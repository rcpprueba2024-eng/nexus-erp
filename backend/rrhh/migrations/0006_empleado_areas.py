from django.db import migrations, models


def copiar_area_a_areas(apps, schema_editor):
    Empleado = apps.get_model("rrhh", "Empleado")
    for empleado in Empleado.objects.all():
        empleado.areas = [empleado.area] if empleado.area else []
        empleado.save(update_fields=["areas"])


def copiar_areas_a_area(apps, schema_editor):
    Empleado = apps.get_model("rrhh", "Empleado")
    for empleado in Empleado.objects.all():
        empleado.area = empleado.areas[0] if empleado.areas else "BACKOFFICE"
        empleado.save(update_fields=["area"])


class Migration(migrations.Migration):

    dependencies = [
        ('rrhh', '0005_empleado_puestos'),
    ]

    operations = [
        migrations.AddField(
            model_name='empleado',
            name='areas',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.RunPython(copiar_area_a_areas, copiar_areas_a_area),
        migrations.RemoveField(
            model_name='empleado',
            name='area',
        ),
    ]
