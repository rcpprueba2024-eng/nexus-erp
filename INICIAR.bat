@echo off
echo Iniciando NEXUS ERP...
echo.
echo No cierres las dos ventanas negras que se van a abrir:
echo una es el servidor de datos (backend) y otra es la
echo interfaz visual (frontend). Si las cerras, el sistema
echo deja de funcionar en el navegador.
echo.
echo ===================================================
echo   Para usarlo DESDE OTRA COMPUTADORA de esta misma
echo   red (WiFi/cable), busca la IP de ESTA maquina con
echo   el comando "ipconfig" (mira "Direccion IPv4", algo
echo   como 192.168.x.x) y en la otra PC abre en el
echo   navegador:   http://ESA-IP:5173
echo   (las dos computadoras deben estar en la misma red)
echo ===================================================
echo.

start "NEXUS ERP - Backend (no cerrar)" cmd /k "cd /d "%~dp0backend" && venv\Scripts\python.exe servir_produccion.py"
timeout /t 3 /nobreak >nul
start "NEXUS ERP - Frontend (no cerrar)" cmd /k "cd /d "%~dp0frontend" && echo Preparando la version optimizada... && npm run build && npm run preview -- --host --port 5173"
timeout /t 12 /nobreak >nul
start http://localhost:5173
