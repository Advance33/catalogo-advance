# -*- coding: utf-8 -*-
"""
Corre sheet-control-colores.gs de verdad, contra la planilla de verdad.

No alcanza con leerlo y decir que está bien: la primera versión de este control
era una fórmula de Google Sheets que parecía razonable y marcaba 16 filas de las
cuales 12 estaban bien cargadas. Se descubrió probándola. Así que el script se
ejecuta, con la planilla del día, y se compara contra lo que dice validar.py.
Las dos tienen que marcar EXACTAMENTE los mismos IDs: si se separan, una de las
dos le está mintiendo a alguien.

Como no hay Node, se usa el mismo Chrome headless que corre las tandas.

    python herramientas/probar-control-sheet.py
"""
import io
import os
import re
import sys
import csv
import json
import html
import shutil
import tempfile
import subprocess
import urllib.request

AQUI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, AQUI)
import validar                                            # noqa: E402
sys.path.insert(0, os.path.join(AQUI, 'pruebas'))
import correr                                             # noqa: E402

GS = os.path.join(AQUI, 'sheet-control-colores.gs')

ARNES = u"""<!doctype html><meta charset="utf-8"><body>
<script>
var DATOS = __DATOS__;
var fondos = {}, notas = {};

/* Stub de lo poco que el script usa de la planilla. */
var SpreadsheetApp = {
  getActive: function(){ return { getSheetByName: function(n){
    return n === 'Landing' ? hoja : null; } }; },
  getUi: function(){ return { createMenu: function(){ return {
    addItem: function(){ return this; }, addToUi: function(){} }; } }; }
};
var hoja = {
  getName: function(){ return 'Landing'; },
  getDataRange: function(){ return { getValues: function(){ return DATOS; } }; },
  getLastRow: function(){ return DATOS.length; },
  getRange: function(a1){
    var m = /^([A-Z]+)(\\d+):([A-Z]+)(\\d+)$/.exec(a1);
    var letra = m[1], desde = +m[2], hasta = +m[4], n = hasta - desde + 1;
    var mio = function(d){ return d[letra] || (d[letra] = {}); };
    return {
      getBackgrounds: function(){
        var f = []; for(var i=0;i<n;i++) f.push([mio(fondos)[desde+i] || null]); return f; },
      getNotes: function(){
        var f = []; for(var i=0;i<n;i++) f.push([mio(notas)[desde+i] || '']); return f; },
      setBackgrounds: function(v){
        for(var i=0;i<n;i++) mio(fondos)[desde+i] = v[i][0]; },
      setNotes: function(v){
        for(var i=0;i<n;i++) mio(notas)[desde+i] = v[i][0]; }
    };
  }
};
</script>
<script>
__SCRIPT__
</script>
<script>
var salida = [];
try {
  revisarColores();
  var pintadas = [];
  Object.keys(fondos.A || {}).forEach(function(linea){
    if(fondos.A[linea]) pintadas.push({
      linea: +linea,
      id: String(DATOS[linea-1][0]).trim(),
      nota: (notas.G || {})[linea] || ''
    });
  });
  pintadas.sort(function(a,b){ return a.linea - b.linea; });
  salida.push('IDS ' + JSON.stringify(pintadas.map(function(p){ return p.id; })));
  pintadas.forEach(function(p){
    salida.push('  fila ' + p.linea + '  ' + p.id + '  ->  ' +
                p.nota.replace(/\\n/g, ' '));
  });
} catch(e) { salida.push('EXCEPCION: ' + (e && e.stack || e)); }
var pre = document.createElement('pre');
pre.id = 'RESULTADO'; pre.textContent = salida.join('\\n');
document.body.appendChild(pre);
</script>
</body>"""


def bajar_matriz():
    url = ('https://docs.google.com/spreadsheets/d/%s/export?format=csv&gid=%s'
           % (validar.SHEET_ID, validar.SHEET_GID))
    crudo = urllib.request.urlopen(url, timeout=60).read().decode('utf-8')
    return list(csv.reader(io.StringIO(crudo)))


def ids_de_validar():
    """Los IDs que validar.py marca por color repetido con distinto precio."""
    filas = validar.bajar_csv()
    ctx = validar.leer_index()
    ids = set()
    for nivel, id_, texto in validar.regla_color_por_precio(filas, ctx):
        ids.add(id_)
        for otro in re.findall(r'\b[A-Z]{2,4}-[A-Z]{2,4}-\d{3}\b', texto):
            ids.add(otro)
    return ids


"""Los casos de prueba, inventados a propósito.

Si la prueba sólo corriera contra la planilla del día, el día que esté todo bien
el script no marcaría nada y diría OK sin haber comprobado nada. Ya pasó con
otra prueba de este repo que miraba una ficha que nunca tenía el problema.

La primera versión de esto inyectaba el error sobre las filas reales del iPhone
17 Pro. Duró un día: el 08/09/2026 se dio de baja el 512GB Silver y la prueba
quedó trabada pidiendo un ID que ya no existe. Los casos van inventados, con
IDs que no pueden chocar con la planilla, así que Pedro puede editar lo que
quiera sin romper la prueba.

Cada caso es (id, capacidad, precio, color, teclado, si_tiene_que_marcar)."""
CASOS = [
    # Dos filas idénticas con distinto precio: el color tiene dos precios.
    ('ZZ-PRU-001', '256gb', '100', 'Orange', 'EN', True),
    ('ZZ-PRU-002', '256gb', '110', 'Orange', 'EN', True),
    # Los colores se SOLAPAN sin ser iguales: el Blue queda con dos precios.
    # Es el caso que una comparación por igualdad exacta dejaba pasar.
    ('ZZ-PRU-003', '512gb', '200', 'Orange/Blue', 'EN', True),
    ('ZZ-PRU-004', '512gb', '210', 'Blue', 'EN', True),
    # Mismo color y distinto precio, pero distinto TECLADO: son dos productos.
    # Sin este caso, el 08/09/2026 el control marcó cuatro MacBook bien cargadas.
    ('ZZ-PRU-005', '1tb', '300', 'Silver', 'EN', False),
    ('ZZ-PRU-006', '1tb', '330', 'Silver', 'ES', False),
    # Colores repartidos como corresponde: nadie comparte nada.
    ('ZZ-PRU-007', '2tb', '400', 'Citrus', 'EN', False),
    ('ZZ-PRU-008', '2tb', '420', 'Indigo', 'EN', False),
]
GRUPO_PRUEBA = 'zz-producto-de-prueba'
DEBEN_MARCAR = {c[0] for c in CASOS if c[5]}

"""Filas bien cargadas que el control NO tiene que tocar. Es el ancla de la
prueba: comparar el script contra validar.py no alcanza, porque si los dos se
equivocan igual coinciden y la prueba dice OK. Pasó el 08/09/2026 con las
MacBook, cuando a los dos les faltaba mirar la columna Teclado.

Las SW/GAF/TAB/CAM son las que una fórmula de Sheets marcaba mal: ahí lo que
separa a las filas es la correa, el código del armazón o la capacidad, no el
color. Las NB-APP son pares EN/ES: mismo color, distinto teclado, distinto
precio, todo correcto."""
BIEN = ['SW-APP-013', 'SW-APP-014', 'SW-APP-019', 'SW-APP-056',
        'GAF-RAY-023', 'GAF-RAY-025', 'GAF-RAY-026',
        'TAB-APP-001', 'TAB-APP-002', 'TAB-APP-042',
        'CAM-NIK-015', 'CAM-NIK-020',
        'NB-APP-001', 'NB-APP-088', 'NB-APP-002', 'NB-APP-089',
        'NB-APP-018', 'NB-APP-093', 'NB-APP-021', 'NB-APP-094']


def con_casos(matriz):
    """La planilla del día más las filas de prueba, al final."""
    enc = [str(c).strip() for c in matriz[0]]
    faltan = [c for c in ('ID', 'Descripción completa', 'Precio USD', 'Color',
                          'Teclado', 'Condición', 'Incluye', 'Grupo') if c not in enc]
    if faltan:
        raise SystemExit('a la planilla le faltan columnas que el control necesita: %s'
                         % ', '.join(faltan))
    copia = [list(f) for f in matriz]
    for id_, capacidad, precio, color, teclado, _ in CASOS:
        fila = [''] * len(enc)
        fila[enc.index('ID')] = id_
        fila[enc.index('Descripción completa')] = ('Producto De Prueba %s (%s)'
                                                   % (capacidad, color))
        fila[enc.index('Precio USD')] = precio
        fila[enc.index('Color')] = color
        fila[enc.index('Teclado')] = teclado
        fila[enc.index('Grupo')] = GRUPO_PRUEBA
        copia.append(fila)
    return copia


def correr_gs(matriz):
    """Ejecuta el .gs de verdad sobre esa matriz y devuelve (ids, texto)."""
    gs = io.open(GS, 'rb').read().decode('utf-8')
    pagina = (ARNES.replace('__DATOS__', json.dumps(matriz, ensure_ascii=False))
                   .replace('__SCRIPT__', gs))
    destino = os.path.join(AQUI, '_control.html')
    io.open(destino, 'wb').write(pagina.encode('utf-8'))

    perfil = tempfile.mkdtemp(prefix='ctrl-')
    try:
        correr.levantar_servidor()
        dom = subprocess.run(
            [correr.buscar_chrome(), '--headless', '--disable-gpu', '--no-first-run',
             '--user-data-dir=' + perfil, '--incognito', '--disk-cache-size=1',
             '--virtual-time-budget=60000', '--dump-dom',
             'http://localhost:8765/_control.html'],
            capture_output=True, timeout=300).stdout.decode('utf-8', 'replace')
    finally:
        shutil.rmtree(perfil, ignore_errors=True)
        if os.path.exists(destino):
            try:
                os.remove(destino)
            except OSError:
                pass

    m = re.search(r'<pre id="RESULTADO">(.*?)</pre>', dom, re.S)
    if not m:
        raise SystemExit('el script no llego a correr en el navegador')
    texto = html.unescape(m.group(1))
    linea = texto.split('\n')[0]
    if not linea.startswith('IDS '):
        raise SystemExit(texto)
    return set(json.loads(linea[4:])), texto


def main():
    matriz = bajar_matriz()
    fallas = []

    # 1. Con los casos armados a mano: marca los que tienen el error y sólo esos.
    ids, texto = correr_gs(con_casos(matriz))
    print('--- con los casos de prueba puestos ---')
    print(texto)
    marco = {i for i in ids if i.startswith('ZZ-PRU-')}
    if marco != DEBEN_MARCAR:
        de_menos = sorted(DEBEN_MARCAR - marco)
        de_mas = sorted(marco - DEBEN_MARCAR)
        if de_menos:
            fallas.append('no marco el error en: %s' % ', '.join(de_menos))
        if de_mas:
            fallas.append('marco filas que estan bien: %s' % ', '.join(de_mas))

    # 2. Con la planilla de hoy: tiene que decir lo mismo que validar.py.
    ids_hoy, _ = correr_gs(matriz)
    del_py = ids_de_validar()
    print('\n--- con la planilla de hoy ---')
    print('  script del Sheet : %s' % (', '.join(sorted(ids_hoy)) or 'ninguno'))
    print('  validar.py       : %s' % (', '.join(sorted(del_py)) or 'ninguno'))
    if ids_hoy != del_py:
        fallas.append('hoy el Sheet marca %s y validar.py %s'
                      % (sorted(ids_hoy) or 'nada', sorted(del_py) or 'nada'))

    # 3. Y en ninguno de los dos casos puede tocar las que están bien. Esto no
    #    depende de validar.py a propósito: si los dos se equivocan igual,
    #    coinciden y el punto 2 no se entera.
    coladas = sorted((ids | ids_hoy) & set(BIEN))
    if coladas:
        fallas.append('marco de mas: %s' % ', '.join(coladas))

    print()
    if fallas:
        for f in fallas:
            print('FALLA  %s' % f)
        return 1
    print('OK  marca los %d casos con el error y no los %d que estan bien'
          % (len(DEBEN_MARCAR), len(CASOS) - len(DEBEN_MARCAR)))
    print('OK  dice lo mismo que validar.py con la planilla de hoy')
    print('OK  no toca las %d filas reales que ya se marcaron mal alguna vez' % len(BIEN))
    return 0


if __name__ == '__main__':
    sys.exit(main())
