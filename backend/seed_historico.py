"""Genera 3 años de historial operativo realista y a gran escala para
probar el sistema como si RCP ya tuviera tiempo trabajando con volumen
real: clientes, personal, órdenes de taller, ventas, compras, cuentas,
horas y movimientos de inventario. A diferencia de seed_demo.py, esto se
deja permanentemente en el sistema (no es para borrar después).

Uso: backend/venv/Scripts/python.exe seed_historico.py
"""
import os
import random
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth.models import User
from django.utils import timezone

from core.models import Configuracion
from inventario.models import Producto
from ventas.models import Cliente, Factura, DetalleFactura
from compras.models import Proveedor, OrdenCompra, DetalleOrdenCompra
from contabilidad.models import CuentaPorCobrar, CuentaPorPagar
from rrhh.models import Empleado, RegistroHoras
from taller.models import OrdenTaller, InsumoUsado

random.seed(7)
HOY = date.today()
HACE_3_ANIOS = HOY - timedelta(days=365 * 3)


def fecha_aleatoria(desde=HACE_3_ANIOS, hasta=HOY):
    dias = (hasta - desde).days
    # Sesgo leve hacia fechas más recientes (negocio creciendo con el tiempo).
    r = random.random() ** 0.7
    return desde + timedelta(days=int(r * dias))


def backdate(modelo, campo, pares):
    """pares: lista de (pk, fecha). Usa bulk_update para esquivar
    auto_now_add (que ignora cualquier valor pasado en save())."""
    objs = []
    for pk, fecha in pares:
        obj = modelo(pk=pk)
        setattr(obj, campo, fecha)
        objs.append(obj)
    for i in range(0, len(objs), 500):
        modelo.objects.bulk_update(objs[i:i + 500], [campo])


NOMBRES_H = ["Carlos", "Luis", "Pedro", "Juan", "Miguel", "Francisco", "Antonio", "Ricardo",
             "Fernando", "Roberto", "Jorge", "Eduardo", "Sergio", "Alejandro", "Rafael", "Oscar",
             "Mario", "Kevin", "Denis", "Marvin", "Iván", "Elvin", "Byron", "Freddy"]
NOMBRES_M = ["Ana", "María", "Rosa", "Carmen", "Isabel", "Patricia", "Sandra", "Martha",
             "Claudia", "Yolanda", "Karla", "Xiomara", "Meyling", "Marlene", "Auxiliadora",
             "Concepción", "Ligia", "Yesenia", "Scarleth", "Massiel"]
APELLIDOS = ["López", "Martínez", "González", "Rodríguez", "Pérez", "Sánchez", "Ramírez",
             "Torres", "Flores", "Rivera", "Gómez", "Díaz", "Reyes", "Morales", "Castro",
             "Ortiz", "Gutiérrez", "Chávez", "Ramos", "Vargas", "Mendoza", "Aguilar",
             "Espinoza", "Castillo", "Salazar", "Cruz", "Herrera", "Medina", "Jarquín",
             "Baltodano", "Membreño", "Sequeira", "Aráuz", "Sevilla", "Talavera", "Zeledón",
             "Blandón", "Cerda", "Pavón", "Úbeda"]


def nombre_persona():
    if random.random() < 0.5:
        nombre = random.choice(NOMBRES_H)
    else:
        nombre = random.choice(NOMBRES_M)
    return f"{nombre} {random.choice(APELLIDOS)} {random.choice(APELLIDOS)}"


def cedula_unica(contador):
    anio = random.choice(list(range(70, 100)) + list(range(0, 6)))
    return f"{contador % 999 + 1:03d}-{random.randint(1,28):02d}{random.randint(1,12):02d}{anio:02d}-{contador:04d}{random.choice('ABCDE')}"


EMPRESAS_CLIENTE = ["Ferretería El Tornillo", "Comercial Managua Digital", "Óptica Visión Clara",
                    "Farmacia San Rafael", "Distribuidora La Colonia", "Restaurante Doña Elba",
                    "Autolote Las Américas", "Clínica Dental Sonrisas", "Panadería El Buen Pan",
                    "Librería Universal"]

EQUIPOS_CCA = ["iPhone 11", "iPhone 12", "iPhone 13", "iPhone 13 Pro", "iPhone SE",
               "Samsung Galaxy A54", "Samsung Galaxy S21", "Samsung Galaxy A14",
               "Xiaomi Redmi Note 12", "Motorola Moto G", "iPhone 14", "Samsung Galaxy A34"]
EQUIPOS_TABLET = ["Tablet Samsung Tab A8", "iPad 9na Gen", "iPad Air"]
EQUIPOS_COM = ["Laptop HP Pavilion 14", "Laptop HP ProBook", "Laptop Dell Inspiron 15",
               "Laptop Dell Latitude", "Laptop Lenovo ThinkPad", "Laptop Lenovo IdeaPad",
               "Laptop Acer Aspire 5", "MacBook Air M1", "MacBook Pro 13",
               "PC de escritorio Gamer", "PC de escritorio HP"]

PROBLEMAS = ["No enciende", "Pantalla rota", "No carga / batería dañada",
             "Muy lento, necesita mantenimiento", "No reconoce el WiFi",
             "Se calienta demasiado", "Cambio de disco a SSD",
             "Formateo e instalación de sistema operativo", "Puerto de carga dañado",
             "Cámara no funciona", "Botón de encendido no responde",
             "Micrófono no funciona", "Bocina dañada", "Pantalla con líneas",
             "Batería se descarga muy rápido", "Actualización de RAM",
             "Limpieza interna y cambio de pasta térmica", "No detecta la SIM",
             "Reingreso por falla recurrente", "Diagnóstico general"]

MARCAS_CCA = {"iPhone": "Apple", "Samsung": "Samsung", "Xiaomi": "Xiaomi", "Motorola": "Motorola", "iPad": "Apple"}


print("=== 1/9: Personal (RRHH) ===")
puestos_por_area = {
    "TALLER": ["Técnico de Taller", "Técnico Senior", "Técnico Junior"],
    "PASANTE": ["Pasante de Taller"],
    "VENTAS": ["Asesor de Ventas", "Cajero(a)"],
    "RRHH": ["Encargado de RRHH"],
    "BACKOFFICE": ["Contador(a)", "Auxiliar Contable"],
}
plan_nuevos = [
    ("TALLER", 4), ("PASANTE", 2), ("VENTAS", 4), ("RRHH", 1), ("BACKOFFICE", 2),
]
nuevos_empleados = []
contador_ced = 100
for area, cantidad in plan_nuevos:
    for _ in range(cantidad):
        nombre = nombre_persona()
        contador_ced += 1
        emp = Empleado.objects.create(
            nombre=nombre,
            cedula=cedula_unica(contador_ced),
            puestos=[random.choice(puestos_por_area[area])],
            areas=[area],
            salario=Decimal(random.choice([9000, 11000, 12500, 14000, 16000, 18000, 22000, 26000])),
            telefono=f"8{random.randint(1000000,9999999)}",
            fecha_ingreso=fecha_aleatoria(HACE_3_ANIOS, HOY - timedelta(days=30)),
            activo=random.random() > 0.06,
        )
        nuevos_empleados.append(emp)
print(f"  {len(nuevos_empleados)} empleados nuevos creados.")

tecnicos = [e for e in Empleado.objects.filter(activo=True) if set(e.areas) & {"TALLER", "PASANTE"}]
vendedores_empleado = [e for e in Empleado.objects.filter(activo=True) if "VENTAS" in e.areas]
print(f"  Técnicos disponibles: {len(tecnicos)} | Vendedores (empleado): {len(vendedores_empleado)}")

# Usuarios "vendedor" (FK real de Factura/OrdenTaller es a auth.User, no a
# Empleado) — uno por cada empleado de ventas, sin poder iniciar sesión
# (password inutilizable), solo para que los reportes de ventas muestren
# nombres reales y variados.
usuarios_vendedores = []
for emp in vendedores_empleado:
    username = f"v_{emp.id}"
    u, created = User.objects.get_or_create(username=username, defaults={"first_name": emp.nombre.split()[0] + " " + emp.nombre.split()[1]})
    if created:
        u.set_unusable_password()
        u.save()
    usuarios_vendedores.append(u)
usuarios_vendedores += list(User.objects.filter(username__in=["admin", "ventas1"]))
print(f"  Usuarios vendedor disponibles: {len(usuarios_vendedores)}")


print("=== 2/9: Clientes ===")
clientes_nuevos = []
for _ in range(210):
    es_empresa = random.random() < 0.08
    nombre = random.choice(EMPRESAS_CLIENTE) + f" #{random.randint(2,50)}" if es_empresa else nombre_persona()
    c = Cliente(
        nombre=nombre,
        telefono=f"8{random.randint(1000000,9999999)}",
        email="" if random.random() < 0.4 else f"cliente{random.randint(1,99999)}@example.com",
        direccion=random.choice(["Managua", "Masaya", "Granada", "León", "Ciudad Sandino", "Tipitapa", "Diriamba"]) + ", Nicaragua",
        whatsapp=random.random() < 0.7,
        empresa=es_empresa,
    )
    clientes_nuevos.append(c)
Cliente.objects.bulk_create(clientes_nuevos, batch_size=500)
clientes = list(Cliente.objects.all())
print(f"  {len(clientes_nuevos)} clientes nuevos. Total clientes: {len(clientes)}")


print("=== 3/9: Proveedores ===")
NOMBRES_PROVEEDOR = ["Bismóvil", "Discos y Más", "CompuPartes S.A.", "Importadora TecnoGlobal",
                     "Distribuidora Managua Digital", "Repuestos El Ingeniero",
                     "PC Wholesale Centroamérica", "Accesorios y Más", "MegaCell Distribuidora",
                     "Suministros de Oficina RCP", "Baterías y Cargadores CA", "Pantallas Express"]
proveedores = []
for nombre in NOMBRES_PROVEEDOR:
    p, _ = Proveedor.objects.get_or_create(nombre=nombre, defaults={
        "telefono": f"2{random.randint(2000000,2999999)}",
        "email": f"ventas@{nombre.lower().replace(' ', '').replace('í','i').replace('ó','o')[:12]}.com",
    })
    proveedores.append(p)
print(f"  {len(proveedores)} proveedores.")


print("=== 4/9: Órdenes de taller (esto tarda un poco) ===")
productos_para_insumo = list(Producto.objects.filter(stock_actual__gt=0))
ordenes_creadas = []
fechas_ordenes = []
N_ORDENES = 1500
numero_base = 7000
for i in range(N_ORDENES):
    cca = random.random() < 0.6
    if cca:
        es_tablet = random.random() < 0.12
        equipo = random.choice(EQUIPOS_TABLET) if es_tablet else random.choice(EQUIPOS_CCA)
        categoria = "TABLET" if es_tablet else "CELULAR"
    else:
        equipo = random.choice(EQUIPOS_COM)
        categoria = "COMPUTADORA"
    marca = next((v for k, v in MARCAS_CCA.items() if k in equipo), equipo.split()[1] if len(equipo.split()) > 1 else "")

    fecha = fecha_aleatoria()
    dias_desde = (HOY - fecha).days
    if dias_desde > 20:
        estado = "ENTREGADO" if random.random() > 0.03 else "CANCELADO"
    else:
        estado = random.choices(
            ["RECIBIDO", "DIAGNOSTICO", "EN_REPARACION", "ESPERANDO_REPUESTO", "LISTO_ENTREGA", "ENTREGADO"],
            weights=[15, 10, 20, 10, 15, 30],
        )[0]

    tecnico = random.choice(tecnicos) if tecnicos and random.random() > 0.05 else None
    vendedor = random.choice(usuarios_vendedores)
    costo = Decimal(random.choice([15, 20, 25, 30, 35, 45, 50, 65, 80, 100, 120, 150]))
    moneda = "NIO" if random.random() < 0.28 else "USD"

    orden = OrdenTaller(
        numero=f"OT-{numero_base + i}",
        cliente=random.choice(clientes),
        equipo=equipo,
        categoria_equipo=categoria,
        tipo_servicio=random.choice(["MANTENIMIENTO", "DIAGNOSTICO", "REPARACION"]),
        problema_reportado=random.choice(PROBLEMAS),
        tecnico=tecnico,
        estado=estado,
        marca=marca,
        modelo=equipo,
        costo_estimado=costo,
        moneda=moneda,
        vendedor=vendedor,
        como_supo=random.choice(["REFERIDO", "GOOGLE", "INSTAGRAM", "TIKTOK", "RECURRENTE", "OTRO"]),
    )
    if estado == "ENTREGADO":
        orden.fecha_entrega_real = fecha + timedelta(days=random.randint(1, 8))
    ordenes_creadas.append(orden)
    fechas_ordenes.append(fecha)

nuevas = OrdenTaller.objects.bulk_create(ordenes_creadas, batch_size=500)
print(f"  {len(nuevas)} órdenes creadas, aplicando fechas históricas...")

# Reasignar fecha_ingreso real (auto_now_add las puso en "hoy" al crear) —
# reusando LA MISMA fecha que ya se usó para decidir el estado arriba, no
# una nueva al azar (si no, una orden "Recibida" podía terminar con fecha
# de hace 2 años, algo que nunca pasaría en la vida real).
pares = list(zip((o.pk for o in nuevas), fechas_ordenes))
backdate(OrdenTaller, "fecha_ingreso", pares)
print("  Fechas históricas aplicadas.")

print("=== 5/9: Insumos usados en órdenes ===")
n_insumos = 0
if productos_para_insumo:
    for orden in random.sample(nuevas, k=min(500, len(nuevas))):
        for _ in range(random.randint(1, 2)):
            prod = random.choice(productos_para_insumo)
            prod.refresh_from_db()
            if prod.stock_actual < 1:
                continue
            cantidad = min(random.randint(1, 2), prod.stock_actual)
            InsumoUsado.objects.create(orden=orden, producto=prod, cantidad=cantidad)
            n_insumos += 1
print(f"  {n_insumos} insumos registrados.")


print("=== 6/9: Ventas (POS / facturas) ===")
tasa_actual = Configuracion.actual().tasa_cambio_usd
productos_vendibles = list(Producto.objects.filter(precio_venta__gt=0))
N_FACTURAS = 700
numero_f = 5000
facturas_pk_fecha = []
for i in range(N_FACTURAS):
    moneda = "NIO" if random.random() < 0.3 else "USD"
    factura = Factura.objects.create(
        numero=f"POS-{numero_f + i}",
        cliente=random.choice(clientes),
        vendedor=random.choice(usuarios_vendedores),
        estado=random.choices(["PAGADA", "PENDIENTE", "ANULADA"], weights=[88, 9, 3])[0],
        moneda=moneda,
        tasa_cambio_aplicada=tasa_actual,
    )
    for _ in range(random.randint(1, 4)):
        prod = random.choice(productos_vendibles)
        precio = prod.precio_venta if moneda == "USD" else (prod.precio_venta * tasa_actual).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        DetalleFactura.objects.create(
            factura=factura, tipo="PRODUCTO", producto=prod,
            cantidad=random.randint(1, 3), precio_unitario=precio,
        )
    facturas_pk_fecha.append((factura.pk, fecha_aleatoria()))
    if (i + 1) % 200 == 0:
        print(f"  {i + 1}/{N_FACTURAS} facturas...")

backdate(Factura, "fecha", facturas_pk_fecha)
print(f"  {N_FACTURAS} facturas creadas con fechas históricas.")


print("=== 7/9: Compras a proveedores ===")
N_COMPRAS = 150
numero_oc = 3000
compras_pk_fecha = []
productos_compra = list(Producto.objects.filter(precio_compra__gt=0)) or productos_vendibles
for i in range(N_COMPRAS):
    oc = OrdenCompra.objects.create(
        numero=f"OC-{numero_oc + i}",
        proveedor=random.choice(proveedores),
        estado=random.choices(["RECIBIDA", "PENDIENTE", "CANCELADA"], weights=[80, 15, 5])[0],
    )
    for _ in range(random.randint(1, 5)):
        prod = random.choice(productos_compra)
        precio = prod.precio_compra if prod.precio_compra > 0 else Decimal(str(round(random.uniform(3, 40), 2)))
        DetalleOrdenCompra.objects.create(
            orden=oc, producto=prod, cantidad=random.randint(2, 30), precio_unitario=precio,
        )
    compras_pk_fecha.append((oc.pk, fecha_aleatoria()))
    if (i + 1) % 50 == 0:
        print(f"  {i + 1}/{N_COMPRAS} órdenes de compra...")

backdate(OrdenCompra, "fecha", compras_pk_fecha)
print(f"  {N_COMPRAS} órdenes de compra creadas.")


print("=== 8/9: Cuentas por cobrar/pagar ===")
facturas_recientes = list(Factura.objects.filter(estado="PENDIENTE", fecha__gte=HOY - timedelta(days=75)))
cxc = [
    CuentaPorCobrar(cliente=f.cliente, factura=f, monto=f.total_usd, fecha_vencimiento=f.fecha + timedelta(days=30), estado="PENDIENTE")
    for f in facturas_recientes
]
CuentaPorCobrar.objects.bulk_create(cxc, batch_size=300)

ocs_recientes = list(OrdenCompra.objects.filter(estado="PENDIENTE", fecha__gte=HOY - timedelta(days=75)))
cxp = [
    CuentaPorPagar(proveedor=oc.proveedor, orden_compra=oc, monto=oc.total, fecha_vencimiento=oc.fecha + timedelta(days=30), estado="PENDIENTE")
    for oc in ocs_recientes
]
CuentaPorPagar.objects.bulk_create(cxp, batch_size=300)
print(f"  {len(cxc)} cuentas por cobrar, {len(cxp)} cuentas por pagar.")


print("=== 9/9: Horas de personal (últimos 120 días) ===")
personal_con_horas = [e for e in Empleado.objects.filter(activo=True) if set(e.areas) & {"TALLER", "PASANTE", "VENTAS", "BACKOFFICE"}]
registros_horas = []
for emp in personal_con_horas:
    dia = HOY - timedelta(days=120)
    while dia <= HOY:
        if dia.weekday() < 6 and random.random() > 0.08:  # lunes-sábado, con algunas faltas
            registros_horas.append(RegistroHoras(
                empleado=emp, fecha=dia, horas=Decimal(str(random.choice([4, 6, 8, 8, 8, 9]))),
            ))
        dia += timedelta(days=1)
RegistroHoras.objects.bulk_create(registros_horas, batch_size=500)
print(f"  {len(registros_horas)} registros de horas.")


print("=== Movimientos de inventario (historial de entradas/salidas) ===")
# Se crean uno por uno (no bulk_create): MovimientoInventario.save() ajusta
# el stock del producto, y hay que respetar la existencia real para no
# dejar ningún producto en negativo.
from inventario.models import MovimientoInventario
productos_mov = list(Producto.objects.all())
n_mov = 0
for _ in range(300):
    prod = random.choice(productos_mov)
    if random.random() < 0.5 or prod.stock_actual < 3:
        MovimientoInventario.objects.create(producto=prod, tipo="ENTRADA", cantidad=random.randint(3, 20), motivo="Reabastecimiento")
    else:
        cantidad = min(random.randint(1, 5), prod.stock_actual)
        if cantidad > 0:
            MovimientoInventario.objects.create(producto=prod, tipo="SALIDA", cantidad=cantidad, motivo="Ajuste de inventario")
    n_mov += 1
print(f"  {n_mov} movimientos de inventario.")

print()
print("=== LISTO ===")
print(f"Clientes: {Cliente.objects.count()}")
print(f"Empleados: {Empleado.objects.count()}")
print(f"Órdenes de taller: {OrdenTaller.objects.count()}")
print(f"Facturas: {Factura.objects.count()}")
print(f"Órdenes de compra: {OrdenCompra.objects.count()}")
print(f"Proveedores: {Proveedor.objects.count()}")
print(f"Registros de horas: {RegistroHoras.objects.count()}")
print(f"Movimientos de inventario: {MovimientoInventario.objects.count()}")
