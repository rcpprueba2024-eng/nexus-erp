from django.contrib import admin
from .models import OrdenTaller, InsumoUsado, FotoEquipo, HistorialEstado, DetalleComputadora


class InsumoUsadoInline(admin.TabularInline):
    model = InsumoUsado
    extra = 1


class FotoEquipoInline(admin.TabularInline):
    model = FotoEquipo
    extra = 0


class DetalleComputadoraInline(admin.StackedInline):
    model = DetalleComputadora
    extra = 0
    max_num = 1


@admin.register(OrdenTaller)
class OrdenTallerAdmin(admin.ModelAdmin):
    list_display = ["numero", "cliente", "equipo", "tecnico", "estado", "fecha_ingreso"]
    list_filter = ["estado"]
    search_fields = ["numero", "equipo", "imei1", "imei2", "no_serie"]
    inlines = [DetalleComputadoraInline, InsumoUsadoInline, FotoEquipoInline]


@admin.register(HistorialEstado)
class HistorialEstadoAdmin(admin.ModelAdmin):
    list_display = ["orden", "estado_anterior", "estado_nuevo", "usuario", "fecha"]
    list_filter = ["estado_nuevo"]
