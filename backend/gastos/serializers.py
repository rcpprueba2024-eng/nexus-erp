from rest_framework import serializers
from .models import CategoriaGasto, CajaChica, Gasto


class CategoriaGastoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoriaGasto
        fields = "__all__"


class CajaChicaSerializer(serializers.ModelSerializer):
    class Meta:
        model = CajaChica
        fields = "__all__"


class GastoSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.CharField(source="categoria.nombre", read_only=True)
    registrado_por_nombre = serializers.CharField(source="registrado_por.username", read_only=True)

    class Meta:
        model = Gasto
        fields = "__all__"
        read_only_fields = ["saldo_resultante", "registrado_por"]
