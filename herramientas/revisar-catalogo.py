# -*- coding: utf-8 -*-
"""Como esta el catalogo maestro contra la planilla de hoy.

    python herramientas/revisar-catalogo.py

No toca nada: solo mira y cuenta. Sirve para dos cosas.

Mientras el sheet no mande las columnas CODIGO y CODIGO_VAR, esto dice si
el puente sigue alcanzando: cuantas filas encuentran su producto por el
vinculo guardado, cuantas son altas que necesitan codigo, y cuantas tienen
un vinculo que dejo de ser de fiar (el ID quedo pegado a otro producto).

Cuando el sheet las mande, esto compara lo que dice la planilla con lo que
dice el catalogo, y avisa si se separaron. Que es lo unico que hay que
vigilar cuando la identidad la mantienen dos lados.
"""
import collections
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
sys.path.insert(0, AQUI)
sys.path.insert(0, RAIZ)
import catalogo_maestro as CM                 # noqa: E402
import fotos_sku as FS                        # noqa: E402
import validar                                # noqa: E402


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    maestro = CM.leer()
    if not maestro:
        print('Todavia no hay catalogo maestro. Se siembra una sola vez con:')
        print('   python herramientas/sembrar-catalogo-maestro.py --escribir')
        return 2

    filas = [f for f in validar.bajar_csv() if (f.get('ID') or '').strip()]
    conocidos = validar.leer_index()[0]
    pinta = validar.pinta
    cols = lambda f: FS.colores_de_la_fila(f, pinta, conocidos)
    idx = CM.indexar(maestro)
    por_codigo = {}
    for m in maestro:
        por_codigo.setdefault(m['CODIGO'], m)
    fotos = {x for x in os.listdir(os.path.join(RAIZ, 'fotos')) if x.lower().endswith('.jpg')}

    cuenta = collections.Counter()
    altas, dudosas, sin_esa_foto, variante_nueva, discrepan = [], [], [], [], []
    for f in filas:
        codigo, de = CM.codigo_de_la_fila(f, idx, pinta, conocidos)
        cuenta[de] += 1
        dado = (f.get('CODIGO') or '').strip().upper()
        if codigo and dado and dado != codigo:
            discrepan.append((f['ID'].strip(), dado, codigo))
        if not codigo:
            fila = (f['ID'].strip(), (f.get('Descripción completa') or '')[:52])
            (altas if de == 'falta' else dudosas).append(fila)
            continue
        for c in cols(f):
            if not CM.variante_de(codigo, c, idx):
                variante_nueva.append((f['ID'].strip(), '%s  (%s)' % (c, codigo)))
        cand = CM.candidatos_foto(codigo, cols(f), idx)
        if cand and not any(c + '.jpg' in fotos for c in cand):
            sin_esa_foto.append((f['ID'].strip(), cand[0], (f.get('Descripción completa') or '')[:44]))

    productos = len({m['CODIGO'] for m in maestro})
    print('CATALOGO MAESTRO contra la planilla de hoy')
    print('=' * 66)
    print('catalogo: %d productos, %d variantes' % (productos, len(maestro)))
    print('planilla: %d filas' % len(filas))
    print()
    print('  %4d  encontraron su producto por la columna CODIGO' % cuenta['columna'])
    print('  %4d  lo encontraron por el vinculo guardado con el ID' % cuenta['id'])
    print('  %4d  lo encontraron por el vinculo guardado con el SKU' % cuenta['sku'])
    print('  %4d  ALTAS: no estan en el catalogo y necesitan codigo' % len(altas))
    print('  %4d  DUDOSAS: el vinculo existe pero apunta a otro producto' % len(dudosas))
    print('  %4d  variantes que el catalogo no tiene' % len(variante_nueva))
    con_codigo = sum(1 for x in fotos if CM.partir(x[:-4]))
    if con_codigo:
        print('  %4d  productos cuya foto no esta en la carpeta' % len(sin_esa_foto))
    else:
        print('   ---  las fotos todavia se llaman por SKU, asi que no se cuentan')
        print('        (el renombre a codigos esta en herramientas/renombre-a-codigo.csv)')
    if cuenta['columna']:
        print('  %4d  DISCREPAN: la planilla y el catalogo dicen codigos distintos'
              % len(discrepan))
    print()

    def bloque(titulo, items, ancho=14):
        print('-' * 66)
        print('%s  (%d)' % (titulo, len(items)))
        print('-' * 66)
        for x in items[:40] or [('(ninguna)',)]:
            print('   ' + '  '.join(('%-*s' % (ancho, str(v)) if i == 0 else str(v))
                                    for i, v in enumerate(x)))
        if len(items) > 40:
            print('   ... y %d mas' % (len(items) - 40))
        print()

    bloque('ALTAS: hay que darles un codigo', altas)
    bloque('DUDOSAS: el vinculo ya no sirve, lo tiene que mirar una persona', dudosas)
    if discrepan:
        bloque('DISCREPAN: la planilla dice una cosa y el catalogo otra', discrepan)
    bloque('VARIANTES QUE EL CATALOGO NO TIENE', variante_nueva)

    # una alta sin codigo es un producto sin foto: no rompe nada, pero si se
    # acumulan es que nadie esta asignando y el catalogo se queda atras
    if len(altas) + len(dudosas) > 25:
        print('OJO: %d filas sin codigo. Si esto crece todos los dias, es que'
              % (len(altas) + len(dudosas)))
        print('nadie esta asignando codigos y el catalogo se esta quedando atras.')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
