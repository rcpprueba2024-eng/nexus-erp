from rest_framework.routers import DefaultRouter
from .views import ClienteViewSet, EmpresaViewSet, EquipoViewSet, FacturaViewSet, DetalleFacturaViewSet, PagoViewSet

router = DefaultRouter()
router.register("clientes", ClienteViewSet, basename="cliente")
router.register("empresas", EmpresaViewSet, basename="empresa")
router.register("equipos", EquipoViewSet, basename="equipo")
router.register("facturas", FacturaViewSet)
router.register("detalles", DetalleFacturaViewSet)
router.register("pagos", PagoViewSet)

urlpatterns = router.urls
