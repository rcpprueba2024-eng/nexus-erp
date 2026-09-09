$scripts = "C:\Users\USER\Desktop\NEXUS ERP\scripts"
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scripts\start-backend.ps1`"" -WindowStyle Hidden
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scripts\start-frontend.ps1`"" -WindowStyle Hidden
