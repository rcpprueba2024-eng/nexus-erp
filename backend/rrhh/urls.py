from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    EmpleadoViewSet, RegistroHorasViewSet, ReporteHorasView, ReporteAsistenciaView,
    ReporteAsistenciaExcelView, HorarioEmpleadoViewSet, PermisoEmpleadoViewSet,
    UniformeDiaViewSet, DocumentoEmpleadoViewSet, SaldoVacacionesView,
)

router = DefaultRouter()
router.register("empleados", EmpleadoViewSet)
router.register("registros-horas", RegistroHorasViewSet)
router.register("horarios", HorarioEmpleadoViewSet)
router.register("permisos", PermisoEmpleadoViewSet)
router.register("uniforme-dias", UniformeDiaViewSet)
router.register("documentos", DocumentoEmpleadoViewSet)

urlpatterns = [
    path("reporte-horas/", ReporteHorasView.as_view()),
    path("reporte-asistencia/", ReporteAsistenciaView.as_view()),
    path("reporte-asistencia/exportar/", ReporteAsistenciaExcelView.as_view()),
    path("vacaciones/saldo/", SaldoVacacionesView.as_view()),
] + router.urls
