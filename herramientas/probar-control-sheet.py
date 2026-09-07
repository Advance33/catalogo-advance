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


"""Las filas del 17 Pro tal como estaban ROTAS el 07/09/2026, antes de que se
repartieran los colores. Se vuelven a inyectar a propósito: si sólo se corriera
contra la planilla del día, el día que esté todo bien el script no marcaría nada
y la prueba diría OK sin haber comprobado absolutamente nada. Ya pasó con otra
prueba de este repo que miraba una ficha que nunca tenía el problema."""
ROTAS = {
    'CEL-APP-068': ('iPhone 17 Pro 256GB E-Sim (Orange/Blue/Silver)', 'Orange/Blue/Silver'),
    'CEL-APP-069': ('iPhone 17 Pro 256GB E-Sim (Blue/Silver/Orange)', 'Blue/Silver/Orange'),
    'CEL-APP-071': ('iPhone 17 Pro 512GB (Orange/Silver)', 'Orange/Silver'),
    'CEL-APP-072': ('iPhone 17 Pro 512GB (Silver)', 'Silver'),
}

"""Las que una fórmula de Sheets marcaba mal y este script NO tiene que tocar.
Son el motivo por el que el control lleva la lista de colores del catálogo: acá
lo que separa a las filas es la correa, el código del armazón o la capacidad, no
el color."""
BIEN = ['SW-APP-013', 'SW-APP-014', 'SW-APP-019', 'SW-APP-056',
        'GAF-RAY-023', 'GAF-RAY-025', 'GAF-RAY-026',
        'TAB-APP-001', 'TAB-APP-002', 'TAB-APP-042',
        'CAM-NIK-015', 'CAM-NIK-020']


def romper(matriz):
    """Devuelve una copia con el 17 Pro cargado como estaba cuando fallaba."""
    enc = [str(c).strip() for c in matriz[0]]
    iid, ides, icol = (enc.index('ID'), enc.index('Descripción completa'),
                       enc.index('Color'))
    copia = [list(f) for f in matriz]
    tocadas = 0
    for f in copia[1:]:
        vieja = ROTAS.get(str(f[iid]).strip())
        if vieja:
            f[ides], f[icol] = vieja
            tocadas += 1
    if tocadas != len(ROTAS):
        raise SystemExit('esperaba encontrar %d filas del 17 Pro y encontre %d: '
                         'cambiaron los IDs en la planilla' % (len(ROTAS), tocadas))
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

    # 1. Con la planilla rota a propósito: tiene que marcar los cuatro.
    ids, texto = correr_gs(romper(matriz))
    print('--- con el 17 Pro cargado mal (a proposito) ---')
    print(texto)
    if ids != set(ROTAS):
        fallas.append('con el error puesto marco %s y esperaba %s'
                      % (sorted(ids) or 'nada', sorted(ROTAS)))

    # 2. Con la planilla de hoy: tiene que decir lo mismo que validar.py.
    ids_hoy, texto_hoy = correr_gs(matriz)
    del_py = ids_de_validar()
    print('\n--- con la planilla de hoy ---')
    print('  script del Sheet : %s' % (', '.join(sorted(ids_hoy)) or 'ninguno'))
    print('  validar.py       : %s' % (', '.join(sorted(del_py)) or 'ninguno'))
    if ids_hoy != del_py:
        fallas.append('hoy el Sheet marca %s y validar.py %s'
                      % (sorted(ids_hoy) or 'nada', sorted(del_py) or 'nada'))

    # 3. Y en ninguno de los dos casos puede tocar las que estan bien.
    coladas = sorted((ids | ids_hoy) & set(BIEN))
    if coladas:
        fallas.append('marco de mas: %s' % ', '.join(coladas))

    print()
    if fallas:
        for f in fallas:
            print('FALLA  %s' % f)
        return 1
    print('OK  marca los 4 cuando el error esta')
    print('OK  dice lo mismo que validar.py con la planilla de hoy')
    print('OK  no toca las %d filas que una formula marcaba mal' % len(BIEN))
    return 0


if __name__ == '__main__':
    sys.exit(main())
