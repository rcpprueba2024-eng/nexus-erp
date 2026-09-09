"""Uno-off: fusiona las Marca duplicadas por variante de mayúsculas que
creó backfill_equipos.py (usaba Title Case: "Apple", "Acer"...) contra el
catálogo ya existente de la importación del Excel real (todo en
MAYUSCULA: "APPLE", "ACER"...). Se conserva la marca más antigua (id más
bajo = viene del catálogo original) y se reasignan Producto/Equipo/Modelo
de la duplicada antes de borrarla.
"""
import os
import sys
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from collections import defaultdict
from inventario.models import Marca, Modelo, Producto
from ventas.models import Equipo


def main():
    grupos = defaultdict(list)
    for m in Marca.objects.all():
        grupos[m.nombre.strip().lower()].append(m)

    fusionadas = 0
    for clave, marcas in grupos.items():
        if len(marcas) < 2:
            continue
        marcas.sort(key=lambda m: m.id)
        canonica = marcas[0]
        for dup in marcas[1:]:
            print(f"Fusionando '{dup.nombre}' (id={dup.id}) -> '{canonica.nombre}' (id={canonica.id})")

            # Modelo: puede haber Modelo(marca=dup, nombre=X) y ya existir
            # Modelo(marca=canonica, nombre=X) -> hay que fusionar también
            # a nivel de modelo, no solo reasignar el FK marca.
            for modelo_dup in list(Modelo.objects.filter(marca=dup)):
                modelo_canon, _ = Modelo.objects.get_or_create(marca=canonica, nombre=modelo_dup.nombre)
                Producto.objects.filter(modelo=modelo_dup).update(modelo=modelo_canon)
                Equipo.objects.filter(modelo=modelo_dup).update(modelo=modelo_canon)
                modelo_dup.delete()

            Producto.objects.filter(marca=dup).update(marca=canonica)
            Equipo.objects.filter(marca=dup).update(marca=canonica)
            dup.delete()
            fusionadas += 1

    print(f"Marcas fusionadas: {fusionadas}")
    print(f"Marcas totales restantes: {Marca.objects.count()}")


if __name__ == "__main__":
    main()
