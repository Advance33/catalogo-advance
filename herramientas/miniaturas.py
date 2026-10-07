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

LAS COPIAS SIN FONDO (05/10/2026)
Cada foto tiene ademas dos copias SIN FONDO, con transparencia, que son las que
muestra la web:
  fotos/mini/sinfondo/AT-XXXX.webp   la chica: la grilla, los rubros, las
                                     vitrinas, las novedades, lo mirado
  fotos/sinfondo/AT-XXXX.webp        la grande, de 800 px: la ficha y la lupa
Primero se hizo solo la chica, con la idea de que en la ficha (fondo casi
blanco, --ficha-bg) el blanco de la toma no se notaba. Si se notaba: en el
iPhone de Benja la ficha mostraba el recuadro blanco, y la mezcla que lo
borraba ademas hacia desaparecer la foto al bajar dentro de la ficha. La
grande sin fondo pesa 80 KB contra los 58 del jpg, y se baja de a una.

Hasta el 05/10 el fondo blanco del proveedor se borraba en el navegador, con
mix-blend-mode:multiply contra el lila. En la compu andaba; en el iPhone de
Benja (Chrome de iPhone, que por dentro es Safari) cada producto se veia en un
cuadrado blanco. En una pagina suelta la mezcla andaba tambien en su iPhone:
es algo de como Safari arma las capas de la pagina entera, y no se pudo aislar
desde la Mac. Con el fondo ya transparente en el archivo no hay nada que
mezclar, y se ve igual en cualquier navegador.

Como se saca el fondo: "de color a transparencia" desde el color del fondo,
que se mira en el borde de cada foto (color_del_fondo: el blanco, o un gris
claro parejo como el de las Ray-Ban). Lo que esta a UMBRAL_FONDO o menos de
ese color queda transparente del todo; lo demas, tanto mas opaco cuanto mas
lejos.
Es lo mismo que hacia multiply: un producto blanco (AirPods, Pencil, la Xbox
Series S) conserva sus sombras y contornos y deja ver el lila en lo blanco.
Los .jpg siguen siendo los originales: los usan WhatsApp (p/), Pancho y
fotos/indice.json, y estas copias se rehacen con su chica cuando cambia la
grande (misma huella).

LOS COLORES PASTEL QUEDAN OPACOS (07/10/2026)
"De color a transparencia" volvia medio transparente todo lo claro, tambien
ADENTRO del producto: un iPhone celeste (Glacier, Mist Blue, Sky Blue) dejaba
ver el lila de la pagina y se veia lavanda, y un rosa se veia lila. El cliente
elegia un color que no era (examen de la linea iPhone, Benja). Ahora el alfa
nunca baja de lo que pide el COLOR del pixel (croma: el canal mas alto menos el
mas bajo): un gris o un blanco (croma ~0) sigue igual que antes, con sus
sombras y el lila en lo blanco; un pixel con color (croma de CROMA_DESDE a
CROMA_HASTA) va de transparente a opaco. Los productos de color fuerte ya eran
opacos y no cambian.

Calidad 65 con el alfa a 80 (medido el 05/10 en 30 fotos): 26 KB cada una
contra 12 KB del jpg chico. El alfa a 75 ya dejaba escalones en las sombras
de los productos blancos (AirPods); a 80 no se distingue del alfa sin perdida.
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
# Las chicas sin fondo (ver arriba)
SIN_FONDO_MINI = os.path.join(MINIS, 'sinfondo')
SIN_FONDO_GRANDE = os.path.join(FOTOS, 'sinfondo')
LADO_SIN_FONDO_GRANDE = 800
EXT_SIN_FONDO = '.webp'
UMBRAL_FONDO = 10
# Desde que croma un pixel cuenta como color y desde cual es opaco (07/10)
CROMA_DESDE, CROMA_HASTA = 6, 28
CALIDAD_SIN_FONDO = 65
CALIDAD_ALFA = 80


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


def color_del_fondo(im):
    """El color del fondo de la toma, mirando el borde. Casi todas (657 de 728
    el 05/10) son blanco puro, pero algunas vienen sobre un gris claro parejo
    (las Ray-Ban Meta, 242): con el blanco fijo les quedaba un recuadro gris.
    Si el borde es de un color CLARO y parejo (6 de cada 10 puntos a 12 o menos
    de la mediana) se borra ese color; si no (fondo oscuro, una escena, el
    producto tocando el borde), el blanco, como siempre. Un fondo oscuro no se
    toca: sacarlo se comeria las partes negras del producto."""
    w, h = im.size
    puntos = [im.getpixel((x, y)) for x in range(2, w - 2, 3) for y in (2, h - 3)]
    puntos += [im.getpixel((x, y)) for y in range(2, h - 2, 3) for x in (2, w - 3)]
    mediana = tuple(sorted(p[i] for p in puntos)[len(puntos) // 2] for i in range(3))
    parejos = sum(1 for p in puntos if max(abs(p[i] - mediana[i]) for i in range(3)) <= 12)
    if parejos < len(puntos) * 0.6 or min(mediana) < 200 or min(mediana) >= 250:
        return (255, 255, 255)
    return mediana


def sin_fondo(im):
    """La foto con el color del fondo hecho transparencia (RGBA). Todo con
    operaciones de Pillow, sin recorrer pixel por pixel: 0,1 s por foto."""
    from PIL import Image, ImageChops, ImageMath
    if im.mode != 'RGB':
        im = im.convert('RGB')
    fondo = color_del_fondo(im)
    r, g, b = im.split()
    # Que tan lejos del fondo esta cada pixel, hacia lo oscuro, de 0 a 255: lo
    # dice el canal que mas se aleja. Con el fondo blanco es 255 menos el
    # canal mas oscuro. Lo mas claro que el fondo (un brillo) cuenta como fondo.
    lejos = [c.point(lambda v, f=f: round(max(0, f - v) * 255 / f)) for c, f in zip((r, g, b), fondo)]
    maximo = ImageChops.lighter(ImageChops.lighter(lejos[0], lejos[1]), lejos[2])
    alfa = maximo.point(lambda v: 0 if v <= UMBRAL_FONDO
                        else min(255, round((v - UMBRAL_FONDO) * 255 / (255 - UMBRAL_FONDO))))
    # Lo que tiene color no se transparenta (07/10, ver arriba): un celeste
    # claro dejaba ver el lila de la pagina y se veia lavanda.
    alto = ImageChops.lighter(ImageChops.lighter(r, g), b)
    bajo = ImageChops.darker(ImageChops.darker(r, g), b)
    piso = ImageChops.subtract(alto, bajo).point(
        lambda v: 0 if v <= CROMA_DESDE
        else min(255, round((v - CROMA_DESDE) * 255 / (CROMA_HASTA - CROMA_DESDE))))
    alfa = ImageChops.lighter(alfa, piso)
    # El color que, puesto con ese alfa sobre el fondo, da el pixel original
    canales = [ImageMath.lambda_eval(
        lambda e, f=f: e['convert'](e['max'](e['min'](
            f - (f - e['float'](e['c'])) * 255 / e['max'](e['float'](e['a']), 1), 255), 0), 'L'),
        c=c, a=alfa) for c, f in zip((r, g, b), fondo)]
    return Image.merge('RGBA', canales + [alfa])


def una_sin_fondo(origen, destino, lado=None):
    from PIL import Image
    im = Image.open(origen)
    if lado:
        im = im.convert('RGB')
        im.thumbnail((lado, lado), Image.LANCZOS)
    sin_fondo(im).save(destino, 'WEBP', quality=CALIDAD_SIN_FONDO,
                                       alpha_quality=CALIDAD_ALFA, method=6)


def nombre_sin_fondo(f):
    """AT-0065-02.jpg -> AT-0065-02.webp"""
    return os.path.splitext(f)[0] + EXT_SIN_FONDO


def actualizar(rehacer=False, avisar=None):
    """Deja fotos/mini/ y sus copias sin fondo al dia. Devuelve (hechas,
    borradas, total): una foto cuenta como hecha si se rehizo su chica o su
    copia sin fondo."""
    os.makedirs(MINIS, exist_ok=True)
    os.makedirs(SIN_FONDO_MINI, exist_ok=True)
    os.makedirs(SIN_FONDO_GRANDE, exist_ok=True)
    grandes = [f for f in os.listdir(FOTOS) if f.lower().endswith('.jpg')]
    antes = leer_huellas()
    sembrar = antes is None
    huellas = dict(antes or {})
    hechas = 0
    for f in sorted(grandes):
        g, m = os.path.join(FOTOS, f), os.path.join(MINIS, f)
        sm = os.path.join(SIN_FONDO_MINI, nombre_sin_fondo(f))
        sg = os.path.join(SIN_FONDO_GRANDE, nombre_sin_fondo(f))
        h = huella(g)
        # Si la grande cambio desde que se hizo la chica, la chica quedo
        # vieja: es justo el caso de una foto corregida, y mostrar la vieja
        # seria peor que no tener ninguna. Se mira el contenido: la fecha no
        # sirve (ver arriba). La copia sin fondo va con la chica: si ella se
        # rehace, la copia tambien.
        al_dia = False
        if not rehacer and os.path.exists(m):
            if huellas.get(f) == h:
                al_dia = True
            elif sembrar and os.path.getmtime(m) >= os.path.getmtime(g):
                huellas[f] = h
                al_dia = True
        if al_dia and os.path.exists(sm) and os.path.exists(sg):
            continue
        try:
            if not al_dia:
                una(g, m)
                huellas[f] = h
            if not al_dia or not os.path.exists(sm):
                una_sin_fondo(m, sm)
            if not al_dia or not os.path.exists(sg):
                una_sin_fondo(g, sg, LADO_SIN_FONDO_GRANDE)
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
    validas = {nombre_sin_fondo(f) for f in grandes}
    for carpeta in (SIN_FONDO_MINI, SIN_FONDO_GRANDE):
        for f in os.listdir(carpeta):
            if f.lower().endswith(EXT_SIN_FONDO) and f not in validas:
                os.remove(os.path.join(carpeta, f))
    huellas = {k: v for k, v in huellas.items() if k in set(grandes)}
    if huellas != antes:
        guardar_huellas(huellas)
    return hechas, borradas, len(grandes)


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    hechas, borradas, total = actualizar('--todas' in sys.argv)
    peso = lambda d, ext='.jpg': sum(os.path.getsize(os.path.join(d, f))
                                     for f in os.listdir(d) if f.lower().endswith(ext))
    print('%d fotos rehechas (chica o su copia sin fondo) · %d borradas · %d fotos en total' % (hechas, borradas, total))
    if total:
        print('   grandes  %6.1f MB   (%d KB cada una)'
              % (peso(FOTOS) / 1048576, peso(FOTOS) // 1024 // total))
        print('   chicas   %6.1f MB   (%d KB cada una)'
              % (peso(MINIS) / 1048576, peso(MINIS) // 1024 // total))
        print('   sin fondo %6.1f MB   (%d KB cada una)'
              % (peso(SIN_FONDO_MINI, EXT_SIN_FONDO) / 1048576,
                 peso(SIN_FONDO_MINI, EXT_SIN_FONDO) // 1024 // total))
        print('   sin fondo grandes %6.1f MB   (%d KB cada una)'
              % (peso(SIN_FONDO_GRANDE, EXT_SIN_FONDO) / 1048576,
                 peso(SIN_FONDO_GRANDE, EXT_SIN_FONDO) // 1024 // total))
    return 0


if __name__ == '__main__':
    sys.exit(main())
