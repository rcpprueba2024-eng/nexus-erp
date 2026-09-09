"""Uno-off: importa el registro de horas real de RRHH desde "9- Septiembre
2026.xlsx" (hoja "REGISTRO MES SEPTIEMBRE 2026") hacia rrhh.RegistroHoras.

El Excel trae los 30 días del mes PRE-LLENADOS con "Ausente"/sin horas
como valor por defecto (para que RRHH solo tenga que corregir el día real
cuando pasa) — se comprobó: el resumen del propio archivo dice "3 días
laborados" por persona, y del 4 de septiembre en adelante TODAS las
filas, para TODOS los empleados, están idénticamente vacías (sin hora de
entrada/salida, estado "Ausente"). Importar esas 27 filas futuras tal
cual marcaría a todo el personal como ausente el resto del mes, lo cual
es falso — esas filas no representan una ausencia real, sino un día que
todavía no ha pasado en el Excel. Por eso este script solo importa filas
con datos reales (alguna hora registrada, horas trabajadas, vacaciones,
ausencia por enfermedad, u observaciones) — no las filas plantilla en
blanco.

Uso:
    python importar_horas_septiembre2026.py            # dry-run
    python importar_horas_septiembre2026.py --commit    # escribe de verdad

No crea empleados nuevos: si un nombre de la hoja no calza con ningún
Empleado ya existente, esa fila se reporta como "sin empleado" y no se
importa (para no crear un Empleado fantasma con datos incompletos).
"""
import argparse
import datetime
import os
import sys

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

import openpyxl

RUTA_EXCEL = r"C:\Users\USER\Downloads\9- Septiembre 2026.xlsx"
HOJA = "REGISTRO MES SEPTIEMBRE 2026"


def _hora(v):
    """Convierte lo que trae la celda (timedelta u datetime) a datetime.time."""
    if isinstance(v, datetime.timedelta):
        seg = int(v.total_seconds())
        h, resto = divmod(seg, 3600)
        m, s = divmod(resto, 60)
        h = h % 24
        return datetime.time(h, m, s)
    if isinstance(v, datetime.datetime):
        return v.time()
    if isinstance(v, datetime.time):
        return v
    return None


def _horas_decimal(v):
    if isinstance(v, datetime.timedelta):
        return round(v.total_seconds() / 3600, 2)
    return 0


def main(commit):
    from django.db import transaction
    from rrhh.models import Empleado, RegistroHoras

    empleados_por_nombre = {e.nombre.strip().upper(): e for e in Empleado.objects.all()}

    wb = openpyxl.load_workbook(RUTA_EXCEL, data_only=True, read_only=True)
    ws = wb[HOJA]

    creados = 0
    actualizados = 0
    omitidas_sin_datos = 0
    sin_empleado = {}

    with transaction.atomic():
        sid = transaction.savepoint()
        for fila in ws.iter_rows(min_row=2, values_only=True):
            nombre_excel = (fila[3] or "").strip()
            if not nombre_excel:
                continue

            entrada_real, entrada_of, salida_real, salida_of = fila[4], fila[5], fila[6], fila[7]
            horas_reales = fila[8]
            vacaciones, enfermedad, observaciones = fila[14], fila[15], fila[16]
            estado = (fila[13] or "").strip()

            tiene_datos = (
                entrada_real is not None or salida_real is not None
                or (isinstance(horas_reales, datetime.timedelta) and horas_reales.total_seconds() > 0)
                or vacaciones or enfermedad or observaciones
            )
            if not tiene_datos:
                omitidas_sin_datos += 1
                continue

            empleado = empleados_por_nombre.get(nombre_excel.upper())
            if empleado is None:
                sin_empleado[nombre_excel] = sin_empleado.get(nombre_excel, 0) + 1
                continue

            fecha = fila[0].date() if isinstance(fila[0], datetime.datetime) else fila[0]

            notas_partes = [estado] if estado else []
            min_tardanza = fila[12]
            if min_tardanza:
                notas_partes.append(f"{min_tardanza} min. tardanza")
            if vacaciones:
                notas_partes.append("Vacaciones")
            if enfermedad:
                notas_partes.append("Ausencia por enfermedad")
            if observaciones:
                notas_partes.append(str(observaciones))
            nota = " · ".join(str(p) for p in notas_partes)[:255]

            existente = RegistroHoras.objects.filter(empleado=empleado, fecha=fecha).first()
            if existente:
                existente.hora_entrada = _hora(entrada_real)
                existente.hora_salida = _hora(salida_real)
                existente.horas = _horas_decimal(horas_reales)
                existente.nota = nota
                existente.save()
                actualizados += 1
            else:
                RegistroHoras.objects.create(
                    empleado=empleado, fecha=fecha,
                    hora_entrada=_hora(entrada_real), hora_salida=_hora(salida_real),
                    horas=_horas_decimal(horas_reales), nota=nota,
                )
                creados += 1

        if not commit:
            transaction.savepoint_rollback(sid)
        else:
            transaction.savepoint_commit(sid)

    print(f"Registros {'creados' if commit else 'que se crearían'}: {creados}")
    print(f"Registros {'actualizados' if commit else 'que se actualizarían'} (ya existían): {actualizados}")
    print(f"Filas plantilla sin datos reales, omitidas: {omitidas_sin_datos}")
    if sin_empleado:
        print("Nombres sin Empleado correspondiente (no importados):", sin_empleado)
    if not commit:
        print()
        print("*** DRY-RUN: no se escribió nada. Corré con --commit para importar de verdad. ***")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", action="store_true")
    args = parser.parse_args()
    main(commit=args.commit)
