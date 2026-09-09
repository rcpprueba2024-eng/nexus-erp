from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    CategoriaProductoViewSet, SubcategoriaProductoViewSet, MarcaViewSet, ModeloViewSet,
    ProductoViewSet, MovimientoInventarioViewSet, ImportarProductosView, UnidadMedidaViewSet,
    BajaProductoViewSet,
)

router = DefaultRouter()
router.register("categorias", CategoriaProductoViewSet)
router.register("subcategorias", SubcategoriaProductoViewSet)
router.register("marcas", MarcaViewSet)
router.register("modelos", ModeloViewSet)
router.register("unidades", UnidadMedidaViewSet)
router.register("productos", ProductoViewSet)
router.register("movimientos", MovimientoInventarioViewSet)
router.register("bajas", BajaProductoViewSet)

urlpatterns = [
    path("importar/", ImportarProductosView.as_view()),
] + router.urls
