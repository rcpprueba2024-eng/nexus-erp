from django.conf import settings
from django.db import models
from core.choices import MONEDA_CHOICES


class CategoriaProducto(models.Model):
    TIPO_CHOICES = [
        ("REPUESTO", "Repuesto"),
        ("INSUMO", "Insumo"),
        ("EQUIPO", "Equipo"),
        ("HERRAMIENTA", "Herramienta"),
        ("PRODUCTO", "Producto"),
        ("ACCESORIO", "Accesorio"),
        ("OTRO", "Otro"),
    ]

    nombre = models.CharField(max_length=100, unique=True)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default="PRODUCTO")
    descripcion = models.CharField(max_length=255, blank=True)
    # Herramientas/activos de uso interno del taller (no se venden) quedan
    # con vendible=False: siguen viéndose y administrándose en Inventario,
    # pero no aparecen como categoría elegible en POS ni en Facturar OTs.
    vendible = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Categoría"
        verbose_name_plural = "Categorías"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class SubcategoriaProducto(models.Model):
    categoria = models.ForeignKey(CategoriaProducto, on_delete=models.CASCADE, related_name="subcategorias")
    nombre = models.CharField(max_length=100)
    descripcion = models.CharField(max_length=255, blank=True)

    class Meta:
        verbose_name = "Subcategoría"
        verbose_name_plural = "Subcategorías"
        ordering = ["categoria__nombre", "nombre"]
        unique_together = [("categoria", "nombre")]

    def __str__(self):
        return f"{self.categoria.nombre} / {self.nombre}"


class Marca(models.Model):
    nombre = models.CharField(max_length=100, unique=True)

    class Meta:
        verbose_name = "Marca"
        verbose_name_plural = "Marcas"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class Modelo(models.Model):
    marca = models.ForeignKey(Marca, on_delete=models.CASCADE, related_name="modelos")
    nombre = models.CharField(max_length=100)

    class Meta:
        verbose_name = "Modelo"
        verbose_name_plural = "Modelos"
        ordering = ["marca__nombre", "nombre"]
        unique_together = [("marca", "nombre")]

    def __str__(self):
        return f"{self.marca.nombre} {self.nombre}"


class UnidadMedida(models.Model):
    nombre = models.CharField(max_length=50, unique=True, help_text="Ej. Unidad, Gramo, Paquete")
    abreviatura = models.CharField(max_length=10, blank=True, help_text="Ej. und, g, paq")
    # Si no permite fracción, la cantidad al vender/usar debe ser entera
    # (ej. "Unidad"); si permite fracción, se puede vender/usar en partes
    # (ej. "Gramo" -> vender 8g de un bote, "Paquete" -> medio paquete).
    permite_fraccion = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Unidad de medida"
        verbose_name_plural = "Unidades de medida"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class Producto(models.Model):
    SUBGRUPO_CHOICES = [
        ("ABANDONADA", "Computadoras abandonadas"),
        ("EN_TALLER", "Computadoras en taller"),
        ("USO_PERSONAL", "Equipo usado por personal"),
        ("REPUESTO", "Repuestos"),
        ("INSUMO_TALLER", "Insumo para taller"),
        ("LISTO_ENTREGA", "Equipos listos para que el cliente lo retire"),
    ]

    CONDICION_CHOICES = [
        ("NUEVO", "Nuevo"),
        ("USADO", "Usado"),
        ("MAL_ESTADO", "Mal estado"),
    ]

    codigo = models.CharField(max_length=30, unique=True)
    nombre = models.CharField(max_length=200)
    categoria = models.ForeignKey(CategoriaProducto, on_delete=models.SET_NULL, null=True, blank=True, related_name="productos")
    subcategoria = models.ForeignKey(SubcategoriaProducto, on_delete=models.SET_NULL, null=True, blank=True, related_name="productos")
    marca = models.ForeignKey(Marca, on_delete=models.SET_NULL, null=True, blank=True, related_name="productos")
    modelo = models.ForeignKey(Modelo, on_delete=models.SET_NULL, null=True, blank=True, related_name="productos")
    no_serie = models.CharField(max_length=100, blank=True, verbose_name="N.º de serie")
    condicion = models.CharField(max_length=15, choices=CONDICION_CHOICES, default="NUEVO")
    subgrupo = models.CharField(max_length=20, choices=SUBGRUPO_CHOICES, default="REPUESTO")
    unidad_medida = models.ForeignKey(UnidadMedida, on_delete=models.SET_NULL, null=True, blank=True, related_name="productos")
    imagen = models.ImageField(upload_to="productos/", null=True, blank=True)
    descripcion = models.TextField(blank=True)
    detalles = models.TextField(blank=True, help_text="Especificaciones técnicas, características adicionales")
    moneda = models.CharField(max_length=3, choices=MONEDA_CHOICES, default="USD")
    precio_compra = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    precio_venta = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    # Decimal, no entero: productos con unidad de medida fraccionable
    # (gramos, paquetes) necesitan existencias no enteras.
    stock_actual = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    stock_minimo = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    ubicacion = models.CharField(max_length=100, blank=True, help_text="Estante o mueble donde está guardado")
    nivel = models.CharField(max_length=50, blank=True)
    asignacion = models.CharField(max_length=100, blank=True, help_text="Persona o área a la que está asignado")
    prestado_a = models.CharField(max_length=100, blank=True)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["nombre"]

    def __str__(self):
        return f"{self.codigo} - {self.nombre}"


class MovimientoInventario(models.Model):
    TIPO_CHOICES = [
        ("ENTRADA", "Entrada"),
        ("SALIDA", "Salida"),
    ]

    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, related_name="movimientos")
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    cantidad = models.DecimalField(max_digits=10, decimal_places=3)
    motivo = models.CharField(max_length=200, blank=True)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-fecha"]

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        super().save(*args, **kwargs)
        if is_new:
            if self.tipo == "ENTRADA":
                self.producto.stock_actual += self.cantidad
            else:
                self.producto.stock_actual -= self.cantidad
            self.producto.save(update_fields=["stock_actual"])

    def __str__(self):
        return f"{self.tipo} - {self.producto.nombre} ({self.cantidad})"


class BajaProducto(models.Model):
    """Historial de bajas de inventario: cuando un producto sale
    definitivamente del activo (se entrega a un área/persona, se dona,
    se desecha, etc.) queda registrado quién lo hizo, de dónde salió, a
    qué área fue y a quién se le entregó de parte de la empresa — antes
    solo existía el booleano Producto.activo, sin ningún rastro de qué
    pasó ni quién lo decidió."""

    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, related_name="bajas")
    fecha = models.DateTimeField(auto_now_add=True)
    # Cuantas unidades salen en ESTA baja — no siempre es todo el stock: a
    # veces solo se dañan/entregan algunas y el resto sigue disponible.
    cantidad = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    origen = models.CharField(max_length=150, blank=True, help_text="De dónde salió (ubicación o área de origen)")
    area_destino = models.CharField(max_length=150, blank=True, help_text="A qué área o departamento va")
    entregado_a = models.CharField(max_length=150, blank=True, help_text="Persona o entidad a la que la empresa se lo entregó")
    motivo = models.TextField(blank=True)
    dado_de_baja_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="bajas_registradas",
    )

    class Meta:
        ordering = ["-fecha"]
        verbose_name = "Baja de producto"
        verbose_name_plural = "Bajas de producto"

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        stock_antes = self.producto.stock_actual
        super().save(*args, **kwargs)
        if is_new:
            # Deja registrado el movimiento de salida (mismo mecanismo que
            # cualquier otra salida de stock). Solo se apaga el producto si
            # esta baja agota TODO lo que quedaba — si era una baja parcial,
            # el resto del stock sigue disponible y activo normalmente.
            if self.cantidad > 0:
                MovimientoInventario.objects.create(
                    producto=self.producto, tipo="SALIDA", cantidad=self.cantidad,
                    motivo=f"Baja de inventario{': ' + self.motivo if self.motivo else ''}",
                )
            if stock_antes - self.cantidad <= 0:
                self.producto.activo = False
                self.producto.save(update_fields=["activo"])

    def __str__(self):
        return f"Baja de {self.producto.nombre} ({self.fecha:%Y-%m-%d})"
