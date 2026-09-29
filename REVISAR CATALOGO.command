#!/bin/bash
# Revisar los datos del catalogo  (version Mac de "REVISAR CATALOGO.bat")
# No publica nada: solo mira.
#
# 29/09: decia "Baja la hoja Landing" y "el sitio lee la planilla en vivo".
# Desde el 22/09 los productos vienen de ADVAPP (validar.py dice "Fuente:
# ADVAPP") y la planilla quedo congelada como respaldo; los pedidos van a
# ADVAPP, no al "equipo del sheet".

cd "$(dirname "$0")" || exit 1

PY=python3
command -v $PY >/dev/null 2>&1 || PY=python

echo
echo "   ============================================================"
echo "     REVISAR LOS DATOS DEL CATALOGO"
echo "   ============================================================"
echo
echo "   Baja los productos de ADVAPP y controla que este todo bien"
echo "   para mostrarse en la web. No publica nada: solo mira."
echo

$PY validar.py --todo
RES=$?

echo
if [ "$RES" = "1" ]; then
  echo "   ------------------------------------------------------------"
  echo "     HAY ERRORES GRAVES"
  echo
  echo "     Son cosas que el cliente esta viendo mal AHORA en la web,"
  echo "     porque el sitio lee ADVAPP en vivo."
  echo
  echo "     Cada linea dice donde se arregla:"
  # 29/09: validar.py marcaba estos "planilla"; desde hoy dice ADVAPP
  echo "       ADVAPP   = se le pide a ADVAPP; el pedido redactado:"
  echo "                  $PY validar.py --pedido"
  echo "       codigo   = hay que tocar index.html"
  echo "       fotos    = falta producir la imagen"
  echo "   ------------------------------------------------------------"
elif [ "$RES" = "2" ]; then
  echo "   ------------------------------------------------------------"
  echo "     NO SE PUDO REVISAR"
  echo
  echo "     Suele ser falta de internet. Proba de nuevo en un rato."
  echo "   ------------------------------------------------------------"
elif [ "$RES" = "127" ]; then
  echo "   ------------------------------------------------------------"
  echo "     NO SE ENCONTRO PYTHON"
  echo
  echo "     Hace falta para revisar los datos (python3 --version)."
  echo "   ------------------------------------------------------------"
else
  echo "   ------------------------------------------------------------"
  echo "     TODO BIEN. No hay errores graves."
  echo
  echo "     Los avisos de la lista de arriba no rompen nada: son"
  echo "     fotos que faltan y detalles de escritura."
  echo "   ------------------------------------------------------------"
fi

echo
read -n 1 -s -r -p "   Apreta cualquier tecla para cerrar..."
echo
