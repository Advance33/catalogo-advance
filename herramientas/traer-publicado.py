# -*- coding: utf-8 -*-
"""Traer de lo publicado lo que el repo no tiene (27/11/2026, issue #302 de ADVAPP).

    python3 herramientas/traer-publicado.py faltantes   antes de armar: las paginas de producto/ que estan
                                                        publicadas y no en el repo, con su direccion
    python3 herramientas/traer-publicado.py faltantes --sin-precio
                                                        lo mismo, sin el precio que traen escrito (si no
                                                        se pudo armar y lo publicado es de otro dia)
    python3 herramientas/traer-publicado.py todo        si no se pudo armar: lo armado y publicado hoy, entero
    python3 herramientas/traer-publicado.py --probar    las pruebas de este archivo

Los dos los corre solo el workflow de Publicar (.github/workflows/publicar.yml),
en la copia del repo que se publica: no se commitea nada.

POR QUE EXISTE
Desde el 12/11 la publicacion rearma producto/ con el precio del momento a
partir de lo que hay en el repo, y no commitea (publicar.yml). En el repo
producto/ queda como la ultima vez que alguien lo guardo (el 05/11, hasta el
PR #113 del 26/11). La pagina de un modelo que entro despues existe solo en lo
publicado:
- si el modelo sale de ADVAPP, la publicacion siguiente no la arma y queda en
  404, en vez de quedar "Hoy sin stock" como dice paginas-producto.py ("las
  paginas no se borran"). Paso con producto/xiaomi-pocophone-c71/ (Search
  Console, 26/11) y el 24/11 a las 00:55 con 7 paginas a la vez;
- si ADVAPP le cambia el nombre, la direccion se arma de nuevo con el nombre
  nuevo: para Google es otra pagina.
"faltantes" las baja de lo publicado antes de armar, con la direccion que
tienen (producto/indice.json publicado), y paginas-producto.py hace con ellas
lo mismo que con las del repo: la rearma si el modelo sigue, o la pasa a sin
stock (sin el precio que traia escrito) si ya no esta. Si no se pudo armar y
lo publicado es de otro dia, "faltantes --sin-precio" las trae igual, cada una
como la arma armar_pagina ("Consulta el precio", sin hora): asi no se pierden
justo el dia que ADVAPP no contesta.

"todo" es para cuando no se puede armar (ADVAPP o Chrome no contestan) en una
publicacion con un cambio (un merge): si lo publicado tiene precio de hoy, se
publica el cambio con producto/, preguntas/, llms.txt y sitemap.xml tal cual
estan publicados, en vez de las paginas del repo sin precio. Si lo publicado es
de otro dia, o falta un solo archivo, no trae nada: un precio de ayer no se
deja y una mitad tampoco.

NUNCA FRENA LA PUBLICACION
"faltantes" siempre termina bien: lo que no pudo bajar no lo trae, y queda un
aviso en el resumen de la corrida. "todo" dice con el codigo de salida si trajo
(0) o no (1); el workflow decide.

LO QUE NO CUBRE
- Depende de lo publicado. Si un dia se publica sin esas paginas (el sitio no
  contesto en "faltantes", o una no se pudo limpiar con --sin-precio), la
  corrida siguiente ya no las encuentra: la de un modelo que sigue en ADVAPP
  vuelve con la misma direccion (sale del nombre), la de uno que ya no esta
  queda en 404. Se cura del todo guardando producto/ en el repo (como el PR
  #113).
- El dia que se publica sin precio, el sitemap y "Todos los modelos" son los
  del repo, una foto del dia en que alguien los guardo: las traidas de modelos
  que entraron despues de esa foto no figuran ahi; vuelven en la corrida
  siguiente que pueda armar.
"""
import concurrent.futures
import datetime
import io
import json
import os
import re
import sys
import time

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
sys.path.insert(0, AQUI)
import indexnow  # noqa: E402  (bajar() y direccion_publica(): las mismas que usa la comparacion)


def paginas_producto():
    """paginas-producto.py (por sin_precio_del_dia), cargado solo cuando hace
    falta: si un cambio lo rompe, "faltantes" sin --sin-precio y "todo" siguen
    andando."""
    import importlib.util
    spec = importlib.util.spec_from_file_location('paginas_producto', os.path.join(AQUI, 'paginas-producto.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

HORA_AR = datetime.timezone(datetime.timedelta(hours=-3))
RE_SLUG = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
RE_DIA_LLMS = re.compile(r'son del (\d{2})/(\d{2})/(\d{4}), (\d{2}):(\d{2})')
RE_SELLO = re.compile(r'"sello": "(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})')
RE_HORA = re.compile(r'\d{2}/\d{2}/\d{4}, \d{2}:\d{2}')
TIEMPO = 240        # segundos que tiene "todo" para bajar todo
TIEMPO_FALTANTES = 90
EXTRA = ('llms.txt', 'sitemap.xml', 'producto/indice.json', 'producto/index.html', 'preguntas/index.html')


def hoy_ar(reloj=None):
    """'27/11/2026', el dia de hoy en Argentina."""
    return (reloj or datetime.datetime.now(HORA_AR)).strftime('%d/%m/%Y')


def leer_json(texto):
    try:
        d = json.loads(texto or '')
    except ValueError:
        return None
    return d if isinstance(d, dict) and isinstance(d.get('slugs'), dict) else None


def escribir(raiz, rel, texto):
    """Byte a byte como lo publico el sitio (sin tocar los saltos de linea)."""
    ruta = os.path.join(raiz, rel)
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with io.open(ruta, 'w', encoding='utf-8', newline='') as fh:
        fh.write(texto)


def texto_indice(d):
    """El indice como lo escribe paginas-producto.py."""
    return json.dumps({'slugs': dict(sorted(d['slugs'].items())), 'lastmod': dict(sorted((d.get('lastmod') or {}).items()))},
                      ensure_ascii=False, indent=1) + '\n'


def bajar_varias(publica, rels, bajar, hilos=8, tiempo=None, reloj=time.time):
    """{rel: texto o None (404)} de lo que bajo y [rel] de lo que no."""
    limite = reloj() + tiempo if tiempo else None

    def una(rel):
        if limite and reloj() > limite:
            return rel, None, IOError('se acabo el tiempo')
        try:
            return rel, bajar(publica + rel), None
        except Exception as e:    # una que no baja no frena a las demas
            return rel, None, e

    bajadas, fallas = {}, []
    with concurrent.futures.ThreadPoolExecutor(max_workers=hilos) as pool:
        for rel, texto, error in pool.map(una, sorted(rels)):
            if error is not None:
                fallas.append(rel)
            else:
                bajadas[rel] = texto
    return bajadas, fallas


def faltantes(raiz=RAIZ, bajar=indexnow.bajar, sin_precio=False, tiempo=TIEMPO_FALTANTES):
    """Trae las paginas de producto/ publicadas que el repo no tiene y suma su
    direccion a producto/indice.json. Devuelve cuantas trajo.
    sin_precio: para cuando no se pudo escribir el precio y lo publicado es de
    otro dia; cada pagina traida pasa por sin_precio_del_dia (queda como la
    arma armar_pagina) y la que no se puede limpiar no se trae.
    Baja todo primero y escribe al final; si algo falla al escribir, borra lo
    que escribio y deja el indice como estaba."""
    publica = indexnow.direccion_publica(raiz)
    if not publica:
        print('::warning::Traer lo publicado: no encontre el og:url de index.html. No se trajo nada.')
        return 0
    try:
        publicado = leer_json(bajar(publica + 'producto/indice.json'))
    except Exception as e:
        publicado, motivo = None, e
    else:
        motivo = 'no esta o no se entiende'
    if publicado is None:
        print('::warning::Traer lo publicado: producto/indice.json del sitio %s. Se arma con lo del repo.' % motivo)
        return 0
    ruta_indice = os.path.join(raiz, 'producto', 'indice.json')
    try:
        with io.open(ruta_indice, encoding='utf-8', newline='') as fh:
            texto_local = fh.read()
    except OSError:
        texto_local = None
    local = leer_json(texto_local)
    if local is None:
        print('::warning::Traer lo publicado: no pude leer producto/indice.json del repo. No se trajo nada.')
        return 0
    if not isinstance(local.get('lastmod'), dict):
        local['lastmod'] = {}
    lastmod_pub = publicado.get('lastmod') if isinstance(publicado.get('lastmod'), dict) else {}
    usados = set(local['slugs'].values())
    pedidas = {}
    for fam, s in publicado['slugs'].items():
        if (fam in local['slugs'] or not isinstance(s, str) or s in usados or not RE_SLUG.match(s)
                or os.path.exists(os.path.join(raiz, 'producto', s, 'index.html'))):
            continue
        pedidas.setdefault('producto/%s/index.html' % s, []).append(fam)
    if not pedidas:
        print('Traer lo publicado: el repo ya tiene todas las paginas publicadas.')
        return 0
    bajadas, fallas = bajar_varias(publica, pedidas, bajar, tiempo=tiempo)
    listas = {}
    limpiar = paginas_producto().sin_precio_del_dia if sin_precio else None
    for rel, texto in sorted(bajadas.items()):
        if not texto or '<html' not in texto:
            fallas.append(rel)
            continue
        if sin_precio and '"sello": "' in texto:
            texto = limpiar(texto)
            if texto is None:
                fallas.append(rel)
                continue
        listas[rel] = texto
    if listas:
        escritas = []
        try:
            for rel, texto in listas.items():
                s = rel.split('/')[1]
                for fam in pedidas[rel]:
                    local['slugs'][fam] = s
                if isinstance(lastmod_pub.get(s), str):
                    local['lastmod'][s] = lastmod_pub[s]
                escribir(raiz, rel, texto)
                escritas.append(rel)
            escribir(raiz, 'producto/indice.json', texto_indice(local))
        except Exception as e:
            for rel in escritas:
                try:
                    os.remove(os.path.join(raiz, rel))
                    os.rmdir(os.path.dirname(os.path.join(raiz, rel)))
                except OSError:
                    pass
            escribir(raiz, 'producto/indice.json', texto_local)
            print('::warning::Traer lo publicado: fallo al escribir (%s). No se trajo nada.' % e)
            return 0
    traidas = sorted(rel.split('/')[1] for rel in listas)
    print('Traer lo publicado: %d pagina(s) que el repo no tiene%s: %s.'
          % (len(traidas), ', sin precio' if sin_precio else '', ', '.join(traidas) or '-'))
    if fallas:
        print('::warning::Traer lo publicado: %d no se pudieron traer (%s). Si sus modelos ya no estan, esas quedan en 404.'
              % (len(fallas), ', '.join(sorted(fallas))))
    return len(traidas)


def todo(raiz=RAIZ, hoy=None, bajar=indexnow.bajar, tiempo=TIEMPO):
    """Pone en el repo lo armado y publicado hoy (producto/, preguntas/,
    llms.txt, sitemap.xml). True si lo trajo entero; False si no trajo nada."""
    hoy = hoy or hoy_ar()
    publica = indexnow.direccion_publica(raiz)
    if not publica:
        print('Traer lo publicado: no encontre el og:url de index.html.')
        return False
    try:
        llms = bajar(publica + 'llms.txt') or ''
        texto_indice_pub = bajar(publica + 'producto/indice.json')
    except Exception as e:
        print('Traer lo publicado: el sitio no contesto (%s).' % e)
        return False
    m = RE_DIA_LLMS.search(llms)
    dia = '%s/%s/%s' % m.group(1, 2, 3) if m else 'sin fecha'
    if dia != hoy:
        print('Traer lo publicado: lo publicado no tiene precio de hoy (%s; hoy es %s).' % (dia, hoy))
        return False
    # La hora de esa publicacion, como la escriben las paginas y "Todos los modelos"
    sello = '%s-%s-%sT%s:%s' % m.group(3, 2, 1, 4, 5)
    hora = '%s, %s:%s' % (dia, m.group(4), m.group(5))
    publicado = leer_json(texto_indice_pub)
    if publicado is None:
        print('Traer lo publicado: producto/indice.json del sitio no esta o no se entiende.')
        return False
    slugs = sorted(set(s for s in publicado['slugs'].values() if isinstance(s, str) and RE_SLUG.match(s)))
    # llms.txt y el indice, los que se miraron arriba (no se vuelven a bajar:
    # si en el medio se publica otra vez, el indice y las paginas siguen siendo
    # de la misma publicacion que se reviso)
    rels = [r for r in EXTRA if r not in ('llms.txt', 'producto/indice.json')] + ['producto/%s/index.html' % s for s in slugs]
    bajadas, fallas = bajar_varias(publica, rels, bajar, tiempo=tiempo)
    bajadas.update({'llms.txt': llms, 'producto/indice.json': texto_indice_pub})
    # Lo que bajo tiene que ser lo que se espera: una pagina de error del sitio
    # con 200 no se publica en lugar de la pagina
    forma = {'sitemap.xml': '<urlset'}
    fallas += [r for r in rels if r in bajadas and (forma.get(r, '<html') not in (bajadas[r] or ''))]
    if fallas:
        print('Traer lo publicado: %d de %d no bajaron bien (%s). No se trae nada.'
              % (len(fallas), len(rels) + 2, ', '.join(sorted(fallas)[:5]) + (' ...' if len(fallas) > 5 else '')))
        return False
    # Todo de la misma publicacion que llms.txt: otra corrida pudo publicar en
    # el medio, o el sitio servir una copia vieja de alguna
    otra = [r for r, t in bajadas.items() if r.startswith('producto/')
            and (any(x != sello for x in RE_SELLO.findall(t)) or any(x != hora for x in RE_HORA.findall(t)))]
    if otra:
        print('Traer lo publicado: %d pagina(s) con el precio de otra hora que llms.txt (%s; %s). No se trae nada.'
              % (len(otra), hora, ', '.join(sorted(otra)[:5])))
        return False
    for rel in sorted(bajadas):
        escribir(raiz, rel, bajadas[rel])
    print('Traer lo publicado: lo publicado hoy, entero (%d paginas de producto/, preguntas/, llms.txt y sitemap.xml).' % len(slugs))
    return True


def main(argv):
    if '--probar' in argv:
        return probar()
    if argv[:1] == ['faltantes']:
        try:
            faltantes(sin_precio='--sin-precio' in argv)
        except Exception as e:    # nunca frena la publicacion
            print('::warning::Traer lo publicado: %s. Se arma con lo del repo.' % e)
        return 0
    if argv[:1] == ['todo']:
        return 0 if todo() else 1
    print(__doc__)
    return 2


def probar():
    import contextlib
    import shutil
    import tempfile
    fallas = []

    def ok(c, txt, detalle=None):
        print(('  OK  ' if c else 'FALLA ') + txt + ('' if c or detalle is None else '  [%s]' % (detalle,)))
        if not c:
            fallas.append(txt)

    def callado(f, *a, **k):
        salida = io.StringIO()
        with contextlib.redirect_stdout(salida):
            r = f(*a, **k)
        return r, salida.getvalue()

    pub = 'https://catalogo.example/'
    portada = '<meta property="og:url" content="%s">' % pub

    def repo(indice):
        d = tempfile.mkdtemp(prefix='traer-')
        escribir(d, 'index.html', portada)
        escribir(d, 'producto/indice.json', texto_indice(indice))
        for s in indice['slugs'].values():
            escribir(d, 'producto/%s/index.html' % s, '<html>repo %s</html>' % s)
        return d

    def sitio(archivos, caido=()):
        def bajar(url):
            rel = url[len(pub):]
            if rel in caido:
                raise IOError('no contesta')
            return archivos.get(rel)
        return bajar

    def leer(d, rel):
        with io.open(os.path.join(d, rel), encoding='utf-8', newline='') as fh:
            return fh.read()

    ok(hoy_ar(datetime.datetime(2026, 11, 27, 0, 30, tzinfo=HORA_AR)) == '27/11/2026', 'el dia de hoy en Argentina')

    # faltantes: trae las publicadas que el repo no tiene, con su direccion
    ind_repo = {'slugs': {'M:A': 'a', 'M:B': 'b'}, 'lastmod': {'a': '2026-11-05', 'b': '2026-11-05'}}
    ind_pub = {'slugs': {'M:A': 'a', 'M:B': 'b', 'M:C71': 'xiaomi-pocophone-c71', 'M:DUO': 'apple-iphone-duo',
                         'M:OTRO-A': 'a', 'M:RARO': '../../etc', 'M:CAIDA': 'caida'},
               'lastmod': {'a': '2026-11-26', 'xiaomi-pocophone-c71': '2026-11-18', 'apple-iphone-duo': '2026-11-20'}}
    arch = {'producto/indice.json': json.dumps(ind_pub), 'producto/a/index.html': '<html>publicada a</html>',
            'producto/xiaomi-pocophone-c71/index.html': '<html>\r\nc71 "sello": "2026-11-18T18:07:00-03:00"</html>',
            'producto/apple-iphone-duo/index.html': '<html>duo</html>'}
    d = repo(ind_repo)
    try:
        n, salida = callado(faltantes, d, sitio(arch, caido=('producto/caida/index.html',)))
        ind = json.loads(leer(d, 'producto/indice.json'))
        ok(n == 2 and leer(d, 'producto/xiaomi-pocophone-c71/index.html') == arch['producto/xiaomi-pocophone-c71/index.html']
           and leer(d, 'producto/apple-iphone-duo/index.html') == '<html>duo</html>',
           'faltantes: trae las paginas publicadas que el repo no tiene, byte a byte', salida)
        ok(ind['slugs']['M:C71'] == 'xiaomi-pocophone-c71' and ind['slugs']['M:DUO'] == 'apple-iphone-duo'
           and ind['lastmod']['xiaomi-pocophone-c71'] == '2026-11-18',
           'faltantes: y suma su direccion (y su fecha) al indice, con la misma familia', ind)
        ok(leer(d, 'producto/a/index.html') == '<html>repo a</html>' and ind['slugs']['M:A'] == 'a' and ind['lastmod']['a'] == '2026-11-05',
           'faltantes: lo que el repo ya tiene no se toca')
        ok('M:OTRO-A' not in ind['slugs'] and 'M:RARO' not in ind['slugs'] and not os.path.exists(os.path.join(d, 'etc')),
           'faltantes: ni una direccion que el repo ya usa para otra familia ni una que no es direccion')
        ok('M:CAIDA' not in ind['slugs'] and not os.path.exists(os.path.join(d, 'producto/caida'))
           and '::warning::' in salida and 'producto/caida/index.html' in salida,
           'faltantes: la que no bajo no se trae ni entra al indice, con un aviso', salida)
        n2, _ = callado(faltantes, d, sitio(arch))
        ok(n2 == 0, 'faltantes: la segunda vez no hay nada que traer')
    finally:
        shutil.rmtree(d, ignore_errors=True)
    for caso, bajar in (('el sitio no contesta', sitio({}, caido=('producto/indice.json',))),
                        ('el sitio no tiene indice', sitio({})),
                        ('el indice no se entiende', sitio({'producto/indice.json': '<html>404</html>'}))):
        d = repo(ind_repo)
        try:
            antes = leer(d, 'producto/indice.json')
            n, salida = callado(faltantes, d, bajar)
            ok(n == 0 and leer(d, 'producto/indice.json') == antes and '::warning::' in salida,
               'faltantes: si %s, no trae nada, avisa y termina bien' % caso, salida)
        finally:
            shutil.rmtree(d, ignore_errors=True)

    # todo: lo publicado hoy, entero, o nada
    hoy = '27/11/2026'
    sello_hoy, sello_ayer = '"sello": "2026-11-27T15:07:00-03:00"', '"sello": "2026-11-26T18:07:00-03:00"'
    ind_pub = {'slugs': {'M:A': 'a', 'M:DUO': 'apple-iphone-duo', 'M:VIEJA': 'vieja'}, 'lastmod': {}}

    def publicado(**cambios):
        a = {'llms.txt': '# Advance Tecno\nLos precios son del 27/11/2026, 15:07 (hora de Argentina).\n',
             'sitemap.xml': '<urlset>publicado</urlset>', 'producto/indice.json': json.dumps(ind_pub),
             'producto/index.html': '<html>todos</html>', 'preguntas/index.html': '<html>preguntas</html>',
             'producto/a/index.html': '<html>a %s</html>' % sello_hoy,
             'producto/apple-iphone-duo/index.html': '<html>duo %s</html>' % sello_hoy,
             'producto/vieja/index.html': '<html>sin stock, sin sello</html>'}
        a.update(cambios)
        return a

    d = repo(ind_repo)
    try:
        r, salida = callado(todo, d, hoy, sitio(publicado()))
        ok(r and leer(d, 'producto/apple-iphone-duo/index.html') == '<html>duo %s</html>' % sello_hoy
           and leer(d, 'producto/a/index.html') == '<html>a %s</html>' % sello_hoy and leer(d, 'llms.txt').startswith('# Advance Tecno')
           and leer(d, 'sitemap.xml') == '<urlset>publicado</urlset>' and leer(d, 'preguntas/index.html') == '<html>preguntas</html>'
           and json.loads(leer(d, 'producto/indice.json')) == ind_pub and leer(d, 'producto/b/index.html') == '<html>repo b</html>',
           'todo: con precio de hoy trae lo publicado entero (y lo nuevo del repo queda)', salida)
    finally:
        shutil.rmtree(d, ignore_errors=True)
    for caso, arch in (('lo publicado es de ayer', publicado(**{'llms.txt': 'Los precios son del 26/11/2026, 18:07.'})),
                       ('llms.txt no dice de cuando', publicado(**{'llms.txt': '# Advance Tecno\n'})),
                       ('falta una pagina', publicado(**{'producto/vieja/index.html': None})),
                       ('una pagina tiene precio de ayer', publicado(**{'producto/a/index.html': '<html>a %s</html>' % sello_ayer}))):
        d = repo(ind_repo)
        try:
            r, salida = callado(todo, d, hoy, sitio(arch))
            ok(r is False and leer(d, 'producto/a/index.html') == '<html>repo a</html>'
               and not os.path.exists(os.path.join(d, 'llms.txt')) and not os.path.exists(os.path.join(d, 'producto/apple-iphone-duo')),
               'todo: si %s, no trae nada' % caso, salida)
        finally:
            shutil.rmtree(d, ignore_errors=True)
    d = repo(ind_repo)
    try:
        r, salida = callado(todo, d, hoy, sitio(publicado(), caido=('producto/apple-iphone-duo/index.html',)))
        ok(r is False and leer(d, 'producto/a/index.html') == '<html>repo a</html>', 'todo: si una no baja, no trae nada', salida)
        reloj = iter([0, 0, 999]).__next__    # el limite, la "x" a tiempo y la "y" tarde
        _, f = bajar_varias(pub, ['x', 'y'], sitio({'x': 'a', 'y': 'b'}), hilos=1, tiempo=10, reloj=reloj)
        ok(f == ['y'], 'todo: lo que no llega a bajar a tiempo cuenta como que no bajo', f)
    finally:
        shutil.rmtree(d, ignore_errors=True)

    # faltantes --sin-precio: la traida queda como la arma armar_pagina (o no se trae)
    m = {'familia': 'M:DUO', 'titulo': 'Apple iPhone Duo', 'marca': 'Apple', 'categoria': 'Celular', 'rubro': 'Celulares',
         'clave': 'A1', 'sku': '', 'desde': 1200, 'hasta': 1200, 'stock': True, 'wa': 'https://wa.me/1?text=hola',
         'versiones': [{'version': '256GB', 'color': 'Black', 'precio': 1200, 'stock': True, 'clave': 'A1', 'sku': '', 'wa': '', 'aviso': ''}]}
    g = {'cuotas': 12}
    pp = paginas_producto()
    sin = pp.armar_pagina(m, 'apple-iphone-duo', pub, g)
    con = pp.con_precio_del_dia(sin, m, g, '2026-11-26T18:07:00-03:00', pub + 'producto/apple-iphone-duo/')
    rara = con.replace('<tbody id="filas">', '<tbody>', 1)
    ind_pub2 = {'slugs': {'M:A': 'a', 'M:B': 'b', 'M:DUO': 'apple-iphone-duo', 'M:RARA': 'rara', 'M:VIEJA': 'vieja'}, 'lastmod': None}
    arch2 = {'producto/indice.json': json.dumps(ind_pub2), 'producto/apple-iphone-duo/index.html': con,
             'producto/rara/index.html': rara, 'producto/vieja/index.html': '<html>sin stock, sin sello</html>'}
    d = repo(ind_repo)
    try:
        n, salida = callado(faltantes, d, sitio(arch2), True)
        ind = json.loads(leer(d, 'producto/indice.json'))
        ok(n == 2 and leer(d, 'producto/apple-iphone-duo/index.html') == sin and 'Precio al' not in leer(d, 'producto/apple-iphone-duo/index.html')
           and leer(d, 'producto/vieja/index.html') == '<html>sin stock, sin sello</html>',
           'faltantes --sin-precio: la traida queda sin precio, como la arma armar_pagina (la que ya no tenia, igual)', salida)
        ok('M:RARA' not in ind['slugs'] and not os.path.exists(os.path.join(d, 'producto/rara')) and 'producto/rara/index.html' in salida,
           'faltantes --sin-precio: la que no se puede limpiar no se trae (nunca un precio viejo)', salida)
        ok(ind['lastmod'].get('a') == '2026-11-05' and 'apple-iphone-duo' not in ind['lastmod'],
           'faltantes: un "lastmod" publicado que no es un diccionario no rompe nada', ind['lastmod'])
    finally:
        shutil.rmtree(d, ignore_errors=True)
    d = repo(ind_repo)
    try:
        antes = leer(d, 'producto/indice.json')
        real = escribir
        llamadas = []

        def escribir_que_falla(raiz, rel, texto):
            llamadas.append(rel)
            if len(llamadas) == 2:
                raise OSError('disco lleno')
            real(raiz, rel, texto)
        globals()['escribir'] = escribir_que_falla
        try:
            n, salida = callado(faltantes, d, sitio(arch))
        finally:
            globals()['escribir'] = real
        ok(n == 0 and leer(d, 'producto/indice.json') == antes and not os.path.exists(os.path.join(d, 'producto', llamadas[0].split('/')[1]))
           and '::warning::' in salida, 'faltantes: si falla al escribir, borra lo que escribio y el indice queda como estaba', salida)
    finally:
        shutil.rmtree(d, ignore_errors=True)
    for caso, cambio in (('una pagina es de otra publicacion del mismo dia', {'producto/a/index.html': '<html>a "sello": "2026-11-27T18:07:00-03:00"</html>'}),
                         ('"Todos los modelos" es de otra hora', {'producto/index.html': '<html>Precios al 27/11/2026, 18:07</html>'})):
        d = repo(ind_repo)
        try:
            r, salida = callado(todo, d, hoy, sitio(publicado(**cambio)))
            ok(r is False and not os.path.exists(os.path.join(d, 'llms.txt')), 'todo: si %s, no trae nada' % caso, salida)
        finally:
            shutil.rmtree(d, ignore_errors=True)
    d = repo(ind_repo)
    try:
        r, salida = callado(todo, d, hoy, sitio(publicado(**{'producto/index.html': '<html>Precios al 27/11/2026, 15:07</html>'})))
        ok(r is True, 'todo: con "Todos los modelos" de la misma hora, si', salida)
    finally:
        shutil.rmtree(d, ignore_errors=True)
    d = repo(ind_repo)
    try:
        r, salida = callado(todo, d, hoy, sitio(publicado(**{'producto/vieja/index.html': 'Error 503: intente mas tarde'})))
        ok(r is False and not os.path.exists(os.path.join(d, 'llms.txt')), 'todo: una pagina de error con 200 no se trae', salida)
        r, salida = callado(todo, d, hoy, sitio(publicado(**{'sitemap.xml': '<html>error</html>'})))
        ok(r is False, 'todo: un sitemap que no es sitemap tampoco', salida)
    finally:
        shutil.rmtree(d, ignore_errors=True)

    print('\n%d falla(s)' % len(fallas) if fallas else '\nTODO OK')
    return 1 if fallas else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
