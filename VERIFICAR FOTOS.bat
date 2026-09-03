@echo off
cd /d "%~dp0"
title Verificar fotos del catalogo
echo.
echo  Revisando las fotos contra la planilla...
echo.
python verificar-fotos.py
echo.
echo  ===========================================
echo   Listo. Se abre el reporte REVISAR-FOTOS.txt
echo  ===========================================
echo.
if exist REVISAR-FOTOS.txt start "" notepad REVISAR-FOTOS.txt
pause
