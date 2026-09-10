# -*- coding: utf-8 -*-
"""Arma por primera vez el catalogo maestro a partir de la planilla de hoy.

    python herramientas/sembrar-catalogo-maestro.py             simula
    python herramientas/sembrar-catalogo-maestro.py --escribir  lo escribe

Se corre UNA VEZ. De ahi en mas el catalogo solo crece: las altas se agregan
con --altas y ningun codigo se reescribe nunca.

Lo que hace:
  1. Junta todos los colores que aparecen en la planilla, agrupa las
     escrituras que son el mismo color (el mapa COLORES de index.html ya dice
     que "black" y "bla" son el mismo tono, porque comparten el hex) y le
     pone a cada uno un codigo corto.
  2. Le da un codigo AT-#### a cada producto y AT-####-CCC a cada
     combinacion producto+color, en orden de categoria, marca y nombre, para
     que el catalogo se pueda leer de arriba abajo.
  3. Deja anotado con que ID y con que SKU entro cada uno, que es el puente
     para que la planilla pueda encontrarlos la primera vez.
  4. Escribe el mapa de renombre de las fotos que ya estan en la carpeta.
  5. Lista aparte lo que la planilla tiene mal cargado y no se puede
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
# monitores. No se inventa nada con ellas; la fila queda sin color y sale
# listada para que la planilla las saque de ahi.
NO_ES_COLOR = re.compile(
    r'^(fhd|qhd|wqhd|uhd|4k|2k|hd|hdr\d*|ips|va|tn|oled|led|curvo|curved|flat|'
    r'\d+\s*hz|\d+(\.\d+)?\s*ms.*|adaptive\s*sync|freesync|g-?sync|'
    r'dp|hdmi|vga|usb.*|vesa|\d+y\s*garantia|\d+\s*x\s*\d+|'
    r'fhd\s*\d+x\d+|\d+r|rapid\s*(ips|va)|pivot|regulable)$', re.I)


# Tipeos del proveedor que sabemos a que color corresponden. Van aca y no
# como un color nuevo: si "Garphite" entrara al catalogo con codigo propio,
# el dia que lo corrijan a "Graphite" las fotos de esos productos quedarian
# huerfanas. Como escritura de GRP, funciona hoy y sigue funcionando cuando
# lo arreglen. Cada uno esta pedido en CATALOGO-A-CORREGIR.txt.
TIPEOS = {
    'garphite': 'Graphite',          # CEL-SAM-076/077/078
    'shinny chalky grey': 'Shiny Chalky Grey',
}


def hexes_del_index():
    """El mapa COLORES de index.html: escritura -> hex. Dos escrituras con el
    mismo hex son el mismo color, y esa es la forma mas honesta de agrupar
    sinonimos sin inventar una lista nueva."""
    src = io.open(os.path.join(RAIZ, 'index.html'), encoding='utf-8').read()
    bloque = re.search(r'const COLORES = \{(.*?)\n\};', src, re.S)
    salida = {}
    if bloque:
        for m in re.finditer(r"'?([A-Za-z][A-Za-z0-9 ]*)'?\s*:\s*'(#[0-9A-Fa-f]{3,8})'", bloque.group(1)):
            salida[CM.norm(m.group(1))] = m.group(2).upper()
    return salida


def codigo_corto(nombre, usados):
    """Un codigo corto para un color, que se lea de un vistazo y no se pueda
    confundir con otro.

    Dos reglas:
      - un color de una palabra usa sus tres primeras letras (Black -> BLA);
        uno de varias, dos de la primera y una de cada siguiente, para que
        "Black Alpine Loop M" y "Black Milanese Loop L" se distingan solos.
      - NINGUN CODIGO PUEDE SER PREFIJO DE OTRO. Sin esa regla salian
        SIL/SILVE, WHI/WHITE, GRA/GRAPH, BLU/BLUEB: pares donde uno de los
        dos se lee como el otro a medio escribir, y estos codigos terminan
        siendo el nombre de un archivo. Cuando las tres primeras letras ya
        estan tomadas se pasa a las consonantes, que siguen siendo legibles
        (Silverblue -> SLV, Graphite -> GRP).
    """
    palabras = [p for p in re.split(r'[^A-Za-z0-9]+', CM.norm(nombre).upper()) if p]
    if not palabras:
        palabras = ['XXX']
    solo = re.sub(r'[^A-Z0-9]', '', ''.join(palabras))
    consonantes = re.sub(r'[AEIOU]', '', solo) or solo
    if len(palabras) == 1:
        cands = [palabras[0][:3], consonantes[:3], consonantes[:4], palabras[0][:5]]
    else:
        iniciales = palabras[0][:2] + ''.join(p[0] for p in palabras[1:])
        cands = [iniciales[:5], (palabras[0][:3] + ''.join(p[0] for p in palabras[1:]))[:5],
                 palabras[0][:3], consonantes[:3], consonantes[:4]]

    def libre(c):
        return (2 <= len(c) <= 5
                and not any(c.startswith(u) or u.startswith(c) for u in usados))

    cands += [iniciales[:4] if len(palabras) > 1 else '', consonantes[:5],
              solo[:4], solo[:5]]
    for c in cands:
        if c and libre(c):
            return c
    # Ultimo recurso: un codigo neutro. Nunca choca ni es prefijo de otro
    # porque ningun color empieza con "X" seguido de dos digitos, y es
    # preferible un codigo sin sentido a uno que se lea como el de al lado.
    for i in range(1, 100):
        c = 'X%02d' % i
        if libre(c):
            return c
    raise SystemExit('no se pudo generar un codigo para %r' % nombre)


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    if CM.leer():
        print('El catalogo maestro ya existe (%d filas). Esto se corre una sola vez.'
              % len(CM.leer()))
        print('Para ver que productos le faltan:  python herramientas/revisar-catalogo.py')
        print('Para volver a sembrarlo desde cero hay que borrar catalogo-maestro.csv,')
        print('y eso solo se puede hacer mientras el catalogo siga sin usarse.')
        return 2

    filas = validar.bajar_csv()
    filas = [f for f in filas if (f.get('ID') or '').strip()]
    conocidos, _, _, _, _ = validar.leer_index()
    pinta = validar.pinta
    hexes = hexes_del_index()

    # ---- 1. los colores ----
    escrituras = collections.Counter()
    sucios = collections.defaultdict(list)
    for f in filas:
        for c in FS.colores_de_la_fila(f, pinta, conocidos):
            if NO_ES_COLOR.match(c.strip()):
                sucios['spec'].append((f['ID'], c, f.get('Color', '')))
            elif ',' in c:
                sucios['coma'].append((f['ID'], c, f.get('Color', '')))
            elif not pinta(c, conocidos):
                sucios['desconocido'].append((f['ID'], c, f.get('Color', '')))
            else:
                escrituras[TIPEOS.get(CM.norm(c), c.strip())] += 1
                if CM.norm(c) in TIPEOS:
                    sucios['tipeo'].append((f['ID'], c, f.get('Color', '')))

    # agrupar escrituras que son el mismo color: mismo hex, o el mismo texto
    # sin espacios ni guiones ("Sky Blue" y "Skyblue")
    def hex_de(c):
        k = CM.norm(c)
        if k in hexes:
            return hexes[k]
        p = k.split()
        for x in (p[-1] if p else '', p[0] if p else ''):
            if x in hexes:
                return hexes[x]
        return None

    grupos = {}
    for c in sorted(escrituras, key=lambda x: (-escrituras[x], CM.norm(x))):
        apretado = re.sub(r'[^a-z0-9]', '', CM.norm(c))
        h = hex_de(c)
        clave = None
        for g, datos in grupos.items():
            if apretado in datos['apretados'] or (h and h == datos['hex'] and datos['una_palabra'] and ' ' not in c):
                clave = g
                break
        if clave is None:
            grupos[c] = {'nombre': c, 'apretados': {apretado}, 'hex': h,
                         'una_palabra': ' ' not in c, 'escrituras': [c], 'usos': escrituras[c]}
        else:
            grupos[clave]['apretados'].add(apretado)
            grupos[clave]['escrituras'].append(c)
            grupos[clave]['usos'] += escrituras[c]

    # El codigo se reparte por uso, no por orden alfabetico: el color que
    # aparece en 21 productos se queda con el codigo obvio y el que aparece en
    # uno se lleva el largo. Alfabetico daba GRA a "Graphite" (5 usos) y GRAY
    # a "Gray" (17), que es justo al reves de lo que uno espera leer.
    usados, colores = set(), []
    cod_de_escritura = {}
    reclamadas = set()          # una escritura pertenece a un solo color
    for g in sorted(grupos.values(), key=lambda x: (-x['usos'], CM.norm(x['nombre']))):
        cod = codigo_corto(g['nombre'], usados)
        usados.add(cod)
        otras = set(e for e in g['escrituras'] if e != g['nombre'])
        # y los sinonimos que index.html ya sabe que son el mismo tono, aunque
        # hoy no aparezcan en la planilla: "grey" comparte hex con "gray" y sin
        # esto el dia que el proveedor escriba "Grey" el color no se reconoce
        # y el producto se queda sin foto por una letra.
        # Solo para los colores de UNA palabra: ahi el hex identifica el color
        # entero. En "Black Milanese Loop L" el hex es el del negro y heredar
        # sus alias le daria "black" y "negro" a una correa, con lo cual cinco
        # codigos distintos se pelearian por la misma escritura.
        if g['hex'] and g['una_palabra']:
            otras.update(k for k, h in hexes.items()
                         if h == g['hex'] and CM.norm(k) != CM.norm(g['nombre'])
                         and CM.norm(k) not in reclamadas)
        otras.update(k for k, v in TIPEOS.items() if CM.norm(v) == CM.norm(g['nombre']))
        reclamadas.update(CM.norm(x) for x in otras)
        reclamadas.add(CM.norm(g['nombre']))
        colores.append({'Codigo': cod, 'Color': g['nombre'],
                        'Escrituras': '|'.join(sorted(otras)),
                        'Nota': '%d usos' % g['usos']})
        for e in g['escrituras']:
            cod_de_escritura[CM.norm(e)] = cod

    # ---- 2. los productos ----
    orden = lambda f: ((f.get('Categoría') or '').strip(), (f.get('Marca') or '').strip(),
                       CM.norm(f.get('Descripción completa')), (f.get('ID') or '').strip())
    por_sku = collections.OrderedDict()
    for f in sorted(filas, key=orden):
        por_sku.setdefault(FS.sku_de(f) or 'ID:' + f['ID'].strip(), []).append(f)

    hoy = datetime.date.today().isoformat()
    maestro, n = [], 0
    filas_sin_color = 0
    for sku, fs in por_sku.items():
        n += 1
        codigo = '%s-%04d' % (CM.PREFIJO, n)
        primera = fs[0]
        # los colores de todas las filas hermanas, sin repetir, en el orden en
        # que aparecen; asi el producto lleva su paleta completa
        vistos, paleta = set(), []
        for f in fs:
            for c in FS.colores_de_la_fila(f, pinta, conocidos):
                cod = cod_de_escritura.get(CM.norm(c))
                if cod and cod not in vistos:
                    vistos.add(cod)
                    paleta.append((cod, c))
        base = {'CODIGO': codigo,
                'Categoria': (primera.get('Categoría') or '').strip(),
                'Marca': (primera.get('Marca') or '').strip(),
                'Producto': (primera.get('Descripción completa') or '').strip(),
                'SKU_alta': sku if not sku.startswith('ID:') else '',
                'Precio_alta': (primera.get('Precio USD') or '').strip(),
                'Alta': hoy, 'Baja': '', 'Fusionado_en': '', 'Nota': ''}
        if not paleta:
            filas_sin_color += 1
            maestro.append(dict(base, CODIGO_COLOR=codigo, Color='', CodigoColor='',
                                ID_alta=primera['ID'].strip()))
            continue
        for cod, nombre in paleta:
            # el ID de alta es el de la fila que vende ese color
            de_quien = next((f['ID'].strip() for f in fs
                             if any(cod_de_escritura.get(CM.norm(x)) == cod
                                    for x in FS.colores_de_la_fila(f, pinta, conocidos))),
                            primera['ID'].strip())
            maestro.append(dict(base, CODIGO_COLOR='%s-%s' % (codigo, cod),
                                Color=nombre, CodigoColor=cod, ID_alta=de_quien))

    # ---- 3. el renombre de las fotos que ya estan ----
    # Una foto que hoy existe es la prueba de que ese color existio, aunque la
    # planilla ya no lo venda. Esas combinaciones tambien entran al catalogo,
    # anotadas: el dia que el color vuelva, su foto ya lo esta esperando. Es
    # justo lo que hasta ahora se perdia en cada rotacion.
    fotos = sorted(x for x in os.listdir(os.path.join(RAIZ, 'fotos')) if x.lower().endswith(FS.EXT))
    skus_hoy = {FS.sku_de(f) for f in filas if FS.sku_de(f)}
    ids_hoy = {f['ID'].strip() for f in filas}
    nombre_de_cod = {c['Codigo']: c['Color'] for c in colores}
    # todos los slugs que puede tener un color en un nombre de archivo,
    # incluidas las formas que el proveedor usa y que no son la canonica
    slugs_de_cod = {}
    for c in colores:
        formas = set()
        for e in [c['Color']] + [x for x in c['Escrituras'].split('|') if x]:
            formas.update(FS.formas(e))
        slugs_de_cod[c['Codigo']] = formas
    por_sku_cod, cod_por_sku = {}, {}
    for m in maestro:
        if m['SKU_alta']:
            por_sku_cod.setdefault(m['SKU_alta'], {})[m['CodigoColor']] = m['CODIGO_COLOR']
            cod_por_sku[m['SKU_alta']] = m['CODIGO']
    renombres, sin_destino, agregados = [], [], []
    for a in fotos:
        r = FS.resolver(a[:-len(FS.EXT)], skus_hoy, ids_hoy)
        if r is None or r['tipo'] != 'sku':
            sin_destino.append((a, 'el producto no esta en la planilla de hoy'))
            continue
        tabla = por_sku_cod.get(r['clave'], {})
        destino = None
        if not r['color']:
            # foto sin color: es la portada. Si el producto tiene paleta, va al
            # primer color; si no, al codigo pelado.
            destino = tabla.get('') or (sorted(v for k, v in tabla.items() if k)[:1] or [None])[0]
        else:
            for k, v in tabla.items():
                if k and r['color'] in slugs_de_cod[k]:
                    destino = v
                    break
            if destino is None:
                # un color que el producto tuvo y hoy no vende: se le da lugar
                cod = next((c['Codigo'] for c in colores
                            if r['color'] in slugs_de_cod[c['Codigo']]), None)
                base = cod_por_sku.get(r['clave'])
                if cod and base:
                    destino = '%s-%s' % (base, cod)
                    modelo = next(m for m in maestro if m['CODIGO'] == base)
                    maestro.append(dict(modelo, CODIGO_COLOR=destino, Color=nombre_de_cod[cod],
                                        CodigoColor=cod, Nota='hay foto; la planilla no lo vende hoy'))
                    agregados.append((a, destino))
        if destino:
            renombres.append((a, destino + FS.EXT))
        else:
            sin_destino.append((a, 'el color "%s" no es ninguno del catalogo' % r['color']))

    # ---- informe ----
    print('CATALOGO MAESTRO — semilla desde la planilla de hoy')
    print('=' * 66)
    print('filas de la planilla: %d' % len(filas))
    print('productos con codigo: %d   (AT-0001 .. %s)' % (n, '%s-%04d' % (CM.PREFIJO, n)))
    print('combinaciones producto+color: %d   (de esas, %d productos sin color,'
          % (len(maestro), filas_sin_color))
    print('                              %d colores que hoy no se venden pero tienen foto)'
          % len(agregados))
    print('colores distintos: %d' % len(colores))
    print('fotos que se renombran: %d de %d' % (len(renombres), len(fotos)))
    print()
    print('--- primeros colores ---')
    for c in colores[:14]:
        print('  %-5s %-28s %s' % (c['Codigo'], c['Color'][:28], c['Escrituras'][:32]))
    print()
    print('--- primeras filas del catalogo ---')
    for m in maestro[:12]:
        print('  %-14s %-16s %-40s %s' % (m['CODIGO_COLOR'], m['Marca'][:16],
                                          m['Producto'][:40], m['Color'][:16]))
    print()
    print('--- primeros renombres de foto ---')
    for a, b in renombres[:8]:
        print('  %-58s -> %s' % (a[:58], b))
    if sin_destino:
        print()
        print('--- %d fotos sin destino (se ven en %s) ---' % (len(sin_destino), os.path.basename(PENDIENTES)))
        for a, m in sin_destino[:6]:
            print('  %-58s %s' % (a[:58], m))

    if not ESCRIBIR:
        print()
        print('Simulacion. Para escribirlo:  python herramientas/sembrar-catalogo-maestro.py --escribir')
        return 0

    CM.escribir(maestro)
    CM.escribir_colores(colores)
    CM.guardar_contador(n)
    with io.open(MAPA_FOTOS, 'w', encoding='utf-8', newline='') as fh:
        w = csv.writer(fh)
        w.writerow(['archivo_hoy', 'archivo_nuevo'])
        w.writerows(renombres)

    L = ['LO QUE HAY QUE CORREGIR EN LA PLANILLA', '=' * 66, '',
         'Generado el %s por sembrar-catalogo-maestro.py' % datetime.date.today().strftime('%d/%m/%Y'), '']
    L += ['1) LA COLUMNA COLOR TIENE SPECS TECNICAS, NO COLORES  (%d)' % len(sucios['spec']), '-' * 66,
          '   Son monitores. La web lee esa columna como lista de colores y',
          '   termina dibujando un puntito que dice "240Hz". Las specs van en',
          '   Detalle, no en Color.', '']
    for pid, c, todo in sorted(set(sucios['spec']))[:60]:
        L.append('   %-14s %-22s   Color = %s' % (pid, c[:22], todo[:44]))
    L += ['', '2) DOS COSAS SEPARADAS POR COMA DENTRO DE UN COLOR  (%d)' % len(sucios['coma']), '-' * 66,
          '   "Black Ocean Band, Natural" son dos datos en una celda. La coma',
          '   no separa nada para la web y el color entero queda sin pintar.', '']
    for pid, c, todo in sorted(set(sucios['coma']))[:40]:
        L.append('   %-14s %-30s   Color = %s' % (pid, c[:30], todo[:38]))
    L += ['', '2b) TIPEOS QUE ESTAMOS TAPANDO DE ESTE LADO  (%d)' % len(sucios['tipeo']), '-' * 66,
          '   Los reconocemos igual para que el producto no se quede sin foto,',
          '   pero convendria corregirlos en la planilla.', '']
    for pid, c, todo in sorted(set(sucios['tipeo'])):
        L.append('   %-14s %-30s   deberia decir: %s' % (pid, c[:30], TIPEOS[CM.norm(c)]))
    L += ['', '3) COLORES QUE EL CATALOGO NO SABE PINTAR  (%d)' % len(sucios['desconocido']), '-' * 66,
          '   O es un tipeo del proveedor, o es un color nuevo que hay que',
          '   agregar al mapa COLORES de index.html.', '']
    for pid, c, todo in sorted(set(sucios['desconocido']))[:40]:
        L.append('   %-14s %-30s   Color = %s' % (pid, c[:30], todo[:38]))
    L += ['', '4) FOTOS QUE NO ENCONTRARON SU LUGAR EN EL CATALOGO  (%d)' % len(sin_destino), '-' * 66, '']
    for a, m in sin_destino:
        L.append('   %-58s %s' % (a[:58], m))
    io.open(PENDIENTES, 'w', encoding='utf-8').write(chr(10).join(L))

    print()
    print('Escrito:')
    print('  %s   %d filas' % (CM.MAESTRO, len(maestro)))
    print('  %s   %d colores' % (CM.COLORES_CSV, len(colores)))
    print('  %s   %d renombres' % (MAPA_FOTOS, len(renombres)))
    print('  %s   lo que hay que corregir en la planilla' % PENDIENTES)
    return 0


if __name__ == '__main__':
    sys.exit(main())
