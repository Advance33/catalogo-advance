# -*- coding: utf-8 -*-
"""Corre las pruebas del catalogo con los datos de hoy.

Cada archivo .js de esta carpeta es una tanda de comprobaciones. Se inyecta
antes de </body> en una copia del index.html y se abre con Chrome sin ventana;
la tanda escribe el resultado en un <pre id="RESULTADO"> y de ahi lo leemos.
La pagina baja los productos de ADVAPP (si ADVAPP falla, la copia de este
navegador, o el aviso: desde la 1.3 A del 29/09 nunca la planilla), asi que
hace falta internet.

Se corre con doble clic en "PROBAR.command", o a mano:  python3 pruebas/correr.py

Otro puerto (29/09):  python3 pruebas/correr.py --puerto 9130
(o con la variable de entorno PRUEBAS_PUERTO=9130). Sin nada, el 8765 de
siempre. Dos corridas a la vez no se pisan: cada tanda de cada corrida tiene
su propia copia (_probe-<pid>-<tanda>.html).

Hace falta servir por HTTP: con file:// la funcion urlFoto() descarta todo lo
que no sea http(s) y ademas el navegador no deja bajar los datos.
Si el servidor no esta levantado, este script lo levanta y lo deja andando.

EL RESUMEN (Pedro eligio 7.1 C el 29/09, muestra pruebas.html): arriba va
solo lo que falla, y abajo tres grupos: NUEVAS, fila por fila con el nombre
del producto; CONOCIDAS (ya pedidas), una linea por pedido con los dias que
lleva; y ARREGLADAS. Todas las lineas tienen 50 caracteres o menos, para que
se lea tambien a ancho de celular (la unica excepcion es la CLAVE, que se
copia entera). Lo que ya se pidio se anota a mano con
herramientas/fallas-conocidas.py (7.4 B), que es tambien el que clasifica; el
detalle fila por fila queda en pruebas/conocidas.json. Mientras corre, el
avance va en una sola linea que se reescribe (por stderr).

    --detalle     ademas, cada FALLA tal cual, como antes del 29/09 (la
                  revision diaria lo usa para su log)
    --json RUTA   la clasificacion en un JSON (la lee la revision diaria).
                  Siempre queda tambien en pruebas/_ultima-corrida.json, que
                  es lo que mira fallas-conocidas.py para anotar, y en
                  pruebas/_ultima-corrida-<puerto>.json (la de ese puerto:
                  fallas-conocidas.py --puerto N).

Devuelve 0 si pasa todo; 1 si hay algo NUEVO (tambien una tanda que no llego
a correr o que revento): PUBLICAR pregunta "Publicar igual?"; 3 si lo unico
que falla ya esta pedido: PUBLICAR sigue sin preguntar (7.2 B); 2 si no se
pudo correr. correr.py nunca anota una conocida: solo pasa a "arregladas" las
que dejaron de fallar. Si no puede cargar el clasificador, todo cuenta como
nuevo, como antes.
"""
import html, tempfile, shutil
import datetime
import glob
import importlib.util
import io
import json
import os
import re
import subprocess
import sys
import textwrap
import threading
import time
import urllib.error
import urllib.request

AQUI    = os.path.dirname(os.path.abspath(__file__))
RAIZ    = os.path.dirname(AQUI)
INDEX   = os.path.join(RAIZ, 'index.html')
PUERTO  = 8765
PUERTO_DE_SIEMPRE = 8765      # el de servidor.py, "ABRIR CATALOGO" y los CORS de ADVAPP


def puerto_pedido(argv, entorno, por_defecto):
    """El puerto de esta corrida: "--puerto N" (o "--puerto=N") en la linea de
    comandos, si no la variable PRUEBAS_PUERTO, si no el de siempre.

    29/09 (auditoria, hallazgo 183): era fijo, y para correr las pruebas de
    una copia del repo sin tocar el servidor de la Mac habia que editar este
    archivo. None si lo pedido no es un puerto."""
    valor = None
    for i, a in enumerate(argv):
        if a == '--puerto' and i + 1 < len(argv):
            valor = argv[i + 1]
        elif a.startswith('--puerto='):
            valor = a.split('=', 1)[1]
    if valor is None:
        valor = (entorno.get('PRUEBAS_PUERTO') or '').strip() or por_defecto
    try:
        n = int(valor)
    except (TypeError, ValueError):
        return None
    return n if 0 < n < 65536 else None


PUERTO  = puerto_pedido(sys.argv[1:], os.environ, PUERTO)
BASE    = 'http://localhost:%d' % (PUERTO or 0)

# La copia de cada tanda. Hasta el 29/09 era siempre RAIZ/_probe.html: la
# revision de las 14:00 y un PUBLICAR a mano (o dos sondas) escribian el mismo
# archivo, y una corrida podia leer la tanda de la otra con su nombre, o
# encontrarse el archivo borrado por el final de la otra y decir "NO LLEGO A
# CORRER". Con el PID y la tanda en el nombre cada una tiene la suya, y cada
# una borra solo las suyas. (.gitignore ya deja afuera todo lo que empieza con
# guion bajo.)
PREFIJO_PROBE = '_probe-%d-' % os.getpid()
# La pagina sola, con la medicion apagada, para los iframes (ver armar_pagina)
PAGINA_SIN_MEDIR = '_probe-%d.html' % os.getpid()

# El orden importa solo para leer la salida: primero lo que mas se rompe.
# El presupuesto es cuanto reloj virtual se le da a cada tanda: layout abre
# el catalogo entero cuatro veces (una por ancho) y espera a que cada una
# termine de dibujar, asi que necesita bastante mas que las demas.
ORDEN = ['agrupacion', 'portada', 'extras', 'precios', 'color-precio', 'foto-color', 'codigos', 'nombres', 'meta', 'sugeridos', 'destacada', 'carrusel', 'layout']
PRESUPUESTO = {'layout': 200, 'extras': 150, 'foto-color': 150, 'links': 170}   # segundos; el resto usa el de correr()
# extras hace varios clicks y cada uno repinta la portada entera (seis filas
# de doce productos con foto), asi que con los 90 de base no llegaba.
# links (29/09) abre la pagina cuatro veces mas en iframes, cada una bajando
# el catalogo entero.

CHROMES = [
    # Mac (la mudanza del 23/09/2026). Van primero porque en Windows no
    # existen y se saltean solas; al reves pasa lo mismo.
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    os.path.expanduser('~/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    # Windows
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    os.path.expandvars(r'%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe'),
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
]


def buscar_chrome():
    for c in CHROMES:
        if os.path.exists(c):
            return c
    return None


def servidor_vivo():
    try:
        urllib.request.urlopen(BASE + '/index.html', timeout=2).read(1)
        return True
    except Exception:
        return False


def sirve_esta_carpeta(nombre, contenido):
    """(29/09, revision) Si el servidor que contesta en BASE sirve ESTA
    carpeta: pide la copia apagada que esta corrida acaba de escribir
    (PAGINA_SIN_MEDIR, con su PID en el nombre) y la compara byte a byte.
    Antes se aceptaba cualquier servidor que tuviera un index.html: uno de
    otra copia del catalogo en el mismo puerto contestaba, las copias de las
    tandas daban 404 y los archivos que leen las guardas (fotos/indice.json,
    p/indice.json, los .py) salian de la carpeta equivocada."""
    try:
        return urllib.request.urlopen(BASE + '/' + nombre, timeout=5).read() == contenido
    except Exception:
        return False


def levantar_servidor():
    """Levanta servidor.py en segundo plano. Devuelve el proceso, o None si ya estaba."""
    if servidor_vivo():
        return None
    if PUERTO == PUERTO_DE_SIEMPRE:
        cmd = [sys.executable, os.path.join(RAIZ, 'servidor.py')]
    else:
        # servidor.py escucha siempre en el 8765. Para otro puerto se levanta
        # el mismo (su SinCache, solo en 127.0.0.1) en ese puerto, y tambien
        # queda andando: si fuera de esta corrida y se apagara al terminar,
        # otra corrida que lo estuviera usando se quedaria sin pagina a mitad
        # de camino (29/09).
        cmd = [sys.executable, '-c',
               'import functools, socketserver, sys; sys.dont_write_bytecode = True; '
               'sys.path.insert(0, %r); import servidor; '
               'socketserver.ThreadingTCPServer.allow_reuse_address = True; '
               'socketserver.ThreadingTCPServer.daemon_threads = True; '
               'socketserver.ThreadingTCPServer(("127.0.0.1", %d), '
               'functools.partial(servidor.SinCache, directory=%r)).serve_forever()'
               % (RAIZ, PUERTO, RAIZ)]
    p = subprocess.Popen(cmd, cwd=RAIZ, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(25):
        time.sleep(0.4)
        if servidor_vivo():
            return p
    p.terminate()
    raise SystemExit('No se pudo levantar el servidor local en el puerto %d.' % PUERTO)


# La medicion va apagada en TODAS las copias de prueba (29/09, hallazgo 187).
# Encenderla es poner la direccion en ANALITICA_URL y publicar; con eso, cada
# corrida de pruebas (cada PUBLICAR y la revision de las 14:00) le mandaria a
# ADVAPP visitas, fichas y busquedas falsas desde localhost, ensuciando justo
# lo que se quiere medir. analitica.js la enciende a mano contra un envio
# interceptado, que es lo unico que necesita.
RE_ANALITICA = re.compile(r"^(let ANALITICA_URL = )'[^'\r\n]*';", re.M)

# Varias tandas (layout, menu, las guardas b3 y b7, links) abren la pagina
# otra vez en un iframe con src = 'index.html', y esa es la de verdad: con la
# medicion encendida, cada una mandaria su visita. Antes de la tanda va este
# script, que cambia esa direccion por la copia apagada y deja igual el ?... y
# el #... del link. La tanda no se entera.
IFRAMES_A_LA_COPIA = '''<script>
/* correr.py (29/09): los iframes que abren index.html abren la copia con la
   medicion apagada, con la misma ?busqueda y el mismo #p=. */
(() => {
  const copia = '%s';
  const d = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
  Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
    configurable: true, enumerable: d.enumerable,
    get(){ return d.get.call(this); },
    set(v){
      try{
        const u = new URL(v, location.href);
        if(u.origin === location.origin && /\\/index\\.html$/.test(u.pathname)){
          u.pathname = u.pathname.replace(/index\\.html$/, copia);
          v = u.href;
        }
      }catch(e){}
      d.set.call(this, v);
    }
  });
})();
</script>
'''


# Los nombres de las filas (29/09, muestra 7.1 C). El resumen nombra cada
# fila nueva por su producto, y eso lo sabe la pagina, no la tanda: cuando la
# tanda escribe su RESULTADO, este script anota aparte, en un <pre> escondido,
# el nombre de cada producto que ese RESULTADO nombra por su ID. Las tandas no
# cambian. La forma del ID es la de RE_ID en herramientas/fallas-conocidas.py.
# Anota tambien de donde saco los datos la pagina (FUENTE.fuente): con ADVAPP
# caido, lo que se le pidio a ADVAPP puede no verse, y eso no es "arreglado".
NOMBRES_FILAS = '''<script>
/* correr.py (29/09, muestra 7.1): los nombres de las filas que nombra el
   RESULTADO, para el resumen de las pruebas. */
(() => {
  const anotar = pre => {
    const nombres = {};
    try{
      const vistos = new Set((pre.textContent || '').match(/[A-Z0-9]+(?:-[A-Z0-9]+)+/g) || []);
      for(const p of (typeof PRODUCTOS !== 'undefined' ? PRODUCTOS : [])){
        if(!p || !vistos.has(p.id) || nombres[p.id]) continue;
        const d = String(p.desc || p.id), c = String(p.color || '');
        nombres[p.id] = c && !d.toLowerCase().includes(c.toLowerCase()) ? d + ' (' + c + ')' : d;
      }
    }catch(e){}
    const x = document.createElement('pre');
    x.id = 'NOMBRES_FILAS';
    x.hidden = true;
    try{ x.dataset.fuente = (typeof FUENTE !== 'undefined' && FUENTE && FUENTE.fuente) || ''; }catch(e){}
    x.textContent = JSON.stringify(nombres);
    document.body.appendChild(x);
  };
  const obs = new MutationObserver(() => {
    const pre = document.getElementById('RESULTADO');
    if(pre){ obs.disconnect(); anotar(pre); }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
</script>
'''


def pagina_sin_medir():
    """El index.html con la medicion apagada, en texto."""
    # En binario para no tocar los finales de linea del index.html
    src = io.open(INDEX, 'rb').read().decode('utf-8')
    src, n = RE_ANALITICA.subn(r"\1'';", src, count=1)
    if n != 1:
        raise SystemExit("No encontre la linea \"let ANALITICA_URL = '...';\" en index.html: "
                         'sin ella no se puede asegurar que las pruebas no le manden eventos a ADVAPP.')
    return src


def armar_pagina():
    """La copia apagada, sin tanda, que abren los iframes. Una por corrida.
    Devuelve lo que escribio (con eso se mira que el servidor sea el de esta
    carpeta: sirve_esta_carpeta)."""
    contenido = pagina_sin_medir().encode('utf-8')
    io.open(os.path.join(RAIZ, PAGINA_SIN_MEDIR), 'wb').write(contenido)
    return contenido


def armar_probe(js):
    """Escribe la copia de la pagina con la tanda adentro y devuelve su nombre."""
    src = pagina_sin_medir()
    tanda = io.open(js, encoding='utf-8').read()
    salida = src.replace('</body>', IFRAMES_A_LA_COPIA % PAGINA_SIN_MEDIR + NOMBRES_FILAS +
                         '<script>\n' + tanda + '\n</script>\n</body>', 1)
    nombre = PREFIJO_PROBE + os.path.basename(js)[:-3] + '.html'
    io.open(os.path.join(RAIZ, nombre), 'wb').write(salida.encode('utf-8'))
    return nombre


def borrar_probe(nombre):
    try:
        os.remove(os.path.join(RAIZ, nombre))
    except FileNotFoundError:
        pass
    except OSError as e:
        # En Windows, si quedo un Chrome colgado con el archivo abierto, el
        # borrado tira PermissionError y se perdia el resumen entero de la
        # corrida por no poder limpiar un temporal.
        print('(no se pudo borrar %s: %s)' % (nombre, e))


def dump_dom(cmd, limite):
    """Corre Chrome con --dump-dom y devuelve lo que imprimio, o None si no
    llego a imprimir la pagina entera antes de `limite` segundos.

    En Mac, Chrome sin ventana imprime el DOM pero despues NO se cierra solo
    (en Windows si). Esperar a que termine dejaba cada tanda colgada hasta el
    timeout y se perdia el resultado. Por eso se lee la salida a medida que
    llega y, apenas aparece el </html> del final, se cierra Chrome a mano.
    """
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    partes = []
    lector = threading.Thread(target=lambda: [partes.append(b) for b in iter(lambda: p.stdout.read1(65536), b'')],
                              daemon=True)
    lector.start()
    fin = time.time() + limite
    try:
        while time.time() < fin:
            if b''.join(partes[-3:]).rstrip().endswith(b'</html>') or p.poll() is not None:
                break
            time.sleep(0.3)
        else:
            return None
    finally:
        if p.poll() is None:
            p.kill()
        p.wait()
        lector.join(5)
    return b''.join(partes)


# Por que una tanda no dejo resultado (29/09, hallazgo 182). Antes las dos
# salian como "Suele ser falta de internet", y una tanda que revienta por un
# cambio de HTML (layout.js no atrapaba sus errores) parecia un corte de red.
SIN_TERMINAR = 'Chrome no termino a tiempo'
SIN_RESULTADO = 'la pagina cargo pero la tanda no escribio su RESULTADO'


def correr(chrome, probe, segundos=90):
    """Abre la copia `probe` sin ventana. Devuelve (texto del <pre
    id="RESULTADO">, None, anotado) o (None, por que no hubo resultado, {}).
    anotado: lo que dejo NOMBRES_FILAS, {'nombres': {ID: nombre} de las filas
    que nombra el RESULTADO, 'fuente': 'advapp', 'planilla' o 'copia'}, con
    None en lo que no este.

    Cada tanda va con un perfil de Chrome recien creado. Hasta el 29/09 todas
    se servian desde la misma URL (/_probe.html) y, compartiendo perfil,
    Chrome devolvia la copia cacheada de la tanda anterior: una tanda llegaba
    a informar el resultado de otra y los fallos parecian azarosos. Ahora cada
    tanda tiene su URL, pero el perfil nuevo se deja igual: no cuesta nada.
    """
    perfil = tempfile.mkdtemp(prefix='probe-')
    cmd = [chrome, '--headless', '--disable-gpu', '--window-size=1920,1080',
           '--user-data-dir=' + perfil,
           '--virtual-time-budget=%d' % (segundos * 1000), '--dump-dom',
           BASE + '/' + probe]
    try:
        dom = dump_dom(cmd, segundos + 90)
    finally:
        shutil.rmtree(perfil, ignore_errors=True)
    if dom is None:
        return None, SIN_TERMINAR, {}
    pagina = dom.decode('utf-8', 'replace')
    m = re.search(r'<pre id="RESULTADO">(.*?)</pre>', pagina, re.S)
    if not m:
        return None, SIN_RESULTADO, {}
    n = re.search(r'<pre id="NOMBRES_FILAS"([^>]*)>(.*?)</pre>', pagina, re.S)
    try:
        nombres = json.loads(html.unescape(n.group(2))) if n else None
    except ValueError:
        nombres = None
    f = re.search(r'data-fuente="([^"]*)"', n.group(1)) if n else None
    return html.unescape(m.group(1)), None, {'nombres': nombres if isinstance(nombres, dict) else None,
                                             'fuente': f.group(1) if f else None}


ULTIMA = os.path.join(AQUI, '_ultima-corrida.json')   # el _ del principio: no va al repo
# (29/09, revision) Y otra por puerto. La de arriba es de la ultima corrida que
# termino: con dos a la vez (la del 9821 piso la del 9824) fallas-conocidas.py
# anotaba desde la equivocada. Con --puerto N lee la de ese puerto, y siempre
# dice de que puerto y hora es la que usa (las dos llevan "puerto" y "hora").
ULTIMA_PUERTO = os.path.join(AQUI, '_ultima-corrida-%d.json')
ANCHO = 50                                            # 7.1 C (el mismo de fallas-conocidas.py)


def cargar_clasificador():
    """herramientas/fallas-conocidas.py, que clasifica en nuevas, conocidas y
    arregladas. Su nombre lleva guiones, asi que se carga por la ruta.
    Devuelve (modulo, None) o (None, por que no se pudo)."""
    ruta = os.path.join(RAIZ, 'herramientas', 'fallas-conocidas.py')
    try:
        spec = importlib.util.spec_from_file_location('fallas_conocidas', ruta)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod, None
    except Exception as e:
        return None, '%s: %s' % (type(e).__name__, e)


def decir(texto, sangria='', primera=None):
    """Imprime el texto partido a ANCHO (7.1 C: se lee a ancho de celular)."""
    for l in textwrap.wrap(texto, ANCHO, initial_indent=sangria if primera is None else primera,
                           subsequent_indent=sangria, break_long_words=False, break_on_hyphens=False):
        print(l)


def avance(i, total, nombre):
    """La linea de avance, que se reescribe. Va por stderr y solo si es la
    terminal: PUBLICAR guarda la salida con tee para leer el RESULTADO, y en
    el log de la revision diaria no suma nada."""
    try:
        if sys.stderr.isatty():
            sys.stderr.write(('\r  %d/%d  %-36s' % (i, total, nombre[:36])) if nombre else '\r' + ' ' * ANCHO + '\r')
            sys.stderr.flush()
    except Exception:
        pass


def escribir_json(ruta, datos):
    """A un temporal y despues os.replace: la revision diaria nunca lee uno a
    medio escribir."""
    carpeta = os.path.dirname(os.path.abspath(ruta))
    os.makedirs(carpeta, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix='_corrida-', suffix='.tmp', dir=carpeta)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as fh:
            json.dump(datos, fh, ensure_ascii=False, indent=1)
        os.replace(tmp, ruta)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


def main():
    if PUERTO is None:
        print('El puerto pedido no es un numero de puerto. Uso: python3 pruebas/correr.py [--puerto N]')
        return 2
    detalle = '--detalle' in sys.argv
    ruta_json = None
    if '--json' in sys.argv:
        i = sys.argv.index('--json')
        ruta_json = sys.argv[i + 1] if i + 1 < len(sys.argv) and not sys.argv[i + 1].startswith('--') else None
        if not ruta_json:
            print('--json necesita la ruta del archivo. Uso: python3 pruebas/correr.py --json RUTA')
            return 2
    chrome = buscar_chrome()
    if not chrome:
        print('No encontre Chrome ni Edge. Las pruebas necesitan uno de los dos.')
        return 2

    tandas = [f[:-3] for f in os.listdir(AQUI) if f.endswith('.js')]
    tandas.sort(key=lambda n: (ORDEN.index(n) if n in ORDEN else 99, n))
    if not tandas:
        print('No hay ninguna tanda .js en pruebas/.')
        return 2

    servidor = levantar_servidor()
    corridas = []
    try:
        if not sirve_esta_carpeta(PAGINA_SIN_MEDIR, armar_pagina()):
            decir('El servidor de %s no sirve esta carpeta (%s): es de otra copia del catalogo, '
                  'y las pruebas mirarian esa. No se corre. Apagalo, o usa otro puerto:  '
                  'python3 pruebas/correr.py --puerto N' % (BASE, RAIZ))
            return 2
        print('Corriendo %d tandas con los datos de hoy' % len(tandas))
        print('(%s)...' % BASE)
        sys.stdout.flush()
        for i, nombre in enumerate(tandas, 1):
            avance(i, len(tandas), nombre)
            probe = armar_probe(os.path.join(AQUI, nombre + '.js'))
            try:
                # 140 y no 90: desde que la portada dibuja seis filas de productos
                # con foto, ademas de la grilla que piden las pruebas, con 90 varias
                # tandas no llegaban a terminar y figuraban como caidas.
                texto, motivo, anotado = correr(chrome, probe, PRESUPUESTO.get(nombre, 140))
            finally:
                borrar_probe(probe)
            corridas.append({'tanda': nombre, 'texto': texto or None,
                             'motivo': motivo or (None if texto else SIN_RESULTADO),
                             'nombres': anotado.get('nombres'), 'fuente': anotado.get('fuente')})
        avance(0, 0, '')
    finally:
        # Solo las copias de ESTA corrida: las de otra que este andando a la
        # vez (la revision de las 14:00, un PUBLICAR) son de ella.
        for resto in glob.glob(os.path.join(RAIZ, glob.escape(PREFIJO_PROBE) + '*.html')):
            borrar_probe(os.path.basename(resto))
        borrar_probe(PAGINA_SIN_MEDIR)
        if servidor:
            # El servidor queda levantado a proposito. Antes se bajaba al
            # terminar, y a quien tenia el catalogo abierto en el navegador se
            # le caian todas las fotos de golpe sin entender por que. Pesa
            # nada y sirve para seguir trabajando; se apaga cerrando su ventana.
            print()
            decir('(el servidor local quedo andando en %s%s)' % (
                BASE, '' if PUERTO == PUERTO_DE_SIEMPRE else '; se apaga con: kill %d' % servidor.pid))
    return resumir(corridas, detalle, ruta_json)


def resumir(corridas, detalle, ruta_json):
    """Imprime el resumen y devuelve el codigo de salida (0, 1 o 3)."""
    fc, error = cargar_clasificador()
    c, registro = None, 'ok'
    if fc:
        try:
            reg = fc.leer_conocidas()
        except fc.RegistroDanado as e:
            # Danado no es vacio: todo cuenta como nuevo (frena) y no se
            # escribe nada encima.
            reg, registro = {'conocidas': {}, 'arregladas': {}}, str(e)
        try:
            enviados = fc.leer_enviados()
        except fc.RegistroDanado:
            enviados = None           # sus conocidas pasan a nuevas (lo dice cada una)
        try:
            c = fc.clasificar(corridas, reg, enviados)
        except Exception as e:
            error = 'clasificar: %s: %s' % (type(e).__name__, e)

    # ---- Arriba, solo lo que falla (7.1 C) ----
    por_tanda = {}
    for x in corridas:
        if x['texto'] is None:
            continue
        lineas = x['texto'].split('\n')
        # La cabecera la escribe la propia tanda y es la que manda. Si una
        # prueba revienta, el detalle sale como EXCEPCION: contando solo las
        # lineas 'FALLA' el runner decia "pasa todo" con exit 0 y PUBLICAR
        # dejaba subir el catalogo con el JS roto.
        fallas = [l for l in lineas if l.startswith('FALLA') or l.startswith('EXCEPCION')]
        # Las lineas AVISO (29/09) se muestran y no se cuentan: algo que
        # conviene saber pero que el cliente no ve (fuentes.js, la planilla
        # de respaldo recortada). La revision diaria no las lleva a la
        # notificacion.
        avisos = [l for l in lineas if l.startswith('AVISO')]
        cabecera = next((l.strip() for l in lineas if l.strip()), '')
        declaradas = re.search('(\\d+) FALLA', cabecera)
        n = max(len(fallas), int(declaradas.group(1)) if declaradas else 0)
        por_tanda[x['tanda']] = (cabecera, fallas, avisos, n)
    compacto = c is not None and not detalle
    print()
    bien = [t for t, v in por_tanda.items() if not v[3]]
    if compacto and bien:
        print('  %d tanda%s: TODO OK' % (len(bien), 's' if len(bien) != 1 else ''))
    for x in corridas:
        nombre = x['tanda']
        if x['texto'] is None:
            # La linea termina siempre en "NO LLEGO A CORRER": es lo que
            # busca revision-diaria.py. El porque va en la de abajo.
            print('  %-14s NO LLEGO A CORRER' % nombre)
            # (29/09, revision) Partida a ANCHO: "(la pagina cargo pero la
            # tanda no escribio su RESULTADO)" salia de 63 caracteres.
            decir('(%s)' % x['motivo'], '       ', '       ')
            continue
        cabecera, fallas, avisos, n = por_tanda[nombre]
        if not compacto:
            print('  %-14s %s' % (nombre, cabecera))
            for l in fallas + avisos:
                print('       ' + l.strip())
            continue
        if any(l.startswith('EXCEPCION') for l in fallas):
            decir('%s: la tanda se rompio (abajo)' % nombre, '       ', '  ')
        elif n:
            decir('%s: %d comprobacion%s falla%s (abajo)' % (nombre, n, 'es' if n != 1 else '',
                                                          'n' if n != 1 else ''), '       ', '  ')
        for l in avisos:
            decir(l.strip(), '       ', '  %s: ' % nombre)

    # ---- Los tres grupos ----
    sin_correr = [x for x in corridas if x['texto'] is None]
    if c is not None:
        grupos = fc.lineas_grupos(c)
        if grupos:
            print()
            for l in grupos:
                print(l)
        if registro != 'ok':
            decir('OJO: %s Mientras tanto todo cuenta como nuevo.' % registro, '   ')
        # Las que dejaron de fallar pasan solas a "arregladas" (se avisan
        # esta vez y nada mas). correr.py nunca anota una conocida.
        if c['arregladas'] and registro == 'ok':
            try:
                fc.aplicar_arregladas(c['arregladas'])
            except Exception as e:
                decir('(no se pudieron guardar las arregladas en pruebas/conocidas.json: %s)' % e, '   ')
        resultado, rc = fc.resultado(c)
    else:
        print()
        decir('(no se pudo cargar herramientas/fallas-conocidas.py -%s-: todo cuenta como nuevo, '
              'como antes del 29/09)' % error)
        n = sum(v[3] for v in por_tanda.values()) + len(sin_correr)
        resultado = (['RESULTADO: %d NUEVA%s. Revisar antes de publicar.' % (n, 'S' if n != 1 else '')]
                     if n else ['RESULTADO: pasa todo.'])
        rc = 1 if n else 0

    if sin_correr:
        print()
        # 29/09: el poco PRESUPUESTO no va en el primer aviso sino en el
        # segundo. Un presupuesto corto no hace que Chrome tarde: lo hace
        # volcar la pagina antes, sin RESULTADO. Y el segundo ya no culpa
        # primero a index.html: analitica.js salia asi de a ratos porque
        # esperaba un Blob.text(), que el reloj virtual no cuenta, y dos tandas
        # de la auditoria salieron a buscar un error en index.html que no habia.
        if any(x['motivo'] == SIN_TERMINAR for x in sin_correr):
            decir('Si Chrome no termino a tiempo, suele ser falta de internet: las pruebas bajan '
                  'los datos de ADVAPP de verdad.')
        if any(x['motivo'] == SIN_RESULTADO for x in sin_correr):
            decir('Si la pagina cargo pero la tanda no escribio su RESULTADO, Chrome dio por gastado '
                  'el reloj virtual antes de que terminara. Puede ser que la tanda necesite mas '
                  'PRESUPUESTO; que espere algo que no es un temporizador ni un pedido de red '
                  '(Blob.text(), el arrayBuffer() de una respuesta) y Chrome lo de por terminado, '
                  'que pasa de a ratos y mas con la maquina cargada (repetirla sola); que no hayan '
                  'llegado los datos; o un error de JS que la tanda no atrapo. Abrir la pagina en '
                  'el navegador y mirar la consola.')
    print()
    for l in resultado:
        print(l)

    # La clasificacion, para fallas-conocidas.py (siempre) y para la revision
    # diaria (--json). Sin clasificador no se escribe: la revision lee
    # entonces las lineas FALLA, y todo cuenta como nuevo.
    if c is not None:
        ahora = datetime.datetime.now()
        datos = dict(c, rc=rc, hora=ahora.strftime('%H:%M'), registro=registro, puerto=PUERTO)
        for ruta in [ULTIMA, ULTIMA_PUERTO % PUERTO] + ([ruta_json] if ruta_json else []):
            try:
                escribir_json(ruta, datos)
            except OSError as e:
                decir('(no se pudo escribir %s: %s)' % (ruta, e))
    return rc


if __name__ == '__main__':
    sys.exit(main())
