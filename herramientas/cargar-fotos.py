# -*- coding: utf-8 -*-
"""Mete en el catalogo las fotos nuevas de una carpeta.

    python herramientas/cargar-fotos.py <carpeta>             muestra que haria
    python herramientas/cargar-fotos.py <carpeta> --aplicar   las copia

Se usa cuando alguien junta fotos sueltas (del proveedor, de la web del
fabricante, del Drive) y hay que ponerlas en fotos/ con el nombre que les
toca. Por defecto la carpeta es _fotos-nuevas de la raiz.

COMO SABE A QUE PRODUCTO VA CADA UNA
Por un archivo asignacion.txt adentro de la misma carpeta, una linea por foto:

    IMG_2831.jpg   AT-0248
    captura2.png   AT-0125  AT-0127     <- la misma foto para dos productos

A la izquierda el archivo como esta en la carpeta; a la derecha uno o varios
codigos. Si el codigo es de un producto que vende colores, se resuelve solo
la variante de portada (el primer color que vende hoy); tambien se puede
escribir la variante entera, AT-0248-01, y entonces manda esa.

Lo escribe una persona MIRANDO las fotos, no un programa: que una imagen sea
de tal producto es lo unico que no se puede deducir del texto, y es
exactamente el error que dejo once fichas mostrando otra cosa.

QUE LES HACE
Las lleva a 900x900 sobre blanco sin recortar, que es como estan las 400 que
ya hay, y las guarda como JPEG. Nunca pisa una foto que ya existe: si el
archivo destino esta, lo dice y sigue de largo.
"""
import io
import os
import shutil
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
sys.path.insert(0, AQUI)
sys.path.insert(0, RAIZ)
import catalogo_maestro as CM                 # noqa: E402
import fotos_sku as FS                        # noqa: E402
import validar                                # noqa: E402

LADO = 900
FOTOS = os.path.join(RAIZ, 'fotos')
POR_DEFECTO = os.path.join(RAIZ, '_fotos-nuevas')
APLICAR = '--aplicar' in sys.argv


def a_cuadrado(origen, destino):
    """900x900 sobre blanco, la foto entera y centrada."""
    from PIL import Image
    im = Image.open(origen)
    if im.mode in ('RGBA', 'LA', 'P'):
        fondo = Image.new('RGB', im.size, (255, 255, 255))
        im = im.convert('RGBA')
        fondo.paste(im, mask=im.split()[-1])
        im = fondo
    else:
        im = im.convert('RGB')
    im.thumbnail((LADO, LADO), Image.LANCZOS)
    lienzo = Image.new('RGB', (LADO, LADO), (255, 255, 255))
    lienzo.paste(im, ((LADO - im.width) // 2, (LADO - im.height) // 2))
    lienzo.save(destino, 'JPEG', quality=90, optimize=True)


def leer_asignacion(carpeta):
    """archivo -> [codigos]. Las lineas vacias y las que empiezan con # no van."""
    ruta = os.path.join(carpeta, 'asignacion.txt')
    if not os.path.exists(ruta):
        return None
    salida = []
    for n, linea in enumerate(io.open(ruta, encoding='utf-8'), 1):
        linea = linea.split('#')[0].strip()
        if not linea:
            continue
        partes = linea.split()
        if len(partes) < 2:
            print('   linea %d: le falta el codigo -> %s' % (n, linea))
            continue
        salida.append((partes[0], [p.strip().upper() for p in partes[1:]]))
    return salida


def archivo_de(codigo, idx, porcod, pinta, conocidos):
    """El nombre de archivo que le toca a ese codigo: su variante de portada."""
    if CM.partir(codigo) and CM.partir(codigo)[1]:
        return codigo + CM.EXT                      # ya vino la variante entera
    fila = porcod.get(codigo)
    if fila is None:
        return ''
    cols = FS.colores_de_la_fila(fila, pinta, conocidos)
    if cols:
        v = (CM.variante_de(codigo, cols[0], idx)
             or CM.variante_por_partes(codigo, cols[0], idx))
        if v:
            return v + CM.EXT
    v = CM.variante_de(codigo, '', idx)
    return (v or codigo) + CM.EXT


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    sueltos = [a for a in sys.argv[1:] if not a.startswith('--')]
    carpeta = sueltos[0] if sueltos else POR_DEFECTO
    if not os.path.isdir(carpeta):
        print('No existe la carpeta %s' % carpeta)
        print('Crea esa carpeta, meté ahí las fotos y un asignacion.txt.')
        return 2

    pares = leer_asignacion(carpeta)
    if pares is None:
        print('Falta %s' % os.path.join(carpeta, 'asignacion.txt'))
        print()
        print('Las fotos que hay en la carpeta:')
        for a in sorted(os.listdir(carpeta)):
            if a.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
                print('   %s' % a)
        return 2

    maestro = CM.leer()
    idx = CM.indexar(maestro)
    conocidos = validar.leer_index()[0]
    pinta = validar.pinta
    porcod = {}
    for f in validar.bajar_csv():
        c = (f.get('CODIGO') or '').strip()
        if c and c not in porcod:
            porcod[c] = f

    hechos, quejas, ya = [], [], []
    for nombre, codigos in pares:
        origen = os.path.join(carpeta, nombre)
        if not os.path.exists(origen):
            quejas.append('%s: no esta en la carpeta' % nombre)
            continue
        for cod in codigos:
            base = cod if CM.partir(cod) else ''
            if not base:
                quejas.append('%s: "%s" no tiene forma de codigo' % (nombre, cod))
                continue
            if CM.partir(cod)[0] not in idx['por_codigo']:
                quejas.append('%s: %s no existe en el catalogo' % (nombre, cod))
                continue
            destino = archivo_de(cod, idx, porcod, pinta, conocidos)
            if not destino:
                quejas.append('%s: %s no esta en la planilla de hoy' % (nombre, cod))
                continue
            if os.path.exists(os.path.join(FOTOS, destino)):
                ya.append('%s ya tiene foto (%s), no se pisa' % (cod, destino))
                continue
            hechos.append((nombre, cod, destino))

    print('CARGAR FOTOS')
    print('=' * 66)
    print('carpeta: %s' % carpeta)
    print()
    for nombre, cod, destino in hechos:
        e = (idx['por_codigo'].get(CM.partir(cod)[0]) or [{}])[0]
        print('  %-26s -> %-14s %s' % (nombre[:26], destino, (e.get('Producto') or '')[:34]))
    if ya:
        print()
        print('--- ya tenian foto ---')
        for x in ya:
            print('  ' + x)
    if quejas:
        print()
        print('--- no se pudieron ---')
        for x in quejas:
            print('  ' + x)
    print()
    print('%d para copiar   ·   %d ya tenian   ·   %d con problema'
          % (len(hechos), len(ya), len(quejas)))

    if not APLICAR:
        print()
        print('Simulacion. Para copiarlas:')
        print('   python herramientas/cargar-fotos.py "%s" --aplicar' % carpeta)
        return 1 if quejas else 0
    if not hechos:
        print('No hay nada que copiar.')
        return 1 if quejas else 0

    for nombre, cod, destino in hechos:
        a_cuadrado(os.path.join(carpeta, nombre), os.path.join(FOTOS, destino))
        print('  copiada %s' % destino)
    print()
    print('%d fotos nuevas. Ahora:' % len(hechos))
    print('   python verificar-fotos.py')
    print('   (va a pedir revisar las nuevas: son fotos que nadie miro todavia)')
    return 1 if quejas else 0


if __name__ == '__main__':
    sys.exit(main())
