"""Uno-off: crea/vincula taller.Equipo para las 1500 OrdenTaller sembradas
por seed_historico.py, y de paso corrige un bug real de esos datos: el
generador sacaba la "marca" tomando la 2da palabra del texto del equipo
(funciona para "Laptop HP Pavilion 14" -> "HP", pero da basura para
"MacBook Pro 13" -> "Pro" o "PC de escritorio HP" -> "de"). Aquí se
reconoce la marca real buscando palabras clave en el texto completo del
equipo, que es confiable, en vez de confiar en el campo `marca` ya roto.
También corrige el propio OrdenTaller.marca (no solo el Equipo vinculado)
para que la ficha de la OT deje de mostrar "Pro"/"Air"/"de" como marca.
"""
import os
import sys
import django

MARCA_KEYWORDS = [
    ("iphone", "Apple"), ("ipad", "Apple"), ("macbook", "Apple"),
    ("samsung", "Samsung"), ("xiaomi", "Xiaomi"), ("motorola", "Motorola"),
    ("hp", "HP"), ("dell", "Dell"), ("lenovo", "Lenovo"), ("acer", "Acer"),
]
STOPWORDS = {"de", "la", "el", "un", "una", "del", "los", "las", "para"}


def marca_real(equipo_texto, marca_actual):
    texto = (equipo_texto or "").lower()
    for kw, marca in MARCA_KEYWORDS:
        if kw in texto:
            return marca
    actual = (marca_actual or "").strip()
    if actual.lower() in STOPWORDS:
        return ""
    return actual


def main():
    from taller.models import OrdenTaller
    from ventas.models import resolver_equipo, Equipo

    ordenes = list(OrdenTaller.objects.select_related("cliente").order_by("fecha_ingreso", "id"))
    print(f"Procesando {len(ordenes)} ordenes...")

    corregidas_marca = 0
    for o in ordenes:
        marca_corregida = marca_real(o.equipo, o.marca)
        if marca_corregida != (o.marca or ""):
            corregidas_marca += 1
            o.marca = marca_corregida

        equipo = resolver_equipo(o.cliente, o.categoria_equipo, marca_corregida, o.modelo, o.color, o.no_serie)
        o.equipo_vinculado = equipo

    OrdenTaller.objects.bulk_update(ordenes, ["equipo_vinculado", "marca"], batch_size=300)

    total_equipos = Equipo.objects.count()
    print(f"Marcas corregidas (bug 'de'/'Pro'/'Air'): {corregidas_marca}")
    print(f"Equipos creados: {total_equipos} (de {len(ordenes)} ordenes -> {len(ordenes) - total_equipos} agrupadas en expedientes compartidos)")


if __name__ == "__main__":
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    sys.path.insert(0, os.path.dirname(__file__))
    django.setup()
    main()
