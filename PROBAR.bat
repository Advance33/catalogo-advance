@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Probar el catalogo - Advance Tecno

echo.
echo   ============================================================
echo     PROBAR EL CATALOGO
echo.
echo     Abre el catalogo con la planilla de verdad y controla que
echo     todo siga andando: la agrupacion en tarjetas, que se
echo     recomienda en cada categoria, el orden de la barra y como
echo     se ve en celular, tablet y pantalla grande.
echo   ============================================================
echo.

python pruebas\correr.py
set RESULTADO=%errorlevel%

echo.
if "%RESULTADO%"=="0" (
  echo   ------------------------------------------------------------
  echo     TODO BIEN. Se puede publicar.
  echo   ------------------------------------------------------------
) else if "%RESULTADO%"=="2" (
  echo   ------------------------------------------------------------
  echo     NO SE PUDO PROBAR ^(el detalle esta arriba^).
  echo   ------------------------------------------------------------
) else (
  echo   ------------------------------------------------------------
  echo     HAY COMPROBACIONES QUE FALLAN
  echo.
  echo     Arriba dice cuales. Cada linea que empieza con FALLA es
  echo     algo que el cliente veria mal en la web.
  echo.
  echo     Si no sabes por donde empezar, pasale a Claude lo que
  echo     dice aca arriba.
  echo   ------------------------------------------------------------
)
echo.
pause
