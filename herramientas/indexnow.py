# -*- coding: utf-8 -*-
"""IndexNow: avisarle a Bing que paginas cambiaron despues de publicar.

    python3 herramientas/indexnow.py cambios    que paginas recien armadas dicen otra
                                                cosa que las publicadas (solo lee)
    python3 herramientas/indexnow.py avisar     le manda esa lista a IndexNow
    python3 herramientas/indexnow.py --probar   las pruebas de este archivo

"cambios" y "avisar" los corre solo el workflow de Publicar
(.github/workflows/publicar.yml).

POR QUE EXISTE (12/11/2026, buscadores con IA)
El precio escrito en producto/ se rearma a las 15 y a las 18 y en cada
publicacion (paginas-producto.py --con-precio). Bing no se entera hasta que
vuelve a pasar por la pagina, y puede tardar dias: mientras tanto Copilot, que
busca en Bing, y en parte ChatGPT cuentan el precio viejo. IndexNow
(indexnow.org) es el aviso que Bing pide para eso: la lista de direcciones que
cambiaron. Google no lo usa. Lo pedia el brief "Posicionamiento en IAs" del
grupo (Fase 2), revisado solo para Tecno.

COMO SABE QUE CAMBIO
No guarda nada. Baja cada pagina publicada y la compara con la recien armada,
las dos sin la hora del precio, que cambia en todas en cada corrida. Avisa
solo las que dicen otra cosa (otro precio, otro stock, otro texto), las nuevas
y las que dejaron de existir. Si no cambio ninguna, no avisa nada.
Mira cada modelo (producto/<nombre>/), "Todos los modelos" (producto/) y las
preguntas (preguntas/). La portada no: se arma con JavaScript y su HTML no
cambia con los precios.

LA CLAVE
IndexNow pide una clave en un archivo de la raiz del sitio que se llama como
ella (<clave>.txt), para saber que el aviso lo manda el sitio. No es un
secreto: va publicada y cualquiera la puede leer. robots.txt la deja pasar
(los demas .txt de la raiz no se leen).

NUNCA FRENA LA PUBLICACION
Si algo falla (no baja una pagina, IndexNow no contesta), queda un aviso en
el resumen de la corrida y termina bien. Una pagina que no se pudo bajar no
se avisa: no se sabe si cambio.
"""
import concurrent.futures
import io
import json
import os
import re
import sys
import urllib.error
import urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)

CLAVE = 'ba1130a96e87dc0f407811c8dd679e65'
SERVICIO = 'https://api.indexnow.org/indexnow'
TOPE = 10000    # lo maximo que IndexNow recibe en un aviso

# La hora del precio, en las tres formas en que la escribe paginas-producto.py:
# "Precio al 12/11/2026, 13:05", "Precios en dolares al 12/11/2026, 13:05" y
# "sello": "2026-11-12T13:05:00-03:00" en los datos de la pagina.
RE_SELLO = re.compile(r'"sello": "[^"]*"')
RE_HORA = re.compile(r'\d{2}/\d{2}/\d{4}, \d{2}:\d{2}')

QUE_DICE = {200: 'recibido', 202: 'recibido; todavia tienen que leer la clave del sitio',
            400: 'el aviso esta mal armado', 403: 'no encontraron la clave en el sitio',
            422: 'las direcciones no son de este sitio o la clave no coincide',
            429: 'demasiados avisos seguidos'}


def leer(ruta):
    with io.open(ruta, encoding='utf-8') as f:
        return f.read()


def direccion_publica(raiz=RAIZ):
    """La direccion del catalogo, con la barra final: el og:url de index.html,
    de donde tambien la toman las paginas de producto."""
    try:
        m = re.search(r'<meta property="og:url" content="(https://[^"]+)"', leer(os.path.join(raiz, 'index.html')))
    except IOError:
        return None
    return m.group(1).rstrip('/') + '/' if m else None


def sin_hora(html):
    """La pagina sin la hora del precio."""
    return RE_HORA.sub('', RE_SELLO.sub('', html))


def paginas_armadas(raiz=RAIZ):
    """{direccion relativa: archivo} de lo que se compara."""
    out = {}
    for rel in ('producto/', 'preguntas/'):
        ruta = os.path.join(raiz, rel, 'index.html')
        if os.path.isfile(ruta):
            out[rel] = ruta
    carpeta = os.path.join(raiz, 'producto')
    for nombre in sorted(os.listdir(carpeta)) if os.path.isdir(carpeta) else []:
        ruta = os.path.join(carpeta, nombre, 'index.html')
        if os.path.isfile(ruta):
            out['producto/%s/' % nombre] = ruta
    return out


def del_sitemap(xml, publica):
    """Las direcciones relativas de producto/ y preguntas/ que nombra un sitemap."""
    out = set()
    for loc in re.findall(r'<loc>([^<]+)</loc>', xml or ''):
        rel = loc[len(publica):] if loc.startswith(publica) else ''
        if rel == 'preguntas/' or rel.startswith('producto/'):
            out.add(rel)
    return out


def bajar(url):
    """El texto publicado en url; None si no existe (404). Con cualquier otro
    problema, la excepcion."""
    pedido = urllib.request.Request(url, headers={'User-Agent': 'catalogo-advance/indexnow'})
    try:
        with urllib.request.urlopen(pedido, timeout=20) as r:
            return r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


def comparar(armadas, antes, publica, bajar=bajar, hilos=8):
    """Que hay que avisar. armadas: {direccion relativa: html recien armado};
    antes: las direcciones relativas del sitemap publicado. Devuelve
    (cambiadas, sin_bajar): las que dicen otra cosa, las nuevas y las que ya
    no estan; y las que no se pudieron bajar, que no se avisan."""
    def una(rel):
        try:
            return rel, bajar(publica + rel), None
        except Exception as e:    # una pagina que no baja no frena a las demas
            return rel, None, e

    cambiadas, sin_bajar = [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=hilos) as pool:
        for rel, publicada, error in pool.map(una, sorted(armadas)):
            if error is not None:
                sin_bajar.append(rel)
            elif publicada is None or sin_hora(publicada) != sin_hora(armadas[rel]):
                cambiadas.append(rel)
    return cambiadas + sorted(r for r in antes if r not in armadas), sin_bajar


def cuerpo(urls, publica, clave=CLAVE):
    """El aviso como lo pide IndexNow."""
    return {'host': publica.split('//', 1)[1].strip('/'), 'key': clave,
            'keyLocation': publica + clave + '.txt', 'urlList': list(urls)[:TOPE]}


def avisar(urls, publica, abrir=urllib.request.urlopen):
    """Manda el aviso y devuelve el codigo con que contesto IndexNow."""
    pedido = urllib.request.Request(SERVICIO, data=json.dumps(cuerpo(urls, publica)).encode('utf-8'),
                                    headers={'Content-Type': 'application/json; charset=utf-8'})
    try:
        with abrir(pedido, timeout=30) as r:
            return r.getcode()
    except urllib.error.HTTPError as e:
        return e.code


def anotar(urls, salida):
    """Deja la lista en la salida del paso, para el job que avisa."""
    with io.open(salida, 'a', encoding='utf-8') as f:
        f.write(u'cambios=%s\n' % json.dumps(urls))


def main_cambios(raiz=RAIZ, entorno=os.environ):
    publica = direccion_publica(raiz)
    if not publica:
        print('::warning::IndexNow: no encontre el og:url de index.html. No se avisa nada.')
        return 0
    armadas = {rel: leer(ruta) for rel, ruta in paginas_armadas(raiz).items()}
    try:
        antes = del_sitemap(bajar(publica + 'sitemap.xml'), publica)
    except Exception as e:
        print('::warning::IndexNow: no se pudo bajar el sitemap publicado (%s). Las paginas que se dieron de baja no se avisan.' % e)
        antes = set()
    cambiadas, sin_bajar = comparar(armadas, antes, publica)
    urls = [publica + rel for rel in cambiadas][:TOPE]
    print('IndexNow: %d de %d paginas dicen otra cosa que lo publicado.' % (len(urls), len(armadas)))
    for u in urls[:12]:
        print('  ' + u)
    if len(urls) > 12:
        print('  ... y %d mas' % (len(urls) - 12))
    if sin_bajar:
        print('::warning::IndexNow: %d paginas publicadas no se pudieron bajar para comparar y no se avisan (%s).'
              % (len(sin_bajar), ', '.join(sin_bajar[:4])))
    if entorno.get('GITHUB_OUTPUT'):
        anotar(urls, entorno['GITHUB_OUTPUT'])
    return 0


def main_avisar(raiz=RAIZ, entorno=os.environ):
    try:
        urls = json.loads(entorno.get('CAMBIOS') or '[]')
    except ValueError:
        print('::warning::IndexNow: la lista de paginas llego rota. No se avisa nada.')
        return 0
    publica = direccion_publica(raiz)
    if not urls or not publica:
        print('IndexNow: nada para avisar.')
        return 0
    try:
        codigo = avisar(urls, publica)
    except Exception as e:
        print('::warning::IndexNow no contesto (%s). El sitio ya esta publicado; Bing lo vera cuando vuelva a pasar.' % e)
        return 0
    dice = QUE_DICE.get(codigo, 'respuesta que no conozco')
    if codigo in (200, 202):
        print('::notice::IndexNow: %d paginas avisadas (%d, %s).' % (len(urls), codigo, dice))
    else:
        print('::warning::IndexNow contesto %d (%s). El sitio ya esta publicado; Bing lo vera cuando vuelva a pasar.' % (codigo, dice))
    return 0


def main(argv):
    if '--probar' in argv:
        return probar()
    if argv[:1] == ['cambios']:
        return main_cambios()
    if argv[:1] == ['avisar']:
        return main_avisar()
    print(__doc__)
    return 2


def probar():
    import tempfile
    fallas = []

    def ok(c, txt, detalle=None):
        print(('  OK  ' if c else 'FALLA ') + txt + ('' if c or detalle is None else '  [%s]' % (detalle,)))
        if not c:
            fallas.append(txt)

    pub = 'https://catalogo.example/'
    pag = ('<i>Precio al %s · hasta 12 cuotas</i><b>USD %s</b><p id="nota-precios">Precios en dólares al %s '
           '(hora de Argentina)</p><script>D = {"registro": "x", "sello": "%s"}</script>')
    a = pag % ('12/11/2026, 13:05', '1.285', '12/11/2026, 13:05', '2026-11-12T13:05:00-03:00')
    b = pag % ('12/11/2026, 18:02', '1.285', '12/11/2026, 18:02', '2026-11-12T18:02:00-03:00')
    c = pag % ('12/11/2026, 18:02', '1.290', '12/11/2026, 18:02', '2026-11-12T18:02:00-03:00')
    ok(sin_hora(a) == sin_hora(b) and '13:05' not in sin_hora(a) and '2026' not in sin_hora(a),
       'la misma pagina armada a otra hora es la misma pagina', sin_hora(a))
    ok(sin_hora(b) != sin_hora(c) and 'USD 1.285' in sin_hora(a), 'con otro precio es otra pagina')

    sm = ('<urlset><url><loc>%s</loc></url><url><loc>%sproducto/</loc></url><url><loc>%spreguntas/</loc></url>'
          '<url><loc>%sproducto/vieja/</loc></url><url><loc>https://otro.example/producto/x/</loc></url></urlset>') % ((pub,) * 4)
    ok(del_sitemap(sm, pub) == {'producto/', 'preguntas/', 'producto/vieja/'} and del_sitemap(None, pub) == set(),
       'del sitemap, solo producto/ y preguntas/ de este sitio')

    publicado = {pub + 'producto/igual/': a, pub + 'producto/otro-precio/': a, pub + 'producto/': a, pub + 'producto/nueva/': None}

    def baja(url):
        if url.endswith('/se-cae/'):
            raise IOError('sin red')
        return publicado[url]

    armadas = {'producto/igual/': b, 'producto/otro-precio/': c, 'producto/': b, 'producto/nueva/': b, 'producto/se-cae/': b}
    cambiadas, sin_bajar = comparar(armadas, {'producto/igual/', 'producto/vieja/', 'preguntas/'}, pub, bajar=baja, hilos=2)
    ok(cambiadas == ['producto/nueva/', 'producto/otro-precio/', 'preguntas/', 'producto/vieja/'],
       'se avisan la que cambio de precio, la nueva y las que ya no estan; la que solo cambio de hora, no', cambiadas)
    ok(sin_bajar == ['producto/se-cae/'], 'la que no se pudo bajar no se avisa y no frena a las demas', sin_bajar)
    ok(comparar({'producto/igual/': b}, {'producto/igual/'}, pub, bajar=baja) == ([], []), 'si no cambio nada, la lista queda vacia')

    cu = cuerpo([pub + 'producto/a/', pub + 'producto/b/'], pub, 'clave')
    ok(cu == {'host': 'catalogo.example', 'key': 'clave', 'keyLocation': pub + 'clave.txt',
              'urlList': [pub + 'producto/a/', pub + 'producto/b/']}, 'el aviso como lo pide IndexNow', cu)
    ok(len(cuerpo(['u'] * (TOPE + 5), pub)['urlList']) == TOPE, 'nunca mas de las que IndexNow recibe en un aviso')

    visto = {}

    class Respuesta(object):
        def __enter__(self):
            return self

        def __exit__(self, *x):
            return False

        def getcode(self):
            return 202

    def abre(pedido, timeout=None):
        visto['url'], visto['datos'], visto['tipo'] = pedido.full_url, json.loads(pedido.data.decode('utf-8')), pedido.get_header('Content-type')
        return Respuesta()

    def rechaza(pedido, timeout=None):
        raise urllib.error.HTTPError(pedido.full_url, 403, 'Forbidden', None, None)

    ok(avisar([pub + 'producto/a/'], pub, abrir=abre) == 202 and visto['url'] == SERVICIO
       and visto['datos']['urlList'] == [pub + 'producto/a/'] and visto['datos']['key'] == CLAVE
       and visto['tipo'] == 'application/json; charset=utf-8', 'el aviso sale a IndexNow en JSON', visto)
    ok(avisar([pub + 'producto/a/'], pub, abrir=rechaza) == 403, 'si IndexNow lo rechaza, devuelve el codigo y no se cae')

    with tempfile.TemporaryDirectory() as d:
        for rel in ('producto', 'producto/uno', 'producto/sin-pagina', 'preguntas'):
            os.makedirs(os.path.join(d, rel))
        for rel in ('producto/index.html', 'producto/uno/index.html', 'preguntas/index.html', 'producto/indice.json'):
            with io.open(os.path.join(d, rel), 'w', encoding='utf-8') as f:
                f.write(u'x')
        with io.open(os.path.join(d, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(u'<meta property="og:url" content="https://catalogo.example">')
        ok(sorted(paginas_armadas(d)) == ['preguntas/', 'producto/', 'producto/uno/'], 'se comparan los modelos, "Todos los modelos" y las preguntas',
           sorted(paginas_armadas(d)))
        ok(direccion_publica(d) == pub and direccion_publica(os.path.join(d, 'no-hay')) is None, 'la direccion publica sale del og:url, con la barra')
        salida = os.path.join(d, 'salida')
        anotar([pub + 'producto/uno/'], salida)
        ok(leer(salida) == 'cambios=["%sproducto/uno/"]\n' % pub, 'la lista queda en una sola linea para el job que avisa', leer(salida))
        ok(main_avisar(d, {'CAMBIOS': '[]'}) == 0 and main_avisar(d, {'CAMBIOS': 'roto'}) == 0 and main_avisar(d, {}) == 0,
           'sin lista, o con la lista rota, no avisa y termina bien')

    archivo = os.path.join(RAIZ, CLAVE + '.txt')
    ok(re.match(r'^[0-9a-f]{32}$', CLAVE) and os.path.isfile(archivo) and leer(archivo) == CLAVE,
       'la clave esta publicada en la raiz, en un archivo con su nombre y sin nada mas')
    ok(re.search(r'(?m)^Allow: /%s\.txt$' % CLAVE, leer(os.path.join(RAIZ, 'robots.txt'))), 'robots.txt deja leer la clave')
    print('\n%d falla(s)' % len(fallas) if fallas else '\nTODO OK')
    return 1 if fallas else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
