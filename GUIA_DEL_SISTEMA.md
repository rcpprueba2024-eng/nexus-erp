# Guía del Sistema — RCP ERP

Esta guía explica cómo funciona cada parte del sistema, para qué sirve y cómo usarla.

---

## 1. Arquitectura general

El sistema tiene dos partes que corren por separado:

| Parte | Tecnología | Carpeta | Dirección |
|---|---|---|---|
| Backend (API + base de datos) | Django + Django REST Framework | `backend/` | http://127.0.0.1:8000 |
| Frontend (interfaz visual) | React + Vite | `frontend/` | http://localhost:5173 |

El frontend le pide datos al backend por internet (API REST) y los muestra en pantallas. El backend guarda todo en una base de datos (por ahora SQLite, un archivo local; más adelante puede cambiarse a PostgreSQL).

### Cómo arrancar el sistema

Necesitas dos terminales abiertas al mismo tiempo:

```bash
cd backend
venv\Scripts\python.exe manage.py runserver 8000
```

```bash
cd frontend
npm run dev
```

Luego abres `http://localhost:5173` en el navegador.

### Accesos

- **Panel de administración de Django** (para editar datos directamente, ver todo, o arreglar algo a mano): `http://127.0.0.1:8000/admin/`
  - Usuario: `admin`
  - Contraseña: `RcpAdmin2026!` *(cámbiala cuando el sistema pase a producción)*

---

## 2. Estructura del menú

El sistema tiene 5 secciones, accesibles desde el menú lateral izquierdo:

1. **Panel** — resumen general (dashboard)
2. **Inventario** — productos y stock
3. **Ventas** — clientes y facturación
4. **Compras** — proveedores y órdenes de compra
5. **Contabilidad / RRHH** — empleados y cuentas por cobrar/pagar

---

## 3. Panel General (Dashboard)

**Qué muestra:** un resumen en tiempo real de todo el negocio, con 8 indicadores:

- **Productos** — cuántos productos hay dados de alta en el inventario
- **Bajo stock** — cuántos productos están en o por debajo de su stock mínimo (alerta de reabastecimiento)
- **Facturas emitidas** — cuántas ventas se han facturado
- **Total en ventas** — suma de todas las facturas
- **Órdenes de compra** — cuántas órdenes se han creado a proveedores
- **Empleados activos** — cuántas personas están dadas de alta
- **Por cobrar** — dinero que los clientes todavía deben (facturas pendientes)
- **Por pagar** — dinero que la empresa debe a proveedores (órdenes pendientes)

Esta pantalla es solo de lectura: no se edita nada aquí, junta información de los otros 4 módulos.

---

## 4. Inventario

**Para qué sirve:** llevar el control de qué productos vende/usa la empresa y cuánta existencia (stock) queda de cada uno.

**Qué se puede hacer:**
- **Agregar producto:** llenas código, nombre, precio de compra, precio de venta, stock inicial y stock mínimo, y das clic en "Agregar".
- **Ver la lista de productos:** con su categoría, precio de venta, stock actual y un semáforo de estado:
  - 🟢 **OK** — el stock está por encima del mínimo
  - 🔴 **Bajo stock** — hay que reabastecer
- **Eliminar producto.**

**Cómo se relaciona con el resto del sistema:**
- Cuando emites una **factura de venta**, el producto se toma de aquí (con su precio de venta).
- Cuando creas una **orden de compra**, también se elige el producto de esta lista (con su precio de compra).
- El **stock** se ajusta automáticamente cuando registras movimientos de inventario (entradas/salidas) — esto se gestiona desde el panel de administración de Django (`/admin/`) en la sección "Movimiento inventarios", ya que aún no tiene pantalla propia en el frontend.

**Dato técnico:** cada producto tiene una categoría (Electrónica, Oficina, Hogar, etc.) y una unidad de medida (Unidad, Kilogramo, Litro, Caja).

---

## 5. Ventas

**Para qué sirve:** administrar los clientes de la empresa y emitir facturas de venta.

**Qué se puede hacer:**

### Clientes
- Agregar un cliente nuevo (nombre, documento fiscal, correo, teléfono).
- Ver la lista de clientes registrados.

### Facturas
- Emitir una factura nueva: eliges el número de factura, el cliente, el producto y la cantidad.
  - El sistema toma automáticamente el precio de venta del producto y calcula el total.
- Ver el historial de facturas con su estado:
  - 🟡 **Pendiente** — aún no se ha cobrado
  - 🟢 **Pagada**
  - 🔴 **Anulada**

**Nota:** por ahora cada factura se crea con un solo producto desde la pantalla. Si necesitas una factura con varios productos, puedes agregar más líneas ("detalles") desde el panel de administración de Django, o pedirme que agregue esa función al formulario.

---

## 6. Compras

**Para qué sirve:** administrar los proveedores de la empresa y las órdenes de compra que se les hacen.

**Qué se puede hacer:**

### Proveedores
- Agregar un proveedor nuevo (nombre, documento fiscal, correo, teléfono).
- Ver la lista de proveedores.

### Órdenes de compra
- Crear una orden nueva: número de orden, proveedor, producto y cantidad.
  - El sistema toma el precio de compra del producto y calcula el total.
- Ver el historial de órdenes con su estado:
  - 🟡 **Pendiente**
  - 🟢 **Recibida**
  - 🔴 **Cancelada**

**Nota:** cambiar el estado de una orden a "Recibida" (por ejemplo, cuando llega la mercancía) se hace por ahora desde el panel de administración de Django. Si quieres, puedo agregar un botón para hacerlo directo desde esta pantalla.

---

## 7. Contabilidad / RRHH

**Para qué sirve:** llevar el registro de empleados y de las deudas de la empresa (lo que le deben y lo que debe).

**Qué se puede hacer:**

### Empleados
- Agregar un empleado (nombre, puesto, salario, fecha de ingreso).
- Ver la lista de empleados con su estado (activo/inactivo).

### Cuentas por cobrar
Dinero que los **clientes** deben a la empresa (normalmente ligado a una factura pendiente). Muestra cliente, monto, fecha de vencimiento y si ya se pagó o no.

### Cuentas por pagar
Dinero que la **empresa** debe a los **proveedores** (normalmente ligado a una orden de compra). Muestra proveedor, monto, fecha de vencimiento y estado.

**Nota:** estas cuentas se generan hoy desde el panel de administración; la idea a futuro es que se creen automáticamente cuando se emite una factura o una orden de compra.

---

## 8. ¿Cómo se conecta todo?

```
Producto (Inventario)
   ├── se vende en → Factura (Ventas) → genera → Cuenta por cobrar (Contabilidad)
   └── se compra en → Orden de compra (Compras) → genera → Cuenta por pagar (Contabilidad)
```

Todo gira alrededor del **Inventario**: es la base que usan tanto Ventas como Compras para saber qué producto se está moviendo y a qué precio.

---

## 9. Qué falta / próximos pasos sugeridos

- **Login de usuarios** en el frontend (hoy cualquiera que abra la página puede ver y editar todo — está bien para desarrollo, no para producción).
- Botones para cambiar estados (factura pagada, orden recibida) sin entrar al admin de Django.
- Facturas y órdenes con múltiples productos desde la propia pantalla.
- Generación automática de cuentas por cobrar/pagar al crear una factura u orden.
- Cambiar de SQLite a PostgreSQL cuando el sistema pase a uso real.
- Reportes (ventas por periodo, productos más vendidos, etc.).

<!-- servidor: auto-deploy activo desde 2026-09-09 -->
<!-- dev: entorno de desarrollo local preparado en C:\dev
exus-erp 2026-09-09 -->
