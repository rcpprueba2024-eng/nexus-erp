"""Uno-off: deja el sistema completamente vacío para una prueba desde
cero, conservando SOLO los usuarios de login (los 6 de prueba + admin) y
la Configuracion de empresa. Se borra en el orden correcto para respetar
las relaciones PROTECT (facturas/OTs/compras antes que sus productos y
clientes; productos antes que su catálogo de categorías/marcas/modelos).

Empleado/RegistroHoras (RRHH) se conservan a propósito: son personal,
no "datos de prueba masivos", y se necesitan técnicos para poder crear
una OT nueva en la prueba.
"""
import os
import sys
import shutil
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from django.conf import settings
from ventas.models import Cliente, Empresa, Equipo, Factura, DetalleFactura
from taller.models import OrdenTaller
from compras.models import Proveedor, OrdenCompra
from inventario.models import Producto, MovimientoInventario, CategoriaProducto, SubcategoriaProducto, Marca, Modelo
from contabilidad.models import CuentaPorCobrar, CuentaPorPagar


def borrar(nombre, queryset):
    n = queryset.count()
    queryset.delete()
    print(f"{nombre}: {n} borrados")


def main():
    # 1) Lo que referencia PROTECT a Cliente/Proveedor/Producto va primero.
    borrar("Facturas (+ detalles)", Factura.objects.all())
    borrar("Órdenes de taller (+ insumos/fotos/historial)", OrdenTaller.objects.all())
    borrar("Órdenes de compra (+ detalles)", OrdenCompra.objects.all())

    # 2) Cuentas por cobrar/pagar quedan huérfanas si no se borran ya
    #    (CASCADE desde Cliente/Proveedor las alcanzaría, pero son parte
    #    explícita del alcance pedido).
    borrar("Cuentas por cobrar", CuentaPorCobrar.objects.all())
    borrar("Cuentas por pagar", CuentaPorPagar.objects.all())

    # 3) Ahora sí, clientes/empresas/proveedores (Equipo cae en cascada
    #    con Cliente).
    borrar("Clientes (+ equipos)", Cliente.objects.all())
    borrar("Empresas", Empresa.objects.all())
    borrar("Proveedores", Proveedor.objects.all())

    # 4) Inventario: movimientos antes que productos, catálogo al final.
    borrar("Movimientos de inventario", MovimientoInventario.objects.all())
    borrar("Productos", Producto.objects.all())
    borrar("Subcategorías", SubcategoriaProducto.objects.all())
    borrar("Categorías", CategoriaProducto.objects.all())
    borrar("Modelos", Modelo.objects.all())
    borrar("Marcas", Marca.objects.all())

    # 5) Archivos de imagen huérfanos (productos/fotos de OT) — ya no
    #    tienen fila en la base, no tiene sentido dejarlos en disco.
    media_root = settings.MEDIA_ROOT
    for sub in ["productos", "ordenes/fotos"]:
        ruta = os.path.join(media_root, sub)
        if os.path.isdir(ruta):
            shutil.rmtree(ruta)
            print(f"Carpeta de medios borrada: {sub}")


if __name__ == "__main__":
    main()
