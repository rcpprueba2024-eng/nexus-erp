from django.db import migrations


def poblar_empresas(apps, schema_editor):
    Cliente = apps.get_model("ventas", "Cliente")
    Empresa = apps.get_model("ventas", "Empresa")

    for c in Cliente.objects.filter(es_empresa_legacy=True):
        nombre = c.nombre.strip() or f"Empresa cliente #{c.id}"
        empresa, creada = Empresa.objects.get_or_create(
            nombre=nombre,
            defaults={"telefono": c.telefono, "direccion": c.direccion, "email": c.email},
        )
        c.empresa = empresa
        c.tipo_cliente = "EMPRESA"
        c.save(update_fields=["empresa", "tipo_cliente"])


def revertir(apps, schema_editor):
    Cliente = apps.get_model("ventas", "Cliente")
    Cliente.objects.update(empresa=None)


class Migration(migrations.Migration):

    dependencies = [
        ("ventas", "0007_empresa_cliente_campos"),
    ]

    operations = [
        migrations.RunPython(poblar_empresas, revertir),
    ]
