"""Cálculos de horas/días compartidos entre views.py (reportes) y
serializers.py (validación al guardar un permiso) — separado en su propio
módulo para que serializers.py pueda usarlos sin crear una importación
circular (views.py ya importa desde serializers.py)."""
from datetime import date, time

from .models import HorarioEmpleado

# El taller/tienda no paga hora extra: aunque un empleado llegue antes de las
# 8:00 a.m. o se quede después de las 5:00 p.m., solo se cuentan (y se pagan)
# las horas dentro de esta ventana. Se usa tanto para las horas esperadas
# según el horario como para las horas realmente trabajadas.
VENTANA_PAGO_INICIO = time(8, 0)
VENTANA_PAGO_FIN = time(17, 0)
# El sábado es media jornada con horario distinto al resto de la semana
# (8:30 a.m.–1:00 p.m., no 8:00 a.m.–5:00 p.m.).
VENTANA_PAGO_INICIO_SABADO = time(8, 30)
VENTANA_PAGO_FIN_SABADO = time(13, 0)
# La jornada ordinaria completa (Art. 51 del Código del Trabajo) es de 8
# horas, no las 9 que hay de corrido entre 8:00 y 17:00 — la diferencia es
# la hora de almuerzo, sin goce de salario. Solo se descuenta cuando el
# turno realmente cubre esa hora (un turno corto que termina antes del
# mediodía no la pierde). El sábado no tiene bloque de almuerzo asignado
# (es medio día corrido hasta la 1:00 p.m.), así que nunca se le descuenta.
ALMUERZO_INICIO = time(12, 0)
ALMUERZO_FIN = time(13, 0)


def _minutos(t):
    return t.hour * 60 + t.minute if t else None


def _horas_pagables(hora_inicio, hora_fin, dia_semana=None):
    if not hora_inicio or not hora_fin:
        return 0.0
    es_sabado = dia_semana == 6  # isoweekday(): 1=Lunes … 6=Sábado, 7=Domingo
    ventana_inicio = VENTANA_PAGO_INICIO_SABADO if es_sabado else VENTANA_PAGO_INICIO
    ventana_fin = VENTANA_PAGO_FIN_SABADO if es_sabado else VENTANA_PAGO_FIN
    inicio = max(_minutos(hora_inicio), _minutos(ventana_inicio))
    fin = min(_minutos(hora_fin), _minutos(ventana_fin))
    horas = max(0.0, (fin - inicio) / 60)
    if not es_sabado and inicio <= _minutos(ALMUERZO_INICIO) and fin >= _minutos(ALMUERZO_FIN):
        horas = max(0.0, horas - 1)
    return horas


# Art. 76 del Código del Trabajo de Nicaragua: 15 días de vacaciones por
# cada 6 meses de trabajo ininterrumpido (= 30 días por año completo) —
# acá se prorratea mes a mes desde la fecha de ingreso.
DIAS_VACACION_POR_MES = 2.5


def _meses_completos(desde, hasta):
    meses = (hasta.year - desde.year) * 12 + (hasta.month - desde.month)
    if hasta.day < desde.day:
        meses -= 1
    return max(0, meses)


def _horario_del_dia(empleado, dia_semana):
    """El horario normal (fijo, semanal) de este trabajador para ese día —
    None si ese día no trabaja / no tiene horario cargado. `.horarios.all()`
    no pega dos veces a la base de datos si el queryset de `empleado` ya
    vino con `.prefetch_related("horarios")` (Django cachea el resultado en
    la instancia)."""
    for h in empleado.horarios.all():
        if h.dia_semana == dia_semana:
            return h
    return None


def _fraccion_dia_por_hora(empleado, permiso_o_datos):
    """Cuántos DÍAS de vacaciones representan las horas que le faltaron a
    un permiso POR_HORA — comparando el horario AUTORIZADO ese día
    (permiso_o_datos.hora_entrada/hora_salida, ej. "se fue a las 12" en vez
    de su salida normal) contra el horario NORMAL de ese trabajador ese
    mismo día de la semana (HorarioEmpleado). Si no tiene horario cargado
    para ese día (o el permiso cubre las mismas horas o más), no hay nada
    que descontar — devuelve 0.0.

    `permiso_o_datos` puede ser una instancia de PermisoEmpleado o
    cualquier objeto/dict con fecha_inicio/hora_entrada/hora_salida (el
    serializer valida ANTES de crear la instancia real)."""
    fecha = permiso_o_datos.get("fecha_inicio") if isinstance(permiso_o_datos, dict) else permiso_o_datos.fecha_inicio
    hora_entrada = permiso_o_datos.get("hora_entrada") if isinstance(permiso_o_datos, dict) else permiso_o_datos.hora_entrada
    hora_salida = permiso_o_datos.get("hora_salida") if isinstance(permiso_o_datos, dict) else permiso_o_datos.hora_salida
    if not fecha or not hora_entrada or not hora_salida:
        return 0.0

    dia_semana = fecha.isoweekday()
    horario = _horario_del_dia(empleado, dia_semana)
    if not horario or not horario.hora_entrada or not horario.hora_salida:
        return 0.0

    horas_normales = _horas_pagables(horario.hora_entrada, horario.hora_salida, dia_semana)
    horas_autorizadas = _horas_pagables(hora_entrada, hora_salida, dia_semana)
    faltantes = max(0.0, horas_normales - horas_autorizadas)
    if faltantes <= 0 or horas_normales <= 0:
        return 0.0
    return faltantes / horas_normales


def _dias_vacaciones_tomados(empleado):
    total = 0.0
    for p in empleado.permisos.all():
        if p.tipo == "MOMENTANEO" and p.categoria == "VACACIONES" and p.fecha_inicio and p.fecha_fin:
            total += (p.fecha_fin - p.fecha_inicio).days + 1
        elif p.tipo == "POR_HORA" and p.categoria == "VACACIONES":
            total += _fraccion_dia_por_hora(empleado, p)
    return round(total, 2)


def dias_disponibles_vacaciones(empleado, hoy=None, excluir_permiso_id=None):
    """Saldo actual de vacaciones (acumulados - tomados) — usado por
    PermisoEmpleadoSerializer.validate() para no dejar registrar por horas
    más de lo que el trabajador tiene disponible. `excluir_permiso_id`: al
    EDITAR un permiso ya guardado, no contarlo dos veces contra sí mismo."""
    hoy = hoy or date.today()
    meses = _meses_completos(empleado.fecha_ingreso, hoy)
    acumulados = round(meses * DIAS_VACACION_POR_MES, 1)
    tomados = 0.0
    for p in empleado.permisos.all():
        if excluir_permiso_id and p.id == excluir_permiso_id:
            continue
        if p.tipo == "MOMENTANEO" and p.categoria == "VACACIONES" and p.fecha_inicio and p.fecha_fin:
            tomados += (p.fecha_fin - p.fecha_inicio).days + 1
        elif p.tipo == "POR_HORA" and p.categoria == "VACACIONES":
            tomados += _fraccion_dia_por_hora(empleado, p)
    return round(acumulados - tomados, 2)
