"""Uno-off: borra TODAS las órdenes de taller (OrdenTaller) y lo que
cuelga de ellas en cascada (DetalleComputadora, DiagnosticoOrden,
FotoEquipo, HistorialEstado, InsumoUsado).

NO toca: clientes, equipos (expedientes), facturas, inventario, RRHH,
configuración. Los FKs desde OrdenTaller hacia Cliente son PROTECT (no
se borra ningún cliente); hacia Empleado/User/DetalleFactura son
SET_NULL. Es seguro correrlo antes de re-importar el histórico.

Uso:
    python borrar_ordenes_taller.py            # solo reporta cuántas hay
    python borrar_ordenes_taller.py --commit   # borra de verdad
"""
import argparse
import os
import sys

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from taller.models import OrdenTaller


def main(commit):
    total = OrdenTaller.objects.count()
    print(f"Órdenes de taller actuales: {total}")
    if total == 0:
        print("Nada que borrar.")
        return
    if not commit:
        print("\n*** DRY-RUN: no se borró nada. Corré con --commit para borrar de verdad. ***")
        return
    n, detalle = OrdenTaller.objects.all().delete()
    print(f"\nBorradas: {n} filas en total")
    for modelo, cant in sorted(detalle.items()):
        print(f"  {modelo}: {cant}")
    print(f"Órdenes de taller restantes: {OrdenTaller.objects.count()}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", action="store_true")
    args = parser.parse_args()
    main(commit=args.commit)
