# -*- coding: utf-8 -*-
"""Chequea que el catalogo maestro siga sano.

    python herramientas/validar-catalogo.py

Sale con 1 si encuentra algo grave. El catalogo es el unico lugar donde vive
la identidad de cada producto: si se rompe, las fotos se pierden y no hay
forma de reconstruirlo. Lo edita gente, lo edita el sheet y lo editan
scripts, asi que hay que mirarlo antes de cada publicacion.

Lo que mira:
  1. Que se pueda leer y no tenga filas rotas.
  2. Que cada CODIGO_VAR sea unico y este bien formado.
  3. Que un CODIGO no tenga dos productos distintos adentro.
  4. Que las variantes de cada producto esten numeradas sin repetir.
  5. Que dos variantes del mismo producto no se escriban igual.
  6. Que las fusiones apunten a un codigo que existe y no den vueltas.
  7. Que el contador no haya retrocedido.
  8. Que NO HAYA DESAPARECIDO ningun codigo que estaba en la version
     anterior. Este es el importante: un codigo que se va se lleva las fotos
     de ese producto, y es la clase de error que no se nota hasta que un
     cliente ve una ficha vacia.
"""
import collections
import os
import subprocess
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
sys.path.insert(0, AQUI)
sys.path.insert(0, RAIZ)
import catalogo_maestro as CM                 # noqa: E402


def version_anterior():
    """Los códigos del catálogo tal como está en el último commit."""
    try:
        r = subprocess.run(['git', 'show', 'HEAD:herramientas/catalogo-maestro.csv'],
                           cwd=RAIZ, capture_output=True)
        if r.returncode != 0 or not r.stdout:
            return None
        import csv, io
        return {f['CODIGO_VAR'].strip()
                for f in csv.DictReader(io.StringIO(r.stdout.decode('utf-8')))
                if (f.get('CODIGO_VAR') or '').strip()}
    except Exception:
        return None


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    graves, avisos = [], []

    try:
        filas = CM.leer()
    except CM.CatalogoRoto as e:
        print('CATALOGO ROTO')
        print('   %s' % e)
        return 1
    if not filas:
        print('Todavia no hay catalogo maestro. Nada que validar.')
        return 0

    # 2. codigos unicos y bien formados
    vistos = collections.Counter(f['CODIGO_VAR'] for f in filas)
    for c, n in vistos.items():
        if n > 1:
            graves.append('%s aparece %d veces' % (c, n))
    for f in filas:
        cc, cod = f['CODIGO_VAR'].strip(), (f.get('CODIGO') or '').strip()
        p = CM.partir(cc)
        if not p:
            graves.append('%s no tiene la forma AT-0000 ni AT-0000-COL' % cc)
        elif p[0] != cod:
            graves.append('%s no empieza con su CODIGO (%s)' % (cc, cod))
        elif p[1] != (f.get('NumVar') or '').strip():
            avisos.append('%s: el sufijo y la columna NumVar no coinciden' % cc)

    # 3. un codigo, un producto
    idx = CM.indexar(filas)
    por_codigo_filas = collections.defaultdict(list)
    for f in filas:
        por_codigo_filas[f['CODIGO']].append(f)
    por_codigo = collections.defaultdict(set)
    for f in filas:
        por_codigo[f['CODIGO']].add((f.get('Marca', ''), f.get('Categoria', ''), f.get('Producto', '')))
    for cod, datos in por_codigo.items():
        if len(datos) > 1:
            graves.append('%s tiene %d productos distintos adentro: %s'
                          % (cod, len(datos), ' | '.join(sorted(d[2][:40] for d in datos))))

    # 4. las variantes de cada producto: numeradas sin repetir ni saltear
    for cod, fs in por_codigo_filas.items():
        nums = [(f.get('NumVar') or '').strip() for f in fs]
        con = [x for x in nums if x]
        if len(set(con)) != len(con):
            graves.append('%s tiene dos variantes con el mismo numero' % cod)
        if con and sorted(int(x) for x in con) != list(range(1, len(con) + 1)):
            avisos.append('%s tiene la numeracion con huecos: %s' % (cod, ','.join(sorted(con))))
        if len(fs) > 1 and '' in nums:
            graves.append('%s mezcla una fila sin variante con otras que si la tienen' % cod)

    # 5. dos variantes del mismo producto que se escriben igual
    for cod, fs in por_codigo_filas.items():
        dueño = {}
        for f in fs:
            for e in CM.escrituras_de(f):
                if e in dueño and dueño[e] != f['CODIGO_VAR']:
                    graves.append('en %s, "%s" la reclaman %s y %s'
                                  % (cod, e, dueño[e], f['CODIGO_VAR']))
                dueño[e] = f['CODIGO_VAR']

    # 6. las fusiones apuntan a un codigo que existe y no hacen ciclo
    for f in filas:
        dest = (f.get('Fusionado_en') or '').strip().upper()
        if dest and dest not in por_codigo_filas:
            graves.append('%s dice estar fusionado en %s, que no existe' % (f['CODIGO_VAR'], dest))
        elif dest and CM.seguir_fusion(f['CODIGO'], idx) == f['CODIGO'] and dest != f['CODIGO']:
            graves.append('la fusion de %s da vueltas en circulo' % f['CODIGO'])

    # 7. el contador
    n_max = max((int(f['CODIGO'][3:]) for f in filas if CM.RE_CODIGO.match(f['CODIGO'])), default=0)
    contador = CM.ultimo_asignado()
    if contador < n_max:
        graves.append('el contador dice %d y el catalogo llega a %d: el proximo codigo pisaria uno usado'
                      % (contador, n_max))

    # 8. nada desaparecido
    antes = version_anterior()
    if antes is None:
        avisos.append('no se pudo leer la version anterior (¿todavia no esta en git?)')
    else:
        ahora = {f['CODIGO_VAR'] for f in filas}
        idos = sorted(antes - ahora)
        # Un producto que se sembro sin colores y estrena el primero pasa de
        # "AT-0082" a "AT-0082-01": no desaparecio, se numero. Eso es un aviso
        # y no un error, porque hay una foto que renombrar y conviene decirlo,
        # pero nada quedo huerfano.
        numerados = sorted(x for x in idos if x + '-01' in ahora)
        idos = [x for x in idos if x not in set(numerados)]
        if numerados:
            avisos.append('%d producto(s) estrenaron su primera variante: %s. '
                          'Si tenian foto <CODIGO>.jpg hay que renombrarla a <CODIGO>-01.jpg'
                          % (len(numerados), ', '.join(numerados[:8])))
        if idos:
            graves.append('%d codigo(s) que estaban en el commit anterior YA NO ESTAN: %s'
                          % (len(idos), ', '.join(idos[:8])))

    print('CATALOGO MAESTRO — chequeo')
    print('=' * 62)
    print('%d variantes, %d productos, contador en %d'
          % (len(filas), len(por_codigo), contador))
    print()
    for titulo, lista in (('GRAVE', graves), ('aviso', avisos)):
        print('%s (%d)' % (titulo, len(lista)))
        for x in lista[:30]:
            print('   %s' % x)
        if len(lista) > 30:
            print('   ... y %d mas' % (len(lista) - 30))
        print()
    if graves:
        print('El catalogo tiene errores graves. NO se puede publicar asi.')
        return 1
    print('El catalogo esta sano.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
