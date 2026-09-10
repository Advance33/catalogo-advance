# -*- coding: utf-8 -*-
"""Como se llaman las fotos desde el contrato landing/1.2: por SKU, no por ID.

    fotos/<SKU>-<color>.jpg   la foto de ese color (el color como slug)
    fotos/<SKU>.jpg           la foto de un producto que no tiene color
    fotos/indice.json         la lista de archivos, para que la web no adivine

El SKU identifica al producto SIN sus colores, y lo comparten las filas
hermanas (mismo producto en otro color: el Watch Ultra 3 Natural y el Black
tienen el mismo SKU). Por eso la portada de una fila es la foto de su PRIMER
color -<SKU>-<primer color>.jpg- y dos hermanas con el mismo SKU tienen
portadas distintas. Solo los productos sin color usan <SKU>.jpg.

Por que SKU y no ID: la planilla renumeraba y reutilizaba IDs, y una foto
correcta pasaba a estar mal sin que ningun archivo cambiara. El SKU sobrevive
a que el proveedor reescriba el nombre y a que el catalogo renumere.

Los nombres viejos (<ID>.jpg y <ID>-<color>.jpg) se siguen entendiendo como
respaldo mientras dure la transicion; el resolver los reconoce y dice que son
viejos, para que los chequeos puedan avisar.

Este modulo es la unica verdad sobre nombres de foto: lo importan
verificar-fotos.py, validar.py, revisar-fotos-con-agentes.py y el script de
migracion. index.html aplica las mismas reglas en fotoDeCarpeta() y
fotosDeColor(); si se cambia algo aca, se cambia alla.
"""
import re
import unicodedata

EXT = '.jpg'
RE_ID = re.compile(r'^([A-Z]{2,3}-[A-Z?]{2,4}-\d{3})(?:-(.+))?$')
RE_SKU_OK = re.compile(r'^[a-z0-9~.\-]+$')
TALLE = re.compile(r'^(x{0,2}s|m|x{0,2}l)$', re.I)
VACIO = ('', '—', '-', '–')


def norm(s):
    s = unicodedata.normalize('NFD', s or '')
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn').lower().strip()


def slug(s):
    """"Space Gray" -> "space-gray". Igual que slugColor() en index.html."""
    return re.sub(r'^-+|-+$', '', re.sub(r'[^a-z0-9]+', '-', norm(s)))


def partir_colores(txt):
    """La barra separa opciones, salvo cuando lo que sigue es un talle:
    "Midnight Sport Band M/L" es un color con su talle. Igual que
    partirColores() en index.html."""
    salida = []
    for t in [x.strip() for x in (txt or '').split('/') if x.strip()]:
        if salida and TALLE.match(t):
            salida[-1] += '/' + t
        else:
            salida.append(t)
    return salida


def pintas(txt, pinta=None, conocidos=None):
    """Los puntitos que dibuja la ficha. Igual que pintas() en index.html:
    "Black-Silver" son dos colores si los dos lados son colores conocidos,
    pero "Rose-Gold" y "Space-Gray" siguen siendo uno solo; y un color no se
    cuenta dos veces."""
    salida = []
    for n in partir_colores(txt):
        partes = [x.strip() for x in n.split('-') if x.strip()]
        salida.extend(partes if len(partes) > 1 and pinta
                      and all(pinta(x, conocidos) for x in partes) else [n])
    vistos, out = set(), []
    for n in salida:
        if norm(n) not in vistos:
            vistos.add(norm(n))
            out.append(n)
    return out


def color_del_parentesis(desc, pinta=None, conocidos=None):
    """El PRIMER parentesis del nombre cuyo contenido sea TODO colores que
    sabemos pintar. Ese recaudo es lo que evita confundir "(CAJA DE KIT)",
    "(INGLES)" o "(MINI 3 PRO)" con un color. Sin `pinta` no se mira."""
    if not pinta:
        return []
    for m in re.finditer(r'\(([^)]*)\)', desc or ''):
        lista = pintas(m.group(1).strip(), pinta, conocidos)
        if lista and all(pinta(c, conocidos) for c in lista):
            return lista
    return []


def colores_de_la_fila(fila, pinta=None, conocidos=None):
    """Los colores que vende la fila, como los ve la web (colorDeLaFila en
    index.html): manda la columna Color, salvo cuando el parentesis del nombre
    dice MENOS colores que ella -ahi el nombre es el que sabe, porque la
    columna se completa con los colores de toda la familia y el precio de la
    fila es el de un color solo. Con la columna vacia, manda el parentesis.

    Esta funcion decide como se llama la portada, asi que tiene que dar
    exactamente lo mismo que la web: si se cambia una, se cambia la otra."""
    txt = (fila.get('Color') or '').strip()
    col = partir_colores(txt) if txt not in VACIO else []
    par = color_del_parentesis(fila.get('Descripción completa'), pinta, conocidos)
    if not col:
        return par
    if not par:
        return col
    a, b = {norm(c) for c in par}, {norm(c) for c in col}
    return par if (len(a) < len(b) and a <= b) else col


def formas(color):
    """Las dos escrituras que acepta la web para un color en un nombre de
    archivo: "jet-black" y "jetblack". La primera es la canonica."""
    s = slug(color)
    return [s, s.replace('-', '')] if s else []


def sku_de(fila):
    return (fila.get('SKU') or '').strip()


def nombre_portada(fila, pinta=None, conocidos=None):
    """El archivo de portada de la fila, sin extension: <SKU>-<primer color>
    si vende colores, <SKU> si no. Vacio si la fila no tiene SKU."""
    sku = sku_de(fila)
    if not sku:
        return ''
    cols = colores_de_la_fila(fila, pinta, conocidos)
    return '%s-%s' % (sku, slug(cols[0])) if cols else sku


def nombre_color(sku, color):
    return '%s-%s' % (sku, slug(color))


def candidatos_portada(fila, pinta=None, conocidos=None):
    """Los nombres (sin extension) que la web prueba, en orden, para la
    portada de una fila. Igual que fotoDeCarpeta() en index.html:
      <SKU>-<color> para cada color que vende, en el orden de la celda
      <SKU>                    (la foto sin color)
      <ID>-<color> ... <ID>    (los nombres viejos, de respaldo)
    Primero el primer color; si no esta, cualquier otro color que la fila
    venda es mejor que nada y no es mentira: la ficha lo muestra con su
    puntito. Recien despues la foto sin color."""
    sku = sku_de(fila)
    pid = (fila.get('ID') or '').strip()
    cols = colores_de_la_fila(fila, pinta, conocidos)
    salida = []
    for base in [b for b in (sku, pid) if b]:
        for c in cols:
            salida.extend(base + '-' + f for f in formas(c))
        salida.append(base)
    return salida


def vende_color(filas, color_archivo, pinta=None, conocidos=None):
    """Alguna de estas filas vende el color que dice el archivo."""
    return any(color_coincide(color_archivo, colores_de_la_fila(f, pinta, conocidos)) for f in filas)


def nombre_viejo_portada(fila):
    """El nombre anterior al contrato: <ID>. Solo para el respaldo."""
    return (fila.get('ID') or '').strip()


def resolver(base, skus, ids=()):
    """De un nombre de archivo (sin extension) dice a que producto pertenece.

    Devuelve un dict:
      tipo   'sku'   nombre nuevo, clave = SKU, color = slug del color o ''
             'id'    nombre viejo, clave = ID, color = slug del color o ''
             None    no es de ningun producto de la planilla (huerfana)

    Los SKU llevan guiones adentro, asi que se prueba el mas largo primero:
    "celular~apple~17-iphone-pro~512gb-orange" tiene que caer en el SKU
    "celular~apple~17-iphone-pro~512gb" con color "orange", no en un SKU mas
    corto con un color inventado."""
    for sku in sorted(skus, key=len, reverse=True):
        if base == sku:
            return {'tipo': 'sku', 'clave': sku, 'color': ''}
        if base.startswith(sku + '-'):
            return {'tipo': 'sku', 'clave': sku, 'color': base[len(sku) + 1:]}
    m = RE_ID.match(base)
    if m and m.group(1) in ids:
        return {'tipo': 'id', 'clave': m.group(1), 'color': (m.group(2) or '')}
    return None


def color_coincide(color_archivo, colores_fila):
    """El slug de un archivo es de alguno de los colores de la fila, en
    cualquiera de sus dos escrituras."""
    posibles = set()
    for c in colores_fila:
        posibles.update(formas(c))
    return color_archivo in posibles


# --------------------------------------------------------------------------
# Cuando el SKU cambia.
#
# El 10/09/2026, primer dia del contrato 1.2, la planilla cambio el SKU de 36
# productos que conservaron su ID (el proveedor reescribio el nombre y el SKU
# lo siguio: "Galaxy A57 8/128GB" paso a "... 5G") y el manifiesto no aviso
# nada. 41 fotos quedaron sin producto de un dia para otro.
#
# Para eso se guarda la planilla con la que se nombraron los archivos
# (herramientas/planilla-de-los-nombres.csv). Un archivo que hoy no resuelve
# se busca en esa planilla, y de la fila de entonces se llega a la de hoy por
# el ID: el mismo ID, o el ID nuevo que dice el manifiesto (ids_renombrados y
# renombres_historicos.mapa). Si el ID de hoy tiene otro SKU, el archivo se
# renombra. Si el color del archivo lo venden varias hermanas, se elige la que
# vende ese color; si aun asi cae en dos SKU distintos, se avisa y no se toca.
# --------------------------------------------------------------------------

def indexar(filas):
    """Lo que hace falta para resolver nombres contra una planilla."""
    import collections
    byid = {(f.get('ID') or '').strip(): f for f in filas if (f.get('ID') or '').strip()}
    por_sku = collections.defaultdict(list)
    for f in byid.values():
        if sku_de(f):
            por_sku[sku_de(f)].append(f)
    return {'byid': byid, 'skus': set(por_sku), 'por_sku': por_sku}


def leer_planilla(ruta):
    """Una copia local de la planilla (CSV con encabezados). [] si no esta."""
    import csv, io, os
    if not ruta or not os.path.exists(ruta):
        return []
    with io.open(ruta, encoding='utf-8', newline='') as fh:
        return [f for f in csv.DictReader(fh) if (f.get('ID') or '').strip()]


def puente_de_ids(meta):
    """ID de antes -> ID de hoy, segun el manifiesto. Sigue las cadenas
    (a->b y b->c dan a->c) y corta si hay un ciclo."""
    mapa = {}
    if meta:
        mapa.update((meta.get('renombres_historicos') or {}).get('mapa') or {})
        ren = meta.get('ids_renombrados') or {}
        if isinstance(ren, dict):
            mapa.update(ren)
    salida = {}
    for viejo in mapa:
        actual, vistos = viejo, set()
        while actual in mapa and actual not in vistos:
            vistos.add(actual)
            actual = mapa[actual]
        salida[viejo] = actual
    return salida


def destino_hoy(base, antes, hoy, puente, pinta=None, conocidos=None):
    """Para un archivo (sin extension) que NO resuelve contra la planilla de
    hoy: a donde deberia ir segun la planilla con la que se lo nombro.

    Devuelve un dict con
      estado   'renombrar'   nombre = el nombre nuevo (sin extension)
               'sin fila'    el producto de entonces no esta hoy
               'ambigua'     hoy cae en mas de un SKU: lo decide una persona
               'desconocida' tampoco estaba en la planilla de entonces
      antes    la fila de entonces (para explicarlo), si la hay
      hoy      las filas de hoy que le corresponden
    """
    ra = resolver(base, antes['skus'], antes['byid'].keys())
    if ra is None:
        return {'estado': 'desconocida', 'antes': None, 'hoy': [], 'nombre': ''}
    if ra['tipo'] == 'sku':
        filas_antes = antes['por_sku'][ra['clave']]
    else:
        filas_antes = [antes['byid'][ra['clave']]]
    ids_hoy = []
    for f in filas_antes:
        i = (f.get('ID') or '').strip()
        i = puente.get(i, i)
        if i in hoy['byid'] and i not in ids_hoy:
            ids_hoy.append(i)
    filas = [hoy['byid'][i] for i in ids_hoy]
    if ra['color']:
        venden = [f for f in filas if color_coincide(ra['color'], colores_de_la_fila(f, pinta, conocidos))]
        filas = venden or filas
    skus = sorted({sku_de(f) for f in filas if sku_de(f)})
    r = {'antes': filas_antes[0], 'hoy': filas, 'nombre': '', 'color': ra['color']}
    if not filas or not skus:
        r['estado'] = 'sin fila'
    elif len(skus) > 1:
        r['estado'] = 'ambigua'
    else:
        r['estado'] = 'renombrar'
        r['nombre'] = ('%s-%s' % (skus[0], ra['color']) if ra['color']
                       else nombre_portada(filas[0], pinta, conocidos))
    return r
