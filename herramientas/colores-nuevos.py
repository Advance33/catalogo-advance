# -*- coding: utf-8 -*-
"""Los colores que llegan de ADVAPP sin puntito, con el tono ya medido.

    python3 herramientas/colores-nuevos.py
    python3 herramientas/colores-nuevos.py --sin lime,mid     (para probarlo)

Un color que el mapa COLORES de index.html no conoce sale en la web sin
puntito. Pasa cada vez que ADVAPP carga un producto con un color nuevo
("Pistachio", "Lime") o lo escribe cortado ("Mid" por Midnight). La revision
diaria lo avisa; esto dice que hacer con cada uno.

Para cada color:
  · si es un nombre cortado o una traduccion de uno que ya esta, lo dice:
    va con el mismo tono (y conviene pedirle a ADVAPP que lo escriba entero);
  · si no, MIDE el tono en nuestra foto revisada de ese producto y color
    (fotos/AT-####-NN.jpg): el tono que mas se repite entre los pixeles que
    no son fondo blanco.

Deja las lineas listas para pegar en COLORES, pero NO las pega: la medicion
puede agarrar la pantalla de un telefono en vez del dorso. Una persona mira la
foto que se nombra al lado y confirma. El 26/09 asi salio que el "Lime" del
Galaxy A36 es casi menta y no verde lima: a ojo se habria puesto mal.
"""
import os
import re
import sys
import collections

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
sys.path.insert(0, AQUI)
sys.path.insert(0, RAIZ)
import validar                                # noqa: E402
import catalogo_maestro as CM                 # noqa: E402
import difflib                                # noqa: E402

FOTOS = os.path.join(RAIZ, 'fotos')

# Como lo escribe el proveedor en castellano -> como esta en el mapa
TRADUCCIONES = {'lima': 'lime', 'lavanda': 'lavender', 'negro': 'black',
                'blanco': 'white', 'azul': 'blue', 'rosa': 'pink', 'verde': 'green',
                'gris': 'gray', 'plata': 'silver', 'dorado': 'gold', 'violeta': 'violet'}


def tonos_del_mapa():
    """nombre -> tono, leido del mapa COLORES de index.html (validar solo
    guarda los nombres)."""
    txt = open(os.path.join(RAIZ, 'index.html'), encoding='utf-8').read()
    ini = txt.index('const COLORES = {')
    fin = txt.index('};', ini)
    salida = {}
    for m in re.finditer(r"""(?:'([^']+)'|([A-Za-z]+))\s*:\s*'(#[0-9A-Fa-f]{6})'""", txt[ini:fin]):
        salida[validar.norm(m.group(1) or m.group(2))] = m.group(3).upper()
    return salida


def tono_de_la_foto(ruta):
    """El tono que mas se repite fuera del fondo, o None si no se puede.

    Se agrupan los pixeles en cubos de 16 niveles por canal y se devuelve el
    promedio del cubo mas poblado: el cuerpo del producto suele ser la
    superficie mas grande que no es fondo.
    """
    try:
        from PIL import Image
    except ImportError:
        return None
    try:
        im = Image.open(ruta).convert('RGB').resize((225, 225))
    except Exception:
        return None
    cubos = collections.defaultdict(list)
    pixeles = im.get_flattened_data() if hasattr(im, 'get_flattened_data') else im.getdata()
    for p in pixeles:
        if min(p) > 238:                       # fondo blanco
            continue
        cubos[(p[0] // 16, p[1] // 16, p[2] // 16)].append(p)
    if not cubos:
        return None
    mayor = max(cubos.values(), key=len)
    return '#%02X%02X%02X' % tuple(sum(x[i] for x in mayor) // len(mayor) for i in range(3))


def foto_del_color(fila, token):
    """La foto de ese color de esa fila: CODIGO_VAR trae un codigo por color,
    en el mismo orden que la columna Color."""
    cols = validar.partir_colores(validar.limpio(fila.get('Color', '')))
    codigos = [c.strip() for c in (fila.get('CODIGO_VAR') or '').split('/') if c.strip()]
    if token in cols and len(codigos) == len(cols):
        cv = codigos[cols.index(token)]
    elif len(codigos) == 1:
        cv = codigos[0]
    else:
        # Sin CODIGO_VAR en la fila, la variante la sabe el maestro
        maestro = CM.indexar(CM.leer())
        cod, _ = CM.codigo_de_la_fila(fila, maestro, validar.pinta, None)
        cv = CM.variante_de(cod, token, maestro) if cod else None
        if not cv:
            return None
    ruta = os.path.join(FOTOS, cv + '.jpg')
    return ruta if os.path.exists(ruta) else None


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    ctx = validar.leer_index()
    colores = ctx[0]                      # los nombres que el mapa conoce
    tonos = tonos_del_mapa()
    if '--sin' in sys.argv:
        for c in sys.argv[sys.argv.index('--sin') + 1].split(','):
            colores.discard(validar.norm(c))
            tonos.pop(validar.norm(c), None)
    filas = validar.bajar_csv()
    faltan = collections.OrderedDict()
    por_id = {f['ID']: f for f in filas}
    for sev, pid, msg in validar.regla_color(filas, ctx):
        m = re.match(r'color "(.+)" no está en el mapa', msg)
        if m:
            faltan.setdefault(m.group(1), []).append(pid)
    if not faltan:
        print('No hay colores nuevos: todos los de ADVAPP tienen puntito.')
        return 0

    print('COLORES SIN PUNTITO: %d' % len(faltan))
    print('=' * 70)
    lineas = []
    for token, ids in faltan.items():
        n = validar.norm(token)
        print('\n"%s"  en %s' % (token, ', '.join(ids[:4]) + (' y %d mas' % (len(ids) - 4) if len(ids) > 4 else '')))
        conocido = TRADUCCIONES.get(n)
        if not conocido:
            largos = [k for k in tonos if k.startswith(n) and k != n]
            conocido = min(largos, key=len) if largos and len(n) >= 3 else None
            if conocido:
                print('   parece "%s" cortado. Conviene pedirle a ADVAPP que lo escriba entero.' % conocido)
            else:
                # "Pistachio" y "pistacho": el mismo color escrito de otra forma
                cerca = difflib.get_close_matches(n, list(tonos), n=1, cutoff=0.85)
                conocido = cerca[0] if cerca else None
                if conocido:
                    print('   parece "%s" escrito de otra forma.' % conocido)
        if conocido and conocido in tonos:
            print('   mismo tono que "%s": %s' % (conocido, tonos[conocido]))
            lineas.append("  %s:'%s',   // = %s" % (repr(n) if ' ' in n else n, tonos[conocido], conocido))
            continue
        ruta = None
        for pid in ids:
            ruta = foto_del_color(por_id.get(pid, {}), token)
            if ruta:
                break
        tono = tono_de_la_foto(ruta) if ruta else None
        if tono:
            print('   medido en %s: %s   <-- MIRAR la foto antes de pegarlo' % (os.path.relpath(ruta, RAIZ), tono))
            lineas.append("  %s:'%s',   // medido en %s" % (repr(n) if ' ' in n else n, tono,
                                                           os.path.basename(ruta)))
        else:
            print('   sin foto nuestra de ese color: no se puede medir. Si no es un color '
                  '(una malla, un material), dejarlo sin puntito es lo correcto.')
    if lineas:
        print('\nPara pegar al final de COLORES en index.html (despues de mirar las fotos):\n')
        print('\n'.join(lineas))
    return 1


if __name__ == '__main__':
    sys.exit(main())
