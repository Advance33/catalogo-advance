# -*- coding: utf-8 -*-
"""Como esta el catalogo maestro contra la planilla de hoy.

    python3 herramientas/revisar-catalogo.py

No toca nada: solo mira y cuenta. Sirve para dos cosas.

Para las filas que llegan sin CODIGO, dice si el puente alcanza: cuantas
encuentran su producto por el vinculo guardado, cuantas son altas que
necesitan codigo, y cuantas tienen un vinculo que dejo de ser de fiar (el ID
quedo pegado a otro producto).

Y como las columnas CODIGO y CODIGO_VAR ya llegan de ADVAPP (contrato
landing/1.3), compara lo que dice la columna con lo que dice el catalogo, y
avisa si se separaron. Que es lo unico que hay que vigilar cuando la
identidad la mantienen dos lados. Hasta el 29/09 esa comparacion usaba el
codigo que ya habia salido de la misma columna, asi que decia "0 DISCREPAN"
mientras habia 22 choques (13 de verdad: el 17 Pro Sim con el codigo del
eSIM, el MacBook Neo ES con el del EN).
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
        print('   python3 herramientas/sembrar-catalogo-maestro.py --escribir')
        return 2
    # La foto que se predice abajo usa la copia de varianteDeLaColumna(): si
    # dejo de hacer lo mismo que la web, el conteo de fotos no vale.
    malas = CM.probar_columna()
    if malas:
        print('variante_de_la_columna ya no hace lo mismo que la web:')
        for m in malas:
            print('   ' + m)
        return 3

    filas = [f for f in validar.bajar_csv() if (f.get('ID') or '').strip()]
    conocidos = validar.leer_index()[0]
    pinta = validar.pinta
    cols = lambda f: FS.colores_de_la_fila(f, pinta, conocidos)
    idx = CM.indexar(maestro)
    por_codigo = {}
    for m in maestro:
        por_codigo.setdefault(m['CODIGO'], m)
    fotos = {x for x in os.listdir(os.path.join(RAIZ, 'fotos')) if x.lower().endswith('.jpg')}
    # Sin foto nuestra, la portada la elige la web: la de ADVAPP, o desde el
    # 29/09 la de una hermana del mismo modelo y color (fotoDeHermana). Se usa
    # la misma copia que validar.py y verificar-fotos.py (PortadaWeb) y no una
    # propia: con una propia, el 29/09 esto decia "el cliente ve el logo" en
    # 33 fichas y en la pagina eran 4; las demas muestran la foto de una
    # hermana (una es un duplicado que colapsarIguales esconde). Solo los
    # .jpg, como la web (busca en INDICE_FOTOS con EXT_FOTOS).
    portada = validar.PortadaWeb(filas, idx, {x[:-4] for x in fotos}, conocidos)

    cuenta = collections.Counter()
    altas, dudosas, sin_esa_foto, variante_nueva, discrepan = [], [], [], [], []
    otra_capacidad, con_la_de_advapp, con_la_de_hermana = [], [], []
    for f in filas:
        # `codigo` es el que usa la web para elegir la foto (la columna, si
        # viene); la discrepancia se mide aparte, contra el puente sin las
        # columnas, con la misma regla que el pedido a ADVAPP.
        codigo, de = CM.codigo_de_la_fila(f, idx, pinta, conocidos)
        cuenta[de] += 1
        dado, puente, tipo = CM.choque_de_codigo(f, idx, pinta, conocidos)
        if tipo == 'choque':
            discrepan.append((f['ID'].strip(), dado, 'el catalogo dice ' + puente))
        elif tipo == 'otra-capacidad':
            # Pedro, 26/09: el mismo modelo con otra memoria se ve igual. No
            # es un error ni se pide; se cuenta para que no se confunda.
            otra_capacidad.append(f['ID'].strip())
        if not codigo:
            fila = (f['ID'].strip(), (f.get('Descripción completa') or '')[:52])
            (altas if de == 'falta' else dudosas).append(fila)
            continue
        propios = cols(f)
        for c in propios:
            if not CM.variante_de(codigo, c, idx):
                variante_nueva.append((f['ID'].strip(), '%s  (%s)' % (c, codigo)))
        # Con la fila, como la web: primero lo que dice CODIGO_VAR. Sin eso
        # el 28/09 se contaban 8 fichas "sin foto" que la web mostraba bien.
        cand = CM.candidatos_foto(codigo, propios, idx, f.get('Descripción completa') or '',
                                  conocidos, fila=f, propios=propios)
        # `cand` es lo mismo que portada.candidatos(f) (mismo codigo, mismos
        # colores). Tambien entra la fila sin candidatos: la web igual puede
        # mostrarle la foto de una hermana (el Tab A11+ Gray, 29/09). El logo
        # se cuenta solo si habia un nombre que buscar, como verificar-fotos.
        if not any(c + '.jpg' in fotos for c in cand):
            clase, que = portada.de(f)
            nombre = cand[0] if cand else '(sin variante)'
            desc = (f.get('Descripción completa') or '')[:44]
            if clase in ('advapp', 'advapp-hermana'):
                con_la_de_advapp.append((f['ID'].strip(), nombre, desc + (
                    ' (de una hermana)' if clase == 'advapp-hermana' else '')))
            elif clase == 'hermana':
                con_la_de_hermana.append((f['ID'].strip(), nombre, 'muestra %s.jpg  %s' % (que, desc)))
            elif cand:
                sin_esa_foto.append((f['ID'].strip(), cand[0], desc))

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
        print('  %4d  fichas sin foto nuestra: el cliente ve el logo' % len(sin_esa_foto))
        print('  %4d  fichas sin foto nuestra que muestran la de ADVAPP (nadie la miro)'
              % len(con_la_de_advapp))
        print('  %4d  fichas sin foto propia que muestran la de otra memoria (Pedro, 26/09)'
              % len(con_la_de_hermana))
    else:
        print('   ---  las fotos todavia se llaman por SKU, asi que no se cuentan')
        print('        (el renombre a codigos esta en herramientas/renombre-a-codigo.csv)')
    if cuenta['columna']:
        print('  %4d  DISCREPAN: la columna CODIGO dice otro producto que el catalogo'
              % len(discrepan))
        print('  %4d  otra capacidad del mismo modelo: misma foto, no se pide (Pedro, 26/09)'
              % len(otra_capacidad))
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
        bloque('DISCREPAN: la columna CODIGO dice una cosa y el catalogo otra', discrepan)
    bloque('VARIANTES QUE EL CATALOGO NO TIENE', variante_nueva)
    if con_codigo:
        bloque('SIN FOTO NUESTRA: el cliente ve el logo', sin_esa_foto)
        bloque('SIN FOTO NUESTRA: se ve la de ADVAPP, que nadie reviso', con_la_de_advapp)
        # Informativo, como el 2c de verificar-fotos: la decision de Pedro del
        # 26/09 (otra memoria, misma foto) no se pide ni es un error.
        bloque('SIN FOTO PROPIA: se ve la de otra memoria del mismo modelo y color (esta bien)',
               con_la_de_hermana)

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
