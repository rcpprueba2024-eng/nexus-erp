from django.contrib import admin
from .models import Perfil, Configuracion


@admin.register(Perfil)
class PerfilAdmin(admin.ModelAdmin):
    list_display = ["user", "rol"]
    list_filter = ["rol"]


@admin.register(Configuracion)
class ConfiguracionAdmin(admin.ModelAdmin):
    list_display = ["tasa_cambio_usd", "actualizado_en"]
