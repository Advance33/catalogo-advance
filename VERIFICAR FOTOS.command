#!/bin/bash
# Revisar las fotos contra la planilla  (version Mac de "VERIFICAR FOTOS.bat")

cd "$(dirname "$0")" || exit 1

PY=python3
command -v $PY >/dev/null 2>&1 || PY=python

echo
echo "  Revisando las fotos contra la planilla..."
echo

$PY verificar-fotos.py

echo
echo "  ==========================================="
echo "   Listo. Se abre el reporte REVISAR-FOTOS.txt"
echo "  ==========================================="
echo

# En Mac, "open -t" lo abre con el editor de texto por defecto
[ -f REVISAR-FOTOS.txt ] && open -t REVISAR-FOTOS.txt

read -n 1 -s -r -p "  Apreta cualquier tecla para cerrar..."
echo
