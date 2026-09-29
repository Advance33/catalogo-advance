"""Chequeo automatico de las fotos del catalogo.

Baja los productos de ADVAPP (la planilla, congelada desde el 22/09, queda de
respaldo) y compara contra la carpeta fotos/. Desde el 10/09 las fotos se
llaman por el codigo propio del catalogo maestro (herramientas/catalogo-
maestro.csv):
    fotos/AT-####-NN.jpg        la foto de esa variante (un color)
    fotos/AT-####.jpg           el producto sin variantes
Los nombres de las dos etapas anteriores (por SKU y por ID) se siguen
entendiendo, y se avisa para renombrarlos.

Avisa de:
  1. Productos sin foto de portada (y aparte, los que muestran la foto de
     ADVAPP porque no hay una nuestra: esa no la reviso nadie)
  2. Colores sin su foto
  3. Fotos huerfanas (su producto hoy no tiene fila)
  4. Fotos de una variante que ninguna fila vende hoy
  5. MISMA FOTO en productos distintos (distinto Modelo Y distinto SKU)
  6. Fotos que no son 900x900
  7. Fotos que CAMBIARON despues de haberse revisado
  8. Fotos nuevas que nadie miro
  9. Mismo color con distinta foto en filas del mismo grupo
 10. Fotos con nombre viejo (por SKU o por ID): faltan renombrar
 11. Fotos de un color que son la foto de OTRO color del mismo producto
 12. Fotos viejas que quedaron por mirar
 13. Dos colores del MISMO producto con la misma imagen
 14. La columna CODIGO de ADVAPP apuntando a otro producto (otra Sim, otro
     teclado u otro modelo). La otra memoria del mismo modelo se lista
     aparte y no frena (Pedro, 26/09): mismo criterio que pruebas/codigos.js

Frenan la publicacion el (5), el (7), el (8), el (11) y el (14): son las
formas que tiene una ficha de mostrar otro producto u otro color. El (7) y el (8) exigen
que alguien haya mirado cada imagen y que siga siendo la misma; el (11) mira
que la foto de cada color no sea la de otro color que el producto vende HOY,
que es como volvian los errores cuando la planilla rotaba colores bajo el
mismo ID. (El 3b, las fotos que perdian su producto al cambiar el SKU, se
saco el 29/09: con nombres por codigo no puede pasar, y la lista estaba
vacia siempre.)

Se corre con doble clic en "VERIFICAR FOTOS.command" (en Windows, el .bat),
o: python3 verificar-fotos.py
Escribe el resultado en REVISAR-FOTOS.txt y el indice fotos/indice.json que
lee la web para elegir la portada.

  python3 verificar-fotos.py --revisadas   anota TODAS las de hoy como miradas
  python3 verificar-fotos.py --revisadas X.jpg    anota solo esa
  python3 verificar-fotos.py --sembrar     arranca el registro: lo ya mirado
                                           queda mirado y el resto, pendiente
  python3 verificar-fotos.py --aceptar     SUMA los duplicados de hoy a los
                                           ya aceptados (no borra ninguno)
"""
import csv, io, os, re, sys, json, hashlib, collections, urllib.request, datetime

AQUI   = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.join(AQUI, 'herramientas'))
import fotos_sku as FS                        # la unica verdad sobre nombres de foto
import catalogo_maestro as CM                 # la identidad propia de cada producto
import validar                                # la lista de colores del catalogo

SHEET_ID  = '18xxslIKTBnVMrLixCGlQBJGje3vKBYQHXy0qvVp8tpQ'
SHEET_GID = '482985525'
FOTOS  = os.path.join(AQUI, 'fotos')
SALIDA = os.path.join(AQUI, 'REVISAR-FOTOS.txt')
ACEPTADAS = os.path.join(AQUI, 'fotos-aceptadas.txt')
REVISADAS = os.path.join(AQUI, 'fotos-revisadas.txt')
INDICE = os.path.join(FOTOS, 'indice.json')
PLANILLA_NOMBRES = os.path.join(AQUI, 'herramientas', 'planilla-de-los-nombres.csv')


def leer_revisadas():
    """Lo que ya se miro: nombre de archivo -> (huella, mirada).

    El chequeo de duplicados no alcanza para una foto que esta mal ella sola.
    El iPhone 17 mostro durante meses un Air y no habia dos productos con la
    misma imagen, asi que nada lo marcaba. Con esto, una foto que cambia deja
    de coincidir con su huella y el sitio no se publica hasta que alguien la
    vuelva a mirar. Las que dicen "sin mirar" son un pendiente, no frenan.
    """
    reg = {}
    if os.path.exists(REVISADAS):
        with open(REVISADAS, encoding='utf-8') as fh:
            for linea in fh:
                datos, _, nota = linea.partition('#')
                partes = datos.split()
                if len(partes) == 2:
                    reg[partes[1]] = (partes[0], 'sin mirar' not in nota)
    return reg


RE_ACEPTADA = re.compile(r'^([0-9a-f]{32})(\s+)(\d+)(.*)$')


def leer_aceptadas(lineas):
    """Las aceptaciones de fotos-aceptadas.txt: (huella -> en cuantos modelos,
    claves viejas por lista de IDs). Recibe las lineas del archivo."""
    md5, ids = {}, set()
    for linea in lineas:
        datos = linea.split('#')[0].strip()
        p = datos.split()
        if len(p) == 2 and re.fullmatch(r'[0-9a-f]{32}', p[0]) and p[1].isdigit():
            md5[p[0]] = int(p[1])
        elif datos:
            ids.add(datos)
    return md5, ids


def fusionar_aceptadas(lineas, repetidas, hoy):
    """--aceptar SUMA a lo que ya estaba; no reescribe (29/09).

    Antes el archivo se regeneraba solo con los duplicados que se veian ese
    dia. El 29/09 hubiera borrado dos aceptaciones (el iPad 11 A16 y el iPhone
    17E White) solo porque ADVAPP igualo el texto del Modelo y dejaron de
    contar como duplicado, y ademas pisaba las notas escritas a mano con el
    porque de cada una (las decisiones de Pedro del 26/09: "la memoria no se
    ve", "el teclado no se distingue"). Cuando el texto volviera a rotar, la
    alarma sonaba otra vez por algo que ya se habia mirado.

    Ahora: cada linea que ya estaba queda tal cual, comentario incluido; una
    huella nueva se agrega al final con la fecha; y si una huella ya aceptada
    aparece hoy en MAS modelos que los anotados, se sube solo el numero y se
    anota la fecha, sin tocar el comentario. Si aparece en menos no se baja:
    bajarlo haria sonar la alarma la proxima vez que el texto rote. Lo que ya
    no haga falta se borra a mano.

    Devuelve (lineas nuevas, cuantas se sumaron, cuantas se subieron)."""
    ya, _ = leer_aceptadas(lineas)
    salida, subidas = [], 0
    hoy_por_md5 = {}
    for mods, ids_, fs, h in repetidas:
        hoy_por_md5[h] = max(hoy_por_md5.get(h, 0), len(mods))
    if not any(l.startswith('#') for l in lineas):
        lineas = ['# Duplicados de foto ya revisados y dados por buenos:',
                  '# huella de la imagen, en cuantos modelos aparece, y cuales.',
                  '# Se regenera con:'] + list(lineas)
    for linea in lineas:
        if linea.startswith('# Se regenera con:'):
            # la cabecera de antes decia lo contrario de lo que pasa ahora
            linea = ('# Se SUMAN con: python3 verificar-fotos.py --aceptar (no borra '
                     'nada: lo que ya no haga falta se borra a mano)')
        m = RE_ACEPTADA.match(linea)
        if m and hoy_por_md5.get(m.group(1), 0) > int(m.group(3)):
            n = hoy_por_md5[m.group(1)]
            resto = m.group(4).rstrip()
            # la nota va siempre despues de un '#': suelta, la linea dejaria
            # de leerse como huella y pasaria por una clave vieja de IDs
            if '#' not in resto:
                resto += '   #'
            linea = '%s%s%d%s (sube a %d modelos el %s)' % (
                m.group(1), m.group(2), n, resto, n, hoy)
            subidas += 1
        salida.append(linea)
    while salida and not salida[-1].strip():
        salida.pop()
    sumadas = 0
    for mods, ids_, fs, h in repetidas:
        if h in ya:
            continue
        ya[h] = len(mods)
        salida.append('%s  %d   # %s (aceptada el %s)'
                      % (h, len(mods), ' | '.join(mods)[:70], hoy))
        sumadas += 1
    salida.append('')
    return salida, sumadas, subidas


def bajar():
    """Lo que muestra la web: ADVAPP (validar.bajar_advapp), y si no contesta,
    la planilla, que esta congelada desde el 22/09. Hasta el 26/09 este
    chequeo miraba solo la planilla y no veia los productos nuevos de ADVAPP."""
    try:
        filas = [x for x in validar.bajar_advapp() if x.get('ID', '').strip()]
        if filas:
            print('Fuente: ADVAPP')
            return filas
    except Exception as e:
        print('AVISO: ADVAPP no contesto (%s); se usa la planilla, congelada '
              'desde el 22/09.' % e)
    return bajar_planilla()


def bajar_planilla():
    """La Landing entera. Se bajan las dos fuentes y se usa la que trae mas.

    gviz respeta los filtros que alguien deja puestos en la hoja y export no.
    El 16/09 quedo un filtro en la Landing y gviz trajo 55 filas de 583: este
    chequeo informo 615 fotos "huerfanas" y reescribio fotos/indice.json con
    esa planilla recortada. La web ya se cuidaba de eso (bajarCSV en
    index.html); este script no.
    """
    base = f'https://docs.google.com/spreadsheets/d/{SHEET_ID}'
    fuentes = [f'{base}/export?format=csv&gid={SHEET_GID}',
               f'{base}/gviz/tq?tqx=out:csv&headers=1&gid={SHEET_GID}']
    mejor, cuantas, error = None, [], None
    for url in fuentes:
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                txt = r.read().decode('utf-8')
        except Exception as e:
            error = e
            continue
        if txt.lstrip().lower().startswith(('<!doctype', '<html')):
            raise SystemExit('ERROR: la planilla no es publica (Google devolvio HTML)')
        filas = [x for x in csv.DictReader(io.StringIO(txt)) if x.get('ID', '').strip()]
        cuantas.append(len(filas))
        if mejor is None or len(filas) > len(mejor):
            mejor = filas
    if mejor is None:
        raise SystemExit('ERROR: no se pudo bajar la planilla (%s)' % error)
    if not mejor:
        raise SystemExit('ERROR: la planilla vino vacia')
    if len(set(cuantas)) > 1:
        print('AVISO: las dos fuentes no traen lo mismo (%s filas). Casi siempre es un'
              ' filtro puesto en la hoja Landing: se usa la que trae mas.'
              % ' y '.join(map(str, cuantas)))
    return mejor


# --------------------------------------------------------------------------
# La columna CODIGO de ADVAPP contra el catalogo (29/09, hallazgo 162)
# --------------------------------------------------------------------------
# Hasta el 29/09 cualquier diferencia entre la columna y el catalogo era un
# "choque" que frenaba la publicacion. Pero Pedro decidio el 26/09 que el
# mismo modelo con otra memoria se ve igual: ADVAPP le pone al 16 Pro Max 512
# el codigo del 256 (AT-0068) y la foto del hermano esta bien. Con eso
# PUBLICAR mostraba todos los dias "HAY FOTOS SIN REVISAR" por cosas ya
# aceptadas, uno se acostumbraba a apretar S, y una falla nueva pasaba de
# largo. Ademas este script y pruebas/codigos.js no contaban lo mismo (22 o 33
# aca, 51 alla): aca el catalogo se resolvia con codigo_de_la_fila, que es
# mas estricto que lo que hace la web.
#
# Ahora es el MISMO criterio que la seccion 8 de pruebas/codigos.js, paso por
# paso, para que las dos puntas digan lo mismo (medido el 29/09: los mismos 51
# choques y la misma clase para cada uno):
#   1. El catalogo se lee como la web (codigoDeLaFila sin las columnas): el
#      mapa de fotos/indice.json, por ID o SKU, y solo si la firma cierra.
#   2. Las filas que ese codigo "tiene de verdad" son las que la columna Y el
#      mapa le dan. Si ninguna vende la misma Sim y el mismo teclado (del SKU,
#      como simDelSku y tecladoDelSku), es otro producto: FRENA (Pedro, 26/09:
#      Sim y eSIM, teclado ES y EN, son productos distintos).
#   3. Si alguna es de la misma familia() -la regla con la que la pagina junta
#      un modelo con sus memorias-, es otra memoria: se ACEPTA y no frena.
#   4. Si no, es otro modelo: FRENA.
#   5. Si ninguna fila de hoy lleva ese codigo, la web no puede juzgar y lo
#      deja para aca: se decide igual, pero contra el producto del catalogo
#      maestro (sus SKU y sus nombres). Asi los MacBook Air 13 con AT-0522
#      ("16ram 512gb") cuentan como otra memoria.
# Si se cambia alla, se cambia aca. familia() y "que filas muestra la web"
# son las de validar.py (familia_web, fila_activa), las mismas que usa
# validar.PortadaWeb: una sola copia de cada regla de la pagina.

def sim_del_sku(s):
    """simDelSku() de index.html."""
    x = (s or '').lower()
    return 'E-Sim' if re.search(r'[-~]e-?sim$', x) else 'Sim' if re.search(r'[-~]sim$', x) else ''


def teclado_del_sku(s):
    """tecladoDelSku() de index.html."""
    m = re.search(r'[-~]teclado(es|en)$', (s or '').lower())
    return m.group(1).upper() if m else ''


def sim_tec(fila):
    """Lo que compara codigos.js: la Sim y el teclado leidos SOLO del SKU."""
    s = (fila.get('SKU') or '').strip()
    return (sim_del_sku(s) or '-') + '/' + (teclado_del_sku(s) or '-')


def codigo_como_la_web(fila, mapa):
    """codigoDeLaFila() de index.html con las columnas vacias: el ID o el SKU
    en el mapa del catalogo, y solo si la firma de hoy es una de las suyas."""
    firma = CM.firma_de_producto(fila.get('Marca'), fila.get('Categoría'),
                                 fila.get('Descripción completa') or fila.get('Modelo'))
    for clave in ((fila.get('ID') or '').strip(), (fila.get('SKU') or '').strip()):
        cod = clave and ((mapa.get('ids') or {}).get(clave) or (mapa.get('skus') or {}).get(clave))
        if cod and firma in ((mapa.get('firmas') or {}).get(cod) or []):
            return cod
    return ''


def _contra_el_maestro(fila, codigo, cidx, rx):
    """El paso 5: ninguna fila de hoy lleva ese codigo, asi que se compara con
    el producto del catalogo maestro. La Sim y el teclado se miran solo si el
    producto los dice (en sus SKU o en sus nombres): un producto que no dice
    nada no contradice a nadie."""
    entradas = cidx['por_codigo'].get(codigo) or []
    vivas = [m for m in entradas if not (m.get('Baja') or '').strip()] or entradas
    skus = {s for m in vivas for s in CM.todos(m, 'SKU_alta')}
    nombres = {n for m in vivas for n in CM.nombres_de(m)}
    sims = {sim_del_sku(s) for s in skus}
    sims |= {('E-Sim' if re.search(r'\be-?\s?sim\b', n, re.I) else 'Sim')
             for n in nombres if re.search(r'\b(e-?\s?)?sim\b', n, re.I)}
    tecs = {teclado_del_sku(s) for s in skus}
    tecs |= {m.group(1).upper() for m in (re.search(r'\bteclado\s+(es|en)\b', n, re.I) for n in nombres) if m}
    sims.discard('')
    tecs.discard('')
    s, t = sim_tec(fila).split('/')
    if (sims and s not in sims) or (tecs and t not in tecs):
        return 'otra-sim-o-teclado', 'la fila es %s y %s es %s/%s' % (
            sim_tec(fila), codigo, ','.join(sorted(sims)) or '-', ','.join(sorted(tecs)) or '-')
    mia = validar.familia_web(fila.get('Categoría'), fila.get('Marca'),
                              fila.get('Descripción completa') or fila.get('Modelo'), rx)
    if any(validar.familia_web(c, m.get('Marca'), n, rx) == mia
           for m in vivas for c in CM.categorias_de(m) for n in CM.nombres_de(m)):
        return 'otra-memoria', ''
    return 'otro-modelo', '%s es "%s"' % (codigo, (vivas[0].get('Producto') or '')[:40] if vivas else '?')


def choques_de_codigo(rows, mapa, cidx, rx):
    """Las filas activas cuya columna CODIGO no es la que les da el catalogo,
    cada una con su clase: 'otra-memoria' (se acepta), 'otra-sim-o-teclado' u
    'otro-modelo' (frenan). Lista de dicts con id, dado, mapa, clase, por que."""
    activas = [r for r in rows if validar.fila_activa(r)]
    mapa_de = {id(r): codigo_como_la_web(r, mapa) for r in activas}
    fam = lambda r: validar.familia_web(r.get('Categoría'), r.get('Marca'),
                                        r.get('Descripción completa') or r.get('Modelo'), rx)
    salida = []
    for r in activas:
        dado = (r.get('CODIGO') or '').strip().upper()
        puente = mapa_de[id(r)]
        if not dado or not puente or puente == dado or dado not in cidx['por_codigo']:
            continue                   # el codigo que no existe va aparte (fantasma)
        suyas = [q for q in activas if q is not r
                 and (q.get('CODIGO') or '').strip().upper() == dado and mapa_de[id(q)] == dado]
        igual = [q for q in suyas if sim_tec(q) == sim_tec(r)]
        porque = ''
        if not suyas:
            clase, porque = _contra_el_maestro(r, dado, cidx, rx)
            porque = ('comparado con el catalogo maestro, porque hoy ninguna otra fila lleva %s%s'
                      % (dado, (': ' + porque) if porque else ''))
        elif not igual:
            clase = 'otra-sim-o-teclado'
            porque = 'la fila es %s y %s es %s (%s)' % (sim_tec(r), dado, sim_tec(suyas[0]),
                                                      suyas[0]['ID'].strip())
        elif any(fam(q) == fam(r) for q in igual):
            clase = 'otra-memoria'
        else:
            clase = 'otro-modelo'
            porque = '%s es otro modelo (%s)' % (dado, igual[0]['ID'].strip())
        salida.append({'id': r['ID'].strip(), 'dado': dado, 'mapa': puente,
                       'clase': clase, 'porque': porque})
    return salida


def pedidos_de_codigo(ruta=None):
    """ID -> 'dd/mm' del ultimo envio a ADVAPP de un punto de CODIGO de esa
    fila (herramientas/pedidos-advapp.json, solo se lee). Sirve para que un
    choque que ya se pidio se vea como tal y no como algo nuevo."""
    ruta = ruta or os.path.join(AQUI, 'herramientas', 'pedidos-advapp.json')
    try:
        with open(ruta, encoding='utf-8') as fh:
            enviados = (json.load(fh) or {}).get('enviados') or {}
    except Exception:
        return {}
    salida = {}
    for clave, v in enviados.items():
        partes = clave.split('|')
        if len(partes) < 2 or partes[0] not in ('r_codigo', 'r_var_de_otro') or not isinstance(v, dict):
            continue
        fecha = str(v.get('enviado') or '')
        if re.match(r'^\d{4}-\d{2}-\d{2}$', fecha) and fecha > salida.get(partes[1], ''):
            salida[partes[1]] = fecha
    return {k: '%s/%s' % (f[8:10], f[5:7]) for k, f in salida.items()}


def main():
    # El catalogo maestro se lee UNA vez, y antes de tocar nada (29/09). Se
    # leia tres veces: la primera atrapaba el error, avisaba "OJO" y escribia
    # fotos/indice.json SIN el mapa del catalogo; la tercera reventaba con un
    # Traceback. Quedaba en la carpeta un indice con el que la web no puede
    # traducir un color a su AT-####-NN: probado con una celda CODIGO_VAR
    # vacia, 193 productos que solo tienen fotos por color se quedaban sin
    # ninguna. Con el maestro roto no se toca nada y queda el indice anterior,
    # que es de un momento en que todo cerraba.
    # Sale con 1, que es lo que PUBLICAR ya frena con "Publicar igual?", y con
    # una linea '<--' que la revision diaria levanta como aviso.
    try:
        maestro = CM.leer()
    except CM.CatalogoRoto as e:
        print('EL CATALOGO MAESTRO ESTA ROTO: no se revisaron las fotos y NO se')
        print('toco fotos/indice.json (queda el anterior, que estaba completo).')
        print('   %s' % e)
        print('   Para ver el detalle:  python3 herramientas/validar-catalogo.py')
        print()
        print('     1  CATALOGO MAESTRO ROTO: las fotos no se revisaron   <-- arreglarlo primero')
        return 1
    cidx = CM.indexar(maestro)

    rows  = bajar()
    byid  = {r['ID'].strip(): r for r in rows}
    ids   = set(byid)
    skus  = {FS.sku_de(r) for r in rows if FS.sku_de(r)}
    por_sku = collections.defaultdict(list)
    for r in rows:
        if FS.sku_de(r):
            por_sku[FS.sku_de(r)].append(r)
    conocidos = validar.leer_index()[0]
    pinta = validar.pinta
    colores = lambda r: FS.colores_de_la_fila(r, pinta, conocidos)

    # Las copias chicas de fotos/mini/, que son las que usa la grilla y la
    # portada. Se rehacen aca y no a mano: una foto nueva o corregida tiene que
    # llevarse su chica en la misma publicacion, o la web muestra la vieja.
    try:
        import miniaturas
        hechas, borradas, _ = miniaturas.actualizar()
        if hechas or borradas:
            print('Fotos chicas: %d nuevas, %d borradas' % (hechas, borradas))
    except Exception as e:
        print('AVISO: no se pudieron rehacer las fotos chicas (%s)' % e)

    files = [f for f in os.listdir(FOTOS) if f.lower().endswith(FS.EXT)]
    bases = {os.path.splitext(f)[0] for f in files}
    archivo_de = {os.path.splitext(f)[0]: f for f in files}

    # El indice que lee la web (fotos/indice.json). Con el, la pagina sabe que
    # archivos existen sin pedirlos uno por uno, y elige la portada por el
    # primer color del dia. Se rearma en cada corrida: PUBLICAR corre este
    # script antes del commit, asi que el indice publicado siempre es el de
    # la carpeta.
    # Y con el, el mapa del catalogo maestro: como llega la web del producto
    # de la planilla al nombre de su foto. Van juntos a proposito, porque
    # tienen que ser del mismo momento: un indice nuevo con un mapa viejo
    # muestra fotos que ya no son de ese producto.
    indice = {'archivos': sorted(files)}
    if maestro:
        indice['catalogo'] = CM.mapa_para_la_web(maestro, cidx)
    # Se escribe SOLO si cambio algo de verdad (29/09). Antes se escribia
    # siempre con la hora en 'generado', que nadie lee (la web usa 'archivos'
    # y 'catalogo'): la revision diaria de las 14:00 dejaba todos los dias un
    # "M fotos/indice.json" que no era nada, cada publicacion subia un commit
    # de ruido y el "El sitio ya esta al dia" de PUBLICAR no salia nunca.
    # Se comparan los datos y no el texto, asi un cambio de formato no cuenta.
    try:
        with open(INDICE, encoding='utf-8') as fh:
            previo = json.load(fh)
        previo.pop('generado', None)
    except Exception:
        previo = None          # no esta, no se lee o es de otro formato
    if previo != indice:
        indice['generado'] = datetime.datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
        # newline='\r\n': el indice se escribe igual en Windows y en Mac. Sin
        # esto, desde la Mac salia con otros finales de linea y el commit
        # mostraba el archivo entero cambiado aunque no hubiera ninguna foto
        # nueva.
        with open(INDICE, 'w', encoding='utf-8', newline='\r\n') as fh:
            # sort_keys: el indice sale siempre en el mismo orden. Sin esto
            # cada corrida reordenaba las claves y dejaba 400 lineas de diff
            # que decian lo mismo, tapando los cambios de verdad.
            json.dump(indice, fh, ensure_ascii=False, indent=0, sort_keys=True)

    # Las columnas CODIGO y CODIGO_VAR del contrato landing/1.3. Las escribe
    # ADVAPP con el mismo catalogo maestro que tenemos aca, asi que tienen que
    # dar lo mismo. Cuando dejen de dar lo mismo es que una de las dos puntas
    # cambio y la otra no se entero, y eso no se ve mirando la pagina: se ve
    # cuando un cliente abre una ficha con la foto de otro.
    # Que la columna diga otra memoria del mismo modelo NO es eso (Pedro,
    # 26/09): va a `aceptados` y no frena. Lo decide choques_de_codigo(), con
    # el mismo criterio que pruebas/codigos.js (ver arriba de todo).
    choques, aceptados, corridas, fantasma = [], [], [], []
    maestro_idx = cidx                 # el maestro ya se leyo (y sano) arriba
    if maestro_idx:
        ya_pedido = pedidos_de_codigo()
        for c in choques_de_codigo(rows, indice.get('catalogo') or {}, maestro_idx,
                                   validar.expresiones_de_familia()):
            linea = '%s: la columna CODIGO dice %s y el catalogo dice %s' % (c['id'], c['dado'], c['mapa'])
            if c['clase'] == 'otra-memoria':
                aceptados.append(linea + ' (otra memoria del mismo modelo%s)'
                                 % ('; ' + c['porque'] if c['porque'] else ''))
            else:
                choques.append('%s -- %s: %s%s' % (
                    linea, 'OTRA SIM O TECLADO' if c['clase'] == 'otra-sim-o-teclado' else 'OTRO MODELO',
                    c['porque'], ' [pedido a ADVAPP el %s]' % ya_pedido[c['id']] if c['id'] in ya_pedido else ''))
        for r in rows:
            suyo = (r.get('CODIGO') or '').strip().upper()
            if not suyo:
                continue
            if suyo not in maestro_idx['por_codigo']:
                fantasma.append('%s -> %s' % (r['ID'].strip(), suyo))
                continue
            # Y que la celda de variantes tenga tantas posiciones como colores:
            # una celda corrida le da a un color el codigo del color de al lado.
            cols = colores(r)
            celda = (r.get('CODIGO_VAR') or '').strip()
            partes = [x.strip() for x in celda.split('/')] if celda else []
            if cols and partes and len(partes) != len(cols):
                corridas.append('%s: %d color(es) y %d codigo(s) de variante'
                                % (r['ID'].strip(), len(cols), len(partes)))

    # ---- el codigo de cada fila de la planilla ----
    # Es la identidad de verdad: se le asigno al producto una vez y no cambia
    # aunque el proveedor le reescriba el nombre. Mientras la planilla no
    # traiga la columna, se resuelve con el vinculo guardado y se verifica que
    # el producto siga siendo el mismo.
    validos = {m['CODIGO_VAR'] for m in maestro}
    codigo_de, sin_codigo = {}, []
    for r in rows:
        cod, de = (CM.codigo_de_la_fila(r, cidx, pinta, conocidos) if maestro else ('', 'falta'))
        if cod:
            codigo_de[r['ID'].strip()] = cod
        else:
            sin_codigo.append('%-14s %-50s %s'
                              % (r['ID'].strip(), r['Descripción completa'][:50],
                                 'no esta en el catalogo' if de == 'falta'
                                 else 'el vinculo apunta a otro producto'))
    por_codigo = collections.defaultdict(list)
    for r in rows:
        c = codigo_de.get(r['ID'].strip())
        if c:
            por_codigo[c].append(r)

    # ---- a que producto pertenece cada archivo ----
    usuarios, color_de, viejos, huerfanas = {}, {}, [], []
    for f in files:
        base = os.path.splitext(f)[0]
        cv = CM.partir(base)
        if cv and base in validos:
            entrada = cidx['por_var'][base]
            color_de[f] = entrada.get('Variante') or ''
            filas_cod = por_codigo.get(CM.seguir_fusion(cv[0], cidx)) or []
            # La variante la venden las filas que hoy la ofrecen. Si ninguna
            # (un color que roto y quedo la foto), es de todas las del
            # producto, y el chequeo (4) lo avisa.
            venden = [x for x in filas_cod
                      if any(CM.norm(c) in CM.escrituras_de(entrada) for c in colores(x))]
            usuarios[f] = venden or filas_cod
            if not filas_cod:
                huerfanas.append(f)
            continue
        # los nombres de las dos etapas anteriores, que ya no deberian quedar
        r = FS.resolver(base, skus, ids)
        if r is None:
            huerfanas.append(f)
            continue
        viejos.append(f)
        color_de[f] = r['color']
        usuarios[f] = (por_sku[r['clave']] if r['tipo'] == 'sku' else [byid[r['clave']]])

    # ---- 3: las fotos de un producto que hoy no tiene fila ----
    # No se pierden ni se mueven: el codigo sale del producto y no puede
    # colgarse de otro. Se quedan esperando a que el producto vuelva, que es
    # lo que antes no pasaba: cada cambio de nombre las dejaba sin dueño.
    # (Aca vivia tambien el 3b, "perdidas", de la epoca de los nombres por
    # SKU. Con nombres por codigo quedo como una lista vacia fija que igual
    # figuraba entre lo que frena; se saco el 29/09.)
    huerfanas_expl = []
    for f in huerfanas:
        entrada = cidx['por_var'].get(os.path.splitext(f)[0])
        huerfanas_expl.append('%-16s %s' % (
            f, (entrada.get('Producto') or '')[:56] if entrada is not None
            else 'no esta en el catalogo maestro'))

    def existe(base):
        return base in bases

    # La portada como la elige la web (validar.PortadaWeb, 29/09): con la
    # fila entera -para cada color, primero lo que dice CODIGO_VAR y despues
    # el texto; sin la fila, "Lime" contra "lima" en el maestro salia "sin
    # foto" y la web mostraba AT-0511-02-, y sin foto nuestra, la de ADVAPP o
    # la de una hermana del mismo modelo y color (fotoDeHermana).
    portada = validar.PortadaWeb(rows, cidx, bases, conocidos)

    # ---- 1 y 2: lo que le falta a cada fila ----
    # Sin foto nuestra, la web no muestra siempre el logo. Si ADVAPP manda una
    # foto para ese color (fotoDeAdvapp), muestra esa, y nadie de aca la miro;
    # si una hermana del mismo modelo tiene la de ese color, muestra esa (Pedro,
    # 26/09: otra memoria se ve igual). Hasta el 29/09 las tres cosas salian
    # juntas como "sin foto de portada": el Watch Ultra 3 Ocean Band mostraba
    # una caja negra sin malla y el informe decia lo mismo que de una ficha
    # con el logo.
    sin_base, con_advapp, de_hermana, sin_color = [], [], [], []
    for r in rows:
        pid = r['ID'].strip()
        cols = colores(r)
        cand = portada.candidatos(r)
        # la portada: lo mismo que prueba la web, en el mismo orden
        if not any(existe(c) for c in cand):
            clase, que = portada.de(r)
            nombre = cand[0] if cand else '(sin codigo)'
            if clase in ('advapp', 'advapp-hermana'):
                con_advapp.append('%-14s %-14s %s%s  %s' % (
                    pid, nombre, r['Descripción completa'][:40],
                    ' (de una hermana)' if clase == 'advapp-hermana' else '', que))
            elif clase == 'hermana':
                de_hermana.append('%-14s %-14s muestra %-16s %s'
                                  % (pid, nombre, que + FS.EXT, r['Descripción completa'][:36]))
            elif cand:
                sin_base.append('%-14s %-14s %s' % (pid, cand[0], r['Descripción completa'][:46]))
        if len(cols) > 1:
            cod = codigo_de.get(pid)
            for c in cols:
                v = (CM.variante_de_la_columna(r, cod, c, cidx, cols) or CM.variante_de(cod, c, cidx)) if cod else ''
                if v and not existe(v):
                    sin_color.append('%-14s %-18s (%s)' % (v + '.jpg', c[:18], r['Descripción completa'][:40]))

    # ---- 4: una variante que ninguna fila del producto vende hoy ----
    # No es un error: un producto deja de vender un color y su foto se queda
    # esperando, que es justo lo que el catalogo vino a permitir. Se lista
    # para saber que hay, no para arreglar nada.
    mal_color = []
    for f in files:
        if f not in usuarios or not color_de[f]:
            continue
        vende = set()
        for r in usuarios[f]:
            vende.update(CM.norm(c) for c in colores(r))
        if CM.norm(color_de[f]) not in vende:
            mal_color.append('%-16s %-24s la planilla dice: %s'
                             % (f, color_de[f][:24],
                                ' | '.join((r.get('Color') or '(vacio)') for r in usuarios[f])[:40]))

    # ---- 6: tamano ----
    tam = []
    try:
        from PIL import Image
        for f in files:
            try:
                w, h = Image.open(os.path.join(FOTOS, f)).size
                if (w, h) != (900, 900):
                    tam.append(f'{f}   {w}x{h}')
            except Exception:
                tam.append(f'{f}   NO SE PUDO LEER')
    except ImportError:
        tam.append('(Pillow no instalado: no se pudo chequear el tamano)')

    # ---- 5: la misma imagen en productos de modelos distintos ----
    H = collections.defaultdict(list)
    firma = {}
    for f in files:
        with open(os.path.join(FOTOS, f), 'rb') as fh:
            firma[f] = hashlib.md5(fh.read()).hexdigest()
        H[firma[f]].append(f)
    repetidas = []
    for fs in H.values():
        if len(fs) < 2:
            continue
        rs = [r for f in fs for r in usuarios.get(f, [])]
        ids_r = {r['ID'].strip() for r in rs}
        if len(ids_r) < 2:
            continue
        # Tienen que ser productos distintos por los DOS lados:
        #   - distinto Modelo, porque el mismo equipo en otra capacidad usa la
        #     misma foto y esta bien (Galaxy S25 FE de 256 y de 512GB);
        #   - y distinto SKU, porque las hermanas de color del mismo producto
        #     tambien la comparten: los tres Ray-Ban Skyler tienen tres codigos
        #     de Modelo distintos ("601/1M52", "601/CH52", "601/T352") y salian
        #     como error todos los dias siendo el mismo anteojo.
        ident = {FS.sku_de(r) or r['ID'].strip() for r in rs}
        mods = {(r['Modelo'] or '').strip().upper() for r in rs}
        if len(mods) > 1 and len(ident) > 1:
            repetidas.append((sorted(mods), sorted(ids_r), sorted(fs), firma[fs[0]]))

    # Un duplicado puede ser correcto: el mismo equipo en otra capacidad usa la
    # misma foto y esta bien. Los que ya se miraron y se dieron por buenos
    # quedan en fotos-aceptadas.txt (--aceptar), asi el chequeo solo frena por
    # lo que aparecio DESPUES. Sin esto la alarma suena siempre y se ignora.
    #
    # La clave es la huella de la imagen y en cuantos modelos aparece: los IDs
    # se renumeran y los SKU cambian (el 10/09/2026 la misma lista de
    # duplicados salio "nueva" cinco veces solo por eso), la imagen no. Si
    # manana la misma foto aparece en un modelo MAS, vuelve a sonar. Las
    # claves viejas por lista de IDs se siguen entendiendo.
    lineas_acept = []
    if os.path.exists(ACEPTADAS):
        with open(ACEPTADAS, encoding='utf-8') as fh:
            lineas_acept = fh.read().split(chr(10))
    aceptadas_md5, aceptadas_ids = leer_aceptadas(lineas_acept)
    clave = lambda ids_: ','.join(sorted(ids_))
    if '--aceptar' in sys.argv:
        salida, sumadas, subidas = fusionar_aceptadas(
            lineas_acept, repetidas, datetime.date.today().strftime('%d/%m/%Y'))
        with open(ACEPTADAS, 'w', encoding='utf-8', newline='\r\n') as fh:
            fh.write(chr(10).join(salida))
        vigentes = {r[3] for r in repetidas}
        print('Duplicados de hoy: %d. Se sumaron %d y se subio el numero de %d.'
              % (len(repetidas), sumadas, subidas))
        print('Se conservan %d aceptaciones que hoy no aparecen como duplicado (%s).'
              % (sum(1 for h in aceptadas_md5 if h not in vigentes), ACEPTADAS))
        return 0
    nuevas = [r for r in repetidas
              if not (aceptadas_md5.get(r[3], 0) >= len(r[0]) or clave(r[1]) in aceptadas_ids)]
    # Las aceptaciones que hoy no se usan. No se borran solas (ver
    # fusionar_aceptadas), pero una huella aceptada deja pasar en silencio la
    # misma imagen en otro modelo mientras no supere el numero anotado: por
    # eso se listan, para verlas y limpiarlas a mano si ya no hacen falta.
    vigentes = {r[3] for r in repetidas}
    no_vigentes = [l.strip()[:100] for l in lineas_acept
                   if RE_ACEPTADA.match(l) and RE_ACEPTADA.match(l).group(1) not in vigentes]

    # ---- 9: dentro de un Grupo, el mismo color deberia ser la misma foto ----
    # El iPhone 17 Pro naranja es el mismo aparato valga 1190 o 1400. La fila
    # que se aparta suele ser la que tiene el archivo mal nombrado.
    porgrupo = collections.defaultdict(lambda: collections.defaultdict(set))
    for f in files:
        if f in usuarios and color_de[f]:
            for r in usuarios[f]:
                g = (r.get('Grupo') or '').strip()
                if g:
                    porgrupo[g][color_de[f]].add(f)
    color_disidente = []
    for g, porcolor in sorted(porgrupo.items()):
        for col, fs in sorted(porcolor.items()):
            fs = sorted(fs)
            if len(fs) < 2:
                continue
            cuenta = collections.Counter(firma[a] for a in fs)
            if len(cuenta) > 1:
                # Con dos archivos y dos huellas no hay mayoria: hay que
                # elegir igual, y tiene que salir SIEMPRE el mismo, porque
                # el orden de un set de Python cambia en cada corrida y el
                # informe decia un archivo distinto cada vez.
                primero = {}
                for a in fs:
                    primero.setdefault(firma[a], a)
                mayoria = min(cuenta, key=lambda h: (-cuenta[h], primero[h]))
                raros = [a for a in fs if firma[a] != mayoria]
                color_disidente.append('%s / %s%s   se aparta: %s'
                                       % (g, col, chr(10) + ' ' * 6, (chr(10) + ' ' * 6).join(raros)))

    # ---- 11: la foto de un color no puede ser la de OTRO color del producto ----
    # Es la forma exacta que tuvieron los ocho errores del 09/09/2026: la fila
    # cambio de color bajo el mismo ID y la portada quedo. Es el error que mas
    # cuesta ver a ojo.
    #
    # Rehecho el 29/09. Buscaba la portada por nombres de SKU y de ID
    # (FS.candidatos_portada), y desde que las 721 fotos se llaman AT-####
    # no encontraba ninguna: daba 0 todos los dias como si estuviera todo bien.
    # Ese mismo dia una ficha mostraba otra malla: SW-APP-016 vende "Natural -
    # Blue Trail Loop M/L", ADVAPP le manda CODIGO_VAR=AT-0455-05, y esa foto
    # es identica byte a byte a la AT-0455-04, la "Anchor Blue Ocean Band" que
    # vende SW-APP-017.
    #
    # Ahora la foto de cada color se elige como la elige la web (nombresDeFoto
    # en index.html): primero la variante de la columna CODIGO_VAR, con las
    # mismas guardas de varianteDeLaColumna, y si no sirve la del texto del
    # color. Y NO se comparan textos: "Natural" contra "Natural Titanium" o
    # "Lavender" contra "lavander" son el mismo color escrito distinto, y
    # comparando escrituras salian 366 avisos falsos sobre 383 portadas. La
    # regla es la de deOtroColor en pruebas/codigos.js, mas la huella: avisa
    # cuando la foto NO es la variante que el catalogo le da a ese color y,
    # ademas, es (o es identica a) la variante que el catalogo le da a OTRO
    # color que vende el mismo producto. Medido el 29/09: 382 fotos de color
    # revisadas, un solo aviso, el de SW-APP-016. Ese mismo dia la web sumo la
    # guarda "si el maestro nombra ESTE color con otra variante, decide el
    # maestro" y la ficha paso a mostrar la AT-0455-03: con la copia comun
    # (de_la_columna, abajo) este control ve lo mismo y ya no lo marca. El dato
    # de ADVAPP sigue mal y sigue pedido (pedido-advapp.py, r_variante).
    def de_la_columna(r, cod, color):
        # La copia de varianteDeLaColumna() que vive en catalogo_maestro, la
        # misma que usan candidatos_foto y altas-catalogo (29/09). Aca habia
        # otra copia propia que ya se habia separado de la web: no miraba si
        # el maestro nombra ESTE color con otra variante (el Trail Loop del
        # Ultra 3 con la Ocean Band en la celda), ni leia los colores de la
        # fila como la web. Una sola copia, controlada por CASOS_COLUMNA.
        return CM.variante_de_la_columna(r, cod, color, cidx, colores(r))

    mentirosas = []
    portada_de = {}            # fila -> (producto, portada, variantes que vende)
    for r in rows:
        pid = r['ID'].strip()
        cod = codigo_de.get(pid)
        cols = colores(r)
        if not cod or not cols:
            continue
        vende_prod = []        # los colores que vende HOY el producto, en todas sus filas
        for x in por_codigo.get(cod) or []:
            for c in colores(x):
                if all(CM.norm(c) != CM.norm(y) for y in vende_prod):
                    vende_prod.append(c)
        suyas, port = set(), None
        for col in cols:
            propia = CM.variante_de(cod, col, cidx)
            arch = de_la_columna(r, cod, col) or propia
            suyas.update(x for x in (arch, propia) if x)
            if not arch or not existe(arch):
                continue
            port = port or arch
            if arch == propia:
                continue
            for otro in vende_prod:
                if CM.norm(otro) == CM.norm(col):
                    continue
                vx = CM.variante_de(cod, otro, cidx)
                if not vx or vx == propia:
                    continue
                if vx == arch or (existe(vx) and firma[archivo_de[vx]] == firma[archivo_de[arch]]):
                    mentirosas.append('%-14s vende %-28s y muestra %s, que %s la de %s (%s)'
                                      % (pid, col[:28], archivo_de[arch],
                                         'es' if vx == arch else 'es identica a',
                                         otro[:28], vx + FS.EXT))
                    break
        if port:
            portada_de[pid] = (cod, port, suyas)
    # Y dos portadas identicas en filas del MISMO producto que no comparten
    # ninguna variante: una de las dos muestra un color que no vende. Solo
    # dentro del producto y por codigo de variante: entre productos distintos
    # es trabajo del (5), que tiene sus aceptaciones, porque el mismo modelo
    # en otra memoria comparte foto a proposito (Pedro, 26/09); medido el
    # 29/09, mirando entre productos salian 67 pares y casi todos eran eso.
    por_portada = collections.defaultdict(list)
    for pid, (cod, port, suyas) in portada_de.items():
        por_portada[(cod, firma[archivo_de[port]])].append((pid, port, suyas))
    for lst in por_portada.values():
        for i, (a, pa, va) in enumerate(lst):
            for b, pb, vb in lst[i + 1:]:
                if not (va & vb):
                    mentirosas.append('%-14s y %-14s tienen la misma portada (%s y %s) y no venden ninguna variante en comun'
                                      % (a, b, archivo_de[pa], archivo_de[pb]))

    # ---- 13: dos colores del MISMO producto con la misma imagen ----
    # Si el silver y el space black del mismo SKU son el mismo archivo, uno de
    # los dos miente, y no lo ve ningun otro chequeo: el (5) no, porque es un
    # solo producto; el (9) tampoco, porque son colores distintos. En la ficha
    # el cliente toca un puntito y ve la foto del otro color.
    mismo_color = []
    por_clave = collections.defaultdict(dict)          # producto -> variante -> archivo
    for f in files:
        if f in usuarios and color_de[f]:
            cv = CM.partir(os.path.splitext(f)[0])
            if cv:
                por_clave[cv[0]][color_de[f]] = f
    for cl, porcolor in sorted(por_clave.items()):
        vistas = collections.defaultdict(list)
        for col, f in sorted(porcolor.items()):
            vistas[firma[f]].append((col, f))
        for lst in vistas.values():
            if len(lst) > 1:
                mismo_color.append('%s: %s son la misma imagen (%s)'
                                   % (cl[:40], ' y '.join(c for c, _ in lst), lst[0][1]))

    # ---- 7, 8, 12: las fotos contra el registro de lo ya mirado ----
    registro = leer_revisadas()
    cambiadas  = sorted(f for f in files if f in registro and registro[f][0] != firma[f])
    aparecidas = sorted(f for f in files if f not in registro)
    pendientes = sorted(f for f in files if f in registro and not registro[f][1])

    if '--revisadas' in sys.argv or '--sembrar' in sys.argv:
        # "--revisadas" a secas marca todo; con nombres detras, solo esos.
        sueltas = {a for a in sys.argv[1:] if not a.startswith('--')}
        todas = '--revisadas' in sys.argv and not sueltas
        fantasma = sorted(n for n in sueltas if n not in files)
        if fantasma:
            print('OJO: no existe ninguna foto con ese nombre: %s' % ', '.join(fantasma))
            print('El nombre va tal cual esta en fotos/ (ahora son por codigo: AT-0455-04.jpg).')
            return 2
        hechas, congeladas = 0, 0
        with open(REVISADAS, 'w', encoding='utf-8', newline='\r\n') as fh:
            fh.write('# Fotos miradas contra el producto que dice la planilla.' + chr(10))
            fh.write('# Si una cambia, deja de coincidir y no se publica hasta mirarla.' + chr(10))
            # python3 (29/09): en la Mac "python" no existe. Este encabezado lo
            # escriben tambien revisar-fotos-con-agentes.py, sacar-fotos-malas.py
            # y migrar-fotos-a-*.py: tiene que ser el mismo en todos, o va y
            # viene en el diff segun cual corrio ultimo.
            fh.write('# Anotar las miradas:  python3 verificar-fotos.py --revisadas' + chr(10))
            fh.write('# Arrancar el registro: python3 verificar-fotos.py --sembrar' + chr(10))
            for f in sorted(files):
                previo = registro.get(f)
                if todas or f in sueltas:
                    h, ok = firma[f], True
                elif previo and previo[0] != firma[f]:
                    # Cambio y NO se la miro: se conserva la huella vieja para
                    # que siga saliendo como "cambiada" y siga frenando. Antes
                    # se escribia la huella nueva como "sin mirar", y una foto
                    # equivocada que entraba de contrabando dejaba de frenar
                    # apenas alguien anotaba OTRA foto. Es justo el agujero
                    # por el que volvia la foto del iPhone 17.
                    h, ok = previo[0], previo[1]
                    congeladas += 1
                elif previo:
                    h, ok = firma[f], previo[1]
                else:
                    h, ok = firma[f], False
                hechas += ok
                fh.write('%s  %-34s # %s%s'
                         % (h, f, 'mirada' if ok else 'sin mirar', chr(10)))
        print('Registro escrito: %d fotos, %d miradas, %d pendientes  (%s)'
              % (len(files), hechas, len(files) - hechas, REVISADAS))
        if congeladas:
            print('%d foto(s) cambiaron y no se marcaron: siguen frenando hasta que las mires.' % congeladas)
        return 0

    # ---- el informe ----
    L = []
    w = L.append
    w('REVISAR FOTOS — chequeo automatico')
    w('=' * 62)
    w(f'Generado: {datetime.datetime.now():%d/%m/%Y %H:%M}')
    w(f'Productos en la planilla: {len(rows)}   ·   fotos en la carpeta: {len(files)}   ·   con nombre de codigo: {len(files) - len(viejos)}')
    w('')
    w(f'  {len(sin_base):>4}  productos sin foto de portada: se ve el logo')
    w(f'  {len(con_advapp):>4}  sin foto nuestra: se ve la de ADVAPP, que nadie reviso')
    w(f'  {len(de_hermana):>4}  sin foto propia: se ve la de otra memoria del mismo modelo y color')
    w(f'  {len(sin_color):>4}  colores sin su foto')
    # Con '<--' para que la revision diaria lo levante como cualquier otro
    # contador que frena (29/09). Los aceptados van en la linea de abajo, sin
    # flecha: son la decision de Pedro del 26/09 y no tienen que sonar.
    w(f'  {len(choques) + len(fantasma) + len(corridas):>4}  COLUMNAS DE ADVAPP QUE NO CIERRAN con el catalogo  <-- pedirlo a ADVAPP')
    w(f'  {len(aceptados):>4}  codigos de otra memoria del mismo modelo (aceptado, Pedro 26/09)')
    w(f'  {len(nuevas):>4}  MISMA FOTO en modelos distintos, SIN REVISAR  <-- mirar primero')
    w(f'  {len(cambiadas):>4}  FOTOS QUE CAMBIARON sin pasar por revision   <-- mirar primero')
    w(f'  {len(aparecidas):>4}  FOTOS NUEVAS que nadie miro todavia          <-- mirar primero')
    w(f'  {len(mentirosas):>4}  FOTOS DE OTRO COLOR del mismo producto        <-- mirar primero')
    w(f'  {len(pendientes):>4}  fotos viejas que quedaron por mirar')
    w(f'  {len(viejos):>4}  fotos con nombre viejo (por SKU o por ID), sin renombrar')
    w(f'  {len(sin_codigo):>4}  filas de la planilla sin codigo del catalogo')
    w(f'  {len(color_disidente):>4}  mismo color con distinta foto dentro del grupo')
    w(f'  {len(mismo_color):>4}  dos colores del mismo producto con la MISMA foto')
    w(f'  {len(repetidas) - len(nuevas):>4}  duplicados ya revisados (fotos-aceptadas.txt)')
    w(f'  {len(no_vigentes):>4}  aceptaciones que hoy no se usan (se conservan; ver al final)')
    w(f'  {len(mal_color):>4}  fotos con un color que no esta en la planilla')
    w(f'  {len(huerfanas_expl):>4}  fotos huerfanas (ni SKU ni ID en la planilla)')
    w(f'  {len(tam):>4}  fotos que no son 900x900')
    w('')
    fin_del_resumen = len(L)

    def bloque(titulo, items, nota=''):
        w('-' * 62)
        w(f'{titulo}  ({len(items)})')
        if nota:
            w(nota)
        w('-' * 62)
        w('\n'.join('   ' + x for x in items) if items else '   (ninguna)')
        w('')

    w('=' * 62)
    w(f'1) MISMA FOTO EN MODELOS DISTINTOS  ({len(repetidas)})')
    w('   Dos productos de modelos diferentes muestran la misma imagen.')
    w('   Puede ser normal (equipos identicos) o un ERROR GRAVE: una ficha')
    w('   mostrando otro producto. Hay que MIRARLAS.')
    w('=' * 62)
    if repetidas:
        for mods, ids_, fs, h in repetidas:
            w(f'   modelos: {" | ".join(mods)}')
            for i in ids_:
                w(f'      {i:<15} {byid[i]["Descripción completa"][:56]}')
            w(f'      archivos: {", ".join(fs)}')
            w('')
    else:
        w('   (ninguna)')
        w('')

    bloque('2) PRODUCTOS SIN FOTO DE PORTADA: EL CLIENTE VE EL LOGO', sin_base)
    bloque('2b) SIN FOTO NUESTRA: SE VE LA DE ADVAPP, QUE NADIE REVISO', con_advapp,
           '   La web cae a la foto que manda ADVAPP (fotoDeAdvapp) cuando no hay una'
           + chr(10) + '   nuestra. Nadie la comparo con el producto: mirarla con el link de al'
           + chr(10) + '   lado, y si esta mal, producir la nuestra o pedirle a ADVAPP que la cambie.')
    bloque('2c) SIN FOTO PROPIA: SE VE LA DE OTRA MEMORIA DEL MISMO MODELO', de_hermana,
           '   La web le pone la foto de una hermana del mismo Grupo, mismo color, misma'
           + chr(10) + '   Sim y mismo teclado (fotoDeHermana). Esta bien: Pedro, 26/09, otra'
           + chr(10) + '   memoria se ve igual. No hay que hacer nada; se lista para saberlo.')
    bloque('3) COLORES SIN SU FOTO', sin_color)
    bloque('4) FOTOS DE UNA VARIANTE QUE HOY NO SE VENDE', mal_color,
           '   No hay nada que arreglar: la foto se queda esperando a que el color'
           + chr(10) + '   vuelva. Antes esto era una foto perdida; ahora es una foto guardada.')
    bloque('4b) FILAS DE LA PLANILLA SIN CODIGO DEL CATALOGO', sin_codigo,
           '   Sin codigo no hay foto. Son altas a las que hay que asignarles uno, o'
           + chr(10) + '   vinculos que dejaron de ser de fiar porque el ID paso a otro producto:'
           + chr(10) + '      python3 herramientas/revisar-catalogo.py')
    bloque('5) FOTOS HUERFANAS (ni el SKU ni el ID estan en la planilla)', huerfanas_expl,
           '   Se quedan en la carpeta: el SKU sale del producto y no puede colgarse'
           + chr(10) + '   de otra cosa. Si el producto vuelve, la foto lo espera.')
    bloque('6) FOTOS QUE NO SON 900x900', tam)
    bloque('7) FOTOS QUE CAMBIARON DESPUES DE REVISADAS', cambiadas,
           '   El archivo no es el que se miro. Puede ser una mejora, o la foto'
           + chr(10) + '   equivocada que volvio. Mirala y despues: python3 verificar-fotos.py --revisadas')
    bloque('8) FOTOS NUEVAS SIN MIRAR', aparecidas,
           '   Entraron despues del ultimo registro y nadie las comparo con el producto.')
    bloque('9) MISMO COLOR CON DISTINTA FOTO DENTRO DEL GRUPO', color_disidente,
           '   El naranja del iPhone 17 Pro es el mismo valga 1190 o 1400. La fila'
           + chr(10) + '   que se aparta suele ser la que tiene el archivo mal nombrado.')
    # 29/09: antes recomendaba migrar-fotos-a-sku.py, que hoy seria un paso
    # atras: los nombres por SKU son de la etapa anterior al codigo.
    bloque('10) FOTOS CON NOMBRE VIEJO (POR SKU O POR ID)', viejos,
           '   Todavia se entienden, pero van con el nombre de su codigo (AT-####-NN.jpg).'
           + chr(10) + '   Se cargan mirandolas, con una linea por foto en asignacion.txt:'
           + chr(10) + '      python3 herramientas/cargar-fotos.py <carpeta>'
           + chr(10) + '   NO usar migrar-fotos-a-sku.py: los nombres por SKU son de antes del codigo.')
    bloque('11) FOTOS DE UN COLOR QUE SON LA DE OTRO COLOR DEL MISMO PRODUCTO', mentirosas,
           '   La fila vende un color y la foto que muestra (portada o puntito) es, o es'
           + chr(10) + '   identica a, la variante que el catalogo le da a otro color. Suele ser la'
           + chr(10) + '   columna CODIGO_VAR de ADVAPP apuntando a otra variante (pedirlo con'
           + chr(10) + '   herramientas/pedido-advapp.py), o un archivo copiado encima de otro.')
    bloque('13) DOS COLORES DEL MISMO PRODUCTO CON LA MISMA FOTO', mismo_color,
           '   El cliente toca un puntito y ve la foto del otro color. Una de las'
           + chr(10) + '   dos esta mal nombrada, o falta producir una de las dos imagenes.')
    bloque('12) FOTOS VIEJAS QUE QUEDARON POR MIRAR', pendientes,
           '   Estaban antes de que existiera el registro. No frenan la publicacion,'
           + chr(10) + '   pero son las que todavia podrian tener una imagen equivocada.'
           + chr(10) + '   Para repartirlas entre agentes que las miren de a lotes:'
           + chr(10) + '      python3 revisar-fotos-con-agentes.py --preparar')
    bloque('14) LA COLUMNA CODIGO DE ADVAPP APUNTA A OTRO PRODUCTO (frena)',
           choques + ['codigo que no existe en el catalogo: ' + x for x in fantasma]
           + ['celda corrida: ' + x for x in corridas],
           '   Otra Sim, otro teclado u otro modelo: son productos distintos (Pedro,'
           + chr(10) + '   26/09) y la ficha muestra la foto de otro. Se le pide a ADVAPP con:'
           + chr(10) + '      python3 herramientas/pedido-advapp.py'
           + chr(10) + '   Mismo criterio que pruebas/codigos.js (seccion 8).')
    bloque('14b) LA COLUMNA CODIGO DICE OTRA MEMORIA DEL MISMO MODELO (aceptado, no frena)', aceptados,
           '   Pedro, 26/09: el mismo modelo con otra memoria se ve igual, asi que la'
           + chr(10) + '   foto del hermano esta bien. No se pide ni frena; se lista para saberlo.')
    bloque('ACEPTACIONES QUE HOY NO SE USAN (fotos-aceptadas.txt)', no_vigentes,
           '   Duplicados que alguien ya miro y que hoy no aparecen (el texto del Modelo'
           + chr(10) + '   roto, o el producto no esta). Se conservan para que no vuelvan a sonar;'
           + chr(10) + '   si ya no hacen falta, se borran a mano.')

    with open(SALIDA, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(L))
    # El resumen entero, hasta el ultimo contador. Era L[:21] fijo, y cada
    # contador nuevo quedaba afuera sin que nadie lo notara (29/09).
    print('\n'.join(L[:fin_del_resumen]))
    print(f'...\nReporte completo en: {SALIDA}')

    if choques or fantasma or corridas:
        print()
        # El titulo se deja igual: lo busca revision-diaria.py (y su guarda en
        # pruebas/guardas-t2-pedido-revision.js). "Planilla" aca son las
        # columnas que manda ADVAPP.
        print('LAS COLUMNAS DE LA PLANILLA NO COINCIDEN CON EL CATALOGO')
        print('=' * 62)
        for x in choques:
            print('   choque: %s' % x)
        for x in fantasma:
            print('   codigo que no existe en el catalogo: %s' % x)
        for x in corridas:
            print('   celda corrida: %s' % x)
        print()
        print('   Las dos puntas salen del mismo catalogo maestro, asi que esto')
        print('   significa que una de las dos cambio y la otra no se entero.')
        # 29/09: desde el 22/09 los datos son de ADVAPP; la planilla quedo
        # congelada y ya no hay "equipo de la planilla" a quien pedirle.
        print('   Hay que resolverlo con ADVAPP ANTES de publicar:')
        print('      python3 herramientas/pedido-advapp.py')
    if aceptados:
        print()
        print('(%d fila(s) con el codigo de otra memoria del mismo modelo: aceptado por Pedro'
              ' el 26/09, no frena. Detalle en REVISAR-FOTOS.txt, bloque 14b.)' % len(aceptados))

    # Frenan la publicacion las cuatro formas que tiene una ficha de mostrar
    # otro producto u otro color: (1) dos modelos con la misma imagen, (7) una
    # foto que cambio despues de revisada, (8) una foto que nadie miro nunca y
    # (11) la foto de un color que es la de otro color del mismo producto.
    # (El 5b, que tambien frenaba, se saco el 29/09: era una lista vacia fija.)
    # Y las columnas del contrato 1.3 en desacuerdo con el catalogo, que es la
    # misma clase de error una etapa antes: ahi la ficha todavia no esta mal,
    # pero va a estarlo en la proxima corrida. Desde el 29/09 solo las que
    # apuntan a otro producto: la otra memoria del mismo modelo (aceptados)
    # no frena, asi PUBLICAR no pregunta todos los dias por lo ya decidido.
    # Lo demas son avisos.
    return 1 if (nuevas or cambiadas or aparecidas or mentirosas
                 or choques or fantasma or corridas) else 0


if __name__ == '__main__':
    sys.exit(main())
