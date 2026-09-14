# -*- coding: utf-8 -*-
"""Trae al catalogo las fotos que Pedro pego en el panel.

    python herramientas/traer-del-panel.py                prepara y muestra
    python herramientas/traer-del-panel.py --aplicar      ademas las guarda

El panel guarda cada foto en su base con la imagen adentro, ademas del
codigo, el producto y el color que tenia la parada donde se pego. Este
comando lee esos documentos -- bajados a _panel/bajadas/fotos con la accion
read_db -- y deja en fotos/ las que faltan.

NUNCA PISA UNA FOTO QUE YA EXISTA. Si una esta mal hay que sacarla a mano
primero: pisar sin querer es como se pierde una foto buena.

QUE FRENA, Y POR QUE
  · codigo que no es una variante viva del catalogo -- suele ser una foto
    pegada antes de que el producto se partiera en colores, y hoy le
    corresponde a otro archivo;
  · dos colores del MISMO producto con la imagen identica, byte por byte:
    o se pego dos veces la misma, o uno de los dos colores no era ese. Es
    el error que este proyecto entero existe para evitar.

Y arma una hoja de contacto, porque el color lo dice el texto de la parada
y la foto la eligio una persona apurada. Mirarlas juntas lleva un minuto.
"""
import io
import os
import sys
import json
import base64
import hashlib
import importlib.util

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
sys.path.insert(0, AQUI)
sys.path.insert(0, RAIZ)
import catalogo_maestro as CM                 # noqa: E402


def _traer(nombre, archivo):
    ruta = os.path.join(AQUI, archivo)
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


BF = _traer('bajar_fotos', 'bajar-fotos.py')   # la hoja de contacto es la misma

BAJADAS = os.path.join(RAIZ, '_panel', 'bajadas', 'fotos')
RECHAZADAS = os.path.join(RAIZ, '_panel', 'rechazadas.txt')
LISTAS = os.path.join(RAIZ, '_panel', 'listas')
FOTOS = os.path.join(RAIZ, 'fotos')
HOJA = os.path.join(RAIZ, '_panel', '_hoja-de-contacto.jpg')
APLICAR = '--aplicar' in sys.argv


def leer_rechazadas():
    """Las que ya se miraron y mostraban otra cosa.

    Se anotan en _panel/rechazadas.txt -- un codigo por linea, y despues de
    una almohadilla por que -- para que no vuelvan a entrar en la proxima
    corrida. Sin esto habria que acordarse cuales eran, y no hay forma.
    """
    if not os.path.exists(RECHAZADAS):
        return set()
    salida = set()
    for linea in io.open(RECHAZADAS, encoding='utf-8'):
        linea = linea.split('#', 1)[0].strip()
        if linea:
            salida.add(linea.replace(CM.EXT, ''))
    return salida


def documentos():
    if not os.path.isdir(BAJADAS):
        return None
    salida = []
    for nombre in sorted(os.listdir(BAJADAS)):
        if not nombre.endswith('.json'):
            continue
        try:
            salida.append(json.loads(io.open(os.path.join(BAJADAS, nombre),
                                             encoding='utf-8').read()))
        except Exception as e:
            print('   %s no se pudo leer (%s)' % (nombre, str(e)[:40]))
    return salida


def imagen_de(doc):
    """El JPEG que viaja como texto adentro del documento."""
    datos = doc.get('datos') or ''
    if ',' not in datos:
        return None
    try:
        return base64.b64decode(datos.split(',', 1)[1])
    except Exception:
        return None


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    docs = documentos()
    if docs is None:
        print('Falta %s' % BAJADAS)
        print('Primero hay que bajar la base del panel con la accion read_db.')
        return 2
    os.makedirs(LISTAS, exist_ok=True)

    vivas = {v['CODIGO_VAR']: v for v in CM.leer() if not (v.get('Baja') or '').strip()}
    rechazadas = leer_rechazadas()
    nuevas, ya, quejas, avisos, saltadas = [], 0, [], [], 0
    porhuella = {}

    for doc in docs:
        archivo = (doc.get('archivo') or '').strip()
        if not archivo.lower().endswith(CM.EXT):
            quejas.append('%s: no dice a que archivo va' % (archivo or '(sin nombre)'))
            continue
        base = archivo[:-len(CM.EXT)]
        if base not in vivas:
            quejas.append('%s: no es una variante viva del catalogo (%s)'
                          % (archivo, (doc.get('producto') or '')[:34]))
            continue
        if os.path.exists(os.path.join(FOTOS, archivo)):
            ya += 1
            continue
        if base in rechazadas:
            saltadas += 1
            continue
        crudo = imagen_de(doc)
        if not crudo:
            quejas.append('%s: el documento no trae la imagen' % archivo)
            continue
        try:
            from PIL import Image
            im = Image.open(io.BytesIO(crudo))
            ancho, alto = im.size
            if (ancho, alto) != (BF.LADO, BF.LADO):
                im = BF.a_cuadrado(BF.sobre_blanco(im))
            else:
                im = BF.sobre_blanco(im)
            buf = io.BytesIO()
            im.save(buf, 'JPEG', quality=90, optimize=True)
            crudo = buf.getvalue()
        except Exception as e:
            quejas.append('%s: no se pudo preparar (%s)' % (archivo, str(e)[:40]))
            continue
        destino = os.path.join(LISTAS, archivo)
        io.open(destino, 'wb').write(crudo)
        nuevas.append((archivo, destino))
        porhuella.setdefault(hashlib.sha256(crudo).hexdigest(), []).append(archivo)

    # La misma imagen en varias paradas. Entre colores de un mismo producto es
    # error seguro y se frena. Entre productos distintos puede estar bien -- dos
    # kits con el mismo cargador -- pero tambien es como se cuela la foto de otra
    # cosa, asi que se avisa para mirarla.
    repetidas = set()
    for huella, archivos in porhuella.items():
        if len(archivos) < 2:
            continue
        porproducto = {}
        for a in archivos:
            porproducto.setdefault(CM.partir(a[:-len(CM.EXT)])[0], []).append(a)
        # Los que comparten imagen Y producto se frenan, aunque en el grupo
        # haya ademas otros productos: basta con que dos colores de uno solo
        # se repitan para que uno de los dos este mostrando lo del otro.
        hermanos = [a for mismos in porproducto.values() if len(mismos) > 1
                    for a in mismos]
        if hermanos:
            quejas.append('%s: son la MISMA imagen y son colores del mismo producto'
                          % ', '.join(sorted(hermanos)))
            repetidas.update(hermanos)
        if len(porproducto) > 1:
            avisos.append('%s: la misma imagen en %d productos distintos. Mirala: si uno '
                          'de ellos no es eso, ahi esta la foto de otra cosa'
                          % (', '.join(sorted(archivos)), len(productos)))
    if repetidas:
        for archivo, ruta in [n for n in nuevas if n[0] in repetidas]:
            os.remove(ruta)
        nuevas = [n for n in nuevas if n[0] not in repetidas]

    meta = {v['CODIGO_VAR'] + CM.EXT: {'prod': v.get('Producto'), 'color': v.get('Variante')}
            for v in vivas.values()}
    for archivo, _ in nuevas:
        print('   %-15s %s' % (archivo, (meta.get(archivo, {}).get('prod') or '')[:44]))

    print()
    print('%d nuevas - %d ya tenian foto - %d frenadas - %d rechazadas antes'
          % (len(nuevas), ya, len(quejas), saltadas))
    for q in quejas:
        print('   %s' % q)
    for a in avisos:
        print('   MIRAR: %s' % a)

    if nuevas:
        BF.HOJA = HOJA
        BF.hoja_de_contacto(nuevas, meta)
        print()
        print('Hoja de contacto: %s' % HOJA)
        print('MIRALA: el color lo dice el texto de la parada, la foto la eligio alguien.')

    if not APLICAR:
        print()
        print('Para guardarlas:')
        print('   python herramientas/traer-del-panel.py --aplicar')
        return 1 if quejas else 0

    import shutil
    for archivo, ruta in nuevas:
        shutil.copy2(ruta, os.path.join(FOTOS, archivo))
    print()
    print('%d fotos guardadas. Ahora:  python verificar-fotos.py' % len(nuevas))
    return 1 if quejas else 0


if __name__ == '__main__':
    sys.exit(main())
