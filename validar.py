# -*- coding: utf-8 -*-
"""
Valida los datos de ADVAPP (lo mismo que muestra la web) contra las reglas
que el catálogo necesita para mostrarse bien. Si ADVAPP no contesta revisa
la planilla Landing, que está congelada desde el 22/09 y es solo el
respaldo, y lo dice. Se corre ANTES de publicar:

    python3 validar.py

Sale con código 1 si hay algún error GRAVE, así que PUBLICAR puede frenar
solo. Con --todo muestra también los avisos leves. Con --pedido redacta lo
que hay que pedirle a ADVAPP por las reglas de datos de acá (etiqueta
[ADVAPP]); lo demás que se les pide sale de herramientas/pedido-advapp.py.
(29/09: decía "planilla" y "PEDIDO PARA LA PLANILLA"; desde el 22/09 los
datos y los pedidos son de ADVAPP.)

Las listas de colores y de categorías NO se copian acá: se leen del propio
index.html. Si mañana se agrega un color al mapa, el validador se entera
solo y no hay dos verdades que mantener sincronizadas.
"""
import csv, io, os, re, sys, json, unicodedata, collections, datetime, textwrap, urllib.request

AQUI      = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, 'herramientas'))
import fotos_sku as FS       # los nombres de foto de antes del catalogo
import catalogo_maestro as CM   # la identidad propia de cada producto
INDEX     = os.path.join(AQUI, 'index.html')
# El nombre del archivo quedo de cuando el pedido iba al equipo de la planilla
# y NO se cambia a proposito (29/09): esta en el .gitignore, y con otro nombre
# el "git add -A" de PUBLICAR lo subiria a la web (el repo es publico). Si se
# renombra, primero se suma el nombre nuevo al .gitignore. Adentro dice ADVAPP.
SALIDA_PEDIDO = os.path.join(AQUI, 'PEDIDO-AL-SHEET.txt')
FOTOS     = os.path.join(AQUI, 'fotos')
SHEET_ID  = '18xxslIKTBnVMrLixCGlQBJGje3vKBYQHXy0qvVp8tpQ'
SHEET_GID = '482985525'
CSV_URL   = ('https://docs.google.com/spreadsheets/d/%s/export?format=csv&gid=%s'
             % (SHEET_ID, SHEET_GID))

# Las notas internas que no tienen que llegar a la web (un "+ Capa", un
# "C/C") viven en NOTAS_DEL_NOMBRE, dentro de index.html: el catálogo las
# saca del nombre al cargar y este validador lee esa misma lista.
# --------------------------------------------------------------------------

def norm(s):
    s = unicodedata.normalize('NFD', s or '')
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return s.lower().strip()


def limpio(s):
    v = (s or '').strip()
    return '' if v in ('—', '-', '–') else v


def leer_index():
    """Saca del index.html las listas que son la verdad del catálogo."""
    src = io.open(INDEX, encoding='utf-8').read()

    bloque = re.search(r'const COLORES = \{(.*?)\n\};', src, re.S)
    colores = set()
    if bloque:
        # El valor tiene que ser un color de verdad ('#RRGGBB'): sin eso, el
        # texto de los comentarios de al lado entraba como color y `pinta`
        # daba por bueno cualquier cosa ("s", "y la primera", "py").
        for m in re.finditer(r"""'?([A-Za-z][A-Za-z0-9 ]*)'?\s*:\s*'#""", bloque.group(1)):
            colores.add(norm(m.group(1)))

    bloque = re.search(r'const CATS_PLURAL = \{(.*?)\n\};', src, re.S)
    plurales = set()
    if bloque:
        for m in re.finditer(r"'([^']+)'\s*:", bloque.group(1)):
            plurales.add(m.group(1))

    bloque = re.search(r'const ORDEN_CATS = \[(.*?)\];', src, re.S)
    orden = set(re.findall(r"'([^']+)'", bloque.group(1))) if bloque else set()

    # El catálogo renombra categorías al vuelo ("Lente" se muestra como
    # "Objetivo"), así que las listas usan el nombre nuevo y la planilla el
    # viejo. Sin esto, el validador pide que se declaren categorías que en
    # pantalla ya no existen con ese nombre.
    renombre = {}
    bloque = re.search(r'const CATS_RENOMBRE = \{(.*?)\};', src, re.S)
    if bloque:
        for viejo, nuevo in re.findall(r"'([^']+)'\s*:\s*'([^']+)'", bloque.group(1)):
            renombre[norm(viejo)] = nuevo

    # Las notas que el catálogo saca del nombre. Se leen de ahí y no se copian
    # acá: si las dos listas viven en dos lados, el día que entra una nota
    # nueva el validador pide arreglar algo que la página ya resolvió, o al
    # revés, deja pasar lo que sí se ve.
    notas = []
    bloque = re.search('const NOTAS_DEL_NOMBRE = ' + re.escape('[') + '(.*?)' + chr(10) + re.escape('];'), src, re.S)
    if bloque:
        for linea in bloque.group(1).split(chr(10)):
            m = re.search(r'busca:\s*/(.+?)/i', linea)
            if not m:
                continue
            que = re.search(r"que:\s*'([^']*)'", linea)
            if 'condicion:' in linea:
                destino = 'Condición'
            elif 'garantia:' in linea:
                # 29/09: la garantía decía "(se borra)" y la página la manda a
                # su renglón de la ficha (el "3Y Warranty" del Dell P2725H)
                destino = 'Garantía'
            elif re.search(r"incluye:\s*'\S", linea):
                destino = 'Incluye'
            else:
                destino = '(se borra)'
            # en JavaScript la barra del patrón va escapada; en Python no
            notas.append((m.group(1).replace(chr(92) + '/', '/'),
                          que.group(1) if que else '', destino))

    return colores, plurales, orden, renombre, notas


def claves_repetidas_colores():
    """Las claves que el mapa COLORES de index.html trae mas de una vez, con
    el tono que vale (en un objeto de JavaScript gana la ULTIMA). Hasta el
    29/09 estaban repetidas 'ice white', 'titan black', 'moonlit silver' y
    'anchor blue': se corregia el tono de la de arriba y en pantalla no
    cambiaba nada. leer_index() guarda las claves en un set y no lo veia."""
    src = io.open(INDEX, encoding='utf-8').read()
    bloque = re.search(r'const COLORES = \{(.*?)\n\};', src, re.S)
    if not bloque:
        return []
    vistos = collections.OrderedDict()
    for m in re.finditer(r"""'?([A-Za-z][A-Za-z0-9 ]*)'?\s*:\s*'(#[0-9A-Fa-f]{6})'""", bloque.group(1)):
        vistos.setdefault(norm(m.group(1)), []).append(m.group(2))
    return [(k, tonos) for k, tonos in vistos.items() if len(tonos) > 1]


# Desde el 17/09/2026 la web lee ADVAPP, y desde el 22/09 la planilla no se
# actualiza mas. Los controles leian la planilla: el 26/09 el validador decia
# "sin errores graves" sobre 583 filas congeladas mientras la web mostraba 758
# de ADVAPP. Ahora leen lo mismo que la web, con las mismas columnas (contrato
# landing/1.x), y la planilla queda de respaldo, igual que en index.html.
ADVAPP_URL = 'https://advapp-blond.vercel.app/api/catalog?resource=tecno-web'
FUENTE = {'nombre': '', 'manifiesto': None}   # de donde salio la ultima bajada

# Las mismas defensas que la web (index.html, bajarAdvapp y ADVAPP_MINIMO).
# Hasta el 29/09 aca solo se rechazaba una respuesta SIN productos: una carga
# cortada pasaba entera, y pedido-advapp.py le habria agradecido a ADVAPP como
# "ya arreglado" todo lo que no vino. La web ya la descartaba; las
# herramientas, que no tienen localStorage, guardan la cantidad de la ultima
# carga buena en logs/ (no se publica: es de esta maquina).
ADVAPP_MINIMO = 0.8
ULTIMA_CARGA = os.path.join(AQUI, 'logs', 'advapp-ultima-carga.json')
# La revision diaria baja ADVAPP UNA vez, guarda la copia en logs/ y le pasa
# la ruta a validar, verificar-fotos y pedido-advapp con esta variable: asi las
# tres herramientas miran exactamente el mismo dato, y el dia despues se puede
# ver con que dato corrio (29/09: la falla del 28 no se podia reconstruir).
COPIA_ENV = 'ADVAPP_COPIA'


def _filas_de_ayer():
    try:
        return int(json.load(io.open(ULTIMA_CARGA, encoding='utf-8')).get('filas') or 0)
    except Exception:
        return 0


def _guardar_filas(n, generado):
    try:
        os.makedirs(os.path.dirname(ULTIMA_CARGA), exist_ok=True)
        tmp = ULTIMA_CARGA + '.tmp'
        with io.open(tmp, 'w', encoding='utf-8') as fh:
            json.dump({'filas': n, 'generado_en': generado,
                       'guardado': datetime.datetime.now().isoformat(timespec='seconds')}, fh)
        os.replace(tmp, ULTIMA_CARGA)
    except OSError:
        pass                     # no poder recordarlo no es motivo para frenar


def bajar_advapp():
    """Los productos de ADVAPP como filas de la planilla, mas la columna SKUS
    (el JSON de los SKU por color, como lo arma bajarAdvapp() en la web)."""
    copia = os.environ.get(COPIA_ENV)
    if copia:
        with io.open(copia, 'rb') as fh:
            d = json.loads(fh.read().decode('utf-8'))
    else:
        req = urllib.request.Request(ADVAPP_URL, headers={'User-Agent': 'validar.py'})
        with urllib.request.urlopen(req, timeout=60) as r:
            d = json.loads(r.read().decode('utf-8'))
    productos = d.get('productos') or []
    if not productos:
        raise ValueError('ADVAPP vino sin productos')
    n = len(productos)
    declaradas = d.get('filas')
    if isinstance(declaradas, (int, float)) and declaradas > 0 and n < int(declaradas):
        raise ValueError('ADVAPP trajo %d de las %d filas que declara' % (n, int(declaradas)))
    # Contra la ultima carga buena, y solo si trae mucho menos: ahi se le
    # pregunta a la planilla cuantas filas hay de verdad (igual que la web).
    antes = _filas_de_ayer()
    if antes and n < antes * ADVAPP_MINIMO:
        try:
            planilla = int((bajar_meta() or {}).get('filas') or 0)
        except (TypeError, ValueError):
            planilla = 0             # sin ese dato no se descarta nada, como la web
        if planilla and n < planilla * ADVAPP_MINIMO:
            raise ValueError('ADVAPP trajo %d filas y la ultima carga buena tenia %d '
                             '(menos del %d %%)' % (n, antes, round(ADVAPP_MINIMO * 100)))
    _guardar_filas(n, d.get('generado_en'))
    cols = [str(c) for c in (d.get('columnas') or [])] or \
        [k for k in productos[0] if k != 'SKUS']
    texto = lambda v: '' if v is None else str(v)
    filas = []
    for p in productos:
        f = {c: texto(p.get(c)) for c in cols}
        f['SKUS'] = json.dumps(p.get('SKUS') if isinstance(p.get('SKUS'), list) else [],
                               ensure_ascii=False)
        filas.append(f)
    FUENTE['manifiesto'] = {k: d.get(k) for k in
                            ('contrato', 'fuente', 'generado_en', 'filas', 'verificado_hoy')}
    FUENTE['manifiesto']['copia'] = copia or ''
    return filas


def bajar_planilla(destino=None):
    req = urllib.request.Request(CSV_URL, headers={'User-Agent': 'validar.py'})
    with urllib.request.urlopen(req, timeout=60) as r:
        datos = r.read().decode('utf-8')
    if destino:
        io.open(destino, 'w', encoding='utf-8', newline='').write(datos)
    return list(csv.DictReader(io.StringIO(datos)))


def bajar_csv(destino=None):
    """Lo que muestra la web: ADVAPP, y si no contesta, la planilla (que esta
    congelada desde el 22/09: sirve para no quedarse sin nada, no para creerle)."""
    try:
        filas = bajar_advapp()
        FUENTE['nombre'] = 'ADVAPP'
    except Exception as e:
        sys.stderr.write('AVISO: ADVAPP no contesto (%s); se usa la planilla, '
                         'que esta congelada desde el 22/09.\n' % e)
        FUENTE['nombre'] = 'planilla (respaldo: ADVAPP no contesto)'
        FUENTE['manifiesto'] = None
        FUENTE['error'] = str(e)
        return bajar_planilla(destino)
    if destino:
        cols = list(filas[0].keys())
        with io.open(destino, 'w', encoding='utf-8', newline='') as fh:
            w = csv.DictWriter(fh, fieldnames=cols)
            w.writeheader()
            w.writerows(filas)
    return filas


META_URL = ('https://docs.google.com/spreadsheets/d/%s/gviz/tq?sheet=Meta&tqx=out:csv'
            % SHEET_ID)


def bajar_meta():
    """El manifiesto de la hoja Meta (contrato landing/1.x): la fila cuya
    primera celda es "json". None si no se pudo leer: el que llama decide si
    puede seguir sin él."""
    try:
        req = urllib.request.Request(META_URL, headers={'User-Agent': 'validar.py'})
        with urllib.request.urlopen(req, timeout=30) as r:
            txt = r.read().decode('utf-8')
        fila = next((f for f in csv.reader(io.StringIO(txt)) if f and f[0] == 'json'), None)
        return json.loads(fila[1]) if fila else None
    except Exception:
        return None


# --------------------------------------------------------------------------
# Reglas. Cada una devuelve una lista de (severidad, ID, mensaje).
# GRAVE = el cliente ve algo incorrecto.  AVISO = se puede mejorar.
# --------------------------------------------------------------------------

TALLE = re.compile(r'^(x{0,2}s|m|x{0,2}l)$', re.I)


def partir_colores(txt):
    """Igual que partirColores() en el catálogo.

    La barra separa opciones, salvo cuando lo que sigue es la medida de una
    correa: "Midnight Sport Band M/L" es un color con su talle, no dos.
    """
    salida = []
    for t in [x.strip() for x in (txt or '').split('/') if x.strip()]:
        if salida and TALLE.match(t):
            salida[-1] += '/' + t
        else:
            salida.append(t)
    return salida


def pinta(token, colores):
    """Igual que hexColor() en el catálogo: entero, última palabra, primera.

    Sin esto el validador era más exigente que la página y pedía cargar
    colores que en pantalla ya salían pintados: "Grey Transitions" se pinta
    con "grey" y "Black Ocean Band" con "black".
    """
    k = norm(token)
    if k in colores:
        return True
    # Una coma adentro de un token nunca es un color: "Black Ocean Band,
    # Natural" son dos cosas mal separadas en la planilla, no un color con
    # nombre largo. Sin esto la ultima palabra ("natural") lo daba por bueno
    # y el validador pedia la foto <SKU>-black-ocean-band-natural.jpg.
    if ',' in k:
        return False
    palabras = k.split()
    if palabras and (palabras[-1] in colores or palabras[0] in colores):
        return True
    # Un producto de dos tonos: "Titanio Gris · Blanco" en los relojes,
    # "Ice White · White Leather + White Silicone" en los Kieslect. Se pinta
    # con el primero, que es el que se ve de frente. La página hace lo mismo
    # en pintas(); sin esto el validador pedía cargar colores que en pantalla
    # ya salían pintados.
    primero = re.split(r'[-·]', k)[0].strip()
    return bool(primero) and primero != k and primero in colores


def regla_ids_y_precios(filas, ctx):
    fallas = []
    vistos = collections.Counter(f['ID'].strip() for f in filas)
    for pid, n in vistos.items():
        if n > 1:
            fallas.append(('GRAVE', pid, 'ID repetido en %d filas' % n))
    for f in filas:
        p = limpio(f.get('Precio USD'))
        if not p or not p.replace('.', '').replace(',', '').isdigit() or p == '0':
            fallas.append(('GRAVE', f['ID'], 'precio vacío o no numérico: %r' % p))
    return fallas


def regla_capacidad_repetida(filas, ctx):
    """"Samsung A27 8/256GB 5G 8/256GB" — el Modelo ya traía la capacidad."""
    fallas = []
    for f in filas:
        d = f['Descripción completa']
        caps = re.findall(r'\b\d{1,2}\s*/\s*\d{3,4}\s*GB\b', d, re.I)
        limpias = [re.sub(r'\s+', '', c.upper()) for c in caps]
        for cap, n in collections.Counter(limpias).items():
            if n > 1:
                fallas.append(('GRAVE', f['ID'],
                               'la capacidad %s aparece %d veces en el nombre' % (cap, n)))
    return fallas


# Marcas que conviven en un mismo nombre a proposito. La primera es la de la
# fila y la segunda la que aparece en el texto. No son errores de carga:
#   "Ray-Ban Meta Wayfarer" es un producto de las dos marcas.
#   "Sigma EF-630 Flash Nikon" es un Sigma con montura Nikon.
# Sin esta lista el pedido a la planilla salia con trece Ray-Ban para
# "corregir" que estaban bien, y un pedido con ruido se deja de leer.
CONVIVEN = {
    ('rayban', 'meta'),
    ('sigma', 'nikon'), ('sigma', 'canon'), ('sigma', 'sony'), ('sigma', 'fujifilm'),
    ('tamron', 'nikon'), ('tamron', 'canon'), ('tamron', 'sony'),
    ('smallrig', 'sony'), ('smallrig', 'canon'), ('smallrig', 'nikon'),
    ('saramonic', 'sony'), ('saramonic', 'canon'),
    ('logitech', 'playstation'), ('logitech', 'xbox'),
}


def regla_marca_ajena(filas, ctx):
    """
    El nombre menciona una marca que no es la de la fila. Puede ser un error
    de carga (el volante Logitech cargado como Microsoft) o la compatibilidad
    ("Sigma EF-630 Flash Nikon" es un Sigma CON montura Nikon). No hay forma
    de distinguirlos leyendo el texto, así que:
      - si la marca propia NO figura en el nombre, es GRAVE
      - si figuran las dos, es un AVISO para que lo mire una persona
    """
    def compacta(s):
        # "Ray-Ban" y "Rayban" son la misma marca escrita distinto
        return re.sub(r'[^a-z0-9]', '', norm(s))

    fallas = []
    marcas = set(norm(f['Marca']) for f in filas if limpio(f['Marca']))
    for f in filas:
        # En los lentes la otra marca es siempre la montura, no un error.
        if f['Categoría'] in ('Lente', 'Objetivo'):
            continue
        d, propia = norm(f['Descripción completa']), norm(f['Marca'])
        otras = [m for m in marcas
                 if m and m != propia and re.search(r'\b%s\b' % re.escape(m), d)]
        otras = [m for m in otras
                 if (compacta(propia), compacta(m)) not in CONVIVEN]
        if not otras:
            continue
        # Siempre AVISO, nunca grave. Los nombres comerciales legítimos que
        # incluyen otra marca son la mayoría de los casos: "Ray-Ban Meta
        # Wayfarer", "Sigma EF-630 Flash Nikon", "Volante Logitech G29 PS5".
        # Frenar una publicación por esto es ruido; que una persona lo mire,
        # no. El único error real que encontró esta regla (un volante Logitech
        # cargado como Microsoft) se ve igual de bien en la lista de avisos.
        propia_figura = propia and compacta(propia) in compacta(d)
        fallas.append((
            'AVISO', f['ID'],
            'marca "%s" y el nombre menciona "%s"%s' % (
                f['Marca'], otras[0],
                '' if propia_figura else ' — y la propia no figura en el nombre')))
    return fallas


def regla_notas_internas(filas, ctx):
    """Notas de carga metidas en el nombre del producto.

    Dejó de ser GRAVE: el catálogo las saca antes de mostrar, así que el
    cliente ya no las lee. Se sigue avisando porque mientras estén en la hoja
    dependemos de ese parche, y cualquier otro que lea la planilla -un pedido
    por WhatsApp, una exportación- las ve tal cual están cargadas.
    """
    notas = ctx[4] if len(ctx) > 4 else []
    if not notas:
        return [('AVISO', '(index.html)',
                 'no pude leer NOTAS_DEL_NOMBRE del catálogo: nadie está '
                 'controlando las notas de carga en el nombre')]
    fallas = []
    for f in filas:
        d = f['Descripción completa']
        for patron, que, destino in notas:
            m = re.search(patron, d, re.I)
            if m:
                fallas.append((
                    'AVISO', f['ID'],
                    '"%s" (%s) en el nombre. El catálogo lo saca y lo manda a %s, '
                    'pero conviene cargarlo ahí' % (m.group(0).strip(), que, destino)))
    return fallas


def regla_color(filas, ctx):
    """La columna Color manda; el paréntesis del nombre la copia."""
    colores = ctx[0]
    fallas = []
    for f in filas:
        col = limpio(f['Color'])
        par = re.findall(r'\(([^)]*)\)', f['Descripción completa'])
        ultimo = par[-1].strip() if par else ''

        if col and ultimo and norm(col) != norm(ultimo):
            # sólo molesta si el paréntesis es de colores
            partes = [p.strip() for p in ultimo.split('/') if p.strip()]
            if partes and all(norm(p) in colores for p in partes):
                fallas.append(('GRAVE', f['ID'],
                               'el nombre dice (%s) y la columna Color dice %s' % (ultimo, col)))

        for token in partir_colores(col):
            if pinta(token, colores):
                continue
            # Igual que pintas() en el catálogo: un producto de dos tonos
            # ("Titanio Gris · Blanco", "Mate Black - transitions grey") se
            # pinta con el primero, que es el que se ve de frente.
            primero = re.split(r'[-·—]', token)[0].strip()
            if primero and primero != token and pinta(primero, colores):
                continue
            fallas.append(('AVISO', f['ID'],
                           'color "%s" no está en el mapa COLORES: sale sin puntito' % token))
    return fallas


def regla_categorias(filas, ctx):
    _, plurales, orden, renombre = ctx[:4]
    fallas = []
    # Comparar contra el nombre que el catálogo va a mostrar, no el de la planilla
    cats = set(renombre.get(norm(f['Categoría'].strip()), f['Categoría'].strip())
               for f in filas if limpio(f['Categoría']))

    def plural_automatico(cat):
        """La misma regla que aplica el catálogo cuando la categoría no está
        en CATS_PLURAL: vocal + s, consonante + es."""
        if re.search(r's$', cat, re.I):
            return cat
        return cat + ('s' if re.search(r'[aeiouáéíóú]$', cat, re.I) else 'es')

    for cat in sorted(cats):
        if cat not in plurales:
            # Siempre grave: la regla automática acierta con "Parlante" y falla
            # con "Notebook", y no hay forma de saber cuál es cuál sin mirarlo.
            # Una categoría nueva tiene que declarar su plural, y listo.
            fallas.append((
                'GRAVE', '(categoría)',
                '"%s" no está en CATS_PLURAL: el chip va a decir "%s" — declararlo a mano'
                % (cat, plural_automatico(cat))))
        if cat not in orden:
            fallas.append(('AVISO', '(categoría)',
                           '"%s" no está en ORDEN_CATS: el chip aparece al final de la barra' % cat))
    return fallas


# Un teleconversor no tiene focal ni apertura: "Canon RF 1.4X Extender" está
# bien escrito así y pedirle "mm" sería ruido.
RE_TELE = re.compile(r'\b(extender|teleconverter|converter|tc-\d|[\d.]+x\b)', re.I)


def monturas_del_index():
    """Las listas MONTURAS_SUFIJO y MONTURAS_PREFIJO de index.html, como
    [(regex, montura)], en el mismo orden en que las prueba monturaDe().
    Se leen del codigo, como regla_specs_dual lee specs(): si alguien suma
    una forma nueva de escribir la montura, esta regla se entera sola."""
    src = io.open(INDEX, encoding='utf-8').read()
    listas = []
    for nombre in ('MONTURAS_SUFIJO', 'MONTURAS_PREFIJO'):
        ini = src.find('const %s = [' % nombre)
        if ini < 0:
            return None
        fin = src.find('];', ini)
        pares = re.findall(r"\[/(.+?)/\s*,\s*'([^']+)'\]", src[ini:fin])
        try:
            listas += [(re.compile(rx), m) for rx, m in pares]
        except re.error:
            return None
    return listas


def monturas_del_sku_del_index():
    """La tabla MONTURAS_DEL_SKU de index.html ({'CANRF': 'Canon RF', ...}),
    la que usa monturaDelSku() para leer la montura del final del SKU. Se lee
    del codigo por lo mismo que monturas_del_index(): si la web suma un
    sufijo, esta regla se entera sola (29/09). None si no la encuentra."""
    src = io.open(INDEX, encoding='utf-8').read()
    ini = src.find('const MONTURAS_DEL_SKU = {')
    fin = src.find('};', ini)
    if ini < 0 or fin < 0:
        return None
    pares = re.findall(r"""\b([A-Z]+)['"]?\s*:\s*['"]([^'"]+)['"]""", src[ini:fin])
    return dict(pares) or None


def _montura_del_sku(s, tabla):
    """monturaDelSku() del index.html: el sufijo del final del SKU
    ("...-canef") se compara entero contra la tabla, asi que CANRF no es
    CANRFS. El "-000" de los que no la traen, o un sufijo que no esta en la
    tabla, no dan nada. re.A porque el /i de JS no pliega letras que no son
    ASCII y el re.I de Python si."""
    m = re.search(r'[-~]([a-z]+)$', str(s or '').strip(), re.I | re.A)
    return tabla.get(m.group(1).upper(), '') if m else ''


def montura_del_sku_de_la_fila(f, tabla):
    """p.monturaSku de la web (29/09): primero la columna SKU y, si no la
    dice, los SKU por color, y solo si todos dicen la misma
    (monturaDeLosSkus). Igual que sim_de_la_fila con la Sim."""
    m = _montura_del_sku(f.get('SKU'), tabla)
    if m:
        return m
    try:
        lista = json.loads(f.get('SKUS') or '[]')
    except ValueError:
        return ''
    if not isinstance(lista, list) or not lista:
        return ''
    dichos = [_montura_del_sku(x.get('sku') if isinstance(x, dict) else None, tabla) for x in lista]
    return dichos[0] if all(d and d == dichos[0] for d in dichos) else ''


def montura_de(f, monturas, del_sku=None):
    """Lo mismo que p.montura del index.html:
    (esLente(p) && p.monturaSku) || monturaDe(p) (29/09). Primero el SKU de
    ADVAPP y, si no la dice, el nombre. Hasta el 29/09 decia "lo mismo que
    monturaDe()" y leia solo el nombre: cuando la web paso a leer primero el
    SKU (hallazgo 196), esto quedo avisando 8 lentes que la web si filtra y
    dando Nikon F a los 7 Tamron "III NIKON" que la web da Nikon Z. Sin
    del_sku (la tabla MONTURAS_DEL_SKU), solo el nombre."""
    if del_sku:
        m = montura_del_sku_de_la_fila(f, del_sku)
        if m:
            return m
    t = re.sub(r'[.,]', ' ', (f.get('Modelo') or f['Descripción completa'] or '').upper()).strip()
    for rx, m in monturas or []:
        if rx.search(t):
            return m
    return ''


def regla_lentes(filas, ctx):
    """Sin "mm" y con coma decimal el buscador no los encuentra."""
    fallas = []
    # Sin montura el lente no aparece en el filtro Montura de la web (29/09):
    # el Sigma "85MM ... ART EF CANON" la tenia dada vuelta y otros 10 decian
    # solo "CANON", sin RF ni EF, y no los avisaba nadie. Desde el hallazgo
    # 196 la web lee primero el final del SKU de ADVAPP, que resuelve 8 de
    # esos 10: quedan LEN-SIG-002 y LEN-SIG-046, los mismos que pide
    # r_montura en herramientas/pedido-advapp.py. Por eso aca se mira igual
    # que la web, SKU y despues nombre: si no, se le pedia a ADVAPP un dato
    # que ya manda. La web no la deduce ni la inventa: se pide a quien carga.
    monturas = monturas_del_index()
    if monturas is None:
        fallas.append(('AVISO', '(código)', 'no se pudieron leer MONTURAS_SUFIJO/PREFIJO del index.html'))
    del_sku = monturas_del_sku_del_index()
    if del_sku is None:
        fallas.append(('AVISO', '(código)', 'no se pudo leer MONTURAS_DEL_SKU del index.html: la montura '
                                            'se mira solo en el nombre, como si la web no leyera el SKU'))
    for f in filas:
        if f['Categoría'] not in ('Lente', 'Objetivo'):
            continue
        d = f['Descripción completa']
        if monturas and not montura_de(f, monturas, del_sku):
            fallas.append(('AVISO', f['ID'],
                           'ni el SKU ni el nombre dicen la montura: no aparece en el filtro Montura de la web'
                           if del_sku else
                           'el nombre no dice la montura ("CANON RF", "SONY FE", "NIKON Z"...) y el SKU '
                           'no se pudo mirar (ver el aviso de código)'))
        if not RE_TELE.search(d) and not re.search(r'\d\s*mm\b', d, re.I):
            fallas.append(('AVISO', f['ID'], 'sin "mm" en el focal: no lo encuentra quien busca "50mm"'))
        if re.search(r'\d,\d', d):
            fallas.append(('AVISO', f['ID'], 'apertura con coma: no lo encuentra quien busca "2.8"'))
        if re.search(r'\bF\d', d, re.I):
            fallas.append(('AVISO', f['ID'], 'apertura sin barra (F1.8 en vez de F/1.8)'))
    return fallas


def regla_specs_dual(filas, ctx):
    """
    La planilla escribe la memoria de dos formas ("16/512GB" y "16GB/256GB").
    En vez de dar por sentado cuál entiende el catálogo, se saca la expresión
    de specs() del index.html y se prueba: si matchea, no hay nada que avisar.
    Así el día que cambie el código, esta regla se entera sola.
    """
    src = io.open(INDEX, encoding='utf-8').read()
    # La de specs() y no la primera del archivo (29/09): la primera "const
    # dual" es la de capacidadDe(), que lee los TB por otro lado. Con esa, el
    # dia que se sumaron los "16GB/1TB" esta regla los hubiera marcado GRAVE
    # aunque specs() ya los entendiera.
    ini = src.find('function specs(')
    m = re.search(r'const dual\s*=\s*/(.+?)/[gimsuy]*\.exec', src[ini:]) if ini >= 0 else None
    if not m:
        return [('AVISO', '(código)', 'no se encontró la expresión dual en specs()')]
    try:
        rx = re.compile(m.group(1).replace(r'\/', '/'), re.I)
    except re.error as e:
        return [('AVISO', '(código)', 'no se pudo leer la expresión de specs(): %s' % e)]

    fallas = []
    for f in filas:
        txt = ' '.join([f['Descripción completa'], f.get('Modelo') or ''])
        # ¿Parece "RAM / almacenamiento" pero el catálogo no lo reconoce? El
        # disco tambien en TB (29/09): "16GB/1TB" pasaba sin que nadie mirara
        # si specs() lo entendia, y no lo entendia (48 filas sin RAM).
        parece = re.search(r'\d{1,2}\s*(?:GB)?\s*/\s*(?:\d{3,4}\s*GB|\d(?:[.,]\d)?\s*TB)', txt, re.I)
        if parece and not rx.search(txt):
            fallas.append(('GRAVE', f['ID'],
                           'memoria escrita como "%s": specs() no la reconoce y pierde el disco'
                           % parece.group(0)))
    return fallas


def _sim_del_sku(s):
    """Lo mismo que simDelSku() del index.html: -sim / -esim al final."""
    x = (s or '').strip().lower()
    if re.search(r'[-~]e-?sim$', x):
        return 'e-sim'
    return 'sim' if re.search(r'[-~]sim$', x) else ''


def sim_de_la_fila(f):
    """La Sim de una fila como la lee la web (index.html, armado de cada
    producto): primero la columna SKU y, si no lo dice, los SKU por color, y
    solo si todos dicen lo mismo. Sin SKU que lo diga, nada (29/09)."""
    s = _sim_del_sku(f.get('SKU'))
    if s:
        return s
    try:
        lista = json.loads(f.get('SKUS') or '[]')
    except ValueError:
        return ''
    if not isinstance(lista, list) or not lista:
        return ''
    dichos = [_sim_del_sku(x.get('sku') if isinstance(x, dict) else '') for x in lista]
    return dichos[0] if all(d and d == dichos[0] for d in dichos) else ''


def regla_color_por_precio(filas, ctx):
    """
    Dos filas del mismo producto, con precios distintos y EXACTAMENTE los
    mismos colores.

    Es el caso del iPhone 17 PRO 256GB, que se arregló tres veces y volvió tres
    veces. Cuando pasa, el catálogo dibuja dos botones que dicen lo mismo con
    dos precios distintos, y el cliente no tiene cómo saber qué color le toca a
    cuál. Y no es que el catálogo lo muestre mal: el dato de qué color vale
    cuánto NO ESTÁ en ninguna parte de la planilla, así que no hay código que
    pueda deducirlo. Por eso es GRAVE y frena la publicación.

    La regla: si dos filas comparten Grupo y tienen precios distintos, cada una
    tiene que declarar SU color, no la lista completa de la familia.
    """
    def juego_set(f):
        return {norm(c) for c in (f.get('Color') or '').split('/') if c.strip()}

    def juego(f):
        return '/'.join(sorted(juego_set(f)))

    colores = ctx[0]

    def sin_color(f):
        """La descripción sin el paréntesis de colores.

        Se saca el paréntesis SOLO si todo lo de adentro son colores, el mismo
        criterio que usa el catálogo. Borrándolos todos, "Switch 2" y "Switch 2
        (Choose One)" quedaban iguales, y lo mismo el Z6 III (Ingles) contra el
        (Español): tres avisos graves por filas que en realidad sí se
        distinguen. Lo que va entre paréntesis y no es un color es justamente
        lo que las separa.
        """
        def quitar(m):
            partes = [p.strip() for p in m.group(1).split('/') if p.strip()]
            son_colores = partes and all(norm(p) in colores for p in partes)
            return ' ' if son_colores else m.group(0)
        t = re.sub(r'\(([^)]*)\)', quitar, f.get('Descripción completa') or '')
        # El regalo, el teclado y la condición también distinguen: el Mini 5 Pro
        # con cuatro baterías y el pelado son dos cosas distintas al mismo
        # nombre, y la MacBook con teclado español sale más que la inglesa.
        #
        # Estas columnas son EXACTAMENTE las que mira firmaVisible() en
        # index.html, y tienen que seguir siéndolo. El 08/09/2026 acá faltaba
        # Teclado y saltaron cuatro GRAVES contra MacBook bien cargadas: la EN a
        # 2.233 y la ES a 2.354 comparten el Space Black porque es el mismo
        # color en dos productos distintos. El catálogo no se equivocaba; se
        # equivocaba el control. Si las dos claves se separan, una de las dos le
        # miente a alguien.
        #
        # Desde el 29/09 firmaVisible() suma la Sim del SKU (Pedro, 26/09: Sim
        # y eSIM son productos distintos), y aca va la misma: sin ella, una Sim
        # y una eSIM con el mismo nombre y color a precios distintos saltaban
        # como GRAVE, cuando son dos productos y la web muestra los dos.
        extra = ((f.get('Incluye') or '') + '|' + (f.get('Teclado') or '') +
                 '|' + (f.get('Condición') or '') + '|' + sim_de_la_fila(f))
        return re.sub(r'\s+', ' ', norm(t)).strip() + ' || ' + norm(extra)

    porgrupo = collections.defaultdict(list)
    for f in filas:
        g = (f.get('Grupo') or '').strip()
        # Sin columna Grupo no hay forma barata de saber quién es hermano de
        # quién: esta regla simplemente no aplica y no inventa falsos avisos.
        if g:
            porgrupo[norm(g)].append(f)

    fallas = []
    for g, fs in porgrupo.items():
        if len(fs) < 2:
            continue
        # Se agrupa por descripción-sin-color: eso deja juntas las filas que solo
        # se diferencian por el color. Sin esa parte saltaba el Quest 3S de
        # 128GB contra el de 256GB, donde el precio distinto es por la capacidad
        # y está perfecto.
        juntas = collections.defaultdict(list)
        for f in fs:
            if juego(f):
                juntas[sin_color(f)].append(f)
        for desc, hermanas in juntas.items():
            # Lo que rompe no es que dos filas digan los mismos colores: es que
            # UN color aparezca en dos filas con precios distintos, porque
            # entonces ese color tiene dos precios y no hay dato que diga cuál
            # vale. Antes se pedían los colores EXACTAMENTE iguales y por eso el
            # 17 Pro 512GB pasaba limpio: "Orange/Silver" a 1.400 contra
            # "Silver" a 1.445 son conjuntos distintos, pero el Silver está en
            # los dos. Comparar por intersección agarra los dos casos y sigue
            # sin marcar los 6 modelos bien cargados, donde cada fila trae su
            # color y ninguno se repite.
            for i, a in enumerate(hermanas):
                for b in hermanas[i + 1:]:
                    if (a.get('Precio USD') or '').strip() == (b.get('Precio USD') or '').strip():
                        continue          # mismo precio: no hay ambigüedad
                    repetidos = juego_set(a) & juego_set(b)
                    if not repetidos:
                        continue          # colores repartidos: así tiene que ser
                    fallas.append(('GRAVE', a['ID'],
                                   '%s aparece en %s a USD %s y en %s a USD %s. Un mismo '
                                   'color no puede tener dos precios: cada fila tiene que '
                                   'traer solo SU color, o no hay forma de saber cual vale '
                                   'cuanto'
                                   % ('/'.join(sorted(repetidos)), a['ID'],
                                      (a.get('Precio USD') or '?').strip(), b['ID'],
                                      (b.get('Precio USD') or '?').strip())))
    return fallas


def _agrupar(filas, src):
    """
    Repite el agrupamiento del catálogo para ver las tarjetas que realmente
    va a dibujar. Las expresiones se leen de index.html en vez de copiarse,
    así no hay dos versiones de la misma regla.
    """
    def re_de(nombre, defecto):
        m = re.search(r'const %s\s*=\s*/(.+?)/[gimsuy]*;' % nombre, src)
        try:
            return re.compile(m.group(1) if m else defecto, re.I)
        except re.error:
            return re.compile(defecto, re.I)

    RE_CAP   = re_de('RE_CAP',   r'\b\d+(?:[.,]\d+)?\s*(?:gb|tb)\b')
    RE_RAM   = re_de('RE_RAM',   r'\b\d+\s*ram\b')
    RE_DUAL  = re_de('RE_DUAL',  r'\b\d{1,2}\s*/\s*\d{3,4}\s*gb\b')
    RE_PAREN = re_de('RE_PAREN', r'\([^)]*\)')
    RE_CORCH = re_de('RE_CORCH', r'\[[^\]]*\]')

    def familia(f):
        t = f['Descripción completa'] or ''
        for rx in (RE_PAREN, RE_CORCH, RE_DUAL, RE_CAP, RE_RAM):
            t = rx.sub(' ', t)
        t = re.sub(r'[\s\-–/]+', ' ', norm(t)).strip()
        return '|'.join([norm(f['Categoría']), norm(f['Marca']), t])

    grupos = collections.OrderedDict()
    for f in filas:
        grupos.setdefault(familia(f), []).append(f)

    def nombre_grupo(descs):
        if len(descs) == 1:
            return descs[0]
        pal = [d.split() for d in descs]
        out = []
        for i in range(min(len(w) for w in pal)):
            if not all(norm(w[i]) == norm(pal[0][i]) for w in pal):
                break
            out.append(pal[0][i])
        # Igual que nombreGrupo() en index.html: si el prefijo común corta dentro
        # de un paréntesis, ese pedazo se descarta ("Ray-Ban Skyler (Shiny").
        n = re.sub(r'\s*\([^)]*$', '', ' '.join(out)).rstrip(' -–(')
        return n if len(n.split()) >= 2 else descs[0]

    return grupos, nombre_grupo


def regla_tarjetas(filas, ctx):
    """El título y los botones que ve el cliente, no los que debería ver."""
    src = io.open(INDEX, encoding='utf-8').read()
    grupos, nombre_grupo = _agrupar(filas, src)
    fallas = []

    for vs in grupos.values():
        descs = [v['Descripción completa'] for v in vs]
        nom = nombre_grupo(descs)
        pid = vs[0]['ID']

        if nom.count('(') != nom.count(')'):
            fallas.append(('GRAVE', pid,
                           'el título de la tarjeta queda cortado: "%s"' % nom))
        elif re.search(r'[/\-–·]$', nom.strip()):
            fallas.append(('GRAVE', pid, 'el título termina en un separador: "%s"' % nom))
        elif re.search(r'[\U0001F300-\U0001FAFF]', nom):
            fallas.append(('AVISO', pid, 'hay emojis en el título de la tarjeta: "%s"' % nom))
        elif len(nom) > 60:
            fallas.append(('AVISO', pid, 'título de %d caracteres: se corta en la tarjeta' % len(nom)))

        if len(vs) < 2:
            continue
        # Etiqueta de cada variante. Del paréntesis se saca el color (eso ya se
        # elige con los puntitos) pero se conserva lo que no es color, que es
        # justo lo que distingue una variante de otra: "(M4/M5)" vs "(M3/M4)".
        colores = ctx[0]
        etiquetas = []
        for v in vs:
            e = v['Descripción completa']
            if norm(e).startswith(norm(nom)):
                e = e[len(nom):]

            def sin_color(m):
                dentro = m.group(0)[1:-1].strip()
                partes = [p.strip() for p in dentro.split('/') if p.strip()]
                todo_color = partes and all(norm(p) in colores for p in partes)
                return ' ' if todo_color else ' %s ' % dentro

            e = re.sub(r'\([^)]*\)', sin_color, e)
            e = re.sub(r'[\s\-–]+', ' ', e).strip()
            etiquetas.append(e or limpio(v['Color']) or 'Estándar')
        # El catálogo desempata los botones repetidos en tres pasadas: primero
        # el color, después el idioma del teclado y al final el ID. Con el ID
        # nunca quedan dos botones iguales, así que no hay nada grave que
        # avisar. Lo que sí vale la pena es cuando hay que llegar al ID: quiere
        # decir que ningún dato distingue las variantes y al cliente le queda
        # un "NB-APP-089" pegado al botón, que no le dice nada.
        for campo in ('Color', 'Teclado'):
            repes = collections.Counter(etiquetas)
            etiquetas = [e + ' · ' + limpio(v[campo]) if repes[e] > 1 and limpio(v.get(campo)) else e
                         for e, v in zip(etiquetas, vs)]

        repes = collections.Counter(etiquetas)
        for e, n in repes.items():
            if n < 2:
                continue
            iguales = [v for v, x in zip(vs, etiquetas) if x == e]
            fallas.append(('AVISO', iguales[0]['ID'],
                           'el botón "%s" se repite y sólo el ID lo distingue: %s'
                           % (e, ', '.join(v['ID'] for v in iguales))))
    return fallas


# --------------------------------------------------------------------------
# La portada que muestra la web, paso por paso (29/09, hallazgo 48)
# --------------------------------------------------------------------------
# Los informes de fotos (esta regla y verificar-fotos.py) predecian la portada
# solo con el texto del color, y la web hace mas: prueba primero la celda
# CODIGO_VAR, despues cae a la foto que manda ADVAPP, y desde el 29/09 a la
# de una hermana del mismo modelo y del mismo color (fotoDeHermana: Pedro,
# 26/09, otra memoria se ve igual). Con eso el informe decia "sin foto" en
# fichas que el cliente veia con foto, y no decia nada de las que mostraban
# una foto de ADVAPP que nadie de aca miro. PortadaWeb repite el orden de la
# web (cargar() y armarModelo() en index.html); si se cambia alla, se cambia
# aca. Medido el 29/09 contra la pagina en Chrome: 757 de 758 iguales. La que
# no, es una fila repetida (mismo nombre, color y precio) que colapsarIguales()
# esconde: la web no la muestra y aca figura con la foto de la hermana. No se
# copio colapsarIguales porque no cambia nada de lo que ve el cliente.

def expresiones_de_familia():
    """Las expresiones de familia() leidas de index.html, como hace _agrupar:
    si la web cambia la regla, esto se entera solo. Las banderas tambien:
    RE_TALLE distingue mayusculas a proposito."""
    src = io.open(INDEX, encoding='utf-8').read()
    salida = {}
    for nombre, defecto in (
            ('RE_PAREN', r'\([^)]*\)'), ('RE_CORCH', r'\[[^\]]*\]'),
            ('RE_DUAL', r'\b\d{1,2}\s*/\s*\d{1,4}\s*(?:gb|tb)\b'),
            ('RE_CAP', r'\b\d+(?:[.,]\d+)?\s*(?:gb|tb)\b'), ('RE_RAM', r'\b\d+\s*ram\b'),
            ('RE_MM', r'\b\d{2}\s*mm\b'),
            ('RE_CORREA', r'\b(?:sport band|ocean band|alpine loop|milanese loop|trail loop|sport loop)\b'),
            ('RE_TALLE', r'\b[SML](?:/[SML])?(?:-[SML](?:/[SML])?)?\b'),
            ('RE_COLOR', r'\b(?:midnight|starlight|silver|space gray|rose gold|jet black|natural|'
                         r'anchor blue|dark green|black|gold|white|blue)\b')):
        m = re.search(r'const %s\s*=\s*/(.+?)/([gimsuy]*);' % nombre, src)
        patron, banderas = (m.group(1), m.group(2)) if m else (defecto, 'gi')
        try:
            salida[nombre] = re.compile(patron, re.I if 'i' in banderas else 0)
        except re.error:
            salida[nombre] = re.compile(defecto, re.I)
    return salida


def familia_web(cat, marca, desc, rx, grupo=''):
    """familia() de index.html: con Grupo manda el Grupo; si no, el nombre sin
    la marca adelante (sinMarca, como la llama pruebas/codigos.js), sin
    parentesis, memoria ni RAM, y en los relojes sin medida, malla ni color."""
    if (grupo or '').strip():
        return 'G:' + norm(grupo)
    d, m = desc or '', (marca or '').strip()
    if m and norm(d).startswith(norm(m) + ' '):
        d = d[len(m):].strip()
    for n in ('RE_PAREN', 'RE_CORCH', 'RE_DUAL', 'RE_CAP', 'RE_RAM'):
        d = rx[n].sub(' ', d)
    if norm(cat) in ('apple watch', 'smartwatch'):
        for n in ('RE_MM', 'RE_CORREA', 'RE_TALLE', 'RE_COLOR'):
            d = rx[n].sub(' ', d)
    return '|'.join([norm(cat), norm(marca), re.sub(r'[\s\-–/]+', ' ', norm(d)).strip()])


def teclado_de_la_fila(f):
    """p.teclado de la web: del final del SKU ("...-tecladoes") y, si no lo
    dice, la columna Teclado."""
    m = re.search(r'[-~]teclado(es|en)$', (f.get('SKU') or '').strip().lower())
    return m.group(1).upper() if m else limpio(f.get('Teclado'))


def fila_activa(f):
    """Las filas que la web muestra: Activo vacio o que diga que si (siNo), y
    con nombre."""
    t = re.sub(r'[.!]+$', '', norm(f.get('Activo') or ''))
    si = not t or bool(re.match(r'(si\b|s$|yes$|y$|true$|1$|x$)', t))
    return si and bool((f.get('Descripción completa') or f.get('Modelo') or '').strip())


def foto_de_advapp_del_color(f, color, propios):
    """fotoDeAdvapp(p, color) de index.html para UN color pedido, que puede no
    ser de la fila (fotoDeHermana le pregunta a la hermana por el color de la
    otra). catalogo_maestro.foto_de_advapp no recibe el color: prueba todos
    los de la fila, que es lo que hace la web para la portada propia."""
    try:
        skus = json.loads(f.get('SKUS') or '[]')
    except ValueError:
        return ''
    fotos = {}
    for s in skus if isinstance(skus, list) else []:
        if not isinstance(s, dict):
            continue
        at = str(s.get('at') or '').strip().upper()
        lst = s.get('fotos')
        url = str(lst[0] or '') if isinstance(lst, list) and lst else ''
        if at and url.startswith('http') and at not in fotos:
            fotos[at] = url
    if not fotos or not propios:
        return ''
    cvs = [x.strip().upper() for x in (f.get('CODIGO_VAR') or '').split('/')]
    i = next((j for j, c in enumerate(propios) if norm(c) == norm(color)), -1)
    cv = cvs[i] if i != -1 and len(cvs) == len(propios) else ''
    if cv and cv in fotos:
        return fotos[cv]
    if len(propios) == 1 and len(fotos) == 1 and i == 0:
        return next(iter(fotos.values()))
    return ''


class PortadaWeb(object):
    """La portada de cada fila como la elige la web. de(fila) devuelve
    (clase, que): 'nuestra' (la foto propia, AT-####-NN), 'advapp' (la de
    ADVAPP de esa fila, url), 'hermana' (la nuestra de una hermana, AT-...),
    'advapp-hermana' (la de ADVAPP de una hermana, url) o 'logo' ('' o el
    primer nombre que se busco). Una fila sin codigo solo puede tener la de
    ADVAPP o el logo."""

    def __init__(self, filas, cidx, archivos, conocidos):
        self.cidx, self.archivos, self.conocidos = cidx, archivos, conocidos
        self.colores = lambda f: FS.colores_de_la_fila(f, pinta, conocidos)
        self.codigo = {id(f): CM.codigo_de_la_fila(f, cidx, pinta, conocidos)[0] for f in filas}
        rx = expresiones_de_familia()
        self.grupos = collections.OrderedDict()
        self.grupo_de = {}
        for f in filas:
            if not fila_activa(f):
                continue
            g = familia_web(f.get('Categoría'), f.get('Marca'),
                            f.get('Descripción completa') or f.get('Modelo'), rx, f.get('Grupo'))
            self.grupos.setdefault(g, []).append(f)
            self.grupo_de[id(f)] = g

    def candidatos(self, f):
        """Los nombres que prueba fotoDeCarpeta(), en orden (nombresDeFoto)."""
        cod = self.codigo.get(id(f)) or ''
        cols = self.colores(f)
        return CM.candidatos_foto(cod, cols, self.cidx, f.get('Descripción completa') or '',
                                  self.conocidos, fila=f, propios=cols) if cod else []

    def de_hermana(self, f):
        cols = self.colores(f)
        g = self.grupo_de.get(id(f))
        if not cols or g is None:
            return '', ''
        c = cols[0]                            # solo el primer color: el de su portada
        sim, tec = norm(sim_de_la_fila(f)), norm(teclado_de_la_fila(f))
        hermanas = [x for x in self.grupos[g] if x is not f
                    and norm(sim_de_la_fila(x)) == sim and norm(teclado_de_la_fila(x)) == tec]
        for x in hermanas:                     # primero las fotos nuestras
            cod = self.codigo.get(id(x))
            if not cod:
                continue
            v = CM.variante_de_la_columna(x, cod, c, self.cidx, self.colores(x)) \
                or CM.variante_de(cod, c, self.cidx)
            if v and v in self.archivos:
                return 'hermana', v
        for x in hermanas:                     # despues las de ADVAPP
            xc = self.colores(x)
            u = foto_de_advapp_del_color(x, c, xc) if xc else ''
            if u:
                return 'advapp-hermana', u
        return '', ''

    def de(self, f):
        cand = self.candidatos(f)
        propia = next((c for c in cand if c in self.archivos), '')
        if propia:
            return 'nuestra', propia
        u = CM.foto_de_advapp(f, self.colores(f))
        if u:
            return 'advapp', u
        clase, que = self.de_hermana(f)
        if clase:
            return clase, que
        return 'logo', cand[0] if cand else ''


def regla_fotos(filas, ctx):
    if not os.path.isdir(FOTOS):
        return [('AVISO', '(fotos)', 'no existe la carpeta fotos/')]
    # Solo imagenes: en fotos/ conviven notas de trabajo (.txt) que no son
    # fotos de nada y salian como quince "huerfanas" en cada revision.
    nombres = [n for n in os.listdir(FOTOS) if n.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))]
    archivos = set(os.path.splitext(n)[0] for n in nombres)
    ids = set(f['ID'].strip() for f in filas)
    fallas = []

    # El indice que lee la web para elegir la portada tiene que ser el de la
    # carpeta. Lo escribe verificar-fotos.py, que PUBLICAR.bat corre antes del
    # commit; si alguien publico por afuera, la web elige con datos viejos.
    indice = os.path.join(FOTOS, 'indice.json')
    if not os.path.exists(indice):
        fallas.append(('AVISO', '(fotos)', 'falta fotos/indice.json: corré verificar-fotos.py'))
    else:
        try:
            en_indice = set(json.load(io.open(indice, encoding='utf-8')).get('archivos', []))
            if en_indice != set(n for n in nombres if n.lower().endswith('.jpg')):
                fallas.append(('AVISO', '(fotos)',
                               'fotos/indice.json no coincide con la carpeta: corré python3 verificar-fotos.py (PUBLICAR lo hace solo)'))
        except Exception:
            fallas.append(('AVISO', '(fotos)', 'fotos/indice.json no se pudo leer'))

    # Las fotos se llaman por el codigo del catalogo maestro: AT-0142-01.jpg
    # para una variante, AT-0142.jpg para un producto que no tiene. El codigo
    # se le asigno al producto una vez y no cambia aunque el proveedor le
    # reescriba el nombre. La regla vive en herramientas/catalogo_maestro.py,
    # la misma que usa la web.
    conocidos = ctx[0]
    maestro = CM.leer() if os.path.exists(CM.MAESTRO) else []
    if not maestro:
        fallas.append(('AVISO', '(fotos)', 'no hay catalogo maestro: no se puede saber'
                       ' de que producto es cada foto'))
        return fallas
    cidx = CM.indexar(maestro)
    validos = set(m['CODIGO_VAR'] for m in maestro)
    sin_codigo = 0
    # La portada como la elige la web (29/09): con la fila entera (primero lo
    # que dice CODIGO_VAR y despues el texto: "Lime" contra "lima" daba "sin
    # foto" y la web mostraba AT-0511-02), y sin foto nuestra, la de ADVAPP o
    # la de una hermana del mismo color. Solo se avisa lo que el cliente ve
    # mal: el logo, o una foto de ADVAPP que nadie miro. La de la hermana no
    # se avisa: es la decision de Pedro del 26/09 (otra memoria, misma foto).
    portada = PortadaWeb(filas, cidx, archivos, conocidos)
    for f in filas:
        cod = portada.codigo.get(id(f))
        if not cod:
            sin_codigo += 1
            continue
        cols = FS.colores_de_la_fila(f, pinta, conocidos)
        cand = portada.candidatos(f)
        if cand:
            clase, que = portada.de(f)
            if clase in ('advapp', 'advapp-hermana'):
                fallas.append(('AVISO', f['ID'], 'sin foto nuestra: se ve la de ADVAPP%s, que nadie'
                                                 ' reviso (%s.jpg)'
                               % (' de una hermana' if clase == 'advapp-hermana' else '', cand[0])))
            elif clase == 'logo':
                fallas.append(('AVISO', f['ID'], 'sin foto de portada: se ve el logo (%s.jpg)' % cand[0]))
        for c in cols[1:]:                        # la primera es la portada
            v = CM.variante_de_la_columna(f, cod, c, cidx, cols) or CM.variante_de(cod, c, cidx)
            if v and v not in archivos:
                fallas.append(('AVISO', f['ID'],
                               'ofrece "%s" y falta %s.jpg' % (c, v)))
    if sin_codigo:
        fallas.append(('AVISO', '(fotos)',
                       '%d fila(s) sin codigo del catalogo, asi que no pueden tener foto:'
                       ' python3 herramientas/revisar-catalogo.py' % sin_codigo))

    viejas, sueltas = [], []
    for a in sorted(archivos):
        if a in validos:
            continue
        if CM.partir(a):
            sueltas.append(a)             # tiene forma de codigo pero no esta
        else:
            viejas.append(a)
    if viejas:
        fallas.append(('AVISO', '(fotos)',
                       '%d foto(s) con nombre de antes del catalogo (%s.jpg…):'
                       ' python3 herramientas/migrar-fotos-a-codigo.py --aplicar'
                       % (len(viejas), viejas[0])))
    for a in sueltas:
        fallas.append(('AVISO', '(fotos)',
                       '%s.jpg tiene forma de codigo pero no esta en el catalogo maestro' % a))
    return fallas


# Cada regla dice dónde se arregla lo que encuentra. No es lo mismo un dato mal
# cargado (se le pide a ADVAPP) que una lista del catálogo que quedó corta (se
# toca index.html) o una foto que falta (se produce la imagen).
CONDICION_ACEPTADA = os.path.join(AQUI, 'condicion-aceptada.txt')

# Lo que delata un producto que no es nuevo y sellado. Va con \b a los dos
# lados: "usado" no puede saltar dentro de otra palabra, y "cpo" solo, no
# adentro de un código de modelo.
SENALES_CONDICION = re.compile(
    r'\b(usad[oa]s?|reacondicionad[oa]s?|refurbished|renewed|seminuev[oa]s?|'
    r'open ?box|caja abierta|sin caja|caja blanca|white ?box|exhibici[oó]n|'
    r'outlet|cpo|grad[oe] [abc]|like new|como nuev[oa]|segunda mano|'
    r'reparad[oa]s?|swap|sin sellar)\b', re.I)

# Una Condición que dice justamente lo que se promete no es una señal
CONDICION_NUEVA = re.compile(r'^(nuev[oa]s?|sellad[oa]s?|nuev[oa] sellad[oa]|new|sealed)$', re.I)


def leer_condicion_aceptada():
    """Código -> señales que Pedro ya miró y dio por buenas.

    Una línea por producto: el código AT y la señal, por ejemplo
        AT-0265  caja blanca    # objetivo de kit, nuevo
    Todo lo que va después de # es comentario.
    """
    aceptadas = collections.defaultdict(set)
    if not os.path.exists(CONDICION_ACEPTADA):
        return aceptadas
    for linea in io.open(CONDICION_ACEPTADA, encoding='utf-8'):
        linea = linea.split('#', 1)[0].strip()
        if not linea:
            continue
        codigo, _, senal = linea.partition(' ')
        if senal.strip():
            aceptadas[codigo.strip().upper()].add(re.sub(r'\s+', ' ', norm(senal)))
    return aceptadas


def regla_condicion(filas, ctx):
    """Productos que podrían no ser nuevos y sellados.

    El catálogo le dice al cliente que todo lo que vende es nuevo y sellado.
    Un usado, un reacondicionado o un open box que entre en la carga del día
    haría mentir a la página, y no hay forma de que el código sepa si ese caso
    está bien: lo decide Pedro. Por eso es GRAVE -la revisión diaria sólo avisa
    por los graves- y se apaga producto por producto en condicion-aceptada.txt.

    La aceptación es por código AT y por señal, no por ID: los IDs se
    renumeran. Y si mañana el mismo producto pasa de "caja blanca" a "usado",
    es otra señal y vuelve a preguntar.
    """
    aceptadas = leer_condicion_aceptada()
    fallas = []
    for f in filas:
        senales = set()
        cond = limpio(f.get('Condición'))
        if cond and not CONDICION_NUEVA.match(norm(cond)):
            senales.add(re.sub(r'\s+', ' ', norm(cond)))
        for col in ('Modelo', 'Descripción completa', 'Incluye', 'Detalle'):
            for m in SENALES_CONDICION.finditer(f.get(col) or ''):
                senales.add(re.sub(r'\s+', ' ', norm(m.group(1))))
        if not senales:
            continue
        codigo = (f.get('CODIGO') or '').strip().upper()
        clave = codigo or (f.get('ID') or '').strip()
        nuevas = sorted(s for s in senales if s not in aceptadas.get(clave, set()))
        if not nuevas:
            continue
        nombre = limpio(f.get('Descripción completa')) or limpio(f.get('Modelo'))
        fallas.append(('GRAVE', f.get('ID') or '?',
                       'posible producto que no es nuevo y sellado (%s): %s %s. Si está '
                       'bien, agregá "%s %s" a condicion-aceptada.txt'
                       % (', '.join(nuevas), clave, nombre, clave, nuevas[0])))
    return fallas


# La etiqueta de los datos mal cargados decia 'planilla' hasta el 29/09. Desde
# el 22/09 los datos vienen de ADVAPP y la planilla quedo congelada: la
# etiqueta mandaba a pedirle al equipo de una hoja que ya no carga nada. El
# nombre de la constante queda (la usan las reglas de abajo); lo que se ve,
# no. Las siete reglas con esta etiqueta siguen enteras, y su pedido sale con
# --pedido: todavia no estan en herramientas/pedido-advapp.py ("Color vs
# precio", por ejemplo, no es lo mismo que su r_dos_precios), asi que sacar
# --pedido las dejaria sin nadie que se las pida a ADVAPP.
PLANILLA, CODIGO, FOTOS_ = 'ADVAPP', 'código', 'fotos'
# Lo que no se arregla en ningún lado sino que se decide: sale de los pedidos
# a ADVAPP, porque ahí no hay nada que corregir.
DECISION = 'decisión'


# Que decirle a ADVAPP cuando una regla encuentra algo. El pedido va como
# REGLA y no como correccion de celda: la carga diaria reescribe los datos
# desde la lista del proveedor, asi que arreglar la fila de hoy no sirve para
# mañana. Cada texto tiene que poder aplicarse sin mirar el caso puntual.
PEDIDO = {
    'IDs y precios':
        'Cada fila necesita ID unico y precio numerico. Sin precio la ficha no '
        'se puede mostrar y el producto queda afuera del catalogo.',
    'Capacidad repetida':
        'La capacidad va una sola vez. Si esta en la descripcion no se repite '
        'en el nombre del modelo.',
    'Marca equivocada':
        'La marca de la columna tiene que ser la del fabricante del producto, '
        'no la de la marca compatible. Un accesorio "para Nikon" hecho por '
        'Sigma va con marca Sigma.',
    'Notas internas':
        'Lo que es nota para adentro no va en el nombre: el cliente lo lee tal '
        'cual. Los agregados de venta van a la columna Incluye.',
    'Colores':
        'La columna Color lleva SOLO colores, separados por barra. Lo que no '
        'es un color -una configuracion, una memoria, un "consultar"- va a '
        'Detalle o a Incluye, o se deja vacio. Un texto que no es color sale '
        'como una opcion sin punto de color y el cliente no entiende que elegir.',
    'Color vs precio':
        'Cuando dos filas del mismo producto valen distinto, cada una tiene que '
        'traer SOLO su color. Si las dos traen la lista completa no hay forma '
        'de saber cual color vale cuanto, y el catalogo termina mostrando dos '
        'precios para el mismo color.',
    'Nomenclatura lentes':
        'Los lentes llevan la distancia focal con mm y la apertura con F/. La '
        'montura va al final y completa.',
}

REGLAS = [
    ('IDs y precios',       regla_ids_y_precios,      PLANILLA),
    ('Capacidad repetida',  regla_capacidad_repetida, PLANILLA),
    ('Marca equivocada',    regla_marca_ajena,        PLANILLA),
    ('Notas internas',      regla_notas_internas,     PLANILLA),
    ('Colores',             regla_color,              PLANILLA),
    ('Color vs precio',     regla_color_por_precio,   PLANILLA),
    ('Nomenclatura lentes', regla_lentes,             PLANILLA),
    ('Condición',           regla_condicion,          DECISION),
    ('Categorías',          regla_categorias,         CODIGO),
    ('Formato de memoria',  regla_specs_dual,         CODIGO),
    ('Tarjetas',            regla_tarjetas,           CODIGO),
    ('Fotos',               regla_fotos,              FOTOS_),
]



def escribir_pedido(graves, avisos):
    """Arma el texto para mandarle a ADVAPP (hasta el 29/09 iba "al equipo que
    carga la planilla", que desde el 22/09 ya no carga nada).

    Agrupado por regla y no por fila: lo que se pide es como cargar de ahora
    en mas, y los casos del dia van abajo como ejemplo de lo que quedo mal.
    Lo que se le pide a ADVAPP por otras reglas (codigos, variantes, erratas)
    sale de herramientas/pedido-advapp.py, que ademas lleva la cuenta de lo
    ya pedido; este pedido cubre las reglas de datos de validar.
    """
    porregla = collections.OrderedDict()
    for sev, lista in (('ARREGLAR', graves), ('CUANDO PUEDAN', avisos)):
        for nombre, pid, msg, donde in lista:
            # Un '(código)' de una regla de datos (no poder leer una tabla del
            # index.html) es nuestro, no de ADVAPP: no va al pedido (29/09).
            if donde != PLANILLA or pid == '(código)':
                continue
            porregla.setdefault((sev, nombre), []).append((pid, msg))

    L = ['PEDIDO PARA ADVAPP (reglas de datos de validar.py) — %s'
         % datetime.date.today().strftime('%d/%m/%Y'), '']
    if FUENTE.get('nombre') and FUENTE['nombre'] != 'ADVAPP':
        # Sobre la planilla congelada el pedido le pediria a ADVAPP arreglar
        # cosas que no son suyas: se dice arriba de todo (29/09).
        L += ['OJO: ADVAPP no contesto y esto se armo sobre la planilla de respaldo,',
              'congelada desde el 22/09. NO mandarlo: volver a correrlo cuando ADVAPP ande.', '']
    if not porregla:
        L.append('No hay nada para pedir: los datos de ADVAPP estan limpios.')
    n = 0
    for (sev, nombre), casos in porregla.items():
        n += 1
        L.append('%d) %s — %s (%d caso%s)'
                 % (n, sev, nombre.upper(), len(casos), '' if len(casos) == 1 else 's'))
        L.append('')
        for linea in textwrap.wrap(PEDIDO.get(nombre, ''), 72):
            L.append('   ' + linea)
        L.append('')
        L.append('   Lo que quedo asi hoy:')
        for pid, msg in casos[:12]:
            for i, linea in enumerate(textwrap.wrap('%s — %s' % (pid, msg), 68)):
                L.append('     ' + linea if i == 0 else '       ' + linea)
        if len(casos) > 12:
            L.append('     ... y %d mas' % (len(casos) - 12))
        L.append('')
    L.append('Estos pedidos son de como cargar, no de corregir la fila de hoy:')
    L.append('la carga de mañana vuelve a escribir los datos.')
    txt = chr(10).join(L)
    io.open(SALIDA_PEDIDO, 'w', encoding='utf-8').write(txt)
    print()
    print(txt)
    print()
    print('(guardado en %s)' % SALIDA_PEDIDO)
    print('Lo demas que hay que pedirle a ADVAPP:  python3 herramientas/pedido-advapp.py')


def aviso_revision_diaria(horas=36):
    """Si la revision diaria dejo de correr, lo dice. '' si esta al dia o si
    en esta maquina no corre (no hay ningun log).

    El agente de launchd corre a las 14:00 solo si la Mac esta prendida y con
    la sesion abierta; si no, ese dia no corre y nadie se entera, porque el
    aviso sale solo cuando hay errores: el silencio se leia como "todo bien"
    (29/09). PUBLICAR corre este validador, asi que se ve al publicar. 36
    horas y no un dia: el agente corre tambien sabado y domingo."""
    import glob
    logs = glob.glob(os.path.join(AQUI, 'logs', 'revision-*.txt'))
    if not logs:
        return ''
    ultima = datetime.datetime.fromtimestamp(max(os.path.getmtime(x) for x in logs))
    if datetime.datetime.now() - ultima <= datetime.timedelta(hours=horas):
        return ''
    return ('OJO: la revision diaria no corre desde el %s. Revisar con:  '
            'python3 revision-diaria.py --estado' % ultima.strftime('%d/%m %H:%M'))


def main():
    todo = '--todo' in sys.argv
    sys.stdout.reconfigure(encoding='utf-8')

    ctx = leer_index()
    print('Mapa de colores: %d entradas · categorías con plural: %d' % (len(ctx[0]), len(ctx[1])))
    for k, tonos in claves_repetidas_colores():
        print('OJO: clave repetida en COLORES (index.html): "%s" %s. Vale la ultima (%s); '
              'dejar una sola.' % (k, ' y '.join(tonos), tonos[-1]))
    ojo = aviso_revision_diaria()
    if ojo:
        print(ojo)

    local = [a for a in sys.argv[1:] if not a.startswith('--')]
    try:
        if local:
            filas = list(csv.DictReader(io.open(local[0], encoding='utf-8')))
            print('Datos: %s (archivo local)' % local[0])
        else:
            filas = bajar_csv()
            man = FUENTE.get('manifiesto') or {}
            if FUENTE['nombre'] == 'ADVAPP':
                # generado_en y las filas declaradas quedan en el log de la
                # revision: sin eso no se sabia con que dato corrio (29/09)
                print('Fuente: ADVAPP, %s (generado_en %s, %s filas declaradas)'
                      % ('copia de la revision diaria ' + os.path.basename(man['copia'])
                         if man.get('copia') else 'bajada recién',
                         man.get('generado_en') or '?', man.get('filas') or '?'))
            else:
                print('Fuente: %s, bajada recién' % FUENTE['nombre'])
                # Una linea fija para que la revision diaria la reconozca sin
                # depender del texto de arriba. Hasta el 29/09 ADVAPP caido
                # terminaba en "Se puede publicar" sobre 583 filas del 22/09 y
                # nadie se enteraba de que la web mostraba precios congelados.
                print('FUENTE-RESPALDO: ADVAPP no contesto (%s). Se reviso la planilla, '
                      'congelada desde el 22/09, que es lo que la web muestra mientras tanto.'
                      % FUENTE.get('error', ''))
    except Exception as e:
        # No poder validar no es lo mismo que encontrar errores: sale con 2
        # para que PUBLICAR lo distinga y no diga que el catálogo está mal.
        # 29/09: decia "No se pudo leer la planilla", y lo que fallo primero
        # es ADVAPP; la planilla es el respaldo que tampoco contesto.
        if local:
            print('\nNo se pudo leer %s: %s' % (local[0], e))
        else:
            print('\nNo se pudo leer ADVAPP ni la planilla de respaldo: %s' % e)
            print('Suele ser falta de internet.')
        return 2
    print('Filas: %d\n' % len(filas))

    graves, avisos = [], []
    for nombre, regla, donde in REGLAS:
        for sev, pid, msg in regla(filas, ctx):
            (graves if sev == 'GRAVE' else avisos).append((nombre, pid, msg, donde))

    if graves:
        print('╔' + '═' * 68)
        print('║ %d ERRORES GRAVES — el cliente ve algo incorrecto' % len(graves))
        print('╚' + '═' * 68)
        for nombre, pid, msg, donde in graves:
            print('  [%-8s] %-14s %s' % (donde, pid, msg))
        print()
        # Dónde se arregla cada cosa: no todo se le pide a ADVAPP.
        por_donde = collections.Counter(d for _, _, _, d in graves)
        print('  Se arreglan en: ' + ' · '.join(
            '%s (%d)' % (d, c) for d, c in por_donde.most_common()))
        print()

    porgrupo = collections.Counter(n for n, _, _, _ in avisos)
    if avisos and not todo:
        print('%d avisos (correr con --todo para verlos):' % len(avisos))
        for n, c in porgrupo.most_common():
            print('   %-22s %d' % (n, c))
    elif avisos:
        print('╔' + '═' * 68)
        print('║ %d AVISOS' % len(avisos))
        print('╚' + '═' * 68)
        for nombre, pid, msg, donde in avisos:
            print('  [%-8s] %-14s %s' % (donde, pid, msg))

    if '--pedido' in sys.argv:
        escribir_pedido(graves, avisos)

    print()
    if graves:
        print('RESULTADO: %d graves, %d avisos → NO publicar hasta resolver los graves.'
              % (len(graves), len(avisos)))
        return 1
    print('RESULTADO: sin errores graves, %d avisos. Se puede publicar.' % len(avisos))
    if not local and FUENTE['nombre'] != 'ADVAPP':
        print('OJO: eso vale para la planilla de respaldo, no para ADVAPP (no contesto).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
