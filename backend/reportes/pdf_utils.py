import os
from datetime import datetime
from io import BytesIO

from django.conf import settings
from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

PRIMARY = colors.HexColor("#1D4ED8")
DARK = colors.HexColor("#0F172A")
MUTED = colors.HexColor("#64748B")
LIGHT_ROW = colors.HexColor("#F1F5F9")
TOTALS_ROW_BG = colors.HexColor("#DBEAFE")
GRID_COLOR = colors.HexColor("#E2E8F0")

LOGO_PATH = os.path.join(settings.MEDIA_ROOT, "branding", "rcp-logo.png")

# Ancho útil de la página carta con márgenes de 1.8cm a cada lado.
PAGE_CONTENT_WIDTH = 17.8 * cm

_styles = getSampleStyleSheet()
TITLE_STYLE = ParagraphStyle("ReporteTitulo", parent=_styles["Title"], textColor=DARK, fontSize=16, leading=19)
SUBTITLE_STYLE = ParagraphStyle("ReporteSubtitulo", parent=_styles["Normal"], textColor=MUTED, fontSize=9)
SECTION_STYLE = ParagraphStyle("ReporteSeccion", parent=_styles["Heading2"], textColor=DARK, fontSize=12.5, spaceBefore=16, spaceAfter=6)
EMPTY_STYLE = ParagraphStyle("ReporteVacio", parent=_styles["Normal"], textColor=MUTED, fontSize=9.5)


# `money_cols` acá es 0-indexado (posición dentro de cada fila), a diferencia
# de excel_utils.money_cols que es 1-indexado (columnas de hoja de cálculo).
def _formatear_celda(valor, columna, money_cols):
    if valor is None:
        return "—"
    if columna in money_cols and isinstance(valor, (int, float)):
        return f"${valor:,.2f}"
    if isinstance(valor, float):
        return f"{valor:,.2f}"
    if isinstance(valor, bool):
        return "Sí" if valor else "No"
    return str(valor)


def _tabla(headers, rows, totals_row=None, money_cols=None):
    money_cols = set(money_cols or [])
    data = [list(headers)]
    data += [[_formatear_celda(v, i, money_cols) for i, v in enumerate(row)] for row in rows]
    if totals_row:
        data.append([_formatear_celda(v, i, money_cols) for i, v in enumerate(totals_row)])

    n_cols = len(headers)
    col_width = PAGE_CONTENT_WIDTH / n_cols
    tabla = Table(data, colWidths=[col_width] * n_cols, repeatRows=1)

    ultima_fila = len(data) - 1
    cuerpo_fin = ultima_fila - 1 if totals_row else ultima_fila
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, GRID_COLOR),
        ("ROWBACKGROUNDS", (0, 1), (-1, cuerpo_fin), [colors.white, LIGHT_ROW]),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    for col in money_cols:
        style.append(("ALIGN", (col, 1), (col, -1), "RIGHT"))
    if totals_row:
        style += [
            ("FONTNAME", (0, ultima_fila), (-1, ultima_fila), "Helvetica-Bold"),
            ("BACKGROUND", (0, ultima_fila), (-1, ultima_fila), TOTALS_ROW_BG),
        ]
    tabla.setStyle(TableStyle(style))
    return tabla


def _encabezado(titulo_principal, subtitulo=None):
    generado = datetime.now().strftime("%d/%m/%Y %H:%M")
    pie = f"Generado el {generado}" + (f" · {subtitulo}" if subtitulo else "")
    bloque_titulo = [Paragraph(titulo_principal, TITLE_STYLE), Paragraph(pie, SUBTITLE_STYLE)]

    if os.path.exists(LOGO_PATH):
        logo = Image(LOGO_PATH, width=2.2 * cm, height=2.2 * cm)
        header = Table(
            [[logo, bloque_titulo]],
            colWidths=[2.6 * cm, PAGE_CONTENT_WIDTH - 2.6 * cm],
        )
        header.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (0, 0), 0),
            ("LEFTPADDING", (1, 0), (1, 0), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        flowables = [header]
    else:
        flowables = bloque_titulo

    flowables.append(Spacer(1, 4))
    linea = Table([[""]], colWidths=[PAGE_CONTENT_WIDTH], rowHeights=[1])
    linea.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, 0), 1, PRIMARY)]))
    flowables.append(linea)
    flowables.append(Spacer(1, 12))
    return flowables


def _pie_de_pagina(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(1.8 * cm, 1.2 * cm, "Nexus ERP")
    canvas.drawRightString(letter[0] - 1.8 * cm, 1.2 * cm, f"Página {doc.page}")
    canvas.restoreState()


def build_pdf_response(filename, titulo_principal, secciones, subtitulo=None):
    """`secciones`: lista de dicts {titulo?, headers, rows, totals_row?, money_cols?}."""
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=letter,
        topMargin=1.6 * cm, bottomMargin=1.8 * cm, leftMargin=1.8 * cm, rightMargin=1.8 * cm,
        title=titulo_principal,
    )
    story = _encabezado(titulo_principal, subtitulo)

    for seccion in secciones:
        if seccion.get("titulo"):
            story.append(Paragraph(seccion["titulo"], SECTION_STYLE))
        if not seccion["rows"]:
            story.append(Paragraph("Sin datos para este periodo.", EMPTY_STYLE))
            story.append(Spacer(1, 8))
            continue
        story.append(_tabla(seccion["headers"], seccion["rows"], seccion.get("totals_row"), seccion.get("money_cols")))
        story.append(Spacer(1, 10))

    doc.build(story, onFirstPage=_pie_de_pagina, onLaterPages=_pie_de_pagina)
    buf.seek(0)
    response = HttpResponse(buf.read(), content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def simple_pdf_response(titulo_principal, headers, rows, filename, totals_row=None, money_cols=None, subtitulo=None):
    return build_pdf_response(
        filename, titulo_principal,
        [{"headers": headers, "rows": rows, "totals_row": totals_row, "money_cols": money_cols}],
        subtitulo=subtitulo,
    )
