"""Catálogo de ejemplo (categorías + productos reales, con precio y stock)
para poder probar Facturación de Productos / POS sin tener que cargar
inventario real primero. Re-ejecutable: usa get_or_create por código."""
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from inventario.models import CategoriaProducto, UnidadMedida, Producto

UND = UnidadMedida.objects.get(nombre="Unidad")
GRAMO = UnidadMedida.objects.get(nombre="Gramo")
PAQUETE = UnidadMedida.objects.get(nombre="Paquete")

categorias = {
    "Baterías": "PRODUCTO",
    "Pantallas": "PRODUCTO",
    "Repuestos varios": "REPUESTO",
    "Accesorios": "ACCESORIO",
    "Insumos": "INSUMO",
}
cat = {}
for nombre, tipo in categorias.items():
    cat[nombre], _ = CategoriaProducto.objects.get_or_create(nombre=nombre, defaults={"tipo": tipo})

productos = [
    # codigo, nombre, categoria, unidad, precio_venta, stock
    ("BAT-IPH11", "Batería iPhone 11", "Baterías", UND, 22.00, 15),
    ("BAT-SAMA20", "Batería Samsung A20", "Baterías", UND, 15.00, 12),
    ("BAT-LAP-GEN", "Batería genérica para laptop", "Baterías", UND, 45.00, 6),
    ("PANT-IPH11", "Pantalla iPhone 11", "Pantallas", UND, 65.00, 8),
    ("PANT-SAMA20", "Pantalla Samsung A20", "Pantallas", UND, 48.00, 7),
    ("PANT-LAP156", 'Pantalla laptop 15.6" HD', "Pantallas", UND, 55.00, 5),
    ("PTOCARGA-IPH", "Puerto de carga iPhone (flex)", "Repuestos varios", UND, 12.00, 20),
    ("FLEX-SAM", "Flex de carga Samsung", "Repuestos varios", UND, 10.00, 18),
    ("TEC-LAP-GEN", "Teclado de laptop genérico", "Repuestos varios", UND, 18.00, 10),
    ("CAB-USBC", "Cable USB-C 1m", "Accesorios", UND, 5.00, 40),
    ("CARG-20W", "Cargador rápido 20W", "Accesorios", UND, 12.00, 25),
    ("FUNDA-UNIV", "Funda protectora universal", "Accesorios", UND, 6.00, 30),
    ("MICA-VT", "Mica de vidrio templado", "Accesorios", UND, 4.00, 50),
    ("PASTA-TERM", "Pasta térmica (por gramo)", "Insumos", GRAMO, 0.60, 500),
    ("ALCOHOL-ISO", "Alcohol isopropranol (paquete)", "Insumos", PAQUETE, 3.50, 20),
]

creados = 0
for codigo, nombre, cat_nombre, unidad, precio, stock in productos:
    _, created = Producto.objects.get_or_create(
        codigo=codigo,
        defaults=dict(
            nombre=nombre, categoria=cat[cat_nombre], unidad_medida=unidad,
            subgrupo="REPUESTO", condicion="NUEVO", moneda="USD",
            precio_compra=round(precio * 0.6, 2), precio_venta=precio,
            stock_actual=stock, stock_minimo=max(2, stock // 5),
        ),
    )
    if created:
        creados += 1

print(f"Categorías: {len(cat)} | Productos creados: {creados} | Total productos: {Producto.objects.count()}")
