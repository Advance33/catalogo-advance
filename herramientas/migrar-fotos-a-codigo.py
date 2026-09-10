# -*- coding: utf-8 -*-
"""Pone a las fotos el nombre definitivo: el codigo del catalogo maestro.

    python herramientas/migrar-fotos-a-codigo.py             simula
    python herramientas/migrar-fotos-a-codigo.py --aplicar   renombra

Es el ultimo renombre. De aca en mas los archivos no se mueven mas: el
codigo se le asigna al producto una sola vez y no cambia aunque cambie su
nombre, su ID, su SKU o sus colores. Lo que se mueve, de ahora en adelante,
es una celda del catalogo.

    fotos/AT-0142-01.jpg    el iPhone 17 Pro 256GB en su primera variante
    fotos/AT-0142.jpg       un producto que no tiene variantes

El mapa lo calcula sembrar-catalogo-maestro.py y queda en
herramientas/renombre-a-codigo.csv. Este script lo aplica, mueve a
_fotos-antes-del-codigo/ lo que quede sin lugar, y reescribe
fotos-revisadas.txt para que la huella y el "ya la mire" viajen con cada
archivo.
"""
import csv
import datetime
import hashlib
import io
import json
import os
import shutil
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
sys.path.insert(0, AQUI)
sys.path.insert(0, RAIZ)
import catalogo_maestro as CM                 # noqa: E402

FOTOS = os.path.join(RAIZ, 'fotos')
REVISADAS = os.path.join(RAIZ, 'fotos-revisadas.txt')
APARTE = os.path.join(RAIZ, '_fotos-antes-del-codigo')
MAPA = os.path.join(AQUI, 'renombre-a-codigo.csv')
APLICAR = '--aplicar' in sys.argv


def huella(ruta):
    with open(ruta, 'rb') as fh:
        return hashlib.md5(fh.read()).hexdigest()


def leer_registro():
    reg = {}
    if os.path.exists(REVISADAS):
        for linea in io.open(REVISADAS, encoding='utf-8'):
            datos, _, nota = linea.partition('#')
            p = datos.split()
            if len(p) == 2:
                reg[p[1]] = (p[0], 'sin mirar' not in nota)
    return reg


def escribir_registro(reg):
    with io.open(REVISADAS, 'w', encoding='utf-8', newline='') as fh:
        fh.write('# Fotos miradas contra el producto que dice la planilla.\n')
        fh.write('# Si una cambia, deja de coincidir y no se publica hasta mirarla.\n')
        fh.write('# Anotar las miradas:  python verificar-fotos.py --revisadas\n')
        fh.write('# Arrancar el registro: python verificar-fotos.py --sembrar\n')
        for archivo in sorted(reg):
            h, mirada = reg[archivo]
            fh.write('%s  %-34s # %s\n' % (h, archivo, 'mirada' if mirada else 'sin mirar'))


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    maestro = CM.leer()
    if not maestro:
        print('No hay catalogo maestro. Se siembra primero:')
        print('   python herramientas/sembrar-catalogo-maestro.py --escribir')
        return 2
    if not os.path.exists(MAPA):
        print('Falta %s. Lo escribe el semillero.' % MAPA)
        return 2

    validos = {m['CODIGO_VAR'] for m in maestro}
    with io.open(MAPA, encoding='utf-8', newline='') as fh:
        pares = [(r['archivo_hoy'], r['archivo_nuevo']) for r in csv.DictReader(fh)]

    archivos = sorted(x for x in os.listdir(FOTOS) if x.lower().endswith(CM.EXT))
    ya = [x for x in archivos if CM.partir(x[:-len(CM.EXT)])]
    mueve, problemas = {}, []
    destinos = {}
    for viejo, nuevo in pares:
        if viejo not in archivos:
            continue
        if not CM.partir(nuevo[:-len(CM.EXT)]) or nuevo[:-len(CM.EXT)] not in validos:
            problemas.append((viejo, 'el destino %s no esta en el catalogo' % nuevo))
            continue
        if nuevo in destinos:
            problemas.append((viejo, 'chocaria con %s en %s' % (destinos[nuevo], nuevo)))
            continue
        destinos[nuevo] = viejo
        mueve[viejo] = nuevo
    quedan = [x for x in archivos if x not in mueve and x not in ya]

    print('MIGRACION DE FOTOS AL CODIGO DEL CATALOGO')
    print('=' * 62)
    print('fotos en la carpeta: %d' % len(archivos))
    print('  %4d  se renombran al codigo' % len(mueve))
    print('  %4d  ya tienen nombre de codigo' % len(ya))
    print('  %4d  se apartan: su producto no esta en el catalogo' % len(quedan))
    print('  %4d  problemas' % len(problemas))
    print()
    for v, n in list(mueve.items())[:6]:
        print('   %-58s -> %s' % (v[:58], n))
    if quedan:
        print()
        print('   se apartan a %s:' % os.path.basename(APARTE))
        for x in quedan[:8]:
            print('      %s' % x)
        if len(quedan) > 8:
            print('      ... y %d mas' % (len(quedan) - 8))
    if problemas:
        print()
        print('   PROBLEMAS:')
        for v, m in problemas:
            print('      %-50s %s' % (v[:50], m))

    if not APLICAR:
        print()
        print('Simulacion. Para hacerlo:  python herramientas/migrar-fotos-a-codigo.py --aplicar')
        return 1 if problemas else 0
    if problemas:
        print()
        print('Hay problemas sin resolver: no se toca nada.')
        return 1

    registro = leer_registro()
    firmas = {x: huella(os.path.join(FOTOS, x)) for x in archivos}
    os.makedirs(APARTE, exist_ok=True)
    mapa = {'cuando': datetime.datetime.now().strftime('%Y-%m-%d %H:%M'),
            'renombradas': {}, 'apartadas': []}
    for x in quedan:
        destino = os.path.join(APARTE, x)
        if os.path.exists(destino):
            destino += '.' + datetime.datetime.now().strftime('%H%M%S')
        shutil.move(os.path.join(FOTOS, x), destino)
        mapa['apartadas'].append(x)
    # primero a nombres temporales: un destino puede ser el nombre de otro
    tmp = {}
    for v in mueve:
        t = os.path.join(FOTOS, '__cod__' + v)
        os.rename(os.path.join(FOTOS, v), t)
        tmp[v] = t
    for v, n in mueve.items():
        os.rename(tmp[v], os.path.join(FOTOS, n))
        mapa['renombradas'][v] = n
    io.open(os.path.join(APARTE, 'mapa.json'), 'w', encoding='utf-8').write(
        json.dumps(mapa, ensure_ascii=False, indent=1))

    finales = sorted(x for x in os.listdir(FOTOS) if x.lower().endswith(CM.EXT))
    nuevo_reg = {}
    for x, (h, mirada) in registro.items():
        destino = mueve.get(x, x if x in finales else None)
        if destino:
            prev = nuevo_reg.get(destino)
            nuevo_reg[destino] = (h, mirada or (prev[1] if prev else False))
    for x in finales:
        nuevo_reg.setdefault(x, (firmas.get(x) or huella(os.path.join(FOTOS, x)), False))
    escribir_registro(nuevo_reg)

    print()
    print('Hecho. %d renombradas, %d apartadas. Registro: %d entradas.'
          % (len(mueve), len(quedan), len(nuevo_reg)))
    print('Ahora hay que regenerar el indice:  python verificar-fotos.py')
    return 0


if __name__ == '__main__':
    sys.exit(main())
