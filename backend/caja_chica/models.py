from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import models

from core.models import Configuracion

# Límites de filas del formato real de arqueo (compras/../plantilla Excel):
# las fórmulas de la plantilla (SUMIF, COUNT, SUM) apuntan a rangos de celda
# fijos — un ítem de más se quedaría fuera de la suma sin que se note, así
# que se valida acá antes de guardar. No se pueden ampliar sin también
# ampliar los rangos de fórmulas en la plantilla.
MAX_CREDITOS = 7
MAX_INGRESOS_VENTAS = 15
MAX_GASTOS_CAJA_CHICA = 10
MAX_VENTAS_POR_VENDEDOR = 4
MAX_EQUIPOS_POR_VENDEDOR = 3

# Una caja no puede cerrarse si no se abrió primero: "Abrir caja" crea el
# registro solo con fecha + caja chica inicial (estado ABIERTA); "Cerrar
# caja" llena el resto del formulario y pasa el registro a CERRADA. Ver
# caja_chica/views.py (perform_create/perform_update).
ESTADO_CHOICES = [
    ("ABIERTA", "Abierta"),
    ("CERRADA", "Cerrada"),
]


class ArqueoCaja(models.Model):
    """Cierre / arqueo diario de caja — replica exactamente el 'FORMATO
    ARQUEO DIARIO DE CAJA' en Excel que ya usa RCP (ver
    caja_chica/plantillas_excel/arqueo_caja.xlsx). Cada instancia es UN
    cierre (un día). Los campos de acá abajo son los que la plantilla real
    llena a mano cada día; los totales, sumas y diferencias (TOTAL A,
    TOTAL B, B-A, TICKET PROM., etc.) los sigue calculando el Excel con sus
    propias fórmulas — este modelo nunca los recalcula ni los guarda, para
    no arriesgarse a que un cálculo hecho aparte en Python se desalinee del
    que ya usa y confía el negocio.

    Nace en estado ABIERTA (solo fecha + caja chica inicial) y pasa a
    CERRADA cuando alguien completa el resto del formulario — una caja no
    puede cerrarse sin haberse abierto primero."""

    # Un arqueo por día: no tiene sentido abrir dos cajas la misma fecha —
    # si hace falta corregir algo, se edita el arqueo de ese día, no se crea
    # otro.
    fecha = models.DateField(unique=True, verbose_name="Fecha del cierre")
    estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default="ABIERTA")

    # ---------- Columna izquierda (TOTAL A — lo que "debió" entrar según ventas) ----------
    # La plantilla real es en dólares (F4 alimenta TOTAL A = SUM(F4:F10), ver
    # arqueo_excel.py) y solo tiene una celda para esto — por eso el monto en
    # córdobas se guarda aparte acá y se convierte a dólares recién al
    # exportar (con el tipo de cambio del día), en vez de agregarle una fila
    # nueva a la plantilla real y arriesgar desalinear sus fórmulas.
    caja_chica_inicial = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="Caja chica inicial (dólares)")
    caja_chica_inicial_cordobas = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="Caja chica inicial (córdobas)")

    # ---------- Columna derecha (TOTAL B — lo que realmente se cerró/contó
    # por cada canal). "+ Efectivo en Caja" no está acá: sale solo del
    # conteo físico de billetes (hoja "efectivo"). "+ Gastos caja chica"
    # tampoco: sale solo de la tabla de gastos de abajo. ----------
    pagos_cheque_cierre = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="Pagos con cheque (cierre)")
    pagos_transferencia_cierre = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="Pagos en transferencia (cierre)")
    compras_credex_cierre = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="Compras con CREDEX (cierre)")
    cierre_pos = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="Cierre en POS")
    creditos_cierre = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="Créditos (cierre)")

    # ---------- Créditos pendientes (snapshot del día — máx. 7 filas) ----------
    # Cada ítem: {"cliente": str, "factura": str, "ot": str, "monto": number, "vence": "YYYY-MM-DD"}
    creditos = models.JSONField(default=list, blank=True)

    # ---------- (X) Ingresos por ventas del día (máx. 15 filas) ----------
    # Cada ítem: {"descripcion": str, "monto": number, "tipo": str (Efect./Cheque/Transf./POS/Crédito/Credex),
    #             "banco": str, "factura": str, "ots": str, "vendedor": str, "empresa": "SI"/"NO"}
    ingresos_ventas = models.JSONField(default=list, blank=True)

    # ---------- (Y) Gastos de caja chica del día (máx. 10 filas) ----------
    # Cada ítem: {"descripcion": str, "monto": number}
    gastos_caja_chica = models.JSONField(default=list, blank=True)

    recibos_caja_utilizados = models.CharField(max_length=255, blank=True, verbose_name="Recibos de caja utilizados")
    comentarios = models.TextField(blank=True)

    # ---------- Detalle de ventas del día — columna "ANTERIOR" ----------
    # (el "ACUM." lo suma la fórmula sola: ANTERIOR + hoy)
    ventas_dia_anterior = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_com_anterior = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_cca_anterior = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    repuestos_uso_interno_anterior = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    rep_acc_insumo_externa_anterior = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="Repuestos/accesorios/insumos venta externa (anterior)")
    computadoras_anterior = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # ---------- Detalle de ventas por vendedor (máx. 4 filas fijas) ----------
    # Cada ítem: {"vendedor": str, "acumulado_semanal": number, "semana_anterior": number}
    # "Venta del día" y "Acumulado MES" los calcula la fórmula sola (SUMIF
    # contra ingresos_ventas por nombre de vendedor).
    ventas_por_vendedor = models.JSONField(default=list, blank=True)
    meta_semanal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    meta_mensual = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # ---------- Equipos recibidos por día, por vendedor (máx. 3 filas fijas) ----------
    # Cada ítem: {"vendedor": str, "clientes_atendidos": int, "com": int, "cca": int, "repuestos": int}
    equipos_por_vendedor = models.JSONField(default=list, blank=True)

    # ---------- Proyección de cierre ----------
    dia_del_mes = models.PositiveIntegerField(default=1)
    dias_mes = models.PositiveIntegerField(default=30)
    tipo_cambio = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)

    # ---------- Conteo físico de efectivo (hoja "efectivo" de la plantilla) ----------
    billetes_usd_100 = models.PositiveIntegerField(default=0)
    billetes_usd_50 = models.PositiveIntegerField(default=0)
    billetes_usd_20 = models.PositiveIntegerField(default=0)
    billetes_usd_10 = models.PositiveIntegerField(default=0)
    billetes_usd_5 = models.PositiveIntegerField(default=0)
    billetes_usd_1 = models.PositiveIntegerField(default=0)
    billetes_nio_1000 = models.PositiveIntegerField(default=0)
    billetes_nio_500 = models.PositiveIntegerField(default=0)
    billetes_nio_200 = models.PositiveIntegerField(default=0)
    billetes_nio_100 = models.PositiveIntegerField(default=0)
    billetes_nio_50 = models.PositiveIntegerField(default=0)
    billetes_nio_20 = models.PositiveIntegerField(default=0)
    billetes_nio_10 = models.PositiveIntegerField(default=0)
    billetes_nio_5 = models.PositiveIntegerField(default=0)
    billetes_nio_1 = models.PositiveIntegerField(default=0)

    # "creado_por/creado_en" = quién abrió la caja y cuándo (el registro nace
    # en el momento de la apertura). "cerrada_por/cerrada_en" queda vacío
    # hasta que alguien completa el cierre — puede ser una persona distinta
    # a quien abrió.
    creado_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="arqueos_caja")
    creado_en = models.DateTimeField(auto_now_add=True)
    cerrada_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="arqueos_cerrados")
    cerrada_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Arqueo de caja"
        verbose_name_plural = "Arqueos de caja"
        ordering = ["-fecha", "-id"]

    def __str__(self):
        return f"Arqueo {self.fecha}"

    def clean(self):
        errores = {}
        if len(self.creditos or []) > MAX_CREDITOS:
            errores["creditos"] = f"La plantilla solo tiene espacio para {MAX_CREDITOS} créditos."
        if len(self.ingresos_ventas or []) > MAX_INGRESOS_VENTAS:
            errores["ingresos_ventas"] = f"La plantilla solo tiene espacio para {MAX_INGRESOS_VENTAS} ingresos."
        if len(self.gastos_caja_chica or []) > MAX_GASTOS_CAJA_CHICA:
            errores["gastos_caja_chica"] = f"La plantilla solo tiene espacio para {MAX_GASTOS_CAJA_CHICA} gastos."
        if len(self.ventas_por_vendedor or []) > MAX_VENTAS_POR_VENDEDOR:
            errores["ventas_por_vendedor"] = f"La plantilla solo tiene espacio para {MAX_VENTAS_POR_VENDEDOR} vendedores en esta tabla."
        if len(self.equipos_por_vendedor or []) > MAX_EQUIPOS_POR_VENDEDOR:
            errores["equipos_por_vendedor"] = f"La plantilla solo tiene espacio para {MAX_EQUIPOS_POR_VENDEDOR} vendedores en esta tabla."
        if errores:
            raise ValidationError(errores)

    def save(self, *args, **kwargs):
        self.clean()
        if self.tipo_cambio is None:
            self.tipo_cambio = Configuracion.actual().tasa_cambio_usd
        super().save(*args, **kwargs)
