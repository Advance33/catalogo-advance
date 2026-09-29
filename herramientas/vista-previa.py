# -*- coding: utf-8 -*-
"""
Las vistas previas para WhatsApp: una pagina chica por fila de ADVAPP.

Pedro eligio el 29/09 la opcion B de la decision 4.2 (muestra
muestras/auditoria/ficha.html, "La vista previa en WhatsApp"): el link que
se manda de un producto tiene que llegar con la foto propia de ESE producto,
el modelo de titulo y, debajo, la version y el color de esa fila. Sin precio:
los precios cambian todos los dias y la tarjeta de WhatsApp queda guardada en
el chat. Hasta ese dia todos los links llegaban con la misma tarjeta
("Stock y precios en tiempo real") y el cliente no sabia que le mandaron
hasta abrirlo.

WhatsApp no corre JavaScript: lee las etiquetas og: del HTML que le devuelve
la direccion. El catalogo es una sola pagina (index.html) que arma todo con
JavaScript, asi que la vista previa de cada producto necesita su propio
archivo. Esta herramienta escribe uno por fila:

    p/<ID>.html     og:title, og:description, og:image (la foto propia, con
                    direccion absoluta y sus medidas reales), twitter:card,
                    noindex, y lleva al cliente a la ficha (../#p=<ID>, como
                    los links de la web) al instante, con un link a la vista
                    por si el navegador no corre JavaScript.
    p/indice.json   {"ids": [...]}: los IDs que tienen pagina. Lo lee el
                    boton Compartir de la ficha (decision 4.1) para mandar
                    p/<ID>.html solo cuando existe.
    p/_generado.json  {"generado_en": ..., "vistas": {ID: {titulo, linea,
                    foto, destino}}}: con que respuesta de ADVAPP y con que
                    valores se armo cada pagina (29/09, revision). No se
                    publica (el _* del .gitignore): lo usa la guarda del
                    navegador para separar un error del generador de datos
                    que cambiaron despues.

Los textos y la foto los calcula LA WEB, no una copia en Python: se abre
index.html en Chrome sin ventana con los mismos datos de ADVAPP que reviso
validar.bajar_advapp() (con sus defensas y la variable ADVAPP_COPIA), y
herramientas/vista-previa.js usa las funciones del sitio (el titulo de la
tarjeta, la version de la ficha, la foto que muestra la ficha). Copiar
armarModelo y partirTitulo en Python serian cientos de lineas que se
quedarian atras en silencio el dia que cambie la web.

Uso (desde la carpeta del catalogo):

    python3 herramientas/vista-previa.py              arma p/ con los datos de hoy
    python3 herramientas/vista-previa.py --puerto N   el servidor local en ese puerto
                                                      (sin nada, uno libre)
    python3 herramientas/vista-previa.py --confirmar-bajas
                                                      borra las paginas de las filas
                                                      que ADVAPP ya no trae aunque
                                                      sean muchas de golpe
    python3 herramientas/vista-previa.py --probar     autopruebas, sin red ni Chrome

Solo escribe los archivos que cambiaron, y borra la pagina de una fila que
ADVAPP dio de baja. Si de golpe se fuera mas de la quinta parte no borra
ninguna y sale con 1: eso parece una carga rara, no bajas. (Un link a una
pagina borrada lo recibe 404.html, que lo manda a #p=<ID> de la web.)

Sale con 0 si p/ quedo al dia, 1 si quedo al dia pero algo merece mirarse
(bajas frenadas), y 2 si no se pudo armar: sin ADVAPP, sin Chrome, o la web
no uso esos datos. Con 2, p/ queda exactamente como estaba.
"""
import html
import io
import json
import os
import re
import shutil
import struct
import sys
import tempfile
import threading
import urllib.request
import http.server
import socketserver

sys.dont_write_bytecode = True          # nada de __pycache__ en la carpeta del sitio
AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
sys.path.insert(0, RAIZ)
sys.path.insert(0, os.path.join(RAIZ, 'pruebas'))

INDEX = os.path.join(RAIZ, 'index.html')
JS = os.path.join(AQUI, 'vista-previa.js')
CARPETA = os.path.join(RAIZ, 'p')
# La tarjeta general del sitio, para la fila cuya ficha no muestra una foto
# propia (muestra la de ADVAPP, o ninguna). Nunca la de otro color.
GENERAL = 'assets/preview.png'

# Mas que esto WhatsApp no lo muestra en la vista previa (el limite que se
# conoce es de unos 300 KB). Una foto mas pesada va con su copia de 400 px de
# fotos/mini/, que es la misma imagen.
PESO_MAXIMO = 300 * 1024

# Si de una corrida a la otra se irian mas de esta parte de las paginas (y mas
# de BAJAS_MINIMO), no es una baja: es una carga rara. No se borra nada.
TOPE_BAJAS = 0.2
BAJAS_MINIMO = 10

# Cuanto se le da a Chrome: reloj virtual (la pagina espera la cotizacion y el
# indice de fotos) y reloj de verdad para terminar.
SEGUNDOS_VIRTUALES = 90
SEGUNDOS_REALES = 150

# Siempre con fullmatch (29/09, revision): con match y "$" al final, un ID con
# un salto de linea al final ("A-1\n") pasaba.
RE_ID = re.compile(r'[A-Za-z0-9][A-Za-z0-9_-]{0,80}')

# Los iconos de la pestana y del inicio del celular: los cuatro de index.html
# (decision 6.1 B). (29/09, revision: las paginas llevaban el viejo
# assets/logo-mark.png.) Van con ../ porque la pagina esta en p/.
ICONOS = ['<link rel="icon" type="image/png" sizes="32x32" href="../assets/icono-32.png">',
          '<link rel="icon" type="image/png" sizes="16x16" href="../assets/icono-16.png">',
          '<link rel="icon" type="image/png" sizes="192x192" href="../assets/icono-192.png">',
          '<link rel="apple-touch-icon" href="../assets/icono-180.png">']

# La carpeta y la extension de las fotos propias. Las dice index.html
# (CARPETA_FOTOS y EXT_FOTOS) y main() las lee de ahi (fotos_de_index): estas
# son solo el respaldo si no las encuentra (29/09, revision: estaban copiadas
# a mano y podian quedar distintas).
CARPETA_FOTOS = 'fotos/'
EXT_FOTOS = '.jpg'


# --------------------------------------------------------------------------
# Lo que dice index.html (una sola verdad)
# --------------------------------------------------------------------------

def leer_index():
    return io.open(INDEX, 'rb').read().decode('utf-8')


def direccion_publica(src):
    """La direccion publica del catalogo: la del og:url de index.html."""
    m = re.search(r'<meta property="og:url" content="(https://[^"]+/)"', src)
    return m.group(1) if m else ''


def url_de_advapp(src):
    m = re.search(r"^const ADVAPP_URL = '([^'\r\n]+)';", src, re.M)
    return m.group(1) if m else ''


def fotos_de_index(src):
    """(carpeta, extension, aviso) de las fotos propias, las de CARPETA_FOTOS
    y EXT_FOTOS de index.html. Si no las encuentra, las de siempre ('fotos/',
    '.jpg') y el aviso que lo dice."""
    c = re.search(r"^const CARPETA_FOTOS = '([^'\r\n/]+/)';", src, re.M)
    x = re.search(r"^const EXT_FOTOS = '(\.[A-Za-z0-9]+)';", src, re.M)
    if c and x:
        return c.group(1), x.group(1), ''
    return ('fotos/', '.jpg', 'no encontre %s en index.html: se usan "fotos/" y ".jpg"'
            % ' ni '.join(n for n, m in (('CARPETA_FOTOS', c), ('EXT_FOTOS', x)) if not m))


# La medicion va apagada, igual que en las pruebas (pruebas/correr.py): esta
# pagina no es un visitante.
RE_ANALITICA = re.compile(r"^(let ANALITICA_URL = )'[^'\r\n]*';", re.M)

INTERCEPTOR = '''<script>
/* vista-previa.py: ADVAPP sale de la copia que bajo y reviso la herramienta
   (validar.bajar_advapp), no de la red: asi la pagina arma exactamente los
   datos revisados, y se puede comprobar que los uso. */
(() => {
  const url = %s, copia = %s;
  const original = window.fetch.bind(window);
  window.fetch = (pedido, opciones) => {
    const u = typeof pedido === 'string' ? pedido : ((pedido && pedido.url) || String(pedido));
    if(u === url) return original(copia, { cache: 'no-store', signal: opciones && opciones.signal });
    return original(pedido, opciones);
  };
})();
</script>
'''

LECTOR = '''<script>
%s
/* vista-previa.py: cuando la pagina termina de armar los productos, se
   calculan las vistas previas y se dejan, en JSON, en un pre al final. */
(() => {
  const espera = setInterval(() => {
    if(!MODELOS.length || !FUENTE) return;
    clearInterval(espera);
    let salida;
    try{ salida = vistasPrevias(); }
    catch(e){ salida = { error: String((e && e.stack) || e) }; }
    for(let i = 1; i < 5000; i++){ clearInterval(i); clearTimeout(i); }
    const pre = document.createElement('pre');
    pre.id = 'VISTAS';
    pre.textContent = JSON.stringify(salida);
    document.body.appendChild(pre);
  }, 100);
})();
</script>
'''

COPIA_WEB = '/_vista-previa-advapp.json'
PAGINA_WEB = '/_vista-previa.html'


def pagina_de_trabajo(src, url_advapp, js):
    """index.html con la medicion apagada, ADVAPP desviado a la copia y el
    calculo de las vistas al final. Se sirve desde la memoria: no se escribe
    nada en la carpeta del sitio."""
    src, n = RE_ANALITICA.subn(r"\1'';", src, count=1)
    if n != 1:
        raise ValueError("no encontre la linea \"let ANALITICA_URL = '...';\" en index.html: "
                         'sin ella no se puede asegurar que esto no le mande eventos a ADVAPP')
    if not url_advapp:
        raise ValueError('no encontre ADVAPP_URL en index.html')
    inter = INTERCEPTOR % (json.dumps(url_advapp), json.dumps(COPIA_WEB))
    i = src.find('<meta charset="utf-8">')
    i = i + len('<meta charset="utf-8">') if i != -1 else src.find('<head>') + len('<head>')
    src = src[:i] + '\n' + inter + src[i:]
    j = src.rfind('</body>')
    if j == -1:
        raise ValueError('index.html sin </body>')
    return src[:j] + (LECTOR % js) + src[j:]


# --------------------------------------------------------------------------
# ADVAPP: una sola bajada, revisada por validar.bajar_advapp()
# --------------------------------------------------------------------------

def bajar_advapp(url):
    """(bytes crudos, filas de validar, manifiesto, modulo validar). Los bytes
    son los mismos que reviso validar: con ADVAPP_COPIA se lee esa copia (la
    de la revision diaria); si no, se baja una vez y validar lee esa bajada."""
    import validar
    copia = os.environ.get(validar.COPIA_ENV)
    temporal = None
    try:
        if not copia:
            req = urllib.request.Request(url or validar.ADVAPP_URL,
                                         headers={'User-Agent': 'vista-previa.py'})
            with urllib.request.urlopen(req, timeout=60) as r:
                crudo = r.read()
            fd, temporal = tempfile.mkstemp(prefix='vista-previa-advapp-', suffix='.json')
            with os.fdopen(fd, 'wb') as fh:
                fh.write(crudo)
            copia = temporal
        with io.open(copia, 'rb') as fh:
            crudo = fh.read()
        antes = os.environ.get(validar.COPIA_ENV)
        os.environ[validar.COPIA_ENV] = copia
        try:
            filas = validar.bajar_advapp()     # las defensas de siempre; si no sirve, tira
        finally:
            if antes is None:
                os.environ.pop(validar.COPIA_ENV, None)
            else:
                os.environ[validar.COPIA_ENV] = antes
        return crudo, filas, dict(validar.FUENTE.get('manifiesto') or {}), validar
    finally:
        if temporal:
            try:
                os.remove(temporal)
            except OSError:
                pass


# --------------------------------------------------------------------------
# El servidor local y Chrome
# --------------------------------------------------------------------------

class _Manejador(http.server.SimpleHTTPRequestHandler):
    extras = {}

    def do_GET(self):
        ruta = self.path.split('?', 1)[0].split('#', 1)[0]
        if ruta in self.extras:
            cuerpo, tipo = self.extras[ruta]
            self.send_response(200)
            self.send_header('Content-Type', tipo)
            self.send_header('Content-Length', str(len(cuerpo)))
            self.end_headers()
            self.wfile.write(cuerpo)
            return None
        return super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *a):
        pass


def levantar_servidor(puerto, extras):
    """Un servidor solo en 127.0.0.1 (como servidor.py) que sirve la carpeta
    del sitio, mas las dos direcciones de trabajo desde la memoria.
    puerto 0 = uno libre, asi no choca con el 8765 de ABRIR CATALOGO ni con
    unas pruebas que esten corriendo."""
    class M(_Manejador):
        pass
    M.extras = extras

    def fabrica(*a, **k):
        return M(*a, directory=RAIZ, **k)

    class Servidor(socketserver.ThreadingTCPServer):
        allow_reuse_address = True
        daemon_threads = True
    srv = Servidor(('127.0.0.1', puerto), fabrica)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def abrir_en_chrome(url):
    """(DOM de la pagina despues de correr, None) o (None, motivo)."""
    try:
        import correr as CORRER       # la lista de Chrome y el volcado, los de las pruebas
    except Exception as ex:
        return None, 'no pude cargar pruebas/correr.py (%s)' % ex
    chrome = CORRER.buscar_chrome()
    if not chrome:
        return None, 'no encontre Chrome ni Edge'
    perfil = tempfile.mkdtemp(prefix='vista-previa-')
    cmd = [chrome, '--headless', '--disable-gpu', '--window-size=1280,900',
           '--user-data-dir=' + perfil,
           '--virtual-time-budget=%d' % (SEGUNDOS_VIRTUALES * 1000), '--dump-dom', url]
    try:
        dom = CORRER.dump_dom(cmd, SEGUNDOS_REALES)
    finally:
        shutil.rmtree(perfil, ignore_errors=True)
    if dom is None:
        return None, 'Chrome no termino a tiempo'
    return dom.decode('utf-8', 'replace'), None


def leer_vistas(dom):
    """El JSON que dejo el lector. El comentario del propio script tambien
    queda en el volcado: por eso se busca el pre que abre con una llave."""
    m = re.search(r'<pre id="VISTAS">(\{.*?)</pre>', dom or '', re.S)
    if not m:
        return None
    try:
        return json.loads(html.unescape(m.group(1)))
    except ValueError:
        return None


def calcular_en_la_web(crudo, puerto=0):
    """Abre la web con esa copia de ADVAPP. (lo que calculo vista-previa.js,
    None) o (None, motivo)."""
    src = leer_index()
    js = io.open(JS, encoding='utf-8').read()
    try:
        pagina = pagina_de_trabajo(src, url_de_advapp(src), js).encode('utf-8')
    except ValueError as ex:
        return None, str(ex)
    extras = {PAGINA_WEB: (pagina, 'text/html; charset=utf-8'),
              COPIA_WEB: (crudo, 'application/json; charset=utf-8')}
    try:
        srv = levantar_servidor(puerto, extras)
    except OSError as ex:
        return None, 'no pude levantar el servidor local en el puerto %s (%s)' % (puerto or 'libre', ex)
    try:
        dom, motivo = abrir_en_chrome('http://127.0.0.1:%d%s' % (srv.server_address[1], PAGINA_WEB))
    finally:
        srv.shutdown()
        srv.server_close()
    if dom is None:
        return None, motivo
    datos = leer_vistas(dom)
    if datos is None:
        return None, 'la pagina no llego a armar los productos (mirar la consola de index.html)'
    if datos.get('error'):
        return None, 'vista-previa.js fallo: %s' % datos['error'][:400]
    return datos, None


def revisar_datos(datos, manifiesto, activas):
    """Que la web haya armado EXACTAMENTE los datos revisados, y entera.
    Devuelve el motivo para no escribir nada, o ''."""
    if datos.get('fuente') != 'advapp':
        return 'la web no uso ADVAPP sino "%s"' % datos.get('fuente')
    if (manifiesto.get('generado_en') or '') != (datos.get('generado_en') or ''):
        return 'la web armo otra respuesta de ADVAPP (%s y no %s)' % (
            datos.get('generado_en'), manifiesto.get('generado_en'))
    if not datos.get('indice'):
        return 'la web no pudo leer fotos/indice.json: las fotos saldrian mal'
    vistas = datos.get('vistas') or []
    if not vistas:
        return 'la web no dio ninguna fila'
    if datos.get('filas') != activas:
        return 'la web armo %s filas y ADVAPP trae %s activas' % (datos.get('filas'), activas)
    if len(vistas) < activas * 0.9:
        return 'la web dio %d vistas para %d filas' % (len(vistas), activas)
    malos = [v.get('id') for v in vistas if not RE_ID.fullmatch(str(v.get('id') or ''))
             or not RE_ID.fullmatch(str(v.get('destino') or v.get('id') or ''))
             or not str(v.get('titulo') or '').strip()]
    if malos:
        return '%d fila(s) sin ID usable o sin titulo (%s)' % (len(malos), ', '.join(map(str, malos[:5])))
    if len({v['id'] for v in vistas}) != len(vistas):
        return 'hay IDs repetidos: dos filas escribirian la misma pagina'
    return ''


# --------------------------------------------------------------------------
# Las fotos: medidas de verdad, leidas del archivo
# --------------------------------------------------------------------------

def medidas(ruta):
    """(ancho, alto) de un JPEG o PNG, sin librerias. None si no se entiende."""
    try:
        with open(ruta, 'rb') as fh:
            cab = fh.read(26)
            if cab[:8] == b'\x89PNG\r\n\x1a\n':
                return struct.unpack('>II', cab[16:24])
            if cab[:2] != b'\xff\xd8':
                return None
            fh.seek(2)
            while True:
                b = fh.read(1)
                while b and b != b'\xff':
                    b = fh.read(1)
                while b == b'\xff':
                    b = fh.read(1)
                if not b:
                    return None
                marca = b[0]
                if marca in (0xD8, 0x01) or 0xD0 <= marca <= 0xD7:
                    continue
                largo = struct.unpack('>H', fh.read(2))[0]
                # SOF0..SOF15, salvo DHT (C4), JPG (C8) y DAC (CC)
                if 0xC0 <= marca <= 0xCF and marca not in (0xC4, 0xC8, 0xCC):
                    fh.read(1)
                    alto, ancho = struct.unpack('>HH', fh.read(4))
                    return ancho, alto
                fh.seek(largo - 2, 1)
    except (OSError, struct.error, IndexError):
        return None


def imagen_para(foto, raiz=RAIZ):
    """La imagen de la vista previa de una fila: (ruta del sitio, ancho, alto,
    propia). `foto` es la foto propia que muestra la ficha
    ("fotos/AT-0071-03.jpg") o vacio. Sin foto propia, la tarjeta general.
    La carpeta y la extension son las de index.html (CARPETA_FOTOS y
    EXT_FOTOS; la de las copias chicas, CARPETA_FOTOS + 'mini/', como alla)."""
    if foto and re.fullmatch(re.escape(CARPETA_FOTOS) + r'[^/]+' + re.escape(EXT_FOTOS), foto):
        ruta = os.path.join(raiz, foto)
        if os.path.isfile(ruta):
            if os.path.getsize(ruta) > PESO_MAXIMO:
                mini = os.path.join(raiz, CARPETA_FOTOS, 'mini', os.path.basename(foto))
                if os.path.isfile(mini) and os.path.getsize(mini) <= PESO_MAXIMO:
                    foto, ruta = CARPETA_FOTOS + 'mini/' + os.path.basename(foto), mini
            med = medidas(ruta)
            if med:
                return foto, med[0], med[1], True
    med = medidas(os.path.join(raiz, GENERAL)) or (1200, 630)
    return GENERAL, med[0], med[1], False


# --------------------------------------------------------------------------
# La pagina de cada fila
# --------------------------------------------------------------------------

def e(s):
    return html.escape(str(s or ''), quote=True)


def armar_pagina(v, publica, raiz=RAIZ):
    """El HTML de p/<ID>.html. Siempre igual para los mismos datos: sin
    fecha ni nada que cambie solo, asi no se reescribe si no cambio."""
    ide, destino = v['id'], v.get('destino') or v['id']
    titulo, linea = str(v['titulo']).strip(), str(v.get('linea') or '').strip()
    foto, ancho, alto, propia = imagen_para(v.get('foto') or '', raiz)
    url_pagina = publica + 'p/' + ide + '.html'
    url_foto = publica + foto
    completo = titulo + (' · ' + linea if linea else '')
    ir = '../#p=' + destino
    # summary: la foto cuadrada, chica y al costado, como la dibujo la muestra.
    # La tarjeta general (1200x630) va grande, como la de la portada.
    tarjeta = 'summary' if propia else 'summary_large_image'
    L = ['<!doctype html>',
         '<html lang="es">',
         '<head>',
         '<meta charset="utf-8">',
         '<meta name="viewport" content="width=device-width, initial-scale=1">',
         '<title>%s — Advance Tecno</title>' % e(completo),
         '<!-- La vista previa de este producto en WhatsApp (decision 4.2, Pedro 29/09).',
         '     La arma herramientas/vista-previa.py en cada PUBLICAR: no editar a mano. -->',
         '<meta name="robots" content="noindex">']
    if linea:
        L.append('<meta name="description" content="%s">' % e(linea))
    L += ['<meta property="og:type" content="website">',
          '<meta property="og:site_name" content="Advance Tecno">',
          '<meta property="og:locale" content="es_AR">',
          '<meta property="og:title" content="%s">' % e(titulo)]
    if linea:
        L.append('<meta property="og:description" content="%s">' % e(linea))
    L += ['<meta property="og:url" content="%s">' % e(url_pagina),
          '<meta property="og:image" content="%s">' % e(url_foto),
          '<meta property="og:image:width" content="%d">' % ancho,
          '<meta property="og:image:height" content="%d">' % alto,
          '<meta property="og:image:alt" content="%s">' % e(completo if propia else 'Catálogo Advance Tecno'),
          '<meta name="twitter:card" content="%s">' % tarjeta,
          '<meta name="twitter:title" content="%s">' % e(titulo)]
    if linea:
        L.append('<meta name="twitter:description" content="%s">' % e(linea))
    L += ['<meta name="twitter:image" content="%s">' % e(url_foto)] + ICONOS + [
          # El cliente no se queda aca: va derecho a la ficha. WhatsApp no
          # corre JavaScript, asi que igual lee las etiquetas de arriba.
          # (29/09, revision) Con el "<" escapado: un "</script>" en el
          # destino no puede cerrar el script (defensa de mas: el ID ya se
          # valida en revisar_datos y en aplicar).
          '<script>location.replace(%s);</script>' % json.dumps(ir).replace('<', '\\u003c'),
          # Los colores son los del sitio (index.html, :root): --paper, --surface,
          # --foto-bg, --ink, --muted y --acento.
          '<style>',
          '  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F4EFFD;',
          '       font:15px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#170F28}',
          '  main{width:min(360px,calc(100% - 32px));margin:16px 0;background:#FFFFFF;border-radius:14px;',
          '       overflow:hidden;box-shadow:0 1px 2px rgba(24,18,38,.05),0 10px 30px rgba(24,18,38,.07);text-align:center}',
          '  img{display:block;width:100%;height:auto;background:#F3EFFA}',
          '  .t{padding:16px 18px 20px}',
          '  h1{margin:0;font-size:19px;line-height:1.25}',
          '  p{margin:6px 0 0;color:#584D70;font-size:14px}',
          '  a{display:inline-block;margin-top:16px;padding:12px 18px;border-radius:999px;background:#7C3AED;',
          '    color:#FFFFFF;text-decoration:none;font-weight:600}',
          '</style>',
          '</head>',
          '<body>',
          '<main>']
    if propia:
        L.append('  <img src="../%s" alt="%s" width="%d" height="%d">' % (e(foto), e(completo), ancho, alto))
    L += ['  <div class="t">',
          '    <h1>%s</h1>' % e(titulo)]
    if linea:
        L.append('    <p>%s</p>' % e(linea))
    L += ['    <a href="%s">Ver el producto en el catálogo</a>' % e(ir),
          '  </div>',
          '</main>',
          '</body>',
          '</html>',
          '']
    return '\n'.join(L)


def escribir_si_cambio(ruta, texto):
    nuevo = texto.encode('utf-8')
    try:
        with open(ruta, 'rb') as fh:
            if fh.read() == nuevo:
                return False
    except OSError:
        pass
    # (29/09, revision) El temporal empieza con "_": el .gitignore (_*) lo deja
    # afuera. Como "p/<ID>.html.tmp", si se cortaba a mitad de camino el
    # "git add -A" de PUBLICAR lo publicaba.
    tmp = os.path.join(os.path.dirname(ruta), '_' + os.path.basename(ruta) + '.tmp')
    with open(tmp, 'wb') as fh:
        fh.write(nuevo)
    os.replace(tmp, ruta)
    return True


def limpiar_temporales(carpeta):
    """Borra los temporales que dejo una corrida cortada (los _*.tmp de
    ahora y los *.html.tmp de antes del 29/09). Devuelve cuantos."""
    n = 0
    for f in os.listdir(carpeta):
        if f.endswith('.tmp'):
            try:
                os.remove(os.path.join(carpeta, f))
                n += 1
            except OSError:
                pass
    return n


def texto_indice(ids):
    """p/indice.json: solo los IDs. (29/09, revision: el generado_en de ADVAPP
    cambia cada minuto y aca adentro hacia que cada PUBLICAR tuviera "1
    cambio" y subiera algo aunque nada hubiera cambiado; va en _generado.json.)"""
    return json.dumps({'ids': sorted(ids)}, ensure_ascii=False, indent=1) + '\n'


GENERADO = '_generado.json'


def texto_generado(vistas, generado_en):
    """p/_generado.json (29/09, revision): con que respuesta de ADVAPP
    (generado_en) y con que valores de cada vista (los de vistasPrevias() de
    vista-previa.js, tal cual) se armo cada p/<ID>.html. Empieza con "_": el
    .gitignore lo deja afuera, no se publica. La guarda del navegador
    (decision-vista-previa.js) compara las paginas contra esto (cualquier
    diferencia es un error del generador) y esto contra la web de hoy (datos
    que cambiaron despues: aviso)."""
    return json.dumps({'generado_en': generado_en,
                       'vistas': {v['id']: {'titulo': v.get('titulo'), 'linea': v.get('linea') or '',
                                            'foto': v.get('foto') or '',
                                            'destino': v.get('destino') or v['id']}
                                  for v in vistas}},
                      ensure_ascii=False, indent=1, sort_keys=True) + '\n'


def escribir_siempre(ruta, texto):
    """Atomico (un temporal que empieza con "_" y os.replace), aunque no
    haya cambiado."""
    tmp = os.path.join(os.path.dirname(ruta), '_' + os.path.basename(ruta) + '.tmp')
    with open(tmp, 'wb') as fh:
        fh.write(texto.encode('utf-8'))
    os.replace(tmp, ruta)


def leer_indice(carpeta=CARPETA):
    """Los IDs de p/indice.json (lo lee tambien revision-diaria.py)."""
    try:
        with io.open(os.path.join(carpeta, 'indice.json'), encoding='utf-8') as fh:
            return set(json.load(fh).get('ids') or [])
    except (OSError, ValueError, AttributeError):
        return set()


def aplicar(vistas, publica, carpeta=CARPETA, raiz=RAIZ, confirmar_bajas=False, generado_en=None):
    """Escribe p/ y devuelve cuantas paginas quedaron nuevas, cambiadas,
    iguales y borradas, si se freno el borrado y si cambio el indice.
    Un ID o un destino que no sirve de nombre de archivo levanta ValueError
    antes de escribir nada (29/09, revision: hasta ese dia lo frenaba solo
    revisar_datos, y aplicar lo metia en la ruta y en el script)."""
    malos = [repr(v.get('id')) for v in vistas
             if not RE_ID.fullmatch(str(v.get('id') or ''))
             or not RE_ID.fullmatch(str(v.get('destino') or v.get('id') or ''))]
    if malos:
        raise ValueError('%d fila(s) con un ID que no sirve de nombre de archivo (%s)'
                         % (len(malos), ', '.join(malos[:5])))
    os.makedirs(carpeta, exist_ok=True)
    limpiar_temporales(carpeta)
    antes = {f[:-5] for f in os.listdir(carpeta) if f.endswith('.html')}
    hoy = {v['id']: armar_pagina(v, publica, raiz) for v in vistas}
    res = {'nuevas': 0, 'cambiadas': 0, 'iguales': 0, 'borradas': 0, 'frenadas': [], 'indice': False}
    for ide in sorted(hoy):
        if escribir_si_cambio(os.path.join(carpeta, ide + '.html'), hoy[ide]):
            res['cambiadas' if ide in antes else 'nuevas'] += 1
        else:
            res['iguales'] += 1
    bajas = sorted(antes - set(hoy))
    if (bajas and not confirmar_bajas and len(bajas) > BAJAS_MINIMO
            and len(bajas) > len(antes) * TOPE_BAJAS):
        res['frenadas'] = bajas
    else:
        for ide in bajas:
            try:
                os.remove(os.path.join(carpeta, ide + '.html'))
                res['borradas'] += 1
            except OSError:
                pass
    # El indice dice solo lo que HOY esta en ADVAPP, aunque queden paginas
    # frenadas: el boton Compartir no tiene que mandar una fila dada de baja.
    res['indice'] = escribir_si_cambio(os.path.join(carpeta, 'indice.json'), texto_indice(hoy))
    # Con que se armaron las paginas: en cada corrida (no va al repo)
    escribir_siempre(os.path.join(carpeta, GENERADO), texto_generado(vistas, generado_en))
    return res


def main(argv):
    if '--probar' in argv:
        return probar()
    puerto = 0
    for i, a in enumerate(argv):
        try:
            if a == '--puerto' and i + 1 < len(argv):
                puerto = int(argv[i + 1])
            elif a.startswith('--puerto='):
                puerto = int(a.split('=', 1)[1])
        except ValueError:
            print('El puerto tiene que ser un numero. Uso: python3 herramientas/vista-previa.py [--puerto N]')
            return 2

    print('Vistas previas para WhatsApp (p/<ID>.html)')
    src = leer_index()
    global CARPETA_FOTOS, EXT_FOTOS
    CARPETA_FOTOS, EXT_FOTOS, aviso_fotos = fotos_de_index(src)
    if aviso_fotos:
        print('  AVISO: %s' % aviso_fotos)
    publica = direccion_publica(src)
    if not publica:
        print('NO SE ARMARON: no encontre el og:url de index.html, y sin la direccion publica no hay '
              'vista previa (WhatsApp necesita direcciones completas). p/ quedo como estaba.')
        return 2
    try:
        crudo, filas, manifiesto, validar = bajar_advapp(url_de_advapp(src))
    except Exception as ex:
        print('NO SE ARMARON: ADVAPP no sirvio (%s). p/ quedo como estaba.' % ex)
        return 2
    activas = sum(1 for f in filas if validar.fila_activa(f))
    datos, motivo = calcular_en_la_web(crudo, puerto)
    if datos is None:
        print('NO SE ARMARON: %s. p/ quedo como estaba.' % motivo)
        return 2
    motivo = revisar_datos(datos, manifiesto, activas)
    if motivo:
        print('NO SE ARMARON: %s. p/ quedo como estaba.' % motivo)
        return 2
    vistas = datos['vistas']
    try:
        res = aplicar(vistas, publica, confirmar_bajas='--confirmar-bajas' in argv,
                      generado_en=manifiesto.get('generado_en'))
    except ValueError as ex:
        print('NO SE ARMARON: %s. p/ quedo como estaba.' % ex)
        return 2
    propias = sum(1 for v in vistas if imagen_para(v.get('foto') or '')[3])
    print('  %d filas de ADVAPP (generado_en %s): %d con su foto propia y %d con la tarjeta general'
          % (len(vistas), manifiesto.get('generado_en'), propias, len(vistas) - propias))
    if len(vistas) != propias:
        print('  (esas son las filas cuya ficha muestra la foto de ADVAPP o ninguna).')
    print('  %d nuevas, %d cambiadas, %d sin cambios, %d borradas (filas que ADVAPP ya no trae).%s'
          % (res['nuevas'], res['cambiadas'], res['iguales'], res['borradas'],
             ' p/indice.json actualizado.' if res['indice'] else ' p/indice.json sin cambios.'))
    for p in datos.get('problemas') or []:
        print('  AVISO: %s' % p)
    if res['frenadas']:
        print('  OJO: %d paginas son de filas que ADVAPP ya no trae (%s...). Son demasiadas de golpe '
              'para ser bajas y no se borro ninguna (p/indice.json ya no las lista). Si de verdad se '
              'dieron de baja: python3 herramientas/vista-previa.py --confirmar-bajas'
              % (len(res['frenadas']), ', '.join(res['frenadas'][:5])))
        return 1
    return 0


# --------------------------------------------------------------------------
# Autopruebas (sin red ni Chrome): python3 herramientas/vista-previa.py --probar
# --------------------------------------------------------------------------

def probar():
    global CARPETA_FOTOS, EXT_FOTOS         # el caso de las fotos las cambia y las devuelve
    fallas = []

    def ok(c, txt):
        print(('  OK  ' if c else 'FALLA ') + txt)
        if not c:
            fallas.append(txt)

    tmp = tempfile.mkdtemp(prefix='vista-previa-probar-')
    try:
        # Un sitio de mentira: dos fotos, una pesada con su mini, y la general
        os.makedirs(os.path.join(tmp, 'fotos', 'mini'))
        os.makedirs(os.path.join(tmp, 'assets'))

        def jpeg(ruta, ancho, alto, relleno=0):
            sof = b'\xff\xc0' + struct.pack('>HBHHB', 11, 8, alto, ancho, 1) + b'\x01\x11\x00'
            with open(ruta, 'wb') as fh:
                fh.write(b'\xff\xd8' + b'\xff\xe0' + struct.pack('>H', 16) + b'JFIF\x00' + b'\x00' * 9
                         + sof + b'\x00' * relleno + b'\xff\xd9')
        jpeg(os.path.join(tmp, 'fotos', 'AT-0072-03.jpg'), 900, 900)
        jpeg(os.path.join(tmp, 'fotos', 'AT-0160.jpg'), 1500, 1500, PESO_MAXIMO + 10)
        jpeg(os.path.join(tmp, 'fotos', 'mini', 'AT-0160.jpg'), 400, 400)
        with open(os.path.join(tmp, GENERAL), 'wb') as fh:
            fh.write(b'\x89PNG\r\n\x1a\n' + struct.pack('>I', 13) + b'IHDR' + struct.pack('>II', 1200, 630) + b'\x08\x06\x00\x00\x00')

        ok(medidas(os.path.join(tmp, 'fotos', 'AT-0072-03.jpg')) == (900, 900), 'lee las medidas de un JPEG')
        ok(medidas(os.path.join(tmp, GENERAL)) == (1200, 630), 'lee las medidas de un PNG')
        ok(medidas(os.path.join(tmp, 'no-esta.jpg')) is None, 'sin archivo, sin medidas (y sin error)')
        ok(imagen_para('fotos/AT-0160.jpg', tmp) == ('fotos/mini/AT-0160.jpg', 400, 400, True),
           'la foto de mas de 300 KB va con su copia de fotos/mini/')
        ok(imagen_para('fotos/AT-9999-01.jpg', tmp)[:3] == (GENERAL, 1200, 630),
           'una foto que no esta en fotos/ no se inventa: va la tarjeta general')
        ok(imagen_para('https://lh3.googleusercontent.com/d/x', tmp)[3] is False,
           'la foto de ADVAPP no cuenta como propia')

        pub = 'https://advance33.github.io/catalogo-advance/'
        caso = {'id': 'CEL-APP-068', 'destino': 'CEL-APP-068', 'titulo': 'Apple iPhone 17 Pro',
                'linea': '256GB · E-Sim · Orange', 'foto': 'fotos/AT-0072-03.jpg'}
        h = armar_pagina(caso, pub, tmp)
        meta = lambda k: (re.search(r'<meta (?:property|name)="%s" content="([^"]*)">' % re.escape(k), h) or [None, None])[1]
        ok(meta('og:title') == 'Apple iPhone 17 Pro' and meta('og:description') == '256GB · E-Sim · Orange',
           'el caso de la muestra: el modelo de titulo, la version y el color debajo')
        ok(meta('og:image') == pub + 'fotos/AT-0072-03.jpg' and meta('og:image:width') == '900'
           and meta('og:image:height') == '900', 'og:image absoluta a la foto propia, con sus medidas')
        ok(meta('og:url') == pub + 'p/CEL-APP-068.html', 'og:url es la pagina misma (Facebook la sigue)')
        ok(meta('twitter:card') == 'summary', 'foto cuadrada: summary (chica, al costado)')
        ok(meta('robots') == 'noindex', 'lleva noindex')
        ok('location.replace("../#p=CEL-APP-068")' in h and 'href="../#p=CEL-APP-068"' in h,
           'lleva a la ficha al instante y con un link visible')
        ok('http-equiv' not in h, 'sin meta refresh (el que arma la vista previa podria seguirlo)')
        ok(not re.search(r'USD|\$\s*\d', h), 'sin precio')

        sin = dict(caso, id='GAF-RAY-049', destino='GAF-RAY-049', foto='', linea='')
        h = armar_pagina(sin, pub, tmp)
        ok('og:image" content="%s%s"' % (pub, GENERAL) in h and 'summary_large_image' in h and '<img' not in h,
           'sin foto propia: la tarjeta general, grande, y la pagina sin imagen')
        ok('og:description' not in h and 'twitter:description' not in h and '<p>' not in h,
           'sin linea no se inventa una descripcion')

        gem = dict(caso, id='TAB-X-WIFIPEN', destino='TAB-X-CELLPEN')
        h = armar_pagina(gem, pub, tmp)
        ok('location.replace("../#p=TAB-X-CELLPEN")' in h and meta('og:url') == pub + 'p/TAB-X-WIFIPEN.html',
           'la fila escondida por repetida tiene su pagina y lleva a su gemela visible')
        comillas = dict(caso, titulo='Apple MacBook Pro M5 14"', linea='24GB/1TB · <b>')
        h = armar_pagina(comillas, pub, tmp)
        ok('content="Apple MacBook Pro M5 14&quot;"' in h and '&lt;b&gt;' in h and '<b>' not in h,
           'las comillas de las pulgadas y los < no rompen el HTML')

        # p/: solo se reescribe lo que cambio, y las bajas con tope
        carpeta = os.path.join(tmp, 'p')
        vistas = [dict(caso, id='F-%03d' % i, destino='F-%03d' % i) for i in range(60)]
        r = aplicar(vistas, pub, carpeta, tmp)
        ok(r['nuevas'] == 60 and r['indice'] and leer_indice(carpeta) == {v['id'] for v in vistas},
           'la primera vez escribe todas y el indice')
        antes = os.path.getmtime(os.path.join(carpeta, 'F-000.html'))
        r = aplicar(vistas, pub, carpeta, tmp)
        ok(r['iguales'] == 60 and not r['nuevas'] and not r['cambiadas'] and not r['indice'],
           'la segunda vez, con lo mismo, no reescribe nada')
        ok(os.path.getmtime(os.path.join(carpeta, 'F-000.html')) == antes, 'ni toca la fecha del archivo')
        vistas[1] = dict(vistas[1], linea='512GB · Sim · Blue')
        r = aplicar(vistas[:-3], pub, carpeta, tmp)
        ok(r['cambiadas'] == 1 and r['borradas'] == 3 and r['indice']
           and not os.path.exists(os.path.join(carpeta, 'F-059.html')),
           'reescribe la que cambio y borra las de las filas dadas de baja')
        r = aplicar(vistas[:20], pub, carpeta, tmp)
        ok(len(r['frenadas']) == 37 and not r['borradas'] and os.path.exists(os.path.join(carpeta, 'F-050.html'))
           and leer_indice(carpeta) == {v['id'] for v in vistas[:20]},
           'si se irian demasiadas de golpe no borra ninguna, y el indice lista solo las de hoy')
        r = aplicar(vistas[:20], pub, carpeta, tmp, confirmar_bajas=True)
        ok(r['borradas'] == 37 and not r['frenadas'], '--confirmar-bajas las borra')

        # La pagina de trabajo y la lectura del resultado
        src = ('<html><head>\r\n<meta charset="utf-8">\r\n<title>x</title></head><body>\r\n<script>\r\n'
               "let ANALITICA_URL = 'https://medir';\r\n</script>\r\n</body></html>")
        t = pagina_de_trabajo(src, 'https://advapp/api', 'function vistasPrevias(){}')
        ok("let ANALITICA_URL = '';" in t and 'https://medir' not in t, 'la medicion va apagada')
        ok(t.index('"https://advapp/api"') < t.index('<title>'), 'ADVAPP se desvia antes de que corra la pagina')
        ok(t.index('function vistasPrevias') > t.index('ANALITICA_URL') and t.endswith('</body></html>'),
           'el calculo va al final, despues del script de la pagina')
        try:
            pagina_de_trabajo('<html><body></body></html>', 'https://advapp/api', '')
            ok(False, 'sin la linea de la medicion no se abre la pagina')
        except ValueError:
            ok(True, 'sin la linea de la medicion no se abre la pagina')
        dom = ('<script>/* ... en un pre al final <pre id="VISTAS">. */</script>'
               '<pre id="VISTAS">{"fuente":"advapp","vistas":[{"titulo":"13\\" &amp; &lt;x&gt;"}]}</pre>')
        d = leer_vistas(dom)
        ok(d and d['vistas'][0]['titulo'] == '13" & <x>', 'lee el JSON del pre, no el comentario del script')

        bien = {'fuente': 'advapp', 'generado_en': 'g1', 'indice': True, 'filas': 3,
                'vistas': [{'id': 'A-1', 'titulo': 'x'}, {'id': 'A-2', 'titulo': 'y'}, {'id': 'A-3', 'titulo': 'z'}]}
        ok(revisar_datos(bien, {'generado_en': 'g1'}, 3) == '', 'los datos que cierran se aceptan')
        ok('planilla' in revisar_datos(dict(bien, fuente='planilla'), {'generado_en': 'g1'}, 3),
           'si la web cayo a la planilla no se escribe nada')
        ok('otra respuesta' in revisar_datos(bien, {'generado_en': 'g2'}, 3),
           'si la web armo otra respuesta de ADVAPP no se escribe nada')
        ok('indice.json' in revisar_datos(dict(bien, indice=False), {'generado_en': 'g1'}, 3),
           'sin el indice de fotos no se escribe nada')
        ok('activas' in revisar_datos(bien, {'generado_en': 'g1'}, 4), 'si se perdio una fila no se escribe nada')
        ok('sin ID' in revisar_datos(dict(bien, vistas=bien['vistas'][:2] + [{'id': '../x', 'titulo': 'z'}]),
                                     {'generado_en': 'g1'}, 3), 'un ID que no sirve de nombre de archivo frena')

        # ---- (29/09, revision) lo que encontro la revision r-identidad-diff
        # 10: los cuatro iconos de index.html, y no el logo-mark.png viejo
        h = armar_pagina(caso, pub, tmp)
        src_index = leer_index()
        de_index = [re.sub(r'\s+', ' ', l.strip()) for l in re.findall(
            r'^<link rel="(?:icon|apple-touch-icon)"[^>]*>', src_index, re.M)]
        ok(len(de_index) == 4 and [l.replace('href="assets/', 'href="../assets/') for l in de_index] == ICONOS,
           'los iconos de la pagina son los cuatro de index.html, con ../assets/')
        ok(all(i in h for i in ICONOS) and 'logo-mark' not in h, 'y la pagina los lleva, sin el logo-mark.png viejo')

        # 19: el ID con un salto de linea al final no pasa, y el destino no cierra el script
        ok(RE_ID.fullmatch('CEL-APP-068') and not RE_ID.fullmatch('CEL-APP-068\n'),
           'un ID con un salto de linea al final no es un ID')
        ok('sin ID' in revisar_datos(dict(bien, vistas=bien['vistas'][:2] + [{'id': 'A-3\n', 'titulo': 'z'}]),
                                     {'generado_en': 'g1'}, 3), 'y revisar_datos lo frena')
        c2 = os.path.join(tmp, 'p-malo')
        try:
            aplicar([dict(caso, id='A-1\n', destino='A-1\n')], pub, c2, tmp)
            ok(False, 'aplicar() tambien valida el ID (no escribe nada)')
        except ValueError:
            ok(not os.path.exists(c2), 'aplicar() tambien valida el ID (no escribe nada)')
        try:
            aplicar([dict(caso, id='A-1', destino='A-1</script><script>x()//')], pub, c2, tmp)
            ok(False, 'y el destino')
        except ValueError:
            ok(not os.path.exists(c2), 'y el destino')
        h = armar_pagina(dict(caso, destino='X</script><script>alert(1)//'), pub, tmp)
        ok(h.count('</script>') == 1 and '\\u003c/script>\\u003cscript>alert(1)//' in h,
           'un "</script>" en el destino va escapado y no cierra el script')

        # 21: el temporal empieza con "_" (el .gitignore lo deja afuera) y se limpian los viejos
        c3 = os.path.join(tmp, 'p-tmp')
        os.makedirs(c3)
        reemplazar = os.replace
        try:
            def cortado(a, b):
                raise OSError('corte a mitad de camino')
            os.replace = cortado
            try:
                escribir_si_cambio(os.path.join(c3, 'F-000.html'), 'x')
            except OSError:
                pass
        finally:
            os.replace = reemplazar
        quedo = sorted(os.listdir(c3))
        ok(quedo == ['_F-000.html.tmp'],
           'cortado a mitad, el temporal queda como _<ID>.html.tmp y no se publica (quedo %s)' % quedo)
        open(os.path.join(c3, 'F-001.html.tmp'), 'w').close()
        aplicar(vistas[:2], pub, c3, tmp, generado_en='2026-09-29T19:22:20.026Z')
        ok(not [f for f in os.listdir(c3) if f.endswith('.tmp')], 'aplicar() borra los temporales que quedaron')

        # 8: con que se armaron las paginas va en p/_generado.json (no se
        # publica); p/indice.json sigue siendo solo los ids
        with io.open(os.path.join(c3, 'indice.json'), encoding='utf-8') as fh:
            ind = json.load(fh)
        ok(ind == {'ids': ['F-000', 'F-001']} and leer_indice(c3) == {'F-000', 'F-001'},
           'p/indice.json es solo {"ids": [...]}')
        with io.open(os.path.join(c3, GENERADO), encoding='utf-8') as fh:
            gen = json.load(fh)
        ok(gen == {'generado_en': '2026-09-29T19:22:20.026Z',
                   'vistas': {'F-000': {'titulo': 'Apple iPhone 17 Pro', 'linea': '256GB · E-Sim · Orange',
                                        'foto': 'fotos/AT-0072-03.jpg', 'destino': 'F-000'},
                              'F-001': {'titulo': 'Apple iPhone 17 Pro', 'linea': '512GB · Sim · Blue',
                                        'foto': 'fotos/AT-0072-03.jpg', 'destino': 'F-001'}}},
           'p/_generado.json tiene el generado_en y los valores de cada vista con que se armo cada pagina')
        r = aplicar(vistas[:2], pub, c3, tmp, generado_en='2026-09-29T19:25:00.000Z')
        with io.open(os.path.join(c3, GENERADO), encoding='utf-8') as fh:
            gen = json.load(fh)
        ok(not r['indice'] and not r['nuevas'] and not r['cambiadas']
           and gen['generado_en'] == '2026-09-29T19:25:00.000Z',
           'con otro generado_en y las mismas paginas, p/indice.json no cambia (PUBLICAR sigue "al dia") '
           'y _generado.json se reescribe')
        sin = dict(vistas[0], id='G-1', destino='', foto='', linea=None)
        aplicar([sin], pub, c3, tmp, confirmar_bajas=True)
        with io.open(os.path.join(c3, GENERADO), encoding='utf-8') as fh:
            gen = json.load(fh)
        ok(gen['vistas'] == {'G-1': {'titulo': 'Apple iPhone 17 Pro', 'linea': '', 'foto': '', 'destino': 'G-1'}}
           and gen['generado_en'] is None,
           'sin foto propia la foto va vacia, y el destino es el ID si la vista no trae otro')

        # 21: la carpeta y la extension de las fotos, las de index.html
        ok(fotos_de_index(src_index) == ('fotos/', '.jpg', ''),
           'la carpeta y la extension de las fotos se leen de index.html (CARPETA_FOTOS, EXT_FOTOS)')
        c, x, aviso = fotos_de_index('<html></html>')
        ok((c, x) == ('fotos/', '.jpg') and 'CARPETA_FOTOS' in aviso and 'EXT_FOTOS' in aviso,
           'si no estan, las de siempre y un aviso que lo dice')
        guardadas = CARPETA_FOTOS, EXT_FOTOS
        try:
            CARPETA_FOTOS, EXT_FOTOS = 'img/', '.webp'
            os.makedirs(os.path.join(tmp, 'img'))
            shutil.copy(os.path.join(tmp, 'fotos', 'AT-0072-03.jpg'), os.path.join(tmp, 'img', 'AT-0072-03.webp'))
            ok(imagen_para('img/AT-0072-03.webp', tmp)[3] is True and imagen_para('fotos/AT-0072-03.jpg', tmp)[3] is False,
               'imagen_para usa la carpeta y la extension que dice index.html')
        finally:
            CARPETA_FOTOS, EXT_FOTOS = guardadas
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print()
    print('RESULTADO: %s' % ('%d FALLA(S)' % len(fallas) if fallas else 'TODO OK'))
    return 1 if fallas else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
