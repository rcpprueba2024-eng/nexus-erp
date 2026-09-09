from rest_framework.routers import DefaultRouter

from .views import ArqueoCajaViewSet

router = DefaultRouter()
router.register("arqueos", ArqueoCajaViewSet)

urlpatterns = router.urls
