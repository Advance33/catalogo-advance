# -*- coding: utf-8 -*-
"""Arma los datos del panel donde Pedro pega las fotos que faltan.

    python herramientas/panel-de-fotos.py

Escribe _panel/faltan.js, que es lo que lee la pagina publicada. Una entrada
por FOTO, no por producto: uno que vende cuatro colores necesita cuatro, y
la ficha dibuja un puntito por cada uno.

Van ordenadas de mas caro a mas barato, que es el orden en que conviene
conseguirlas: la foto de una camara de 5.900 dolares vale mas que la de un
cable.

CONSERVA LO QUE YA SE SABIA. Si una foto se saco del sitio por mostrar otro
producto, el panel lo muestra con la imagen vieja al lado, para poder decidir
mirandola; y si una se pego en el panel y mostraba otra cosa, muestra el
motivo. Las dos cosas las vio una persona y no se deducen de la planilla:
se leen de _fotos-que-estan-mal/ y de _panel/rechazadas.txt.
"""
import io
import os
import re
import sys
import json
import base64
import hashlib

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
sys.path.insert(0, AQUI)
sys.path.insert(0, RAIZ)
import catalogo_maestro as CM                 # noqa: E402
import validar                                # noqa: E402

FOTOS = os.path.join(RAIZ, 'fotos')
CARPETA = os.path.join(RAIZ, '_panel')
SALIDA = os.path.join(CARPETA, 'faltan.js')
MALAS = os.path.join(RAIZ, '_fotos-que-estan-mal')
RECHAZADAS = os.path.join(RAIZ, '_panel', 'rechazadas.txt')
BAJADAS = os.path.join(RAIZ, '_panel', 'bajadas', 'fotos')


def lo_que_ya_se_sabia():
    """Las que se sacaron del sitio por mostrar otro producto.

    Viven en _fotos-que-estan-mal/ con un cuando.json al lado. Se muestran
    chiquitas al lado de la parada para poder decidir MIRANDOLAS: alguna
    puede estar bien y convenir devolverla. Eso no se deduce de la planilla,
    lo vio una persona, asi que se lee de donde quedo guardado.
    """
    if not os.path.isdir(MALAS):
        return {}
    try:
        cuando = json.loads(io.open(os.path.join(MALAS, 'cuando.json'),
                                    encoding='utf-8').read())
    except Exception:
        cuando = {}
    salida = {}
    for nombre in os.listdir(MALAS):
        if not nombre.lower().endswith(CM.EXT):
            continue
        salida[nombre] = {'mini': mini_de(os.path.join(MALAS, nombre)),
                          'cuando': cuando.get(nombre, '')}
    return salida


def leer_rechazos():
    """Las que se pegaron en el panel y mostraban otro producto, con el porque.

    El panel las vuelve a pedir, y decir POR QUE evita que la proxima vez se
    pegue la misma: "dice Blue Trail Loop y la foto es una Ocean Band negra"
    se entiende; "falta esta foto" hace pegar lo mismo de nuevo.
    """
    if not os.path.exists(RECHAZADAS):
        return {}
    salida = {}
    for linea in io.open(RECHAZADAS, encoding='utf-8'):
        if linea.lstrip().startswith('#') or '#' not in linea:
            continue
        datos, porque = linea.split('#', 1)
        partes = datos.split()                  # CODIGO [HUELLA]
        if partes:
            salida[partes[0].replace(CM.EXT, '')] = {
                'porque': porque.strip(),
                'huella': partes[1] if len(partes) > 1 else ''}
    return salida


def bytes_de_la_rechazada(codigo, huella):
    """Cuanto pesa, en la base del panel, la foto que se rechazo.

    El panel guarda cada foto con su peso. Si la que sigue guardada pesa eso,
    es la mala: el panel no la cuenta como hecha y la vuelve a pedir. Si Pedro
    pega otra, el peso cambia y cuenta. Asi no hace falta borrar nada de la
    base -- que ademas desde el 15/09 no deja borrar sin version.
    """
    ruta = os.path.join(BAJADAS, codigo + '.json')
    if not huella or not os.path.exists(ruta):
        return None
    try:
        doc = json.loads(io.open(ruta, encoding='utf-8').read())
        crudo = base64.b64decode((doc.get('datos') or ',').split(',', 1)[1])
    except Exception:
        return None
    if hashlib.sha256(crudo).hexdigest()[:16] != huella:
        return None                          # ya pego otra: esa no es la mala
    return doc.get('bytes')


def para_buscar(marca, producto, variante):
    """El texto para pegar en Google y encontrar la foto de ESA variante.

    Del nombre se saca lo que no ayuda a buscar una imagen y la ensucia: el
    parentesis de colores o de idioma, la memoria ("8/512GB", "16ram"), las
    pulgadas (11.2"), los separadores sueltos (— | ·) y, en los Ray-Ban, la
    cola "F <montura> | L <lente>", que ya viene en la variante. Despues va el
    color, si el nombre no lo dice ya, y la marca una sola vez adelante.

      RAY-BAN META GEN 2 — BLAYZER OPTICS + Trap Dark Love
        -> Ray-Ban Meta Gen 2 Blayzer Optics Trap Dark Love
    """
    t = producto or ''
    if CM.norm(marca).replace(' ', '-') in ('ray-ban', 'rayban'):
        t = re.sub(r'\s+F\s+.*$', '', t)
    t = re.sub(r'\([^)]*\)', ' ', t)
    t = re.sub(r'\b\d+(?:[.,]\d+)?\s*(?:"|”|pulgadas)', ' ', t)
    t = re.sub(r'\b\d+\s*/\s*\d+\s*(?:gb|tb)\b|\b\d+\s*(?:gb|tb|ram)\b', ' ', t, flags=re.I)
    t = re.sub(r'(?<=\s)[—–|·•/]+(?=\s)', ' ', ' ' + t + ' ')
    palabras = t.split()
    # Solo se pasa a minuscula un nombre que viene TODO en mayusculas (como los
    # Ray-Ban de la seccion nueva). Uno normal tiene siglas y numeros romanos
    # que tienen que quedar como estan: "III", "USM", "M/L".
    romano = re.compile(r'^[IVX]+$')
    if palabras and all(not any(c.islower() for c in w) for w in palabras):
        palabras = [w if (any(c.isdigit() for c in w) or romano.match(w) or len(w) < 3)
                    else '-'.join(x[:1] + x[1:].lower() for x in w.split('-'))
                    for w in palabras]
    llano = lambda s: set(re.sub(r'[^a-z0-9]+', ' ', CM.norm(s)).split())
    if marca and not ' '.join(palabras).lower().replace('-', ' ').startswith(marca.lower().replace('-', ' ')):
        palabras = [marca] + palabras
    color = re.sub(r'\s*[·|]\s*', ' ', variante or '').strip()
    if color and not llano(color) <= llano(' '.join(palabras)):
        palabras.append(color)
    return re.sub(r'\s{2,}', ' ', ' '.join(palabras)).strip()


def mini_de(ruta, lado=150):
    """La foto vieja, chiquita, metida en el documento. Chiquita porque viaja
    como texto adentro del archivo y son once."""
    from PIL import Image
    im = Image.open(ruta)
    im.thumbnail((lado, lado), Image.LANCZOS)
    if im.mode != 'RGB':
        im = im.convert('RGB')
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=72)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    os.makedirs(CARPETA, exist_ok=True)

    maestro = CM.leer()
    idx = CM.indexar(maestro)
    try:
        filas = validar.bajar_csv()
    except Exception as e:
        print('No se pudo bajar la planilla: %s' % e)
        return 2

    # De cada codigo, con que fila de la planilla se vende y a cuanto.
    dela_planilla = {}
    for fila in filas:
        cod = CM.codigo_de_la_fila(fila, idx)
        if isinstance(cod, tuple):          # devuelve (codigo, por que via)
            cod = cod[0]
        if not cod:
            continue
        precio = (fila.get('Precio USD') or '').strip()
        ident = (fila.get('ID') or '').strip()
        # Nos quedamos con la mas cara: es la que conviene mostrar primero.
        viejo = dela_planilla.get(cod)
        if not viejo or _num(precio) > _num(viejo[1]):
            dela_planilla[cod] = (ident, precio)

    sabido = lo_que_ya_se_sabia()
    rechazos = leer_rechazos()
    faltan = []
    for v in maestro:
        if (v.get('Baja') or '').strip():
            continue
        archivo = v['CODIGO_VAR'] + CM.EXT
        if os.path.exists(os.path.join(FOTOS, archivo)):
            continue
        cod = v.get('CODIGO') or CM.partir(v['CODIGO_VAR'])[0]
        ident, precio = dela_planilla.get(cod, ('', ''))
        if not ident:
            continue                     # no se vende hoy: no hace falta la foto
        p = {'cod': cod, 'archivo': archivo, 'id': ident,
             'prod': (v.get('Producto') or '').strip(),
             'marca': (v.get('Marca') or '').strip(),
             'cat': (v.get('Categoria') or '').strip(),
             'precio': precio, 'color': (v.get('Variante') or '').strip()}
        p['busqueda'] = para_buscar(p['marca'], p['prod'], p['color'])
        if archivo in sabido:
            p['mala'] = sabido[archivo]
        if v['CODIGO_VAR'] in rechazos:
            r = rechazos[v['CODIGO_VAR']]
            p['rechazo'] = r['porque']
            peso = bytes_de_la_rechazada(v['CODIGO_VAR'], r['huella'])
            if peso:
                p['rechazoBytes'] = peso
        faltan.append(p)

    # cual de cuantas le faltan a ese producto
    porprod = {}
    for p in faltan:
        porprod.setdefault(p['cod'], []).append(p)
    for mismos in porprod.values():
        for i, p in enumerate(mismos, 1):
            p['cual'], p['cuantas'] = i, len(mismos)

    faltan.sort(key=lambda p: (-_num(p['precio']), p['archivo']))
    with io.open(SALIDA, 'w', encoding='utf-8') as f:
        f.write('window.FALTAN = %s;\n' % json.dumps(faltan, ensure_ascii=False))

    porcat = {}
    for p in faltan:
        porcat[p['cat']] = porcat.get(p['cat'], 0) + 1
    print('%d fotos de %d productos' % (len(faltan), len(porprod)))
    for cat in sorted(porcat, key=lambda c: -porcat[c]):
        print('   %-22s %3d' % (cat or 'sin categoria', porcat[cat]))
    print('\n%s' % SALIDA)
    return 0


def _num(texto):
    try:
        return float(re.sub(r'[^\d.]', '', (texto or '').replace(',', '')) or 0)
    except ValueError:
        return 0.0


if __name__ == '__main__':
    sys.exit(main())
