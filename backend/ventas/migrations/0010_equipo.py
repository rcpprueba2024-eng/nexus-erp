from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("ventas", "0009_remove_cliente_es_empresa_legacy"),
        ("inventario", "0005_modelo_producto_modelo_fk"),
    ]

    operations = [
        migrations.CreateModel(
            name="Equipo",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("categoria_equipo", models.CharField(choices=[("COMPUTADORA", "Computadora"), ("CELULAR", "Celular"), ("TABLET", "Tablet"), ("OTRO", "Otro")], default="COMPUTADORA", max_length=20)),
                ("color", models.CharField(blank=True, max_length=50)),
                ("no_serie", models.CharField(blank=True, max_length=100)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                ("cliente", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="equipos", to="ventas.cliente")),
                ("marca", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="equipos_cliente", to="inventario.marca")),
                ("modelo", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="equipos_cliente", to="inventario.modelo")),
            ],
            options={"ordering": ["-creado_en"]},
        ),
    ]
