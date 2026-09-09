from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("ventas", "0006_factura_moneda_factura_tasa_cambio_aplicada_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="Empresa",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nombre", models.CharField(max_length=200, unique=True)),
                ("ruc", models.CharField(blank=True, max_length=30, verbose_name="RUC")),
                ("direccion", models.CharField(blank=True, max_length=255)),
                ("telefono", models.CharField(blank=True, max_length=30)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["nombre"]},
        ),
        migrations.RenameField(
            model_name="cliente",
            old_name="empresa",
            new_name="es_empresa_legacy",
        ),
        migrations.AddField(
            model_name="cliente",
            name="tipo_cliente",
            field=models.CharField(blank=True, choices=[("PARTICULAR", "Particular"), ("EMPRESA", "Empresa"), ("GOBIERNO", "Gobierno"), ("MAYORISTA", "Mayorista"), ("REVENDEDOR", "Revendedor")], max_length=20),
        ),
        migrations.AddField(
            model_name="cliente",
            name="notas",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="cliente",
            name="empresa",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="contactos", to="ventas.empresa"),
        ),
    ]
