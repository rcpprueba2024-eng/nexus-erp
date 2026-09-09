from django.conf import settings
from django.db import models
from core.choices import ROLES
from inventario.models import Producto

AVATAR_COLORES = [
    "#4338ca", "#0f766e", "#b45309", "#be123c", "#4d7c0f", "#7c3aed", "#0369a1", "#a16207",
]

DIAS_SEMANA = [
    (1, "Lunes"), (2, "Martes"), (3, "Miércoles"), (4, "Jueves"), (5, "Viernes"), (6, "Sábado"),
]

TIPO_PERMISO = [
    ("FIJO", "Fijo (se repite cada semana)"),
    ("MOMENTANEO", "Momentáneo (con fecha de inicio y fin)"),
    # Pedido explícito: permiso de UN solo día donde el trabajador sale (o
    # entra) a una hora distinta a la normal — ej. "sale a la 1:00 pm" —
    # sin ausentarse el día completo como MOMENTANEO ni repetirse cada
    # semana como FIJO. Usa fecha_inicio como el día puntual (fecha_fin no
    # aplica) y hora_entrada/hora_salida como el horario autorizado ese día.
    ("POR_HORA", "Por horas (un solo día)"),
]

# Distingue vacaciones/incapacidad del resto de permisos sin depender de
# adivinar por el texto del motivo (antes el reporte de asistencia detectaba
# "vacaciones"/"enfermedad" buscando esas palabras dentro de `motivo`, algo
# frágil si RRHH escribía distinto) — ahora la pestaña que lo crea (Permisos
# vs. Vacaciones) fija esta categoría explícitamente.
CATEGORIA_PERMISO = [
    ("VACACIONES", "Vacaciones"),
    ("ENFERMEDAD", "Incapacidad / enfermedad"),
    ("OTRO", "Otro"),
]

# Con qué tipo de vínculo laboral está el trabajador ahora mismo. Un
# Pasante NO acumula ni tiene derecho a vacaciones (Art. 76 del Código del
# Trabajo aplica a la relación laboral ordinaria, no a una pasantía) — ver
# SaldoVacacionesView y PermisoEmpleadoSerializer.validate(), que se apoyan
# en este campo para excluirlo/bloquearlo. Si deja de ser pasante y pasa a
# ser trabajador fijo, RRHH solo cambia este campo y recupera el derecho.
TIPO_VINCULACION_CHOICES = [
    ("FIJO", "Trabajador fijo"),
    ("PASANTIA", "Pasantía"),
    ("PRUEBA", "Mes de prueba"),
]


class Empleado(models.Model):
    nombre = models.CharField(max_length=200)
    cedula = models.CharField(max_length=30, unique=True, verbose_name="Cédula")
    # Lista de puestos (no uno solo) — hay trabajadores que cubren más de
    # un puesto (ej. Recepción y Ventas).
    puestos = models.JSONField(default=list, blank=True)
    # Lista de áreas (no una sola) — un Gerente puede también cubrir Ventas,
    # por ejemplo. Nota: esto es la clasificación organizativa del
    # trabajador (para tableros/reportes), no su rol de acceso al sistema
    # — eso sigue siendo Perfil.rol (siempre uno solo, ver core/models.py).
    areas = models.JSONField(default=list, blank=True)
    salario = models.DecimalField(max_digits=12, decimal_places=2)
    email = models.EmailField(blank=True)
    telefono = models.CharField(max_length=30, blank=True)
    fecha_ingreso = models.DateField()
    activo = models.BooleanField(default=True)
    tipo_vinculacion = models.CharField(max_length=10, choices=TIPO_VINCULACION_CHOICES, default="FIJO")
    equipos_asignados = models.ManyToManyField(Producto, blank=True, related_name="empleados_asignados")
    # Descripción libre de lo que se le entregó (ej. "2 camisas talla M,
    # pantalón 32") — el color de cada día lo define UniformeDia, igual
    # para toda la empresa; esto es solo la talla/prenda de este empleado.
    uniforme_asignado = models.CharField(max_length=255, blank=True)
    # No todo trabajador necesita entrar al sistema — se vincula solo si
    # Gerencia decide darle acceso (ver rrhh/views.py y el flujo en RRHH.jsx).
    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="empleado",
    )

    # Avatar: foto subida por el usuario, o iniciales sobre un color fijo
    # (asignado una sola vez al crear el empleado) cuando no hay foto.
    foto = models.ImageField(upload_to="empleados/fotos/", null=True, blank=True)
    avatar_color = models.CharField(max_length=7, blank=True)

    class Meta:
        ordering = ["nombre"]

    def save(self, *args, **kwargs):
        if not self.avatar_color:
            self.avatar_color = AVATAR_COLORES[abs(hash(self.cedula or self.nombre)) % len(AVATAR_COLORES)]
        super().save(*args, **kwargs)

    @property
    def areas_display(self):
        etiquetas = dict(ROLES)
        return [etiquetas.get(a, a) for a in self.areas]

    def __str__(self):
        return f"{self.nombre} ({', '.join(self.puestos)})"


class RegistroHoras(models.Model):
    """Horas laborales de un empleado en una fecha, para el reporte de RRHH.

    hora_entrada/hora_salida son opcionales: RRHH las escribe cuando quiere
    que ese día cuente para el reporte de puntualidad/tardanzas (comparado
    contra HorarioEmpleado); si solo le interesa el total de horas, puede
    dejarlas vacías y escribir `horas` directo, como siempre se hizo."""

    empleado = models.ForeignKey(Empleado, on_delete=models.CASCADE, related_name="registros_horas")
    fecha = models.DateField()
    hora_entrada = models.TimeField(null=True, blank=True)
    hora_salida = models.TimeField(null=True, blank=True)
    horas = models.DecimalField(max_digits=5, decimal_places=2)
    nota = models.CharField(max_length=255, blank=True)
    registrado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-fecha", "-id"]

    def __str__(self):
        return f"{self.empleado.nombre} · {self.fecha} · {self.horas}h"


class HorarioEmpleado(models.Model):
    """Horario semanal fijo de un empleado: hora de entrada/salida por cada
    uno de los 6 días laborales (Lunes-Sábado). Sin fila para un día, o con
    entrada/salida vacías, significa que ese día no trabaja."""

    empleado = models.ForeignKey(Empleado, on_delete=models.CASCADE, related_name="horarios")
    dia_semana = models.PositiveSmallIntegerField(choices=DIAS_SEMANA)
    hora_entrada = models.TimeField(null=True, blank=True)
    hora_salida = models.TimeField(null=True, blank=True)

    class Meta:
        ordering = ["dia_semana"]
        constraints = [
            models.UniqueConstraint(fields=["empleado", "dia_semana"], name="unico_horario_por_dia"),
        ]

    def __str__(self):
        return f"{self.empleado.nombre} · {self.get_dia_semana_display()}"


class PermisoEmpleado(models.Model):
    """Excepción al horario base de un empleado.

    FIJO: se repite cada semana en `dia_semana` — con entrada/salida nulas
    significa que ese día no trabaja (permiso permanente); con horas
    puestas, reemplaza el horario base de ese día (ej. sale más temprano
    todos los jueves para estudiar).

    MOMENTANEO: cubre un rango de fechas puntual (`fecha_inicio`—`fecha_fin`,
    puede ser un solo día o varias semanas, ej. reposo médico) durante el
    cual el empleado no tiene horario — no reemplaza horas, solo ausenta.
    """

    empleado = models.ForeignKey(Empleado, on_delete=models.CASCADE, related_name="permisos")
    tipo = models.CharField(max_length=12, choices=TIPO_PERMISO)
    categoria = models.CharField(max_length=12, choices=CATEGORIA_PERMISO, default="OTRO")
    motivo = models.CharField(max_length=255, blank=True)

    dia_semana = models.PositiveSmallIntegerField(choices=DIAS_SEMANA, null=True, blank=True)
    hora_entrada = models.TimeField(null=True, blank=True)
    hora_salida = models.TimeField(null=True, blank=True)

    fecha_inicio = models.DateField(null=True, blank=True)
    fecha_fin = models.DateField(null=True, blank=True)

    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado_en"]

    def __str__(self):
        if self.tipo == "FIJO":
            return f"{self.empleado.nombre} · fijo · {self.get_dia_semana_display()}"
        return f"{self.empleado.nombre} · momentáneo · {self.fecha_inicio}—{self.fecha_fin}"


class UniformeDia(models.Model):
    """Qué color de uniforme toca cada día de la semana — un horario fijo,
    igual para todo el personal (no por empleado). Fila sin color = ese día
    no hay uniforme asignado (ropa libre, o no se trabaja)."""

    dia_semana = models.PositiveSmallIntegerField(choices=DIAS_SEMANA, unique=True)
    color = models.CharField(max_length=60, blank=True)
    # Color real (picker) para pintar la tarjeta de cada día — `color` sigue
    # siendo el nombre en texto que se imprime/muestra (ej. "Azul Navi", que
    # ni es un nombre CSS válido), este es solo para el swatch visual.
    color_hex = models.CharField(max_length=7, blank=True, default="")

    class Meta:
        ordering = ["dia_semana"]

    def __str__(self):
        return f"{self.get_dia_semana_display()} · {self.color or 'sin asignar'}"


class DocumentoEmpleado(models.Model):
    """Archivos adjuntos del expediente de un empleado (contrato, cédula
    escaneada, constancias, etc.) — puede haber varios por persona."""

    empleado = models.ForeignKey(Empleado, on_delete=models.CASCADE, related_name="documentos")
    archivo = models.FileField(upload_to="empleados/documentos/")
    nombre = models.CharField(max_length=200, blank=True, help_text="Nombre para mostrar (ej. 'Contrato 2026'); si se deja vacío se usa el nombre del archivo")
    subido_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-subido_en"]

    def __str__(self):
        return self.nombre or self.archivo.name
