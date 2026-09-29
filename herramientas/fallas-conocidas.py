# -*- coding: utf-8 -*-
"""Las fallas de las pruebas que ya se pidieron: el registro de conocidas.

    python3 herramientas/fallas-conocidas.py
        las NUEVAS de la ultima corrida de las pruebas, cada una con su CLAVE
        y con lo que figura para esa fila en herramientas/pedidos-advapp.json
    python3 herramientas/fallas-conocidas.py --conocida CLAVE [CLAVE ...] --pedido r_codigo
        las anota como conocidas con EL punto de esa regla para esa fila.
        Tambien acepta la clave entera del punto ("r_codigo|ID|AT-0537|AT-0537-03").
    python3 herramientas/fallas-conocidas.py --conocida CLAVE --pedido ARCHIVO.txt --a ADVAPP
        lo que se pidio a mano, fuera de pedidos-advapp.json. El archivo tiene
        que existir (se le puede pasar la ruta entera), nombrar la fila y no
        decir que quedo sin enviar. La fecha sale de su "[REGISTRO] Enviado ...
        el dd/mm/aaaa", o del nombre (-26-09), o de --fecha AAAA-MM-DD.
    Opcionales al anotar:
        --grupo "iPhone 17 Pro Sim"                como se cuenta en el resumen
        --titulo "Con el codigo de otro producto"  el renglon que va arriba del grupo
    --puerto N (al listar y al anotar): la corrida de ese puerto
        (pruebas/_ultima-corrida-N.json). Sin nada, la ultima que termino, de
        cualquier puerto; siempre se dice de que puerto y hora es.
    python3 herramientas/fallas-conocidas.py --probar
        se prueba a si mismo con los casos del 29/09 (sin red; lo corre la
        revision diaria todos los dias)

POR QUE EXISTE
Desde el 26/09 las pruebas terminaban en rojo todos los dias por lo mismo:
cosas que ya se le habian pedido a ADVAPP. El 28/09 aparecieron 2 fallas
nuevas y el aviso solo cambio el numero, de 2 a 4; PUBLICAR preguntaba
"Publicar igual?" siempre, y de tanto contestar S se contestaba S tambien el
dia que habia algo nuevo. Pedro eligio el 29/09 (muestras 7.1 a 7.4):
  7.1 C  el resumen en tres grupos: NUEVAS fila por fila con el nombre del
         producto, CONOCIDAS una linea por pedido con los dias que lleva, y
         ARREGLADAS. Todas las lineas de 50 caracteres o menos (se lee a ancho
         de celular); la unica excepcion es la CLAVE, que se copia entera.
  7.2 B  PUBLICAR pregunta solo por lo nuevo (correr.py sale con 3 si lo unico
         que falla es conocido).
  7.3 C  la revision de las 14:00 cuenta solo lo nuevo y avisa "Reclamar a
         ADVAPP" cuando lo pedido lleva mas de 7 dias.
  7.4 B  una falla pasa a conocida SOLO cuando alguien la anota con este
         comando. Anotarla sola desde pedidos-advapp.json se equivocaba dos
         veces con los datos del 29/09: el Watch Ultra 3 Black Ocean se pidio
         fuera del registro, y el MacBook Air 24/512 Midnight figura en el
         registro por OTRA cosa (su CODIGO_VAR, no su CODIGO).

LA CLAVE
tanda|comprobacion|ID. La comprobacion va abreviada a sus cuatro primeras
palabras con sentido ("la columna CODIGO nunca apunta a otro producto" da
columna-codigo-nunca-apunta); el registro guarda ademas el texto entero, y
una conocida vale solo mientras la prueba diga exactamente eso.

LO QUE NUNCA ES CONOCIDO
Una tanda que revienta (EXCEPCION) o que no llega a correr, una falla que no
dice que filas, y lo que no se ve de una lista cortada: eso se arregla, no se
pide. Tampoco una fila nueva en una comprobacion conocida (la conocida es la
FILA, no la comprobacion), una fila cuyo ID hoy es otro producto (ADVAPP
reusa IDs), ni una cuyo punto ya no esta en pedidos-advapp.json.

ARREGLADAS
Una conocida que deja de fallar pasa sola a "arregladas" con la fecha, y
solo si su tanda corrio entera y la comprobacion dio OK (o fallo con la lista
completa y sin esa fila). Eso lo hace correr.py, que nunca anota una
conocida. Si una arreglada vuelve, sale como NUEVA con "VOLVIO: se habia
arreglado el dd/mm".

La fecha de un punto de pedidos-advapp.json se relee cada vez: si se vuelve
a mandar, los dias cuentan desde el ultimo envio.
"""
import collections
import datetime
import json
import os
import re
import sys
import tempfile
import textwrap
import unicodedata

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
CONOCIDAS = os.path.join(RAIZ, 'pruebas', 'conocidas.json')      # va al repo
ULTIMA = os.path.join(RAIZ, 'pruebas', '_ultima-corrida.json')   # no (el _* del .gitignore)
# (29/09, revision) La de cada puerto: con dos corridas a la vez (la del 9821
# piso la del 9824) la de arriba es de la ultima que termino, no de la tuya.
ULTIMA_PUERTO = os.path.join(RAIZ, 'pruebas', '_ultima-corrida-%d.json')
PEDIDOS = os.path.join(AQUI, 'pedidos-advapp.json')

ANCHO = 50          # 7.1 C: cada linea del resumen entra a ancho de celular

# La forma de un ID de ADVAPP (29/09: los 758 la tienen; decision-pruebas-avisos.js
# lo controla con los datos de cada dia). Lo usa tambien el script que correr.py
# inyecta para anotar los nombres de las filas.
RE_ID = re.compile(r'[A-Z0-9]+(?:-[A-Z0-9]+)+')
# (29/09, revision) Un ID suelto en el texto: que no sea un pedazo de otra
# palabra, de una direccion o de un nombre de archivo ("E-Sim/-" no es un ID).
RE_ID_SUELTO = re.compile(r'(?<![A-Za-z0-9_./=-])(?:%s)(?![A-Za-z0-9_/=-])' % RE_ID.pattern)
# Los IDs del principio de un pedazo, en lista: "A-1, B-2 y C-3: ...". Cada
# uno tiene que terminar donde termina (espacio, dos puntos, coma o el final).
_UNO = r'(?:%s)(?=$|[\s:,])' % RE_ID.pattern
RE_CADENA = re.compile(r'%s(?:(?:,\s*|\s+y\s+)%s)*' % (_UNO, _UNO))

# Palabras que no cuentan para la CLAVE: "la columna CODIGO nunca apunta"
# queda columna-codigo-nunca-apunta. "no" y "nunca" SI cuentan.
VACIAS = {'la', 'las', 'el', 'los', 'lo', 'y', 'e', 'o', 'u', 'de', 'del', 'un', 'una',
          'unos', 'unas', 'a', 'al', 'en', 'que', 'se', 'su', 'sus', 'con', 'por', 'para'}

# Lo que ninguna CLAVE puede tapar (ver LO QUE NUNCA ES CONOCIDO)
NO_SE_ANOTAN = ('no_corrio', 'excepcion', 'sin_filas', 'no_se_ven', 'sin_detalle')


class RegistroDanado(Exception):
    """conocidas.json o pedidos-advapp.json no se pueden leer. Nunca se sigue
    con uno vacio: correr.py cuenta todo como nuevo y no escribe nada, y este
    comando no anota."""


# ------------------------------------------------------------ utilidades

def sin_tildes(s):
    return unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode('ascii')


def norm(s):
    return ' '.join(re.findall(r'[a-z0-9]+', sin_tildes(s).lower()))


def slug(texto):
    palabras = re.findall(r'[a-z0-9]+', sin_tildes(texto).lower())
    utiles = [p for p in palabras if p not in VACIAS] or palabras
    return '-'.join(utiles[:4]) or 'sin-texto'


def clave(tanda, comprobacion, id_):
    return '%s|%s|%s' % (tanda, slug(comprobacion), id_)


def ddmm(iso):
    try:
        return datetime.date.fromisoformat(iso).strftime('%d/%m')
    except (TypeError, ValueError):
        return str(iso)


def hace(dias):
    return 'hoy' if dias == 0 else 'hace 1 dia' if dias == 1 else 'hace %d dias' % dias


def envolver(texto, sangria, primera=None):
    """El texto partido a ANCHO. Un ID o una CLAVE no se cortan nunca."""
    return textwrap.wrap(texto or '', ANCHO, initial_indent=sangria if primera is None else primera,
                         subsequent_indent=sangria, break_long_words=False,
                         break_on_hyphens=False) or [sangria.rstrip()]


def sin_color(nombre):
    """"iPhone 17 Pro 1TB Sim (Blue)" -> "iPhone 17 Pro 1TB Sim": el grupo por
    defecto cuando no se da --grupo."""
    return re.sub(r'\s*\([^()]*\)\s*$', '', nombre or '').strip() or (nombre or '')


# ------------------------------------------------------------ registros

def leer_conocidas(ruta=None):
    ruta = ruta or CONOCIDAS
    try:
        with open(ruta, encoding='utf-8') as fh:
            reg = json.load(fh)
    except FileNotFoundError:
        return {'conocidas': {}, 'arregladas': {}}
    except (OSError, ValueError) as e:
        raise RegistroDanado('REGISTRO DANADO: %s no se puede leer (%s). Recuperalo con:  '
                             'git show HEAD:pruebas/%s' % (os.path.basename(ruta), e, os.path.basename(ruta)))
    if not isinstance(reg, dict) or not isinstance(reg.get('conocidas', {}), dict) \
            or not isinstance(reg.get('arregladas', {}), dict):
        raise RegistroDanado('REGISTRO DANADO: %s no tiene la forma {"conocidas": {...}, '
                             '"arregladas": {...}}' % os.path.basename(ruta))
    reg.setdefault('conocidas', {})
    reg.setdefault('arregladas', {})
    return reg


def guardar_conocidas(reg, ruta=None):
    """A un temporal propio y despues os.replace: cortado a la mitad, o con la
    revision de las 14:00 y un PUBLICAR a la vez, el registro queda entero."""
    ruta = ruta or CONOCIDAS
    fd, tmp = tempfile.mkstemp(prefix='_conocidas-', suffix='.tmp', dir=os.path.dirname(ruta))
    try:
        with os.fdopen(fd, 'w', encoding='utf-8', newline='\n') as fh:
            json.dump(reg, fh, ensure_ascii=False, indent=1, sort_keys=True)
            fh.write('\n')
        os.chmod(tmp, 0o644)          # mkstemp lo crea 600; va al repo como los demas
        os.replace(tmp, ruta)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


def leer_enviados(ruta=None):
    """Los puntos de herramientas/pedidos-advapp.json (lo que se le pidio a
    ADVAPP y cuando), tal cual los deja pedido-advapp.py --enviado."""
    ruta = ruta or PEDIDOS
    try:
        with open(ruta, encoding='utf-8') as fh:
            reg = json.load(fh)
    except FileNotFoundError:
        return {}
    except (OSError, ValueError) as e:
        raise RegistroDanado('%s no se puede leer (%s)' % (os.path.basename(ruta), e))
    env = reg.get('enviados') if isinstance(reg, dict) else None
    if not isinstance(env, dict):
        raise RegistroDanado('%s no tiene sus "enviados"' % os.path.basename(ruta))
    return env


def fecha_del_pedido(e, enviados):
    """(fecha AAAA-MM-DD, problema). El punto se busca cada vez en el registro
    de lo enviado: si se volvio a mandar, cuenta desde ahi."""
    if e.get('punto'):
        if enviados is None:
            return None, 'no se pudo leer pedidos-advapp.json'
        v = enviados.get(e['punto'])
        if not v:
            return None, 'su punto ya no esta en pedidos-advapp.json (%s)' % e['punto']
        if v.get('id') != e.get('id'):
            return None, 'su punto es de otra fila (%s)' % v.get('id')
        enviado = v.get('enviado')
        # (29/09, revision) Un punto sin fecha de envio hacia reventar la
        # comparacion con hoy (TypeError) y se perdia el resumen entero.
        if not re.match(r'^\d{4}-\d{2}-\d{2}$', str(enviado or '')):
            return None, 'su punto no dice cuando se envio (%s)' % e['punto']
        # (29/09, revision) pedido-advapp.py marca "arreglado" cuando ADVAPP
        # corrigio el dato. Si la prueba sigue fallando, ya no es lo pedido:
        # es otra cosa, y "Reclamar a ADVAPP" taparia que falla por otra causa.
        if v.get('arreglado'):
            return enviado, 'su punto figura arreglado el %s' % ddmm(v['arreglado'])
        return enviado, None
    if e.get('archivo'):
        return e.get('fecha'), None if re.match(r'^\d{4}-\d{2}-\d{2}$', e.get('fecha') or '') \
            else 'no dice cuando se pidio'
    return None, 'no dice donde se pidio'


# ------------------------------------------------------------ leer una tanda

def partir_falla(linea):
    """'FALLA texto  [extra]' -> (texto, extra o None). Es la forma de ok()
    en todas las tandas."""
    cuerpo = linea[len('FALLA'):].strip()
    i = cuerpo.find('  [')
    if i >= 0 and cuerpo.endswith(']'):
        return cuerpo[:i].strip(), cuerpo[i + 3:-1]
    return cuerpo, None


def texto_ok(linea):
    """'  OK  texto  [extra]' -> texto."""
    cuerpo = linea.strip()[len('OK'):].strip()
    i = cuerpo.find('  [')
    return cuerpo[:i].strip() if i >= 0 else cuerpo


def filas_de(extra, ids=None):
    """Las filas que nombra lo que va entre corchetes.

    Devuelve (filas [(id, detalle)], sueltos [texto], cortada, ocultas).
    Los pedazos van separados por " | ". Cada ID de hoy (si se sabe cuales
    son) que aparece en un pedazo es una fila; si no se sabe, los que tienen
    la forma de un ID al principio del pedazo, en lista ("A-1, B-2 y C-3").
    Nunca el ID entre parentesis: en codigos.js es la gemela con la que se
    compara ("A (Sim/-) lleva AT-0071, que es E-Sim/- (B)"), no otra fila.
    (29/09, revision: hasta ese dia contaba solo el PRIMER ID de cada pedazo,
    y en "[CEL-APP-001, CEL-APP-002, CEL-APP-003]" con la 001 conocida las
    otras dos quedaban como su detalle: una falla nueva escondida detras de
    una conocida, con salida 3.)
    Cortada: la tanda pone el total adelante ("12: ...") y muestra menos, o
    termina en "...", o no dice el total y muestra 3 o mas (casi todas
    muestran slice(0, 3)): puede haber filas que no se ven, y esas son
    nuevas. Ocultas: cuantas faltan, si se sabe."""
    if not extra:
        return [], [], False, None
    total, cuerpo = None, extra
    m = re.match(r'^(\d+): (.*)$', extra, re.S)
    if m:
        total, cuerpo = int(m.group(1)), m.group(2)
    partes = [x.strip() for x in cuerpo.split(' | ') if x.strip()]
    puntos = bool(partes) and partes[-1] in ('...', '…')
    if puntos:
        partes = partes[:-1]
    filas, sueltos, vistas = [], [], 0
    for x in partes:
        de_aca = ids_del_pedazo(x, ids)
        if de_aca:
            filas += de_aca
        else:
            sueltos.append(x)
        vistas += max(1, len(de_aca))
    if total is not None:
        ocultas = max(0, total - vistas)
        return filas, sueltos, ocultas > 0 or puntos, (ocultas or None)
    return filas, sueltos, puntos or vistas >= 3, None


def sin_parentesis(x):
    """El texto con lo que va entre parentesis tapado por espacios (el mismo
    largo, asi las posiciones siguen valiendo para el texto original)."""
    while True:
        y = re.sub(r'\([^()]*\)', lambda m: ' ' * len(m.group(0)), x)
        if y == x:
            return y
        x = y


def ids_del_pedazo(x, ids):
    """[(id, detalle)] de un pedazo de la lista (ver filas_de). Los IDs del
    principio llevan de detalle lo que sigue a la lista; uno que aparece mas
    adelante, el pedazo entero."""
    tapado = sin_parentesis(x)
    m = RE_CADENA.match(tapado)
    fin = m.end() if m else 0
    detalle = x[fin:].strip(' :') if m else ''
    filas, vistos = [], set()
    for t in RE_ID_SUELTO.finditer(tapado):
        i = t.group(0)
        adelante = t.end() <= fin
        if i in vistos or (ids is None and not adelante) or (ids is not None and i not in ids):
            continue
        vistos.add(i)
        filas.append((i, detalle if adelante else x.strip()))
    return filas


def nueva(tipo, tanda, comprobacion, **extra):
    x = {'tipo': tipo, 'tanda': tanda, 'comprobacion': comprobacion, 'id': '', 'nombre': '',
         'detalle': '', 'clave': '', 'nota': ''}
    x.update(extra)
    return x


# ------------------------------------------------------------ clasificar

def clasificar(corridas, reg, enviados, hoy=None):
    """Separa lo que fallo en nuevas, conocidas y arregladas.

    corridas: [{'tanda', 'texto' (el RESULTADO, o None si no llego a correr),
    'motivo', 'nombres' ({ID: nombre} de las filas que nombra, o None),
    'fuente' (de donde saco los datos la pagina: 'advapp', 'planilla',
    'copia'; None si no se sabe)}], en el orden en que corrieron. reg: leer_conocidas(). enviados:
    leer_enviados(), o None si no se pudo leer (sus conocidas pasan a nuevas).
    No escribe nada: las arregladas las guarda correr.py con
    aplicar_arregladas()."""
    hoy = hoy or datetime.date.today()
    nuevas, conocidas, tandas = [], [], []
    no_cuentan = 0
    fallando = set()
    nombres_todos = {}
    oks, en_falla, enteras = {}, {}, set()
    for c in corridas:
        t, texto, nombres = c['tanda'], c.get('texto'), c.get('nombres')
        nombres_todos.update(nombres or {})
        info = {'tanda': t, 'corrio': texto is not None, 'motivo': c.get('motivo') or '',
                'fuente': c.get('fuente'), 'cabecera': '', 'fallas': [], 'excepciones': [], 'avisos': []}
        tandas.append(info)
        if texto is None:
            nuevas.append(nueva('no_corrio', t, 'NO LLEGO A CORRER', detalle=info['motivo']))
            continue
        lineas = [l.rstrip() for l in texto.split('\n')]
        info['cabecera'] = next((l.strip() for l in lineas if l.strip()), '')
        m = re.search(r'(\d+) FALLA', info['cabecera'])
        declaradas = int(m.group(1)) if m else 0
        ids = set(nombres) if nombres is not None else None     # None: no se sabe (sin el script)
        for l in lineas:
            m = re.search(r'(\d+) son otra memoria del mismo modelo', l)
            if m and not l.startswith(('FALLA', 'EXCEPCION')):
                no_cuentan += int(m.group(1))
            if l.strip().startswith('OK  '):
                oks.setdefault(t, set()).add(texto_ok(l))
            elif l.startswith('EXCEPCION'):
                info['excepciones'].append(l.strip())
                nuevas.append(nueva('excepcion', t, 'la tanda se rompio', detalle=l.strip()))
            elif l.startswith('AVISO'):
                info['avisos'].append(l.strip())
            elif l.startswith('FALLA'):
                comp, extra = partir_falla(l)
                info['fallas'].append(comp)
                filas, sueltos, cortada, ocultas = filas_de(extra, ids)
                en_falla[(t, comp)] = ({f[0] for f in filas}, not cortada and not sueltos)
                if not filas:
                    nuevas.append(nueva('sin_filas', t, comp, detalle=extra or ''))
                    continue
                for id_, det in filas:
                    k = clave(t, comp, id_)
                    fallando.add(k)
                    nombre = (nombres or {}).get(id_, '')
                    e = reg['conocidas'].get(k)
                    if e and e.get('comprobacion') == comp:
                        fecha, problema = fecha_del_pedido(e, enviados)
                        if not problema and e.get('nombre') and nombre and norm(e['nombre']) != norm(nombre):
                            # ADVAPP reusa IDs (memoria: ids-y-colores-rotan)
                            problema = 'el ID ahora es otro producto (se anoto como "%s")' % e['nombre']
                        if not problema and e.get('nombre') and not nombre:
                            # (29/09, revision) Sin el nombre de hoy (la pagina
                            # no dejo NOMBRES_FILAS) el control de arriba se
                            # salteaba callado: un ID reusado pasaba por conocido.
                            problema = ('no se sabe que producto es hoy ese ID (la prueba no dijo los '
                                        'nombres; se anoto como "%s")' % e['nombre'])
                        if not problema and fecha > hoy.isoformat():
                            problema = 'la fecha del pedido (%s) es posterior a hoy' % fecha
                        if not problema:
                            conocidas.append({
                                'clave': k, 'tanda': t, 'comprobacion': comp, 'id': id_,
                                'nombre': nombre or e.get('nombre', ''), 'detalle': det,
                                'a': e.get('a', ''), 'fecha': fecha,
                                'dias': (hoy - datetime.date.fromisoformat(fecha)).days,
                                'grupo': e.get('grupo') or sin_color(nombre or e.get('nombre', '')) or id_,
                                'titulo': e.get('titulo') or comp,
                                'punto': e.get('punto', ''), 'archivo': e.get('archivo', '')})
                            continue
                        nuevas.append(nueva('fila', t, comp, id=id_, nombre=nombre, detalle=det, clave=k,
                                            nota='Estaba anotada, pero ' + problema + '.'))
                        continue
                    arr = reg['arregladas'].get(k)
                    nota = ('VOLVIO: se habia arreglado el %s.' % ddmm(arr.get('arreglada'))
                            if arr and arr.get('comprobacion') == comp else '')
                    nuevas.append(nueva('fila', t, comp, id=id_, nombre=nombre, detalle=det, clave=k, nota=nota))
                for s in sueltos:
                    nuevas.append(nueva('sin_filas', t, comp, detalle=s))
                if cortada:
                    nuevas.append(nueva('no_se_ven', t, comp, cuantas=ocultas,
                                        detalle=('%d fila(s) mas que la prueba no muestra' % ocultas) if ocultas
                                        else 'puede haber mas filas que la prueba no muestra'))
        visibles = len(info['fallas']) + len(info['excepciones'])
        if declaradas > visibles:
            nuevas.append(nueva('sin_detalle', t, 'la tanda dice %d FALLA(S) y muestra %d'
                                % (declaradas, visibles)))
        # Entera: sin EXCEPCION, sin fallas escondidas, y con los datos de
        # ADVAPP. Con ADVAPP caido la pagina muestra la planilla o la copia
        # guardada, donde lo que se le pidio a ADVAPP puede no verse: eso no
        # es que lo hayan arreglado.
        if not info['excepciones'] and declaradas <= visibles and c.get('fuente') in (None, 'advapp'):
            enteras.add(t)

    # Las conocidas que hoy no fallan. Solo si su tanda corrio entera y la
    # comprobacion se miro: si la prueba cambio de texto o ese dia no corrio,
    # no se sabe nada y queda como estaba.
    arregladas = []
    for k, e in sorted(reg['conocidas'].items()):
        t, comp = e.get('tanda'), e.get('comprobacion')
        if k in fallando or t not in enteras:
            continue
        ids_hoy, completa = en_falla.get((t, comp), (None, False))
        if comp in oks.get(t, ()) or (ids_hoy is not None and completa and e.get('id') not in ids_hoy):
            a = dict(e, clave=k, arreglada=hoy.isoformat())
            a['fecha_pedido'], _ = fecha_del_pedido(e, enviados)
            arregladas.append(a)
    return {'fecha': hoy.isoformat(), 'tandas': tandas, 'nuevas': nuevas, 'conocidas': conocidas,
            'arregladas': arregladas, 'no_cuentan': no_cuentan, 'nombres': nombres_todos}


def aplicar_arregladas(arregladas, ruta=None):
    """Pasa las arregladas de "conocidas" a "arregladas" en el registro. Lo
    relee justo antes (otra corrida pudo haberlo tocado). Devuelve cuantas."""
    if not arregladas:
        return 0
    reg = leer_conocidas(ruta)
    n = 0
    for a in arregladas:
        e = reg['conocidas'].pop(a['clave'], None)
        if e is None:
            continue
        e['arreglada'] = a['arreglada']
        reg['arregladas'][a['clave']] = e
        n += 1
    if n:
        guardar_conocidas(reg, ruta)
    return n


def contar_nuevas(nuevas):
    """Cada fila cuenta una; lo que no se ve de una lista cortada, las que
    faltan (o una, si no se sabe cuantas). La usa tambien revision-diaria.py
    (29/09, revision: tenia su copia, y las dos podian contar distinto)."""
    return sum((x.get('cuantas') or 1) if x.get('tipo') == 'no_se_ven' else 1 for x in nuevas)


# ------------------------------------------------------------ el resumen

def lineas_grupos(c):
    """Los tres grupos, como en la muestra 7.1 C."""
    L = []
    nuevas, conocidas, arregladas = c['nuevas'], c['conocidas'], c['arregladas']
    raya = '  ' + '-' * (ANCHO - 2)
    if nuevas:
        n = contar_nuevas(nuevas)
        L += ['  ' + '=' * (ANCHO - 2),
              '   %d NUEVA%s - frena%s la publicacion' % (n, 'S' if n != 1 else '', 'n' if n != 1 else ''),
              '  ' + '=' * (ANCHO - 2)]
        por_comp = collections.OrderedDict()
        for x in nuevas:
            por_comp.setdefault((x['tanda'], x['comprobacion']), []).append(x)
        for (t, comp), xs in por_comp.items():
            L += envolver('%s | %s' % (t, comp), '  ')
            for x in xs:
                if x['tipo'] == 'fila':
                    L += envolver(x['nombre'] or '(sin nombre)', '     ', '   ')
                    L.append('     ' + x['id'])
                    if x['detalle']:
                        L += envolver(x['detalle'], '     ')
                    if x['nota']:
                        L += envolver(x['nota'], '     ')
                elif x['tipo'] == 'no_corrio':
                    L += envolver('(%s). No se anota: se vuelve a correr.' % (x['detalle'] or 'sin motivo'), '     ', '   ')
                elif x['tipo'] == 'excepcion':
                    L += envolver(x['detalle'], '     ', '   ')
                    L.append('     La prueba se rompio: no se anota.')
                else:
                    L += envolver(x['detalle'] or '(sin detalle)', '     ', '   ')
                    L += envolver('No dice que filas: se arregla, no se anota.'
                                  if x['tipo'] in ('sin_filas', 'sin_detalle')
                                  else 'Lo que no se ve no se anota.', '     ')
        anotables = [x for x in nuevas if x['tipo'] not in NO_SE_ANOTAN and x['clave']]
        if anotables:
            L += [raya,
                  '   Si una ya se pidio, se anota asi (o pasale',
                  '   esto a Claude):',
                  '     python3 herramientas/fallas-conocidas.py',
                  '       --conocida CLAVE --pedido r_codigo',
                  '   (lo pedido a mano: --pedido ARCHIVO --a QUIEN)',
                  '   Cada CLAVE y lo pedido para cada fila:',
                  '     python3 herramientas/fallas-conocidas.py',
                  '   La CLAVE de la primera es:',
                  '   ' + anotables[0]['clave']]       # la unica que puede pasar de 50
    if conocidas:
        k = len(conocidas)
        L += [raya, '   %d CONOCIDA%s - ya pedida%s, no frena%s'
              % (k, 'S' if k != 1 else '', 's' if k != 1 else '', 'n' if k != 1 else ''), raya]
        por_titulo = collections.OrderedDict()
        for x in conocidas:
            g = por_titulo.setdefault(x['titulo'], collections.OrderedDict())
            g.setdefault((x['grupo'], x['a'], x['fecha']), []).append(x)
        for titulo, grupos in por_titulo.items():
            L += envolver(titulo.rstrip(':') + ':', '   ')
            for (grupo, a, fecha), xs in grupos.items():
                L += envolver(grupo, '       ', '   %2d  ' % len(xs))
                L += envolver('%s, pedido el %s (%s)' % (a, ddmm(fecha), hace(xs[0]['dias'])), '       ')
        L.append('   Fila por fila: pruebas/conocidas.json')
    if conocidas or arregladas:
        if not conocidas:
            L.append(raya)
        n = len(arregladas)
        L.append('   %d ARREGLADA%s desde la corrida anterior%s' % (n, 'S' if n != 1 else '', ':' if n else ''))
        grupos = collections.OrderedDict()
        for x in arregladas:
            grupos.setdefault((x.get('grupo') or sin_color(x.get('nombre')) or x.get('id'),
                               x.get('a', ''), x.get('fecha_pedido') or ''), []).append(x)
        for (grupo, a, fecha), xs in grupos.items():
            L += envolver(grupo, '       ', '   %2d  ' % len(xs))
            L += envolver('%s, pedido el %s' % (a, ddmm(fecha)) if fecha else a, '       ')
    if c.get('no_cuentan') and (nuevas or conocidas or arregladas):
        L += envolver('No cuentan: %d filas de otra memoria del mismo modelo (Pedro, 26/09)'
                      % c['no_cuentan'], '   ')
    return L


def resultado(c):
    """(lineas del RESULTADO, codigo de salida). 1 = hay nuevas (PUBLICAR
    pregunta), 3 = falla solo lo conocido (PUBLICAR sigue), 0 = pasa todo.
    PUBLICAR.command lee el numero de "RESULTADO: N NUEVA"."""
    n, k = contar_nuevas(c['nuevas']), len(c['conocidas'])
    if n:
        L = ['RESULTADO: %d NUEVA%s. Revisar antes de publicar.' % (n, 'S' if n != 1 else '')]
        if k:
            L += envolver('%d conocida%s sigue%s esperando respuesta.'
                          % (k, 's' if k != 1 else '', 'n' if k != 1 else ''), ' ' * 11)
        return L, 1
    if k:
        vieja = min(c['conocidas'], key=lambda x: x['fecha'])
        return envolver('RESULTADO: nada nuevo. %d conocida%s sigue%s esperando respuesta '
                        '(la mas vieja, pedida el %s: %s).'
                        % (k, 's' if k != 1 else '', 'n' if k != 1 else '', ddmm(vieja['fecha']),
                           hace(vieja['dias'])), ''), 3
    return ['RESULTADO: pasa todo.'], 0


# ------------------------------------------------------------ el comando

def ruta_ultima(puerto=None):
    """La corrida que se mira: la de ese puerto (--puerto N), o la ultima
    que termino, de cualquier puerto."""
    return ULTIMA_PUERTO % puerto if puerto else ULTIMA


def leer_ultima(ruta=None):
    ruta = ruta or ULTIMA
    try:
        with open(ruta, encoding='utf-8') as fh:
            return json.load(fh)
    except FileNotFoundError:
        return None


def de_que_corrida(ultima):
    """'29/09 15:21, puerto 9821': siempre se dice de que corrida se lee (29/09,
    revision: con dos corridas a la vez se anotaba desde la equivocada)."""
    return '%s %s, puerto %s' % (ddmm(ultima.get('fecha')), ultima.get('hora', '?'),
                                 ultima.get('puerto') or '?')


def puntos_de(id_, enviados, regla=None):
    return sorted((k, v) for k, v in (enviados or {}).items()
                  if (v.get('id') == id_ or k.split('|')[1:2] == [id_])
                  and (regla is None or k.split('|')[0] == regla))


def archivo_del_pedido(nombre, id_):
    """(ruta, fecha AAAA-MM-DD o None, problema) de un pedido a mano. Tiene
    que existir, nombrar la fila y no decir que quedo sin mandar (29/09:
    PEDIDO-ADVAPP-26-09.txt arranca con "[REEMPLAZADO] No se envio": lo que
    se mando ese dia fue CARGA-CODIGOS-ADVAPP-26-09.txt)."""
    candidatos = [nombre, os.path.join(RAIZ, nombre), os.path.join(RAIZ, '_notas', nombre)]
    ruta = next((os.path.abspath(os.path.expanduser(x)) for x in candidatos
                 if os.path.isfile(os.path.expanduser(x))), None)
    if not ruta:
        return None, None, ('no encuentro %s: pasale la ruta entera (los pedidos con fecha en el '
                            'nombre no van al repo, viven en la carpeta de publicar)' % nombre)
    with open(ruta, encoding='utf-8', errors='replace') as fh:
        texto = fh.read()
    primera = texto.strip().split('\n', 1)[0] if texto.strip() else ''
    if re.search(r'BORRADOR|REEMPLAZADO|[Ss]in enviar|[Nn]o se envi[oó]', primera):
        return None, None, '%s dice que no se mando: "%s"' % (os.path.basename(ruta), primera.strip()[:90])
    if id_ not in texto:
        return None, None, '%s no nombra la fila %s' % (os.path.basename(ruta), id_)
    fecha = None
    m = re.search(r'[Ee]nviad[oa][^\n]*?(\d{1,2})/(\d{1,2})/(\d{4})', primera)
    if m:
        fecha = '%s-%02d-%02d' % (m.group(3), int(m.group(2)), int(m.group(1)))
    else:
        m = re.search(r'-(\d{2})-(\d{2})(?:[^0-9]|$)', os.path.basename(ruta))
        if m:
            f = datetime.date(datetime.date.today().year, int(m.group(2)), int(m.group(1)))
            if f > datetime.date.today():
                f = f.replace(year=f.year - 1)
            fecha = f.isoformat()
    return ruta, fecha, None


def anotar(claves, pedido, a=None, fecha=None, grupo=None, titulo=None, ultima=None,
           ruta=None, ruta_pedidos=None, hoy=None):
    """Anota las CLAVES como conocidas. Devuelve la lista de lo que hizo;
    si algo no se puede, levanta ValueError y NO escribe nada (todas o
    ninguna)."""
    hoy = hoy or datetime.date.today()
    if ultima is None:
        raise ValueError('no hay corrida para mirar: primero corre  python3 pruebas/correr.py')
    reg = leer_conocidas(ruta)                      # danado: RegistroDanado, no se anota
    enviados = leer_enviados(ruta_pedidos)
    fallaron = {}
    for x in ultima.get('nuevas', []) + ultima.get('conocidas', []):
        if x.get('clave') and x.get('tipo') not in NO_SE_ANOTAN:
            if x['clave'] in fallaron and fallaron[x['clave']]['comprobacion'] != x['comprobacion']:
                raise ValueError('la CLAVE %s es de dos comprobaciones distintas: anotala a mano' % x['clave'])
            fallaron[x['clave']] = x
    hechos = []
    for k in claves:
        x = fallaron.get(k)
        if not x:
            raise ValueError('%s no fallo en la ultima corrida (%s): solo se anota lo que falla. '
                             'Las que se pueden anotar salen con  python3 herramientas/fallas-conocidas.py'
                             % (k, de_que_corrida(ultima)))
        e = {'tanda': x['tanda'], 'comprobacion': x['comprobacion'], 'id': x['id'],
             'nombre': x.get('nombre', ''), 'detalle': x.get('detalle', ''), 'anotada': hoy.isoformat()}
        if pedido.startswith('r_') and '|' in pedido:
            v = enviados.get(pedido)
            if not v:
                raise ValueError('el punto %s no esta en pedidos-advapp.json' % pedido)
            if v.get('id') != x['id']:
                raise ValueError('el punto %s es de la fila %s, no de %s' % (pedido, v.get('id'), x['id']))
            e.update(punto=pedido, a='ADVAPP')
        elif re.match(r'^r_[a-z_]+$', pedido):
            ps = puntos_de(x['id'], enviados, pedido)
            if not ps:
                otros = puntos_de(x['id'], enviados)
                raise ValueError('%s no tiene ningun punto de %s en pedidos-advapp.json%s' % (
                    x['id'], pedido, (': tiene ' + ', '.join(p for p, _ in otros)) if otros else ''))
            if len(ps) > 1:
                raise ValueError('%s tiene %d puntos de %s: pasale la clave entera de uno (%s)'
                                 % (x['id'], len(ps), pedido, ' / '.join(p for p, _ in ps)))
            e.update(punto=ps[0][0], a='ADVAPP')
        else:
            if not a:
                raise ValueError('lo pedido a mano necesita --a (a quien se le pidio)')
            ruta_arch, f, problema = archivo_del_pedido(pedido, x['id'])
            if problema:
                raise ValueError(problema)
            f = fecha or f
            if not f:
                raise ValueError('no se de que dia es %s: pasale --fecha AAAA-MM-DD' % pedido)
            e.update(archivo=os.path.basename(ruta_arch), fecha=f, a=a)
        if a and e.get('punto') and a != 'ADVAPP':
            raise ValueError('los puntos de pedidos-advapp.json se le piden a ADVAPP, no a %s' % a)
        f, problema = fecha_del_pedido(e, enviados)
        if problema:
            raise ValueError(problema)
        if f > hoy.isoformat():
            raise ValueError('la fecha del pedido (%s) es posterior a hoy' % f)
        if grupo:
            e['grupo'] = grupo
        if titulo:
            e['titulo'] = titulo
        vieja = reg['arregladas'].pop(k, None)
        if vieja:
            e['historial'] = vieja.get('historial', []) + [{'anotada': vieja.get('anotada'),
                                                            'arreglada': vieja.get('arreglada')}]
        reg['conocidas'][k] = e
        hechos.append((k, e, f))
    guardar_conocidas(reg, ruta)
    return hechos


def listar(ultima, reg, enviados):
    if ultima is None:
        print('Todavia no hay ninguna corrida anotada: correr  python3 pruebas/correr.py')
        return 0
    nuevas = ultima.get('nuevas', [])
    print('Ultima corrida de las pruebas: %s' % de_que_corrida(ultima))
    print('(otra corrida: --puerto N lee la de ese puerto)')
    anotables = [x for x in nuevas if x['tipo'] not in NO_SE_ANOTAN and x.get('clave')]
    otras = [x for x in nuevas if x not in anotables]
    print('%d NUEVA(S) que se pueden anotar si ya se pidieron:' % len(anotables))
    comp = None
    for x in anotables:
        if (x['tanda'], x['comprobacion']) != comp:
            comp = (x['tanda'], x['comprobacion'])
            print('\n%s | %s' % comp)
        print('  %s  %s' % (x['id'], x.get('nombre', '')))
        if x.get('detalle'):
            print('    falla:  %s' % x['detalle'])
        if x.get('nota'):
            print('    %s' % x['nota'])
        print('    CLAVE:  %s' % x['clave'])
        ps = puntos_de(x['id'], enviados)
        if ps:
            print('    en pedidos-advapp.json:')
            for k, v in ps:
                print('      %s  (enviado el %s%s)' % (k, ddmm(v.get('enviado')),
                                                     ', figura arreglado el %s' % ddmm(v['arreglado'])
                                                     if v.get('arreglado') else ''))
        else:
            print('    en pedidos-advapp.json: nada para esta fila')
    if anotables:
        print('\nOJO: el punto tiene que pedir LO MISMO que falla. Una fila puede figurar en')
        print('pedidos-advapp.json por otra cosa (el 29/09, el MacBook Air 24/512 Midnight')
        print('estaba por su CODIGO_VAR y lo que fallaba era su CODIGO).')
        print('Para anotar:  python3 herramientas/fallas-conocidas.py --conocida CLAVE [CLAVE ...]')
        print('                  --pedido r_codigo            (el punto de esa regla para esa fila)')
        print('              o   --pedido ARCHIVO.txt --a ADVAPP   (lo pedido a mano)')
    if otras:
        print('\n%d NUEVA(S) que no se anotan (se arreglan):' % len(otras))
        for x in otras:
            print('  %s | %s: %s' % (x['tanda'], x['comprobacion'], (x.get('detalle') or '(sin detalle)')[:140]))
    print('\nYa anotadas como conocidas: %d (pruebas/conocidas.json)' % len(reg['conocidas']))
    for k, e in sorted(reg['conocidas'].items()):
        f, problema = fecha_del_pedido(e, enviados)
        print('  %s  %s, pedido el %s%s' % (k, e.get('a'), ddmm(f), ('  OJO: ' + problema) if problema else ''))
    return 0


def valor(argv, nombre):
    if nombre in argv:
        i = argv.index(nombre)
        if i + 1 < len(argv) and not argv[i + 1].startswith('--'):
            return argv[i + 1]
        raise ValueError('%s necesita un valor' % nombre)
    return None


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    if '--probar' in argv:
        return probar()
    try:
        puerto = valor(argv, '--puerto')
        if puerto is not None and not re.match(r'^\d{1,5}$', puerto):
            raise ValueError('--puerto va con el numero del puerto de la corrida (el de correr.py --puerto N)')
        ruta = ruta_ultima(int(puerto) if puerto else None)
        ultima = leer_ultima(ruta)
        if ultima is None and puerto:
            raise ValueError('no hay ninguna corrida del puerto %s (%s): primero corre  '
                             'python3 pruebas/correr.py --puerto %s' % (puerto, os.path.basename(ruta), puerto))
        if '--conocida' in argv:
            i = argv.index('--conocida')
            claves = []
            for x in argv[i + 1:]:
                if x.startswith('--'):
                    break
                claves.append(x)
            pedido = valor(argv, '--pedido')
            if not claves or not pedido:
                raise ValueError('uso: --conocida CLAVE [CLAVE ...] --pedido r_codigo   '
                                 '(o --pedido ARCHIVO.txt --a QUIEN)')
            fecha = valor(argv, '--fecha')
            if fecha and not re.match(r'^\d{4}-\d{2}-\d{2}$', fecha):
                raise ValueError('--fecha va AAAA-MM-DD')
            hechos = anotar(claves, pedido, a=valor(argv, '--a'), fecha=fecha,
                            grupo=valor(argv, '--grupo'), titulo=valor(argv, '--titulo'),
                            ultima=ultima)
            print('Desde la corrida del %s' % de_que_corrida(ultima))
            for k, e, f in hechos:
                print('Anotada: %s\n  %s, pedido el %s (%s)' % (k, e['a'], ddmm(f), e.get('punto') or e.get('archivo')))
            print('%d anotada(s) en pruebas/conocidas.json. Desde la proxima corrida no frenan.' % len(hechos))
            return 0
        return listar(ultima, leer_conocidas(), leer_enviados())
    except (ValueError, RegistroDanado) as e:
        print('NO SE ANOTO NADA: %s' % e)
        return 2


# ------------------------------------------------------------ autoprueba

def probar_resumen_de_correr(ok, tmp, corr, nombres, hoy):
    """(29/09, revision) El resumen que imprime pruebas/correr.py (resumir),
    entero y de verdad: arriba (lo de correr.py) y los tres grupos (lo de
    aca). correr.py no tiene autoprueba, y la de los grupos sola no veia la
    linea del motivo de una tanda que no corrio, que salia de 63 caracteres.
    Corre con este registro en una carpeta temporal y con las corridas de
    correr.py tambien ahi: no toca pruebas/conocidas.json ni las corridas de
    verdad."""
    import contextlib
    import importlib.util
    import io
    global CONOCIDAS, PEDIDOS
    ruta = os.path.join(RAIZ, 'pruebas', 'correr.py')
    try:
        spec = importlib.util.spec_from_file_location('correr_probar', ruta)
        cp = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cp)
    except Exception as ex:
        ok(False, 'se carga pruebas/correr.py para medir su resumen (%s: %s)' % (type(ex).__name__, ex))
        return
    esta = sys.modules[__name__]
    guardados = CONOCIDAS, PEDIDOS, cp.ULTIMA, getattr(cp, 'ULTIMA_PUERTO', None), cp.PUERTO, cp.cargar_clasificador
    CONOCIDAS, PEDIDOS = os.path.join(tmp, 'resumen-conocidas.json'), os.path.join(tmp, 'resumen-pedidos.json')
    cp.ULTIMA = os.path.join(tmp, '_ultima-corrida.json')
    cp.ULTIMA_PUERTO = os.path.join(tmp, '_ultima-corrida-%d.json')
    cp.PUERTO = 9899
    cp.cargar_clasificador = lambda: (esta, None)
    corridas = [dict(corr[0], motivo=None, fuente='advapp'),
                {'tanda': 'guardas-t3-fotos-publicar-repo', 'texto': None, 'nombres': None, 'fuente': None,
                 'motivo': cp.SIN_RESULTADO},
                {'tanda': 'guardas-b6-portada', 'texto': None, 'nombres': None, 'fuente': None,
                 'motivo': cp.SIN_TERMINAR},
                {'tanda': 'meta', 'texto': '\n===== 1 FALLA(S) =====\nEXCEPCION: TypeError: x is null, '
                 'y un texto largo que la tanda escribio sin pensar en el ancho', 'nombres': {}, 'fuente': 'advapp',
                 'motivo': None},
                {'tanda': 'fuentes', 'texto': '\n===== TODO OK =====\n  OK  algo\nAVISO la planilla de respaldo '
                 'quedo recortada y esto es un aviso largo que no cuenta', 'nombres': {}, 'fuente': 'advapp',
                 'motivo': None}]
    salida = None
    try:
        capturado = io.StringIO()
        with contextlib.redirect_stdout(capturado):
            rc = cp.resumir(corridas, False, None)
        salida = capturado.getvalue()
    except Exception as ex:
        ok(False, 'resumir de correr.py corre con corridas armadas (%s: %s)' % (type(ex).__name__, ex))
    finally:
        CONOCIDAS, PEDIDOS = guardados[0], guardados[1]
        cp.ULTIMA, cp.ULTIMA_PUERTO, cp.PUERTO, cp.cargar_clasificador = guardados[2:]
    if salida is None:
        return
    claves = {x['clave'] for x in clasificar(corridas, {'conocidas': {}, 'arregladas': {}}, {}, hoy)['nuevas']
              if x['clave']}
    lineas = salida.split('\n')
    largas = [l for l in lineas if len(l) > ANCHO and l.strip() not in claves]
    ok(rc == 1 and '(la pagina cargo pero la tanda no' in salida and not largas,
       'todo el resumen de correr.py tiene %d caracteres o menos, salvo la CLAVE (tambien el motivo '
       'de una tanda que no corrio)%s' % (ANCHO, (': ' + largas[0].strip()[:60]) if largas else ''))
    try:
        with open(os.path.join(tmp, '_ultima-corrida.json'), encoding='utf-8') as fh:
            general = json.load(fh)
        with open(os.path.join(tmp, '_ultima-corrida-9899.json'), encoding='utf-8') as fh:
            del_puerto = json.load(fh)
    except (OSError, ValueError):
        general = del_puerto = None
    ok(general is not None and general == del_puerto and general.get('puerto') == 9899 and general.get('hora')
       and isinstance(general.get('nuevas'), list),
       'correr.py deja la corrida en _ultima-corrida.json y en la de su puerto, con puerto y hora')
    ok(os.path.basename(ruta_ultima(9899)) == '_ultima-corrida-9899.json'
       and os.path.basename(guardados[3] or '') == '_ultima-corrida-%d.json'
       and os.path.dirname(guardados[3] or '') == os.path.dirname(ULTIMA),
       'fallas-conocidas.py --puerto N lee el archivo que escribe correr.py para ese puerto')


def probar():
    """Casos armados con lo que salio el 29/09, sin red."""
    fallas = []

    def ok(c, txt):
        print(('  OK  ' if c else 'FALLA ') + txt)
        if not c:
            fallas.append(txt)

    hoy = datetime.date(2026, 9, 29)
    comp_col = 'la columna CODIGO nunca apunta a otro producto (otra Sim, otro teclado u otro modelo)'
    comp_por = 'y todas las portadas usan una de esas'
    sim = 'CEL-APL-17P-1TB-BLU-SIM'
    neo = 'NBK-APL-NEO13-8G256-BLS-ES'
    wat = 'SWT-APL-WULTRA3-000-BLK-49-CELL-OCEAN'
    mba = 'NBK-APL-MBA13M5-24G512-MID-EN'
    nombres = {sim: 'iPhone 17 Pro 1TB Sim (Blue)', neo: 'MacBook Neo A18 13" 8GB/256GB Teclado ES (Blush)',
               wat: 'Watch Ultra 3 49mm (Black – Black Ocean Band)',
               mba: 'MacBook Air M5 13.6" 24GB/512GB (Midnight)'}
    col = lambda ids: ('FALLA %s  [%d: %s]' % (comp_col, len(ids), ' | '.join(
        '%s (Sim/-) lleva AT-0071, que es E-Sim/- (CEL-APL-17P-1TB-BLU-ESIM)' % i for i in ids)))
    por = 'FALLA %s  [%s -> 1huLIXmTEPy9bEyBMCkLlWQFLU-Lpuy0F=w400]' % (comp_por, wat)
    info = '  --  51 donde la columna y el mapa no coinciden: 40 son otra memoria del mismo modelo (aceptado, Pedro 26/09)'
    texto = lambda *l: '\n===== %d FALLA(S) =====\n' % sum(1 for x in l if x.startswith('FALLA')) + '\n'.join(l)
    enviados = {'r_codigo|%s|AT-0537|AT-0537-03' % sim: {'enviado': '2026-09-26', 'id': sim},
                'r_codigo|%s|AT-0433|AT-0433-03' % neo: {'enviado': '2026-09-21', 'id': neo},
                'r_variante|%s|AT-0522-02' % mba: {'enviado': '2026-09-21', 'id': mba},
                'r_teclado|%s|ES' % neo: {'enviado': '2026-09-21', 'id': neo}}

    # --- leer la linea
    ok(partir_falla(por) == (comp_por, wat + ' -> 1huLIXmTEPy9bEyBMCkLlWQFLU-Lpuy0F=w400'),
       'la linea FALLA se parte en comprobacion y detalle')
    f, s, cortada, ocultas = filas_de(col([sim, neo]).split('  [', 1)[1][:-1], set(nombres))
    ok([x[0] for x in f] == [sim, neo] and not s and not cortada, 'con el total adelante, la lista esta entera')
    f, s, cortada, ocultas = filas_de('12: %s (Sim/-) lleva AT-0071 | %s x | ...' % (sim, neo), set(nombres))
    ok(cortada and ocultas == 10, 'si el total es mayor que lo que se ve, faltan filas (y se sabe cuantas)')
    f, s, cortada, ocultas = filas_de('%s -> a | %s -> b | %s -> c' % (sim, neo, wat), set(nombres))
    ok(cortada and ocultas is None, 'sin total y con 3 o mas, puede haber filas que no se ven')
    ok(slug(comp_col) == 'columna-codigo-nunca-apunta' and slug(comp_por) == 'todas-portadas-usan-esas',
       'la CLAVE abrevia la comprobacion a sus cuatro primeras palabras')
    ok(all(RE_ID.fullmatch(i) for i in nombres), 'los IDs del 29/09 tienen la forma que se lee')

    # --- clasificar
    reg = {'conocidas': {}, 'arregladas': {}}
    corr = [{'tanda': 'codigos', 'texto': texto(info, por, col([sim, neo])), 'nombres': nombres}]
    c = clasificar(corr, reg, enviados, hoy)
    ok(len(c['nuevas']) == 3 and not c['conocidas'] and c['no_cuentan'] == 40,
       'sin nada anotado, las 3 filas son nuevas; "otra memoria" no cuenta')
    ok(all(x['clave'] for x in c['nuevas']) and c['nuevas'][0]['clave'] == 'codigos|todas-portadas-usan-esas|' + wat,
       'cada fila nueva trae su CLAVE tanda|comprobacion|ID')

    tmp = tempfile.mkdtemp(prefix='conocidas-probar-')
    ruta = os.path.join(tmp, 'conocidas.json')
    rped = os.path.join(tmp, 'pedidos.json')
    with open(rped, 'w', encoding='utf-8') as fh:
        json.dump({'enviados': enviados}, fh)
    ultima = dict(c, hora='14:00')
    k_sim, k_neo, k_wat = (clave('codigos', comp_col, sim), clave('codigos', comp_col, neo),
                           clave('codigos', comp_por, wat))
    try:
        # --- anotar: lo que no se puede
        def no_anota(txt, *a, **kw):
            antes = os.path.exists(ruta) and open(ruta, encoding='utf-8').read()
            try:
                anotar(*a, ultima=ultima, ruta=ruta, ruta_pedidos=rped, hoy=hoy, **kw)
                ok(False, txt)
            except (ValueError, RegistroDanado):
                ok((os.path.exists(ruta) and open(ruta, encoding='utf-8').read()) == antes, txt)
        no_anota('no se anota una CLAVE que no fallo', ['codigos|columna-codigo-nunca-apunta|CEL-X-1'], 'r_codigo')
        no_anota('ni con el punto de otra fila', [k_sim], 'r_codigo|%s|AT-0433|AT-0433-03' % neo)
        no_anota('ni con una regla que no tiene punto para esa fila', [k_neo], 'r_variante')
        no_anota('ni un pedido a mano sin --a', [k_wat], 'PEDIDO-X.txt')
        arch = os.path.join(tmp, 'PEDIDO-ADVAPP-26-09.txt')
        with open(arch, 'w', encoding='utf-8') as fh:
            fh.write('[REEMPLAZADO] No se envio: lo reemplazo CARGA-CODIGOS-ADVAPP-26-09.txt.\n%s\n' % wat)
        no_anota('ni con un pedido a mano que dice que no se mando', [k_wat], arch, a='ADVAPP')
        no_anota('ni todas si una no se puede (todas o ninguna)', [k_sim, 'codigos|x|Y-1'], 'r_codigo')
        with open(ruta, 'w', encoding='utf-8') as fh:
            fh.write('{"conocidas": {<<<<<<< HEAD')
        no_anota('ni con el registro roto (no se lee como vacio)', [k_sim], 'r_codigo')
        try:
            leer_conocidas(ruta)
            ok(False, 'el registro roto levanta RegistroDanado')
        except RegistroDanado:
            ok(True, 'el registro roto levanta RegistroDanado')
        os.remove(ruta)

        # --- anotar: lo que si
        anotar([k_sim, k_neo], 'r_codigo', ultima=ultima, ruta=ruta, ruta_pedidos=rped, hoy=hoy,
               grupo=None, titulo='Con el codigo de otro producto')
        carga = os.path.join(tmp, 'CARGA-CODIGOS-ADVAPP-26-09.txt')
        with open(carga, 'w', encoding='utf-8') as fh:
            fh.write('[REGISTRO] Enviado por Pedro el 26/09/2026. Verificado.\n  %s  AT-0456 -> AT-0455\n' % wat)
        anotar([k_wat], carga, a='ADVAPP', ultima=ultima, ruta=ruta, ruta_pedidos=rped, hoy=hoy,
               grupo='Watch Ultra 3 Black Ocean', titulo='Portada con la foto de ADVAPP')
        reg = leer_conocidas(ruta)
        ok(reg['conocidas'][k_sim]['punto'] == 'r_codigo|%s|AT-0537|AT-0537-03' % sim
           and reg['conocidas'][k_wat]['fecha'] == '2026-09-26' and reg['conocidas'][k_wat]['archivo']
           == 'CARGA-CODIGOS-ADVAPP-26-09.txt',
           'se anota con el punto de la regla, o con el archivo y la fecha de su [REGISTRO]')

        c = clasificar(corr, reg, enviados, hoy)
        ok(not c['nuevas'] and len(c['conocidas']) == 3, 'lo anotado pasa a conocido')
        L, rc = resultado(c)
        ok(rc == 3 and L[0].startswith('RESULTADO: nada nuevo') and '21/09' in ' '.join(L)
           and 'hace 8 dias' in ' '.join(L), 'solo conocidas: sale con 3 y dice la mas vieja y sus dias')
        g = lineas_grupos(c)
        ok('   Con el codigo de otro producto:' in g and '    1  iPhone 17 Pro 1TB Sim' in g
           and '       ADVAPP, pedido el 21/09 (hace 8 dias)' in g and '   0 ARREGLADAS desde la corrida anterior' in g,
           'las conocidas se agrupan por pedido, con los dias')

        # una fila nueva en una comprobacion conocida es NUEVA
        corr2 = [{'tanda': 'codigos', 'texto': texto(info, por, col([sim, neo, mba])), 'nombres': nombres}]
        c2 = clasificar(corr2, reg, enviados, hoy)
        ok([x['id'] for x in c2['nuevas']] == [mba] and len(c2['conocidas']) == 3,
           'una fila nueva en una comprobacion conocida cuenta como NUEVA')
        L, rc = resultado(c2)
        ok(rc == 1 and L[0] == 'RESULTADO: 1 NUEVA. Revisar antes de publicar.', 'con una nueva sale con 1 y la cuenta')
        g = lineas_grupos(c2)
        largas = [l for l in g + L if len(l) > ANCHO and not l.strip().startswith('codigos|')]
        ok(not largas, 'todas las lineas tienen %d caracteres o menos (salvo la CLAVE)' % ANCHO)
        ok(any(l.strip() == clave('codigos', comp_col, mba) for l in g), 'y dice la CLAVE de la primera nueva')

        # nunca conocidas
        c3 = clasificar([{'tanda': 'codigos', 'texto': texto('EXCEPCION: TypeError: x is null'), 'nombres': {}},
                         {'tanda': 'sim', 'texto': None, 'motivo': 'Chrome no termino a tiempo'},
                         {'tanda': 'marcas', 'texto': texto('FALLA muestra hasta 14 productos de esa marca  [0]'),
                          'nombres': {}}], reg, enviados, hoy)
        ok(sorted(x['tipo'] for x in c3['nuevas']) == ['excepcion', 'no_corrio', 'sin_filas'],
           'una tanda que revienta, una que no corre y una falla sin filas son siempre nuevas')
        ok(not c3['arregladas'], 'y con la tanda rota, lo conocido no se da por arreglado')

        # otro producto con el mismo ID, y un punto que desaparecio
        otro = dict(nombres, **{sim: 'Galaxy A17 8GB/256GB (Blue)'})
        c4 = clasificar([{'tanda': 'codigos', 'texto': texto(col([sim])), 'nombres': otro}], reg, enviados, hoy)
        ok([x['id'] for x in c4['nuevas']] == [sim] and 'otro producto' in c4['nuevas'][0]['nota'],
           'si ADVAPP reusa el ID para otro producto, la fila vuelve a ser nueva')
        sin_punto = {k: v for k, v in enviados.items() if not k.startswith('r_codigo|' + neo)}
        c5 = clasificar([{'tanda': 'codigos', 'texto': texto(col([neo])), 'nombres': nombres}], reg, sin_punto, hoy)
        ok([x['id'] for x in c5['nuevas']] == [neo], 'si su punto sale de pedidos-advapp.json, la fila vuelve a ser nueva')

        # arregladas: el Watch deja de fallar y su tanda corrio entera
        corr6 = [{'tanda': 'codigos', 'texto': texto(info, '  OK  ' + comp_por + '  [120 portadas]', col([sim, neo])),
                  'nombres': nombres}]
        c6 = clasificar(corr6, reg, enviados, hoy)
        ok([x['clave'] for x in c6['arregladas']] == [k_wat], 'la conocida que da OK pasa a arreglada')
        ok(aplicar_arregladas(c6['arregladas'], ruta) == 1 and k_wat in leer_conocidas(ruta)['arregladas'],
           'y se guarda en "arregladas" con su fecha')
        g = lineas_grupos(clasificar(corr6, leer_conocidas(ruta), enviados, hoy))
        ok('   0 ARREGLADAS desde la corrida anterior' in g, 'se avisa una sola vez')
        c7 = clasificar(corr, leer_conocidas(ruta), enviados, hoy)
        ok([x['id'] for x in c7['nuevas']] == [wat] and c7['nuevas'][0]['nota'].startswith('VOLVIO'),
           'si una arreglada vuelve, sale como NUEVA con VOLVIO')
        # la comprobacion no aparece (la tanda cambio de texto): no se sabe nada
        c8 = clasificar([{'tanda': 'codigos', 'texto': texto(col([sim, neo])), 'nombres': nombres}],
                        reg, enviados, hoy)
        ok(not c8['arregladas'], 'si la comprobacion no se ve, no se da por arreglada')
        c9 = clasificar([dict(corr6[0], fuente='planilla')], reg, enviados, hoy)
        ok(not c9['arregladas'] and clasificar([dict(corr6[0], fuente='advapp')], reg, enviados, hoy)['arregladas'],
           'con ADVAPP caido (la pagina en la planilla), lo conocido no se da por arreglado')

        # --- (29/09, revision) lo que encontro la revision r-identidad-diff
        # Hallazgo 6: una nueva escondida detras de una conocida en una lista con ", "
        a1, a2, a3 = 'CEL-APP-001', 'CEL-APP-002', 'CEL-APP-003'
        comp_fan = 'ninguna portada apunta a un archivo que no esta'
        k_a1 = clave('codigos', comp_fan, a1)
        reg_a = {'conocidas': {k_a1: {'tanda': 'codigos', 'comprobacion': comp_fan, 'id': a1,
                                      'nombre': 'iPhone 17 (Black)', 'a': 'ADVAPP',
                                      'punto': 'r_codigo|%s|AT-0001|AT-0001-01' % a1}},
                 'arregladas': {}}
        env_a = {'r_codigo|%s|AT-0001|AT-0001-01' % a1: {'enviado': '2026-09-26', 'id': a1}}
        nom_a = {a1: 'iPhone 17 (Black)', a2: 'iPhone 17 (White)', a3: 'iPhone 17 (Blue)'}
        linea = 'FALLA %s  [CEL-APP-001, CEL-APP-002, CEL-APP-003]' % comp_fan
        ca = clasificar([{'tanda': 'codigos', 'texto': texto(linea), 'nombres': nom_a}], reg_a, env_a, hoy)
        ok([x['id'] for x in ca['conocidas']] == [a1]
           and [x['id'] for x in ca['nuevas'] if x['tipo'] == 'fila'] == [a2, a3] and resultado(ca)[1] == 1,
           'en "[CEL-APP-001, CEL-APP-002, CEL-APP-003]" con la 001 conocida, la 002 y la 003 son NUEVAS (sale con 1)')
        ca = clasificar([{'tanda': 'codigos', 'texto': texto(linea), 'nombres': None}], reg_a, env_a, hoy)
        ok({a2, a3} <= {x['id'] for x in ca['nuevas']} and resultado(ca)[1] == 1,
           'y lo mismo sin saber los IDs de hoy (la lista del principio del pedazo)')
        f, s, cortada, ocultas = filas_de('2: %s (Sim/-) lleva AT-0071, que es E-Sim/- (%s) | %s lleva AT-0433, '
                                          'que es otro modelo (%s)' % (sim, neo, wat, mba), set(nombres))
        ok([x[0] for x in f] == [sim, wat] and not s and not cortada
           and f[0][1] == '(Sim/-) lleva AT-0071, que es E-Sim/- (%s)' % neo,
           'el ID entre parentesis (la gemela de codigos.js) no es otra fila, y el detalle queda igual')
        f, s, cortada, ocultas = filas_de('%s (Sim/-) lleva AT-0071, que es E-Sim/- (%s)' % (sim, neo), None)
        ok([x[0] for x in f] == [sim], 'sin saber los IDs de hoy tampoco (ni AT-0071, ni la gemela)')
        f, s, cortada, ocultas = filas_de('5: %s, %s y %s' % (sim, neo, wat), set(nombres))
        ok([x[0] for x in f] == [sim, neo, wat] and cortada and ocultas == 2,
           'con ", " e " y " cuenta cada ID, y lo que falta se cuenta contra los IDs que se ven')

        # Hallazgo 7: el punto figura arreglado y la prueba sigue fallando
        arr = {k: (dict(v, arreglado='2026-09-28') if k.startswith('r_codigo|' + sim) else v)
               for k, v in enviados.items()}
        cr = clasificar(corr, reg, arr, hoy)
        x = next((x for x in cr['nuevas'] if x['id'] == sim), None)
        ok(x is not None and 'su punto figura arreglado el 28/09' in x['nota'] and len(cr['conocidas']) == 2,
           'si su punto figura arreglado, la conocida vuelve a ser NUEVA ("su punto figura arreglado el 28/09")')

        # 21: un punto sin "enviado" (antes TypeError) y los nombres que no llegaron
        sin_env = {k: ({kk: vv for kk, vv in v.items() if kk != 'enviado'} if k.startswith('r_codigo|' + neo) else v)
                   for k, v in enviados.items()}
        try:
            cs = clasificar(corr, reg, sin_env, hoy)
            x = next((x for x in cs['nuevas'] if x['id'] == neo), None)
            ok(x is not None and 'no dice cuando se envio' in x['nota'],
               'un punto sin fecha de envio no revienta: la fila vuelve a ser NUEVA y dice por que')
        except Exception as ex:
            ok(False, 'un punto sin fecha de envio no revienta (%s: %s)' % (type(ex).__name__, ex))
        cn = clasificar([dict(corr[0], nombres=None)], reg, enviados, hoy)
        ok(not cn['conocidas'] and all('no se sabe que producto es hoy' in x['nota']
                                       for x in cn['nuevas'] if x['tipo'] == 'fila')
           and len([x for x in cn['nuevas'] if x['tipo'] == 'fila']) == 3,
           'sin los nombres de hoy no se puede ver si el ID se reuso: lo anotado no pasa por conocido')
        ok(not clasificar([dict(corr[0], nombres={})], reg, enviados, hoy)['conocidas'],
           'con los nombres vacios tampoco')

        # 3e: la forma del ID, la misma aca y en el script que inyecta correr.py
        with open(os.path.join(RAIZ, 'pruebas', 'correr.py'), encoding='utf-8') as fh:
            fuente_correr = fh.read()
        re_js = re.search(r'\.match\(/([^/]+)/g\)', fuente_correr)
        ok(re_js is not None and re_js.group(1) == RE_ID.pattern,
           'correr.py (NOMBRES_FILAS) lee el ID con la misma forma que RE_ID (%s / %s)'
           % (re_js.group(1) if re_js else '?', RE_ID.pattern))

        # 3a y 3d: el resumen entero de correr.py a 50 caracteres, y su corrida por puerto
        probar_resumen_de_correr(ok, tmp, corr, nombres, hoy)
    finally:
        import shutil
        shutil.rmtree(tmp, ignore_errors=True)

    print()
    print('RESULTADO: %s' % ('%d FALLA(S)' % len(fallas) if fallas else 'pasa todo'))
    return 1 if fallas else 0


if __name__ == '__main__':
    sys.exit(main())
