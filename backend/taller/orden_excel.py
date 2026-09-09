"""Calcula qué celdas llenar en la Orden de Recepción y Trabajo real del
jefe (ver taller/plantillas_excel/orden_com.xlsx y orden_cca.xlsx —
plantillas reales, una por tipo de equipo) a partir de los datos de una
OrdenTaller.

Importante: este módulo NO abre el .xlsx con openpyxl. La plantilla
trae al menos una imagen en formato WMF (metaarchivo viejo de Windows)
que openpyxl no soporta — al cargarla y volver a guardarla con openpyxl,
esa imagen se pierde y Excel la reemplaza por un recuadro roto al
exportar a PDF (se confirmó viendo el PDF resultante). Por eso acá solo
se calculan los VALORES a escribir; quien realmente escribe en el
archivo es taller/orden_pdf_excel.py, abriendo la plantilla con
win32com (el motor real de Excel, que si sabe leer WMF) y escribiendo
directo sobre esa sesión — la plantilla en disco nunca se toca ni se
resguarda con los datos de una orden.

Regla de oro (igual que caja_chica/arqueo_excel.py y
compras/cotizacion_cliente_excel.py): acá solo se llenan las celdas que
en la plantilla real son datos escritos a mano — todo lo demás
(cláusulas legales, colores, recuadros, logos) es diseño fijo del jefe y
nunca se toca.

Aviso importante — hay secciones de la plantilla que NO son celdas de
Excel editables: el checklist de entrada/salida y "Cómo supo de
nosotros"/"¿Primera vez que nos visita?" están armados como IMÁGENES
fijas (así las diseñó el jefe), no como celdas. Ni siquiera en el
proceso manual actual se llenan por Excel — se imprimen en blanco y se
marcan a mano con lapicero sobre el papel impreso, igual que en las
órdenes ya llenadas que mandó de ejemplo. Por eso esas secciones salen
en blanco en el PDF generado acá también — es el mismo comportamiento
que tiene el archivo original del jefe.

El recuadro "ENCIENDE OK / SIN IMAGEN / CON FALLA / NO ENCIENDE" es
igual de fijo (imagen del ENCABEZADO de página, PageSetup.CenterHeader
con código "&G", no una imagen normal de la hoja) — pero en la
plantilla COM sí se puede marcar encima: taller/orden_pdf_excel.py
dibuja una "X" nueva justo sobre el cuadrito rosado correspondiente
(ver POSICION_ENCENDIDO abajo). En CCA no se logró ubicar esa "X" con
precisión, así que ahí el estado de encendido se sigue imprimiendo como
TEXTO en "Detalles de servicio" en vez de perderse.

Los íconos decorativos de "Daños visibles" que trae la plantilla de
fábrica son igual de fijos — y son la imagen del ENCABEZADO de página
(mismo truco del "&G" de arriba), así que tampoco se pueden marcar
encima ni ocultar como una forma cualquiera. La solución (ver
orden_danos_img.py y orden_pdf_excel.py): tapar esa zona con un
rectángulo blanco y poner ENCIMA una imagen nueva, generada al vuelo,
con la MISMA silueta que el widget de la pantalla (DanosVisibles.jsx) y
las mismas marcas que el técnico puso — nunca se modifica el encabezado
real de la plantilla, solo se dibuja por encima en la sesión de Excel
de esa exportación puntual.
"""
import os
import re

TEMPLATE_COM = os.path.join(os.path.dirname(__file__), "plantillas_excel", "orden_com.xlsx")
TEMPLATE_CCA = os.path.join(os.path.dirname(__file__), "plantillas_excel", "orden_cca.xlsx")
SHEET_COM = "ORDEN DE TRABAJO (3) ((( OK )))"
SHEET_CCA = "ORDEN DE TRABAJO (4) OK"

# Texto EXACTO que ya trae cada plantilla en esa celda — se necesita tal
# cual para poder insertarle una "X" dentro del paréntesis correcto sin
# tocar el resto. Si el jefe llega a cambiar el texto de estas celdas en
# la plantilla, esta copia hay que actualizarla junto con ella (ver
# aviso arriba).
TXT_EMPRESA_COM = "EMPRESA:    SI (   )         NO (   )"
TXT_SOFTWARE_COM = "LA EMPRESA MODIFICA O CONTROLA EL SOFTWARE::   SI (   )         NO (   )             "
TXT_ENTREGA_COM = "Fecha y hora de entrega:__________________________/____________________________"
TXT_RECIBE_COM = "Recibe / Técn. / Entrega: _________________/___________________/_________________"

TXT_EMPRESA_CCA = "Empresa:    SI (   )        NO (   )"
TXT_SOFTWARE_CCA = "La empresa realiza modificaciones de software:   SI (   )         NO (   )"
TXT_ENTREGA_CCA = "Fecha y hora de entrega: __________________//_________________"
TXT_RECIBE_CCA = "Recibe / Técn. / Entrega.: ____________/_____________/____________"

# J20/I20 (COM/CCA, "BAT. ORIG. (SI/NO)") y J21 (COM, "COMPRADO NUEVO")
# NO traen el patrón "SI (   ) NO (   )" que sí tienen EMPRESA/SOFTWARE
# arriba — se comprobó abriendo la plantilla real: J20 trae pegado un
# texto de ayuda sin relación ("Estado: Bueno, malo, regular") y J21 trae
# "SI       /       NO" sin paréntesis, así que _marcar_si_no() nunca
# encontraba nada que reemplazar ahí y la celda quedaba tal cual venía,
# sin ninguna marca. Por eso estos tres van directo con Sí/No en vez de
# con _marcar_si_no().

# Nombre de la forma "DAÑOS VISIBLES" en la plantilla COM — ahí se
# escriben los daños marcados en el diagrama digital, en vez de en
# "Detalles de servicio". La plantilla CCA no trae una caja equivalente,
# así que ahí los daños se quedan en "Detalles de servicio".
NOMBRE_FORMA_DANOS_COM = "Rounded Rectangle 113"

# --- Casillas (Claro / Tigo / Whatsapp) del cliente ---
# Son formas rectangulares vacías (checkboxes reales) que ya trae la
# plantilla al lado de "No. Tel:"/"No. Celular:" — se marcan poniéndoles
# una "X" adentro, igual que cualquier otra forma con texto.
CASILLA_CLARO_COM = "Rectangle 3"
CASILLA_TIGO_COM = "Rectangle 124"
CASILLA_WHATSAPP_COM = "Rectangle 125"
CASILLA_CLARO_CCA = "Rectangle 66"
CASILLA_TIGO_CCA = "Rectangle 1"
CASILLA_WHATSAPP_CCA = "Rectangle 2"

# Insignia verde "BITLOCKER" del encabezado — es una forma real (se
# puede editar), a diferencia del recuadro "BIT LOCKER ACTIVO SI/NO" de
# más arriba, que sí es parte de la imagen decorativa fija del
# encabezado de página y no se puede marcar. Por eso el estado de
# BitLocker se refleja acá, en esta insignia, en vez de ahí.
NOMBRE_FORMA_BITLOCKER_COM = "Rounded Rectangle 16"

# TÉCNICO (sección "2.- DETALLES DE RECEPCIÓN"): la plantilla COM pone
# un recuadro celeste (forma, no celda) ENCIMA de L15 — se comprobó
# generando el PDF con el sistema real: el nombre del técnico se
# escribía en la celda pero salía invisible, tapado por esa forma
# (mismo problema que SERVICIO/VALOR/CONTRASEÑA/etc., ver más abajo). La
# plantilla CCA no tiene este problema: su celda equivalente (I16) sí es
# escribible directamente.
NOMBRE_FORMA_TECNICO2_COM = "Rounded Rectangle 122"

# ENCIENDE OK / SIN IMAGEN / CON FALLA / NO ENCIENDE: el jefe pidió que
# esto sean casillas reales que se puedan rellenar. El recuadro completo
# (etiquetas + los 4 cuadritos rosados) es parte de la imagen fija de la
# plantilla — no hay ninguna celda ni forma real ahí para escribirle
# encima. La solución: dibujar una forma nueva (una "X"), del tamaño del
# cuadrito rosado correspondiente, EXACTAMENTE en su posición — se
# comprobó con varias pruebas de calibración (una forma de prueba,
# exportar a PDF, medir con PyMuPDF dónde cae en puntos reales, ajustar)
# hasta que la "X" cae justo adentro del cuadrito rosado. Ver el uso de
# estas coordenadas en orden_pdf_excel.py — son nativas de cada
# plantilla, no de puntos de PDF.
POSICION_ENCENDIDO = {
    "ENCIENDE_OK": "OK",
    "ENCIENDE_SIN_IMAGEN": "SIN_IMAGEN",
    "ENCIENDE_CON_FALLA": "CON_FALLA",
    "NO_ENCIENDE": "NO_ENCIENDE",
}

# "¿Cómo supo de nosotros?" y "¿Primera vez que nos visita?": el sistema
# YA recoge estos dos datos (orden.como_supo y detalle.primera_vez, ver
# NuevaOrden.jsx) pero nunca se imprimían — se comprobó que ninguna de
# las dos casillas de la plantilla es una celda ni una forma normal, son
# parte de UNA SOLA imagen ("Picture 128" en COM / "Picture 108" en CCA)
# con los 12 cuadritos de "cómo supo" + el "SI ( ) NO ( )" de "primera
# vez" todos dibujados adentro. A diferencia del recuadro de ENCIENDE
# (que sí está pegado al encabezado "&G" de la página y por eso necesita
# calibración en cada generación), ESTA imagen es una forma normal de la
# hoja con Left/Top/Width/Height reales y estables — así que la posición
# de cada casilla se calcula como una FRACCIÓN fija del ancho/alto de
# esa forma (medida una sola vez recortando el PDF exportado y ubicando
# los cuadritos celestes por color), sin necesitar calibración en cada
# PDF: nativo = forma.Left/.Top + fracción * forma.Width/.Height.
NOMBRE_IMAGEN_COMO_SUPO_COM = "Picture 128"
NOMBRE_IMAGEN_COMO_SUPO_CCA = "Picture 108"

# (fracción_x, fracción_y) del centro de cada cuadrito, relativo a la
# imagen completa — el layout (2 columnas de 6 opciones) es igual en
# las dos plantillas, pero las imágenes NO miden exactamente lo mismo
# (Picture 128 en COM es más ancha/ alta que Picture 108 en CCA), así
# que las fracciones salen un poco distintas — cada una se midió por
# separado ubicando los cuadritos celestes por color en su propio PDF
# exportado. Valores de orden.como_supo tal como los guarda
# NuevaOrden.jsx (COMO_SUPO_VALUES).
COMO_SUPO_FRACCION_COM = {
    "FACEBOOK": (0.371, 0.203), "INSTAGRAM": (0.371, 0.317), "TIKTOK": (0.371, 0.431),
    "LINKEDIN": (0.371, 0.546), "SMS": (0.371, 0.660), "RADIO": (0.371, 0.774),
    "EMAIL": (0.929, 0.203), "REFERIDO": (0.929, 0.317), "MANTA_ROTULO": (0.929, 0.431),
    "GOOGLE": (0.929, 0.546), "RECURRENTE": (0.929, 0.660), "OTRO": (0.929, 0.774),
}
COMO_SUPO_FRACCION_CCA = {
    "FACEBOOK": (0.361, 0.225), "INSTAGRAM": (0.361, 0.342), "TIKTOK": (0.361, 0.462),
    "LINKEDIN": (0.361, 0.578), "SMS": (0.361, 0.699), "RADIO": (0.361, 0.815),
    "EMAIL": (0.930, 0.225), "REFERIDO": (0.930, 0.342), "MANTA_ROTULO": (0.930, 0.462),
    "GOOGLE": (0.930, 0.578), "RECURRENTE": (0.930, 0.699), "OTRO": (0.930, 0.815),
}

# "Primera vez que nos visita? SI ( )  NO ( )" — mismo truco, el hueco
# entre paréntesis. Solo existe para COM: "primera_vez" vive en
# DetalleComputadora, no hay un campo equivalente para celulares (ver
# aviso en orden_cca_operaciones).
PRIMERA_VEZ_FRACCION_COM = {True: (0.778, 0.911), False: (0.960, 0.911)}


def _marcas_como_supo_y_primera_vez(nombre_imagen, mapa_como_supo, como_supo, mapa_primera_vez, primera_vez):
    """Arma la lista de "marcas libres" (ver orden_pdf_excel.py) para
    "Cómo supo de nosotros" y "Primera vez que nos visita", ambas
    dibujadas sobre la MISMA imagen de fondo — devuelve
    [(nombre_imagen, fracción_x, fracción_y), ...]."""
    marcas = []
    frac = mapa_como_supo.get(como_supo)
    if frac:
        marcas.append((nombre_imagen, frac[0], frac[1]))
    if primera_vez is not None and mapa_primera_vez:
        fx, fy = mapa_primera_vez[primera_vez]
        marcas.append((nombre_imagen, fx, fy))
    return marcas


def tipo_orden(orden):
    return "CCA" if orden.categoria_equipo in ("CELULAR", "TABLET") else "COM"


# Vistas disponibles por tipo de equipo — mismo diccionario que
# frontend/src/components/orden/DanosVisibles.jsx (VISTAS_POR_TIPO), para
# que la imagen armada en orden_danos_img.py dibuje exactamente las
# mismas siluetas/vistas que el técnico vio y usó al marcar los daños en
# pantalla.
VISTAS_POR_TIPO = {
    "CCA": ["FRENTE", "ATRAS"],
    "COM": ["FRENTE", "ATRAS", "LATERAL_IZQ", "LATERAL_DER"],
}


def _casillas_operadora_whatsapp(cliente, nombre_claro, nombre_tigo, nombre_whatsapp):
    """Devuelve la lista de nombres de forma que hay que marcar según la
    operadora (Claro/Tigo) y el WhatsApp del cliente."""
    marcar = []
    operadora = getattr(cliente, "operadora", None) if cliente else None
    if operadora == "CLARO":
        marcar.append(nombre_claro)
    elif operadora == "TIGO":
        marcar.append(nombre_tigo)
    if cliente and cliente.whatsapp:
        marcar.append(nombre_whatsapp)
    return marcar

TIPO_SERVICIO_LABELS = {
    "DIAGNOSTICO": "Diagnóstico", "MANTENIMIENTO_BASICO": "Mantenimiento básico",
    "MANTENIMIENTO_PREVENTIVO": "Mantenimiento preventivo", "MANTENIMIENTO_FULL": "Mantenimiento full",
    "REPARACION": "Reparación", "REPARACION_BISAGRA": "Reparación de bisagra",
    "CONFIGURACION": "Configuración", "DESBLOQUEO": "Desbloqueo", "FLASHEO": "Flasheo",
    "REINGRESO": "Reingreso", "OTRO": "Otro",
}


def _texto_respaldo(valor):
    """"Respaldo?   SI   /   NO" (celda K25 de COM) — el sistema ya
    recoge este dato (detalle.respaldo_solicitado) pero nunca se
    imprimía. A diferencia de EMPRESA/SOFTWARE, esta celda NO trae un
    patrón "SI (   ) NO (   )" con paréntesis para insertarle una "X"
    (se comprobó abriendo la plantilla real) — la pregunta y las dos
    opciones vienen todas pegadas en un solo texto. Se reemplaza el
    texto completo dejando solo la respuesta real, mismo criterio que
    ya se usa para BAT. ORIG./COMPRADO NUEVO/RECEPTOR MOUSE."""
    if valor is None:
        return None
    return f"Respaldo?   {'SÍ' if valor else 'NO'}"


def _si_no(valor):
    if valor is True:
        return "Sí"
    if valor is False:
        return "No"
    return None


def _marcar_si_no(texto_base, valor):
    """Inserta una 'X' dentro del paréntesis SI( )/NO( ) que ya trae la
    plantilla en `texto_base`, sin tocar el resto — ej. 'EMPRESA:  SI
    (   )   NO (   )' -> 'EMPRESA:  SI (   )   NO ( X )'. Devuelve None
    si no hay valor (deja la celda tal cual trae la plantilla)."""
    if valor is None:
        return None
    patron = r"SI\s*\(\s*\)" if valor else r"NO\s*\(\s*\)"
    reemplazo = "SI ( X )" if valor else "NO ( X )"
    return re.sub(patron, reemplazo, texto_base, count=1)


def _llenar_blancos(texto_base, valores):
    """Reemplaza, en orden, cada tramo de guiones bajos de `texto_base`
    por el siguiente valor de `valores` — un valor vacío deja ese tramo
    tal cual (sigue en blanco para llenarse a mano)."""
    it = iter(valores)

    def repl(m):
        v = next(it, None)
        return v if v else m.group(0)

    return re.sub(r"_{3,}", repl, texto_base)


def _fecha_hora(dt):
    if not dt:
        return None
    return dt.strftime("%d/%m/%Y  %I:%M %p")


def _fecha(d):
    if not d:
        return None
    return d.strftime("%d/%m/%Y")


# Ancho real (en puntos) de cada celda combinada donde puede ir texto
# largo — se necesita para calcular cuántas líneas hacen falta y así
# poder darle a la fila el alto justo. Range.Rows.AutoFit() de Excel NO
# calcula bien el alto de celdas COMBINADAS (es un problema conocido de
# Excel, no algo específico de esta plantilla): se probó y en vez de
# agrandar la fila para que quepa el texto, la achica — se comprobó
# imprimiendo el resultado y viendo el texto cortado a media oración.
ANCHO_TEXTO_COM = 670.2  # C44:K44 y C47:K47
ANCHO_TEXTO_CCA = 597.6  # C45:M45 y C47:M47


def _alto_para_texto(texto, ancho_celda, font_size=10.0, alto_minimo=21.0):
    """Estima cuántas líneas necesita `texto` al envolverse dentro de una
    celda de `ancho_celda` puntos de ancho, y devuelve el alto de fila
    (en puntos) que le corresponde — con margen de sobra a propósito
    (mejor una fila un poco más alta de lo necesario, que "Ajustar a 1
    página" igual compensa, a que le falte y corte el texto)."""
    if not texto:
        return alto_minimo
    # ~0.52 * tamaño de letra por carácter es una estimación conservadora
    # para Arial (mezcla de mayúsculas/minúsculas) — de sobra antes que
    # justa, para no subestimar cuántas líneas hacen falta.
    caracteres_por_linea = max(10, int(ancho_celda / (font_size * 0.52)))
    lineas = max(1, -(-len(texto) // caracteres_por_linea))  # división hacia arriba
    alto_por_linea = font_size * 1.35
    return max(alto_minimo, lineas * alto_por_linea + 6)


def _tipos_servicio_txt(orden):
    # orden.tipo_servicio (singular) quedó de una versión vieja del
    # formulario — el campo real que llena hoy NuevaOrden.jsx es
    # tipos_servicio (plural, lista). Mismo bug ya corregido antes en
    # pdf_orden.py._tipos_servicio_txt.
    partes = []
    for s in (orden.tipos_servicio or []):
        if s == "OTRO" and orden.tipos_servicio_otro:
            partes.append(orden.tipos_servicio_otro)
        else:
            partes.append(TIPO_SERVICIO_LABELS.get(s, s))
    if partes:
        return " · ".join(partes)
    return TIPO_SERVICIO_LABELS.get(orden.tipo_servicio) if orden.tipo_servicio else None


ETIQUETA_VISTA = {"FRENTE": "Frente", "ATRAS": "Atrás", "LATERAL_IZQ": "Lateral izq.", "LATERAL_DER": "Lateral der."}


def _danos_visibles_txt(orden):
    """Texto de los daños que el técnico marcó en el diagrama digital
    (orden.danos_visibles: [{x, y, vista, nota}]) — además del DIBUJO
    (ver orden_danos_img.py/orden_pdf_excel.py, que muestra EN DÓNDE se
    marcó cada punto sobre la silueta del equipo), la nota de cada punto
    se imprime también como texto acá (se agrega a "Detalles de
    servicio") para que la descripción no dependa de leerla en la
    imagen — nunca se pierde, ni siquiera las marcas sin nota (el
    técnico a veces solo marca el punto sin escribir descripción)."""
    puntos = orden.danos_visibles or []
    if not puntos:
        return None
    por_vista = {}
    for p in puntos:
        vista = ETIQUETA_VISTA.get(p.get("vista"), p.get("vista") or "?")
        nota = (p.get("nota") or "").strip() or "marca sin descripción"
        por_vista.setdefault(vista, []).append(nota)
    partes = [f"{vista}: {'; '.join(notas)}" for vista, notas in por_vista.items()]
    return "Daños visibles — " + " · ".join(partes)


def _nombre_corto(nombre_completo):
    """Inicial + un apellido — el recuadro de TÉCNICO de la plantilla es
    angosto (pensado para un nombre corto tipo 'manolo'), un nombre
    completo largo se corta visualmente."""
    palabras = (nombre_completo or "").strip().split()
    if not palabras:
        return None
    if len(palabras) == 1:
        return palabras[0]
    inicial = palabras[0][0].upper() + "."
    apellido = palabras[-2] if len(palabras) >= 3 else palabras[-1]
    return f"{inicial} {apellido}"


def _dos_slots(items):
    """La plantilla solo trae 2 casillas para accesorios (1.- y 2.-) — si
    hay más de 2, se juntan el resto dentro de la segunda casilla en vez
    de perderlos."""
    if not items:
        return None, None
    if len(items) == 1:
        return items[0], None
    return items[0], ", ".join(items[1:])


def _accesorios_com(detalle):
    items = [a.get("nombre", "").strip() for a in ((detalle.accesorios_detalle if detalle else None) or []) if a.get("nombre", "").strip()]
    return _dos_slots(items)


def _accesorios_cca(orden):
    items = [a.strip() for a in (orden.accesorios or "").split(",") if a.strip()]
    return _dos_slots(items)


ENCENDIDO_LABELS = {
    "ENCIENDE_OK": "Enciende OK", "ENCIENDE_CON_FALLA": "Enciende con falla",
    "ENCIENDE_SIN_IMAGEN": "Enciende pero sin imagen", "NO_ENCIENDE": "No enciende",
}


def _factura_numero(orden):
    # orden.origen_venta (si existe) es un DetalleFactura — de ahí sale la
    # factura real vinculada a esta orden. La mayoría de órdenes no tienen
    # una venta de origen, así que esto casi siempre da None y no pasa nada.
    ov = getattr(orden, "origen_venta", None)
    if not ov:
        return None
    factura = getattr(ov, "factura", None)
    return getattr(factura, "numero", None) if factura else None


def _valores_comunes(orden, cliente):
    simbolo = "C$" if orden.moneda == "NIO" else "$"
    return {
        "tecnico": _nombre_corto(orden.tecnico.nombre) if orden.tecnico_id else None,
        "numero": (orden.numero or "").replace("-", " "),
        "cliente": cliente.nombre if cliente else None,
        "cedula": getattr(cliente, "cedula", None) if cliente else None,
        "fecha_recp": _fecha_hora(orden.fecha_hora_recepcion),
        "email": getattr(cliente, "email", None) if cliente else None,
        "ruc": getattr(cliente, "documento", None) if cliente else None,
        "telefono": cliente.telefono if cliente else None,
        "servicio": _tipos_servicio_txt(orden),
        "valor": f"{simbolo}{orden.costo_estimado}" if orden.costo_estimado else None,
        "adelanto": f"{simbolo}{orden.adelanto}" if getattr(orden, "adelanto", None) else None,
        "fact_recibo": _factura_numero(orden),
        "marca_modelo": " ".join(filter(None, [orden.marca, orden.modelo])) or None,
        # Color + capacidad juntos porque la plantilla solo trae un campo
        # "COLOR EQUIPO" — no hay una celda aparte para capacidad.
        "color": " · ".join(filter(None, [orden.color, orden.capacidad])) or None,
        "estado_general": orden.get_estado_general_display() if orden.estado_general else None,
        "bateria_original": _si_no(orden.bateria_original),
        "contrasena": "Sin contraseña" if orden.sin_contrasena else (orden.contrasena_equipo or None),
        "falla_reportada": orden.problema_reportado or None,
        "instrucciones_asesor": orden.instrucciones_asesor or None,
        # Los daños van en el recuadro "DAÑOS VISIBLES" para COM (tiene su
        # propia caja de texto ahí — ver orden_com_operaciones) y acá para
        # CCA (esa plantilla no trae una caja equivalente donde ponerlos).
        "detalles_servicio": _detalles_servicio_completos(orden, incluir_danos=True),
        "detalles_servicio_sin_danos": _detalles_servicio_completos(orden, incluir_danos=False),
        "fecha_entrega": _fecha(orden.fecha_entrega_real or orden.fecha_entrega_estimada),
        "recibe": orden.recibe or None,
        "asesor": orden.asesor.nombre if orden.asesor_id else None,
    }


def _detalles_servicio_completos(orden, incluir_danos=True):
    """"Detalles de servicio" solo tiene UNA celda en la plantilla, pero
    en el sistema hay hasta 3 campos distintos que pueden traer
    información (diagnóstico, comentarios, recomendaciones) — antes solo
    se usaba el primero que no estuviera vacío y los otros dos se
    perdían. Ahora se juntan todos, cada uno con su etiqueta, para que
    nada de lo que se llenó en el sistema se quede sin imprimir.

    También se agrega acá el estado de encendido: el recuadro "ENCIENDE
    OK / SIN IMAGEN / CON FALLA / NO ENCIENDE" de la plantilla es una
    IMAGEN fija (se confirmó viendo que esas 4 celdas no traen texto real,
    solo la imagen "Picture 28"/"Picture 20" encima) — no se puede marcar
    ahí. En vez de perderse, se imprime como texto acá.

    Va primero "instrucciones_asesor" (lo que el asesor le pide al
    técnico) — el jefe pidió que quede junto a la falla reportada, y
    como la plantilla no trae una celda propia para eso, se agrega acá al
    frente, bien etiquetado, para que el técnico lo vea de una vez."""
    partes = []
    if orden.equipo_apagado_recepcion:
        partes.append("EQUIPO RECIBIDO APAGADO: no se pudo verificar el checklist técnico de entrada (marcado con X en rojo)")
    if orden.instrucciones_asesor:
        partes.append(f"Instrucciones del asesor: {orden.instrucciones_asesor}")
    if orden.encendido:
        partes.append(f"Encendido: {ENCENDIDO_LABELS.get(orden.encendido, orden.encendido)}")
    if orden.diagnostico:
        partes.append(f"Diagnóstico: {orden.diagnostico}")
    if orden.comentarios:
        partes.append(f"Comentarios: {orden.comentarios}")
    if orden.recomendaciones:
        partes.append(f"Recomendaciones: {orden.recomendaciones}")
    texto = "  //  ".join(partes) or None
    if incluir_danos:
        danos = _danos_visibles_txt(orden)
        if danos:
            texto = f"{texto}  ///  {danos}" if texto else danos
    return texto


def _recibe_tecnico_entrega_asesor(v):
    """Reemplaza toda la línea "Recibe / Técn. / Entrega:____/____/____"
    por un formato que solo muestra lo que realmente se llenó — el
    formato original de la plantilla (3 rayas fijas) se ve mal a medio
    llenar (ej. "____/M. OBANDO/____", con dos tercios en blanco). De
    paso se agrega el Asesor, que el jefe pidió y la plantilla no traía.
    Si no hay nada que mostrar, devuelve None y se deja la línea de la
    plantilla tal cual (para llenarse a mano)."""
    if not (v["recibe"] or v["tecnico"] or v["asesor"]):
        return None
    partes = []
    if v["recibe"]:
        partes.append(f"Recibe: {v['recibe']}")
    if v["tecnico"]:
        partes.append(f"Técn.: {v['tecnico']}")
    if v["asesor"]:
        partes.append(f"Asesor: {v['asesor']}")
    return "Recibe / Técn. / Entrega:   " + "   ·   ".join(partes)


def orden_com_operaciones(orden, cliente=None, empresa_nombre=None):
    """Devuelve (hoja, [(celda, valor), ...], [(celda, alto_fila), ...],
    [(nombre_de_forma, valor), ...], [nombre_de_forma_a_marcar, ...],
    posicion_encendido) para llenar taller/plantillas_excel/orden_com.xlsx
    vía COM."""
    cliente = cliente or orden.cliente
    detalle = getattr(orden, "detalle_com", None)
    v = _valores_comunes(orden, cliente)
    acc1, acc2 = _accesorios_com(detalle)
    empresa = bool((cliente.empresa_id if cliente else None) or empresa_nombre)
    posicion_encendido = POSICION_ENCENDIDO.get(orden.encendido)

    ops = []
    shapes = []
    casillas = []

    def w(cell, value):
        if value not in (None, ""):
            ops.append((cell, value))

    def s(nombre_forma, value):
        if value not in (None, ""):
            shapes.append((nombre_forma, value))

    w("N2", v["tecnico"])
    w("N4", v["numero"])
    w("C7", f"Cliente: {v['cliente']}" if v["cliente"] else None)
    w("I7", f"ID: {v['cedula']}" if v["cedula"] else None)
    w("L7", f" F/hora recp:  {v['fecha_recp']}" if v["fecha_recp"] else None)
    w("C8", _marcar_si_no(TXT_EMPRESA_COM, empresa))
    w("F8", f" E-mail: {v['email']}" if v["email"] else None)
    w("L8", f" RUC: {v['ruc']}" if v["ruc"] else None)
    w("C9", _marcar_si_no(TXT_SOFTWARE_COM, detalle.empresa_controla_software if detalle else None))
    w("L9", f" No. Tel: {v['telefono']}" if v["telefono"] else None)
    casillas.extend(_casillas_operadora_whatsapp(cliente, CASILLA_CLARO_COM, CASILLA_TIGO_COM, CASILLA_WHATSAPP_COM))

    # BITLOCKER: el recuadro "BIT LOCKER ACTIVO SI/NO" de la plantilla es
    # parte de la imagen decorativa fija del encabezado (no se puede
    # marcar), pero la insignia verde "BITLOCKER" de al lado SÍ es una
    # forma real editable — ahí se refleja el estado en vez de perderlo.
    if detalle and detalle.bitlocker_activo is not None:
        s(NOMBRE_FORMA_BITLOCKER_COM, "BITLOCKER: " + _si_no(detalle.bitlocker_activo).upper())

    # SERVICIO / VALOR / ADELANTO / FACT.RECIBO NO van sobre una FORMA
    # (un rectángulo redondeado de color) que la plantilla del jefe pone
    # ENCIMA de estas celdas — escribir en la celda quedaba invisible,
    # tapado por la forma (se comprobó comparando el PDF exportado). El
    # texto tiene que ir directo en la forma, ver orden_pdf_excel.py.
    s("Rounded Rectangle 2", v["servicio"])
    s("Rounded Rectangle 7", v["valor"])
    s("Rounded Rectangle 8", v["adelanto"])
    s("Rounded Rectangle 9", v["fact_recibo"])

    s(NOMBRE_FORMA_TECNICO2_COM, v["tecnico"])
    # N15 ya trae la fórmula "=+N4", no se toca.

    w("D17", orden.equipo)
    w("J17", v["estado_general"])
    # Los técnicos ya escriben todo junto en estos campos (ej. ram_tipo =
    # "32 GB DE RAM / DDR5") — se ponen tal cual, sin reformatear encima.
    w("N17", detalle.ram_tipo if detalle else None)
    # MARCA y MODELO son celdas SEPARADAS en esta plantilla (D18/D19, cada
    # una con su propia etiqueta) — antes se combinaban las dos en D18 y
    # D19 se dejaba en blanco, así que el modelo nunca aparecía impreso.
    w("D18", orden.marca or None)
    w("D19", orden.modelo or None)
    if detalle:
        w("N18", " / ".join(filter(None, [detalle.ram_frecuencia, detalle.ram_slots])) or None)
        w("N19", " / ".join(filter(None, [detalle.disco_capacidad, detalle.tipo_almacenamiento])) or None)
    w("D20", detalle.procesador_generacion if detalle else None)
    w("J20", _si_no(orden.bateria_original))
    w("N20", detalle.marca_disco if detalle else None)
    w("D21", v["color"])
    w("J21", _si_no(detalle.comprado_nuevo if detalle else None))
    w("N21", detalle.serial_disco if detalle else None)
    w("D22", orden.no_serie)
    w("J22", _si_no(detalle.trae_receptor_mouse if detalle else None))
    w("N22", detalle.tipo_conector if detalle else None)

    w("E24", acc1)
    w("H24", acc2)
    w("K25", _texto_respaldo(detalle.respaldo_solicitado if detalle else None))

    # CONTRASEÑA: misma historia — "Rounded Rectangle 13" tapa la celda C33.
    s("Rounded Rectangle 13", v["contrasena"])

    # DAÑOS VISIBLES: el jefe pidió que los daños salgan reflejados en la
    # FIGURA del equipo, igual que en el diagrama que el técnico llena en
    # pantalla (DanosVisibles.jsx) — no como texto suelto. Esa imagen (la
    # silueta con las "X" marcadas en el mismo lugar donde se marcaron en
    # el sistema) se arma e inserta aparte, en orden_pdf_excel.py, porque
    # necesita generar un PNG e insertarlo con Shapes.AddPicture — acá
    # solo se calculan los valores de celda. El texto de cada nota igual
    # se mantiene abajo en "Detalles de servicio" (ver
    # _detalles_servicio_completos) para que la descripción que escribió
    # el técnico no se pierda — el dibujo muestra EN DÓNDE, el texto dice
    # QUÉ.

    w("C44", v["falla_reportada"])
    w("C47", v["detalles_servicio"])

    entrega = _llenar_blancos(TXT_ENTREGA_COM, [v["fecha_entrega"]])
    if entrega != TXT_ENTREGA_COM:
        w("C59", entrega)
    w("C61", _recibe_tecnico_entrega_asesor(v))

    alturas = []
    if v["falla_reportada"]:
        alturas.append(("C44", _alto_para_texto(v["falla_reportada"], ANCHO_TEXTO_COM)))
    if v["detalles_servicio"]:
        alturas.append(("C47", _alto_para_texto(v["detalles_servicio"], ANCHO_TEXTO_COM)))

    marcas_libres = _marcas_como_supo_y_primera_vez(
        NOMBRE_IMAGEN_COMO_SUPO_COM, COMO_SUPO_FRACCION_COM, orden.como_supo,
        PRIMERA_VEZ_FRACCION_COM, detalle.primera_vez if detalle else None
    )
    return SHEET_COM, ops, alturas, shapes, casillas, posicion_encendido, marcas_libres


def orden_cca_operaciones(orden, cliente=None, empresa_nombre=None):
    """Devuelve (hoja, [(celda, valor), ...], [(celda, alto_fila), ...],
    [(nombre_de_forma, valor), ...], [nombre_de_forma_a_marcar, ...],
    posicion_encendido) para llenar taller/plantillas_excel/orden_cca.xlsx
    vía COM."""
    cliente = cliente or orden.cliente
    v = _valores_comunes(orden, cliente)
    acc1, acc2 = _accesorios_cca(orden)
    empresa = bool((cliente.empresa_id if cliente else None) or empresa_nombre)
    posicion_encendido = POSICION_ENCENDIDO.get(orden.encendido)

    ops = []
    shapes = []
    casillas = []

    def w(cell, value):
        if value not in (None, ""):
            ops.append((cell, value))

    def s(nombre_forma, value):
        if value not in (None, ""):
            shapes.append((nombre_forma, value))

    w("P2", v["tecnico"])
    w("P4", v["numero"])
    w("C7", f"Cliente: {v['cliente']}" if v["cliente"] else None)
    w("H7", f" ID:  {v['cedula']}" if v["cedula"] else None)
    w("N7", f" F/hora recp:  {v['fecha_recp']}" if v["fecha_recp"] else None)
    w("C8", _marcar_si_no(TXT_EMPRESA_CCA, empresa))
    w("F8", f" E-mail: {v['email']}" if v["email"] else None)
    w("N8", f" RUC: {v['ruc']}" if v["ruc"] else None)
    w("C9", _marcar_si_no(TXT_SOFTWARE_CCA, None))
    w("N9", f" No. Celular: {v['telefono']}" if v["telefono"] else None)
    w("E10", getattr(cliente, "direccion", None) if cliente else None)
    casillas.extend(_casillas_operadora_whatsapp(cliente, CASILLA_CLARO_CCA, CASILLA_TIGO_CCA, CASILLA_WHATSAPP_CCA))

    # Mismo caso que en COM: estas 4 celdas quedan tapadas por una forma
    # de color encima — el texto va directo en la forma.
    s("Rounded Rectangle 102", v["servicio"])
    s("Rounded Rectangle 103", v["valor"])
    s("Rounded Rectangle 104", v["adelanto"])
    s("Rounded Rectangle 105", v["fact_recibo"])

    w("I16", v["tecnico"])
    # P16 ya trae la fórmula "=+P4", no se toca.

    w("D18", orden.equipo)
    w("I18", v["estado_general"])
    w("D19", v["marca_modelo"])
    # No hay un campo explícito de single/dual SIM en el modelo — un
    # segundo IMEI es la señal más confiable de que el equipo es dual SIM.
    if orden.imei2:
        w("I19", "Dual SIM")
    elif orden.imei1:
        w("I19", "Single SIM")
    w("D20", v["color"])
    w("I20", _si_no(orden.bateria_original))
    imeis = " / ".join(filter(None, [f"IMEI1: {orden.imei1}" if orden.imei1 else None, f"IMEI2: {orden.imei2}" if orden.imei2 else None]))
    w("D21", imeis or None)

    w("E23", acc1)
    w("H23", acc2)

    s("Rounded Rectangle 113", v["contrasena"])

    w("C45", v["falla_reportada"])
    w("C47", v["detalles_servicio"])

    entrega = _llenar_blancos(TXT_ENTREGA_CCA, [v["fecha_entrega"]])
    if entrega != TXT_ENTREGA_CCA:
        w("C59", entrega)
    w("C61", _recibe_tecnico_entrega_asesor(v))

    alturas = []
    if v["falla_reportada"]:
        alturas.append(("C45", _alto_para_texto(v["falla_reportada"], ANCHO_TEXTO_CCA, alto_minimo=27.0)))
    if v["detalles_servicio"]:
        alturas.append(("C47", _alto_para_texto(v["detalles_servicio"], ANCHO_TEXTO_CCA, alto_minimo=27.0)))

    # CCA no tiene un campo de "primera vez" en el sistema (solo existe
    # en DetalleComputadora) — se marca únicamente "cómo supo de
    # nosotros" hasta que exista ese dato también para celulares.
    marcas_libres = _marcas_como_supo_y_primera_vez(
        NOMBRE_IMAGEN_COMO_SUPO_CCA, COMO_SUPO_FRACCION_CCA, orden.como_supo, None, None
    )
    return SHEET_CCA, ops, alturas, shapes, casillas, posicion_encendido, marcas_libres


def orden_operaciones(orden, cliente=None, empresa_nombre=None):
    es_cca = orden.categoria_equipo in ("CELULAR", "TABLET")
    template = TEMPLATE_CCA if es_cca else TEMPLATE_COM
    fn = orden_cca_operaciones if es_cca else orden_com_operaciones
    hoja, ops, alturas, shapes, casillas, posicion_encendido, marcas_libres = fn(orden, cliente, empresa_nombre)
    return template, hoja, ops, alturas, shapes, casillas, posicion_encendido, marcas_libres
