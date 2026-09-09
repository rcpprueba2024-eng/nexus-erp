from rest_framework import viewsets
from core.permissions import role_permission
from .models import CuentaPorCobrar, CuentaPorPagar
from .serializers import CuentaPorCobrarSerializer, CuentaPorPagarSerializer

CONTABILIDAD_ROLES = ("BACKOFFICE",)


class CuentaPorCobrarViewSet(viewsets.ModelViewSet):
    queryset = CuentaPorCobrar.objects.select_related("cliente", "factura").all()
    serializer_class = CuentaPorCobrarSerializer

    def get_permissions(self):
        # Ventas necesita poder VER el saldo pendiente de un cliente desde
        # su ficha (para saber si le puede seguir fiando) — administrar
        # cuentas por cobrar (crear/editar/borrar) sigue siendo solo de
        # Backoffice.
        if self.action in ("list", "retrieve"):
            return [role_permission(*CONTABILIDAD_ROLES, "VENTAS", modules=("contabilidad", "clientes"))()]
        return [role_permission(*CONTABILIDAD_ROLES, modules="contabilidad")()]

    def get_queryset(self):
        qs = super().get_queryset()
        cliente_id = self.request.query_params.get("cliente")
        if cliente_id:
            qs = qs.filter(cliente_id=cliente_id)
        return qs


class CuentaPorPagarViewSet(viewsets.ModelViewSet):
    queryset = CuentaPorPagar.objects.all()
    serializer_class = CuentaPorPagarSerializer
    permission_classes = [role_permission(*CONTABILIDAD_ROLES, modules="contabilidad")]
