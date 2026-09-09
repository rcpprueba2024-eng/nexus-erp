from django.contrib import admin
from .models import CategoriaProducto, SubcategoriaProducto, Marca, Producto, MovimientoInventario


@admin.register(CategoriaProducto)
class CategoriaProductoAdmin(admin.ModelAdmin):
    list_display = ["nombre", "tipo", "descripcion"]
    list_filter = ["tipo"]


@admin.register(SubcategoriaProducto)
class SubcategoriaProductoAdmin(admin.ModelAdmin):
    list_display = ["nombre", "categoria", "descripcion"]
    list_filter = ["categoria"]


@admin.register(Marca)
class MarcaAdmin(admin.ModelAdmin):
    list_display = ["nombre"]
    search_fields = ["nombre"]


@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    list_display = ["codigo", "nombre", "marca", "subgrupo", "categoria", "moneda", "precio_venta", "stock_actual", "activo"]
    list_filter = ["subgrupo", "categoria", "marca", "moneda", "activo"]
    search_fields = ["codigo", "nombre"]


@admin.register(MovimientoInventario)
class MovimientoInventarioAdmin(admin.ModelAdmin):
    list_display = ["producto", "tipo", "cantidad", "fecha"]
    list_filter = ["tipo"]
