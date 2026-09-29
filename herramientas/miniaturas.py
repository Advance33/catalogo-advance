# -*- coding: utf-8 -*-
"""Las fotos chicas de la grilla y de la portada.

    python3 herramientas/miniaturas.py           las que falten o esten viejas
    python3 herramientas/miniaturas.py --todas   las rehace todas

POR QUE EXISTE
La portada de un celular bajaba 73 fotos de 900x900 (2,1 MB) para mostrarlas
del tamano de una estampilla: los rubros, la vidriera, las novedades y lo
mirado. Medido el 17/09/2026 con la pagina de verdad.

Estas copias de 400 px pesan la cuarta parte y se ven igual en ese tamano. La
de 900 queda para la ficha, que es donde el cliente mira el producto de cerca.

Viven en fotos/mini/ con EL MISMO NOMBRE que la grande (AT-0065-02.jpg), asi
la web arma una direccion de la otra sin tener que consultar ninguna lista.

Se regeneran solas al publicar: verificar-fotos.py llama a actualizar() antes
de escribir el indice, y una foto nueva o cambiada se lleva su chica al toque.

CAMBIADA POR EL CONTENIDO, NO POR LA FECHA (29/09)
Hasta el 29/09 la chica se rehacia si la grande tenia fecha mas nueva. Pero
en la Mac, copiar desde el Finder, con cp -p o bajando de Google Drive
conserva la fecha ORIGINAL del archivo: pisar fotos/AT-XXXX.jpg con una
corregida de fecha vieja dejaba la chica anterior, y el cliente veia la foto
mala en la grilla y la buena recien en la ficha. Ahora cada chica guarda en
fotos/mini/huellas.json el md5 de la grande con que se hizo, y se rehace
cuando no coincide. Va commiteado junto a las chicas, asi otra copia del
repo (un worktree) no las rehace todas. Si se pierde, la primera corrida lo
vuelve a sembrar con la regla de la fecha, que para lo que ya estaba alcanza
(el 29/09 las 721 chicas coincidian con su grande, comparadas pixel a pixel).
"""
import hashlib
import io
import json
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
FOTOS = os.path.join(RAIZ, 'fotos')
MINIS = os.path.join(FOTOS, 'mini')
HUELLAS = os.path.join(MINIS, 'huellas.json')
LADO = 400
CALIDAD = 78


def huella(ruta):
    """El md5 del archivo: la misma huella que usa verificar-fotos.py."""
    with open(ruta, 'rb') as fh:
        return hashlib.md5(fh.read()).hexdigest()


def leer_huellas():
    """{archivo: md5 de la grande con que se hizo su chica}, o None si todavia
    no hay registro (o esta roto: se vuelve a sembrar)."""
    try:
        with io.open(HUELLAS, encoding='utf-8') as fh:
            d = json.load(fh)
        return d if isinstance(d, dict) else None
    except (OSError, ValueError):
        return None


def guardar_huellas(huellas):
    # newline='\r\n' y sort_keys, como fotos/indice.json: sale igual desde
    # cualquier maquina y el diff muestra solo lo que cambio.
    with io.open(HUELLAS, 'w', encoding='utf-8', newline='\r\n') as fh:
        json.dump(huellas, fh, ensure_ascii=False, indent=0, sort_keys=True)


def una(origen, destino):
    from PIL import Image
    im = Image.open(origen)
    if im.mode != 'RGB':
        im = im.convert('RGB')
    im.thumbnail((LADO, LADO), Image.LANCZOS)
    im.save(destino, 'JPEG', quality=CALIDAD, optimize=True, progressive=True)


def actualizar(rehacer=False, avisar=None):
    """Deja fotos/mini/ al dia. Devuelve (hechas, borradas, total)."""
    os.makedirs(MINIS, exist_ok=True)
    grandes = [f for f in os.listdir(FOTOS) if f.lower().endswith('.jpg')]
    antes = leer_huellas()
    sembrar = antes is None
    huellas = dict(antes or {})
    hechas = 0
    for f in sorted(grandes):
        g, m = os.path.join(FOTOS, f), os.path.join(MINIS, f)
        h = huella(g)
        # Si la grande cambio desde que se hizo la chica, la chica quedo
        # vieja: es justo el caso de una foto corregida, y mostrar la vieja
        # seria peor que no tener ninguna. Se mira el contenido: la fecha no
        # sirve (ver arriba).
        if not rehacer and os.path.exists(m):
            if huellas.get(f) == h:
                continue
            if sembrar and os.path.getmtime(m) >= os.path.getmtime(g):
                huellas[f] = h
                continue
        try:
            una(g, m)
            huellas[f] = h
            hechas += 1
            if avisar:
                avisar(f)
        except Exception as e:
            print('   no se pudo con %s: %s' % (f, e))
    # Las que ya no tienen grande no sirven para nada
    borradas = 0
    for f in os.listdir(MINIS):
        if f.lower().endswith('.jpg') and f not in set(grandes):
            os.remove(os.path.join(MINIS, f))
            borradas += 1
    huellas = {k: v for k, v in huellas.items() if k in set(grandes)}
    if huellas != antes:
        guardar_huellas(huellas)
    return hechas, borradas, len(grandes)


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    hechas, borradas, total = actualizar('--todas' in sys.argv)
    peso = lambda d: sum(os.path.getsize(os.path.join(d, f))
                         for f in os.listdir(d) if f.lower().endswith('.jpg'))
    print('%d chicas nuevas · %d borradas · %d fotos en total' % (hechas, borradas, total))
    if total:
        print('   grandes  %6.1f MB   (%d KB cada una)'
              % (peso(FOTOS) / 1048576, peso(FOTOS) // 1024 // total))
        print('   chicas   %6.1f MB   (%d KB cada una)'
              % (peso(MINIS) / 1048576, peso(MINIS) // 1024 // total))
    return 0


if __name__ == '__main__':
    sys.exit(main())
