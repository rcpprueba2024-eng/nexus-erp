from django.db.models import Q
from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from core.choices import CATEGORIA_EQUIPO_CCA
from core.models import Configuracion
from core.permissions import role_permission
from .models import OrdenTaller, InsumoUsado, FotoEquipo, HistorialEstado, DiagnosticoOrden
from .serializers import (
    OrdenTallerSerializer, OrdenTallerTecnicoSerializer, InsumoUsadoSerializer,
    FotoEquipoSerializer, HistorialEstadoSerializer, DiagnosticoOrdenSerializer,
)

TALLER_ROLES = ("TALLER", "BACKOFFICE")
ORDEN_ROLES = ("TALLER", "BACKOFFICE", "VENTAS")
# Tope por diagnóstico, no por orden — cada diagnóstico nuevo vuelve a
# empezar en 0. Es una red de seguridad más que un límite real de uso.
MAX_FOTOS_POR_DIAGNOSTICO = 100


def _rol(user):
    if user.is_superuser:
        return "ADMIN"
    perfil = getattr(user, "perfil", None)
    return perfil.rol if perfil else None


ROLES_SIN_DATOS_CLIENTE = ("TALLER", "PASANTE")

# Los datos de la orden (cliente, equipo, servicio, etc.) solo los edita
# Gerencia una vez creada la OT. El resto de roles solo opera el tablero de
# Taller: avanza el estado, asigna técnico, marca el checklist de salida,
# deja una nota, escribe su diagnóstico, o — desde Facturar OTs — completa
# el checklist de salida y la firma de "recibí conforme" al momento de
# cobrar, sin poder tocar el resto del formulario de ingreso.
CAMPOS_TALLER_PERMITIDOS = {"estado", "tecnico", "checklist_salida", "notas", "diagnostico", "firma_cliente_entrega"}


class OrdenTallerViewSet(viewsets.ModelViewSet):
    queryset = OrdenTaller.objects.all()
    permission_classes = [role_permission(*ORDEN_ROLES, "PASANTE", modules=("ordenes", "taller"))]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_class(self):
        if _rol(self.request.user) in ROLES_SIN_DATOS_CLIENTE:
            return OrdenTallerTecnicoSerializer
        return OrdenTallerSerializer

    def create(self, request, *args, **kwargs):
        if _rol(request.user) in ROLES_SIN_DATOS_CLIENTE:
            return Response({"detail": "El personal de taller no tiene permiso para crear órdenes."}, status=403)
        return super().create(request, *args, **kwargs)

    def list(self, request, *args, **kwargs):
        # Sin acceso a Task Scheduler de Windows en este entorno para correr
        # esto una vez al día — en su lugar se revisa "al vuelo" cada vez que
        # se lista, así los equipos vencidos pasan a ABANDONADO en la
        # práctica igual de rápido (el tablero se consulta muchas veces al
        # día) sin depender de infraestructura externa.
        candidatas = OrdenTaller.objects.filter(estado="LISTO_ENTREGA").prefetch_related("historial")
        for orden in candidatas:
            orden.verificar_abandono()
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        # El serializer trae cliente_nombre/tecnico_nombre/asesor_nombre/
        # vendedor_nombre (4 FKs atravesados por cada fila) — sin
        # select_related, listar 1500 órdenes dispara miles de consultas
        # extra y tarda ~19s en vez de milisegundos.
        # insumos/fotos/historial son FKs inversas que el serializer anida
        # completas: sin prefetch_related, cada una dispara una consulta más
        # POR FILA (3 x 1500 = 4500 consultas extra al listar).
        qs = OrdenTaller.objects.select_related(
            "cliente", "tecnico", "asesor", "vendedor", "equipo_vinculado", "equipo_vinculado__marca", "equipo_vinculado__modelo",
            "origen_venta", "origen_venta__factura",
        ).prefetch_related(
            "insumos", "insumos__producto", "fotos", "historial", "historial__usuario", "origen_venta__factura__pagos",
        ).all()
        buscar = self.request.query_params.get("buscar")
        if buscar:
            qs = qs.filter(
                Q(numero__icontains=buscar) | Q(cliente__nombre__icontains=buscar) |
                Q(cliente__telefono__icontains=buscar) | Q(equipo__icontains=buscar) |
                Q(imei1__icontains=buscar) | Q(imei2__icontains=buscar) |
                Q(no_serie__icontains=buscar) | Q(tecnico__nombre__icontains=buscar)
            )
        # Historial de reparaciones del cliente / del equipo (por número de serie).
        cliente_id = self.request.query_params.get("cliente")
        if cliente_id:
            qs = qs.filter(cliente_id=cliente_id)
        no_serie = self.request.query_params.get("no_serie")
        if no_serie:
            qs = qs.filter(no_serie=no_serie)
        excluir = self.request.query_params.get("excluir")
        if excluir:
            qs = qs.exclude(pk=excluir)
        return qs

    def perform_update(self, serializer):
        rol = _rol(self.request.user)
        # Backoffice analiza procesos (ve técnico, asesor, cliente, factura)
        # pero no edita ni elimina — a diferencia de Taller/Ventas, que sí
        # cambian estado/checklist de salida en su día a día.
        if rol == "BACKOFFICE":
            raise PermissionDenied("Backoffice puede ver las órdenes, pero no editarlas — eso es de Taller/Ventas/Gerencia.")
        if rol != "ADMIN":
            no_permitidos = set(self.request.data.keys()) - CAMPOS_TALLER_PERMITIDOS
            if no_permitidos:
                raise PermissionDenied(
                    "Solo Gerencia puede editar los datos de la orden. Tu rol solo puede "
                    "cambiar estado, técnico, checklist de salida o dejar una nota."
                )
        anterior = self.get_object().estado
        instancia = serializer.save()
        if instancia.estado != anterior:
            HistorialEstado.objects.create(
                orden=instancia, estado_anterior=anterior, estado_nuevo=instancia.estado,
                usuario=self.request.user,
            )

    def perform_create(self, serializer):
        categoria = serializer.validated_data.get("categoria_equipo", "COMPUTADORA")
        tipo = "CCA" if categoria in CATEGORIA_EQUIPO_CCA else "COM"
        numero = Configuracion.siguiente_numero_orden(tipo)
        instancia = serializer.save(vendedor=self.request.user, numero=numero)
        HistorialEstado.objects.create(
            orden=instancia, estado_anterior="", estado_nuevo=instancia.estado,
            usuario=self.request.user,
        )

    def perform_destroy(self, instance):
        if _rol(self.request.user) != "ADMIN":
            raise PermissionDenied("Solo Gerencia puede eliminar una orden de trabajo.")
        instance.delete()

    @action(detail=True, methods=["post"])
    def facturar(self, request, pk=None):
        """Genera la factura de una OT ya existente (creada directamente, no
        desde una venta) — la busca el vendedor en Facturación > Facturar
        OTs, revisa el total y cobra. No usa el flujo normal de
        DetalleFactura tipo=SERVICIO (ese crea una OT nueva); aquí la OT
        YA existe, solo se le asocia la factura vía origen_venta."""
        if _rol(request.user) in ROLES_SIN_DATOS_CLIENTE:
            return Response({"detail": "El personal de taller no tiene permiso para facturar."}, status=403)
        orden = self.get_object()
        if orden.origen_venta_id:
            return Response({"detail": "Esta orden ya fue facturada."}, status=409)

        from core.models import Configuracion
        from ventas.models import Factura, DetalleFactura, Pago
        from ventas.serializers import FacturaSerializer

        moneda = request.data.get("moneda") or orden.moneda or "USD"
        pagos_data = request.data.get("pagos") or []
        tasa = Configuracion.actual().tasa_cambio_usd
        # El total de la OT (repuestos + servicios cargados en la orden)
        # puede seguir en 0 si nadie llegó a cargar un precio antes de que
        # taller la pasara a "Listo para entregar" — solo Gerencia puede
        # editar esos campos (ver CAMPOS_TALLER_PERMITIDOS), así que quien
        # factura necesita poder fijar el monto real a cobrar aquí mismo.
        try:
            monto = float(request.data.get("monto"))
        except (TypeError, ValueError):
            monto = orden.total_final
        factura = Factura.objects.create(
            numero=f"FACT-{orden.numero}", cliente=orden.cliente, vendedor=request.user,
            moneda=moneda, tasa_cambio_aplicada=tasa,
        )
        detalle = DetalleFactura.objects.create(
            factura=factura, tipo="PRODUCTO", producto=None,
            descripcion=f"OT {orden.numero} — {orden.equipo}",
            cantidad=1, precio_unitario=monto,
        )
        orden.origen_venta = detalle
        orden.save(update_fields=["origen_venta"])
        for p in pagos_data:
            Pago.objects.create(
                factura=factura, metodo=p.get("metodo"), monto=p.get("monto"),
                monto_recibido=p.get("monto_recibido"),
                cuotas=p.get("cuotas") or None, banco=p.get("banco") or "", referencia=p.get("referencia") or "",
            )
        return Response(FacturaSerializer(factura).data, status=201)

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        """Orden de Recepción y Trabajo como PDF real (ReportLab) — a
        diferencia de "Imprimir/PDF" en pantalla (que imprime el HTML con
        window.print()), este PDF trae el tamaño de página fijo (carta) de
        una vez: no depende de que el navegador y el driver de la
        impresora del cliente se pongan de acuerdo al momento de imprimir,
        que era lo que fallaba con ciertas impresoras (ej. HP Smart) y
        sacaba la orden repartida en 10+ hojas.

        Genera el mismo Excel real del jefe (taller/plantillas_excel/
        orden_com.xlsx y orden_cca.xlsx) convertido a PDF — no una
        recreación aparte — para que salga igual a la plantilla oficial,
        con sus cláusulas y formato exactos (ver taller/orden_excel.py y
        taller/orden_pdf_excel.py)."""
        from .orden_pdf_excel import build_orden_pdf_response

        orden = self.get_object()
        return build_orden_pdf_response(orden, cliente=orden.cliente)

    @action(detail=True, methods=["post"])
    def duplicar(self, request, pk=None):
        """Crea una nueva orden a partir de una existente: mismo cliente/equipo/
        especificaciones, pero número, estado y firmas reiniciados."""
        if _rol(request.user) in ROLES_SIN_DATOS_CLIENTE or _rol(request.user) == "BACKOFFICE":
            return Response({"detail": "Tu rol no tiene permiso para crear órdenes."}, status=403)
        original = self.get_object()
        nuevo = OrdenTaller.objects.get(pk=original.pk)
        nuevo.pk = None
        nuevo.id = None
        nuevo.numero = Configuracion.siguiente_numero_orden(original.tipo_orden)
        nuevo.estado = "RECIBIDO"
        nuevo.fecha_entrega_real = None
        nuevo.firma_cliente = ""
        nuevo.firma_tecnico = ""
        nuevo.aceptacion_cliente = False
        nuevo.recibe = ""
        nuevo.vendedor = request.user
        nuevo.save()

        if original.tipo_orden == "COM" and hasattr(original, "detalle_com"):
            detalle = original.detalle_com
            detalle.pk = None
            detalle.id = None
            detalle.orden = nuevo
            detalle.save()

        HistorialEstado.objects.create(
            orden=nuevo, estado_anterior="", estado_nuevo=nuevo.estado, usuario=request.user,
        )
        return Response(self.get_serializer(nuevo).data, status=201)


class InsumoUsadoViewSet(viewsets.ModelViewSet):
    queryset = InsumoUsado.objects.all()
    serializer_class = InsumoUsadoSerializer
    permission_classes = [role_permission(*TALLER_ROLES, modules="taller")]


class DiagnosticoOrdenViewSet(viewsets.ModelViewSet):
    queryset = DiagnosticoOrden.objects.select_related("tecnico").prefetch_related("fotos").all()
    serializer_class = DiagnosticoOrdenSerializer
    permission_classes = [role_permission(*ORDEN_ROLES, modules=("ordenes", "taller"))]

    def get_queryset(self):
        qs = super().get_queryset()
        orden = self.request.query_params.get("orden")
        if orden:
            qs = qs.filter(orden_id=orden)
        return qs

    def perform_create(self, serializer):
        # Queda registrado quién lo escribió, si el usuario tiene un
        # Empleado vinculado (ver Empleado.usuario) — no es obligatorio.
        empleado = getattr(self.request.user, "empleado", None)
        serializer.save(tecnico=empleado)


class FotoEquipoViewSet(viewsets.ModelViewSet):
    queryset = FotoEquipo.objects.all()
    serializer_class = FotoEquipoSerializer
    permission_classes = [role_permission(*ORDEN_ROLES, modules=("ordenes", "taller"))]
    parser_classes = [MultiPartParser, FormParser]

    def create(self, request, *args, **kwargs):
        diagnostico_orden = request.data.get("diagnostico_orden")
        if diagnostico_orden:
            actuales = FotoEquipo.objects.filter(diagnostico_orden_id=diagnostico_orden).count()
            if actuales >= MAX_FOTOS_POR_DIAGNOSTICO:
                return Response(
                    {"detail": f"Este diagnóstico ya tiene el máximo de {MAX_FOTOS_POR_DIAGNOSTICO} fotos."},
                    status=400,
                )
        return super().create(request, *args, **kwargs)


class HistorialEstadoViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = HistorialEstado.objects.all()
    serializer_class = HistorialEstadoSerializer
    permission_classes = [role_permission(*TALLER_ROLES, modules=("ordenes", "taller"))]


class ExportarOrdenesView(APIView):
    permission_classes = [role_permission(*TALLER_ROLES, modules=("ordenes", "taller"))]

    def get(self, request):
        if _rol(request.user) in ROLES_SIN_DATOS_CLIENTE:
            return Response({"detail": "El personal de taller no tiene permiso para exportar datos de clientes."}, status=403)
        from reportes.excel_utils import simple_workbook, workbook_response

        ordenes = OrdenTaller.objects.all().select_related("cliente", "tecnico")
        rows = [
            [
                o.numero, o.cliente.nombre, o.equipo, o.tecnico.nombre if o.tecnico else "",
                o.get_estado_display(), str(o.fecha_ingreso), f"{o.moneda} {o.total_final:,.2f}",
            ]
            for o in ordenes
        ]
        wb = simple_workbook(
            "Órdenes de Taller",
            ["N° Orden", "Cliente", "Equipo", "Técnico", "Estado", "Fecha ingreso", "Total"],
            rows,
        )
        return workbook_response(wb, "ordenes_taller.xlsx")
