# -*- coding: utf-8 -*-
"""
Mide cuanto del cuadro ocupa el producto en cada foto.

El problema no es la resolucion: son fotos nitidas donde el producto quedo
chico en el medio de un mar blanco, y en la grilla se ve diminuto al lado de
las demas. Se detecta buscando el recuadro de lo que NO es fondo.

  python encuadre.py            ver el informe
  python encuadre.py --arreglar recorta el blanco sobrante y reescala a 900x900

Al arreglar guarda el original en fotos-sin-recortar/ por si hay que volver.
"""
import os, sys, shutil
from PIL import Image, ImageChops

AQUI = os.path.dirname(os.path.abspath(__file__))
FOTOS = os.path.join(AQUI, 'fotos')
BACKUP = os.path.join(AQUI, 'fotos-sin-recortar')
LADO = 900
# Cuanto del ancho/alto ocupa el producto. Por debajo de esto se ve chico.
MINIMO = 0.62
# Margen que se le deja alrededor al recortar, en proporcion al lado
MARGEN = 0.06
# Pixeles reales que tiene que medir el producto en la foto original para que
# recortar valga la pena. Por debajo de esto, recortar es agrandar pixeles: la
# foto se ve mas grande pero mas borrosa, y conviene conseguir otra.
MIN_PIXELES = 520


def caja(im):
    """Recuadro de lo que no es fondo. Devuelve None si la foto es toda fondo."""
    rgb = im.convert('RGB')
    # el color de fondo se toma de la esquina, que casi siempre es fondo liso
    fondo = Image.new('RGB', rgb.size, rgb.getpixel((0, 0)))
    dif = ImageChops.difference(rgb, fondo).convert('L')
    # umbral bajo: los blancos "casi puros" (#F5F5F7 de Apple) tambien son fondo
    return dif.point(lambda p: 255 if p > 18 else 0).getbbox()


def ocupacion(im):
    b = caja(im)
    if not b:
        return 0.0, None
    w, h = im.size
    return max((b[2] - b[0]) / w, (b[3] - b[1]) / h), b


def arreglar(ruta, b):
    im = Image.open(ruta)
    rgb = im.convert('RGB')
    fondo = rgb.getpixel((0, 0))
    lado = max(b[2] - b[0], b[3] - b[1])
    lado = int(lado * (1 + MARGEN * 2))
    cx, cy = (b[0] + b[2]) // 2, (b[1] + b[3]) // 2
    # cuadrado centrado en el producto, sin salirse de la imagen
    x0, y0 = cx - lado // 2, cy - lado // 2
    recorte = Image.new('RGB', (lado, lado), fondo)
    recorte.paste(rgb.crop((max(0, x0), max(0, y0),
                            min(rgb.width, x0 + lado), min(rgb.height, y0 + lado))),
                  (max(0, -x0), max(0, -y0)))
    recorte.resize((LADO, LADO), Image.LANCZOS).save(ruta, 'JPEG', quality=90, optimize=True)


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    hacer = '--arreglar' in sys.argv
    flojas = []
    for n in sorted(os.listdir(FOTOS)):
        if not n.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
            continue
        ruta = os.path.join(FOTOS, n)
        try:
            im = Image.open(ruta)
            oc, b = ocupacion(im)
        except Exception as e:
            print('  %-28s ERROR: %s' % (n[:28], e))
            continue
        if b and oc < MINIMO:
            flojas.append((oc, n, im.size, b))

    flojas.sort()
    # El producto medido en pixeles de verdad decide si recortar mejora o empeora
    recortables = [f for f in flojas if max(f[3][2] - f[3][0], f[3][3] - f[3][1]) >= MIN_PIXELES]
    chicas = [f for f in flojas if f not in recortables]

    print('Fotos revisadas: %d' % len(os.listdir(FOTOS)))
    print('Con el producto chico en el cuadro (ocupa menos del %d%%): %d\n'
          % (MINIMO * 100, len(flojas)))

    print('=== %d SE ARREGLAN RECORTANDO (hay pixeles de sobra) ===' % len(recortables))
    for oc, n, tam, b in recortables[:25]:
        px = max(b[2] - b[0], b[3] - b[1])
        print('  %-26s ocupa %3d%%  producto %4dpx  (%dx%d)' % (n[:26], oc * 100, px, tam[0], tam[1]))
    if len(recortables) > 25:
        print('  ... y %d mas' % (len(recortables) - 25))

    print('\n=== %d NECESITAN OTRA FOTO (recortar las dejaria borrosas) ===' % len(chicas))
    for oc, n, tam, b in chicas[:25]:
        px = max(b[2] - b[0], b[3] - b[1])
        print('  %-26s ocupa %3d%%  producto %4dpx  (%dx%d)' % (n[:26], oc * 100, px, tam[0], tam[1]))
    if len(chicas) > 25:
        print('  ... y %d mas' % (len(chicas) - 25))

    if not hacer:
        print('\nPara recortar las que se pueden:  python encuadre.py --arreglar')
        return 0

    os.makedirs(BACKUP, exist_ok=True)
    for oc, n, tam, b in recortables:
        ruta = os.path.join(FOTOS, n)
        shutil.copy2(ruta, os.path.join(BACKUP, n))
        try:
            arreglar(ruta, b)
            im = Image.open(ruta)
            print('  %-26s %3d%% -> %3d%%' % (n[:26], oc * 100, ocupacion(im)[0] * 100))
        except Exception as e:
            shutil.copy2(os.path.join(BACKUP, n), ruta)
            print('  %-26s ERROR, se dejo como estaba: %s' % (n[:26], e))
    print('\n%d fotos recortadas. Los originales quedaron en fotos-sin-recortar/' % len(recortables))
    if chicas:
        print('Las otras %d quedaron intactas: hay que conseguirles otra foto.' % len(chicas))
    return 0


if __name__ == '__main__':
    sys.exit(main())
