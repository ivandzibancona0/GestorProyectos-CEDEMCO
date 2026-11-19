@echo off
setlocal EnableExtensions
chcp 65001 >nul
title CEDEMCO - UADY ^| Servidor

cd /d "%~dp0"

echo ============================================================
echo   CEDEMCO - UADY ^| Plataforma de Gestion de Emprendimientos
echo ============================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] No se encontro Node.js en el sistema.
    echo Instale Node.js 20 LTS o superior y vuelva a intentarlo.
    echo.
    pause
    exit /b 1
)

if not exist ".env" (
    echo [ERROR] No se encontro el archivo .env en la raiz del proyecto.
    echo Copie .env.example como .env y configure su conexion a PostgreSQL.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [INFO] No se encontro node_modules. Instalando dependencias...
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] No se pudieron instalar las dependencias con npm install.
        echo.
        pause
        exit /b 1
    )
    echo.
)

set "PORT=3000"
set "APP_ORIGIN="
for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    if /i "%%A"=="PORT" set "PORT=%%B"
    if /i "%%A"=="APP_ORIGIN" set "APP_ORIGIN=%%B"
)
set "PORT=%PORT:"=%"
set "PORT=%PORT: =%"
if "%APP_ORIGIN%"=="" set "APP_ORIGIN=http://localhost:%PORT%"
set "APP_ORIGIN=%APP_ORIGIN:"=%"
set "APP_ORIGIN=%APP_ORIGIN: =%"
set "HEALTH_URL=http://localhost:%PORT%/health"

echo [INFO] Verificando estado del servidor en %APP_ORIGIN%...
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "try { $r=Invoke-WebRequest -Uri $env:HEALTH_URL -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -eq 200){ exit 0 } else { exit 2 } } catch { if($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 503){ exit 2 } else { exit 1 } }"
if "%ERRORLEVEL%"=="0" (
    echo [INFO] El servidor ya se encuentra en ejecucion.
    echo [INFO] Abriendo la aplicacion en el navegador...
    start "" "%APP_ORIGIN%"
    timeout /t 3 /nobreak >nul
    exit /b 0
)
if "%ERRORLEVEL%"=="2" (
    echo [AVISO] El servidor ya esta activo en el puerto %PORT%, pero PostgreSQL no responde.
    echo [AVISO] Verifique que el servicio de PostgreSQL este iniciado.
    start "" "%APP_ORIGIN%"
    echo.
    pause
    exit /b 0
)

echo [INFO] Iniciando servidor CEDEMCO en %APP_ORIGIN%...
echo [INFO] La aplicacion se abrira automaticamente en su navegador cuando este lista.
echo [INFO] Para detener el servidor, presione Ctrl + C o cierre esta ventana.
echo.

start "" /b powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "$u=$env:APP_ORIGIN; $h=$env:HEALTH_URL; for($i=0;$i -lt 30;$i++){ Start-Sleep -Seconds 1; try { $r=Invoke-WebRequest -Uri $h -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -eq 200){ Start-Process $u; break } } catch { if($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 503){ Write-Host ''; Write-Host '[AVISO] El servidor inicio, pero PostgreSQL no responde. Verifique que el servicio de PostgreSQL este activo.' -ForegroundColor Yellow; Start-Process $u; break } } }" <nul

node src/server.js
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" (
    echo [ERROR] El servidor se detuvo con codigo de salida %EXIT_CODE%.
    echo Revise los mensajes anteriores para ver el detalle.
    echo.
    pause
    exit /b %EXIT_CODE%
)

echo [INFO] Servidor detenido correctamente.
pause
exit /b 0
