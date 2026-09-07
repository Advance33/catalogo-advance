"""Chequeo automatico de las fotos del catalogo.

Baja la planilla Landing y compara contra la carpeta fotos/. Avisa de:
  1. Productos sin foto principal
  2. Colores sin su foto (fotos/<ID>-<color>.jpg)
  3. Fotos huerfanas (el ID ya no esta en la planilla)
  4. Fotos con nombre de color que no existe en la planilla
  5. MISMA FOTO en productos de modelos distintos
  6. Fotos que no son 900x900
  7. Fotos que CAMBIARON despues de haberse revisado
  8. Fotos nuevas que nadie miro
  9. Portadas que no coinciden con ninguna foto de color del producto
 10. Fotos viejas que quedaron por mirar

El (5), el (7) y el (8) son los que detectan el error grave: una ficha
mostrando otro producto. El (5) solo ve el caso de dos fichas con la misma
imagen; una foto que esta mal ella sola -el iPhone 17 con la foto de un 16e-
la agarran el (7) y el (8), que exigen que alguien haya mirado cada imagen y
que siga siendo la misma. Esa es la parte que faltaba: la foto del 16e se
saco varias veces y volvia sola en la siguiente copia por lote, porque nada
comparaba la imagen de hoy contra la que se habia dado por buena.

Se corre con doble clic en "VERIFICAR FOTOS.bat", o: python verificar-fotos.py
Escribe el resultado en REVISAR-FOTOS.txt

  python verificar-fotos.py --revisadas   anota TODAS las de hoy como miradas
  python verificar-fotos.py --revisadas CEL-APP-077.jpg    anota solo esa
  python verificar-fotos.py --sembrar     arranca el registro: lo ya mirado
                                          queda mirado y el resto, pendiente
  python verificar-fotos.py --aceptar     anota los duplicados como buenos
"""
import csv, io, os, re, sys, hashlib, collections, unicodedata, urllib.request, datetime

SHEET_ID  = '18xxslIKTBnVMrLixCGlQBJGje3vKBYQHXy0qvVp8tpQ'
SHEET_GID = '482985525'
AQUI   = os.path.dirname(os.path.abspath(__file__))
FOTOS  = os.path.join(AQUI, 'fotos')
SALIDA = os.path.join(AQUI, 'REVISAR-FOTOS.txt')
ACEPTADAS = os.path.join(AQUI, 'fotos-aceptadas.txt')
REVISADAS = os.path.join(AQUI, 'fotos-revisadas.txt')

def norm(s):
    s = unicodedata.normalize('NFD', s or '')
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return s.lower().strip()

def slug(s):
    return re.sub(r'^-+|-+$', '', re.sub(r'[^a-z0-9]+', '-', norm(s)))

def colores(r):
    return [c.strip() for c in (r.get('Color') or '').split('/') if c.strip()]

def leer_revisadas():
    """Lo que ya se miro: nombre de archivo -> huella que tenia ese dia.

    El chequeo de duplicados no alcanza para una foto que esta mal ella sola.
    El iPhone 17 mostro durante meses un 16e -una sola camara- y no habia dos
    productos con la misma imagen, asi que nada lo marcaba. Se arreglaba, y en
    la siguiente copia por lote volvia la mala sin que nadie se enterara.
    Con esto, una foto que cambia deja de coincidir con su huella y el sitio no
    se publica hasta que alguien la vuelva a mirar.

    Cada linea es:  <huella>  <archivo>  # mirada | sin mirar

    Las que dicen "sin mirar" son las que ya estaban en el catalogo cuando se
    armo el registro: son un pendiente, no frenan la publicacion. Frena lo que
    aparece o cambia DESPUES, que es por donde entra la foto equivocada.
    """
    reg = {}
    if os.path.exists(REVISADAS):
        with open(REVISADAS, encoding='utf-8') as fh:
            for linea in fh:
                datos, _, nota = linea.partition('#')
                partes = datos.split()
                if len(partes) == 2:
                    reg[partes[1]] = (partes[0], 'sin mirar' not in nota)
    return reg


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
    firma = {}
    for f in files:
        with open(os.path.join(FOTOS, f), 'rb') as fh:
            firma[f] = hashlib.md5(fh.read()).hexdigest()
        H[firma[f]].append(f)
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

    # La portada de un producto que tiene fotos de color deberia ser una de
    # ellas: es uno de los colores que se venden. Cuando no coincide con
    # ninguna suele ser el caso del iPhone 17, que en la grilla mostraba un
    # Air y adentro, al tocar los colores, aparecia el 17 de verdad.
    portada_suelta = []
    for r in rows:
        pid = r['ID'].strip()
        if pid + '.jpg' not in firma:
            continue
        suyas = [f for f in files if f.startswith(pid + '-')]
        if suyas and firma[pid + '.jpg'] not in {firma[f] for f in suyas}:
            portada_suelta.append('%-14s %s   (tiene %s)'
                                  % (pid, r['Descripción completa'][:40],
                                     ', '.join(f.replace(pid + '-', '') for f in sorted(suyas))))

    # --- las fotos contra el registro de lo ya mirado ---
    registro = leer_revisadas()
    cambiadas  = sorted(f for f in files if f in registro and registro[f][0] != firma[f])
    aparecidas = sorted(f for f in files if f not in registro)
    pendientes = sorted(f for f in files if f in registro and not registro[f][1])

    if '--revisadas' in sys.argv or '--sembrar' in sys.argv:
        # "--revisadas" a secas marca todo; con nombres detras, solo esos.
        sueltas = {a for a in sys.argv[1:] if not a.startswith('--')}
        todas = '--revisadas' in sys.argv and not sueltas
        with open(REVISADAS, 'w', encoding='utf-8') as fh:
            fh.write('# Fotos miradas contra el producto que dice la planilla.' + chr(10))
            fh.write('# Si una cambia, deja de coincidir y no se publica hasta mirarla.' + chr(10))
            fh.write('# Anotar las miradas:  python verificar-fotos.py --revisadas' + chr(10))
            fh.write('# Arrancar el registro: python verificar-fotos.py --sembrar' + chr(10))
            hechas = 0
            for f in sorted(files):
                # al sembrar, lo que ya estaba mirado y no cambio sigue mirado
                ok = (todas or f in sueltas
                      or (f in registro and registro[f][1] and registro[f][0] == firma[f]))
                hechas += ok
                fh.write('%s  %-34s # %s%s'
                         % (firma[f], f, 'mirada' if ok else 'sin mirar', chr(10)))
        print('Registro escrito: %d fotos, %d miradas, %d pendientes  (%s)'
              % (len(files), hechas, len(files) - hechas, REVISADAS))
        return 0

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
    w(f'  {len(cambiadas):>4}  FOTOS QUE CAMBIARON sin pasar por revision   <-- mirar primero')
    w(f'  {len(aparecidas):>4}  FOTOS NUEVAS que nadie miro todavia          <-- mirar primero')
    w(f'  {len(pendientes):>4}  fotos viejas que quedaron por mirar')
    w(f'  {len(portada_suelta):>4}  portadas que no son ninguna de sus fotos de color')
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
    bloque('7) FOTOS QUE CAMBIARON DESPUES DE REVISADAS', cambiadas,
           '   El archivo no es el que se miro. Puede ser una mejora, o la foto'
           + chr(10) + '   equivocada que volvio. Mirala y despues: python verificar-fotos.py --revisadas')
    bloque('8) FOTOS NUEVAS SIN MIRAR', aparecidas,
           '   Entraron despues del ultimo registro y nadie las comparo con el producto.')
    bloque('9) PORTADAS QUE NO SON NINGUNA DE SUS FOTOS DE COLOR', portada_suelta,
           '   La ficha muestra una imagen por fuera y otra al tocar los colores.'
           + chr(10) + '   Asi se veia el iPhone 17: un Air en la grilla y el 17 real adentro.'
           + chr(10) + '   Puede ser legitimo (una foto general del producto), pero hay que mirarlo.')
    bloque('10) FOTOS VIEJAS QUE QUEDARON POR MIRAR', pendientes,
           '   Estaban antes de que existiera el registro. No frenan la publicacion,'
           + chr(10) + '   pero son las que todavia podrian tener una imagen equivocada.')

    with open(SALIDA, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(L))
    print('\n'.join(L[:14]))
    print(f'...\nReporte completo en: {SALIDA}')

    # Frenan la publicacion las tres formas que tiene una ficha de mostrar otro
    # producto: (1) dos modelos con la misma imagen, (7) una foto que cambio
    # despues de revisada -asi es como volvia la mala cada vez- y (8) una foto
    # que nadie miro nunca. Lo demas son avisos: una foto que falta se ve como
    # un recuadro con la marca y no engania a nadie.
    # Mientras no exista el registro no se frena por (8): serian todas.
    return 1 if (nuevas or cambiadas or aparecidas) else 0

if __name__ == '__main__':
    sys.exit(main())
