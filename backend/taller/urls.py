from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    OrdenTallerViewSet, InsumoUsadoViewSet, FotoEquipoViewSet, HistorialEstadoViewSet, ExportarOrdenesView,
    DiagnosticoOrdenViewSet,
)

router = DefaultRouter()
router.register("ordenes", OrdenTallerViewSet)
router.register("insumos", InsumoUsadoViewSet)
router.register("fotos", FotoEquipoViewSet)
router.register("historial", HistorialEstadoViewSet)
router.register("diagnosticos", DiagnosticoOrdenViewSet)

urlpatterns = [
    path("ordenes/exportar/", ExportarOrdenesView.as_view()),
] + router.urls
