from django.db import migrations


UNIDADES_INICIALES = [
    ("Unidad", "und", False),
    ("Par", "par", False),
    ("Caja", "caja", False),
    ("Paquete", "paq", True),
    ("Gramo", "g", True),
    ("Kilogramo", "kg", True),
    ("Litro", "lt", True),
    ("Mililitro", "ml", True),
]


def crear_unidades(apps, schema_editor):
    UnidadMedida = apps.get_model("inventario", "UnidadMedida")
    for nombre, abrev, fraccion in UNIDADES_INICIALES:
        UnidadMedida.objects.get_or_create(nombre=nombre, defaults={"abreviatura": abrev, "permite_fraccion": fraccion})


def borrar_unidades(apps, schema_editor):
    UnidadMedida = apps.get_model("inventario", "UnidadMedida")
    UnidadMedida.objects.filter(nombre__in=[u[0] for u in UNIDADES_INICIALES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("inventario", "0008_unidadmedida_alter_movimientoinventario_cantidad_and_more"),
    ]

    operations = [
        migrations.RunPython(crear_unidades, borrar_unidades),
    ]
