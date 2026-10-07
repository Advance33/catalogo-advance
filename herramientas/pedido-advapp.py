# -*- coding: utf-8 -*-
"""El pedido a ADVAPP, armado desde los datos y no a mano.

    python3 herramientas/pedido-advapp.py              arma el borrador
    python3 herramientas/pedido-advapp.py --enviado    anota que se mando hoy
    python3 herramientas/pedido-advapp.py --enviado-ids ID1,ID2   solo esas filas
    python3 herramientas/pedido-advapp.py --probar     se prueba a si misma (sin red)

Baja lo que publica ADVAPP (lo mismo que muestra la web), lo compara contra
nuestro maestro de codigos y contra si mismo con reglas fijas, y escribe
PEDIDO-ADVAPP.txt: por regla, cada fila con lo que tiene hoy y lo que
tendria que tener.

POR QUE EXISTE
Hasta el 26/09/2026 los pedidos se escribian a mano. Pasaron tres cosas: un
borrador prometio que un error "se iba solo" y no era cierto; tres puntos
quedaron escritos y nunca se mandaron; y un punto del 21/09 decia un codigo
equivocado. Un pedido que sale de los datos no se olvida de nada ni afirma
lo que no midio.

LO QUE RECUERDA
herramientas/pedidos-advapp.json guarda cada punto con la fecha en que se
mando (--enviado). Al armar el siguiente, cada punto sale como NUEVO, como
"pedido el dd/mm, sigue igual", o en "YA LO ARREGLARON" si desaparecio. Asi
se ve de un vistazo que falta mandar y que les estamos repitiendo. Un punto
arreglado que vuelve sale como VOLVIO y cuenta aparte (29/09: antes se lo
mostraba como "sigue igual" y el registro seguia diciendo "arreglado").

Lo que ninguna regla puede medir (una referencia de fabrica que falta, un
color que no existe para ese modelo) va a mano en herramientas/
preguntas-advapp.json, con su fecha, y sale en el pedido hasta que se anota
la respuesta.

LO QUE NO HACE
No manda nada: el pedido lo manda una persona. Y no decide precios ni cual de
dos datos contradictorios esta bien -- eso lo pregunta (no-inventar).

COMO TERMINA
0 = nada nuevo; 1 = hay puntos nuevos, o arreglados que volvieron; 2 = no se
pudo armar (ADVAPP no contesto, o el registro o las preguntas estan danados).
Con 2 no se escribe nada: ni el borrador, ni los pendientes, ni el registro.
"""
import os
import re
import sys
import json
import datetime
import textwrap
import statistics
import collections

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
sys.path.insert(0, AQUI)
sys.path.insert(0, RAIZ)
import catalogo_maestro as CM                 # noqa: E402
import validar                                # noqa: E402

SALIDA = os.path.join(RAIZ, 'PEDIDO-ADVAPP.txt')
NUESTROS = os.path.join(RAIZ, 'PENDIENTES-NUESTROS.txt')
REGISTRO = os.path.join(AQUI, 'pedidos-advapp.json')
PREGUNTAS = os.path.join(AQUI, 'preguntas-advapp.json')
INDEX = os.path.join(RAIZ, 'index.html')
HOY = datetime.date.today()


# ---------------------------------------------------------------- reglas
# Cada regla devuelve puntos: {clave, id, desc, hoy, poner, nota}. La clave
# identifica el punto entre dias (regla + fila + lo que se pide), asi un
# punto que cambia de contenido cuenta como otro.

REGLAS = []


def regla(titulo, explicacion, ve_el_cliente, donde='parser'):
    def deco(fn):
        REGLAS.append({'fn': fn, 'titulo': titulo, 'explicacion': explicacion,
                       've': ve_el_cliente, 'donde': donde, 'nombre': fn.__name__})
        return fn
    return deco


def _desc(f):
    return (f.get('Descripción completa') or '').strip()


def _precio(f):
    try:
        return float((f.get('Precio USD') or '').replace(',', '.').strip())
    except ValueError:
        return None


def _usd(p):
    return ('%d' % p) if p == int(p) else ('%.2f' % p)


def capacidad(texto):
    """La memoria de guardado que dice un nombre: la ULTIMA cifra con GB o TB
    ("8/256GB" -> 256GB, "12GB/256GB" -> 256GB, "16GB/1TB" -> 1TB). None si no
    dice ninguna. Es lo que distingue un codigo de otra capacidad de un nombre
    escrito distinto: "Galaxy S25 FE 8/256GB" y "Galaxy S25 FE 256GB" son el
    mismo producto (medido el 26/09: comparar nombres enteros daba 60 falsos)."""
    m = re.findall(r'(\d+)\s*(GB|TB)\b', texto or '', re.I)
    return (m[-1][0] + m[-1][1].upper()) if m else None


def ram_y_disco(texto):
    """(RAM, disco) de un nombre: "8GB/256GB" -> (8, '256GB'), "12/512GB" ->
    (12, '512GB'), "16ram 512gb" -> (16, '512GB'), "256GB" -> (None, '256GB').
    La RAM es la primera cifra de "X/Y"; el disco, capacidad()."""
    t = texto or ''
    m = (re.search(r'\b(\d+)\s*(?:gb|g|ram)?\s*/\s*\d+\s*(?:gb|tb)\b', t, re.I)
         or re.search(r'\b(\d+)\s*(?:gb\s*)?ram\b', t, re.I))
    return (int(m.group(1)) if m else None), capacidad(t)


def memoria_distinta(a, b):
    """Si dos nombres dicen memorias distintas: otro disco, o otra RAM cuando
    los dos la dicen. Sin memoria en alguno de los dos no se puede afirmar."""
    (ra, da), (rb, db) = ram_y_disco(a), ram_y_disco(b)
    if not da or not db:
        return False
    return da != db or (ra is not None and rb is not None and ra != rb)


def modelo_sin_variables(texto, marca=''):
    """El nombre sin lo que no se ve en la foto: colores entre parentesis,
    memoria, RAM y la conectividad Sim/eSIM no -- esa si cambia el producto."""
    t = re.sub(r'\([^)]*\)', ' ', texto or '')
    t = re.sub(r'\b\d+\s*(?:gb|tb|g|ram)?\s*/\s*\d+\s*(?:gb|tb)\b', ' ', t, flags=re.I)
    t = re.sub(r'\b\d+\s*(?:gb|tb)\b', ' ', t, flags=re.I)
    t = re.sub(r'\b(?:5g|4g)\b', ' ', t, flags=re.I)
    # Tampoco se ven: Sim o eSIM, lo que trae la caja, y la marca repetida
    t = re.sub(r'\be-?\s?sim\b|\bsim\b|\bsin cargador\b|\bcon cargador\b', ' ', t, flags=re.I)
    if marca:
        t = re.sub(r'\b' + re.escape(marca) + r'\b', ' ', t, flags=re.I)
    return ' '.join(sorted(set(CM.norm(t).replace('"', ' ').split())))


def mismo_modelo(fila, cod, idx):
    """La fila y el producto `cod` son el mismo modelo con otra capacidad.

    Pedro, 26/09/2026: el mismo modelo con otra memoria se ve igual, asi que
    mostrar la foto del hermano no es un error y no hay nada que pedir. Solo
    cuenta si el resto del nombre coincide: el Redmi Note 15 Pro no es el Pro
    Plus, y ahi la foto si seria de otro producto.

    Y la MEMORIA tiene que ser distinta de verdad (29/09). Sin eso, dos
    productos que se diferencian solo por lo que va entre parentesis pasaban
    como "otra capacidad": el Watch Ultra 3 con malla Ocean y el de malla
    Milanese dan los dos "3 49mm ultra watch", y la fila con el codigo del
    otro reloj se omitia del pedido sin avisar. La RAM cuenta: el Galaxy A56
    8/256 con el codigo del 12/256 sigue omitido, como decidio Pedro."""
    prod = (idx['por_codigo'].get(cod) or [{}])[0].get('Producto', '')
    marca = fila.get('Marca') or ''
    return (modelo_sin_variables(_desc(fila), marca) == modelo_sin_variables(prod, marca)
            and memoria_distinta(_desc(fila), prod))


def sim_de(texto):
    t = (texto or '').lower()
    return 'esim' if re.search(r'\be-?\s?sim\b', t) else 'sim' if re.search(r'\bsim\b', t) else ''


def teclado_del_sku(f):
    m = re.search(r'-(ES|EN)$', (f.get('SKU_VARIANTE') or '').strip().upper())
    return m.group(1) if m else ''


def otra_capacidad(fila, cod, idx):
    """El producto `cod` del maestro dice otra capacidad que la fila."""
    a = capacidad(_desc(fila))
    b = capacidad((idx['por_codigo'].get(cod) or [{}])[0].get('Producto', ''))
    return bool(a and b and a != b)


@regla('CODIGO DE OTRO PRODUCTO',
       'La columna CODIGO no es la del producto de la fila. El codigo lo damos '
       'nosotros y esta en nuestro maestro (herramientas/catalogo-maestro.csv).',
       'la ficha muestra la foto y la identidad del otro producto (el 512GB con la foto '
       'del 256GB, el Sim con la del eSIM).')
def r_codigo(filas, ctx):
    idx, pinta, conocidos = ctx['idx'], ctx['pinta'], ctx['conocidos']
    for f in filas:
        tiene = (f.get('CODIGO') or '').strip().upper()
        cod, de = CM.codigo_de_la_fila(dict(f, CODIGO='', CODIGO_VAR=''), idx, pinta, conocidos)
        if not cod or cod == tiene:
            continue
        var = CM.variante_de(cod, (f.get('Color') or '').strip(), idx) or ''
        # Otra memoria (capacidad o RAM) del mismo modelo: la foto es la misma.
        # Sim contra eSIM no entra aca: son productos distintos y ya tienen
        # codigo propio cada uno (26/09).
        if tiene and tiene in idx['por_codigo'] and mismo_modelo(f, tiene, idx) \
                and sim_de(_desc(f)) == sim_de(idx['por_codigo'][tiene][0].get('Producto', '')):
            yield {'id': f['ID'], 'clave': cod + '|' + var, 'omitir': 'misma foto: otra capacidad del mismo modelo'}
            continue
        yield {'id': f['ID'], 'desc': _desc(f),
               'hoy': '%s  %s' % (tiene or '(vacio)', (f.get('CODIGO_VAR') or '').strip() or '(vacio)'),
               'poner': '%s  %s' % (cod, var or '(sin color: preguntar)'),
               'clave': cod + '|' + var}


@regla('FALTA EL CODIGO DE COLOR',
       'CODIGO esta bien pero CODIGO_VAR no dice el color, o dice el de otro color.',
       'la ficha muestra la foto de otro color, o la foto de ADVAPP en vez de la nuestra.')
def r_variante(filas, ctx):
    idx = ctx['idx']
    for f in filas:
        cod = (f.get('CODIGO') or '').strip().upper()
        if not cod or cod not in idx['por_codigo']:
            continue
        tiene = (f.get('CODIGO_VAR') or '').strip().upper()
        cols = validar.partir_colores(validar.limpio(f.get('Color') or ''))
        if len(cols) != 1:
            continue                       # varios colores en una fila: otra regla
        var = CM.variante_de(cod, cols[0], idx)
        if not var or var == tiene:
            continue
        # si el CODIGO esta mal, ya lo pide r_codigo con su variante
        cod_real, _ = CM.codigo_de_la_fila(dict(f, CODIGO='', CODIGO_VAR=''), idx,
                                           ctx['pinta'], ctx['conocidos'])
        if cod_real and cod_real != cod:
            continue
        # Y el codigo de la columna tiene que ser de ESTE producto: el S26 de
        # 256GB traia el del 512GB, y proponerle un color del 512GB era
        # confirmar el error (26/09). Eso lo toma r_sin_codigo_propio.
        if not cod_real and otra_capacidad(f, cod, idx):
            continue
        yield {'id': f['ID'], 'desc': _desc(f), 'hoy': '%s  %s' % (cod, tiene or '(vacio)'),
               'poner': '%s  %s' % (cod, var), 'clave': var}


@regla('EL CODIGO DE COLOR ES DE OTRO PRODUCTO',
       'CODIGO_VAR (y el "at" de SKUS) tiene que empezar con el CODIGO de la fila: '
       'AT-0455-06 es un color del AT-0455 y de ningun otro. Aca la fila trae el color de '
       'un producto y el codigo de otro.',
       'la web descarta ese color y muestra la foto de ADVAPP (o la de otro color) aunque '
       'la nuestra exista: el Watch Ultra 3 Black Ocean salia sin malla.')
def r_var_de_otro(filas, ctx):
    # 29/09: SWT-APL-WULTRA3-000-BLK-49-CELL-OCEAN trae CODIGO AT-0456 (el de
    # malla Milanese) y CODIGO_VAR AT-0455-01 (el Black del Alpine Loop). Ninguna
    # regla lo veia: r_codigo no la reconoce por ID ni SKU, y r_variante busca
    # el color en AT-0456, donde no esta. Se proponen SOLO los dos productos en
    # juego: buscar "Black" en toda la marca pegaria en decenas (inventar).
    idx = ctx['idx']
    for f in filas:
        cod = (f.get('CODIGO') or '').strip().upper()
        if not CM.RE_CODIGO.match(cod):
            continue
        partes = [x.strip().upper() for x in re.split(r'[/,|]', f.get('CODIGO_VAR') or '') if x.strip()]
        try:
            ats = [(s.get('at') or '').strip().upper() for s in json.loads(f.get('SKUS') or '[]')
                   if isinstance(s, dict) and s.get('at')]     # hay "at" nulos: no cuentan
        except ValueError:
            ats = []
        ajenos = sorted({x for x in partes + ats if x != cod and not x.startswith(cod + '-')})
        if not ajenos:
            continue
        color = validar.limpio(f.get('Color') or '')
        otros = sorted({CM.partir(x)[0] for x in ajenos if CM.partir(x)} - {cod})
        buenas = [(c, CM.variante_de(c, color, idx)) for c in [cod] + otros if c in idx['por_codigo']]
        buenas = [(c, v) for c, v in buenas if v]
        if len(buenas) == 1:
            poner = '%s  %s' % buenas[0]
        else:
            poner = '? %s: %s' % (' o '.join([cod] + otros),
                                  'los dos reconocen el color' if buenas else 'ninguno reconoce el color')
        yield {'id': f['ID'], 'desc': _desc(f), 'hoy': '%s  %s' % (cod, ', '.join(ajenos)),
               'poner': poner, 'clave': cod + '|' + ','.join(ajenos)}


@regla('EL MISMO CODIGO DE COLOR EN DOS PRODUCTOS',
       'Un AT-####-NN nombra UN producto y UN color: es lo que decide la foto. '
       'Nosotros damos el codigo nuevo; digannos cual fila se queda con el que tiene.',
       'dos productos distintos con la misma foto.')
def r_repetido(filas, ctx):
    por_var = collections.defaultdict(list)
    for f in filas:
        v = (f.get('CODIGO_VAR') or '').strip().upper()
        if v and '/' not in v:
            por_var[v].append(f)
    for v, fs in por_var.items():
        skus = {(f.get('SKU_VARIANTE') or f['ID']).strip() for f in fs}
        if len(fs) > 1 and len(skus) > 1:
            for f in fs:
                yield {'id': f['ID'], 'desc': _desc(f), 'hoy': v,
                       'poner': '(lo decimos nosotros)', 'clave': v + '|' + ','.join(sorted(skus))}


@regla('EL TECLADO CONTRA SU COLUMNA',
       'Si el SKU termina en -ES, la columna Teclado es ES (y al reves).',
       'la ficha tecnica dice un idioma de teclado y el producto es del otro. La web ya '
       'lee el SKU, asi que el cliente no lo ve; el dato igual esta mal en ADVAPP.',
       donde='parser')
def r_teclado(filas, ctx):
    for f in filas:
        m = re.search(r'-(ES|EN)$', (f.get('SKU_VARIANTE') or '').strip().upper())
        col = (f.get('Teclado') or '').strip().upper()
        if m and col and col != m.group(1):
            yield {'id': f['ID'], 'desc': _desc(f), 'hoy': 'Teclado ' + col,
                   'poner': 'Teclado ' + m.group(1), 'clave': m.group(1)}


CONEXION = [  # (en el SKU, lo que el nombre NO puede decir, como se lee)
    (r'(CELL|5G|LTE)', r'\bwi-?fi\b(?!\s*\+)', 'el SKU dice celular/5G y el nombre dice Wifi'),
    (r'WIFI(?!.*CELL)', r'\b(5g|lte|cellular|celular)\b', 'el SKU dice Wifi y el nombre dice celular'),
    (r'-ESIM$', r'(?<!e-)(?<!e)\bsim\b', 'el SKU dice eSIM y el nombre dice Sim'),
    (r'(?<!E)-SIM$', r'\be-?sim\b', 'el SKU dice Sim y el nombre dice eSIM'),
]

# La gama con la que TERMINA el modelo del SKU (TABA11PLUS, POCOX8PROMAX) y que
# el nombre tiene que decir. Al final y no en cualquier parte: como subcadena
# saltaban "FE" adentro de EFEOSR y "PRO" adentro de APPROACHS70 (medido 29/09).
GAMA_AL_FINAL = re.compile(r'(PLUS|PRO|MAX|ULTRA|FE|MINI|AIR|LITE)$')


@regla('EL NOMBRE CONTRADICE AL SKU',
       'El nombre, el SKU y el ID tienen que decir lo mismo. Aca no sabemos cual de los '
       'datos esta bien: por eso es una pregunta, no una correccion.',
       'el nombre promete una cosa y el producto es otra (Wifi o 5G, Sim o eSIM, '
       'la generacion).', donde='pregunta')
def r_nombre(filas, ctx):
    for f in filas:
        sku = (f.get('SKU_VARIANTE') or '').strip().upper()
        nom = _desc(f).lower()
        for en_sku, en_nombre, dice in CONEXION:
            if re.search(en_sku, sku) and re.search(en_nombre, nom):
                yield {'id': f['ID'], 'desc': _desc(f), 'hoy': sku, 'poner': '? ' + dice,
                       'clave': dice}
        # ID nuevo (con guiones, del estilo del SKU) cuyo MODELO no coincide con
        # el del SKU: AUR-APL-AIRPODSMAX2-... con SKU AUR-APL-AIRPODSMAX-...
        # Solo el tramo del modelo (el tercero): el ID se congela al darse de
        # alta y el SKU despues suma la RAM ("256" -> "8G256"), y eso no es
        # una contradiccion. Medido el 26/09: sin este corte salian 31 falsas.
        idf = f['ID'].strip().upper()
        if sku and idf.count('-') >= 4 and idf[:3] == sku[:3]:
            a, b = idf.split('-'), sku.split('-')
            if len(a) > 2 and len(b) > 2 and a[2] != b[2]:
                yield {'id': f['ID'], 'desc': _desc(f), 'hoy': 'SKU ' + sku,
                       'poner': '? el ID dice %s y el SKU dice %s' % (a[2], b[2]),
                       'clave': 'id|' + a[2] + '|' + b[2]}
        # El SKU dice una gama que el nombre no dice (29/09): la fila
        # TAB-SAM-TABA11PLUS-... se llama "Galaxy Tab A11 6GB/128GB" sin el "+",
        # y la tarjeta del A11+ quedo titulada "Galaxy Tab" con un boton "A11".
        # El ID y el SKU coincidian entre si, asi que lo de arriba no lo veia.
        b = sku.split('-')
        m = GAMA_AL_FINAL.search(b[2]) if len(b) > 2 else None
        if m:
            g = m.group(1).lower()
            if not re.search(r'\b' + g + r'\b', nom) and not (g == 'plus' and re.search(r'\w\+', nom)):
                mod = (f.get('Modelo') or '').strip()
                yield {'id': f['ID'], 'desc': _desc(f), 'hoy': 'SKU ' + sku,
                       'poner': '? el SKU dice %s y el nombre no%s'
                                % (m.group(1), (' (la columna Modelo dice "%s")' % mod) if mod else ''),
                       'clave': 'gama|' + g}


@regla('EL MISMO PRODUCTO Y COLOR CON DOS PRECIOS',
       'Dos filas que para el cliente son lo mismo (mismo SKU de la web, mismo color) '
       'y valen distinto. No sabemos cual precio vale.',
       'el mismo producto aparece dos veces a precios distintos, o se esconde uno y el '
       'precio que queda puede no ser el real.', donde='pregunta')
def r_dos_precios(filas, ctx):
    grupos = collections.defaultdict(list)
    for f in filas:
        k = ((f.get('SKU') or '').strip().lower(), validar.norm(validar.limpio(f.get('Color') or '')))
        if k[0] and k[1]:
            grupos[k].append(f)
    for k, fs in grupos.items():
        precios = {(f.get('Precio USD') or '').strip() for f in fs}
        if len(fs) > 1 and len(precios) > 1:
            for f in fs:
                yield {'id': f['ID'], 'desc': _desc(f), 'hoy': 'USD ' + f.get('Precio USD', ''),
                       'poner': '? ' + ' o '.join('USD ' + p for p in sorted(precios)),
                       'clave': k[0] + '|' + k[1] + '|' + ','.join(sorted(precios))}


@regla('EL MISMO SKU EN DOS FILAS, UNA SIN COLOR',
       'Una fila sin color al lado de otra con el mismo SKU de la web. O es la misma fila '
       'repetida (que quede una sola, con su color y su stock), o son productos distintos '
       'y el SKU y el nombre tienen que diferenciarlos. Si ademas valen distinto, no '
       'sabemos cual precio vale.',
       'la ficha ofrece dos versiones que son lo mismo ("Space Black" y "Base"), a veces a '
       'dos precios: el iPad Pro M4 11" 512GB salia a USD 1.120 (el precio del 256GB) al '
       'lado de otro 512GB a 1.320.', donde='pregunta')
def r_fila_sin_color(filas, ctx):
    # r_dos_precios agrupa por SKU + color y se salteaba las filas sin color:
    # asi quedaron fuera del pedido el iPad Pro M4 11" 512GB (TAB-APP-046 sin
    # color a 1.320 junto al Space Black a 1.120) y el Tab A11+ 6/128 (29/09).
    grupos = collections.defaultdict(list)
    for f in filas:
        s = (f.get('SKU') or '').strip().lower()
        if s:
            grupos[s].append(f)
    for s, fs in grupos.items():
        sin = [f for f in fs if not validar.limpio(f.get('Color') or '')]
        if len(fs) < 2 or not sin:
            continue
        precios = sorted({p for p in (_precio(x) for x in fs) if p is not None})
        for f in sin:
            otras = [x for x in fs if x is not f]
            quienes = ', '.join('%s (%s, USD %s)' % (x['ID'], validar.limpio(x.get('Color') or '') or 'sin color',
                                                    (x.get('Precio USD') or '').strip()) for x in otras)
            if len(precios) > 1:
                poner = '? %s: cual vale, y es la misma fila' % ' o '.join('USD ' + _usd(p) for p in precios)
            else:
                poner = '? es la misma fila (una sola, con su color)'
            yield {'id': f['ID'], 'desc': _desc(f), 'hoy': 'sin color, USD ' + (f.get('Precio USD') or '').strip(),
                   'poner': poner, 'detalle': 'Mismo SKU de la web que ' + quienes,
                   'clave': s + '|' + ','.join(_usd(p) for p in precios)}


# Cuanto se tiene que apartar un precio de los de su misma memoria para que
# "vale igual que otra memoria" deje de ser casualidad (29/09: con 8% salen
# las filas clonadas y no las diferencias normales entre colores).
APARTE = 0.08


def _comparables(a, b):
    """Dos memorias (RAM, disco) que se pueden ordenar: una es mayor o igual
    en disco Y en RAM. Si una dice la RAM y la otra no, no se comparan."""
    (ra, da), (rb, db) = a, b
    if a == b or (ra is None) != (rb is None):
        return False
    ga, gb = _gigas(da), _gigas(db)
    ra, rb = ra or 0, rb or 0
    return (ga >= gb and ra >= rb) or (ga <= gb and ra <= rb)


def _gigas(disco):
    n = int(re.match(r'\d+', disco).group())
    return n * 1024 if disco.endswith('TB') else n


def _memoria(c):
    return ('%d/%s' % c) if c[0] is not None else c[1]


@regla('EL PRECIO DE OTRA MEMORIA',
       'Filas que parecen copiadas de otra memoria del mismo modelo: traen su precio (y '
       'casi siempre su CODIGO), con el CODIGO_VAR vacio. Es un patron de como se dan de '
       'alta las filas nuevas. No sabemos el precio de verdad: por eso es una pregunta. '
       'El CODIGO de otra memoria NO se pide (Pedro, 26/09: misma foto); aca va solo '
       'como indicio de la copia.',
       'la pestana de memoria dice "desde" un precio que no es el suyo (el S26 FE "512GB '
       'desde USD 730", el precio del 128GB) y al tocarla el precio salta; con stock, se '
       'puede pedir a un precio que quizas no sea el real.', donde='pregunta')
def r_precio_de_otra_capacidad(filas, ctx):
    # Nadie comparaba memorias de un mismo modelo: validar agrupa por nombre sin
    # color justamente para NO cruzarlas, r_dos_precios mira el mismo SKU, y
    # r_codigo omite a proposito la fila que trae el codigo de otra memoria.
    # Las clonadas (codigo Y precio del hermano) quedaban invisibles (29/09).
    # Se agrupa por Grupo + Sim/eSIM + teclado + Condicion + Incluye, las mismas
    # columnas que separan versiones en la web, y se incluyen las filas sin
    # stock: la pestana calcula su "desde" con todas.
    grupos = collections.defaultdict(list)
    for f in filas:
        g = (f.get('Grupo') or '').strip().lower()
        c = ram_y_disco(_desc(f))
        p = _precio(f)
        if g and c[1] and p:
            k = (g, sim_de(_desc(f)), teclado_del_sku(f), (f.get('Condición') or '').strip().lower(),
                 (f.get('Incluye') or '').strip().lower())
            grupos[k].append((c, p, f))
    for k, fs in grupos.items():
        por_mem = collections.defaultdict(list)
        for c, p, f in fs:
            por_mem[c].append((p, f))
        if len(por_mem) < 2:
            continue
        marcadas = 0
        # 1) Fila por fila, solo con el criterio preciso: vale EXACTAMENTE lo
        #    que otra memoria y se aparta de sus hermanas de la misma memoria.
        for c, lst in por_mem.items():
            for p, f in lst:
                herm = [q for q, g2 in lst if g2 is not f]
                if not herm:
                    continue
                med = statistics.median(herm)
                if abs(p - med) / med <= APARTE:
                    continue
                de = [c2 for c2, l2 in por_mem.items()
                      if _comparables(c, c2) and any(q == p for q, _ in l2)]
                if not de:
                    continue
                cod = (f.get('CODIGO') or '').strip().upper()
                cods_otra = {(g2.get('CODIGO') or '').strip().upper() for c2 in de for q, g2 in por_mem[c2] if q == p}
                cods_suya = {(g2.get('CODIGO') or '').strip().upper() for q, g2 in lst if g2 is not f}
                copia = (' Y trae el CODIGO %s, el de esa memoria: parece copiada.' % cod
                         if cod and cod in cods_otra and cod not in cods_suya else '')
                marcadas += 1
                yield {'id': f['ID'], 'desc': _desc(f), 'hoy': 'USD ' + _usd(p),
                       'poner': '? USD %s es el precio del %s; los otros %s valen %s'
                                % (_usd(p), ' y '.join(_memoria(x) for x in sorted(de, key=str)),
                                   _memoria(c), '/'.join(_usd(x) for x in sorted(set(herm)))),
                       'detalle': ('Stock: %s.' % ((f.get('Stock') or '').strip() or '?')) + copia,
                       'clave': '%s|%s|%s' % (k[0], _memoria(c), _usd(p))}
        # 2) La memoria mayor que vale igual o menos que una menor, sin una
        #    fila clonada que la explique: UN punto por familia con la tabla.
        #    Fila por fila le echaba la culpa a la que estaba bien (el S26
        #    Ultra de 1TB a 1.380 es el correcto; los mal son los 256GB).
        if marcadas:
            continue
        minimo = {c: min(q for q, _ in l) for c, l in por_mem.items()}
        raro = any(_comparables(a, b) and (_gigas(a[1]), a[0] or 0) > (_gigas(b[1]), b[0] or 0)
                   and minimo[a] <= minimo[b] for a in por_mem for b in por_mem)
        if not raro:
            continue
        orden = sorted(por_mem, key=lambda c: (_gigas(c[1]), c[0] or 0))
        tabla = ' · '.join('%s %s' % (_memoria(c), '/'.join(_usd(q) for q in sorted({q for q, _ in por_mem[c]})))
                           for c in orden)
        nombre = k[0] + (' ' + k[1] if k[1] else '') + (' teclado ' + k[2] if k[2] else '')
        primera = min((f for _, _, f in fs), key=lambda x: x['ID'])
        yield {'id': nombre, 'desc': _desc(primera), 'hoy': 'precios por memoria',
               'poner': '? la memoria mas grande vale igual o menos que una menor: cuales valen',
               'detalle': 'USD por memoria: ' + tabla,
               'clave': 'familia|' + nombre + '|' + tabla}


@regla('EL MISMO PRODUCTO EN DOS TARJETAS',
       'El Grupo sale de las palabras del nombre, y una palabra de mas arma otra tarjeta: '
       '"Esp" en vez de "Teclado ES", "Cell 5G" en vez de "Cellular". Aca el SKU_MADRE y el '
       'tipo del SKU_VARIANTE (CELL, ES, WIFIPEN...) son los mismos y el Grupo no. Como '
       'regla del parser: que el Grupo salga del SKU_MADRE mas ese tipo, no del nombre.',
       'el mismo modelo partido en dos tarjetas; en la principal falta una version (el '
       'iPad Pro M5 11" Cellular de 512GB salia solo en otra tarjeta).', donde='pregunta')
def r_grupo_partido(filas, ctx):
    por = collections.defaultdict(lambda: collections.defaultdict(list))
    for f in filas:
        madre = (f.get('SKU_MADRE') or '').strip().upper()
        sv = (f.get('SKU_VARIANTE') or '').strip().upper()
        g = (f.get('Grupo') or '').strip().lower()
        if not madre or not g or not sv.startswith(madre + '-'):
            continue
        tipo = '-'.join(sv[len(madre) + 1:].split('-')[2:])   # despues de memoria y color
        por[madre + '|' + tipo][g].append(f)
    palabras = lambda g: set(re.split(r'[~\-]+', g)) - {''}
    for k, grupos in por.items():
        if len(grupos) < 2:
            continue
        orden = sorted(grupos, key=lambda g: (-len(grupos[g]), len(g), g))
        principal = orden[0]
        ref = min(grupos[principal], key=lambda x: x['ID'])
        for g in orden[1:]:
            mas = sorted(palabras(g) - palabras(principal))
            menos = sorted(palabras(principal) - palabras(g))
            dif = '; '.join(x for x in (('de mas: ' + ' '.join(mas)) if mas else '',
                                        ('le falta: ' + ' '.join(menos)) if menos else '') if x)
            for f in grupos[g]:
                yield {'id': f['ID'], 'desc': _desc(f), 'hoy': 'Grupo ' + (dif or g),
                       'poner': '? el mismo producto que %s' % ref['ID'],
                       'detalle': 'Grupo "%s" contra "%s" (%s)' % (g, principal, _desc(ref)[:60]),
                       'clave': k + '|' + g}


def _color_afuera(f):
    """True si el color de la fila esta en el nombre pero FUERA de los
    parentesis; False si esta adentro; None si no se sabe."""
    c = validar.limpio(f.get('Color') or '')
    if not c:
        return None
    d = _desc(f)
    nc = validar.norm(validar.partir_colores(c)[0]) if validar.partir_colores(c) else ''
    if not nc:
        return None
    if nc in validar.norm(' '.join(re.findall(r'\(([^)]*)\)', d))):
        return False
    if nc in validar.norm(re.sub(r'\([^)]*\)', ' ', d)):
        return True
    return None


@regla('EL NOMBRE ESCRITO DISTINTO QUE SUS HERMANAS',
       'Filas del mismo Grupo escritas de otra forma: el color suelto en el medio en vez de '
       'entre parentesis al final, o la memoria sin la RAM que dicen las demas. La web arma '
       'los botones de version con el nombre, y asi salen botones que son lo mismo.',
       'botones de version que no dicen nada ("GPS 46mm Silver M/L" al lado de "46mm GPS") '
       'y ningun puntito de color.')
def r_nombre_desparejo(filas, ctx):
    # Watch Series 11 46mm (29/09): SW-APP-009 "GPS 46mm Silver M/L" y SW-APP-010
    # al lado de "46mm GPS (Space Gray)" daban tres botones y cero puntitos.
    por_g = collections.defaultdict(list)
    for f in filas:
        g = (f.get('Grupo') or '').strip().lower()
        if g:
            por_g[g].append(f)
    for g, fs in por_g.items():
        afuera = [(f, _color_afuera(f)) for f in fs]
        if any(e is False for _, e in afuera):
            for f, e in afuera:
                if e is True:
                    c = validar.limpio(f.get('Color') or '')
                    yield {'id': f['ID'], 'desc': _desc(f), 'hoy': 'color suelto: ' + c,
                           'poner': 'el color entre parentesis al final, como sus hermanas: (%s)' % c,
                           'clave': 'color|' + validar.norm(c)}
        # La misma memoria con y sin RAM: "256GB" al lado de "12GB/256GB"
        por_disco = collections.defaultdict(list)
        for f in fs:
            r, d = ram_y_disco(_desc(f))
            if d:
                por_disco[d].append((r, f))
        for d, lst in por_disco.items():
            rams = sorted({r for r, _ in lst if r is not None})
            if not rams:
                continue
            for r, f in lst:
                if r is None:
                    yield {'id': f['ID'], 'desc': _desc(f), 'hoy': d + ' sin RAM',
                           'poner': '? es el %s como sus hermanas' % ' o '.join('%d/%s' % (x, d) for x in rams),
                           'clave': 'ram|' + d + '|' + ','.join(str(x) for x in rams)}


@regla('LA CATEGORIA CONTRADICE AL SKU',
       'El prefijo del SKU (DRN, CEL, TAB...) dice la clase de producto, y en todas las '
       'demas filas coincide con la Categoria.',
       'el producto no aparece en su rubro: dos drones con stock no salian en "Drones" y la '
       'portada mostraba un drone como estrella de "Accesorios Drone".')
def r_categoria(filas, ctx):
    # 29/09: ACC-DJI-013, 015 y 017 son drones (SKU DRN-) con Categoria
    # "Accesorio Drone"; las otras 20 familias de prefijo coinciden 1 a 1.
    # Se aprende de los datos (la mayoria del prefijo), no de una lista fija.
    pre = collections.defaultdict(collections.Counter)
    for f in filas:
        p = (f.get('SKU_VARIANTE') or '').strip().upper().split('-')[0]
        cat = (f.get('Categoría') or '').strip()
        if p and cat:
            pre[p][cat] += 1
    for f in filas:
        p = (f.get('SKU_VARIANTE') or '').strip().upper().split('-')[0]
        cat = (f.get('Categoría') or '').strip()
        if not p or not cat or not pre[p]:
            continue
        mayor, n = pre[p].most_common(1)[0]
        resto = sum(pre[p].values()) - n
        if cat != mayor and n >= 3 and n >= 2 * resto:
            yield {'id': f['ID'], 'desc': _desc(f), 'hoy': 'Categoria ' + cat,
                   'poner': 'Categoria %s (como las otras %d filas %s-)' % (mayor, n, p),
                   'clave': cat + '|' + mayor}


@regla('LENTE SIN MONTURA',
       'El SKU del lente termina en -000 y el nombre no dice la montura (RF, EF, EF-M, E, '
       'Z...). Sin eso no se puede filtrar ni saber a que camara va. No la adivinamos.',
       'el lente no aparece en el filtro Montura.', donde='pregunta')
def r_montura(filas, ctx):
    # 29/09: de 189 lentes, 187 traen la montura en el SKU; LEN-SIG-002 (Sigma
    # 56mm "Canon": existe en EF-M y en RF) y LEN-SIG-046 no la dicen en ningun lado.
    for f in filas:
        sv = (f.get('SKU_VARIANTE') or '').strip().upper()
        if not sv.startswith('LEN-'):
            continue
        try:
            skus = [s.get('sku') for s in json.loads(f.get('SKUS') or '[]') if isinstance(s, dict)]
        except ValueError:
            skus = []
        sufijos = {x.strip().upper().split('-')[-1] for x in [sv] + [s for s in skus if s]}
        if sufijos <= {'000'}:
            yield {'id': f['ID'], 'desc': _desc(f), 'hoy': 'SKU ...-000',
                   'poner': '? que montura es (ni el nombre ni el SKU la dicen)', 'clave': 'montura'}


# Erratas vistas en los nombres de ADVAPP (29/09). Se vigilan una por una:
# el nombre tiene que venir bien desde ADVAPP, la web no traduce ni corrige
# nombres (partirTitulo). Al renombrar, que mantengan ID, CODIGO y SKU: el
# 11/09 un nombre reescrito entero ("Rayban Meta GEN2") hizo que las
# herramientas dejaran de reconocer siete filas.
ERRATAS = [
    (r'\bEor\b', 'EOS', 'las otras Canon dicen EOS, y el SKU tambien'),
    (r'\bGoogles\b', 'Goggles', 'son las gafas DJI Goggles, como dice el SKU'),
    (r'\bCamcoder\b', 'Camcorder', 'como las Panasonic'),
    (r'\bCombo More Fly\b', 'Fly More Combo', 'como las otras filas DJI'),
    (r'\bRecharga\s+Ble\b', 'Rechargeable', 'la palabra quedo partida'),
    (r'\bF/A\b', 'F/<numero>', '"F/A" no es una apertura: el SKU la dice'),
    (r'^Acc\s+DJI\s+', 'sin "Acc DJI " al comienzo', 'la marca ya va arriba'),
    (r'\(?\s*Consultar Colores\s*\)?', 'sacarlo del nombre',
     'si quieren avisarlo va en Detalle; en Color no, que pintaria un color inventado'),
    (r'\bBateria\b', 'Batería', 'tilde'),
    (r'\bMicrofono\b', 'Micrófono', 'tilde'),
    (r'\bCamara\b', 'Cámara', 'tilde'),
    (r'\bMultifuncion\b', 'Multifunción', 'tilde'),
    (r'\bHelices\b', 'Hélices', 'tilde'),
]


@regla('ERRATAS EN EL NOMBRE',
       'Palabras mal escritas en "Descripcion completa". Al corregirlas, mantener ID, CODIGO '
       'y SKU: es solo el texto.',
       'el titulo de la tarjeta, la cinta de la portada y el mensaje de WhatsApp dicen la '
       'errata ("Googles 2"), y el buscador no encuentra "goggles" ni "camcorder".')
def r_erratas(filas, ctx):
    for f in filas:
        d = _desc(f)
        for patron, bien, por_que in ERRATAS:
            m = re.search(patron, d)
            if m:
                sku = (f.get('SKU_VARIANTE') or '').strip()
                yield {'id': f['ID'], 'desc': d, 'hoy': '"%s"' % m.group(0).strip(),
                       'poner': '%s (%s)' % (bien, por_que),
                       'detalle': ('SKU: ' + sku) if 'SKU' in por_que and sku else '',
                       'clave': 'errata|' + patron}


# Las siglas que ADVAPP pasa a "Tipo Titulo" cuando el proveedor escribe todo en
# mayusculas (29/09: 34 filas). Su propia columna Modelo las trae bien. Solo
# esta lista: con "toda palabra corta en mayusculas" quedaria "Drone DJI MINI 5
# PRO", porque 446 de 757 Modelos vienen enteros en mayusculas.
SIGLAS = {'IPS', 'VA', 'HDR', 'WQHD', 'VESA', 'DP', 'VGA', 'MSI', 'MAG', 'RC', 'DC', 'VCM',
          'ZA', 'IF', 'VC', 'NC', 'ID', 'PC', 'BC'}


@regla('SIGLAS EN MINUSCULA',
       'Al pasar el texto a "Tipo Titulo" se rompen las siglas. Dos reglas para el parser: '
       '(a) si el texto del proveedor ya viene con mayusculas y minusculas, dejarlo como '
       'viene; (b) si viene todo en mayusculas, sumar estas siglas a la lista que ya '
       'respetan (DJI, HDMI, USB, FHD...).',
       'la linea tecnica, "Estas eligiendo", el buscador y el mensaje de WhatsApp dicen '
       '"Flat Rapid Ips · Hdr".')
def r_siglas(filas, ctx):
    for f in filas:
        malas = []
        for t in re.findall(r'(?<![A-Za-z])([A-Z][a-z]{1,4})(?![A-Za-z])', _desc(f)):
            if t.upper() in SIGLAS and t not in malas:
                malas.append(t)
        if malas:
            yield {'id': f['ID'], 'desc': _desc(f), 'hoy': ', '.join(malas),
                   'poner': ', '.join(t.upper() for t in malas),
                   'clave': 'siglas|' + ','.join(sorted(malas))}


# Colores escritos en castellano. La columna Color va en ingles como las
# demas filas; esto no inventa un color: es el mismo, traducido, y va con "?".
CASTELLANO = {'negro': 'Black', 'blanco': 'White', 'gris': 'Gray', 'grafito': 'Graphite',
              'plata': 'Silver', 'plateado': 'Silver', 'dorado': 'Gold', 'azul': 'Blue',
              'rojo': 'Red', 'verde': 'Green', 'rosa': 'Pink', 'violeta': 'Purple',
              'amarillo': 'Yellow', 'naranja': 'Orange'}
ABREVIADOS = {'mid': 'Midnight'}


def _clave_color(s):
    return re.sub(r'[\s\-]+', '', validar.norm(s))


def _raro(c):
    """Todo en minuscula o todo en mayuscula (sin cifras)."""
    letras = re.sub(r'[^A-Za-z]', '', c)
    return bool(letras) and not re.search(r'\d', c) and (c == c.lower() or (len(letras) > 1 and c == c.upper()))


@regla('EL COLOR ESCRITO DISTINTO',
       'La columna Color se muestra tal cual: en el puntito, en "Estas eligiendo" y en el '
       'mensaje de WhatsApp. Tiene que ir en ingles, con mayuscula inicial, y escrita igual '
       'en todas las filas del modelo: si una hermana dice "Skyblue" y otra "Sky Blue", al '
       'cambiar de memoria la ficha pierde el color elegido.',
       'puntitos que dicen "gray", "negro" o "SILVER" al lado de "Pink" y "White", y el '
       'color elegido que se pierde al cambiar de memoria.')
def r_color_escrito(filas, ctx):
    # 29/09: 'gray' x7, 'black' x4, 'lightblue' x2, 'SILVER', 'negro', 'dark
    # blue', 'Mid', 'Gris', 'Grafito', 'Blanco'; y Skyblue / Sky Blue en el
    # iPhone Air. Tienen que ser TODAS las filas del modelo: si queda una
    # hermana mal escrita al mismo precio, la web puede elegir justo esa.
    formas = collections.defaultdict(collections.Counter)
    for f in filas:
        g = (f.get('Grupo') or '').strip().lower()
        for c in validar.partir_colores(validar.limpio(f.get('Color') or '')):
            formas[(g, _clave_color(c))][c] += 1
    for f in filas:
        g = (f.get('Grupo') or '').strip().lower()
        for c in validar.partir_colores(validar.limpio(f.get('Color') or '')):
            k = validar.norm(c)
            poner = ''
            if k in CASTELLANO:
                poner = '? %s (en ingles, como el resto)' % CASTELLANO[k]
            elif k in ABREVIADOS:
                poner = '? %s (abreviado)' % ABREVIADOS[k]
            else:
                otras = {x: n for x, n in formas[(g, _clave_color(c))].items() if x != c and not _raro(x)}
                if otras:
                    # la forma de las hermanas: la que mas se repite; empatadas,
                    # la mas separada ("Sky Blue" antes que "Skyblue")
                    mejor = max(otras, key=lambda x: (otras[x], len(x.split()), x))
                    propia = formas[(g, _clave_color(c))][c]
                    if _raro(c) or otras[mejor] > propia or (otras[mejor] == propia and
                                                             len(mejor.split()) > len(c.split())):
                        poner = '%s (como sus hermanas)' % mejor
                if not poner and _raro(c):
                    poner = ' '.join(w[:1].upper() + w[1:].lower() for w in c.split())
            if poner:
                yield {'id': f['ID'], 'desc': _desc(f), 'hoy': 'Color "%s"' % c, 'poner': poner,
                       'clave': 'color|' + c + '|' + poner}


GAMAS_BUSQUEDA = ('pro', 'max', 'plus', 'ultra', 'air', 'mini', 'fe', 'lite')


@regla('LOS TERMINOS DE BUSQUEDA NOMBRAN OTRO MODELO',
       '"Terminos de busqueda" dice una gama (pro, max, plus, ultra, air...) que ni el Modelo '
       'ni la Descripcion dicen. No los regeneren a ciegas con el nombre: a veces el que '
       'esta mal es el nombre. Digannos cual de las dos columnas vale.',
       'buscando "iphone air" aparece el iPhone 17, y "s26 ultra" trae el S26 y el S26 Plus.',
       donde='pregunta')
def r_terminos(filas, ctx):
    for f in filas:
        t = validar.norm(f.get('Términos de búsqueda') or '')
        if not t:
            continue
        base = validar.norm((f.get('Modelo') or '') + ' ' + _desc(f)).replace('+', ' plus ')
        tiene = set(re.findall(r'[a-z0-9]+', base))
        de_mas = [g for g in GAMAS_BUSQUEDA if re.search(r'\b' + g + r'\b', t) and g not in tiene]
        if de_mas:
            yield {'id': f['ID'], 'desc': _desc(f), 'hoy': 'busca "%s"' % ', '.join(de_mas),
                   'poner': '? sacar "%s", o el nombre esta mal' % ', '.join(de_mas),
                   'clave': 'terminos|' + ','.join(de_mas)}


@regla('LO QUE FALTA EN EL CONTRATO',
       'No son filas: son columnas o direcciones que la web ya sabe usar y ADVAPP todavia '
       'no manda. Salen solas mientras falten.',
       'toda ficha dice "Cada producto tiene la suya" en vez de su garantia; sin la '
       'direccion de eventos no se mide nada (busquedas sin resultado, clics a WhatsApp).')
def r_contrato(filas, ctx):
    # Garantia (29/09): la web la muestra sola si viene (col('garantia') y
    # htmlServicio), pero landing/1.3 no la trae y nunca se pidio. Texto libre
    # por fila, vacia cuando no se sabe: los plazos los dice Pedro, no se
    # deducen por marca ni se completa con un valor fijo.
    if filas and not any(k in filas[0] for k in ('Garantía', 'Garantia', 'garantia')):
        yield {'id': '(contrato)', 'desc': 'columna Garantia', 'hoy': 'no viene',
               'poner': 'columna opcional "Garantia": texto libre por fila, vacia si no se sabe',
               'detalle': 'Los plazos los da Pedro (o el proveedor a traves de el): nada de '
                          'un valor por defecto. Vacia, la web sigue diciendo "Cada producto '
                          'tiene la suya".',
               'clave': 'columna-garantia'}
    for f in filas:
        m = re.search(r'\b\d+\s*Y\s+Warranty\b|\bWarranty\b|\bGarant[ií]a\b', _desc(f), re.I)
        if m:
            yield {'id': f['ID'], 'desc': _desc(f), 'hoy': '"%s" en el nombre' % m.group(0),
                   'poner': 'la garantia en su columna, no en el nombre',
                   'clave': 'garantia-en-el-nombre'}
    # La medicion (29/09): MEDICION-ADVAPP.txt pide POST /api/eventos desde el
    # 17/09 y nunca entro en un pedido. Sale mientras index.html tenga
    # ANALITICA_URL vacio, y deja de salir sola cuando se complete.
    try:
        src = open(INDEX, encoding='utf-8').read()
    except OSError:
        src = ''
    if re.search(r"\bANALITICA_URL\s*=\s*''", src):
        yield {'id': '(contrato)', 'desc': 'medicion de la pagina', 'hoy': 'no existe',
               'poner': 'la direccion para los eventos (ver MEDICION-ADVAPP.txt)',
               'detalle': 'Hoy /api/eventos da 404. El documento tiene el cuerpo, los eventos, '
                          'CORS y la tabla sugerida; la direccion exacta la confirman ustedes.',
               'clave': 'endpoint-eventos'}


@regla('SIN CODIGO PROPIO: TRAE EL DE OTRO PRODUCTO',
       'La fila trae en CODIGO el de otro producto (casi siempre otra capacidad) y en '
       'nuestro maestro no hay uno para ella. El codigo lo damos NOSOTROS: se decide si es '
       'un alta o un producto que ya esta con otro nombre (altas-decididas.csv) y recien '
       'despues se le pasa a ADVAPP.',
       'la ficha muestra la foto del otro producto.', donde='nosotros')
def r_sin_codigo_propio(filas, ctx):
    idx = ctx['idx']
    esperan = ctx.get('esperan') or {}
    for f in filas:
        cod = (f.get('CODIGO') or '').strip().upper()
        cod_real, _ = CM.codigo_de_la_fila(dict(f, CODIGO='', CODIGO_VAR=''), idx,
                                           ctx['pinta'], ctx['conocidos'])
        if cod_real:
            continue
        if cod and cod in idx['por_codigo'] and otra_capacidad(f, cod, idx):
            if mismo_modelo(f, cod, idx):
                continue                   # misma foto: no es un problema (Pedro, 26/09)
            yield {'id': f['ID'], 'desc': _desc(f), 'hoy': cod,
                   'poner': 'es de: ' + idx['por_codigo'][cod][0]['Producto'][:40],
                   'clave': cod, 'candidato': candidato(f, ctx)}
        elif not cod:
            # Las que esperan una respuesta de ADVAPP (preguntas-advapp.json con
            # espera_codigo): los Ray-Ban GAF-RAY-049/050/056 figuraban todos
            # los dias como "esperan que les demos codigo" y no dependia de
            # nosotros (29/09). Solo mientras el nombre siga igual: ADVAPP
            # reusa IDs, y si contesta cambiando el nombre la fila vuelve sola.
            espera = esperan.get(f['ID'])
            if espera and espera == CM.norm(_desc(f)):
                continue
            yield {'id': f['ID'], 'desc': _desc(f), 'hoy': '(vacio)',
                   'poner': 'alta o vinculo', 'clave': '', 'candidato': candidato(f, ctx)}


@regla('COLOR NUEVO SIN REGISTRAR EN EL MAESTRO',
       'La fila es de un producto que ya tiene codigo, pero ese color no esta en el maestro: '
       'no tiene AT-####-NN y por eso no puede tener foto propia. Primero mirar si es otra '
       'forma de escribir una variante que ya esta (va a Escrituras y NO estrena numero: '
       'Lime/lima, Pistachio/Pistacho, Natural/Natural Titanium). Si es un color nuevo de '
       'verdad, se registra con herramientas/altas-catalogo.py mirando la lista: nunca '
       '--aplicar a ciegas. Despues falta producir la foto AT-####-NN.jpg.',
       'ese color sale sin foto propia.', donde='nosotros')
def r_color_sin_registrar(filas, ctx):
    # La revision diaria no corria altas-catalogo.py y ninguna otra herramienta
    # avisaba de un color que el maestro no conoce: r_variante se lo saltea,
    # verificar-fotos solo mira variantes que existen. El 29/09 eran ~33, y
    # cada dia habia mas fichas sin imagen sin que nadie se entere.
    idx = ctx['idx']
    vistos = set()
    for f in filas:
        cod, _ = CM.codigo_de_la_fila(f, idx, ctx['pinta'], ctx['conocidos'])
        if not cod or cod not in idx['por_codigo']:
            continue
        var_col = (f.get('CODIGO_VAR') or '').strip().upper()
        # Un CODIGO_VAR de otro producto lo pide r_var_de_otro: registrar el
        # color aca seria meterlo en el producto equivocado (Ocean Band, 29/09).
        if var_col and var_col != cod and not var_col.startswith(cod + '-'):
            continue
        for c in validar.partir_colores(validar.limpio(f.get('Color') or '')):
            if CM.variante_de(cod, c, idx) or CM.variante_por_partes(cod, c, idx):
                continue
            k = cod + '|' + CM.norm(c)
            if k in vistos:
                continue
            vistos.add(k)
            yield {'id': f['ID'], 'desc': _desc(f), 'hoy': c, 'poner': 'color de ' + cod,
                   'clave': k, 'candidato': _parecida(cod, c, var_col, idx)}


def _parecida(cod, color, var_col, idx):
    """Una variante que ya esta y quizas es la misma escrita distinto. Es una
    sugerencia para la persona que decide, no una decision."""
    if var_col.startswith(cod + '-') and var_col in idx['por_var']:
        return '%s "%s": ADVAPP ya le pone ese codigo; otra forma de escribirlo?' % (
            var_col, idx['por_var'][var_col].get('Variante', ''))
    import difflib
    kc = re.sub(r'[^a-z]', '', CM.norm(color))
    for f in idx['por_codigo'].get(cod) or []:
        if (f.get('Baja') or '').strip():
            continue
        for e in CM.escrituras_de(f):
            ke = re.sub(r'[^a-z]', '', e)
            if len(ke) < 3 or len(kc) < 3:
                continue
            if (ke.startswith(kc) or kc.startswith(ke)
                    or difflib.SequenceMatcher(None, kc, ke).ratio() >= 0.8
                    or (kc[:3] == ke[:3] and abs(len(kc) - len(ke)) <= 1)):
                return '%s "%s": otra forma de escribirlo?' % (f['CODIGO_VAR'], f.get('Variante', ''))
    return 'ninguna parecida: color nuevo'


@regla('PREGUNTAS QUE NO SALEN DE UNA REGLA',
       'Cosas que ninguna regla puede medir sola (una referencia de fabrica, un color que '
       'no existe para ese modelo, como calculan el ETag). Estan en herramientas/'
       'preguntas-advapp.json y salen aca hasta que se anota la respuesta.',
       'depende de cada pregunta.', donde='pregunta')
def r_preguntas(filas, ctx):
    for q in ctx.get('preguntas') or []:
        if (q.get('respondida') or '').strip():
            continue
        ids = [x.get('ID') for x in (q.get('filas') or []) if x.get('ID')]
        yield {'id': q['id'], 'desc': ', '.join(ids) if ids else '(general)',
               'hoy': 'anotada el ' + fecha(q['fecha']),
               'poner': '? (abajo)', 'clave': q['id'],
               'detalle': q['pregunta'] + ((' Ya lo preguntamos %s.' % q['antes']) if q.get('antes') else '')}


def candidato(f, ctx):
    """El producto del maestro que mas se parece: misma marca, misma
    capacidad, nombre sin colores. Es una sugerencia para la persona que
    decide (vinculo o alta), no una decision."""
    idx, pinta, con = ctx['idx'], ctx['pinta'], ctx['conocidos']
    cap = capacidad(_desc(f))
    d = CM.sin_los_colores(_desc(f), pinta, con)
    mejor = None
    for cod, fs in idx['por_codigo'].items():
        e = fs[0]
        if CM.norm(e.get('Marca')) != CM.norm(f.get('Marca')) or (e.get('Baja') or '').strip():
            continue
        if cap and capacidad(e.get('Producto')) not in (cap,):
            continue
        s = CM.parecido(d, CM.sin_los_colores(e.get('Producto', ''), pinta, con))
        if not mejor or s > mejor[0]:
            mejor = (s, cod, e.get('Producto', ''))
    if mejor and mejor[0] >= 0.6:
        return '%s %s (%d%%)' % (mejor[1], mejor[2][:44], mejor[0] * 100)
    return 'ninguno parecido: seria un alta'


# ---------------------------------------------------------------- registro

class ArchivoDanado(Exception):
    """El registro o las preguntas no se pueden leer: no se arma el pedido."""


def leer_registro(ruta=None):
    """El registro de lo enviado. Si no existe es la primera corrida y vale.

    Si existe y no se puede leer, NO se sigue con uno vacio (29/09): con un
    marcador de conflicto de merge adentro el borrador salia "64 nuevos, 0 ya
    pedidos" sin una advertencia, y --enviado pisaba las fechas de todo lo
    mandado el 21 y el 26/09. Se frena con 2 (1 ya quiere decir "hay nuevos")."""
    ruta = ruta or REGISTRO
    try:
        with open(ruta, encoding='utf-8') as fh:
            reg = json.load(fh)
    except FileNotFoundError:
        return {'enviados': {}}
    except (OSError, ValueError) as e:
        raise ArchivoDanado('REGISTRO DANADO: %s no se puede leer (%s). No se arma el pedido '
                            'para no mandar todo como nuevo. Recuperalo con:  git show '
                            'HEAD:herramientas/%s' % (os.path.basename(ruta), e, os.path.basename(ruta)))
    if not isinstance(reg, dict) or not isinstance(reg.get('enviados', {}), dict):
        raise ArchivoDanado('REGISTRO DANADO: %s no tiene la forma {"enviados": {...}}. Recuperalo '
                            'con:  git show HEAD:herramientas/%s' % (os.path.basename(ruta),
                                                                     os.path.basename(ruta)))
    reg.setdefault('enviados', {})
    return reg


def guardar_registro(reg, ruta=None):
    """Se escribe a un temporal y se reemplaza: cortado a la mitad, el
    registro queda como estaba y no a medio escribir."""
    ruta = ruta or REGISTRO
    tmp = ruta + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as fh:
        json.dump(reg, fh, ensure_ascii=False, indent=1, sort_keys=True)
    os.replace(tmp, ruta)


def leer_preguntas(ruta=None):
    """Las preguntas a mano (herramientas/preguntas-advapp.json). Sin archivo
    no hay preguntas; con el archivo roto se frena igual que con el registro:
    seguir sin ellas haria que --enviado las diera por respondidas."""
    ruta = ruta or PREGUNTAS
    try:
        with open(ruta, encoding='utf-8') as fh:
            datos = json.load(fh)
    except FileNotFoundError:
        return []
    except (OSError, ValueError) as e:
        raise ArchivoDanado('PREGUNTAS DANADAS: %s no se puede leer (%s). Arreglalo o '
                            'recuperalo con:  git show HEAD:herramientas/%s'
                            % (os.path.basename(ruta), e, os.path.basename(ruta)))
    qs = datos.get('preguntas') if isinstance(datos, dict) else None
    if not isinstance(qs, list):
        raise ArchivoDanado('PREGUNTAS DANADAS: %s no tiene la lista "preguntas".' % os.path.basename(ruta))
    vistos = set()
    for q in qs:
        falta = [c for c in ('id', 'fecha', 'pregunta') if not (isinstance(q, dict) and str(q.get(c) or '').strip())]
        if falta:
            raise ArchivoDanado('PREGUNTAS DANADAS: una pregunta no tiene %s.' % ', '.join(falta))
        try:
            datetime.date.fromisoformat(q['fecha'])
        except ValueError:
            raise ArchivoDanado('PREGUNTAS DANADAS: %s tiene la fecha "%s" (va AAAA-MM-DD).'
                                % (q['id'], q['fecha']))
        if q['id'] in vistos:
            raise ArchivoDanado('PREGUNTAS DANADAS: el id %s esta repetido.' % q['id'])
        vistos.add(q['id'])
    return qs


def esperan_de(preguntas):
    """ID -> nombre normalizado, de las filas que esperan una respuesta."""
    salida = {}
    for q in preguntas:
        if q.get('espera_codigo') and not (q.get('respondida') or '').strip():
            for x in q.get('filas') or []:
                if x.get('ID') and x.get('nombre'):
                    salida[x['ID']] = CM.norm(x['nombre'])
    return salida


def clave_punto(r, p):
    return '%s|%s|%s' % (r['nombre'], p['id'], p['clave'])


def fecha(iso):
    d = datetime.date.fromisoformat(iso)
    return d.strftime('%d/%m')


def anotar_enviados(enviados, hallados, claves_hoy, omitidas, cuando):
    """Lo que hace --enviado sobre el registro (aparte, para poder probarlo).

    Un punto que estaba arreglado y hoy se vuelve a mandar pasa su par
    {enviado, arreglado} al historial y queda como pedido hoy (29/09): con
    setdefault seguia diciendo "arreglado" aunque estuviera roto otra vez, y
    si lo volvian a arreglar no figuraba en "ya arreglaron"."""
    for _, p, k in hallados:
        v = enviados.get(k)
        if v is None:
            enviados[k] = {'enviado': cuando, 'id': p['id']}
        elif v.get('arreglado'):
            v.setdefault('historial', []).append({'enviado': v['enviado'], 'arreglado': v.pop('arreglado')})
            v['enviado'] = cuando
    # lo que se pidio y ya no aparece queda como arreglado (con la fecha del
    # envio, no la de hoy: --fecha tiene que valer para las dos cosas)
    for k, v in enviados.items():
        if k not in claves_hoy and k not in omitidas and not v.get('arreglado'):
            v['arreglado'] = cuando
    return enviados


# ---------------------------------------------------------------- armado

def escribir_nuestros(nuestros):
    L = ['LO QUE TENEMOS QUE RESOLVER NOSOTROS - %s' % HOY.strftime('%d/%m/%Y'),
         'Armado por herramientas/pedido-advapp.py. No va a ADVAPP: primero hay que '
         'decidirlo nosotros.', '']
    for r in [x for x in REGLAS if x['donde'] == 'nosotros']:
        pts = [p for rr, p, _ in nuestros if rr is r]
        L += ['', '%s - %d fila%s' % (r['titulo'], len(pts), '' if len(pts) == 1 else 's'),
              '-' * 68]
        L += textwrap.wrap(r['explicacion'], 88) + ['']
        for p in sorted(pts, key=lambda x: x['id']):
            L.append('  %-40s %-9s %s' % (p['id'], p['hoy'], p['poner']))
            L.append('  %-40s %s' % ('', p['desc'][:70]))
            if p.get('candidato'):
                L.append('  %-40s candidato: %s' % ('', p['candidato']))
    with open(NUESTROS, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(L) + '\n')
    # El total va primero y con la misma forma de siempre: la revision
    # diaria lo lee ("Pendientes nuestros: N").
    cuenta = collections.Counter(r['nombre'] for r, _, _ in nuestros)
    print('Pendientes nuestros: %d (codigos: %d, colores sin registrar: %d) (en %s)'
          % (len(nuestros), cuenta['r_sin_codigo_propio'], cuenta['r_color_sin_registrar'],
             os.path.relpath(NUESTROS, RAIZ)))


def correr_reglas(filas, ctx):
    hallados = []                       # (regla, punto, clave)
    omitidas = set()                    # siguen pasando, pero por criterio no se piden
    for r in REGLAS:
        vistos = set()
        for p in r['fn'](filas, ctx):
            k = clave_punto(r, p)
            if k in vistos:
                continue
            vistos.add(k)
            if p.get('omitir'):
                omitidas.add(k)
                continue
            hallados.append((r, p, k))
    return hallados, omitidas


# ---------------------------------------------------------------- correcciones
#
# Desde el 01/10/2026 ADVAPP lo manejamos nosotros (Benja: "VOS MANEJAS
# ADVAPP"): el pedido ya no es un texto para que lo cargue otro equipo. Lo que
# tiene una respuesta cierta sale ademas como datos, en CORRECCIONES-ADVAPP.json,
# y se aplica desde ADVAPP (Padron -> Correcciones de la auditoria) con la
# sesion de quien lo revisa: primero muestra cada cambio, despues lo aplica.
#
# Solo entra lo que no es una pregunta: codigos del maestro, la categoria del
# prefijo del SKU, erratas con su forma correcta, siglas y colores escritos
# distinto. Lo que lleva "?" sigue siendo una pregunta y queda en el texto.
# Cada cambio lleva el valor de hoy ("antes"): si alguien lo toco despues de la
# auditoria, ADVAPP no lo pisa.
SALIDA_JSON = os.path.join(RAIZ, 'CORRECCIONES-ADVAPP.json')
RE_AT = re.compile(r'AT-\d{4}(?:-\d{2})?')


def _arreglar_nombre(desc, punto, regla):
    if regla == 'r_siglas':
        malas = [x.strip() for x in punto['hoy'].split(',') if x.strip()]
        out = desc
        for m in malas:
            out = re.sub(r'(?<![A-Za-z])%s(?![A-Za-z])' % re.escape(m), m.upper(), out)
        return out
    patron = punto['clave'].split('|', 1)[1]
    bien = punto['poner'].split(' (', 1)[0]
    if bien.startswith('sin "') or bien == 'sacarlo del nombre':
        return re.sub(r'\s{2,}', ' ', re.sub(patron, ' ', desc)).strip()
    if '<' in bien:
        return None                           # "F/<numero>": no se sabe cual
    return re.sub(patron, bien, desc)


def correcciones_de(hallados, filas):
    por_id = {f['ID']: f for f in filas}
    out = collections.OrderedDict()
    for r, p, k in hallados:
        f = por_id.get(p['id'])
        if not f or str(p.get('poner', '')).startswith('?'):
            continue
        nombre = r['nombre']
        cambios = {}
        if nombre in ('r_codigo', 'r_variante', 'r_var_de_otro'):
            ats = RE_AT.findall(p['poner'])
            if not ats:
                continue
            cambios['codigo'] = ats[0].split('-')[0] + '-' + ats[0].split('-')[1]
            if len(ats) > 1:
                cambios['codigo_var'] = ats[1]
        elif nombre == 'r_categoria':
            m = re.match(r'Categoria (.+?) \(como', p['poner'])
            if m:
                cambios['categoria'] = m.group(1)
        elif nombre in ('r_erratas', 'r_siglas'):
            actual = (out.get(p['id'], {}).get('cambios', {}).get('nombre')) or _desc(f)
            nuevo = _arreglar_nombre(actual, p, nombre)
            if nuevo and nuevo != actual:
                cambios['nombre'] = nuevo
        elif nombre == 'r_color_escrito':
            viejo = p['hoy'][len('Color "'):-1]
            bien = p['poner'].split(' (', 1)[0]
            color = (f.get('Color') or '').strip()
            if bien and bien != viejo and color:
                cambios['color'] = color.replace(viejo, bien)
                d = (out.get(p['id'], {}).get('cambios', {}).get('nombre')) or _desc(f)
                if '(%s)' % viejo in d:
                    cambios['nombre'] = d.replace('(%s)' % viejo, '(%s)' % bien)
        if not cambios:
            continue
        x = out.setdefault(p['id'], {'id': p['id'], 'producto': _desc(f), 'cambios': {}, 'antes': {}, 'reglas': []})
        campos = {'codigo': 'CODIGO', 'codigo_var': 'CODIGO_VAR', 'categoria': 'Categoría',
                  'nombre': 'Descripción completa', 'color': 'Color'}
        for c, v in cambios.items():
            x['antes'].setdefault(c, (f.get(campos[c]) or '').strip())
            x['cambios'][c] = v
        if r['titulo'] not in x['reglas']:
            x['reglas'].append(r['titulo'])
    lista = [x for x in out.values() if any(x['cambios'][c] != x['antes'][c] for c in x['cambios'])]
    return lista


# Lo que confirmo Pedro (01/10/2026). La auditoria encuentra lo que se puede
# deducir de los datos; hay correcciones que sólo él sabe (un Redmi que es 4G
# aunque el nombre diga 5G, un S25 Ultra de 12 GB que dice 16). Esas se anotan
# en herramientas/correcciones-confirmadas.json y salen en el mismo archivo
# que se aplica desde ADVAPP, con el valor de hoy como "antes" (ADVAPP no pisa
# lo que alguien cambió después). Cuando ADVAPP ya dice lo mismo, dejan de
# salir solas: no hay que borrarlas a mano.
CONFIRMADAS = os.path.join(AQUI, 'correcciones-confirmadas.json')
CAMPOS_ADVAPP = {'codigo': 'CODIGO', 'codigo_var': 'CODIGO_VAR', 'categoria': 'Categoría',
                 'nombre': 'Descripción completa', 'color': 'Color'}


def leer_confirmadas(ruta=None):
    ruta = ruta or CONFIRMADAS
    if not os.path.exists(ruta):
        return []
    try:
        d = json.load(open(ruta, encoding='utf-8'))
    except ValueError as e:
        raise ArchivoDanado('%s está dañado: %s' % (os.path.relpath(ruta, RAIZ), e))
    lista = d.get('correcciones') if isinstance(d, dict) else None
    if not isinstance(lista, list):
        raise ArchivoDanado('%s no trae la lista "correcciones"' % os.path.relpath(ruta, RAIZ))
    for c in lista:
        if not isinstance(c, dict) or not c.get('id') or not isinstance(c.get('cambios'), dict) \
                or any(k not in CAMPOS_ADVAPP for k in c['cambios']) or not c.get('motivo'):
            raise ArchivoDanado('%s: cada corrección lleva id, cambios (%s) y motivo: %r'
                                % (os.path.relpath(ruta, RAIZ), ', '.join(CAMPOS_ADVAPP), c))
    return lista


def sumar_confirmadas(lista, filas, confirmadas):
    """Las confirmadas que ADVAPP todavía no tiene, sumadas a las de la
    auditoría (en la misma corrección si es el mismo producto). Devuelve la
    lista y cuántas ya estaban aplicadas."""
    por_id = {f['ID']: f for f in filas}
    out = collections.OrderedDict((x['id'], x) for x in lista)
    aplicadas = 0
    for c in confirmadas:
        f = por_id.get(c['id'])
        if not f:
            continue
        pend = {k: v for k, v in c['cambios'].items() if (f.get(CAMPOS_ADVAPP[k]) or '').strip() != v}
        if not pend:
            aplicadas += 1
            continue
        x = out.setdefault(c['id'], {'id': c['id'], 'producto': _desc(f), 'cambios': {}, 'antes': {}, 'reglas': []})
        for k, v in pend.items():
            x['antes'].setdefault(k, (f.get(CAMPOS_ADVAPP[k]) or '').strip())
            x['cambios'][k] = v
        regla = 'Confirmado: ' + c['motivo']
        if regla not in x['reglas']:
            x['reglas'].append(regla)
    return list(out.values()), aplicadas


def escribir_correcciones(lista, man):
    with open(SALIDA_JSON, 'w', encoding='utf-8') as fh:
        json.dump({'armado': HOY.isoformat(), 'contra': man.get('generado_en') or '',
                   'correcciones': lista}, fh, ensure_ascii=False, indent=1)
    print('Correcciones aplicables desde ADVAPP: %d productos (en %s)'
          % (len(lista), os.path.relpath(SALIDA_JSON, RAIZ)))


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    if '--probar' in sys.argv:
        return probar()
    # Primero lo nuestro: si el registro o las preguntas estan danados no se
    # baja nada ni se escribe nada.
    try:
        reg = leer_registro()
        preguntas = leer_preguntas()
    except ArchivoDanado as e:
        print(e)
        return 2
    # Solo ADVAPP, sin la planilla de respaldo (29/09). Con ADVAPP caido,
    # bajar_csv() devolvia la planilla del 22/09: el borrador salia "contra la
    # carga de ADVAPP (583 filas)" con 36 nuevos inventados y 76 "ya
    # arreglaron" falsos, y --enviado los grababa para siempre. bajar_advapp
    # tambien rechaza una carga cortada (menos filas que las que declara).
    try:
        filas = [f for f in validar.bajar_advapp() if (f.get('ID') or '').strip()]
    except Exception as e:
        print('ADVAPP no contesto (%s): no se arma el pedido ni se anota --enviado. '
              'PEDIDO-ADVAPP.txt, PENDIENTES-NUESTROS.txt y el registro quedan como estaban.' % e)
        return 2
    maestro = CM.leer()
    ctx = {'idx': CM.indexar(maestro), 'pinta': validar.pinta,
           'conocidos': validar.leer_index()[0], 'preguntas': preguntas,
           'esperan': esperan_de(preguntas)}
    enviados = reg.get('enviados', {})
    man = validar.FUENTE.get('manifiesto') or {}

    hallados, omitidas = correr_reglas(filas, ctx)
    # Lo que se resuelve de nuestro lado no va en el pedido: se escribe aparte.
    nuestros = [h for h in hallados if h[0]['donde'] == 'nosotros']
    hallados = [h for h in hallados if h[0]['donde'] != 'nosotros']
    escribir_nuestros(nuestros)
    claves_hoy = {k for _, _, k in hallados}

    if '--enviado' in sys.argv or '--enviado-ids' in sys.argv:
        # --enviado-ids ID1,ID2: se mando solo lo de esas filas (un pedido
        # armado a mano, o una parte del borrador). Sin lista: todo.
        solo = None
        if '--enviado-ids' in sys.argv:
            solo = set(sys.argv[sys.argv.index('--enviado-ids') + 1].split(','))
        cuando = HOY.isoformat()
        if '--fecha' in sys.argv:
            cuando = sys.argv[sys.argv.index('--fecha') + 1]
        hallados = [h for h in hallados if solo is None or h[1]['id'] in solo]
        reg['enviados'] = anotar_enviados(enviados, hallados, claves_hoy, omitidas, cuando)
        guardar_registro(reg)
        print('Anotado: %d puntos enviados el %s (carga de ADVAPP de %d filas, generada %s).'
              % (len(hallados), fecha(cuando), len(filas), man.get('generado_en') or '?'))
        return 0

    nuevos = [h for h in hallados if h[2] not in enviados]
    volvieron = [h for h in hallados if h[2] in enviados and enviados[h[2]].get('arreglado')]
    arreglados = [(k, v) for k, v in enviados.items()
                  if k not in claves_hoy and k not in omitidas and not v.get('arreglado')]

    L = []
    L.append('[BORRADOR] Armado por herramientas/pedido-advapp.py el %s contra la carga '
             'de ADVAPP (%d filas, generada %s).' % (HOY.strftime('%d/%m/%Y'), len(filas),
                                                     man.get('generado_en') or '?'))
    L.append('Cuando se mande: python3 herramientas/pedido-advapp.py --enviado')
    L.append('')
    L.append('')
    L.append('Advance Tecno al equipo de ADVAPP - %s' % HOY.strftime('%d/%m/%Y'))
    L.append('=' * 68)
    siguen = len(hallados) - len(nuevos) - len(volvieron)
    L.append('%d puntos: %d nuevos%s y %d que ya les habiamos pedido y siguen igual.'
             % (len(hallados), len(nuevos),
                (', %d que habian arreglado y volvieron' % len(volvieron)) if volvieron else '', siguen))
    L.append('Como siempre, son reglas para el parser, no celdas: la carga de manana '
             'reescribe la hoja.')
    L.append('Donde dice "?" es una pregunta: no sabemos cual de los dos datos esta bien.')
    n = 0
    por_regla = collections.OrderedDict()
    for r, p, k in hallados:
        por_regla.setdefault(r['nombre'], (r, []))[1].append((p, k))
    for nombre, (r, pts) in por_regla.items():
        n += 1
        L.append('')
        L.append('')
        L.append('%d) %s - %d fila%s' % (n, r['titulo'], len(pts), '' if len(pts) == 1 else 's'))
        L.append('-' * 68)
        L.append(r['explicacion'])
        L.append('Que ve el cliente: ' + r['ve'])
        L.append('')
        ancho = min(40, max(len(p['id']) for p, _ in pts))
        L.append('  %-*s  %-26s  %s' % (ancho, 'ID (ficha)', 'hoy', 'tendria que ser'))
        for p, k in sorted(pts, key=lambda x: x[0]['id']):
            ya = enviados.get(k)
            if not ya:
                marca = '   NUEVO'
            elif ya.get('arreglado'):
                marca = '   VOLVIO (arreglado el %s, pedido el %s)' % (fecha(ya['arreglado']),
                                                                    fecha(ya['enviado']))
            else:
                marca = '   (pedido el %s)' % fecha(ya['enviado'])
            L.append('  %-*s  %-26s  %s%s' % (ancho, p['id'], p['hoy'][:26], p['poner'], marca))
            L.append('  %-*s  %s' % (ancho, '', p['desc'][:70]))
            for linea in textwrap.wrap(p.get('detalle') or '', 88 - ancho):
                L.append('  %-*s  %s' % (ancho, '', linea))
    if arreglados:
        L.append('')
        L.append('')
        L.append('LO QUE YA ARREGLARON - gracias (%d)' % len(arreglados))
        L.append('-' * 68)
        for k, v in sorted(arreglados):
            L.append('  %s   (pedido el %s)' % (k.split('|')[1], fecha(v['enviado'])))
    with open(SALIDA, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(L) + '\n')
    try:
        confirmadas = leer_confirmadas()
    except ArchivoDanado as e:
        print(e)
        confirmadas = []
    lista, ya = sumar_confirmadas(correcciones_de(hallados, filas), filas, confirmadas)
    if confirmadas:
        print('Confirmadas por Pedro: %d pendientes de aplicar, %d ya aplicadas en ADVAPP'
              % (len(confirmadas) - ya, ya))
    escribir_correcciones(lista, man)

    print('Pedido a ADVAPP: %d puntos (%d nuevos, %d ya pedidos), %d arreglados desde el ultimo envio.'
          % (len(hallados), len(nuevos), len(hallados) - len(nuevos), len(arreglados)))
    # Linea propia para la revision diaria: un punto que vuelve no es
    # "nuevo" (seria mentirle a ADVAPP) pero hay que avisarlo igual.
    print('Volvieron: %d' % len(volvieron))
    print('Quedo en %s' % os.path.relpath(SALIDA, RAIZ))
    for nombre, (r, pts) in por_regla.items():
        print('  %-44s %3d' % (r['titulo'][:44], len(pts)))
    return 1 if (nuevos or volvieron) else 0


# ---------------------------------------------------------------- prueba

def probar():
    """Casos armados a mano, sin red y sin tocar ningun archivo del repo: que
    cada regla nueva vea su caso y no vea el que no es, y que el registro
    danado, ADVAPP caido y un punto que vuelve se manejen como corresponde."""
    import tempfile
    global SALIDA, NUESTROS, REGISTRO, PREGUNTAS
    fallas = []

    def ok(c, txt):
        print(('  OK  ' if c else 'FALLA ') + txt)
        if not c:
            fallas.append(txt)

    def m(cod, var, prod, variante='', escr='', marca='Apple', cat='Celular'):
        return {'CODIGO': cod, 'CODIGO_VAR': var, 'Producto': prod, 'Variante': variante,
                'Escrituras': escr, 'NumVar': var[-2:] if var != cod else '', 'Marca': marca,
                'Categoria': cat}

    def fila(i, desc, color='', precio='100', cod='', var='', sku='', sv='', grupo='', **k):
        f = {'ID': i, 'Descripción completa': desc, 'Color': color, 'Precio USD': precio,
             'CODIGO': cod, 'CODIGO_VAR': var, 'SKU': sku, 'SKU_VARIANTE': sv, 'Grupo': grupo,
             'Marca': k.pop('marca', 'Apple'), 'Categoría': k.pop('cat', 'Celular'),
             'Stock': 'Sí', 'SKUS': '[]'}
        f.update(k)
        return f

    maestro = [
        m('AT-0455', 'AT-0455-01', 'Watch Ultra 3 49mm (Black)', 'Black'),
        m('AT-0455', 'AT-0455-06', 'Watch Ultra 3 49mm (Black)', 'Black Ocean Band',
          'black – black ocean band'),
        m('AT-0456', 'AT-0456-01', 'Watch Ultra 3 49mm (Black Milanese Loop)', 'Black'),
        m('AT-0086', 'AT-0086-01', 'Galaxy A56 12/256GB (Black)', 'Black', marca='Samsung'),
        m('AT-0087', 'AT-0087-01', 'Galaxy A56 8/256GB (Black)', 'Black', marca='Samsung'),
        m('AT-0511', 'AT-0511-02', 'Galaxy A36 6/128GB (lima)', 'lima', marca='Samsung'),
    ]
    idx = CM.indexar(maestro)
    ctx = {'idx': idx, 'pinta': validar.pinta, 'conocidos': {'black', 'white', 'gray', 'blue'},
           'preguntas': [], 'esperan': {}}

    # 1) El codigo de color de otro producto (Watch Ultra 3 Ocean, 29/09)
    oc = fila('SWT-OCEAN', 'Watch Ultra 3 49mm (Black – Black Ocean Band)', 'Black – Black Ocean Band',
              cod='AT-0456', var='AT-0455-01', SKUS=json.dumps([{'sku': 'x', 'at': 'AT-0455-01'}, {'at': None}]))
    pts = list(r_var_de_otro([oc], ctx))
    ok(len(pts) == 1 and pts[0]['poner'] == 'AT-0455  AT-0455-06',
       'el CODIGO_VAR de otro producto se pide, con el color del producto que lo reconoce')
    ok(not list(r_var_de_otro([fila('X', 'Watch', 'Black', cod='AT-0455', var='AT-0455-01')], ctx)),
       'un CODIGO_VAR que empieza con su CODIGO no se pide')
    # 2) La omision "misma foto" exige memoria distinta
    ok(not mismo_modelo(oc, 'AT-0455', idx),
       'dos relojes que difieren en la malla no pasan como "otra capacidad"')
    a56 = fila('A56', 'Galaxy A56 8GB/256GB (Black)', 'Black', marca='Samsung')
    ok(mismo_modelo(a56, 'AT-0086', idx), 'el A56 8/256 con el codigo del 12/256 sigue omitido (Pedro, 26/09)')
    # 3) El precio de otra memoria (S26 FE 8/512 Pistachio a 730, 29/09)
    g = 'celular~samsung~fe-galaxy-s26'
    fe = [fila('128P', 'Galaxy S26 FE 8GB/128GB (Pistachio)', 'Pistachio', '730', 'AT-0097', grupo=g),
          fila('512B', 'Galaxy S26 FE 8GB/512GB (Blueberry)', 'Blueberry', '980', 'AT-0099', grupo=g),
          fila('512G', 'Galaxy S26 FE 8GB/512GB (Graphite)', 'Graphite', '980', 'AT-0099', grupo=g),
          fila('512P', 'Galaxy S26 FE 8GB/512GB (Pistachio)', 'Pistachio', '730', 'AT-0097', grupo=g)]
    pts = list(r_precio_de_otra_capacidad(fe, ctx))
    ok([p['id'] for p in pts] == ['512P'], 'se pregunta la fila con el precio de otra memoria, y solo esa')
    ok(pts and pts[0]['poner'].startswith('?') and 'CODIGO AT-0097' in pts[0].get('detalle', ''),
       'como pregunta, sin proponer un precio, y avisando el codigo copiado')
    fam = [fila('1', 'Moto G06 4/64GB (Blue)', 'Blue', '175', grupo='g06'),
           fila('2', 'Moto G06 4/256GB (Oak)', 'Oak', '175', grupo='g06')]
    pts = list(r_precio_de_otra_capacidad(fam, ctx))
    ok(len(pts) == 1 and pts[0]['clave'].startswith('familia|'),
       'la memoria mayor al mismo precio sin clon va como UN punto por familia')
    # 4) Mismo SKU con una fila sin color (iPad Pro M4 512, 29/09)
    ip = [fila('SBK', 'iPad Pro M4 11" 512GB (Space Black)', 'Space Black', '1120', sku='ipad-512'),
          fila('046', 'iPad Pro M4 11" 512gb', '', '1320', sku='ipad-512')]
    pts = list(r_fila_sin_color(ip, ctx))
    ok(len(pts) == 1 and pts[0]['id'] == '046' and 'USD 1120 o USD 1320' in pts[0]['poner'],
       'la fila sin color con el mismo SKU se pregunta, con los dos precios')
    # 5) La gama del SKU que el nombre no dice (Tab A11+, 29/09)
    tab = fila('TAB', 'Galaxy Tab A11 6GB/128GB (Gray)', 'Gray', sv='TAB-SAM-TABA11PLUS-6G128-GRY-WIFI',
               Modelo='Galaxy Tab A11+')
    ok(any(p['clave'] == 'gama|plus' for p in r_nombre([tab], ctx)), 'el SKU dice PLUS y el nombre no: se pregunta')
    ok(not any(p['clave'].startswith('gama') for p in r_nombre(
        [fila('ACM', 'Adaptador EF-EOS R', sv='ACM-CAN-EFEOSR-000-000-000')], ctx)),
       '"FE" adentro de EFEOSR no es la gama')
    # 6) Categoria contra el prefijo del SKU (drones, 29/09)
    dr = [fila('D%d' % i, 'Drone %d' % i, sv='DRN-DJI-X%d' % i, cat='Drone') for i in range(4)]
    dr.append(fila('ACC', 'Drone DJI Air 3S + Fly More Combo', sv='DRN-DJI-AIR3S', cat='Accesorio Drone'))
    pts = list(r_categoria(dr, ctx))
    ok([p['id'] for p in pts] == ['ACC'] and 'Drone' in pts[0]['poner'], 'un drone cargado como accesorio se pide')
    # 7) Colores, siglas, erratas, terminos
    cols = [fila('a', 'x', 'gray', grupo='t'), fila('b', 'x', 'Gray', grupo='t'),
            fila('c', 'x', 'negro', grupo='e'), fila('d', 'x', 'Skyblue', grupo='air'),
            fila('e', 'x', 'Sky Blue', grupo='air'), fila('f', 'x', 'Dark Blue', grupo='z')]
    pts = {p['id']: p['poner'] for p in r_color_escrito(cols, ctx)}
    ok(pts.get('a', '').startswith('Gray') and pts.get('c', '').startswith('? Black')
       and pts.get('d', '').startswith('Sky Blue') and 'e' not in pts and 'f' not in pts and 'b' not in pts,
       'colores: minuscula, castellano y escrito distinto que la hermana', )
    ok([p['poner'] for p in r_siglas([fila('m', 'Mag 272F | Msi (Flat Rapid Ips · Hdr)')], ctx)] ==
       ['MAG, MSI, IPS, HDR'], 'las siglas en Tipo Titulo se piden en mayuscula')
    ok(not list(r_siglas([fila('p', 'iPhone 16 Pro Max 256GB (Natural)')], ctx)), 'Pro Max no es una sigla')
    ok(any('Goggles' in p['poner'] for p in r_erratas([fila('g', 'Googles 2')], ctx)), 'la errata conocida se pide')
    t = fila('t', 'iPhone 17 256GB E-Sim (Blue)', **{'Términos de búsqueda': 'iphone 17 air 256gb',
                                                     'Modelo': 'iPhone 17'})
    ok([p['clave'] for p in r_terminos([t], ctx)] == ['terminos|air'], 'un termino de busqueda de otra gama se pregunta')
    ok(not list(r_terminos([fila('u', 'iPhone Air 256GB', **{'Términos de búsqueda': 'iphone 17 air'})], ctx)),
       'la gama que el nombre dice no se pregunta')
    # 8) Color sin registrar: con la variante parecida como sugerencia
    lim = fila('LIM', 'Galaxy A36 6/128GB (Lime)', 'Lime', cod='AT-0511', var='AT-0511-02', marca='Samsung')
    pts = list(r_color_sin_registrar([lim, oc], ctx))
    ok(len(pts) == 1 and pts[0]['id'] == 'LIM' and 'AT-0511-02' in pts[0]['candidato'],
       'color sin registrar: sugiere la variante que ADVAPP ya le pone, y no toma el Ocean')
    # 9) Ray-Ban que esperan respuesta: fuera de pendientes mientras el nombre siga igual
    rb = fila('GAF-RAY-049', 'Metaverse / Smart Glasses — Wayfarer', marca='Ray-Ban')
    ctx2 = dict(ctx, esperan=esperan_de([{'id': 'P', 'fecha': '2026-09-29', 'pregunta': 'x', 'espera_codigo': True,
                                           'filas': [{'ID': 'GAF-RAY-049', 'nombre': rb['Descripción completa']}]}]))
    ok(not list(r_sin_codigo_propio([rb], ctx2)), 'la fila que espera respuesta de ADVAPP no va a pendientes nuestros')
    rb2 = dict(rb, **{'Descripción completa': 'Meta Wayfarer (RW4006)'})
    ok(len(list(r_sin_codigo_propio([rb2], ctx2))) == 1, 'si ADVAPP le cambia el nombre, vuelve a pendientes')

    # 10) Registro: danado frena, ausente arranca vacio, se escribe entero
    tmp = tempfile.mkdtemp(prefix='pedido-probar-')
    r1 = os.path.join(tmp, 'reg.json')
    ok(leer_registro(r1) == {'enviados': {}}, 'sin registro es la primera corrida')
    with open(r1, 'w', encoding='utf-8') as fh:
        fh.write('<<<<<<< HEAD\n{"enviados": {}}\n=======\n')
    try:
        leer_registro(r1)
        ok(False, 'un registro con marcadores de merge frena')
    except ArchivoDanado:
        ok(True, 'un registro con marcadores de merge frena')
    guardar_registro({'enviados': {'a': {'enviado': '2026-09-21'}}}, r1)
    ok(leer_registro(r1)['enviados']['a']['enviado'] == '2026-09-21' and not os.path.exists(r1 + '.tmp'),
       'el registro se escribe entero, sin dejar el temporal')
    # 11) Un punto arreglado que vuelve
    R = {'nombre': 'r_x'}
    env = {'r_x|F|c': {'enviado': '2026-09-01', 'arreglado': '2026-09-03', 'id': 'F'},
           'r_x|G|c': {'enviado': '2026-09-01', 'id': 'G'}}
    anotar_enviados(env, [(R, {'id': 'F'}, 'r_x|F|c')], {'r_x|F|c'}, set(), '2026-09-05')
    ok(env['r_x|F|c'].get('arreglado') is None and env['r_x|F|c']['enviado'] == '2026-09-05'
       and env['r_x|F|c']['historial'] == [{'enviado': '2026-09-01', 'arreglado': '2026-09-03'}],
       'un punto que vuelve pasa su arreglo al historial y queda pedido de nuevo')
    ok(env['r_x|G|c'].get('arreglado') == '2026-09-05', 'lo que desaparecio queda arreglado con la fecha del envio')
    # 12) ADVAPP caido: sale con 2 y no escribe nada
    viejos = (SALIDA, NUESTROS, REGISTRO, PREGUNTAS, validar.bajar_advapp)
    try:
        SALIDA, NUESTROS = os.path.join(tmp, 'P.txt'), os.path.join(tmp, 'N.txt')
        REGISTRO, PREGUNTAS = r1, os.path.join(tmp, 'no-hay.json')

        def caido():
            raise OSError('HTTP Error 404')
        validar.bajar_advapp = caido
        argv = sys.argv
        sys.argv = ['pedido-advapp.py', '--enviado']
        try:
            rc = main()
        finally:
            sys.argv = argv
        ok(rc == 2 and not os.path.exists(SALIDA) and not os.path.exists(NUESTROS)
           and leer_registro(r1)['enviados'] == {'a': {'enviado': '2026-09-21'}},
           'con ADVAPP caido sale con 2 y no toca el borrador, los pendientes ni el registro')
    finally:
        SALIDA, NUESTROS, REGISTRO, PREGUNTAS, validar.bajar_advapp = viejos
    # 12b) Las confirmadas por Pedro: se suman con el "antes" de hoy, se
    #      juntan con la corrección de la auditoría del mismo producto y,
    #      cuando ADVAPP ya dice lo mismo, dejan de salir
    filas_c = [fila('X-1', 'Redmi Note 15 Pro 5G 8/256GB (Black)', 'Black'),
               fila('X-2', 'Galaxy S25 Ultra 12GB/1TB 5G (Gray)', 'Gray')]
    conf = [{'id': 'X-1', 'cambios': {'nombre': 'Redmi Note 15 Pro 4G 8/256GB (Black)'}, 'motivo': 'prueba'},
            {'id': 'X-2', 'cambios': {'nombre': 'Galaxy S25 Ultra 12GB/1TB 5G (Gray)'}, 'motivo': 'prueba'},
            {'id': 'NO-EXISTE', 'cambios': {'color': 'Rojo'}, 'motivo': 'prueba'}]
    previa = [{'id': 'X-1', 'producto': 'x', 'cambios': {'codigo': 'AT-0119'}, 'antes': {'codigo': ''}, 'reglas': ['r']}]
    lst, ya = sumar_confirmadas(previa, filas_c, conf)
    x1 = [x for x in lst if x['id'] == 'X-1']
    ok(len(lst) == 1 and len(x1) == 1 and x1[0]['cambios'] == {'codigo': 'AT-0119', 'nombre': 'Redmi Note 15 Pro 4G 8/256GB (Black)'}
       and x1[0]['antes']['nombre'] == 'Redmi Note 15 Pro 5G 8/256GB (Black)' and ya == 1,
       'las confirmadas se suman a la misma corrección, con el "antes" de hoy; la ya aplicada y la de un ID que no está no salen')
    with tempfile.TemporaryDirectory() as tmp:
        mala = os.path.join(tmp, 'c.json')
        open(mala, 'w', encoding='utf-8').write('{"correcciones": [{"id": "X", "cambios": {"precio": "1"}, "motivo": "m"}]}')
        try:
            leer_confirmadas(mala)
            ok(False, 'una confirmada que cambia un campo no permitido (precio) se rechaza')
        except ArchivoDanado:
            ok(True, 'una confirmada que cambia un campo no permitido (precio) se rechaza')
    try:
        ok(isinstance(leer_confirmadas(), list), 'herramientas/correcciones-confirmadas.json se lee (%d)' % len(leer_confirmadas()))
    except ArchivoDanado as e:
        ok(False, str(e))
    # 13) Las preguntas del repo se leen
    try:
        qs = leer_preguntas()
        ok(isinstance(qs, list), 'herramientas/preguntas-advapp.json se lee (%d preguntas)' % len(qs))
    except ArchivoDanado as e:
        ok(False, str(e))
    print()
    print('RESULTADO: %s' % ('%d FALLA(S)' % len(fallas) if fallas else 'pasa todo'))
    return 1 if fallas else 0


if __name__ == '__main__':
    sys.exit(main())
