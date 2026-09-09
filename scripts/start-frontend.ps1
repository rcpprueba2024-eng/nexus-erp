$ErrorActionPreference = 'Continue'
$frontend = "C:\Users\USER\Desktop\NEXUS ERP\frontend"
$logDir   = "C:\Users\USER\Desktop\NEXUS ERP\scripts\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
Set-Location $frontend
& "C:\Program Files\nodejs\npm.cmd" run dev -- --host 127.0.0.1 --port 5173 *>> "$logDir\frontend.log"
