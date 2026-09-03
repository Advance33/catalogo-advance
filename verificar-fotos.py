"""Chequeo automatico de las fotos del catalogo.

Baja la planilla Landing y compara contra la carpeta fotos/. Avisa de:
  1. Productos sin foto principal
  2. Colores sin su foto (fotos/<ID>-<color>.jpg)
  3. Fotos huerfanas (el ID ya no esta en la planilla)
  4. Fotos con nombre de color que no existe en la planilla
  5. MISMA FOTO en productos de modelos distintos  <- el chequeo importante
  6. Fotos que no son 900x900

El (5) es el que detecta el error grave: una ficha mostrando otro producto.

Se corre con doble clic en "VERIFICAR FOTOS.bat", o: python verificar-fotos.py
Escribe el resultado en REVISAR-FOTOS.txt
"""
import csv, io, os, re, sys, hashlib, collections, unicodedata, urllib.request, datetime

SHEET_ID  = '18xxslIKTBnVMrLixCGlQBJGje3vKBYQHXy0qvVp8tpQ'
SHEET_GID = '482985525'
AQUI   = os.path.dirname(os.path.abspath(__file__))
FOTOS  = os.path.join(AQUI, 'fotos')
SALIDA = os.path.join(AQUI, 'REVISAR-FOTOS.txt')
ACEPTADAS = os.path.join(AQUI, 'fotos-aceptadas.txt')

def norm(s):
    s = unicodedata.normalize('NFD', s or '')
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return s.lower().strip()

def slug(s):
    return re.sub(r'^-+|-+$', '', re.sub(r'[^a-z0-9]+', '-', norm(s)))

def colores(r):
    return [c.strip() for c in (r.get('Color') or '').split('/') if c.strip()]

def bajar():
    url = (f'https://docs.google.com/spreadsheets/d/{SHEET_ID}'
           f'/gviz/tq?tqx=out:csv&headers=1&gid={SHEET_GID}')
    with urllib.request.urlopen(url, timeout=60) as r:
        txt = r.read().decode('utf-8')
    if txt.lstrip().lower().startswith(('<!doctype', '<html')):
        raise SystemExit('ERROR: la planilla no es publica (Google devolvio HTML)')
    filas = [x for x in csv.DictReader(io.StringIO(txt)) if x.get('ID', '').strip()]
    if not filas:
        raise SystemExit('ERROR: la planilla vino vacia')
    return filas

def main():
    rows  = bajar()
    byid  = {r['ID'].strip(): r for r in rows}
    files = [f for f in os.listdir(FOTOS) if f.lower().endswith('.jpg')]
    have  = {os.path.splitext(f)[0] for f in files}

    def raiz(f):
        p = os.path.splitext(f)[0].split('-')
        for i in range(len(p), 0, -1):
            cand = '-'.join(p[:i])
            if cand in byid:
                return cand
        return None

    sin_base, sin_color, mal_color, huerfanas, tam = [], [], [], [], []
    for r in rows:
        pid = r['ID'].strip()
        if pid not in have:
            sin_base.append(f"{pid:<15} {r['Descripción completa'][:60]}")
        cols = colores(r)
        if len(cols) > 1:
            for c in cols:
                if f'{pid}-{slug(c)}' not in have:
                    sin_color.append(f"{pid}-{slug(c)}.jpg   ({r['Descripción completa'][:44]})")

    for f in files:
        base = os.path.splitext(f)[0]
        rz = raiz(f)
        if rz is None:
            huerfanas.append(f)
            continue
        resto = base[len(rz):].lstrip('-')
        if resto and resto not in {slug(c) for c in colores(byid[rz])}:
            mal_color.append(f"{f}   (la planilla dice: {byid[rz].get('Color','') or '(vacio)'})")

    try:
        from PIL import Image
        for f in files:
            try:
                w, h = Image.open(os.path.join(FOTOS, f)).size
                if (w, h) != (900, 900):
                    tam.append(f'{f}   {w}x{h}')
            except Exception:
                tam.append(f'{f}   NO SE PUDO LEER')
    except ImportError:
        tam.append('(Pillow no instalado: no se pudo chequear el tamano)')

    # el chequeo clave: misma imagen en productos de modelos distintos
    H = collections.defaultdict(list)
    for f in files:
        with open(os.path.join(FOTOS, f), 'rb') as fh:
            H[hashlib.md5(fh.read()).hexdigest()].append(f)
    repetidas = []
    for fs in H.values():
        if len(fs) < 2:
            continue
        ids = {raiz(x) for x in fs} - {None}
        if len(ids) < 2:
            continue
        mods = {(byid[i]['Modelo'] or '').strip().upper() for i in ids}
        if len(mods) > 1:
            repetidas.append((sorted(mods), sorted(ids), sorted(fs)))

    # Un duplicado puede ser correcto: el mismo equipo en otra capacidad usa
    # la misma foto y esta bien. Los que ya se miraron y se dieron por buenos
    # quedan anotados en fotos-aceptadas.txt (se agregan con --aceptar), asi
    # el chequeo solo frena por lo que aparecio DESPUES de la ultima revision.
    # Sin esto la alarma suena siempre y se termina ignorando.
    aceptadas = set()
    if os.path.exists(ACEPTADAS):
        with open(ACEPTADAS, encoding='utf-8') as fh:
            for linea in fh:
                linea = linea.split('#')[0].strip()
                if linea:
                    aceptadas.add(linea)
    clave = lambda ids: ','.join(sorted(ids))
    if '--aceptar' in sys.argv:
        with open(ACEPTADAS, 'w', encoding='utf-8') as fh:
            fh.write('# Duplicados de foto ya revisados y dados por buenos.' + chr(10))
            fh.write('# Se regenera con: python verificar-fotos.py --aceptar' + chr(10))
            for mods, ids, fs in repetidas:
                fh.write('%-40s # %s%s' % (clave(ids), ' | '.join(mods)[:60], chr(10)))
        print('Anotados %d duplicados como revisados en %s' % (len(repetidas), ACEPTADAS))
        return 0
    nuevas = [r for r in repetidas if clave(r[1]) not in aceptadas]

    L = []
    w = L.append
    w('REVISAR FOTOS — chequeo automatico')
    w('=' * 62)
    w(f'Generado: {datetime.datetime.now():%d/%m/%Y %H:%M}')
    w(f'Productos en la planilla: {len(rows)}   ·   fotos en la carpeta: {len(files)}')
    w('')
    w(f'  {len(sin_base):>4}  productos sin foto principal')
    w(f'  {len(sin_color):>4}  colores sin su foto')
    w(f'  {len(nuevas):>4}  MISMA FOTO en modelos distintos, SIN REVISAR  <-- mirar primero')
    w(f'  {len(repetidas) - len(nuevas):>4}  duplicados ya revisados (fotos-aceptadas.txt)')
    w(f'  {len(mal_color):>4}  fotos con un color que no esta en la planilla')
    w(f'  {len(huerfanas):>4}  fotos huerfanas (ID que ya no existe)')
    w(f'  {len(tam):>4}  fotos que no son 900x900')
    w('')

    def bloque(titulo, items, nota=''):
        w('-' * 62)
        w(f'{titulo}  ({len(items)})')
        if nota:
            w(nota)
        w('-' * 62)
        w('\n'.join('   ' + x for x in items) if items else '   (ninguna)')
        w('')

    w('=' * 62)
    w(f'1) MISMA FOTO EN MODELOS DISTINTOS  ({len(repetidas)})')
    w('   Dos productos de modelos diferentes muestran la misma imagen.')
    w('   Puede ser normal (equipos identicos) o un ERROR GRAVE: una ficha')
    w('   mostrando otro producto. Hay que MIRARLAS.')
    w('=' * 62)
    if repetidas:
        for mods, ids, fs in repetidas:
            w(f'   modelos: {" | ".join(mods)}')
            for i in ids:
                w(f'      {i:<15} {byid[i]["Descripción completa"][:56]}')
            w(f'      archivos: {", ".join(fs)}')
            w('')
    else:
        w('   (ninguna)')
        w('')

    bloque('2) PRODUCTOS SIN FOTO PRINCIPAL', sin_base)
    bloque('3) COLORES SIN SU FOTO', sin_color)
    bloque('4) FOTOS CON UN COLOR QUE NO ESTA EN LA PLANILLA', mal_color,
           '   O sobra la foto, o falta el color en la celda Color del Sheet.')
    bloque('5) FOTOS HUERFANAS (el ID ya no existe)', huerfanas)
    bloque('6) FOTOS QUE NO SON 900x900', tam)

    with open(SALIDA, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(L))
    print('\n'.join(L[:14]))
    print(f'...\nReporte completo en: {SALIDA}')

    # Lo unico que frena una publicacion es (1): dos productos de modelos
    # distintos mostrando la misma imagen. Lo demas son avisos -una foto que
    # falta se ve como un recuadro con la marca y no engania a nadie; una
    # ficha mostrando otro producto, si.
    return 1 if nuevas else 0

if __name__ == '__main__':
    sys.exit(main())
