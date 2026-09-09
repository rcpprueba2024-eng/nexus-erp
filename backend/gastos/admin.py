from django.contrib import admin
from .models import CategoriaGasto, CajaChica, Gasto


@admin.register(CategoriaGasto)
class CategoriaGastoAdmin(admin.ModelAdmin):
    list_display = ["nombre", "descripcion"]
    search_fields = ["nombre"]


@admin.register(CajaChica)
class CajaChicaAdmin(admin.ModelAdmin):
    list_display = ["saldo_actual", "actualizado_en"]


@admin.register(Gasto)
class GastoAdmin(admin.ModelAdmin):
    list_display = ["fecha", "descripcion", "categoria", "monto", "saldo_resultante", "registrado_por"]
    list_filter = ["categoria"]
    search_fields = ["descripcion"]
