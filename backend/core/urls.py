from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LoginView, MeView, ConfiguracionView, UsuarioViewSet, RegistroActividadViewSet

router = DefaultRouter()
router.register("usuarios", UsuarioViewSet, basename="usuario")
router.register("actividad", RegistroActividadViewSet, basename="actividad")

urlpatterns = [
    path("login/", LoginView.as_view()),
    path("me/", MeView.as_view()),
    path("configuracion/", ConfiguracionView.as_view()),
    path("", include(router.urls)),
]
