#!/bin/bash
# Probar el catalogo - Advance Tecno  (version Mac de PROBAR.bat)

cd "$(dirname "$0")" || exit 1

PY=python3
command -v $PY >/dev/null 2>&1 || PY=python

echo
echo "   ============================================================"
echo "     PROBAR EL CATALOGO"
echo
echo "     Abre el catalogo con la planilla de verdad y controla que"
echo "     todo siga andando: la agrupacion en tarjetas, que se"
echo "     recomienda en cada categoria, el orden de la barra y como"
echo "     se ve en celular, tablet y pantalla grande."
echo "   ============================================================"
echo

$PY pruebas/correr.py
RESULTADO=$?

echo
if [ "$RESULTADO" = "0" ]; then
  echo "   ------------------------------------------------------------"
  echo "     TODO BIEN. Se puede publicar."
  echo "   ------------------------------------------------------------"
elif [ "$RESULTADO" = "2" ]; then
  echo "   ------------------------------------------------------------"
  echo "     NO SE PUDO PROBAR (el detalle esta arriba)."
  echo "   ------------------------------------------------------------"
else
  echo "   ------------------------------------------------------------"
  echo "     HAY COMPROBACIONES QUE FALLAN"
  echo
  echo "     Arriba dice cuales. Cada linea que empieza con FALLA es"
  echo "     algo que el cliente veria mal en la web."
  echo
  echo "     Si no sabes por donde empezar, pasale a Claude lo que"
  echo "     dice aca arriba."
  echo "   ------------------------------------------------------------"
fi

echo
read -n 1 -s -r -p "   Apreta cualquier tecla para cerrar..."
echo
