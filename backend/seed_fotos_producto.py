"""Genera una imagen representativa por categoría de producto (no una por
producto — serían miles) y la asigna a todos los productos de esa
categoría, para que Inventario deje de verse con recuadros vacíos.
"""
import os
import io

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.core.files.base import ContentFile
from PIL import Image, ImageDraw, ImageFont

from inventario.models import Producto, CategoriaProducto

FUENTE_PATH = r"C:\Windows\Fonts\segoeuib.ttf"

PALETA = {
    "ACCESORIO": "#2563eb",
    "EQUIPO": "#7c3aed",
    "HERRAMIENTA": "#b45309",
    "INSUMO": "#059669",
    "OTROS": "#64748b",
    "PARA PRUEBAS": "#dc2626",
    "PARA REPUESTO": "#0891b2",
    "REPUESTO CCA": "#db2777",
    "REPUESTO COM": "#4338ca",
}
COLOR_DEFECTO = "#334155"


def _oscurecer(hex_color, factor=0.78):
    hex_color = hex_color.lstrip("#")
    r, g, b = (int(hex_color[i:i + 2], 16) for i in (0, 2, 4))
    return f"#{int(r*factor):02x}{int(g*factor):02x}{int(b*factor):02x}"


def _envolver_texto(draw, texto, fuente, ancho_max):
    palabras = texto.split()
    lineas, actual = [], ""
    for palabra in palabras:
        prueba = f"{actual} {palabra}".strip()
        if draw.textlength(prueba, font=fuente) <= ancho_max:
            actual = prueba
        else:
            if actual:
                lineas.append(actual)
            actual = palabra
    if actual:
        lineas.append(actual)
    return lineas


def generar_imagen(nombre_categoria):
    color = PALETA.get(nombre_categoria, COLOR_DEFECTO)
    color_oscuro = _oscurecer(color)
    size = 480
    img = Image.new("RGB", (size, size), color)
    draw = ImageDraw.Draw(img)

    # Textura simple: franja diagonal más oscura, para que no sea un
    # cuadro de color plano sin ningún trabajo de diseño.
    draw.polygon([(0, size), (size, 0), (size, size * 0.35), (0, size * 0.75)], fill=color_oscuro)

    # Círculo/ícono abstracto centrado arriba.
    cx, cy, r = size / 2, size * 0.36, size * 0.14
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline="white", width=6)
    draw.ellipse([cx - r * 0.4, cy - r * 0.4, cx + r * 0.4, cy + r * 0.4], fill="white")

    fuente = ImageFont.truetype(FUENTE_PATH, 34)
    lineas = _envolver_texto(draw, nombre_categoria.title(), fuente, size * 0.8)
    alto_linea = 42
    y = size * 0.62
    for linea in lineas:
        w = draw.textlength(linea, font=fuente)
        draw.text((size / 2 - w / 2, y), linea, font=fuente, fill="white")
        y += alto_linea

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=87)
    buf.seek(0)
    return buf.read()


print("Generando imágenes por categoría...")
categorias = list(CategoriaProducto.objects.all())
asignados = 0
for cat in categorias:
    productos = list(Producto.objects.filter(categoria=cat, imagen=""))
    if not productos:
        continue
    data = generar_imagen(cat.nombre)
    # Se guarda el archivo UNA vez (el primer producto) y a los demás se
    # les apunta el campo a esa misma ruta ya guardada — si no, Django le
    # cambia el nombre a cada copia para no pisar el archivo anterior y
    # terminamos con cientos de copias idénticas en disco.
    primero = productos[0]
    primero.imagen.save(f"cat_{cat.id}.jpg", ContentFile(data), save=True)
    ruta_guardada = primero.imagen.name
    for p in productos[1:]:
        p.imagen.name = ruta_guardada
        p.save(update_fields=["imagen"])
    asignados += len(productos)
    print(f"  {cat.nombre}: {len(productos)} productos")

# Productos sin categoría (no debería haber, pero por si acaso).
sin_cat = list(Producto.objects.filter(categoria__isnull=True, imagen=""))
if sin_cat:
    data = generar_imagen("Producto")
    sin_cat[0].imagen.save("sin_categoria.jpg", ContentFile(data), save=True)
    ruta = sin_cat[0].imagen.name
    for p in sin_cat[1:]:
        p.imagen.name = ruta
        p.save(update_fields=["imagen"])
    asignados += len(sin_cat)

print(f"Listo. {asignados} productos con foto asignada.")
print(f"Total productos con imagen: {Producto.objects.exclude(imagen='').count()}")
