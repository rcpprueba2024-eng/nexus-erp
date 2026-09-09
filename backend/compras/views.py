from django.db.models import Prefetch
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from core.permissions import role_permission
from .models import (
    Proveedor, OrdenCompra, DetalleOrdenCompra,
    CotizacionCliente, ItemCotizacionCliente,
)
from .serializers import (
    ProveedorSerializer, OrdenCompraSerializer, DetalleOrdenCompraSerializer,
    CotizacionClienteSerializer, ItemCotizacionClienteSerializer,
)
from .cotizacion_cliente_excel import cotizacion_cliente_excel_response
from .pdf_cotizacion_cliente import build_cotizacion_cliente_pdf_response

COMPRAS_ROLES = ("BACKOFFICE", "TALLER")


class ProveedorViewSet(viewsets.ModelViewSet):
    queryset = Proveedor.objects.all()
    serializer_class = ProveedorSerializer
    permission_classes = [role_permission(*COMPRAS_ROLES, modules="compras")]


class OrdenCompraViewSet(viewsets.ModelViewSet):
    # Mismo motivo que en ventas/views.py: sin esto, listar el historial de
    # compras dispara una consulta extra por proveedor y por cada producto
    # de cada línea de detalle.
    queryset = OrdenCompra.objects.select_related("proveedor").prefetch_related(
        Prefetch("detalles", queryset=DetalleOrdenCompra.objects.select_related("producto"))
    ).all()
    serializer_class = OrdenCompraSerializer
    permission_classes = [role_permission(*COMPRAS_ROLES, modules="compras")]


class DetalleOrdenCompraViewSet(viewsets.ModelViewSet):
    queryset = DetalleOrdenCompra.objects.select_related("producto", "orden").all()
    serializer_class = DetalleOrdenCompraSerializer
    permission_classes = [role_permission(*COMPRAS_ROLES, modules="compras")]


class CotizacionClienteViewSet(viewsets.ModelViewSet):
    queryset = CotizacionCliente.objects.prefetch_related("items").all()
    serializer_class = CotizacionClienteSerializer
    permission_classes = [role_permission(*COMPRAS_ROLES, modules="compras")]

    @action(detail=True, methods=["get"])
    def excel(self, request, pk=None):
        return cotizacion_cliente_excel_response(self.get_object())

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        return build_cotizacion_cliente_pdf_response(self.get_object())


class ItemCotizacionClienteViewSet(viewsets.ModelViewSet):
    queryset = ItemCotizacionCliente.objects.select_related("cotizacion").all()
    serializer_class = ItemCotizacionClienteSerializer
    permission_classes = [role_permission(*COMPRAS_ROLES, modules="compras")]
