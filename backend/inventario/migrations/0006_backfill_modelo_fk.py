from django.db import migrations


def normalizar(texto):
    return " ".join(texto.strip().split())


def poblar_modelos(apps, schema_editor):
    Producto = apps.get_model("inventario", "Producto")
    Marca = apps.get_model("inventario", "Marca")
    Modelo = apps.get_model("inventario", "Modelo")

    generica, _ = Marca.objects.get_or_create(nombre="Genérico")

    cache = {}
    for p in Producto.objects.exclude(modelo_texto="").select_related("marca"):
        marca = p.marca or generica
        texto = normalizar(p.modelo_texto)
        if not texto:
            continue
        clave = (marca.id, texto.lower())
        modelo = cache.get(clave)
        if modelo is None:
            modelo, _ = Modelo.objects.get_or_create(marca=marca, nombre=texto)
            cache[clave] = modelo
        p.modelo = modelo
        p.save(update_fields=["modelo"])


def revertir(apps, schema_editor):
    Producto = apps.get_model("inventario", "Producto")
    Producto.objects.update(modelo=None)


class Migration(migrations.Migration):

    dependencies = [
        ("inventario", "0005_modelo_producto_modelo_fk"),
    ]

    operations = [
        migrations.RunPython(poblar_modelos, revertir),
    ]
