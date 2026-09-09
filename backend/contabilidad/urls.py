from rest_framework.routers import DefaultRouter
from .views import CuentaPorCobrarViewSet, CuentaPorPagarViewSet

router = DefaultRouter()
router.register("cuentas-por-cobrar", CuentaPorCobrarViewSet)
router.register("cuentas-por-pagar", CuentaPorPagarViewSet)

urlpatterns = router.urls
