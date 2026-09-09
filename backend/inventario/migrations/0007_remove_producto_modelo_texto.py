from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("inventario", "0006_backfill_modelo_fk"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="producto",
            name="modelo_texto",
        ),
    ]
