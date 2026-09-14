# -*- coding: utf-8 -*-
"""Baja fotos de producto desde una lista de direcciones y las deja listas.

    python herramientas/bajar-fotos.py                 baja y prepara
    python herramientas/bajar-fotos.py --aplicar       ademas las mete en fotos/

Lee _fotos-buscadas/candidatas.txt, una linea por foto:

    AT-0068-02   https://store.storeimages.cdn-apple.com/...
    AT-0512-01   https://images.samsung.com/is/image/samsung/...   # el violeta

A la izquierda el archivo que se quiere llenar, a la derecha de donde sacarlo.
Lo que va despues de # es una nota para la persona que revisa.

DE DONDE SALEN ESAS DIRECCIONES
De los sitios de cada fabricante, y las busca una persona (o Claude) mirando
que la foto sea del producto y del color que dice. Eso NO se puede automatizar:
es el unico paso donde un error mete la foto de otro producto, que es el error
que este proyecto entero existe para evitar.

Medido el 14/09/2026, sitio por sitio:

    Apple      2000x2000, y el CDN acepta pedir mas. Sin marca. El mejor.
    Samsung    PNG 1164x776 del CDN oficial. Las direcciones NO estan en el
               HTML que devuelve un lector de paginas comun: hay que bajar el
               HTML crudo y buscarlas con una expresion regular.
    Canon      deja bajar, pero lo mas grande que da son 362x320. Muy chico.
    GSMArena   1000px y anda, PERO la imagen trae su marca de agua. No sirve.
    B&H, Sony  bloquean con 403.

QUE LES HACE
Recorta el fondo -- muchas vienen con el producto chiquito en un lienzo
enorme --, deja un margen parejo y las guarda a 900x900 sobre blanco, que es
como estan las 541 que ya hay. Nunca pisa una foto que exista.

Y ARMA UNA HOJA DE CONTACTO con todas, para mirarlas juntas antes de
aceptarlas. Bajar la foto equivocada es facil; publicarla sin mirar, caro.
"""
import io
import os
import re
import sys
import urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
sys.path.insert(0, AQUI)
sys.path.insert(0, RAIZ)
import catalogo_maestro as CM                 # noqa: E402

LADO = 900
MINIMO = 500          # menos que esto se ve borroso al llevarlo a 900
CARPETA = os.path.join(RAIZ, '_fotos-buscadas')
LISTA = os.path.join(CARPETA, 'candidatas.txt')
FOTOS = os.path.join(RAIZ, 'fotos')
HOJA = os.path.join(CARPETA, '_hoja-de-contacto.jpg')
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'}
APLICAR = '--aplicar' in sys.argv


def leer_lista():
    if not os.path.exists(LISTA):
        return None
    salida = []
    for n, linea in enumerate(io.open(LISTA, encoding='utf-8'), 1):
        nota = ''
        if '#' in linea:
            linea, nota = linea.split('#', 1)
        linea = linea.strip()
        if not linea:
            continue
        partes = linea.split(None, 1)
        if len(partes) != 2 or not partes[1].startswith('http'):
            print('   linea %d: no tiene la forma "<archivo> <direccion>"' % n)
            continue
        salida.append((partes[0].strip().upper(), partes[1].strip(), nota.strip()))
    return salida


def sobre_blanco(im):
    """Sin transparencia: lo que era transparente queda blanco."""
    from PIL import Image
    if im.mode in ('RGBA', 'LA', 'P'):
        fondo = Image.new('RGB', im.size, (255, 255, 255))
        im = im.convert('RGBA')
        fondo.paste(im, mask=im.split()[-1])
        return fondo
    return im.convert('RGB')


def recortar_fondo(im, tolerancia=12):
    """Saca el fondo liso de los bordes. La de Apple viene con el producto
    ocupando un tercio del lienzo; sin esto la ficha se ve vacia."""
    from PIL import Image, ImageChops
    fondo = Image.new('RGB', im.size, im.getpixel((0, 0)))
    dif = ImageChops.difference(im, fondo).convert('L').point(lambda p: 255 if p > tolerancia else 0)
    caja = dif.getbbox()
    if not caja:
        return im
    ancho, alto = caja[2] - caja[0], caja[3] - caja[1]
    if ancho < im.width * 0.12 or alto < im.height * 0.12:
        return im               # recorto de mas: algo salio mal, la dejo entera
    return im.crop(caja)


def a_cuadrado(im):
    from PIL import Image
    im.thumbnail((LADO - 60, LADO - 60), Image.LANCZOS)
    lienzo = Image.new('RGB', (LADO, LADO), (255, 255, 255))
    lienzo.paste(im, ((LADO - im.width) // 2, (LADO - im.height) // 2))
    return lienzo


def hoja_de_contacto(hechas, meta):
    """Todas juntas, con el producto y el color escritos al lado."""
    from PIL import Image, ImageDraw, ImageFont
    if not hechas:
        return
    CEL, TXT, COLS = 250, 46, 5
    filas = (len(hechas) + COLS - 1) // COLS
    hoja = Image.new('RGB', (COLS * CEL, filas * (CEL + TXT)), (245, 246, 250))
    dr = ImageDraw.Draw(hoja)
    try:
        f1 = ImageFont.truetype('arial.ttf', 12)
        f2 = ImageFont.truetype('arialbd.ttf', 12)
    except Exception:
        f1 = f2 = ImageFont.load_default()
    for i, (archivo, ruta) in enumerate(hechas):
        x, y = (i % COLS) * CEL, (i // COLS) * (CEL + TXT)
        im = Image.open(ruta)
        im.thumbnail((CEL - 14, CEL - 14))
        hoja.paste(im, (x + (CEL - im.width) // 2, y + (CEL - im.height) // 2))
        m = meta.get(archivo, {})
        dr.rectangle([x, y + CEL, x + CEL, y + CEL + TXT], fill=(255, 255, 255))
        dr.text((x + 5, y + CEL + 3), archivo, font=f2, fill=(20, 30, 60))
        dr.text((x + 5, y + CEL + 17), (m.get('prod') or '')[:33], font=f1, fill=(60, 66, 80))
        dr.text((x + 5, y + CEL + 30), (m.get('color') or '')[:33], font=f1, fill=(140, 60, 40))
        dr.rectangle([x, y, x + CEL, y + CEL + TXT], outline=(215, 220, 230))
    hoja.save(HOJA, 'JPEG', quality=82)


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    os.makedirs(CARPETA, exist_ok=True)
    lista = leer_lista()
    if lista is None:
        print('Falta %s' % LISTA)
        print('Una linea por foto:  <CODIGO_VAR>  <direccion>')
        return 2

    maestro = CM.leer()
    idx = CM.indexar(maestro)
    meta = {}
    for v in maestro:
        meta[v['CODIGO_VAR'] + CM.EXT] = {'prod': v.get('Producto'), 'color': v.get('Variante')}

    hechas, quejas, ya = [], [], []
    for archivo, url, nota in lista:
        if not archivo.lower().endswith('.jpg'):
            archivo += CM.EXT
        base = os.path.splitext(archivo)[0]
        if base not in idx['por_var'] and CM.partir(base) is None:
            quejas.append('%s: no es un codigo de variante del catalogo' % archivo)
            continue
        if os.path.exists(os.path.join(FOTOS, archivo)):
            ya.append(archivo)
            continue
        try:
            datos = urllib.request.urlopen(
                urllib.request.Request(url, headers=UA), timeout=40).read()
        except Exception as e:
            quejas.append('%s: no se pudo bajar (%s)' % (archivo, str(e)[:44]))
            continue
        destino = os.path.join(CARPETA, archivo)
        try:
            from PIL import Image
            crudo = os.path.join(CARPETA, '_crudo.tmp')
            io.open(crudo, 'wb').write(datos)
            im = Image.open(crudo)
            ancho, alto = im.size
            if max(ancho, alto) < MINIMO:
                quejas.append('%s: la imagen es de %dx%d, muy chica' % (archivo, ancho, alto))
                continue
            im = a_cuadrado(recortar_fondo(sobre_blanco(im)))
            im.save(destino, 'JPEG', quality=90, optimize=True)
            hechas.append((archivo, destino))
            print('  %-15s %4dx%-4d -> 900x900   %s' % (archivo, ancho, alto, nota[:30]))
        except Exception as e:
            quejas.append('%s: no se pudo preparar (%s)' % (archivo, str(e)[:44]))

    print()
    print('%d preparadas · %d ya tenian foto · %d con problema'
          % (len(hechas), len(ya), len(quejas)))
    if ya:
        print('   ya tenian: %s' % ', '.join(ya[:6]))
    for q in quejas:
        print('   %s' % q)

    if hechas:
        hoja_de_contacto(hechas, meta)
        print()
        print('Hoja de contacto: %s' % HOJA)
        print('MIRALA antes de aplicar: que cada foto sea del producto y del color')
        print('que dice. Es el unico paso que no se puede automatizar.')

    if not APLICAR:
        print()
        print('Para meterlas en el catalogo:')
        print('   python herramientas/bajar-fotos.py --aplicar')
        return 1 if quejas else 0

    import shutil
    for archivo, ruta in hechas:
        shutil.copy2(ruta, os.path.join(FOTOS, archivo))
    print()
    print('%d fotos agregadas. Ahora:  python verificar-fotos.py' % len(hechas))
    return 1 if quejas else 0


if __name__ == '__main__':
    sys.exit(main())
