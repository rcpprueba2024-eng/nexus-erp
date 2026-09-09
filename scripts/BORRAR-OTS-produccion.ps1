# ============================================================
#  NEXUS ERP - Vaciar las órdenes de taller (OTs) en PRODUCCIÓN
#  Correr EN el servidor (DESKTOP-N8VJVGN).
#
#  Borra TODAS las OrdenTaller (ingresadas, en proceso, listas,
#  entregadas, etc.) + lo que cuelga en cascada (diagnósticos, fotos,
#  historial de estados, insumos usados, detalle de computadora).
#
#  NO toca: clientes, empresas, facturas, inventario, RRHH, gastos,
#  configuración. La numeración (siguiente_numero_com/cca) queda como está.
#
#  Hace RESPALDO completo antes, y pide confirmación.
# ============================================================
$ErrorActionPreference = "Stop"
function Paso($t){ Write-Host "`n===== $t =====" -ForegroundColor Cyan }

Paso "0. Ubicando el proyecto"
$backend = (Get-ChildItem C:\Users\RCP -Filter borrar_ordenes_taller.py -Recurse -Depth 6 -EA SilentlyContinue | Select-Object -First 1).DirectoryName
if (-not $backend) { throw "No encontré borrar_ordenes_taller.py — ¿el auto-deploy ya trajo los últimos commits? Revisá C:\Users\RCP\nexus-server\run\deploy.log" }
$py = Join-Path $backend "venv\Scripts\python.exe"
"Backend: $backend"

Paso "1. Datos de conexión a PostgreSQL (desde el .env)"
$envf = Join-Path $backend ".env"
$dbname = "nexus_erp"; $dbuser = "nexus"; $dbport = "5433"; $dbhost = "127.0.0.1"
Get-Content $envf | ForEach-Object {
  if ($_ -match "^DB_NAME=(.+)$")     { $dbname = $Matches[1].Trim() }
  if ($_ -match "^DB_USER=(.+)$")     { $dbuser = $Matches[1].Trim() }
  if ($_ -match "^DB_PORT=(.+)$")     { $dbport = $Matches[1].Trim() }
  if ($_ -match "^DB_HOST=(.+)$")     { $dbhost = $Matches[1].Trim() }
  if ($_ -match "^DB_PASSWORD=(.+)$") { $env:PGPASSWORD = $Matches[1].Trim() }
}
"db=$dbname  user=$dbuser  $dbhost`:$dbport"

Paso "2. RESPALDO completo (pg_dump)"
$pgdump = (Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_dump.exe" | Select-Object -Last 1).FullName
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$bak = "C:\Users\RCP\nexus-server\backup_ANTES_vaciar_OTs_$stamp.dump"
& $pgdump -h $dbhost -p $dbport -U $dbuser -Fc -f $bak $dbname
if ($LASTEXITCODE -ne 0) { throw "pg_dump FALLÓ — no sigo" }
"Respaldo OK: $bak  ($([math]::Round((Get-Item $bak).Length/1MB,1)) MB)"

Paso "3. Cuántas OTs hay ahora (dry-run)"
& $py (Join-Path $backend "borrar_ordenes_taller.py")

Paso "4. Confirmación"
$r = Read-Host "Escribí  BORRAR  para vaciar TODAS las órdenes de taller (cualquier otra cosa cancela)"
if ($r -ne "BORRAR") { Write-Host "Cancelado. No se borró nada. Respaldo en $bak" -ForegroundColor Green; exit 0 }

Paso "5. Borrando"
& $py (Join-Path $backend "borrar_ordenes_taller.py") --commit

Paso "6. Verificación"
& $py (Join-Path $backend "manage.py") shell -c "from taller.models import OrdenTaller; from ventas.models import Cliente, Factura; from inventario.models import Producto; print('Órdenes de taller :', OrdenTaller.objects.count(), '(debe ser 0)'); print('Clientes          :', Cliente.objects.count(), '(intacto)'); print('Facturas          :', Factura.objects.count(), '(intacto)'); print('Productos         :', Producto.objects.count(), '(intacto)')"

Write-Host "`n===== LISTO =====" -ForegroundColor Green
Write-Host "Si algo salió mal, restaurar con:" -ForegroundColor Yellow
Write-Host "  & '$pgdump'.Replace('pg_dump','pg_restore') -h $dbhost -p $dbport -U $dbuser -d $dbname --clean --if-exists `"$bak`"" -ForegroundColor Gray
Write-Host "Reiniciá el backend después (parar-nexus.ps1 + iniciar-nexus.ps1) para limpiar cachés." -ForegroundColor Yellow
