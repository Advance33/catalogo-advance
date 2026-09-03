# -*- coding: utf-8 -*-
"""
Valida la planilla Landing contra las reglas que el catálogo necesita para
mostrarse bien. Se corre ANTES de publicar:

    python validar.py

Sale con código 1 si hay algún error GRAVE, así que PUBLICAR.bat puede
frenar solo. Con --todo muestra también los avisos leves.

Las listas de colores y de categorías NO se copian acá: se leen del propio
index.html. Si mañana se agrega un color al mapa, el validador se entera
solo y no hay dos verdades que mantener sincronizadas.
"""
import csv, io, os, re, sys, json, unicodedata, collections, urllib.request

AQUI      = os.path.dirname(os.path.abspath(__file__))
INDEX     = os.path.join(AQUI, 'index.html')
FOTOS     = os.path.join(AQUI, 'fotos')
SHEET_ID  = '18xxslIKTBnVMrLixCGlQBJGje3vKBYQHXy0qvVp8tpQ'
SHEET_GID = '482985525'
CSV_URL   = ('https://docs.google.com/spreadsheets/d/%s/export?format=csv&gid=%s'
             % (SHEET_ID, SHEET_GID))

# Notas internas que nunca tienen que llegar a la web. El texto va a la
# columna que corresponda (Incluye, Condición, Términos de búsqueda).
NOTAS_INTERNAS = [
    (r'\(?\bC/C\b\)?',           'con cargador',      'Incluye'),
    (r'\(?\bS/C\b\)?',           'sin cargador',      'Incluye'),
    (r'CAJA DE KIT',             'nota de depósito',  '(borrar)'),
    (r'CAJA BLANCA',             'producto sin caja', 'Condición'),
    (r'Incluye solo lápiz',      'contenido de caja', 'Incluye'),
    (r'\+ Capa',                 'funda, en portugués', 'Incluye'),
    (r'\b\d+ BATT\b',            'baterías incluidas', 'Incluye'),
]

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
        for m in re.finditer(r"'?([A-Za-z][A-Za-z ]*)'?\s*:", bloque.group(1)):
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

    return colores, plurales, orden, renombre


def bajar_csv(destino=None):
    req = urllib.request.Request(CSV_URL, headers={'User-Agent': 'validar.py'})
    with urllib.request.urlopen(req, timeout=60) as r:
        datos = r.read().decode('utf-8')
    if destino:
        io.open(destino, 'w', encoding='utf-8').write(datos)
    return list(csv.DictReader(io.StringIO(datos)))


# --------------------------------------------------------------------------
# Reglas. Cada una devuelve una lista de (severidad, ID, mensaje).
# GRAVE = el cliente ve algo incorrecto.  AVISO = se puede mejorar.
# --------------------------------------------------------------------------

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


def regla_marca_ajena(filas, ctx):
    """
    El nombre menciona una marca que no es la de la fila. Puede ser un error
    de carga (el volante Logitech cargado como Microsoft) o la compatibilidad
    ("Sigma EF-630 Flash Nikon" es un Sigma CON montura Nikon). No hay forma
    de distinguirlos leyendo el texto, así que:
      - si la marca propia NO figura en el nombre, es GRAVE
      - si figuran las dos, es un AVISO para que lo mire una persona
    """
    fallas = []
    marcas = set(norm(f['Marca']) for f in filas if limpio(f['Marca']))
    for f in filas:
        # En los lentes la otra marca es siempre la montura, no un error.
        if f['Categoría'] == 'Lente':
            continue
        d, propia = norm(f['Descripción completa']), norm(f['Marca'])
        otras = [m for m in marcas
                 if m and m != propia and re.search(r'\b%s\b' % re.escape(m), d)]
        if not otras:
            continue
        propia_figura = propia and re.search(r'\b%s\b' % re.escape(propia), d)
        fallas.append((
            'AVISO' if propia_figura else 'GRAVE', f['ID'],
            'marca "%s" y el nombre menciona "%s"%s' % (
                f['Marca'], otras[0], ' (¿montura o compatibilidad?)' if propia_figura else '')))
    return fallas


def regla_notas_internas(filas, ctx):
    fallas = []
    for f in filas:
        d = f['Descripción completa']
        for patron, que, destino in NOTAS_INTERNAS:
            if re.search(patron, d, re.I):
                fallas.append(('GRAVE', f['ID'],
                               '%s (%s) en el nombre → va a %s' % (
                                   re.search(patron, d, re.I).group(0), que, destino)))
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

        for token in [t.strip() for t in col.split('/') if t.strip()]:
            if norm(token) not in colores:
                fallas.append(('AVISO', f['ID'],
                               'color "%s" no está en el mapa COLORES: sale sin puntito' % token))
    return fallas


def regla_categorias(filas, ctx):
    _, plurales, orden, renombre = ctx
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


def regla_lentes(filas, ctx):
    """Sin "mm" y con coma decimal el buscador no los encuentra."""
    fallas = []
    for f in filas:
        if f['Categoría'] != 'Lente':
            continue
        d = f['Descripción completa']
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
    m = re.search(r'const dual\s*=\s*/(.+?)/[gimsuy]*\.exec', src)
    if not m:
        return [('AVISO', '(código)', 'no se encontró la expresión dual en specs()')]
    try:
        rx = re.compile(m.group(1).replace(r'\/', '/'), re.I)
    except re.error as e:
        return [('AVISO', '(código)', 'no se pudo leer la expresión de specs(): %s' % e)]

    fallas = []
    for f in filas:
        txt = ' '.join([f['Descripción completa'], f.get('Modelo') or ''])
        # ¿Parece "RAM / almacenamiento" pero el catálogo no lo reconoce?
        parece = re.search(r'\d{1,2}\s*(?:GB)?\s*/\s*\d{3,4}\s*GB', txt, re.I)
        if parece and not rx.search(txt):
            fallas.append(('GRAVE', f['ID'],
                           'memoria escrita como "%s": specs() no la reconoce y pierde el disco'
                           % parece.group(0)))
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
        repes = collections.Counter(etiquetas)
        for e, n in repes.items():
            if n < 2:
                continue
            iguales = [v for v, x in zip(vs, etiquetas) if x == e]
            colores = set(limpio(v['Color']) for v in iguales)
            if len(colores) < len(iguales):     # el color tampoco los distingue
                fallas.append(('GRAVE', iguales[0]['ID'],
                               '%d variantes con el botón "%s" y sin color que las separe (%s)'
                               % (n, e, ', '.join(v['ID'] for v in iguales))))
    return fallas


def regla_fotos(filas, ctx):
    if not os.path.isdir(FOTOS):
        return [('AVISO', '(fotos)', 'no existe la carpeta fotos/')]
    archivos = set(os.path.splitext(n)[0] for n in os.listdir(FOTOS))
    ids = set(f['ID'].strip() for f in filas)
    fallas = []

    for f in filas:
        if f['ID'].strip() not in archivos:
            fallas.append(('AVISO', f['ID'], 'sin foto principal'))
        col = limpio(f['Color'])
        partes = [c.strip() for c in col.split('/') if c.strip()]
        for c in partes[1:]:                      # el primero es la foto principal
            slug = re.sub(r'[^a-z0-9]+', '-', norm(c)).strip('-')
            if '%s-%s' % (f['ID'].strip(), slug) not in archivos:
                fallas.append(('AVISO', f['ID'],
                               'ofrece el color "%s" y falta %s-%s.jpg' % (c, f['ID'].strip(), slug)))

    for a in sorted(archivos):
        raiz = '-'.join(a.split('-')[:3])
        if raiz not in ids:
            fallas.append(('AVISO', raiz, 'foto huérfana: %s.jpg sin producto en la planilla' % a))
    return fallas


# Cada regla dice dónde se arregla lo que encuentra. No es lo mismo un dato mal
# cargado (se pide al equipo del sheet) que una lista del catálogo que quedó
# corta (se toca index.html) o una foto que falta (se produce la imagen).
PLANILLA, CODIGO, FOTOS_ = 'planilla', 'código', 'fotos'

REGLAS = [
    ('IDs y precios',       regla_ids_y_precios,      PLANILLA),
    ('Capacidad repetida',  regla_capacidad_repetida, PLANILLA),
    ('Marca equivocada',    regla_marca_ajena,        PLANILLA),
    ('Notas internas',      regla_notas_internas,     PLANILLA),
    ('Colores',             regla_color,              PLANILLA),
    ('Nomenclatura lentes', regla_lentes,             PLANILLA),
    ('Categorías',          regla_categorias,         CODIGO),
    ('Formato de memoria',  regla_specs_dual,         CODIGO),
    ('Tarjetas',            regla_tarjetas,           CODIGO),
    ('Fotos',               regla_fotos,              FOTOS_),
]


def main():
    todo = '--todo' in sys.argv
    sys.stdout.reconfigure(encoding='utf-8')

    ctx = leer_index()
    print('Mapa de colores: %d entradas · categorías con plural: %d' % (len(ctx[0]), len(ctx[1])))

    local = [a for a in sys.argv[1:] if not a.startswith('--')]
    try:
        if local:
            filas = list(csv.DictReader(io.open(local[0], encoding='utf-8')))
            print('Planilla: %s (local)' % local[0])
        else:
            filas = bajar_csv()
            print('Planilla: hoja Landing, bajada recién')
    except Exception as e:
        # No poder validar no es lo mismo que encontrar errores: sale con 2
        # para que PUBLICAR.bat lo distinga y no diga que el catálogo está mal.
        print('\nNo se pudo leer la planilla: %s' % e)
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
        # Dónde se arregla cada cosa: no todo se pide al equipo del sheet.
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

    print()
    if graves:
        print('RESULTADO: %d graves, %d avisos → NO publicar hasta resolver los graves.'
              % (len(graves), len(avisos)))
        return 1
    print('RESULTADO: sin errores graves, %d avisos. Se puede publicar.' % len(avisos))
    return 0


if __name__ == '__main__':
    sys.exit(main())
