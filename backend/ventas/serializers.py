from rest_framework import serializers
from .models import Cliente, Empresa, Equipo, Factura, DetalleFactura, Pago, DIAS_CLIENTE_FRECUENTE, UMBRAL_CLIENTE_FRECUENTE


class EmpresaSerializer(serializers.ModelSerializer):
    cantidad_contactos = serializers.SerializerMethodField()
    cantidad_equipos = serializers.SerializerMethodField()

    class Meta:
        model = Empresa
        fields = "__all__"

    def get_cantidad_contactos(self, obj):
        return getattr(obj, "n_contactos", None) if getattr(obj, "n_contactos", None) is not None else obj.contactos.count()

    def get_cantidad_equipos(self, obj):
        if getattr(obj, "n_equipos", None) is not None:
            return obj.n_equipos
        return Equipo.objects.filter(cliente__empresa=obj).count()


class ClienteSerializer(serializers.ModelSerializer):
    empresa_nombre = serializers.CharField(source="empresa.nombre", read_only=True)
    # Automático: activo si tuvo una OT o factura dentro de la ventana
    # DIAS_CLIENTE_FRECUENTE. Se apoya en las anotaciones que arma
    # ClienteViewSet.get_queryset() (evita golpear la DB fila por fila).
    frecuente = serializers.SerializerMethodField()

    class Meta:
        model = Cliente
        fields = "__all__"

    def get_frecuente(self, obj):
        n = getattr(obj, "n_ordenes_recientes", None)
        m = getattr(obj, "n_facturas_recientes", None)
        if n is None or m is None:
            return None
        return (n + m) >= UMBRAL_CLIENTE_FRECUENTE


class EquipoSerializer(serializers.ModelSerializer):
    cliente_nombre = serializers.CharField(source="cliente.nombre", read_only=True)
    marca_nombre = serializers.CharField(source="marca.nombre", read_only=True)
    modelo_nombre = serializers.CharField(source="modelo.nombre", read_only=True)
    cantidad_ordenes = serializers.SerializerMethodField()

    class Meta:
        model = Equipo
        fields = "__all__"

    def get_cantidad_ordenes(self, obj):
        return getattr(obj, "n_ordenes", None) if getattr(obj, "n_ordenes", None) is not None else obj.ordenes.count()


class DetalleFacturaSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True)
    orden_taller_numero = serializers.SerializerMethodField()

    class Meta:
        model = DetalleFactura
        fields = "__all__"
        read_only_fields = ["subtotal"]

    def get_orden_taller_numero(self, obj):
        orden = getattr(obj, "orden_generada", None)
        return orden.numero if orden else None


class PagoSerializer(serializers.ModelSerializer):
    vuelto = serializers.ReadOnlyField()

    class Meta:
        model = Pago
        fields = "__all__"


class FacturaSerializer(serializers.ModelSerializer):
    cliente_nombre = serializers.CharField(source="cliente.nombre", read_only=True)
    vendedor_nombre = serializers.CharField(source="vendedor.username", read_only=True)
    detalles = DetalleFacturaSerializer(many=True, read_only=True)
    pagos = PagoSerializer(many=True, read_only=True)
    total_pagado = serializers.ReadOnlyField()
    saldo_pendiente = serializers.ReadOnlyField()
    # Si alguna vez existió una Cuenta por Cobrar para esta factura, fue una
    # venta al crédito (aunque ya esté saldada) — si nunca la hubo, fue al
    # contado. Para el historial de compras del cliente.
    tuvo_credito = serializers.SerializerMethodField()

    class Meta:
        model = Factura
        fields = "__all__"
        read_only_fields = ["total", "total_usd", "tasa_cambio_aplicada", "vendedor"]

    def get_tuvo_credito(self, obj):
        return obj.cuentas_por_cobrar.exists()
