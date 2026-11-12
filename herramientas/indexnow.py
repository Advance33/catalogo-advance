# -*- coding: utf-8 -*-
"""IndexNow: avisarle a Bing que paginas cambiaron despues de publicar.

    python3 herramientas/indexnow.py cambios    que paginas recien armadas dicen otra
                                                cosa que las publicadas (solo lee)
    python3 herramientas/indexnow.py avisar     le manda esa lista a IndexNow
    python3 herramientas/indexnow.py --probar   las pruebas de este archivo

"cambios" y "avisar" los corre solo el workflow de Publicar
(.github/workflows/publicar.yml), que antes de comparar corre las pruebas.

POR QUE EXISTE (12/11/2026, buscadores con IA)
El precio escrito en producto/ se rearma a las 15:07 y a las 18:07 (el
horario esta en publicar.yml) y en cada publicacion (paginas-producto.py
--con-precio). Bing no se entera hasta que
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
Mira cada modelo (producto/<nombre>/), "Todos los modelos" (producto/), las
preguntas (preguntas/) y llms.txt. La portada no: se arma con JavaScript y su
HTML no cambia con los precios.
Si unas pocas no se pudieron bajar para comparar, se avisan igual: un aviso
de mas no molesta y uno de menos deja el precio viejo. Si son muchas las que
no bajan, o muchas las que el sitio dice no tener, es el sitio que no contesta
bien y esas no se avisan.

LA CLAVE
IndexNow pide una clave en un archivo de la raiz del sitio que se llama como
ella (<clave>.txt), para saber que el aviso lo manda el sitio. No es un
secreto: va publicada y cualquiera la puede leer. robots.txt la deja pasar
(los demas .txt de la raiz no se leen).

NUNCA FRENA LA PUBLICACION
Si algo falla (el sitio no contesta, IndexNow tampoco despues de tres
intentos), queda un aviso en el resumen de la corrida y termina bien. La
comparacion tiene dos minutos: lo que no llego a comparar cuenta como que no
bajo.

LO QUE NO CUBRE
- Si IndexNow no recibe un aviso, esas paginas no se vuelven a avisar: la
  corrida siguiente ya compara contra lo publicado. Bing las ve cuando pasa.
- Dos corridas pegadas (un push cerca de las 15 o de las 18) comparan contra
  el mismo sitio, el de antes de las dos. Casi siempre avisan lo mismo dos
  veces, que no trae problemas; si justo entre una y otra cambio un precio,
  la segunda puede publicarlo sin avisarlo.
- Si un dia no se pudo escribir el precio y se publican las paginas del repo,
  el workflow no compara ni avisa: no hay nada bueno que contarle a Bing.
"""
import concurrent.futures
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)

CLAVE = 'ba1130a96e87dc0f407811c8dd679e65'
SERVICIO = 'https://api.indexnow.org/indexnow'
AGENTE = 'catalogo-advance/indexnow'
TOPE = 10000        # lo maximo que IndexNow recibe en un aviso
PESO = 100000       # bytes: la lista viaja al job que avisa en una variable de entorno, que admite unos 128 KB
ESPERAS = (5, 20)   # segundos antes del segundo y del tercer intento del aviso
TIEMPO = 120        # segundos que tiene la comparacion

# La hora del precio, en las formas en que la escribe paginas-producto.py:
# "Precio al 12/11/2026, 13:05", "Precios en dolares al 12/11/2026, 13:05",
# "son del 12/11/2026, 13:05" (llms.txt) y "sello": "2026-11-12T13:05:00-03:00"
# en los datos de la pagina. Si alla cambia la forma, aca falla una prueba.
RE_SELLO = re.compile(r'"sello": "[^"]*"')
RE_HORA = re.compile(r'\d{2}/\d{2}/\d{4}, \d{2}:\d{2}')

QUE_DICE = {200: 'recibido', 202: 'recibido; todavia tienen que leer la clave del sitio',
            400: 'el aviso esta mal armado', 403: 'no encontraron la clave en el sitio',
            422: 'las direcciones no son de este sitio o la clave no coincide',
            429: 'demasiados avisos seguidos'}


def leer(ruta):
    """El texto de un archivo, byte a byte como lo publica el sitio (sin tocar
    los saltos de linea): asi se compara igual que lo que baja bajar()."""
    with io.open(ruta, 'rb') as f:
        return f.read().decode('utf-8', 'replace')


def direccion_publica(raiz=RAIZ):
    """La direccion del catalogo, con la barra final: el og:url de index.html,
    de donde tambien la toman las paginas de producto."""
    try:
        m = re.search(r'<meta property="og:url" content="(https://[^"]+)"', leer(os.path.join(raiz, 'index.html')))
    except IOError:
        return None
    return m.group(1).rstrip('/') + '/' if m else None


def sin_hora(texto):
    """La pagina sin la hora del precio."""
    return RE_HORA.sub('', RE_SELLO.sub('', texto))


def paginas_armadas(raiz=RAIZ):
    """{direccion relativa: archivo} de lo que se compara."""
    out = {}
    for rel, archivo in (('producto/', 'producto/index.html'), ('preguntas/', 'preguntas/index.html'), ('llms.txt', 'llms.txt')):
        ruta = os.path.join(raiz, archivo)
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


def bajar(url, abrir=urllib.request.urlopen, dormir=time.sleep):
    """El texto publicado en url; None si no existe (404). Si no contesta,
    prueba dos veces mas; si sigue sin contestar, la excepcion."""
    pedido = urllib.request.Request(url, headers={'User-Agent': AGENTE})
    for espera in (1, 3, None):
        try:
            with abrir(pedido, timeout=10) as r:
                return r.read().decode('utf-8', 'replace')
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if espera is None:
                raise
        except Exception:
            if espera is None:
                raise
        dormir(espera)


def comparar(armadas, antes, publica, bajar=bajar, hilos=8, tiempo=TIEMPO, reloj=time.time):
    """Compara lo armado con lo publicado. armadas: {direccion relativa: texto
    recien armado}; antes: las direcciones relativas del sitemap publicado.
    Devuelve cuatro listas: distintas (dicen otra cosa), nuevas (el sitio no
    las tiene), bajas (estaban y ya no se arman) y sin_bajar (no se pudieron
    comparar: no bajaron o se acabo el tiempo)."""
    limite = reloj() + tiempo

    def una(rel):
        if reloj() > limite:
            return rel, None, IOError('se acabo el tiempo')
        try:
            return rel, bajar(publica + rel), None
        except Exception as e:    # una pagina que no baja no frena a las demas
            return rel, None, e

    distintas, nuevas, sin_bajar = [], [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=hilos) as pool:
        for rel, publicada, error in pool.map(una, sorted(armadas)):
            if error is not None:
                sin_bajar.append(rel)
            elif publicada is None:
                nuevas.append(rel)
            elif sin_hora(publicada) != sin_hora(armadas[rel]):
                distintas.append(rel)
    return distintas, nuevas, sorted(r for r in antes if r not in armadas), sin_bajar


def pocas(lista, total):
    """Si son pocas (se avisan) o tantas que es el sitio el que no contesta
    bien (no se avisan)."""
    return len(lista) < total and len(lista) <= max(5, total // 10)


def recortar(urls, tope=TOPE, peso=PESO):
    """Las direcciones que entran en un aviso."""
    out, total = [], 2
    for u in urls[:tope]:
        total += len(json.dumps(u)) + 2
        if total > peso:
            break
        out.append(u)
    return out


def cuerpo(urls, publica, clave=CLAVE):
    """El aviso como lo pide IndexNow."""
    return {'host': publica.split('//', 1)[1].strip('/'), 'key': clave,
            'keyLocation': publica + clave + '.txt', 'urlList': list(urls)}


def avisar(urls, publica, abrir=urllib.request.urlopen):
    """Manda el aviso y devuelve el codigo con que contesto IndexNow."""
    pedido = urllib.request.Request(SERVICIO, data=json.dumps(cuerpo(urls, publica)).encode('utf-8'),
                                    headers={'Content-Type': 'application/json; charset=utf-8', 'User-Agent': AGENTE})
    try:
        with abrir(pedido, timeout=30) as r:
            return r.getcode()
    except urllib.error.HTTPError as e:
        return e.code


def avisar_insistiendo(urls, publica, avisar=avisar, dormir=time.sleep):
    """Hasta tres intentos si IndexNow no contesta, esta caido (5xx) o pide
    esperar (429). Devuelve (codigo, error) del ultimo intento."""
    for espera in ESPERAS + (None,):
        codigo, error = None, None
        try:
            codigo = avisar(urls, publica)
        except Exception as e:
            error = e
        if (codigo is not None and codigo != 429 and codigo < 500) or espera is None:
            return codigo, error
        dormir(espera)


def anotar(urls, salida):
    """Deja la lista en la salida del paso, para el job que avisa."""
    with io.open(salida, 'a', encoding='utf-8') as f:
        f.write(u'cambios=%s\n' % json.dumps(urls))


def main_cambios(raiz=RAIZ, entorno=os.environ, bajar=bajar):
    try:
        publica = direccion_publica(raiz)
        if not publica:
            print('::warning::IndexNow: no encontre el og:url de index.html. No se avisa nada.')
            return 0
        armadas = {rel: leer(ruta) for rel, ruta in paginas_armadas(raiz).items()}
        try:
            antes = del_sitemap(bajar(publica + 'sitemap.xml'), publica)
        except Exception as e:
            print('::warning::IndexNow: no se pudo bajar el sitemap publicado (%s). Las paginas dadas de baja no se avisan.' % e)
            antes = set()
        distintas, nuevas, bajas, sin_bajar = comparar(armadas, antes, publica, bajar=bajar)
        total = len(armadas)
        print('IndexNow: de %d paginas, %d dicen otra cosa que lo publicado, %d son nuevas y %d ya no estan.'
              % (total, len(distintas), len(nuevas), len(bajas)))
        cambiadas = distintas + bajas
        if pocas(nuevas, total):
            cambiadas += nuevas
        else:
            print('::warning::IndexNow: el sitio dice no tener %d de %d paginas: no contesta bien. Esas no se avisan.' % (len(nuevas), total))
        if sin_bajar and pocas(sin_bajar, total):
            print('::notice::IndexNow: %d paginas no se pudieron bajar para comparar; se avisan igual (%s).'
                  % (len(sin_bajar), ', '.join(sin_bajar[:4])))
            cambiadas += sin_bajar
        elif sin_bajar:
            print('::warning::IndexNow: %d de %d paginas publicadas no se pudieron bajar: el sitio no contesta. Esas no se avisan.'
                  % (len(sin_bajar), total))
        urls = recortar([publica + rel for rel in cambiadas])
        if len(urls) < len(cambiadas):
            print('::warning::IndexNow: cambiaron %d paginas y en un aviso entran %d. Las demas no se avisan.' % (len(cambiadas), len(urls)))
        for u in urls[:12]:
            print('  ' + u)
        if len(urls) > 12:
            print('  ... y %d mas' % (len(urls) - 12))
        if entorno.get('GITHUB_OUTPUT'):
            anotar(urls, entorno['GITHUB_OUTPUT'])
    except Exception as e:
        print('::warning::IndexNow: no se pudo comparar con lo publicado (%s: %s). No se avisa nada.' % (type(e).__name__, e))
    return 0


def main_avisar(raiz=RAIZ, entorno=os.environ, avisar=avisar, dormir=time.sleep):
    try:
        urls = json.loads(entorno.get('CAMBIOS') or '[]')
    except ValueError:
        print('::warning::IndexNow: la lista de paginas llego rota. No se avisa nada.')
        return 0
    publica = direccion_publica(raiz)
    if not urls or not publica:
        print('IndexNow: nada para avisar.')
        return 0
    codigo, error = avisar_insistiendo(urls, publica, avisar=avisar, dormir=dormir)
    if codigo in (200, 202):
        print('::notice::IndexNow: %d paginas avisadas (%d, %s).' % (len(urls), codigo, QUE_DICE[codigo]))
    else:
        que = 'no contesto (%s)' % error if codigo is None else 'contesto %d (%s)' % (codigo, QUE_DICE.get(codigo, 'respuesta que no conozco'))
        print('::warning::IndexNow %s. El sitio ya esta publicado; Bing vera esas %d paginas cuando vuelva a pasar.' % (que, len(urls)))
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
    import contextlib
    import importlib.util
    import tempfile
    fallas = []

    def ok(c, txt, detalle=None):
        print(('  OK  ' if c else 'FALLA ') + txt + ('' if c or detalle is None else '  [%s]' % (detalle,)))
        if not c:
            fallas.append(txt)

    def callado(f, *a, **k):
        """Lo que devuelve f, sin lo que imprime (los avisos para el resumen de la corrida)."""
        with contextlib.redirect_stdout(io.StringIO()):
            return f(*a, **k)

    pub = 'https://catalogo.example/'
    pag = ('<i>Precio al %s · hasta 12 cuotas</i><b>USD %s</b><p id="nota-precios">Precios en dólares al %s '
           '(hora de Argentina)</p><script>D = {"registro": "x", "sello": "%s"}</script>')
    a = pag % ('12/11/2026, 13:05', '1.285', '12/11/2026, 13:05', '2026-11-12T13:05:00-03:00')
    b = pag % ('12/11/2026, 18:02', '1.285', '12/11/2026, 18:02', '2026-11-12T18:02:00-03:00')
    c = pag % ('12/11/2026, 18:02', '1.290', '12/11/2026, 18:02', '2026-11-12T18:02:00-03:00')
    ok(sin_hora(a) == sin_hora(b) and '13:05' not in sin_hora(a) and '2026' not in sin_hora(a),
       'la misma pagina armada a otra hora es la misma pagina', sin_hora(a))
    ok(sin_hora(b) != sin_hora(c) and 'USD 1.285' in sin_hora(a), 'con otro precio es otra pagina')

    # La hora, como la escribe hoy el que arma las paginas: si alla cambia la forma, esto falla
    spec = importlib.util.spec_from_file_location('paginas_producto', os.path.join(AQUI, 'paginas-producto.py'))
    pp = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(pp)
    s1, s2 = '2026-11-12T13:05:00-03:00', '2026-11-13T09:40:00-03:00'
    ok(RE_HORA.sub('', pp.texto_sello(s1)) == '' and pp.texto_sello(s1) != pp.texto_sello(s2),
       'la hora que escribe paginas-producto.py es la que aca se saca', pp.texto_sello(s1))

    def modelo(precio):
        return {'familia': 'M:X', 'titulo': 'Apple iPhone 17 Pro', 'marca': 'Apple', 'categoria': 'Celular', 'rubro': 'Celulares',
                'clave': 'A1', 'sku': '', 'desde': precio, 'hasta': 1570, 'stock': True, 'wa': 'https://wa.me/1?text=hola',
                'versiones': [{'version': '256GB', 'color': 'Orange', 'precio': precio, 'stock': True, 'clave': 'A1', 'sku': '', 'wa': '', 'aviso': ''},
                              {'version': '512GB', 'color': 'Blue', 'precio': 1570, 'stock': True, 'clave': 'A2', 'sku': '', 'wa': '', 'aviso': ''}]}

    def pagina(precio, sello):
        g = {'cuotas': 12, 'congelados': {'dia': '2026-11-06', 'cambian': '2026-11-09'}}
        return pp.con_precio_del_dia(pp.armar_pagina(modelo(precio), 'x', pub, g), modelo(precio), g, sello, pub + 'producto/x/')

    ok('Precio al 12/11/2026, 13:05' in pagina(1200, s1) and '"sello": "%s"' % s1 in pagina(1200, s1)
       and pagina(1200, s1) != pagina(1200, s2) and sin_hora(pagina(1200, s1)) == sin_hora(pagina(1200, s2)),
       'la pagina de un modelo armada a otra hora, con el precio escrito, es la misma pagina')
    ok(sin_hora(pagina(1200, s1)) != sin_hora(pagina(1210, s1)), 'y con otro precio es otra')
    ent = [{'slug': 'x', 'titulo': 'X', 'rubro': 'Celulares', 'desde': 1200, 'stock': True}]
    gen = {'cuotas': 12, 'whatsapp': '5491100000000', 'direccion': 'Av. X 1, CABA', 'descripcion': 'Tienda.', 'preguntas': []}
    for nombre, arma in (('llms.txt', lambda s: pp.armar_llms(gen, pub, ent, s)), ('"Todos los modelos"', lambda s: pp.armar_indice(ent, pub, gen, s))):
        ok(pp.texto_sello(s1) in arma(s1) and arma(s1) != arma(s2) and sin_hora(arma(s1)) == sin_hora(arma(s2)),
           '%s armado a otra hora es el mismo' % nombre)

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
    r = comparar(armadas, {'producto/igual/', 'producto/vieja/', 'preguntas/'}, pub, bajar=baja, hilos=2)
    ok(r == (['producto/otro-precio/'], ['producto/nueva/'], ['preguntas/', 'producto/vieja/'], ['producto/se-cae/']),
       'aparte: la que cambio de precio, la nueva, las que ya no estan y la que no bajo; la que solo cambio de hora, en ninguna', r)
    ok(comparar({'producto/igual/': b}, {'producto/igual/'}, pub, bajar=baja) == ([], [], [], []), 'si no cambio nada, no hay nada que avisar')
    reloj = iter([0, 0, 500, 500, 500, 500, 500])
    r = comparar(armadas, set(), pub, bajar=baja, hilos=1, tiempo=120, reloj=lambda: next(reloj))
    ok(r[3] == ['producto/igual/', 'producto/nueva/', 'producto/otro-precio/', 'producto/se-cae/'] and r[:3] == ([], [], []),
       'cuando se acaba el tiempo no sigue bajando: lo que falta cuenta como que no bajo', r)
    ok(pocas(['a'] * 5, 20) and not pocas(['a'] * 6, 20) and pocas(['a'] * 47, 476) and not pocas(['a'] * 48, 476)
       and not pocas(['a'] * 4, 4) and pocas([], 4), 'pocas se avisan; muchas, o todas, es que el sitio no contesta bien')
    largas = [pub + 'producto/%s/' % ('x' * 60)] * 600
    ok(recortar(['u'] * 5, tope=3) == ['u'] * 3 and len(recortar(largas, peso=1000)) == 10
       and len(json.dumps(recortar(largas, peso=1000))) <= 1000
       and len(json.dumps(recortar(largas * 3))) <= PESO < len(json.dumps(largas * 3)) and recortar(largas) == largas,
       'en un aviso entra lo que IndexNow recibe y lo que el workflow puede pasar', len(recortar(largas, peso=1000)))

    class Respuesta(object):
        def __init__(self, codigo=200, texto=b''):
            self.codigo, self.texto = codigo, texto

        def __enter__(self):
            return self

        def __exit__(self, *x):
            return False

        def getcode(self):
            return self.codigo

        def read(self):
            return self.texto

    intentos, pausas = [], []

    def abre_a_la_tercera(pedido, timeout=None):
        intentos.append(pedido.full_url)
        if len(intentos) < 3:
            raise urllib.error.HTTPError(pedido.full_url, 503, 'caido', None, None)
        return Respuesta(200, b'hola\r\n')

    def no_esta(pedido, timeout=None):
        raise urllib.error.HTTPError(pedido.full_url, 404, 'no esta', None, None)

    def nunca(pedido, timeout=None):
        raise IOError('sin red')

    ok(bajar(pub + 'x', abrir=abre_a_la_tercera, dormir=pausas.append) == 'hola\r\n' and len(intentos) == 3 and pausas == [1, 3],
       'una pagina que no contesta se vuelve a pedir dos veces, y baja sin tocarle los saltos de linea', (intentos, pausas))
    ok(bajar(pub + 'x', abrir=no_esta, dormir=pausas.append) is None and pausas == [1, 3], 'la que no existe no se vuelve a pedir')
    try:
        bajar(pub + 'x', abrir=nunca, dormir=lambda s: None)
        ok(False, 'si no contesta nunca, avisa con la excepcion')
    except IOError:
        ok(True, 'si no contesta nunca, avisa con la excepcion')

    cu = cuerpo([pub + 'producto/a/', pub + 'producto/b/'], pub, 'clave')
    ok(cu == {'host': 'catalogo.example', 'key': 'clave', 'keyLocation': pub + 'clave.txt',
              'urlList': [pub + 'producto/a/', pub + 'producto/b/']}, 'el aviso como lo pide IndexNow', cu)

    visto = {}

    def abre(pedido, timeout=None):
        visto.update(url=pedido.full_url, datos=json.loads(pedido.data.decode('utf-8')),
                     tipo=pedido.get_header('Content-type'), agente=pedido.get_header('User-agent'))
        return Respuesta(202)

    def rechaza(pedido, timeout=None):
        raise urllib.error.HTTPError(pedido.full_url, 403, 'Forbidden', None, None)

    ok(avisar([pub + 'producto/a/'], pub, abrir=abre) == 202 and visto['url'] == SERVICIO
       and visto['datos']['urlList'] == [pub + 'producto/a/'] and visto['datos']['key'] == CLAVE
       and visto['tipo'] == 'application/json; charset=utf-8' and visto['agente'] == AGENTE,
       'el aviso sale a IndexNow en JSON y dice quien lo manda', visto)
    ok(avisar([pub + 'producto/a/'], pub, abrir=rechaza) == 403, 'si IndexNow lo rechaza, devuelve el codigo y no se cae')

    def serie(*respuestas):
        cola, esperas = list(respuestas), []

        def avisa(urls, publica):
            r = cola.pop(0)
            if isinstance(r, Exception):
                raise r
            return r
        return avisa, esperas

    av, es = serie(429, IOError('sin red'), 200)
    ok(avisar_insistiendo(['u'], pub, avisar=av, dormir=es.append) == (200, None) and es == list(ESPERAS),
       'si IndexNow pide esperar o no contesta, insiste hasta tres veces', es)
    av, es = serie(403, 200)
    ok(avisar_insistiendo(['u'], pub, avisar=av, dormir=es.append) == (403, None) and es == [],
       'si rechaza la clave no insiste: insistir no lo arregla')
    av, es = serie(503, 503, 503)
    ok(avisar_insistiendo(['u'], pub, avisar=av, dormir=es.append) == (503, None) and es == list(ESPERAS), 'y al tercer intento se rinde')

    with tempfile.TemporaryDirectory() as d:
        for rel in ('producto', 'producto/uno', 'producto/sin-pagina', 'preguntas'):
            os.makedirs(os.path.join(d, rel))
        for rel in ('producto/index.html', 'producto/uno/index.html', 'preguntas/index.html', 'producto/indice.json', 'llms.txt'):
            with io.open(os.path.join(d, rel), 'wb') as f:
                f.write(b'uno\r\ndos')
        with io.open(os.path.join(d, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(u'<meta property="og:url" content="https://catalogo.example">')
        ok(sorted(paginas_armadas(d)) == ['llms.txt', 'preguntas/', 'producto/', 'producto/uno/'],
           'se comparan los modelos, "Todos los modelos", las preguntas y llms.txt', sorted(paginas_armadas(d)))
        ok(leer(os.path.join(d, 'llms.txt')) == 'uno\r\ndos', 'lo armado se lee sin tocarle los saltos de linea, como lo publicado')
        ok(direccion_publica(d) == pub and direccion_publica(os.path.join(d, 'no-hay')) is None, 'la direccion publica sale del og:url, con la barra')
        salida = os.path.join(d, 'salida')
        anotar([pub + 'producto/uno/'], salida)
        ok(leer(salida) == 'cambios=["%sproducto/uno/"]\n' % pub, 'la lista queda en una sola linea para el job que avisa', leer(salida))

        def baja_casi_todo(url):
            if url.endswith('/producto/uno/'):
                raise IOError('sin red')
            return sm if url.endswith('sitemap.xml') else 'uno\r\ndos'

        def se_rompe(url):
            raise RuntimeError('algo raro')

        def nada(url):
            return None

        sal = [os.path.join(d, 'salida%d' % i) for i in range(2, 6)]
        r1 = callado(main_cambios, d, {'GITHUB_OUTPUT': sal[0]}, bajar=baja_casi_todo)
        ok(r1 == 0 and json.loads(leer(sal[0]).split('=', 1)[1]) == [pub + 'producto/vieja/', pub + 'producto/uno/'],
           'de punta a punta: la que ya no esta y la unica que no bajo se avisan', leer(sal[0]))
        ok(callado(main_cambios, d, {'GITHUB_OUTPUT': sal[1]}, bajar=se_rompe) == 0 and leer(sal[1]) == 'cambios=[]\n',
           'si el sitio no contesta nada, termina bien y la lista queda vacia')
        ok(callado(main_cambios, d, {'GITHUB_OUTPUT': sal[2]}, bajar=nada) == 0 and leer(sal[2]) == 'cambios=[]\n',
           'si el sitio dice que no tiene ninguna pagina, no las avisa como nuevas')
        ok(callado(main_cambios, os.path.join(d, 'no-hay'), {'GITHUB_OUTPUT': sal[3]}, bajar=se_rompe) == 0 and not os.path.exists(sal[3]),
           'sin la portada no compara y termina bien')
        ok(callado(main_avisar, d, {'CAMBIOS': '[]'}) == 0 and callado(main_avisar, d, {'CAMBIOS': 'roto'}) == 0
           and callado(main_avisar, d, {}) == 0, 'sin lista, o con la lista rota, no avisa y termina bien')
        av, es = serie(503, 200)
        ok(callado(main_avisar, d, {'CAMBIOS': '["%sproducto/uno/"]' % pub}, avisar=av, dormir=es.append) == 0 and es == [ESPERAS[0]],
           'con lista, avisa (insistiendo) y termina bien aunque IndexNow falle una vez')

    archivo = os.path.join(RAIZ, CLAVE + '.txt')
    ok(re.match(r'^[0-9a-f]{32}$', CLAVE) and os.path.isfile(archivo) and leer(archivo) == CLAVE,
       'la clave esta publicada en la raiz, en un archivo con su nombre y sin nada mas')
    ok(re.search(r'(?m)^Allow: /%s\.txt$' % CLAVE, leer(os.path.join(RAIZ, 'robots.txt'))), 'robots.txt deja leer la clave')
    print('\n%d falla(s)' % len(fallas) if fallas else '\nTODO OK')
    return 1 if fallas else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
