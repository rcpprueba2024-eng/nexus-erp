from decimal import Decimal
from django.db import models
from inventario.models import Producto


class Proveedor(models.Model):
    nombre = models.CharField(max_length=200)
    documento = models.CharField(max_length=30, blank=True, verbose_name="RFC/NIT/RUC")
    email = models.EmailField(blank=True)
    telefono = models.CharField(max_length=30, blank=True)
    direccion = models.CharField(max_length=255, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class OrdenCompra(models.Model):
    ESTADO_CHOICES = [
        ("PENDIENTE", "Pendiente"),
        ("RECIBIDA", "Recibida"),
        ("CANCELADA", "Cancelada"),
    ]

    numero = models.CharField(max_length=30, unique=True)
    proveedor = models.ForeignKey(Proveedor, on_delete=models.PROTECT, related_name="ordenes")
    fecha = models.DateField(auto_now_add=True)
    estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default="PENDIENTE")
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        ordering = ["-fecha", "-id"]

    def recalcular_total(self):
        self.total = sum(d.subtotal for d in self.detalles.all())
        self.save(update_fields=["total"])

    def __str__(self):
        return f"OC {self.numero} - {self.proveedor.nombre}"


class DetalleOrdenCompra(models.Model):
    orden = models.ForeignKey(OrdenCompra, on_delete=models.CASCADE, related_name="detalles")
    producto = models.ForeignKey(Producto, on_delete=models.PROTECT)
    cantidad = models.PositiveIntegerField(default=1)
    precio_unitario = models.DecimalField(max_digits=12, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    def save(self, *args, **kwargs):
        self.subtotal = self.cantidad * self.precio_unitario
        super().save(*args, **kwargs)
        self.orden.recalcular_total()

    def __str__(self):
        return f"{self.producto.nombre} x{self.cantidad}"


class CotizacionCliente(models.Model):
    """Presupuesto (PPTO) que se le da a un CLIENTE — no confundir con
    `Cotizacion`, que es la que se le pide a un proveedor. Esta replica el
    formato de Excel que el negocio ya usaba a mano (ver
    compras/plantillas_excel/cotizacion_cliente.xlsx, tomado de un PPTO real
    de RCP) para no perder ese formato al pasarlo al sistema."""

    ppto_numero = models.CharField(max_length=60, blank=True, verbose_name="No. de PPTO")
    titulo = models.CharField(max_length=255, blank=True)
    cliente_nombre = models.CharField(max_length=200)
    equipo_marca = models.CharField(max_length=200, blank=True)
    servicio_producto = models.CharField(max_length=255, blank=True)
    tipo_trabajo = models.CharField(max_length=200, blank=True)
    periodo = models.CharField(max_length=50, blank=True)
    fecha = models.DateField()
    contacto_nombre = models.CharField(max_length=200, blank=True)
    contacto_puesto = models.CharField(max_length=200, blank=True)
    contacto_telefono = models.CharField(max_length=60, blank=True)
    contacto_email = models.CharField(max_length=200, blank=True)
    ruc = models.CharField(max_length=60, blank=True)
    # Tal como en la plantilla original: el tipo de cambio queda fijo en
    # esta cotización puntual (no sigue la tasa general de Configuración si
    # esta cambia después) — es lo que se le mostró/prometió al cliente.
    tipo_cambio = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("36.63"))
    nota_garantia = models.CharField(max_length=500, blank=True)
    observaciones = models.TextField(blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-fecha", "-id"]

    def __str__(self):
        return f"{self.ppto_numero or 'PPTO'} · {self.cliente_nombre}"


class ItemCotizacionCliente(models.Model):
    cotizacion = models.ForeignKey(CotizacionCliente, on_delete=models.CASCADE, related_name="items")
    descripcion = models.CharField(max_length=255)
    cantidad = models.PositiveIntegerField(default=1)
    # En dólares, igual que en la plantilla original (el precio en córdobas
    # sale de multiplicar esto por el tipo de cambio de la cotización).
    precio_unitario_usd = models.DecimalField(max_digits=12, decimal_places=2)
    proveedor = models.CharField(max_length=200, blank=True)
    costo_proveedor_unitario = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    orden = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["orden", "id"]

    def __str__(self):
        return f"{self.descripcion} x{self.cantidad}"
