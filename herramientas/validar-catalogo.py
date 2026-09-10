# -*- coding: utf-8 -*-
"""Chequea que el catalogo maestro siga sano.

    python herramientas/validar-catalogo.py

Sale con 1 si encuentra algo grave. El catalogo es el unico lugar donde vive
la identidad de cada producto: si se rompe, las fotos se pierden y no hay
forma de reconstruirlo. Lo edita gente, lo edita el sheet y lo editan
scripts, asi que hay que mirarlo antes de cada publicacion.

Lo que mira:
  1. Que se pueda leer y no tenga filas rotas.
  2. Que cada CODIGO_COLOR sea unico y este bien formado.
  3. Que un CODIGO no tenga dos productos distintos adentro.
  4. Que el codigo de color exista en el diccionario.
  5. Que ninguna escritura de color pertenezca a dos colores.
  6. Que ningun codigo de color sea prefijo de otro.
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
        return {f['CODIGO_COLOR'].strip()
                for f in csv.DictReader(io.StringIO(r.stdout.decode('utf-8')))
                if (f.get('CODIGO_COLOR') or '').strip()}
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
    vistos = collections.Counter(f['CODIGO_COLOR'] for f in filas)
    for c, n in vistos.items():
        if n > 1:
            graves.append('%s aparece %d veces' % (c, n))
    for f in filas:
        cc, cod = f['CODIGO_COLOR'].strip(), (f.get('CODIGO') or '').strip()
        p = CM.partir(cc)
        if not p:
            graves.append('%s no tiene la forma AT-0000 ni AT-0000-COL' % cc)
        elif p[0] != cod:
            graves.append('%s no empieza con su CODIGO (%s)' % (cc, cod))
        elif p[1] != (f.get('CodigoColor') or '').strip():
            avisos.append('%s: el sufijo y la columna CodigoColor no coinciden' % cc)

    # 3. un codigo, un producto
    por_codigo = collections.defaultdict(set)
    for f in filas:
        por_codigo[f['CODIGO']].add((f.get('Marca', ''), f.get('Categoria', ''), f.get('Producto', '')))
    for cod, datos in por_codigo.items():
        if len(datos) > 1:
            graves.append('%s tiene %d productos distintos adentro: %s'
                          % (cod, len(datos), ' | '.join(sorted(d[2][:40] for d in datos))))

    # 4 y 5. el diccionario de colores
    dicc = CM.leer_colores()
    codigos_color = {c for c, _ in dicc.values()}
    for f in filas:
        cc = (f.get('CodigoColor') or '').strip()
        if cc and cc not in codigos_color:
            graves.append('%s usa el color %s, que no esta en catalogo-colores.csv'
                          % (f['CODIGO_COLOR'], cc))
    dueños = collections.defaultdict(set)
    import csv, io
    if os.path.exists(CM.COLORES_CSV):
        for f in csv.DictReader(io.open(CM.COLORES_CSV, encoding='utf-8', newline='')):
            for e in [f['Color']] + [x for x in (f.get('Escrituras') or '').split('|') if x]:
                if e.strip():
                    dueños[CM.norm(e)].add(f['Codigo'])
    for e, cods in dueños.items():
        if len(cods) > 1:
            graves.append('la escritura "%s" la reclaman %s' % (e, ', '.join(sorted(cods))))

    # 6. ningun codigo de color prefijo de otro
    todos = sorted(codigos_color)
    for i, a in enumerate(todos):
        for b in todos[i + 1:]:
            if b.startswith(a):
                avisos.append('los codigos de color %s y %s se confunden al leer' % (a, b))

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
        ahora = {f['CODIGO_COLOR'] for f in filas}
        idos = sorted(antes - ahora)
        if idos:
            graves.append('%d codigo(s) que estaban en el commit anterior YA NO ESTAN: %s'
                          % (len(idos), ', '.join(idos[:8])))

    print('CATALOGO MAESTRO — chequeo')
    print('=' * 62)
    print('%d filas, %d productos, %d colores, contador en %d'
          % (len(filas), len(por_codigo), len(codigos_color), contador))
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
