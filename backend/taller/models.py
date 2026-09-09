from datetime import date
from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User
from core.choices import (
    SERVICIO_CHOICES, CATEGORIA_EQUIPO_CHOICES, MONEDA_CHOICES, ESTADO_EQUIPO_CHOICES,
    OPERADORA_CHOICES, FORMA_PAGO_CHOICES, ESTADO_ORDEN_CHOICES, CATEGORIA_EQUIPO_CCA,
    TIPO_EQUIPO_COM_CHOICES, TIPO_ALMACENAMIENTO_CHOICES, TIPO_CONECTOR_DISCO_CHOICES,
    ESTADO_ENCENDIDO_CHOICES,
)
from ventas.models import Cliente, Equipo
from rrhh.models import Empleado
from inventario.models import Producto


class OrdenTaller(models.Model):
    ESTADO_CHOICES = ESTADO_ORDEN_CHOICES

    # blank=True: el asistente de creación ya no arma un número provisional
    # en el frontend (lo asigna perform_create() al guardar), así que llega
    # vacío en el payload — sin esto, la validación del serializer lo
    # rechazaba antes de que perform_create() pudiera sobreescribirlo.
    numero = models.CharField(max_length=30, unique=True, blank=True)
    cliente = models.ForeignKey(Cliente, on_delete=models.PROTECT, related_name="ordenes_taller")
    equipo = models.CharField(max_length=200, help_text="Ej. Laptop HP Pavilion 14 / iPhone 12")
    # Vínculo real al equipo físico del cliente (expediente): se resuelve
    # automáticamente al crear la OT desde ventas.resolver_equipo(). El
    # campo `equipo` de arriba se mantiene como resumen de texto para no
    # romper el formulario/impresión existente.
    equipo_vinculado = models.ForeignKey(Equipo, on_delete=models.SET_NULL, null=True, blank=True, related_name="ordenes")
    categoria_equipo = models.CharField(max_length=20, choices=CATEGORIA_EQUIPO_CHOICES, default="COMPUTADORA")
    tipo_servicio = models.CharField(max_length=20, choices=SERVICIO_CHOICES, null=True, blank=True)
    problema_reportado = models.TextField(blank=True)
    # Lo que el ASESOR le pide al técnico (a diferencia de
    # problema_reportado, que es lo que dice el CLIENTE) — va impreso en
    # la orden junto a la falla reportada, para que el técnico vea ambas
    # cosas de un vistazo.
    instrucciones_asesor = models.TextField(blank=True, verbose_name="Detalles del servicio")
    tecnico = models.ForeignKey(Empleado, on_delete=models.SET_NULL, null=True, blank=True, related_name="ordenes_taller")
    # Asesor de ventas que atendió/cerró la orden — distinto de `vendedor`
    # (el usuario logueado que guardó el registro): permite dar crédito de
    # venta a la persona correcta aunque otro compañero haya digitado la
    # orden en el sistema.
    asesor = models.ForeignKey(Empleado, on_delete=models.SET_NULL, null=True, blank=True, related_name="ordenes_como_asesor")
    estado = models.CharField(max_length=30, choices=ESTADO_CHOICES, default="RECIBIDO")
    fecha_ingreso = models.DateField(auto_now_add=True)
    # Fecha/hora exacta de recepción del equipo — a diferencia de
    # fecha_ingreso (auto_now_add, solo fecha, nunca editable), este campo
    # sí lo captura/ajusta el usuario y sirve para medir tiempos reales de
    # atención al técnico.
    fecha_hora_recepcion = models.DateTimeField(null=True, blank=True)
    fecha_entrega_estimada = models.DateField(null=True, blank=True)
    fecha_entrega_real = models.DateField(null=True, blank=True)
    # Hora exacta de entrega (además de fecha_entrega_real, que es solo
    # fecha) — para que Backoffice pueda medir cuánto tardó cada equipo
    # desde que entró hasta que salió, no solo en qué día.
    fecha_hora_entrega_real = models.DateTimeField(null=True, blank=True)
    # Cuánto se estima que tardará la reparación (texto libre: "2 días",
    # "24 horas") — para que Gerencia pueda dar seguimiento a si el
    # técnico se atrasa respecto a lo prometido.
    tiempo_reparacion_estimado = models.CharField(max_length=100, blank=True)
    costo_estimado = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notas = models.TextField(blank=True)
    # Aparte de `notas` (que ya trae historial real de recepción/diagnóstico
    # en muchas órdenes) — qué repuestos se le sacaron a un equipo en estado
    # ABANDONADO. Iba pisando `notas` antes; ahora tiene su propio campo.
    repuestos_extraidos_abandono = models.TextField(blank=True)

    # 2.- Detalles de recepción — información del equipo (visible para el técnico)
    marca = models.CharField(max_length=100, blank=True)
    modelo = models.CharField(max_length=100, blank=True)
    color = models.CharField(max_length=50, blank=True)
    capacidad = models.CharField(max_length=50, blank=True)
    estado_general = models.CharField(max_length=20, choices=ESTADO_EQUIPO_CHOICES, blank=True)
    no_serie = models.CharField(max_length=100, blank=True)
    especificaciones = models.JSONField(default=dict, blank=True)

    # Información técnica
    imei1 = models.CharField(max_length=30, blank=True, verbose_name="IMEI 1")
    imei2 = models.CharField(max_length=30, blank=True, verbose_name="IMEI 2")
    numero_chip = models.CharField(max_length=30, blank=True)
    encendido = models.CharField(max_length=20, choices=ESTADO_ENCENDIDO_CHOICES, blank=True)
    sistema_operativo = models.CharField(max_length=100, blank=True)
    operadora_equipo = models.CharField(max_length=10, choices=OPERADORA_CHOICES, blank=True)
    bateria_original = models.BooleanField(null=True, blank=True)
    camara_funciona = models.BooleanField(null=True, blank=True)

    accesorios = models.CharField(max_length=255, blank=True)
    contrasena_equipo = models.CharField(max_length=100, blank=True)
    sin_contrasena = models.BooleanField(default=False, help_text="El cliente no proporciona la contraseña del equipo")
    patron_desbloqueo = models.JSONField(default=list, blank=True, help_text="Secuencia de puntos 0-8")
    danos_visibles = models.JSONField(default=list, blank=True, help_text="Puntos marcados sobre el diagrama del equipo")
    estado_equipo_notas = models.TextField(blank=True)
    comentarios = models.TextField(blank=True)

    checklist_entrada = models.JSONField(default=dict, blank=True)
    checklist_salida = models.JSONField(default=dict, blank=True)
    # Si el equipo llegó apagado, el checklist técnico de entrada no se
    # puede verificar (no hay forma de probar WiFi, cámara, teclado, etc.
    # sin encenderlo) — la UI lo deshabilita cuando esto está marcado.
    equipo_apagado_recepcion = models.BooleanField(default=False)

    # Tipo de servicio (multi-selección)
    tipos_servicio = models.JSONField(default=list, blank=True)
    tipos_servicio_otro = models.CharField(max_length=200, blank=True)

    # 3.- Diagnóstico y presupuesto
    diagnostico = models.TextField(blank=True)
    recomendaciones = models.TextField(blank=True)
    repuestos = models.JSONField(default=list, blank=True, help_text="[{descripcion, tipo, precio}]")
    necesita_repuestos = models.BooleanField(default=False)
    # Si el repuesto necesario ya está disponible de inmediato, se factura
    # junto con el resto del servicio en un solo cobro (en vez de dejarlo
    # pendiente para una compra/orden aparte).
    repuesto_inmediato = models.BooleanField(default=False)
    forma_pago = models.CharField(max_length=10, choices=FORMA_PAGO_CHOICES, blank=True)
    servicios_realizados = models.JSONField(default=list, blank=True, help_text="[{descripcion, precio}]")
    descuento = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    impuestos = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # 4.- Entrega
    recibe = models.CharField(max_length=200, blank=True)
    aceptacion_cliente = models.BooleanField(default=False)
    # Dos firmas del cliente, no una del cliente y otra del técnico: una al
    # dejar el equipo (acepta términos/garantía = "Leí y entendí") y otra al
    # retirarlo ya reparado ("Recibí conforme").
    firma_cliente = models.TextField(blank=True, help_text="Firma del cliente al recibir el equipo (Leí y entendí) — imagen base64")
    firma_cliente_entrega = models.TextField(blank=True, help_text="Firma del cliente al retirar el equipo (Recibí conforme) — imagen base64")
    firma_tecnico = models.TextField(blank=True, help_text="Imagen de firma en base64")

    # 5.- Observaciones
    observaciones = models.TextField(blank=True)

    # Datos comerciales — NO visibles para el técnico
    adelanto = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    moneda = models.CharField(max_length=3, choices=MONEDA_CHOICES, default="USD")
    vendedor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="ordenes_vendidas")
    como_supo = models.CharField(max_length=50, blank=True)

    origen_venta = models.OneToOneField(
        "ventas.DetalleFactura", on_delete=models.SET_NULL, null=True, blank=True, related_name="orden_generada"
    )

    class Meta:
        ordering = ["-fecha_ingreso", "-id"]

    @property
    def tipo_orden(self):
        """CCA (celular/tablet) o COM (computadora/otro): cada tipo tiene su propio
        flujo de campos técnicos y checklist (ver frontend ordenTipo.js)."""
        return "CCA" if self.categoria_equipo in CATEGORIA_EQUIPO_CCA else "COM"

    @property
    def total_repuestos(self):
        return sum(float(r.get("precio") or 0) for r in (self.repuestos or []))

    @property
    def total_servicios(self):
        return sum(float(s.get("precio") or 0) for s in (self.servicios_realizados or []))

    @property
    def total_final(self):
        base = self.total_repuestos + self.total_servicios
        if base <= 0:
            base = float(self.costo_estimado or 0)
        return base - float(self.descuento or 0) + float(self.impuestos or 0)

    # --- Plazo de retiro / resguardo / abandono (ver checklist:legal.garantia,
    # que ya avisa al cliente de estos mismos plazos en la orden impresa) ---
    DIAS_GRACIA_RETIRO = 45
    DIAS_LIMITE_ABANDONO = 66
    CARGO_RESGUARDO_DIARIO = 100  # córdobas/día, entre el día 46 y el 66

    @property
    def fecha_listo(self):
        """Fecha en que el equipo pasó a LISTO_ENTREGA por última vez —
        de ahí arranca el plazo de 45 días, no de fecha_ingreso."""
        h = self.historial.filter(estado_nuevo="LISTO_ENTREGA").order_by("-fecha").first()
        return h.fecha.date() if h else None

    @property
    def dias_en_espera(self):
        """Días transcurridos desde que quedó listo. Solo tiene sentido
        mientras el equipo sigue sin ser retirado (LISTO_ENTREGA) o quedó
        abandonado (ahí se congela al día en que se marcó como tal)."""
        if self.estado not in ("LISTO_ENTREGA", "ABANDONADO"):
            return None
        inicio = self.fecha_listo
        if not inicio:
            return None
        if self.estado == "ABANDONADO":
            h = self.historial.filter(estado_nuevo="ABANDONADO").order_by("-fecha").first()
            fin = h.fecha.date() if h else date.today()
        else:
            fin = date.today()
        return (fin - inicio).days

    @property
    def cargo_resguardo(self):
        """Cobro acumulado por resguardo (córdobas): 0 durante los primeros
        45 días de gracia, C$100/día entre el 46 y el 66."""
        dias = self.dias_en_espera
        if not dias or dias <= self.DIAS_GRACIA_RETIRO:
            return 0
        dias_cobrables = min(dias, self.DIAS_LIMITE_ABANDONO) - self.DIAS_GRACIA_RETIRO
        return dias_cobrables * self.CARGO_RESGUARDO_DIARIO

    @property
    def vencido_para_abandono(self):
        dias = self.dias_en_espera
        return self.estado == "LISTO_ENTREGA" and dias is not None and dias > self.DIAS_LIMITE_ABANDONO

    def verificar_abandono(self):
        """Si superó el plazo sin que lo retiraran, lo pasa a ABANDONADO —
        se llama de forma perezosa (ver OrdenTallerViewSet.list) en vez de
        depender de una tarea programada de Windows, que este entorno no
        puede configurar solo."""
        if not self.vencido_para_abandono:
            return False
        anterior = self.estado
        self.estado = "ABANDONADO"
        self.save(update_fields=["estado"])
        HistorialEstado.objects.create(orden=self, estado_anterior=anterior, estado_nuevo="ABANDONADO", usuario=None)
        return True

    def save(self, *args, **kwargs):
        if self.estado == "ENTREGADO" and not self.fecha_entrega_real:
            self.fecha_entrega_real = date.today()
            self.fecha_hora_entrega_real = timezone.now()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.numero} - {self.equipo}"


class DetalleComputadora(models.Model):
    """Campos exclusivos de la Orden COM (computadoras/laptops/etc.).

    Vive en una tabla aparte en OneToOne con OrdenTaller para no mezclar
    campos con la Orden CCA (celulares): una orden CCA nunca tiene fila
    aquí. Ver OrdenTaller.tipo_orden.
    """

    orden = models.OneToOneField(OrdenTaller, on_delete=models.CASCADE, related_name="detalle_com")

    # 2.- Datos del equipo (específicos de cómputo)
    tipo_equipo = models.CharField(max_length=20, choices=TIPO_EQUIPO_COM_CHOICES, default="LAPTOP")
    procesador_generacion = models.CharField(max_length=150, blank=True)
    comprado_nuevo = models.BooleanField(null=True, blank=True)
    # Si el equipo llegó con su receptor USB de mouse inalámbrico —
    # distinto de "componentes.receptor_inalambrico" (que es sobre si ESE
    # periférico FUNCIONA en el checklist técnico); esto es solo si lo
    # trajo o no, para no perderlo si el cliente no lo entrega.
    trae_receptor_mouse = models.BooleanField(null=True, blank=True)

    # Estado físico por componente: {pantalla, carcasa, teclado, touchpad,
    # bisagras, puertos, cargador} -> BUENO/MALO/REGULAR (ESTADO_EQUIPO_CHOICES)
    estado_fisico = models.JSONField(default=dict, blank=True)

    # Especificaciones del equipo
    ram_tipo = models.CharField(max_length=50, blank=True)
    ram_frecuencia = models.CharField(max_length=50, blank=True)
    ram_slots = models.CharField(max_length=50, blank=True)
    disco_capacidad = models.CharField(max_length=50, blank=True)
    tipo_almacenamiento = models.CharField(max_length=10, choices=TIPO_ALMACENAMIENTO_CHOICES, blank=True)
    marca_disco = models.CharField(max_length=100, blank=True)
    serial_disco = models.CharField(max_length=100, blank=True)
    tipo_conector = models.CharField(max_length=10, choices=TIPO_CONECTOR_DISCO_CHOICES, blank=True)

    # Componentes y periféricos: {bateria, cargador, adaptador,
    # receptor_inalambrico, camara, microfono, wifi, bluetooth, usb, hdmi,
    # ethernet, audio, lector_sd, otros} -> ESTADO_COMPONENTE_CHOICES
    componentes = models.JSONField(default=dict, blank=True)

    # Accesorios recibidos con detalle: [{nombre, estado_serial}]
    accesorios_detalle = models.JSONField(default=list, blank=True)

    # 1.- Datos del cliente / recepción (específicos de cómputo)
    empresa_controla_software = models.BooleanField(null=True, blank=True)
    primera_vez = models.BooleanField(null=True, blank=True)
    # ¿El cliente pide que se respalde la información del disco antes de
    # intervenir el equipo?
    respaldo_solicitado = models.BooleanField(null=True, blank=True)
    bitlocker_activo = models.BooleanField(null=True, blank=True)
    bitlocker_clave = models.CharField(max_length=255, blank=True, verbose_name="Clave de recuperación BitLocker")

    # Software / sistema operativo: {version, licencia, office, antivirus, programas, observaciones}
    software = models.JSONField(default=dict, blank=True)

    # Checklist técnico de entrada por categorías: {item: OK/FALLA/NO_APLICA/NO_PROBADO}
    checklist_entrada = models.JSONField(default=dict, blank=True)

    tecnico_recibe = models.ForeignKey(
        "rrhh.Empleado", on_delete=models.SET_NULL, null=True, blank=True, related_name="detalles_com_recibidos"
    )
    tecnico_entrega = models.ForeignKey(
        "rrhh.Empleado", on_delete=models.SET_NULL, null=True, blank=True, related_name="detalles_com_entregados"
    )

    def __str__(self):
        return f"Detalle COM · {self.orden.numero}"


class DiagnosticoOrden(models.Model):
    """Un diagnóstico registrado sobre la orden — a diferencia del viejo
    campo OrdenTaller.diagnostico (un solo texto que se sobrescribía), acá
    puede haber varios en el tiempo: si ya hay un diagnóstico y aparece algo
    nuevo, se agrega uno más sin perder el anterior. Cada uno puede traer
    sus propias fotos (ver FotoEquipo.diagnostico_orden), hasta 100 — ver
    MAX_FOTOS_POR_DIAGNOSTICO en views.py."""

    orden = models.ForeignKey(OrdenTaller, on_delete=models.CASCADE, related_name="diagnosticos")
    texto = models.TextField()
    tecnico = models.ForeignKey(Empleado, on_delete=models.SET_NULL, null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado_en"]

    def __str__(self):
        return f"Diagnóstico {self.orden.numero} · {self.creado_en:%Y-%m-%d}"


class FotoEquipo(models.Model):
    MOMENTO_CHOICES = [("RECEPCION", "Recepción"), ("DIAGNOSTICO", "Diagnóstico"), ("ENTREGA", "Entrega")]

    orden = models.ForeignKey(OrdenTaller, on_delete=models.CASCADE, related_name="fotos")
    imagen = models.ImageField(upload_to="ordenes/fotos/")
    momento = models.CharField(max_length=11, choices=MOMENTO_CHOICES, default="RECEPCION")
    # Solo se usa cuando momento=DIAGNOSTICO y la foto pertenece a un
    # diagnóstico puntual (ver DiagnosticoOrden) — nulo para fotos viejas o
    # de recepción/entrega, que siguen colgando directo de la orden.
    diagnostico_orden = models.ForeignKey(DiagnosticoOrden, on_delete=models.CASCADE, null=True, blank=True, related_name="fotos")
    subida_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-subida_en"]

    def __str__(self):
        return f"Foto {self.orden.numero} ({self.get_momento_display()})"


class HistorialEstado(models.Model):
    orden = models.ForeignKey(OrdenTaller, on_delete=models.CASCADE, related_name="historial")
    estado_anterior = models.CharField(max_length=30, blank=True)
    estado_nuevo = models.CharField(max_length=30)
    usuario = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-fecha"]

    def __str__(self):
        return f"{self.orden.numero}: {self.estado_anterior} → {self.estado_nuevo}"


class InsumoUsado(models.Model):
    orden = models.ForeignKey(OrdenTaller, on_delete=models.CASCADE, related_name="insumos")
    producto = models.ForeignKey(Producto, on_delete=models.PROTECT)
    cantidad = models.PositiveIntegerField(default=1)

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        super().save(*args, **kwargs)
        if is_new:
            self.producto.stock_actual -= self.cantidad
            self.producto.save(update_fields=["stock_actual"])

    def __str__(self):
        return f"{self.producto.nombre} x{self.cantidad}"
