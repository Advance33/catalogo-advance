@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Publicar catalogo - Advance Tecno

echo.
echo   ============================================================
echo     PUBLICAR EL CATALOGO
echo   ============================================================
echo.

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo   ERROR: esta carpeta no es el repositorio del catalogo.
  echo   Este acceso directo tiene que apuntar a catalogo-advance-publicar.
  echo.
  pause
  exit /b 1
)

rem ---- Revision de la planilla antes de publicar -------------------------
rem  validar.py baja la hoja Landing y controla lo que el catalogo necesita
rem  para mostrarse bien. Codigos: 0 = todo bien, 1 = hay errores graves,
rem  2 = no se pudo revisar (por ejemplo, sin internet).
echo   Revisando la planilla...
echo.
python validar.py
set REVISION=%errorlevel%

if "%REVISION%"=="1"    goto :hay_errores
if "%REVISION%"=="2"    goto :sin_revisar
if "%REVISION%"=="9009" goto :sin_python
goto :revision_lista

:hay_errores
echo.
echo   ------------------------------------------------------------
echo     HAY ERRORES SIN RESOLVER
echo.
echo     Arriba esta la lista. Son cosas que el cliente ve mal en la
echo     web: un color que no coincide con el nombre, una nota interna
echo     que quedo a la vista, una categoria sin definir.
echo.
echo     Cada linea dice donde se arregla:
echo       planilla = se le pide al equipo del sheet
echo       codigo   = hay que tocar index.html
echo       fotos    = falta producir la imagen
echo.
echo     Cuando esten resueltos, volve a abrir este acceso directo.
echo   ------------------------------------------------------------
echo.
choice /c SN /n /m "   Publicar igual, con estos errores? [S = si, N = no]: "
if errorlevel 2 goto :cancelado
echo.
echo   De acuerdo, se publica con los errores.
echo.
goto :revision_lista

:sin_revisar
echo.
echo   AVISO: no se pudo revisar la planilla ^(el detalle esta arriba^).
echo   Suele ser falta de internet. Se puede publicar igual, pero
echo   nadie controlo los datos.
echo.
goto :revision_lista

:sin_python
echo.
echo   AVISO: no se encontro Python, asi que no se reviso la planilla.
echo   Se puede publicar igual.
echo.
goto :revision_lista

:revision_lista
echo   Probando el catalogo...
echo.
python pruebas\correr.py
set PRUEBAS=%errorlevel%
if "%PRUEBAS%"=="1" goto :fallan_pruebas
if "%PRUEBAS%"=="2" echo   AVISO: no se pudieron correr las pruebas ^(ver arriba^). Se publica sin probar.
goto :pruebas_listas

:fallan_pruebas
echo.
echo   ------------------------------------------------------------
echo     HAY COMPROBACIONES QUE FALLAN
echo.
echo     Cada linea que empieza con FALLA es algo que el cliente
echo     veria mal en la web: una tarjeta partida en dos, un boton
echo     repetido, un filtro que deja la grilla vacia.
echo   ------------------------------------------------------------
echo.
choice /c SN /n /m "   Publicar igual? [S = si, N = no]: "
if errorlevel 2 goto :cancelado
echo.

:pruebas_listas
echo.
echo   Revisando las fotos...
echo.
python verificar-fotos.py
set FOTOS=%errorlevel%
if "%FOTOS%"=="1" goto :fotos_dudosas
goto :fotos_listas

:fotos_dudosas
echo.
echo   ------------------------------------------------------------
echo     HAY FOTOS REPETIDAS SIN REVISAR
echo.
echo     Dos productos de modelos distintos estan mostrando la
echo     misma imagen. A veces esta bien (el mismo equipo en otra
echo     capacidad) y a veces es una ficha con el producto
echo     equivocado. El detalle esta en REVISAR-FOTOS.txt.
echo.
echo     Cuando las mires y esten todas bien, corre una vez:
echo        python verificar-fotos.py --aceptar
echo     y de ahi en mas solo avisa por las nuevas.
echo   ------------------------------------------------------------
echo.
choice /c SN /n /m "   Publicar igual? [S = si, N = no]: "
if errorlevel 2 goto :cancelado
echo.

:fotos_listas
git status --porcelain > "%TEMP%\_pub.txt" 2>nul
for /f %%A in ('type "%TEMP%\_pub.txt" ^| find /c /v ""') do set CANT=%%A

if "%CANT%"=="0" (
  echo   El sitio ya esta al dia. No hay nada nuevo para publicar.
  echo.
  echo   https://advance33.github.io/catalogo-advance/
  echo.
  del "%TEMP%\_pub.txt" >nul 2>&1
  pause
  exit /b 0
)

echo   Hay %CANT% cambio^(s^) sin publicar:
echo   ------------------------------------------------------------
git status --short
echo   ------------------------------------------------------------
del "%TEMP%\_pub.txt" >nul 2>&1
echo.
echo     M = modificado    ?? = nuevo    D = borrado
echo.
echo   Una vez publicado, los clientes lo ven en 1 o 2 minutos.
echo.

choice /c SN /n /m "   Publicar estos cambios? [S = si, N = no]: "
if errorlevel 2 (
  echo.
  echo   Cancelado. No se subio nada.
  echo.
  pause
  exit /b 0
)

echo.
echo   Subiendo...
echo.

for /f "tokens=1-3 delims=/ " %%a in ("%date%") do set HOY=%%a/%%b/%%c
for /f "tokens=1-2 delims=:" %%a in ("%time%") do set AHORA=%%a:%%b

git add -A
if errorlevel 1 goto :error
git commit -m "Actualizacion del catalogo - %HOY% %AHORA%" >nul
if errorlevel 1 goto :error
git push origin main
if errorlevel 1 goto :error

echo.
echo   ============================================================
echo     LISTO. %CANT% cambio^(s^) publicados.
echo.
echo     En 1 o 2 minutos se ve en:
echo     https://advance33.github.io/catalogo-advance/
echo.
echo     Si lo abris y no ves el cambio, recarga con Ctrl+F5:
echo     el navegador guarda las fotos viejas.
echo   ============================================================
echo.
pause
exit /b 0

:cancelado
echo.
echo   Cancelado. No se subio nada.
echo.
pause
exit /b 0

:error
echo.
echo   ------------------------------------------------------------
echo     NO SE PUDO PUBLICAR
echo.
echo     Suele ser falta de internet. Revisa la conexion y proba
echo     de nuevo. Si el error se repite, pasale a Claude lo que
echo     dice aca arriba.
echo   ------------------------------------------------------------
echo.
pause
exit /b 1
