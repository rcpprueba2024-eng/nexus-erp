from rest_framework import serializers
from .models import OrdenTaller, InsumoUsado, FotoEquipo, HistorialEstado, DetalleComputadora, DiagnosticoOrden


class DetalleComputadoraSerializer(serializers.ModelSerializer):
    tipo_equipo_display = serializers.CharField(source="get_tipo_equipo_display", read_only=True)
    tecnico_recibe_nombre = serializers.CharField(source="tecnico_recibe.nombre", read_only=True, default=None)
    tecnico_entrega_nombre = serializers.CharField(source="tecnico_entrega.nombre", read_only=True, default=None)

    class Meta:
        model = DetalleComputadora
        exclude = ["orden"]


class DetalleComputadoraWritableMixin:
    """Permite guardar `detalle_com` anidado en un solo POST/PUT/PATCH de la
    orden, en vez de exigir una segunda llamada al endpoint de detalle-com.
    Solo aplica cuando la orden es de tipo COM (ver OrdenTaller.tipo_orden);
    para una orden CCA el bloque simplemente se ignora si llega."""

    def create(self, validated_data):
        detalle_data = validated_data.pop("detalle_com", None)
        instancia = super().create(validated_data)
        if detalle_data is not None and instancia.tipo_orden == "COM":
            DetalleComputadora.objects.create(orden=instancia, **detalle_data)
        return instancia

    def update(self, instance, validated_data):
        detalle_data = validated_data.pop("detalle_com", None)
        instancia = super().update(instance, validated_data)
        if detalle_data is not None and instancia.tipo_orden == "COM":
            DetalleComputadora.objects.update_or_create(orden=instancia, defaults=detalle_data)
        return instancia


class InsumoUsadoSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True)

    class Meta:
        model = InsumoUsado
        fields = "__all__"


class FotoEquipoSerializer(serializers.ModelSerializer):
    class Meta:
        model = FotoEquipo
        fields = "__all__"


class DiagnosticoOrdenSerializer(serializers.ModelSerializer):
    tecnico_nombre = serializers.CharField(source="tecnico.nombre", read_only=True, default=None)
    fotos = FotoEquipoSerializer(many=True, read_only=True)

    class Meta:
        model = DiagnosticoOrden
        fields = "__all__"


class HistorialEstadoSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source="usuario.username", read_only=True)
    estado_anterior_display = serializers.SerializerMethodField()
    estado_nuevo_display = serializers.SerializerMethodField()

    class Meta:
        model = HistorialEstado
        fields = "__all__"

    def _label(self, code):
        return dict(OrdenTaller.ESTADO_CHOICES).get(code, code)

    def get_estado_anterior_display(self, obj):
        return self._label(obj.estado_anterior) if obj.estado_anterior else None

    def get_estado_nuevo_display(self, obj):
        return self._label(obj.estado_nuevo)


class ExpedienteMixin:
    """Historial de otras OTs del mismo Equipo (expediente) — no depende de
    tener cliente_nombre en el serializer que lo use, así que es seguro
    reutilizarlo también en la vista de Taller/Pasante sin exponer datos
    de cliente."""

    def get_expediente(self, obj):
        # Solo se calcula en el detalle de una orden (retrieve): en el
        # listado sería una consulta más por cada una de las 1500+ filas.
        view = self.context.get("view")
        if view is not None and getattr(view, "action", None) != "retrieve":
            return []
        if not obj.equipo_vinculado_id:
            return []
        otras = obj.equipo_vinculado.ordenes.exclude(id=obj.id).order_by("-fecha_ingreso")[:20]
        return [
            {
                "id": o.id, "numero": o.numero, "fecha_ingreso": o.fecha_ingreso,
                "estado": o.estado, "estado_display": o.get_estado_display(),
                "problema_reportado": o.problema_reportado,
            }
            for o in otras
        ]


class OrdenTallerSerializer(DetalleComputadoraWritableMixin, ExpedienteMixin, serializers.ModelSerializer):
    """Vista completa: Backoffice / Gerencia."""
    cliente_nombre = serializers.CharField(source="cliente.nombre", read_only=True)
    cliente_telefono = serializers.CharField(source="cliente.telefono", read_only=True, default=None)
    cliente_problematico = serializers.BooleanField(source="cliente.es_problematico", read_only=True, default=False)
    cliente_motivo_problematico = serializers.CharField(source="cliente.motivo_problematico", read_only=True, default="")
    tecnico_nombre = serializers.CharField(source="tecnico.nombre", read_only=True)
    asesor_nombre = serializers.CharField(source="asesor.nombre", read_only=True, default=None)
    tipo_servicio_display = serializers.CharField(source="get_tipo_servicio_display", read_only=True)
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)
    vendedor_nombre = serializers.CharField(source="vendedor.username", read_only=True)
    equipo_marca = serializers.CharField(source="equipo_vinculado.marca.nombre", read_only=True, default=None)
    equipo_modelo = serializers.CharField(source="equipo_vinculado.modelo.nombre", read_only=True, default=None)
    expediente = serializers.SerializerMethodField()
    insumos = InsumoUsadoSerializer(many=True, read_only=True)
    fotos = FotoEquipoSerializer(many=True, read_only=True)
    diagnosticos = DiagnosticoOrdenSerializer(many=True, read_only=True)
    historial = HistorialEstadoSerializer(many=True, read_only=True)
    total_repuestos = serializers.ReadOnlyField()
    total_servicios = serializers.ReadOnlyField()
    total_final = serializers.ReadOnlyField()
    tipo_orden = serializers.ReadOnlyField()
    detalle_com = DetalleComputadoraSerializer(required=False, allow_null=True)
    # Estado de facturación — usado por Facturación > Facturar OTs para
    # separar en taller / lista para pagar / ya pagada.
    factura_numero = serializers.CharField(source="origen_venta.factura.numero", read_only=True, default=None)
    factura_estado = serializers.CharField(source="origen_venta.factura.estado", read_only=True, default=None)
    factura_saldo_pendiente = serializers.DecimalField(source="origen_venta.factura.saldo_pendiente", read_only=True, default=None, max_digits=12, decimal_places=2)
    # Plazo de retiro / resguardo — ver Equipos Listos y Equipos en Abandono.
    fecha_listo = serializers.ReadOnlyField()
    dias_en_espera = serializers.ReadOnlyField()
    cargo_resguardo = serializers.ReadOnlyField()
    vencido_para_abandono = serializers.ReadOnlyField()

    class Meta:
        model = OrdenTaller
        fields = "__all__"
        # `numero` lo asigna el backend (consecutivo real por COM/CCA, ver
        # Configuracion.siguiente_numero_orden) — no lo manda el frontend.
        extra_kwargs = {"numero": {"required": False}}


class OrdenTallerTecnicoSerializer(DetalleComputadoraWritableMixin, ExpedienteMixin, serializers.ModelSerializer):
    """Vista para el rol Taller/Pasante: sin ningún dato del cliente (ni nombre,
    ni contacto, ni firma) — solo lo necesario para trabajar el equipo: número
    de orden, tipo de equipo, fallas/diagnóstico y fotos. `expediente` sí es
    seguro: solo trae otras OTs del mismo equipo, nunca datos de cliente."""
    tecnico_nombre = serializers.CharField(source="tecnico.nombre", read_only=True)
    tipo_servicio_display = serializers.CharField(source="get_tipo_servicio_display", read_only=True)
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)
    equipo_marca = serializers.CharField(source="equipo_vinculado.marca.nombre", read_only=True, default=None)
    equipo_modelo = serializers.CharField(source="equipo_vinculado.modelo.nombre", read_only=True, default=None)
    expediente = serializers.SerializerMethodField()
    insumos = InsumoUsadoSerializer(many=True, read_only=True)
    fotos = FotoEquipoSerializer(many=True, read_only=True)
    diagnosticos = DiagnosticoOrdenSerializer(many=True, read_only=True)
    historial = HistorialEstadoSerializer(many=True, read_only=True)
    total_repuestos = serializers.ReadOnlyField()
    total_servicios = serializers.ReadOnlyField()
    tipo_orden = serializers.ReadOnlyField()
    detalle_com = DetalleComputadoraSerializer(required=False, allow_null=True)

    class Meta:
        model = OrdenTaller
        fields = [
            "id", "numero", "equipo", "equipo_vinculado", "equipo_marca", "equipo_modelo", "expediente",
            "categoria_equipo", "tipo_orden",
            "tipo_servicio", "tipo_servicio_display", "problema_reportado", "instrucciones_asesor",
            "tecnico", "tecnico_nombre", "estado", "estado_display", "fecha_ingreso", "fecha_hora_recepcion",
            "fecha_entrega_estimada", "fecha_entrega_real", "tiempo_reparacion_estimado", "notas",
            "marca", "modelo", "color", "capacidad", "estado_general", "no_serie", "especificaciones",
            "imei1", "imei2", "numero_chip", "encendido", "sistema_operativo", "operadora_equipo",
            "bateria_original", "camara_funciona",
            "accesorios", "contrasena_equipo", "patron_desbloqueo", "danos_visibles",
            "estado_equipo_notas", "comentarios",
            "checklist_entrada", "checklist_salida",
            "tipos_servicio", "tipos_servicio_otro",
            "diagnostico", "recomendaciones", "repuestos", "necesita_repuestos", "forma_pago",
            "servicios_realizados", "descuento", "impuestos", "total_repuestos", "total_servicios",
            "firma_tecnico", "observaciones",
            "insumos", "fotos", "diagnosticos", "historial", "detalle_com",
        ]
