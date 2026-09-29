#!/bin/bash
# Publicar el catalogo - Advance Tecno  (version Mac de PUBLICAR.bat)
#
# Doble clic lo abre en la Terminal. Hace lo mismo que el .bat de Windows y en
# el mismo orden: revisa los datos de ADVAPP, revisa el catalogo de codigos,
# revisa las fotos, corre las pruebas y recien ahi ofrece subir. Desde el
# 29/09, entre las fotos y las pruebas arma tambien las vistas previas para
# WhatsApp (p/<ID>.html), que el .bat no tiene: la PC se retiro el 25/09.
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

# ---- Revision de los datos ---------------------------------------------
#  validar.py baja los productos de ADVAPP (la planilla quedo congelada el
#  22/09 y es solo el respaldo) y controla lo que el catalogo necesita para
#  mostrarse bien. 0 = todo bien, 1 = errores graves, 2 = no se pudo revisar.
#  (29/09: los textos de aca decian "planilla" y "equipo del sheet", y desde
#  el 22/09 los pedidos van a ADVAPP.)
echo "   Revisando los datos de ADVAPP..."
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
  # 29/09: validar.py marcaba estos "planilla"; ahora dice ADVAPP, que es de
  # donde salen los datos desde el 22/09.
  echo "     Cada linea dice donde se arregla:"
  echo "       ADVAPP   = se le pide a ADVAPP (de ahi salen los datos)"
  echo "       codigo   = hay que tocar index.html"
  echo "       fotos    = falta producir la imagen"
  echo
  echo "     Para lo de \"ADVAPP\", el pedido ya redactado sale con:"
  echo "        $PY validar.py --pedido"
  echo "     Queda en PEDIDO-AL-SHEET.txt (el nombre es de antes; adentro"
  echo "     dice ADVAPP). Lo demas que hay que pedirles sale con:"
  echo "        $PY herramientas/pedido-advapp.py"
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
  echo "   AVISO: no se pudieron revisar los datos (el detalle esta arriba)."
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
# La salida se guarda para ver QUE frena (29/09). Hasta ese dia, lo unico que
# frenaba casi siempre era la columna CODIGO de ADVAPP, y el titulo decia "HAY
# FOTOS SIN REVISAR" con cuatro causas y ninguna era esa. La otra memoria del
# mismo modelo ya no frena (Pedro, 26/09: verificar-fotos la lista aparte y
# sale con 0 si es lo unico); si frena, es otra Sim, otro teclado u otro
# modelo, y el titulo lo dice. -u: sin eso, por el tee, la salida llega toda
# junta al final.
FOTOS_SALIDA=$(mktemp -t publicar-fotos.XXXXXX)
$PY -u verificar-fotos.py | tee "$FOTOS_SALIDA"
FOTOS=${PIPESTATUS[0]}
# Los contadores con "<--" que no estan en 0: los de fotos y el de codigos
CODIGOS=$(grep -E '^ *[1-9][0-9]* .*COLUMNAS DE ADVAPP.*<--' "$FOTOS_SALIDA" | wc -l | tr -d ' ')
OTROS=$(grep -E '^ *[1-9][0-9]* .*<--' "$FOTOS_SALIDA" | grep -v 'COLUMNAS DE ADVAPP' | wc -l | tr -d ' ')
rm -f "$FOTOS_SALIDA"
if [ "$FOTOS" -eq 1 ]; then
  echo
  echo "   ------------------------------------------------------------"
  if [ "$CODIGOS" != "0" ] && [ "$OTROS" = "0" ]; then
    echo "     LA COLUMNA CODIGO DE ADVAPP APUNTA A OTRO PRODUCTO"
    echo
    echo "     Las fotos estan bien: lo que frena es el codigo que manda"
    echo "     ADVAPP. Esta arriba y en REVISAR-FOTOS.txt (bloque 14)."
    echo "     Si dice \"pedido a ADVAPP el ...\", ya se les pidio y falta"
    echo "     que lo corrijan. Lo que no, se pide con:"
    echo "        $PY herramientas/pedido-advapp.py"
    echo
    echo "     Mientras tanto, esas fichas pueden mostrar la foto de la"
    echo "     otra Sim, del otro teclado o de otro modelo."
    echo "   ------------------------------------------------------------"
    echo
    preguntar "Publicar igual?" || cancelado
    echo
  else
    echo "     HAY FOTOS SIN REVISAR"
    echo
    echo "     El detalle esta arriba y en REVISAR-FOTOS.txt. Puede ser:"
    echo
    echo "      - Dos productos de modelos distintos con la misma imagen."
    echo "        A veces esta bien (el mismo equipo en otra capacidad)."
    echo "        Si estan todas bien:  $PY verificar-fotos.py --aceptar"
    echo "        (suma a las ya aceptadas, no borra ninguna)"
    echo
    echo "      - Una foto que CAMBIO despues de haberse revisado. Ojo con"
    echo "        esta: asi es como volvia la foto equivocada del iPhone 17."
    echo
    echo "      - Una foto NUEVA que nadie miro todavia."
    echo "        Mirala, y si esta bien anotala:"
    echo "        $PY verificar-fotos.py --revisadas NOMBRE.jpg"
    echo
    echo "      - Una FOTO DE OTRO COLOR: la fila vende un color y muestra"
    echo "        la foto de otro color del mismo producto. Casi siempre es"
    echo "        la columna CODIGO_VAR de ADVAPP; se pide con:"
    echo "        $PY herramientas/pedido-advapp.py"
    echo
    echo "      - La columna CODIGO de ADVAPP apuntando a OTRO producto"
    echo "        (otra Sim, otro teclado u otro modelo): se pide con"
    echo "        $PY herramientas/pedido-advapp.py. La otra memoria del"
    echo "        mismo modelo NO frena (Pedro, 26/09)."
    echo
    echo "      - El CATALOGO MAESTRO ROTO: ahi las fotos no se revisaron"
    echo "        y fotos/indice.json quedo como estaba."
    echo "   ------------------------------------------------------------"
    echo
    preguntar "Publicar igual?" || cancelado
    echo
  fi
fi

# ---- Las vistas previas para WhatsApp ------------------------------------
#  Pedro eligio el 29/09 la B de la decision 4.2: cada fila tiene su pagina
#  chica p/<ID>.html con la foto propia, el modelo y la version, sin precio,
#  que es lo que muestra WhatsApp cuando se manda el link de un producto. Se
#  rehacen aca: despues de las fotos (eligen la foto con fotos/indice.json,
#  que verificar-fotos acaba de escribir) y antes de las pruebas
#  (decision-vista-previa.js las revisa). Solo se reescriben las que
#  cambiaron. No frena: si no se pudieron armar, p/ queda como estaba.
echo
echo "   Armando las vistas previas para WhatsApp..."
echo
$PY herramientas/vista-previa.py
VISTAS=$?
if [ "$VISTAS" = "2" ]; then
  echo
  echo "   AVISO: no se pudieron armar las vistas previas (el motivo esta"
  echo "   arriba). Las paginas p/ quedaron como estaban: un producto nuevo"
  echo "   se comparte con la tarjeta general hasta el proximo PUBLICAR."
  echo "   Se puede publicar igual."
  echo
elif [ "$VISTAS" = "1" ]; then
  echo
  echo "   AVISO: quedaron paginas de filas que ADVAPP ya no trae (el detalle"
  echo "   esta arriba). Se puede publicar igual."
  echo
fi

# ---- Las pruebas --------------------------------------------------------
echo
echo "   Probando el catalogo..."
echo
# Pedro eligio 7.2 B el 29/09: se pregunta "Publicar igual?" solo por lo NUEVO.
# Hasta ese dia se preguntaba siempre que algo fallaba, aunque ya estuviera
# pedido a ADVAPP, y de tanto contestar S se contestaba S tambien el dia que
# aparecia algo nuevo. correr.py sale con 1 si hay nuevas (y dice cuantas en
# "RESULTADO: N NUEVA(S)"), con 3 si lo unico que falla ya esta pedido
# (pruebas/conocidas.json) y con 0 si pasa todo. La salida se guarda (tee)
# para leer ese numero; el avance va por stderr y se sigue viendo. -u: sin
# eso, por el tee, la salida llega toda junta al final.
PRUEBAS_SALIDA=$(mktemp -t publicar-pruebas.XXXXXX)
$PY -u pruebas/correr.py | tee "$PRUEBAS_SALIDA"
PRUEBAS=${PIPESTATUS[0]}
NUEVAS=$(sed -n 's/^RESULTADO: \([0-9][0-9]*\) NUEVA.*/\1/p' "$PRUEBAS_SALIDA" | head -1)
rm -f "$PRUEBAS_SALIDA"
if [ "$PRUEBAS" = "1" ]; then
  echo "   ------------------------------------------------------------"
  if [ -n "$NUEVAS" ]; then
    if [ "$NUEVAS" = "1" ]; then
      echo "     HAY 1 FALLA NUEVA"
    else
      echo "     HAY $NUEVAS FALLAS NUEVAS"
    fi
    echo "     No estaban anotadas como pedidas: estan arriba, en"
    echo "     NUEVAS. Es algo que el cliente puede estar viendo mal"
    echo "     y nadie le pidio a nadie que lo arregle."
  else
    # Salio con 1 sin decir cuantas nuevas: se rompio en el medio
    echo "     LAS PRUEBAS TERMINARON MAL"
    echo
    echo "     No llegaron a decir que es nuevo y que ya esta pedido."
    echo "     Pasale a Claude lo que dice aca arriba."
  fi
  echo "   ------------------------------------------------------------"
  preguntar "Publicar igual?" || cancelado
  echo
elif [ "$PRUEBAS" = "3" ]; then
  # Falla solo lo que ya se pidio: se recuerda (el RESULTADO de arriba dice
  # cuantas y la mas vieja) y se sigue como cualquier dia.
  echo "   Las pruebas no frenan: lo que falla ya esta pedido."
  echo
elif [ "$PRUEBAS" = "2" ]; then
  echo "   AVISO: no se pudieron correr las pruebas (ver arriba). Se publica sin probar."
fi

# ---- Subir --------------------------------------------------------------
CANT=$(git status --porcelain | wc -l | tr -d ' ')

# Las publicaciones que quedaron sin subir (29/09). Si el push falla, el
# commit ya esta hecho y queda solo en esta compu; la vez siguiente el status
# da 0 y se decia "El sitio ya esta al dia" sin subir nada. No se notaba
# porque verificar-fotos reescribia fotos/indice.json todos los dias por la
# fecha, y eso forzaba otro commit que se llevaba el pendiente; desde que
# solo lo escribe si cambio algo, quedaba a la vista. origin/main avanza solo
# cuando un push sale bien, asi que el conteo sirve sin internet y sin fetch.
PEND=$(git rev-list --count origin/main..main 2>/dev/null || echo 0)

if [ "$CANT" = "0" ] && [ "$PEND" = "0" ]; then
  echo "   El sitio ya esta al dia. No hay nada nuevo para publicar."
  echo
  echo "   https://advance33.github.io/catalogo-advance/"
  pausa; exit 0
fi

AHORA=$(date '+%d/%m/%Y %H:%M')

error(){
  echo
  echo "   ------------------------------------------------------------"
  echo "     NO SE PUDO PUBLICAR"
  echo
  echo "     Suele ser falta de internet o la cuenta de GitHub. Revisa"
  echo "     la conexion y proba de nuevo. Si el error se repite, pasale"
  echo "     a Claude lo que dice aca arriba."
  echo "   ------------------------------------------------------------"
  pausa; exit 1
}

# El envio a GitHub, separando el rechazo de la falta de conexion. Si GitHub
# tiene commits que esta compu no tiene (se publica tambien desde otra
# carpeta), reintentar no sirve y un "git pull" a mano puede dejar a quien
# publica en medio de un conflicto en index.html: eso lo resuelve Claude.
# En los dos casos el commit ya quedo hecho aca y el proximo PUBLICAR lo
# vuelve a intentar solo (PEND, arriba).
subir(){
  local salida rc
  salida=$(git push origin main 2>&1)
  rc=$?
  echo "$salida" | sed 's/^/   /'
  [ $rc -eq 0 ] && return 0
  echo
  echo "   ------------------------------------------------------------"
  if echo "$salida" | grep -qiE 'rejected|non-fast-forward|fetch first'; then
    echo "     NO SE PUDO PUBLICAR: GitHub tiene cambios que esta compu"
    echo "     no tiene. No lo reintentes ni lo arregles a mano: pasale a"
    echo "     Claude lo que dice aca arriba."
    echo
    echo "     Lo de hoy quedo guardado en esta compu y se sube cuando"
    echo "     eso este resuelto."
  else
    echo "     NO SE PUDO PUBLICAR"
    echo
    echo "     Suele ser falta de internet o la cuenta de GitHub. Revisa"
    echo "     la conexion y proba de nuevo. Si el error se repite, pasale"
    echo "     a Claude lo que dice aca arriba."
    echo
    echo "     Lo de hoy quedo guardado en esta compu: la proxima vez que"
    echo "     abras PUBLICAR lo vuelve a intentar."
  fi
  echo "   ------------------------------------------------------------"
  pausa; exit 1
}

if [ "$PEND" != "0" ]; then
  echo "   OJO: hay $PEND publicacion(es) anterior(es) que NO llegaron a"
  echo "   GitHub (se hicieron en esta compu, pero el envio fallo):"
  git log --oneline origin/main..main | sed 's/^/      /'
  echo
fi

if [ "$CANT" = "0" ]; then
  preguntar "Subirlas ahora?" || cancelado
  echo
  echo "   Subiendo..."
  echo
  subir
  echo
  echo "   ============================================================"
  echo "     LISTO. Se subieron $PEND publicacion(es) que habian quedado"
  echo "     pendientes."
  echo
  echo "     En 1 o 2 minutos se ve en:"
  echo "     https://advance33.github.io/catalogo-advance/"
  echo "   ============================================================"
  pausa
  exit 0
fi

echo "   Hay $CANT cambio(s) sin publicar:"
echo "   ------------------------------------------------------------"
git status --short
echo "   ------------------------------------------------------------"
echo
echo "     M = modificado    ?? = nuevo    D = borrado"
echo

# Un archivo que cambio TODOS sus finales de linea (CRLF <-> LF) (29/09).
# .gitattributes dice "* -text" a proposito (26/08: git no toca los finales),
# asi que si alguien guarda un archivo con otros finales, el diff lo muestra
# entero y tapa el cambio real: le paso a herramientas/altas-decididas.csv el
# 26/09 (169 lineas de diff para un cambio de 3). No rompe nada; se avisa.
git diff --name-only -z | while IFS= read -r -d '' f; do
  todo=$(git diff --numstat -- "$f" | awk '$1 != "-" {print $1 + $2}')
  real=$(git diff --numstat --ignore-cr-at-eol -- "$f" | awk '$1 != "-" {print $1 + $2}')
  if [ "${todo:-0}" -gt 20 ] && [ $(( ${real:-0} * 4 )) -lt "${todo:-0}" ]; then
    echo "   OJO: $f cambio sus finales de linea (CRLF/LF): el diff"
    echo "   lo muestra entero ($todo lineas) y el cambio real son ${real:-0}."
    echo "   No rompe nada; si no fue a proposito, pasale esto a Claude."
    echo
  fi
done

echo "   Una vez publicado, los clientes lo ven en 1 o 2 minutos."
echo
preguntar "Publicar estos cambios?" || cancelado

echo
echo "   Subiendo..."
echo

git add -A                                              || error
git commit -m "Actualizacion del catalogo - $AHORA" >/dev/null || error
subir

echo
echo "   ============================================================"
echo "     LISTO. $CANT cambio(s) publicados."
if [ "$PEND" != "0" ]; then
  echo "     Y se subieron $PEND publicacion(es) anterior(es) que habian"
  echo "     quedado pendientes."
fi
echo
echo "     En 1 o 2 minutos se ve en:"
echo "     https://advance33.github.io/catalogo-advance/"
echo
echo "     Si lo abris y no ves el cambio, recarga con Cmd+Shift+R:"
echo "     el navegador guarda las fotos viejas."
echo "   ============================================================"
pausa
exit 0
