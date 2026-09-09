from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("inventario", "0004_producto_asignacion_producto_condicion_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="Modelo",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nombre", models.CharField(max_length=100)),
                ("marca", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="modelos", to="inventario.marca")),
            ],
            options={
                "verbose_name": "Modelo",
                "verbose_name_plural": "Modelos",
                "ordering": ["marca__nombre", "nombre"],
                "unique_together": {("marca", "nombre")},
            },
        ),
        migrations.RenameField(
            model_name="producto",
            old_name="modelo",
            new_name="modelo_texto",
        ),
        migrations.AddField(
            model_name="producto",
            name="modelo",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="productos", to="inventario.modelo"),
        ),
    ]
