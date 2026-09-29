# -*- coding: utf-8 -*-
"""Corre las pruebas del catalogo con los datos de hoy.

Cada archivo .js de esta carpeta es una tanda de comprobaciones. Se inyecta
antes de </body> en una copia del index.html y se abre con Chrome sin ventana;
la tanda escribe el resultado en un <pre id="RESULTADO"> y de ahi lo leemos.
La pagina baja los productos de ADVAPP (y la planilla de Google, congelada
desde el 22/09, solo si ADVAPP falla), asi que hace falta internet.

Se corre con doble clic en "PROBAR.command", o a mano:  python3 pruebas/correr.py

Otro puerto (29/09):  python3 pruebas/correr.py --puerto 9130
(o con la variable de entorno PRUEBAS_PUERTO=9130). Sin nada, el 8765 de
siempre. Dos corridas a la vez no se pisan: cada tanda de cada corrida tiene
su propia copia (_probe-<pid>-<tanda>.html).

Hace falta servir por HTTP: con file:// la funcion urlFoto() descarta todo lo
que no sea http(s) y ademas el navegador no deja bajar los datos.
Si el servidor no esta levantado, este script lo levanta y lo deja andando.

Devuelve 0 si pasa todo y 1 si algo falla, asi PUBLICAR puede frenar.
"""
import html, tempfile, shutil
import glob
import io
import os
import re
import subprocess
import sys
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
    """La copia apagada, sin tanda, que abren los iframes. Una por corrida."""
    io.open(os.path.join(RAIZ, PAGINA_SIN_MEDIR), 'wb').write(pagina_sin_medir().encode('utf-8'))
    return PAGINA_SIN_MEDIR


def armar_probe(js):
    """Escribe la copia de la pagina con la tanda adentro y devuelve su nombre."""
    src = pagina_sin_medir()
    tanda = io.open(js, encoding='utf-8').read()
    salida = src.replace('</body>', IFRAMES_A_LA_COPIA % PAGINA_SIN_MEDIR +
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
    id="RESULTADO">, None) o (None, por que no hubo resultado).

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
        return None, SIN_TERMINAR
    m = re.search(r'<pre id="RESULTADO">(.*?)</pre>', dom.decode('utf-8', 'replace'), re.S)
    return (html.unescape(m.group(1)), None) if m else (None, SIN_RESULTADO)


def main():
    if PUERTO is None:
        print('El puerto pedido no es un numero de puerto. Uso: python3 pruebas/correr.py [--puerto N]')
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
    fallas_totales = 0
    sin_correr = {}
    try:
        print('Corriendo %d tandas con los datos de hoy (%s)...\n' % (len(tandas), BASE))
        armar_pagina()
        for nombre in tandas:
            probe = armar_probe(os.path.join(AQUI, nombre + '.js'))
            try:
                # 140 y no 90: desde que la portada dibuja seis filas de productos
                # con foto, ademas de la grilla que piden las pruebas, con 90 varias
                # tandas no llegaban a terminar y figuraban como caidas.
                texto, motivo = correr(chrome, probe, PRESUPUESTO.get(nombre, 140))
            finally:
                borrar_probe(probe)
            if not texto:
                sin_correr[nombre] = motivo
                # La linea termina siempre en "NO LLEGO A CORRER": es lo que
                # busca revision-diaria.py. El porque va en la de abajo.
                print('  %-14s NO LLEGO A CORRER' % nombre)
                print('       (%s)' % motivo)
                continue
            # La cabecera la escribe la propia tanda y es la que manda. Si una
            # prueba revienta, el detalle sale como EXCEPCION: contando solo las
            # lineas 'FALLA' el runner decia "pasa todo" con exit 0 y
            # PUBLICAR (entonces el .bat; hoy PUBLICAR.command en la Mac)
            # dejaba subir el catalogo con el JS roto.
            lineas = texto.split('\n')
            fallas = [l for l in lineas
                      if l.startswith('FALLA') or l.startswith('EXCEPCION')]
            # Las lineas AVISO (29/09) se muestran y no se cuentan: algo que
            # conviene saber pero que el cliente no ve (fuentes.js, la
            # planilla de respaldo recortada). Quedan en el log de la revision
            # diaria, que no las lleva a la notificacion (solo lee FALLA y
            # EXCEPCION).
            avisos = [l for l in lineas if l.startswith('AVISO')]
            cabecera = next((l.strip() for l in lineas if l.strip()), '')
            declaradas = re.search('(\\d+) FALLA', cabecera)
            fallas_totales += max(len(fallas),
                                  int(declaradas.group(1)) if declaradas else 0)
            print('  %-14s %s' % (nombre, cabecera))
            for l in fallas + avisos:
                print('       ' + l.strip())
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
            print('\n(el servidor local quedo andando en %s%s)' % (
                BASE, '' if PUERTO == PUERTO_DE_SIEMPRE else '; se apaga con: kill %d' % servidor.pid))

    print()
    if sin_correr:
        print('RESULTADO: %d tanda(s) no llegaron a correr (%s).'
              % (len(sin_correr), ', '.join(sin_correr)))
        # 29/09: el poco PRESUPUESTO no va en el primer aviso sino en el
        # segundo. Un presupuesto corto no hace que Chrome tarde: lo hace
        # volcar la pagina antes, sin RESULTADO. Y el segundo ya no culpa
        # primero a index.html: analitica.js salia asi de a ratos porque
        # esperaba un Blob.text(), que el reloj virtual no cuenta, y dos tandas
        # de la auditoria salieron a buscar un error en index.html que no habia.
        if any(m == SIN_TERMINAR for m in sin_correr.values()):
            print('Si Chrome no termino a tiempo, suele ser falta de internet: las pruebas bajan '
                  'los datos de ADVAPP de verdad.')
        if any(m == SIN_RESULTADO for m in sin_correr.values()):
            print('Si la pagina cargo pero la tanda no escribio su RESULTADO, Chrome dio por gastado '
                  'el reloj virtual antes de que terminara. Puede ser que la tanda necesite mas '
                  'PRESUPUESTO; que espere algo que no es un temporizador ni un pedido de red '
                  '(Blob.text(), el arrayBuffer() de una respuesta) y Chrome lo de por terminado, '
                  'que pasa de a ratos y mas con la maquina cargada (repetirla sola); que no hayan '
                  'llegado los datos; o un error de JS que la tanda no atrapo. Abrir la pagina en '
                  'el navegador y mirar la consola.')
        return 1
    if fallas_totales:
        print('RESULTADO: %d comprobacion(es) fallaron. Revisar antes de publicar.' % fallas_totales)
        return 1
    print('RESULTADO: pasa todo.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
