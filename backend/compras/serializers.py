from rest_framework import serializers
from .models import (
    Proveedor, OrdenCompra, DetalleOrdenCompra,
    CotizacionCliente, ItemCotizacionCliente,
)


class ProveedorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Proveedor
        fields = "__all__"


class DetalleOrdenCompraSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True)

    class Meta:
        model = DetalleOrdenCompra
        fields = "__all__"
        read_only_fields = ["subtotal"]


class OrdenCompraSerializer(serializers.ModelSerializer):
    proveedor_nombre = serializers.CharField(source="proveedor.nombre", read_only=True)
    detalles = DetalleOrdenCompraSerializer(many=True, read_only=True)

    class Meta:
        model = OrdenCompra
        fields = "__all__"
        read_only_fields = ["total"]


class ItemCotizacionClienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemCotizacionCliente
        fields = "__all__"


class CotizacionClienteSerializer(serializers.ModelSerializer):
    items = ItemCotizacionClienteSerializer(many=True, read_only=True)

    class Meta:
        model = CotizacionCliente
        fields = "__all__"
