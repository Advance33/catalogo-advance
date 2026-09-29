#!/bin/bash
# Probar el catalogo - Advance Tecno  (version Mac de PROBAR.bat)

cd "$(dirname "$0")" || exit 1

PY=python3
command -v $PY >/dev/null 2>&1 || PY=python

echo
echo "   ============================================================"
echo "     PROBAR EL CATALOGO"
echo
echo "     Abre el catalogo con los datos de hoy de ADVAPP y controla que"
echo "     todo siga andando: la agrupacion en tarjetas, que se"
echo "     recomienda en cada categoria, el orden de la barra y como"
echo "     se ve en celular, tablet y pantalla grande."
echo "   ============================================================"
echo

# 29/09 (Pedro eligio 7.1 C y 7.2 B): correr.py separa lo NUEVO de lo que ya
# esta pedido (pruebas/conocidas.json). Sale con 1 si hay nuevas y con 3 si
# lo unico que falla ya se pidio: eso no frena PUBLICAR.
# (29/09, revision) Como en PUBLICAR.command: la salida se guarda (tee) para
# leer "RESULTADO: N NUEVA". Un Traceback de Python tambien sale con 1, y el
# cartel decia "HAY FALLAS NUEVAS · Arriba, en NUEVAS, dice cuales" sin que
# hubiera NUEVAS. -u: sin eso, por el tee, la salida llega toda al final.
PRUEBAS_SALIDA=$(mktemp -t probar-pruebas.XXXXXX)
$PY -u pruebas/correr.py | tee "$PRUEBAS_SALIDA"
RESULTADO=${PIPESTATUS[0]}
NUEVAS=$(sed -n 's/^RESULTADO: \([0-9][0-9]*\) NUEVA.*/\1/p' "$PRUEBAS_SALIDA" | head -1)
rm -f "$PRUEBAS_SALIDA"
echo
if [ "$RESULTADO" = "0" ]; then
  echo "   ------------------------------------------------------------"
  echo "     TODO BIEN. Se puede publicar."
  echo "   ------------------------------------------------------------"
elif [ "$RESULTADO" = "2" ]; then
  echo "   ------------------------------------------------------------"
  echo "     NO SE PUDO PROBAR (el detalle esta arriba)."
  echo "   ------------------------------------------------------------"
elif [ "$RESULTADO" = "3" ]; then
  echo "   ------------------------------------------------------------"
  echo "     NADA NUEVO. Lo que falla ya esta pedido (arriba, en"
  echo "     CONOCIDAS, con los dias que lleva). Se puede publicar:"
  echo "     PUBLICAR no va a preguntar por esto."
  echo "   ------------------------------------------------------------"
elif [ "$RESULTADO" = "1" ] && [ -n "$NUEVAS" ]; then
  echo "   ------------------------------------------------------------"
  echo "     HAY FALLAS NUEVAS ($NUEVAS)"
  echo
  echo "     Arriba, en NUEVAS, dice cuales: es algo que el cliente"
  echo "     puede estar viendo mal y nadie pidio que se arregle."
  echo
  echo "     Si ya se pidio, se anota como conocida (ahi mismo dice"
  echo "     como). Si no sabes por donde empezar, pasale a Claude lo"
  echo "     que dice aca arriba."
  echo "   ------------------------------------------------------------"
else
  # Se rompio en el medio (un Traceback, Ctrl-C): no llego a decir que es
  # nuevo y que ya esta pedido.
  echo "   ------------------------------------------------------------"
  echo "     LAS PRUEBAS TERMINARON MAL (salida $RESULTADO)"
  echo
  echo "     No llegaron a decir que es nuevo y que ya esta pedido."
  echo "     Pasale a Claude lo que dice aca arriba."
  echo "   ------------------------------------------------------------"
fi

echo
read -n 1 -s -r -p "   Apreta cualquier tecla para cerrar..."
echo
