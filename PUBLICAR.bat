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

rem ---- Revision de los datos antes de publicar ---------------------------
rem  validar.py baja los productos de ADVAPP (la planilla quedo congelada el
rem  22/09 y es solo el respaldo) y controla lo que el catalogo necesita
rem  para mostrarse bien. Codigos: 0 = todo bien, 1 = hay errores graves,
rem  2 = no se pudo revisar (por ejemplo, sin internet).
rem  La PC se retiro el 25/09, pero este archivo sigue diciendo lo mismo que
rem  PUBLICAR.command, por si vuelve a hacer falta.
echo   Revisando los datos de ADVAPP...
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
rem 29/09: validar.py marcaba estos "planilla"; ahora dice ADVAPP. Aca los
rem comandos siguen con "python": es el de Windows (en la Mac, python3).
echo     Cada linea dice donde se arregla:
echo       ADVAPP   = se le pide a ADVAPP ^(de ahi salen los datos^)
echo       codigo   = hay que tocar index.html
echo       fotos    = falta producir la imagen
echo.
echo     Para lo de "ADVAPP", el pedido ya redactado sale con:
echo        python validar.py --pedido
echo     Queda en PEDIDO-AL-SHEET.txt ^(el nombre es de antes; adentro
echo     dice ADVAPP^). Lo demas que hay que pedirles sale con:
echo        python herramientas\pedido-advapp.py
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
echo   AVISO: no se pudieron revisar los datos ^(el detalle esta arriba^).
echo   Suele ser falta de internet. Se puede publicar igual, pero
echo   nadie controlo los datos.
echo.
goto :revision_lista

:sin_python
echo.
echo   AVISO: no se encontro Python, asi que no se revisaron los datos.
echo   Se puede publicar igual.
echo.
goto :revision_lista

:revision_lista
echo   Revisando el catalogo de codigos...
echo.
python herramientas\validar-catalogo.py
if errorlevel 1 goto :catalogo_roto
goto :catalogo_listo

:catalogo_roto
echo.
echo   ------------------------------------------------------------
echo     EL CATALOGO DE CODIGOS TIENE ERRORES
echo.
echo     Ahi vive la identidad de cada producto: si se rompe, las
echo     fotos se quedan sin dueno y no hay como reconstruirlo.
echo     Mirar el detalle de arriba antes de seguir.
echo   ------------------------------------------------------------
echo.
choice /c SN /n /m "   Publicar igual? [S = si, N = no]: "
if errorlevel 2 goto :cancelado
echo.

:catalogo_listo
echo.
echo   Revisando las fotos...
echo.
python verificar-fotos.py
set FOTOS=%errorlevel%
if "%FOTOS%"=="1" goto :fotos_dudosas
goto :fotos_listas

:probar_catalogo
echo.
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
goto :pruebas_listas

:fotos_dudosas
rem 29/09: el .command separa en el titulo el caso en que lo unico que frena
rem es la columna CODIGO de ADVAPP; aca, con la PC retirada el 25/09, se dice
rem en la lista. La otra memoria del mismo modelo ya no frena (Pedro, 26/09).
echo.
echo   ------------------------------------------------------------
echo     HAY FOTOS ^(O CODIGOS DE ADVAPP^) SIN RESOLVER
echo.
echo     El detalle esta arriba y en REVISAR-FOTOS.txt. Puede ser:
echo.
echo      - Dos productos de modelos distintos con la misma imagen.
echo        A veces esta bien (el mismo equipo en otra capacidad).
echo        Si estan todas bien:  python verificar-fotos.py --aceptar
echo        (suma a las ya aceptadas, no borra ninguna)
echo.
echo      - Una foto que CAMBIO despues de haberse revisado. Ojo con
echo        esta: asi es como volvia la foto equivocada del iPhone 17.
echo.
echo      - Una foto NUEVA que nadie miro todavia.
echo        Mirala, y si esta bien anotala:
echo        python verificar-fotos.py --revisadas NOMBRE.jpg
echo.
echo      - Una FOTO DE OTRO COLOR: la fila vende un color y muestra
echo        la foto de otro color del mismo producto. Casi siempre es
echo        la columna CODIGO_VAR de ADVAPP; se pide con:
echo        python herramientas\pedido-advapp.py
echo.
echo      - La columna CODIGO de ADVAPP apuntando a OTRO producto
echo        ^(otra Sim, otro teclado u otro modelo^): se pide con
echo        python herramientas\pedido-advapp.py. La otra memoria del
echo        mismo modelo NO frena ^(Pedro, 26/09^).
echo.
echo      - El CATALOGO MAESTRO ROTO: ahi las fotos no se revisaron y
echo        fotos\indice.json quedo como estaba.
echo   ------------------------------------------------------------
echo.
choice /c SN /n /m "   Publicar igual? [S = si, N = no]: "
if errorlevel 2 goto :cancelado
echo.

:fotos_listas
goto :probar_catalogo

:pruebas_listas
git status --porcelain > "%TEMP%\_pub.txt" 2>nul
for /f %%A in ('type "%TEMP%\_pub.txt" ^| find /c /v ""') do set CANT=%%A

rem Las publicaciones que quedaron sin subir (29/09): si el push falla, el
rem commit ya esta hecho y la vez siguiente el status da 0. Antes se decia
rem "El sitio ya esta al dia" sin subir nada. origin/main avanza solo cuando
rem un push sale bien, asi que el conteo sirve sin internet. El detalle esta
rem en PUBLICAR.command.
set PEND=0
for /f %%A in ('git rev-list --count origin/main..main 2^>nul') do set PEND=%%A

if not "%CANT%"=="0" goto :hay_algo
if not "%PEND%"=="0" goto :hay_algo
echo   El sitio ya esta al dia. No hay nada nuevo para publicar.
echo.
echo   https://advance33.github.io/catalogo-advance/
echo.
del "%TEMP%\_pub.txt" >nul 2>&1
pause
exit /b 0

:hay_algo
if "%PEND%"=="0" goto :sin_pendientes
echo   OJO: hay %PEND% publicacion^(es^) anterior^(es^) que NO llegaron a
echo   GitHub ^(se hicieron en esta compu, pero el envio fallo^):
git log --oneline origin/main..main
echo.
if not "%CANT%"=="0" goto :sin_pendientes
del "%TEMP%\_pub.txt" >nul 2>&1
choice /c SN /n /m "   Subirlas ahora? [S = si, N = no]: "
if errorlevel 2 goto :cancelado
echo.
echo   Subiendo...
echo.
goto :subir

:sin_pendientes
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

:subir
rem El envio, separando el rechazo (GitHub tiene commits que esta compu no
rem tiene) de la falta de conexion: con el rechazo reintentar no sirve.
git push origin main > "%TEMP%\_push.txt" 2>&1
set PUSH=%errorlevel%
type "%TEMP%\_push.txt"
if "%PUSH%"=="0" goto :subido
findstr /i /c:"rejected" /c:"non-fast-forward" /c:"fetch first" "%TEMP%\_push.txt" >nul
if errorlevel 1 goto :error_push
goto :rechazado

:subido
del "%TEMP%\_push.txt" >nul 2>&1
echo.
echo   ============================================================
if "%CANT%"=="0" (
  echo     LISTO. Se subieron %PEND% publicacion^(es^) que habian quedado
  echo     pendientes.
) else (
  echo     LISTO. %CANT% cambio^(s^) publicados.
)
if not "%CANT%"=="0" if not "%PEND%"=="0" echo     Y se subieron %PEND% publicacion^(es^) anterior^(es^) pendientes.
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
echo     Suele ser falta de internet o la cuenta de GitHub. Revisa
echo     la conexion y proba de nuevo. Si el error se repite, pasale
echo     a Claude lo que dice aca arriba.
echo   ------------------------------------------------------------
echo.
pause
exit /b 1

:error_push
del "%TEMP%\_push.txt" >nul 2>&1
echo.
echo   ------------------------------------------------------------
echo     NO SE PUDO PUBLICAR
echo.
echo     Suele ser falta de internet o la cuenta de GitHub. Revisa
echo     la conexion y proba de nuevo. Si el error se repite, pasale
echo     a Claude lo que dice aca arriba.
echo.
echo     Lo de hoy quedo guardado en esta compu: la proxima vez que
echo     abras PUBLICAR lo vuelve a intentar.
echo   ------------------------------------------------------------
echo.
pause
exit /b 1

:rechazado
del "%TEMP%\_push.txt" >nul 2>&1
echo.
echo   ------------------------------------------------------------
echo     NO SE PUDO PUBLICAR: GitHub tiene cambios que esta compu
echo     no tiene. No lo reintentes ni lo arregles a mano: pasale a
echo     Claude lo que dice aca arriba.
echo.
echo     Lo de hoy quedo guardado en esta compu y se sube cuando
echo     eso este resuelto.
echo   ------------------------------------------------------------
echo.
pause
exit /b 1
