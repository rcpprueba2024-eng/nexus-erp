"""Uno-off: importa el histórico real de clientes/equipos/órdenes desde
"BASE DE DATOS 2026 05 JUNIO- SOLO MES - SIN PROTECCION.xlsx" (hoja
"JUNIO 2026", que a pesar del nombre es el historial COMPLETO 2020-2026,
no solo junio) hacia el sistema, ya limpio de datos de prueba (ver
limpiar_bd_dejar_solo_usuarios.py).

Uso:
    python importar_historico_junio2026.py            # solo reporta (dry-run)
    python importar_historico_junio2026.py --commit    # escribe de verdad

El dry-run es el modo por defecto A PROPÓSITO — corre primero sin
--commit para revisar el reporte (cuántos clientes/órdenes se crearían,
qué valores de estado/tipo de servicio/técnico no se pudieron mapear)
antes de tocar la base de datos real con información de clientes reales.

No se toca: usuarios, personal de RRHH, catálogos (Marca/Modelo/
Categoría), Configuración — todo lo que ya dejó en pie
limpiar_bd_dejar_solo_usuarios.py.
"""
import argparse
import os
import sys
import datetime

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

import openpyxl

RUTA_EXCEL = r"C:\Users\USER\Desktop\BASE DE DATOS 2026 05 JUNIO- SOLO MES - SIN PROTECCION.xlsx"
HOJA = "JUNIO 2026"
PRIMERA_FILA_DATOS = 6

# --- Mapeos: texto real del Excel (tal cual lo escribieron a mano, con
# variantes/typos incluidos) -> valores válidos del sistema. Cualquier
# valor que aparezca en el Excel y NO esté en estos diccionarios se
# reporta en el dry-run como "sin mapear" en vez de fallar silenciosamente
# o adivinar.

MAPA_ESTADO = {
    "abandonado": "ABANDONADO",
    "equipo listo": "LISTO_ENTREGA",
    "anulada": "CANCELADO",
    "en importaci\u00f3n": "IMPORTACION",
    "en proceso": "EN_REPARACION",
    "facturado": "ENTREGADO",
    # "terminado" se resuelve aparte (depende de "Entregado a CTE?")
}

MAPA_EQUIPO = {
    "laptop": "COMPUTADORA",
    "cpu": "COMPUTADORA",
    "pc": "COMPUTADORA",
    "celular": "CELULAR",
    "tablet": "TABLET",
    "accesorio": "OTRO",
    "reloj": "OTRO",
    "otros": "OTRO",
    "tv": "OTRO",
    "consola": "OTRO",
}

# tipos_servicio es una lista (multi-selección) en el sistema — cada
# valor del Excel se traduce a UN código de esa lista. Cuando no hay un
# código específico que le calce, se usa OTRO y se guarda el texto
# original en tipos_servicio_otro para no perder la descripción real.
MAPA_TIPO_SERVICIO = {
    "diagn\u00f3stico nivel 1": "DIAGNOSTICO",
    "diagn\u00f3stico avanzado (nivel 3)": "DIAGNOSTICO",
    "reparaci\u00f3n de bisagras": "REPARACION_BISAGRA",
    "reparacion de bisagras": "REPARACION_BISAGRA",
    "repararacion de bisagras": "REPARACION_BISAGRA",
    "reparaci\u00f3n de pieza": "REPARACION",
    "cambio de pieza": "REPARACION",
    "instalaci\u00f3n de piezas (solo m.o.)": "REPARACION",
    "reparaci\u00f3n electr\u00f3nica": "REPARACION",
    "resellado y/o enderezado": "REPARACION",
    "aumento de ram": "REPARACION",
    "mantenimiento y limpieza": "MANTENIMIENTO_BASICO",
    "combo ssd + mantenimiento": "MANTENIMIENTO_FULL",
    "tratamiento u.s.": "OTRO",
    "instalaci\u00f3n software especial": "CONFIGURACION",
    "reinstalaci\u00f3n sistema operativo": "CONFIGURACION",
    "desbloqueo / liberaci\u00f3n de red": "DESBLOQUEO",
    "otros": "OTRO",
    "venta de accesorio": "OTRO",
    "venta de insumos": "OTRO",
    "venta de repuesto": "OTRO",
    "venta de equipo": "OTRO",
    "servicios varios": "OTRO",
}

# Nombre/apodo tal como aparece en "Técnico"/"Recibido por" -> nombre
# completo real en rrhh.Empleado (se resuelve por coincidencia exacta
# contra este mapa, no por fuzzy-matching, para no adivinar mal con
# nombres reales de personal).
MAPA_TECNICO = {
    "augusto": "AUGUSTO CESAR PALACIOS KUAN",
    "jorge montiel": "JORGE ELIEZER MONTIEL MEDINA",
    "jorge": "JORGE ELIEZER MONTIEL MEDINA",
    "juan": "JUAN MANUEL ALGUERA GONZALEZ",
    "manolo": "MANOLO VALERIO OBANDO URBINA",
    "m. obando": "MANOLO VALERIO OBANDO URBINA",
    "obando": "MANOLO VALERIO OBANDO URBINA",
    # La base de junio (copia 2) usa la etiqueta "Tecnico 1" en vez del
    # nombre — es Manolo Obando (dato confirmado por RCP).
    "tecnico 1": "MANOLO VALERIO OBANDO URBINA",
    "técnico 1": "MANOLO VALERIO OBANDO URBINA",
    "tecnico1": "MANOLO VALERIO OBANDO URBINA",
    "newman": "NEWMAN JOSE ORTIZ MARTINEZ",
    "tania": "TANIA PEREZ",
    "kevin": "KEVIN ORLANDO DE PAUL AYERDIS COREA",
}


def _norm(texto):
    return " ".join(str(texto or "").strip().split()).lower()


def _texto(v):
    if v is None:
        return ""
    return str(v).strip()


def _fecha(v):
    if isinstance(v, datetime.datetime):
        return v.date()
    if isinstance(v, datetime.date):
        return v
    return None


def _hora(v):
    if isinstance(v, datetime.time):
        return v
    if isinstance(v, datetime.datetime):
        return v.time()
    return None


def _numero_orden(cca_com_txt):
    """'CCA 8440' -> 'CCA-8440' / 'COM 10832' -> 'COM-10832'. None si el
    texto no calza con ese patrón (para no importar un numero() roto)."""
    t = _texto(cca_com_txt)
    partes = t.replace("-", " ").split()
    if len(partes) == 2 and partes[0] in ("CCA", "COM") and partes[1].isdigit():
        return f"{partes[0]}-{partes[1]}"
    return None


def main(commit, ruta_excel=None, hoja=None):
    ruta_excel = ruta_excel or RUTA_EXCEL
    hoja = hoja or HOJA
    print(f"Excel : {ruta_excel}")
    print(f"Hoja  : {hoja}")
    from django.db import transaction
    from django.utils import timezone
    from ventas.models import Cliente, resolver_equipo
    from taller.models import OrdenTaller
    from rrhh.models import Empleado

    empleados_por_nombre = {e.nombre: e for e in Empleado.objects.all()}
    tecnico_cache = {}

    def resolver_tecnico(texto):
        clave = _norm(texto)
        if not clave:
            return None
        if clave in tecnico_cache:
            return tecnico_cache[clave]
        nombre_real = MAPA_TECNICO.get(clave)
        empleado = empleados_por_nombre.get(nombre_real) if nombre_real else None
        tecnico_cache[clave] = empleado
        return empleado

    wb = openpyxl.load_workbook(ruta_excel, data_only=True, read_only=True)
    ws = wb[hoja]

    estados_sin_mapear = {}
    tipos_sin_mapear = {}
    equipos_sin_mapear = {}
    tecnicos_sin_mapear = {}
    numeros_invalidos = []
    filas_omitidas = 0

    clientes_cache = {}  # clave -> Cliente (o dict de datos en dry-run)
    numeros_vistos = set()

    total_ordenes = 0
    total_clientes_nuevos = 0
    total_ordenes_creadas = 0
    max_com_importado = [0]
    max_cca_importado = [0]

    with transaction.atomic():
        sid = transaction.savepoint()
        for i, fila in enumerate(ws.iter_rows(min_row=PRIMERA_FILA_DATOS, values_only=True), start=PRIMERA_FILA_DATOS):
            cliente_nombre = _texto(fila[3])
            if not cliente_nombre or len(cliente_nombre) <= 1:
                filas_omitidas += 1
                continue

            numero = _numero_orden(fila[11])
            if numero is None:
                numeros_invalidos.append((i, fila[11]))
                filas_omitidas += 1
                continue
            if numero in numeros_vistos:
                # No debería pasar (cada OT real es única) pero por si el
                # Excel trae una fila duplicada, no se importa dos veces.
                filas_omitidas += 1
                continue
            numeros_vistos.add(numero)

            total_ordenes += 1

            # --- Estado ---
            status_txt = _norm(fila[0])
            entregado_cte = _norm(fila[1])
            if status_txt == "terminado":
                estado = "ENTREGADO" if entregado_cte in ("si", "s\u00ed") else "LISTO_ENTREGA"
            else:
                estado = MAPA_ESTADO.get(status_txt)
                if estado is None:
                    estados_sin_mapear[status_txt] = estados_sin_mapear.get(status_txt, 0) + 1
                    estado = "RECIBIDO"

            # --- Categoría de equipo ---
            equipo_txt = _norm(fila[25])
            categoria_equipo = MAPA_EQUIPO.get(equipo_txt)
            if categoria_equipo is None:
                if equipo_txt:
                    equipos_sin_mapear[equipo_txt] = equipos_sin_mapear.get(equipo_txt, 0) + 1
                categoria_equipo = "COMPUTADORA"

            # --- Tipos de servicio (multi) ---
            tipos_servicio = []
            tipos_servicio_otro = ""
            ts_txt = _texto(fila[37])
            ts_norm = _norm(ts_txt)
            if ts_norm:
                codigo = MAPA_TIPO_SERVICIO.get(ts_norm)
                if codigo is None:
                    tipos_sin_mapear[ts_txt] = tipos_sin_mapear.get(ts_txt, 0) + 1
                    codigo = "OTRO"
                    tipos_servicio_otro = ts_txt
                elif codigo == "OTRO":
                    tipos_servicio_otro = ts_txt
                tipos_servicio = [codigo]

            # --- Técnico / recibido por ---
            tecnico_txt = _texto(fila[46])
            tecnico = resolver_tecnico(tecnico_txt)
            if tecnico_txt and tecnico is None:
                clave = _norm(tecnico_txt)
                tecnicos_sin_mapear[tecnico_txt] = tecnicos_sin_mapear.get(tecnico_txt, 0) + 1

            # --- Cliente (dedup por cédula; si no hay, por nombre+teléfono) ---
            cedula = _texto(fila[14])
            telefono = _texto(fila[21])
            correo = _texto(fila[23])
            whatsapp = _norm(fila[22]) in ("si", "s\u00ed", "1", "true", "x")

            clave_cliente = cedula if cedula else ("NOCED", cliente_nombre.upper(), telefono)
            cliente = clientes_cache.get(clave_cliente)
            if cliente is None:
                cliente = Cliente.objects.create(
                    nombre=cliente_nombre, cedula=cedula, telefono=telefono,
                    email=correo, whatsapp=whatsapp,
                )
                clientes_cache[clave_cliente] = cliente
                total_clientes_nuevos += 1

            # --- Equipo (expediente) ---
            marca_txt = _texto(fila[26])
            modelo_txt = _texto(fila[27])
            color_txt = _texto(fila[28])
            equipo_vinculado = resolver_equipo(cliente, categoria_equipo, marca_txt, modelo_txt, color_txt, "")

            # --- Fechas ---
            fecha_orden = _fecha(fila[4])
            hora_recepcion = _hora(fila[18])
            fecha_hora_recepcion = None
            if fecha_orden:
                naive = datetime.datetime.combine(fecha_orden, hora_recepcion or datetime.time(0, 0))
                fecha_hora_recepcion = timezone.make_aware(naive)
            fecha_entrega_real = _fecha(fila[5]) or _fecha(fila[53])

            # --- Precio (columna "Factura por" = lo cobrado al cliente) ---
            factura_por = fila[43]
            try:
                costo_estimado = float(factura_por) if factura_por not in (None, "") else 0
            except (TypeError, ValueError):
                costo_estimado = 0

            diagnostico_txt = _texto(fila[30])
            trabajo_realizado = _texto(fila[36])
            como_supo = _texto(fila[24])
            no_factura = _texto(fila[7])

            notas_partes = []
            if no_factura:
                notas_partes.append(f"No. Factura (histórico): {no_factura}")
            garantia = _texto(fila[58])
            if garantia:
                notas_partes.append(f"Garantía brindada: {garantia}")
            detalles = _texto(fila[59])
            if detalles:
                notas_partes.append(f"Detalles: {detalles}")

            orden = OrdenTaller(
                numero=numero,
                cliente=cliente,
                equipo=f"{marca_txt} {modelo_txt}".strip() or categoria_equipo.title(),
                equipo_vinculado=equipo_vinculado,
                categoria_equipo=categoria_equipo,
                tecnico=tecnico,
                estado=estado,
                fecha_hora_recepcion=fecha_hora_recepcion,
                fecha_entrega_real=fecha_entrega_real,
                costo_estimado=costo_estimado,
                marca=marca_txt,
                modelo=modelo_txt,
                color=color_txt,
                diagnostico=diagnostico_txt,
                comentarios=trabajo_realizado,
                tipos_servicio=tipos_servicio,
                tipos_servicio_otro=tipos_servicio_otro,
                como_supo=como_supo,
                notas="\n".join(notas_partes),
            )
            orden.save()
            # fecha_ingreso es auto_now_add=True (siempre "hoy" al crear) —
            # se pisa aparte con la fecha real de la orden para no romper
            # el orden cronológico del listado ni los reportes por fecha.
            if fecha_orden:
                OrdenTaller.objects.filter(pk=orden.pk).update(fecha_ingreso=fecha_orden)
            total_ordenes_creadas += 1

            n = int(numero.split("-")[1])
            if numero.startswith("COM-"):
                max_com_importado[0] = max(max_com_importado[0], n)
            else:
                max_cca_importado[0] = max(max_cca_importado[0], n)

        if not commit:
            transaction.savepoint_rollback(sid)
        else:
            transaction.savepoint_commit(sid)
            # El contador de "próximo número" tiene que quedar DESPUÉS del
            # más alto que se acaba de importar — si no, la próxima orden
            # nueva que cree alguien en el sistema chocaría con un número
            # que ya existe en el histórico (se comprobó: el Excel trae
            # números más altos que los que el sistema tenía como
            # "siguiente" antes de este import).
            from core.models import Configuracion
            config = Configuracion.actual()
            cambios = []
            if max_com_importado[0] >= config.siguiente_numero_com:
                config.siguiente_numero_com = max_com_importado[0] + 1
                cambios.append("siguiente_numero_com")
            if max_cca_importado[0] >= config.siguiente_numero_cca:
                config.siguiente_numero_cca = max_cca_importado[0] + 1
                cambios.append("siguiente_numero_cca")
            if cambios:
                config.save(update_fields=cambios)
                print(f"Contador de próxima orden actualizado: COM->{config.siguiente_numero_com}, CCA->{config.siguiente_numero_cca}")

    print(f"Filas con datos procesadas: {total_ordenes}")
    print(f"Filas omitidas (sin cliente o sin número de orden válido): {filas_omitidas}")
    print(f"Órdenes {'creadas' if commit else 'que se crearían'}: {total_ordenes_creadas}")
    print(f"Clientes {'creados' if commit else 'que se crearían'}: {total_clientes_nuevos}")
    print()
    if numeros_invalidos:
        print(f"Números de orden con formato raro ({len(numeros_invalidos)}), no importados:")
        for fila_n, val in numeros_invalidos[:15]:
            print(f"  fila {fila_n}: {val!r}")
        if len(numeros_invalidos) > 15:
            print(f"  ... y {len(numeros_invalidos) - 15} más")
        print()
    if estados_sin_mapear:
        print("STATUS sin mapear (se importaron como RECIBIDO):", estados_sin_mapear)
    if equipos_sin_mapear:
        print("Tipo de equipo sin mapear (se importaron como COMPUTADORA):", equipos_sin_mapear)
    if tipos_sin_mapear:
        print("TIPO DE SERVICIO sin mapear (se importaron como OTRO, texto conservado):", tipos_sin_mapear)
    if tecnicos_sin_mapear:
        print("Técnicos sin mapear (se dejó tecnico=None):", tecnicos_sin_mapear)

    if not commit:
        print()
        print("*** DRY-RUN: no se escribió nada en la base de datos. Corré con --commit para importar de verdad. ***")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", action="store_true")
    parser.add_argument("--excel", default=None, help="Ruta al .xlsx (default: la de junio en el Escritorio)")
    parser.add_argument("--hoja", default=None, help="Nombre de la hoja (default: 'JUNIO 2026')")
    args = parser.parse_args()
    main(commit=args.commit, ruta_excel=args.excel, hoja=args.hoja)
