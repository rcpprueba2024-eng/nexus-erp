from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("taller", "0007_alter_historialestado_estado_anterior_and_more"),
        ("ventas", "0010_equipo"),
    ]

    operations = [
        migrations.AddField(
            model_name="ordentaller",
            name="equipo_vinculado",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="ordenes", to="ventas.equipo"),
        ),
    ]
