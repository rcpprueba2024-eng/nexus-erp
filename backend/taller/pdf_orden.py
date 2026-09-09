"""Genera la Orden de Recepción y Trabajo como un PDF real (ReportLab),
en vez de imprimir el HTML de OrdenPreview.jsx con window.print().

Por qué: el flujo de impresión por HTML/CSS dependía de que el navegador y
el driver de la impresora del cliente se pusieran de acuerdo en el tamaño
de hoja al momento de imprimir — con algunas impresoras (sobre todo detrás
de capas como HP Smart) esa negociación fallaba y el documento salía
repartido en 10+ hojas en vez de 1, sin que hubiera nada mal en el HTML.
Un PDF generado en el servidor con tamaño de página fijo (carta) no
depende de esa negociación: siempre son las mismas páginas, sin importar
la impresora, el driver o el navegador del cliente.

Tamaño carta SIEMPRE (pagesize=letter) — esto no cambia. Lo que sí varía
es cuánto contenido trae cada orden: una orden con diagnóstico largo,
comentarios, checklist de entrada Y salida completos, y varios repuestos,
puede no caber en una sola hoja carta con el tamaño de letra normal. La
solución no es agrandar la hoja: se genera primero con el tamaño normal,
se cuentan las páginas (doc.page, que ya lleva ReportLab), y si no cupo en
1 sola hoja se regenera automáticamente con una versión más compacta
(letra más chica, márgenes más ajustados, checklist en más columnas) — la
inmensa mayoría de las órdenes ni pasan por esa segunda pasada.

Este PDF debe traer TODO lo que trae la vista completa en pantalla
(OrdenPreview.jsx) — antes traía solo un resumen y, sobre todo, no
separaba bien los campos propios de CCA (celular/tablet: IMEI, chip,
cámara) de los propios de COM (computadora: procesador, RAM, disco,
componentes, software, BitLocker) — ver core.choices.CATEGORIA_EQUIPO_CCA
/ CATEGORIA_EQUIPO_COM y taller.models.OrdenTaller.categoria_equipo. Los
daños físicos tampoco se veían bien: antes solo se listaba la nota de
texto de cada marca, y muchas marcas de daño no llevan nota (el técnico
solo marca el punto en el diagrama) — así que para esas órdenes no salía
NADA. Ahora se dibuja la misma silueta del equipo con las marcas en su
posición real, igual que en pantalla (ver DanosVisibles.jsx del
frontend — estas formas están calcadas 1:1 de ese archivo).
"""
import base64
import os
from io import BytesIO

from django.conf import settings
from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle, HRFlowable, KeepTogether,
)
from reportlab.graphics.shapes import Drawing, Rect, Circle, Ellipse, Line, String, Group

PRIMARY = colors.HexColor("#1D4ED8")
DARK = colors.HexColor("#0F172A")
MUTED = colors.HexColor("#475569")
BORDER = colors.HexColor("#CBD5E1")
AMARILLO_BG = colors.HexColor("#FEF08A")
AMARILLO_TXT = colors.HexColor("#713F12")

LOGO_PATH = os.path.join(settings.MEDIA_ROOT, "branding", "rcp-logo.png")
SD = "—"

ESTADO_EQUIPO_LABELS = {"BUENO": "Bueno", "REGULAR": "Regular", "MALO": "Malo", "ENCIENDE_CON_FALLA": "Enciende con falla"}
ESTADO_ENCENDIDO_LABELS = {
    "ENCIENDE_OK": "Enciende OK", "ENCIENDE_CON_FALLA": "Enciende con falla",
    "ENCIENDE_SIN_IMAGEN": "Enciende pero sin imagen", "NO_ENCIENDE": "No enciende",
}
OPERADORA_LABELS = {"CLARO": "Claro", "TIGO": "Tigo"}
FORMA_PAGO_LABELS = {"CREDITO": "Crédito", "CONTADO": "Contado"}
TIPO_SERVICIO_LABELS = {
    "DIAGNOSTICO": "Diagnóstico", "MANTENIMIENTO_BASICO": "Mantenimiento básico",
    "MANTENIMIENTO_PREVENTIVO": "Mantenimiento preventivo", "MANTENIMIENTO_FULL": "Mantenimiento full",
    "REPARACION": "Reparación", "REPARACION_BISAGRA": "Reparación de bisagra",
    "CONFIGURACION": "Configuración", "DESBLOQUEO": "Desbloqueo", "FLASHEO": "Flasheo",
    "REINGRESO": "Reingreso", "OTRO": "Otro",
}
COMO_SUPO_LABELS = {
    "FACEBOOK": "Facebook", "EMAIL": "E-mail", "INSTAGRAM": "Instagram", "TIKTOK": "TikTok",
    "LINKEDIN": "LinkedIn", "SMS": "SMS", "RADIO": "Radio", "REFERIDO": "Referido",
    "MANTA_ROTULO": "Manta o rótulo", "GOOGLE": "Google", "RECURRENTE": "Cliente recurrente", "OTRO": "Otro",
}
TIPO_REPUESTO_LABELS = {"Original": "Original", "AAA+": "AAA+", "Compatible": "Compatible"}
COMPONENTES_ITEMS_LABELS = {
    "bateria": "Batería original", "cargador": "Cargador", "adaptador": "Adaptador",
    "receptor_inalambrico": "Receptor inalámbrico", "camara": "Cámara", "microfono": "Micrófono",
    "wifi": "WiFi", "bluetooth": "Bluetooth", "usb": "Puertos USB", "hdmi": "HDMI",
    "ethernet": "Ethernet", "audio": "Audio", "lector_sd": "Lector SD", "otros": "Otros componentes",
}
ESTADO_COMPONENTE_LABELS = {"FUNCIONA": "Funciona", "NO_FUNCIONA": "No funciona", "NO_APLICA": "No aplica", "NO_PROBADO": "No probado"}

CHECKLIST_CCA = ["Carga", "Llamadas", "Red móvil", "WiFi", "Limpieza", "Cámara frontal", "Cámara trasera",
                  "Micrófono", "Auricular", "Speaker", "Brillo", "Cuentas", "Accesorios"]
CHECKLIST_COM = [
    ("carga", "Carga"), ("mousepad", "Mousepad"), ("microfono", "Micrófono"), ("pantallaBrillo", "Pantalla / Brillo"),
    ("puertoCarga", "Puerto de carga"), ("teclado", "Teclado"), ("auricular", "Auricular"),
    ("puntosPixelesMuertos", "Puntos / píxeles muertos"), ("puertosUsb", "Puertos USB"), ("botonPower", "Botón power"),
    ("speakers", "Speakers"), ("lineasManchas", "Líneas / manchas"), ("puertosHdmi", "Puertos HDMI"),
    ("huella", "Huella"), ("jackAudio", "Jack audio"), ("tactil", "Táctil"), ("camaras", "Cámaras"),
    ("wifi", "WiFi"), ("sensores", "Sensores"), ("fanCoolers", "Fan coolers"), ("leds", "Leds"),
    ("bluetooth", "Bluetooth"), ("bisagras", "Bisagras"), ("apagarEncender", "Apagar / encender"),
]

VISTAS_POR_TIPO = {"CCA": ["FRENTE", "ATRAS"], "COM": ["FRENTE", "ATRAS", "LATERAL_IZQ", "LATERAL_DER"]}
ETIQUETA_VISTA = {"FRENTE": "Frente", "ATRAS": "Atrás", "LATERAL_IZQ": "Lateral izquierdo", "LATERAL_DER": "Lateral derecho"}

CLAUSULAS_DIAGNOSTICO = [
    "a) Una vez concluido o avanzado el diagnóstico, no se realizará ninguna reparación sin la autorización expresa "
    "del cliente, la cual podrá otorgarse de forma escrita, digital o verbal, quedando constancia en el sistema de "
    "la empresa.",
    "b) Cuando para confirmar el diagnóstico sea indispensable realizar intervenciones técnicas preliminares, "
    "especialmente en servicios de mantenimiento correctivo, tratamiento ultrasónico o por errores de software "
    "(S.O., BIOS, Bloqueos y similares), el cliente acepta que deberá cancelar el valor correspondiente a los "
    "trabajos efectivamente realizados, aun cuando decida no continuar con reparaciones adicionales.",
    "c) Asimismo, el cliente autoriza a la empresa a realizar pruebas técnicas necesarias, incluyendo desmontaje "
    "parcial o total del equipo, sin que ello implique responsabilidad por daños preexistentes, desgaste normal, "
    "vida útil o fallas ocultas.",
]
CLAUSULAS_INGRESO = [
    "No garantizamos entregar funcionando, total o parcial, de equipos que ingresan al taller apagados, con "
    "señales de humedad, maltrato físico, manipulación inadecuada, suciedad general o excesiva, con más de cinco "
    "años de uso o que no puedan ser probados completamente al ingresar.",
    "Durante el diagnóstico, reparación o mantenimiento, estos equipos pueden presentar nuevas fallas o incluso no "
    "encender, por lo cual se excluye expresamente cualquier garantía sobre el trabajo realizado.",
    "Bisagras golpeadas, excesivamente ajustadas o deterioradas, pueden ocasionar daños en pantalla (como líneas, "
    "manchas o puntos), así como afectaciones en cámara, micrófono o módulo de WiFi, antes o durante la "
    "reparación. Asimismo, en reemplazos de pantalla, no se otorgará garantía si, tras la entrega del equipo, se "
    "presentan líneas, manchas, píxeles muertos o fallas en la función táctil (totales o parciales), ya que dichas "
    "condiciones suelen ser causadas por golpes o presión indebida ejercida sobre la pantalla.",
    "Se requiere acceso a cuenta principal del equipo y/o usuario administrador para poder realizar pruebas "
    "generales y de estrés.",
    "* El cliente debe expresar de buena fe cualquier información relevante para el diagnóstico o reparación del "
    "equipo. Configuraciones empresariales, uso de VPN, bloqueos de seguridad, ajustes de accesibilidad, control "
    "parental, bloqueo de booteo, bloqueo de BIOS, de BIT Locker o similares pueden afectar el correcto "
    "funcionamiento del mismo. En estos casos, la empresa NO SE PUEDE RESPONSABILIZAR por el correcto "
    "funcionamiento total ni parcial del equipo recibido.",
]
CLAUSULAS_GARANTIA = [
    "La GARANTÍA, sellada en la factura, cubre exclusivamente el trabajo realizado y aplica una sola vez. No "
    "cubre daños por humedad, sobrecargas eléctricas (incluyendo uso de cargadores inadecuados no originales o "
    "dañados), fallas por golpes, presión o manipulación posterior a la reparación, ni intervenciones previas de "
    "otros talleres o del propio cliente. NO HACEMOS REEMBOLSOS. Toda reparación, una vez aprobada (por escrito, "
    "llamada, mensaje, cotización sellada u orden de compra), debe ser asumida por el cliente en un 100%. Fallas "
    "adicionales a las cotizadas pueden demorar el tiempo de entrega final y alterar el presupuesto inicial.",
    "El diagnóstico tiene un valor que varía entre $20 y $100, según el equipo y el nivel de complejidad. Pre "
    "diagnósticos desde $10. El cliente acepta que durante el proceso pueden detectarse fallas adicionales no "
    "evidentes al momento de la recepción, y la empresa no se hace responsable por ellas. Es responsabilidad del "
    "cliente cerrar sesión en correos, redes sociales y otras cuentas antes de entregar el equipo; RCP no se hace "
    "responsable por el uso de estas ni por la pérdida de información en discos duros, memorias u otros medios "
    "durante diagnóstico o reparación.",
    "Al firmar, el cliente declara que el equipo entregado es de su propiedad. El equipo debe retirarse en un "
    "plazo máximo de 45 días tras el aviso de que está listo; después de este período (opcionalmente) se cobrarán "
    "C$100 diarios por resguardo, hasta un máximo de 60 días en total, tras lo cual la empresa no asume "
    "responsabilidad alguna, conforme al Reglamento de la Ley 842. En caso de no contar con repuestos, el cliente "
    "tiene hasta dos meses desde la recepción del equipo para retirarlo; de no hacerlo, se considerará abandonado. "
    "Los pagos con cheque deben realizarse a nombre de Albert N. Palacios González.",
    "* El cliente debe presentar este documento para poder retirar el equipo y verificar detalladamente el estado "
    "en el que lo recibe para así disminuir reclamos una vez que el equipo esté entregado y fuera del taller.",
]


def nombre_corto(nombre_completo):
    """Inicial + un apellido para el papel impreso — ver misma lógica en
    OrdenPreview.jsx (nombreCorto)."""
    palabras = (nombre_completo or "").strip().split()
    if not palabras:
        return ""
    if len(palabras) == 1:
        return palabras[0]
    inicial = palabras[0][0].upper() + "."
    apellido = palabras[-2] if len(palabras) >= 3 else palabras[-1]
    return f"{inicial} {apellido}"


def _v(valor):
    if valor in (None, ""):
        return SD
    return valor


def _si_no(valor):
    if valor is True:
        return "Sí"
    if valor is False:
        return "No"
    return SD


# ============================================================
# Siluetas del equipo para el diagrama de daños visibles — cada
# forma está calcada 1:1 de frontend/src/components/orden/DanosVisibles.jsx
# (mismo viewBox 160x240, mismas coordenadas) para que el diagrama impreso
# se vea igual que el que llenó el técnico en pantalla.
# ============================================================
COL_BORDE = colors.HexColor("#94a3b8")
COL_BORDE_CLARO = colors.HexColor("#cbd5e1")
COL_RELLENO = colors.HexColor("#f1f5f9")
COL_RELLENO2 = colors.HexColor("#f8fafc")
COL_RELLENO3 = colors.HexColor("#e2e8f0")
COL_RELLENO_BOTON = colors.HexColor("#cbd5e1")
COL_MARCA = colors.HexColor("#dc2626")


def _y(y_svg):
    """El viewBox del diagrama original (SVG) crece hacia abajo; ReportLab
    crece hacia arriba — se voltea acá una sola vez para poder copiar las
    coordenadas del frontend tal cual."""
    return 240 - y_svg


def _rect(x, y_top, w, h, r=0, fill=None, stroke=None, sw=1):
    # (x, y_top) en términos SVG es la esquina SUPERIOR izquierda del
    # rectángulo — Rect de ReportLab ubica la esquina INFERIOR izquierda,
    # así que la "y" que le corresponde es el borde de ABAJO (y_top + h).
    return Rect(x, _y(y_top + h), w, h, rx=r, ry=r, fillColor=fill, strokeColor=stroke, strokeWidth=sw)


def _circ(cx, cy, r, fill=None, stroke=None, sw=1):
    return Circle(cx, _y(cy), r, fillColor=fill, strokeColor=stroke, strokeWidth=sw)


def _elipse(cx, cy, rx, ry, fill=None, stroke=None, sw=1):
    return Ellipse(cx, _y(cy), rx, ry, fillColor=fill, strokeColor=stroke, strokeWidth=sw)


def _botones_laterales_celular(g):
    g.add(_rect(138, 64, 4, 28, r=1.5, fill=COL_RELLENO_BOTON, stroke=COL_BORDE, sw=1))
    g.add(_rect(18, 54, 4, 16, r=1.5, fill=COL_RELLENO_BOTON, stroke=COL_BORDE, sw=1))
    g.add(_rect(18, 76, 4, 16, r=1.5, fill=COL_RELLENO_BOTON, stroke=COL_BORDE, sw=1))


def _silueta_celular_frente(g):
    g.add(_rect(20, 10, 120, 220, r=18, fill=colors.white, stroke=COL_BORDE, sw=2))
    _botones_laterales_celular(g)
    g.add(_rect(30, 26, 100, 194, r=8, fill=COL_RELLENO, stroke=COL_BORDE_CLARO, sw=1))
    g.add(_rect(64, 17, 32, 4, r=2, fill=COL_BORDE_CLARO))
    g.add(_circ(100, 19, 2.2, fill=None, stroke=COL_BORDE, sw=1.3))
    g.add(_rect(64, 215, 32, 3, r=1.5, fill=COL_BORDE_CLARO))


def _silueta_celular_atras(g):
    g.add(_rect(20, 10, 120, 220, r=18, fill=colors.white, stroke=COL_BORDE, sw=2))
    _botones_laterales_celular(g)
    g.add(_rect(32, 24, 96, 192, r=10, fill=COL_RELLENO2, stroke=COL_RELLENO3, sw=1))
    g.add(_rect(36, 30, 40, 40, r=12, fill=COL_RELLENO3, stroke=COL_BORDE, sw=1.5))
    g.add(_circ(48, 42, 6.5, fill=None, stroke=COL_BORDE, sw=1.5))
    g.add(_circ(48, 42, 3, fill=COL_BORDE))
    g.add(_circ(65, 42, 6.5, fill=None, stroke=COL_BORDE, sw=1.5))
    g.add(_circ(65, 42, 3, fill=COL_BORDE))
    g.add(_circ(48, 59, 6.5, fill=None, stroke=COL_BORDE, sw=1.5))
    g.add(_circ(48, 59, 3, fill=COL_BORDE))
    g.add(_circ(65, 59, 3.2, fill=None, stroke=COL_BORDE_CLARO, sw=1.2))
    g.add(_circ(80, 150, 11, fill=None, stroke=COL_RELLENO3, sw=1.5))


def _silueta_laptop_frente(g):
    g.add(_rect(15, 10, 130, 112, r=10, fill=colors.white, stroke=COL_BORDE, sw=2))
    g.add(_rect(25, 20, 110, 92, r=4, fill=COL_RELLENO, stroke=COL_BORDE_CLARO, sw=1))
    g.add(_rect(58, 118, 44, 10, r=2, fill=COL_BORDE_CLARO, stroke=COL_BORDE, sw=1))
    g.add(_rect(10, 128, 140, 92, r=10, fill=colors.white, stroke=COL_BORDE, sw=2))
    for fila in range(4):
        for col in range(10):
            g.add(_rect(19 + col * 12, 136 + fila * 10, 9.5, 7, r=1.5, fill=COL_RELLENO, stroke=COL_RELLENO3, sw=0.5))
    g.add(_rect(62, 198, 36, 16, r=3, fill=COL_RELLENO, stroke=COL_BORDE_CLARO, sw=1))


def _silueta_laptop_atras(g):
    g.add(_rect(15, 10, 130, 112, r=10, fill=colors.white, stroke=COL_BORDE, sw=2))
    g.add(_circ(80, 66, 15, fill=None, stroke=COL_BORDE_CLARO, sw=2))
    g.add(_rect(58, 118, 44, 10, r=2, fill=COL_BORDE_CLARO, stroke=COL_BORDE, sw=1))
    g.add(_rect(10, 128, 140, 92, r=10, fill=colors.white, stroke=COL_BORDE, sw=2))
    for col in range(6):
        g.add(_rect(28 + col * 17, 148, 11, 3, r=1.5, fill=COL_RELLENO3))
        g.add(_rect(28 + col * 17, 156, 11, 3, r=1.5, fill=COL_RELLENO3))
    for (ex, ey) in [(22, 138), (138, 138), (22, 210), (138, 210)]:
        g.add(_elipse(ex, ey, 6, 4, fill=COL_RELLENO3))


def _silueta_laptop_lateral(g, espejo=False):
    inner = Group()
    inner.add(_rect(10, 108, 140, 24, r=4, fill=colors.white, stroke=COL_BORDE, sw=2))
    inner.add(_rect(22, 114, 10, 12, r=1.5, fill=COL_RELLENO, stroke=COL_BORDE_CLARO, sw=1))
    inner.add(_rect(40, 116, 16, 8, r=1.5, fill=COL_RELLENO, stroke=COL_BORDE_CLARO, sw=1))
    inner.add(_rect(66, 116, 10, 8, r=1.5, fill=COL_RELLENO, stroke=COL_BORDE_CLARO, sw=1))
    inner.add(_rect(112, 114, 14, 12, r=1.5, fill=COL_RELLENO, stroke=COL_BORDE_CLARO, sw=1))
    inner.add(_rect(130, 116, 10, 8, r=1.5, fill=COL_RELLENO, stroke=COL_BORDE_CLARO, sw=1))
    if espejo:
        # Mismo efecto que el CSS del frontend (scale(-1,1) translate(-160,0)):
        # espeja el lado izquierdo para dibujar el lado derecho sin duplicar coordenadas.
        inner.transform = (-1, 0, 0, 1, 160, 0)
    g.add(inner)


def _grupo_silueta(tipo, vista):
    g = Group()
    if tipo == "COM":
        if vista == "ATRAS":
            _silueta_laptop_atras(g)
        elif vista == "LATERAL_IZQ":
            _silueta_laptop_lateral(g, espejo=False)
        elif vista == "LATERAL_DER":
            _silueta_laptop_lateral(g, espejo=True)
        else:
            _silueta_laptop_frente(g)
    else:
        if vista == "ATRAS":
            _silueta_celular_atras(g)
        else:
            _silueta_celular_frente(g)
    return g


def _marca_dano(g, x, y, numero):
    yy = _y(y)
    g.add(Line(x - 5, yy - 5, x + 5, yy + 5, strokeColor=COL_MARCA, strokeWidth=2.5))
    g.add(Line(x - 5, yy + 5, x + 5, yy - 5, strokeColor=COL_MARCA, strokeWidth=2.5))
    g.add(Circle(x + 9, yy - 9, 7, fillColor=COL_MARCA, strokeColor=None))
    g.add(String(x + 9, yy - 11.5, str(numero), fontSize=7.5, fillColor=colors.white, textAnchor="middle", fontName="Helvetica-Bold"))


def _dibujar_danos_vista(tipo, vista, puntos_vista, ancho_final, alto_final):
    d = Drawing(160, 240)
    d.add(_grupo_silueta(tipo, vista))
    for i, p in enumerate(puntos_vista):
        _marca_dano(d, p.get("x", 80), p.get("y", 120), i + 1)
    d.width = ancho_final
    d.height = alto_final
    d.scale(ancho_final / 160.0, alto_final / 240.0)
    return d


def _imagen_firma(data_uri, ancho, alto):
    """Decodifica una firma capturada en el equipo (guardada como imagen
    base64) para incrustarla en el PDF — si el cliente ya firmó
    digitalmente, el documento impreso debe mostrar esa firma real, no
    solo una línea en blanco."""
    if not data_uri or "," not in data_uri:
        return None
    try:
        _, b64 = data_uri.split(",", 1)
        raw = base64.b64decode(b64)
        return Image(BytesIO(raw), width=ancho, height=alto)
    except Exception:
        return None


# ============================================================
# Estilos (dos pasadas: normal y compacta — ver _construir_pdf)
# ============================================================

def _crear_estilos(escala=1.0):
    base = getSampleStyleSheet()

    def ps(name, **kw):
        for campo in ("fontSize", "leading", "spaceBefore", "spaceAfter"):
            if campo in kw:
                kw[campo] = kw[campo] * escala
        return ParagraphStyle(name, **kw)

    return {
        "escala": escala,
        "titulo": ps("Titulo", parent=base["Title"], textColor=PRIMARY, fontSize=11.5, leading=13, alignment=TA_RIGHT),
        "meta": ps("Meta", parent=base["Normal"], textColor=MUTED, fontSize=7.4, alignment=TA_RIGHT),
        "seccion_titulo": ps("SeccionTitulo", parent=base["Normal"], textColor=colors.white, fontSize=8.2,
                              leading=9.4, fontName="Helvetica-Bold"),
        "seccion_extra": ps("SeccionExtra", parent=base["Normal"], textColor=colors.HexColor("#FEF08A"), fontSize=7.4,
                             leading=8.5, fontName="Helvetica-Bold", alignment=TA_RIGHT),
        "campo": ps("Campo", parent=base["Normal"], fontSize=7.1, leading=8.1, textColor=colors.black),
        "legal_h": ps("LegalH", parent=base["Normal"], fontSize=7.6, leading=8.7, fontName="Helvetica-Bold",
                       textColor=PRIMARY, spaceAfter=0.6),
        "legal_p": ps("LegalP", parent=base["Normal"], fontSize=6.5, leading=7.3, textColor=colors.black,
                       spaceAfter=0.6),
        "footer": ps("Footer", parent=base["Normal"], fontSize=6.2, leading=7.4, textColor=colors.HexColor("#CA8A04"),
                      alignment=TA_CENTER),
        "firma_label": ps("FirmaLabel", parent=base["Normal"], fontSize=6.9, textColor=MUTED, alignment=TA_CENTER),
        "checklist_sub": ps("ChecklistSub", parent=base["Normal"], fontSize=7.4, leading=8.5,
                             fontName="Helvetica-Bold", spaceAfter=1.5),
        "checklist_item": ps("ChecklistItem", parent=base["Normal"], fontSize=6.6, leading=7.6, textColor=colors.black),
        "dano_nota": ps("DanoNota", parent=base["Normal"], fontSize=5.6, leading=6.4, textColor=MUTED),
        "dano_titulo": ps("DanoTitulo", parent=base["Normal"], fontSize=6.4, leading=7.4, fontName="Helvetica-Bold", textColor=colors.black),
    }


def _p(est, texto, style=None):
    return Paragraph(texto if texto not in (None, "") else SD, style or est["campo"])


def _sp(est, valor):
    return Spacer(1, valor * est["escala"])


def _seccion_titulo(est, numero, texto, ancho, extra_derecha=None):
    if extra_derecha:
        fila = [Paragraph(f"{numero}.- {texto}", est["seccion_titulo"]), Paragraph(extra_derecha, est["seccion_extra"])]
        t = Table([fila], colWidths=[ancho * 0.66, ancho * 0.34])
    else:
        t = Table([[Paragraph(f"{numero}.- {texto}", est["seccion_titulo"])]], colWidths=[ancho])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PRIMARY),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 1.2 * est["escala"]), ("BOTTOMPADDING", (0, 0), (-1, -1), 1.2 * est["escala"]),
        ("BOX", (0, 0), (-1, -1), 1, PRIMARY),
    ]))
    return t


def _caja(est, ancho, *filas_labels_valores, titulo=None):
    """Tabla de 2 columnas [etiqueta | valor] con borde, estilo 'caja de datos'."""
    data = []
    if titulo:
        data.append([Paragraph(titulo, est["legal_h"]), ""])
    for label, valor in filas_labels_valores:
        data.append([Paragraph(f"<font color='#64748b'>{label}</font>", est["campo"]), _p(est, valor)])
    t = Table(data, colWidths=[ancho * 0.44, ancho * 0.56])
    estilo = [
        ("BOX", (0, 0), (-1, -1), 0.7, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 0.6 * est["escala"]), ("BOTTOMPADDING", (0, 0), (-1, -1), 0.6 * est["escala"]),
        ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]
    if titulo:
        estilo.append(("SPAN", (0, 0), (-1, 0)))
        estilo.append(("LINEBELOW", (0, 0), (-1, 0), 0.5, BORDER))
    t.setStyle(TableStyle(estilo))
    return t


def _clausulas_2col(est, titulo, parrafos, ancho, titulo_style=None):
    mitad = (len(parrafos) + 1) // 2
    col_izq = [Paragraph(c, est["legal_p"]) for c in parrafos[:mitad]]
    col_der = [Paragraph(c, est["legal_p"]) for c in parrafos[mitad:]]
    tabla = Table([[col_izq, col_der]], colWidths=[ancho / 2 - 4, ancho / 2 - 4])
    tabla.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, 0), 0), ("RIGHTPADDING", (0, 0), (0, 0), 8),
        ("LEFTPADDING", (1, 0), (1, 0), 8), ("RIGHTPADDING", (1, 0), (1, 0), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    bloque = [Paragraph(titulo, titulo_style or est["legal_h"]), tabla] if titulo else [tabla]
    return bloque


def _checklist_bloque(est, titulo, items, keys, valores, ancho, color_marca, columnas):
    celdas = []
    for k, label in zip(keys, items):
        marcado = bool(valores.get(k))
        caja = "☒" if marcado else "☐"
        color_caja = color_marca if marcado else "#94a3b8"
        celdas.append(Paragraph(f"<font color='{color_caja}'>{caja}</font> {label}", est["checklist_item"]))
    filas = [celdas[i:i + columnas] for i in range(0, len(celdas), columnas)]
    if filas and len(filas[-1]) < columnas:
        filas[-1] = filas[-1] + [""] * (columnas - len(filas[-1]))
    ancho_col = ancho / columnas
    tabla = Table(filas, colWidths=[ancho_col] * columnas)
    tabla.setStyle(TableStyle([
        ("TOPPADDING", (0, 0), (-1, -1), 0.4 * est["escala"]), ("BOTTOMPADDING", (0, 0), (-1, -1), 0.4 * est["escala"]),
        ("LEFTPADDING", (0, 0), (-1, -1), 2), ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    titulo_p = Paragraph(f"<font color='{color_marca}'>{titulo}</font>", est["checklist_sub"])
    return KeepTogether([titulo_p, tabla])


def _resumen_dict(valores, items_labels, estado_labels):
    partes = []
    for key, label in items_labels.items():
        val = (valores or {}).get(key)
        if val not in (None, ""):
            partes.append(f"{label}: {estado_labels.get(val, val)}")
    return " · ".join(partes)


def _software_txt(orden, detalle):
    sw = (detalle.software if detalle else None) or {}
    partes = []
    if orden.sistema_operativo:
        partes.append(f"Sistema operativo: {orden.sistema_operativo}")
    for clave, etiqueta in [("version", "Versión"), ("licencia", "Licencia"), ("office", "Office"),
                             ("antivirus", "Antivirus"), ("programas", "Programas importantes")]:
        if sw.get(clave):
            partes.append(f"{etiqueta}: {sw[clave]}")
    return " · ".join(partes)


def _accesorios_detalle_txt(detalle):
    partes = []
    for a in ((detalle.accesorios_detalle if detalle else None) or []):
        nombre = (a.get("nombre") or "").strip()
        if not nombre:
            continue
        extra = [x for x in (a.get("estado"), a.get("serial")) if x]
        partes.append(f"{nombre} ({', '.join(extra)})" if extra else nombre)
    return " · ".join(partes)


def _tipos_servicio_txt(orden):
    partes = []
    for s in (orden.tipos_servicio or []):
        if s == "OTRO" and orden.tipos_servicio_otro:
            partes.append(orden.tipos_servicio_otro)
        else:
            partes.append(TIPO_SERVICIO_LABELS.get(s, s))
    return " · ".join(partes) or (TIPO_SERVICIO_LABELS.get(orden.tipo_servicio) if orden.tipo_servicio else None)


def _factura_numero(orden):
    ov = getattr(orden, "origen_venta", None)
    if not ov:
        return None
    factura = getattr(ov, "factura", None)
    return getattr(factura, "numero", None) if factura else None


def _construir_pdf(orden, cliente, empresa_nombre, *, escala, margen_tb, margen_lr, columnas_checklist):
    est = _crear_estilos(escala)
    es_cca = orden.categoria_equipo in ("CELULAR", "TABLET")
    tipo = "CCA" if es_cca else "COM"
    detalle = getattr(orden, "detalle_com", None)

    buf = BytesIO()
    ancho_util = letter[0] - 2 * margen_lr
    doc = SimpleDocTemplate(
        buf, pagesize=letter, topMargin=margen_tb, bottomMargin=margen_tb, leftMargin=margen_lr, rightMargin=margen_lr,
        title=f"Orden {orden.numero}",
    )
    story = []

    # ---------- Encabezado ----------
    tecnico_nombre = orden.tecnico.nombre if orden.tecnico_id else None
    estado_txt = orden.get_estado_display()
    header_der = [
        Paragraph(f"ORDEN DE RECEPCIÓN Y TRABAJO <font color='#1d4ed8'>{tipo}</font>", est["titulo"]),
        Paragraph(
            f"Técnico asignado: <b>{nombre_corto(tecnico_nombre) or SD}</b> · OT No: "
            f"<b><font backColor='#fef08a' color='#713f12'>{orden.numero}</font></b> · {estado_txt}",
            est["meta"],
        ),
    ]
    if os.path.exists(LOGO_PATH):
        logo = Image(LOGO_PATH, width=20 * mm, height=10 * mm)
    else:
        logo = Paragraph("RCP", est["titulo"])
    header = Table([[logo, header_der]], colWidths=[ancho_util * 0.25, ancho_util * 0.75])
    header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("LINEBELOW", (0, 0), (-1, -1), 1.5, PRIMARY),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
    ]))
    story.append(header)
    story.append(_sp(est, 0.6))

    # ---------- 1.- Datos generales del cliente ----------
    fecha_recepcion = orden.fecha_hora_recepcion.strftime("%d/%m/%Y, %H:%M") if orden.fecha_hora_recepcion else SD
    telefono = cliente.telefono if cliente else SD
    if cliente and getattr(cliente, "telefono2", None):
        telefono = f"{telefono} / {cliente.telefono2}"
    operadora_txt = OPERADORA_LABELS.get(getattr(cliente, "operadora", None), SD) if cliente else SD
    como_supo_txt = COMO_SUPO_LABELS.get(orden.como_supo, SD)
    empresa_id = getattr(cliente, "empresa_id", None) if cliente else None
    filas_1 = [
        ("Cliente:", cliente.nombre if cliente else SD), ("Cédula:", getattr(cliente, "cedula", None)),
        ("Correo:", getattr(cliente, "email", None)), ("Teléfono:", telefono), ("Operadora:", operadora_txt),
        ("WhatsApp:", _si_no(getattr(cliente, "whatsapp", None)) if cliente else SD),
        ("Empresa:", empresa_nombre or (cliente.empresa.nombre if empresa_id else None)),
        ("RUC:", getattr(cliente, "documento", None)),
        ("Fecha y hora de recepción:", fecha_recepcion),
        ("¿Cómo se enteró?:", como_supo_txt),
        ("Servicio:", _tipos_servicio_txt(orden)),
        ("Valor US$:", f"${orden.costo_estimado or 0}"),
        ("Adelanto:", f"${orden.adelanto}" if getattr(orden, "adelanto", None) else None),
        ("Fact./Recibo No.:", _factura_numero(orden)),
    ]
    if not es_cca:
        filas_1.append(("¿Empresa controla software?:", _si_no(detalle.empresa_controla_software) if detalle else SD))
        filas_1.append(("¿Primera vez o recurrente?:", _si_no(detalle.primera_vez) if detalle else SD))
    story.append(_seccion_titulo(est, 1, "DATOS GENERALES DEL CLIENTE", ancho_util))
    # A 2 columnas (antes 1 sola, filas apiladas): mismo contenido en la
    # mitad del alto — clave para que la orden completa quepa en 1 hoja.
    celdas_1 = [Paragraph(f"<font color='#64748b'>{l}</font> {_v(v)}", est["campo"]) for l, v in filas_1]
    filas_tabla1 = [celdas_1[i:i + 2] for i in range(0, len(celdas_1), 2)]
    if len(filas_tabla1[-1]) == 1:
        filas_tabla1[-1].append("")
    tabla1 = Table(filas_tabla1, colWidths=[ancho_util / 2, ancho_util / 2])
    tabla1.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.8, PRIMARY), ("TOPPADDING", (0, 0), (-1, -1), 0.6 * escala),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0.6 * escala), ("LEFTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(tabla1)
    story.append(_sp(est, 0.9))

    story.extend(_clausulas_2col(est, "SOBRE EL DIAGNÓSTICO", CLAUSULAS_DIAGNOSTICO, ancho_util))
    story.append(_sp(est, 0.9))

    # ---------- 2.- Detalles de recepción ----------
    # A partir de acá TODO se separa según el equipo sea CCA (celular/
    # tablet) o COM (computadora/otro) — antes venía todo junto en las
    # mismas 2 cajas para ambos tipos, mezclando campos que no le
    # correspondían al equipo (o dejando fuera los que sí).
    bitlocker_txt = f"BitLocker activo: {_si_no(detalle.bitlocker_activo)}" if (detalle and not es_cca) else None
    story.append(_seccion_titulo(est, 2, "DETALLES DE RECEPCIÓN", ancho_util, extra_derecha=bitlocker_txt))

    marca_modelo = " ".join(filter(None, [orden.marca, orden.modelo])) or SD
    serie = orden.no_serie or SD
    if es_cca:
        partes = []
        if orden.imei1:
            partes.append(f"IMEI1: {orden.imei1}")
        if orden.imei2:
            partes.append(f"IMEI2: {orden.imei2}")
        if orden.numero_chip:
            partes.append(f"Chip: {orden.numero_chip}")
        serie = " · ".join(partes) or SD

    if es_cca:
        caja_equipo = _caja(
            est, ancho_util / 2 - 2,
            ("Equipo:", orden.equipo), ("Marca/Modelo:", marca_modelo),
            ("Color:", f"{orden.color or SD}{f' · {orden.capacidad}' if orden.capacidad else ''}"),
            ("IMEI:", serie),
            titulo="EQUIPO RECIBIDO",
        )
        caja_estado = _caja(
            est, ancho_util / 2 - 2,
            ("Estado:", ESTADO_EQUIPO_LABELS.get(orden.estado_general, SD)),
            ("Encendido:", ESTADO_ENCENDIDO_LABELS.get(orden.encendido, SD)),
            ("Batería original:", _si_no(orden.bateria_original)),
            ("¿Cámara funciona?:", _si_no(orden.camara_funciona)),
            titulo="ESTADO DEL EQUIPO",
        )
        story.append(Table([[caja_equipo, caja_estado]], colWidths=[ancho_util / 2, ancho_util / 2]))
    else:
        ancho_caja = ancho_util / 3 - 2
        caja_equipo = _caja(
            est, ancho_caja,
            ("Equipo:", orden.equipo), ("Marca/Modelo:", marca_modelo),
            ("Procesador:", detalle.procesador_generacion if detalle else None),
            ("Color:", f"{orden.color or SD}{f' · {orden.capacidad}' if orden.capacidad else ''}"),
            ("N.º serie:", serie),
            titulo="EQUIPO RECIBIDO",
        )
        caja_estado = _caja(
            est, ancho_caja,
            ("Estado:", ESTADO_EQUIPO_LABELS.get(orden.estado_general, SD)),
            ("Encendido:", ESTADO_ENCENDIDO_LABELS.get(orden.encendido, SD)),
            ("Batería original:", _si_no(orden.bateria_original)),
            ("¿Comprado nuevo?:", _si_no(detalle.comprado_nuevo) if detalle else SD),
            titulo="ESTADO DEL EQUIPO",
        )
        caja_specs = _caja(
            est, ancho_caja,
            ("RAM / Tipo:", f"{(detalle.ram_tipo if detalle else None) or SD}{f' / {detalle.ram_frecuencia}' if detalle and detalle.ram_frecuencia else ''}"),
            ("Slots de RAM:", detalle.ram_slots if detalle else None),
            ("Disco:", f"{(detalle.disco_capacidad if detalle else None) or SD}{f' / {detalle.tipo_almacenamiento}' if detalle and detalle.tipo_almacenamiento else ''}"),
            ("Marca del disco:", detalle.marca_disco if detalle else None),
            ("Serial disco / conector:", f"{(detalle.serial_disco if detalle else None) or SD}{f' / {detalle.tipo_conector}' if detalle and detalle.tipo_conector else ''}"),
            titulo="ESPECIFICACIONES DEL EQUIPO",
        )
        story.append(Table([[caja_equipo, caja_estado, caja_specs]], colWidths=[ancho_util / 3, ancho_util / 3, ancho_util / 3]))
    story.append(_sp(est, 0.9))

    if not es_cca and detalle is not None:
        componentes_txt = _resumen_dict(detalle.componentes, COMPONENTES_ITEMS_LABELS, ESTADO_COMPONENTE_LABELS)
        software_txt = _software_txt(orden, detalle)
        if componentes_txt:
            story.append(Paragraph(f"<b>Componentes:</b> {componentes_txt}", est["legal_p"]))
        if software_txt:
            story.append(Paragraph(f"<b>Software / Sistema operativo:</b> {software_txt}", est["legal_p"]))

    if es_cca:
        accesorios_txt = orden.accesorios or SD
        story.append(Paragraph(f"<font color='#64748b'>Accesorios:</font> {accesorios_txt}", est["legal_p"]))
    else:
        accesorios_txt = _accesorios_detalle_txt(detalle) or SD
        respaldo_txt = f" · ¿Solicita respaldo de la información?: {_si_no(detalle.respaldo_solicitado)}" if detalle else ""
        story.append(Paragraph(f"<font color='#64748b'>Accesorios recibidos:</font> {accesorios_txt}{respaldo_txt}", est["legal_p"]))

    contrasena_txt = "Sin contraseña (no se puede verificar el equipo)" if orden.sin_contrasena else (orden.contrasena_equipo or SD)
    story.append(Paragraph(f"<font color='#64748b'>Contraseña:</font> {contrasena_txt}", est["legal_p"]))
    story.append(_sp(est, 0.6))

    # ---------- Daños visibles: diagrama del equipo con las marcas ----------
    # Antes solo se listaba la nota de texto de cada marca — muchas marcas
    # no llevan nota (el técnico solo marca el punto en el diagrama), así
    # que para esas órdenes no salía nada. Ahora se dibuja la misma
    # silueta con las marcas en su posición real, igual que en pantalla.
    puntos_danos = orden.danos_visibles or []
    if puntos_danos:
        vistas = VISTAS_POR_TIPO.get(tipo, VISTAS_POR_TIPO["CCA"])
        ancho_dibujo = 15 * mm * escala
        alto_dibujo = 22.5 * mm * escala
        celdas_danos = []
        for vw in vistas:
            pts = [p for p in puntos_danos if p.get("vista") == vw]
            dibujo = _dibujar_danos_vista(tipo, vw, pts, ancho_dibujo, alto_dibujo)
            contenido = [dibujo, Paragraph(ETIQUETA_VISTA.get(vw, vw), est["dano_titulo"])]
            if pts:
                notas = [f"{i + 1}. {(p.get('nota') or 'Sin descripción').strip()}" for i, p in enumerate(pts)]
                contenido.append(Paragraph(" ".join(notas), est["dano_nota"]))
            # Ojo: NO envolver en KeepTogether acá — KeepTogether.wrap()
            # devuelve a propósito una altura "infinita" (0xffffff) para
            # forzar que el documento llame a su split() más adelante; eso
            # funciona bien como elemento suelto del story, pero una Table
            # nunca llama split() en el contenido de sus celdas, así que
            # esa altura falsa se toma literal y revienta con
            # LayoutError. La lista de flowables sola, sin envoltorio,
            # sí calcula bien su alto dentro de una celda.
            celdas_danos.append(contenido)
        ancho_col = ancho_util / len(vistas)
        # Ojo: la etiqueta "Daños visibles" va como Paragraph SUELTO antes
        # de la tabla, no como una fila con SPAN dentro de la misma tabla
        # que trae los Drawing — combinar SPAN con una fila de Drawing en
        # la misma Table confunde el cálculo de alto de fila de ReportLab
        # (reporta un alto "infinito" y tira LayoutError). Separado, no.
        story.append(Paragraph("<font color='#64748b'>Daños visibles</font>", est["campo"]))
        tabla_danos = Table([celdas_danos], colWidths=[ancho_col] * len(vistas))
        tabla_danos.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 2), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ]))
        story.append(tabla_danos)
    else:
        story.append(Paragraph("<font color='#64748b'>Daños visibles:</font> Ninguno marcado", est["legal_p"]))
    story.append(_sp(est, 0.9))

    story.extend(_clausulas_2col(est, "SOBRE EL INGRESO", CLAUSULAS_INGRESO, ancho_util))
    story.append(_sp(est, 0.9))

    # ---------- 3.- Diagnóstico y presupuesto ----------
    story.append(_seccion_titulo(est, 3, "DIAGNÓSTICO Y PRESUPUESTO", ancho_util))
    if orden.equipo_apagado_recepcion:
        story.append(Paragraph("El check list no aplica: no se puede verificar nada con el equipo apagado.", est["legal_p"]))
    if orden.problema_reportado:
        story.append(Paragraph(f"<b>Falla reportada:</b> {orden.problema_reportado}", est["legal_p"]))
    if orden.comentarios:
        story.append(Paragraph(f"<b>Comentarios:</b> {orden.comentarios}", est["legal_p"]))
    if orden.diagnostico:
        story.append(Paragraph(f"<b>Diagnóstico:</b> {orden.diagnostico}", est["legal_p"]))
    if orden.recomendaciones:
        story.append(Paragraph(f"<b>Recomendaciones:</b> {orden.recomendaciones}", est["legal_p"]))

    items = CHECKLIST_CCA if es_cca else [label for _, label in CHECKLIST_COM]
    keys = CHECKLIST_CCA if es_cca else [key for key, _ in CHECKLIST_COM]
    entrada_vals = orden.checklist_entrada or {}
    salida_vals = orden.checklist_salida or {}

    story.append(_sp(est, 0.6))
    story.append(_checklist_bloque(est, "CHECK LIST TÉCNICO DE ENTRADA", items, keys, entrada_vals, ancho_util, "#1D4ED8", columnas_checklist))
    story.append(_sp(est, 0.4))
    story.append(_checklist_bloque(est, "CHECK LIST TÉCNICO DE SALIDA", items, keys, salida_vals, ancho_util, "#BE123C", columnas_checklist))
    story.append(_sp(est, 0.6))

    repuestos = orden.repuestos or []
    servicios = orden.servicios_realizados or []
    simbolo = "C$" if orden.moneda == "NIO" else "US$"
    if repuestos or servicios:
        data = [["Descripción", "Tipo", "Precio"]]
        for r in repuestos:
            data.append([r.get("descripcion", ""), TIPO_REPUESTO_LABELS.get(r.get("tipo"), r.get("tipo", "")), f"{simbolo}{r.get('precio', 0)}"])
        for s in servicios:
            data.append([s.get("descripcion", ""), "Servicio", f"{simbolo}{s.get('precio', 0)}"])
        tabla_items = Table(data, colWidths=[ancho_util * 0.55, ancho_util * 0.25, ancho_util * 0.2])
        tabla_items.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), PRIMARY), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 7.5 * escala), ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
            ("TOPPADDING", (0, 0), (-1, -1), 2 * escala), ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * escala),
        ]))
        story.append(tabla_items)
        story.append(_sp(est, 0.9))

    total_repuestos = sum(float(r.get("precio") or 0) for r in repuestos)
    total_servicios = sum(float(s.get("precio") or 0) for s in servicios)
    base_total = (total_repuestos + total_servicios) or float(orden.costo_estimado or 0)
    total_final = base_total - float(orden.descuento or 0) + float(orden.impuestos or 0)
    extra_total = []
    if float(orden.descuento or 0) > 0 or float(orden.impuestos or 0) > 0:
        extra_total.append(f"Descuento: {simbolo}{float(orden.descuento or 0):,.2f} · Impuestos: {simbolo}{float(orden.impuestos or 0):,.2f}")
    if orden.repuesto_inmediato:
        extra_total.append("Repuesto inmediato — incluido en este cobro")
    texto_pago = f"Forma de pago: {FORMA_PAGO_LABELS.get(orden.forma_pago, SD)}" + ("".join(f" · {x}" for x in extra_total))
    tabla_total = Table([[
        Paragraph(texto_pago, est["campo"]),
        Paragraph(f"<b>Total de la orden: {simbolo}{total_final:,.2f}</b>", ParagraphStyle("Tot", parent=est["campo"], fontSize=10 * escala, textColor=PRIMARY, alignment=TA_RIGHT)),
    ]], colWidths=[ancho_util * 0.6, ancho_util * 0.4])
    tabla_total.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.8, PRIMARY), ("TOPPADDING", (0, 0), (-1, -1), 3 * escala), ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * escala), ("LEFTPADDING", (0, 0), (-1, -1), 5)]))
    story.append(tabla_total)
    story.append(_sp(est, 0.6))

    # ---------- 4.- Aceptación, responsables y entrega final ----------
    story.append(_seccion_titulo(est, 4, "ACEPTACIÓN, RESPONSABLES Y ENTREGA FINAL", ancho_util))
    asesor_nombre = orden.asesor.nombre if orden.asesor_id else SD
    fecha_entrega = orden.fecha_entrega_real or orden.fecha_entrega_estimada or SD
    linea4 = (
        f"<font color='#64748b'>Fecha y hora de entrega:</font> {fecha_entrega} &nbsp;·&nbsp; "
        f"<font color='#64748b'>Recibe/Técnico:</font> {orden.recibe or SD} / {nombre_corto(tecnico_nombre) or SD} &nbsp;·&nbsp; "
        f"<font color='#64748b'>Asesor asignado:</font> {asesor_nombre}"
    )
    if orden.tiempo_reparacion_estimado:
        linea4 += f" &nbsp;·&nbsp; <font color='#64748b'>Tiempo estimado:</font> {orden.tiempo_reparacion_estimado}"
    story.append(Paragraph(linea4, est["legal_p"]))
    if orden.observaciones:
        story.append(Paragraph(f"<b>Observaciones:</b> {orden.observaciones}", est["legal_p"]))
    story.append(_sp(est, 0.9))

    def _firma_box(label, data_uri):
        img = _imagen_firma(data_uri, ancho_util * 0.4, 13 * mm)
        if img is not None:
            contenido = img
        else:
            contenido = Table([[""]], colWidths=[ancho_util * 0.45], rowHeights=[5 * mm])
            contenido.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, -1), 1, colors.black)]))
        return [contenido, Paragraph(label, est["firma_label"])]

    firmas = Table([[
        _firma_box("Firma del cliente — Leí y entendí", getattr(orden, "firma_cliente", None)),
        _firma_box("Firma del cliente — Recibí conforme", getattr(orden, "firma_cliente_entrega", None)),
    ]], colWidths=[ancho_util / 2, ancho_util / 2])
    firmas.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER"), ("VALIGN", (0, 0), (-1, -1), "BOTTOM")]))
    story.append(KeepTogether(firmas))
    story.append(_sp(est, 0.9))

    # ---------- 5.- Otros / La garantía ----------
    story.append(HRFlowable(width=ancho_util, thickness=1.5, color=PRIMARY, spaceAfter=2))
    titulo_g5 = ParagraphStyle("G5", parent=est["legal_h"], alignment=TA_CENTER, fontSize=9 * escala)
    story.append(Paragraph("5.- OTROS — LA GARANTÍA", titulo_g5))
    for c in CLAUSULAS_GARANTIA:
        story.append(Paragraph(c, est["legal_p"]))
    story.append(_sp(est, 0.6))
    story.append(Paragraph(
        "+20K equipos reparados · Dell Technology Partner · Lenovo Business Partner · "
        "Consulte sobre sus equipos: 8880 8260 / 7553 0443",
        est["footer"],
    ))

    doc.build(story)
    buf.seek(0)
    return buf.getvalue(), doc.page


def build_orden_pdf_response(orden, cliente=None, empresa_nombre=None):
    cliente = cliente or orden.cliente

    # Pasada 1: medidas normales — igual que siempre. La inmensa mayoría de
    # las órdenes cae acá y no pasa por la pasada compacta.
    contenido, paginas = _construir_pdf(
        orden, cliente, empresa_nombre,
        escala=1.0, margen_tb=3 * mm, margen_lr=8 * mm, columnas_checklist=4,
    )

    # Pasada 2: solo si la orden trae tanto contenido que no cupo en 1
    # hoja carta con el tamaño normal — se regenera compacta para que, de
    # todas formas, salga completa en 1 sola hoja.
    if paginas > 1:
        contenido_compacto, paginas_compactas = _construir_pdf(
            orden, cliente, empresa_nombre,
            escala=0.9, margen_tb=2 * mm, margen_lr=6 * mm, columnas_checklist=6,
        )
        if paginas_compactas <= paginas:
            contenido = contenido_compacto

    response = HttpResponse(contenido, content_type="application/pdf")
    response["Content-Disposition"] = f'inline; filename="Orden_{orden.numero}.pdf"'
    return response
