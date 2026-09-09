from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("ventas", "0008_backfill_empresa"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="cliente",
            name="es_empresa_legacy",
        ),
    ]
