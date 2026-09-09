@echo off
setlocal
echo ===================================================
echo   NEXUS ERP - Instalacion
echo ===================================================
echo.
echo Esto prepara el sistema en esta computadora. Solo hace
echo falta correrlo UNA vez (o de nuevo si algo cambio).
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se encontro Python en esta computadora.
  echo Instalalo desde https://www.python.org/downloads/
  echo IMPORTANTE: marca la casilla "Add python.exe to PATH" durante la instalacion.
  echo Despues de instalarlo, volve a correr este archivo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se encontro Node.js en esta computadora.
  echo Instalalo desde https://nodejs.org/ ^(version LTS^)
  echo Despues de instalarlo, volve a correr este archivo.
  pause
  exit /b 1
)

echo [1/4] Preparando el backend ^(Python^)...
cd /d "%~dp0backend"
if not exist venv (
  python -m venv venv
)
call venv\Scripts\python.exe -m pip install --quiet --upgrade pip
call venv\Scripts\python.exe -m pip install --quiet -r requirements.txt
if errorlevel 1 (
  echo [ERROR] Fallo la instalacion de las dependencias de Python.
  pause
  exit /b 1
)

echo [2/4] Preparando la base de datos...
call venv\Scripts\python.exe manage.py migrate
if errorlevel 1 (
  echo [ERROR] Fallo la preparacion de la base de datos.
  pause
  exit /b 1
)

echo [3/4] Preparando el frontend ^(interfaz visual^)...
cd /d "%~dp0frontend"
call npm install
if errorlevel 1 (
  echo [ERROR] Fallo "npm install".
  pause
  exit /b 1
)

cd /d "%~dp0"
echo [4/4] Listo.
echo.
echo ===================================================
echo   Instalacion completa.
echo   Para abrir el sistema, doble-clic en INICIAR.bat
echo ===================================================
pause
