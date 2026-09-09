"""Uno-off: vacía los datos de negocio del sistema (clientes, empresas,
equipos, órdenes de taller, facturas/pagos, compras, cotizaciones,
cuentas por cobrar/pagar, inventario) dejando SOLO:

- Usuarios de login (auth.User + core.Perfil)
- Configuracion de empresa
- Empleados de RRHH (+ RegistroHoras) — son personal, no "datos de prueba"
- Catálogos compartidos: CategoriaProducto, SubcategoriaProducto, Marca,
  Modelo, UnidadMedida — son listas de referencia reutilizables, no
  movimientos de negocio.

Se borra en el orden correcto para respetar las relaciones PROTECT
(facturas/OTs/compras/cotizaciones antes que sus productos/clientes/
proveedores).
"""
import os
import sys
import shutil
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from django.conf import settings
from ventas.models import Cliente, Empresa, Factura
from taller.models import OrdenTaller
from compras.models import Proveedor, OrdenCompra, CotizacionCliente
from inventario.models import Producto, MovimientoInventario
from contabilidad.models import CuentaPorCobrar, CuentaPorPagar
from caja_chica.models import ArqueoCaja
from gastos.models import CajaChica, Gasto


def borrar(nombre, queryset):
    n = queryset.count()
    queryset.delete()
    print(f"{nombre}: {n} borrados")


def main():
    # 1) Lo que referencia PROTECT a Cliente/Proveedor/Producto va primero.
    borrar("Facturas (+ detalles/pagos)", Factura.objects.all())
    borrar("Órdenes de taller (+ insumos/fotos/historial)", OrdenTaller.objects.all())
    borrar("Órdenes de compra (+ detalles)", OrdenCompra.objects.all())
    borrar("Cotizaciones (+ detalles)", CotizacionCliente.objects.all())

    # 2) Cuentas por cobrar/pagar (CASCADE desde Cliente/Proveedor las
    #    alcanzaría igual, pero son parte explícita del alcance pedido).
    borrar("Cuentas por cobrar", CuentaPorCobrar.objects.all())
    borrar("Cuentas por pagar", CuentaPorPagar.objects.all())

    # 3) Ahora sí, clientes/empresas/proveedores (Equipo cae en cascada
    #    con Cliente).
    borrar("Clientes (+ equipos)", Cliente.objects.all())
    borrar("Empresas", Empresa.objects.all())
    borrar("Proveedores", Proveedor.objects.all())

    # 4) Inventario: movimientos y productos. El catálogo (categorías,
    #    subcategorías, marcas, modelos, unidades de medida) se conserva.
    borrar("Movimientos de inventario", MovimientoInventario.objects.all())
    borrar("Productos", Producto.objects.all())

    # 5) Caja chica y gastos — CategoriaGasto NO se toca (es catálogo,
    #    igual que las categorías de producto). CajaChica es una fila
    #    única con el saldo actual: se borra igual que Gasto/ArqueoCaja,
    #    CajaChica.actual() la vuelve a crear sola en 0 la próxima vez que
    #    se use.
    borrar("Arqueos de caja", ArqueoCaja.objects.all())
    borrar("Gastos", Gasto.objects.all())
    borrar("Saldo de caja chica", CajaChica.objects.all())

    # 6) Archivos de imagen huérfanos (productos/fotos de OT) — ya no
    #    tienen fila en la base, no tiene sentido dejarlos en disco.
    media_root = settings.MEDIA_ROOT
    for sub in ["productos", "ordenes/fotos"]:
        ruta = os.path.join(media_root, sub)
        if os.path.isdir(ruta):
            shutil.rmtree(ruta)
            print(f"Carpeta de medios borrada: {sub}")


if __name__ == "__main__":
    main()
