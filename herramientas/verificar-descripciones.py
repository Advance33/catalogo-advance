#!/usr/bin/env python3
"""Ninguna descripción se publica sin pasar por el verificador (Pedro, 01/10/2026:
"creá una estructura con un agente para que no se filtren datos erróneos").

Cómo funciona:
  1. Las descripciones las escribe un agente (o una persona) en
     datos/descripciones.json, con el formato de datos/LEEME-descripciones.md.
  2. OTRO agente, el verificador (~/.claude/agents/verificador-descripciones.md),
     revisa cada dato contra la página oficial y contra la fila del proveedor y
     da un veredicto por entrada: ok / corregir / sacar.
  3. Esta herramienta registra en datos/descripciones-verificadas.json la huella
     (sha256) de cada entrada que salió "ok".
  4. La prueba pruebas/decision-descripciones.js [D.4] falla si una entrada no
     tiene su huella registrada: una descripción nueva, o una que cambió después
     de verificarse (aunque sea una coma), frena la publicación hasta que el
     verificador la vuelva a mirar. Las "notas" no cuentan para la huella.

Uso (desde la carpeta del catálogo):
  python3 herramientas/verificar-descripciones.py
      Estado: cuántas verificadas y cuáles faltan.
  python3 herramientas/verificar-descripciones.py --lotes 10 --carpeta DIR [--todas]
      Arma DIR/lote-01.json … con las pendientes (o todas) y las filas de hoy
      del sitio de cada modelo, para darle un lote a cada verificador.
  python3 herramientas/verificar-descripciones.py --registrar DIR/informe-*.json
      Registra las "ok" cuya huella coincide con la entrada de hoy. Las que no
      coinciden (la entrada cambió después) o no son "ok" se listan y no entran.
"""
import glob, hashlib, json, os, re, shutil, socket, subprocess, sys, tempfile, threading
import datetime, functools, http.server, socketserver

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESC = os.path.join(RAIZ, 'datos', 'descripciones.json')
REG = os.path.join(RAIZ, 'datos', 'descripciones-verificadas.json')
CHROMES = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
           r'C:\Program Files\Google\Chrome\Application\chrome.exe',
           r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
           r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe']


def huella(entrada):
    """sha256 del JSON canónico de la entrada, sin "notas". La prueba
    (decision-descripciones.js, pdHuella) calcula exactamente lo mismo."""
    x = {k: v for k, v in entrada.items() if k != 'notas'}
    txt = json.dumps(x, sort_keys=True, ensure_ascii=False, separators=(',', ':'))
    return hashlib.sha256(txt.encode('utf-8')).hexdigest()


def leer_registro():
    if not os.path.exists(REG):
        return {'formato': 'verificadas/1',
                'leeme': 'Huellas de las descripciones que pasaron el verificador. Lo escribe herramientas/verificar-descripciones.py; no se edita a mano.',
                'verificadas': {}}
    return json.load(open(REG, encoding='utf-8'))


def escribir_registro(r):
    r['verificadas'] = dict(sorted(r['verificadas'].items(), key=lambda kv: (kv[1].get('modelo', ''), kv[0])))
    with open(REG, 'w', encoding='utf-8') as f:
        json.dump(r, f, ensure_ascii=False, indent=1)
        f.write('\n')


def entradas():
    return json.load(open(DESC, encoding='utf-8'))['descripciones']


def estado():
    reg = leer_registro()['verificadas']
    es = entradas()
    falta = [e['modelo'] for e in es if huella(e) not in reg]
    print('%d descripciones · %d verificadas · %d sin verificar' % (len(es), len(es) - len(falta), len(falta)))
    for m in falta:
        print('   sin verificar:', m)
    return 1 if falta else 0


# ---------- Las filas de hoy del sitio (lo que dice el proveedor) ----------
SONDA = r"""<!doctype html><html><head><meta charset="utf-8"></head><body>
<iframe id="f" src="index.html" style="width:1300px;height:800px"></iframe><pre id="R">esperando</pre><script>
const t = setInterval(() => {
  const w = document.getElementById('f').contentWindow; let ok = false;
  try{ ok = w.eval('MODELOS.length && FUENTE && FUENTE.fuente === "advapp"'); }catch(e){}
  if(!ok) return; clearInterval(t);
  document.getElementById('R').textContent = JSON.stringify(w.eval(`MODELOS.map(m => ({ desc: m.desc, marca: m.marca, cat: m.cat,
    variantes: m.variantes.map(v => ({ id: v.id, codigo: String(v.codigo || '').toUpperCase(),
      nombre: [v.desc, v.modelo, v.incluye].filter(Boolean).join(' '),
      memoria: norm(memoriaDeOpcion(v.opcion || v.etiqueta) || capacidadDe(v) || ''),
      sim: norm(v.sim || ''), teclado: norm(v.teclado || ''), montura: norm(v.montura || ''),
      color: v.color || '', stock: !!v.stock })) }))`));
}, 300);
</script></body></html>"""


def filas_del_sitio():
    chrome = next((c for c in CHROMES if os.path.exists(c)), None)
    if not chrome:
        raise SystemExit('Hace falta Chrome (o Edge) para leer las filas del sitio.')
    sonda = os.path.join(RAIZ, '_sonda-verificar-%d.html' % os.getpid())   # _* no se versiona
    open(sonda, 'w', encoding='utf-8').write(SONDA)
    class Callado(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):      # sin un renglón por cada foto pedida
            pass
    srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Callado, directory=RAIZ))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        url = 'http://127.0.0.1:%d/%s' % (srv.server_address[1], os.path.basename(sonda))
        out = subprocess.run([chrome, '--headless', '--disable-gpu', '--virtual-time-budget=40000', '--dump-dom', url],
                             capture_output=True, text=True, timeout=120).stdout
    finally:
        srv.shutdown()
        os.remove(sonda)
    m = re.search(r'<pre id="R">(.*?)</pre>', out, re.S)
    import html
    txt = html.unescape(m.group(1)) if m else 'esperando'
    if txt.startswith('esperando'):
        raise SystemExit('El sitio no cargó los datos de ADVAPP: no se pueden armar los lotes.')
    return json.loads(txt)


def lotes(n, carpeta, todas):
    reg = leer_registro()['verificadas']
    es = [e for e in entradas() if todas or huella(e) not in reg]
    if not es:
        print('No hay nada para verificar.')
        return 0
    filas = filas_del_sitio()
    os.makedirs(carpeta, exist_ok=True)
    n = max(1, min(n, len(es)))
    for i in range(n):
        parte = es[i::n]
        salida = []
        for e in parte:
            cods = set(e['codigos'])
            modelos = [m for m in filas if any(v['codigo'] in cods for v in m['variantes'])]
            salida.append({'hash': huella(e), 'entrada': e,
                           'filas_de_hoy': [{'modelo_en_el_sitio': m['desc'], 'marca': m['marca'], 'rubro': m['cat'],
                                             'filas': m['variantes']} for m in modelos]})
        ruta = os.path.join(carpeta, 'lote-%02d.json' % (i + 1))
        json.dump(salida, open(ruta, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(ruta, len(parte), 'entradas')
    return 0


def registrar(rutas):
    r = leer_registro()
    hoy = {huella(e): e for e in entradas()}
    nuevas, rechazadas = 0, []
    for ruta in rutas:
        for it in json.load(open(ruta, encoding='utf-8')):
            h, v, m = it.get('hash'), it.get('veredicto'), it.get('modelo', '?')
            errores = [x for x in it.get('hallazgos', []) if x.get('gravedad') == 'error']
            if v != 'ok' or errores:
                rechazadas.append('%s: %s (%d errores)' % (m, v, len(errores)))
            elif h not in hoy:
                rechazadas.append('%s: la entrada cambió después de verificarse (huella vieja)' % m)
            else:
                r['verificadas'][h] = {'modelo': hoy[h]['modelo'], 'fecha': datetime.date.today().isoformat(),
                                       'por': 'verificador-descripciones', 'informe': os.path.basename(ruta),
                                       'fuentes': it.get('fuentes_leidas', [])}
                nuevas += 1
    # Lo que ya no está en el archivo no se arrastra
    r['verificadas'] = {h: x for h, x in r['verificadas'].items() if h in hoy}
    escribir_registro(r)
    print('%d registradas como verificadas.' % nuevas)
    for x in rechazadas:
        print('   NO registrada:', x)
    return estado()


def main():
    a = sys.argv[1:]
    if '--registrar' in a:
        rutas = [x for x in a[a.index('--registrar') + 1:] if not x.startswith('--')]
        return registrar(rutas)
    if '--lotes' in a:
        n = int(a[a.index('--lotes') + 1])
        carpeta = a[a.index('--carpeta') + 1] if '--carpeta' in a else os.path.join(tempfile.gettempdir(), 'verificar-descripciones')
        return lotes(n, carpeta, '--todas' in a)
    if '--huella' in a:            # para la autoprueba: imprime la huella de cada entrada
        for e in entradas():
            print(huella(e), e['modelo'])
        return 0
    return estado()


if __name__ == '__main__':
    sys.exit(main())
