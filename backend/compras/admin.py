from django.contrib import admin
from .models import Proveedor, OrdenCompra, DetalleOrdenCompra


class DetalleOrdenCompraInline(admin.TabularInline):
    model = DetalleOrdenCompra
    extra = 1


@admin.register(Proveedor)
class ProveedorAdmin(admin.ModelAdmin):
    list_display = ["nombre", "documento", "email", "telefono"]
    search_fields = ["nombre", "documento"]


@admin.register(OrdenCompra)
class OrdenCompraAdmin(admin.ModelAdmin):
    list_display = ["numero", "proveedor", "fecha", "estado", "total"]
    list_filter = ["estado"]
    inlines = [DetalleOrdenCompraInline]
