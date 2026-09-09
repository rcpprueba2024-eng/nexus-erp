"""Impresión de recibos en la impresora térmica configurada (ver
core.models.Configuracion). Usa python-escpos: soporta una impresora ya
instalada en Windows (Win32Raw, recibe los bytes ESC/POS directo, sin pasar
por el diálogo de impresión normal) o una impresora de red por IP/puerto.

Si no hay impresora configurada o falla la conexión, se lanza
ImpresionError con un mensaje legible para mostrar al usuario del POS —
nunca debe tumbar la venta ya registrada.
"""
from core.models import Configuracion


class ImpresionError(Exception):
    pass


def _obtener_impresora(config):
    if config.impresora_conexion == "WIN32":
        if not config.impresora_nombre:
            raise ImpresionError("No se configuró el nombre de la impresora de Windows. Ve a Configuración → Impresora.")
        from escpos.printer import Win32Raw
        try:
            return Win32Raw(config.impresora_nombre)
        except Exception as exc:
            raise ImpresionError(f"No se pudo abrir la impresora «{config.impresora_nombre}»: {exc}") from exc

    if config.impresora_conexion == "RED":
        if not config.impresora_ip:
            raise ImpresionError("No se configuró la IP de la impresora de red. Ve a Configuración → Impresora.")
        from escpos.printer import Network
        try:
            return Network(config.impresora_ip, port=config.impresora_puerto or 9100, timeout=5)
        except Exception as exc:
            raise ImpresionError(f"No se pudo conectar a la impresora en {config.impresora_ip}:{config.impresora_puerto}: {exc}") from exc

    raise ImpresionError("No hay una impresora térmica configurada. Ve a Configuración → Impresora.")


def _ancho_columnas(config):
    return 32 if config.impresora_ancho_papel == 58 else 48


def imprimir_factura(factura):
    config = Configuracion.actual()
    ancho = _ancho_columnas(config)
    simbolo = "C$" if factura.moneda == "NIO" else "$"
    p = _obtener_impresora(config)

    try:
        try:
            p.charcode("CP858")  # incluye ñ, tildes y € — la más compatible en impresoras térmicas
        except Exception:
            pass
        p.set(align="center", bold=True, width=2, height=2)
        p.text("RCP\n")
        p.set(align="center", bold=False, width=1, height=1)
        p.text("Reparación de Celulares y Portátiles\n")
        p.text("-" * ancho + "\n")
        p.set(align="left")
        p.text(f"Factura: {factura.numero}\n")
        p.text(f"Fecha: {factura.fecha}\n")
        p.text(f"Cliente: {factura.cliente.nombre}\n")
        if factura.vendedor:
            p.text(f"Atendió: {factura.vendedor.first_name or factura.vendedor.username}\n")
        p.text("-" * ancho + "\n")

        for d in factura.detalles.all():
            nombre = d.producto.nombre if d.producto else (d.descripcion or d.equipo_descripcion)
            linea_precio = f"{d.cantidad} x {simbolo}{float(d.precio_unitario):,.2f}"
            p.text(f"{nombre[:ancho]}\n")
            p.text(f"{linea_precio:<{ancho - 12}}{simbolo}{float(d.subtotal):>10,.2f}\n")

        p.text("-" * ancho + "\n")
        p.set(align="right", bold=True)
        p.text(f"TOTAL: {simbolo}{float(factura.total):,.2f}\n")
        p.set(align="center", bold=False)
        p.text("\n¡Gracias por su compra!\n")
        p.text("\n\n")
        p.cut()
    except ImpresionError:
        raise
    except Exception as exc:
        raise ImpresionError(f"Error al imprimir: {exc}") from exc
    finally:
        try:
            p.close()
        except Exception:
            pass
