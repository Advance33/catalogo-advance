# -*- coding: utf-8 -*-
"""El pedido a ADVAPP, armado desde los datos y no a mano.

    python3 herramientas/pedido-advapp.py              arma el borrador
    python3 herramientas/pedido-advapp.py --enviado    anota que se mando hoy
    python3 herramientas/pedido-advapp.py --enviado-ids ID1,ID2   solo esas filas

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
se ve de un vistazo que falta mandar y que les estamos repitiendo.

LO QUE NO HACE
No manda nada: el pedido lo manda una persona. Y no decide precios ni cual de
dos datos contradictorios esta bien -- eso lo pregunta (no-inventar).
"""
import os
import re
import sys
import json
import datetime
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


def capacidad(texto):
    """La memoria de guardado que dice un nombre: la ULTIMA cifra con GB o TB
    ("8/256GB" -> 256GB, "12GB/256GB" -> 256GB, "16GB/1TB" -> 1TB). None si no
    dice ninguna. Es lo que distingue un codigo de otra capacidad de un nombre
    escrito distinto: "Galaxy S25 FE 8/256GB" y "Galaxy S25 FE 256GB" son el
    mismo producto (medido el 26/09: comparar nombres enteros daba 60 falsos)."""
    m = re.findall(r'(\d+)\s*(GB|TB)\b', texto or '', re.I)
    return (m[-1][0] + m[-1][1].upper()) if m else None


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
    Plus, y ahi la foto si seria de otro producto."""
    prod = (idx['por_codigo'].get(cod) or [{}])[0].get('Producto', '')
    marca = fila.get('Marca') or ''
    return modelo_sin_variables(_desc(fila), marca) == modelo_sin_variables(prod, marca)


def sim_de(texto):
    t = (texto or '').lower()
    return 'esim' if re.search(r'\be-?\s?sim\b', t) else 'sim' if re.search(r'\bsim\b', t) else ''


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


@regla('SIN CODIGO PROPIO: TRAE EL DE OTRO PRODUCTO',
       'La fila trae en CODIGO el de otro producto (casi siempre otra capacidad) y en '
       'nuestro maestro no hay uno para ella. El codigo lo damos NOSOTROS: se decide si es '
       'un alta o un producto que ya esta con otro nombre (altas-decididas.csv) y recien '
       'despues se le pasa a ADVAPP.',
       'la ficha muestra la foto del otro producto.', donde='nosotros')
def r_sin_codigo_propio(filas, ctx):
    idx = ctx['idx']
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
            yield {'id': f['ID'], 'desc': _desc(f), 'hoy': '(vacio)',
                   'poner': 'alta o vinculo', 'clave': '', 'candidato': candidato(f, ctx)}


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

def leer_registro():
    try:
        return json.load(open(REGISTRO, encoding='utf-8'))
    except Exception:
        return {'enviados': {}}


def clave_punto(r, p):
    return '%s|%s|%s' % (r['nombre'], p['id'], p['clave'])


def fecha(iso):
    d = datetime.date.fromisoformat(iso)
    return d.strftime('%d/%m')


# ---------------------------------------------------------------- armado

def escribir_nuestros(nuestros):
    L = ['LO QUE TENEMOS QUE RESOLVER NOSOTROS - %s' % HOY.strftime('%d/%m/%Y'),
         'Armado por herramientas/pedido-advapp.py. No va a ADVAPP: primero hay que '
         'decidir el codigo.', '']
    for r in [x for x in REGLAS if x['donde'] == 'nosotros']:
        pts = [p for rr, p, _ in nuestros if rr is r]
        L += ['', '%s - %d fila%s' % (r['titulo'], len(pts), '' if len(pts) == 1 else 's'),
              '-' * 68, r['explicacion'], '']
        for p in sorted(pts, key=lambda x: x['id']):
            L.append('  %-40s %-9s %s' % (p['id'], p['hoy'], p['poner']))
            L.append('  %-40s %s' % ('', p['desc'][:70]))
            if p.get('candidato'):
                L.append('  %-40s candidato: %s' % ('', p['candidato']))
    open(NUESTROS, 'w', encoding='utf-8').write('\n'.join(L) + '\n')
    print('Pendientes nuestros: %d (en %s)' % (len(nuestros), os.path.relpath(NUESTROS, RAIZ)))


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    filas = [f for f in validar.bajar_csv() if (f.get('ID') or '').strip()]
    maestro = CM.leer()
    ctx = {'idx': CM.indexar(maestro), 'pinta': validar.pinta,
           'conocidos': validar.leer_index()[0]}
    reg = leer_registro()
    enviados = reg.get('enviados', {})

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
        for _, p, k in hallados:
            enviados.setdefault(k, {'enviado': cuando, 'id': p['id']})
        # lo que se pidio y ya no aparece queda como arreglado
        for k, v in enviados.items():
            if k not in claves_hoy and k not in omitidas and not v.get('arreglado'):
                v['arreglado'] = HOY.isoformat()
        reg['enviados'] = enviados
        json.dump(reg, open(REGISTRO, 'w', encoding='utf-8'), ensure_ascii=False, indent=1,
                  sort_keys=True)
        print('Anotado: %d puntos enviados el %s.' % (len(hallados), fecha(cuando)))
        return 0

    nuevos = [h for h in hallados if h[2] not in enviados]
    arreglados = [(k, v) for k, v in enviados.items()
                  if k not in claves_hoy and k not in omitidas and not v.get('arreglado')]

    L = []
    L.append('[BORRADOR] Armado por herramientas/pedido-advapp.py el %s contra la carga '
             'de ADVAPP (%d filas).' % (HOY.strftime('%d/%m/%Y'), len(filas)))
    L.append('Cuando se mande: python3 herramientas/pedido-advapp.py --enviado')
    L.append('')
    L.append('')
    L.append('Advance Tecno al equipo de ADVAPP - %s' % HOY.strftime('%d/%m/%Y'))
    L.append('=' * 68)
    L.append('%d puntos: %d nuevos y %d que ya les habiamos pedido y siguen igual.'
             % (len(hallados), len(nuevos), len(hallados) - len(nuevos)))
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
            marca = ('   (pedido el %s)' % fecha(ya['enviado'])) if ya else '   NUEVO'
            L.append('  %-*s  %-26s  %s%s' % (ancho, p['id'], p['hoy'][:26], p['poner'], marca))
            L.append('  %-*s  %s' % (ancho, '', p['desc'][:70]))
    if arreglados:
        L.append('')
        L.append('')
        L.append('LO QUE YA ARREGLARON - gracias (%d)' % len(arreglados))
        L.append('-' * 68)
        for k, v in sorted(arreglados):
            L.append('  %s   (pedido el %s)' % (k.split('|')[1], fecha(v['enviado'])))
    open(SALIDA, 'w', encoding='utf-8').write('\n'.join(L) + '\n')

    print('Pedido a ADVAPP: %d puntos (%d nuevos, %d ya pedidos), %d arreglados desde el ultimo envio.'
          % (len(hallados), len(nuevos), len(hallados) - len(nuevos), len(arreglados)))
    print('Quedo en %s' % os.path.relpath(SALIDA, RAIZ))
    for nombre, (r, pts) in por_regla.items():
        print('  %-44s %3d' % (r['titulo'][:44], len(pts)))
    return 1 if nuevos else 0


if __name__ == '__main__':
    sys.exit(main())
