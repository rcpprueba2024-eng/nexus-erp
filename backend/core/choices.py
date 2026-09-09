ROLES = [
    ("TALLER", "Taller"),
    ("PASANTE", "Pasante de taller"),
    ("VENTAS", "Ventas"),
    ("RRHH", "Recursos Humanos"),
    ("BACKOFFICE", "Backoffice / Contabilidad"),
    ("JEFE_OPERACIONES", "Jefe de Operaciones"),
    ("ADMIN", "Gerencia General"),
]

IDIOMA_CHOICES = [
    ("es", "Español (Latinoamérica)"),
    ("en", "English (US)"),
    ("zh", "中文 (普通话)"),
    ("fr", "Français"),
]

TEMA_CHOICES = [
    ("auto", "Automático (según el sistema)"),
    ("claro", "Claro"),
    ("oscuro", "Oscuro"),
    ("medianoche", "Medianoche"),
    ("esmeralda", "Esmeralda"),
    ("ambar", "Ámbar"),
    ("blanco", "Blanco y negro"),
]

# Apartados del sistema que se pueden otorgar/quitar por usuario desde
# Configuración de Empresa. "configuracion" queda fuera a propósito: solo
# Gerencia (rol ADMIN) puede administrar usuarios, nunca es delegable.
MODULOS = [
    ("dashboard", "Panel"),
    ("ordenes", "Órdenes de Trabajo"),
    ("clientes", "Clientes"),
    ("inventario", "Inventario"),
    ("taller", "Taller"),
    ("ventas", "Ventas"),
    ("compras", "Compras"),
    ("contabilidad", "Contabilidad"),
    ("rrhh", "Recursos Humanos"),
    ("reportes", "Reportes"),
    ("gastos", "Gastos"),
    ("caja_chica", "Caja Chica"),
]

MODULOS_POR_ROL = {
    "ADMIN": [k for k, _ in MODULOS],
    # Taller y Pasante SOLO tienen acceso al apartado de Taller — nada de
    # Panel, Órdenes, Inventario, Compras ni Reportes. Ver App.jsx (el
    # tablero de técnicos dentro de Taller ya cubre ver/editar sus órdenes).
    # Pedido explícito: acceso al Arqueo/Cierre de Caja para Taller, Ventas
    # y RRHH además de Gerencia (que ya lo tiene por llevarse todos los
    # módulos arriba).
    "TALLER": ["taller", "caja_chica"],
    "PASANTE": ["taller"],
    "VENTAS": ["dashboard", "ordenes", "clientes", "inventario", "ventas", "reportes", "caja_chica"],
    "RRHH": ["dashboard", "rrhh", "reportes", "caja_chica"],
    # Backoffice analiza los procesos de la empresa: ve la lista de OTs
    # (con hora de ingreso/salida de cada equipo), factura OTs y ve el
    # registro de facturas, además de costos/insumos/productos/repuestos.
    # "taller" se conserva solo para que sus reportes (Flujo diario,
    # Reporte financiero) lean esos datos por API — App.jsx oculta el
    # tablero operativo de Taller (kanban de técnicos) para este rol
    # aunque el módulo siga otorgado; "ventas"/"ordenes" sí abren sus
    # páginas (OTs, facturación, registro de facturas) porque las necesita.
    "BACKOFFICE": ["dashboard", "ordenes", "taller", "ventas", "inventario", "compras", "contabilidad", "reportes", "gastos"],
    # Supervisor operativo por debajo de Gerencia: mismo alcance de módulos
    # que ADMIN (ve todo), pero sin el bypass especial de rol=="ADMIN" ni
    # acceso a Configuración de Usuarios (ver core.permissions.AdminOnly) —
    # eso se sigue reservando manualmente para el rol ADMIN.
    "JEFE_OPERACIONES": [k for k, _ in MODULOS],
}

TIPO_CLIENTE_CHOICES = [
    ("PARTICULAR", "Particular"),
    ("EMPRESA", "Empresa"),
    ("GOBIERNO", "Gobierno"),
    ("MAYORISTA", "Mayorista"),
    ("REVENDEDOR", "Revendedor"),
]

CATEGORIA_EQUIPO_CHOICES = [
    ("COMPUTADORA", "Computadora"),
    ("CELULAR", "Celular"),
    ("TABLET", "Tablet"),
    ("OTRO", "Otro"),
]

# Las órdenes de taller se procesan bajo dos flujos distintos según el
# equipo: CCA (celulares/tablets: IMEI, chip, operadora, patrón de
# desbloqueo) y COM (computadoras/otros: número de serie, especificaciones
# técnicas). Ver OrdenTaller.tipo_orden.
CATEGORIA_EQUIPO_CCA = ("CELULAR", "TABLET")
CATEGORIA_EQUIPO_COM = ("COMPUTADORA", "OTRO")

SERVICIO_CHOICES = [
    ("MANTENIMIENTO", "Mantenimiento"),
    ("DIAGNOSTICO", "Diagnóstico"),
    ("REPARACION", "Reparación"),
]

MONEDA_CHOICES = [
    ("USD", "Dólares (US$)"),
    ("NIO", "Córdobas (C$)"),
]

ESTADO_EQUIPO_CHOICES = [
    ("BUENO", "Bueno"),
    ("REGULAR", "Regular"),
    ("MALO", "Malo"),
    ("ENCIENDE_CON_FALLA", "Enciende con falla"),
]

OPERADORA_CHOICES = [
    ("CLARO", "Claro"),
    ("TIGO", "Tigo"),
]

FORMA_PAGO_CHOICES = [
    ("CREDITO", "Crédito"),
    ("CONTADO", "Contado"),
]

TIPO_REPUESTO_CHOICES = [
    ("ORIGINAL", "Original"),
    ("AAA", "AAA+"),
    ("COMPATIBLE", "Compatible"),
]

TIPO_SERVICIO_REALIZADO_CHOICES = [
    ("DIAGNOSTICO", "Diagnóstico"),
    ("MANTENIMIENTO_BASICO", "Mantenimiento básico"),
    ("MANTENIMIENTO_PREVENTIVO", "Mantenimiento preventivo"),
    ("MANTENIMIENTO_FULL", "Mantenimiento full"),
    ("REPARACION", "Reparación"),
    ("REPARACION_BISAGRA", "Reparación de bisagra"),
    ("CONFIGURACION", "Configuración"),
    ("DESBLOQUEO", "Desbloqueo"),
    ("FLASHEO", "Flasheo"),
    ("REINGRESO", "Reingreso"),
    ("OTRO", "Otro"),
]

# Escala de encendido capturada en la recepción del equipo — reemplaza al
# antiguo booleano "enciende sí/no", que no distinguía fallas parciales.
ESTADO_ENCENDIDO_CHOICES = [
    ("ENCIENDE_OK", "Enciende OK"),
    ("ENCIENDE_CON_FALLA", "Enciende con falla"),
    ("ENCIENDE_SIN_IMAGEN", "Enciende pero sin imagen"),
    ("NO_ENCIENDE", "No enciende"),
]

ESTADO_ORDEN_CHOICES = [
    ("RECIBIDO", "Por empezar"),
    ("DIAGNOSTICO", "Diagnóstico"),
    ("ESPERANDO_AUTORIZACION", "Esperando autorización"),
    ("EN_REPARACION", "En Proceso"),
    # Reemplaza al antiguo estado "Esperando repuesto" (retirado a pedido
    # del usuario) — un solo estado para "el equipo está detenido esperando
    # una pieza de afuera", sea la espera corta o larga.
    ("IMPORTACION", "Importación"),
    ("LISTO_ENTREGA", "Equipo listo"),
    ("ENTREGADO", "Entregado"),
    ("CANCELADO", "Cancelado"),
    ("REINGRESO", "Reingreso"),
    # Equipo listo que el cliente nunca retiró dentro del plazo (ver
    # OrdenTaller.DIAS_LIMITE_ABANDONO) — pasa a la bodega de equipos en
    # abandono, de donde ocasionalmente se extraen repuestos.
    ("ABANDONADO", "Abandonado"),
]

# --- Específico de órdenes COM (computadoras) ---------------------------
# Estos catálogos solo los usa taller.DetalleComputadora; las órdenes CCA
# no los tocan.

TIPO_EQUIPO_COM_CHOICES = [
    ("LAPTOP", "Laptop"),
    ("PC_ESCRITORIO", "PC de escritorio"),
    ("ALL_IN_ONE", "All-in-One"),
    ("MACBOOK", "MacBook"),
    ("MINI_PC", "Mini PC"),
    ("SERVIDOR", "Servidor"),
    ("MONITOR", "Monitor"),
    ("OTRO", "Otro"),
]

TIPO_ALMACENAMIENTO_CHOICES = [
    ("HDD", "HDD"),
    ("SSD", "SSD"),
    ("NVME", "NVMe"),
]

TIPO_CONECTOR_DISCO_CHOICES = [
    ("SATA", "SATA"),
    ("NVME", "NVMe"),
    ("OTRO", "Otro"),
]

ESTADO_COMPONENTE_CHOICES = [
    ("FUNCIONA", "Funciona"),
    ("NO_FUNCIONA", "No funciona"),
    ("NO_APLICA", "No aplica"),
    ("NO_PROBADO", "No probado"),
]

CHECKLIST_TECNICO_ESTADO_CHOICES = [
    ("OK", "OK"),
    ("FALLA", "Falla"),
    ("NO_APLICA", "No aplica"),
    ("NO_PROBADO", "No probado"),
]

IMPRESORA_CONEXION_CHOICES = [
    ("WIN32", "Impresora instalada en Windows"),
    ("RED", "Red (IP y puerto, ESC/POS directo)"),
]

ANCHO_PAPEL_CHOICES = [
    (58, "58 mm"),
    (80, "80 mm"),
]

COMO_SUPO_CHOICES = [
    ("EMAIL", "E-mail"),
    ("INSTAGRAM", "Instagram"),
    ("TIKTOK", "TikTok"),
    ("LINKEDIN", "LinkedIn"),
    ("SMS", "SMS"),
    ("RADIO", "Radio"),
    ("REFERIDO", "Referido"),
    ("GOOGLE", "Google"),
    ("RECURRENTE", "Recurrente"),
    ("OTRO", "Otro"),
]
