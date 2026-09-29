@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Probar el catalogo - Advance Tecno

echo.
echo   ============================================================
echo     PROBAR EL CATALOGO
echo.
echo     Abre el catalogo con los datos de hoy de ADVAPP y controla que
echo     todo siga andando: la agrupacion en tarjetas, que se
echo     recomienda en cada categoria, el orden de la barra y como
echo     se ve en celular, tablet y pantalla grande.
echo   ============================================================
echo.

rem 29/09 (Pedro eligio 7.1 C y 7.2 B, como PROBAR.command): correr.py sale
rem con 1 si hay NUEVAS y con 3 si lo unico que falla ya esta pedido
rem (pruebas\conocidas.json). (29/09, revision) Un Traceback de Python
rem tambien sale con 1: para distinguirlo se lee "RESULTADO: N NUEVA" de la
rem salida. Windows no tiene tee: la salida va a un archivo y se muestra al
rem terminar (el avance y un error de Python salen igual en la pantalla,
rem porque van por stderr).
set "PRUEBAS_SALIDA=%TEMP%\probar-pruebas-%RANDOM%%RANDOM%.txt"
set PYTHONIOENCODING=utf-8
python -u pruebas\correr.py > "%PRUEBAS_SALIDA%"
set RESULTADO=%errorlevel%
type "%PRUEBAS_SALIDA%"
set NUEVAS=
for /f "tokens=2" %%n in ('findstr /b /r /c:"RESULTADO: [0-9][0-9]* NUEVA" "%PRUEBAS_SALIDA%"') do if not defined NUEVAS set NUEVAS=%%n
del "%PRUEBAS_SALIDA%" >nul 2>&1

set CARTEL=mal
if "%RESULTADO%"=="0" set CARTEL=bien
if "%RESULTADO%"=="2" set CARTEL=no
if "%RESULTADO%"=="3" set CARTEL=conocidas
if "%RESULTADO%"=="1" if defined NUEVAS set CARTEL=nuevas

echo.
if "%CARTEL%"=="bien" (
  echo   ------------------------------------------------------------
  echo     TODO BIEN. Se puede publicar.
  echo   ------------------------------------------------------------
)
if "%CARTEL%"=="no" (
  echo   ------------------------------------------------------------
  echo     NO SE PUDO PROBAR ^(el detalle esta arriba^).
  echo   ------------------------------------------------------------
)
if "%CARTEL%"=="conocidas" (
  echo   ------------------------------------------------------------
  echo     NADA NUEVO. Lo que falla ya esta pedido ^(arriba, en
  echo     CONOCIDAS, con los dias que lleva^). Se puede publicar:
  echo     PUBLICAR no va a preguntar por esto.
  echo   ------------------------------------------------------------
)
if "%CARTEL%"=="nuevas" (
  echo   ------------------------------------------------------------
  echo     HAY FALLAS NUEVAS ^(%NUEVAS%^)
  echo.
  echo     Arriba, en NUEVAS, dice cuales: es algo que el cliente
  echo     puede estar viendo mal y nadie pidio que se arregle.
  echo.
  echo     Si ya se pidio, se anota como conocida ^(ahi mismo dice
  echo     como^). Si no sabes por donde empezar, pasale a Claude lo
  echo     que dice aca arriba.
  echo   ------------------------------------------------------------
)
if "%CARTEL%"=="mal" (
  echo   ------------------------------------------------------------
  echo     LAS PRUEBAS TERMINARON MAL ^(salida %RESULTADO%^)
  echo.
  echo     No llegaron a decir que es nuevo y que ya esta pedido.
  echo     Pasale a Claude lo que dice aca arriba.
  echo   ------------------------------------------------------------
)
echo.
pause
