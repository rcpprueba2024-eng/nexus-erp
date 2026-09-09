# ============================================================
#  NEXUS ERP - Deploy manual a producción
#  Correr EN el servidor. Trae los últimos commits de main, rebuild
#  del frontend, migraciones, y reinicia el backend.
#
#  Es lo que hace el auto-deploy, a mano — para cuando el watcher no
#  está corriendo (p.ej. después de un reinicio).
# ============================================================
$ErrorActionPreference = "Stop"
function Paso($t){ Write-Host "`n===== $t =====" -ForegroundColor Cyan }

$repo = (Get-ChildItem C:\Users\RCP -Filter manage.py -Recurse -Depth 6 -EA SilentlyContinue | Select -First 1).Directory.Parent.FullName
if (-not $repo) { throw "No encontré el repo (manage.py) bajo C:\Users\RCP" }
$backend = Join-Path $repo "backend"
$frontend = Join-Path $repo "frontend"
$py = Join-Path $backend "venv\Scripts\python.exe"
"Repo: $repo"

Paso "1. git pull"
Push-Location $repo
git fetch origin
git pull --rebase origin main
git log --oneline -3
Pop-Location

Paso "2. Migraciones + check"
& $py (Join-Path $backend "manage.py") migrate
& $py (Join-Path $backend "manage.py") check
if ($LASTEXITCODE -ne 0) { throw "manage.py check falló — NO se despliega" }

Paso "3. Build del frontend"
$npm = (Get-Command npm.cmd -EA SilentlyContinue).Source
if (-not $npm) { $npm = "C:\Program Files\nodejs\npm.cmd" }
Push-Location $frontend
& $npm run build
Pop-Location

Paso "4. Reiniciar backend"
Get-CimInstance Win32_Process -Filter "Name='python.exe'" | ? { $_.CommandLine -match 'servir_produccion' } | % { "  matando PID $($_.ProcessId)"; Stop-Process -Id $_.ProcessId -Force }
Start-Sleep 3
Start-Process -WindowStyle Hidden $py -ArgumentList "servir_produccion.py" -WorkingDirectory $backend
Start-Sleep 6

Paso "5. Verificar"
try { Invoke-WebRequest "http://127.0.0.1:8000/api/auth/login/" -Method POST -Body '{}' -ContentType "application/json" -TimeoutSec 15 -UseBasicParsing | Out-Null } catch { Write-Host ("  Backend responde: HTTP " + $_.Exception.Response.StatusCode.value__ + " (400 = OK)") -ForegroundColor Green }
Write-Host "`nProbá desde otra PC: http://192.168.1.189:8080  (Ctrl+F5 para forzar recarga)" -ForegroundColor Yellow
