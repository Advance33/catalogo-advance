# -*- coding: utf-8 -*-
"""Recorta el margen de los logos de marcas/ para la vitrina de marcas.

    python herramientas/recortar-logos.py

Los logos de marcas/ son cuadrados de 320x320 con la marca en el medio: estan
pensados para los circulos de la fila de marcas. En la vitrina de la portada
van en una cinta horizontal, y ahi un cuadrado con un logo ancho adentro queda
diminuto (el de Canon ocupa el 20% del alto). Este script deja en
marcas/recortados/ la misma imagen sin el margen transparente o blanco.

Hay que correrlo cada vez que se agrega o se cambia un logo en marcas/. Si
alguno no tiene su recortado, la pagina usa el original: se ve chico, pero se ve.
"""
import os
import sys
from PIL import Image, ImageChops

RAIZ    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEN  = os.path.join(RAIZ, 'marcas')
DESTINO = os.path.join(ORIGEN, 'recortados')
MARGEN  = 4    # px de aire alrededor, para que el borde del dibujo no quede cortado


def caja_con_dibujo(im):
    """Lo que no es transparente NI blanco. Hay logos con fondo blanco pintado."""
    alfa = im.split()[3].point(lambda v: 255 if v > 12 else 0)
    blanco = Image.new('RGB', im.size, (255, 255, 255))
    color = ImageChops.difference(im.convert('RGB'), blanco).convert('L').point(lambda v: 255 if v > 18 else 0)
    return ImageChops.multiply(alfa, color).getbbox()


def main():
    os.makedirs(DESTINO, exist_ok=True)
    hechos = 0
    for nombre in sorted(os.listdir(ORIGEN)):
        if not nombre.lower().endswith('.png'):
            continue
        im = Image.open(os.path.join(ORIGEN, nombre)).convert('RGBA')
        caja = caja_con_dibujo(im)
        if not caja:
            print('  sin dibujo, se saltea:', nombre)
            continue
        x0, y0, x1, y1 = caja
        caja = (max(0, x0 - MARGEN), max(0, y0 - MARGEN), min(im.width, x1 + MARGEN), min(im.height, y1 + MARGEN))
        im.crop(caja).save(os.path.join(DESTINO, nombre), 'PNG', optimize=True)
        print('  %-14s %dx%d -> %dx%d' % (nombre, im.width, im.height, caja[2] - caja[0], caja[3] - caja[1]))
        hechos += 1
    print('%d logos recortados en marcas/recortados/' % hechos)
    return 0


if __name__ == '__main__':
    sys.exit(main())
