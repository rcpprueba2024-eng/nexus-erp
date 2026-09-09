from rest_framework import serializers
from .models import Empleado, RegistroHoras, HorarioEmpleado, PermisoEmpleado, UniformeDia, DocumentoEmpleado
from .calculos import _fraccion_dia_por_hora, dias_disponibles_vacaciones
from inventario.serializers import ProductoSerializer

# LISTO_ENTREGA/ABANDONADO cuentan como "cerradas" para efectos de carga de
# trabajo del técnico: el técnico ya terminó su parte (reparar el equipo),
# lo que quede pendiente (que el cliente lo retire, o que se abandone) ya no
# es trabajo suyo — antes se contaban como si el técnico "aún tuviera" el
# equipo aunque llevara semanas listo esperando que lo retiraran.
ESTADOS_ORDEN_CERRADOS = ("ENTREGADO", "CANCELADO", "LISTO_ENTREGA", "ABANDONADO")


class OrdenesActivasMixin:
    def get_ordenes_activas_count(self, obj):
        return obj.ordenes_taller.exclude(estado__in=ESTADOS_ORDEN_CERRADOS).count()


class EmpleadoSerializer(OrdenesActivasMixin, serializers.ModelSerializer):
    equipos_detalle = ProductoSerializer(source="equipos_asignados", many=True, read_only=True)
    areas_display = serializers.ReadOnlyField()
    ordenes_activas_count = serializers.SerializerMethodField()
    usuario_username = serializers.CharField(source="usuario.username", read_only=True, default=None)

    class Meta:
        model = Empleado
        fields = "__all__"


class EmpleadoResumenSerializer(OrdenesActivasMixin, serializers.ModelSerializer):
    """Para Taller/Pasante: solo lo necesario para el tablero de técnicos —
    nada de salario, cédula, correo ni teléfono de los demás empleados."""
    areas_display = serializers.ReadOnlyField()
    ordenes_activas_count = serializers.SerializerMethodField()

    class Meta:
        model = Empleado
        fields = ["id", "nombre", "puestos", "areas", "areas_display", "foto", "avatar_color", "activo", "ordenes_activas_count"]


class RegistroHorasSerializer(serializers.ModelSerializer):
    empleado_nombre = serializers.CharField(source="empleado.nombre", read_only=True)

    class Meta:
        model = RegistroHoras
        fields = "__all__"


class HorarioEmpleadoSerializer(serializers.ModelSerializer):
    dia_semana_display = serializers.CharField(source="get_dia_semana_display", read_only=True)

    class Meta:
        model = HorarioEmpleado
        fields = "__all__"


class PermisoEmpleadoSerializer(serializers.ModelSerializer):
    dia_semana_display = serializers.CharField(source="get_dia_semana_display", read_only=True, default=None)
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)
    categoria_display = serializers.CharField(source="get_categoria_display", read_only=True)
    # Las pestañas de Permisos/Vacaciones listan a través de empleados
    # distintos en una sola tabla (no dentro de la ficha de uno solo) —
    # necesitan saber de quién es cada fila sin una consulta aparte.
    empleado_nombre = serializers.CharField(source="empleado.nombre", read_only=True)

    class Meta:
        model = PermisoEmpleado
        fields = "__all__"

    def validate(self, data):
        categoria = data.get("categoria", getattr(self.instance, "categoria", None))
        empleado = data.get("empleado", getattr(self.instance, "empleado", None))
        if categoria == "VACACIONES" and empleado is not None and empleado.tipo_vinculacion == "PASANTIA":
            raise serializers.ValidationError("Los pasantes no tienen derecho a vacaciones.")
        tipo = data.get("tipo", getattr(self.instance, "tipo", None))
        if tipo == "FIJO" and data.get("dia_semana") is None and getattr(self.instance, "dia_semana", None) is None:
            raise serializers.ValidationError("Un permiso fijo necesita un día de la semana.")
        if tipo == "MOMENTANEO":
            inicio = data.get("fecha_inicio", getattr(self.instance, "fecha_inicio", None))
            fin = data.get("fecha_fin", getattr(self.instance, "fecha_fin", None))
            if not inicio or not fin:
                raise serializers.ValidationError("Un permiso momentáneo necesita fecha de inicio y de fin.")
            if fin < inicio:
                raise serializers.ValidationError("La fecha de fin no puede ser anterior a la de inicio.")
        if tipo == "POR_HORA":
            fecha = data.get("fecha_inicio", getattr(self.instance, "fecha_inicio", None))
            hora_entrada = data.get("hora_entrada", getattr(self.instance, "hora_entrada", None))
            hora_salida = data.get("hora_salida", getattr(self.instance, "hora_salida", None))
            if not fecha:
                raise serializers.ValidationError("Un permiso por horas necesita la fecha de ese día.")
            if not hora_entrada or not hora_salida:
                raise serializers.ValidationError("Un permiso por horas necesita la hora de entrada y de salida autorizadas ese día.")
            if hora_salida <= hora_entrada:
                raise serializers.ValidationError("La hora de salida debe ser posterior a la hora de entrada.")
            # Vacaciones por horas (ej. "vino a las 8 pero se fue a las
            # 12"): las horas que le faltaron a su horario normal ese día
            # se descuentan del saldo como fracción de día — pero solo si
            # le alcanzan. Si no tiene suficientes vacaciones disponibles
            # (ej. un trabajador nuevo que aún no acumula nada), NO se dejar
            # registrar como VACACIONES: el jefe pidió que en ese caso se
            # descuente del salario en vez de vacaciones, y eso se hace
            # registrándolo en la pestaña "Permisos" con categoría "Otro"
            # (no descuenta vacaciones, y de todos modos cuenta como
            # justificado para el reporte de asistencia — ver
            # _calcular_filas_asistencia en views.py, que no filtra POR_HORA
            # por categoría).
            if categoria == "VACACIONES" and empleado is not None:
                fraccion = _fraccion_dia_por_hora(empleado, {
                    "fecha_inicio": fecha, "hora_entrada": hora_entrada, "hora_salida": hora_salida,
                })
                if fraccion > 0:
                    excluir_id = self.instance.id if self.instance else None
                    disponibles = dias_disponibles_vacaciones(empleado, excluir_permiso_id=excluir_id)
                    if fraccion > disponibles:
                        raise serializers.ValidationError(
                            f"No alcanza: esas horas equivalen a {fraccion:.2f} días de vacaciones y "
                            f"{empleado.nombre} solo tiene {disponibles:.2f} disponibles. Regístralo en "
                            "\"Permisos\" (categoría \"Otro\") para que quede sin goce de salario."
                        )
        return data


class UniformeDiaSerializer(serializers.ModelSerializer):
    dia_semana_display = serializers.CharField(source="get_dia_semana_display", read_only=True)

    class Meta:
        model = UniformeDia
        fields = "__all__"


class DocumentoEmpleadoSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentoEmpleado
        fields = "__all__"
        read_only_fields = ["subido_en"]
