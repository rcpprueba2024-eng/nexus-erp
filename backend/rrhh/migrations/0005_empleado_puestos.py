from django.db import migrations, models


def copiar_puesto_a_puestos(apps, schema_editor):
    Empleado = apps.get_model("rrhh", "Empleado")
    for empleado in Empleado.objects.all():
        empleado.puestos = [empleado.puesto] if empleado.puesto else []
        empleado.save(update_fields=["puestos"])


def copiar_puestos_a_puesto(apps, schema_editor):
    Empleado = apps.get_model("rrhh", "Empleado")
    for empleado in Empleado.objects.all():
        empleado.puesto = ", ".join(empleado.puestos)
        empleado.save(update_fields=["puesto"])


class Migration(migrations.Migration):

    dependencies = [
        ('rrhh', '0004_permisoempleado_horarioempleado'),
    ]

    operations = [
        migrations.AddField(
            model_name='empleado',
            name='puestos',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.RunPython(copiar_puesto_a_puestos, copiar_puestos_a_puesto),
        migrations.RemoveField(
            model_name='empleado',
            name='puesto',
        ),
    ]
