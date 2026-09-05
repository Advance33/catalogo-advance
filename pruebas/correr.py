# -*- coding: utf-8 -*-
"""Corre las pruebas del catalogo contra la planilla de verdad.

Cada archivo .js de esta carpeta es una tanda de comprobaciones. Se inyecta
antes de </body> en una copia del index.html y se abre con Chrome sin ventana;
la tanda escribe el resultado en un <pre id="RESULTADO"> y de ahi lo leemos.

Se corre con doble clic en "PROBAR.bat", o a mano:  python pruebas/correr.py

Hace falta servir por HTTP: con file:// la funcion urlFoto() descarta todo lo
que no sea http(s) y ademas el navegador no deja bajar el CSV de la planilla.
Si el servidor no esta levantado, este script lo levanta y lo baja al terminar.

Devuelve 0 si pasa todo y 1 si algo falla, asi PUBLICAR.bat puede frenar.
"""
import html, tempfile, shutil
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
PROBE   = os.path.join(RAIZ, '_probe.html')
PUERTO  = 8765
BASE    = 'http://localhost:%d' % PUERTO

# El orden importa solo para leer la salida: primero lo que mas se rompe.
# El presupuesto es cuanto reloj virtual se le da a cada tanda: layout abre
# el catalogo entero cuatro veces (una por ancho) y espera a que cada una
# termine de dibujar, asi que necesita bastante mas que las demas.
ORDEN = ['agrupacion', 'portada', 'extras', 'precios', 'color-precio', 'sugeridos', 'destacada', 'carrusel', 'layout']
PRESUPUESTO = {'layout': 200, 'extras': 150}   # segundos; el resto usa el de correr()
# extras hace varios clicks y cada uno repinta la portada entera (seis filas
# de doce productos con foto), asi que con los 90 de base no llegaba.

CHROMES = [
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
    p = subprocess.Popen([sys.executable, os.path.join(RAIZ, 'servidor.py')],
                         cwd=RAIZ, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(25):
        time.sleep(0.4)
        if servidor_vivo():
            return p
    p.terminate()
    raise SystemExit('No se pudo levantar el servidor local en el puerto %d.' % PUERTO)


def armar_probe(js):
    # En binario para no tocar los finales de linea del index.html
    src = io.open(INDEX, 'rb').read().decode('utf-8')
    tanda = io.open(js, encoding='utf-8').read()
    salida = src.replace('</body>', '<script>\n' + tanda + '\n</script>\n</body>', 1)
    io.open(PROBE, 'wb').write(salida.encode('utf-8'))


def correr(chrome, segundos=90):
    """Abre _probe.html sin ventana y devuelve el texto del <pre id="RESULTADO">.

    Cada tanda va con un perfil de Chrome recien creado. Todas se sirven desde
    la misma URL (/_probe.html) y, compartiendo perfil, Chrome devolvia la copia
    cacheada de la tanda anterior: una tanda llegaba a informar el resultado de
    otra y los fallos parecian azarosos.
    """
    perfil = tempfile.mkdtemp(prefix='probe-')
    cmd = [chrome, '--headless', '--disable-gpu', '--window-size=1920,1080',
           '--user-data-dir=' + perfil,
           '--virtual-time-budget=%d' % (segundos * 1000), '--dump-dom',
           BASE + '/_probe.html']
    try:
        dom = subprocess.run(cmd, capture_output=True, timeout=segundos + 90).stdout
    except subprocess.TimeoutExpired:
        return None
    finally:
        shutil.rmtree(perfil, ignore_errors=True)
    m = re.search(r'<pre id="RESULTADO">(.*?)</pre>', dom.decode('utf-8', 'replace'), re.S)
    return html.unescape(m.group(1)) if m else None


def main():
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
    sin_correr = []
    try:
        print('Corriendo %d tandas contra la planilla de hoy...\n' % len(tandas))
        for nombre in tandas:
            armar_probe(os.path.join(AQUI, nombre + '.js'))
            # 140 y no 90: desde que la portada dibuja seis filas de productos
            # con foto, ademas de la grilla que piden las pruebas, con 90 varias
            # tandas no llegaban a terminar y figuraban como caidas.
            texto = correr(chrome, PRESUPUESTO.get(nombre, 140))
            if not texto:
                sin_correr.append(nombre)
                print('  %-14s NO LLEGO A CORRER' % nombre)
                continue
            # La cabecera la escribe la propia tanda y es la que manda. Si una
            # prueba revienta, el detalle sale como EXCEPCION: contando solo las
            # lineas 'FALLA' el runner decia "pasa todo" con exit 0 y
            # PUBLICAR.bat dejaba subir el catalogo con el JS roto.
            lineas = texto.split('\n')
            fallas = [l for l in lineas
                      if l.startswith('FALLA') or l.startswith('EXCEPCION')]
            cabecera = next((l.strip() for l in lineas if l.strip()), '')
            declaradas = re.search('(\\d+) FALLA', cabecera)
            fallas_totales += max(len(fallas),
                                  int(declaradas.group(1)) if declaradas else 0)
            print('  %-14s %s' % (nombre, cabecera))
            for l in fallas:
                print('       ' + l.strip())
    finally:
        if os.path.exists(PROBE):
            os.remove(PROBE)
        # El servidor queda levantado a proposito. Antes se bajaba al terminar,
        # y a quien tenia el catalogo abierto en el navegador se le caian todas
        # las fotos de golpe sin entender por que. Pesa nada y sirve para
        # seguir trabajando; se apaga cerrando su ventana.
        if servidor:
            print('\n(el servidor local quedo andando en %s)' % BASE)

    print()
    if sin_correr:
        print('RESULTADO: %d tanda(s) no llegaron a correr (%s).'
              % (len(sin_correr), ', '.join(sin_correr)))
        print('Suele ser falta de internet: las pruebas bajan la planilla de verdad.')
        return 1
    if fallas_totales:
        print('RESULTADO: %d comprobacion(es) fallaron. Revisar antes de publicar.' % fallas_totales)
        return 1
    print('RESULTADO: pasa todo.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
