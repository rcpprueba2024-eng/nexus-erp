from datetime import date, datetime, timedelta
from openpyxl import Workbook
from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from core.choices import ROLES
from core.permissions import role_permission
from reportes.excel_utils import build_sheet, add_bar_chart, workbook_response
from .models import Empleado, RegistroHoras, HorarioEmpleado, PermisoEmpleado, UniformeDia, DocumentoEmpleado, DIAS_SEMANA
from .serializers import (
    EmpleadoSerializer, EmpleadoResumenSerializer, RegistroHorasSerializer,
    HorarioEmpleadoSerializer, PermisoEmpleadoSerializer, UniformeDiaSerializer, DocumentoEmpleadoSerializer,
)
from .calculos import (
    ALMUERZO_FIN, ALMUERZO_INICIO, DIAS_VACACION_POR_MES,
    VENTANA_PAGO_FIN, VENTANA_PAGO_FIN_SABADO, VENTANA_PAGO_INICIO, VENTANA_PAGO_INICIO_SABADO,
    _dias_vacaciones_tomados, _horas_pagables, _meses_completos, _minutos,
)

ROLES_PERSONAL_LIMITADO = ("TALLER", "PASANTE", "VENTAS")


def _rol(user):
    if user.is_superuser:
        return "ADMIN"
    perfil = getattr(user, "perfil", None)
    return perfil.rol if perfil else None


class EmpleadoViewSet(viewsets.ModelViewSet):
    """Taller/Pasante/Ventas solo pueden LISTAR (tablero de técnicos, y
    Ventas para ver la carga de trabajo al asignar técnico en una orden) y
    reciben una versión resumida sin datos sensibles (salario, cédula,
    contacto); no pueden crear/editar/eliminar empleados — eso es de RRHH."""
    queryset = Empleado.objects.prefetch_related("equipos_asignados").all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        # Lectura: también Taller/Pasante/Ventas. "Subir mi foto"
        # (update/partial_update): solo Taller/Pasante, no Ventas — no
        # editan su propio perfil de empleado desde acá.
        if self.action in ("list", "retrieve"):
            return [role_permission("RRHH", "TALLER", "PASANTE", "VENTAS", modules=("rrhh", "taller", "ventas"))()]
        if self.action in ("update", "partial_update"):
            return [role_permission("RRHH", "TALLER", "PASANTE", modules=("rrhh", "taller"))()]
        return [role_permission("RRHH", modules="rrhh")()]

    def get_serializer_class(self):
        if _rol(self.request.user) in ROLES_PERSONAL_LIMITADO:
            return EmpleadoResumenSerializer
        return EmpleadoSerializer

    # Vincular (o desvincular) el usuario de login de un empleado queda
    # reservado a Gerencia, igual que crear la cuenta en sí (AdminOnly en
    # UsuarioViewSet) — RRHH puede crear/editar empleados pero no otorgar
    # acceso al sistema.
    def _bloquear_usuario_si_no_admin(self, serializer):
        if "usuario" in self.request.data and _rol(self.request.user) != "ADMIN":
            raise PermissionDenied("Solo Gerencia puede asignar un usuario del sistema a un empleado.")

    def perform_create(self, serializer):
        self._bloquear_usuario_si_no_admin(serializer)
        serializer.save()

    def perform_update(self, serializer):
        self._bloquear_usuario_si_no_admin(serializer)
        serializer.save()


class RegistroHorasViewSet(viewsets.ModelViewSet):
    queryset = RegistroHoras.objects.select_related("empleado").all()
    serializer_class = RegistroHorasSerializer
    permission_classes = [role_permission("RRHH", modules="rrhh")]

    def get_queryset(self):
        qs = super().get_queryset()
        empleado = self.request.query_params.get("empleado")
        desde = self.request.query_params.get("desde")
        hasta = self.request.query_params.get("hasta")
        if empleado:
            qs = qs.filter(empleado_id=empleado)
        if desde:
            qs = qs.filter(fecha__gte=desde)
        if hasta:
            qs = qs.filter(fecha__lte=hasta)
        return qs


class HorarioEmpleadoViewSet(viewsets.ModelViewSet):
    queryset = HorarioEmpleado.objects.select_related("empleado").all()
    serializer_class = HorarioEmpleadoSerializer
    permission_classes = [role_permission("RRHH", modules="rrhh")]

    def get_queryset(self):
        qs = super().get_queryset()
        empleado = self.request.query_params.get("empleado")
        if empleado:
            qs = qs.filter(empleado_id=empleado)
        return qs

    def create(self, request, *args, **kwargs):
        # "Guardar horario" desde el frontend siempre manda el día completo
        # (entrada+salida, o ambos vacíos para "no trabaja"); si ya había
        # una fila para ese día se reemplaza en vez de chocar con el
        # UniqueConstraint (empleado, dia_semana).
        empleado_id = request.data.get("empleado")
        dia = request.data.get("dia_semana")
        existente = HorarioEmpleado.objects.filter(empleado_id=empleado_id, dia_semana=dia).first()
        if existente:
            serializer = self.get_serializer(existente, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        return super().create(request, *args, **kwargs)


class PermisoEmpleadoViewSet(viewsets.ModelViewSet):
    queryset = PermisoEmpleado.objects.select_related("empleado").all()
    serializer_class = PermisoEmpleadoSerializer
    permission_classes = [role_permission("RRHH", modules="rrhh")]

    def get_queryset(self):
        qs = super().get_queryset()
        empleado = self.request.query_params.get("empleado")
        if empleado:
            qs = qs.filter(empleado_id=empleado)
        categoria = self.request.query_params.get("categoria")
        if categoria:
            qs = qs.filter(categoria=categoria)
        return qs


class UniformeDiaViewSet(viewsets.ModelViewSet):
    """Horario de colores de uniforme, igual para toda la empresa — no hay
    "empleado" en la ruta, solo 6 filas (una por día laboral) que RRHH edita."""
    queryset = UniformeDia.objects.all()
    serializer_class = UniformeDiaSerializer
    permission_classes = [role_permission("RRHH", "TALLER", "PASANTE", "VENTAS", modules=("rrhh", "taller", "ventas"))]

    def get_permissions(self):
        # Todo el personal puede consultar qué color toca hoy; solo RRHH
        # lo edita.
        if self.action in ("list", "retrieve"):
            return [role_permission("RRHH", "TALLER", "PASANTE", "VENTAS", modules=("rrhh", "taller", "ventas"))()]
        return [role_permission("RRHH", modules="rrhh")()]


class DocumentoEmpleadoViewSet(viewsets.ModelViewSet):
    queryset = DocumentoEmpleado.objects.select_related("empleado").all()
    serializer_class = DocumentoEmpleadoSerializer
    permission_classes = [role_permission("RRHH", modules="rrhh")]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = super().get_queryset()
        empleado = self.request.query_params.get("empleado")
        if empleado:
            qs = qs.filter(empleado_id=empleado)
        return qs


class ReporteHorasView(APIView):
    """Total de horas por empleado en un rango de fechas, para el reporte de RRHH."""

    permission_classes = [role_permission("RRHH", modules="rrhh")]

    def get(self, request):
        desde = request.query_params.get("desde")
        hasta = request.query_params.get("hasta")
        registros = RegistroHoras.objects.select_related("empleado")
        if desde:
            registros = registros.filter(fecha__gte=desde)
        if hasta:
            registros = registros.filter(fecha__lte=hasta)
        por_empleado = {}
        for r in registros:
            acc = por_empleado.setdefault(r.empleado_id, {
                "empleado_id": r.empleado_id, "empleado_nombre": r.empleado.nombre,
                "puesto": ", ".join(r.empleado.puestos), "total_horas": 0,
            })
            acc["total_horas"] += float(r.horas)
        return Response(sorted(por_empleado.values(), key=lambda x: -x["total_horas"]))


def _parsear_rango(request):
    try:
        desde = datetime.strptime(request.query_params.get("desde", ""), "%Y-%m-%d").date()
        hasta = datetime.strptime(request.query_params.get("hasta", ""), "%Y-%m-%d").date()
    except ValueError:
        return None, None, Response({"detail": "Parámetros desde/hasta inválidos (YYYY-MM-DD)."}, status=400)
    if hasta < desde:
        return None, None, Response({"detail": "La fecha 'hasta' no puede ser anterior a 'desde'."}, status=400)
    return desde, hasta, None


def _calcular_filas_asistencia(desde, hasta):
    """Reporte completo de asistencia por rango de fechas: días trabajados,
    horas, faltas (completas/parciales) y puntualidad — comparando cada
    RegistroHoras contra el horario base (HorarioEmpleado) y descontando
    los días cubiertos por un PermisoEmpleado (esos no cuentan como falta,
    ya están justificados). Ver TIPO_PERMISO/HorarioEmpleado en models.py
    para el significado exacto de cada campo que se usa acá. Compartida por
    ReporteAsistenciaView (JSON) y ReporteAsistenciaExcelView (.xlsx) para no
    duplicar esta lógica en dos lugares."""

    empleados = (
        Empleado.objects.filter(activo=True)
        .prefetch_related("horarios", "permisos", "registros_horas")
    )

    filas = []
    for emp in empleados:
        horario_por_dia = {h.dia_semana: h for h in emp.horarios.all()}
        fijos_por_dia = {p.dia_semana: p for p in emp.permisos.all() if p.tipo == "FIJO" and p.dia_semana}
        momentaneos = [p for p in emp.permisos.all() if p.tipo == "MOMENTANEO" and p.fecha_inicio and p.fecha_fin]
        # Permiso de un solo día (ej. "sale a la 1:00 pm") — a diferencia de
        # MOMENTANEO no ausenta el día completo, solo reemplaza la hora
        # esperada de entrada/salida para esa fecha puntual.
        por_hora_por_dia = {
            p.fecha_inicio: p for p in emp.permisos.all()
            if p.tipo == "POR_HORA" and p.fecha_inicio and p.hora_entrada and p.hora_salida
        }
        registros_por_fecha = {r.fecha: r for r in emp.registros_horas.all() if desde <= r.fecha <= hasta}

        dias_programados = 0
        dias_trabajados = 0
        dias_falta_completa = 0
        dias_falta_parcial = 0
        dias_permiso = 0
        total_horas = 0.0
        horas_esperadas_total = 0.0
        tardanzas = []
        minutos_tarde_total = 0
        ausencias_detalle = []  # [(fecha, dia_semana, motivo)] — faltas y permisos momentáneos

        # Nunca antes de que la persona entrara a trabajar — si no, alguien
        # contratado a mitad del periodo sale con faltas falsas por los
        # días previos a su fecha de ingreso, cuando ni siquiera existía
        # en la empresa (el horario semanal no sabe de por sí desde
        # cuándo aplica, solo qué hora le toca cada día).
        dia = max(desde, emp.fecha_ingreso)
        while dia <= hasta:
            dia_semana = dia.isoweekday()  # 1=Lunes … 7=Domingo (nunca programado, no hay choice 7)
            permiso_momentaneo = next((p for p in momentaneos if p.fecha_inicio <= dia <= p.fecha_fin), None)
            if permiso_momentaneo:
                dias_permiso += 1
                ausencias_detalle.append((dia, permiso_momentaneo.motivo or "Permiso sin motivo especificado", permiso_momentaneo.categoria))
                dia += timedelta(days=1)
                continue

            permiso_por_hora = por_hora_por_dia.get(dia)
            if permiso_por_hora:
                # Reemplaza la hora esperada solo para este día puntual —
                # sigue contando como día programado y necesita registro,
                # pero con la ventana autorizada, no el horario normal.
                entrada_esperada, salida_esperada = permiso_por_hora.hora_entrada, permiso_por_hora.hora_salida
            else:
                permiso_fijo = fijos_por_dia.get(dia_semana)
                if permiso_fijo and not permiso_fijo.hora_entrada and not permiso_fijo.hora_salida:
                    # Día libre fijo (ej. no trabaja los jueves) — ni siquiera cuenta como programado.
                    dia += timedelta(days=1)
                    continue

                if permiso_fijo and permiso_fijo.hora_entrada and permiso_fijo.hora_salida:
                    entrada_esperada, salida_esperada = permiso_fijo.hora_entrada, permiso_fijo.hora_salida
                else:
                    horario = horario_por_dia.get(dia_semana)
                    if not horario or not horario.hora_entrada or not horario.hora_salida:
                        dia += timedelta(days=1)
                        continue  # sin horario ese día = no programado
                    entrada_esperada, salida_esperada = horario.hora_entrada, horario.hora_salida

            # Horas esperadas también acotadas a la ventana pagada: si a
            # alguien le configuraron un horario fuera de 8:00–17:00, igual
            # no se le exige (ni se le paga) más que esa ventana.
            horas_esperadas = _horas_pagables(entrada_esperada, salida_esperada, dia_semana)
            dias_programados += 1
            horas_esperadas_total += horas_esperadas

            registro = registros_por_fecha.get(dia)
            if not registro or float(registro.horas) <= 0:
                dias_falta_completa += 1
                ausencias_detalle.append((dia, "Falta injustificada", None))
            else:
                # Si hay hora de entrada/salida registradas, se pagan solo
                # las horas dentro de 8:00 a.m.–5:00 p.m. (sin hora extra
                # por llegar antes o irse después). Si RRHH solo cargó el
                # total de horas a mano (sin marcar entrada/salida), se
                # respeta ese valor tal cual lo escribió.
                if registro.hora_entrada and registro.hora_salida:
                    horas_trabajadas = _horas_pagables(registro.hora_entrada, registro.hora_salida, dia_semana)
                else:
                    horas_trabajadas = float(registro.horas)
                total_horas += horas_trabajadas
                dias_trabajados += 1
                if horas_esperadas > 0 and horas_trabajadas < horas_esperadas * 0.9:
                    dias_falta_parcial += 1
                if registro.hora_entrada and _minutos(registro.hora_entrada) > _minutos(entrada_esperada):
                    minutos = _minutos(registro.hora_entrada) - _minutos(entrada_esperada)
                    tardanzas.append(minutos)
                    minutos_tarde_total += minutos

            dia += timedelta(days=1)

        if dias_falta_completa > 0:
            clasificacion = "ROJO"
        elif dias_falta_parcial > 0:
            clasificacion = "AMARILLO"
        else:
            clasificacion = "VERDE"

        dias_semana_label = dict(DIAS_SEMANA)
        ausencias_detalle.sort(key=lambda x: x[0])
        dias_vacaciones = sum(1 for _, _, cat in ausencias_detalle if cat == "VACACIONES")
        dias_enfermedad = sum(1 for _, _, cat in ausencias_detalle if cat == "ENFERMEDAD")

        filas.append({
            "empleado_id": emp.id, "empleado_nombre": emp.nombre,
            "puestos": emp.puestos, "areas": emp.areas,
            "dias_programados": dias_programados, "dias_trabajados": dias_trabajados,
            "dias_falta_completa": dias_falta_completa, "dias_falta_parcial": dias_falta_parcial,
            "dias_permiso": dias_permiso,
            "total_horas": round(total_horas, 2), "horas_esperadas_total": round(horas_esperadas_total, 2),
            "tardanzas_count": len(tardanzas),
            "promedio_tardanza_minutos": round(sum(tardanzas) / len(tardanzas), 1) if tardanzas else 0,
            "minutos_tarde_total": minutos_tarde_total,
            "clasificacion": clasificacion,
            # Campos para el informe estilo RRHH (días sin trabajar, horas
            # perdidas por faltas/tardanzas, y el desglose de vacaciones vs.
            # incapacidad médica según la categoría del permiso — ver
            # PermisoEmpleado.categoria en models.py).
            "dias_no_laborados": dias_falta_completa + dias_permiso,
            "horas_no_laboradas": round(max(0.0, horas_esperadas_total - total_horas), 2),
            "dias_vacaciones": dias_vacaciones,
            "dias_enfermedad": dias_enfermedad,
            "ausencias_detalle": [
                f"{dias_semana_label.get(f.isoweekday(), '')} {f.strftime('%d/%m/%Y')}, {motivo}"
                for f, motivo, _ in ausencias_detalle
            ],
        })

    return sorted(filas, key=lambda x: -x["total_horas"])


class SaldoVacacionesView(APIView):
    """Cuánto lleva acumulado cada empleado y cuánto ya tomó, para la
    pestaña de Vacaciones — separado del reporte de asistencia porque es
    saldo acumulado DESDE SIEMPRE (fecha de ingreso), no de un rango de
    fechas puntual como `desde`/`hasta` en los otros reportes."""

    permission_classes = [role_permission("RRHH", modules="rrhh")]

    def get(self, request):
        hoy = date.today()
        filas = []
        # Los pasantes no acumulan vacaciones (Art. 76 no aplica a una
        # pasantía) — ver Empleado.tipo_vinculacion. `horarios` hace falta
        # además de `permisos` porque los permisos POR_HORA de vacaciones
        # se descuentan comparando contra el horario normal de ese día
        # (ver _fraccion_dia_por_hora en calculos.py).
        for emp in Empleado.objects.filter(activo=True).exclude(tipo_vinculacion="PASANTIA").prefetch_related("permisos", "horarios"):
            meses = _meses_completos(emp.fecha_ingreso, hoy)
            acumulados = round(meses * DIAS_VACACION_POR_MES, 1)
            tomados = _dias_vacaciones_tomados(emp)
            filas.append({
                "empleado_id": emp.id, "empleado_nombre": emp.nombre,
                "fecha_ingreso": str(emp.fecha_ingreso), "meses_trabajados": meses,
                "dias_acumulados": acumulados, "dias_tomados": tomados,
                "dias_disponibles": round(acumulados - tomados, 2),
            })
        return Response(sorted(filas, key=lambda f: f["empleado_nombre"]))


def _agrupar_por_area(filas):
    etiquetas = dict(ROLES)
    por_area = {}
    for f in filas:
        for area in (f["areas"] or ["SIN_AREA"]):
            acc = por_area.setdefault(area, {
                "area": area, "area_display": etiquetas.get(area, area),
                "empleados_count": 0, "dias_programados": 0, "dias_trabajados": 0,
                "dias_falta_completa": 0, "dias_falta_parcial": 0, "dias_permiso": 0,
                "total_horas": 0.0, "horas_esperadas_total": 0.0,
                "tardanzas_count": 0, "_suma_tardanza": 0.0,
                "clasificacion": "VERDE",
            })
            acc["empleados_count"] += 1
            for campo in ("dias_programados", "dias_trabajados", "dias_falta_completa", "dias_falta_parcial", "dias_permiso", "total_horas", "horas_esperadas_total", "tardanzas_count"):
                acc[campo] += f[campo]
            acc["_suma_tardanza"] += f["promedio_tardanza_minutos"] * f["tardanzas_count"]
            if f["clasificacion"] == "ROJO" or acc["clasificacion"] == "ROJO":
                acc["clasificacion"] = "ROJO"
            elif f["clasificacion"] == "AMARILLO" and acc["clasificacion"] != "ROJO":
                acc["clasificacion"] = "AMARILLO"
    for acc in por_area.values():
        acc["total_horas"] = round(acc["total_horas"], 2)
        acc["horas_esperadas_total"] = round(acc["horas_esperadas_total"], 2)
        acc["promedio_tardanza_minutos"] = round(acc["_suma_tardanza"] / acc["tardanzas_count"], 1) if acc["tardanzas_count"] else 0
        del acc["_suma_tardanza"]
    return sorted(por_area.values(), key=lambda x: -x["total_horas"])


class ReporteAsistenciaView(APIView):
    permission_classes = [role_permission("RRHH", modules="rrhh")]

    def get(self, request):
        desde, hasta, error = _parsear_rango(request)
        if error:
            return error
        agrupar_por = request.query_params.get("agrupar_por", "empleado")
        filas = _calcular_filas_asistencia(desde, hasta)

        if agrupar_por == "area":
            return Response({
                "desde": str(desde), "hasta": str(hasta), "agrupar_por": "area",
                "filas": _agrupar_por_area(filas),
            })

        return Response({
            "desde": str(desde), "hasta": str(hasta), "agrupar_por": "empleado",
            "filas": filas,
        })


CLASIFICACION_LABEL = {"VERDE": "Al día", "AMARILLO": "Con faltas parciales", "ROJO": "Con faltas"}


class ReporteAsistenciaExcelView(APIView):
    """Reporte completo para RRHH en un solo archivo: datos maestros de cada
    empleado (incluye salario/cédula — por eso mismo permiso restringido que
    el resto del módulo), el detalle de asistencia del rango pedido, y un
    resumen por área con gráfico — todo lo que RRHH necesita para revisar o
    archivar el período sin tener que combinar varias exportaciones."""

    permission_classes = [role_permission("RRHH", modules="rrhh")]

    def get(self, request):
        desde, hasta, error = _parsear_rango(request)
        if error:
            return error

        filas = _calcular_filas_asistencia(desde, hasta)
        filas_area = _agrupar_por_area(filas)
        etiquetas_area = dict(ROLES)

        wb = Workbook()

        ws1 = wb.active
        ws1.title = "Empleados"
        empleados = Empleado.objects.filter(activo=True).prefetch_related("equipos_asignados")
        rows1 = [[
            e.nombre, e.cedula, ", ".join(e.puestos or []),
            ", ".join(etiquetas_area.get(a, a) for a in (e.areas or [])),
            float(e.salario) if e.salario is not None else 0,
            e.email or "", e.telefono or "", e.fecha_ingreso.strftime("%d/%m/%Y") if e.fecha_ingreso else "",
            ", ".join(p.nombre for p in e.equipos_asignados.all()),
        ] for e in empleados]
        build_sheet(
            ws1, f"Empleados ({len(rows1)} activos)",
            ["Nombre", "Cédula", "Puesto(s)", "Área(s)", "Salario", "Correo", "Teléfono", "Fecha de ingreso", "Equipos asignados"],
            rows1, money_cols=[5],
        )

        ws2 = wb.create_sheet("Asistencia")
        rows2 = [[
            f["empleado_nombre"], f["dias_trabajados"], f["tardanzas_count"],
            "\n".join(f["ausencias_detalle"]) or "",
            f["minutos_tarde_total"], f["dias_no_laborados"], f["horas_no_laboradas"],
            f["dias_vacaciones"], f["dias_enfermedad"],
        ] for f in filas]
        # Fila completa en rojo cuando el empleado tuvo alguna falta (con o
        # sin justificar) en el periodo — mismo criterio que "dias_no_laborados".
        filas_en_rojo = {i for i, f in enumerate(filas) if f["dias_no_laborados"] > 0}
        totales2 = [
            "TOTAL", sum(f["dias_trabajados"] for f in filas), sum(f["tardanzas_count"] for f in filas), "",
            sum(f["minutos_tarde_total"] for f in filas), sum(f["dias_no_laborados"] for f in filas),
            round(sum(f["horas_no_laboradas"] for f in filas), 2),
            sum(f["dias_vacaciones"] for f in filas), sum(f["dias_enfermedad"] for f in filas),
        ]
        header_row2 = build_sheet(
            ws2, f"Asistencia del {desde.strftime('%d/%m/%Y')} al {hasta.strftime('%d/%m/%Y')}",
            ["Empleado", "Días laborados", "Llegadas tardes", "Días ausentes", "Min. tardes",
             "Días no laborados", "Horas no laboradas", "Vacaciones", "Ausencia por enfermedad"],
            rows2, totals_row=totales2,
            highlight_rows=filas_en_rojo, col_widths={1: 26, 4: 46}, wrap_cols={4}, time_cols={7},
        )
        add_bar_chart(ws2, header_row2, len(rows2), category_col=1, value_col=6, title="Días no laborados por empleado")

        ws3 = wb.create_sheet("Resumen por área")
        rows3 = [[
            a["area_display"], a["empleados_count"], a["dias_trabajados"], a["dias_falta_completa"],
            a["total_horas"], a["tardanzas_count"], CLASIFICACION_LABEL.get(a["clasificacion"], a["clasificacion"]),
        ] for a in filas_area]
        header_row3 = build_sheet(
            ws3, "Resumen por área",
            ["Área", "Empleados", "Días trabajados", "Faltas completas", "Total horas", "Tardanzas", "Estado"],
            rows3,
        )
        add_bar_chart(ws3, header_row3, len(rows3), category_col=1, value_col=5, title="Total de horas por área")

        return workbook_response(wb, f"rrhh_completo_{desde}_{hasta}.xlsx")
