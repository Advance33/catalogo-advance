@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Revisar catalogo - Advance Tecno

rem 29/09: decia "Baja la hoja Landing", "el sitio lee la planilla en vivo" y
rem "se le pide al equipo del sheet". Desde el 22/09 los datos vienen de
rem ADVAPP y la planilla quedo congelada como respaldo. La PC se retiro el
rem 25/09, pero este archivo dice lo mismo que "REVISAR CATALOGO.command" por
rem si vuelve a hacer falta. "python" y no python3: es el comando de Windows.

echo.
echo   ============================================================
echo     REVISAR LOS DATOS DEL CATALOGO
echo   ============================================================
echo.
echo   Baja los productos de ADVAPP y controla que este todo bien
echo   para mostrarse en la web. No publica nada: solo mira.
echo.

python validar.py --todo
set RES=%errorlevel%

echo.
if "%RES%"=="1" goto :hay
if "%RES%"=="2" goto :sinconexion
if "%RES%"=="9009" goto :sinpython

echo   ------------------------------------------------------------
echo     TODO BIEN. No hay errores graves.
echo.
echo     Los avisos de la lista de arriba no rompen nada: son
echo     fotos que faltan y detalles de escritura.
echo   ------------------------------------------------------------
goto :fin

:hay
echo   ------------------------------------------------------------
echo     HAY ERRORES GRAVES
echo.
echo     Son cosas que el cliente esta viendo mal AHORA en la web,
echo     porque el sitio lee ADVAPP en vivo.
echo.
echo     Cada linea dice donde se arregla:
echo       ADVAPP   = se le pide a ADVAPP; el pedido redactado sale con
echo                  python validar.py --pedido
echo       codigo   = hay que tocar index.html
echo       fotos    = falta producir la imagen
echo   ------------------------------------------------------------
goto :fin

:sinconexion
echo   ------------------------------------------------------------
echo     NO SE PUDO REVISAR
echo     Suele ser falta de internet. Proba de nuevo en un rato.
echo   ------------------------------------------------------------
goto :fin

:sinpython
echo   ------------------------------------------------------------
echo     NO SE ENCONTRO PYTHON
echo     Hace falta para revisar los datos.
echo   ------------------------------------------------------------
goto :fin

:fin
echo.
pause
