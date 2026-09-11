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

    python herramientas/altas-catalogo.py     lista lo que no reconoce
    (una persona escribe la decisión en herramientas/altas-decididas.csv)
    python herramientas/confirmar-altas.py --aplicar
    python herramientas/altas-catalogo.py --aplicar

Confirmar no es sólo destrabar el día: el ID, el SKU, el nombre y la
categoría con que vino quedan anotados en el producto, así que el mismo
cambio no vuelve a preguntarse nunca más.
"""
import csv
import io
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
    with io.open(ruta, 'w', encoding='utf-8', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNAS, extrasaction='ignore')
        w.writeheader()
        for f in sorted(filas, key=lambda x: x['CODIGO_VAR']):
            w.writerow({c: (f.get(c) or '') for c in COLUMNAS})
    if ruta == MAESTRO:
        sincronizar_contador(filas)


def sincronizar_contador(filas):
    """Deja el contador en el número más alto que se haya entregado.

    Desde el contrato landing/1.3 los códigos los reparte el equipo de la
    planilla, así que de este lado el contador dejó de ser una reserva y pasó
    a ser un espejo: si no se actualizara, el día que el sheet entregue el
    AT-0509 el chequeo diría que el contador retrocedió y frenaría la
    publicación por algo que está bien.

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
    salida.update(norm(x) for x in (fila.get('Escrituras') or '').split('|') if x.strip())
    return {x for x in salida if x}


def lista(fila, campo):
    """Un campo que guarda varios valores, separados por barra vertical."""
    return [x.strip() for x in (fila.get(campo) or '').split('|') if x.strip()]


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
    fila[APRENDIDAS[campo]] = '|'.join(lista(fila, APRENDIDAS[campo]) + [valor])
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
    fila['Nombres_vistos'] = '|'.join(lista(fila, 'Nombres_vistos') + [nombre])
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
    fila['Otras_Categorias'] = '|'.join(lista(fila, 'Otras_Categorias') + [categoria])
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
    io.open(ruta, 'w', encoding='utf-8').write(
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
    for f in filas:
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


def candidatos_foto(codigo, textos_de_hoy, idx):
    """Los archivos que la web prueba para la portada de una fila, en orden:
    la primera variante que vende hoy, después cualquier otra que venda, y al
    final el producto sin variante."""
    if not codigo:
        return []
    salida = [variante_de(codigo, t, idx) for t in (textos_de_hoy or [])]
    salida.append(variante_de(codigo, '', idx) or codigo)
    vistos, out = set(), []
    for n in salida:
        if n and n not in vistos:
            vistos.add(n)
            out.append(n)
    return out
