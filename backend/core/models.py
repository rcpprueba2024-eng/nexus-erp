from django.db import models
from django.contrib.auth.models import User
from .choices import ROLES, IDIOMA_CHOICES, TEMA_CHOICES, MODULOS_POR_ROL, IMPRESORA_CONEXION_CHOICES, ANCHO_PAPEL_CHOICES


class Perfil(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="perfil")
    rol = models.CharField(max_length=20, choices=ROLES, default="BACKOFFICE")
    modulos_permitidos = models.JSONField(default=list, blank=True)
    idioma = models.CharField(max_length=5, choices=IDIOMA_CHOICES, default="es")
    tema = models.CharField(max_length=15, choices=TEMA_CHOICES, default="auto")
    foto = models.ImageField(upload_to="usuarios/fotos/", null=True, blank=True)
    # Eliminar un usuario no es inmediato: Gerencia lo marca para borrar y
    # queda 24 horas en espera (cuenta desactivada mientras tanto) por si
    # fue un error — se puede cancelar en ese lapso. Pasadas las 24 horas,
    # se borra de forma definitiva la próxima vez que se liste el catálogo
    # de usuarios (mismo patrón de purga perezosa que Taller usa para
    # abandono de equipos, ver OrdenTaller.verificar_abandono()).
    eliminacion_solicitada_en = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.user.username} ({self.get_rol_display()})"

    def save(self, *args, **kwargs):
        if not self.modulos_permitidos:
            self.modulos_permitidos = list(MODULOS_POR_ROL.get(self.rol, []))
        super().save(*args, **kwargs)


class Configuracion(models.Model):
    """Fila única con parámetros globales del sistema."""
    tasa_cambio_usd = models.DecimalField(
        max_digits=8, decimal_places=4, default=36.6200,
        help_text="Cuántos córdobas (C$) equivalen a 1 dólar (US$)",
    )

    # Impresora térmica del POS (ver ventas/impresion.py)
    impresora_conexion = models.CharField(max_length=10, choices=IMPRESORA_CONEXION_CHOICES, blank=True)
    impresora_nombre = models.CharField(max_length=200, blank=True, help_text="Nombre exacto de la impresora instalada en Windows")
    impresora_ip = models.CharField(max_length=100, blank=True)
    impresora_puerto = models.PositiveIntegerField(default=9100)
    impresora_ancho_papel = models.PositiveSmallIntegerField(choices=ANCHO_PAPEL_CHOICES, default=80)

    # Consecutivo real de números de orden de Taller, por tipo de equipo
    # (COM/CCA van cada uno por su cuenta — ver OrdenTaller.tipo_orden).
    # Guarda el PRÓXIMO número a asignar, no el último usado.
    siguiente_numero_com = models.PositiveIntegerField(default=1)
    siguiente_numero_cca = models.PositiveIntegerField(default=1)

    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Configuración"
        verbose_name_plural = "Configuración"

    @classmethod
    def actual(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    @classmethod
    def siguiente_numero_orden(cls, tipo):
        """Consume y devuelve el próximo número de orden ("COM-1234" o
        "CCA-1234") para `tipo` ('COM' o 'CCA'). Atómico con select_for_update
        para que dos órdenes creadas al mismo tiempo nunca reciban el mismo
        número."""
        from django.db import transaction

        campo = "siguiente_numero_com" if tipo == "COM" else "siguiente_numero_cca"
        cls.actual()  # asegura que exista la fila antes del lock
        with transaction.atomic():
            config = cls.objects.select_for_update().get(pk=1)
            numero = getattr(config, campo)
            setattr(config, campo, numero + 1)
            config.save(update_fields=[campo])
        return f"{tipo}-{numero}"

    def __str__(self):
        return f"1 US$ = C${self.tasa_cambio_usd}"


class RegistroActividad(models.Model):
    """Bitácora automática de toda acción que modifica datos (crear/editar/
    eliminar) y de cada inicio de sesión — capturada sola por
    core.middleware.RegistroActividadMiddleware para TODA la API, sin tener
    que instrumentar cada ViewSet de cada app a mano (así ningún módulo
    nuevo se queda sin registrar). Solo la ve el usuario SISTEMA.RCP, ver
    permissions.SistemaRcpOnly — pedido explícito: ni siquiera otras cuentas
    de Gerencia (ADMIN/superusuario) tienen acceso a esta pantalla."""

    ACCION_CHOICES = [
        ("LOGIN", "Inicio de sesión"),
        ("CREAR", "Creación"),
        ("EDITAR", "Edición"),
        ("ELIMINAR", "Eliminación"),
    ]

    # SET_NULL, no CASCADE: si se borra la cuenta, su historial de
    # movimientos no debe desaparecer con ella — por eso también se guarda
    # `usuario_nombre` como copia fija (sigue legible aunque el FK quede en
    # null).
    usuario = models.ForeignKey(
        "auth.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="actividades",
    )
    usuario_nombre = models.CharField(max_length=200, blank=True)
    accion = models.CharField(max_length=10, choices=ACCION_CHOICES)
    metodo = models.CharField(max_length=10)
    ruta = models.CharField(max_length=255)
    # Primer segmento después de /api/ (ej. "taller", "rrhh") — para poder
    # filtrar la bitácora por módulo sin parsear la ruta cada vez.
    modulo = models.CharField(max_length=50, blank=True)
    # Algo legible sacado de la respuesta (número de orden, nombre, usuario
    # afectado, etc.) — para no dejar la bitácora en puros IDs numéricos.
    resumen = models.CharField(max_length=255, blank=True)
    codigo_estado = models.PositiveSmallIntegerField()
    ip = models.GenericIPAddressField(null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-creado_en"]
        verbose_name = "Registro de actividad"
        verbose_name_plural = "Registros de actividad"

    def __str__(self):
        return f"{self.usuario_nombre} · {self.accion} · {self.ruta}"
