import re
import unicodedata
import openpyxl
from django.db import transaction
from django.db.models import Count
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from core.permissions import role_permission
from .models import CategoriaProducto, SubcategoriaProducto, Marca, Modelo, Producto, MovimientoInventario, UnidadMedida, BajaProducto
from .serializers import (
    CategoriaProductoSerializer, SubcategoriaProductoSerializer, MarcaSerializer, ModeloSerializer,
    ProductoSerializer, MovimientoInventarioSerializer, UnidadMedidaSerializer, BajaProductoSerializer,
)

INVENTARIO_ROLES = ("TALLER", "VENTAS", "BACKOFFICE", "RRHH")

# Alias de encabezado reconocidos por columna destino. Cubre tanto el
# formato simple original (codigo/nombre/...) como el inventario real del
# taller (ITEM/ARTICULO/TIPO/EXISTENCIA/VALOR UNITARIO/ESTANTE/...), para
# que una hoja exportada tal cual del control interno se pueda importar sin
# tener que reacomodar columnas a mano primero.
ALIAS_COLUMNAS = {
    "codigo": ["ITEM", "SKU", "CODIGO"],
    "nombre": ["ARTICULO", "NOMBRE", "PRODUCTO"],
    "categoria": ["TIPO", "CATEGORIA"],
    "marca": ["MARCA"],
    "modelo": ["MODELO"],
    "no_serie": ["N SERIE", "NO SERIE", "NUMERO DE SERIE", "SERIE"],
    "condicion": ["ESTADO", "TIPO2", "CONDICION"],
    "stock_actual": ["EXISTENCIA", "STOCK ACTUAL", "STOCK", "INVENTARIO INICIAL"],
    "precio_compra": ["VALOR UNITARIO", "COSTO UNITARIO", "COSTO", "PRECIO COMPRA"],
    "precio_venta": ["VALOR VENTA", "PRECIO VENTA"],
    "ubicacion": ["ESTANTE", "UBICACION"],
    "nivel": ["NIVEL"],
    "detalles": ["DETALLE / COMPATIBILIDAD", "DETALLE COMPATIBILIDAD", "CARACTERISTICAS", "DETALLES"],
    "asignacion": ["ASIGNACION"],
    "prestado_a": ["PRESTADO"],
    "stock_minimo": ["STOCK MINIMO"],
    "descripcion": ["DESCRIPCION"],
    "unidad_medida": ["UNIDAD", "UNIDAD DE MEDIDA"],
    "subgrupo": ["SUBGRUPO"],
}
# Columnas que, si aparecen sin coincidir con nada, no cuentan como "ruido"
# al calcular qué fila es el encabezado (evita que fechas de movimientos
# diarios como "23-jun" bajen el puntaje de la fila real de encabezados).
_ALIAS_A_DESTINO = {alias: destino for destino, alias_list in ALIAS_COLUMNAS.items() for alias in alias_list}


def _normalizar_encabezado(texto):
    if texto is None:
        return ""
    texto = unicodedata.normalize("NFKD", str(texto).strip().upper()).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", texto)


class CategoriaProductoViewSet(viewsets.ModelViewSet):
    queryset = CategoriaProducto.objects.all()
    serializer_class = CategoriaProductoSerializer
    permission_classes = [role_permission(*INVENTARIO_ROLES, modules="inventario")]


class UnidadMedidaViewSet(viewsets.ModelViewSet):
    queryset = UnidadMedida.objects.annotate(productos_count=Count("productos"))
    serializer_class = UnidadMedidaSerializer

    def get_permissions(self):
        # Igual que Marca/Modelo: leer y crear disponible ampliamente
        # (se necesita al vender/registrar productos), editar/borrar
        # reservado al módulo de inventario.
        if self.action in ("list", "retrieve", "create"):
            return [role_permission(*INVENTARIO_ROLES, "PASANTE", modules=("inventario", "taller", "rrhh", "ventas"))()]
        return [role_permission(*INVENTARIO_ROLES, modules="inventario")()]


class SubcategoriaProductoViewSet(viewsets.ModelViewSet):
    queryset = SubcategoriaProducto.objects.all()
    serializer_class = SubcategoriaProductoSerializer
    permission_classes = [role_permission(*INVENTARIO_ROLES, modules="inventario")]


class MarcaViewSet(viewsets.ModelViewSet):
    queryset = Marca.objects.all()
    serializer_class = MarcaSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve", "create"):
            return [role_permission(*INVENTARIO_ROLES, "PASANTE", modules=("inventario", "taller", "rrhh"))()]
        return [role_permission(*INVENTARIO_ROLES, modules="inventario")()]

    def create(self, request, *args, **kwargs):
        # Case-insensitive: "samsung" no debe crear una marca aparte si ya
        # existe "SAMSUNG" — mismo criterio que resolver_marca_modelo().
        nombre = (request.data.get("nombre") or "").strip()
        existente = Marca.objects.filter(nombre__iexact=nombre).first() if nombre else None
        if existente:
            return Response(self.get_serializer(existente).data, status=200)
        return super().create(request, *args, **kwargs)


class ModeloViewSet(viewsets.ModelViewSet):
    queryset = Modelo.objects.select_related("marca").all()
    serializer_class = ModeloSerializer

    def get_permissions(self):
        # Igual que ProductoViewSet: Taller/Pasante necesitan poder LEER y
        # crear modelos al recibir un equipo en la OT (alta rápida), aunque
        # no tengan el módulo "inventario" completo.
        if self.action in ("list", "retrieve", "create"):
            return [role_permission(*INVENTARIO_ROLES, "PASANTE", modules=("inventario", "taller", "rrhh"))()]
        return [role_permission(*INVENTARIO_ROLES, modules="inventario")()]

    def get_queryset(self):
        qs = super().get_queryset()
        marca_id = self.request.query_params.get("marca")
        if marca_id:
            qs = qs.filter(marca_id=marca_id)
        return qs

    def create(self, request, *args, **kwargs):
        nombre = (request.data.get("nombre") or "").strip()
        marca_id = request.data.get("marca")
        existente = Modelo.objects.filter(marca_id=marca_id, nombre__iexact=nombre).first() if (nombre and marca_id) else None
        if existente:
            return Response(self.get_serializer(existente).data, status=200)
        return super().create(request, *args, **kwargs)


class ProductoViewSet(viewsets.ModelViewSet):
    # select_related: el serializer trae categoria_nombre/categoria_tipo/
    # subcategoria_nombre/marca_nombre/modelo_nombre (4 FKs); sin esto,
    # listar el inventario completo dispara miles de consultas extra a
    # medida que crece el catálogo.
    queryset = Producto.objects.select_related("categoria", "subcategoria", "marca", "modelo").all()
    serializer_class = ProductoSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        # Taller/Pasante no tienen el módulo "inventario" (solo ven Taller),
        # pero sí necesitan poder LISTAR productos para elegir el insumo al
        # registrar consumo en una reparación. RRHH tampoco tiene
        # "inventario", pero necesita listar equipos de "uso personal" para
        # asignárselos a un empleado. Ninguno puede crear/editar/borrar.
        if self.action in ("list", "retrieve"):
            return [role_permission(*INVENTARIO_ROLES, "PASANTE", modules=("inventario", "taller", "rrhh"))()]
        return [role_permission(*INVENTARIO_ROLES, modules="inventario")()]


class MovimientoInventarioViewSet(viewsets.ModelViewSet):
    queryset = MovimientoInventario.objects.all()
    serializer_class = MovimientoInventarioSerializer
    permission_classes = [role_permission(*INVENTARIO_ROLES, modules="inventario")]


class BajaProductoViewSet(viewsets.ModelViewSet):
    queryset = BajaProducto.objects.select_related("producto", "dado_de_baja_por").all()
    serializer_class = BajaProductoSerializer
    permission_classes = [role_permission(*INVENTARIO_ROLES, modules="inventario")]

    def perform_create(self, serializer):
        serializer.save(dado_de_baja_por=self.request.user)


class ImportarProductosView(APIView):
    """Importación masiva de productos desde un archivo .xlsx.

    Reconoce el formato simple original (codigo, nombre, categoria, ...) Y
    el inventario real de control interno (ITEM, ARTICULO, TIPO, MARCA,
    MODELO, N° SERIE, ESTADO, EXISTENCIA, VALOR UNITARIO, ESTANTE, NIVEL,
    DETALLE / COMPATIBILIDAD, ASIGNACION, PRESTADO — ver ALIAS_COLUMNAS),
    detectando la fila de encabezados aunque no sea la primera (esas hojas
    suelen traer un título de sección en la fila 1). Solo 'codigo'
    (ITEM/SKU) y 'nombre' (ARTICULO) son obligatorias.
    """
    permission_classes = [role_permission("BACKOFFICE", "TALLER", modules="inventario")]
    parser_classes = [MultiPartParser]

    def post(self, request):
        archivo = request.FILES.get("archivo")
        if not archivo:
            return Response({"detail": "Adjunta un archivo .xlsx en el campo 'archivo'."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            wb = openpyxl.load_workbook(archivo, data_only=True)
        except Exception:
            return Response({"detail": "No se pudo leer el archivo. Debe ser un .xlsx válido."}, status=status.HTTP_400_BAD_REQUEST)

        ws = wb.worksheets[0]
        filas = list(ws.iter_rows(values_only=True))
        if not filas:
            return Response({"detail": "El archivo está vacío."}, status=status.HTTP_400_BAD_REQUEST)

        # La fila de encabezados es la que más coincidencias tiene contra
        # ALIAS_COLUMNAS, buscando entre las primeras filas (por si antes
        # hay una fila de título como "INVENTARIO TALLER / HERRAMIENTAS").
        fila_encabezado, mejor_conteo = 0, -1
        for i, fila in enumerate(filas[:6]):
            conteo = sum(1 for c in fila if _normalizar_encabezado(c) in _ALIAS_A_DESTINO)
            if conteo > mejor_conteo:
                fila_encabezado, mejor_conteo = i, conteo

        # Se guardan TODOS los índices que matchean cada destino (no solo el
        # primero): hojas reales como esta traen columnas duplicadas con
        # distinto propósito por fila — p.ej. "DETALLES" y "DETALLE /
        # COMPATIBILIDAD" a la vez, o "INVENTARIO INICIAL" y "EXISTENCIA" —
        # y cuál de las dos trae el dato varía fila por fila.
        encabezados = [_normalizar_encabezado(c) for c in filas[fila_encabezado]]
        idx = {}
        for destino, alias_list in ALIAS_COLUMNAS.items():
            encontrados = [encabezados.index(alias) for alias in alias_list if alias in encabezados]
            if encontrados:
                idx[destino] = encontrados

        if "codigo" not in idx or "nombre" not in idx:
            return Response(
                {"detail": "No se encontraron las columnas de código (ITEM/SKU/codigo) y nombre (ARTICULO/nombre) en el archivo."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        tiene_precio_venta = "precio_venta" in idx
        creados, actualizados, errores = 0, 0, []
        subgrupos_validos = dict(Producto.SUBGRUPO_CHOICES).keys()
        condiciones_validas = dict(Producto.CONDICION_CHOICES).keys()

        # Caché de catálogos: sin esto, cada fila repetía un get_or_create
        # (SELECT + posible INSERT) por categoría/marca/modelo/unidad, aunque
        # la mayoría de filas de un inventario real comparten la misma
        # categoría o marca — con esto, un valor ya visto (de la BD o creado
        # en una fila anterior de este mismo import) no vuelve a consultarse.
        categorias_cache = {c.nombre: c for c in CategoriaProducto.objects.all()}
        marcas_cache = {m.nombre: m for m in Marca.objects.all()}
        modelos_cache = {(m.marca_id, m.nombre): m for m in Modelo.objects.all()}
        unidades_cache = {u.nombre.lower(): u for u in UnidadMedida.objects.all()}

        # Todo el archivo en una sola transacción (un solo commit al final)
        # en vez de uno por fila — en SQLite cada commit implica escribir a
        # disco, así que con cientos de filas esto por sí solo puede ser la
        # diferencia entre segundos y minutos. `atomic()` anidado por fila
        # (más abajo) crea un punto de guardado individual, así una fila con
        # error solo deshace esa fila sin invalidar el resto del lote.
        with transaction.atomic():
            for n, fila in enumerate(filas[fila_encabezado + 1:], start=fila_encabezado + 2):
                def val(col):
                    # Primer valor no vacío entre las columnas candidatas de este
                    # destino, en el orden de prioridad de ALIAS_COLUMNAS.
                    for i in idx.get(col, []):
                        if i < len(fila) and fila[i] not in (None, ""):
                            return fila[i]
                    return None

                def val_concat(col):
                    # Para notas/detalles: junta TODAS las columnas candidatas
                    # con contenido en vez de quedarse solo con la primera, así
                    # no se pierde texto cuando hay más de una columna de notas.
                    partes = [str(fila[i]).strip() for i in idx.get(col, []) if i < len(fila) and fila[i] not in (None, "")]
                    return "; ".join(partes)

                codigo = val("codigo")
                nombre = val("nombre")
                if not codigo or not nombre:
                    continue

                try:
                    # Punto de guardado por fila: si esta fila falla, solo se
                    # deshace ella (savepoint), sin invalidar el commit único
                    # de todo el archivo ni las filas ya procesadas.
                    with transaction.atomic():
                        categoria = None
                        cat_nombre = val("categoria")
                        if cat_nombre:
                            cat_nombre = str(cat_nombre).strip().upper()
                            categoria = categorias_cache.get(cat_nombre)
                            if categoria is None:
                                categoria = CategoriaProducto.objects.create(nombre=cat_nombre)
                                categorias_cache[cat_nombre] = categoria

                        marca = None
                        marca_nombre = val("marca")
                        if marca_nombre:
                            marca_nombre = str(marca_nombre).strip().upper()
                            marca = marcas_cache.get(marca_nombre)
                            if marca is None:
                                marca = Marca.objects.create(nombre=marca_nombre)
                                marcas_cache[marca_nombre] = marca

                        modelo = None
                        modelo_nombre = val("modelo")
                        if modelo_nombre and marca:
                            modelo_nombre = str(modelo_nombre).strip()
                            modelo_key = (marca.id, modelo_nombre)
                            modelo = modelos_cache.get(modelo_key)
                            if modelo is None:
                                modelo = Modelo.objects.create(marca=marca, nombre=modelo_nombre)
                                modelos_cache[modelo_key] = modelo

                        subgrupo = str(val("subgrupo") or "REPUESTO").strip().upper()
                        if subgrupo not in subgrupos_validos:
                            subgrupo = "REPUESTO"

                        condicion = _normalizar_encabezado(val("condicion")).replace(" ", "_") or "NUEVO"
                        if condicion not in condiciones_validas:
                            condicion = "NUEVO"

                        precio_compra = val("precio_compra") or 0
                        # Si el archivo no trae columna de precio de venta (el
                        # inventario de control interno no la tiene), se parte del
                        # costo en vez de $0 — vender gratis por accidente es peor
                        # que pedirle a alguien que ajuste el margen después.
                        precio_venta = val("precio_venta") if tiene_precio_venta else None
                        if precio_venta is None:
                            precio_venta = precio_compra if not tiene_precio_venta else 0

                        unidad_texto = " ".join(str(val("unidad_medida") or "Unidad").strip().split())
                        unidad_key = unidad_texto.lower()
                        unidad_medida = unidades_cache.get(unidad_key)
                        if unidad_medida is None:
                            unidad_medida = UnidadMedida.objects.create(nombre=unidad_texto)
                            unidades_cache[unidad_key] = unidad_medida

                        defaults = dict(
                            nombre=str(nombre).strip(),
                            categoria=categoria,
                            marca=marca,
                            modelo=modelo,
                            no_serie=str(val("no_serie") or "").strip(),
                            condicion=condicion,
                            subgrupo=subgrupo,
                            unidad_medida=unidad_medida,
                            precio_compra=precio_compra,
                            precio_venta=precio_venta,
                            stock_actual=val("stock_actual") or 0,
                            stock_minimo=val("stock_minimo") or 0,
                            descripcion=str(val("descripcion") or ""),
                            detalles=val_concat("detalles"),
                            ubicacion=str(val("ubicacion") or "").strip(),
                            nivel=str(val("nivel") or "").strip(),
                            asignacion=str(val("asignacion") or "").strip(),
                            prestado_a=str(val("prestado_a") or "").strip(),
                        )
                        obj, created = Producto.objects.update_or_create(codigo=str(codigo).strip(), defaults=defaults)
                        if created:
                            creados += 1
                        else:
                            actualizados += 1
                except Exception as exc:
                    errores.append(f"Fila {n}: {exc}")

        return Response({
            "creados": creados,
            "actualizados": actualizados,
            "errores": errores,
            "total_procesadas": creados + actualizados,
            "fila_encabezado_detectada": fila_encabezado + 1,
        })
