@echo off
REM Crea una copia de seguridad de la base de datos (db.sqlite3) con fecha
REM y hora en el nombre, dentro de la carpeta "respaldos". Se puede correr
REM a mano cuando quieras, o programarlo en el Programador de tareas de
REM Windows para que corra solo todos los dias.

setlocal enabledelayedexpansion

set ORIGEN=%~dp0backend\db.sqlite3
set CARPETA_RESPALDOS=%~dp0respaldos

if not exist "%CARPETA_RESPALDOS%" mkdir "%CARPETA_RESPALDOS%"

for /f "tokens=1-4 delims=/ " %%a in ('date /t') do (set FECHA=%%d-%%b-%%c)
set HORA=%time::=-%
set HORA=%HORA: =0%

set DESTINO=%CARPETA_RESPALDOS%\db_%FECHA%_%HORA%.sqlite3

copy "%ORIGEN%" "%DESTINO%" >nul

if %errorlevel%==0 (
    echo Respaldo creado: %DESTINO%
) else (
    echo ERROR: no se pudo crear el respaldo. Verifica que el sistema no este corriendo con la base de datos bloqueada.
)

REM Conserva solo los ultimos 30 respaldos para no llenar el disco.
for /f "skip=30 delims=" %%f in ('dir "%CARPETA_RESPALDOS%\db_*.sqlite3" /b /o-d 2^>nul') do del "%CARPETA_RESPALDOS%\%%f"

if "%1"=="" pause
