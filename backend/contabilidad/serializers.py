from rest_framework import serializers
from .models import CuentaPorCobrar, CuentaPorPagar


class CuentaPorCobrarSerializer(serializers.ModelSerializer):
    cliente_nombre = serializers.CharField(source="cliente.nombre", read_only=True)

    class Meta:
        model = CuentaPorCobrar
        fields = "__all__"


class CuentaPorPagarSerializer(serializers.ModelSerializer):
    proveedor_nombre = serializers.CharField(source="proveedor.nombre", read_only=True)

    class Meta:
        model = CuentaPorPagar
        fields = "__all__"
