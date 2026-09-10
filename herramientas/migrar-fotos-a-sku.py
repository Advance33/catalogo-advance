# -*- coding: utf-8 -*-
"""Pone a las fotos el nombre que les corresponde HOY segun la planilla.

    python herramientas/migrar-fotos-a-sku.py             simula y muestra el plan
    python herramientas/migrar-fotos-a-sku.py --aplicar   renombra de verdad

Las fotos se llaman por SKU (contrato landing/1.2): fotos/<SKU>-<color>.jpg,
y fotos/<SKU>.jpg solo si el producto no tiene color. La regla vive en
fotos_sku.py. Este script hace dos cosas:

 A. Migra lo que quedo con nombre viejo por ID:
      <ID>-<color>.jpg  ->  <SKU>-<color>.jpg
      <ID>.jpg          ->  <SKU>-<primer color de la fila>.jpg, o <SKU>.jpg
    Un ID que ya no esta en la planilla se archiva: la planilla reutiliza
    numeros, y una foto colgada de un ID viejo puede aparecer manana en otro
    producto.

 B. Sigue a los productos cuyo SKU cambio. La planilla con la que se
    nombraron los archivos queda guardada en planilla-de-los-nombres.csv;
    un archivo que hoy no resuelve se busca ahi, se llega a la fila de hoy
    por el ID (el mismo, o el nuevo segun la hoja Meta) y se renombra al SKU
    de hoy. Si cae en dos SKU distintos, se avisa y no se toca. Una foto por
    SKU que no encuentra fila hoy se deja donde esta: el SKU se deriva del
    producto, asi que no puede colgarse de otra cosa, y el producto puede
    volver.

 Choques (dos archivos que caen en el mismo nombre): si son identicos queda
 uno; si no, gana el explicito de color sobre la portada del ID, entre dos
 explicitos gana el "mirada" del registro, y si empatan el mas nuevo. El que
 pierde se archiva en _fotos-antes-del-sku/ (ignorada por git) con un
 mapa.json de viejo -> nuevo. fotos-revisadas.txt se reescribe con los
 nombres nuevos: huella y estado viajan con el archivo.
"""
import collections
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
import fotos_sku as FS                       # noqa: E402
import validar                               # noqa: E402

FOTOS = os.path.join(RAIZ, 'fotos')
REVISADAS = os.path.join(RAIZ, 'fotos-revisadas.txt')
APARTE = os.path.join(RAIZ, '_fotos-antes-del-sku')
PLANILLA_NOMBRES = os.path.join(AQUI, 'planilla-de-los-nombres.csv')
APLICAR = '--aplicar' in sys.argv


def huella(nombre):
    with open(os.path.join(FOTOS, nombre), 'rb') as fh:
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
    with open(REVISADAS, 'w', encoding='utf-8') as fh:
        fh.write('# Fotos miradas contra el producto que dice la planilla.' + chr(10))
        fh.write('# Si una cambia, deja de coincidir y no se publica hasta mirarla.' + chr(10))
        fh.write('# Anotar las miradas:  python verificar-fotos.py --revisadas' + chr(10))
        fh.write('# Arrancar el registro: python verificar-fotos.py --sembrar' + chr(10))
        for archivo in sorted(reg):
            h, mirada = reg[archivo]
            fh.write('%s  %-34s # %s%s' % (h, archivo, 'mirada' if mirada else 'sin mirar', chr(10)))


# Lo unico que hace falta para saber de que producto era una foto. Este
# archivo se publica con el sitio, asi que no lleva ni precios ni terminos de
# busqueda ni nada que no se use: es una nota de trabajo, no la planilla.
COLUMNAS_NOMBRES = ['ID', 'SKU', 'Color', 'Descripción completa']


def guardar_planilla_de_los_nombres(filas_hoy, filas_antes, archivos_finales):
    """La planilla que corresponde a los nombres que quedaron en fotos/.

    Es la de hoy, mas las filas de la planilla anterior cuyo SKU ya no esta
    y que todavia tienen archivos en la carpeta: asi manana se sigue sabiendo
    de que producto era cada foto que quedo sin fila.
    """
    hoy = FS.indexar(filas_hoy)
    bases = {a[:-len(FS.EXT)] for a in archivos_finales}
    extra = []
    for f in filas_antes:
        sku = FS.sku_de(f)
        if not sku or sku in hoy['skus']:
            continue
        if any(b == sku or b.startswith(sku + '-') for b in bases):
            extra.append(f)
    with io.open(PLANILLA_NOMBRES, 'w', encoding='utf-8', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNAS_NOMBRES, extrasaction='ignore')
        w.writeheader()
        for f in filas_hoy + extra:
            w.writerow({c: (f.get(c) or '') for c in COLUMNAS_NOMBRES})
    return len(extra)


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    filas_hoy = validar.bajar_csv()
    conocidos = validar.leer_index()[0]
    pinta = validar.pinta
    hoy = FS.indexar(filas_hoy)
    if len(hoy['skus']) < 400:
        print('La planilla trajo %d SKU: algo esta mal, no se migra.' % len(hoy['skus']))
        return 2
    filas_antes = FS.leer_planilla(PLANILLA_NOMBRES)
    antes = FS.indexar(filas_antes) if filas_antes else None
    meta = validar.bajar_meta()
    puente = FS.puente_de_ids(meta)
    if antes:
        print('planilla de los nombres: %d filas · hoy: %d filas · puente de IDs del Meta: %d'
              % (len(filas_antes), len(filas_hoy), len(puente)))
    else:
        print('sin planilla-de-los-nombres.csv: solo se migran los nombres viejos por ID')

    archivos = sorted(n for n in os.listdir(FOTOS) if n.lower().endswith(FS.EXT))
    firma = {n: huella(n) for n in archivos}
    registro = leer_registro()

    # ---- a donde va cada archivo ----
    destino = collections.defaultdict(list)     # nombre nuevo -> [(nombre viejo, explicito)]
    ya_nuevos, archivar, quedan = [], [], []
    motivo_quedan = {}
    for n in archivos:
        base = n[:-len(FS.EXT)]
        r = FS.resolver(base, hoy['skus'], hoy['byid'].keys())
        if r and r['tipo'] == 'sku':
            # Trampa: si el SKU de ayer era mas largo que uno de hoy, el
            # archivo "resuelve" contra el corto con un color inventado
            # (celular~...~256gb-esim-blue cae en ~256gb con color "esim-blue").
            # Si ninguna fila vende ese "color" y la planilla de los nombres
            # lo conocia con otro SKU, se lo sigue como a cualquier cambio.
            if (r['color'] and antes and not FS.vende_color(hoy['por_sku'][r['clave']], r['color'], pinta, conocidos)):
                ra = FS.resolver(base, antes['skus'], antes['byid'].keys())
                if ra and ra['tipo'] == 'sku' and ra['clave'] != r['clave']:
                    d = FS.destino_hoy(base, antes, hoy, puente, pinta, conocidos)
                    if d['estado'] == 'renombrar' and d['nombre'] != base:
                        destino[d['nombre']].append((n, True))
                        continue
            ya_nuevos.append(n)
            continue
        if r:                                   # nombre viejo por ID, con fila hoy
            fila = hoy['byid'][r['clave']]
            if r['color']:
                destino[FS.nombre_color(FS.sku_de(fila), r['color'])].append((n, True))
            else:
                destino[FS.nombre_portada(fila, pinta, conocidos)].append((n, False))
            continue
        # no resuelve hoy: la planilla de los nombres dice de que producto era
        d = (FS.destino_hoy(base, antes, hoy, puente, pinta, conocidos) if antes
             else {'estado': 'desconocida', 'antes': None, 'hoy': []})
        if d['estado'] == 'renombrar':
            destino[d['nombre']].append((n, bool(d.get('color'))))
            continue
        es_id = FS.RE_ID.match(base) is not None
        if es_id:
            archivar.append(n)                  # un ID suelto es peligroso: se archiva
            motivo_quedan[n] = 'ID que ya no esta en la planilla'
        else:
            quedan.append(n)                    # un SKU suelto es inofensivo: se deja
            if d['estado'] == 'ambigua':
                motivo_quedan[n] = 'AMBIGUA: hoy cae en %s' % ', '.join(sorted({FS.sku_de(f) for f in d['hoy']}))
            elif d['antes'] is not None:
                motivo_quedan[n] = 'sin fila hoy; era %s «%s»' % (
                    (d['antes'].get('ID') or '').strip(), (d['antes'].get('Descripción completa') or '')[:50])
            else:
                motivo_quedan[n] = 'sin fila hoy ni en la planilla de los nombres'

    # ---- resolver choques ----
    mueve, aparta, motivo = {}, [], {}
    mirada_heredada = set()       # ganadores identicos a un perdedor ya mirado
    for nuevo, cands in sorted(destino.items()):
        if nuevo + FS.EXT in ya_nuevos:         # el nombre ya existe con un archivo valido
            cands = cands + [(nuevo + FS.EXT, True)]
        por_huella = collections.defaultdict(list)
        for n, explicito in cands:
            por_huella[firma[n]].append((n, explicito))
        todos = [(n, e) for lst in por_huella.values() for n, e in lst]
        todos.sort(key=lambda x: (not x[1], not registro.get(x[0], ('', False))[1],
                                  -os.path.getmtime(os.path.join(FOTOS, x[0])), x[0]))
        gana = todos[0][0]
        if gana != nuevo + FS.EXT:
            mueve[gana] = nuevo
        for n, e in todos[1:]:
            if n == nuevo + FS.EXT:
                # el que ya estaba pierde contra uno mejor: se aparta y el
                # nombre lo toma el ganador
                ya_nuevos.remove(n)
            aparta.append(n)
            motivo[n] = ('identica a %s (unificada en %s)' % (gana, nuevo) if firma[n] == firma[gana]
                         else 'otra toma del mismo color; queda %s' % gana)
            # los mismos bytes ya mirados siguen mirados, se llamen como se llamen
            if firma[n] == firma[gana] and registro.get(n, ('', False))[1]:
                mirada_heredada.add(gana)

    # ---- informe ----
    print('archivos: %d · ya con nombre de hoy: %d · se renombran: %d · se apartan: %d · se archivan: %d · quedan sin fila: %d'
          % (len(archivos), len(ya_nuevos), len(mueve), len(aparta), len(archivar), len(quedan)))
    print()
    if mueve:
        print('--- se renombran ---')
        for v, n in sorted(mueve.items()):
            print('  %-58s -> %s' % (v, n + FS.EXT))
    if aparta:
        print('--- se apartan ---')
        for n in aparta:
            print('  %-58s %s' % (n, motivo[n]))
    if archivar:
        print('--- se archivan (ID sin fila hoy) ---')
        for n in archivar:
            print('  %s' % n)
    if quedan:
        print('--- quedan en la carpeta sin fila hoy ---')
        for n in quedan:
            print('  %-58s %s' % (n, motivo_quedan[n]))

    if not APLICAR:
        print()
        print('Simulacion. Para hacerlo de verdad:  python herramientas/migrar-fotos-a-sku.py --aplicar')
        return 0

    # ---- aplicar ----
    os.makedirs(APARTE, exist_ok=True)
    ruta_mapa = os.path.join(APARTE, 'mapa.json')
    mapa = json.load(io.open(ruta_mapa, encoding='utf-8')) if os.path.exists(ruta_mapa) else {}
    mapa.setdefault('renombradas', {}); mapa.setdefault('apartadas', {}); mapa.setdefault('huerfanas', [])
    mapa.setdefault('corridas', []).append(datetime.datetime.now().strftime('%Y-%m-%d %H:%M'))
    for n in aparta + archivar:
        dest = os.path.join(APARTE, n)
        if os.path.exists(dest):
            dest = os.path.join(APARTE, '%s.%s' % (n, datetime.datetime.now().strftime('%Y%m%d%H%M%S')))
        shutil.move(os.path.join(FOTOS, n), dest)
        if n in aparta:
            mapa['apartadas'][n] = motivo[n]
        else:
            mapa['huerfanas'].append(n)
    # primero a nombres temporales: un nombre nuevo puede coincidir con uno viejo
    tmp = {}
    for v, n in mueve.items():
        t = os.path.join(FOTOS, '__mig__' + v)
        os.rename(os.path.join(FOTOS, v), t)
        tmp[v] = t
    for v, n in mueve.items():
        os.rename(tmp[v], os.path.join(FOTOS, n + FS.EXT))
        mapa['renombradas'][v] = n + FS.EXT
    io.open(ruta_mapa, 'w', encoding='utf-8').write(json.dumps(mapa, ensure_ascii=False, indent=1))

    # el registro viaja con los archivos
    finales = sorted(n for n in os.listdir(FOTOS) if n.lower().endswith(FS.EXT))
    nuevo_reg = {}
    for n, (h, mirada) in registro.items():
        mirada = mirada or n in mirada_heredada
        if n in mueve:
            destino_n = mueve[n] + FS.EXT
            prev = nuevo_reg.get(destino_n)
            nuevo_reg[destino_n] = (h, mirada or (prev[1] if prev else False))
        elif n in finales:
            nuevo_reg[n] = (h, mirada)
    for n in mirada_heredada:
        if n in finales and n not in registro:
            nuevo_reg[n] = (firma[n], True)
    for n in finales:
        nuevo_reg.setdefault(n, (firma.get(n) or huella(n), False))
    escribir_registro(nuevo_reg)

    extra = guardar_planilla_de_los_nombres(filas_hoy, filas_antes, finales)
    print()
    print('Hecho. %d renombradas, %d apartadas/archivadas en %s. Registro: %d entradas.'
          % (len(mueve), len(aparta) + len(archivar), APARTE, len(nuevo_reg)))
    print('Planilla de los nombres guardada: %d filas de hoy + %d de productos sin fila que aun tienen foto.'
          % (len(filas_hoy), extra))
    return 0


if __name__ == '__main__':
    sys.exit(main())
