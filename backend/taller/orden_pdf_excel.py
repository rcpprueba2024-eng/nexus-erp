"""Exporta la Orden de Recepción y Trabajo a PDF — el mismo Excel real
del jefe (con sus fórmulas, colores, imágenes y cláusulas originales)
llenado y convertido a PDF con Microsoft Excel instalado en el
servidor, igual que se hace para el Arqueo de Caja (ver
caja_chica/arqueo_pdf.py) y la Cotización a Cliente (ver
compras/pdf_cotizacion_cliente.py).

Reemplaza a la versión anterior (taller/pdf_orden.py, hecha con
ReportLab desde cero) — el jefe pidió explícitamente que la orden
impresa salga "igualita" a su plantilla real, con sus cláusulas, colores
y formato exactos; la única forma de garantizar eso es exportando el
Excel real, no recreándolo a mano.

A diferencia de arqueo_pdf.py/pdf_cotizacion_cliente.py (que llenan la
plantilla con openpyxl y solo usan Excel/COM para el último paso de
exportar a PDF), acá el LLENADO también se hace por COM: la plantilla de
la orden trae al menos una imagen en formato WMF que openpyxl no sabe
leer y descarta al guardar — ver taller/orden_excel.py para el porqué
completo. Por eso este módulo abre la plantilla directo con win32com,
escribe los valores celda por celda sobre esa misma sesión, exporta a
PDF, y cierra SIN GUARDAR (Close(False)) — la plantilla en disco nunca
se modifica."""
import os
import tempfile
import uuid

from django.http import HttpResponse, JsonResponse

from .orden_danos_img import construir_imagen_danos
from .orden_excel import (
    NOMBRE_FORMA_BITLOCKER_COM, NOMBRE_FORMA_TECNICO2_COM, SHEET_COM, VISTAS_POR_TIPO,
    orden_operaciones, tipo_orden,
)

# Tamaño de la "X" para las marcas libres (Cómo supo de nosotros /
# Primera vez que nos visita) — mismo criterio que las demás casillas
# chicas de la plantilla (Claro/Tigo/Whatsapp).
MARCA_LIBRE_TAMANO = (11.0, 12.0)  # ancho, alto (nativos)

XL_TYPE_PDF = 0

# Corrección de una falla que ya trae la plantilla COM tal cual la mandó
# el jefe (se confirmó exportando la plantilla sin tocarle un solo dato):
# el área de impresión ($B$2:$O$71) no alcanza a cubrir el pie de página
# (los logos llegan hasta la fila 72), y el párrafo de garantía (a 10pt)
# necesita más alto del que tiene su celda — entre las dos cosas, el
# final del párrafo y el pie quedaban cortados al exportar a PDF. Acá se
# corrige en cada PDF que se genera (nunca se toca ni se guarda el
# archivo de la plantilla) extendiendo el área de impresión hasta la fila
# 72 y bajando esa letra a 9pt — con eso entra completo, se comprobó
# generando y revisando el PDF. La plantilla CCA no tiene este problema
# (ya viene con margen de sobra), así que esto es solo para COM.
CORRECCION_COM_PRINT_AREA = "$B$2:$O$72"
CORRECCION_COM_GARANTIA_CELDA = "C64"
CORRECCION_COM_GARANTIA_FONTSIZE = 9.0

# Mismo tipo de falla que la de arriba, en otro recuadro: la cajita
# "NO SE OFRECE GARANTÍA EN SOFTWARE" (una FORMA, no una celda) trae de
# fábrica letra a 10.5pt y con eso la palabra "SOFTWARE" no entra —
# queda cortado en "NO SE OFRECE / GARANTÍA EN". Se confirmó exportando
# la plantilla completamente sin tocar: el corte ya viene así de
# fábrica. A 8.5pt entra completo (comprobado). Solo existe en la
# plantilla COM — la CCA no tiene una caja de garantía de software.
CORRECCION_COM_GARANTIA_SOFTWARE_FORMA = "Rounded Rectangle 11"
CORRECCION_COM_GARANTIA_SOFTWARE_FONTSIZE = 8.5

# Mismo tipo de falla, en la casilla "EMPRESA: SI ( )  NO ( )": la celda
# combinada (C8:E8) es angosta (169pt) y con la letra de "dato relleno"
# de este módulo (12pt, ver TAMANO_LETRA_DATOS) el texto no entra —
# queda cortado justo en el paréntesis de "NO ( X )", que es la parte
# que en realidad hay que poder leer. Se comprobó exportando la
# plantilla real: a 8pt entra completo con margen de sobra. Esta celda
# es una ETIQUETA fija con un cuadrito para marcar (como las de
# Claro/Tigo/Whatsapp), no un "dato" que deba verse grande, así que no
# tiene sentido forzarle el tamaño de letra grande de las demás celdas.
CORRECCION_COM_EMPRESA_CELDA = "C8"
CORRECCION_COM_EMPRESA_FONTSIZE = 8.0

# Achica la cláusula "IMPORTANTE" para ganarle espacio real al diagrama
# de daños de al lado (ver el aviso completo más abajo, junto a
# CORRECCION_COM_DANOS_BANDA). El "rebote" de tamaño (pasar por 20pt
# antes de bajar a 7pt) es necesario porque TextFrame2.AutoSize calcula
# mal el alto si se va directo de 10pt a 7pt (se comprobó: corta la
# última línea de la cláusula aunque el texto en sí no se pierda).
CORRECCION_COM_IMPORTANTE_FORMA = "Rounded Rectangle 119"
CORRECCION_COM_IMPORTANTE_FONTSIZE = 7.0
CORRECCION_COM_IMPORTANTE_FONTSIZE_REBOTE = 20.0

# El jefe pidió que los datos que llena el sistema se vean más grandes
# al imprimir — varias celdas de "relleno" (nombre del cliente, cédula,
# etc.) traían de fábrica una letra bastante más chica (10-11pt) que las
# etiquetas fijas de al lado, así que el dato quedaba casi invisible en
# comparación. Se sube a este tamaño cualquier celda que este módulo
# escriba (no se toca la letra de las celdas que ya traían su propio
# valor de fábrica, ver el loop de más abajo).
TAMANO_LETRA_DATOS = 12.0

# Casillas (Claro/Tigo/Whatsapp del cliente, etc.): formas rectangulares
# vacías que ya trae la plantilla como checkbox real — se marcan
# poniéndoles una "X" en negrita adentro. Son chicas (~11x10pt), por eso
# la letra tiene que ser bien chica para que la "X" entre.
TAMANO_LETRA_CASILLA = 8.0

# ENCIENDE OK / SIN IMAGEN / CON FALLA / NO ENCIENDE: acá SÍ hace falta
# DIBUJAR una forma nueva (no hay ninguna existente que marcar) porque
# todo ese recuadro es parte de la imagen fija de la plantilla — ver el
# aviso completo en orden_excel.py junto a POSICION_ENCENDIDO.
#
# OJO — esto no se puede resolver con una coordenada nativa fija ni con
# una fórmula de escala calculada de antemano: la plantilla usa "Ajustar
# a 1 página" (FitToPagesTall=1), así que Excel reescala el alto de la
# hoja según cuánto texto haya en los campos dinámicos (Falla reportada
# / Detalles de servicio) — y se comprobó (con varias pruebas, texto
# corto y largo) que esa escala NO es perfectamente predecible a partir
# del alto del área de impresión sola; el error que queda es chico pero
# alcanza para que la "X" caiga pegada al borde del cuadrito en vez de
# adentro. La solución confiable: CALIBRAR en cada generación — exportar
# una vez de más con dos marcas de prueba en posiciones nativas conocidas
# bien separadas, medir con PyMuPDF exactamente dónde cayeron en ESE PDF,
# sacar de ahí la escala/desplazamiento REAL de esta hoja en este momento
# (con sus altos de fila dinámicos ya puestos), y recién con eso calcular
# la posición nativa correcta para la "X" — ver _calibrar_y_dinamico().
# La escala horizontal sí es fija (nunca se tocan anchos de columna), esa
# no hace falta calibrarla cada vez.
CASILLAS_ENCENDIDO_COM_PDF = {
    "OK": (296.4, 232.3, 10.4, 7.7),
    "SIN_IMAGEN": (400.5, 232.3, 10.4, 7.7),
    "CON_FALLA": (296.4, 244.5, 10.4, 7.7),
    "NO_ENCIENDE": (400.5, 244.5, 10.4, 7.7),
}
CASILLAS_ENCENDIDO_CCA_PDF = {
    "OK": (501.0, 216.0, 8.0, 14.0),
    "SIN_IMAGEN": (579.0, 216.0, 8.0, 14.0),
    "CON_FALLA": (501.0, 231.0, 8.0, 14.0),
    "NO_ENCIENDE": (579.0, 231.0, 8.0, 14.0),
}

COM_OFFSET_X, COM_SCALE_X = 9.02, 0.5803
CCA_OFFSET_X, CCA_SCALE_X = 24.3, 0.6667

# --- Imagen de "daños visibles" (silueta con las marcas del técnico) ---
#
# COM: las coordenadas nativas de una forma nueva caen en el mismo
# sistema que ya usan formas reales de la plantilla (Rounded Rectangle
# 113/119) — no hace falta convertir nada, se comprobó insertando ahí
# mismo. El ancho (520) ya cubre TODA la imagen decorativa vieja de
# fábrica (se comprobó: con menos ancho quedaba un resto visible de esa
# foto al lado del diagrama) — el jefe pidió varias veces que las
# figuras salgan MÁS GRANDES, así que ahora sí se usa a fondo ese ancho
# (antes las 4 siluetas ocupaban apenas la mitad del ancho disponible,
# dejando un tramo en blanco enorme al lado — se comprobó midiendo el
# PDF exportado). El alto (102, hasta justo antes de "IMPORTANTE" ya
# achicada) es lo más grande que da el hueco real de la plantilla sin
# invadir la cláusula de al lado — se midió con calibración directa en
# Excel (Shape.Top/Height reales) que ahí prácticamente no queda margen
# (1-2pt), por eso el alto casi no sube. El bloque completo también se
# corrió un poco más a la derecha (Left 470->474) — el jefe pidió
# explícitamente correrlo hacia la derecha además de agrandarlo.
CORRECCION_COM_DANOS_BANDA = (465.0, 712.0, 520.0, 101.0)  # Left, Top, Width, Height (nativos)
CORRECCION_COM_DANOS_IMG_POS = (474.0, 714.0)  # Left, Top (nativos)
# Tamaño de cada silueta individual y separación entre ellas — se subió
# bastante el ancho (55->85) para aprovechar el ancho real disponible
# (hay margen de sobra hasta donde empieza la cajita "NO SE OFRECE
# GARANTÍA EN SOFTWARE", ~860 nativo — se comprobó con Shape.Left real).
# El alto ya estaba prácticamente en su tope (queda pegado a
# "IMPORTANTE"), por eso sube poco (82->87) comparado con el ancho.
CORRECCION_COM_DANOS_TAMANO_VISTA = (85.0, 87.0, 13.0)  # ancho, alto, alto_etiqueta (nativos) por silueta
CORRECCION_COM_DANOS_SEPARACION = 13.0  # espacio nativo entre siluetas, para repartirlas en todo el ancho

# CCA: el diagrama decorativo de fábrica NO es una forma normal de la
# hoja (a diferencia de lo que parecía por el nombre "Picture 88" al
# inspeccionar el .xlsx) — es la imagen del ENCABEZADO de página
# (PageSetup.CenterHeaderPicture, técnica "&G" con un montón de saltos
# de línea antes para empujarla hacia abajo, fuera de la franja de
# encabezado real). Un encabezado de página vive en un sistema de
# coordenadas de MARGEN, no en el de fila/columna de la hoja — por eso
# la calibración vieja (pensada para una forma normal) nunca alineaba
# bien, y por eso hace falta medir con un rectángulo de prueba real en
# vez de leer Shape.Left/Top de algo (confirmado insertando un
# rectángulo en native (100,100,50,50) y viendo que cae en PDF
# (86.2, 75.7, 33.7, 30.9) — escala/desplazo bien distintos de 1:1).
_CCA_DANOS_ESCALA_X, _CCA_DANOS_DESPLAZO_X = 0.6747, 18.70
_CCA_DANOS_ESCALA_Y, _CCA_DANOS_DESPLAZO_Y = 0.6177, 13.91


def _cca_nativo_x(pdf_x):
    return (pdf_x - _CCA_DANOS_DESPLAZO_X) / _CCA_DANOS_ESCALA_X


def _cca_nativo_y(pdf_y):
    return (pdf_y - _CCA_DANOS_DESPLAZO_Y) / _CCA_DANOS_ESCALA_Y


def _cca_nativo_medida(pdf_medida, eje):
    return pdf_medida / (_CCA_DANOS_ESCALA_X if eje == "x" else _CCA_DANOS_ESCALA_Y)


# Zona real (medida en el PDF exportado) donde cae el diagrama viejo de
# fábrica: dos imágenes incrustadas del encabezado que juntas ocupan
# aproximadamente x:[432,586] y:[291,403] en puntos del PDF final — se
# calculan sus equivalentes nativos con la calibración de arriba, con
# un margen chico para tapar el diagrama completo sin dejar bordes.
# OJO: el párrafo "SOBRE EL INGRESO" empieza en y≈407 del PDF — la altura
# de abajo (122/117) llegaba hasta y≈408-409, es decir se metía encima de
# la primera línea de ese párrafo y la dejaba borrosa/ilegible. Por eso
# la altura se recortó para terminar en y≈400, con margen real de sobra.
CORRECCION_CCA_DANOS_BANDA = (
    _cca_nativo_x(426.0), _cca_nativo_y(287.0),
    _cca_nativo_medida(168.0, "x"), _cca_nativo_medida(113.0, "y"),
)  # Left, Top, Width, Height (nativos)
CORRECCION_CCA_DANOS_IMG_POS = (_cca_nativo_x(432.0), _cca_nativo_y(291.0))  # Left, Top (nativos)
# Tamaño de cada silueta en nativos: se define en términos de cuánto se
# QUIERE que mida en el PDF final (más grande = más fácil de leer, el
# jefe pidió esto mismo para COM) y se convierte una sola vez acá,
# igual que se hace con la posición.
CORRECCION_CCA_DANOS_TAMANO_VISTA = (
    _cca_nativo_medida(70.0, "x"), _cca_nativo_medida(97.0, "y"), _cca_nativo_medida(12.0, "y"),
)  # ancho, alto, alto_etiqueta (nativos) por silueta
CORRECCION_CCA_DANOS_SEPARACION = _cca_nativo_medida(12.0, "x")  # espacio nativo entre las 2 siluetas

# Zona nativa del "CHECK LIST TÉCNICO DE ENTRADA" en cada plantilla —
# es una imagen fija de fábrica (ver aviso en orden_excel.py), no
# celdas, así que cuando el equipo llegó apagado y ese checklist no se
# pudo verificar de verdad, se marca completo con una "X" grande en
# rojo por encima (ver _marcar_equipo_apagado) en vez de dejarlo en
# blanco sin ninguna indicación. Medido igual que el resto de
# correcciones: Shape.Left/Top/Width/Height reales contra la plantilla
# ("Picture 110" en CCA, "Picture 129" en COM — identificadas por ser,
# de las fotos de la hoja, las que caen exactamente en la posición y
# tamaño de "CHECK LIST TÉCNICO DE ENTRADA" en el layout impreso, y
# tener practicamente el mismo tamaño que su pareja de "CHECK LIST DE
# SALIDA" justo al lado).
CORRECCION_COM_CHECKLIST_ENTRADA = (21.6, 1007.7, 383.1, 92.6)  # Left, Top, Width, Height (nativos)
CORRECCION_CCA_CHECKLIST_ENTRADA = (10.2, 808.8, 322.2, 87.1)  # Left, Top, Width, Height (nativos)

# Dos alturas nativas bien separadas, cerca de la fila de ENCIENDE OK en
# cada plantilla, que se usan solo para la marca de calibración temporal
# (se borra antes de la exportación final — nunca queda en el PDF real).
COM_CALIB_NATIVE_TOPS = (350.0, 470.0)
CCA_CALIB_NATIVE_TOPS = (290.0, 430.0)


def _marcar_zona_x_roja(ws, left, top, width, height):
    """Dibuja una "X" grande en rojo (dos líneas diagonales) sobre una
    zona rectangular nativa — para invalidar visualmente un bloque
    completo de la plantilla (ej. el checklist de entrada cuando el
    equipo llegó apagado) sin depender de celdas o formas editables que
    esa zona no tiene."""
    linea1 = ws.Shapes.AddLine(left, top, left + width, top + height)
    linea2 = ws.Shapes.AddLine(left + width, top, left, top + height)
    for linea in (linea1, linea2):
        linea.Line.ForeColor.RGB = 255  # rojo puro, formato RGB() de VBA (0x0000FF -> B,G,R)
        linea.Line.Weight = 2.25


def _calibrar_escala_y(ws, sheet_name, ruta_temporal):
    """Mide la escala/desplazamiento vertical REAL de esta hoja, en su
    estado actual (con los altos de fila dinámicos ya aplicados), para
    poder ubicar la "X" de ENCIENDE con precisión — ver el aviso largo
    junto a CASILLAS_ENCENDIDO_COM_PDF. Exporta un PDF de más (se borra
    apenas se mide) con dos marcas verdes en posiciones nativas
    conocidas, mide dónde cayeron con PyMuPDF, y devuelve (scale_y,
    offset_y) tal que pdf_y = native_y * scale_y + offset_y. None si por
    algún motivo no se pudo medir (se sigue sin marcar la casilla, no se
    interrumpe la generación del PDF por esto)."""
    import numpy as np
    import fitz

    tops = COM_CALIB_NATIVE_TOPS if sheet_name == SHEET_COM else CCA_CALIB_NATIVE_TOPS
    left = 496.3 if sheet_name == SHEET_COM else 700.0
    ancho, alto_marca = 40.0, 20.0

    marcas = []
    for top in tops:
        m = ws.Shapes.AddShape(1, left, top, ancho, alto_marca)
        m.Fill.ForeColor.RGB = 65280  # verde puro
        m.Line.Visible = False
        m.ZOrder(0)  # msoBringToFront — que nada la tape al medir
        marcas.append(m)
    try:
        ws.ExportAsFixedFormat(XL_TYPE_PDF, ruta_temporal)
    finally:
        for m in marcas:
            m.Delete()

    try:
        doc = fitz.open(ruta_temporal)
        page = doc[0]
        pix = page.get_pixmap(matrix=fitz.Matrix(1, 1))
        arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
        mask = (arr[:, :, 0] < 40) & (arr[:, :, 1] > 200) & (arr[:, :, 2] < 40)
        ys, xs = np.where(mask)
        doc.close()
    except Exception:
        return None
    finally:
        if os.path.exists(ruta_temporal):
            os.remove(ruta_temporal)

    if len(ys) == 0:
        return None
    ymid = (ys.min() + ys.max()) / 2
    ys_a = ys[ys < ymid]
    ys_b = ys[ys >= ymid]
    if len(ys_a) == 0 or len(ys_b) == 0:
        return None
    pdf_top_a, pdf_top_b = float(ys_a.min()), float(ys_b.min())
    native_a, native_b = tops
    scale_y = (pdf_top_b - pdf_top_a) / (native_b - native_a)
    if scale_y <= 0:
        return None
    offset_y = pdf_top_a - native_a * scale_y
    return scale_y, offset_y


def _coords_nativas_encendido(sheet_name, posicion, scale_y, offset_y):
    """Convierte el punto-objetivo en el PDF (fijo) a coordenadas
    nativas, usando la escala vertical YA CALIBRADA para esta hoja en
    este momento (ver _calibrar_escala_y) — la horizontal es fija."""
    mapa = CASILLAS_ENCENDIDO_COM_PDF if sheet_name == SHEET_COM else CASILLAS_ENCENDIDO_CCA_PDF
    offset_x, scale_x = (COM_OFFSET_X, COM_SCALE_X) if sheet_name == SHEET_COM else (CCA_OFFSET_X, CCA_SCALE_X)
    coords_pdf = mapa.get(posicion)
    if not coords_pdf:
        return None
    pdf_left, pdf_top, pdf_w, pdf_h = coords_pdf
    native_left = (pdf_left - offset_x) / scale_x
    native_top = (pdf_top - offset_y) / scale_y
    native_w = pdf_w / scale_x
    native_h = pdf_h / scale_y
    return native_left, native_top, native_w, native_h


def build_orden_pdf_response(orden, cliente=None, empresa_nombre=None):
    template_path, sheet_name, ops, alturas, shapes, casillas, posicion_encendido, marcas_libres = orden_operaciones(
        orden, cliente, empresa_nombre
    )

    try:
        import win32com.client as win32_client
    except ImportError:
        return JsonResponse(
            {"detail": "No se pudo generar el PDF: este servidor no tiene Microsoft Excel/pywin32 disponible."},
            status=501,
        )

    ruta_pdf = os.path.join(tempfile.gettempdir(), f"orden_{orden.id}_{uuid.uuid4().hex[:8]}.pdf")

    import pythoncom

    # CoInitialize: hace falta llamarlo en CADA hilo que use COM antes de
    # tocar cualquier objeto COM — al correr esto desde un script suelto
    # (o la consola de Django) funcionaba porque ese hilo ya tenía COM
    # inicializado por accidente, pero el hilo real que atiende esta
    # petición en el servidor Django NUNCA lo inicializa solo, y
    # DispatchEx tronaba con "No se ha llamado a CoInitialize." — se
    # confirmó pegándole a este endpoint por HTTP de verdad (no solo
    # desde manage.py shell, que enmascaraba el problema).
    pythoncom.CoInitialize()
    excel = None
    wb = None
    ruta_imagen_danos = None
    try:
        # DispatchEx (no Dispatch/dynamic.Dispatch): Dispatch se conecta a
        # una instancia de Excel que ya esté abierta en esta máquina si la
        # hay (confirmado con una prueba real) — si alguien tenía Excel
        # abierto con sus propios archivos, este código le habría vuelto
        # invisible su ventana y hasta se la cerraba al terminar
        # (excel.Quit() abajo), perdiendo lo que tuviera sin guardar.
        # DispatchEx siempre crea un proceso de Excel nuevo y separado.
        excel = win32_client.DispatchEx("Excel.Application")
        excel.Visible = False
        excel.DisplayAlerts = False
        # ReadOnly=False: hace falta escribir los valores de esta orden;
        # de todas formas se cierra sin guardar (Close(False) abajo), así
        # que la plantilla en disco queda intacta pase lo que pase.
        wb = excel.Workbooks.Open(template_path, ReadOnly=False, UpdateLinks=0)
        ws = wb.Worksheets(sheet_name)
        if sheet_name == SHEET_COM:
            ws.PageSetup.PrintArea = CORRECCION_COM_PRINT_AREA
            ws.Range(CORRECCION_COM_GARANTIA_CELDA).Font.Size = CORRECCION_COM_GARANTIA_FONTSIZE
            for shp in ws.Shapes:
                if shp.Name == CORRECCION_COM_GARANTIA_SOFTWARE_FORMA:
                    shp.TextFrame2.TextRange.Font.Size = CORRECCION_COM_GARANTIA_SOFTWARE_FONTSIZE
                    break
            # IMPORTANTE: se achica la letra (para poder agrandar el
            # diagrama de daños de al lado, que el jefe pidió que se vea
            # más grande) y se recalcula su alto real — se mantiene fijo
            # el borde INFERIOR de la caja (no el superior) para no
            # acercarse a "3.- DIAGNÓSTICO Y PRESUPUESTO", que le queda
            # pegado debajo. OJO: TextFrame2.AutoSize solo, yendo directo
            # de 10pt a 7pt, calcula mal el alto (se comprobó: corta la
            # última línea) — hay que pasar antes por OTRO tamaño para
            # forzar que Excel recalcule bien (ver
            # CORRECCION_COM_IMPORTANTE_FONTSIZE_REBOTE).
            for shp in ws.Shapes:
                if shp.Name == CORRECCION_COM_IMPORTANTE_FORMA:
                    borde_inferior = shp.Top + shp.Height
                    shp.TextFrame2.AutoSize = 1  # msoAutoSizeShapeToFitText
                    shp.TextFrame2.TextRange.Font.Size = CORRECCION_COM_IMPORTANTE_FONTSIZE_REBOTE
                    shp.TextFrame2.TextRange.Font.Size = CORRECCION_COM_IMPORTANTE_FONTSIZE
                    shp.Top = borde_inferior - shp.Height
                    break
        for celda, valor in ops:
            rng = ws.Range(celda)
            rng.Value2 = valor
            rng.Font.Color = 0  # negro — algunas celdas traen de fábrica el gris de "texto de ejemplo"
            rng.Font.Size = TAMANO_LETRA_DATOS
        if sheet_name == SHEET_COM:
            # EMPRESA: SI ( ) NO ( ) — ver aviso junto a
            # CORRECCION_COM_EMPRESA_FONTSIZE arriba. Va DESPUÉS del loop
            # de "ops" a propósito, para pisar el tamaño grande que ese
            # loop le acaba de poner.
            ws.Range(CORRECCION_COM_EMPRESA_CELDA).Font.Size = CORRECCION_COM_EMPRESA_FONTSIZE
        for celda, alto in alturas:
            # El alto ya viene calculado a mano en orden_excel.py
            # (_alto_para_texto) según cuánto texto se escribió — NO se usa
            # Range.Rows.AutoFit() acá porque es conocido que Excel lo
            # calcula mal en celdas COMBINADAS (en vez de agrandar la fila
            # para que quepa el texto, la achica) — se comprobó
            # imprimiendo el resultado y viendo el texto cortado a media
            # oración con AutoFit puesto.
            rng = ws.Range(celda)
            rng.WrapText = True
            ws.Rows(rng.Row).RowHeight = alto
        if shapes:
            # SERVICIO / VALOR / ADELANTO / FACT.RECIBO NO / CONTRASEÑA /
            # DAÑOS VISIBLES / BITLOCKER: la plantilla del jefe pone un
            # rectángulo de color ENCIMA de esas celdas — escribir en la
            # celda quedaba invisible, tapado por la forma (se comprobó
            # comparando el PDF exportado con y sin este paso). El texto
            # va directo en la forma.
            por_nombre = {shp.Name: shp for shp in ws.Shapes}
            for nombre_forma, valor in shapes:
                shp = por_nombre.get(nombre_forma)
                if shp is None:
                    continue
                shp.TextFrame2.TextRange.Text = str(valor)
                shp.TextFrame2.TextRange.Font.Bold = True
                shp.TextFrame2.TextRange.Font.Fill.ForeColor.RGB = 0  # negro
                if nombre_forma == NOMBRE_FORMA_BITLOCKER_COM:
                    # Esta insignia normalmente solo trae "BITLOCKER" (9
                    # letras) — "BITLOCKER: SÍ"/"BITLOCKER: NO" no entra
                    # en el mismo ancho a 12pt (se comprobó: el "SÍ"/"NO"
                    # quedaba invisible, cortado). Letra más chica, sin
                    # tocar el tamaño de la forma.
                    shp.TextFrame2.TextRange.Font.Size = 9.0
                else:
                    shp.TextFrame2.TextRange.Font.Size = TAMANO_LETRA_DATOS
        if casillas:
            # Claro / Tigo / Whatsapp del cliente: formas-checkbox vacías
            # que ya trae la plantilla — se marcan poniéndoles una "X"
            # adentro (mismo tipo de forma que las de arriba, pero mucho
            # más chicas, así que necesitan letra más chica para entrar).
            por_nombre = {shp.Name: shp for shp in ws.Shapes}
            for nombre_forma in casillas:
                shp = por_nombre.get(nombre_forma)
                if shp is None:
                    continue
                shp.TextFrame2.TextRange.Text = "X"
                shp.TextFrame2.TextRange.Font.Bold = True
                shp.TextFrame2.TextRange.Font.Fill.ForeColor.RGB = 0
                shp.TextFrame2.TextRange.Font.Size = TAMANO_LETRA_CASILLA

        if marcas_libres:
            # "Cómo supo de nosotros" / "Primera vez que nos visita" — ver
            # el aviso completo en orden_excel.py junto a
            # NOMBRE_IMAGEN_COMO_SUPO_COM. Cada marca es una "X" nueva
            # posicionada como fracción del ancho/alto de la imagen de
            # fondo (Picture 128/108) — no hace falta calibrar nada
            # porque esa imagen es una forma normal y estable, a
            # diferencia del recuadro de ENCIENDE.
            por_nombre_img = {shp.Name: shp for shp in ws.Shapes}
            ancho_marca, alto_marca = MARCA_LIBRE_TAMANO
            for nombre_imagen, frac_x, frac_y in marcas_libres:
                img = por_nombre_img.get(nombre_imagen)
                if img is None:
                    continue
                cx = img.Left + frac_x * img.Width
                cy = img.Top + frac_y * img.Height
                marca = ws.Shapes.AddShape(1, cx - ancho_marca / 2, cy - alto_marca / 2, ancho_marca, alto_marca)
                marca.Fill.Visible = False
                marca.Line.Visible = False
                marca.TextFrame2.TextRange.Text = "X"
                marca.TextFrame2.TextRange.Font.Bold = True
                marca.TextFrame2.TextRange.Font.Fill.ForeColor.RGB = 0
                marca.TextFrame2.TextRange.Font.Size = TAMANO_LETRA_CASILLA
                marca.TextFrame2.VerticalAnchor = 3  # msoAnchorMiddle
                marca.TextFrame2.HorizontalAnchor = 2  # msoAnchorCenter

        # Imagen de "daños visibles": la silueta del equipo con las
        # marcas que puso el técnico en pantalla, en el mismo lugar
        # donde las puso — ver el aviso completo en orden_excel.py sobre
        # por qué esto necesita un rectángulo blanco + una imagen nueva
        # en vez de escribir sobre una forma existente.
        if orden.danos_visibles:
            tipo = tipo_orden(orden)
            if sheet_name == SHEET_COM:
                ancho_v, alto_v, etiqueta_v = CORRECCION_COM_DANOS_TAMANO_VISTA
                kwargs_tamano = {
                    "ancho_por_vista": ancho_v, "alto_por_vista": alto_v,
                    "etiqueta_alto": etiqueta_v, "separacion": CORRECCION_COM_DANOS_SEPARACION,
                }
            else:
                ancho_v, alto_v, etiqueta_v = CORRECCION_CCA_DANOS_TAMANO_VISTA
                kwargs_tamano = {
                    "ancho_por_vista": ancho_v, "alto_por_vista": alto_v,
                    "etiqueta_alto": etiqueta_v, "separacion": CORRECCION_CCA_DANOS_SEPARACION,
                }
            resultado_img = construir_imagen_danos(
                tipo, orden.danos_visibles, VISTAS_POR_TIPO.get(tipo, []), **kwargs_tamano
            )
            if resultado_img:
                ruta_imagen_danos, ancho_pt, alto_pt = resultado_img
                if sheet_name == SHEET_COM:
                    bl, bt, bw, bh = CORRECCION_COM_DANOS_BANDA
                    il, it = CORRECCION_COM_DANOS_IMG_POS
                else:
                    bl, bt, bw, bh = CORRECCION_CCA_DANOS_BANDA
                    il, it = CORRECCION_CCA_DANOS_IMG_POS
                banda = ws.Shapes.AddShape(1, bl, bt, bw, bh)  # 1 = msoShapeRectangle
                banda.Fill.ForeColor.RGB = 0xFFFFFF
                banda.Line.Visible = False
                ws.Shapes.AddPicture(
                    ruta_imagen_danos, LinkToFile=False, SaveWithDocument=True,
                    Left=il, Top=it, Width=ancho_pt, Height=alto_pt,
                )

        # Equipo recibido apagado: el checklist técnico de entrada no se
        # pudo verificar de verdad (no hay forma de probar WiFi, cámara,
        # teclado, etc. sin encenderlo) — se marca esa zona completa con
        # una "X" grande en rojo para que no quede en blanco sin ninguna
        # indicación, en vez de que parezca que simplemente no se llenó.
        # El texto ("EQUIPO RECIBIDO APAGADO...") va aparte, en
        # "Detalles de servicio" (ver orden_excel.py:_detalles_servicio_completos).
        if orden.equipo_apagado_recepcion:
            zona = CORRECCION_COM_CHECKLIST_ENTRADA if sheet_name == SHEET_COM else CORRECCION_CCA_CHECKLIST_ENTRADA
            _marcar_zona_x_roja(ws, *zona)

        if posicion_encendido and sheet_name == SHEET_COM:
            # ENCIENDE OK/SIN IMAGEN/CON FALLA/NO ENCIENDE: acá no hay
            # ninguna forma existente que marcar (es imagen fija) — se
            # dibuja una "X" nueva, sin relleno, justo encima del
            # cuadrito rosado correspondiente. Antes de dibujarla se
            # calibra la escala vertical REAL de esta hoja en este
            # momento (exporta un PDF de más, se borra apenas se mide) —
            # ver _calibrar_escala_y() y el aviso largo junto a
            # CASILLAS_ENCENDIDO_COM_PDF más arriba.
            #
            # Solo COM por ahora: en la plantilla CCA esta marca queda
            # mal ubicada (aparece en la fila equivocada) y no se pudo
            # encontrar de dónde sale la diferencia — se decidió no
            # arriesgar a marcar la casilla incorrecta en el papel real.
            # El estado de encendido en CCA se sigue viendo como texto
            # en "Detalles de servicio", igual que antes.
            ruta_calib = os.path.join(tempfile.gettempdir(), f"calib_{uuid.uuid4().hex[:8]}.pdf")
            calibracion = _calibrar_escala_y(ws, sheet_name, ruta_calib)
            coords = (
                _coords_nativas_encendido(sheet_name, posicion_encendido, *calibracion)
                if calibracion else None
            )
            if coords:
                left, top, ancho, alto = coords
                marca = ws.Shapes.AddShape(1, left, top, ancho, alto)  # 1 = msoShapeRectangle
                marca.Fill.Visible = False  # sin relleno: no tapa el cuadrito rosado de fábrica
                marca.Line.Visible = False
                marca.TextFrame2.TextRange.Text = "X"
                marca.TextFrame2.TextRange.Font.Bold = True
                marca.TextFrame2.TextRange.Font.Fill.ForeColor.RGB = 0
                marca.TextFrame2.TextRange.Font.Size = TAMANO_LETRA_CASILLA
                marca.TextFrame2.VerticalAnchor = 3  # msoAnchorMiddle
                marca.TextFrame2.HorizontalAnchor = 2  # msoAnchorCenter

        ws.ExportAsFixedFormat(XL_TYPE_PDF, ruta_pdf)
    except Exception as exc:
        return JsonResponse({"detail": f"No se pudo generar el PDF de la orden: {exc}"}, status=500)
    finally:
        if wb is not None:
            wb.Close(False)
        if excel is not None:
            excel.Quit()
        pythoncom.CoUninitialize()
        if ruta_imagen_danos and os.path.exists(ruta_imagen_danos):
            os.remove(ruta_imagen_danos)

    if not os.path.exists(ruta_pdf):
        return JsonResponse({"detail": "No se pudo generar el PDF de la orden."}, status=500)

    with open(ruta_pdf, "rb") as f:
        contenido = f.read()
    os.remove(ruta_pdf)

    nombre = f"Orden_{orden.numero}"
    response = HttpResponse(contenido, content_type="application/pdf")
    response["Content-Disposition"] = f'inline; filename="{nombre}.pdf"'
    return response
