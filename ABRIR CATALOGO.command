#!/bin/bash
# Catalogo Advance - servidor local  (version Mac de "ABRIR CATALOGO.bat")

cd "$(dirname "$0")" || exit 1

PY=python3
command -v $PY >/dev/null 2>&1 || PY=python

echo
echo "  ==========================================="
echo "    CATALOGO ADVANCE"
echo "  ==========================================="
echo
echo "    Abriendo en tu navegador..."
echo
echo "    NO cierres esta ventana mientras lo uses."
echo "    Para apagarlo, cerra esta ventana o apreta Ctrl+C."
echo "  ==========================================="
echo

# Espera 2 segundos y abre el navegador, mientras el servidor arranca abajo
( sleep 2; open "http://localhost:8765" ) &

# El servidor corre en esta ventana. Al cerrarla, se apaga.
# servidor.py es igual que "python -m http.server", pero le avisa al navegador
# que no guarde nada en cache: sin eso, despues de editar el index.html el
# navegador sigue mostrando la version vieja.
$PY servidor.py

# Si Python no esta instalado, el mensaje de error queda visible
echo
echo "  No se pudo iniciar. Revisa que Python este instalado (python3 --version)."
read -n 1 -s -r -p "  Apreta cualquier tecla para cerrar..."
echo
