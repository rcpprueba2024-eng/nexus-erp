# ============================================================
#  NEXUS ERP - Recargar histórico de órdenes de taller  (PRODUCCIÓN)
#  Correr EN el servidor (DESKTOP-N8VJVGN).
#
#  Qué hace:
#   1. Verifica que el código esté al día (commit 6c220da o posterior)
#   2. Respaldo completo de la base PostgreSQL (pg_dump)
#   3. Dry-run del import -> muestra el resumen y PARA para que revises
#   4. Si confirmás: borra TODAS las órdenes de taller + importa las nuevas
#   5. Verifica los conteos
#
#  NO toca: clientes, facturas, inventario, RRHH, configuración.
#  (los clientes del Excel que ya existan se reutilizan por cédula;
#   los que falten se crean)
# ============================================================
param(
  [string]$Excel = "$env:USERPROFILE\Desktop\BASE DE DATOS 2026 05 JUNIO- SOLO MES - copia (2).xlsx",
  [string]$Hoja  = "JUNIO 2026"
)
$ErrorActionPreference = "Stop"
function Paso($t){ Write-Host "`n===== $t =====" -ForegroundColor Cyan }

# --- 0. Ubicar el proyecto y el python del venv ---
Paso "Ubicando el proyecto"
$manage = Get-ChildItem C:\ -Filter manage.py -Recurse -Depth 5 -ErrorAction SilentlyContinue |
          ? { $_.FullName -match "nexus-erp\\backend\\manage.py" } | Select -First 1
if (-not $manage) { throw "No encontré nexus-erp\backend\manage.py en C:\. Ajustá la ruta a mano." }
$backend = Split-Path $manage.FullName
$py = Join-Path $backend "venv\Scripts\python.exe"
if (-not (Test-Path $py)) { throw "No existe el venv en $py" }
"Backend : $backend"
"Python  : $py"
"Excel   : $Excel"
if (-not (Test-Path $Excel)) { throw "No encontré el Excel en: $Excel  (copiálo al servidor y volvé a correr con -Excel '<ruta>')" }

# --- 1. Código al día ---
Paso "Verificando versión del código"
Push-Location $backend\..
git fetch --quiet
$log = git log --oneline -1
"HEAD local: $log"
if (-not (git log --oneline | Select-String "6c220da|borrar_ordenes_taller")) {
  Write-Host "El servidor NO tiene el commit del script de borrado." -ForegroundColor Yellow
  Write-Host "Corré:  git pull --rebase origin main   (o esperá al auto-deploy) y volvé a lanzar esto." -ForegroundColor Yellow
  Pop-Location; exit 1
}
Pop-Location

# --- 2. Respaldo PostgreSQL ---
Paso "Respaldo de la base (pg_dump)"
$envFile = Join-Path $backend ".env"
$dbname = "rcp_erp"; $dbuser = "postgres"
if (Test-Path $envFile) {
  (Get-Content $envFile) | % {
    if ($_ -match "^DB_NAME=(.+)$") { $dbname = $Matches[1].Trim() }
    if ($_ -match "^DB_USER=(.+)$") { $dbuser = $Matches[1].Trim() }
    if ($_ -match "^DB_PASSWORD=(.+)$") { $env:PGPASSWORD = $Matches[1].Trim() }
  }
}
$pgdump = (Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_dump.exe" | Select -Last 1).FullName
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$bak = "C:\Backups\pg\rcp_erp_ANTES_recarga_$stamp.dump"
New-Item -ItemType Directory -Force -Path (Split-Path $bak) | Out-Null
& $pgdump -U $dbuser -Fc -f $bak $dbname
if ($LASTEXITCODE -ne 0) { throw "pg_dump falló" }
"Respaldo OK: $bak  ($([math]::Round((Get-Item $bak).Length/1MB,1)) MB)"

# --- 3. Dry-run ---
Paso "DRY-RUN del import (no escribe nada)"
& $py (Join-Path $backend "importar_historico_junio2026.py") --excel $Excel --hoja $Hoja
Write-Host "`nREVISÁ el resumen de arriba:" -ForegroundColor Yellow
Write-Host "  - 'Órdenes que se crearían' debe ser ~541" -ForegroundColor Yellow
Write-Host "  - En 'Técnicos sin mapear' NO deben aparecer 'Tecnico 1' ni 'Jorge Montiel'." -ForegroundColor Yellow
Write-Host "    Si aparecen -> los empleados en producción no se llaman exactamente" -ForegroundColor Yellow
Write-Host "    'MANOLO VALERIO OBANDO URBINA' / 'JORGE ELIEZER MONTIEL MEDINA'. Pará y avisá a Claude." -ForegroundColor Yellow
$r = Read-Host "`n¿Todo bien? Escribí  SI  para BORRAR las órdenes actuales e importar (cualquier otra cosa cancela)"
if ($r -ne "SI") { Write-Host "Cancelado. No se tocó nada. Respaldo en $bak" -ForegroundColor Green; exit 0 }

# --- 4. Borrar + importar ---
Paso "Borrando todas las órdenes de taller"
& $py (Join-Path $backend "borrar_ordenes_taller.py") --commit
Paso "Importando el histórico nuevo"
& $py (Join-Path $backend "importar_historico_junio2026.py") --excel $Excel --hoja $Hoja --commit

# --- 5. Verificar ---
Paso "Verificación"
& $py (Join-Path $backend "manage.py") shell -c @"
from taller.models import OrdenTaller
from ventas.models import Cliente, Factura
from collections import Counter
print('Órdenes de taller :', OrdenTaller.objects.count())
print('  por categoría   :', dict(Counter(OrdenTaller.objects.values_list('categoria_equipo',flat=True))))
print('  con técnico     :', OrdenTaller.objects.filter(tecnico__isnull=False).count())
print('  rango fechas    :', OrdenTaller.objects.earliest('fecha_ingreso').fecha_ingreso, '->', OrdenTaller.objects.latest('fecha_ingreso').fecha_ingreso)
print('Clientes          :', Cliente.objects.count())
print('Facturas (intactas):', Factura.objects.count())
"@

Write-Host "`n===== LISTO =====" -ForegroundColor Green
Write-Host "Si algo salió mal, restaurar con:" -ForegroundColor Yellow
Write-Host "  pg_restore -U $dbuser -d $dbname --clean --if-exists `"$bak`"" -ForegroundColor Yellow
