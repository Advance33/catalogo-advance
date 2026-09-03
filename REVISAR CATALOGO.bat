@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Revisar catalogo - Advance Tecno

echo.
echo   ============================================================
echo     REVISAR LA PLANILLA DEL CATALOGO
echo   ============================================================
echo.
echo   Baja la hoja Landing y controla que este todo bien para
echo   mostrarse en la web. No publica nada: solo mira.
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
echo     porque el sitio lee la planilla en vivo.
echo.
echo     Cada linea dice donde se arregla:
echo       planilla = se le pide al equipo del sheet
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
echo     Hace falta para revisar la planilla.
echo   ------------------------------------------------------------
goto :fin

:fin
echo.
pause
