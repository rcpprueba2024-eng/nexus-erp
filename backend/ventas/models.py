from django.db import models
from django.contrib.auth.models import User
from core.choices import SERVICIO_CHOICES, CATEGORIA_EQUIPO_CHOICES, MONEDA_CHOICES, OPERADORA_CHOICES, TIPO_CLIENTE_CHOICES
from inventario.models import Producto

TIPO_ITEM_CHOICES = [
    ("PRODUCTO", "Producto"),
    ("SERVICIO", "Servicio"),
]

# Un cliente se considera "frecuente" si tuvo actividad (OT o factura) en
# esta ventana de días — criterio automático, no un campo manual que hay
# que recordar actualizar.
DIAS_CLIENTE_FRECUENTE = 180
UMBRAL_CLIENTE_FRECUENTE = 3


class Empresa(models.Model):
    nombre = models.CharField(max_length=200, unique=True)
    ruc = models.CharField(max_length=30, blank=True, verbose_name="RUC")
    direccion = models.CharField(max_length=255, blank=True)
    telefono = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    # Persona de contacto dentro de la empresa (quien realmente atiende el
    # trato) — distinto del teléfono/correo generales de la empresa arriba.
    contacto_nombre = models.CharField(max_length=200, blank=True)
    contacto_puesto = models.CharField(max_length=100, blank=True)
    contacto_email = models.EmailField(blank=True)
    contacto_telefono = models.CharField(max_length=30, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class Cliente(models.Model):
    nombre = models.CharField(max_length=200)
    cedula = models.CharField(max_length=30, blank=True, verbose_name="Cédula / ID")
    documento = models.CharField(max_length=30, blank=True, verbose_name="RUC")
    email = models.EmailField(blank=True)
    telefono = models.CharField(max_length=30, blank=True)
    telefono2 = models.CharField(max_length=30, blank=True, verbose_name="Teléfono alterno")
    direccion = models.CharField(max_length=255, blank=True)
    direccion_entrega = models.CharField(max_length=255, blank=True)
    operadora = models.CharField(max_length=10, choices=OPERADORA_CHOICES, blank=True)
    whatsapp = models.BooleanField(default=False)
    # Texto libre a propósito (no un catálogo cerrado de departamentos):
    # también llegan clientes de fuera de Nicaragua.
    departamento_pais = models.CharField(max_length=100, blank=True, verbose_name="Departamento / País")
    empresa = models.ForeignKey(Empresa, on_delete=models.SET_NULL, null=True, blank=True, related_name="contactos")
    tipo_cliente = models.CharField(max_length=20, choices=TIPO_CLIENTE_CHOICES, blank=True)
    # Uso interno (seguimiento del vendedor/taller). Nunca se incluye en
    # recibos, facturas impresas ni en la ficha de OT — solo se lee desde
    # el panel de administración de Clientes.
    notas = models.TextField(blank=True)
    # "Bandera roja": cliente conflictivo, que abandonó equipos, se negó a
    # seguir con una reparación ya en curso, etc. — el motivo queda libre a
    # propósito, no es un catálogo cerrado de razones. Se muestra como aviso
    # al personal en la ficha del cliente, en la lista y al crear una OT
    # nueva a su nombre.
    es_problematico = models.BooleanField(default=False, verbose_name="Cliente problemático")
    motivo_problematico = models.TextField(blank=True, verbose_name="Motivo")
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class Equipo(models.Model):
    """Un equipo físico del cliente (celular, laptop...). Existe una sola
    vez por cliente+serie aunque el equipo pase por el taller varias veces
    — cada paso queda como una OrdenTaller distinta ligada a este mismo
    Equipo, formando su expediente."""

    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name="equipos")
    categoria_equipo = models.CharField(max_length=20, choices=CATEGORIA_EQUIPO_CHOICES, default="COMPUTADORA")
    marca = models.ForeignKey("inventario.Marca", on_delete=models.SET_NULL, null=True, blank=True, related_name="equipos_cliente")
    modelo = models.ForeignKey("inventario.Modelo", on_delete=models.SET_NULL, null=True, blank=True, related_name="equipos_cliente")
    color = models.CharField(max_length=50, blank=True)
    no_serie = models.CharField(max_length=100, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado_en"]

    def __str__(self):
        partes = " ".join(p for p in [self.marca.nombre if self.marca else "", self.modelo.nombre if self.modelo else ""] if p)
        return partes or f"Equipo #{self.id}"


def resolver_marca_modelo(marca_texto, modelo_texto):
    """Homogeneiza marca/modelo de texto libre contra el catálogo único de
    inventario.Marca/Modelo (mismo catálogo que usa Productos), para que
    todo el sistema hable de las mismas marcas en vez de variantes sueltas
    por cada formulario."""
    from inventario.models import Marca, Modelo
    marca_norm = " ".join((marca_texto or "").strip().split())
    modelo_norm = " ".join((modelo_texto or "").strip().split())
    marca_obj = None
    if marca_norm:
        # Case-insensitive: si ya existe "SAMSUNG" y alguien escribe
        # "samsung", debe reusar la misma marca en vez de crear una
        # variante nueva (así se pobló el catálogo real por Excel, en
        # mayúsculas, y no queremos que un formulario nuevo lo duplique).
        marca_obj = Marca.objects.filter(nombre__iexact=marca_norm).first()
        if marca_obj is None:
            marca_obj = Marca.objects.create(nombre=marca_norm)
    modelo_obj = None
    if modelo_norm and marca_obj:
        modelo_obj = Modelo.objects.filter(marca=marca_obj, nombre__iexact=modelo_norm).first()
        if modelo_obj is None:
            modelo_obj = Modelo.objects.create(marca=marca_obj, nombre=modelo_norm)
    return marca_obj, modelo_obj


def resolver_equipo(cliente, categoria_equipo, marca_texto, modelo_texto, color, no_serie):
    marca_obj, modelo_obj = resolver_marca_modelo(marca_texto, modelo_texto)
    no_serie_norm = (no_serie or "").strip()
    if no_serie_norm:
        # Con n.º de serie es un match exacto e inequívoco.
        existente = Equipo.objects.filter(cliente=cliente, marca=marca_obj, modelo=modelo_obj, no_serie=no_serie_norm).first()
        if existente:
            return existente
    elif marca_obj and modelo_obj:
        # Sin serie: solo se reutiliza el mismo Equipo si hay EXACTAMENTE
        # una coincidencia previa para este cliente+marca+modelo (si hay
        # varias ya sería ambiguo — mejor crear uno nuevo que adivinar mal).
        candidatos = list(Equipo.objects.filter(cliente=cliente, marca=marca_obj, modelo=modelo_obj, no_serie="")[:2])
        if len(candidatos) == 1:
            return candidatos[0]
    return Equipo.objects.create(
        cliente=cliente, categoria_equipo=categoria_equipo or "COMPUTADORA",
        marca=marca_obj, modelo=modelo_obj, color=(color or "").strip(), no_serie=no_serie_norm,
    )


class Factura(models.Model):
    ESTADO_CHOICES = [
        ("PENDIENTE", "Pendiente"),
        ("PAGADA", "Pagada"),
        ("ANULADA", "Anulada"),
    ]

    numero = models.CharField(max_length=30, unique=True)
    cliente = models.ForeignKey(Cliente, on_delete=models.PROTECT, related_name="facturas")
    vendedor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="ventas_realizadas")
    fecha = models.DateField(auto_now_add=True)
    estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default="PENDIENTE")
    # Moneda en la que el cliente pagó realmente esta venta. `total` queda
    # en esa moneda (lo que cuadra contra la caja); `total_usd` es el mismo
    # monto convertido al tipo de cambio vigente AL MOMENTO de la venta
    # (congelado en tasa_cambio_aplicada), para que los reportes puedan
    # sumar en una sola unidad sin importar en qué moneda pagó cada cliente.
    moneda = models.CharField(max_length=3, choices=MONEDA_CHOICES, default="USD")
    tasa_cambio_aplicada = models.DecimalField(max_digits=8, decimal_places=4, default=1)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_usd = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        ordering = ["-fecha", "-id"]

    def recalcular_total(self):
        self.total = sum(d.subtotal for d in self.detalles.all())
        tasa = self.tasa_cambio_aplicada or 1
        self.total_usd = self.total if self.moneda == "USD" else (self.total / tasa if tasa else 0)
        self.save(update_fields=["total", "total_usd"])

    @property
    def total_pagado(self):
        return sum((p.monto for p in self.pagos.all()), start=0) if self.pk else 0

    @property
    def saldo_pendiente(self):
        return self.total - self.total_pagado

    def recalcular_estado(self):
        # PAGADA solo cuando la suma de pagos cubre el total; si queda un
        # saldo (venta al crédito, parcial o sin abono), se mantiene
        # PENDIENTE y se refleja en Cuentas por Cobrar — ver Pago.save().
        if self.estado != "ANULADA":
            self.estado = "PAGADA" if self.total_pagado >= self.total else "PENDIENTE"
            self.save(update_fields=["estado"])

    def sincronizar_cuenta_por_cobrar(self):
        from datetime import date, timedelta
        from contabilidad.models import CuentaPorCobrar
        saldo = self.saldo_pendiente
        cxc = CuentaPorCobrar.objects.filter(factura=self).first()
        if saldo > 0 and self.estado != "ANULADA":
            if cxc:
                cxc.monto = saldo
                cxc.estado = "PENDIENTE"
                cxc.save(update_fields=["monto", "estado"])
            else:
                CuentaPorCobrar.objects.create(
                    cliente=self.cliente, factura=self, monto=saldo,
                    fecha_vencimiento=date.today() + timedelta(days=30),
                )
        elif cxc:
            cxc.estado = "PAGADO"
            cxc.save(update_fields=["estado"])

    def __str__(self):
        return f"Factura {self.numero} - {self.cliente.nombre}"


class Pago(models.Model):
    """Un abono a una factura. Puede haber varios por factura (pago mixto:
    parte efectivo, parte tarjeta) y no es obligatorio que sumen el total
    (venta a crédito) — ver Factura.recalcular_estado/sincronizar_cuenta_por_cobrar."""
    METODO_CHOICES = [
        ("EFECTIVO", "Efectivo"),
        ("TARJETA", "Tarjeta"),
        ("CREDEX", "Credex"),
        ("TASA_CERO", "Tasa Cero"),
        ("LINEA_CREDITO", "Línea de Crédito"),
    ]

    factura = models.ForeignKey(Factura, on_delete=models.CASCADE, related_name="pagos")
    metodo = models.CharField(max_length=20, choices=METODO_CHOICES)
    monto = models.DecimalField(max_digits=12, decimal_places=2, help_text="Monto aplicado a la factura, en la moneda de la factura")
    # Solo aplica a EFECTIVO: lo que el cliente entregó en mano, para poder
    # calcular y dejar constancia del vuelto (con tarjeta no hay vuelto).
    monto_recibido = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    # Solo aplican a CREDEX/TASA_CERO/LINEA_CREDITO — quedan vacíos para
    # EFECTIVO/TARJETA. No se validan por método a propósito: cada negocio
    # los llena distinto (a veces la línea de crédito también corre en
    # cuotas), mejor dejar la casilla libre que bloquear el cobro.
    cuotas = models.PositiveIntegerField(null=True, blank=True, help_text="Número de cuotas, si aplica")
    banco = models.CharField(max_length=100, blank=True, help_text="Banco o financiera, si aplica")
    referencia = models.CharField(max_length=100, blank=True, help_text="N.º de autorización, referencia o últimos dígitos")
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["creado_en"]

    @property
    def vuelto(self):
        if self.metodo != "EFECTIVO" or self.monto_recibido is None:
            return 0
        return max(self.monto_recibido - self.monto, 0)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.factura.recalcular_estado()
        self.factura.sincronizar_cuenta_por_cobrar()

    def __str__(self):
        return f"{self.factura.numero} - {self.metodo} {self.monto}"


class DetalleFactura(models.Model):
    factura = models.ForeignKey(Factura, on_delete=models.CASCADE, related_name="detalles")
    tipo = models.CharField(max_length=10, choices=TIPO_ITEM_CHOICES, default="PRODUCTO")

    # Para tipo PRODUCTO
    producto = models.ForeignKey(Producto, on_delete=models.PROTECT, null=True, blank=True)

    # Para tipo SERVICIO (mantenimiento / diagnóstico / reparación) -> genera orden de taller
    servicio_tipo = models.CharField(max_length=20, choices=SERVICIO_CHOICES, null=True, blank=True)
    equipo_descripcion = models.CharField(max_length=200, blank=True, help_text="Ej. iPhone 12, Laptop Dell Inspiron")

    # Ficha de recepción del equipo (Orden de Recepción y Trabajo)
    categoria_equipo = models.CharField(max_length=20, choices=CATEGORIA_EQUIPO_CHOICES, blank=True)
    marca = models.CharField(max_length=100, blank=True)
    modelo = models.CharField(max_length=100, blank=True)
    color = models.CharField(max_length=50, blank=True)
    no_serie = models.CharField(max_length=100, blank=True)
    especificaciones = models.JSONField(default=dict, blank=True)
    accesorios = models.CharField(max_length=255, blank=True)
    contrasena_equipo = models.CharField(max_length=100, blank=True)
    checklist_entrada = models.JSONField(default=dict, blank=True)
    adelanto = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    moneda = models.CharField(max_length=3, choices=MONEDA_CHOICES, default="USD")
    como_supo = models.CharField(max_length=50, blank=True)

    descripcion = models.CharField(max_length=200, blank=True)
    # Decimal, no entero: productos que se venden por unidad de medida
    # fraccionable (ej. 8 gramos de pasta térmica, medio paquete) necesitan
    # cantidades no enteras.
    cantidad = models.DecimalField(max_digits=10, decimal_places=3, default=1)
    precio_unitario = models.DecimalField(max_digits=12, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        self.subtotal = self.cantidad * self.precio_unitario
        super().save(*args, **kwargs)
        self.factura.recalcular_total()

        if is_new and self.tipo == "SERVICIO":
            from taller.models import OrdenTaller
            equipo_vinculado = resolver_equipo(
                self.factura.cliente, self.categoria_equipo, self.marca, self.modelo, self.color, self.no_serie,
            )
            OrdenTaller.objects.create(
                numero=f"OT-{self.factura.numero}-{self.id}",
                cliente=self.factura.cliente,
                equipo=self.equipo_descripcion or self.descripcion or "Equipo sin especificar",
                equipo_vinculado=equipo_vinculado,
                categoria_equipo=self.categoria_equipo or "COMPUTADORA",
                marca=self.marca,
                modelo=self.modelo,
                color=self.color,
                no_serie=self.no_serie,
                especificaciones=self.especificaciones,
                accesorios=self.accesorios,
                contrasena_equipo=self.contrasena_equipo,
                checklist_entrada=self.checklist_entrada,
                adelanto=self.adelanto,
                moneda=self.moneda,
                como_supo=self.como_supo,
                tipo_servicio=self.servicio_tipo,
                problema_reportado=self.descripcion,
                estado="RECIBIDO",
                costo_estimado=self.precio_unitario,
                vendedor=self.factura.vendedor,
                origen_venta=self,
            )

    def __str__(self):
        if self.tipo == "SERVICIO":
            return f"{self.get_servicio_tipo_display()} - {self.equipo_descripcion}"
        return f"{self.producto.nombre if self.producto else self.descripcion} x{self.cantidad}"
