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
import fotos_sku as FS       # los nombres de foto de antes del catalogo
import catalogo_maestro as CM   # la identidad propia de cada producto
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
    """Cada foto con lo que hay que saber para juzgarla.

    Las fotos se llaman por el codigo del catalogo (AT-0142-01.jpg), asi que
    el archivo dice solo?: de que producto es y de que variante. Lo demas
    -que vende hoy la fila, a que precio- sale de la planilla del dia.
    """
    filas = bajar()
    conocidos = validar.leer_index()[0]
    pinta = validar.pinta
    cols = lambda x: FS.colores_de_la_fila(x, pinta, conocidos)
    maestro = CM.leer()
    if not maestro:
        print('No hay catalogo maestro: no se puede saber de que producto es cada foto.')
        return []
    cidx = CM.indexar(maestro)

    # de cada fila de la planilla, su codigo de producto
    por_codigo = collections.defaultdict(list)
    for x in filas:
        cod, _ = CM.codigo_de_la_fila(x, cidx, pinta, conocidos)
        if cod:
            por_codigo[cod].append(x)

    archivos = [a for a in sorted(os.listdir(FOTOS)) if a.lower().endswith('.jpg')]
    firma = {a: hashlib.md5(open(os.path.join(FOTOS, a), 'rb').read()).hexdigest()
             for a in archivos}

    def entrada_de(a):
        """La fila del catalogo que corresponde al archivo, o None."""
        return cidx['por_var'].get(os.path.splitext(a)[0])

    # senal de riesgo: dentro de un grupo de la planilla, la misma variante
    # deberia ser la misma foto; la que se aparta es la sospechosa
    porgrupo = collections.defaultdict(lambda: collections.defaultdict(list))
    for a in archivos:
        e = entrada_de(a)
        if e is None or not (e.get('Variante') or '').strip():
            continue
        for x in por_codigo.get(CM.seguir_fusion(e['CODIGO'], cidx)) or []:
            g = (x.get('Grupo') or '').strip()
            if g:
                porgrupo[g][CM.norm(e['Variante'])].append(a)
    disidentes = set()
    for porvar in porgrupo.values():
        for lista in porvar.values():
            lista = sorted(set(lista))
            if len(lista) < 2:
                continue
            cuenta = collections.Counter(firma[a] for a in lista)
            if len(cuenta) > 1:
                primero = {}
                for a in lista:
                    primero.setdefault(firma[a], a)
                mayoria = min(cuenta, key=lambda h: (-cuenta[h], primero[h]))
                disidentes.update(a for a in lista if firma[a] != mayoria)

    # otra senal: dos variantes del mismo producto con la misma imagen. Una de
    # las dos miente, y es de las que mas cuesta ver a ojo.
    porprod = collections.defaultdict(list)
    for a in archivos:
        e = entrada_de(a)
        if e is not None:
            porprod[e['CODIGO']].append(a)
    repetidas = set()
    for lista in porprod.values():
        cuenta = collections.Counter(firma[a] for a in lista)
        repetidas.update(a for a in lista if cuenta[firma[a]] > 1)

    salida = []
    for a in archivos:
        e = entrada_de(a)
        if e is None:
            continue                       # el catalogo no la conoce: no hay que juzgar
        cod = CM.seguir_fusion(e['CODIGO'], cidx)
        vivas = por_codigo.get(cod) or []
        variante = (e.get('Variante') or '').strip()
        # Que ninguna fila venda hoy esa variante NO es un error: el producto
        # dejo de venderla y la foto se guardo. Pero conviene mirarla igual,
        # porque tambien es lo que pasa cuando el nombre esta mal.
        nadie = bool(variante) and not any(
            CM.norm(c) in CM.escrituras_de(e) for x in vivas for c in cols(x))
        riesgo = ((2 if a in disidentes else 0) + (2 if a in repetidas else 0)
                  + (1 if nadie else 0))
        salida.append({
            'archivo': a,
            'ruta': os.path.join(FOTOS, a),
            'codigo': e['CODIGO_VAR'],
            'producto': (vivas[0].get('Descripci\u00f3n completa') if vivas
                         else e.get('Producto', '')),
            'marca': e.get('Marca', ''),
            'categoria': e.get('Categoria', ''),
            'variante_del_archivo': variante or '(el producto no tiene variantes)',
            'que_vende_hoy': ' | '.join('/'.join(cols(x)) or '(sin color)' for x in vivas)
                             or '(hoy no esta en la planilla)',
            'precio_usd': (vivas[0].get('Precio USD', '') if vivas else ''),
            'nadie_vende_esa_variante': nadie,
            'misma_imagen_que_otra_variante': a in repetidas,
            'riesgo': riesgo,
        })
    return salida


ENCARGO = """Mira cada imagen del lote y deci si corresponde al producto.

Para cada entrada tenes la ruta de la foto, que producto dice ser y que
variante deberia mostrar. El nombre del archivo es un codigo interno y no
dice nada: lo que vale es "producto" y "variante_del_archivo".

Marca una foto como MAL cuando:
  - muestra otro aparato (otro modelo, otra generacion, otro tipo de cosa)
  - el nombre del archivo dice un color y en la imagen se ve otro
  - la imagen no corresponde a la variante que dice "variante_del_archivo"
  - dos variantes del mismo producto tienen la misma imagen (viene marcado
    con "misma_imagen_que_otra_variante": una de las dos miente)
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
