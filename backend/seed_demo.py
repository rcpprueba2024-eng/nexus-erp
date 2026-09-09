import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from datetime import date, timedelta
from django.contrib.auth.models import User
from core.models import Perfil
from inventario.models import CategoriaProducto, SubcategoriaProducto, Marca, Producto, MovimientoInventario
from ventas.models import Cliente, Factura, DetalleFactura
from compras.models import Proveedor, OrdenCompra, DetalleOrdenCompra
from contabilidad.models import CuentaPorCobrar, CuentaPorPagar
from rrhh.models import Empleado
from taller.models import OrdenTaller, InsumoUsado

# --- Usuarios / roles ---
usuarios_data = [
    ("admin", "RcpAdmin2026!", "ADMIN", True, "Gerencia"),
    ("taller1", "Taller2026!", "TALLER", False, "Taller"),
    ("pasante1", "Pasante2026!", "PASANTE", False, "Pasante"),
    ("ventas1", "Ventas2026!", "VENTAS", False, "Ventas"),
    ("rrhh1", "Rrhh2026!", "RRHH", False, "RRHH"),
    ("backoffice1", "Backoffice2026!", "BACKOFFICE", False, "Backoffice"),
]
for username, password, rol, is_super, nombre in usuarios_data:
    user, created = User.objects.get_or_create(username=username, defaults={"first_name": nombre})
    if created:
        user.set_password(password)
        user.is_staff = True
        user.is_superuser = is_super
        user.save()
    Perfil.objects.get_or_create(user=user, defaults={"rol": rol})

# --- Inventario: categorías ---
cat_laptops, _ = CategoriaProducto.objects.get_or_create(nombre="Computadoras")
cat_celulares, _ = CategoriaProducto.objects.get_or_create(nombre="Celulares")
cat_repuestos, _ = CategoriaProducto.objects.get_or_create(nombre="Repuestos")
cat_perifericos, _ = CategoriaProducto.objects.get_or_create(nombre="Artículos para computadora")
cat_insumos, _ = CategoriaProducto.objects.get_or_create(nombre="Insumos de taller")

# --- Inventario: marcas ---
marcas = {}
for nombre_marca in ["HP", "Dell", "Lenovo", "Acer", "Apple", "Samsung"]:
    marcas[nombre_marca], _ = Marca.objects.get_or_create(nombre=nombre_marca)

# --- Inventario: subcategorías ---
subcat_ultrabooks, _ = SubcategoriaProducto.objects.get_or_create(categoria=cat_laptops, nombre="Ultrabooks")
subcat_gamer, _ = SubcategoriaProducto.objects.get_or_create(categoria=cat_laptops, nombre="Gama gamer")
subcat_gama_alta, _ = SubcategoriaProducto.objects.get_or_create(categoria=cat_celulares, nombre="Gama alta")
subcat_pantallas, _ = SubcategoriaProducto.objects.get_or_create(categoria=cat_repuestos, nombre="Pantallas")
subcat_baterias, _ = SubcategoriaProducto.objects.get_or_create(categoria=cat_repuestos, nombre="Baterías")

# codigo, nombre, categoria, subgrupo, unidad, precio_compra, precio_venta, stock, minimo
productos_data = [
    ("PC-001", "Laptop HP Pavilion 14 (abandonada)", cat_laptops, "ABANDONADA", "UND", 0, 0, 3, 0),
    ("PC-002", "Laptop Acer Aspire 5 (abandonada)", cat_laptops, "ABANDONADA", "UND", 0, 0, 2, 0),
    ("PC-003", "Laptop Dell Inspiron 15 (en taller)", cat_laptops, "EN_TALLER", "UND", 0, 0, 1, 0),
    ("PC-004", "Laptop Lenovo ThinkPad (uso interno - Ventas)", cat_laptops, "USO_PERSONAL", "UND", 0, 0, 1, 0),
    ("PC-005", "Laptop HP ProBook (uso interno - Taller)", cat_laptops, "USO_PERSONAL", "UND", 0, 0, 1, 0),
    ("RSP-001", "Memoria RAM 8GB DDR4", cat_repuestos, "REPUESTO", "UND", 350, 550, 25, 5),
    ("RSP-002", "Disco SSD 480GB", cat_repuestos, "REPUESTO", "UND", 650, 980, 15, 5),
    ("RSP-003", "Cargador universal laptop", cat_repuestos, "REPUESTO", "UND", 180, 320, 20, 5),
    ("RSP-004", "Pantalla LCD 15.6\"", cat_repuestos, "REPUESTO", "UND", 900, 1400, 6, 2),
    ("PER-001", "Mouse inalámbrico", cat_perifericos, "REPUESTO", "UND", 120, 220, 30, 8),
    ("PER-002", "Teclado USB", cat_perifericos, "REPUESTO", "UND", 150, 260, 18, 5),
    ("INS-001", "Pasta térmica", cat_insumos, "INSUMO_TALLER", "UND", 60, 0, 12, 3),
    ("INS-002", "Alcohol isopropílico", cat_insumos, "INSUMO_TALLER", "LT", 90, 0, 8, 2),
    ("INS-003", "Kit de destornilladores de precisión", cat_insumos, "INSUMO_TALLER", "UND", 250, 0, 4, 1),
    ("LST-001", "Laptop Acer Aspire (lista para retiro)", cat_laptops, "LISTO_ENTREGA", "UND", 0, 1450, 1, 0),
    ("CEL-001", "iPhone 12 64GB (reacondicionado)", cat_celulares, "LISTO_ENTREGA", "UND", 4500, 6200, 3, 1),
    ("CEL-002", "Samsung Galaxy A54", cat_celulares, "REPUESTO", "UND", 3200, 4500, 5, 2),
    ("CEL-003", "Pantalla iPhone 12", cat_repuestos, "REPUESTO", "UND", 850, 1300, 6, 2),
    ("CEL-004", "Batería genérica para celular", cat_repuestos, "REPUESTO", "UND", 180, 320, 15, 5),
    ("ART-001", "Funda protectora universal", cat_perifericos, "REPUESTO", "UND", 40, 90, 25, 5),
]

productos = {}
for codigo, nombre, cat, subgrupo, unidad, pc, pv, stock, minimo in productos_data:
    p, created = Producto.objects.get_or_create(
        codigo=codigo,
        defaults=dict(nombre=nombre, categoria=cat, subgrupo=subgrupo, unidad_medida=unidad,
                      precio_compra=pc, precio_venta=pv, stock_actual=0, stock_minimo=minimo),
    )
    productos[codigo] = p
    if created and stock:
        MovimientoInventario.objects.create(producto=p, tipo="ENTRADA", cantidad=stock, motivo="Stock inicial")

# --- Inventario: asignar marca / subcategoría / moneda a algunos productos de ejemplo ---
asignaciones_marca = {
    "PC-001": (marcas["HP"], None), "PC-005": (marcas["HP"], subcat_ultrabooks),
    "PC-002": (marcas["Acer"], None), "LST-001": (marcas["Acer"], None),
    "PC-003": (marcas["Dell"], subcat_gamer), "PC-004": (marcas["Lenovo"], subcat_ultrabooks),
    "CEL-001": (marcas["Apple"], subcat_gama_alta), "CEL-002": (marcas["Samsung"], subcat_gama_alta),
    "CEL-003": (marcas["Apple"], subcat_pantallas), "RSP-004": (None, subcat_pantallas),
    "CEL-004": (None, subcat_baterias),
}
for codigo, (marca_obj, subcat_obj) in asignaciones_marca.items():
    Producto.objects.filter(codigo=codigo).update(marca=marca_obj, subcategoria=subcat_obj, moneda="USD")

# --- Ventas: clientes ---
clientes_data = [
    ("Comercial Aurora SA de CV", "AUC-990101-XX1", "compras@aurora.com", "555-100-2001"),
    ("Ferretería El Tornillo", "FET-870212-YY2", "ventas@eltornillo.com", "555-100-2002"),
    ("Distribuidora Norte SRL", "DNO-050303-ZZ3", "contacto@distnorte.com", "555-100-2003"),
]
clientes = {}
for nombre, doc, email, tel in clientes_data:
    c, _ = Cliente.objects.get_or_create(nombre=nombre, defaults=dict(documento=doc, email=email, telefono=tel))
    clientes[nombre] = c

vendedor_user = User.objects.get(username="ventas1")

# Se limpian las tablas transaccionales para regenerarlas con la nueva lógica
# de ventas (producto/servicio) y enrutamiento a Taller; los catálogos
# (clientes, proveedores, productos, empleados, usuarios) no se tocan.
InsumoUsado.objects.all().delete()
OrdenTaller.objects.all().delete()
DetalleFactura.objects.all().delete()
Factura.objects.all().delete()
DetalleOrdenCompra.objects.all().delete()
OrdenCompra.objects.all().delete()
CuentaPorCobrar.objects.all().delete()
CuentaPorPagar.objects.all().delete()

if True:
    f1 = Factura.objects.create(numero="FAC-0001", cliente=clientes["Comercial Aurora SA de CV"], estado="PAGADA", vendedor=vendedor_user)
    DetalleFactura.objects.create(factura=f1, tipo="PRODUCTO", producto=productos["LST-001"], cantidad=1, precio_unitario=productos["LST-001"].precio_venta)

    f2 = Factura.objects.create(numero="FAC-0002", cliente=clientes["Ferretería El Tornillo"], estado="PENDIENTE", vendedor=vendedor_user)
    DetalleFactura.objects.create(factura=f2, tipo="PRODUCTO", producto=productos["RSP-001"], cantidad=2, precio_unitario=productos["RSP-001"].precio_venta)

    # Venta de servicio -> genera orden de taller automáticamente
    f3 = Factura.objects.create(numero="FAC-0003", cliente=clientes["Distribuidora Norte SRL"], estado="PAGADA", vendedor=vendedor_user)
    DetalleFactura.objects.create(
        factura=f3, tipo="SERVICIO", servicio_tipo="DIAGNOSTICO",
        equipo_descripcion="iPhone 12 - no carga", descripcion="Diagnóstico de puerto de carga",
        cantidad=1, precio_unitario=250,
    )

    f4 = Factura.objects.create(numero="FAC-0004", cliente=clientes["Comercial Aurora SA de CV"], estado="PENDIENTE", vendedor=vendedor_user)
    DetalleFactura.objects.create(
        factura=f4, tipo="SERVICIO", servicio_tipo="MANTENIMIENTO",
        equipo_descripcion="Laptop Lenovo ThinkPad", descripcion="Mantenimiento preventivo y limpieza",
        cantidad=1, precio_unitario=400,
    )

    f5 = Factura.objects.create(numero="FAC-0005", cliente=clientes["Ferretería El Tornillo"], estado="PAGADA", vendedor=vendedor_user)
    DetalleFactura.objects.create(factura=f5, tipo="PRODUCTO", producto=productos["CEL-002"], cantidad=1, precio_unitario=productos["CEL-002"].precio_venta)
    DetalleFactura.objects.create(factura=f5, tipo="PRODUCTO", producto=productos["ART-001"], cantidad=2, precio_unitario=productos["ART-001"].precio_venta)

# --- Compras: proveedores ---
proveedores_data = [
    ("Tech Supplies Internacional", "TSI-880404-AA1", "ventas@techsupplies.com", "555-200-3001"),
    ("Refacciones y Cómputo del Centro", "RCC-920505-BB2", "pedidos@refaccioncomputo.com", "555-200-3002"),
]
proveedores = {}
for nombre, doc, email, tel in proveedores_data:
    p, _ = Proveedor.objects.get_or_create(nombre=nombre, defaults=dict(documento=doc, email=email, telefono=tel))
    proveedores[nombre] = p

if True:
    oc1 = OrdenCompra.objects.create(numero="OC-0001", proveedor=proveedores["Tech Supplies Internacional"], estado="RECIBIDA")
    DetalleOrdenCompra.objects.create(orden=oc1, producto=productos["RSP-002"], cantidad=10, precio_unitario=productos["RSP-002"].precio_compra)

    oc2 = OrdenCompra.objects.create(numero="OC-0002", proveedor=proveedores["Refacciones y Cómputo del Centro"], estado="PENDIENTE")
    DetalleOrdenCompra.objects.create(orden=oc2, producto=productos["RSP-004"], cantidad=5, precio_unitario=productos["RSP-004"].precio_compra)

# --- RRHH: empleados ---
empleados_data = [
    ("María López", "0801-1990-00011", "Gerente de Ventas", "VENTAS", 22000, "maria.lopez@rcp.com", "555-300-1001", date(2022, 3, 1), ["PC-004"]),
    ("Carlos Ramírez", "0801-1992-00022", "Técnico de Taller", "TALLER", 14000, "carlos.ramirez@rcp.com", "555-300-1002", date(2023, 6, 15), ["PC-005"]),
    ("Luis Fernández", "0801-1993-00055", "Técnico de Taller", "TALLER", 14500, "luis.fernandez@rcp.com", "555-300-1005", date(2024, 2, 1), []),
    ("Ana Torres", "0801-1988-00033", "Contadora", "BACKOFFICE", 18000, "ana.torres@rcp.com", "555-300-1003", date(2021, 1, 10), []),
    ("José Martínez", "0801-1995-00044", "Encargado de RRHH", "RRHH", 16000, "jose.martinez@rcp.com", "555-300-1004", date(2023, 1, 20), []),
]
empleados = {}
for nombre, cedula, puesto, area, salario, email, tel, ingreso, equipos in empleados_data:
    emp, _ = Empleado.objects.get_or_create(
        cedula=cedula,
        defaults=dict(nombre=nombre, puestos=[puesto], areas=[area], salario=salario, email=email, telefono=tel, fecha_ingreso=ingreso),
    )
    empleados[nombre] = emp
    for codigo in equipos:
        emp.equipos_asignados.add(productos[codigo])

# --- Contabilidad ---
if True:
    CuentaPorCobrar.objects.create(
        cliente=clientes["Ferretería El Tornillo"],
        factura=Factura.objects.get(numero="FAC-0002"),
        monto=950, fecha_vencimiento=date.today() + timedelta(days=15), estado="PENDIENTE",
    )

if True:
    CuentaPorPagar.objects.create(
        proveedor=proveedores["Refacciones y Cómputo del Centro"],
        orden_compra=OrdenCompra.objects.get(numero="OC-0002"),
        monto=4500, fecha_vencimiento=date.today() + timedelta(days=10), estado="PENDIENTE",
    )

# --- Taller: órdenes de servicio ---
if True:
    ot1 = OrdenTaller.objects.create(
        numero="OT-0001",
        cliente=clientes["Comercial Aurora SA de CV"],
        equipo="Laptop Dell Inspiron 15",
        problema_reportado="No enciende, posible falla de fuente de poder",
        tecnico=empleados["Carlos Ramírez"],
        estado="EN_REPARACION",
        fecha_entrega_estimada=date.today() + timedelta(days=3),
        costo_estimado=650,
    )
    InsumoUsado.objects.create(orden=ot1, producto=productos["INS-001"], cantidad=1)

    ot2 = OrdenTaller.objects.create(
        numero="OT-0002",
        cliente=clientes["Ferretería El Tornillo"],
        equipo="Laptop Acer Aspire",
        problema_reportado="Cambio de pantalla por rotura",
        tecnico=empleados["Carlos Ramírez"],
        estado="LISTO_ENTREGA",
        fecha_entrega_estimada=date.today(),
        costo_estimado=1450,
    )

    OrdenTaller.objects.create(
        numero="OT-0003",
        cliente=clientes["Distribuidora Norte SRL"],
        equipo="Laptop HP Pavilion",
        problema_reportado="Limpieza general y cambio de pasta térmica",
        tecnico=empleados["Carlos Ramírez"],
        estado="RECIBIDO",
        fecha_entrega_estimada=date.today() + timedelta(days=2),
        costo_estimado=300,
    )

    # Órdenes ya entregadas, para alimentar el reporte de eficiencia de técnicos
    ot4 = OrdenTaller.objects.create(
        numero="OT-0004",
        cliente=clientes["Comercial Aurora SA de CV"],
        equipo="Samsung Galaxy A54",
        problema_reportado="Cambio de batería",
        tecnico=empleados["Luis Fernández"],
        estado="ENTREGADO",
        costo_estimado=350,
    )
    OrdenTaller.objects.filter(pk=ot4.pk).update(fecha_ingreso=date.today() - timedelta(days=2))
    ot4.refresh_from_db()
    OrdenTaller.objects.filter(pk=ot4.pk).update(fecha_entrega_real=date.today())

    ot5 = OrdenTaller.objects.create(
        numero="OT-0005",
        cliente=clientes["Ferretería El Tornillo"],
        equipo="iPhone 12",
        problema_reportado="Cambio de pantalla",
        tecnico=empleados["Luis Fernández"],
        estado="ENTREGADO",
        costo_estimado=1300,
    )
    OrdenTaller.objects.filter(pk=ot5.pk).update(fecha_ingreso=date.today() - timedelta(days=1), fecha_entrega_real=date.today())

    ot6 = OrdenTaller.objects.create(
        numero="OT-0006",
        cliente=clientes["Distribuidora Norte SRL"],
        equipo="Laptop Dell Inspiron",
        problema_reportado="Formateo e instalación de software",
        tecnico=empleados["Carlos Ramírez"],
        estado="ENTREGADO",
        costo_estimado=300,
    )
    OrdenTaller.objects.filter(pk=ot6.pk).update(fecha_ingreso=date.today() - timedelta(days=5), fecha_entrega_real=date.today())

print("Datos de demo cargados correctamente para RCP (taller de equipos).")
print("Usuarios demo: admin/RcpAdmin2026! | taller1/Taller2026! | ventas1/Ventas2026! | rrhh1/Rrhh2026! | backoffice1/Backoffice2026!")
