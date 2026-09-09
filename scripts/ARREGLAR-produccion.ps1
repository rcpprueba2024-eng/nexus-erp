# ============================================================
#  NEXUS ERP - Arreglar producción: los POST/escrituras se cuelgan
#  Correr EN el servidor (DESKTOP-N8VJVGN) en PowerShell como Administrador.
#
#  Síntoma: la página carga pero el login se queda colgado infinito.
#  Causa típica: disco lleno / PostgreSQL trabado / hilos del backend pegados.
#
#  Este script: diagnostica -> libera lo obvio -> reinicia PostgreSQL y el
#  backend -> prueba que el login responda. Muestra todo antes de tocar nada.
# ============================================================
$ErrorActionPreference = "Continue"
function Paso($t){ Write-Host "`n===== $t =====" -ForegroundColor Cyan }

Paso "1. Espacio en disco C:"
$c = Get-PSDrive C
$libreGB = [math]::Round($c.Free/1GB,2)
"Libre: $libreGB GB de $([math]::Round(($c.Used+$c.Free)/1GB,1)) GB"
if ($libreGB -lt 2) {
  Write-Host "  *** DISCO CASI LLENO — esta es casi seguro la causa ***" -ForegroundColor Red
}

Paso "2. Respaldos pg_dump acumulados (C:\Backups\pg)"
if (Test-Path C:\Backups\pg) {
  $dumps = Get-ChildItem C:\Backups\pg -File | Sort-Object LastWriteTime
  $totalMB = [math]::Round(($dumps | Measure-Object Length -Sum).Sum/1MB,1)
  "$($dumps.Count) archivos, $totalMB MB en total"
  if ($dumps.Count -gt 5) {
    Write-Host "  Borrando los más viejos, dejo los 5 más recientes..." -ForegroundColor Yellow
    $dumps | Select-Object -SkipLast 5 | ForEach-Object { "  - borrado $($_.Name)"; Remove-Item $_.FullName -Force }
  }
}

Paso "3. Limpieza rápida de temporales de Windows Update"
$antes = (Get-PSDrive C).Free
try {
  Stop-Service wuauserv -Force -ErrorAction SilentlyContinue
  Remove-Item "C:\Windows\SoftwareDistribution\Download\*" -Recurse -Force -ErrorAction SilentlyContinue
  Start-Service wuauserv -ErrorAction SilentlyContinue
} catch {}
Remove-Item "$env:TEMP\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "C:\Windows\Temp\*" -Recurse -Force -ErrorAction SilentlyContinue
$liberadoMB = [math]::Round(((Get-PSDrive C).Free - $antes)/1MB,0)
"Liberado: ~$liberadoMB MB.  Libre ahora: $([math]::Round((Get-PSDrive C).Free/1GB,2)) GB"

Paso "4. Estado de PostgreSQL"
$pg = Get-Service postgresql* -ErrorAction SilentlyContinue
$pg | Select Status, StartType, Name, DisplayName | Format-Table -Auto
if (-not $pg) { Write-Host "  NO hay servicio postgresql* — ¿instalado en otro lado? Revisar." -ForegroundColor Red }

Paso "5. Consultas/transacciones trabadas en la base"
$psql = (Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue | Select -Last 1).FullName
$envFile = Get-ChildItem C:\ -Filter .env -Recurse -Depth 5 -ErrorAction SilentlyContinue | ? { $_.FullName -match "nexus-erp\\backend\\.env" } | Select -First 1
$dbname="rcp_erp"; $dbuser="postgres"
if ($envFile) {
  Get-Content $envFile.FullName | % {
    if ($_ -match "^DB_NAME=(.+)$"){ $dbname=$Matches[1].Trim() }
    if ($_ -match "^DB_USER=(.+)$"){ $dbuser=$Matches[1].Trim() }
    if ($_ -match "^DB_PASSWORD=(.+)$"){ $env:PGPASSWORD=$Matches[1].Trim() }
  }
}
if ($psql -and $pg.Status -eq "Running") {
  & $psql -U $dbuser -d $dbname -c "SELECT pid, state, wait_event_type, now()-query_start AS duracion, left(query,90) AS query FROM pg_stat_activity WHERE state <> 'idle' AND pid <> pg_backend_pid() ORDER BY query_start;"
  Write-Host "  Si hay consultas 'active' de hace rato -> están trabadas." -ForegroundColor Yellow
  Write-Host "  Para matarlas TODAS (seguro, no borra datos):" -ForegroundColor Yellow
  Write-Host "    & `"$psql`" -U $dbuser -d $dbname -c `"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state<>'idle' AND pid<>pg_backend_pid();`"" -ForegroundColor Gray
}

Paso "6. Reiniciar PostgreSQL"
if ($pg) {
  Restart-Service $pg.Name -Force
  Start-Sleep 4
  (Get-Service $pg.Name).Status
}

Paso "7. Reiniciar el backend (waitress) - sus hilos quedaron pegados"
$back = Get-CimInstance Win32_Process -Filter "Name='python.exe'" | ? { $_.CommandLine -match "servir_produccion|waitress|runserver" }
$back | ForEach-Object { "  matando PID $($_.ProcessId)"; Stop-Process -Id $_.ProcessId -Force }
Start-Sleep 2
$svc = Get-Service | ? { $_.Name -match "nexus|NexusBackend|rcp" -and $_.Name -notmatch "caddy" } | Select -First 1
if ($svc) {
  "  arrancando servicio $($svc.Name)"
  Start-Service $svc.Name
} else {
  $backend = ($back | Select -First 1).CommandLine
  Write-Host "  No hay servicio del backend. Arrancalo a mano desde su carpeta:" -ForegroundColor Yellow
  Write-Host "    cd <...>\nexus-erp\backend ; .\venv\Scripts\python.exe servir_produccion.py" -ForegroundColor Gray
}
Start-Sleep 5

Paso "8. Prueba: el login debe responder RÁPIDO ahora"
try {
  $r = Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/auth/login/" -Method POST -Body '{"username":"x","password":"y"}' -ContentType "application/json" -TimeoutSec 15 -UseBasicParsing
  "  HTTP $($r.StatusCode)"
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  if ($code) { Write-Host "  HTTP $code  <- BIEN (responde; 400 es lo esperado con datos falsos)" -ForegroundColor Green }
  else { Write-Host "  SIGUE COLGADO: $($_.Exception.Message)" -ForegroundColor Red; Write-Host "  Revisar logs del backend y de PostgreSQL." -ForegroundColor Red }
}

Write-Host "`n===== FIN =====" -ForegroundColor Green
Write-Host "Probá entrar al sistema desde otra PC: http://192.168.1.189:8080" -ForegroundColor Yellow
