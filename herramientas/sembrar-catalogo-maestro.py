# -*- coding: utf-8 -*-
"""Arma por primera vez el catalogo maestro a partir de la planilla de hoy.

    python herramientas/sembrar-catalogo-maestro.py             simula
    python herramientas/sembrar-catalogo-maestro.py --escribir  lo escribe

Se corre UNA VEZ. De ahi en mas el catalogo solo crece y ningun codigo se
reescribe nunca.

Lo que hace:
  1. Agrupa las filas de la planilla por producto. El SKU alcanza casi
     siempre, pero no cuando dos productos distintos lo comparten: los
     cuatro Ray-Ban Meta Skyler tienen el mismo SKU y son cuatro anteojos,
     y lo unico que los separa es la referencia de fabrica del nombre.
  2. Le da un codigo AT-#### a cada producto y AT-####-NN a cada variante,
     en orden de categoria, marca y nombre, para que el catalogo se pueda
     leer de arriba abajo.
  3. Junta todas las formas en que el proveedor escribe cada variante, para
     que "Sky Blue" y "Skyblue" no sean dos cosas.
  4. Deja anotado con que ID, con que SKU y a que precio entro cada uno, que
     es el puente para reconocerlos cuando la planilla los reescriba.
  5. Escribe el mapa de renombre de las fotos que ya estan en la carpeta.
  6. Lista aparte lo que la planilla tiene mal cargado y no se puede
     interpretar: specs tecnicas en la columna Color, tipeos, y colores que
     el catalogo todavia no sabe pintar.
"""
import collections
import csv
import datetime
import io
import os
import re
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
sys.path.insert(0, AQUI)
sys.path.insert(0, RAIZ)
import catalogo_maestro as CM                 # noqa: E402
import fotos_sku as FS                        # noqa: E402
import validar                                # noqa: E402

ESCRIBIR = '--escribir' in sys.argv
MAPA_FOTOS = os.path.join(AQUI, 'renombre-a-codigo.csv')
PENDIENTES = os.path.join(RAIZ, 'CATALOGO-A-CORREGIR.txt')

# Palabras que aparecen en la columna Color y no son colores: son specs de
# monitores. No se inventa nada con ellas; la fila queda sin variante y sale
# listada para que la planilla las saque de ahi.
NO_ES_COLOR = re.compile(
    r'^(fhd|qhd|wqhd|uhd|4k|2k|hd|hdr\d*|ips|va|tn|oled|led|curvo|curved|flat|'
    r'\d+\s*hz|\d+(\.\d+)?\s*ms.*|adaptive\s*sync|freesync|g-?sync|'
    r'dp|hdmi|vga|usb.*|vesa|\d+y\s*garantia|\d+\s*x\s*\d+|'
    r'fhd\s*\d+x\d+|\d+r|rapid\s*(ips|va)|pivot|regulable)$', re.I)

# Tipeos del proveedor que sabemos a que se refieren. Van aca y no como una
# variante nueva: si "Garphite" estrenara su propio numero, el dia que lo
# corrijan a "Graphite" las fotos de esos productos quedarian huerfanas.
# Como escritura alternativa funciona hoy y sigue funcionando cuando lo
# arreglen. Cada uno esta pedido en CATALOGO-A-CORREGIR.txt.
TIPEOS = {
    'garphite': 'Graphite',              # CEL-SAM-076/077/078
    'shinny chalky grey': 'Shiny Chalky Grey',
}


def hexes_del_index():
    """El mapa COLORES de index.html: escritura -> hex. Dos escrituras con el
    mismo hex son el mismo color, y esa es la forma mas honesta de juntar
    sinonimos sin inventar una lista nueva."""
    src = io.open(os.path.join(RAIZ, 'index.html'), encoding='utf-8').read()
    bloque = re.search(r'const COLORES = \{(.*?)\n\};', src, re.S)
    salida = {}
    if bloque:
        for m in re.finditer(r"'?([A-Za-z][A-Za-z0-9 ]*)'?\s*:\s*'(#[0-9A-Fa-f]{3,8})'",
                             bloque.group(1)):
            salida[CM.norm(m.group(1))] = m.group(2).upper()
    return salida


def clave_de_producto(fila, sku):
    """Que filas son el mismo producto. El SKU, mas la referencia de fabrica
    cuando la hay: sin eso los cuatro Meta Skyler quedaban con un solo codigo
    y una sola foto siendo cuatro anteojos de entre 525 y 595 dolares."""
    return (sku, tuple(sorted(CM.referencias(fila.get('Descripción completa')))))


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    if CM.leer():
        print('El catalogo maestro ya existe (%d filas). Esto se corre una sola vez.'
              % len(CM.leer()))
        print('Para ver que le falta:  python herramientas/revisar-catalogo.py')
        print('Para sembrarlo de nuevo hay que borrar catalogo-maestro.csv, y eso')
        print('solo se puede hacer mientras el catalogo siga sin usarse.')
        return 2

    filas = [f for f in validar.bajar_csv() if (f.get('ID') or '').strip()]
    conocidos, _, _, _, _ = validar.leer_index()
    pinta = validar.pinta
    hexes = hexes_del_index()

    # ---- 1. las variantes que vende cada fila ----
    sucios = collections.defaultdict(list)

    def variantes_de(f):
        salida = []
        for c in FS.colores_de_la_fila(f, pinta, conocidos):
            if NO_ES_COLOR.match(c.strip()):
                sucios['spec'].append((f['ID'], c, f.get('Color', '')))
            elif ',' in c:
                sucios['coma'].append((f['ID'], c, f.get('Color', '')))
            elif CM.norm(c) in TIPEOS:
                sucios['tipeo'].append((f['ID'], c, f.get('Color', '')))
                salida.append(TIPEOS[CM.norm(c)])
            elif not pinta(c, conocidos):
                sucios['desconocido'].append((f['ID'], c, f.get('Color', '')))
            else:
                salida.append(c.strip())
        return salida

    # ---- 2. agrupar por producto ----
    orden = lambda f: ((f.get('Categoría') or '').strip(), (f.get('Marca') or '').strip(),
                       CM.norm(f.get('Descripción completa')), (f.get('ID') or '').strip())
    por_producto = collections.OrderedDict()
    for f in sorted(filas, key=orden):
        sku = FS.sku_de(f) or 'ID:' + f['ID'].strip()
        por_producto.setdefault(clave_de_producto(f, sku), []).append(f)

    # ---- 3. numerar ----
    hoy = datetime.date.today().isoformat()
    maestro, n = [], 0
    sin_variantes = 0
    codigo_de_clave = {}
    sin_var_de_clave = {}
    for clave, fs in por_producto.items():
        n += 1
        codigo = '%s-%04d' % (CM.PREFIJO, n)
        codigo_de_clave[clave] = codigo
        primera = fs[0]
        base = {'CODIGO': codigo,
                'Categoria': (primera.get('Categoría') or '').strip(),
                'Marca': (primera.get('Marca') or '').strip(),
                'Producto': (primera.get('Descripción completa') or '').strip(),
                'SKU_alta': clave[0] if not clave[0].startswith('ID:') else '',
                'Precio_alta': (primera.get('Precio USD') or '').strip(),
                'Alta': hoy, 'Baja': '', 'Fusionado_en': '', 'Nota': ''}
        # las variantes de todas las filas hermanas, sin repetir
        vistas, paleta = {}, []
        for f in fs:
            for v in variantes_de(f):
                k = CM.norm(v)
                if k not in vistas:
                    vistas[k] = f
                    paleta.append(v)
        if not paleta:
            sin_variantes += 1
            sin_var_de_clave[clave] = codigo
            maestro.append(dict(base, CODIGO_VAR=codigo, Variante='', Escrituras='',
                                NumVar='', ID_alta=primera['ID'].strip()))
            continue
        for i, v in enumerate(paleta, 1):
            escrituras = set()
            # los sinonimos que index.html ya sabe que son el mismo tono,
            # aunque hoy no aparezcan en la planilla: "grey" comparte hex con
            # "gray" y sin esto, el dia que el proveedor escriba "Grey", el
            # producto se queda sin foto por una letra. Solo para los de una
            # palabra: en "Black Alpine Loop M" el hex es el del negro, y
            # heredar sus alias le daria "black" y "negro" a una correa.
            h = hexes.get(CM.norm(v))
            if h and ' ' not in v:
                escrituras.update(k for k, x in hexes.items() if x == h and k != CM.norm(v))
            escrituras.update(k for k, x in TIPEOS.items() if CM.norm(x) == CM.norm(v))
            maestro.append(dict(base, CODIGO_VAR='%s-%02d' % (codigo, i), Variante=v,
                                Escrituras='|'.join(sorted(escrituras)),
                                NumVar='%02d' % i,
                                ID_alta=vistas[CM.norm(v)]['ID'].strip()))

    # ---- 4. el renombre de las fotos que ya estan ----
    # Una foto que hoy existe es la prueba de que esa variante existio, aunque
    # la planilla ya no la venda. Esas tambien entran al catalogo, anotadas: el
    # dia que la variante vuelva, su foto ya la esta esperando. Es justo lo que
    # hasta ahora se perdia en cada rotacion.
    fotos = sorted(x for x in os.listdir(os.path.join(RAIZ, 'fotos'))
                   if x.lower().endswith(FS.EXT))
    skus_hoy = {FS.sku_de(f) for f in filas if FS.sku_de(f)}
    ids_hoy = {f['ID'].strip() for f in filas}
    claves_de_sku = collections.defaultdict(list)
    for clave in por_producto:
        claves_de_sku[clave[0]].append(clave)
    # todas las escrituras conocidas de cada variante, como slug de archivo
    slugs = collections.defaultdict(set)
    for m in maestro:
        if m['NumVar']:
            for e in CM.escrituras_de(m):
                slugs[m['CODIGO_VAR']].update(FS.formas(e))

    renombres, sin_destino, agregados = [], [], []
    for a in fotos:
        r = FS.resolver(a[:-len(FS.EXT)], skus_hoy, ids_hoy)
        if r is None or r['tipo'] != 'sku':
            sin_destino.append((a, 'el producto no esta en la planilla de hoy'))
            continue
        posibles = claves_de_sku.get(r['clave']) or []
        if len(posibles) != 1:
            sin_destino.append((a, 'ese SKU lo comparten %d productos distintos: hay que'
                                   ' decidir a mano de cual es' % len(posibles)))
            continue
        clave = posibles[0]
        codigo = codigo_de_clave[clave]
        destino = None
        if not r['color']:
            destino = sin_var_de_clave.get(clave) or next(
                (m['CODIGO_VAR'] for m in maestro
                 if m['CODIGO'] == codigo and m['NumVar'] == '01'), None)
        else:
            for cv in sorted(slugs):
                if cv.startswith(codigo + '-') and r['color'] in slugs[cv]:
                    destino = cv
                    break
            if destino is None:
                # una variante que el producto tuvo y hoy no vende: se le da
                # lugar al final, con su numero propio
                usados = [int(m['NumVar']) for m in maestro
                          if m['CODIGO'] == codigo and m['NumVar']]
                cv = '%s-%02d' % (codigo, (max(usados) if usados else 0) + 1)
                modelo = next(m for m in maestro if m['CODIGO'] == codigo)
                # el nombre sale del slug del archivo, asi que se escribe
                # como se lee: "sky-blue" -> "Sky Blue"
                maestro.append(dict(modelo, CODIGO_VAR=cv,
                                    Variante=r['color'].replace('-', ' ').title(),
                                    Escrituras='', NumVar=cv[-2:],
                                    Nota='hay foto; la planilla no la vende hoy'))
                slugs[cv] = {r['color']}
                destino = cv
                agregados.append((a, cv))
        if destino:
            renombres.append((a, destino + FS.EXT))
        else:
            sin_destino.append((a, 'no se pudo ubicar la variante "%s"' % r['color']))

    # ---- informe ----
    partidos = sum(len(cs) - 1 for cs in claves_de_sku.values() if len(cs) > 1)
    print('CATALOGO MAESTRO — semilla desde la planilla de hoy')
    print('=' * 66)
    print('filas de la planilla: %d' % len(filas))
    print('productos con codigo: %d   (AT-0001 .. %s)' % (n, '%s-%04d' % (CM.PREFIJO, n)))
    print('   de esos, %d salieron de partir un SKU que compartian dos productos' % partidos)
    print('variantes: %d   (%d productos sin variante, %d que hoy no se venden pero tienen foto)'
          % (len(maestro), sin_variantes, len(agregados)))
    print('fotos que se renombran: %d de %d' % (len(renombres), len(fotos)))
    print()
    cuenta = collections.Counter(m['CODIGO'] for m in maestro)
    if cuenta:
        ej = cuenta.most_common(1)[0][0]
        print('--- ejemplo de un producto con varias variantes ---')
        for m in maestro:
            if m['CODIGO'] == ej:
                print('  %-14s %-38s %-28s %s'
                      % (m['CODIGO_VAR'], m['Producto'][:38], m['Variante'][:28], m['Nota'][:20]))
        print()
    print('--- primeros renombres de foto ---')
    for a, b in renombres[:6]:
        print('  %-58s -> %s' % (a[:58], b))
    if sin_destino:
        print()
        print('--- %d fotos sin destino (el detalle en %s) ---'
              % (len(sin_destino), os.path.basename(PENDIENTES)))
        for a, m in sin_destino[:5]:
            print('  %-58s %s' % (a[:58], m))

    if not ESCRIBIR:
        print()
        print('Simulacion. Para escribirlo:  python herramientas/sembrar-catalogo-maestro.py --escribir')
        return 0

    CM.escribir(maestro)
    CM.guardar_contador(n)
    with io.open(MAPA_FOTOS, 'w', encoding='utf-8', newline='') as fh:
        w = csv.writer(fh)
        w.writerow(['archivo_hoy', 'archivo_nuevo'])
        w.writerows(renombres)

    L = ['LO QUE HAY QUE CORREGIR EN LA PLANILLA', '=' * 66, '',
         'Generado el %s por sembrar-catalogo-maestro.py'
         % datetime.date.today().strftime('%d/%m/%Y'), '']
    L += ['1) LA COLUMNA COLOR TIENE SPECS TECNICAS, NO COLORES  (%d)' % len(sucios['spec']),
          '-' * 66,
          '   Son monitores. La web lee esa columna como lista de opciones y',
          '   termina dibujando un puntito que dice "240Hz". Las specs van en',
          '   Detalle, no en Color.', '']
    for pid, c, todo in sorted(set(sucios['spec']))[:60]:
        L.append('   %-14s %-22s   Color = %s' % (pid, c[:22], todo[:44]))
    L += ['', '2) DOS COSAS SEPARADAS POR COMA DENTRO DE UNA MISMA OPCION  (%d)'
          % len(sucios['coma']), '-' * 66,
          '   "Black Ocean Band, Natural" son dos datos en una celda. La coma',
          '   no separa nada para la web y la opcion entera queda sin pintar.', '']
    for pid, c, todo in sorted(set(sucios['coma']))[:40]:
        L.append('   %-14s %-30s   Color = %s' % (pid, c[:30], todo[:38]))
    L += ['', '3) TIPEOS QUE ESTAMOS TAPANDO DE ESTE LADO  (%d)' % len(sucios['tipeo']),
          '-' * 66,
          '   Los reconocemos igual para que el producto no se quede sin foto,',
          '   pero convendria corregirlos en la planilla.', '']
    for pid, c, todo in sorted(set(sucios['tipeo'])):
        L.append('   %-14s %-30s   deberia decir: %s' % (pid, c[:30], TIPEOS[CM.norm(c)]))
    L += ['', '4) COLORES QUE EL CATALOGO NO SABE PINTAR  (%d)' % len(sucios['desconocido']),
          '-' * 66,
          '   O es un tipeo del proveedor, o es un color nuevo que hay que',
          '   agregar al mapa COLORES de index.html.', '']
    for pid, c, todo in sorted(set(sucios['desconocido']))[:40]:
        L.append('   %-14s %-30s   Color = %s' % (pid, c[:30], todo[:38]))
    L += ['', '5) FOTOS QUE NO ENCONTRARON SU LUGAR EN EL CATALOGO  (%d)' % len(sin_destino),
          '-' * 66, '']
    for a, m in sin_destino:
        L.append('   %-58s %s' % (a[:58], m))
    io.open(PENDIENTES, 'w', encoding='utf-8').write(chr(10).join(L))

    print()
    print('Escrito:')
    print('  %s   %d filas' % (CM.MAESTRO, len(maestro)))
    print('  %s   %d renombres' % (MAPA_FOTOS, len(renombres)))
    print('  %s   lo que hay que corregir en la planilla' % PENDIENTES)
    return 0


if __name__ == '__main__':
    sys.exit(main())
