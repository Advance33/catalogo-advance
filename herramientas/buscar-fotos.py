# -*- coding: utf-8 -*-
"""Busca sola las fotos que faltan en los catalogos de los fabricantes.

    python herramientas/buscar-fotos.py

Deja dos archivos en _fotos-buscadas/:

    candidatas.txt   las que encontro, listas para  bajar-fotos.py
    a-mano.txt       las que NO, con su categoria, para conseguirlas Pedro

La idea es que lo manual sea el resto, no el metodo.

COMO DECIDE QUE UNA FOTO ES DE ESE LENTE
Por la FIRMA NUMERICA: las focales y las aperturas. Un lente es sus
numeros -- "24-70mm F/2.8" no es "24-70mm F/4" ni "24-105mm F/2.8" --, y
los fabricantes ponen esos numeros en el nombre del archivo:

    Nikon   z_400mmf45_vr_s.jpg        ->  focal 400, apertura 4.5
    Sigma   a022_24_14_product_img01   ->  linea a022, focal 24, apertura 1.4

Las aperturas se comparan SIN el punto ("4.5" y "45" son lo mismo) para no
tener que adivinar como las escribe cada uno.

Y la regla que hace que esto sea seguro: si a un producto le corresponde MAS
DE UNA candidata, no se elige ninguna -- se manda a mano. Empatar es no
saber, y una foto elegida al azar entre dos lentes parecidos es justo el
error caro. Lo mismo si no hay ninguna.

Encontrarla NO alcanza para publicarla: bajar-fotos.py arma una hoja de
contacto y alguien la mira. Esto propone; el ojo confirma.
"""
import io
import os
import re
import sys
import gzip
import urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
sys.path.insert(0, AQUI)
sys.path.insert(0, RAIZ)
import catalogo_maestro as CM                 # noqa: E402

CARPETA = os.path.join(RAIZ, '_fotos-buscadas')
FOTOS = os.path.join(RAIZ, 'fotos')
SALIDA = os.path.join(CARPETA, 'candidatas.txt')
A_MANO = os.path.join(CARPETA, 'a-mano.txt')
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      'Accept-Encoding': 'gzip'}

# De donde sale el catalogo de cada marca. Medido el 14/09/2026.
FUENTES = {
    'Nikon': [
        'https://imaging.nikon.com/imaging/lineup/lens/z-mount/',
        'https://imaging.nikon.com/imaging/lineup/lens/f-mount/',
        'https://imaging.nikon.com/imaging/lineup/mirrorless/',
        'https://imaging.nikon.com/imaging/lineup/dslr/',
    ],
    'Sigma': [
        'https://www.sigma-global.com/en/lenses/',
    ],
}


def bajar(url):
    try:
        r = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40)
        datos = r.read()
        if r.headers.get('Content-Encoding') == 'gzip':
            datos = gzip.decompress(datos)
        return datos.decode('utf-8', 'ignore')
    except Exception:
        return ''


def numeros(texto):
    """Las focales y las aperturas, como los escribe cualquiera.

    "24-70mm F/2.8"        -> focales ('24','70')   aperturas ('28',)
    "100-400mm F/5-6.3"    -> focales ('100','400') aperturas ('5','63')
    """
    t = texto.lower().replace(',', '.')
    focales, aperturas = [], []
    for m in re.finditer(r'(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*mm', t):
        focales += [g for g in m.groups() if g]
    for m in re.finditer(r'f\s*/?\s*(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?', t):
        aperturas += [g for g in m.groups() if g]
    limpio = lambda xs: tuple(x.replace('.', '').lstrip('0') or '0' for x in xs)
    return tuple(focales), limpio(aperturas)


def del_archivo(nombre):
    """Lo mismo, pero leyendo el nombre de archivo del fabricante.

    z_100-400mmf45-56_vr_s   ->  ('100','400') ('45','56')
    a022_24_14_product_img01 ->  ('24',)       ('14',)
    """
    n = nombre.lower()
    n = re.sub(r'_product_img\d+$', '', os.path.splitext(n)[0])
    if 'mm' in n:                                   # estilo Nikon
        return numeros(n.replace('mmf', 'mm f/'))
    partes = [p for p in n.split('_') if p]         # estilo Sigma
    if partes and re.match(r'^[a-z]+\d+$', partes[0]):
        partes = partes[1:]
    partes = [p for p in partes if p.isdigit()]
    if len(partes) < 2:
        return (), ()
    return tuple(partes[:-1]), (partes[-1],)


def linea_del_producto(texto):
    """ART, Contemporary o Sports, que es lo que la firma numerica no ve.

    El 85mm F/1.4 ART y el 85mm F/1.4 EX son el mismo numero y otro lente,
    con otro precio. Devuelve la inicial que usa Sigma, u 'otra' si nombra
    una linea que no es ninguna de las tres.
    """
    t = ' %s ' % (texto or '').lower()
    if 'art' in t.split():
        return 'a'
    if 'contemporary' in t or ' c ' in t:
        return 'c'
    if 'sports' in t or ' s ' in t:
        return 's'
    if ' ex ' in t:
        return 'otra'
    return None


def linea_del_archivo(nombre):
    m = re.match(r'^([acs])\d+_', os.path.basename(nombre).lower())
    return m.group(1) if m else None


def montura_ok(producto, url):
    """Que el lente de la foto entre en la camara que dice el nombre.

    Un fabricante vende el mismo numero DOS VECES: el viejo para reflex y
    el nuevo para mirrorless. El Sigma 85mm F/1.4 DG HSM (reflex) y el DG DN
    (mirrorless) son 85mm F/1.4 los dos, y son otro lente y otro precio.
    El nombre del archivo no lo dice, asi que lo decide la montura:

        dice RF, Z, E, L, X  ->  mirrorless
        dice EF, AF, HSM     ->  reflex
        no dice nada         ->  a mano, que es lo unico honesto

    Nikon lo tiene mas facil: separa el catalogo en z-mount y f-mount, asi
    que alcanza con que la direccion y el nombre digan lo mismo.
    """
    t = ' %s ' % (producto or '').lower()
    if '/z-mount/' in url:
        return ' z ' in t
    if '/f-mount/' in url:
        return ' z ' not in t
    if re.search(r'\bhsm\b|\bef\b|\baf\b|\bdc hsm\b', t):
        return False
    return bool(re.search(r'\brf\b|\bz\b|\be\b|\bl\b|\bx\b|mirrorless|\bdn\b', t))


def candidatas_de(marca):
    """{ (focales, aperturas): [urls] } de todo lo que publica la marca."""
    mapa = {}
    for url in FUENTES.get(marca, []):
        html = bajar(url)
        base = re.match(r'(https?://[^/]+)', url).group(1)
        for src in set(re.findall(r'(?:src|data-src)="([^"]+\.(?:jpg|png))"', html)):
            if re.search(r'icon|logo|banner|_kv\d|category', src, re.I):
                continue
            firma = del_archivo(os.path.basename(src))
            if not firma[0] or not firma[1]:
                continue
            entera = src if src.startswith('http') else base + src
            mapa.setdefault(firma, [])
            if entera not in mapa[firma]:
                mapa[firma].append(entera)
    return mapa


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    os.makedirs(CARPETA, exist_ok=True)
    maestro = CM.leer()

    faltan = [v for v in maestro
              if not (v.get('Baja') or '').strip()
              and not os.path.exists(os.path.join(FOTOS, v['CODIGO_VAR'] + CM.EXT))]
    print('Faltan %d fotos en todo el catalogo.' % len(faltan))

    hallazgos, a_mano = [], []
    for marca in sorted(FUENTES):
        delamarca = [v for v in faltan if (v.get('Marca') or '').strip() == marca]
        if not delamarca:
            continue
        mapa = candidatas_de(marca)
        print('\n%s: %d fotos faltantes, %d productos en su sitio'
              % (marca, len(delamarca), len(mapa)))
        for v in delamarca:
            firma = numeros(v.get('Producto') or '')
            nuestra = linea_del_producto(v.get('Producto'))
            posibles = [u for u in mapa.get(firma, [])
                        if nuestra is None or linea_del_archivo(u) is None
                        or linea_del_archivo(u) == nuestra]
            monturables = [u for u in posibles if montura_ok(v.get('Producto'), u)]
            if len(monturables) == 1:
                hallazgos.append((v, monturables[0], firma))
            elif posibles and not monturables:
                a_mano.append((v, 'el nombre no dice la montura'))
            else:
                porque = ('%d candidatas, empatan' % len(monturables)) if monturables else 'no esta en su sitio'
                a_mano.append((v, porque))

    # Y al reves: una misma foto no puede ser de dos productos distintos.
    # Ese es el error que partio tres anteojos Wayfarer en el mismo codigo.
    cuantos = {}
    for v, url, _ in hallazgos:
        cuantos[url] = cuantos.get(url, 0) + 1
    repetidas = [(v, 'la misma foto le toca a %d productos' % cuantos[url])
                 for v, url, _ in hallazgos if cuantos[url] > 1]
    if repetidas:
        hallazgos = [h for h in hallazgos if cuantos[h[1]] == 1]
        a_mano += repetidas
        print('\n   %d descartadas: una foto para mas de un producto' % len(repetidas))
    for v, url, _ in hallazgos:
        print('   %-12s %-42s  <- %s'
              % (v['CODIGO_VAR'], (v.get('Producto') or '')[:42], os.path.basename(url)))

    otras = [v for v in faltan if (v.get('Marca') or '').strip() not in FUENTES]
    a_mano += [(v, 'no tenemos de donde bajarla') for v in otras]

    if hallazgos:
        with io.open(SALIDA, 'w', encoding='utf-8') as f:
            f.write('# Lo que encontro buscar-fotos.py. MIRAR la hoja de contacto\n')
            f.write('# de bajar-fotos.py antes de aplicar: esto propone, el ojo confirma.\n\n')
            for v, url, firma in hallazgos:
                f.write('%-12s %s   # %s | focal %s apertura %s\n'
                        % (v['CODIGO_VAR'], url, (v.get('Producto') or '')[:40],
                           '-'.join(firma[0]), '-'.join(firma[1])))

    with io.open(A_MANO, 'w', encoding='utf-8') as f:
        f.write('LAS QUE HAY QUE CONSEGUIR A MANO -- %d fotos\n' % len(a_mano))
        f.write('=' * 56 + '\n\n')
        porcat = {}
        for v, porque in a_mano:
            porcat.setdefault((v.get('Categoria') or 'sin categoria').strip(), []).append((v, porque))
        for cat in sorted(porcat, key=lambda c: -len(porcat[c])):
            f.write('\n%s  (%d)\n%s\n' % (cat.upper(), len(porcat[cat]), '-' * 56))
            for v, porque in porcat[cat]:
                color = (v.get('Variante') or '').strip()
                f.write('  %-12s %-46s %-16s %s\n'
                        % (v['CODIGO_VAR'], (v.get('Producto') or '')[:46], color[:16], porque))

    print('\n%d encontradas - %d a mano' % (len(hallazgos), len(a_mano)))
    if hallazgos:
        print('\n   %s' % SALIDA)
        print('   Ahora:  python herramientas/bajar-fotos.py     (y MIRAR la hoja)')
    print('   %s' % A_MANO)
    return 0


if __name__ == '__main__':
    sys.exit(main())
