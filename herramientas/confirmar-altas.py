# -*- coding: utf-8 -*-
"""Aplica al catalogo lo que una persona decidio sobre las filas sin codigo.

    python herramientas/confirmar-altas.py             muestra que haria
    python herramientas/confirmar-altas.py --aplicar   lo escribe

Lee herramientas/altas-decididas.csv, que tiene una linea por fila resuelta:

    ID,Decision,Nota
    ACC-CAN-015,AT-0229,el proveedor lo paso de Lente a Accesorio Camara
    GAF-RAY-032,NUEVO,el Headliner no estaba en el catalogo

Con Decision = AT-####, esto le anota a ese producto el ID, el SKU y el
nombre con que vino hoy. Eso es todo lo que hace, y es todo lo que hace
falta: manana la fila se reconoce sola por cualquiera de sus IDs y le
alcanza con parecerse a cualquiera de sus nombres.

Sin esto, confirmar no serviria de nada. La fila volveria a caer en la lista
de sin resolver manana, y pasado, y el dia que nadie la mire alguien le da
codigo nuevo y las fotos de ese producto quedan partidas en dos.

Con Decision = NUEVO no toca nada: de eso se encarga altas-catalogo.py, que
es quien reparte los codigos.

Lo que NO hace, nunca: cambiar un CODIGO que ya existe, ni borrar el nombre
del alta. Solo suma. El nombre del alta queda como estaba y el de hoy se
agrega al lado, porque el historial de como se llamo un producto es
justamente lo que lo hace reconocible la proxima vez.
"""
import csv
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
HOY = __import__('datetime').date.today().isoformat()
DECISIONES = os.path.join(AQUI, 'altas-decididas.csv')


def filas_de_la_planilla():
    """La planilla publicada, o un archivo con  --planilla <csv>.

    El equipo del sheet trabaja en la hoja Cami antes de publicar Landing, y
    lo que manda para resolver (el sin_codigo del manifiesto) sale de ahi. Sin
    esto, las decisiones se buscaban en la planilla del dia anterior y las
    filas nuevas no aparecian.
    """
    if '--planilla' in sys.argv:
        ruta = sys.argv[sys.argv.index('--planilla') + 1]
        with io.open(ruta, encoding='utf-8', newline='') as fh:
            return list(csv.DictReader(fh))
    return validar.bajar_csv()


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    if not os.path.exists(DECISIONES):
        print('No hay %s todavia.' % os.path.basename(DECISIONES))
        print('Lo que falta resolver sale de:  python herramientas/altas-catalogo.py')
        return 2

    with io.open(DECISIONES, encoding='utf-8', newline='') as fh:
        decisiones = list(csv.DictReader(fh))
    # Si un ID se decidio dos veces, vale la ULTIMA, igual que en
    # altas-catalogo.py. El 16/09 NB-APP-107 tenia un NUEVO del 15/09 (era otro
    # producto) y un vinculo de hoy: sin esto se listaban las dos.
    ultima = {}
    for d in decisiones:
        idf = (d.get('ID') or '').strip()
        if idf and (d.get('Decision') or '').strip():
            ultima[idf] = d
    leidas, decisiones = len(decisiones), list(ultima.values())

    maestro = CM.leer()
    idx = CM.indexar(maestro)
    filas = {(f.get('ID') or '').strip(): f
             for f in filas_de_la_planilla() if (f.get('ID') or '').strip()}

    hechos, nuevos, quejas = [], [], []
    for d in decisiones:
        idf = (d.get('ID') or '').strip()
        cual = (d.get('Decision') or '').strip().upper()
        if not idf or not cual:
            continue
        if cual == 'NUEVO':
            nuevos.append(idf)
            continue
        if cual == 'DESCARTADA':
            # Una decision que se revirtio: la fila era basura y lo que se le
            # habia anotado se quito a mano. Si vuelve, se decide de nuevo.
            continue
        if not CM.RE_CODIGO.match(cual):
            quejas.append('%s: "%s" no es ni un codigo AT-#### ni NUEVO' % (idf, cual))
            continue
        destino = idx['por_codigo'].get(cual)
        if not destino:
            quejas.append('%s: el codigo %s no existe en el catalogo' % (idf, cual))
            continue
        fila = filas.get(idf)
        if fila is None:
            # Ya se aplico y el producto se reconoce solo, o el proveedor
            # saco la fila. En los dos casos no hay nada que anotar.
            continue
        nombre = (fila.get('Descripción completa') or '').strip()
        # Una decision de OTRO dia solo se vuelve a aplicar si la fila de hoy
        # sigue siendo ese producto. El proveedor reusa IDs: el 16/09 NB-APP-107
        # paso de ser un MacBook Pro 16" usado a un MacBook Neo, y SW-APP-056 de
        # un Ultra 3 con Milanese Loop a uno con Alpine Loop. Sin esto, la
        # decision vieja le anotaba al producto viejo el nombre y el ID de otro,
        # y desde ese dia las dos filas se confundian. La prueba es la firma
        # dura: si ninguno de los nombres conocidos del producto la comparte, no
        # se anota nada y se avisa. Las decisiones de HOY no pasan por aca: son
        # justamente las que alguien miro con el nombre de hoy delante.
        fecha = (d.get('Fecha') or '').strip()
        if fecha and fecha != HOY:
            firma_hoy = CM.firma_dura(nombre)
            conocidas = {CM.firma_dura(n) for m in destino for n in CM.nombres_de(m)}
            if firma_hoy not in conocidas:
                quejas.append('%s: la decision del %s dice %s, pero hoy la fila es "%s": '
                              'parece un ID reusado. No se anota; decidir de nuevo'
                              % (idf, fecha, cual, nombre[:48]))
                continue
        sku = FS.sku_de(fila)
        cambios = []
        for m in destino:
            if CM.aprender(m, 'ID_alta', idf):
                cambios.append('ID')
            if CM.aprender(m, 'SKU_alta', sku):
                cambios.append('SKU')
            if CM.aprender_nombre(m, nombre):
                cambios.append('nombre')
            if CM.aprender_categoria(m, (fila.get('Categoría') or '').strip()):
                cambios.append('categoria')
        if cambios:
            hechos.append((idf, cual, nombre, destino[0], sorted(set(cambios))))

    print('CONFIRMAR ALTAS')
    print('=' * 74)
    print('%d decisiones leidas   ·   %d vinculos para anotar   ·   %d marcadas NUEVO'
          % (leidas, len(hechos), len(nuevos)))
    print()
    if hechos:
        print('--- vinculos ---')
        for idf, cod, nombre, m, cambios in hechos:
            print('  %-13s -> %-9s %s' % (idf, cod, nombre[:44]))
            print('  %-13s    %-9s %-44s [%s]'
                  % ('', 'era', (m.get('Producto') or '')[:44], ', '.join(cambios)))
        print()
    if nuevos:
        print('--- marcadas NUEVO (las reparte altas-catalogo.py) ---')
        for idf in nuevos:
            f = filas.get(idf)
            print('  %-13s %s' % (idf, (f.get('Descripción completa') if f else '(ya no esta en la planilla)')[:52]))
        print()
    if quejas:
        print('--- no se pudieron aplicar ---')
        for q in quejas:
            print('  ' + q)
        print()

    if not APLICAR:
        print('Simulacion. Para escribirlo:  python herramientas/confirmar-altas.py --aplicar')
        return 1 if quejas else 0
    if not hechos:
        print('No hay nada nuevo que anotar.')
        return 1 if quejas else 0

    CM.escribir(maestro)
    print('Anotado. Ahora:  python herramientas/altas-catalogo.py')
    return 1 if quejas else 0


if __name__ == '__main__':
    sys.exit(main())
