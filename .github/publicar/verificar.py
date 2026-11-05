# -*- coding: utf-8 -*-
"""Antes de publicar: la copia sin comentarios anda igual que el index.html del repo.

    python3 .github/publicar/verificar.py CARPETA_DEL_REPO CARPETA_A_PUBLICAR

Lo corre el workflow .github/workflows/publicar.yml (auditoría 04/11/2026,
TG-04). Sale con 1, y el workflow NO publica, si:
  1. a la copia le falta algún archivo del repo, o alguno es distinto (todos
     tienen que ser iguales byte a byte, salvo index.html, y los ocultos que
     empiezan con punto, que no se publican);
  2. la portada sin comentarios tira errores de JavaScript que la del repo no
     tira, o no dibuja lo que dibuja la del repo: los productos, los rubros de
     la portada, la grilla de "Ver todo el catálogo" y una ficha abierta.
Las dos portadas se abren en Chrome sin ventana, con los datos de ADVAPP de
ese momento y con la medición apagada (ANALITICA_URL vacío): una prueba no
cuenta como visita. Si ADVAPP no contesta, las dos muestran el aviso y lo que
se compara es que ninguna tire errores.
"""
import functools
import hashlib
import html
import http.server
import json
import os
import re
import shutil
import socketserver
import subprocess
import sys
import threading

REPO, SITIO = (os.path.abspath(x) for x in sys.argv[1:3])
NOMBRE = '_verificar-publicacion.html'

ANTES = r"""<script>
window.__errores = [];
addEventListener('error', e => { if(e instanceof ErrorEvent) __errores.push(String(e.message) + ' @' + (e.lineno || '?')); });
addEventListener('unhandledrejection', e => __errores.push('promesa: ' + String(e.reason && e.reason.message || e.reason)));
</script>"""

DESPUES = r"""<script>
(() => {
  const t0 = Date.now(), espera = ms => new Promise(r => setTimeout(r, ms));
  const listo = () => { try{ return (MODELOS.length > 0 && document.querySelectorAll('#mosaico .rubro').length > 0) ||
                                     document.body.classList.contains('sin-catalogo'); }catch(e){ return false; } };
  (async () => {
    while(!listo() && Date.now() - t0 < 45000) await espera(200);
    const r = { listo: listo(), sinCatalogo: document.body.classList.contains('sin-catalogo') };
    try{
      r.modelos = MODELOS.length;
      r.rubros = document.querySelectorAll('#mosaico .rubro').length;
      r.chips = document.querySelectorAll('#cats .chip').length;
      r.ofertas = document.querySelectorAll('#of-pista .of-slide').length;
      if(r.modelos){
        verTodoElCatalogo();
        await espera(500);
        r.tarjetas = document.querySelectorAll('#grid .card').length;
        abrirFicha(clave(MODELOS[0].rep));
        await espera(500);
        r.ficha = !!document.getElementById('ficha');
      }
    }catch(e){ __errores.push('verificacion: ' + e.message); }
    r.errores = __errores;
    const p = document.createElement('pre'); p.id = 'VERIFICACION'; p.textContent = JSON.stringify(r);
    document.body.appendChild(p);
  })();
})();
</script>"""


def fallar(motivo):
    print('NO SE PUBLICA: ' + motivo)
    sys.exit(1)


def huella(ruta):
    h = hashlib.sha256()
    with open(ruta, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


# ---- 1. La copia tiene todo el sitio ----
archivos = subprocess.run(['git', '-C', REPO, 'ls-files', '-z'], capture_output=True, check=True).stdout.decode('utf-8').split('\0')
archivos = [a for a in archivos if a and not any(p.startswith('.') for p in a.split('/'))]
faltan, distintos = [], []
for a in archivos:
    s = os.path.join(SITIO, a)
    if not os.path.isfile(s):
        faltan.append(a)
    elif a != 'index.html' and (os.path.getsize(s) != os.path.getsize(os.path.join(REPO, a)) or huella(s) != huella(os.path.join(REPO, a))):
        distintos.append(a)
if faltan or distintos:
    fallar('a la copia le faltan %d archivos y %d son distintos (%s)' % (len(faltan), len(distintos), ', '.join((faltan + distintos)[:5])))
for imprescindible in ('index.html', '404.html', 'CNAME', 'robots.txt', 'sitemap.xml'):
    if not os.path.isfile(os.path.join(SITIO, imprescindible)):
        fallar('falta ' + imprescindible)
print('La copia tiene los %d archivos del sitio (iguales salvo index.html).' % len(archivos))


# ---- 2. Las dos portadas en Chrome ----
def chrome():
    for c in (os.environ.get('CHROME'), 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser',
              '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'):
        if c and (shutil.which(c) or os.path.isfile(c)):
            return shutil.which(c) or c
    fallar('no encontré Chrome')


def pagina_de_prueba(carpeta):
    src = open(os.path.join(carpeta, 'index.html'), encoding='utf-8').read()
    src, n = re.subn(r"^(let ANALITICA_URL = )'[^'\r\n]*';", r"\1'';", src, count=1, flags=re.M)
    if n != 1:
        # La copia sin comentarios va en una línea por script: se busca igual, sin el ^
        src, n = re.subn(r"(\blet ANALITICA_URL\s*=\s*)(['\"])[^'\"]*\2", r"\1''", src, count=1)
    if n != 1:
        fallar('no encontré ANALITICA_URL en %s/index.html: no se prueba con la medición prendida' % carpeta)
    m = re.search(r'<head(?:\s[^>]*)?>', src)
    if not m or '</body>' not in src:
        fallar('%s/index.html no tiene <head> o </body>' % carpeta)
    src = src[:m.end()] + ANTES + src[m.end():]
    i = src.rindex('</body>')
    src = src[:i] + DESPUES + src[i:]
    with open(os.path.join(carpeta, NOMBRE), 'w', encoding='utf-8') as f:
        f.write(src)


class Callado(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def abrir(carpeta):
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Callado, directory=carpeta))
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        url = 'http://127.0.0.1:%d/%s' % (srv.server_address[1], NOMBRE)
        perfil = os.path.join(os.environ.get('RUNNER_TEMP') or '/tmp', 'perfil-verificar-%d' % srv.server_address[1])
        cmd = [chrome(), '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
               '--user-data-dir=' + perfil, '--window-size=1280,900', '--virtual-time-budget=60000', '--dump-dom', url]
        try:
            out = subprocess.run(cmd, capture_output=True, timeout=150).stdout.decode('utf-8', 'replace')
        except subprocess.TimeoutExpired:
            fallar('Chrome no terminó de abrir %s en 150 s' % carpeta)
        finally:
            shutil.rmtree(perfil, ignore_errors=True)
        m = re.search(r'<pre id="VERIFICACION">(.*?)</pre>', out, re.S)
        if not m:
            fallar('la portada de %s no llegó a dar su resultado (¿no cargó el script?)' % carpeta)
        return json.loads(html.unescape(m.group(1)))
    finally:
        srv.shutdown()
        srv.server_close()


try:
    pagina_de_prueba(REPO)
    pagina_de_prueba(SITIO)
    fuente = abrir(REPO)
    print('Del repo:          ' + json.dumps(fuente, ensure_ascii=False))
    copia = abrir(SITIO)
    print('Sin comentarios:   ' + json.dumps(copia, ensure_ascii=False))
finally:
    for c in (REPO, SITIO):
        try:
            os.remove(os.path.join(c, NOMBRE))
        except OSError:
            pass

if len(copia['errores']) > len(fuente['errores']):
    fallar('la portada sin comentarios tira errores de JavaScript que la del repo no tira: ' + ' | '.join(copia['errores'][:3]))
if not copia['listo']:
    fallar('la portada sin comentarios no terminó de cargar')
if fuente['listo'] and not fuente['sinCatalogo']:
    if copia['sinCatalogo'] or not copia.get('modelos'):
        fallar('la del repo dibujó %s modelos y la sin comentarios ninguno' % fuente.get('modelos'))
    if abs(copia['modelos'] - fuente['modelos']) > 5:
        fallar('la del repo dibujó %d modelos y la sin comentarios %d' % (fuente['modelos'], copia['modelos']))
    for k in ('rubros', 'tarjetas'):
        if not copia.get(k):
            fallar('la portada sin comentarios no dibujó %s (la del repo: %s)' % (k, fuente.get(k)))
    if fuente.get('ficha') and not copia.get('ficha'):
        fallar('la portada sin comentarios no abrió la ficha')
elif fuente['sinCatalogo']:
    print('ADVAPP no contestó: se comparó solo que ninguna de las dos tire errores.')
print('OK: la portada sin comentarios anda igual que la del repo.')
