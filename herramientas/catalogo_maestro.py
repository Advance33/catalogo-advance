# -*- coding: utf-8 -*-
"""El catalogo maestro: la identidad propia de cada producto y cada variante.

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
    AT-0142-01     una variante suya       (el azul)
    fotos/AT-0142-01.jpg

"AT" es Advance Tecno. Los números son correlativos y no significan nada:
esa es la gracia. No se pueden volver a romper porque no dependen de nada.

POR QUE "VARIANTE" Y NO "COLOR"
-------------------------------
Porque la mitad de las veces no es un color. La planilla manda en la columna
Color cosas como "Black Alpine Loop M" (una correa), "Transitions Green" (un
cristal) o "Titanio Gris · Blanco" (dos tonos de un mismo reloj). Una banda
no es un color: es un objeto.

Numerando, el código no afirma nada sobre lo que hay adentro. AT-0450-01 es
la primera variante del Watch Ultra 3, y el catálogo dice que se vende como
"Black Alpine Loop M". El día que la planilla ponga la correa en su propia
columna, cambia el texto de esa fila y no se renombra ni una foto.

CÓMO SE MANTIENE
----------------
El registro vive en herramientas/catalogo-maestro.csv y SOLO CRECE: un
producto que se da de baja queda con fecha de baja, nunca se borra ni se
reusa su código. Si el producto vuelve, vuelve con el mismo código y sus
fotos lo están esperando.

Cada fila guarda, además del texto de la variante, todas las formas en que
vimos que el proveedor la escribe ("Sky Blue", "Skyblue", "SKY-BLUE"), así
una escritura nueva se agrega sin tocar nada más y sin renombrar nada.

El equipo del sheet mantiene la misma tabla en una hoja "Catalogo" del Sheet
y desde el contrato landing/1.3 (11/09/2026) escribe dos columnas en Landing:
CODIGO y CODIGO_VAR. Las 509 filas vienen con código; las que no lo tuvieran
van con las celdas vacías y salen en sin_codigo del manifiesto.

CODIGO_VAR trae un código por color, en el MISMO ORDEN que la columna Color,
y las posiciones vacías se mantienen: si una variante no tiene código, esa
posición va vacía en vez de desaparecer. Una celda corrida le daría a un
color la foto del color de al lado.

El puente sigue acá abajo y sigue sirviendo: resuelve el código de una fila
por el vínculo guardado con el ID y con el SKU del alta. Se usa cuando la
columna no viene, y sobre todo se usa para VERIFICAR: verificar-fotos.py
compara lo que manda la planilla contra lo que resuelve el puente y frena la
publicación si no coinciden. Las dos puntas salen del mismo catálogo maestro,
así que tienen que dar lo mismo; el día que no den lo mismo es que una cambió
y la otra no se enteró.

ESTADO: EN USO. LOS CODIGOS YA NO SE PUEDEN REGENERAR
-----------------------------------------------------
La numeración se generó el 10/09/2026 desde la planilla de ese día. Desde el
11/09 la lee la web (va en fotos/indice.json) y las fotos se llaman así, de
manera que estos códigos son para siempre: regenerarlos desde cero dejaría
todas las fotos apuntando a productos equivocados.

El acuerdo con el equipo de la planilla está cerrado: el contrato landing/1.3
trae CODIGO y CODIGO_VAR en cada fila, y el 11/09 las 509 filas resuelven por
la columna, no por el puente.

CUANDO EL PROVEEDOR CAMBIA COMO ESCRIBE ALGO
--------------------------------------------
Pasa seguido, y el puente no puede adivinar. El 11/09 movió cuatro productos
de categoría, le agregó "GEN2" a siete anteojos y reescribió media docena de
nombres. Para eso está el trabajo diario:

    python3 herramientas/altas-catalogo.py     lista lo que no reconoce
    (una persona escribe la decisión en herramientas/altas-decididas.csv)
    python3 herramientas/confirmar-altas.py --aplicar
    python3 herramientas/altas-catalogo.py --aplicar

Confirmar no es sólo destrabar el día: el ID, el SKU, el nombre y la
categoría con que vino quedan anotados en el producto, así que el mismo
cambio no vuelve a preguntarse nunca más.
"""
import csv
import difflib
import io
import json
import os
import re
import unicodedata

AQUI = os.path.dirname(os.path.abspath(__file__))
MAESTRO = os.path.join(AQUI, 'catalogo-maestro.csv')
CONTADOR = os.path.join(AQUI, 'catalogo-ultimo-codigo.txt')

PREFIJO = 'AT'
RE_CODIGO = re.compile(r'^AT-\d{4}$')
RE_CODIGO_VAR = re.compile(r'^(AT-\d{4})(?:-(\d{2}))?$')
EXT = '.jpg'

COLUMNAS = ['CODIGO', 'CODIGO_VAR', 'Categoria', 'Marca', 'Producto',
            'Variante', 'Escrituras', 'NumVar', 'ID_alta', 'Otros_IDs',
            'SKU_alta', 'Otros_SKUs', 'Nombres_vistos', 'Otras_Categorias',
            'Precio_alta',
            'Alta', 'Baja', 'Fusionado_en', 'Nota']

# Otros_IDs, Otros_SKUs, Nombres_vistos y Otras_Categorias empiezan vacias y
# se llenan solas: cada vez que una persona confirma que una fila rara es un
# producto que ya esta, el ID, el SKU, el nombre y la categoria con que vino
# hoy quedan anotados ahi. Sin eso, confirmar no serviria de nada: el mismo
# producto vuelve a caer en la lista de sin resolver manana, y pasado, y el
# dia que nadie mire se le da un codigo nuevo y sus fotos se parten en dos.
APRENDIDAS = {'ID_alta': 'Otros_IDs', 'SKU_alta': 'Otros_SKUs'}


def norm(s):
    s = unicodedata.normalize('NFD', s or '')
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn').lower().strip()


class CatalogoRoto(Exception):
    """El registro no se puede leer. Frena todo: es preferible no publicar a
    publicar con un catálogo al que le falta la mitad."""


def leer(ruta=MAESTRO, tolerante=False):
    """El catálogo maestro como lista de filas. [] si todavía no existe.

    Una fila sin CODIGO_VAR es un archivo roto, no una fila que se saltea.
    Antes se descartaba en silencio: una celda pisada y un producto
    desaparecía del catálogo con su foto, sin un solo mensaje. Es la misma
    forma de fallar que ya costó dos rediseños, así que acá revienta.
    """
    if not os.path.exists(ruta):
        return []
    with io.open(ruta, encoding='utf-8', newline='') as fh:
        filas = list(csv.DictReader(fh))
    rotas = [i + 2 for i, f in enumerate(filas) if not (f.get('CODIGO_VAR') or '').strip()]
    if rotas and not tolerante:
        raise CatalogoRoto('%s: %d fila(s) sin CODIGO_VAR (línea %s). '
                           'Alguien lo editó mal: revisalo antes de seguir.'
                           % (os.path.basename(ruta), len(rotas),
                              ', '.join(str(x) for x in rotas[:5])))
    return [f for f in filas if (f.get('CODIGO_VAR') or '').strip()]


def escribir(filas, ruta=MAESTRO):
    if ruta == MAESTRO:
        # Antes de tocar nada: si hay un salto, no se escribe ni una fila.
        salto = salto_en_la_numeracion(filas)
        if salto:
            raise CatalogoRoto(salto)
    with io.open(ruta, 'w', encoding='utf-8', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNAS, extrasaction='ignore')
        w.writeheader()
        for f in sorted(filas, key=lambda x: x['CODIGO_VAR']):
            w.writerow({c: (f.get(c) or '') for c in COLUMNAS})
    if ruta == MAESTRO:
        sincronizar_contador(filas)


def salto_en_la_numeracion(filas, anterior=None):
    """Si los códigos nuevos dejan un hueco. '' si está todo bien.

    Los códigos que estrena una corrida tienen que ser los que siguen al
    último entregado, sin saltear ninguno: anterior+1, anterior+2... Un
    salto no lo produce nunca una alta de verdad (las numera proximo_codigo,
    de a uno) sino un código que llegó de afuera. El 29/09 se probó con una
    fila de ADVAPP con CODIGO AT-0600 mal tipeado: altas-catalogo la tomaba
    como un producto que ya estaba, el contador pasaba de 537 a 600 y como
    no baja nunca, los 62 números del medio quedaban quemados para siempre.
    Sin número fijo de tolerancia a propósito: un lote de seis altas el
    mismo día (el 15/09 hubo seis) es legítimo y no deja hueco.

    Con el contador perdido (0) no se controla: se está reconstruyendo.
    """
    anterior = ultimo_asignado() if anterior is None else anterior
    if not anterior:
        return ''
    nuevos = sorted({int(f['CODIGO'][3:]) for f in filas
                     if RE_CODIGO.match((f.get('CODIGO') or '').strip())
                     and int(f['CODIGO'][3:]) > anterior})
    esperados = list(range(anterior + 1, anterior + 1 + len(nuevos)))
    if nuevos == esperados:
        return ''
    faltan = sorted(set(range(anterior + 1, max(nuevos) + 1)) - set(nuevos))
    return ('el catalogo saltaria del AT-%04d al AT-%04d y dejaria %d numero(s) sin '
            'entregar (AT-%04d...). Un codigo asi no lo da una alta: casi seguro '
            'vino de afuera mal tipeado. No se escribio nada.'
            % (anterior, max(nuevos), len(faltan), faltan[0]))


def sincronizar_contador(filas):
    """Deja el contador en el número más alto que se haya entregado.

    Desde el 14/09 el maestro tiene un solo escritor y somos nosotros: los
    códigos los reparte proximo_codigo(), de a uno. El contador no es el
    espejo de lo que numere otro (así lo pensamos con el contrato landing/1.3,
    cuando creíamos que asignaba el equipo de la planilla): esa idea de espejo
    es la que dejaba pasar un AT-0600 mal tipeado. Por eso escribir() mira
    antes salto_en_la_numeracion() y acá sólo se acompaña lo que ya pasó ese
    control.

    Nunca baja. Un número que se entregó queda entregado aunque su producto
    se borre del archivo, porque su foto puede seguir en la carpeta.
    """
    alto = max((int(f['CODIGO'][3:]) for f in filas
                if RE_CODIGO.match((f.get('CODIGO') or '').strip())), default=0)
    if alto > ultimo_asignado():
        guardar_contador(alto)


def escrituras_de(fila):
    """Todas las formas en que se puede escribir esa variante."""
    salida = {norm(fila.get('Variante'))} if (fila.get('Variante') or '').strip() else set()
    salida.update(norm(x) for x in lista(fila, 'Escrituras'))
    return {x for x in salida if x}


ESCAPE = '\\'


def lista(fila, campo):
    r"""Un campo que guarda varios valores, separados por barra vertical.

    El texto del proveedor PUEDE traer una barra. El 14/09 empezó a mandar
    los nombres como "P2425HE | Dell Pro 24 Plus", y guardados tal cual esa
    barra partía el nombre en dos: el producto quedaba anotado como
    "P2425HE" a secas, que no reconoce nada, y la confirmación hecha a mano
    no servía. Por eso al guardar la barra del texto se escribe \| y acá se
    vuelve a armar. Es el mismo error de siempre — un separador que aparece
    adentro del dato — una capa más abajo.
    """
    texto, partes, actual, i = (fila.get(campo) or ''), [], '', 0
    while i < len(texto):
        if texto[i] == ESCAPE and i + 1 < len(texto):
            actual += texto[i + 1]
            i += 2
        elif texto[i] == '|':
            partes.append(actual)
            actual = ''
            i += 1
        else:
            actual += texto[i]
            i += 1
    partes.append(actual)
    return [x.strip() for x in partes if x.strip()]


def juntar(valores):
    """Arma el campo escapando las barras que trae el texto."""
    return '|'.join(v.replace(ESCAPE, ESCAPE + ESCAPE).replace('|', ESCAPE + '|')
                    for v in valores)


def todos(fila, campo):
    """El valor del alta mas todos los que se aprendieron despues."""
    otros = APRENDIDAS.get(campo)
    uno = (fila.get(campo) or '').strip()
    salida = [uno] if uno else []
    for x in (lista(fila, otros) if otros else []):
        if x not in salida:
            salida.append(x)
    return salida


def aprender(fila, campo, valor):
    """Anota una clave nueva para este producto. Devuelve si agrego algo."""
    valor = (valor or '').strip()
    if not valor or valor in todos(fila, campo):
        return False
    fila[APRENDIDAS[campo]] = juntar(lista(fila, APRENDIDAS[campo]) + [valor])
    return True


def nombres_de(fila):
    """Todos los nombres con los que se vio el producto, el del alta primero."""
    salida = [(fila.get('Producto') or '').strip()]
    for x in lista(fila, 'Nombres_vistos'):
        if x not in salida:
            salida.append(x)
    return [x for x in salida if x]


def aprender_nombre(fila, nombre):
    """Anota un nombre nuevo del producto. Devuelve si agrego algo."""
    nombre = (nombre or '').strip()
    if not nombre or nombre in nombres_de(fila):
        return False
    fila['Nombres_vistos'] = juntar(lista(fila, 'Nombres_vistos') + [nombre])
    return True


def categorias_de(fila):
    """Todas las categorias en las que se vio el producto."""
    salida = [(fila.get('Categoria') or '').strip()]
    for x in lista(fila, 'Otras_Categorias'):
        if x not in salida:
            salida.append(x)
    return [x for x in salida if x]


def aprender_categoria(fila, categoria):
    """Anota una categoria nueva. Devuelve si agrego algo."""
    categoria = (categoria or '').strip()
    if not categoria or norm(categoria) in {norm(x) for x in categorias_de(fila)}:
        return False
    fila['Otras_Categorias'] = juntar(lista(fila, 'Otras_Categorias') + [categoria])
    return True


def indexar(filas):
    """Los índices que hacen falta para encontrar el código de una fila.

    Se busca por TODOS los IDs y SKUs con los que se vio el producto, no solo
    por el del alta. La planilla renumera y el proveedor reescribe; cada clave
    que alguien confirma a mano queda anotada y sirve para siempre.
    """
    idx = {'por_var': {}, 'por_id': {}, 'por_sku': {}, 'por_codigo': {}}
    for f in filas:
        idx['por_var'][f['CODIGO_VAR']] = f
        idx['por_codigo'].setdefault(f['CODIGO'], []).append(f)
        for i in todos(f, 'ID_alta'):
            idx['por_id'].setdefault(i, []).append(f)
        for s in todos(f, 'SKU_alta'):
            idx['por_sku'].setdefault(s, []).append(f)
    return idx


def partir(codigo_var):
    """"AT-0142-01" -> ("AT-0142", "01"). None si no tiene la forma."""
    m = RE_CODIGO_VAR.match((codigo_var or '').strip().upper())
    return (m.group(1), m.group(2) or '') if m else None


def nombre_foto(codigo_var):
    """El archivo de esa variante."""
    return (codigo_var.strip().upper() + EXT) if partir(codigo_var) else ''


def ultimo_asignado(ruta=CONTADOR):
    """El último número de producto que se entregó, guardado aparte."""
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
    io.open(ruta, 'w', encoding='utf-8', newline='\r\n').write(
        '# El ultimo numero de codigo que se entrego. NO BAJA NUNCA.\n'
        '# Si este archivo se pierde, se reconstruye con el maximo del\n'
        '# catalogo, pero entonces se pierden los codigos de los productos\n'
        '# que se dieron de baja y se borraron: por eso no se borra ninguno.\n'
        '%d\n' % n)


def proxima_variante(codigo, idx):
    """El siguiente número de variante libre DENTRO de un producto. Tampoco
    se reusan: si el azul se deja de vender, su número no pasa al violeta."""
    n = 0
    for f in idx['por_codigo'].get(codigo) or []:
        v = (f.get('NumVar') or '').strip()
        if v.isdigit():
            n = max(n, int(v))
    return '%02d' % (n + 1)


# --------------------------------------------------------------------------
# Reconocer una fila de la planilla
# --------------------------------------------------------------------------

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
# alcanza con que aparezcan: hay que contarlas. "gen" no entra, porque el
# numero de generacion ya cuenta por su lado y la palabra aparece o no segun
# el dia ("AirPods Max 2 Gen" y "AirPods Max USB-C 2").
GAMA = ('pro', 'max', 'plus', 'air', 'ultra', 'mini', 'neo', 'fe', 'lite',
        'se', 'cellular', 'wifi', 'body', 'kit')
RE_MEDIDA = re.compile(r'^\d+(gb|tb|mm|in|ram|hz|mp|w)$|^\d+(\.\d+)?in$|^\d+$')

# El designador de modelo: letras y numeros pegados. "A37", "M4", "S26",
# "X730", "R8", "P2425HE". Es lo que separa un Galaxy A37 de un A36 y un
# iPad Air M4 de un M3, y sin contarlo el comparador daba esos pares como el
# mismo producto: le habria dado al A37 la foto del A36.
RE_MODELO = re.compile(r'^(?=.*[a-z])(?=.*\d)[a-z0-9]{2,}$')
# Lo que parece un modelo y es la conectividad. "Galaxy A57 8/128GB" y
# "Galaxy A57 8/128GB 5G" son el mismo telefono: el proveedor le agrego el 5G
# al nombre un martes.
NO_ES_MODELO = ('5g', '4g', '3g', '2g', 'lte', 'wifi6', 'wifi7', 'usbc', 'ipx8',
                'x1', 'x2', 'x3', 'x4', 'x5')

# La referencia del fabricante que a veces viene entre parentesis:
# "(601/1M52)", "(601ST350)", "(X730)". Tiene letras y numeros mezclados y
# no es un chip (M3, M3/M4, A18) ni un año.
RE_REFERENCIA = re.compile(r'^(?=.*\d)(?=.*[a-z])[a-z0-9][a-z0-9 /.\-]{2,}$')
RE_CHIP = re.compile(r'^[ma]\d{1,2}([/\-][ma]?\d{1,2})*$')


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
        # Y el 11/09 volvio a cambiar: "16GB/256GB" paso a "16/256GB", sin el
        # primer GB, y treinta filas dejaron de reconocerse. Los gigas se
        # cuentan por el numero y da igual como escriba la unidad. Los TB NO
        # se tocan: 1TB y 1GB son cosas muy distintas.
        p = re.sub(r'^(\d+)gb$', r'\1', p)
        # "Cell" y "Cellular" son la misma cosa. El equipo del sheet encontró
        # el hueco el 14/09: "Watch SE 3 44MM +Cell" (405) y "Watch SE 3 44MM"
        # (350) daban la misma firma, y los separaba el precio, no la firma.
        # Proponían sumar "cell" a GAMA, pero eso arregla sólo la mitad: deja
        # de reconocer al iPad Pro que ayer vino "Cell 5G LTE" y hoy "Cellular
        # 5G" — justo el que hubo que confirmar a mano ese día. Unificando las
        # dos palabras, el que agrega celular se separa y el que lo escribe
        # distinto se junta.
        if p == 'cell':
            p = 'cellular'
        # un año no distingue un producto de otro
        if re.match(r'^(19|20)\d\d$', p):
            continue
        if p and (p in GAMA or RE_MEDIDA.match(p)
                  or (RE_MODELO.match(p) and p not in NO_ES_MODELO)):
            cuenta[p] = cuenta.get(p, 0) + 1
    return tuple(sorted(cuenta.items()))


def referencias(nombre):
    """Las referencias de fábrica que trae el nombre entre paréntesis.

    Los cuatro Ray-Ban Meta Skyler comparten SKU y son cuatro anteojos
    distintos: lo único que los separa es "(601/T352)", "(T155 / S52)",
    "(601/1M52)" y "(601/CH52)". Sin esto quedaban los cuatro con el mismo
    código y la misma foto.
    """
    salida = set()
    for m in re.finditer(r'\(([^()]*)\)', nombre or ''):
        t = norm(m.group(1))
        if RE_REFERENCIA.match(t) and not RE_CHIP.match(t):
            salida.add(re.sub(r'[^a-z0-9]', '', t))
    return salida


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
    saca sólo el paréntesis que es TODO color; el de los Ray-Ban, que trae la
    referencia de fábrica, se conserva, porque ahí sí distingue un anteojo de
    otro.
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
    día que CEL-APP-085 deje de ser un iPhone y pase a ser un Samsung, el
    vínculo guardado le daría el código del iPhone y la ficha del Samsung
    mostraría la foto del iPhone: exactamente el error que todo esto existe
    para que no vuelva a pasar. Ante la duda no se resuelve, y la fila queda
    sin foto, que es el error barato.
    """
    if norm(fila.get('Marca')) != norm(entrada.get('Marca')):
        return False
    # La categoría también la escribe el proveedor, y también la cambia: el
    # 11/09 movió los cuatro extenders de "Lente" a "Accesorio Cámara" con el
    # nombre y el precio intactos. Como requisito duro, ese cambio bastaba
    # para desconocer el producto, que es el mismo error que usar el nombre
    # como identidad. Así que se compara contra todas las categorías en las
    # que se lo vio, igual que con los nombres.
    if norm(fila.get('Categoría') or fila.get('Categoria')) not in {
            norm(x) for x in categorias_de(entrada)}:
        return False
    a = fila.get('Descripción completa')
    # Contra cada nombre que tuvo el producto, entero: el del alta y todos
    # los que se le anotaron después. El 11/09 el proveedor le agregó "GEN2"
    # a los Ray-Ban y los siete dejaron de reconocerse. Que alcance con
    # pasar la comparación contra CUALQUIERA de sus nombres es lo que hace
    # que confirmarlo una vez a mano valga para siempre.
    return any(_mismo_nombre(fila, entrada, a, b, pinta, conocidos)
               for b in nombres_de(entrada))


def _mismo_nombre(fila, entrada, a, b, pinta=None, conocidos=None):
    """Un nombre de hoy contra un nombre conocido del producto."""
    # La firma dura manda: si cambió una capacidad, una medida o una palabra
    # de gama, es otro producto por más que el nombre se parezca.
    if firma_dura(a) != firma_dura(b):
        return False
    # Y la referencia de fábrica, cuando los dos la traen.
    ra, rb = referencias(a), referencias(b)
    if ra and rb and not (ra & rb):
        return False
    if (parecido(a, b) >= PARECIDO_MINIMO
            or parecido(sin_los_colores(a, pinta, conocidos),
                        sin_los_colores(b, pinta, conocidos)) >= PARECIDO_MINIMO):
        return True
    # El nombre se reescribió entero pero el precio no se movió: pasa cuando
    # el proveedor cambia cómo escribe toda una línea de productos.
    return mismo_precio(fila.get('Precio USD'), entrada.get('Precio_alta')) is True


def seguir_fusion(codigo, idx):
    """Si el código fue fusionado en otro, devuelve el que quedó vivo.

    Dos códigos para el mismo producto pasa: el producto se da de baja, vuelve
    con otro ID y otro nombre, y nadie lo reconoce. Cuando se descubre, en vez
    de borrar uno se lo marca con Fusionado_en y sus fotos siguen sirviendo.
    """
    visto = set()
    while codigo not in visto:
        visto.add(codigo)
        destino = next((f.get('Fusionado_en', '').strip().upper()
                        for f in (idx['por_codigo'].get(codigo) or [])
                        if (f.get('Fusionado_en') or '').strip()), '')
        if not destino or destino == codigo:
            return codigo
        codigo = destino
    return codigo


def codigo_de_la_fila(fila, idx, pinta=None, conocidos=None):
    """El código del PRODUCTO al que pertenece una fila de la planilla.

      1. La columna CODIGO, si la planilla ya la trae. Esto es lo que tiene
         que pasar siempre una vez que el sheet la mantenga.
      2. El vínculo guardado con el ID del alta, si además es el mismo
         producto (misma marca, misma categoría, misma firma dura).
      3. Lo mismo con el SKU del alta.
      4. Nada: o es un alta, o el vínculo ya no es de fiar. En los dos casos
         hace falta que una persona lo resuelva.

    Devuelve (codigo, de_donde). El "de dónde" sirve para avisar cuando se
    está resolviendo por el puente y no por la columna, y para distinguir un
    alta ('falta') de un vínculo que dejó de servir ('dudoso').

    Ojo con lo que NO hace: no devuelve la variante. La variante se lee de la
    fila de HOY. Si viajara con el vínculo, un producto que rota sus colores
    heredaría el de ayer: la fila que hoy vende White se quedaría con la foto
    Black porque así entró al catálogo. Medido contra la planilla del 09/09,
    eso pasaba en 113 filas.
    """
    dado = (fila.get('CODIGO') or '').strip().upper()
    if dado and RE_CODIGO.match(dado):
        return seguir_fusion(dado, idx), 'columna'
    dado = (fila.get('CODIGO_VAR') or '').strip().upper()
    if dado and partir(dado):
        return seguir_fusion(partir(dado)[0], idx), 'columna'
    hubo_candidatos = False
    for clave, donde in (((fila.get('ID') or '').strip(), 'id'),
                         ((fila.get('SKU') or '').strip(), 'sku')):
        if not clave:
            continue
        # Un producto dado de baja que reaparece con su mismo ID es el caso
        # MAS facil de reconocer, no uno para ignorar: en ocho dias, once
        # productos se fueron y volvieron. Si se lo excluye, vuelve como alta,
        # alguien le da un codigo nuevo y sus fotos se quedan esperando a
        # nadie, que es justo lo que el catalogo promete que no pasa.
        cands = idx['por_id' if donde == 'id' else 'por_sku'].get(clave) or []
        if not cands:
            continue
        hubo_candidatos = True
        # El SKU lo derivamos NOSOTROS del nombre, asi que dos productos
        # distintos que el proveedor escribe igual comparten SKU. Si esta
        # clave lleva a mas de un codigo, no identifica a nadie: lo unico
        # que queda para distinguirlos es la variante.
        cuantos = {seguir_fusion(c['CODIGO'], idx) for c in cands}
        codigos = {seguir_fusion(c['CODIGO'], idx)
                   for c in cands if es_el_mismo(fila, c, pinta, conocidos)
                   # El 11/09 los Ray-Ban Meta pasaron a llamarse todos
                   # "Rayban Meta GEN2 Wayfarer": el proveedor saco la
                   # referencia de fabrica, que era lo unico que los
                   # separaba. Por eso esta via, y solo esta, pide ademas
                   # que el precio cierre. El ID no lo necesita: ese lo pone
                   # el proveedor y no lo inventamos.
                   and (donde != 'sku' or mismo_precio(
                       fila.get('Precio USD'), c.get('Precio_alta')) is not False)}
        if len(codigos) == 1:
            unico = next(iter(codigos))
            # Y si el nombre ya no distingue, la variante tiene que hacerlo.
            # Sin esto, de los tres Wayfarer a 535, 595 y 605 dolares el
            # precio dejaba pasar uno solo y los TRES se llevaban su codigo:
            # dos de cada tres fichas con la foto del anteojo equivocado.
            # Quedarse corto sale una foto; equivocarse sale la de otro.
            if len(cuantos) > 1 and not variante_conocida(unico, fila, idx):
                continue
            return unico, donde
    return '', ('dudoso' if hubo_candidatos else 'falta')


def variante_de(codigo, texto, idx):
    """El código de la variante de un producto, a partir de como la escribe
    hoy la planilla. "" si esa variante todavia no esta en el catalogo, que
    es un aviso y no un nombre de archivo inventado: un color que no
    conocemos no puede estrenar un codigo, porque ese codigo seria el nombre
    de una foto que nadie saco."""
    if not codigo:
        return ''
    k = norm(texto)
    filas = idx['por_codigo'].get(codigo) or []
    if not k:
        sin_var = next((f for f in filas if not (f.get('NumVar') or '').strip()), None)
        return sin_var['CODIGO_VAR'] if sin_var else ''
    # Una variante dada de baja no compite por el nombre. Pasa cuando se
    # descubre que un texto no era un color nuevo sino otra forma de escribir
    # uno que ya estaba: la de mas se da de baja y su texto pasa a Escrituras
    # de la buena. Si la muerta siguiera respondiendo, la foto iria a un
    # numero que no se publica.
    vivas = [f for f in filas if not (f.get('Baja') or '').strip()]
    for f in vivas or filas:
        if k in escrituras_de(f):
            return f['CODIGO_VAR']
    return ''


def variante_por_partes(codigo, texto, idx):
    """La variante que ya existe, cuando hoy la escriben toda junta.

    Un anteojo es una sola cosa: montura y cristal. Cuando el proveedor
    escribia "Matte Black/Grey Transitions" se partia en dos variantes, y el
    11/09 paso a escribir "Matte Black . Grey Transitions", que no se parte:
    el mismo anteojo pedia estrenar un tercer numero al lado de los dos que
    ya tenia. Y ese numero es el nombre de la foto, asi que la que estaba
    colgada del primero se quedaba sin nadie que la pidiera.

    Si todas las partes del texto ya son variantes de este producto, esto no
    es una variante nueva sino otra forma de escribir la primera de ellas.
    Devuelve esa variante; "" si no aplica.
    """
    partes = [x.strip() for x in re.split(r'[/·]', texto or '') if x.strip()]
    if len(partes) < 2:
        return ''
    encontradas = [variante_de(codigo, x, idx) for x in partes]
    if not all(encontradas):
        return ''
    return min(encontradas)


def variantes_de_la_fila(fila):
    """Las variantes que vende hoy esa fila de la planilla.

    La barra separa opciones; el punto medio NO, que ahi va un solo objeto de
    dos tonos ("Matte Black . Grey Transitions" es un anteojo, no dos).
    """
    return [x.strip() for x in (fila.get('Color') or '').split('/') if x.strip()]


def variante_conocida(codigo, fila, idx):
    """Si alguna variante de hoy es una que ese producto ya tiene registrada.

    Sirve para desempatar cuando el nombre dejo de distinguir un producto de
    su hermano. Una fila sin colores no tiene con que desempatar: devuelve
    False, y el que llama decide no resolver, que es el lado barato.
    """
    for v in variantes_de_la_fila(fila):
        if variante_de(codigo, v, idx) or variante_por_partes(codigo, v, idx):
            return True
    return False


# --------------------------------------------------------------------------
# El mismo color escrito de otra forma
# --------------------------------------------------------------------------
# Como lo escribe el proveedor en castellano -> como esta en ingles. Vivia en
# colores-nuevos.py; paso aca el 29/09 porque altas-catalogo.py necesita la
# misma tabla: el Galaxy A36 tiene "lima" (AT-0511-02) y ADVAPP empezo a
# mandar "Lime", y la herramienta le iba a estrenar el AT-0511-07.
TRADUCCIONES = {'lima': 'lime', 'lavanda': 'lavender', 'negro': 'black',
                'blanco': 'white', 'azul': 'blue', 'rosa': 'pink', 'verde': 'green',
                'gris': 'gray', 'plata': 'silver', 'dorado': 'gold', 'violeta': 'violet'}
PARECIDO_COLOR = 0.85


def misma_escritura(a, b):
    """Si dos textos son el mismo color escrito distinto: iguales, uno la
    traduccion del otro, o casi iguales letra por letra ("lavander" y
    "Lavender" dan 0.88, "Pistacho" y "Pistachio" 0.94).

    Lo de letra por letra pide cinco letras o mas en los dos: con menos,
    "gre" (Green cortado, AT-0085-02) y "grey" dan 0.86 y son dos colores.
    """
    x, y = norm(a), norm(b)
    if not x or not y:
        return False
    if x == y or TRADUCCIONES.get(x) == y or TRADUCCIONES.get(y) == x:
        return True
    return (len(x) >= 5 and len(y) >= 5
            and difflib.SequenceMatcher(None, x, y).ratio() >= PARECIDO_COLOR)


def _palabras_sueltas(s):
    return ' ' + re.sub(r'[^a-z0-9]+', ' ', norm(s)).strip() + ' '


def variantes_vivas(codigo, idx):
    return [f for f in idx['por_codigo'].get(codigo) or []
            if not (f.get('Baja') or '').strip() and (f.get('NumVar') or '').strip()]


def variantes_parecidas(codigo, texto, idx):
    """Las variantes vivas de ese producto que parecen el mismo color que
    `texto` (misma_escritura contra el nombre o cualquiera de sus
    escrituras). Es la segunda red de altas-catalogo: lo que sale aca no se
    numera, se pregunta."""
    return [f['CODIGO_VAR'] for f in variantes_vivas(codigo, idx)
            if any(misma_escritura(texto, e) for e in escrituras_de(f))]


def se_parece_a(texto, codigo_var, idx):
    """Si `texto` es otra forma de escribir la variante `codigo_var`.

    Vale lo de misma_escritura, y ademas que el texto este ENTERO, palabra
    por palabra, adentro del nombre o de una escritura: "Natural" en
    "Natural Titanium", "Graphite Black" en "Graphite Black · Black Metal +
    Brown Leather". Pero eso solo si esta adentro de UNA sola variante del
    producto y es esa: en el Watch Ultra 3 "Black" esta adentro de "Black
    Alpine Loop M" y de "Black Ocean Band", que son la caja con dos mallas
    distintas, y ahi no hay forma de saber cual es.
    """
    f = idx['por_var'].get(codigo_var)
    if not f or (f.get('Baja') or '').strip():
        return False
    if any(misma_escritura(texto, e) for e in escrituras_de(f)):
        return True
    t = _palabras_sueltas(texto)
    if len(t.strip()) < 3:
        return False
    donde = [x for x in variantes_vivas(f['CODIGO'], idx)
             if any(t in _palabras_sueltas(e) for e in escrituras_de(x))]
    return len(donde) == 1 and donde[0] is f


# --------------------------------------------------------------------------
# Otra capacidad del mismo modelo, y el CODIGO de otro producto
# --------------------------------------------------------------------------
# La regla vive ACA y es una sola (29/09). Decide si la columna CODIGO de
# ADVAPP, cuando no es la que da el puente, es otra memoria del mismo modelo
# (Pedro, 26/09: se ve igual, la foto del hermano esta bien y no se pide) o
# el codigo de otro producto (se pide).
#
# Hasta el 29/09 habia tres copias que decian ser "la misma regla" y no lo
# eran. herramientas/pedido-advapp.py le habia sumado memoria_distinta() a
# su mismo_modelo() y la de aca no la tenia. Y la Sim del producto que trae
# la columna se leia del NOMBRE del maestro aca y en el pedido, y del SKU de
# las filas de hoy en verificar-fotos.py: el iPhone 17 Pro 512GB E-Sim con
# AT-0071 (que es el 1TB E-Sim, pero en el maestro se llama "iPhone 17 Pro
# 1TB (Silver/Orange)" y no dice la Sim) salia en REVISAR-FOTOS como otra
# memoria que no se pide, en revisar-catalogo como DISCREPAN y en el pedido
# a ADVAPP como CODIGO DE OTRO PRODUCTO, con un comentario aca que juraba
# que las tres decian lo mismo.
#
# Quien tenga que decidirlo llama a choque_de_codigo() con sim_tec_de_hoy().
# Si en otra herramienta aparece una copia de estas funciones, la que sobra
# es la copia: se reemplaza por un alias (mismo_modelo = CM.mismo_modelo) y
# no se corrige a mano, porque dos copias se separan solas. La Sim y el
# teclado se leen del SKU como la web (simDelSku y tecladoDelSku de
# index.html) y como pruebas/codigos.js, seccion 8.

def capacidad(texto):
    """La memoria de guardado que dice un nombre: la ULTIMA cifra con GB o TB
    ("8/256GB" -> 256GB, "12GB/256GB" -> 256GB, "16GB/1TB" -> 1TB). None si
    no dice ninguna. Es lo que distingue un codigo de otra capacidad de un
    nombre escrito distinto: "Galaxy S25 FE 8/256GB" y "Galaxy S25 FE 256GB"
    son el mismo producto (medido el 26/09: comparar nombres enteros daba 60
    falsos)."""
    m = re.findall(r'(\d+)\s*(GB|TB)\b', texto or '', re.I)
    return (m[-1][0] + m[-1][1].upper()) if m else None


def ram_y_disco(texto):
    """(RAM, disco) de un nombre: "8GB/256GB" -> (8, '256GB'), "12/512GB" ->
    (12, '512GB'), "16ram 512gb" -> (16, '512GB'), "256GB" -> (None, '256GB').
    La RAM es la primera cifra de "X/Y"; el disco, capacidad()."""
    t = texto or ''
    m = (re.search(r'\b(\d+)\s*(?:gb|g|ram)?\s*/\s*\d+\s*(?:gb|tb)\b', t, re.I)
         or re.search(r'\b(\d+)\s*(?:gb\s*)?ram\b', t, re.I))
    return (int(m.group(1)) if m else None), capacidad(t)


def memoria_distinta(a, b):
    """Si dos nombres dicen memorias distintas: otro disco, o otra RAM cuando
    los dos la dicen. Sin memoria en alguno de los dos no se puede afirmar."""
    (ra, da), (rb, db) = ram_y_disco(a), ram_y_disco(b)
    if not da or not db:
        return False
    return da != db or (ra is not None and rb is not None and ra != rb)


def modelo_sin_variables(texto, marca=''):
    """El nombre sin lo que no se ve en la foto: colores entre parentesis,
    memoria, RAM y la conectividad."""
    t = re.sub(r'\([^)]*\)', ' ', texto or '')
    t = re.sub(r'\b\d+\s*(?:gb|tb|g|ram)?\s*/\s*\d+\s*(?:gb|tb)\b', ' ', t, flags=re.I)
    t = re.sub(r'\b\d+\s*(?:gb|tb)\b', ' ', t, flags=re.I)
    t = re.sub(r'\b(?:5g|4g)\b', ' ', t, flags=re.I)
    t = re.sub(r'\be-?\s?sim\b|\bsim\b|\bsin cargador\b|\bcon cargador\b', ' ', t, flags=re.I)
    if marca:
        t = re.sub(r'\b' + re.escape(marca) + r'\b', ' ', t, flags=re.I)
    return ' '.join(sorted(set(norm(t).replace('"', ' ').split())))


def _producto(codigo, idx):
    return ((idx['por_codigo'].get(codigo) or [{}])[0].get('Producto') or '')


def mismo_modelo(fila, codigo, idx):
    """La fila y el producto `codigo` son el mismo modelo con OTRA memoria.

    Pedro, 26/09/2026: el mismo modelo con otra memoria se ve igual, asi que
    la foto del hermano no es un error. Solo cuenta si el resto del nombre
    coincide: el Redmi Note 15 Pro no es el Pro Plus, y ahi la foto si seria
    de otro producto.

    Y la memoria tiene que ser distinta de verdad (29/09). Sin eso, dos
    productos que se diferencian solo por lo que va entre parentesis pasaban
    como "otra capacidad": el Watch Ultra 3 con malla Ocean y el de malla
    Milanese dan los dos "3 49mm ultra watch", y el dia que el puente
    reconozca la fila Ocean que trae AT-0456 (el Milanese) se la iba a dar
    por buena en vez de pedirla. La RAM cuenta: el Galaxy A56 8/256 con el
    codigo del 12/256 sigue siendo otra capacidad, como decidio Pedro."""
    marca = fila.get('Marca') or ''
    desc = fila.get('Descripción completa') or ''
    prod = _producto(codigo, idx)
    return (modelo_sin_variables(desc, marca) == modelo_sin_variables(prod, marca)
            and memoria_distinta(desc, prod))


def sim_de(texto):
    t = (texto or '').lower()
    return 'esim' if re.search(r'\be-?\s?sim\b', t) else 'sim' if re.search(r'\bsim\b', t) else ''


def otra_capacidad(fila, codigo, idx):
    """El producto `codigo` del maestro dice otra capacidad que la fila."""
    a = capacidad(fila.get('Descripción completa'))
    b = capacidad(_producto(codigo, idx))
    return bool(a and b and a != b)


def teclado_de(sku):
    """ES o EN, del SKU ("...-tecladoes"). '' si no lo dice. El teclado
    separa productos (Pedro, 26/09), igual que Sim y eSIM."""
    m = re.search(r'teclado(es|en)\b', sku or '', re.I)
    return m.group(1).lower() if m else ''


def conectividad(*textos):
    """'cell' si algun texto dice 5G, 4G, LTE o Cellular; 'wifi' si solo dice
    Wifi; '' si no dice nada. En un celular no separa nada (todos tienen
    red), pero una tablet Wifi y una 5G son dos productos: el Galaxy Tab A11+
    Wifi (AT-0488) y el 5G (AT-0487) dan la misma firma dura, porque "5G" no
    cuenta a proposito ("Galaxy A57" y "Galaxy A57 5G" son el mismo)."""
    t = ' ' + re.sub(r'[^a-z0-9]+', ' ', ' '.join(norm(x) for x in textos if x)) + ' '
    if re.search(r' (5g|4g|lte|cell|cellular) ', t):
        return 'cell'
    return 'wifi' if ' wifi ' in t else ''


def mismo_producto_de_verdad(fila, entrada, pinta=None, conocidos=None):
    """es_el_mismo(), y ademas mismo Sim/eSIM, mismo teclado y misma
    conectividad (cuando los dos la dicen): cosas que la firma dura no cuenta
    y que separan productos (Pedro, 26/09: Sim y eSIM, teclado ES y EN)."""
    if not es_el_mismo(fila, entrada, pinta, conocidos):
        return False
    if sim_de(fila.get('Descripción completa')) != sim_de(entrada.get('Producto')):
        return False
    ta = teclado_de(fila.get('SKU'))
    tb = {teclado_de(s) for s in todos(entrada, 'SKU_alta')} - {''}
    if ta and tb and ta not in tb:
        return False
    ca = conectividad(fila.get('Descripción completa'), fila.get('SKU'))
    cb = conectividad(*(nombres_de(entrada) + todos(entrada, 'SKU_alta')))
    return not (ca and cb and ca != cb)


def sim_del_sku(s):
    """simDelSku() de index.html: 'E-Sim', 'Sim' o '' segun como TERMINA el
    SKU ("...~512gb-esim", "...-sim")."""
    x = (s or '').lower()
    return 'E-Sim' if re.search(r'[-~]e-?sim$', x) else 'Sim' if re.search(r'[-~]sim$', x) else ''


def teclado_del_sku(s):
    """tecladoDelSku() de index.html: 'ES', 'EN' o '' ("...-tecladoes")."""
    m = re.search(r'[-~]teclado(es|en)$', (s or '').lower())
    return m.group(1).upper() if m else ''


def sim_tec(fila):
    """La Sim y el teclado de una fila de ADVAPP, leidos SOLO de su SKU, como
    pruebas/codigos.js: "E-Sim/-", "Sim/-", "-/ES", "-/-"."""
    s = (fila.get('SKU') or '').strip()
    return (sim_del_sku(s) or '-') + '/' + (teclado_del_sku(s) or '-')


def puente_de(fila, idx, pinta=None, conocidos=None):
    """El codigo que le da el catalogo a la fila SIN mirar las columnas: con
    ellas, codigo_de_la_fila() devuelve la misma columna y no puede discrepar
    nunca (asi decia revisar-catalogo "0 DISCREPAN" hasta el 29/09)."""
    return codigo_de_la_fila(dict(fila, CODIGO='', CODIGO_VAR=''), idx, pinta, conocidos)[0]


def sim_tec_de_hoy(filas, idx, pinta=None, conocidos=None):
    """codigo -> {sim_tec} de las filas de HOY que llevan ese codigo en la
    columna CODIGO y a las que el puente les da ese mismo codigo: las que el
    codigo "tiene de verdad". Se arma UNA vez con todas las filas de ADVAPP
    (las que muestra la web) y se le pasa a choque_de_codigo().

    Existe porque el nombre del maestro no siempre dice la Sim (29/09):
    AT-0071 se llama "iPhone 17 Pro 1TB (Silver/Orange)", pero las filas que
    lo llevan de verdad son las 1TB E-Sim. Leyendo el nombre, el 512 E-Sim
    con AT-0071 era "eSIM contra nada" y se pedia; leyendo estas filas es
    otra memoria con la misma Sim, que es lo que decidio Pedro el 26/09 que
    no se pide."""
    salida = {}
    for f in filas:
        dado = (f.get('CODIGO') or '').strip().upper()
        if not RE_CODIGO.match(dado):
            continue
        if puente_de(f, idx, pinta, conocidos) == dado:
            salida.setdefault(dado, set()).add(sim_tec(f))
    return salida


def sim_tec_del_maestro(codigo, idx):
    """({sims}, {teclados}) que dice el producto en el maestro, en sus SKU y
    en sus nombres (las variantes vivas). Conjuntos vacios si no dice nada.
    Es el paso 5 de verificar-fotos.py: se usa cuando ninguna fila de hoy
    lleva ese codigo de verdad."""
    entradas = idx['por_codigo'].get(codigo) or []
    vivas = [m for m in entradas if not (m.get('Baja') or '').strip()] or entradas
    skus = {s for m in vivas for s in todos(m, 'SKU_alta')}
    nombres = {n for m in vivas for n in nombres_de(m)}
    sims = {sim_del_sku(s) for s in skus}
    sims |= {('E-Sim' if re.search(r'\be-?\s?sim\b', n, re.I) else 'Sim')
             for n in nombres if re.search(r'\b(e-?\s?)?sim\b', n, re.I)}
    tecs = {teclado_del_sku(s) for s in skus}
    tecs |= {m.group(1).upper() for m in (re.search(r'\bteclado\s+(es|en)\b', n, re.I)
                                          for n in nombres) if m}
    return sims - {''}, tecs - {''}


def misma_sim_y_teclado(fila, codigo, idx, hoy=None):
    """Si la fila vende la misma Sim y el mismo teclado que el producto
    `codigo` (Pedro, 26/09: Sim y eSIM, teclado ES y EN, son productos
    distintos). La fila se lee de su SKU. El producto, en este orden:
      1. las filas de hoy que lo llevan de verdad (`hoy`, de sim_tec_de_hoy):
         alguna tiene que decir exactamente lo mismo que la fila;
      2. si hoy no hay ninguna, lo que dicen sus SKU y sus nombres en el
         maestro. Lo que el maestro no dice no contradice a nadie.
    Es lo mismo que hacen pruebas/codigos.js (seccion 8) y verificar-fotos.py.
    """
    mia = sim_tec(fila)
    suyas = (hoy or {}).get(codigo)
    if suyas:
        return mia in suyas
    sims, tecs = sim_tec_del_maestro(codigo, idx)
    s, t = mia.split('/')
    return not ((sims and s not in sims) or (tecs and t not in tecs))


def choque_de_codigo(fila, idx, pinta=None, conocidos=None, hoy=None):
    """Si la columna CODIGO de ADVAPP dice otro producto que el puente. Es LA
    regla (ver el comentario de arriba de capacidad()): revisar-catalogo.py,
    r_codigo de pedido-advapp.py y los choques de verificar-fotos.py tienen
    que decir lo mismo que esta, y la manera de que lo digan es llamarla.

    Devuelve (dado, puente, tipo). tipo es:
      ''                sin columna, sin puente, o la columna es el puente;
      'otra-capacidad'  el mismo modelo con otra memoria de verdad
                        (mismo_modelo) y la misma Sim y el mismo teclado
                        (misma_sim_y_teclado). Pedro, 26/09: misma foto, no
                        se pide;
      'choque'          todo lo demas, tambien un codigo que el maestro no
                        tiene. Se pide.

    `hoy` es sim_tec_de_hoy() de las filas de ADVAPP, armado una vez. Sin el
    se decide solo contra el maestro, como cuando hoy ninguna fila lleva ese
    codigo, y ahi un producto cuyo maestro no dice la Sim no contradice a
    nadie: el 17 Pro 256 Sim con AT-0071 pasaria por otra capacidad si
    AT-0071 no tuviera anotado su SKU "-esim". Por eso quien decide con las
    filas de ADVAPP en la mano le pasa `hoy`.

    La columna se compara tal cual viene, sin seguir Fusionado_en (29/09),
    igual que r_codigo y pruebas/codigos.js. La web no sigue fusiones
    (codigoDeLaFila devuelve la columna tal cual) y su mapa de variantes va
    por el codigo vivo: con un codigo fusionado en la columna no encuentra
    ninguna variante y busca la foto sin variante del codigo muerto, que casi
    nunca existe. Eso se pide.

    Una fila SIN columna y con puente devuelve '': no es un choque sino un
    codigo que falta, y r_codigo lo pide por su lado."""
    dado = (fila.get('CODIGO') or '').strip().upper()
    puente = puente_de(fila, idx, pinta, conocidos)
    if not dado or not puente or puente == dado:
        return dado, puente, ''
    if (dado in idx['por_codigo'] and mismo_modelo(fila, dado, idx)
            and misma_sim_y_teclado(fila, dado, idx, hoy)):
        return dado, puente, 'otra-capacidad'
    return dado, puente, 'choque'


def firma_de_producto(marca, categoria, nombre):
    """La huella de un producto, para que la web pueda verificar un vinculo
    sin repetir todo el comparador. Marca, categoria y la firma dura."""
    return '%s|%s|%s' % (norm(marca), norm(categoria),
                         ','.join('%s:%d' % x for x in firma_dura(nombre)))


def mapa_para_la_web(filas, idx=None):
    """Lo que la web necesita para llegar del producto de la planilla al
    nombre de su foto, sin poder correr Python.

    Va adentro de fotos/indice.json y se regenera en cada publicacion. Lleva
    la firma de cada producto justamente para que un vinculo viejo no alcance:
    si la planilla reutiliza un ID para otra cosa, la firma no coincide, la
    web no usa ese codigo y el producto sale sin foto. Sin foto es barato;
    con la foto de otro producto es el error que venimos arreglando.

    Cada producto va con TODAS sus claves y TODAS sus firmas, una por cada
    nombre y cada categoria en que se lo vio. Si fuera una sola, la web
    desconoceria justo los productos que alguien ya se tomo el trabajo de
    confirmar a mano: el dia que el proveedor reescribe el nombre, el
    catalogo lo reconoce y la web no, y la ficha sale sin foto igual.
    """
    idx = idx or indexar(filas)
    ids, skus, firmas, variantes = {}, {}, {}, {}
    for f in filas:
        if (f.get('Baja') or '').strip():
            continue
        cod = seguir_fusion(f['CODIGO'], idx)
        for i in todos(f, 'ID_alta'):
            ids.setdefault(i, set()).add(cod)
        for s in todos(f, 'SKU_alta'):
            skus.setdefault(s, set()).add(cod)
        # Se SUMAN las de todas sus variantes, no se pisan: lo aprendido
        # queda anotado en la fila que estaba el dia que alguien lo confirmo,
        # y las hermanas que se agreguen despues siguen teniendo el nombre
        # viejo. Pisando, la ultima fila borraba lo que sabia la primera.
        firmas.setdefault(cod, set()).update(
            firma_de_producto(f.get('Marca'), cat, nom)
            for cat in categorias_de(f)
            for nom in nombres_de(f))
        if f.get('NumVar'):
            tabla = variantes.setdefault(cod, {})
            for e in escrituras_de(f):
                tabla[e] = f['CODIGO_VAR']
        else:
            variantes.setdefault(cod, {})[''] = f['CODIGO_VAR']
    # Una clave que lleva a MAS DE UN codigo no identifica a nadie, asi que
    # no entra en el mapa. Antes se guardaba una sola por clave y la ultima
    # pisaba a las demas: el 11/09 el proveedor saco la referencia de fabrica
    # de los Ray-Ban y siete anteojos quedaron compartiendo dos SKU. La web
    # les habria dado a todos el codigo del ultimo hermano, o sea la foto del
    # anteojo equivocado en seis de siete fichas. Se van sin foto, que es el
    # error que se arregla al dia siguiente en vez del que nadie ve.
    solo = lambda d: {k: next(iter(v)) for k, v in d.items() if len(v) == 1}
    return {'ids': solo(ids), 'skus': solo(skus), 'vars': variantes,
            'firmas': {k: sorted(v) for k, v in firmas.items()}}


def variante_sin_color(codigo, nombre, idx, colores_conocidos=()):
    """La variante de una fila que no trae color, deducida del nombre.

    La misma regla que varianteSinColor() en index.html: si se cambia aca, se
    cambia alla. Devuelve una variante SOLO si es inequivoca:
      1. el nombre nombra una sola variante del producto ("Space Black" gana
         sobre "Black" cuando estan las dos), o
      2. no nombra ninguna, el producto tiene una sola variante viva, y el
         nombre no menciona otro color.
    El 15/09 eran 18 fichas con la foto cargada por color y la fila sin color,
    que buscaban la foto sin variante y mostraban el logo.
    """
    if not codigo:
        return ''
    palabras = lambda s: ' ' + re.sub(r'[^a-z0-9]+', ' ', norm(s or '')).strip() + ' '
    t = palabras(nombre)
    tabla = {}
    for f in idx['por_codigo'].get(codigo) or []:
        if (f.get('Baja') or '').strip() or not (f.get('NumVar') or '').strip():
            continue
        for e in escrituras_de(f):
            if len(palabras(e).strip()) >= 3:
                tabla[e] = f['CODIGO_VAR']
    hallados = [k for k in tabla if palabras(k) in t]
    hallados = [k for k in hallados if not any(o != k and palabras(k) in palabras(o) for o in hallados)]
    cods = {tabla[k] for k in hallados}
    if cods:
        return next(iter(cods)) if len(cods) == 1 else ''
    vivas = set(tabla.values())
    if len(vivas) != 1:
        return ''
    if any(len(palabras(c).strip()) >= 3 and palabras(c) in t for c in colores_conocidos):
        return ''
    return next(iter(vivas))


RE_VARIANTE = re.compile(r'^AT-\d{4}-\d{2}$')
_TALLE = re.compile(r'^(x{0,2}s|m|x{0,2}l)$', re.I)


def partir_colores(txt):
    """Igual que partirColores() en index.html (y que validar.partir_colores):
    la barra separa colores, salvo cuando lo que sigue es un talle."""
    salida = []
    for t in [x.strip() for x in (txt or '').split('/') if x.strip()]:
        if salida and _TALLE.match(t):
            salida[-1] += '/' + t
        else:
            salida.append(t)
    return salida


def _tabla_web(codigo, idx):
    """CATALOGO.vars[codigo] tal como lo arma mapa_para_la_web(): escritura ->
    variante, sin las dadas de baja, y la ultima gana si dos dicen lo mismo."""
    tabla = {}
    for k, filas in idx['por_codigo'].items():
        if k != codigo and seguir_fusion(k, idx) != codigo:
            continue
        for f in filas:
            if (f.get('Baja') or '').strip():
                continue
            if f.get('NumVar'):
                for e in escrituras_de(f):
                    tabla[e] = f['CODIGO_VAR']
            else:
                tabla[''] = f['CODIGO_VAR']
    return tabla


def celda_de_la_columna(fila, color, propios):
    """Lo que dice CODIGO_VAR para ese color, crudo: '' si la celda no esta
    alineada con los colores de la fila o si ese color no esta entre ellos."""
    # Sin pasar a mayusculas, igual que la web: una celda en minusculas no
    # tiene la forma AT-####-NN y alla no se usa.
    lista = [x.strip() for x in (fila.get('CODIGO_VAR') or '').split('/')]
    if not (fila.get('CODIGO_VAR') or '').strip() or not propios or len(lista) != len(propios):
        return ''
    i = next((j for j, c in enumerate(propios) if norm(c) == norm(color)), -1)
    return lista[i] if i != -1 else ''


def variante_de_la_columna(fila, codigo, color, idx, propios):
    """La variante que manda ADVAPP en CODIGO_VAR para ese color. Copia al pie
    de la letra de varianteDeLaColumna() en index.html: si se cambia alla, se
    cambia aca (y los CASOS_COLUMNA de abajo lo controlan en las dos puntas).

    `propios` son los colores de ESA fila como los ve la web (colorDeLaFila,
    que en Python es fotos_sku.colores_de_la_fila), no los que pide quien
    llama. Vale solo si la celda esta alineada, el codigo es de este producto
    y tiene la forma AT-####-NN, la variante esta viva, no es la que el
    catalogo le da a OTRO color de la misma fila, ni contradice al maestro
    cuando este tiene la escritura exacta de ESE color. Si algo no cierra, ''.

    Existe desde el 29/09: los informes de Python predecian la foto solo por
    el texto del color, y la web prueba primero esta celda. Con "Lime" y el
    maestro diciendo "lima", Python decia "sin foto" y la web mostraba
    AT-0511-02: nueve fichas mal contadas en el informe de todos los dias.
    """
    if not codigo or not (fila.get('CODIGO_VAR') or '').strip():
        return ''
    v = celda_de_la_columna(fila, color, propios)
    if not v or not v.startswith(codigo + '-') or not RE_VARIANTE.match(v):
        return ''
    tabla = _tabla_web(codigo, idx)
    if v not in tabla.values():
        return ''
    i = next(j for j, c in enumerate(propios) if norm(c) == norm(color))
    if any(j != i and tabla.get(norm(c), '') == v for j, c in enumerate(propios)):
        return ''
    # Y que no contradiga al maestro para ESTE mismo color (29/09): si el mapa
    # tiene la escritura exacta con otra variante, decide el mapa. El Watch
    # Ultra 3 "Natural – Blue Trail Loop M/L" traia la Ocean Band (AT-0455-05)
    # en la celda y el maestro dice AT-0455-03.
    exacta = tabla.get(norm(color), '')
    if exacta and exacta != v:
        return ''
    return v


def foto_de_advapp(fila, propios):
    """La foto de ADVAPP que la web usa de respaldo para la portada. Copia de
    fotoDeAdvapp() en index.html: el color se ubica por su posicion en
    CODIGO_VAR y esa variante por el `at` de la columna SKUS. '' si no hay.
    Sirve para separar, en los informes, la ficha que el cliente ve con el
    logo de la que ve con una foto que nadie de aca miro."""
    try:
        skus = json.loads(fila.get('SKUS') or '[]')
    except ValueError:
        return ''
    fotos = {}
    for s in skus if isinstance(skus, list) else []:
        at = str((s or {}).get('at') or '').strip().upper() if isinstance(s, dict) else ''
        lst = (s or {}).get('fotos') if isinstance(s, dict) else None
        url = str(lst[0] or '') if isinstance(lst, list) and lst else ''
        if at and url.startswith('http') and at not in fotos:
            fotos[at] = url
    if not fotos:
        return ''
    ats = list(fotos)
    if not propios:
        return fotos.get((fila.get('CODIGO') or '').strip().upper()) or (fotos[ats[0]] if len(ats) == 1 else '')
    cvs = [x.strip().upper() for x in (fila.get('CODIGO_VAR') or '').split('/')]
    for i in range(len(propios)):
        cv = cvs[i] if len(cvs) == len(propios) else ''
        if cv and cv in fotos:
            return fotos[cv]
    return fotos[ats[0]] if len(propios) == 1 and len(ats) == 1 else ''


def candidatos_foto(codigo, textos_de_hoy, idx, nombre='', colores_conocidos=(),
                    fila=None, propios=None):
    """Los archivos que la web prueba para la portada de una fila, en orden
    (nombresDeFoto en index.html): para cada color que vende hoy, primero la
    variante que dice la columna CODIGO_VAR y si no la del texto del color;
    despues el producto sin variante, y si la fila no trae color, la
    variante que el nombre deja clara (variante_sin_color).

    La columna se prueba solo si quien llama pasa la `fila` (y `propios`, los
    colores de la fila como los ve la web; por omision, textos_de_hoy). Sin
    fila queda como antes del 29/09, para no cambiarle el resultado a nadie
    sin que lo pida."""
    if not codigo:
        return []
    propios = textos_de_hoy if propios is None else propios
    salida = [(variante_de_la_columna(fila, codigo, t, idx, propios or []) if fila else '')
              or variante_de(codigo, t, idx) for t in (textos_de_hoy or [])]
    # El producto sin variante no va si la fila dice un color que no resolvio
    # y el producto no tiene NINGUNA variante (29/09): esa foto no tiene color
    # anotado. El Galaxy Tab A11+ Gray salia con AT-0488.jpg, la plateada.
    # Misma regla en nombresDeFoto() de index.html.
    tabla = _tabla_web(codigo, idx)
    sin_variantes = bool(tabla) and all(k == '' for k in tabla)
    if not (textos_de_hoy and not any(salida) and sin_variantes):
        salida.append(variante_de(codigo, '', idx) or codigo)
    if not textos_de_hoy:
        salida.append(variante_sin_color(codigo, nombre, idx, colores_conocidos))
    vistos, out = set(), []
    for n in salida:
        if n and n not in vistos:
            vistos.add(n)
            out.append(n)
    return out


# Los casos de varianteDeLaColumna(). Van en JSON a proposito: la tanda
# pruebas/guardas-t1-maestro-altas.js los lee de ESTE archivo y los corre
# contra la web, y probar_columna() los corre contra la copia de aca. Si una
# de las dos puntas cambia la regla sin la otra, salta la prueba de la que
# quedo atras. Cada caso: colores de la fila, color pedido, celda CODIGO_VAR,
# codigo del producto, lo que tiene que dar, y por que.
CASOS_COLUMNA = r'''
{"vars": {"AT-9001": {"black": "AT-9001-01", "lima": "AT-9001-02", "white": "AT-9001-03"},
          "AT-9002": {"black": "AT-9002-01"}},
 "muertas": {"AT-9001-04": "violet"},
 "casos": [
  ["Lime", "Lime", "AT-9001-02", "AT-9001", "AT-9001-02", "ADVAPP dice la variante aunque el texto no este anotado (Lime/lima, 29/09)"],
  ["Black/White", "White", "AT-9001-01/AT-9001-03", "AT-9001", "AT-9001-03", "alineada: cada color con el suyo"],
  ["Black/White", "White", "AT-9001-03", "AT-9001", "", "corrida: menos codigos que colores"],
  ["Black/White", "Black", "AT-9001-03/AT-9001-01", "AT-9001", "", "dada vuelta: es la de otro color de la fila"],
  ["Black", "Black", "AT-9001-03", "AT-9001", "", "el maestro tiene ESTE texto en otra variante: manda el mapa (Trail Loop del Ultra 3, 29/09)"],
  ["Black", "Black", "AT-9002-01", "AT-9001", "", "de otro producto (el Ultra 3 Ocean Band del 29/09)"],
  ["Violet", "Violet", "AT-9001-04", "AT-9001", "", "dada de baja"],
  ["Pink", "Pink", "AT-9001-07", "AT-9001", "", "no existe en el maestro"],
  ["Black", "Black", "AT-9001-1", "AT-9001", "", "sin la forma AT-####-NN"],
  ["Black/White", "White", "/AT-9001-03", "AT-9001", "AT-9001-03", "la posicion vacia se mantiene"],
  ["Black/White", "Red", "AT-9001-01/AT-9001-03", "AT-9001", "", "un color que la fila no vende"],
  ["Midnight Sport Band M/L", "Midnight Sport Band M/L", "AT-9001-02", "AT-9001", "AT-9001-02", "el talle no parte la celda"]
 ]}
'''


def probar_columna():
    """Corre CASOS_COLUMNA contra variante_de_la_columna. Devuelve las fallas."""
    datos = json.loads(CASOS_COLUMNA)
    filas = []
    for cod, tabla in datos['vars'].items():
        por_var = {}
        for k, cv in tabla.items():
            por_var.setdefault(cv, []).append(k)
        for cv, ks in por_var.items():
            filas.append({'CODIGO': cod, 'CODIGO_VAR': cv, 'NumVar': cv[-2:],
                          'Variante': ks[0], 'Escrituras': juntar(ks[1:])})
    for cv, texto in datos['muertas'].items():
        filas.append({'CODIGO': cv[:7], 'CODIGO_VAR': cv, 'NumVar': cv[-2:],
                      'Variante': texto, 'Escrituras': '', 'Baja': '2026-09-01'})
    idx = indexar(filas)
    fallas = []
    for colores, color, celda, cod, espera, porque in datos['casos']:
        da = variante_de_la_columna({'Color': colores, 'CODIGO_VAR': celda}, cod, color,
                                    idx, partir_colores(colores))
        if da != espera:
            fallas.append('%s: dio %r y tenia que dar %r' % (porque, da, espera))
    return fallas


# Los casos de choque_de_codigo(), armados a mano (29/09). Codigos AT-9xxx
# para que no se confundan con los de verdad; los nombres y los SKU, como los
# manda ADVAPP. Salen de la auditoria del 29/09: el 17 Pro 512 E-Sim con
# AT-0071 (que las tres herramientas daban distinto), el Ultra 3 Ocean con el
# codigo del Milanese y el MacBook Neo ES con el del EN (que aca se daban por
# otra capacidad). Estan como datos para que pedido-advapp.py --probar y
# verificar-fotos.py los puedan correr contra lo suyo mientras tengan copias.
#
# Maestro: codigo, categoria, marca, producto, ID y SKU del alta, precio del
# alta y en que codigo se fusiono.
MAESTRO_CHOQUES = [
    ('AT-9071', 'Celular', 'Apple', 'iPhone 17 Pro 1TB (Silver/Orange)', 'P17-1TB-ESIM',
     'celular~apple~17-iphone-pro~1tb', '1900', ''),
    ('AT-9072', 'Celular', 'Apple', 'iPhone 17 Pro 256GB E-Sim (Blue)', 'P17-256-ESIM',
     'celular~apple~17-iphone-pro~256gb-esim', '1500', ''),
    ('AT-9073', 'Celular', 'Apple', 'iPhone 17 Pro 512GB E-Sim (Blue)', 'P17-512-ESIM',
     'celular~apple~17-iphone-pro~512gb-esim', '1700', ''),
    ('AT-9535', 'Celular', 'Apple', 'iPhone 17 Pro 256GB Sim (Blue)', 'P17-256-SIM',
     'celular~apple~17-iphone-pro~256gb-sim', '1500', ''),
    ('AT-9537', 'Celular', 'Apple', 'iPhone 17 Pro 1TB Sim (Blue)', 'P17-1TB-SIM',
     'celular~apple~17-iphone-pro~1tb-sim', '1950', ''),
    ('AT-9432', 'Notebook', 'Apple', 'MacBook Neo A18 13" 8GB/256GB (Indigo)', 'NEO-256-EN',
     'notebook~apple~a18-macbook-neo~13in-8gb-256gb-tecladoen', '1000', ''),
    ('AT-9433', 'Notebook', 'Apple', 'MacBook Neo A18 13" 8GB/256GB (Silver)', 'NEO-256-ES',
     'notebook~apple~a18-macbook-neo~13in-8gb-256gb-tecladoes', '1000', ''),
    ('AT-9434', 'Notebook', 'Apple', 'MacBook Neo A18 13" 8GB/512GB (Blush)', 'NEO-512-EN',
     'notebook~apple~a18-macbook-neo~13in-8gb-512gb-tecladoen', '1200', ''),
    ('AT-9455', 'Smartwatch', 'Apple', 'Watch Ultra 3 49mm (Black/Black Alpine Loop M)', 'U3-OCEAN',
     'smartwatch~apple~3-ultra-watch~49mm-m-49-cell-ocean', '900', ''),
    ('AT-9456', 'Smartwatch', 'Apple', 'Watch Ultra 3 49mm (Black/Black Milanese Loop L)', 'U3-MILANESE',
     'smartwatch~apple~3-ultra-watch~49mm-l-49-cell-mill', '1000', ''),
    ('AT-9086', 'Celular', 'Samsung', 'Galaxy A56 12/256GB (Black)', 'A56-12-256',
     'celular~samsung~a56-galaxy~12gb-256gb', '450', ''),
    ('AT-9087', 'Celular', 'Samsung', 'Galaxy A56 8/256GB (Black)', 'A56-8-256',
     'celular~samsung~a56-galaxy~8gb-256gb', '400', ''),
    ('AT-9200', 'Tablet', 'Samsung', 'Galaxy Tab S10 FE 8/128GB (Gray)', 'TAB-S10FE-VIEJO',
     'tablet~samsung~s10-fe-galaxy-tab~8gb-128gb-viejo', '500', 'AT-9201'),
    ('AT-9201', 'Tablet', 'Samsung', 'Galaxy Tab S10 FE 8/128GB (Gray)', 'TAB-S10FE',
     'tablet~samsung~s10-fe-galaxy-tab~8gb-128gb', '500', ''),
]
# Filas de hoy: ID, CODIGO, categoria, marca, descripcion, SKU, precio, lo que
# tiene que dar choque_de_codigo() y por que.
FILAS_CHOQUES = [
    ('P17-1TB-ESIM', 'AT-9071', 'Celular', 'Apple', 'iPhone 17 Pro 1TB E-Sim (Blue)',
     'celular~apple~17-iphone-pro~1tb-esim', '1900', '',
     'la fila que AT-9071 tiene de verdad: su Sim (E-Sim) sale del SKU, no del nombre'),
    ('P17-512-ESIM', 'AT-9071', 'Celular', 'Apple', 'iPhone 17 Pro 512GB E-Sim (Blue)',
     'celular~apple~17-iphone-pro~512gb-esim', '1700', 'otra-capacidad',
     '17 Pro 512 E-Sim con el codigo del 1TB E-Sim: otra memoria, misma Sim (AT-0071, 29/09)'),
    ('P17-256-SIM', 'AT-9071', 'Celular', 'Apple', 'iPhone 17 Pro 256GB Sim (Blue)',
     'celular~apple~17-iphone-pro~256gb-sim', '1500', 'choque',
     '17 Pro Sim con el codigo de un E-Sim aunque el nombre del maestro no diga la Sim'),
    ('P17-1TB-SIM', 'AT-9071', 'Celular', 'Apple', 'iPhone 17 Pro 1TB Sim (Blue)',
     'celular~apple~17-iphone-pro~1tb-sim', '1950', 'choque',
     'la misma memoria con otra Sim es otro producto'),
    ('P17-256-ESIM', 'AT-9073', 'Celular', 'Apple', 'iPhone 17 Pro 256GB E-Sim (Blue)',
     'celular~apple~17-iphone-pro~256gb-esim', '1500', 'otra-capacidad',
     'ninguna fila de hoy tiene AT-9073: decide el maestro, que dice E-Sim como la fila'),
    ('P17-256-SIM-B', 'AT-9073', 'Celular', 'Apple', 'iPhone 17 Pro 256GB Sim (Blue)',
     'celular~apple~17-iphone-pro~256gb-sim', '1500', 'choque',
     'ninguna fila de hoy tiene AT-9073: el maestro dice E-Sim y la fila es Sim'),
    ('NEO-512-EN', 'AT-9434', 'Notebook', 'Apple', 'MacBook Neo A18 13" 8GB/512GB (Blush)',
     'notebook~apple~a18-macbook-neo~13in-8gb-512gb-tecladoen', '1200', '',
     'la fila que AT-9434 tiene de verdad (teclado EN)'),
    ('NEO-256-ES', 'AT-9434', 'Notebook', 'Apple', 'MacBook Neo A18 13" 8GB/256GB (Silver)',
     'notebook~apple~a18-macbook-neo~13in-8gb-256gb-tecladoes', '1000', 'choque',
     'MacBook Neo ES con el codigo del EN: otro teclado es otro producto aunque cambie la memoria'),
    ('NEO-256-EN', 'AT-9434', 'Notebook', 'Apple', 'MacBook Neo A18 13" 8GB/256GB (Indigo)',
     'notebook~apple~a18-macbook-neo~13in-8gb-256gb-tecladoen', '1000', 'otra-capacidad',
     'MacBook Neo EN 256 con el codigo del EN 512: otra memoria, mismo teclado'),
    ('U3-MILANESE', 'AT-9456', 'Smartwatch', 'Apple', 'Watch Ultra 3 49mm (Black – Black Milanese Loop L)',
     'smartwatch~apple~3-ultra-watch~49mm-l-49-cell-mill', '1000', '',
     'la fila que AT-9456 tiene de verdad'),
    ('U3-OCEAN', 'AT-9456', 'Smartwatch', 'Apple', 'Watch Ultra 3 49mm (Black – Black Ocean Band)',
     'smartwatch~apple~3-ultra-watch~49mm-m-49-cell-ocean', '900', 'choque',
     'Ultra 3 Ocean con el codigo del Milanese y el puente resuelto: sin otra memoria no es otra capacidad'),
    ('A56-12-256', 'AT-9086', 'Celular', 'Samsung', 'Galaxy A56 12/256GB (Black)',
     'celular~samsung~a56-galaxy~12gb-256gb', '450', '',
     'la fila que AT-9086 tiene de verdad'),
    ('A56-8-256', 'AT-9086', 'Celular', 'Samsung', 'Galaxy A56 8/256GB (Black)',
     'celular~samsung~a56-galaxy~8gb-256gb', '400', 'otra-capacidad',
     'Galaxy A56 8/256 con el codigo del 12/256: otra RAM tambien es otra memoria (Pedro, 26/09)'),
    ('TAB-S10FE', 'AT-9200', 'Tablet', 'Samsung', 'Galaxy Tab S10 FE 8/128GB (Gray)',
     'tablet~samsung~s10-fe-galaxy-tab~8gb-128gb', '500', 'choque',
     'un codigo fusionado en la columna se pide: la web no sigue fusiones'),
    ('FANTASMA', 'AT-9999', 'Tablet', 'Samsung', 'Galaxy Tab S10 FE 8/128GB (Gray)',
     'tablet~samsung~s10-fe-galaxy-tab~8gb-128gb', '500', 'choque',
     'un codigo que el maestro no tiene'),
    ('SIN-COLUMNA', '', 'Tablet', 'Samsung', 'Galaxy Tab S10 FE 8/128GB (Gray)',
     'tablet~samsung~s10-fe-galaxy-tab~8gb-128gb', '500', '',
     'sin columna no hay choque: el codigo que falta lo pide r_codigo por su lado'),
]


def casos_de_choque():
    """(maestro, filas de hoy) de los casos de arriba, como los leen las
    herramientas: filas del catalogo-maestro.csv y filas de ADVAPP."""
    maestro = [{'CODIGO': cod, 'CODIGO_VAR': cod + '-01', 'NumVar': '01', 'Categoria': cat,
                'Marca': marca, 'Producto': prod, 'Variante': 'Black', 'ID_alta': id_alta,
                'SKU_alta': sku, 'Precio_alta': precio, 'Fusionado_en': fusion}
               for cod, cat, marca, prod, id_alta, sku, precio, fusion in MAESTRO_CHOQUES]
    filas = [{'ID': i, 'CODIGO': cod, 'CODIGO_VAR': '', 'Categoría': cat, 'Marca': marca,
              'Descripción completa': desc, 'SKU': sku, 'Precio USD': precio, 'Activo': 'Sí'}
             for i, cod, cat, marca, desc, sku, precio, _, _ in FILAS_CHOQUES]
    return maestro, filas


def probar_choques():
    """Corre FILAS_CHOQUES contra choque_de_codigo(), con sim_tec_de_hoy()
    armado con esas mismas filas, como lo tiene que llamar cada herramienta.
    Devuelve las fallas."""
    maestro, filas = casos_de_choque()
    idx = indexar(maestro)
    hoy = sim_tec_de_hoy(filas, idx)
    fallas = []
    for f, caso in zip(filas, FILAS_CHOQUES):
        espera, porque = caso[-2], caso[-1]
        dado, puente, da = choque_de_codigo(f, idx, hoy=hoy)
        if da != espera:
            fallas.append('%s: %s con %s (el catalogo dice %s) dio %r y tenia que dar %r'
                          % (porque, f['ID'], dado or '(vacio)', puente or '(nada)', da, espera))
    return fallas


if __name__ == '__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    malas = probar_columna()
    for m in malas:
        print('FALLA  ' + m)
    print('variante_de_la_columna: %d de %d casos bien'
          % (len(json.loads(CASOS_COLUMNA)['casos']) - len(malas),
             len(json.loads(CASOS_COLUMNA)['casos'])))
    choques = probar_choques()
    for m in choques:
        print('FALLA  ' + m)
    print('choque_de_codigo: %d de %d casos bien'
          % (len(FILAS_CHOQUES) - len(choques), len(FILAS_CHOQUES)))
    sys.exit(1 if (malas or choques) else 0)
