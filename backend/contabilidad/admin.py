from django.contrib import admin
from .models import CuentaPorCobrar, CuentaPorPagar


@admin.register(CuentaPorCobrar)
class CuentaPorCobrarAdmin(admin.ModelAdmin):
    list_display = ["cliente", "monto", "fecha_vencimiento", "estado"]
    list_filter = ["estado"]


@admin.register(CuentaPorPagar)
class CuentaPorPagarAdmin(admin.ModelAdmin):
    list_display = ["proveedor", "monto", "fecha_vencimiento", "estado"]
    list_filter = ["estado"]
