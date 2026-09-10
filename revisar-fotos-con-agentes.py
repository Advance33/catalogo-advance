# -*- coding: utf-8 -*-
"""Reparte las fotos del catalogo entre agentes para que alguien las MIRE.

Ninguna comprobacion automatica puede decir si una foto muestra el producto
que dice la planilla. El color promedio se equivoca con las pantallas
encendidas, y el archivo mejor nombrado del mundo puede tener otra cosa
adentro: CEL-APP-068-orange.jpg tenia el iPhone plateado.

Lo que si se puede automatizar es el reparto. Este script arma los lotes con
todo lo que el agente necesita para decidir, y despues toma los veredictos y
los vuelca al registro de fotos revisadas.

  python revisar-fotos-con-agentes.py --preparar
      Escribe lotes/lote-NN.json con las fotos que faltan mirar. Ordena por
      riesgo: primero las que ya tienen alguna senal en contra.

  python revisar-fotos-con-agentes.py --aplicar lotes/veredictos.json
      Marca como miradas las que el agente dio por buenas y deja en
      FOTOS-QUE-ESTAN-MAL.txt las que no, con el motivo.

  python revisar-fotos-con-agentes.py --preparar --todas --por-lote 25
      Igual pero sin filtrar por riesgo: el catalogo entero.
"""
import collections, csv, hashlib, io, json, os, re, sys, unicodedata, urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.join(AQUI, 'herramientas'))
import fotos_sku as FS       # como se llaman las fotos: por SKU (contrato landing/1.2)
import validar               # la lista de colores del catalogo
FOTOS = os.path.join(AQUI, 'fotos')
LOTES = os.path.join(AQUI, 'lotes')
REVISADAS = os.path.join(AQUI, 'fotos-revisadas.txt')
INFORME = os.path.join(AQUI, 'FOTOS-QUE-ESTAN-MAL.txt')
SHEET_ID = '18xxslIKTBnVMrLixCGlQBJGje3vKBYQHXy0qvVp8tpQ'
SHEET_GID = '482985525'


def norm(s):
    s = unicodedata.normalize('NFD', s or '')
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn').lower().strip()


def slug(s):
    return re.sub(r'^-+|-+$', '', re.sub(r'[^a-z0-9]+', '-', norm(s)))


def bajar():
    url = ('https://docs.google.com/spreadsheets/d/%s/gviz/tq?tqx=out:csv&headers=1&gid=%s'
           % (SHEET_ID, SHEET_GID))
    with urllib.request.urlopen(url, timeout=60) as r:
        txt = r.read().decode('utf-8')
    return [x for x in csv.DictReader(io.StringIO(txt)) if (x.get('ID') or '').strip()]


def leer_registro():
    reg = {}
    if os.path.exists(REVISADAS):
        with open(REVISADAS, encoding='utf-8') as fh:
            for linea in fh:
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
            huella, mirada = reg[archivo]
            fh.write('%s  %-34s # %s%s'
                     % (huella, archivo, 'mirada' if mirada else 'sin mirar', chr(10)))


def datos_de_las_fotos():
    """Cada foto con lo que hay que saber para juzgarla."""
    filas = bajar()
    conocidos = validar.leer_index()[0]
    pinta = validar.pinta
    byid = {x['ID'].strip(): x for x in filas}
    skus = set(FS.sku_de(x) for x in filas if FS.sku_de(x))
    por_sku = collections.defaultdict(list)
    for x in filas:
        if FS.sku_de(x):
            por_sku[FS.sku_de(x)].append(x)
    archivos = [a for a in sorted(os.listdir(FOTOS)) if a.lower().endswith('.jpg')]
    firma = {a: hashlib.md5(open(os.path.join(FOTOS, a), 'rb').read()).hexdigest()
             for a in archivos}

    # Cada archivo se llama <SKU>-<color> (o <ID>-<color> si todavia no se
    # migro). El SKU lo comparten las hermanas de otro color, asi que un
    # archivo puede ser de varias filas: se juzga contra la que vende ese color.
    def partir(a):
        r = FS.resolver(os.path.splitext(a)[0], skus, byid.keys())
        if r is None:
            return None, [], ''
        filas_a = por_sku[r['clave']] if r['tipo'] == 'sku' else [byid[r['clave']]]
        return (r['tipo'], r['clave']), filas_a, r['color']

    def fila_de(filas_a, col):
        for x in filas_a:
            if col and FS.color_coincide(col, FS.colores_de_la_fila(x, pinta, conocidos)):
                return x
        return filas_a[0]

    # senal de riesgo: dentro de un grupo, el mismo color deberia ser la misma
    # foto en todas las filas; la que se aparta es la sospechosa
    porgrupo = collections.defaultdict(lambda: collections.defaultdict(list))
    for a in archivos:
        clave, filas_a, col = partir(a)
        if clave and col:
            for g in {(x.get('Grupo') or '').strip() for x in filas_a}:
                if g:
                    porgrupo[g][col].append(a)
    disidentes = set()
    for porcolor in porgrupo.values():
        for lista in porcolor.values():
            if len(lista) < 2:
                continue
            cuenta = collections.Counter(firma[a] for a in lista)
            if len(cuenta) > 1:
                mayoria = cuenta.most_common(1)[0][0]
                disidentes.update(a for a in lista if firma[a] != mayoria)

    # otra senal: una foto sin color (<SKU>.jpg o <ID>.jpg) que no coincide
    # con ninguna foto de color del mismo producto
    de_cada = collections.defaultdict(lambda: {'sin_color': [], 'con_color': []})
    for a in archivos:
        clave, filas_a, col = partir(a)
        if clave:
            de_cada[clave]['con_color' if col else 'sin_color'].append(a)
    portada_suelta = set()
    for d in de_cada.values():
        con = {firma[a] for a in d['con_color']}
        for a in d['sin_color']:
            if con and firma[a] not in con:
                portada_suelta.add(a)

    salida = []
    for a in archivos:
        clave, filas_a, col = partir(a)
        if not clave:
            continue
        x = fila_de(filas_a, col)
        # Que ninguna fila del producto venda el color que dice el archivo es
        # la senal mas fuerte que hay: o la foto es de otro producto, o el
        # nombre esta mal. Va primera en la cola.
        nadie = bool(col) and not FS.vende_color(filas_a, col, pinta, conocidos)
        riesgo = ((3 if nadie else 0) + (2 if a in disidentes else 0)
                  + (1 if a in portada_suelta else 0))
        salida.append({
            'archivo': a,
            'ruta': os.path.join(FOTOS, a),
            'id': x['ID'].strip(),
            'sku': FS.sku_de(x),
            'ids_del_sku': [y['ID'].strip() for y in filas_a],
            'producto': x['Descripción completa'],
            'marca': x.get('Marca', ''),
            'categoria': x.get('Categoría', ''),
            'colores_que_vende': ' | '.join('/'.join(FS.colores_de_la_fila(y, pinta, conocidos)) or '(sin color)'
                                            for y in filas_a),
            'color_del_nombre': col or '(sin color: es la unica foto del producto)',
            'precio_usd': x.get('Precio USD', ''),
            'nombre_viejo_por_id': clave[0] == 'id',
            'nadie_vende_ese_color': nadie,
            'riesgo': riesgo,
        })
    return salida


ENCARGO = """Mira cada imagen del lote y deci si corresponde al producto.

Para cada entrada tenes la ruta de la foto, que producto dice ser y, si el
nombre del archivo termina en un color, que color deberia mostrar.

Marca una foto como MAL cuando:
  - muestra otro aparato (otro modelo, otra generacion, otro tipo de cosa)
  - el nombre del archivo dice un color y en la imagen se ve otro
  - el archivo dice un color que la planilla no vende (viene marcado con
    "nadie_vende_ese_color": ahi hay que mirar con mas atencion)
  - muestra un accesorio o una caja en vez del producto

No la marques mal por:
  - el angulo, el recorte o que la foto sea de estudio o de catalogo ajeno
  - que se vea el aparato sin sus accesorios
  - diferencias que solo un experto notaria con el aparato en la mano

Si no podes decidir, pone "duda" y explica que te falta.

Responde SOLO un JSON, sin texto alrededor:
[{"archivo": "...", "veredicto": "bien|mal|duda", "que_muestra": "...", "motivo": "..."}]
El campo que_muestra va siempre: describi lo que ves (aparato y color)."""


def preparar(todas, por_lote):
    fotos = datos_de_las_fotos()
    reg = leer_registro()
    if not todas:
        # "Mirada" vale solo si la imagen sigue siendo la que se miro: una foto
        # que cambio despues de revisada es justo la que hay que volver a ver.
        def falta(f):
            h, mirada = reg.get(f['archivo'], ('', False))
            return not mirada or h != hashlib.md5(open(f['ruta'], 'rb').read()).hexdigest()
        fotos = [f for f in fotos if falta(f)]
    fotos.sort(key=lambda f: (-f['riesgo'], f['archivo']))
    if not fotos:
        print('No queda ninguna foto por mirar.')
        return 0
    os.makedirs(LOTES, exist_ok=True)
    # Se van tambien los veredictos de la tanda anterior: con nombres nuevos,
    # un veredicto viejo se aplica en silencio sobre archivos que ya no estan.
    for viejo in os.listdir(LOTES):
        if re.match(r'(lote|veredicto)s?-?\d*\.json$', viejo):
            os.remove(os.path.join(LOTES, viejo))
    n = 0
    for i in range(0, len(fotos), por_lote):
        n += 1
        with io.open(os.path.join(LOTES, 'lote-%02d.json' % n), 'w', encoding='utf-8') as fh:
            fh.write(json.dumps({'encargo': ENCARGO, 'fotos': fotos[i:i + por_lote]},
                                ensure_ascii=False, indent=1))
    con_riesgo = sum(1 for f in fotos if f['riesgo'])
    print('%d fotos por mirar en %d lote(s) de hasta %d, en %s'
          % (len(fotos), n, por_lote, LOTES))
    print('%d vienen con alguna senal en contra y quedaron primeras.' % con_riesgo)
    return 0


def aplicar(ruta):
    veredictos = json.load(io.open(ruta, encoding='utf-8'))
    if isinstance(veredictos, dict):
        veredictos = veredictos.get('fotos') or veredictos.get('veredictos') or []
    reg = leer_registro()
    firma = {}
    for v in veredictos:
        a = v.get('archivo')
        p = os.path.join(FOTOS, a or '')
        if a and os.path.exists(p):
            firma[a] = hashlib.md5(open(p, 'rb').read()).hexdigest()

    bien = [v for v in veredictos if v.get('veredicto') == 'bien' and v['archivo'] in firma]
    mal = [v for v in veredictos if v.get('veredicto') == 'mal']
    duda = [v for v in veredictos if v.get('veredicto') == 'duda']
    for v in bien:
        reg[v['archivo']] = (firma[v['archivo']], True)
    escribir_registro(reg)

    L = ['FOTOS QUE ESTAN MAL — revisadas por agentes', '=' * 62, '']
    for titulo, lista in (('MAL', mal), ('DUDA', duda)):
        L.append('%s (%d)' % (titulo, len(lista)))
        L.append('-' * 62)
        for v in lista:
            L.append('  %-30s %s' % (v.get('archivo', '?'), v.get('que_muestra', '')))
            L.append('  %-30s %s' % ('', v.get('motivo', '')))
        L.append('')
    io.open(INFORME, 'w', encoding='utf-8').write(chr(10).join(L))
    print('%d dadas por buenas y anotadas · %d mal · %d en duda' % (len(bien), len(mal), len(duda)))
    print('Detalle en %s' % INFORME)
    return 1 if mal else 0


def main():
    args = sys.argv[1:]
    por_lote = 25
    if '--por-lote' in args:
        por_lote = int(args[args.index('--por-lote') + 1])
    if '--preparar' in args:
        return preparar('--todas' in args, por_lote)
    if '--aplicar' in args:
        return aplicar(args[args.index('--aplicar') + 1])
    print(__doc__)
    return 2


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.exit(main())
