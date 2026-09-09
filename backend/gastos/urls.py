from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import CategoriaGastoViewSet, GastoViewSet, CajaChicaView

router = DefaultRouter()
router.register("categorias", CategoriaGastoViewSet)
router.register("gastos", GastoViewSet)

urlpatterns = [
    path("caja-chica/", CajaChicaView.as_view()),
] + router.urls
