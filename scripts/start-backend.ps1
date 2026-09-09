$ErrorActionPreference = 'Continue'
$backend = "C:\Users\USER\Desktop\NEXUS ERP\backend"
$logDir  = "C:\Users\USER\Desktop\NEXUS ERP\scripts\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
Set-Location $backend
& "$backend\venv\Scripts\python.exe" manage.py runserver 127.0.0.1:8000 *>> "$logDir\backend.log"
