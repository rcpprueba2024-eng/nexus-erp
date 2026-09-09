from datetime import date, timedelta
from django.db.models import Count, Prefetch, Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from core.models import Configuracion
from core.permissions import role_permission
from .models import Cliente, Empresa, Equipo, Factura, DetalleFactura, Pago, DIAS_CLIENTE_FRECUENTE
from .serializers import (
    ClienteSerializer, EmpresaSerializer, EquipoSerializer, FacturaSerializer, DetalleFacturaSerializer, PagoSerializer,
)
from .impresion import imprimir_factura, ImpresionError

VENTAS_ROLES = ("VENTAS", "BACKOFFICE")


class ClienteViewSet(viewsets.ModelViewSet):
    """Taller y Pasante NO tienen acceso: por política, el personal de taller
    no debe ver ningún dato de clientes (ver taller.serializers.OrdenTallerTecnicoSerializer).
    `nunca` blinda esto aunque Gerencia les marque el módulo "clientes" o
    "ventas" por error en Configuración: para estos dos roles nunca vale."""
    permission_classes = [role_permission("VENTAS", "BACKOFFICE", modules=("clientes", "ventas"), nunca=("TALLER", "PASANTE"))]
    serializer_class = ClienteSerializer

    def get_queryset(self):
        # Anotado (no una query por cliente) para que "frecuente" no dispare
        # N+1 al listar cientos de clientes — mismo patrón que ya se usó
        # para eficiencia de técnicos en reportes.
        corte = date.today() - timedelta(days=DIAS_CLIENTE_FRECUENTE)
        return Cliente.objects.select_related("empresa").annotate(
            n_ordenes_recientes=Count("ordenes_taller", filter=Q(ordenes_taller__fecha_ingreso__gte=corte), distinct=True),
            n_facturas_recientes=Count("facturas", filter=Q(facturas__fecha__gte=corte), distinct=True),
        )


class EmpresaViewSet(viewsets.ModelViewSet):
    permission_classes = [role_permission("VENTAS", "BACKOFFICE", modules=("clientes", "ventas"), nunca=("TALLER", "PASANTE"))]
    serializer_class = EmpresaSerializer

    def get_queryset(self):
        return Empresa.objects.annotate(
            n_contactos=Count("contactos", distinct=True),
            n_equipos=Count("contactos__equipos", distinct=True),
        )


class EquipoViewSet(viewsets.ModelViewSet):
    permission_classes = [role_permission("VENTAS", "BACKOFFICE", modules=("clientes", "ventas"), nunca=("TALLER", "PASANTE"))]
    serializer_class = EquipoSerializer

    def get_queryset(self):
        qs = Equipo.objects.select_related("cliente", "marca", "modelo").annotate(n_ordenes=Count("ordenes"))
        cliente_id = self.request.query_params.get("cliente")
        if cliente_id:
            qs = qs.filter(cliente_id=cliente_id)
        return qs


class FacturaViewSet(viewsets.ModelViewSet):
    # La factura trae nombre de cliente embebido (ver FacturaSerializer):
    # mismo blindaje que ClienteViewSet.
    # select_related/prefetch_related: el serializer anida los detalles de
    # cada factura (con su propio producto y orden_generada) — sin esto,
    # listar cientos de facturas dispara miles de consultas extra.
    queryset = Factura.objects.select_related("cliente", "vendedor").prefetch_related(
        Prefetch("detalles", queryset=DetalleFactura.objects.select_related("producto", "orden_generada")),
        "pagos", "cuentas_por_cobrar",
    ).all()
    serializer_class = FacturaSerializer
    permission_classes = [role_permission(*VENTAS_ROLES, modules="ventas", nunca=("TALLER", "PASANTE"))]

    def get_queryset(self):
        qs = super().get_queryset()
        cliente_id = self.request.query_params.get("cliente")
        if cliente_id:
            qs = qs.filter(cliente_id=cliente_id)
        return qs

    def perform_create(self, serializer):
        # La tasa se congela al momento de la venta: si mañana cambia el
        # tipo de cambio, esta factura no debe reinterpretarse sola.
        tasa = Configuracion.actual().tasa_cambio_usd
        serializer.save(vendedor=self.request.user, tasa_cambio_aplicada=tasa)

    @action(detail=True, methods=["post"])
    def imprimir(self, request, pk=None):
        factura = self.get_object()
        try:
            imprimir_factura(factura)
        except ImpresionError as exc:
            return Response({"detail": str(exc)}, status=409)
        return Response({"ok": True})


class DetalleFacturaViewSet(viewsets.ModelViewSet):
    queryset = DetalleFactura.objects.select_related("producto", "orden_generada").all()
    serializer_class = DetalleFacturaSerializer
    permission_classes = [role_permission(*VENTAS_ROLES, modules="ventas")]


class PagoViewSet(viewsets.ModelViewSet):
    queryset = Pago.objects.select_related("factura").all()
    serializer_class = PagoSerializer
    permission_classes = [role_permission(*VENTAS_ROLES, modules="ventas")]
