from rest_framework.routers import DefaultRouter
from .views import (
    ProveedorViewSet, OrdenCompraViewSet, DetalleOrdenCompraViewSet,
    CotizacionClienteViewSet, ItemCotizacionClienteViewSet,
)

router = DefaultRouter()
router.register("proveedores", ProveedorViewSet)
router.register("ordenes", OrdenCompraViewSet)
router.register("detalles", DetalleOrdenCompraViewSet)
router.register("cotizaciones-clientes", CotizacionClienteViewSet)
router.register("items-cotizacion-cliente", ItemCotizacionClienteViewSet)

urlpatterns = router.urls
