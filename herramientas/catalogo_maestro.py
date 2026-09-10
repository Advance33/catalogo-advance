# -*- coding: utf-8 -*-
"""El catalogo maestro: la identidad propia de cada producto y cada color.

POR QUE EXISTE
--------------
Hasta acá la identidad de un producto siempre se DEDUJO del texto que manda
el proveedor. Primero fue el ID (CEL-APP-085), que la planilla renumeraba;
después el SKU del contrato landing/1.2, que se arma con las palabras del
nombre. Los dos se rompieron por el mismo motivo: el texto cambia. El
10/09/2026, 36 productos cambiaron de SKU en un día porque alguien escribió
"5G", "Sin Cargador" o 11" en vez de 11in, y 43 fotos quedaron colgadas.

Ninguna función que traduzca texto a identidad va a ser estable, por buena
que sea. La identidad no se calcula: se ASIGNA UNA VEZ y se guarda.

Eso es este archivo. Cada producto del catálogo tiene un código propio que
se le pone el día que entra y no cambia nunca más, pase lo que pase con su
nombre, su precio, su ID o su SKU.

    AT-0142        el producto             (iPhone 17 Pro 256GB)
    AT-0142-BLU    el producto en un color (iPhone 17 Pro 256GB azul)
    fotos/AT-0142-BLU.jpg

"AT" es Advance Tecno. El número es correlativo y no significa nada: esa es
la gracia. No se puede volver a romper porque no depende de nada.

CÓMO SE MANTIENE
----------------
El registro vive en herramientas/catalogo-maestro.csv y SOLO CRECE: un
producto que se da de baja queda con fecha de baja, nunca se borra ni se
reusa su código. Si el producto vuelve, vuelve con el mismo código y sus
fotos lo están esperando.

Para que la planilla pueda poner el código en cada fila, el equipo del sheet
mantiene la misma tabla en una hoja "Catalogo" del Sheet y escribe dos
columnas nuevas en Landing: CODIGO y CODIGO_COLOR. Las filas nuevas que
todavía no tienen código salen listadas en el manifiesto y alguien se las
asigna: hoy son unas tres por día.

Mientras el sheet no tenga esas columnas, este módulo puede resolver el
código de una fila por su cuenta, usando el vínculo guardado con el ID y con
el SKU del día del alta. Es un puente, no la solución: la solución es que el
código venga en la fila.

ESTADO: BORRADOR, TODAVIA NO ESTA EN USO
----------------------------------------
La numeración de catalogo-maestro.csv se generó el 10/09/2026 desde la
planilla de ese día y es una PROPUESTA: nadie la lee todavía, ni la web ni
los chequeos. Se puede regenerar entera mientras siga así.

Deja de poder regenerarse el día que se acuerde con el equipo de la planilla
(ver PROPUESTA-CODIGO-PROPIO-AL-SHEET.txt) y se renombren las fotos. A
partir de ahí los códigos son para siempre, que es todo el punto. Antes de
ese día hay que resolver a mano las fusiones de productos que el catálogo
haya agrupado mal, porque después no se pueden cambiar.
"""
import csv
import io
import os
import re
import unicodedata

AQUI = os.path.dirname(os.path.abspath(__file__))
MAESTRO = os.path.join(AQUI, 'catalogo-maestro.csv')
COLORES_CSV = os.path.join(AQUI, 'catalogo-colores.csv')

PREFIJO = 'AT'
RE_CODIGO = re.compile(r'^AT-\d{4}$')
RE_CODIGO_COLOR = re.compile(r'^(AT-\d{4})(?:-([A-Z0-9]{2,5}))?$')

COLUMNAS = ['CODIGO', 'CODIGO_COLOR', 'Categoria', 'Marca', 'Producto',
            'Color', 'CodigoColor', 'ID_alta', 'SKU_alta', 'Precio_alta',
            'Alta', 'Baja', 'Fusionado_en', 'Nota']
COLUMNAS_COLOR = ['Codigo', 'Color', 'Escrituras', 'Nota']


def norm(s):
    s = unicodedata.normalize('NFD', s or '')
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn').lower().strip()


class CatalogoRoto(Exception):
    """El registro no se puede leer. Frena todo: es preferible no publicar a
    publicar con un catálogo al que le falta la mitad."""


def leer(ruta=MAESTRO, tolerante=False):
    """El catálogo maestro como lista de filas. [] si todavía no existe.

    Una fila sin CODIGO_COLOR es un archivo roto, no una fila que se saltea.
    Antes se descartaba en silencio: una celda pisada y un producto
    desaparecía del catálogo con su foto, sin un solo mensaje. Es la misma
    forma de fallar que ya costó dos rediseños, así que acá revienta.
    """
    if not os.path.exists(ruta):
        return []
    with io.open(ruta, encoding='utf-8', newline='') as fh:
        filas = list(csv.DictReader(fh))
    rotas = [i + 2 for i, f in enumerate(filas) if not (f.get('CODIGO_COLOR') or '').strip()]
    if rotas and not tolerante:
        raise CatalogoRoto('%s: %d fila(s) sin CODIGO_COLOR (línea %s). '
                           'Alguien lo edito mal: revisalo antes de seguir.'
                           % (os.path.basename(ruta), len(rotas),
                              ', '.join(str(x) for x in rotas[:5])))
    return [f for f in filas if (f.get('CODIGO_COLOR') or '').strip()]


def escribir(filas, ruta=MAESTRO):
    with io.open(ruta, 'w', encoding='utf-8', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNAS, extrasaction='ignore')
        w.writeheader()
        for f in sorted(filas, key=lambda x: x['CODIGO_COLOR']):
            w.writerow({c: (f.get(c) or '') for c in COLUMNAS})


def leer_colores(ruta=COLORES_CSV):
    """Diccionario de colores: escritura -> (codigo, nombre canonico).

    El proveedor escribe el mismo color de cinco formas ("Sky Blue",
    "Skyblue", "SKY-BLUE"). Acá cada color tiene un código y la lista de
    todas las formas en que lo vimos escrito, así una escritura nueva se
    agrega sin tocar nada más.
    """
    mapa = {}
    if not os.path.exists(ruta):
        return mapa
    with io.open(ruta, encoding='utf-8', newline='') as fh:
        for f in csv.DictReader(fh):
            cod, nombre = (f.get('Codigo') or '').strip(), (f.get('Color') or '').strip()
            if not cod:
                continue
            for e in [nombre] + [x.strip() for x in (f.get('Escrituras') or '').split('|')]:
                if e:
                    mapa[norm(e)] = (cod, nombre)
    return mapa


def escribir_colores(filas, ruta=COLORES_CSV):
    with io.open(ruta, 'w', encoding='utf-8', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNAS_COLOR, extrasaction='ignore')
        w.writeheader()
        for f in sorted(filas, key=lambda x: x['Codigo']):
            w.writerow({c: (f.get(c) or '') for c in COLUMNAS_COLOR})


def indexar(filas):
    """Los índices que hacen falta para encontrar el código de una fila."""
    idx = {'por_codigo_color': {}, 'por_id': {}, 'por_sku': {}, 'por_codigo': {}}
    for f in filas:
        idx['por_codigo_color'][f['CODIGO_COLOR']] = f
        idx['por_codigo'].setdefault(f['CODIGO'], []).append(f)
        if f.get('ID_alta'):
            idx['por_id'].setdefault(f['ID_alta'], []).append(f)
        if f.get('SKU_alta'):
            idx['por_sku'].setdefault(f['SKU_alta'], []).append(f)
    return idx


def partir(codigo_color):
    """"AT-0142-BLU" -> ("AT-0142", "BLU"). None si no tiene la forma."""
    m = RE_CODIGO_COLOR.match((codigo_color or '').strip().upper())
    return (m.group(1), m.group(2) or '') if m else None


def nombre_foto(codigo_color):
    """El archivo de esa combinación producto+color."""
    p = partir(codigo_color)
    return (codigo_color.strip().upper() + '.jpg') if p else ''


CONTADOR = os.path.join(AQUI, 'catalogo-ultimo-codigo.txt')


def ultimo_asignado(ruta=CONTADOR):
    """El último número que se entregó, guardado aparte del catálogo."""
    if not os.path.exists(ruta):
        return 0
    for linea in io.open(ruta, encoding='utf-8'):
        linea = linea.split('#')[0].strip()
        if linea.isdigit():
            return int(linea)
    return 0


def proximo_codigo(filas, ruta=CONTADOR):
    """El siguiente número libre. Los códigos NO se reusan: un producto dado
    de baja se lleva su número a la tumba, porque sus fotos siguen en la
    carpeta y el día que vuelva tienen que ser suyas otra vez.

    El número sale de un contador propio y no del máximo de las filas, porque
    el máximo baja si alguien borra la última fila y entonces el código
    siguiente pisa uno ya entregado. Se toma el mayor de los dos, así el
    contador se puede reconstruir si se pierde, pero nunca retrocede.
    """
    n = ultimo_asignado(ruta)
    for f in filas:
        if RE_CODIGO.match((f.get('CODIGO') or '').strip()):
            n = max(n, int(f['CODIGO'][3:]))
    return '%s-%04d' % (PREFIJO, n + 1)


def guardar_contador(n, ruta=CONTADOR):
    io.open(ruta, 'w', encoding='utf-8').write(
        '# El ultimo numero de codigo que se entrego. NO BAJA NUNCA.\n'
        '# Si este archivo se pierde, se reconstruye con el maximo del\n'
        '# catalogo, pero entonces se pierden los codigos de los productos\n'
        '# que se dieron de baja y se borraron: por eso no se borra ninguno.\n'
        '%d\n' % n)


def palabras(s):
    return {p for p in re.split(r'[^a-z0-9]+', norm(s)) if p}


def parecido(a, b):
    """Cuánto se parecen dos nombres, de 0 a 1: las palabras que comparten
    sobre el total. "Galaxy A57 8/128GB" y "Galaxy A57 8/128GB 5G" dan 0.86;
    dos productos distintos de la misma marca rara vez pasan de 0.5."""
    pa, pb = palabras(a), palabras(b)
    return len(pa & pb) / len(pa | pb) if (pa or pb) else 0.0


PARECIDO_MINIMO = 0.55
PRECIO_TOLERANCIA = 0.10

# Las palabras que separan un producto de otro dentro de la misma linea. No
# alcanza con que aparezcan: hay que contarlas.
# "gen" no entra: el numero de generacion ya cuenta por su lado, y la palabra
# aparece o no segun el dia ("AirPods Max 2 Gen" y "AirPods Max USB-C 2").
GAMA = ('pro', 'max', 'plus', 'air', 'ultra', 'mini', 'neo', 'fe', 'lite',
        'se', 'cellular', 'wifi', 'body', 'kit')
RE_MEDIDA = re.compile(r'^\d+(gb|tb|mm|in|ram|hz|mp|w)$|^\d+(\.\d+)?in$|^\d+$')


def firma_dura(nombre):
    """Lo que NO puede cambiar sin que sea otro producto: las capacidades,
    las medidas y las palabras de gama, CONTADAS.

    Contadas, no como conjunto, y ese es el punto. "MacBook Pro M5 14"" y
    "MacBook Pro M5 Pro 14"" comparten exactamente las mismas palabras, asi
    que cualquier comparacion por conjuntos las da por identicas: son dos
    maquinas con 400 dolares de diferencia. Lo mismo con "iPhone 17 Pro Max"
    y "iPhone 17 Pro", que es como se rompieron tres fichas de mas de mil
    dolares en la primera semana de septiembre.
    """
    cuenta = {}
    for p in re.split(r'[^a-z0-9]+', norm(nombre)):
        # "AirPods 4ta" y "AirPods 4" son el mismo: el ordinal se escribe de
        # cuatro formas y ninguna cambia el producto
        p = re.sub(r'^(\d+)(ta|to|da|do|ra|ro|er|a|o)$', r'\1', p or '')
        # "16ram" y "16GB" tambien: el proveedor cambio de forma de escribir
        # la memoria y de un dia para otro dejo dudosas catorce notebooks
        p = re.sub(r'^(\d+)ram$', r'\1gb', p)
        # un año no distingue un producto de otro ("Magic Trackpad 2" y
        # "Magic Trackpad 2 (2024)" son el mismo)
        if re.match(r'^(19|20)\d\d$', p):
            continue
        if p and (p in GAMA or RE_MEDIDA.match(p)):
            cuenta[p] = cuenta.get(p, 0) + 1
    return tuple(sorted(cuenta.items()))


def _precio(v):
    try:
        return float(re.sub(r'[^0-9.]', '', (v or '').replace(',', '.')) or 0)
    except ValueError:
        return 0.0


def mismo_precio(a, b, tolerancia=PRECIO_TOLERANCIA):
    """Dos precios que pueden ser del mismo producto. Los precios se mueven,
    pero poco: entre corridas, el 90% queda igual y el 98% dentro del 5%."""
    pa, pb = _precio(a), _precio(b)
    if not pa or not pb:
        return None                      # sin dato no se opina
    return abs(pa - pb) / max(pa, pb) <= tolerancia


def sin_los_colores(nombre, pinta=None, conocidos=None):
    """El nombre sin el paréntesis de colores.

    Media planilla escribe los colores dentro del nombre: "Watch Series 11
    42mm GPS S/M (Rose Gold)". Cuando la fila cambia de color, ese paréntesis
    cambia entero y el nombre parece otro producto aunque sea el mismo. Se
    saca sólo el paréntesis que es TODO color; el de los Ray-Ban, que trae el
    código del fabricante ("601/1M50"), se conserva, porque ahí sí distingue
    un anteojo de otro.
    """
    texto = nombre or ''
    if not pinta:
        return texto
    for m in re.finditer(r'\(([^()]*)\)', texto):
        adentro = [x.strip() for x in re.split(r'[/·]', m.group(1)) if x.strip()]
        if adentro and all(pinta(x, conocidos) for x in adentro):
            texto = texto.replace(m.group(0), ' ')
    return texto


def es_el_mismo(fila, entrada, pinta=None, conocidos=None):
    """Si una fila de la planilla y una del catálogo son el mismo producto.

    Esto existe porque la planilla REUTILIZA los IDs. Sin este control, el
    dia que CEL-APP-085 deje de ser un iPhone y pase a ser un Samsung, el
    vinculo guardado le daria el codigo del iPhone y la ficha del Samsung
    mostraria la foto del iPhone: exactamente el error que todo esto existe
    para que no vuelva a pasar. Ante la duda no se resuelve, y la fila queda
    sin foto, que es el error barato.
    """
    if norm(fila.get('Marca')) != norm(entrada.get('Marca')):
        return False
    if norm(fila.get('Categoría') or fila.get('Categoria')) != norm(entrada.get('Categoria')):
        return False
    a, b = fila.get('Descripción completa'), entrada.get('Producto')
    # La firma dura manda: si cambio una capacidad, una medida o una palabra
    # de gama, es otro producto por mas que el nombre se parezca.
    if firma_dura(a) != firma_dura(b):
        return False
    if (parecido(a, b) >= PARECIDO_MINIMO
            or parecido(sin_los_colores(a, pinta, conocidos),
                        sin_los_colores(b, pinta, conocidos)) >= PARECIDO_MINIMO):
        return True
    # El nombre se reescribio entero pero el precio no se movio: pasa cuando
    # el proveedor cambia como escribe toda una linea de productos.
    return mismo_precio(fila.get('Precio USD'), entrada.get('Precio_alta')) is True


def codigo_de_la_fila(fila, idx, pinta=None, conocidos=None):
    """El código del PRODUCTO al que pertenece una fila de la planilla.

      1. La columna CODIGO, si la planilla ya la trae. Esto es lo que tiene
         que pasar siempre una vez que el sheet la mantenga.
      2. El vínculo guardado con el ID del alta, si ademas es el mismo
         producto (misma marca, misma categoria, nombre parecido).
      3. Lo mismo con el SKU del alta.
      4. Nada: o es un alta, o el vinculo ya no es de fiar. En los dos casos
         hace falta que una persona lo resuelva.

    Devuelve (codigo, de_donde). El "de donde" sirve para avisar cuando se
    está resolviendo por el puente y no por la columna, y para distinguir un
    alta ('falta') de un vinculo que dejo de servir ('dudoso').

    Ojo con lo que NO hace: no devuelve el color. El color se lee de la fila
    de HOY y se traduce con el diccionario. Si el color viajara con el
    vinculo, un producto que rota sus colores heredaria el de ayer: la fila
    que hoy vende White se quedaria con la foto Black porque asi entro al
    catalogo. Medido contra la planilla del 09/09, eso pasaba en 113 filas.
    """
    dado = (fila.get('CODIGO') or '').strip().upper()
    if dado and RE_CODIGO.match(dado):
        return dado, 'columna'
    dado = (fila.get('CODIGO_COLOR') or '').strip().upper()
    if dado and partir(dado):
        return partir(dado)[0], 'columna'
    hubo_candidatos = False
    for clave, donde in (((fila.get('ID') or '').strip(), 'id'),
                         ((fila.get('SKU') or '').strip(), 'sku')):
        if not clave:
            continue
        cands = idx['por_id' if donde == 'id' else 'por_sku'].get(clave) or []
        # Un producto dado de baja que reaparece con su mismo ID es el caso
        # MAS facil de reconocer, no uno para ignorar: en ocho dias, once
        # productos se fueron y volvieron. Si se lo excluye, vuelve como alta,
        # alguien le da un codigo nuevo y sus fotos se quedan esperando a
        # nadie, que es justo lo que el catalogo promete que no pasa.
        if not cands:
            continue
        hubo_candidatos = True
        codigos = {seguir_fusion(c['CODIGO'], idx)
                   for c in cands if es_el_mismo(fila, c, pinta, conocidos)}
        if len(codigos) == 1:
            return codigos.pop(), donde
    return '', ('dudoso' if hubo_candidatos else 'falta')


def seguir_fusion(codigo, idx):
    """Si el código fue fusionado en otro, devuelve el que quedó vivo.

    Dos códigos para el mismo producto pasa: el producto se da de baja, vuelve
    con otro ID y otro nombre, y nadie lo reconoce. Cuando se descubre, en vez
    de borrar uno se lo marca con Fusionado_en y sus fotos siguen sirviendo.
    """
    visto = set()
    while codigo not in visto:
        visto.add(codigo)
        filas = idx['por_codigo'].get(codigo) or []
        destino = next((f.get('Fusionado_en', '').strip().upper() for f in filas
                        if (f.get('Fusionado_en') or '').strip()), '')
        if not destino or destino == codigo:
            return codigo
        codigo = destino
    return codigo


def codigo_color(codigo, color, dicc_colores):
    """Junta el producto con el color de HOY: ("AT-0142", "Blue") -> AT-0142-BLU.

    Devuelve '' si el color no está en el diccionario: un color que no
    conocemos no puede inventar un código, porque ese código seria el nombre
    de un archivo y mañana, cuando el color se agregue bien, no coincidiria.
    """
    if not codigo:
        return ''
    if not color:
        return codigo
    cod = (dicc_colores.get(norm(color)) or ('', ''))[0]
    return '%s-%s' % (codigo, cod) if cod else ''


def candidatos_foto(codigo, colores_de_hoy, dicc_colores):
    """Los archivos que la web prueba para la portada de una fila, en orden:
    el primer color que vende hoy, después cualquier otro color que venda, y
    al final el producto sin color. Mismo criterio que fotos_sku."""
    if not codigo:
        return []
    salida = [codigo_color(codigo, c, dicc_colores) for c in (colores_de_hoy or [])]
    salida.append(codigo)
    vistos, out = set(), []
    for n in salida:
        if n and n not in vistos:
            vistos.add(n)
            out.append(n)
    return out
