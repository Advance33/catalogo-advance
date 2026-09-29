# -*- coding: utf-8 -*-
"""Pone al dia las variantes del catalogo y avisa lo que falta.

    python3 herramientas/altas-catalogo.py             muestra que haria
    python3 herramientas/altas-catalogo.py --aplicar   lo hace

Es el trabajo de todos los dias. Un producto sin su variante registrada no
puede tener foto, asi que si nadie corre esto, cada dia hay mas fichas sin
imagen y nadie se entera hasta que un cliente la ve vacia.

LO QUE HACE SOLO
  · Variante nueva de un producto que ya tiene codigo: le da el proximo
    numero libre DE ESE PRODUCTO. Los numeros no se reusan, asi que si un
    color se deja de vender y despues vuelve, vuelve con el suyo. Agregar un
    color no crea una identidad nueva, por eso puede salir solo.
  · Una variante que ya existe escrita de otra forma: la anota en Escrituras
    y NO estrena numero. El numero es el nombre del archivo, y una variante
    de mas deja la foto vieja sin nadie que la pida.
  · Un producto que se sembro sin colores y estrena el primero: la fila sin
    variante se convierte en la 01.
  · Si ADVAPP ya dice en CODIGO_VAR que variante es, y el texto se le parece
    ("Lime" y la variante "lima", "Natural" y "Natural Titanium"), lo anota
    como escritura de esa. Va primero y para todas las filas, asi la fila
    hermana que llega sin CODIGO_VAR ya la encuentra.

LO QUE NO HACE SOLO (29/09)
Hasta el 29/09 esto numeraba todo lo que no reconocia letra por letra, y en
simulacion ya proponia 8 duplicados (AT-0511-07 "Lime" al lado de la
AT-0511-02 "lima", las tres Kieslect Elfin otra vez...) y un color metido en
el producto equivocado. Un numero de mas es para siempre y deja la foto
revisada sin nadie que la pida. Ahora lo que no es seguro se lista y no se
numera:
  · un color casi igual a uno que el producto ya tiene (traduccion, o casi
    las mismas letras): "¿es la misma?";
  · un CODIGO_VAR que dice una variante que no se parece al texto;
  · un color que ya existe, con ese texto, en OTRO producto que es este
    mismo (mismo modelo, mismo Sim/eSIM, mismo teclado);
  · un color de una fila de OTRA capacidad que el producto de la columna
    (Pedro, 26/09: se ve igual, pero registrarla ahi lo decide una persona);
  · y la fila entera, si su CODIGO no existe en el maestro o si CODIGO_VAR
    trae un codigo de otro producto: es un dato mal cargado de ADVAPP.
Lo que una persona decide se le pasa asi (se puede repetir):
    --misma AT-0511-02=Lime    es otra forma de escribir esa variante
    --nueva AT-0470=Blue       es un color nuevo de ese producto: numerarlo

QUIEN NUMERA: ESTE LADO, Y SOLO CON UNA PERSONA DE ACUERDO
Desde el 14/09/2026 el maestro tiene UN SOLO escritor y somos nosotros. Lo
propuso el equipo de la planilla y tiene sentido: confirmar que una fila es
tal producto es una decision sobre que foto se muestra, y las fotos estan
aca. Ellos siembran nuestro archivo y publican las columnas.

Antes estaba al reves y quedo a medias: se acordo que asignaban ellos, pero
este script siguio numerando variantes igual. Ese es justo el riesgo que
nosotros mismos les habiamos escrito -- si numeran los dos, dos altas del
mismo dia se llevan el mismo AT-#### y una foto tapa a la otra.

Pero numerar sigue necesitando que una persona lo diga. Un producto solo
estrena codigo si esta escrito como NUEVO en altas-decididas.csv. El 14/09,
de 92 filas sin codigo, 76 eran el mismo lente cargado con otra marca:
numerarlas todas habria sido el peor dia del catalogo.

Lo que conviene mirar de la lista que sale: si alguna es un producto que YA
esta con otro nombre. El proveedor reescribe seguido -- el 11/09 movio cuatro
productos de categoria, le agrego "GEN2" a siete anteojos y saco las
referencias de fabrica; el 14/09 empezo a mandar la referencia adelante con
una barra. Confirmar el vinculo en altas-decididas.csv y correr
confirmar-altas.py deja anotados el ID, el SKU, el nombre y la categoria de
ese dia, y el mismo cambio no se vuelve a preguntar nunca mas.
"""
import csv
import datetime
import io
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
sys.path.insert(0, AQUI)
sys.path.insert(0, RAIZ)
import catalogo_maestro as CM                 # noqa: E402
import fotos_sku as FS                        # noqa: E402
import validar                                # noqa: E402

APLICAR = '--aplicar' in sys.argv
# Numera los productos marcados NUEVO y no toca las variantes de los que ya
# estan. Hace falta cuando los colores de la planilla vienen en un formato
# que el partidor no entiende: el 15/09 la hoja Cami trajo "(caja · malla)" en
# los relojes, "color no informado" y "gray/1black", y sin esto las altas del
# dia no se podian numerar sin crear dieciocho variantes que no existen.
SOLO_PRODUCTOS = '--solo-productos' in sys.argv
DECISIONES = os.path.join(AQUI, 'altas-decididas.csv')


def pares_de(bandera):
    """Los valores de --misma y --nueva: CODIGO=texto, tantas veces como se
    pase la bandera. Es como una persona resuelve lo que esto no numera solo."""
    salida = []
    for i, a in enumerate(sys.argv[:-1]):
        if a == bandera:
            cod, _, texto = sys.argv[i + 1].partition('=')
            salida.append((cod.strip().upper(), texto.strip()))
    return salida


def codigos_ajenos(f, cod, idx):
    """Los codigos de la celda CODIGO_VAR que NO son de `cod`.

    El 29/09 la fila SWT-APL-WULTRA3-000-BLK-49-CELL-OCEAN llego con CODIGO
    AT-0456 (el Ultra 3 con Milanese Loop) y CODIGO_VAR AT-0455-01 (el de
    Alpine Loop). Numerando por la columna CODIGO, esto le estrenaba el
    AT-0456-05 "Black – Black Ocean Band", que ya es la AT-0455-06 con foto
    revisada. Cuando las dos columnas se contradicen no hay forma de saber
    cual esta bien: se pregunta y no se toca nada de esa fila.
    """
    salida = []
    for x in (f.get('CODIGO_VAR') or '').split('/'):
        x = x.strip().upper()
        p = CM.partir(x) if x else None
        if x and (not p or CM.seguir_fusion(p[0], idx) != cod):
            salida.append(x)
    return salida


def por_que_no_la_celda(cod, v, dice, propios, idx):
    """Por que no se uso lo que dice CODIGO_VAR para el color `v`."""
    x = idx['por_var'].get(dice.upper())
    if not CM.RE_VARIANTE.match(dice.upper()) or not x:
        return 'esa variante no existe en el maestro'
    if (x.get('Baja') or '').strip():
        return 'esa variante esta dada de baja'
    otro = next((c for c in propios if CM.norm(c) != CM.norm(v)
                 and CM.variante_de(cod, c, idx) == x['CODIGO_VAR']), None)
    if otro:
        return 'es la de "%s", otro color de la misma fila' % otro
    return 'que es "%s", y el texto no se le parece' % (x.get('Variante') or '')


def leer_decisiones():
    """Lo que una persona ya resolvio: ID de la planilla -> AT-#### o NUEVO."""
    if not os.path.exists(DECISIONES):
        return {}
    with io.open(DECISIONES, encoding='utf-8', newline='') as fh:
        filas = list(csv.DictReader(fh))
    salida = {}
    for f in filas:
        i = (f.get('ID') or '').strip()
        d = (f.get('Decision') or '').strip().upper()
        if i and d:
            salida[i] = d
    return salida


class SinAdvapp(Exception):
    """ADVAPP no contesto (o vino cortado) y no se sigue con otra fuente."""


def filas_de_la_planilla():
    """Los datos de ADVAPP, o un archivo con  --planilla <csv>.

    El archivo sirve para trabajar sobre una copia armada a mano (antes, la
    hoja Cami del equipo del sheet, antes de publicar Landing).

    SOLO ADVAPP, nunca la planilla de respaldo (29/09, hallazgo 154). Esto
    usaba validar.bajar_csv(), que si ADVAPP no contesta devuelve la planilla
    congelada del 22/09 y solo avisa por stderr. Con --aplicar habria
    numerado sobre filas de hace una semana, donde los IDs ya son de otros
    productos: simulado con ADVAPP caido, le estrenaba AT-0456-05 y AT-0456-06
    al Watch Ultra 3 Milanese con colores de otro. Un numero de mas es para
    siempre. Tampoco se simula: la lista que saldria es de otro dia y
    alguien podria decidir sobre ella.
    """
    if '--planilla' in sys.argv:
        ruta = sys.argv[sys.argv.index('--planilla') + 1]
        with io.open(ruta, encoding='utf-8', newline='') as fh:
            return list(csv.DictReader(fh))
    try:
        return validar.bajar_advapp()
    except Exception as e:
        raise SinAdvapp(str(e))


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    maestro = CM.leer()
    if not maestro:
        print('Todavia no hay catalogo maestro. Se siembra una sola vez:')
        print('   python3 herramientas/sembrar-catalogo-maestro.py --escribir')
        return 2
    # La primera pasada confia en la copia de varianteDeLaColumna(): si dejo
    # de dar lo mismo que la web, se frena antes de anotar nada.
    malas = CM.probar_columna()
    if malas:
        print('variante_de_la_columna ya no hace lo mismo que la web:')
        for m in malas:
            print('   ' + m)
        return 3

    try:
        filas = [f for f in filas_de_la_planilla() if (f.get('ID') or '').strip()]
    except SinAdvapp as e:
        print('ADVAPP no contesto (%s): no se sigue, ni con --aplicar ni en simulacion.' % e)
        print('La planilla de respaldo esta congelada desde el 22/09 y sus IDs rotan:')
        print('numerar sobre ella le daria codigos a filas que hoy son otro producto.')
        print('Volver a correrlo cuando ADVAPP conteste. No se escribio nada.')
        return 2
    conocidos = validar.leer_index()[0]
    pinta = validar.pinta
    cols = lambda f: FS.colores_de_la_fila(f, pinta, conocidos)
    idx = CM.indexar(maestro)
    hoy = datetime.date.today().isoformat()
    decidido = leer_decisiones()

    # Los productos que hoy no aparecen en ninguna fila. Un producto que se
    # fue y una fila que no se reconoce, de la misma marca y al mismo precio,
    # casi siempre son la misma cosa con el nombre cambiado: ese es el par
    # que conviene mirar primero.
    tomados = set()
    for f in filas:
        c, _ = CM.codigo_de_la_fila(f, idx, pinta, conocidos)
        if c:
            tomados.add(c)

    por_marca = {}
    for m in maestro:
        por_marca.setdefault(CM.norm(m['Marca']), {})[m['CODIGO']] = m

    def candidatos(f, cuantos=3):
        """Los productos del catalogo que mas se parecen a esta fila.

        Se busca por marca sola, NO por marca y categoria: la categoria la
        escribe el proveedor y la cambia. Los cuatro extenders se escaparon
        justo por eso.
        """
        d = f.get('Descripción completa') or ''
        sin_col = CM.sin_los_colores(d, pinta, conocidos)
        puntos = []
        for m in (por_marca.get(CM.norm(f.get('Marca'))) or {}).values():
            p = max(CM.parecido(d, m['Producto']),
                    CM.parecido(sin_col, CM.sin_los_colores(m['Producto'], pinta, conocidos)))
            precio = CM.mismo_precio(f.get('Precio USD'), m.get('Precio_alta'))
            # Un producto que hoy no esta en la planilla y cuyo precio cierra
            # pesa mas que uno que se sigue vendiendo: el que se fue es el
            # candidato natural del que llego.
            if m['CODIGO'] not in tomados and precio is True:
                p += 0.15
            puntos.append((p, precio, m))
        puntos.sort(key=lambda x: -x[0])
        return puntos[:cuantos]

    nuevas_var, sin_resolver, escrituras, convertidas, esperando = [], [], [], [], []
    nuevos_prod = []
    # Lo que no se numera solo (29/09): ver "LO QUE NO HACE SOLO" arriba.
    inexistentes, no_coinciden, preguntas, diferidas, otra_cap, quejas = [], [], [], [], [], []

    def anotar(cv, v):
        fila = idx['por_var'][cv]
        # Con CM.lista y CM.juntar, que escapan la barra: el 14/09 un
        # nombre con "|" quedo partido en dos por juntarlo a mano.
        fila['Escrituras'] = CM.juntar(CM.lista(fila, 'Escrituras') + [v])
        escrituras.append((cv, v, fila))

    # Lo que una persona ya miro de la lista de preguntas.
    for cv, v in pares_de('--misma'):
        x = idx['por_var'].get(cv)
        ya = CM.variante_de(x['CODIGO'], v, idx) if x else ''
        if not x or not (x.get('NumVar') or '').strip() or (x.get('Baja') or '').strip() or not v:
            quejas.append('--misma %s=%s: esa variante no existe o esta dada de baja' % (cv, v))
        elif ya and ya != cv:
            quejas.append('--misma %s=%s: ese texto ya es de %s' % (cv, v, ya))
        elif not ya:
            anotar(cv, v)
    forzadas = {(c, CM.norm(v)) for c, v in pares_de('--nueva') if v}

    # PRIMERA PASADA, para todas las filas y antes de numerar nada: lo que
    # ADVAPP ya dice en CODIGO_VAR. Si el texto se parece a esa variante
    # (CM.se_parece_a) es otra forma de escribirla y se anota. Va aparte y
    # primero porque la fila del 16 Pro Max 512GB Natural llega SIN
    # CODIGO_VAR, y solo encuentra su variante si la de 256GB ya dejo
    # anotada la escritura; en el orden de la planilla no siempre pasa.
    # Que se parezca es la mitad que pone este lado: ADVAPP tambien se
    # equivoca de variante (SW-APP-016 y 017 llegan con la del color de al
    # lado, 26/09), y anotarlo a ciegas dejaria su error escrito para siempre.
    if not SOLO_PRODUCTOS:
        for f in filas:
            cod, _ = CM.codigo_de_la_fila(f, idx, pinta, conocidos)
            if not cod or cod not in idx['por_codigo'] or codigos_ajenos(f, cod, idx):
                continue
            propios = cols(f)
            for v in propios:
                if CM.variante_de(cod, v, idx) or CM.variante_por_partes(cod, v, idx):
                    continue
                cv = CM.variante_de_la_columna(f, cod, v, idx, propios)
                if cv and CM.se_parece_a(v, cv, idx):
                    anotar(cv, v)

    def en_otro_producto(f, cod, v):
        """La variante de OTRO codigo que ya tiene ese texto y que es este
        mismo producto. Solo con el mismo modelo de verdad: Black, White y
        Blue estan en cientos de productos, y por marca sola frenaba 37 de
        44 colores nuevos legitimos (medido el 29/09)."""
        k = CM.norm(v)
        for x in maestro:
            if (CM.seguir_fusion(x['CODIGO'], idx) == cod or (x.get('Baja') or '').strip()
                    or not (x.get('NumVar') or '').strip()):
                continue
            if k in CM.escrituras_de(x) and CM.mismo_producto_de_verdad(f, x, pinta, conocidos):
                return x['CODIGO_VAR']
        return ''
    # El ULTIMO numero entregado. proximo_codigo() ya devuelve el siguiente
    # libre, y abajo se suma uno antes de usarlo: tomarlo tal cual salteaba un
    # numero en cada corrida. Asi quedo el hueco del AT-0509 el 14/09, que en
    # su momento se explico como "un codigo entregado que no quedo". No fue
    # eso: fue este +1 de mas.
    n = int(CM.proximo_codigo(maestro)[3:]) - 1

    for f in filas:
        idf = (f.get('ID') or '').strip()
        cod, _de = CM.codigo_de_la_fila(f, idx, pinta, conocidos)
        base = {'Categoria': (f.get('Categoría') or '').strip(),
                'Marca': (f.get('Marca') or '').strip(),
                'Producto': (f.get('Descripción completa') or '').strip(),
                'ID_alta': idf, 'Otros_IDs': '',
                'SKU_alta': FS.sku_de(f), 'Otros_SKUs': '', 'Nombres_vistos': '',
                'Precio_alta': (f.get('Precio USD') or '').strip(),
                'Alta': hoy, 'Baja': '', 'Fusionado_en': '', 'Nota': ''}
        if not cod:
            if decidido.get(idf) != 'NUEVO':
                esperando.append((f, candidatos(f)))
                continue
            # Desde el 14/09 numeramos nosotros. Se acordo con el equipo de la
            # planilla que hay UN SOLO escritor del maestro y que somos este
            # lado: las confirmaciones son decisiones sobre fotos, y las fotos
            # estan aca. Ellos siembran nuestro archivo y publican.
            #
            # Pero sigue haciendo falta que una persona lo diga: un codigo de
            # mas parte las fotos de un producto en dos y es para siempre. Por
            # eso solo se numera lo que esta escrito como NUEVO en
            # altas-decididas.csv. El 14/09, de 92 filas sin codigo, 76 eran
            # duplicados que el proveedor cargo con otra marca: numerarlas a
            # todas habria sido el peor dia del catalogo.
            cod = '%s-%04d' % (CM.PREFIJO, n + 1)
            n += 1
            base['CODIGO'] = cod
            base['Nota'] = 'alta confirmada a mano el ' + hoy
            variantes = cols(f)
            if not variantes:
                nuevos_prod.append(dict(base, CODIGO_VAR=cod, Variante='',
                                        Escrituras='', NumVar=''))
            else:
                for k, v in enumerate(variantes, 1):
                    nuevos_prod.append(dict(base, CODIGO_VAR='%s-%02d' % (cod, k),
                                            Variante=v, Escrituras='',
                                            NumVar='%02d' % k))
            maestro.extend(x for x in nuevos_prod if x['CODIGO'] == cod)
            idx = CM.indexar(maestro)
            continue
        # Un CODIGO que el maestro no tiene. Somos el unico escritor desde el
        # 14/09, asi que es un tipeo de ADVAPP y no un producto: el 29/09 se
        # probo con AT-0600 y esto le numeraba variantes como si existiera,
        # el contador saltaba a 600 y las alarmas de verificar-fotos y del
        # pedido se apagaban, porque el codigo pasaba a existir. Se lista con
        # el que dice el puente, que suele ser el que quisieron poner.
        if cod not in idx['por_codigo']:
            puente, _ = CM.codigo_de_la_fila(dict(f, CODIGO='', CODIGO_VAR=''), idx, pinta, conocidos)
            inexistentes.append((f, cod, puente))
            continue
        if SOLO_PRODUCTOS:
            continue
        ajenos = codigos_ajenos(f, cod, idx)
        if ajenos:
            no_coinciden.append((f, cod, ajenos))
            continue
        # producto conocido: ¿trae alguna variante que el catalogo no tenga?
        propios = cols(f)
        for v in propios:
            if CM.variante_de(cod, v, idx):
                continue
            # Puede ser una que ya esta, escrita de otra forma. Eso se anota
            # como escritura y NO estrena numero: el numero es el nombre de
            # la foto, y una variante de mas deja la foto vieja sin nadie que
            # la pida.
            ya = CM.variante_por_partes(cod, v, idx)
            if ya:
                anotar(ya, v)
                continue
            forzada = (cod, CM.norm(v)) in forzadas
            # ADVAPP dice una variante para este color y la primera pasada no
            # la acepto: o no se parece, o no existe. Numerar al lado haria
            # que el pedido le pida a ADVAPP mover una ficha de una foto
            # revisada a un numero sin foto.
            dice = CM.celda_de_la_columna(f, v, propios)
            if dice and CM.partir(dice.upper()) and CM.partir(dice.upper())[1] and not forzada:
                preguntas.append((f, cod, v, 'ADVAPP dice %s, %s'
                                  % (dice, por_que_no_la_celda(cod, v, dice, propios, idx))))
                continue
            if not forzada:
                # La segunda red: casi igual a una que el producto ya tiene
                # (Lavender/lavander, Pistachio/Pistacho, Lime/lima). Se
                # pregunta: si es la misma se anota con --misma, si es otra
                # se numera con --nueva.
                parecidas = CM.variantes_parecidas(cod, v, idx)
                if parecidas:
                    preguntas.append((f, cod, v, '¿es la misma que %s?' % ', '.join(
                        '%s "%s"' % (p, idx['por_var'][p].get('Variante') or '') for p in parecidas)))
                    continue
                # Otra capacidad que el producto de la columna: la foto del
                # hermano alcanza (Pedro, 26/09), pero estrenar el color en
                # el producto de OTRA memoria lo decide una persona. Se deja
                # para el final: si una fila de la misma capacidad lo numera
                # en esta corrida, esta ya queda resuelta.
                if CM.otra_capacidad(f, cod, idx):
                    diferidas.append((f, cod, v))
                    continue
                otro = en_otro_producto(f, cod, v)
                if otro:
                    preguntas.append((f, cod, v, 'ya existe en %s, que es este mismo producto: '
                                      'el CODIGO de la fila puede ser el de otro' % otro))
                    continue
            # Un producto que se sembro sin colores y hoy trae el primero: la
            # fila sin variante ES ese color, no una hermana suya. Si se
            # agregara al lado, el producto quedaria con una fila sin numero
            # y otras con numero, que es justo lo que el chequeo llama grave:
            # la portada se vuelve ambigua y no hay forma de saber si la foto
            # AT-0082.jpg es la del Black o la de todos.
            suelta = next((x for x in (idx['por_codigo'].get(cod) or [])
                           if not (x.get('NumVar') or '').strip()), None)
            if suelta is not None and len(idx['por_codigo'][cod]) == 1:
                convertidas.append((cod, v, suelta))
                suelta['CODIGO_VAR'] = '%s-01' % cod
                suelta['NumVar'] = '01'
                suelta['Variante'] = v
                idx = CM.indexar(maestro)
                continue
            num = CM.proxima_variante(cod, idx)
            modelo = (idx['por_codigo'].get(cod) or [{}])[0]
            fila = dict(base, CODIGO=cod, CODIGO_VAR='%s-%s' % (cod, num),
                        Variante=v, Escrituras='', NumVar=num,
                        Categoria=modelo.get('Categoria', base['Categoria']),
                        Marca=modelo.get('Marca', base['Marca']),
                        Producto=modelo.get('Producto', base['Producto']),
                        Nota='variante agregada el ' + hoy)
            nuevas_var.append(fila)
            maestro.append(fila)
            idx = CM.indexar(maestro)

    # Las de otra capacidad, al final: si una fila de su misma capacidad ya
    # numero el color en esta corrida, quedaron resueltas solas.
    for f, cod, v in diferidas:
        if not CM.variante_de(cod, v, idx):
            otra_cap.append((f, cod, v))

    print('ALTAS DEL CATALOGO')
    print('=' * 74)
    print('planilla: %d filas   ·   catalogo: %d productos'
          % (len(filas), len({m['CODIGO'] for m in maestro})))
    print()
    print('  %4d  productos nuevos, confirmados a mano' % len({x['CODIGO'] for x in nuevos_prod}))
    print('  %4d  variantes nuevas de productos que ya estaban' % len(nuevas_var))
    print('  %4d  variantes que ya estaban, escritas de otra forma' % len(escrituras))
    print('  %4d  productos que estrenan su primera variante' % len(convertidas))
    print('  %4d  SIN DECIDIR (ni vinculo ni NUEVO)' % len(esperando))
    print('  %4d  NO SE NUMERAN: las tiene que mirar una persona' % len(preguntas))
    print('  %4d  otra capacidad que el producto de la columna' % len(otra_cap))
    print('  %4d  filas con un CODIGO que no existe en el maestro' % len(inexistentes))
    print('  %4d  filas con CODIGO y CODIGO_VAR que no coinciden' % len(no_coinciden))
    print()
    for q in quejas:
        print('  OJO  ' + q)
    if quejas:
        print()
    if inexistentes:
        print('--- CODIGO QUE NO EXISTE EN EL MAESTRO (ADVAPP lo cargo mal) ---')
        print('    Los codigos los damos nosotros, asi que no es un producto: es un')
        print('    tipeo. No se numera nada y no se toca el contador. Va al pedido a')
        print('    ADVAPP con el codigo que dice el puente, si hay uno.')
        for f, cod, puente in inexistentes:
            print('  %-13s %-9s %-40s %s' % (
                (f.get('ID') or '').strip(), cod, (f.get('Descripción completa') or '')[:40],
                ('seria ' + puente) if puente else '(sin candidato: preguntar)'))
        print()
    if no_coinciden:
        print('--- CODIGO Y CODIGO_VAR NO COINCIDEN ---')
        print('    CODIGO_VAR trae un codigo de otro producto. No se sabe cual de las')
        print('    dos columnas esta bien, asi que no se toca nada de la fila.')
        for f, cod, ajenos in no_coinciden:
            print('  %-13s CODIGO %-9s CODIGO_VAR %-24s %s' % (
                (f.get('ID') or '').strip(), cod, '/'.join(ajenos)[:24],
                (f.get('Descripción completa') or '')[:30]))
        print()
    if preguntas:
        print('--- NO SE NUMERAN: LAS TIENE QUE MIRAR UNA PERSONA ---')
        print('    Si es la misma variante:  --misma AT-####-NN=<texto>  (se anota como escritura)')
        print('    Si es un color nuevo:     --nueva AT-####=<texto>     (se numera)')
        for f, cod, v, porque in preguntas:
            print('  %-13s %-9s %-26s %s' % ((f.get('ID') or '').strip(), cod, v[:26], porque))
        print()
    if otra_cap:
        print('--- OTRA CAPACIDAD QUE EL PRODUCTO DE LA COLUMNA ---')
        print('    La fila es de otra memoria que el producto de su CODIGO. La foto del')
        print('    hermano alcanza (Pedro, 26/09), pero estrenar el color en el producto')
        print('    de otra memoria lo decide una persona:  --nueva AT-####=<texto>')
        for f, cod, v in otra_cap:
            print('  %-13s %-9s %-26s %s' % ((f.get('ID') or '').strip(), cod, v[:26],
                                            (f.get('Descripción completa') or '')[:36]))
        print()
    if nuevos_prod:
        print('--- productos nuevos ---')
        visto = set()
        for x in nuevos_prod:
            if x['CODIGO'] in visto:
                print('  %-14s %-46s %s' % ('', '', x['Variante'][:24]))
                continue
            visto.add(x['CODIGO'])
            print('  %-14s %-46s %s' % (x['CODIGO'], x['Producto'][:46], x['Variante'][:24]))
        print()
    if nuevas_var:
        print('--- variantes nuevas ---')
        for x in nuevas_var:
            print('  %-14s %-46s %s' % (x['CODIGO_VAR'], x['Producto'][:46], x['Variante'][:24]))
        print()
    if convertidas:
        print('--- productos que estrenan su primera variante ---')
        print('    La fila sin variante pasa a ser la 01. Si tenian una foto')
        print('    <CODIGO>.jpg, hay que renombrarla a <CODIGO>-01.jpg.')
        for cod, v, fila in convertidas:
            print('  %-9s -> %-12s %-34s %s'
                  % (cod, cod + '-01', (fila.get('Producto') or '')[:34], v[:22]))
        print()
    if escrituras:
        print('--- otra forma de escribir una variante que ya esta ---')
        for cv, v, fila in escrituras:
            print('  %-14s %-30s ahora tambien: %s'
                  % (cv, (fila.get('Variante') or '')[:30], v[:34]))
        print()
    if esperando:
        print('--- SIN CODIGO ---')
        print('    Los codigos los numera este lado, y solo lo que una persona')
        print('    marco como NUEVO en altas-decididas.csv. Estas filas salen sin')
        print('    foto hasta que alguien decida si son un alta o un vinculo.')
        print()
        print('    Si alguna es un producto que YA esta con otro nombre, se le anota')
        print('    el vinculo y deja de necesitar codigo nuevo. Va en')
        print('    herramientas/altas-decididas.csv como  <ID>,AT-####  y despues:')
        print('      python3 herramientas/confirmar-altas.py --aplicar')
        print()
        for f, cands in sorted(esperando, key=lambda x: x[0]['ID']):
            idf = (f.get('ID') or '').strip()
            marca = '  (ya la miramos: es nueva)' if decidido.get(idf) == 'NUEVO' else ''
            print('  %-13s %-44s %8s  %s%s' % (
                idf, (f.get('Descripción completa') or '')[:44],
                (f.get('Precio USD') or '').strip(),
                (f.get('Categoría') or '').strip()[:16], marca))
            if decidido.get(idf) == 'NUEVO':
                print()
                continue
            for p, precio, m in cands:
                aviso = ''
                if CM.norm(m['Categoria']) != CM.norm(f.get('Categoría')):
                    aviso += ' · cambio de categoria (%s)' % m['Categoria'][:14]
                if precio is False:
                    aviso += ' · OTRO PRECIO'
                if m['CODIGO'] not in tomados:
                    aviso += ' · hoy no se vende'
                print('  %-13s %3.0f%%  %-9s %-38s %7s%s' % (
                    '', p * 100, m['CODIGO'], (m.get('Producto') or '')[:38],
                    (m.get('Precio_alta') or ''), aviso))
            print()

    if not APLICAR:
        print('Simulacion. Para agregarlas:  python3 herramientas/altas-catalogo.py --aplicar')
        return 0
    if not nuevos_prod and not nuevas_var and not escrituras and not convertidas:
        print('No hay nada que agregar.')
        return 0

    try:
        CM.escribir(maestro)
    except CM.CatalogoRoto as e:
        print('NO SE ESCRIBIO: %s' % e)
        return 2
    print('Agregados. El catalogo queda con %d productos y %d variantes.'
          % (len({m['CODIGO'] for m in maestro}), len(maestro)))
    print('Ahora conviene regenerar el indice:  python3 verificar-fotos.py')
    return 0


if __name__ == '__main__':
    sys.exit(main())
