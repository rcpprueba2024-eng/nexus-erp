# HANDOFF — Recarga del histórico de órdenes de taller en PRODUCCIÓN

> Para una sesión de Claude Code corriendo **EN el servidor** (DESKTOP-N8VJVGN).
> Preparado por la sesión de desarrollo (DESKTOP-N8EDP0F) el 2026-09-09.

## Contexto

RCP quiere reemplazar TODO el histórico de órdenes de taller (`OrdenTaller`,
tanto COM como CCA) por el de una planilla actualizada. Ya está preparado y
**probado de punta a punta en la base local de desarrollo** (541 órdenes
importadas OK, clientes y facturas intactos).

## Ya está en `main` (hacé `git pull` primero)

| Commit | Qué |
|---|---|
| `1c3fc5a` | `importar_historico_junio2026.py` acepta `--excel <ruta>` y `--hoja`; mapea la etiqueta **"Tecnico 1" → MANOLO VALERIO OBANDO URBINA** (dato confirmado por RCP) |
| `bfcf126` | Excluye 3 órdenes del import: técnico **"Técnico 2"** (COM-10832) y **"Cristopher Fons."** (COM-11077, COM-11101) — RCP pidió no importarlas |
| `6c220da` | `borrar_ordenes_taller.py` — borra todas las OTs + cascada (DetalleComputadora, DiagnosticoOrden, FotoEquipo, HistorialEstado, InsumoUsado). NO toca clientes, facturas, inventario, RRHH. |

## Lo que falta (hacerlo acá, en el servidor)

### 1. El Excel
RCP tiene que dejar en el servidor el archivo:
`BASE DE DATOS 2026 05 JUNIO- SOLO MES - copia (2).xlsx`
(está en `C:\Users\USER\Downloads\` de la máquina de desarrollo — traerlo por USB / red / Drive).
Hoja a usar: **`JUNIO 2026`**.

### 2. Correr el runbook
```powershell
git pull --rebase origin main
powershell -ExecutionPolicy Bypass -File scripts\RECARGAR-HISTORICO-produccion.ps1 -Excel "C:\ruta\al\copia (2).xlsx"
```
El script: verifica versión → **pg_dump de respaldo** → dry-run (PARA y pide confirmar) → borra OTs + importa → verifica conteos.

### 3. ⚠️ Verificación crítica en el dry-run
Mirá la línea **"Técnicos sin mapear"**:
- Si aparece **"Tecnico 1"** (~251 órdenes) o **"Jorge Montiel"** (~287), los `Empleado`
  en producción NO se llaman exactamente `MANOLO VALERIO OBANDO URBINA` /
  `JORGE ELIEZER MONTIEL MEDINA`.
- En ese caso: `python backend/manage.py shell -c "from rrhh.models import Empleado; [print(repr(e.nombre)) for e in Empleado.objects.all()]"`,
  ajustá `MAPA_TECNICO` en `importar_historico_junio2026.py` con los nombres reales,
  commit + push, `git pull`, y volvé a correr.
- (En desarrollo salieron sin técnico porque la base de prueba tiene otros empleados.)

## Resultado esperado (según la prueba local)
- ~541 órdenes (≈368 COM + ≈173 CCA), fechas oct-2025 → sep-2026
- Estados: ~410 ENTREGADO, ~80 LISTO_ENTREGA, resto en proceso/abandono
- Contadores `siguiente_numero_com` / `siguiente_numero_cca` se ajustan solos
  por encima del máximo importado
- Clientes: los del Excel que ya existan (por cédula) se reutilizan; los que
  falten se crean. Facturas: intactas.

## Rollback
El script imprime el comando exacto al final:
`pg_restore -U postgres -d rcp_erp --clean --if-exists "C:\Backups\pg\rcp_erp_ANTES_recarga_<stamp>.dump"`

## Nota sobre "cambios directo en producción"
RCP quiere que los cambios se hagan directo en producción desde una sola
sesión. Para **código** el flujo sigue siendo edit → push → auto-deploy (el
`git pull` del servidor pisa cualquier edición local no commiteada). Para
**datos/operaciones** (como esta recarga) sí se ejecuta directo acá.
