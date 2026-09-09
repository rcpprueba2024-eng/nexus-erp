from django.db import models, transaction
from django.contrib.auth.models import User


class CategoriaGasto(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    descripcion = models.CharField(max_length=255, blank=True)

    class Meta:
        verbose_name = "Categoría de gasto"
        verbose_name_plural = "Categorías de gasto"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class CajaChica(models.Model):
    """Fila única con el saldo actual de la caja chica. Cada Gasto que se
    crea descuenta de aquí (ver Gasto.save()) y guarda el saldo resultante
    en el propio gasto, igual que Producto.stock_actual se actualiza desde
    MovimientoInventario.save(). El saldo también se puede ajustar a mano
    (apertura inicial o reposición de fondos) editando este registro."""
    saldo_actual = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Caja chica"
        verbose_name_plural = "Caja chica"

    @classmethod
    def actual(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    @classmethod
    def descontar(cls, monto):
        """Resta `monto` del saldo de forma atómica y devuelve el saldo
        resultante — evita que dos gastos registrados al mismo tiempo
        pisen el saldo del otro (mismo patrón que Configuracion.siguiente_numero_orden)."""
        cls.actual()
        with transaction.atomic():
            caja = cls.objects.select_for_update().get(pk=1)
            caja.saldo_actual = caja.saldo_actual - monto
            caja.save(update_fields=["saldo_actual"])
            return caja.saldo_actual

    def __str__(self):
        return f"Caja chica: {self.saldo_actual}"


class Gasto(models.Model):
    fecha = models.DateTimeField(auto_now_add=True)
    categoria = models.ForeignKey(CategoriaGasto, on_delete=models.PROTECT, related_name="gastos")
    descripcion = models.CharField(max_length=255)
    monto = models.DecimalField(max_digits=12, decimal_places=2)
    # Saldo de la caja chica inmediatamente después de este gasto — se
    # calcula solo, no se recibe del cliente (ver save() y CajaChica.descontar()).
    saldo_resultante = models.DecimalField(max_digits=12, decimal_places=2, editable=False, default=0)
    registrado_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="gastos_registrados")

    class Meta:
        verbose_name = "Gasto"
        verbose_name_plural = "Gastos"
        ordering = ["-fecha", "-id"]

    def save(self, *args, **kwargs):
        if self._state.adding:
            self.saldo_resultante = CajaChica.descontar(self.monto)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.descripcion} - {self.monto}"
