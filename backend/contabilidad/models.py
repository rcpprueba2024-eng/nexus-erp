from django.db import models
from ventas.models import Cliente, Factura
from compras.models import Proveedor, OrdenCompra


class CuentaPorCobrar(models.Model):
    ESTADO_CHOICES = [("PENDIENTE", "Pendiente"), ("PAGADO", "Pagado")]

    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name="cuentas_por_cobrar")
    factura = models.ForeignKey(Factura, on_delete=models.SET_NULL, null=True, blank=True, related_name="cuentas_por_cobrar")
    monto = models.DecimalField(max_digits=12, decimal_places=2)
    fecha_vencimiento = models.DateField()
    estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default="PENDIENTE")
    # Los siguientes campos son opcionales — quedan vacíos para las cuentas
    # que el sistema crea solas (ver Factura.sincronizar_cuenta_por_cobrar);
    # se llenan al importar créditos históricos que sí traían este detalle
    # (número de recibo/factura del control manual, asesor que lo vendió,
    # monto original antes de abonos, fecha en que se generó, y el número
    # de OT de referencia — como texto libre, no FK: el número de orden de
    # taller anotado a mano no siempre corresponde con la orden real).
    numero_factura = models.CharField(max_length=30, blank=True)
    asesor = models.CharField(max_length=100, blank=True)
    monto_inicial = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    fecha_factura = models.DateField(null=True, blank=True)
    referencia_ots = models.CharField(max_length=30, blank=True, verbose_name="N.º de OT de referencia")

    class Meta:
        ordering = ["fecha_vencimiento"]
        verbose_name = "Cuenta por cobrar"
        verbose_name_plural = "Cuentas por cobrar"

    def __str__(self):
        return f"{self.cliente.nombre} - {self.monto}"


class CuentaPorPagar(models.Model):
    ESTADO_CHOICES = [("PENDIENTE", "Pendiente"), ("PAGADO", "Pagado")]

    proveedor = models.ForeignKey(Proveedor, on_delete=models.CASCADE, related_name="cuentas_por_pagar")
    orden_compra = models.ForeignKey(OrdenCompra, on_delete=models.SET_NULL, null=True, blank=True, related_name="cuentas_por_pagar")
    monto = models.DecimalField(max_digits=12, decimal_places=2)
    fecha_vencimiento = models.DateField()
    estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default="PENDIENTE")

    class Meta:
        ordering = ["fecha_vencimiento"]
        verbose_name = "Cuenta por pagar"
        verbose_name_plural = "Cuentas por pagar"

    def __str__(self):
        return f"{self.proveedor.nombre} - {self.monto}"
