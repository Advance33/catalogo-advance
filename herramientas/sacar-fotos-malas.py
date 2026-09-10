# -*- coding: utf-8 -*-
"""Saca del sitio las fotos que alguien miro y dio por equivocadas.

    python herramientas/sacar-fotos-malas.py             muestra cuales
    python herramientas/sacar-fotos-malas.py --aplicar   las saca
    python herramientas/sacar-fotos-malas.py --volver    las devuelve

Una foto que muestra otro producto es peor que no tener foto: el producto
queda sin imagen, pero deja de mentirle al cliente. Las fotos NO se borran,
se mueven a _fotos-que-estan-mal/ (ignorada por git), asi que devolverlas es
un comando.

La lista sale de los veredictos que quedaron en lotes/, que es lo que escribe
revisar-fotos-con-agentes.py --aplicar.
"""
import datetime
import glob
import io
import json
import os
import shutil
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
FOTOS = os.path.join(RAIZ, 'fotos')
APARTE = os.path.join(RAIZ, '_fotos-que-estan-mal')
REVISADAS = os.path.join(RAIZ, 'fotos-revisadas.txt')
sys.path.insert(0, AQUI)
sys.path.insert(0, RAIZ)
import catalogo_maestro as CM                 # noqa: E402


def veredictos():
    """El ultimo veredicto de cada archivo, mirando los lotes en orden."""
    ultimo = {}
    for f in sorted(glob.glob(os.path.join(RAIZ, 'lotes', 'veredictos*.json')),
                    key=os.path.getmtime):
        try:
            d = json.load(io.open(f, encoding='utf-8'))
        except Exception:
            continue
        for v in (d if isinstance(d, list) else d.get('fotos') or []):
            if v.get('archivo') and v.get('veredicto'):
                ultimo[v['archivo']] = v['veredicto']
    return ultimo


def registro():
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
        for a in sorted(reg):
            h, m = reg[a]
            fh.write('%s  %-34s # %s\n' % (h, a, 'mirada' if m else 'sin mirar'))


def volver():
    if not os.path.isdir(APARTE):
        print('No hay ninguna foto apartada.')
        return 0
    hubo = 0
    for a in sorted(os.listdir(APARTE)):
        if not a.lower().endswith('.jpg'):
            continue
        destino = os.path.join(FOTOS, a)
        if os.path.exists(destino):
            print('  ya hay una foto con ese nombre, se saltea: %s' % a)
            continue
        shutil.move(os.path.join(APARTE, a), destino)
        print('  vuelve: %s' % a)
        hubo += 1
    print('%d foto(s) devueltas. Ahora: python verificar-fotos.py' % hubo)
    return 0


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    if '--volver' in sys.argv:
        return volver()

    maestro = CM.leer()
    idx = CM.indexar(maestro)
    malas = sorted(a for a, v in veredictos().items()
                   if v == 'mal' and os.path.exists(os.path.join(FOTOS, a)))
    print('FOTOS QUE ALGUIEN MIRO Y DIO POR EQUIVOCADAS')
    print('=' * 66)
    if not malas:
        print('Ninguna. No hay nada que sacar.')
        return 0
    for a in malas:
        e = idx['por_var'].get(os.path.splitext(a)[0]) or {}
        print('  %-14s %-44s %s' % (a, (e.get('Producto') or '')[:44],
                                    (e.get('Variante') or '(sin variante)')[:18]))
    print()
    print('%d foto(s). Van a %s, que no se publica.' % (len(malas), os.path.basename(APARTE)))

    if '--aplicar' not in sys.argv:
        print()
        print('Para sacarlas:  python herramientas/sacar-fotos-malas.py --aplicar')
        print('Para devolverlas despues:  ... --volver')
        return 0

    os.makedirs(APARTE, exist_ok=True)
    reg = registro()
    mapa = {}
    ruta = os.path.join(APARTE, 'cuando.json')
    if os.path.exists(ruta):
        mapa = json.load(io.open(ruta, encoding='utf-8'))
    for a in malas:
        shutil.move(os.path.join(FOTOS, a), os.path.join(APARTE, a))
        mapa[a] = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
        reg.pop(a, None)
    io.open(ruta, 'w', encoding='utf-8').write(json.dumps(mapa, ensure_ascii=False, indent=1))
    escribir_registro(reg)
    print()
    print('Hecho. %d fotos apartadas. Ahora hay que regenerar el indice:' % len(malas))
    print('   python verificar-fotos.py')
    return 0


if __name__ == '__main__':
    sys.exit(main())
