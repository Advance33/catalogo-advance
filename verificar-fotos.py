"""Chequeo automatico de las fotos del catalogo.

Baja la planilla Landing y compara contra la carpeta fotos/. Desde el
contrato landing/1.2 las fotos se llaman por SKU (herramientas/fotos_sku.py):
    fotos/<SKU>-<color>.jpg     la foto de ese color; la portada de una fila es
                                la de su PRIMER color
    fotos/<SKU>.jpg             solo productos sin color
Los nombres viejos por ID se siguen entendiendo, y se avisa para migrarlos.

Avisa de:
  1. Productos sin foto de portada
  2. Colores sin su foto
  3. Fotos huerfanas (ni el SKU ni el ID estan en la planilla)
 3b. Fotos que perdieron su producto porque le cambiaron el SKU
  4. Fotos con nombre de color que ninguna fila del SKU vende
  5. MISMA FOTO en productos distintos (distinto Modelo Y distinto SKU)
  6. Fotos que no son 900x900
  7. Fotos que CAMBIARON despues de haberse revisado
  8. Fotos nuevas que nadie miro
  9. Mismo color con distinta foto en filas del mismo grupo
 10. Fotos con nombre viejo (por ID): faltan migrar
 11. Portadas que son la foto de un color que la fila no vende
 12. Fotos viejas que quedaron por mirar
 13. Dos colores del MISMO producto con la misma imagen

Frenan la publicacion el (5), el (7), el (8), el (11) y el (3b): son las
formas que tiene una ficha de mostrar otro producto, o ninguno. El (7) y el
(8) exigen que alguien haya mirado cada imagen y que siga siendo la misma;
el (11) mira que la portada sea del color que la fila vende HOY, que es como
volvian los errores cuando la planilla rotaba colores bajo el mismo ID; y el
(3b) atrapa las fotos que quedan colgadas cuando la planilla le cambia el
SKU a un producto que sigue vivo (el 10/09/2026 le paso a 36 de golpe).

Se corre con doble clic en "VERIFICAR FOTOS.bat", o: python verificar-fotos.py
Escribe el resultado en REVISAR-FOTOS.txt y el indice fotos/indice.json que
lee la web para elegir la portada.

  python verificar-fotos.py --revisadas   anota TODAS las de hoy como miradas
  python verificar-fotos.py --revisadas X.jpg    anota solo esa
  python verificar-fotos.py --sembrar     arranca el registro: lo ya mirado
                                          queda mirado y el resto, pendiente
  python verificar-fotos.py --aceptar     anota los duplicados como buenos
"""
import csv, io, os, re, sys, json, hashlib, collections, urllib.request, datetime

AQUI   = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
sys.path.insert(0, os.path.join(AQUI, 'herramientas'))
import fotos_sku as FS                        # la unica verdad sobre nombres de foto
import catalogo_maestro as CM                 # la identidad propia de cada producto
import validar                                # la lista de colores del catalogo

SHEET_ID  = '18xxslIKTBnVMrLixCGlQBJGje3vKBYQHXy0qvVp8tpQ'
SHEET_GID = '482985525'
FOTOS  = os.path.join(AQUI, 'fotos')
SALIDA = os.path.join(AQUI, 'REVISAR-FOTOS.txt')
ACEPTADAS = os.path.join(AQUI, 'fotos-aceptadas.txt')
REVISADAS = os.path.join(AQUI, 'fotos-revisadas.txt')
INDICE = os.path.join(FOTOS, 'indice.json')
PLANILLA_NOMBRES = os.path.join(AQUI, 'herramientas', 'planilla-de-los-nombres.csv')


def leer_revisadas():
    """Lo que ya se miro: nombre de archivo -> (huella, mirada).

    El chequeo de duplicados no alcanza para una foto que esta mal ella sola.
    El iPhone 17 mostro durante meses un Air y no habia dos productos con la
    misma imagen, asi que nada lo marcaba. Con esto, una foto que cambia deja
    de coincidir con su huella y el sitio no se publica hasta que alguien la
    vuelva a mirar. Las que dicen "sin mirar" son un pendiente, no frenan.
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
    ids   = set(byid)
    skus  = {FS.sku_de(r) for r in rows if FS.sku_de(r)}
    por_sku = collections.defaultdict(list)
    for r in rows:
        if FS.sku_de(r):
            por_sku[FS.sku_de(r)].append(r)
    conocidos = validar.leer_index()[0]
    pinta = validar.pinta
    colores = lambda r: FS.colores_de_la_fila(r, pinta, conocidos)

    files = [f for f in os.listdir(FOTOS) if f.lower().endswith(FS.EXT)]
    bases = {os.path.splitext(f)[0] for f in files}

    # El indice que lee la web (fotos/indice.json). Con el, la pagina sabe que
    # archivos existen sin pedirlos uno por uno, y elige la portada por el
    # primer color del dia. Se reescribe en cada corrida: PUBLICAR.bat corre
    # este script antes del commit, asi que el indice publicado siempre es el
    # de la carpeta.
    # Y con el, el mapa del catalogo maestro: como llega la web del producto
    # de la planilla al nombre de su foto. Van juntos a proposito, porque
    # tienen que ser del mismo momento: un indice nuevo con un mapa viejo
    # muestra fotos que ya no son de ese producto.
    indice = {'generado': datetime.datetime.now().strftime('%Y-%m-%dT%H:%M:%S'),
              'archivos': sorted(files)}
    try:
        maestro = CM.leer()
        if maestro:
            indice['catalogo'] = CM.mapa_para_la_web(maestro)
    except CM.CatalogoRoto as e:
        print('OJO: el catalogo maestro esta roto, el indice va sin el.')
        print('   %s' % e)
    with open(INDICE, 'w', encoding='utf-8') as fh:
        json.dump(indice, fh, ensure_ascii=False, indent=0)

    # Las columnas CODIGO y CODIGO_VAR del contrato landing/1.3. Las escribe
    # el otro proyecto con el mismo catalogo maestro que tenemos aca, asi que
    # tienen que dar lo mismo. Cuando dejen de dar lo mismo es que una de las
    # dos puntas cambio y la otra no se entero, y eso no se ve mirando la
    # pagina: se ve cuando un cliente abre una ficha con la foto de otro.
    choques, corridas, fantasma = [], [], []
    try:
        maestro_idx = CM.indexar(CM.leer())
    except CM.CatalogoRoto:
        maestro_idx = None
    if maestro_idx:
        for r in rows:
            suyo = (r.get('CODIGO') or '').strip().upper()
            if not suyo:
                continue
            if suyo not in maestro_idx['por_codigo']:
                fantasma.append('%s -> %s' % (r['ID'].strip(), suyo))
                continue
            crudo = dict(r, CODIGO='', CODIGO_VAR='')      # sin la columna
            mio = CM.codigo_de_la_fila(crudo, maestro_idx, pinta, conocidos)[0]
            if mio and mio != suyo:
                choques.append('%s: la planilla dice %s y el catalogo dice %s'
                               % (r['ID'].strip(), suyo, mio))
            # Y que la celda de variantes tenga tantas posiciones como colores:
            # una celda corrida le da a un color el codigo del color de al lado.
            cols = colores(r)
            celda = (r.get('CODIGO_VAR') or '').strip()
            partes = [x.strip() for x in celda.split('/')] if celda else []
            if cols and partes and len(partes) != len(cols):
                corridas.append('%s: %d color(es) y %d codigo(s) de variante'
                                % (r['ID'].strip(), len(cols), len(partes)))

    # ---- el codigo de cada fila de la planilla ----
    # Es la identidad de verdad: se le asigno al producto una vez y no cambia
    # aunque el proveedor le reescriba el nombre. Mientras la planilla no
    # traiga la columna, se resuelve con el vinculo guardado y se verifica que
    # el producto siga siendo el mismo.
    maestro = CM.leer() if os.path.exists(CM.MAESTRO) else []
    cidx = CM.indexar(maestro)
    validos = {m['CODIGO_VAR'] for m in maestro}
    codigo_de, sin_codigo = {}, []
    for r in rows:
        cod, de = (CM.codigo_de_la_fila(r, cidx, pinta, conocidos) if maestro else ('', 'falta'))
        if cod:
            codigo_de[r['ID'].strip()] = cod
        else:
            sin_codigo.append('%-14s %-50s %s'
                              % (r['ID'].strip(), r['Descripción completa'][:50],
                                 'no esta en el catalogo' if de == 'falta'
                                 else 'el vinculo apunta a otro producto'))
    por_codigo = collections.defaultdict(list)
    for r in rows:
        c = codigo_de.get(r['ID'].strip())
        if c:
            por_codigo[c].append(r)

    # ---- a que producto pertenece cada archivo ----
    usuarios, color_de, viejos, huerfanas = {}, {}, [], []
    for f in files:
        base = os.path.splitext(f)[0]
        cv = CM.partir(base)
        if cv and base in validos:
            entrada = cidx['por_var'][base]
            color_de[f] = entrada.get('Variante') or ''
            filas_cod = por_codigo.get(CM.seguir_fusion(cv[0], cidx)) or []
            # La variante la venden las filas que hoy la ofrecen. Si ninguna
            # (un color que roto y quedo la foto), es de todas las del
            # producto, y el chequeo (4) lo avisa.
            venden = [x for x in filas_cod
                      if any(CM.norm(c) in CM.escrituras_de(entrada) for c in colores(x))]
            usuarios[f] = venden or filas_cod
            if not filas_cod:
                huerfanas.append(f)
            continue
        # los nombres de las dos etapas anteriores, que ya no deberian quedar
        r = FS.resolver(base, skus, ids)
        if r is None:
            huerfanas.append(f)
            continue
        viejos.append(f)
        color_de[f] = r['color']
        usuarios[f] = (por_sku[r['clave']] if r['tipo'] == 'sku' else [byid[r['clave']]])

    # ---- 3b: las fotos de un producto que hoy no tiene fila ----
    # No se pierden ni se mueven: el codigo sale del producto y no puede
    # colgarse de otro. Se quedan esperando a que el producto vuelva, que es
    # lo que antes no pasaba: cada cambio de nombre las dejaba sin dueño.
    perdidas, huerfanas_expl = [], []
    for f in huerfanas:
        entrada = cidx['por_var'].get(os.path.splitext(f)[0])
        huerfanas_expl.append('%-16s %s' % (
            f, (entrada.get('Producto') or '')[:56] if entrada is not None
            else 'no esta en el catalogo maestro'))

    def existe(base):
        return base in bases

    def candidatos(r):
        c = codigo_de.get(r['ID'].strip())
        return CM.candidatos_foto(c, colores(r), cidx) if c else []

    # ---- 1 y 2: lo que le falta a cada fila ----
    sin_base, sin_color = [], []
    for r in rows:
        pid = r['ID'].strip()
        cols = colores(r)
        cand = candidatos(r)
        # la portada: lo mismo que prueba la web, en el mismo orden
        if cand and not any(existe(c) for c in cand):
            sin_base.append('%-14s %-14s %s' % (pid, cand[0], r['Descripción completa'][:46]))
        if len(cols) > 1:
            cod = codigo_de.get(pid)
            for c in cols:
                v = CM.variante_de(cod, c, cidx) if cod else ''
                if v and not existe(v):
                    sin_color.append('%-14s %-18s (%s)' % (v + '.jpg', c[:18], r['Descripción completa'][:40]))

    # ---- 4: una variante que ninguna fila del producto vende hoy ----
    # No es un error: un producto deja de vender un color y su foto se queda
    # esperando, que es justo lo que el catalogo vino a permitir. Se lista
    # para saber que hay, no para arreglar nada.
    mal_color = []
    for f in files:
        if f not in usuarios or not color_de[f]:
            continue
        vende = set()
        for r in usuarios[f]:
            vende.update(CM.norm(c) for c in colores(r))
        if CM.norm(color_de[f]) not in vende:
            mal_color.append('%-16s %-24s la planilla dice: %s'
                             % (f, color_de[f][:24],
                                ' | '.join((r.get('Color') or '(vacio)') for r in usuarios[f])[:40]))

    # ---- 6: tamano ----
    tam = []
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

    # ---- 5: la misma imagen en productos de modelos distintos ----
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
        rs = [r for f in fs for r in usuarios.get(f, [])]
        ids_r = {r['ID'].strip() for r in rs}
        if len(ids_r) < 2:
            continue
        # Tienen que ser productos distintos por los DOS lados:
        #   - distinto Modelo, porque el mismo equipo en otra capacidad usa la
        #     misma foto y esta bien (Galaxy S25 FE de 256 y de 512GB);
        #   - y distinto SKU, porque las hermanas de color del mismo producto
        #     tambien la comparten: los tres Ray-Ban Skyler tienen tres codigos
        #     de Modelo distintos ("601/1M52", "601/CH52", "601/T352") y salian
        #     como error todos los dias siendo el mismo anteojo.
        ident = {FS.sku_de(r) or r['ID'].strip() for r in rs}
        mods = {(r['Modelo'] or '').strip().upper() for r in rs}
        if len(mods) > 1 and len(ident) > 1:
            repetidas.append((sorted(mods), sorted(ids_r), sorted(fs), firma[fs[0]]))

    # Un duplicado puede ser correcto: el mismo equipo en otra capacidad usa la
    # misma foto y esta bien. Los que ya se miraron y se dieron por buenos
    # quedan en fotos-aceptadas.txt (--aceptar), asi el chequeo solo frena por
    # lo que aparecio DESPUES. Sin esto la alarma suena siempre y se ignora.
    #
    # La clave es la huella de la imagen y en cuantos modelos aparece: los IDs
    # se renumeran y los SKU cambian (el 10/09/2026 la misma lista de
    # duplicados salio "nueva" cinco veces solo por eso), la imagen no. Si
    # manana la misma foto aparece en un modelo MAS, vuelve a sonar. Las
    # claves viejas por lista de IDs se siguen entendiendo.
    aceptadas_md5, aceptadas_ids = {}, set()
    if os.path.exists(ACEPTADAS):
        with open(ACEPTADAS, encoding='utf-8') as fh:
            for linea in fh:
                linea = linea.split('#')[0].strip()
                p = linea.split()
                if len(p) == 2 and re.fullmatch(r'[0-9a-f]{32}', p[0]) and p[1].isdigit():
                    aceptadas_md5[p[0]] = int(p[1])
                elif linea:
                    aceptadas_ids.add(linea)
    clave = lambda ids_: ','.join(sorted(ids_))
    if '--aceptar' in sys.argv:
        with open(ACEPTADAS, 'w', encoding='utf-8') as fh:
            fh.write('# Duplicados de foto ya revisados y dados por buenos:' + chr(10))
            fh.write('# huella de la imagen, en cuantos modelos aparece, y cuales.' + chr(10))
            fh.write('# Se regenera con: python verificar-fotos.py --aceptar' + chr(10))
            for mods, ids_, fs, h in repetidas:
                fh.write('%s  %d   # %s%s' % (h, len(mods), ' | '.join(mods)[:70], chr(10)))
        print('Anotados %d duplicados como revisados en %s' % (len(repetidas), ACEPTADAS))
        return 0
    nuevas = [r for r in repetidas
              if not (aceptadas_md5.get(r[3], 0) >= len(r[0]) or clave(r[1]) in aceptadas_ids)]

    # ---- 9: dentro de un Grupo, el mismo color deberia ser la misma foto ----
    # El iPhone 17 Pro naranja es el mismo aparato valga 1190 o 1400. La fila
    # que se aparta suele ser la que tiene el archivo mal nombrado.
    porgrupo = collections.defaultdict(lambda: collections.defaultdict(set))
    for f in files:
        if f in usuarios and color_de[f]:
            for r in usuarios[f]:
                g = (r.get('Grupo') or '').strip()
                if g:
                    porgrupo[g][color_de[f]].add(f)
    color_disidente = []
    for g, porcolor in sorted(porgrupo.items()):
        for col, fs in sorted(porcolor.items()):
            fs = sorted(fs)
            if len(fs) < 2:
                continue
            cuenta = collections.Counter(firma[a] for a in fs)
            if len(cuenta) > 1:
                # Con dos archivos y dos huellas no hay mayoria: hay que
                # elegir igual, y tiene que salir SIEMPRE el mismo, porque
                # el orden de un set de Python cambia en cada corrida y el
                # informe decia un archivo distinto cada vez.
                primero = {}
                for a in fs:
                    primero.setdefault(firma[a], a)
                mayoria = min(cuenta, key=lambda h: (-cuenta[h], primero[h]))
                raros = [a for a in fs if firma[a] != mayoria]
                color_disidente.append('%s / %s%s   se aparta: %s'
                                       % (g, col, chr(10) + ' ' * 6, (chr(10) + ' ' * 6).join(raros)))

    # ---- 11: la portada no puede ser la foto de un color que la fila no vende ----
    # Es la forma exacta que tuvieron los ocho errores del 09/09/2026: la fila
    # cambio de color bajo el mismo ID y la portada quedo. Con nombres por
    # SKU la portada ES la foto del primer color, asi que esto solo puede
    # pasar si alguien copio mal un archivo; igual se mira, porque es el
    # error que mas cuesta ver a ojo.
    porhuella = collections.defaultdict(set)      # huella -> colores de archivo
    for f in files:
        if f in usuarios and color_de[f]:
            porhuella[firma[f]].add(color_de[f])
    mentirosas = []
    portada_de = {}
    for r in rows:
        pid, sku = r['ID'].strip(), FS.sku_de(r)
        cols = colores(r)
        if not cols:
            continue
        vende = set()
        for c in cols:
            vende.update(FS.formas(c))
        port = next((c + FS.EXT for c in FS.candidatos_portada(r, pinta, conocidos) if existe(c)), None)
        if not port:
            continue
        portada_de[pid] = (port, vende)
        de_que_color = porhuella.get(firma[port], set())
        if de_que_color and not (de_que_color & vende):
            mentirosas.append('%-14s vende %-28s pero la portada es la foto %s'
                              % (pid, '/'.join(cols)[:28], '/'.join(sorted(de_que_color))))
    # y dos portadas identicas en filas cuyos colores no se tocan
    por_portada = collections.defaultdict(list)
    for pid, (port, vende) in portada_de.items():
        por_portada[firma[port]].append((pid, vende))
    for lst in por_portada.values():
        for i, (a, va) in enumerate(lst):
            for b, vb in lst[i + 1:]:
                if not (va & vb):
                    mentirosas.append('%-14s y %-14s tienen la misma portada y venden colores distintos (%s / %s)'
                                      % (a, b, '/'.join(sorted(va))[:22], '/'.join(sorted(vb))[:22]))

    # ---- 13: dos colores del MISMO producto con la misma imagen ----
    # Si el silver y el space black del mismo SKU son el mismo archivo, uno de
    # los dos miente, y no lo ve ningun otro chequeo: el (5) no, porque es un
    # solo producto; el (9) tampoco, porque son colores distintos. En la ficha
    # el cliente toca un puntito y ve la foto del otro color.
    mismo_color = []
    por_clave = collections.defaultdict(dict)          # producto -> variante -> archivo
    for f in files:
        if f in usuarios and color_de[f]:
            cv = CM.partir(os.path.splitext(f)[0])
            if cv:
                por_clave[cv[0]][color_de[f]] = f
    for cl, porcolor in sorted(por_clave.items()):
        vistas = collections.defaultdict(list)
        for col, f in sorted(porcolor.items()):
            vistas[firma[f]].append((col, f))
        for lst in vistas.values():
            if len(lst) > 1:
                mismo_color.append('%s: %s son la misma imagen (%s)'
                                   % (cl[:40], ' y '.join(c for c, _ in lst), lst[0][1]))

    # ---- 7, 8, 12: las fotos contra el registro de lo ya mirado ----
    registro = leer_revisadas()
    cambiadas  = sorted(f for f in files if f in registro and registro[f][0] != firma[f])
    aparecidas = sorted(f for f in files if f not in registro)
    pendientes = sorted(f for f in files if f in registro and not registro[f][1])

    if '--revisadas' in sys.argv or '--sembrar' in sys.argv:
        # "--revisadas" a secas marca todo; con nombres detras, solo esos.
        sueltas = {a for a in sys.argv[1:] if not a.startswith('--')}
        todas = '--revisadas' in sys.argv and not sueltas
        fantasma = sorted(n for n in sueltas if n not in files)
        if fantasma:
            print('OJO: no existe ninguna foto con ese nombre: %s' % ', '.join(fantasma))
            print('El nombre va tal cual esta en fotos/ (ahora son nombres largos por SKU).')
            return 2
        hechas, congeladas = 0, 0
        with open(REVISADAS, 'w', encoding='utf-8') as fh:
            fh.write('# Fotos miradas contra el producto que dice la planilla.' + chr(10))
            fh.write('# Si una cambia, deja de coincidir y no se publica hasta mirarla.' + chr(10))
            fh.write('# Anotar las miradas:  python verificar-fotos.py --revisadas' + chr(10))
            fh.write('# Arrancar el registro: python verificar-fotos.py --sembrar' + chr(10))
            for f in sorted(files):
                previo = registro.get(f)
                if todas or f in sueltas:
                    h, ok = firma[f], True
                elif previo and previo[0] != firma[f]:
                    # Cambio y NO se la miro: se conserva la huella vieja para
                    # que siga saliendo como "cambiada" y siga frenando. Antes
                    # se escribia la huella nueva como "sin mirar", y una foto
                    # equivocada que entraba de contrabando dejaba de frenar
                    # apenas alguien anotaba OTRA foto. Es justo el agujero
                    # por el que volvia la foto del iPhone 17.
                    h, ok = previo[0], previo[1]
                    congeladas += 1
                elif previo:
                    h, ok = firma[f], previo[1]
                else:
                    h, ok = firma[f], False
                hechas += ok
                fh.write('%s  %-34s # %s%s'
                         % (h, f, 'mirada' if ok else 'sin mirar', chr(10)))
        print('Registro escrito: %d fotos, %d miradas, %d pendientes  (%s)'
              % (len(files), hechas, len(files) - hechas, REVISADAS))
        if congeladas:
            print('%d foto(s) cambiaron y no se marcaron: siguen frenando hasta que las mires.' % congeladas)
        return 0

    # ---- el informe ----
    L = []
    w = L.append
    w('REVISAR FOTOS — chequeo automatico')
    w('=' * 62)
    w(f'Generado: {datetime.datetime.now():%d/%m/%Y %H:%M}')
    w(f'Productos en la planilla: {len(rows)}   ·   fotos en la carpeta: {len(files)}   ·   con nombre de codigo: {len(files) - len(viejos)}')
    w('')
    w(f'  {len(sin_base):>4}  productos sin foto de portada')
    w(f'  {len(sin_color):>4}  colores sin su foto')
    w(f'  {len(nuevas):>4}  MISMA FOTO en modelos distintos, SIN REVISAR  <-- mirar primero')
    w(f'  {len(cambiadas):>4}  FOTOS QUE CAMBIARON sin pasar por revision   <-- mirar primero')
    w(f'  {len(aparecidas):>4}  FOTOS NUEVAS que nadie miro todavia          <-- mirar primero')
    w(f'  {len(mentirosas):>4}  PORTADAS de un color que la fila no vende     <-- mirar primero')
    w(f'  {len(perdidas):>4}  FOTOS QUE PERDIERON SU PRODUCTO (cambio el SKU) <-- un comando las rescata')
    w(f'  {len(pendientes):>4}  fotos viejas que quedaron por mirar')
    w(f'  {len(viejos):>4}  fotos con nombre viejo (por SKU o por ID), sin migrar')
    w(f'  {len(sin_codigo):>4}  filas de la planilla sin codigo del catalogo')
    w(f'  {len(color_disidente):>4}  mismo color con distinta foto dentro del grupo')
    w(f'  {len(mismo_color):>4}  dos colores del mismo producto con la MISMA foto')
    w(f'  {len(repetidas) - len(nuevas):>4}  duplicados ya revisados (fotos-aceptadas.txt)')
    w(f'  {len(mal_color):>4}  fotos con un color que no esta en la planilla')
    w(f'  {len(huerfanas_expl):>4}  fotos huerfanas (ni SKU ni ID en la planilla)')
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
        for mods, ids_, fs, h in repetidas:
            w(f'   modelos: {" | ".join(mods)}')
            for i in ids_:
                w(f'      {i:<15} {byid[i]["Descripción completa"][:56]}')
            w(f'      archivos: {", ".join(fs)}')
            w('')
    else:
        w('   (ninguna)')
        w('')

    bloque('2) PRODUCTOS SIN FOTO DE PORTADA', sin_base)
    bloque('3) COLORES SIN SU FOTO', sin_color)
    bloque('4) FOTOS DE UNA VARIANTE QUE HOY NO SE VENDE', mal_color,
           '   No hay nada que arreglar: la foto se queda esperando a que el color'
           + chr(10) + '   vuelva. Antes esto era una foto perdida; ahora es una foto guardada.')
    bloque('4b) FILAS DE LA PLANILLA SIN CODIGO DEL CATALOGO', sin_codigo,
           '   Sin codigo no hay foto. Son altas a las que hay que asignarles uno, o'
           + chr(10) + '   vinculos que dejaron de ser de fiar porque el ID paso a otro producto:'
           + chr(10) + '      python herramientas/revisar-catalogo.py')
    bloque('5) FOTOS HUERFANAS (ni el SKU ni el ID estan en la planilla)', huerfanas_expl,
           '   Se quedan en la carpeta: el SKU sale del producto y no puede colgarse'
           + chr(10) + '   de otra cosa. Si el producto vuelve, la foto lo espera.')
    bloque('5b) FOTOS QUE PERDIERON SU PRODUCTO PORQUE CAMBIO EL SKU', perdidas,
           '   El producto sigue en la planilla con otro SKU (mismo ID, o el ID nuevo'
           + chr(10) + '   que dice la hoja Meta). Hasta renombrarlas, la web lo muestra sin foto:'
           + chr(10) + '      python herramientas/migrar-fotos-a-sku.py --aplicar')
    bloque('6) FOTOS QUE NO SON 900x900', tam)
    bloque('7) FOTOS QUE CAMBIARON DESPUES DE REVISADAS', cambiadas,
           '   El archivo no es el que se miro. Puede ser una mejora, o la foto'
           + chr(10) + '   equivocada que volvio. Mirala y despues: python verificar-fotos.py --revisadas')
    bloque('8) FOTOS NUEVAS SIN MIRAR', aparecidas,
           '   Entraron despues del ultimo registro y nadie las comparo con el producto.')
    bloque('9) MISMO COLOR CON DISTINTA FOTO DENTRO DEL GRUPO', color_disidente,
           '   El naranja del iPhone 17 Pro es el mismo valga 1190 o 1400. La fila'
           + chr(10) + '   que se aparta suele ser la que tiene el archivo mal nombrado.')
    bloque('10) FOTOS CON NOMBRE VIEJO POR ID', viejos,
           '   Todavia se entienden, pero conviene pasarlas a <SKU>-<color>.jpg:'
           + chr(10) + '      python herramientas/migrar-fotos-a-sku.py --aplicar')
    bloque('11) PORTADAS QUE SON LA FOTO DE UN COLOR QUE LA FILA NO VENDE', mentirosas,
           '   La portada es identica a una foto de otro color, o dos filas con'
           + chr(10) + '   colores distintos comparten portada. Alguien copio mal un archivo.')
    bloque('13) DOS COLORES DEL MISMO PRODUCTO CON LA MISMA FOTO', mismo_color,
           '   El cliente toca un puntito y ve la foto del otro color. Una de las'
           + chr(10) + '   dos esta mal nombrada, o falta producir una de las dos imagenes.')
    bloque('12) FOTOS VIEJAS QUE QUEDARON POR MIRAR', pendientes,
           '   Estaban antes de que existiera el registro. No frenan la publicacion,'
           + chr(10) + '   pero son las que todavia podrian tener una imagen equivocada.'
           + chr(10) + '   Para repartirlas entre agentes que las miren de a lotes:'
           + chr(10) + '      python revisar-fotos-con-agentes.py --preparar')

    with open(SALIDA, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(L))
    print('\n'.join(L[:21]))          # el resumen entero, hasta el ultimo contador
    print(f'...\nReporte completo en: {SALIDA}')

    if choques or fantasma or corridas:
        print()
        print('LAS COLUMNAS DE LA PLANILLA NO COINCIDEN CON EL CATALOGO')
        print('=' * 62)
        for x in choques:
            print('   choque: %s' % x)
        for x in fantasma:
            print('   codigo que no existe en el catalogo: %s' % x)
        for x in corridas:
            print('   celda corrida: %s' % x)
        print()
        print('   Las dos puntas salen del mismo catalogo maestro, asi que esto')
        print('   significa que una de las dos cambio y la otra no se entero.')
        print('   Hay que resolverlo con el equipo de la planilla ANTES de publicar.')

    # Frenan la publicacion las cuatro formas que tiene una ficha de mostrar
    # otro producto: (1) dos modelos con la misma imagen, (7) una foto que
    # cambio despues de revisada, (8) una foto que nadie miro nunca y (11)
    # una portada de un color que la fila no vende; y (5b) una foto que la web
    # dejaria de mostrar porque el SKU cambio, que se arregla con un comando.
    # Y las columnas del contrato 1.3 en desacuerdo con el catalogo, que es la
    # misma clase de error una etapa antes: ahi la ficha todavia no esta mal,
    # pero va a estarlo en la proxima corrida.
    # Lo demas son avisos.
    return 1 if (nuevas or cambiadas or aparecidas or mentirosas or perdidas
                 or choques or fantasma or corridas) else 0


if __name__ == '__main__':
    sys.exit(main())
