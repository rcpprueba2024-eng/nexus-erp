from django.contrib import admin
from .models import Empleado, RegistroHoras, HorarioEmpleado, PermisoEmpleado


@admin.register(Empleado)
class EmpleadoAdmin(admin.ModelAdmin):
    list_display = ["nombre", "cedula", "puestos_texto", "areas_texto", "telefono", "email", "activo"]
    list_filter = ["activo"]
    search_fields = ["nombre", "cedula"]
    filter_horizontal = ["equipos_asignados"]

    @admin.display(description="Puestos")
    def puestos_texto(self, obj):
        return ", ".join(obj.puestos)

    @admin.display(description="Áreas")
    def areas_texto(self, obj):
        return ", ".join(obj.areas_display)


@admin.register(RegistroHoras)
class RegistroHorasAdmin(admin.ModelAdmin):
    list_display = ["empleado", "fecha", "horas", "nota"]
    list_filter = ["fecha"]
    search_fields = ["empleado__nombre"]


@admin.register(HorarioEmpleado)
class HorarioEmpleadoAdmin(admin.ModelAdmin):
    list_display = ["empleado", "dia_semana", "hora_entrada", "hora_salida"]
    list_filter = ["dia_semana"]
    search_fields = ["empleado__nombre"]


@admin.register(PermisoEmpleado)
class PermisoEmpleadoAdmin(admin.ModelAdmin):
    list_display = ["empleado", "tipo", "dia_semana", "fecha_inicio", "fecha_fin", "motivo"]
    list_filter = ["tipo"]
    search_fields = ["empleado__nombre", "motivo"]
