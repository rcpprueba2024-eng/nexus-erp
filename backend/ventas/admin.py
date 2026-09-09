from django.contrib import admin
from .models import Cliente, Factura, DetalleFactura


class DetalleFacturaInline(admin.TabularInline):
    model = DetalleFactura
    extra = 1


@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ["nombre", "documento", "email", "telefono"]
    search_fields = ["nombre", "documento"]


@admin.register(Factura)
class FacturaAdmin(admin.ModelAdmin):
    list_display = ["numero", "cliente", "fecha", "estado", "total"]
    list_filter = ["estado"]
    inlines = [DetalleFacturaInline]
