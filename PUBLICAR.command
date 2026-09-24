#!/bin/bash
# Publicar el catalogo - Advance Tecno  (version Mac de PUBLICAR.bat)
#
# Doble clic lo abre en la Terminal. Hace lo mismo que el .bat de Windows y en
# el mismo orden: revisa la planilla, revisa el catalogo de codigos, revisa las
# fotos, corre las pruebas y recien ahi ofrece subir.
#
# En Mac el comando es python3, no python.

cd "$(dirname "$0")" || exit 1

PY=python3
command -v $PY >/dev/null 2>&1 || PY=python

pausa(){ echo; read -n 1 -s -r -p "   Apreta cualquier tecla para cerrar..."; echo; }

# Devuelve 0 si contesta S, 1 si contesta N
preguntar(){
  local r
  while true; do
    read -n 1 -r -p "   $1 [S = si, N = no]: " r
    echo
    case "$r" in
      [Ss]) return 0 ;;
      [Nn]) return 1 ;;
    esac
  done
}

cancelado(){ echo; echo "   Cancelado. No se subio nada."; pausa; exit 0; }

echo
echo "   ============================================================"
echo "     PUBLICAR EL CATALOGO"
echo "   ============================================================"
echo

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "   ERROR: esta carpeta no es el repositorio del catalogo."
  echo "   Este acceso directo tiene que apuntar a catalogo-advance-publicar."
  pausa; exit 1
fi

# ---- Revision de la planilla -------------------------------------------
#  validar.py baja la hoja Landing y controla lo que el catalogo necesita para
#  mostrarse bien. 0 = todo bien, 1 = errores graves, 2 = no se pudo revisar.
echo "   Revisando la planilla..."
echo
$PY validar.py
REVISION=$?

if [ "$REVISION" = "1" ]; then
  echo
  echo "   ------------------------------------------------------------"
  echo "     HAY ERRORES SIN RESOLVER"
  echo
  echo "     Arriba esta la lista. Son cosas que el cliente ve mal en la"
  echo "     web: un color que no coincide con el nombre, una nota interna"
  echo "     que quedo a la vista, una categoria sin definir."
  echo
  echo "     Cada linea dice donde se arregla:"
  echo "       planilla = se le pide al equipo del sheet"
  echo "       codigo   = hay que tocar index.html"
  echo "       fotos    = falta producir la imagen"
  echo
  echo "     Para lo de \"planilla\", el pedido ya redactado sale con:"
  echo "        $PY validar.py --pedido"
  echo "     Queda en PEDIDO-AL-SHEET.txt, listo para copiar y mandar."
  echo
  echo "     Cuando esten resueltos, volve a abrir este acceso directo."
  echo "   ------------------------------------------------------------"
  echo
  preguntar "Publicar igual, con estos errores?" || cancelado
  echo
  echo "   De acuerdo, se publica con los errores."
  echo
elif [ "$REVISION" = "2" ]; then
  echo
  echo "   AVISO: no se pudo revisar la planilla (el detalle esta arriba)."
  echo "   Suele ser falta de internet. Se puede publicar igual, pero"
  echo "   nadie controlo los datos."
  echo
fi

# ---- El catalogo de codigos --------------------------------------------
echo "   Revisando el catalogo de codigos..."
echo
$PY herramientas/validar-catalogo.py
if [ $? -ne 0 ]; then
  echo
  echo "   ------------------------------------------------------------"
  echo "     EL CATALOGO DE CODIGOS TIENE ERRORES"
  echo
  echo "     Ahi vive la identidad de cada producto: si se rompe, las"
  echo "     fotos se quedan sin dueno y no hay como reconstruirlo."
  echo "     Mirar el detalle de arriba antes de seguir."
  echo "   ------------------------------------------------------------"
  echo
  preguntar "Publicar igual?" || cancelado
  echo
fi

# ---- Las fotos ----------------------------------------------------------
echo
echo "   Revisando las fotos..."
echo
$PY verificar-fotos.py
if [ $? -eq 1 ]; then
  echo
  echo "   ------------------------------------------------------------"
  echo "     HAY FOTOS SIN REVISAR"
  echo
  echo "     Puede ser una de tres cosas, y el detalle esta en"
  echo "     REVISAR-FOTOS.txt:"
  echo
  echo "      - Dos productos de modelos distintos con la misma imagen."
  echo "        A veces esta bien (el mismo equipo en otra capacidad)."
  echo "        Si estan todas bien:  $PY verificar-fotos.py --aceptar"
  echo
  echo "      - Una foto que CAMBIO despues de haberse revisado. Ojo con"
  echo "        esta: asi es como volvia la foto equivocada del iPhone 17."
  echo
  echo "      - Una foto NUEVA que nadie miro todavia."
  echo
  echo "      - Una PORTADA que es la foto de un color que la fila ya no"
  echo "        vende. Las fotos se llaman SKU-color.jpg y la portada es"
  echo "        la del primer color: alguien copio mal un archivo."
  echo
  echo "     Para las ultimas: mira la foto, y si esta bien anotala"
  echo "        $PY verificar-fotos.py --revisadas NOMBRE.jpg"
  echo "   ------------------------------------------------------------"
  echo
  preguntar "Publicar igual?" || cancelado
  echo
fi

# ---- Las pruebas --------------------------------------------------------
echo
echo "   Probando el catalogo..."
echo
$PY pruebas/correr.py
PRUEBAS=$?
if [ "$PRUEBAS" = "1" ]; then
  echo
  echo "   ------------------------------------------------------------"
  echo "     HAY COMPROBACIONES QUE FALLAN"
  echo
  echo "     Cada linea que empieza con FALLA es algo que el cliente"
  echo "     veria mal en la web: una tarjeta partida en dos, un boton"
  echo "     repetido, un filtro que deja la grilla vacia."
  echo "   ------------------------------------------------------------"
  echo
  preguntar "Publicar igual?" || cancelado
  echo
elif [ "$PRUEBAS" = "2" ]; then
  echo "   AVISO: no se pudieron correr las pruebas (ver arriba). Se publica sin probar."
fi

# ---- Subir --------------------------------------------------------------
CANT=$(git status --porcelain | wc -l | tr -d ' ')

if [ "$CANT" = "0" ]; then
  echo "   El sitio ya esta al dia. No hay nada nuevo para publicar."
  echo
  echo "   https://advance33.github.io/catalogo-advance/"
  pausa; exit 0
fi

echo "   Hay $CANT cambio(s) sin publicar:"
echo "   ------------------------------------------------------------"
git status --short
echo "   ------------------------------------------------------------"
echo
echo "     M = modificado    ?? = nuevo    D = borrado"
echo
echo "   Una vez publicado, los clientes lo ven en 1 o 2 minutos."
echo
preguntar "Publicar estos cambios?" || cancelado

echo
echo "   Subiendo..."
echo

AHORA=$(date '+%d/%m/%Y %H:%M')

error(){
  echo
  echo "   ------------------------------------------------------------"
  echo "     NO SE PUDO PUBLICAR"
  echo
  echo "     Suele ser falta de internet. Revisa la conexion y proba"
  echo "     de nuevo. Si el error se repite, pasale a Claude lo que"
  echo "     dice aca arriba."
  echo "   ------------------------------------------------------------"
  pausa; exit 1
}

git add -A                                              || error
git commit -m "Actualizacion del catalogo - $AHORA" >/dev/null || error
git push origin main                                    || error

echo
echo "   ============================================================"
echo "     LISTO. $CANT cambio(s) publicados."
echo
echo "     En 1 o 2 minutos se ve en:"
echo "     https://advance33.github.io/catalogo-advance/"
echo
echo "     Si lo abris y no ves el cambio, recarga con Cmd+Shift+R:"
echo "     el navegador guarda las fotos viejas."
echo "   ============================================================"
pausa
exit 0
