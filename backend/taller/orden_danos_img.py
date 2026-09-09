"""Genera la imagen de "daños visibles" que se inserta en el PDF de la
orden: la MISMA silueta (frente/atrás/lateral) que usa el widget de la
pantalla (ver frontend/src/components/orden/DanosVisibles.jsx), con los
puntos de daño marcados exactamente donde el técnico los marcó — no una
lista de texto, sino la figura del equipo con las "X" rojas encima,
igual que se ve en el sistema.

Las siluetas de abajo son una traducción 1 a 1 (mismos rects/circles/
coordenadas) de las funciones *Silueta de DanosVisibles.jsx, para que lo
que se marca en pantalla caiga en el mismo lugar en el PDF impreso — los
puntos ya vienen guardados en ese mismo sistema de coordenadas
(viewBox 0 0 160 240).

No se usa ninguna librería nueva: PyMuPDF (ya instalado en el servidor)
sabe rasterizar SVG de forma nativa, así que se arma un SVG por vista y
se convierte a PNG en memoria."""
import io
import os
import tempfile
import uuid

import fitz
from PIL import Image

# --- Siluetas (traducidas de DanosVisibles.jsx, mismo viewBox 160x240) ---

_CELULAR_BOTONES = """
<rect x="138" y="64" width="4" height="28" rx="1.5" fill="#94a3b8" stroke="#64748b" stroke-width="1.6"/>
<rect x="18" y="54" width="4" height="16" rx="1.5" fill="#94a3b8" stroke="#64748b" stroke-width="1.6"/>
<rect x="18" y="76" width="4" height="16" rx="1.5" fill="#94a3b8" stroke="#64748b" stroke-width="1.6"/>
"""

_CELULAR_FRENTE = f"""
<rect x="20" y="10" width="120" height="220" rx="18" fill="#fff" stroke="#64748b" stroke-width="3.2"/>
{_CELULAR_BOTONES}
<rect x="30" y="26" width="100" height="194" rx="8" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1.6"/>
<rect x="64" y="17" width="32" height="4" rx="2" fill="#94a3b8"/>
<circle cx="100" cy="19" r="2.2" fill="none" stroke="#64748b" stroke-width="2"/>
<rect x="64" y="215" width="32" height="3" rx="1.5" fill="#94a3b8"/>
"""

_CELULAR_ATRAS = f"""
<rect x="20" y="10" width="120" height="220" rx="18" fill="#fff" stroke="#64748b" stroke-width="3.2"/>
{_CELULAR_BOTONES}
<rect x="32" y="24" width="96" height="192" rx="10" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.6"/>
<rect x="36" y="30" width="40" height="40" rx="12" fill="#e2e8f0" stroke="#64748b" stroke-width="2.2"/>
<circle cx="48" cy="42" r="6.5" fill="none" stroke="#64748b" stroke-width="2.2"/>
<circle cx="48" cy="42" r="3" fill="#64748b"/>
<circle cx="65" cy="42" r="6.5" fill="none" stroke="#64748b" stroke-width="2.2"/>
<circle cx="65" cy="42" r="3" fill="#64748b"/>
<circle cx="48" cy="59" r="6.5" fill="none" stroke="#64748b" stroke-width="2.2"/>
<circle cx="48" cy="59" r="3" fill="#64748b"/>
<circle cx="65" cy="59" r="3.2" fill="none" stroke="#94a3b8" stroke-width="1.8"/>
<circle cx="80" cy="150" r="11" fill="none" stroke="#cbd5e1" stroke-width="1.8"/>
"""

_LAPTOP_FRENTE_FILAS = "".join(
    f'<rect x="{19 + col * 12}" y="{136 + fila * 10}" width="9.5" height="7" rx="1.5" fill="#f1f5f9" stroke="#cbd5e1"/>'
    for fila in range(4)
    for col in range(10)
)
_LAPTOP_FRENTE = f"""
<rect x="15" y="10" width="130" height="112" rx="10" fill="#fff" stroke="#64748b" stroke-width="3.2"/>
<rect x="25" y="20" width="110" height="92" rx="4" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1.6"/>
<rect x="58" y="118" width="44" height="10" rx="2" fill="#94a3b8" stroke="#64748b" stroke-width="1.6"/>
<rect x="10" y="128" width="140" height="92" rx="10" fill="#fff" stroke="#64748b" stroke-width="3.2"/>
{_LAPTOP_FRENTE_FILAS}
<rect x="62" y="198" width="36" height="16" rx="3" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1.6"/>
"""

_LAPTOP_ATRAS_REJILLAS = "".join(
    f'<rect x="{28 + col * 17}" y="148" width="11" height="3" rx="1.5" fill="#94a3b8"/>'
    f'<rect x="{28 + col * 17}" y="156" width="11" height="3" rx="1.5" fill="#94a3b8"/>'
    for col in range(6)
)
_LAPTOP_ATRAS = f"""
<rect x="15" y="10" width="130" height="112" rx="10" fill="#fff" stroke="#64748b" stroke-width="3.2"/>
<circle cx="80" cy="66" r="15" fill="none" stroke="#94a3b8" stroke-width="2.2"/>
<rect x="58" y="118" width="44" height="10" rx="2" fill="#94a3b8" stroke="#64748b" stroke-width="1.6"/>
<rect x="10" y="128" width="140" height="92" rx="10" fill="#fff" stroke="#64748b" stroke-width="3.2"/>
{_LAPTOP_ATRAS_REJILLAS}
<ellipse cx="22" cy="138" rx="6" ry="4" fill="#94a3b8"/>
<ellipse cx="138" cy="138" rx="6" ry="4" fill="#94a3b8"/>
<ellipse cx="22" cy="210" rx="6" ry="4" fill="#94a3b8"/>
<ellipse cx="138" cy="210" rx="6" ry="4" fill="#94a3b8"/>
"""

_LAPTOP_LATERAL = """
<rect x="10" y="98" width="140" height="44" rx="6" fill="#fff" stroke="#64748b" stroke-width="3.2"/>
<rect x="22" y="108" width="14" height="24" rx="2" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1.6"/>
<rect x="44" y="112" width="22" height="16" rx="2" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1.6"/>
<rect x="74" y="112" width="14" height="16" rx="2" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1.6"/>
<rect x="112" y="108" width="18" height="24" rx="2" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1.6"/>
<rect x="132" y="112" width="14" height="16" rx="2" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1.6"/>
"""
_LAPTOP_LATERAL_DER = f'<g transform="scale(-1,1) translate(-160,0)">{_LAPTOP_LATERAL}</g>'


def _silueta_svg(tipo, vista):
    if tipo == "COM":
        if vista == "ATRAS":
            return _LAPTOP_ATRAS
        if vista == "LATERAL_IZQ":
            return _LAPTOP_LATERAL
        if vista == "LATERAL_DER":
            return _LAPTOP_LATERAL_DER
        return _LAPTOP_FRENTE
    return _CELULAR_ATRAS if vista == "ATRAS" else _CELULAR_FRENTE


def _marcadores_svg(puntos_vista):
    partes = []
    for i, p in enumerate(puntos_vista, start=1):
        x, y = p.get("x", 80), p.get("y", 120)
        partes.append(
            f'<circle cx="{x}" cy="{y}" r="12" fill="#dc2626" opacity="0.16"/>'
            f'<line x1="{x - 7}" y1="{y - 7}" x2="{x + 7}" y2="{y + 7}" stroke="#dc2626" stroke-width="3.6"/>'
            f'<line x1="{x - 7}" y1="{y + 7}" x2="{x + 7}" y2="{y - 7}" stroke="#dc2626" stroke-width="3.6"/>'
            f'<circle cx="{x + 11}" cy="{y - 11}" r="9" fill="#dc2626" stroke="#fff" stroke-width="1.2"/>'
            f'<text x="{x + 11}" y="{y - 7.5}" text-anchor="middle" font-size="11" '
            f'font-family="Arial" font-weight="bold" fill="#fff">{i}</text>'
        )
    return "".join(partes)


ETIQUETA_VISTA_CORTA = {
    "FRENTE": "Frente",
    "ATRAS": "Atrás",
    "LATERAL_IZQ": "Lat. izq.",
    "LATERAL_DER": "Lat. der.",
}


def _render_vista_png(tipo, vista, puntos_vista, escala=2.2):
    svg = (
        '<svg width="160" height="240" viewBox="0 0 160 240" xmlns="http://www.w3.org/2000/svg">'
        f"{_silueta_svg(tipo, vista)}"
        f"{_marcadores_svg(puntos_vista)}"
        "</svg>"
    )
    doc = fitz.open(stream=svg.encode("utf-8"), filetype="svg")
    page = doc[0]
    pix = page.get_pixmap(matrix=fitz.Matrix(escala, escala), alpha=True)
    datos = pix.tobytes("png")
    doc.close()
    return Image.open(io.BytesIO(datos)).convert("RGBA")


def construir_imagen_danos(
    tipo, danos_visibles, vistas_disponibles,
    ancho_por_vista=46.0, alto_por_vista=69.0, etiqueta_alto=10.0, separacion=4.0,
):
    """Arma una tira horizontal con las siluetas de TODAS las vistas del
    equipo (Frente/Atrás/Lateral izq./Lateral der. en computadoras;
    Frente/Atrás en celulares) — igual que las pestañas del widget en
    pantalla — con las "X" encima solo en las vistas donde el técnico
    marcó algo; las vistas sin daño salen igual, en blanco, para que se
    vea el equipo completo de un vistazo. Devuelve (ruta_png, ancho_pt,
    alto_pt) listo para insertarse con Shapes.AddPicture, o None si no
    hay nada que dibujar.

    `ancho_por_vista`/`alto_por_vista` son el tamaño (en puntos) de CADA
    silueta individual — por defecto guardan la proporción 160:240 del
    widget en pantalla."""
    if not danos_visibles:
        return None

    por_vista = {}
    for p in danos_visibles:
        v = p.get("vista") or "FRENTE"
        if v not in vistas_disponibles:
            continue
        por_vista.setdefault(v, []).append(p)

    if not por_vista:
        return None

    # Todas las vistas del equipo, en el mismo orden que las pestañas del
    # widget en pantalla — no solo las que tienen daño marcado.
    vistas_a_dibujar = list(vistas_disponibles)

    ESCALA_RENDER = 2.2  # resolución del PNG intermedio (nitidez al imprimir)
    ANCHO_PT_POR_VISTA = ancho_por_vista
    ALTO_PT_POR_VISTA = alto_por_vista
    ETIQUETA_ALTO_PT = etiqueta_alto
    SEPARACION_PT = separacion

    px_por_pt = (160 * ESCALA_RENDER) / ANCHO_PT_POR_VISTA
    ancho_img_pt = len(vistas_a_dibujar) * ANCHO_PT_POR_VISTA + (len(vistas_a_dibujar) - 1) * SEPARACION_PT
    alto_img_pt = ALTO_PT_POR_VISTA + ETIQUETA_ALTO_PT

    factor = px_por_pt
    lienzo = Image.new(
        "RGBA",
        (max(1, round(ancho_img_pt * factor)), max(1, round(alto_img_pt * factor))),
        (255, 255, 255, 0),
    )

    from PIL import ImageDraw, ImageFont

    draw = ImageDraw.Draw(lienzo)
    try:
        fuente = ImageFont.truetype("arialbd.ttf", int(7.5 * factor))
    except Exception:
        fuente = ImageFont.load_default()

    x_cursor_pt = 0.0
    for vista in vistas_a_dibujar:
        tiene_dano = bool(por_vista.get(vista))
        silueta = _render_vista_png(tipo, vista, por_vista.get(vista, []), escala=ESCALA_RENDER)
        silueta = silueta.resize(
            (round(ANCHO_PT_POR_VISTA * factor), round(ALTO_PT_POR_VISTA * factor)),
            Image.LANCZOS,
        )
        x_px = round(x_cursor_pt * factor)
        lienzo.paste(silueta, (x_px, 0), silueta)
        # La vista donde el técnico SÍ marcó algo lleva su etiqueta en
        # rojo — para que salte a la vista cuál hay que mirar, en vez de
        # tener que comparar las 4 en detalle.
        etiqueta = ETIQUETA_VISTA_CORTA.get(vista, vista)
        if tiene_dano:
            etiqueta = f"● {etiqueta}"
        bbox = draw.textbbox((0, 0), etiqueta, font=fuente)
        ancho_txt = bbox[2] - bbox[0]
        cx = x_px + round(ANCHO_PT_POR_VISTA * factor / 2) - ancho_txt // 2
        color_etiqueta = (220, 38, 38, 255) if tiene_dano else (71, 85, 105, 255)
        draw.text((cx, round(ALTO_PT_POR_VISTA * factor) + 1), etiqueta, fill=color_etiqueta, font=fuente)
        x_cursor_pt += ANCHO_PT_POR_VISTA + SEPARACION_PT

    ruta = os.path.join(tempfile.gettempdir(), f"danos_{uuid.uuid4().hex[:10]}.png")
    lienzo.save(ruta)
    return ruta, ancho_img_pt, alto_img_pt
