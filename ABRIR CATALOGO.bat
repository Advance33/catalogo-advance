@echo off
cd /d "%~dp0"
title Catalogo Advance

echo.
echo  ===========================================
echo    CATALOGO ADVANCE
echo  ===========================================
echo.
echo    Abriendo en tu navegador...
echo.
echo    NO cierres esta ventana mientras lo uses.
echo    Para apagarlo, cerra esta ventana.
echo.
echo  ===========================================
echo.

REM Espera 2 segundos y abre el navegador, mientras el servidor arranca abajo
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start "" http://localhost:8765"

REM El servidor corre en esta ventana. Al cerrarla, se apaga.
REM El servidor.py es igual que "python -m http.server", pero le avisa al
REM navegador que no guarde nada en cache: sin eso, despues de editar el
REM index.html el navegador sigue mostrando la version vieja.
python servidor.py

REM Si Python no esta instalado, el mensaje de error queda visible
echo.
echo  No se pudo iniciar. Revisa que Python este instalado.
pause
