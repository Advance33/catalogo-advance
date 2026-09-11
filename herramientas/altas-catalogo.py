# -*- coding: utf-8 -*-
"""Le da codigo a los productos y variantes que entraron al catalogo.

    python herramientas/altas-catalogo.py             muestra que agregaria
    python herramientas/altas-catalogo.py --aplicar   lo agrega

Es el trabajo de todos los dias, y es lo unico que mantiene vivo al catalogo
maestro. Un producto sin codigo no puede tener foto, asi que si nadie corre
esto, cada dia hay mas fichas sin imagen y nadie se entera hasta que un
cliente la ve vacia.

Hace dos cosas, las dos que SUMAN y ninguna que pise:

  1. Producto nuevo: se le da el proximo AT-#### libre y se agregan todas
     sus variantes de hoy.
  2. Variante nueva de un producto que ya tiene codigo: se le da el proximo
     numero libre DE ESE PRODUCTO. Los numeros no se reusan, asi que si el
     azul se dejo de vender y despues vuelve, vuelve con el suyo.

Lo que NO hace, nunca: tocar un codigo que ya existe. Esa es toda la
promesa del catalogo; si esto empezara a reescribir codigos, seria otra
identidad derivada del texto y estariamos de vuelta en el principio.

Tampoco toca las DUDOSAS: las filas cuyo vinculo apunta a un producto que
ya no se le parece. Esas las mira una persona, porque una de dos: o el
producto cambio de gama y hay que darle codigo nuevo, o la planilla
reutilizo un ID y hay que arreglar el vinculo. Salen listadas al final.
"""
import datetime
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


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    maestro = CM.leer()
    if not maestro:
        print('Todavia no hay catalogo maestro. Se siembra una sola vez:')
        print('   python herramientas/sembrar-catalogo-maestro.py --escribir')
        return 2

    filas = [f for f in validar.bajar_csv() if (f.get('ID') or '').strip()]
    conocidos = validar.leer_index()[0]
    pinta = validar.pinta
    cols = lambda f: FS.colores_de_la_fila(f, pinta, conocidos)
    idx = CM.indexar(maestro)
    hoy = datetime.date.today().isoformat()

    nuevos_prod, nuevas_var, dudosas, aconfirmar = [], [], [], []
    n = int(CM.proximo_codigo(maestro)[3:])

    # Un producto nuevo que se parece demasiado a uno que ya tiene codigo casi
    # nunca es nuevo: es el mismo con el nombre reescrito. El 11/09 el
    # proveedor le agrego "GEN2" a los Ray-Ban y dio vuelta "27\" Studio
    # Display" por "Studio Display 27\"", y los dos habrian estrenado codigo
    # al lado del que ya tenian. Un codigo de mas es para siempre y parte las
    # fotos de ese producto en dos, asi que ante el parecido NO se crea: se
    # lista para que una persona diga si es el mismo o no.
    por_mc = {}
    for m in maestro:
        por_mc.setdefault((CM.norm(m['Marca']), CM.norm(m['Categoria'])), {})[m['CODIGO']] = m

    def se_parece_a_uno_que_ya_esta(f):
        d = f.get('Descripción completa') or ''
        mejor, cuanto = None, 0
        for m in (por_mc.get((CM.norm(f.get('Marca')),
                              CM.norm(f.get('Categoría'))), {}) or {}).values():
            p = max(CM.parecido(d, m['Producto']),
                    CM.parecido(CM.sin_los_colores(d, pinta, conocidos),
                                CM.sin_los_colores(m['Producto'], pinta, conocidos)))
            if p > cuanto:
                cuanto, mejor = p, m
        return (mejor, cuanto) if mejor and cuanto >= 0.6 else (None, cuanto)

    for f in filas:
        cod, de = CM.codigo_de_la_fila(f, idx, pinta, conocidos)
        if not cod and de == 'dudoso':
            cands = idx['por_id'].get((f.get('ID') or '').strip()) or []
            dudosas.append((f, cands[0] if cands else None))
            continue
        base = {'Categoria': (f.get('Categoría') or '').strip(),
                'Marca': (f.get('Marca') or '').strip(),
                'Producto': (f.get('Descripción completa') or '').strip(),
                'ID_alta': (f.get('ID') or '').strip(),
                'SKU_alta': FS.sku_de(f),
                'Precio_alta': (f.get('Precio USD') or '').strip(),
                'Alta': hoy, 'Baja': '', 'Fusionado_en': '', 'Nota': ''}
        if not cod:
            parecido_a, cuanto = se_parece_a_uno_que_ya_esta(f)
            if parecido_a is not None:
                aconfirmar.append((f, parecido_a, cuanto))
                continue
            # producto nuevo: codigo propio y todas sus variantes de hoy
            cod = '%s-%04d' % (CM.PREFIJO, n + 1)
            n += 1
            base['CODIGO'] = cod
            variantes = cols(f)
            if not variantes:
                nuevos_prod.append(dict(base, CODIGO_VAR=cod, Variante='',
                                        Escrituras='', NumVar=''))
            else:
                for k, v in enumerate(variantes, 1):
                    nuevos_prod.append(dict(base, CODIGO_VAR='%s-%02d' % (cod, k),
                                            Variante=v, Escrituras='',
                                            NumVar='%02d' % k))
            # para que las filas hermanas de mas abajo lo encuentren
            maestro.extend(x for x in nuevos_prod if x['CODIGO'] == cod)
            idx = CM.indexar(maestro)
            continue
        # producto conocido: ¿trae alguna variante que el catalogo no tenga?
        for v in cols(f):
            if CM.variante_de(cod, v, idx):
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

    print('ALTAS DEL CATALOGO')
    print('=' * 66)
    print('planilla: %d filas   ·   catalogo: %d productos'
          % (len(filas), len({m['CODIGO'] for m in maestro})))
    print()
    print('  %4d  productos nuevos, con %d variantes entre todos'
          % (len({x['CODIGO'] for x in nuevos_prod}), len(nuevos_prod)))
    print('  %4d  variantes nuevas de productos que ya estaban' % len(nuevas_var))
    print('  %4d  A CONFIRMAR: se parecen a uno que ya tiene codigo' % len(aconfirmar))
    print('  %4d  DUDOSAS: no se tocan, las mira una persona' % len(dudosas))
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
    if nuevas_var:
        print()
        print('--- variantes nuevas ---')
        for x in nuevas_var:
            print('  %-14s %-46s %s' % (x['CODIGO_VAR'], x['Producto'][:46], x['Variante'][:24]))
    if aconfirmar:
        print()
        print('--- A CONFIRMAR antes de darles codigo nuevo ---')
        print('    Si es el mismo producto, hay que anotarle el ID de hoy al codigo')
        print('    que ya tiene. Si de verdad es otro, se le da uno nuevo a mano.')
        for f, m, c in sorted(aconfirmar, key=lambda x: -x[2]):
            print('  %-13s %-46s' % ((f.get('ID') or '').strip(),
                                     (f.get('Descripción completa') or '')[:46]))
            print('  %-13s se parece %3.0f%% a %s  %s'
                  % ('', c * 100, m['CODIGO'], (m.get('Producto') or '')[:40]))
    if dudosas:
        print()
        print('--- DUDOSAS: el vinculo apunta a otro producto ---')
        print('    O el producto cambio de gama y necesita codigo nuevo, o la')
        print('    planilla reutilizo un ID. Hay que mirarlas de a una.')
        for f, e in dudosas:
            print('  %-13s hoy: %s' % ((f.get('ID') or '').strip(),
                                       (f.get('Descripción completa') or '')[:48]))
            if e is not None:
                print('  %-13s cat: %s  (%s)' % ('', (e.get('Producto') or '')[:48], e.get('CODIGO', '')))

    if not APLICAR:
        print()
        print('Simulacion. Para agregarlos:  python herramientas/altas-catalogo.py --aplicar')
        return 0
    if not nuevos_prod and not nuevas_var:
        print('No hay nada que agregar.')
        return 0

    CM.escribir(maestro)
    CM.guardar_contador(max(n, CM.ultimo_asignado()))
    print()
    print('Agregados. El catalogo queda con %d productos y %d variantes.'
          % (len({m['CODIGO'] for m in maestro}), len(maestro)))
    print('Ahora conviene regenerar el indice:  python verificar-fotos.py')
    return 0


if __name__ == '__main__':
    sys.exit(main())
