# -*- coding: utf-8 -*-
"""Pone al dia las variantes del catalogo y avisa lo que falta.

    python herramientas/altas-catalogo.py             muestra que haria
    python herramientas/altas-catalogo.py --aplicar   lo hace

Es el trabajo de todos los dias. Un producto sin su variante registrada no
puede tener foto, asi que si nadie corre esto, cada dia hay mas fichas sin
imagen y nadie se entera hasta que un cliente la ve vacia.

LO QUE HACE SOLO
  · Variante nueva de un producto que ya tiene codigo: le da el proximo
    numero libre DE ESE PRODUCTO. Los numeros no se reusan, asi que si un
    color se deja de vender y despues vuelve, vuelve con el suyo. Agregar un
    color no crea una identidad nueva, por eso puede salir solo.
  · Una variante que ya existe escrita de otra forma: la anota en Escrituras
    y NO estrena numero. El numero es el nombre del archivo, y una variante
    de mas deja la foto vieja sin nadie que la pida.
  · Un producto que se sembro sin colores y estrena el primero: la fila sin
    variante se convierte en la 01.

LO QUE NO HACE, Y POR QUE
Repartir codigos AT-####. Los reparte el equipo de la planilla, que es quien
genera las filas, y desde el contrato landing/1.3 vienen en la columna
CODIGO. Tiene que numerar UN SOLO lado: si numeramos los dos, dos altas del
mismo dia se llevan el mismo AT-#### y la foto de una tapa a la otra. Es el
riesgo que nosotros mismos les escribimos en la propuesta, y estuvo abierto
hasta el 11/09 porque se acordo que asignaban ellos pero este script seguia
asignando igual.

Asi que una fila sin codigo sale listada y nada mas. Sale sin foto hasta que
el sheet le ponga el suyo, que es el error barato: se arregla al dia
siguiente y no ensucia nada.

Lo que si conviene mirar de esa lista: si alguna es un producto que YA esta
con otro nombre. El proveedor reescribe seguido -- el 11/09 movio cuatro
productos de categoria, le agrego "GEN2" a siete anteojos y saco las
referencias de fabrica. Confirmar el vinculo en altas-decididas.csv y correr
confirmar-altas.py deja anotados el ID, el SKU, el nombre y la categoria de
ese dia, y el mismo cambio no se vuelve a preguntar nunca mas.
"""
import csv
import datetime
import io
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
sys.path.insert(0, AQUI)
sys.path.insert(0, RAIZ)
import catalogo_maestro as CM                 # noqa: E402
import fotos_sku as FS                        # noqa: E402
import validar                                # noqa: E402

APLICAR = '--aplicar' in sys.argv
DECISIONES = os.path.join(AQUI, 'altas-decididas.csv')


def leer_decisiones():
    """Lo que una persona ya resolvio: ID de la planilla -> AT-#### o NUEVO."""
    if not os.path.exists(DECISIONES):
        return {}
    with io.open(DECISIONES, encoding='utf-8', newline='') as fh:
        filas = list(csv.DictReader(fh))
    salida = {}
    for f in filas:
        i = (f.get('ID') or '').strip()
        d = (f.get('Decision') or '').strip().upper()
        if i and d:
            salida[i] = d
    return salida


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    maestro = CM.leer()
    if not maestro:
        print('Todavia no hay catalogo maestro. Se siembra una sola vez:')
        print('   python herramientas/sembrar-catalogo-maestro.py --escribir')
        return 2

    filas = [f for f in validar.bajar_csv() if (f.get('ID') or '').strip()]
    conocidos = validar.leer_index()[0]
    pinta = validar.pinta
    cols = lambda f: FS.colores_de_la_fila(f, pinta, conocidos)
    idx = CM.indexar(maestro)
    hoy = datetime.date.today().isoformat()
    decidido = leer_decisiones()

    # Los productos que hoy no aparecen en ninguna fila. Un producto que se
    # fue y una fila que no se reconoce, de la misma marca y al mismo precio,
    # casi siempre son la misma cosa con el nombre cambiado: ese es el par
    # que conviene mirar primero.
    tomados = set()
    for f in filas:
        c, _ = CM.codigo_de_la_fila(f, idx, pinta, conocidos)
        if c:
            tomados.add(c)

    por_marca = {}
    for m in maestro:
        por_marca.setdefault(CM.norm(m['Marca']), {})[m['CODIGO']] = m

    def candidatos(f, cuantos=3):
        """Los productos del catalogo que mas se parecen a esta fila.

        Se busca por marca sola, NO por marca y categoria: la categoria la
        escribe el proveedor y la cambia. Los cuatro extenders se escaparon
        justo por eso.
        """
        d = f.get('Descripción completa') or ''
        sin_col = CM.sin_los_colores(d, pinta, conocidos)
        puntos = []
        for m in (por_marca.get(CM.norm(f.get('Marca'))) or {}).values():
            p = max(CM.parecido(d, m['Producto']),
                    CM.parecido(sin_col, CM.sin_los_colores(m['Producto'], pinta, conocidos)))
            precio = CM.mismo_precio(f.get('Precio USD'), m.get('Precio_alta'))
            # Un producto que hoy no esta en la planilla y cuyo precio cierra
            # pesa mas que uno que se sigue vendiendo: el que se fue es el
            # candidato natural del que llego.
            if m['CODIGO'] not in tomados and precio is True:
                p += 0.15
            puntos.append((p, precio, m))
        puntos.sort(key=lambda x: -x[0])
        return puntos[:cuantos]

    nuevas_var, sin_resolver, escrituras, convertidas, esperando = [], [], [], [], []

    for f in filas:
        idf = (f.get('ID') or '').strip()
        cod, _de = CM.codigo_de_la_fila(f, idx, pinta, conocidos)
        base = {'Categoria': (f.get('Categoría') or '').strip(),
                'Marca': (f.get('Marca') or '').strip(),
                'Producto': (f.get('Descripción completa') or '').strip(),
                'ID_alta': idf, 'Otros_IDs': '',
                'SKU_alta': FS.sku_de(f), 'Otros_SKUs': '', 'Nombres_vistos': '',
                'Precio_alta': (f.get('Precio USD') or '').strip(),
                'Alta': hoy, 'Baja': '', 'Fusionado_en': '', 'Nota': ''}
        if not cod:
            # NO se le da un codigo desde aca. Los reparte el equipo de la
            # planilla, que es el que genera las filas, y tiene que repartirlos
            # UN SOLO lado: si los dos numeramos, dos altas del mismo dia se
            # llevan el mismo AT-#### y la foto de una tapa a la otra. Esa fila
            # queda sin codigo hasta que el sheet se lo ponga, y sin codigo sale
            # sin foto, que es el error barato.
            esperando.append((f, candidatos(f)))
            continue
        # producto conocido: ¿trae alguna variante que el catalogo no tenga?
        for v in cols(f):
            if CM.variante_de(cod, v, idx):
                continue
            # Puede ser una que ya esta, escrita de otra forma. Eso se anota
            # como escritura y NO estrena numero: el numero es el nombre de
            # la foto, y una variante de mas deja la foto vieja sin nadie que
            # la pida.
            ya = CM.variante_por_partes(cod, v, idx)
            if ya:
                fila = idx['por_var'][ya]
                fila['Escrituras'] = '|'.join(
                    [x for x in (fila.get('Escrituras') or '').split('|') if x.strip()] + [v])
                escrituras.append((ya, v, fila))
                continue
            # Un producto que se sembro sin colores y hoy trae el primero: la
            # fila sin variante ES ese color, no una hermana suya. Si se
            # agregara al lado, el producto quedaria con una fila sin numero
            # y otras con numero, que es justo lo que el chequeo llama grave:
            # la portada se vuelve ambigua y no hay forma de saber si la foto
            # AT-0082.jpg es la del Black o la de todos.
            suelta = next((x for x in (idx['por_codigo'].get(cod) or [])
                           if not (x.get('NumVar') or '').strip()), None)
            if suelta is not None and len(idx['por_codigo'][cod]) == 1:
                convertidas.append((cod, v, suelta))
                suelta['CODIGO_VAR'] = '%s-01' % cod
                suelta['NumVar'] = '01'
                suelta['Variante'] = v
                idx = CM.indexar(maestro)
                continue
            num = CM.proxima_variante(cod, idx)
            modelo = (idx['por_codigo'].get(cod) or [{}])[0]
            fila = dict(base, CODIGO=cod, CODIGO_VAR='%s-%s' % (cod, num),
                        Variante=v, Escrituras='', NumVar=num,
                        Categoria=modelo.get('Categoria', base['Categoria']),
                        Marca=modelo.get('Marca', base['Marca']),
                        Producto=modelo.get('Producto', base['Producto']),
                        Nota='variante agregada el ' + hoy)
            nuevas_var.append(fila)
            maestro.append(fila)
            idx = CM.indexar(maestro)

    print('ALTAS DEL CATALOGO')
    print('=' * 74)
    print('planilla: %d filas   ·   catalogo: %d productos'
          % (len(filas), len({m['CODIGO'] for m in maestro})))
    print()
    print('  %4d  variantes nuevas de productos que ya estaban' % len(nuevas_var))
    print('  %4d  variantes que ya estaban, escritas de otra forma' % len(escrituras))
    print('  %4d  productos que estrenan su primera variante' % len(convertidas))
    print('  %4d  ESPERANDO CODIGO del sheet' % len(esperando))
    print()
    if nuevas_var:
        print('--- variantes nuevas ---')
        for x in nuevas_var:
            print('  %-14s %-46s %s' % (x['CODIGO_VAR'], x['Producto'][:46], x['Variante'][:24]))
        print()
    if convertidas:
        print('--- productos que estrenan su primera variante ---')
        print('    La fila sin variante pasa a ser la 01. Si tenian una foto')
        print('    <CODIGO>.jpg, hay que renombrarla a <CODIGO>-01.jpg.')
        for cod, v, fila in convertidas:
            print('  %-9s -> %-12s %-34s %s'
                  % (cod, cod + '-01', (fila.get('Producto') or '')[:34], v[:22]))
        print()
    if escrituras:
        print('--- otra forma de escribir una variante que ya esta ---')
        for cv, v, fila in escrituras:
            print('  %-14s %-30s ahora tambien: %s'
                  % (cv, (fila.get('Variante') or '')[:30], v[:34]))
        print()
    if esperando:
        print('--- SIN CODIGO ---')
        print('    Los codigos los reparte el equipo de la planilla: un solo lado')
        print('    numera, o dos altas del mismo dia se llevan el mismo AT-####.')
        print('    Estas filas salen sin foto hasta que el sheet les ponga el suyo.')
        print()
        print('    Si alguna es un producto que YA esta con otro nombre, se le anota')
        print('    el vinculo y deja de necesitar codigo nuevo. Va en')
        print('    herramientas/altas-decididas.csv como  <ID>,AT-####  y despues:')
        print('      python herramientas/confirmar-altas.py --aplicar')
        print()
        for f, cands in sorted(esperando, key=lambda x: x[0]['ID']):
            idf = (f.get('ID') or '').strip()
            marca = '  (ya la miramos: es nueva)' if decidido.get(idf) == 'NUEVO' else ''
            print('  %-13s %-44s %8s  %s%s' % (
                idf, (f.get('Descripción completa') or '')[:44],
                (f.get('Precio USD') or '').strip(),
                (f.get('Categoría') or '').strip()[:16], marca))
            if decidido.get(idf) == 'NUEVO':
                print()
                continue
            for p, precio, m in cands:
                aviso = ''
                if CM.norm(m['Categoria']) != CM.norm(f.get('Categoría')):
                    aviso += ' · cambio de categoria (%s)' % m['Categoria'][:14]
                if precio is False:
                    aviso += ' · OTRO PRECIO'
                if m['CODIGO'] not in tomados:
                    aviso += ' · hoy no se vende'
                print('  %-13s %3.0f%%  %-9s %-38s %7s%s' % (
                    '', p * 100, m['CODIGO'], (m.get('Producto') or '')[:38],
                    (m.get('Precio_alta') or ''), aviso))
            print()

    if not APLICAR:
        print('Simulacion. Para agregarlas:  python herramientas/altas-catalogo.py --aplicar')
        return 0
    if not nuevas_var and not escrituras and not convertidas:
        print('No hay nada que agregar.')
        return 0

    CM.escribir(maestro)
    print('Agregadas. El catalogo queda con %d productos y %d variantes.'
          % (len({m['CODIGO'] for m in maestro}), len(maestro)))
    print('Ahora conviene regenerar el indice:  python verificar-fotos.py')
    return 0


if __name__ == '__main__':
    sys.exit(main())
