from rest_framework import serializers

from .models import ArqueoCaja


class ArqueoCajaSerializer(serializers.ModelSerializer):
    creado_por_nombre = serializers.CharField(source="creado_por.username", read_only=True, default=None)
    cerrada_por_nombre = serializers.CharField(source="cerrada_por.username", read_only=True, default=None)

    class Meta:
        model = ArqueoCaja
        fields = "__all__"
        # "estado" queda escribible a propósito: lo manda el frontend al
        # cerrar (PATCH con estado="CERRADA") — la vista decide ahí mismo si
        # eso cuenta como el cierre real y sella cerrada_por/cerrada_en
        # (ver ArqueoCajaViewSet.perform_update).
        read_only_fields = ["creado_por", "creado_en", "cerrada_por", "cerrada_en"]
