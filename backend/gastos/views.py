from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from core.permissions import role_permission
from .models import CategoriaGasto, CajaChica, Gasto
from .serializers import CategoriaGastoSerializer, CajaChicaSerializer, GastoSerializer

GASTOS_ROLES = ("BACKOFFICE",)


class CategoriaGastoViewSet(viewsets.ModelViewSet):
    queryset = CategoriaGasto.objects.all()
    serializer_class = CategoriaGastoSerializer
    permission_classes = [role_permission(*GASTOS_ROLES, modules="gastos")]


class GastoViewSet(viewsets.ModelViewSet):
    queryset = Gasto.objects.select_related("categoria", "registrado_por").all()
    serializer_class = GastoSerializer
    permission_classes = [role_permission(*GASTOS_ROLES, modules="gastos")]

    def perform_create(self, serializer):
        serializer.save(registrado_por=self.request.user)


class CajaChicaView(APIView):
    """Fila única con el saldo de caja chica — mismo patrón que
    core.views.ConfiguracionView. El PATCH sirve para la apertura inicial
    o para registrar una reposición de fondos (no pasa por Gasto porque no
    es un gasto: es dinero que ENTRA a la caja)."""
    permission_classes = [role_permission(*GASTOS_ROLES, modules="gastos")]

    def get(self, request):
        return Response(CajaChicaSerializer(CajaChica.actual()).data)

    def patch(self, request):
        caja = CajaChica.actual()
        if "saldo_actual" in request.data:
            caja.saldo_actual = request.data["saldo_actual"]
        caja.save()
        return Response(CajaChicaSerializer(caja).data)
