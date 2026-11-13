# -*- coding: utf-8 -*-
"""Las paginas de producto para Google: producto/<nombre>/index.html y sitemap.xml.

    python3 herramientas/paginas-producto.py              las arma con lo de hoy
    python3 herramientas/paginas-producto.py --puerto N   con el servidor en ese puerto
    python3 herramientas/paginas-producto.py --con-precio con el precio de ahora escrito
                                                          (solo el workflow de Publicar)
    python3 herramientas/paginas-producto.py --probar     las pruebas de este archivo

Ademas arma preguntas/index.html y llms.txt (ver "PARA LOS BUSCADORES CON IA").

POR QUE EXISTE (Benja, 05/10/2026)
Hasta el 05/10 el catalogo pedia noindex: era de uso interno. Desde que vive en
catalogo.advancetecno.com.ar sale a Google, y el catalogo es UNA pagina que
arma todo con JavaScript: las fichas se abren con #p=ID y Google no ve las
partes despues del #. Solo indexaria la portada. Por eso cada modelo tiene su
pagina propia, con el nombre, las versiones, los precios, la foto, el regalo y
la descripcion escritos en el HTML. Benja eligio la opcion A de la muestra "El
catalogo en Google": con precio ("desde u$...").

COMO SE ARMAN
Igual que las vistas previas de WhatsApp (vista-previa.py, de donde se usan
la bajada de ADVAPP, el servidor y Chrome): se abre index.html con los datos
de ADVAPP en Chrome sin ventana y paginas-producto.js le pide a la pagina los
modelos ya armados. Asi la pagina dice lo mismo que la ficha del catalogo.

LO QUE NO CAMBIA NUNCA SOLO
- La direccion de un modelo: la primera vez se arma con su nombre
  ("apple-iphone-17-pro") y queda guardada en producto/indice.json, por su
  familia (el SKU madre). Si manana ADVAPP corrige el nombre, la direccion
  sigue: para Google una direccion que cambia es una pagina nueva.
- Las paginas no se borran. La de un modelo que hoy no esta queda, marcada sin
  stock en los datos para Google; al abrirla, el script trae los precios del
  momento de ADVAPP y dice que hoy no hay.
- Salvo que ese modelo siga a la venta con OTRA direccion (19/10/2026,
  chequeo de la web): ADVAPP le cambio el SKU madre o el grupo antes de que
  existiera la herencia de asignar_slugs (W3-05, 13/10), y quedaron dos
  paginas del mismo producto. "apple-iphone-17-pro-2" decia "Hoy sin stock" al
  lado de la de verdad, con stock, y "sony-joystick-ps5" competia con
  "sony-joystick-ps5-2" con una foto que ya no existe. Si alguna version de la
  pagina vieja (su ID o su SKU) esta hoy en un modelo, o su SKU empieza con el
  SKU madre de un modelo de hoy, y es uno solo, la vieja pasa a ser un desvio
  a esa (destino_de_la_vieja): canonica a la nueva, refresh 0 (Google lo toma
  como redireccion) y afuera del sitemap. La direccion vieja sigue andando
  para quien la tenga guardada.
- La unica direccion que se corrigio sola (20/10/2026, auditoria G-08): la
  que nacio cuando slug() borraba el "+". "Samsung Galaxy Tab A11+" se llevo
  "samsung-galaxy-tab-a11", la del A11, y el A11 quedo en "-2". Desde ese dia
  el "+" pegado a una palabra se escribe "plus"; el A11+ pasa a
  "samsung-galaxy-tab-a11-plus" y la vieja es un desvio a esa, con el mismo
  mecanismo de arriba (asignar_slugs y aplicar). El A11 se queda en la suya.

LOS LINKS (05/11/2026, auditoria TG-05)
Hasta el 05/11 ningun link llevaba a estas paginas: Google las conocia solo
por el sitemap, y en Search Console figuraban 24 indexadas y 453 sin indexar.
Ahora cada pagina trae "Otros modelos" (hasta 6 del mismo rubro o la misma
marca, elegir_otros) y el pie lleva a producto/index.html, "Todos los
modelos", que las lista a todas por rubro y esta linkeada desde el pie de la
portada. Todo escrito en el HTML: Google lo ve sin correr JavaScript.

EL PRECIO (13/10/2026, auditoria W3-06)
Hasta el 13/10 el HTML llevaba el precio y el stock del dia en que se armo, y
lo que leen Google y las vistas previas (la descripcion "Desde u$...", la tabla
y los datos para Google sin ejecutar) quedaba viejo al otro dia: a las 22 h de
un PUBLICAR, 119 de 715 versiones tenian otro precio y 16 otro stock. Ahora el
HTML NO fija ni precio ni stock: dice "Consulta el precio" y la tabla trae las
versiones y los colores sin numeros. Al abrir la pagina, el script trae de
ADVAPP el precio y el stock del momento y los pone en el recuadro, la tabla y
los datos para Google (offers del JSON-LD: Google ejecuta el script al
indexar), con los pesos del dolar del catalogo (dolarapi, la misma casa y el
mismo recargo). Si ADVAPP no contesta, queda "Consulta el precio" con el
WhatsApp: nunca un precio viejo. Lo agotado no muestra precio (D15 B).
El resto (nombre, versiones, colores, foto, regalo, descripcion, ficha
tecnica, migas, direccion propia) sigue igual para Google.

PARA LOS BUSCADORES CON IA (Benja, 12/11/2026)
«Advapp: web en buscadores con IA». ChatGPT, Perplexity, Claude y en parte
Gemini y Copilot leen el HTML tal como llega, sin correr el script: en cada
pagina veian "Consulta el precio" y en la portada, "Cargando…". Benja eligio
"Si, con fecha": el precio del momento escrito, con la hora.
- Con --con-precio cada pagina que se rearma lleva escrito el precio, el
  stock y los datos para Google de ese momento, con "Precio al 12/11/2026,
  13:05". Lo agotado, sin precio (D15 B). Lo corre SOLO el workflow de
  Publicar (.github/workflows/publicar.yml), sobre la copia que publica: en
  cada publicacion y a las 15:07 y a las 18:07 (Benja: «solo a las 15h y
  18h»; no en punto porque GitHub demora o saltea las de la hora exacta).
  No gasta tokens ni relee listas: baja de ADVAPP lo mismo que la portada
  (resource=tecno-web). El repo y PUBLICAR siguen sin precio, asi que lo
  publicado en producto/ ya no es igual a main. Lo del W3-06 (a las 22 h de
  un PUBLICAR, 119 de 715 versiones tenian otro precio) se cubre con la hora
  escrita al lado de cada precio. Al abrir, el script trae
  lo de ADVAPP como siempre; lo escrito queda hasta que llega (o hasta que se
  toca otra version o color), y si ADVAPP no contesta se saca y queda
  "Consulta el precio": a una persona nunca se le muestra un precio viejo.
- preguntas/index.html: las preguntas frecuentes de la portada tal cual las
  dibuja (ppPreguntas en paginas-producto.js), en una pagina fija.
- llms.txt: un resumen para las IA (formato de llmstxt.org): quienes somos,
  las paginas, las preguntas en texto y cada modelo con su link (con
  --con-precio, con su "desde"). robots.txt lo deja leer.
Nada de esto escribe texto nuevo: sale de la portada y de ADVAPP.

LA MEDICION (12 y 13/11/2026)
Cada pagina anota en el registro de la portada (MEDICION-ADVAPP.txt), con la
misma visita: que se abrio y desde donde (pagina_producto, con ref), si llego
tocando un aviso pago (pauta y campania: Benja, 13/11, «dale con la
medicion», antes de prender avisos en Google) y el toque a WhatsApp (whatsapp
desde "pagina" o "pagina-pie"). Con la medicion apagada en index.html, o con
Do Not Track, nada. Leida, la pauta sale de la direccion. Lo que hace de
verdad el script con todo esto se prueba en Chrome sin ventana:
    python3 herramientas/probar-pagina-modelo.py
(el workflow de Publicar lo corre en cada PR; --probar solo mira el texto).

Codigos de salida: 0 bien, 2 no se pudieron armar (producto/ queda como estaba).
"""
import datetime
import hashlib
import html
import importlib.util
import io
import json
import os
import re
import sys
import urllib.parse

sys.dont_write_bytecode = True
AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
JS = os.path.join(AQUI, 'paginas-producto.js')
JS_VP = os.path.join(AQUI, 'vista-previa.js')
CARPETA = os.path.join(RAIZ, 'producto')
INDICE = os.path.join(CARPETA, 'indice.json')
SITEMAP = os.path.join(RAIZ, 'sitemap.xml')


def cargar_vista_previa():
    """vista-previa.py tiene un guion en el nombre: se carga por la ruta."""
    spec = importlib.util.spec_from_file_location('vista_previa', os.path.join(AQUI, 'vista-previa.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


LECTOR = '''<script>
%s
/* paginas-producto.py: cuando la pagina termina de armar los productos, se
   calculan las paginas de producto y se dejan, en JSON, en un pre al final. */
(() => {
  let corriendo = false;
  const espera = setInterval(async () => {
    if(corriendo || !MODELOS.length || !FUENTE) return;
    corriendo = true;
    clearInterval(espera);
    let salida;
    try{ salida = await paginasDeProducto(); }
    catch(e){ salida = { error: String((e && e.stack) || e) }; }
    for(let i = 1; i < 5000; i++){ clearInterval(i); clearTimeout(i); }
    const pre = document.createElement('pre');
    pre.id = 'PAGINAS';
    pre.textContent = JSON.stringify(salida);
    document.body.appendChild(pre);
  }, 100);
})();
</script>
'''


def pagina_de_trabajo(VP, src, url_advapp):
    """index.html con la medicion apagada, ADVAPP desviado a la copia y el
    calculo al final (lo mismo que hace vista-previa.py, con otro lector)."""
    src, n = VP.RE_ANALITICA.subn(r"\1'';", src, count=1)
    if n != 1:
        raise ValueError('no encontre ANALITICA_URL en index.html: sin apagarla no se abre la pagina')
    if not url_advapp:
        raise ValueError('no encontre ADVAPP_URL en index.html')
    inter = VP.INTERCEPTOR % (json.dumps(url_advapp), json.dumps(VP.COPIA_WEB))
    i = src.find('<meta charset="utf-8">')
    i = i + len('<meta charset="utf-8">') if i != -1 else src.find('<head>') + len('<head>')
    src = src[:i] + '\n' + inter + src[i:]
    j = src.rfind('</body>')
    if j == -1:
        raise ValueError('index.html sin </body>')
    js = io.open(JS_VP, encoding='utf-8').read() + '\n' + io.open(JS, encoding='utf-8').read()
    return src[:j] + (LECTOR % js) + src[j:]


def calcular_en_la_web(VP, crudo, puerto=0):
    src = VP.leer_index()
    try:
        pagina = pagina_de_trabajo(VP, src, VP.url_de_advapp(src)).encode('utf-8')
    except ValueError as ex:
        return None, str(ex)
    extras = {VP.PAGINA_WEB: (pagina, 'text/html; charset=utf-8'),
              VP.COPIA_WEB: (crudo, 'application/json; charset=utf-8')}
    try:
        srv = VP.levantar_servidor(puerto, extras)
    except OSError as ex:
        return None, 'no pude levantar el servidor local (%s)' % ex
    try:
        dom, motivo = VP.abrir_en_chrome('http://127.0.0.1:%d%s' % (srv.server_address[1], VP.PAGINA_WEB))
    finally:
        srv.shutdown()
        srv.server_close()
    if dom is None:
        return None, motivo
    m = re.search(r'<pre id="PAGINAS">(\{.*?)</pre>', dom or '', re.S)
    if not m:
        return None, 'la pagina no llego a armar los productos'
    try:
        datos = json.loads(html.unescape(m.group(1)))
    except ValueError:
        return None, 'lo que armo la pagina no es JSON'
    if datos.get('error'):
        return None, 'paginas-producto.js fallo: %s' % datos['error'][:400]
    return datos, None


# --------------------------------------------------------------------------
# La direccion de cada modelo
# --------------------------------------------------------------------------

def slug(texto, con_plus=True):
    """El nombre hecho direccion. con_plus=False: como era hasta el 20/10/2026
    (lo usa asignar_slugs para reconocer las direcciones que nacieron asi)."""
    t = html.unescape(str(texto or '')).lower()
    for a, b in (('á', 'a'), ('é', 'e'), ('í', 'i'), ('ó', 'o'), ('ú', 'u'), ('ü', 'u'), ('ñ', 'n'), ('"', ' pulgadas')):
        t = t.replace(a, b)
    # (20/10/2026, auditoria G-08) El "+" pegado al final de una palabra es
    # "plus": se perdia, el Galaxy Tab A11+ se llevo "samsung-galaxy-tab-a11",
    # la direccion del A11, y el A11 quedo en "-2". El "+" suelto ("Neo 2 +
    # Fly More Combo", "+Pencil") o entre dos palabras ("Denim+Milky") es un
    # "y", y sigue siendo un guion: esas direcciones no cambian.
    if con_plus:
        t = re.sub(r'(?<=[a-z0-9])\+(?![a-z0-9])', ' plus ', t)
    t = re.sub(r'[^a-z0-9]+', '-', t).strip('-')
    return t[:80].strip('-') or 'producto'


# La direccion que tenia un modelo antes de corregirla (G-08): queda en el
# indice como "antes:<familia>" y aplicar() la hace desvio a la de hoy.
ANTES = 'antes:'


def leer_indice():
    try:
        with io.open(INDICE, encoding='utf-8') as fh:
            d = json.load(fh)
        return {'slugs': dict(d.get('slugs') or {}), 'lastmod': dict(d.get('lastmod') or {})}
    except (OSError, ValueError, AttributeError):
        return {'slugs': {}, 'lastmod': {}}


def asignar_slugs(modelos, indice):
    """familia -> slug. Lo ya asignado no se toca; lo nuevo, del nombre, sin
    pisar uno que ya exista.

    Salvo que la direccion que le tocaria por el nombre sea la de una familia
    que HOY no esta (13/10/2026, auditoria W3-05 y el cambio de slug del
    Joystick PS5 en ADVAPP): es el mismo producto, al que ADVAPP le cambio el
    SKU madre o el grupo ("G:accesorio-gaming~sony~consultar-estandar-joystick-
    ps5" pasa a "M:ACG-SON-JOYPS5"). Hereda esa direccion, la que ya conoce
    Google: si no, la vieja quedaba "sin stock" y salia una nueva
    "sony-joystick-ps5-2" con el mismo producto.

    Y la unica vez que una direccion asignada cambia (20/10/2026, G-08): la
    que nacio con el "+" perdido. Si el nombre del modelo tiene un "+" pegado
    ("Galaxy Tab A11+") y su direccion es la que le daba el slug de antes
    ("samsung-galaxy-tab-a11", o con su "-2"), pasa a la del nombre con "plus"
    ("samsung-galaxy-tab-a11-plus") y la vieja queda guardada como
    "antes:<familia>": aplicar() la hace desvio a la nueva, asi la direccion
    que ya conoce Google sigue llevando al mismo producto. Pasa una sola vez:
    la nueva ya no es la del slug de antes. Una direccion guardada antes no se
    hereda (no entra en `libres`): es la de otro producto que sigue a la venta."""
    slugs = indice['slugs']
    hoy = {m['familia'] for m in modelos}
    libres = {}
    for f, s in slugs.items():
        if f not in hoy and not f.startswith(ANTES) and s not in libres:
            libres[s] = f
    usados = set(slugs.values())

    def sin_usar(base):
        s, n = base, 2
        while s in usados:
            s = '%s-%d' % (base, n)
            n += 1
        usados.add(s)
        return s

    for m in modelos:
        f = m['familia']
        if f in slugs:
            vieja, nueva = slug(m['titulo'], con_plus=False), slug(m['titulo'])
            if (nueva != vieja and ANTES + f not in slugs
                    and re.fullmatch(re.escape(vieja) + r'(?:-\d+)?', slugs[f])):
                slugs[ANTES + f] = slugs[f]
                slugs[f] = sin_usar(nueva)
            continue
        base = slug(m['titulo'])
        if base in libres:
            del slugs[libres.pop(base)]
            slugs[f] = base
            continue
        slugs[f] = sin_usar(base)
    return slugs


# --------------------------------------------------------------------------
# La pagina
# --------------------------------------------------------------------------

def numero_wa(d):
    """5491100000000 -> +54 9 11 0000-0000 (como el pie del catalogo)."""
    d = re.sub(r'\D', '', str(d or ''))
    if len(d) == 13 and d.startswith('549'):
        return '+54 9 %s %s-%s' % (d[3:5], d[5:9], d[9:])
    return '+' + d if d else ''


def e(s):
    return html.escape(str(s if s is not None else ''), quote=True)


def plata(n):
    return '{:,}'.format(int(round(n))).replace(',', '.')


def recortar(t, largo=160):
    """Lo que Google muestra entra en ~160 caracteres: se corta en una palabra."""
    t = re.sub(r'\s+', ' ', t).strip()
    if len(t) <= largo:
        return t
    corte = t[:largo - 1].rsplit(' ', 1)[0].rstrip(',;:.')
    return corte + '…'


def descripcion_corta(m, cuotas):
    """Lo que Google muestra debajo del titulo. Sin precio ni stock (13/10/2026,
    W3-06): los dos cambian todos los dias y esto queda guardado en Google hasta
    que vuelve a pasar. Dice el nombre (32 sin stock decian exactamente lo mismo,
    06/10), las cuotas, el regalo y el primer renglon de "Por que elegirlo"."""
    partes = ['%s: precio del día en dólares o en pesos' % m['titulo']]
    if cuotas:
        partes.append('hasta %d cuotas' % cuotas)
    if m.get('regalo') and m.get('incluye'):
        partes.append('de regalo ' + re.sub(r'^\s*\+\s*', '', m['incluye']).replace('🎁', '').strip())
    venta = ((m.get('descripcion') or {}).get('venta') or [''])[0]
    return recortar(' '.join(x for x in (', '.join(partes) + '.', 'Envíos a todo el país.', venta) if x))


def oferta_sin_precio(m, url):
    """Lo fijo de los datos para Google de la oferta: moneda, vendedor, estado.
    El precio y el stock los pone el script de la pagina con lo de ADVAPP del
    momento (13/10/2026, W3-06); sin stock, no va oferta (D15 B)."""
    return {
        '@type': 'AggregateOffer', 'priceCurrency': 'USD', 'url': url,
        'seller': {'@type': 'Organization', 'name': 'Advance Tecno'},
        # Lo publicado es nuevo (la "Caja blanca" tambien, 06/10), salvo el
        # usado, que va en su propia pagina (W3-10, 13/10/2026)
        'itemCondition': 'https://schema.org/' + ('UsedCondition' if m.get('usado') else 'NewCondition'),
    }


def datos_para_google(m, url, publica):
    # Sin "offers": el precio y el stock los pone el script al abrir (W3-06)
    producto = {
        '@context': 'https://schema.org', '@type': 'Product', 'name': m['titulo'],
        'brand': {'@type': 'Brand', 'name': m.get('marca') or 'Advance Tecno'},
        'category': m.get('rubro') or m.get('categoria') or '',
        'description': ' '.join((m.get('descripcion') or {}).get('venta') or []) or m['titulo'],
    }
    if m.get('foto_og'):
        producto['image'] = [publica + m['foto_og']]
    migas = {
        '@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'Catálogo', 'item': publica},
            {'@type': 'ListItem', 'position': 2, 'name': m.get('rubro') or 'Productos',
             'item': publica + '?cat=' + urllib.parse.quote(m.get('categoria') or '')},
            {'@type': 'ListItem', 'position': 3, 'name': m['titulo'], 'item': url},
        ]}
    # </ adentro de un <script> cerraria el script: se escapa la barra
    return [json.dumps(x, ensure_ascii=False).replace('</', '<\\/') for x in (producto, migas)]


CSS = r'''
@font-face{font-family:"Lilita One";src:url(../../assets/lilita-latin.woff2) format("woff2");font-display:swap}
:root{--papel:#F4EFFD;--tarjeta:#FFFFFF;--tinta:#170F28;--suave:#584D70;--tenue:#8E84A8;--linea:#E0D4F7;
      --acento:#7C3AED;--verde:#0A7050;--verde-suave:#E3F4EC;
      --display:"Lilita One","Futura","Avenir Next",system-ui,sans-serif;
      --sans:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
      --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace}
*{box-sizing:border-box}
body{margin:0;background:var(--papel);color:var(--tinta);font:15px/1.5 var(--sans)}
a{color:inherit}
.barra{background:#151220;color:#fff}
.barra .in{max-width:1080px;margin:0 auto;padding:12px 16px;display:flex;align-items:center;gap:12px}
.barra a.logo{display:flex;align-items:center;gap:10px;text-decoration:none;color:#fff}
.barra a.logo img{height:22px;width:auto;filter:brightness(0) invert(1)}
.barra a.logo b{font:400 17px/1 var(--display);letter-spacing:.06em;text-transform:uppercase}
.barra a.logo b span{color:#C4A6FF}
.barra a.cat{margin-left:auto;font:600 12px/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:#C9BFE0;text-decoration:none}
main{max-width:1080px;margin:0 auto;padding:16px 16px 40px;display:grid;gap:18px}
.migas{font:500 11px/1.4 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--tenue)}
.migas a{color:var(--tenue)}
.prod{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px;align-items:start}
@media (max-width:760px){.prod{grid-template-columns:minmax(0,1fr)}}
.foto{aspect-ratio:4/3;display:grid;place-items:center}
.foto img{width:100%;height:100%;object-fit:contain;display:block}
.datos{display:grid;gap:12px}
.marca{font:600 10.5px/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--acento)}
h1{margin:4px 0 0;font:400 clamp(28px,5vw,42px)/1.02 var(--display);text-transform:uppercase}
.regalo{font-size:13.5px;font-weight:600;color:var(--verde);background:var(--verde-suave);border-radius:10px;padding:8px 11px}
.eje{display:grid;gap:6px}
.eje small{font:600 10px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--tenue)}
.fila{display:flex;flex-wrap:wrap;gap:6px}
.chip{border:1.5px solid var(--linea);background:var(--tarjeta);color:var(--tinta);border-radius:999px;padding:8px 13px;font:600 13px/1 var(--sans);cursor:pointer}
.chip[aria-pressed="true"]{border-color:var(--acento);color:var(--acento)}
.chip:disabled{opacity:.45;cursor:default}
.precio{background:var(--tinta);color:#fff;border-radius:16px;padding:14px 16px;display:grid;gap:4px}
.precio b{font:400 32px/1 var(--display);letter-spacing:.01em}
.precio i{font:500 12px/1.3 var(--mono);font-style:normal;color:#C9BFE0}
.precio.sin b{font-size:22px}
.wa{display:block;text-align:center;text-decoration:none;background:var(--acento);color:#fff;border-radius:999px;padding:14px;font:600 13px/1 var(--sans);letter-spacing:.04em}
.ver{display:block;text-align:center;text-decoration:none;border:1.5px solid var(--linea);color:var(--tinta);border-radius:999px;padding:12px;font:600 13px/1 var(--sans);background:var(--tarjeta)}
section.bloque{background:var(--tarjeta);border-radius:16px;padding:16px 18px;display:grid;gap:10px}
section.bloque h2{margin:0;font:400 20px/1.1 var(--display);text-transform:uppercase}
section.bloque p{margin:0;color:var(--suave)}
.puntos{margin:0;padding:0;list-style:none;display:grid;gap:10px}
.puntos b{display:block}
.puntos span{color:var(--suave);font-size:14px}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:8px 6px;border-top:1px solid var(--linea);vertical-align:top}
th{font:600 10.5px/1.4 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--tenue)}
td.num{white-space:nowrap;font-variant-numeric:tabular-nums}
.tabla{overflow-x:auto}
.ficha h3{margin:8px 0 2px;font:600 11px/1.4 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--acento)}
.ficha dl{margin:0;display:grid;grid-template-columns:minmax(90px,34%) minmax(0,1fr)}
.ficha dt,.ficha dd{margin:0;padding:7px 0;border-top:1px solid var(--linea);font-size:13.5px}
.ficha dt{color:var(--suave);padding-right:10px}
footer{max-width:1080px;margin:0 auto;padding:0 16px 32px;color:var(--tenue);font-size:12.5px;display:grid;gap:4px}
a:focus-visible,.chip:focus-visible{outline:2px solid var(--acento);outline-offset:2px}
.otros{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px}
.otros a{display:block;height:100%;padding:10px 12px;border:1.5px solid var(--linea);border-radius:12px;background:var(--papel);text-decoration:none;font-weight:600;font-size:14px;line-height:1.3}
.otros a:hover{border-color:var(--acento);color:var(--acento)}
.todos{justify-self:start;font:600 11.5px/1.4 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--acento)}
.congelado{margin:0;padding:10px 12px;border-radius:12px;background:var(--tarjeta);box-shadow:inset 0 0 0 1.5px var(--linea);color:var(--tinta);font-size:13.5px;line-height:1.4}
.congelado[hidden]{display:none}
.congelado b{font-weight:700}
'''

# El script de la pagina: elegir version y color, y traer el precio y el stock
# del momento (13/10/2026, W3-06: el HTML ya no trae ninguno de los dos).
SCRIPT = r'''
(() => {
  const D = JSON.parse(document.getElementById('datos').textContent);
  const $ = (id) => document.getElementById(id);
  const plata = (n) => Math.round(n).toLocaleString('es-AR');
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // El precio de ahora adentro del mensaje, en el lugar que dejó
  // paginas-producto.js (26/10/2026): "... en Black (USD 190). ¿Me pasás info?".
  // Sin precio del momento, el mensaje va sin precio, nunca con uno viejo.
  const conPrecio = (link, pos, precio) => {
    const i = String(link || '').indexOf('?text=');
    if(i < 0 || typeof pos !== 'number' || !(precio > 0)) return link;
    try{
      const t = decodeURIComponent(link.slice(i + 6));
      return link.slice(0, i + 6) + encodeURIComponent(t.slice(0, pos) + ' (USD ' + plata(precio) + ')' + t.slice(pos));
    }catch(e){ return link; }
  };
  // vivo: ya llegó lo de ADVAPP; antes (o si no llega) no se dice precio ni stock
  let tc = null, version = null, color = null, vivo = false;
  // Arranca en la primera versión (vienen ordenadas: con stock y más barata primero, el día que se armó)
  const primera = D.versiones[0];
  if(primera){ version = primera.version; color = primera.color; }
  const versiones = () => [...new Set(D.versiones.map((x) => x.version))];
  const elegida = () => D.versiones.find((x) => x.version === version && x.color === color)
    || D.versiones.find((x) => x.version === version) || D.versiones[0];
  function pintar(){
    const x = elegida();
    version = x.version; color = x.color;
    const vs = versiones();
    $('versiones').hidden = vs.length < 2 || !vs.some(Boolean);
    // Con esc (auditoría 19/10/2026, T-01): un 13" cortaba el atributo y el botón no elegía nada
    $('fila-versiones').innerHTML = vs.map((v) => `<button type="button" class="chip" data-v="${esc(v)}" aria-pressed="${v === version}">${esc(v || 'Única')}</button>`).join('');
    const colores = D.versiones.filter((y) => y.version === version && y.color);
    $('colores').hidden = !colores.length;
    $('fila-colores').innerHTML = colores.map((y) => `<button type="button" class="chip" data-c="${esc(y.color)}" aria-pressed="${y.color === color}">${esc(y.color)}</button>`).join('');
    if(x.foto) $('foto').src = (/^https?:/.test(x.foto) ? '' : '../../') + x.foto;
    // Con el SKU de respaldo: si mañana ADVAPP le cambia el ID, la web encuentra el modelo (W3-03)
    $('ver').href = '../../#p=' + encodeURIComponent(x.clave) + (x.sku && x.sku !== x.clave ? '&s=' + encodeURIComponent(x.sku) : '');
    // El WhatsApp de la versión y el color elegidos (06/10), según el stock de ahora
    const wa = document.querySelector('a.wa');
    const sin = vivo && !x.stock;
    const precio = vivo ? x.precio : null;
    if(wa && (x.wa || x.aviso)){ wa.href = (sin ? conPrecio(x.aviso, x.avisoPos, precio) : conPrecio(x.wa, x.waPos, precio)) || x.wa; wa.textContent = sin ? 'Avisame cuando entre' : 'Consultar por WhatsApp'; }
    const caja = $('precio');
    if(vivo && x.stock && x.precio){
      caja.className = 'precio';
      caja.innerHTML = `<b>USD ${plata(x.precio)}</b><i>${tc ? '≈ $ ' + plata(x.precio * tc) + ' · ' : ''}${D.cuotas ? 'hasta ' + D.cuotas + ' cuotas' : ''}</i>`;
    }else if(vivo){
      caja.className = 'precio sin';
      caja.innerHTML = '<b>Hoy sin stock</b><i>Escribinos y te avisamos cuando entre</i>';
    }else{
      caja.className = 'precio sin';
      caja.innerHTML = '<b>Consultá el precio</b><i>El precio y el stock del día, por WhatsApp</i>';
    }
    document.querySelectorAll('[data-v]').forEach((b) => b.onclick = () => { version = b.dataset.v; color = null; pintar(); });
    // (los data-v y data-c llevan el texto tal cual: se compara con el de la versión)
    document.querySelectorAll('[data-c]').forEach((b) => b.onclick = () => { color = b.dataset.c; pintar(); });
  }
  pintar();
  /* El precio y el stock del momento: los de ADVAPP, como el catálogo. Si no
     llegan, queda "Consultá el precio" con el WhatsApp: el HTML no trae un
     precio viejo para mostrar (W3-06, 13/10/2026). Cada versión se busca por
     su ID y, si ADVAPP se lo cambió, por su SKU (W3-03). */
  fetch(D.advapp).then((r) => r.ok ? r.json() : null).then((j) => {
    const filas = j && Array.isArray(j.productos) ? j.productos : null;
    if(!filas) return;
    const porId = new Map(filas.map((f) => [String(f.ID), f]));
    const porSku = new Map(filas.filter((f) => f.SKU_VARIANTE).map((f) => [String(f.SKU_VARIANTE).trim().toUpperCase(), f]));
    for(const x of D.versiones){
      const f = porId.get(String(x.clave)) || (x.sku ? porSku.get(String(x.sku).toUpperCase()) : null);
      if(!f){ x.stock = false; x.precio = null; continue; }
      if(f.ID) x.clave = String(f.ID);
      const p = Number(String(f['Precio USD'] || '').replace(/[^\d.]/g, ''));
      x.precio = p > 0 ? p : null;
      x.stock = String(f.Stock || '').toLowerCase().startsWith('s') && p > 0;
    }
    vivo = true;
    // Arranca en la más barata con stock, como el catálogo
    const con = D.versiones.filter((x) => x.stock).sort((a, b) => a.precio - b.precio);
    if(con.length && !con.some((x) => x.version === version && x.color === color)){ version = con[0].version; color = con[0].color; }
    pintar();
    /* La tabla y los datos para Google, con lo de ahora (06/10): antes solo
       cambiaba el recuadro y la misma página mostraba dos precios. Lo
       agotado sin precio (D15 B, 13/10/2026). */
    const tb = $('filas');
    const orden = (a, b) => (b.stock - a.stock) || ((a.precio || 0) - (b.precio || 0)) || String(a.version).localeCompare(b.version) || String(a.color).localeCompare(b.color);
    if(tb) tb.innerHTML = [...D.versiones].sort(orden)
      .map((x) => `<tr><td>${esc(x.version || '—')}</td><td>${esc(x.color || '—')}</td><td class="num">${x.stock ? 'u$' + plata(x.precio) : '—'}</td><td>${x.stock ? 'Sí' : 'Sin stock'}</td></tr>`).join('');
    const ld = document.querySelector('script[type="application/ld+json"]');
    try{
      const j = JSON.parse(ld.textContent);
      if(con.length && D.oferta){
        const ps = con.map((x) => x.precio);
        j.offers = Object.assign({}, D.oferta, { lowPrice: Math.min(...ps), highPrice: Math.max(...ps),
          offerCount: con.length, availability: 'https://schema.org/InStock' });
      }else delete j.offers;
      ld.textContent = JSON.stringify(j).replace(/<\//g, '<\\/');
    }catch(e){}
  }).catch(() => {});
  // Los pesos, con el dólar del catálogo (la misma casa y el mismo recargo)
  if(D.cotizacion && D.cotizacion.tipo){
    fetch('https://dolarapi.com/v1/dolares').then((r) => r.ok ? r.json() : null).then((todas) => {
      const d = Array.isArray(todas) && todas.find((x) => x && x.casa === D.cotizacion.tipo);
      const v = d && Number(d.venta);
      if(!(v > 0)) return;
      const final = v * (1 + (D.cotizacion.recargo || 0) / 100) + (D.cotizacion.recargoFijo || 0);
      if(final > 0){ tc = final; pintar(); }
    }).catch(() => {});
  }
  /* De dónde llegó (12/11/2026, buscadores con IA): la página anota UNA vez,
     en el registro de la portada (MEDICION-ADVAPP.txt), el sitio del que vino
     la persona, para contar cuántos llegan desde ChatGPT, Perplexity, Google...
     Con la misma visita de la portada (sessionStorage): si después toca "Ver
     en el catálogo", se sabe de dónde venía. Con Do Not Track, nada; si algo
     falla, nada. Sin D.registro (la medición apagada), nada. */
  // El nombre de la página: el último tramo de la dirección, sin el index.html
  const pagina = location.pathname.split('/').filter((x) => x && x !== 'index.html').pop() || '';
  let visita = '';
  const anotar = (evento) => {
    try{
      if(!D.registro || navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
      if(!visita){
        try{ visita = sessionStorage.getItem('advtecno.visita') || crypto.randomUUID(); sessionStorage.setItem('advtecno.visita', visita); }
        catch(e){ visita = String(Math.random()).slice(2) + Date.now().toString(36); }
      }
      const cuerpo = JSON.stringify({ v: 1, sitio: 'tecno-web', visita,
        eventos: [Object.assign({}, evento, { pagina, ms: Math.round(performance.now()) })] });
      // Como la portada: sendBeacon y, si no está o no lo toma, fetch con keepalive
      if(navigator.sendBeacon && navigator.sendBeacon(D.registro, new Blob([cuerpo], { type: 'text/plain;charset=UTF-8' }))) return;
      fetch(D.registro, { method: 'POST', body: cuerpo, keepalive: true,
                          headers: { 'Content-Type': 'text/plain;charset=UTF-8' } }).catch(() => {});
    }catch(e){}
  };
  /* Si llegó tocando un aviso pago (13/11/2026, Benja: «dale con la
     medición»): un clic pago de Google y uno gratis llegaban los dos como
     "www.google.com". Google le agrega a la dirección gclid (gbraid o wbraid
     en iPhone) y gad_source; cualquier otra pauta se marca a mano en el link
     del aviso, con utm_medium=cpc (o cualquier medio pago: paid_social, cpm,
     display, ads…; la lista está en la función) y utm_source=<de quién es>.
     Se anota de quién es la pauta y la campaña (utm_campaign, o el número
     que pone Google en gad_campaignid); el código del clic no se guarda. Es
     la misma función que la de la portada (index.html, MEDICIÓN): si cambia
     una, cambia la otra (--probar y probar-pagina-modelo.py las comparan). */
  const pautaDe = (busqueda) => {
    try{
      const s = new URLSearchParams(busqueda);
      const limpio = (v, largo) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/[^a-z0-9 ._-]+/g, ' ').trim().slice(0, largo);
      // Un medio es pago si alguna de sus palabras es de avisos (paid_social son dos)
      const paga = limpio(s.get('utm_medium'), 30).split(/[^a-z0-9]+/).some((m) =>
        /^(cp[a-z]|ppc|ads?|display|banner|sponsored|pago|paga|pauta|retargeting|remarketing|paid[a-z]*)$/.test(m));
      const pauta = ['gclid', 'gbraid', 'wbraid', 'gad_source'].some((k) => s.get(k)) ? 'google'
        : paga ? (limpio(s.get('utm_source'), 30) || 'otra') : '';
      if(!pauta) return {};
      const campania = limpio(s.get('utm_campaign'), 40) || limpio(s.get('gad_campaignid'), 40);
      return campania ? { pauta, campania } : { pauta };
    }catch(e){ return {}; }
  };
  const entrada = pautaDe(location.search);
  {
    let ref = '';
    try{ ref = document.referrer ? new URL(document.referrer).hostname : ''; }catch(e){}
    anotar(Object.assign({ t: 'pagina_producto', ref }, entrada));
  }
  /* Leída, la pauta sale de la dirección (como en la portada): el link de la
     barra mandado a un amigo o guardado en favoritos volvía a contar como un
     clic pago cada vez que alguien lo abría. Con la medición apagada no se
     toca nada. */
  if(entrada.pauta && D.registro){
    try{
      const u = new URL(location.href);
      ['gclid', 'gbraid', 'wbraid', 'gad_source', 'gad_campaignid',
       'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id'].forEach((k) => u.searchParams.delete(k));
      history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    }catch(e){}
  }
  /* El toque a WhatsApp (13/11/2026): es lo que dice si la página sirvió, y
     desde acá no se anotaba (en la portada sí). desde: "pagina" es el botón
     de la versión elegida, con el producto, el precio del momento si ADVAPP
     ya contestó (lo agotado va sin precio, como en la página) y sin_stock si
     era "Avisame cuando entre"; "pagina-pie", el número escrito en el pie;
     "pagina-otro", cualquier otro link a WhatsApp que se sume a la página. */
  const toque = (ev) => {
    try{
      const a = ev.target.closest && ev.target.closest('a[href*="wa.me/"]');
      if(!a) return;
      const x = elegida() || {};
      anotar(!a.classList.contains('wa') ? { t: 'whatsapp', desde: a.closest('footer') ? 'pagina-pie' : 'pagina-otro' }
        : Object.assign({ t: 'whatsapp', desde: 'pagina', id: x.clave, color: x.color, version: x.version },
                        vivo && x.stock && x.precio ? { precio: x.precio } : {}, vivo && !x.stock ? { sin_stock: true } : {}));
    }catch(e){}
  };
  document.addEventListener('click', toque, true);
  // Con el botón del medio WhatsApp se abre en otra pestaña y no es un "click"
  document.addEventListener('auxclick', (ev) => { if(ev.button === 1) toque(ev); }, true);
})();
'''


# --------------------------------------------------------------------------
# Los precios del viernes (Benja, 07/11/2026)
# --------------------------------------------------------------------------
# «Congelemos los del viernes avisando que es probable que el lunes cambien».
# El sábado no sale lista, y el fin de semana y los días que se cierra ADVAPP
# manda en el sobre precios_congelados = {dia, cambian}. Abajo del recuadro del
# precio la página lo dice, como la portada: "Precios del viernes 06/11. Es
# probable que cambien el lunes." Sin el dato no se muestra nada. Va entre
# llaves: sus nombres no chocan con los del script, tampoco con los viejos.
ANCLA_PRECIOS = """    const filas = j && Array.isArray(j.productos) ? j.productos : null;
    if(!filas) return;
"""
AVISO_JS = r"""    { /* Los precios del viernes (07/11/2026): ver herramientas/paginas-producto.py */
      const pc = j.precios_congelados, fecha = /^(\d{4})-(\d{2})-(\d{2})$/, cong = document.getElementById('congelado');
      if(cong && pc && fecha.test(pc.dia || '') && fecha.test(pc.cambian || '')){
        const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const dia = (iso) => dias[new Date(iso + 'T12:00:00Z').getUTCDay()];
        const f = fecha.exec(pc.dia);
        cong.innerHTML = '<b>Precios del ' + dia(pc.dia) + ' ' + f[3] + '/' + f[2] + '.</b> Es probable que cambien el ' + dia(pc.cambian) + '.';
        cong.hidden = false;
      }
    }
"""
assert SCRIPT.count(ANCLA_PRECIOS) == 1
SCRIPT = SCRIPT.replace(ANCLA_PRECIOS, ANCLA_PRECIOS + AVISO_JS, 1)
CSS_CONGELADO = '\n'.join(l for l in CSS.splitlines() if l.startswith('.congelado')) + '\n'
CONGELADO_HTML = '      <p class="congelado" id="congelado" hidden></p>\n'


def con_aviso_congelado(t):
    """El aviso de los precios del viernes en una pagina que no se rearma (la
    de un modelo que hoy no esta, y las de antes del 07/11/2026): el estilo,
    el renglon abajo del recuadro del precio y el codigo en el script, en los
    mismos lugares en que los pone armar_pagina. Lo que ya lo tiene, un desvio
    o lo que no reconoce, queda como esta."""
    t = t or ''
    if 'id="congelado"' in t or desvio_de(t) or ANCLA_PRECIOS not in t or t.count('</style>') != 1:
        return t
    m = re.search(r'(<div class="precio(?: sin)?" id="precio">.*?</div>\n)', t)
    if not m:
        return t
    t = t[:m.end()] + CONGELADO_HTML + t[m.end():]
    if '.congelado{' not in t:
        t = t.replace('</style>', CSS_CONGELADO + '</style>', 1)
    return t.replace(ANCLA_PRECIOS, ANCLA_PRECIOS + AVISO_JS, 1)


def html_otros(otros, rubro):
    """El bloque "Otros modelos" (05/11/2026, auditoria TG-05): links de
    verdad a otras paginas de producto/, para que Google llegue a cada una
    por un link y no solo por el sitemap. Al final, el indice del rubro
    (producto/#<rubro>). Sin otros modelos para nombrar, no va."""
    if not otros:
        return ''
    items = ''.join('<li><a href="../%s/">%s</a></li>' % (e(s), e(t)) for s, t in otros)
    return ('<section class="bloque" aria-labelledby="t-otros"><h2 id="t-otros">Otros modelos</h2>'
            '<ul class="otros">%s</ul><a class="todos" href="../#%s">Todos los modelos de %s</a></section>'
            % (items, e(slug(rubro)), e(rubro)))


def armar_pagina(m, s, publica, general, otros=None):
    url = '%sproducto/%s/' % (publica, s)
    desc = m.get('descripcion') or {}
    cuotas = general.get('cuotas') or 0
    meta_desc = descripcion_corta(m, cuotas)
    titulo_pag = '%s | Advance Tecno' % m['titulo']
    foto = m.get('foto') or ''
    src_foto = foto if foto.startswith('http') else ('../../' + foto if foto else '../../assets/preview.png')
    og = publica + (m.get('foto_og') or 'assets/preview.png')
    # La foto ilustrativa de un usado (Benja, 14/10/2026): la del mismo modelo
    # nuevo y del mismo color. En la pagina, con el cartel "Foto ilustrativa"
    # sobre la foto y en el texto alternativo, como en el catalogo. En og:image
    # y en los datos para Google no va (paginas-producto.js deja foto_og
    # vacio): ahi la imagen viaja sola, sin cartel. El estilo va en la etiqueta
    # y no en CSS: asi las paginas de lo nuevo quedan exactamente iguales.
    ilustrativa = bool(m.get('ilustrativa')) and bool(foto)
    alt_foto = m['titulo'] + (' (foto ilustrativa)' if ilustrativa else '')
    cartel = ('<span aria-hidden="true" style="position:absolute;right:8px;bottom:8px;padding:4px 9px;'
              'border-radius:999px;background:rgba(255,255,255,.9);box-shadow:inset 0 0 0 1px var(--linea);'
              'font:600 11px/1 var(--sans);color:var(--tinta)">Foto ilustrativa</span>') if ilustrativa else ''
    ld = datos_para_google(m, url, publica)
    # Sin precio ni stock (W3-06): los pone el script. Las versiones van en el
    # orden en que vinieron (con stock y mas barata primero, el dia que se armo).
    # waPos y avisoPos: donde va el precio del momento dentro del mensaje
    # (26/10/2026); sin el dato, null y el mensaje sale sin precio.
    versiones = [dict({k: x.get(k) or '' for k in ('version', 'color', 'clave', 'sku', 'foto', 'wa', 'aviso')},
                      **{k: x.get(k) if isinstance(x.get(k), int) else None for k in ('waPos', 'avisoPos')})
                 for x in m['versiones']]
    # El dolar del dia en que se armo NO va (19/10/2026): el script no lo usa
    # (los pesos salen de dolarapi al abrir; sin eso no hay pesos), y como
    # cambia todos los dias cada PUBLICAR reescribia todas las paginas y les
    # ponia la fecha de hoy en el sitemap aunque nada mas hubiera cambiado.
    cotiz = {k: v for k, v in (general.get('cotizacion') or {}).items() if k != 'valor'}
    datos = {'versiones': versiones, 'advapp': general.get('advapp') or '', 'cuotas': cuotas,
             'cotizacion': cotiz, 'oferta': oferta_sin_precio(m, url)}
    # Adonde anota de donde llego la persona (12/11/2026): el ANALITICA_URL
    # de la portada; con la medicion apagada no va y la pagina no anota nada
    if general.get('registro'):
        datos['registro'] = general['registro']
    filas = ''.join('<tr><td>%s</td><td>%s</td><td class="num">Consultar</td><td>—</td></tr>' % (
        e(x['version'] or '—'), e(x['color'] or '—'))
        for x in sorted(m['versiones'], key=lambda y: (y['version'], y['color'])))
    venta = ''.join('<p>%s</p>' % e(t) for t in (desc.get('venta') or []))
    puntos = ''.join('<li><b>%s</b><span>%s</span></li>' % (e(p['t']), e(p['x'])) for p in (desc.get('importante') or []))
    ficha = ''.join('<h3>%s</h3><dl>%s</dl>' % (e(g['grupo']), ''.join('<dt>%s</dt><dd>%s</dd>' % (e(k), e(v)) for k, v in g['filas']))
                    for g in (desc.get('ficha') or []))
    regalo = ('<div class="regalo">🎁 De regalo: %s</div>' % e(re.sub(r'^\s*\+\s*', '', m['incluye']).replace('🎁', '').strip())
              if m.get('regalo') and m.get('incluye') else
              ('<div class="regalo">%s</div>' % e(m['incluye']) if m.get('incluye') else ''))
    precio_txt = '<b>Consultá el precio</b><i>El precio y el stock del día, por WhatsApp</i>'
    # es-AR (05/11/2026, auditoria TG-11): como index.html y 404.html
    return '''<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- La pagina de este modelo para Google (Benja, 05/10/2026). La arma
     herramientas/paginas-producto.py en cada PUBLICAR: no editar a mano. -->
<title>{titulo_pag}</title>
<meta name="description" content="{meta_desc}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="Advance Tecno">
<meta property="og:locale" content="es_AR">
<meta property="og:title" content="{titulo}">
<meta property="og:description" content="{meta_desc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{og}">
<meta name="twitter:card" content="summary">
<link rel="icon" type="image/png" sizes="32x32" href="../../assets/icono-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="../../assets/icono-16.png">
<link rel="apple-touch-icon" href="../../assets/icono-180.png">
<script type="application/ld+json">{ld0}</script>
<script type="application/ld+json">{ld1}</script>
<style>{css}</style>
</head>
<body>
<header class="barra"><div class="in">
  <a class="logo" href="../../" aria-label="Advance Tecno: ir al catálogo"><img src="../../assets/logo-mark.png" alt=""><b>Advance <span>Tecno</span></b></a>
  <a class="cat" href="../../">Ver catálogo</a>
</div></header>
<main>
  <nav class="migas" aria-label="Estás en"><a href="../../">Catálogo</a> › <a href="../../?cat={cat_q}">{rubro}</a> › {titulo}</nav>
  <div class="prod">
    <div class="foto"{foto_rel}><img id="foto" src="{src_foto}" alt="{alt_foto}">{cartel}</div>
    <div class="datos">
      <div><div class="marca">{marca}</div><h1>{nombre}</h1></div>
      {regalo}
      <div class="eje" id="versiones"><small>Versión</small><div class="fila" id="fila-versiones"></div></div>
      <div class="eje" id="colores"><small>Color</small><div class="fila" id="fila-colores"></div></div>
      <div class="precio sin" id="precio">{precio_txt}</div>
      <p class="congelado" id="congelado" hidden></p>
      {wa}
      <a class="ver" id="ver" href="../../#p={clave_q}{sku_q}">Ver en el catálogo</a>
    </div>
  </div>
  {sec_venta}
  {sec_puntos}
  <section class="bloque" aria-labelledby="t-precios"><h2 id="t-precios">Versiones y precios</h2>
    <div class="tabla"><table><thead><tr><th>Versión</th><th>Color</th><th>Precio</th><th>Stock</th></tr></thead><tbody id="filas">{filas}</tbody></table></div>
    <p>Precios en dólares, del día: se cargan del catálogo al abrir la página. Se pueden pagar en pesos con el dólar del día y con tarjeta en cuotas.</p>
  </section>
  {sec_ficha}
  {sec_otros}
</main>
<footer>
  <b>Advance Tecno</b>
  <span>{direccion} · Envíos a todo el país · Atención con cita previa</span>
  {contacto}
  <span><a href="../">Todos los modelos</a> · <a href="../../preguntas/">Preguntas frecuentes</a> · <a href="../../">Catálogo</a></span>
  <span>Precios sujetos a cambio sin previo aviso. Consultá disponibilidad antes de comprar.</span>
</footer>
<script id="datos" type="application/json">{datos}</script>
<script>{script}</script>
</body>
</html>
'''.format(
        direccion=e(general.get('direccion') or 'Av. de los Incas 5150, 1A, CABA'),
        contacto=' · '.join(x for x in (
            ('<a href="https://wa.me/%s" target="_blank" rel="noopener">WhatsApp %s</a>' % (e(general['whatsapp']), e(numero_wa(general['whatsapp'])))) if general.get('whatsapp') else '',
            ('<a href="%s" target="_blank" rel="noopener">Ver en el mapa</a>' % e(general['mapa'])) if general.get('mapa') else '') if x).join(['<span>', '</span>']) if (general.get('whatsapp') or general.get('mapa')) else '',
        titulo_pag=e(titulo_pag), meta_desc=e(meta_desc), url=e(url), titulo=e(m['titulo']), og=e(og),
        nombre=e(m.get('nombre') or m['titulo']),
        ld0=ld[0], ld1=ld[1], css=CSS, cat_q=e(urllib.parse.quote(m.get('categoria') or '')), rubro=e(m.get('rubro') or 'Productos'),
        src_foto=e(src_foto), marca=e(m.get('marca') or ''), regalo=regalo,
        alt_foto=e(alt_foto), cartel=cartel, foto_rel=' style="position:relative"' if ilustrativa else '',
        precio_txt=precio_txt,
        wa=('<a class="wa" href="%s" target="_blank" rel="noopener">Consultar por WhatsApp</a>' % e(m['wa'])) if m.get('wa') else '',
        clave_q=e(m['clave']),
        sku_q=e('&s=' + m['sku']) if m.get('sku') and m['sku'] != m['clave'] and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,80}', m['sku']) else '',
        sec_venta=('<section class="bloque" aria-labelledby="t-por"><h2 id="t-por">Por qué elegirlo</h2>%s</section>' % venta) if venta else '',
        sec_puntos=('<section class="bloque" aria-labelledby="t-imp"><h2 id="t-imp">Lo más importante</h2><ul class="puntos">%s</ul></section>' % puntos) if puntos else '',
        sec_ficha=('<section class="bloque ficha" aria-labelledby="t-ficha"><h2 id="t-ficha">Ficha técnica</h2>%s</section>' % ficha) if ficha else '',
        sec_otros=html_otros(otros, m.get('rubro') or 'Productos'),
        filas=filas, datos=json.dumps(datos, ensure_ascii=False).replace('</', '<\\/'), script=SCRIPT)


# --------------------------------------------------------------------------
# Escribir
# --------------------------------------------------------------------------

def _cuerpo_pauta(t, cabecera):
    i = t.find(cabecera)
    j = t.find('catch(e){ return {}; }', i)
    return re.sub(r'\((\w+)\) =>', r'\1 =>', re.sub(r'\s+', ' ', t[i + len(cabecera):j])) if 0 <= i < j else None


def _claves_pauta(t):
    m = re.search(r"\['gclid', 'gbraid', 'wbraid', 'gad_source', 'gad_campaignid',\s*'utm_source'[^\]]*\]", t)
    return re.sub(r'\s+', ' ', m.group(0)) if m else None


def pauta_distinta_de_la_portada(portada=None):
    """La funcion que dice si la visita llego por un aviso pago (pautaDe) y la
    lista de parametros que se sacan de la direccion estan escritas dos veces:
    en SCRIPT y en la portada (index.html, MEDICION). None si siguen iguales;
    si no, que es lo que difiere. Lo miran --probar y probar-pagina-modelo.py,
    que corre en cada PR. portada: el texto de index.html (por defecto, el del
    repo)."""
    if portada is None:
        with io.open(os.path.join(RAIZ, 'index.html'), encoding='utf-8') as fh:
            portada = fh.read()
    aca, alla = _cuerpo_pauta(SCRIPT, 'const pautaDe = (busqueda) => {'), _cuerpo_pauta(portada, 'function pautaDe(busqueda){')
    if not aca or aca != alla:
        return 'pautaDe no es igual en SCRIPT y en index.html'
    if not _claves_pauta(SCRIPT) or _claves_pauta(SCRIPT) != _claves_pauta(portada):
        return 'los parametros que se sacan de la direccion no son los mismos en SCRIPT y en index.html'
    return None


def escribir_si_cambio(ruta, texto):
    try:
        with io.open(ruta, encoding='utf-8') as fh:
            if fh.read() == texto:
                return False
    except OSError:
        pass
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    tmp = os.path.join(os.path.dirname(ruta), '_' + os.path.basename(ruta) + '.tmp')
    with io.open(tmp, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(texto)
    os.replace(tmp, ruta)
    return True


def sin_precio_viejo(t):
    """Una pagina de antes del 13/10 (W3-06) de un modelo que hoy no esta: se
    le saca el precio del dia en que se armo. La descripcion para Google pasa a
    "hoy sin stock", los datos para Google pierden la oferta (sin stock no hay
    precio, D15 B), el recuadro dice "Hoy sin stock" y la tabla no dice
    precios. El script viejo de la pagina, al abrirla, ya marcaba sin stock lo
    que ADVAPP no trae. Lo que no reconoce lo deja como esta."""
    m = re.search(r'<meta property="og:title" content="([^"]*)">', t)
    titulo = html.unescape(m.group(1)) if m else ''
    if titulo:
        nueva = e(recortar('%s: hoy sin stock, consultá cuándo entra. Envíos a todo el país.' % titulo))
        t = re.sub(r'(<meta (?:name="description"|property="og:description") content=")Desde u\$[^"]*(">)',
                   lambda x: x.group(1) + nueva + x.group(2), t)

    def sin_oferta(x):
        try:
            d = json.loads(x.group(2).replace('<\\/', '</'))
        except ValueError:
            return x.group(0)
        if not isinstance(d, dict) or 'offers' not in d:
            return x.group(0)
        d.pop('offers', None)
        return x.group(1) + json.dumps(d, ensure_ascii=False).replace('</', '<\\/') + x.group(3)
    t = re.sub(r'(<script type="application/ld\+json">)(.*?)(</script>)', sin_oferta, t, flags=re.S)
    t = re.sub(r'<div class="precio" id="precio"><b>USD [\d.]+</b><i>[^<]*</i></div>',
               '<div class="precio sin" id="precio"><b>Hoy sin stock</b><i>Escribinos y te avisamos cuando entre</i></div>', t)
    t = re.sub(r'<td class="num">u\$[\d.]+</td><td>Sí</td>', '<td class="num">—</td><td>Sin stock</td>', t)
    t = re.sub(r'<td class="num">u\$[\d.]+</td>', '<td class="num">—</td>', t)

    # Y los datos del script de la pagina (auditoria 19/10/2026, G-01): la del
    # Dyson HD16, de antes del W3-06, guardaba "precio": 770, "stock": true, y
    # su script viejo pintaba "USD 770 · hasta 12 cuotas" hasta que contestaba
    # ADVAPP, y para siempre si ADVAPP no contestaba.
    def sin_precio_en_datos(x):
        try:
            d = json.loads(x.group(2).replace('<\\/', '</'))
        except ValueError:
            return x.group(0)
        vs = d.get('versiones') if isinstance(d, dict) else None
        if not isinstance(vs, list) or not any(isinstance(v, dict) and ('precio' in v or v.get('stock')) for v in vs):
            return x.group(0)
        for v in vs:
            if isinstance(v, dict):
                v.pop('precio', None)
                v['stock'] = False
        return x.group(1) + json.dumps(d, ensure_ascii=False).replace('</', '<\\/') + x.group(3)
    t = re.sub(r'(<script id="datos" type="application/json">)(.*?)(</script>)', sin_precio_en_datos, t, flags=re.S)
    return t


def sin_stock_en_pagina(ruta):
    """La pagina de un modelo que hoy no esta: para Google pasa a sin stock y
    sin el precio viejo (sin_precio_viejo, W3-06). El script de la pagina, al
    abrirla, ya lo dice solo con lo de ADVAPP."""
    try:
        with io.open(ruta, encoding='utf-8') as fh:
            t = fh.read()
    except OSError:
        return False
    nuevo = t.replace('"availability": "https://schema.org/InStock"', '"availability": "https://schema.org/OutOfStock"')
    nuevo = con_aviso_congelado(con_lang_ar(sin_precio_viejo(nuevo)))
    return escribir_si_cambio(ruta, nuevo) if nuevo != t else False


def con_lang_ar(t):
    """lang="es-AR" (05/11/2026, auditoria TG-11) en una pagina que no se
    rearma: la de un modelo que hoy no esta y la de un desvio. Lo demas queda
    como esta (G-09: la sin stock sigue diciendo "Hoy sin stock")."""
    return re.sub(r'<html lang="es">', '<html lang="es-AR">', t or '', count=1)


# --------------------------------------------------------------------------
# La pagina vieja de un modelo que sigue a la venta con otra direccion
# (19/10/2026, ver LO QUE NO CAMBIA NUNCA SOLO)
# --------------------------------------------------------------------------

RE_DESVIO = re.compile(r'<meta name="advance-desvio" content="([a-z0-9-]+)">')


def leer_pagina(ruta):
    try:
        with io.open(ruta, encoding='utf-8') as fh:
            return fh.read()
    except OSError:
        return None


def desvio_de(texto):
    """A que direccion lleva una pagina que ya es un desvio, o None."""
    m = RE_DESVIO.search(texto or '')
    return m.group(1) if m else None


def ids_de_la_pagina(texto):
    """Los ID y SKU de las versiones que guarda una pagina (sus datos para el
    script), en mayusculas. Una pagina sin esos datos no dice ninguno."""
    m = re.search(r'<script id="datos" type="application/json">(.*?)</script>', texto or '', re.S)
    if not m:
        return set()
    try:
        d = json.loads(m.group(1).replace('<\\/', '</'))
    except ValueError:
        return set()
    ids = set()
    for v in (d.get('versiones') or []) if isinstance(d, dict) else []:
        for k in ('clave', 'sku'):
            x = str((v or {}).get(k) or '').strip().upper()
            if x:
                ids.add(x)
    return ids


def destino_de_la_vieja(texto, modelos, slugs):
    """La direccion de HOY del mismo producto que muestra una pagina vieja, o
    None si no hay una sola que lo sea.

    1. Alguna version de la vieja (su ID o su SKU) esta hoy en un modelo: la
       misma fila, en otra familia (el Joystick PS5: ACC-SON-001).
    2. Si ninguna esta, una version cuyo ID o SKU empieza con el SKU madre de
       un modelo de hoy y un guion: la misma familia de ADVAPP con otra fila
       (el iPhone 17 Pro: CEL-APL-17P-512-BLU-SIM y la familia M:CEL-APL-17P).
       Con el guion, CEL-APL-17P no toma al 17 Pro Max (CEL-APL-17PM-...).
    Si da mas de un modelo, no se adivina: queda como estaba (sin stock)."""
    ids = ids_de_la_pagina(texto)
    if not ids:
        return None
    por_id = {}
    madres = {}
    for m in modelos:
        s = slugs.get(m.get('familia'))
        if not s:
            continue
        for v in m.get('versiones') or []:
            for k in ('clave', 'sku'):
                x = str(v.get(k) or '').strip().upper()
                if x:
                    por_id.setdefault(x, set()).add(s)
        f = str(m.get('familia') or '')
        if f.startswith('M:') and len(f) > 2:
            madres.setdefault(f[2:].upper(), set()).add(s)
    hay = set()
    for i in ids:
        hay |= por_id.get(i, set())
    if not hay:
        for madre, ss in madres.items():
            if any(i.startswith(madre + '-') for i in ids):
                hay |= ss
    return next(iter(hay)) if len(hay) == 1 else None


def pagina_desvio(titulo, destino, publica):
    """La pagina vieja hecha desvio: lleva a la nueva con el ?... y el #... que
    traiga, y le dice a Google que la que vale es la nueva."""
    nueva = '%sproducto/%s/' % (publica, destino)
    rel = '../%s/' % destino
    return '''<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- La direccion vieja de un modelo que hoy tiene otra (19/10/2026). La arma
     herramientas/paginas-producto.py: no editar a mano. -->
<title>{titulo} | Advance Tecno</title>
<meta name="advance-desvio" content="{destino}">
<link rel="canonical" href="{nueva}">
<meta http-equiv="refresh" content="0; url={rel}">
<script>location.replace({rel_js} + location.search + location.hash);</script>
<link rel="icon" type="image/png" sizes="32x32" href="../../assets/icono-32.png">
<style>body{{margin:0;min-height:100vh;display:grid;place-items:center;background:#F4EFFD;color:#170F28;font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}}a{{color:#7C3AED;font-weight:600}}</style>
</head>
<body>
<p>Este producto ahora está en <a href="{rel}">{titulo}</a>.</p>
</body>
</html>
'''.format(titulo=e(titulo), destino=e(destino), nueva=e(nueva), rel=e(rel), rel_js=json.dumps(rel))


def titulo_de_la_pagina(texto, por_defecto):
    m = re.search(r'<meta property="og:title" content="([^"]*)">', texto or '')
    return html.unescape(m.group(1)).strip() if m and m.group(1).strip() else por_defecto


# --------------------------------------------------------------------------
# Los links entre paginas (05/11/2026, auditoria TG-05)
# --------------------------------------------------------------------------
# Hasta el 05/11 ningun link llevaba a las paginas de producto/: Google las
# conocia solo por el sitemap (24 indexadas y 453 sin indexar en Search
# Console). Desde ahi cada pagina nombra otros modelos del mismo rubro o de la
# misma marca, y producto/index.html ("Todos los modelos", linkeada desde el
# pie de la portada y de cada pagina) las lista todas por rubro. Todo en el
# HTML, sin JavaScript: Google lo lee en la primera pasada.

OTROS_MAX = 6


def sin_tildes(t):
    t = html.unescape(str(t or '')).lower()
    for a, b in (('á', 'a'), ('é', 'e'), ('í', 'i'), ('ó', 'o'), ('ú', 'u'), ('ü', 'u'), ('ñ', 'n')):
        t = t.replace(a, b)
    return t


def orden_natural(t):
    """'iPhone 9' antes que 'iPhone 17': los numeros se comparan como numeros."""
    return [int(x) if x.isdigit() else x for x in re.split(r'(\d+)', sin_tildes(t))]


def elegir_otros(modelos, slugs, maximo=OTROS_MAX):
    """direccion -> [(direccion, titulo)]: los "Otros modelos" de cada pagina.

    Primero los de la misma marca y el mismo rubro, despues los del mismo
    rubro y despues los de la misma marca, hasta `maximo`. Dentro de cada
    grupo, los vecinos por nombre (al iPhone 17 Pro le tocan el 17 Pro Max, el
    17, el 16 Pro Max...). No mira precio ni stock, que cambian todos los dias:
    si lo hiciera, cada PUBLICAR reescribiria las paginas y les cambiaria la
    fecha en el sitemap sin que cambie el modelo. Los usados no se nombran
    (cada uno es un equipo que se vende y su pagina deja de estar a la venta),
    ni un modelo con el mismo nombre que este."""
    con = [m for m in modelos if slugs.get(m.get('familia'))]
    orden = {m['familia']: (orden_natural(m['titulo']), slugs[m['familia']]) for m in con}
    candidatos = sorted((m for m in con if not m.get('usado')), key=lambda m: orden[m['familia']])
    salida = {}
    for m in con:
        s = slugs[m['familia']]
        rubro, marca = m.get('rubro') or '', sin_tildes(m.get('marca'))
        clave_m = orden[m['familia']]
        mismo_nombre = sin_tildes(m['titulo']).strip()
        grupos = (
            [x for x in candidatos if (x.get('rubro') or '') == rubro and sin_tildes(x.get('marca')) == marca],
            [x for x in candidatos if (x.get('rubro') or '') == rubro and sin_tildes(x.get('marca')) != marca],
            [x for x in candidatos if (x.get('rubro') or '') != rubro and marca and sin_tildes(x.get('marca')) == marca],
        )
        elegidos = []
        for n, g in enumerate(grupos):
            g = [x for x in g if slugs[x['familia']] != s and sin_tildes(x['titulo']).strip() != mismo_nombre]
            # Donde iria este modelo en el grupo, y de ahi para los dos lados
            i = sum(1 for x in g if orden[x['familia']] < clave_m)
            a, b, tomados = i, i - 1, []
            while len(elegidos) + len(tomados) < maximo and (a < len(g) or b >= 0):
                if a < len(g):
                    tomados.append(g[a])
                    a += 1
                if b >= 0 and len(elegidos) + len(tomados) < maximo:
                    tomados.append(g[b])
                    b -= 1
            # En la pagina, cada grupo en el orden de los nombres
            tomados.sort(key=lambda x: orden[x['familia']])
            elegidos += [(slugs[x['familia']], x['titulo']) for x in tomados]
            if len(elegidos) >= maximo:
                break
        salida[s] = elegidos
    # Que ninguna quede sin un link desde otra pagina de modelo: con los
    # vecinos de su marca, el JBL Charge 6 nombraba a otros parlantes pero
    # ninguno lo nombraba a el. Si a un modelo no lo nombra nadie, lo nombra el
    # primero de los suyos (en lugar de su ultimo, si ese ultimo tiene otro
    # link que lo traiga). Siempre en el mismo orden: el resultado no cambia.
    entrantes = {}
    for v in salida.values():
        for t, _ in v:
            entrantes[t] = entrantes.get(t, 0) + 1
    for m in candidatos:
        s = slugs[m['familia']]
        if entrantes.get(s):
            continue
        for t, _ in salida.get(s) or []:
            lista = salida.get(t)
            if lista is None or any(x == s for x, _ in lista):
                continue
            if len(lista) < maximo:
                lista.append((s, m['titulo']))
            elif entrantes.get(lista[-1][0], 0) > 1:
                entrantes[lista[-1][0]] -= 1
                lista[-1] = (s, m['titulo'])
            else:
                continue
            entrantes[s] = 1
            break
    return salida


def entrada_de_la_pagina(texto, s):
    """Nombre y rubro de una pagina que hoy no se rearma (la de un modelo que
    ADVAPP ya no trae, G-09), de sus datos para Google: para el indice."""
    titulo, rubro = '', ''
    for x in re.findall(r'<script type="application/ld\+json">(.*?)</script>', texto or '', re.S):
        try:
            d = json.loads(x.replace('<\\/', '</'))
        except ValueError:
            continue
        if isinstance(d, dict) and d.get('@type') == 'Product':
            titulo, rubro = str(d.get('name') or '').strip(), str(d.get('category') or '').strip()
    return {'slug': s, 'titulo': titulo or titulo_de_la_pagina(texto, s), 'rubro': rubro or 'Productos'}


CSS_INDICE = r'''
.intro{margin:0;color:var(--suave);max-width:640px}
.rubros{display:flex;flex-wrap:wrap;gap:6px}
.rubros a{border:1.5px solid var(--linea);background:var(--tarjeta);border-radius:999px;padding:8px 13px;font:600 13px/1 var(--sans);text-decoration:none}
.rubros a:hover{border-color:var(--acento);color:var(--acento)}
.lista{margin:0;padding:0;list-style:none;columns:3 240px;column-gap:28px}
.lista li{break-inside:avoid;padding:6px 0;border-top:1px solid var(--linea)}
.lista a{text-decoration:none;font-size:14.5px}
.lista a:hover{color:var(--acento);text-decoration:underline}
.lista .desde{color:var(--suave);font-size:13px;white-space:nowrap}
'''


def por_rubro_en_orden(entradas, general):
    """({rubro: [entradas]}, [rubros]): los rubros en el orden de la barra del
    catalogo (general['rubros'], que sale de ORDEN_CATS); los que no estan
    ahi, despues, del que tiene mas modelos al que tiene menos."""
    por_rubro = {}
    for x in entradas:
        por_rubro.setdefault(x['rubro'] or 'Productos', []).append(x)
    orden = [r for r in (general.get('rubros') or []) if isinstance(r, str)]
    rubros = sorted(por_rubro, key=lambda r: (orden.index(r) if r in orden else len(orden),
                                              -len(por_rubro[r]), orden_natural(r)))
    return por_rubro, rubros


def desde_del_dia(x):
    """Lo que dice al lado de cada modelo con --con-precio (12/11/2026)."""
    if x.get('stock') and isinstance(x.get('desde'), (int, float)) and x['desde'] > 0:
        return 'desde USD %s' % plata(x['desde'])
    return 'hoy sin stock'


def armar_indice(entradas, publica, general, sello=None):
    """producto/index.html: todos los modelos con pagina, por rubro (TG-05).
    Los rubros como por_rubro_en_orden. Adentro, por nombre. Cada rubro con su
    ancla (producto/#celulares), que es adonde lleva "Todos los modelos de ..."
    de cada pagina. Con sello (--con-precio, 12/11/2026), cada modelo con su
    "desde" del momento y la hora en la introduccion."""
    url = publica + 'producto/'
    por_rubro, rubros = por_rubro_en_orden(entradas, general)
    # En minuscula la palabra comun ("celulares, accesorios Apple"); la marca
    # y lo que se escribe asi ("MacBooks", "iPads") quedan como estan
    nombres = [' '.join([p[0].lower() + p[1:] if i == 0 and p[:1].isupper() and p[1:].islower() and p.lower() not in ('dyson',)
                         else p for i, p in enumerate(r.split(' '))]) for r in rubros[:3]]
    meta_desc = recortar('Todos los modelos del catálogo de Advance Tecno por rubro: %s y más. '
                         'Parque Chas, CABA. Envíos a todo el país.' % ', '.join(nombres))
    chips = ''.join('<a href="#%s">%s</a>' % (e(slug(r)), e(r)) for r in rubros)
    secciones = ''.join(
        '<section class="bloque" id="%s" aria-labelledby="t-%s"><h2 id="t-%s">%s</h2><ul class="lista">%s</ul></section>' % (
            e(slug(r)), e(slug(r)), e(slug(r)), e(r),
            ''.join('<li><a href="%s/">%s</a>%s</li>' % (
                        e(x['slug']), e(x['titulo']), (' <span class="desde">%s</span>' % e(desde_del_dia(x))) if sello else '')
                    for x in sorted(por_rubro[r], key=lambda y: (orden_natural(y['titulo']), y['slug']))))
        for r in rubros)
    intro = ('Cada modelo del catálogo con su página: las versiones, los colores y la ficha técnica. '
             + ('Precios en dólares al %s (hora de Argentina); al abrir cada página se ven los del momento.' % texto_sello(sello)
                if sello else 'El precio y el stock del día se ven al abrirla.'))
    migas = json.dumps({
        '@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'Catálogo', 'item': publica},
            {'@type': 'ListItem', 'position': 2, 'name': 'Todos los modelos', 'item': url}]},
        ensure_ascii=False).replace('</', '<\\/')
    return '''<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- Todos los modelos con su pagina, por rubro (05/11/2026, auditoria TG-05).
     La arma herramientas/paginas-producto.py en cada PUBLICAR: no editar a mano. -->
<title>Todos los modelos | Advance Tecno</title>
<meta name="description" content="{meta_desc}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Advance Tecno">
<meta property="og:locale" content="es_AR">
<meta property="og:title" content="Todos los modelos | Advance Tecno">
<meta property="og:description" content="{meta_desc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{og}">
<meta name="twitter:card" content="summary">
<link rel="icon" type="image/png" sizes="32x32" href="../assets/icono-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="../assets/icono-16.png">
<link rel="apple-touch-icon" href="../assets/icono-180.png">
<script type="application/ld+json">{migas}</script>
<style>{css}</style>
</head>
<body>
<header class="barra"><div class="in">
  <a class="logo" href="../" aria-label="Advance Tecno: ir al catálogo"><img src="../assets/logo-mark.png" alt=""><b>Advance <span>Tecno</span></b></a>
  <a class="cat" href="../">Ver catálogo</a>
</div></header>
<main>
  <nav class="migas" aria-label="Estás en"><a href="../">Catálogo</a> › Todos los modelos</nav>
  <div><h1>Todos los modelos</h1></div>
  <p class="intro">{intro}</p>
  <nav class="rubros" aria-label="Rubros">{chips}</nav>
  {secciones}
</main>
<footer>
  <b>Advance Tecno</b>
  <span>{direccion} · Envíos a todo el país · Atención con cita previa</span>
  {contacto}
  <span><a href="../preguntas/">Preguntas frecuentes</a> · <a href="../">Catálogo</a></span>
  <span>Precios sujetos a cambio sin previo aviso. Consultá disponibilidad antes de comprar.</span>
</footer>
</body>
</html>
'''.format(
        meta_desc=e(meta_desc), url=e(url), og=e(publica + 'assets/preview.png'), migas=migas, intro=e(intro),
        css=CSS.replace('../../assets/', '../assets/') + CSS_INDICE, chips=chips, secciones=secciones,
        direccion=e(general.get('direccion') or 'Av. de los Incas 5150, 1A, CABA'),
        contacto=' · '.join(x for x in (
            ('<a href="https://wa.me/%s" target="_blank" rel="noopener">WhatsApp %s</a>' % (e(general['whatsapp']), e(numero_wa(general['whatsapp'])))) if general.get('whatsapp') else '',
            ('<a href="%s" target="_blank" rel="noopener">Ver en el mapa</a>' % e(general['mapa'])) if general.get('mapa') else '') if x).join(['<span>', '</span>']) if (general.get('whatsapp') or general.get('mapa')) else '')


def texto_sitemap(publica, indice, fuera=(), preguntas=False):
    """fuera: las direcciones que hoy son un desvio (no se le listan a Google).
    Despues de la portada, producto/ ("Todos los modelos", TG-05) y, si se
    armo, preguntas/ (12/11/2026)."""
    hoy = datetime.date.today().isoformat()
    urls = ['  <url><loc>%s</loc><changefreq>daily</changefreq></url>' % e(publica),
            '  <url><loc>%sproducto/</loc></url>' % e(publica)]
    if preguntas:
        urls.append('  <url><loc>%spreguntas/</loc></url>' % e(publica))
    for s in sorted(set(indice['slugs'].values()) - set(fuera)):
        urls.append('  <url><loc>%sproducto/%s/</loc><lastmod>%s</lastmod></url>' % (e(publica), e(s), indice['lastmod'].get(s, hoy)))
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s\n</urlset>\n' % '\n'.join(urls)


def aplicar(datos, publica, carpeta=CARPETA, raiz=RAIZ, sello=None):
    """sello: la hora de --con-precio ('2026-11-12T13:05:00-03:00'), o None."""
    global INDICE, SITEMAP
    indice = leer_indice()
    modelos = datos.get('modelos') or []
    slugs = asignar_slugs(modelos, indice)
    otros = elegir_otros(modelos, slugs)
    hoy = datetime.date.today().isoformat()
    res = {'nuevas': 0, 'cambiadas': 0, 'iguales': 0, 'sin_stock': 0, 'desvios': 0, 'desvios_nuevos': 0}
    presentes = set()
    for m in modelos:
        s = slugs[m['familia']]
        presentes.add(s)
        ruta = os.path.join(carpeta, s, 'index.html')
        existia = os.path.exists(ruta)
        pagina = armar_pagina(m, s, publica, datos, otros.get(s))
        if sello:
            pagina = con_precio_del_dia(pagina, m, datos, sello, '%sproducto/%s/' % (publica, s))
        if escribir_si_cambio(ruta, pagina):
            res['cambiadas' if existia else 'nuevas'] += 1
            indice['lastmod'][s] = hoy
        else:
            res['iguales'] += 1
    fuera = set()
    viejas = []
    for f, s in slugs.items():
        if s in presentes:
            continue
        ruta = os.path.join(carpeta, s, 'index.html')
        texto = leer_pagina(ruta)
        # Ya es un desvio: queda como esta (si el modelo vuelve con esta
        # familia, el for de arriba la rearma entera), salvo el lang (TG-11)
        if desvio_de(texto):
            escribir_si_cambio(ruta, con_lang_ar(texto))
            fuera.add(s)
            res['desvios'] += 1
            continue
        destino = destino_de_la_vieja(texto, modelos, slugs)
        # La que se corrigio por el "+" (G-08) sabe a donde va: a la de hoy
        # de su familia, sin adivinar por las versiones
        if f.startswith(ANTES):
            destino = slugs.get(f[len(ANTES):]) or destino
        if destino and destino != s and destino in presentes:
            escribir_si_cambio(ruta, pagina_desvio(titulo_de_la_pagina(texto, s), destino, publica))
            fuera.add(s)
            res['desvios'] += 1
            res['desvios_nuevos'] += 1
            indice['lastmod'][s] = hoy
        elif sin_stock_en_pagina(ruta):
            res['sin_stock'] += 1
            indice['lastmod'][s] = hoy
        if s not in fuera and texto is not None:
            viejas.append(s)
    # "Todos los modelos" (TG-05): las de hoy y las de los modelos que hoy no
    # estan (G-09: siguen en el sitemap, con "Hoy sin stock"); los desvios no
    # El "desde" y el stock solo los usa --con-precio (12/11/2026)
    entradas = {slugs[m['familia']]: {'slug': slugs[m['familia']], 'titulo': m['titulo'], 'rubro': m.get('rubro') or 'Productos',
                                      'desde': m.get('desde'), 'stock': bool(m.get('stock'))}
                for m in modelos}
    for s in viejas:
        if s not in entradas:
            entradas[s] = entrada_de_la_pagina(leer_pagina(os.path.join(carpeta, s, 'index.html')), s)
    res['indice'] = escribir_si_cambio(os.path.join(carpeta, 'index.html'), armar_indice(list(entradas.values()), publica, datos, sello))
    res['con_otros'] = sum(1 for v in otros.values() if v)
    escribir_si_cambio(os.path.join(carpeta, 'indice.json'),
                       json.dumps({'slugs': dict(sorted(slugs.items())), 'lastmod': dict(sorted(indice['lastmod'].items()))},
                                  ensure_ascii=False, indent=1) + '\n')
    # Para los buscadores con IA (12/11/2026): preguntas/ y llms.txt
    preguntas = armar_preguntas(datos, publica)
    res['preguntas'] = escribir_si_cambio(os.path.join(raiz, 'preguntas', 'index.html'), preguntas) if preguntas else False
    res['llms'] = escribir_si_cambio(os.path.join(raiz, 'llms.txt'), armar_llms(datos, publica, list(entradas.values()), sello))
    res['sitemap'] = escribir_si_cambio(os.path.join(raiz, 'sitemap.xml'),
                                        texto_sitemap(publica, {'slugs': slugs, 'lastmod': indice['lastmod']}, fuera, bool(preguntas)))
    return res


# --------------------------------------------------------------------------
# Para los buscadores con IA (Benja, 12/11/2026; ver el comentario de arriba)
# --------------------------------------------------------------------------

HORA_AR = datetime.timezone(datetime.timedelta(hours=-3))
DIAS = ('lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo')
PRECIO_SIN_SELLO = ('<div class="precio sin" id="precio"><b>Consultá el precio</b>'
                    '<i>El precio y el stock del día, por WhatsApp</i></div>')
NOTA_SIN_SELLO = ('<p>Precios en dólares, del día: se cargan del catálogo al abrir la página. '
                  'Se pueden pagar en pesos con el dólar del día y con tarjeta en cuotas.</p>')
CONGELADO_VACIO = '<p class="congelado" id="congelado" hidden></p>'


def texto_sello(sello):
    """'2026-11-12T13:05:00-03:00' -> '12/11/2026, 13:05'."""
    m = re.match(r'(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})', sello or '')
    return '%s/%s/%s, %s:%s' % (m.group(3), m.group(2), m.group(1), m.group(4), m.group(5)) if m else ''


def texto_congelados(c):
    """El aviso de los precios del viernes, con las palabras de la portada
    (textoCongelados en index.html), o '' sin el dato."""
    try:
        dia, cambian = datetime.date.fromisoformat(c['dia']), datetime.date.fromisoformat(c['cambian'])
    except (TypeError, KeyError, ValueError):
        return ''
    return '<b>Precios del %s %s.</b> Es probable que cambien el %s.' % (
        DIAS[dia.weekday()], dia.strftime('%d/%m'), DIAS[cambian.weekday()])


# Lo que se le suma al script de la pagina con --con-precio: el precio escrito
# queda hasta que llega ADVAPP o hasta que se toca otra version o color; si
# ADVAPP no contesta, sinSello lo saca (la tabla vuelve a "Consultar" y los
# datos para Google pierden la oferta) y queda "Consultá el precio".
SELLO_JS = r'''  /* El precio del momento escrito en el HTML (12/11/2026, buscadores con IA;
     ver herramientas/paginas-producto.py). Nunca queda un precio viejo a la
     vista: si ADVAPP no contesta, se saca (W3-06). */
  let sello = !!D.sello;
  const NOTA = 'Precios en dólares, del día: se cargan del catálogo al abrir la página. Se pueden pagar en pesos con el dólar del día y con tarjeta en cuotas.';
  const sinSello = () => {
    if(!D.sello) return;
    D.sello = null; sello = false;
    const tb = $('filas'), n = $('nota-precios'), cg = $('congelado');
    if(tb) tb.innerHTML = [...D.versiones].sort((a, b) => String(a.version).localeCompare(b.version) || String(a.color).localeCompare(b.color))
      .map((x) => `<tr><td>${esc(x.version || '—')}</td><td>${esc(x.color || '—')}</td><td class="num">Consultar</td><td>—</td></tr>`).join('');
    if(n) n.textContent = NOTA;
    if(cg) cg.hidden = true;
    const ld = document.querySelector('script[type="application/ld+json"]');
    try{ const j = JSON.parse(ld.textContent); delete j.offers; ld.textContent = JSON.stringify(j).replace(/<\//g, '<\\/'); }catch(e){}
    pintar();
  };
'''
VIVO_JS = r'''    sello = false; D.sello = null;
    { const n = $('nota-precios'), cg = $('congelado');
      if(n) n.textContent = NOTA;
      if(cg && !(j.precios_congelados && j.precios_congelados.dia)) cg.hidden = true; }
'''


def _cambiar_una(t, viejo, nuevo):
    assert t.count(viejo) == 1, 'SCRIPT cambio: no encuentro una sola vez %r' % viejo[:60]
    return t.replace(viejo, nuevo, 1)


SCRIPT_SELLO = SCRIPT
for _viejo, _nuevo in (
        ("  let tc = null, version = null, color = null, vivo = false;\n",
         "  let tc = null, version = null, color = null, vivo = false;\n" + SELLO_JS),
        ("    }else{\n      caja.className = 'precio sin';\n      caja.innerHTML = '<b>Consultá el precio</b>",
         "    }else if(!sello){\n      caja.className = 'precio sin';\n      caja.innerHTML = '<b>Consultá el precio</b>"),
        ("b.onclick = () => { version = b.dataset.v;", "b.onclick = () => { sello = false; version = b.dataset.v;"),
        ("b.onclick = () => { color = b.dataset.c;", "b.onclick = () => { sello = false; color = b.dataset.c;"),
        ("    if(!filas) return;\n", "    if(!filas){ sinSello(); return; }\n"),
        ("    vivo = true;\n", "    vivo = true;\n" + VIVO_JS),
        ("  }).catch(() => {});\n  // Los pesos", "  }).catch(() => sinSello());\n  // Los pesos")):
    SCRIPT_SELLO = _cambiar_una(SCRIPT_SELLO, _viejo, _nuevo)


def con_precio_del_dia(t, m, general, sello, url):
    """La pagina de armar_pagina con el precio del momento escrito: el
    recuadro (la version con que arranca el script: con stock y la mas
    barata), la tabla, la hora, el aviso de los precios del viernes, la oferta
    en los datos para Google y el script que lo respeta. Si algo no esta donde
    se lo espera, devuelve la pagina como vino, sin precio."""
    cuando = texto_sello(sello)
    vs = [x for x in (m.get('versiones') or []) if isinstance(x, dict)]
    if not cuando or not vs:
        return t

    def precio(x):
        p = x.get('precio')
        return p if isinstance(p, (int, float)) and not isinstance(p, bool) and p > 0 else None
    con = [x for x in vs if x.get('stock') and precio(x)]
    hay = set(id(x) for x in con)
    cuotas = general.get('cuotas') or 0
    primera = vs[0]
    if id(primera) in hay:
        caja = '<div class="precio" id="precio"><b>USD %s</b><i>Precio al %s%s</i></div>' % (
            plata(precio(primera)), e(cuando), (' · hasta %d cuotas' % cuotas) if cuotas else '')
    else:
        caja = ('<div class="precio sin" id="precio"><b>Hoy sin stock</b>'
                '<i>Al %s. Escribinos y te avisamos cuando entre</i></div>' % e(cuando))
    # El orden de la tabla del script: con stock, del mas barato al mas caro
    orden = sorted(vs, key=lambda x: (id(x) not in hay, precio(x) or 0, str(x.get('version') or ''), str(x.get('color') or '')))
    filas = ''.join('<tr><td>%s</td><td>%s</td><td class="num">%s</td><td>%s</td></tr>' % (
        e(x.get('version') or '—'), e(x.get('color') or '—'),
        ('u$' + plata(precio(x))) if id(x) in hay else '—', 'Sí' if id(x) in hay else 'Sin stock') for x in orden)
    nota = ('<p id="nota-precios">Precios en dólares al %s (hora de Argentina): al abrir la página se cargan los del momento. '
            'Se pueden pagar en pesos con el dólar del día y con tarjeta en cuotas.</p>' % e(cuando))
    aviso = texto_congelados(general.get('congelados'))

    def con_oferta(x):
        try:
            d = json.loads(x.group(2).replace('<\\/', '</'))
        except ValueError:
            return x.group(0)
        if not isinstance(d, dict) or d.get('@type') != 'Product':
            return x.group(0)
        d.pop('offers', None)
        if con:
            ps = [precio(y) for y in con]
            d['offers'] = dict(oferta_sin_precio(m, url), lowPrice=min(ps), highPrice=max(ps),
                               offerCount=len(con), availability='https://schema.org/InStock')
        return x.group(1) + json.dumps(d, ensure_ascii=False).replace('</', '<\\/') + x.group(3)

    def con_hora(x):
        try:
            d = json.loads(x.group(2).replace('<\\/', '</'))
        except ValueError:
            return x.group(0)
        d['sello'] = sello
        return x.group(1) + json.dumps(d, ensure_ascii=False).replace('</', '<\\/') + x.group(3)

    if (t.count(PRECIO_SIN_SELLO) != 1 or t.count(NOTA_SIN_SELLO) != 1 or t.count(CONGELADO_VACIO) != 1
            or t.count('<script>%s</script>' % SCRIPT) != 1 or len(re.findall(r'<tbody id="filas">', t)) != 1):
        return t
    n = t.replace(PRECIO_SIN_SELLO, caja, 1).replace(NOTA_SIN_SELLO, nota, 1)
    if aviso:
        n = n.replace(CONGELADO_VACIO, '<p class="congelado" id="congelado">%s</p>' % aviso, 1)
    n = re.sub(r'(<tbody id="filas">).*?(</tbody>)', lambda x: x.group(1) + filas + x.group(2), n, count=1, flags=re.S)
    n = re.sub(r'(<script type="application/ld\+json">)(.*?)(</script>)', con_oferta, n, flags=re.S)
    n = re.sub(r'(<script id="datos" type="application/json">)(.*?)(</script>)', con_hora, n, count=1, flags=re.S)
    return n.replace('<script>%s</script>' % SCRIPT, '<script>%s</script>' % SCRIPT_SELLO, 1)


def texto_plano(h, publica=''):
    """El HTML de una respuesta de la portada en texto, para llms.txt y los
    datos para Google: los renglones de la tabla de la moto y de "¿En qué
    cordón estoy?" como "- zona: precio", los links con su direccion."""
    t = h.replace('href="#', 'href="%s#' % publica) if publica else h
    t = re.sub(r'<summary>(.*?)</summary>', r'\n\1\n', t, flags=re.S)
    t = re.sub(r'<tr>\s*<th[^>]*>(.*?)</th>\s*<td>(.*?)</td>\s*</tr>', r'\n- \1: \2', t, flags=re.S)
    t = re.sub(r'<dt>(.*?)</dt>\s*<dd>(.*?)</dd>', r'\n- \1: \2', t, flags=re.S)
    t = re.sub(r'<li>(.*?)</li>', r'\n- \1', t, flags=re.S)
    t = re.sub(r'<a [^>]*href="(https?://[^"]+)"[^>]*>(.*?)</a>', r'\2 (\1)', t, flags=re.S)
    t = re.sub(r'</?(?:p|div|ul|ol|table|tbody|details|dl)\b[^>]*>', '\n', t)
    t = html.unescape(re.sub(r'<[^>]+>', '', t))
    return '\n'.join(x for x in (re.sub(r'[ \t]+', ' ', y).strip() for y in t.split('\n')) if x)


CSS_PREGUNTAS = r'''
.pregunta ul{margin:0;padding-left:18px;color:var(--suave)}
.pregunta li{margin:3px 0}
.pregunta a{color:var(--acento);font-weight:600}
.pregunta .ay-tabla{width:auto;min-width:240px}
.pregunta .ay-tabla th{font:600 13.5px/1.4 var(--sans);letter-spacing:0;text-transform:none;color:var(--tinta)}
.pregunta .ay-zonas summary{cursor:pointer;font-weight:600;color:var(--acento)}
.pregunta .ay-zonas dl{margin:8px 0 0;display:grid;gap:6px}
.pregunta .ay-zonas dt{font-weight:600}
.pregunta .ay-zonas dd{margin:0;color:var(--suave);font-size:14px}
.otra{margin:0;color:var(--suave)}
.otra a{color:var(--acento);font-weight:600}
'''


def armar_preguntas(general, publica):
    """preguntas/index.html: las preguntas frecuentes de la portada en una
    pagina fija (12/11/2026), con sus datos para Google (FAQPage). Sin
    preguntas, None (no se arma)."""
    qs = [q for q in (general.get('preguntas') or [])
          if isinstance(q, dict) and isinstance(q.get('p'), str) and isinstance(q.get('html'), str) and q['p'] and q['html']]
    if not qs:
        return None
    url = publica + 'preguntas/'
    # Los links de la portada (#cotizar-usado) llevan a la portada
    secciones = ''.join(
        '<section class="bloque pregunta" aria-labelledby="q-%d"><h2 id="q-%d">%s</h2>%s</section>' % (
            i, i, e(q['p']), q['html'].replace('href="#', 'href="../#'))
        for i, q in enumerate(qs, 1))
    datos = [{
        '@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [
            {'@type': 'Question', 'name': q['p'], 'acceptedAnswer': {'@type': 'Answer', 'text': texto_plano(q['html'], publica)}}
            for q in qs]}, {
        '@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'Catálogo', 'item': publica},
            {'@type': 'ListItem', 'position': 2, 'name': 'Preguntas frecuentes', 'item': url}]}]
    ld = ''.join('<script type="application/ld+json">%s</script>\n' % json.dumps(x, ensure_ascii=False).replace('</', '<\\/')
                 for x in datos)
    meta_desc = recortar('Preguntas frecuentes de Advance Tecno: ' + ', '.join(q['p'].strip('¿?').lower() for q in qs) + '.')
    wa = general.get('whatsapp') or ''
    otra = ('<p class="otra">¿Te quedó otra duda? <a href="https://wa.me/%s" target="_blank" rel="noopener">Escribinos por WhatsApp</a></p>'
            % e(wa)) if wa else ''
    return '''<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- Las preguntas frecuentes de la portada en una pagina fija (12/11/2026,
     buscadores con IA). La arma herramientas/paginas-producto.py: no editar a mano. -->
<title>Preguntas frecuentes | Advance Tecno</title>
<meta name="description" content="{meta_desc}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Advance Tecno">
<meta property="og:locale" content="es_AR">
<meta property="og:title" content="Preguntas frecuentes | Advance Tecno">
<meta property="og:description" content="{meta_desc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{og}">
<meta name="twitter:card" content="summary">
<link rel="icon" type="image/png" sizes="32x32" href="../assets/icono-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="../assets/icono-16.png">
<link rel="apple-touch-icon" href="../assets/icono-180.png">
{ld}<style>{css}</style>
</head>
<body>
<header class="barra"><div class="in">
  <a class="logo" href="../" aria-label="Advance Tecno: ir al catálogo"><img src="../assets/logo-mark.png" alt=""><b>Advance <span>Tecno</span></b></a>
  <a class="cat" href="../">Ver catálogo</a>
</div></header>
<main>
  <nav class="migas" aria-label="Estás en"><a href="../">Catálogo</a> › Preguntas frecuentes</nav>
  <div><h1>Preguntas frecuentes</h1></div>
  {secciones}
  {otra}
</main>
<footer>
  <b>Advance Tecno</b>
  <span>{direccion} · Envíos a todo el país · Atención con cita previa</span>
  {contacto}
  <span><a href="../producto/">Todos los modelos</a> · <a href="../">Catálogo</a></span>
  <span>Precios sujetos a cambio sin previo aviso. Consultá disponibilidad antes de comprar.</span>
</footer>
</body>
</html>
'''.format(
        meta_desc=e(meta_desc), url=e(url), og=e(publica + 'assets/preview.png'), ld=ld,
        css=CSS.replace('../../assets/', '../assets/') + CSS_PREGUNTAS, secciones=secciones, otra=otra,
        direccion=e(general.get('direccion') or 'Av. de los Incas 5150, 1A, CABA'),
        contacto=' · '.join(x for x in (
            ('<a href="https://wa.me/%s" target="_blank" rel="noopener">WhatsApp %s</a>' % (e(wa), e(numero_wa(wa)))) if wa else '',
            ('<a href="%s" target="_blank" rel="noopener">Ver en el mapa</a>' % e(general['mapa'])) if general.get('mapa') else '') if x).join(['<span>', '</span>']) if (wa or general.get('mapa')) else '')


def armar_llms(general, publica, entradas, sello=None):
    """llms.txt (12/11/2026): lo que una IA necesita para hablar de Advance
    Tecno sin abrir la portada, en el formato de llmstxt.org. Con sello
    (--con-precio), cada modelo con su "desde" y la hora."""
    cuando = texto_sello(sello)
    wa = general.get('whatsapp') or ''
    l = ['# Advance Tecno', '']
    if general.get('descripcion'):
        l += ['> ' + general['descripcion'], '']
    l += [x for x in (
        '- Catálogo: ' + publica,
        ('- Dirección: %s. Atención con cita previa.' % general['direccion']) if general.get('direccion') else '',
        ('- WhatsApp: %s (https://wa.me/%s)' % (numero_wa(wa), wa)) if wa else '',
        ('- Instagram: ' + general['instagram']) if general.get('instagram') else '',
        ('- Mapa: ' + general['mapa']) if general.get('mapa') else '') if x]
    l.append('')
    if cuando:
        l += ['Todos los precios están en dólares. Los de este archivo son del %s (hora de Argentina); el del momento está '
              'en la página de cada modelo. Precios sujetos a cambio sin previo aviso. Consultá disponibilidad antes de comprar.' % cuando, '']
    l += ['## Páginas', '',
          '- [Catálogo](%s): todos los productos, con el precio y el stock del momento.' % publica,
          '- [Todos los modelos](%sproducto/): cada modelo con su página, por rubro.' % publica]
    qs = [q for q in (general.get('preguntas') or []) if isinstance(q, dict) and q.get('p') and q.get('html')]
    if qs:
        l.append('- [Preguntas frecuentes](%spreguntas/): %s' % (publica, ' '.join(q['p'] for q in qs)))
        l += ['', '## Preguntas frecuentes']
        for q in qs:
            l += ['', '### ' + q['p'], '', texto_plano(q['html'], publica)]
    l += ['', '## Modelos']
    por_rubro, rubros = por_rubro_en_orden(entradas, general)
    for r in rubros:
        l += ['', '### ' + r, '']
        for x in sorted(por_rubro[r], key=lambda y: (orden_natural(y['titulo']), y['slug'])):
            l.append('- [%s](%sproducto/%s/)%s' % (x['titulo'], publica, x['slug'], (': ' + desde_del_dia(x)) if sello else ''))
    return '\n'.join(l) + '\n'


def main(argv):
    if '--probar' in argv:
        return probar()
    puerto = 0
    for i, a in enumerate(argv):
        if a == '--puerto' and i + 1 < len(argv):
            puerto = int(argv[i + 1])
    print('Paginas de producto para Google (producto/<nombre>/ y sitemap.xml)')
    VP = cargar_vista_previa()
    src = VP.leer_index()
    publica = VP.direccion_publica(src)
    if not publica:
        print('NO SE ARMARON: no encontre el og:url de index.html. producto/ quedo como estaba.')
        return 2
    try:
        crudo, filas, manifiesto, validar = VP.bajar_advapp(VP.url_de_advapp(src))
    except Exception as ex:
        print('NO SE ARMARON: ADVAPP no sirvio (%s). producto/ quedo como estaba.' % ex)
        return 2
    datos, motivo = calcular_en_la_web(VP, crudo, puerto)
    if datos is None:
        print('NO SE ARMARON: %s. producto/ quedo como estaba.' % motivo)
        return 2
    if len(datos.get('modelos') or []) < 50:
        print('NO SE ARMARON: la pagina armo %d modelos, demasiado pocos para ser una carga normal.' % len(datos.get('modelos') or []))
        return 2
    # El registro de la portada (12/11/2026): la pagina de trabajo lo apaga
    # (pagina_de_trabajo), asi que se lee del index.html
    registro = re.search(r"^let ANALITICA_URL = '(https://[^'\r\n]+)';", src, re.M)
    if registro:
        datos['registro'] = registro.group(1)
    sello = None
    if '--con-precio' in argv:
        sello = datetime.datetime.now(HORA_AR).replace(second=0, microsecond=0).isoformat()
        print('  Con el precio de ahora escrito: "Precio al %s" (solo para la copia que se publica).' % texto_sello(sello))
    res = aplicar(datos, publica, sello=sello)
    print('  %d modelos: %d nuevas, %d cambiadas, %d sin cambios; %d de modelos que hoy no estan, pasadas a sin stock.%s'
          % (len(datos['modelos']), res['nuevas'], res['cambiadas'], res['iguales'], res['sin_stock'],
             ' sitemap.xml actualizado.' if res['sitemap'] else ''))
    if res['desvios']:
        print('  %d direccion(es) vieja(s) llevan a la de hoy del mismo modelo (%d nueva(s) en esta pasada); no van al sitemap.'
              % (res['desvios'], res['desvios_nuevos']))
    print('  %d paginas con "Otros modelos"; producto/index.html (Todos los modelos) %s.'
          % (res['con_otros'], 'actualizado' if res['indice'] else 'sin cambios'))
    print('  preguntas/index.html %s; llms.txt %s.' % (
        'actualizada' if res['preguntas'] else ('sin cambios' if datos.get('preguntas') else 'NO SE ARMO (la portada no dio preguntas)'),
        'actualizado' if res['llms'] else 'sin cambios'))
    return 0


def probar():
    fallas = []

    def ok(c, txt, detalle=None):
        print(('  OK  ' if c else 'FALLA ') + txt + ('' if c or detalle is None else '  [%s]' % (detalle,)))
        if not c:
            fallas.append(txt)

    ok(slug('Apple iPhone 17 Pro') == 'apple-iphone-17-pro', 'el nombre a direccion')
    ok(slug('MacBook Air M5 13.6"') == 'macbook-air-m5-13-6-pulgadas', 'las pulgadas se escriben')
    ok(slug('Cámara Sony α7 IV') == 'camara-sony-7-iv', 'sin tildes ni simbolos')
    # (20/10/2026, G-08) El "+" pegado es "plus"; el suelto o entre palabras, un guion como siempre
    ok(slug('Samsung Galaxy Tab A11+') == 'samsung-galaxy-tab-a11-plus' != slug('Samsung Galaxy Tab A11'),
       'G-08: el A11+ y el A11 tienen direcciones distintas')
    ok(slug('Xiaomi Redmi Note 15 Pro+ 5G') == 'xiaomi-redmi-note-15-pro-plus-5g' and slug('Galaxy A11&#43;') == 'galaxy-a11-plus',
       'G-08: "plus" tambien en el medio del nombre y escrito como entidad')
    ok(slug('Drone DJI Neo 2 + Fly More Combo') == 'drone-dji-neo-2-fly-more-combo'
       and slug('Galaxy Tab S10 FE (SM X520) +Pencil') == 'galaxy-tab-s10-fe-sm-x520-pencil'
       and slug('Calling Watch Kr 3 Denim+Milky') == 'calling-watch-kr-3-denim-milky',
       'G-08: el "+" que es un "y" sigue siendo un guion (esas direcciones no cambian)')
    ok(slug('Samsung Galaxy Tab A11+', con_plus=False) == 'samsung-galaxy-tab-a11', 'G-08: el slug de antes, para reconocer las viejas')
    ind = {'slugs': {'M:TAB-SAM-TABA11PLUS': 'samsung-galaxy-tab-a11', 'M:TAB-SAM-TABA11': 'samsung-galaxy-tab-a11-2',
                     'M:CEL-APL-17P': 'apple-iphone-17-pro'}, 'lastmod': {}}
    tabs = [{'familia': 'M:TAB-SAM-TABA11PLUS', 'titulo': 'Samsung Galaxy Tab A11+'},
            {'familia': 'M:TAB-SAM-TABA11', 'titulo': 'Samsung Galaxy Tab A11'},
            {'familia': 'M:CEL-APL-17P', 'titulo': 'Apple iPhone 17 Pro'}]
    s = asignar_slugs(tabs, ind)
    ok(s == {'M:TAB-SAM-TABA11PLUS': 'samsung-galaxy-tab-a11-plus', 'M:TAB-SAM-TABA11': 'samsung-galaxy-tab-a11-2',
             'antes:M:TAB-SAM-TABA11PLUS': 'samsung-galaxy-tab-a11', 'M:CEL-APL-17P': 'apple-iphone-17-pro'},
       'G-08: el A11+ pasa a "-plus", la vieja queda guardada como antes:, y el A11 y los demas no cambian')
    ok(asignar_slugs(tabs, {'slugs': dict(s), 'lastmod': {}}) == s, 'G-08: y en la pasada siguiente queda igual')
    s = asignar_slugs([{'familia': 'M:TAB-SAM-TABA11PLUS', 'titulo': 'Samsung Galaxy Tab A11+'}],
                      {'slugs': {'M:TAB-SAM-TABA11PLUS': 'tablet-a11-plus-samsung'}, 'lastmod': {}})
    ok(s == {'M:TAB-SAM-TABA11PLUS': 'tablet-a11-plus-samsung'}, 'G-08: una direccion que no salio del slug de antes no se toca')
    s = asignar_slugs([{'familia': 'M:NUEVA', 'titulo': 'Samsung Galaxy Tab A11'}],
                      {'slugs': {'M:TAB-SAM-TABA11PLUS': 'samsung-galaxy-tab-a11-plus',
                                 'antes:M:TAB-SAM-TABA11PLUS': 'samsung-galaxy-tab-a11'}, 'lastmod': {}})
    ok(s.get('M:NUEVA') == 'samsung-galaxy-tab-a11-2' and s.get('antes:M:TAB-SAM-TABA11PLUS') == 'samsung-galaxy-tab-a11',
       'G-08: la direccion vieja del A11+ no la hereda otro modelo (sigue llevando al A11+)')
    ind = {'slugs': {'M:CEL-APL-17P': 'apple-iphone-17-pro'}, 'lastmod': {}}
    s = asignar_slugs([{'familia': 'M:CEL-APL-17P', 'titulo': 'Apple iPhone 17 Pro (nuevo nombre)'},
                       {'familia': 'M:OTRO', 'titulo': 'Apple iPhone 17 Pro'}], ind)
    ok(s['M:CEL-APL-17P'] == 'apple-iphone-17-pro', 'una direccion ya asignada no cambia aunque cambie el nombre')
    ok(s['M:OTRO'] == 'apple-iphone-17-pro-2', 'y otro modelo con el mismo nombre no la pisa')
    # (13/10/2026) ADVAPP le cambia el SKU madre o el grupo a un producto: hereda su direccion
    ind = {'slugs': {'G:accesorio-gaming~sony~consultar-estandar-joystick-ps5': 'sony-joystick-ps5',
                     'M:CEL-APL-17P': 'apple-iphone-17-pro'}, 'lastmod': {}}
    s = asignar_slugs([{'familia': 'M:ACG-SON-JOYPS5', 'titulo': 'Sony Joystick PS5'},
                       {'familia': 'M:CEL-APL-17P', 'titulo': 'Apple iPhone 17 Pro'}], ind)
    ok(s.get('M:ACG-SON-JOYPS5') == 'sony-joystick-ps5' and 'G:accesorio-gaming~sony~consultar-estandar-joystick-ps5' not in s,
       'W3-05: el Joystick PS5 con su SKU madre nuevo sigue en sony-joystick-ps5 (no sale una "-2")')
    ind = {'slugs': {'M:A': 'sony-joystick-ps5'}, 'lastmod': {}}
    s = asignar_slugs([{'familia': 'M:A', 'titulo': 'Sony Joystick PS5'}, {'familia': 'M:B', 'titulo': 'Sony Joystick PS5'}], ind)
    ok(s == {'M:A': 'sony-joystick-ps5', 'M:B': 'sony-joystick-ps5-2'}, 'y si la familia vieja sigue publicada, no se la saca')
    m = {'familia': 'M:CEL-APL-17P', 'titulo': 'Apple iPhone 17 Pro', 'marca': 'Apple', 'categoria': 'Celular', 'rubro': 'Celulares',
         'clave': 'CEL-APP-068', 'sku': 'CEL-APL-17P-256-ORG-ESIM', 'desde': 1200, 'hasta': 1570, 'stock': True,
         'incluye': '+ Cargador 20W + Funda + Templado 🎁',
         'regalo': True, 'foto': 'fotos/sinfondo/AT-0072-03.webp', 'foto_og': 'fotos/AT-0072-03.jpg', 'wa': 'https://wa.me/1?text=hola',
         'versiones': [{'version': '256GB · E-Sim', 'color': 'Orange', 'precio': 1200, 'stock': True, 'clave': 'CEL-APP-068',
                        'sku': 'CEL-APL-17P-256-ORG-ESIM', 'foto': 'fotos/sinfondo/AT-0072-03.webp',
                        'wa': 'https://wa.me/1?text=consulta', 'aviso': 'https://wa.me/1?text=aviso'}],
         'descripcion': {'venta': ['Tres cámaras de 48 MP. </script><script>x()</script>'], 'importante': [{'t': 'Chip A19 Pro', 'x': 'CPU de 6 núcleos'}],
                         'ficha': [{'grupo': 'Pantalla', 'filas': [['Tamaño', '6,3"']]}]}}
    h = armar_pagina(m, 'apple-iphone-17-pro', 'https://catalogo.advancetecno.com.ar/', {'cuotas': 12, 'advapp': 'https://a/x', 'cotizacion': {'tipo': 'blue'}})
    ok('<link rel="canonical" href="https://catalogo.advancetecno.com.ar/producto/apple-iphone-17-pro/">' in h, 'la direccion propia como canonica')
    ok('noindex' not in h, 'sin noindex: es para Google')
    # W3-06 (13/10/2026): ni precio ni stock fijos en el HTML; la oferta para
    # Google la arma el script con lo de ADVAPP del momento
    ok('lowPrice' not in h.split('<script id="datos"')[0] and '"offers"' not in h.split('<script id="datos"')[0]
       and 'InStock' not in h.split('<script id="datos"')[0] and 'OutOfStock' not in h.split('<script id="datos"')[0],
       'W3-06: los datos para Google no fijan precio ni stock (los pone el script al abrir)')
    ok('"priceCurrency": "USD"' in h and 'j.offers = Object.assign({}, D.oferta' in h and 'delete j.offers' in h,
       'W3-06: el script arma la oferta en dolares con lo del momento, y sin stock no va oferta (D15 B)')
    ok(not re.search(r'u\$\s?1\.?200|USD 1\.?200|"precio":|"stock":', h),
       'W3-06: ningun precio ni stock en el HTML (ni en los datos del script)')
    ok('<h1>Apple iPhone 17 Pro</h1>' in h, 'sin nombre aparte, el titulo con la marca')
    h2 = armar_pagina(dict(m, nombre='iPhone 17 Pro'), 'apple-iphone-17-pro', 'https://catalogo.advancetecno.com.ar/', {'cuotas': 12})
    ok('<h1>iPhone 17 Pro</h1>' in h2 and '<title>Apple iPhone 17 Pro | Advance Tecno</title>' in h2,
       'el titulo grande sin la marca (va arriba); el de Google, con la marca')
    ok('<meta name="description" content="Apple iPhone 17 Pro: precio del día en dólares o en pesos, hasta 12 cuotas, de regalo Cargador 20W + Funda + Templado.' in h
       and 'Desde u$' not in h, 'W3-06: la descripcion corta dice el nombre, las cuotas y el regalo, sin precio')
    ok('fotos/AT-0072-03.jpg' in h and 'og:image' in h, 'la foto para compartir es el jpg')
    ok(h.count('</script>') == 4, 'un texto con </script> no rompe la pagina (ld+json, datos y script)')
    ok('<td>256GB · E-Sim</td><td>Orange</td><td class="num">Consultar</td><td>—</td>' in h,
       'W3-06: la tabla trae las versiones y los colores, sin precio ni stock')
    ok('<b>Consultá el precio</b>' in h and 'Hoy sin stock</b><i>Escribinos' not in h.split('<script>')[0],
       'W3-06: el recuadro dice "Consulta el precio" hasta que llega lo de ADVAPP')
    ok('href="../../#p=CEL-APP-068&amp;s=CEL-APL-17P-256-ORG-ESIM"' in h and "'&s=' + encodeURIComponent(x.sku)" in h,
       'W3-03: "Ver en el catalogo" lleva el SKU de respaldo')
    ok('porSku.get(String(x.sku).toUpperCase())' in h, 'W3-03: si ADVAPP le cambio el ID, la version se busca por su SKU')
    # Auditoria del 06/10
    ok('"itemCondition": "https://schema.org/NewCondition"' in h, 'los datos para Google dicen que es nuevo')
    h3 = armar_pagina(dict(m, categoria='Accesorio Apple'), 'x', 'https://catalogo.advancetecno.com.ar/',
                      {'cuotas': 12, 'whatsapp': '5491100000000', 'mapa': 'https://maps.app.goo.gl/x', 'direccion': 'Av. de los Incas 5150, 1A, CABA'})
    ok('?cat=Accesorio%20Apple' in h3 and '?cat=Accesorio Apple' not in h3, 'la direccion del rubro va codificada (migas y datos para Google)')
    ok('<tbody id="filas">' in h3 and 'tb.innerHTML' in h3 and 'lowPrice: Math.min(...ps)' in h3, 'al abrir se rehacen la tabla y los datos para Google')
    ok('wa.href = (sin ? conPrecio(x.aviso, x.avisoPos, precio) : conPrecio(x.wa, x.waPos, precio)) || x.wa' in h3,
       'el WhatsApp sigue a la version elegida y al stock del momento')
    ok('const precio = vivo ? x.precio : null;' in h3 and "' (USD ' + plata(precio) + ')'" in h3,
       'el mensaje lleva el precio de ADVAPP del momento, nunca uno escrito al armar la pagina (26/10)')
    ok('"waPos": null' in h3 and '%28USD' not in h3 and '(USD%20' not in h3,
       'los datos de la pagina no traen un precio adentro del mensaje')
    h4 = armar_pagina(dict(m, usado=True), 'x', 'https://catalogo.advancetecno.com.ar/', {'cuotas': 12})
    ok('UsedCondition' in h4 and 'NewCondition' not in h4, 'W3-10: un usado es UsedCondition para Google')
    # La foto ilustrativa de un usado (Benja, 14/10/2026): asi la manda paginas-producto.js
    h5 = armar_pagina(dict(m, usado=True, ilustrativa=True, foto_og=''), 'x', 'https://catalogo.advancetecno.com.ar/', {'cuotas': 12})
    ok('alt="Apple iPhone 17 Pro (foto ilustrativa)"' in h5 and '>Foto ilustrativa</span>' in h5,
       'la foto ilustrativa de un usado lo dice en la pagina: el cartel y el texto alternativo')
    ok('fotos/AT-0072-03.jpg' not in h5 and '"image"' not in h5 and 'og:image" content="https://catalogo.advancetecno.com.ar/assets/preview.png"' in h5,
       'y no va en og:image ni en los datos para Google (ahi viaja sola, sin el cartel)')
    ok('ilustrativa' not in h.lower() and '<div class="foto"><img id="foto" src="../../fotos/sinfondo/AT-0072-03.webp" alt="Apple iPhone 17 Pro"></div>' in h
       and '"image": ["https://catalogo.advancetecno.com.ar/fotos/AT-0072-03.jpg"]' in h,
       'lo nuevo, como antes: sin cartel, con su foto en og:image y en los datos para Google')
    ok('WhatsApp +54 9 11 0000-0000' in h3 and 'Ver en el mapa' in h3, 'el pie con el WhatsApp y el mapa (un numero de mentira)')
    d0 = descripcion_corta(dict(m, stock=False), 12)
    ok(d0 == descripcion_corta(m, 12) and d0.startswith('Apple iPhone 17 Pro: ') and '  ' not in d0,
       'W3-06: con o sin stock la descripcion es la misma (el stock cambia todos los dias), con el nombre y sin doble espacio')
    # Una pagina de antes del 13/10 de un modelo que hoy no esta: sin el precio viejo
    vieja = ('<meta name="description" content="Desde u$630, hasta 12 cuotas. Envíos a todo el país.">'
             '<meta property="og:title" content="DJI Neo 2">'
             '<meta property="og:description" content="Desde u$630, hasta 12 cuotas. Envíos a todo el país.">'
             '<script type="application/ld+json">{"@type": "Product", "name": "DJI Neo 2", "offers": {"lowPrice": 630, '
             '"availability": "https://schema.org/InStock"}}</script>'
             '<div class="precio" id="precio"><b>USD 630</b><i>hasta 12 cuotas</i></div>'
             '<tr><td>Base</td><td>—</td><td class="num">u$630</td><td>Sí</td></tr>')
    limpia = sin_precio_viejo(vieja)
    ok('u$630' not in limpia and 'USD 630' not in limpia and 'offers' not in limpia and 'lowPrice' not in limpia
       and 'DJI Neo 2: hoy sin stock' in limpia and '<b>Hoy sin stock</b>' in limpia and '<td>Sin stock</td>' in limpia,
       'W3-06: a la pagina vieja de un modelo que hoy no esta se le saca el precio viejo')
    ok(sin_precio_viejo(limpia) == limpia and sin_precio_viejo(h) == h, 'y no toca lo que ya esta bien (ni las paginas nuevas)')
    # (auditoria 19/10/2026, G-01) Y el precio que guardaban los datos del script viejo
    con_datos = ('<script id="datos" type="application/json">{"versiones": [{"version": "Pink", "color": "Pink", '
                 '"precio": 770, "stock": true, "clave": "DYS-X"}], "cuotas": 12}</script>')
    sd = sin_precio_viejo(con_datos)
    dd = json.loads(re.search(r'<script id="datos" type="application/json">(.*?)</script>', sd, re.S).group(1))
    ok('770' not in sd and dd['versiones'][0]['stock'] is False and dd['versiones'][0]['clave'] == 'DYS-X' and dd['cuotas'] == 12,
       'G-01: los datos del script viejo pierden el precio y quedan sin stock (el Dyson HD16 decia USD 770)')
    ok(sin_precio_viejo(sd) == sd, 'y una segunda pasada no los vuelve a tocar')
    # Los precios del viernes (Benja, 07/11/2026)
    ok(CONGELADO_HTML.strip() in h and h.index('id="precio"') < h.index('id="congelado"') < h.index('class="wa"'),
       '07/11: abajo del recuadro del precio va el renglon de los precios del viernes, escondido')
    ok('.congelado{' in h and '.congelado[hidden]{display:none}' in h and AVISO_JS in h and 'j.precios_congelados' in h,
       'con su estilo y el codigo que lo llena con precios_congelados de ADVAPP')
    ok(h.count(AVISO_JS) == 1 and h.index(ANCLA_PRECIOS) < h.index(AVISO_JS), 'una sola vez, apenas llegan los productos')
    sin_aviso = h.replace(CONGELADO_HTML, '').replace(CSS_CONGELADO, '').replace(AVISO_JS, '')
    ok('congelado' not in sin_aviso and con_aviso_congelado(sin_aviso) == h,
       'una pagina de antes del 07/11 queda igual que una rearmada (con_aviso_congelado)')
    ok(con_aviso_congelado(h) == h and con_aviso_congelado(con_aviso_congelado(sin_aviso)) == h, 'y una segunda pasada no la toca')
    desv = pagina_desvio('X', 'apple-iphone-17-pro', 'https://catalogo.advancetecno.com.ar/')
    ok(con_aviso_congelado(desv) == desv and con_aviso_congelado('<p>otra cosa</p>') == '<p>otra cosa</p>',
       'un desvio o algo que no reconoce queda como esta')
    # (auditoria 19/10/2026, T-01) Las versiones y los colores van escapados en los botones
    ok('data-v="${esc(v)}"' in SCRIPT and '${esc(v || \'Única\')}' in SCRIPT and 'data-c="${esc(y.color)}"' in SCRIPT,
       'T-01: una version con comillas (13" 1TB) no corta el atributo del boton')
    d1 = descripcion_corta(dict(m, descripcion={'venta': ['x' * 400]}), 12)
    ok(len(d1) <= 160, 'la descripcion no pasa los 160 caracteres')
    sm = texto_sitemap('https://catalogo.advancetecno.com.ar/', {'slugs': {'a': 'apple-iphone-17-pro'}, 'lastmod': {'apple-iphone-17-pro': '2026-10-05'}})
    ok('<loc>https://catalogo.advancetecno.com.ar/producto/apple-iphone-17-pro/</loc><lastmod>2026-10-05</lastmod>' in sm, 'el sitemap lista la pagina')
    # (19/10/2026) El dolar del dia no queda en la pagina
    hj = armar_pagina(m, 'x', 'https://catalogo.advancetecno.com.ar/',
                      {'cuotas': 12, 'cotizacion': {'tipo': 'blue', 'recargo': 0, 'recargoFijo': 20, 'valor': 1580}})
    ok('"valor"' not in hj and '"tipo": "blue"' in hj and '"recargoFijo": 20' in hj,
       'el dolar del dia no queda en la pagina (el script no lo usa, y cambiaba todas las paginas cada PUBLICAR)')
    # (19/10/2026) La pagina vieja de un modelo que sigue a la venta con otra direccion
    def vieja_con(*claves):
        d = {'versiones': [{'version': '', 'color': '', 'clave': c, 'sku': ''} for c in claves]}
        return ('<meta property="og:title" content="Sony Joystick PS5">'
                '<script id="datos" type="application/json">%s</script>' % json.dumps(d))
    de_hoy = [{'familia': 'M:ACG-SON-JOYPS5', 'versiones': [{'clave': 'ACC-SON-001', 'sku': 'ACG-SON-JOYPS5-000-BLK-000'}]},
              {'familia': 'M:CEL-APL-17P', 'versiones': [{'clave': 'CEL-APP-068', 'sku': 'CEL-APL-17P-256-ORG-ESIM'}]},
              {'familia': 'M:CEL-APL-17PM', 'versiones': [{'clave': 'CEL-APP-078', 'sku': 'CEL-APL-17PM-256-ORG-ESIM'}]}]
    sl = {'M:ACG-SON-JOYPS5': 'sony-joystick-ps5-2', 'M:CEL-APL-17P': 'apple-iphone-17-pro', 'M:CEL-APL-17PM': 'apple-iphone-17-pro-max'}
    ok(destino_de_la_vieja(vieja_con('ACC-SON-001'), de_hoy, sl) == 'sony-joystick-ps5-2',
       'la vieja del Joystick PS5 (la misma fila, hoy en otra familia) lleva a la de hoy')
    ok(destino_de_la_vieja(vieja_con('CEL-APL-17P-512-BLU-SIM'), de_hoy, sl) == 'apple-iphone-17-pro',
       'la vieja del iPhone 17 Pro (una fila que ya no esta, del mismo SKU madre) lleva a la de hoy')
    ok(destino_de_la_vieja(vieja_con('CEL-APL-17PM-512-BLU-ESIM'), de_hoy, sl) == 'apple-iphone-17-pro-max',
       'y la del 17 Pro Max no cae en el 17 Pro (el SKU madre se compara con su guion)')
    ok(destino_de_la_vieja(vieja_con('ACC-SON-001', 'CEL-APP-068'), de_hoy, sl) is None,
       'si sus versiones estan hoy en dos modelos, no se adivina')
    ok(destino_de_la_vieja(vieja_con('DYS-DYS-V15FLUFFYASPIRADORA-000-000-000'), de_hoy, sl) is None
       and destino_de_la_vieja('<p>sin datos</p>', de_hoy, sl) is None,
       'un modelo que de verdad no esta (o una pagina sin datos) queda sin stock, como siempre')
    dv = pagina_desvio('Sony Joystick PS5 <b>', 'sony-joystick-ps5-2', 'https://catalogo.advancetecno.com.ar/')
    ok('<link rel="canonical" href="https://catalogo.advancetecno.com.ar/producto/sony-joystick-ps5-2/">' in dv
       and '<meta http-equiv="refresh" content="0; url=../sony-joystick-ps5-2/">' in dv
       and 'location.replace("../sony-joystick-ps5-2/" + location.search + location.hash)' in dv,
       'el desvio: canonica a la nueva, refresh 0, y lleva el ?... y el #... que traiga')
    ok(desvio_de(dv) == 'sony-joystick-ps5-2' and 'noindex' not in dv and '<b>' not in dv and 'Sony Joystick PS5 &lt;b&gt;' in dv,
       'se reconoce como desvio y el nombre va escapado')
    sm2 = texto_sitemap('https://catalogo.advancetecno.com.ar/',
                        {'slugs': {'G:x': 'sony-joystick-ps5', 'M:y': 'sony-joystick-ps5-2'}, 'lastmod': {}}, {'sony-joystick-ps5'})
    ok('/producto/sony-joystick-ps5-2/' in sm2 and '/producto/sony-joystick-ps5/' not in sm2, 'el desvio no va al sitemap')
    # (05/11/2026, auditoria TG-11) lang="es-AR", como index.html y 404.html
    ok('<html lang="es-AR">' in h and '<html lang="es">' not in h and '<html lang="es-AR">' in dv,
       'TG-11: la pagina y el desvio dicen lang="es-AR"')
    ok(con_lang_ar('<!doctype html>\n<html lang="es">\n<head>') == '<!doctype html>\n<html lang="es-AR">\n<head>'
       and con_lang_ar(h) == h,
       'TG-11: a la pagina que no se rearma (sin stock o desvio) solo se le cambia el lang')
    vieja_es = vieja.replace('<meta name="description"', '<html lang="es"><meta name="description"', 1)
    ok('<html lang="es-AR">' in con_lang_ar(sin_precio_viejo(vieja_es)) and 'Hoy sin stock' in con_lang_ar(sin_precio_viejo(vieja_es)),
       'TG-11 / G-09: la de un modelo que hoy no esta pasa a es-AR y sigue diciendo "Hoy sin stock"')
    # (05/11/2026, auditoria TG-05) Los links entre paginas
    def mod(fam, titulo, marca, rubro, **k):
        return dict({'familia': fam, 'titulo': titulo, 'marca': marca, 'rubro': rubro}, **k)
    cel = [mod('M:I15', 'Apple iPhone 15', 'Apple', 'Celulares'), mod('M:I16', 'Apple iPhone 16', 'Apple', 'Celulares'),
           mod('M:I16P', 'Apple iPhone 16 Pro', 'Apple', 'Celulares'), mod('M:I17', 'Apple iPhone 17', 'Apple', 'Celulares'),
           mod('M:I17P', 'Apple iPhone 17 Pro', 'Apple', 'Celulares'), mod('M:I17PM', 'Apple iPhone 17 Pro Max', 'Apple', 'Celulares'),
           mod('M:I9', 'Apple iPhone 9', 'Apple', 'Celulares'), mod('M:IA', 'Apple iPhone Air', 'Apple', 'Celulares'),
           mod('M:S25', 'Samsung Galaxy S25', 'Samsung', 'Celulares'), mod('M:A17', 'Samsung Galaxy A17', 'Samsung', 'Celulares'),
           mod('M:MBA', 'Apple MacBook Air M5', 'Apple', 'Notebooks'), mod('M:ZB', 'Lenovo Zbook', 'Lenovo', 'Notebooks'),
           mod('U:CEL-1', 'Apple iPhone 16 usado', 'Apple', 'Celulares', usado=True),
           mod('M:SOLO', 'Kodak Instax', 'Kodak', 'Instantáneas')]
    sl = {m['familia']: slug(m['titulo']) for m in cel}
    ot = elegir_otros(cel, sl)
    o17p = [t for _, t in ot[sl['M:I17P']]]
    ok(len(o17p) == 6 and all(t.startswith('Apple iPhone') for t in o17p)
       and {'Apple iPhone 17 Pro Max', 'Apple iPhone 17', 'Apple iPhone Air'} <= set(o17p) and 'Apple iPhone 17 Pro' not in o17p,
       'TG-05: el iPhone 17 Pro nombra 6 modelos, primero los vecinos de su marca y su rubro', o17p)
    ok(o17p == sorted(o17p, key=orden_natural) and orden_natural('Apple iPhone 9') < orden_natural('Apple iPhone 17'),
       'TG-05: en el orden de los nombres, con los numeros como numeros (9 antes que 17)', o17p)
    oa = [t for _, t in ot[sl['M:A17']]]
    ok(oa[:1] == ['Samsung Galaxy S25'] and len(oa) == 6 and all(not t.startswith('Apple MacBook') for t in oa),
       'TG-05: si su marca no alcanza, sigue con su rubro (el Galaxy A17: el S25 y despues celulares de otras marcas)', oa)
    om = [t for _, t in ot[sl['M:MBA']]]
    ok(om[:1] == ['Lenovo Zbook'] and len(om) == 6 and 'Apple iPhone Air' in om,
       'TG-05: y despues con su marca en otros rubros (el MacBook Air: el Zbook y despues los Apple)', om)
    ok(not any('usado' in t for v in ot.values() for _, t in v) and ot[sl['U:CEL-1']],
       'TG-05: un usado no se nombra en otra pagina (su pagina deja de estar a la venta), pero la suya tiene sus otros')
    ok(ot[sl['M:SOLO']] == [], 'TG-05: un modelo solo en su rubro y su marca no inventa vecinos')
    # Un celular solo en su marca y lejos por nombre: con los vecinos, nadie lo nombraba (el JBL Charge 6)
    cel2 = cel + [mod('M:ALC', 'Alcatel 1', 'Alcatel', 'Celulares')]
    sl2 = dict(sl, **{'M:ALC': 'alcatel-1'})
    ot2 = elegir_otros(cel2, sl2)
    nombran = {t for v in ot2.values() for t, _ in v}
    ok('alcatel-1' in nombran and all(sl2[x['familia']] in nombran for x in cel2 if not x.get('usado') and ot2[sl2[x['familia']]]),
       'TG-05: a todo modelo con vecinos lo nombra al menos otra pagina (tambien al que queda solo en su marca)',
       [x['titulo'] for x in cel2 if not x.get('usado') and ot2[sl2[x['familia']]] and sl2[x['familia']] not in nombran])
    ok(all(len(v) <= OTROS_MAX and len({t for t, _ in v}) == len(v) and k not in {t for t, _ in v} for k, v in ot2.items())
       and elegir_otros(list(reversed(cel2)), sl2) == ot2,
       'TG-05: nunca mas de 6, sin repetidos, ninguna se nombra a si misma, y siempre da lo mismo')
    con_precio = [dict(m, desde=999 - i, stock=bool(i % 2)) for i, m in enumerate(cel)]
    ok(elegir_otros(con_precio, sl) == ot and elegir_otros(list(reversed(cel)), sl) == ot,
       'TG-05: los otros no dependen del precio, del stock ni del orden en que llegan (no reescriben las paginas cada dia)')
    h6 = armar_pagina(m, 'apple-iphone-17-pro', 'https://catalogo.advancetecno.com.ar/', {'cuotas': 12},
                      [('apple-iphone-17', 'Apple iPhone 17'), ('x', 'Nombre <con> "comillas"')])
    ok('<a href="../apple-iphone-17/">Apple iPhone 17</a>' in h6 and 'Nombre &lt;con&gt; &quot;comillas&quot;' in h6
       and '<a class="todos" href="../#celulares">Todos los modelos de Celulares</a>' in h6,
       'TG-05: "Otros modelos" con links de verdad a producto/<nombre>/ y al rubro en "Todos los modelos"')
    ok('aria-labelledby="t-otros"' not in h and '<a href="../">Todos los modelos</a>' in h and '<a href="../">Todos los modelos</a>' in h6,
       'TG-05: sin otros, no va el bloque; el pie lleva siempre a "Todos los modelos"')
    ok(h6.index('t-otros') < h6.index('</main>') and h6.count('<script') == h.count('<script'),
       'TG-05: el bloque va en el HTML, adentro del main, sin JavaScript')
    gen = {'cuotas': 12, 'whatsapp': '5491100000000', 'direccion': 'Av. de los Incas 5150, 1A, CABA'}
    ent = [{'slug': sl[x['familia']], 'titulo': x['titulo'], 'rubro': x['rubro']} for x in cel]
    hi = armar_indice(ent + [{'slug': 'viejo-<b>', 'titulo': 'Modelo <viejo>', 'rubro': 'Celulares'}],
                      'https://catalogo.advancetecno.com.ar/', gen)
    ok('<link rel="canonical" href="https://catalogo.advancetecno.com.ar/producto/">' in hi and '<html lang="es-AR">' in hi
       and 'noindex' not in hi and '<title>Todos los modelos | Advance Tecno</title>' in hi,
       'TG-05: producto/index.html, para Google, con su canonica y en es-AR')
    ok(all('<a href="%s/">' % s in hi for s in sl.values()) and '<a href="viejo-&lt;b&gt;/">Modelo &lt;viejo&gt;</a>' in hi,
       'TG-05: el indice linkea cada pagina (con el nombre escapado)')
    hr = armar_indice(ent, 'https://catalogo.advancetecno.com.ar/', dict(gen, rubros=['Instantáneas', 'Notebooks']))
    ok(hr.index('id="instantaneas"') < hr.index('id="notebooks"') < hr.index('id="celulares"'),
       'TG-05: los rubros en el orden de la barra del catalogo (los que no estan ahi, despues)')
    ok('... y más' not in hi and len(re.search(r'<meta name="description" content="([^"]*)"', hi).group(1)) <= 160
       and not re.search(r'<meta name="description" content="[^"]*…"', hi),
       'TG-05: la descripcion del indice entra entera en lo que muestra Google')
    ok(hi.index('id="celulares"') < hi.index('id="notebooks"') < hi.index('id="instantaneas"')
       and '<a href="#celulares">Celulares</a>' in hi
       and hi.index('>Apple iPhone 9<') < hi.index('>Apple iPhone 15<') < hi.index('>Apple iPhone 17<'),
       'TG-05: por rubro (el que mas tiene primero), con su ancla, y por nombre adentro')
    ok('url(../assets/lilita-latin.woff2)' in hi and '../../assets' not in hi and 'WhatsApp +54 9 11 0000-0000' in hi,
       'TG-05: el indice usa las rutas de producto/ (../assets) y el mismo pie')
    ok('<url><loc>https://catalogo.advancetecno.com.ar/producto/</loc></url>' in sm, 'TG-05: el sitemap lista "Todos los modelos"')
    ev = entrada_de_la_pagina(armar_pagina(m, 'apple-iphone-17-pro', 'https://catalogo.advancetecno.com.ar/', {'cuotas': 12}), 'apple-iphone-17-pro')
    ok(ev == {'slug': 'apple-iphone-17-pro', 'titulo': 'Apple iPhone 17 Pro', 'rubro': 'Celulares'}
       and entrada_de_la_pagina('<meta property="og:title" content="DJI Neo 2">', 'dji-neo-2')['titulo'] == 'DJI Neo 2',
       'TG-05: de una pagina que hoy no se rearma, el nombre y el rubro salen de sus datos para Google')
    # De punta a punta, en una carpeta aparte
    import shutil
    import tempfile
    global INDICE
    antes = INDICE
    tmp = tempfile.mkdtemp(prefix='pp-probar-')
    try:
        car = os.path.join(tmp, 'producto')
        os.makedirs(os.path.join(car, 'sony-joystick-ps5'))
        INDICE = os.path.join(car, 'indice.json')
        with io.open(INDICE, 'w', encoding='utf-8') as fh:
            fh.write(json.dumps({'slugs': {'G:viejo': 'sony-joystick-ps5', 'M:ACG-SON-JOYPS5': 'sony-joystick-ps5-2'}, 'lastmod': {}}))
        with io.open(os.path.join(car, 'sony-joystick-ps5', 'index.html'), 'w', encoding='utf-8') as fh:
            fh.write(vieja_con('ACC-SON-001'))
        # Y una de un modelo que ADVAPP ya no trae (G-09): queda sin stock y en el indice
        os.makedirs(os.path.join(car, 'dji-neo-2'))
        with io.open(os.path.join(car, 'dji-neo-2', 'index.html'), 'w', encoding='utf-8') as fh:
            fh.write('<html lang="es">' + vieja.replace('"name": "DJI Neo 2"', '"name": "DJI Neo 2", "category": "Drones"'))
        with io.open(INDICE, 'w', encoding='utf-8') as fh:
            fh.write(json.dumps({'slugs': {'G:viejo': 'sony-joystick-ps5', 'M:ACG-SON-JOYPS5': 'sony-joystick-ps5-2',
                                           'M:DRO-DJI-NEO2': 'dji-neo-2'}, 'lastmod': {}}))
        mj = dict(m, familia='M:ACG-SON-JOYPS5', titulo='Sony Joystick PS5',
                  versiones=[dict(m['versiones'][0], clave='ACC-SON-001', sku='ACG-SON-JOYPS5-000-BLK-000')])
        pasada = lambda: aplicar({'modelos': [mj], 'cuotas': 12}, 'https://catalogo.advancetecno.com.ar/', carpeta=car, raiz=tmp)
        leer = lambda *r: io.open(os.path.join(*r), encoding='utf-8').read()
        r1 = pasada()
        t1, sm3, ind3 = leer(car, 'sony-joystick-ps5', 'index.html'), leer(tmp, 'sitemap.xml'), json.loads(leer(INDICE))
        ok(r1['desvios_nuevos'] == 1 and desvio_de(t1) == 'sony-joystick-ps5-2'
           and '/producto/sony-joystick-ps5/' not in sm3 and '/producto/sony-joystick-ps5-2/' in sm3
           and ind3['slugs'].get('G:viejo') == 'sony-joystick-ps5',
           'de punta a punta: la vieja pasa a desvio, sale del sitemap y su direccion sigue guardada')
        ti = leer(car, 'index.html')
        ok('<a href="sony-joystick-ps5-2/">Sony Joystick PS5</a>' in ti and 'href="sony-joystick-ps5/"' not in ti
           and r1['indice'] and '<html lang="es-AR">' in t1,
           'TG-05 de punta a punta: "Todos los modelos" lleva a la de hoy y no al desvio (que pasa a es-AR)')
        tn = leer(car, 'dji-neo-2', 'index.html')
        ok('<a href="dji-neo-2/">DJI Neo 2</a>' in ti and 'id="drones"' in ti and '<html lang="es-AR">' in tn
           and '<b>Hoy sin stock</b>' in tn and 'Otros modelos' not in tn and '/producto/dji-neo-2/' in leer(tmp, 'sitemap.xml'),
           'G-09 / TG-05: la de un modelo que ADVAPP ya no trae sigue sin stock, en el sitemap y en "Todos los modelos"')
        r2 = pasada()
        ok(r2['desvios'] == 1 and r2['desvios_nuevos'] == 0 and leer(car, 'sony-joystick-ps5', 'index.html') == t1
           and r2['cambiadas'] == 0 and r2['iguales'] == 1,
           'y en la pasada siguiente queda igual (ni el desvio ni la de hoy se reescriben)')
        # (20/10/2026, G-08) El A11+ con la direccion del A11, de punta a punta
        shutil.rmtree(car)
        os.makedirs(car)
        a11p = dict(m, familia='M:TAB-SAM-TABA11PLUS', titulo='Samsung Galaxy Tab A11+',
                    versiones=[dict(m['versiones'][0], clave='TAB-SAM-TABA11PLUS-6G128-GRY-WIFI', sku='TAB-SAM-TABA11PLUS-6G128-GRY-WIFI')])
        a11 = dict(m, familia='M:TAB-SAM-TABA11', titulo='Samsung Galaxy Tab A11',
                   versiones=[dict(m['versiones'][0], clave='TAB-SAM-040', sku='TAB-SAM-TABA11-4G64-GRY-CELL')])
        with io.open(INDICE, 'w', encoding='utf-8') as fh:
            fh.write(json.dumps({'slugs': {'M:TAB-SAM-TABA11PLUS': 'samsung-galaxy-tab-a11',
                                           'M:TAB-SAM-TABA11': 'samsung-galaxy-tab-a11-2'}, 'lastmod': {}}))
        pub = 'https://catalogo.advancetecno.com.ar/'
        # Como estaban: cada una con la otra en "Otros modelos" (TG-05)
        for sl, mo, ot in (('samsung-galaxy-tab-a11', a11p, [('samsung-galaxy-tab-a11-2', a11['titulo'])]),
                           ('samsung-galaxy-tab-a11-2', a11, [('samsung-galaxy-tab-a11', a11p['titulo'])])):
            os.makedirs(os.path.join(car, sl))
            with io.open(os.path.join(car, sl, 'index.html'), 'w', encoding='utf-8') as fh:
                fh.write(armar_pagina(mo, sl, pub, {'cuotas': 12}, ot))
        # El A11 queda igual, salvo su link al A11+, que pasa a la direccion nueva
        t_a11 = leer(car, 'samsung-galaxy-tab-a11-2', 'index.html').replace(
            '<a href="../samsung-galaxy-tab-a11/">', '<a href="../samsung-galaxy-tab-a11-plus/">')
        pasada = lambda: aplicar({'modelos': [a11p, a11], 'cuotas': 12}, pub, carpeta=car, raiz=tmp)
        r1 = pasada()
        vieja = leer(car, 'samsung-galaxy-tab-a11', 'index.html')
        nueva = leer(car, 'samsung-galaxy-tab-a11-plus', 'index.html')
        sm4, ind4 = leer(tmp, 'sitemap.xml'), json.loads(leer(INDICE))
        ok(desvio_de(vieja) == 'samsung-galaxy-tab-a11-plus' and '<title>Samsung Galaxy Tab A11+ | Advance Tecno</title>' in vieja
           and '<link rel="canonical" href="https://catalogo.advancetecno.com.ar/producto/samsung-galaxy-tab-a11-plus/">' in nueva
           and '<title>Samsung Galaxy Tab A11+ | Advance Tecno</title>' in nueva and r1['desvios_nuevos'] == 1,
           'G-08 de punta a punta: la direccion vieja del A11+ lleva a la nueva "-plus", que es la pagina del A11+')
        ok('/producto/samsung-galaxy-tab-a11-plus/' in sm4 and '/producto/samsung-galaxy-tab-a11/' not in sm4
           and '/producto/samsung-galaxy-tab-a11-2/' in sm4 and leer(car, 'samsung-galaxy-tab-a11-2', 'index.html') == t_a11
           and ind4['slugs'].get('antes:M:TAB-SAM-TABA11PLUS') == 'samsung-galaxy-tab-a11',
           'G-08: el sitemap lleva la nueva y no la vieja, el A11 queda igual (su link al A11+ va a la nueva) y la vieja sigue guardada en el indice')
        r2 = pasada()
        ok(r2['desvios'] == 1 and r2['desvios_nuevos'] == 0 and r2['nuevas'] == 0 and r2['cambiadas'] == 0
           and leer(car, 'samsung-galaxy-tab-a11', 'index.html') == vieja,
           'G-08: y en la pasada siguiente no se mueve nada')
    finally:
        INDICE = antes
        shutil.rmtree(tmp, ignore_errors=True)

    # Para los buscadores con IA (12/11/2026): el precio del momento escrito, preguntas/ y llms.txt
    pub = 'https://catalogo.advancetecno.com.ar/'
    mp = {'familia': 'M:X', 'titulo': 'Apple iPhone 17 Pro', 'marca': 'Apple', 'categoria': 'Celular', 'rubro': 'Celulares',
          'clave': 'A1', 'sku': '', 'desde': 1200, 'hasta': 1570, 'stock': True, 'wa': 'https://wa.me/1?text=hola',
          'versiones': [{'version': '256GB', 'color': 'Orange', 'precio': 1200, 'stock': True, 'clave': 'A1', 'sku': '', 'wa': '', 'aviso': ''},
                        {'version': '512GB', 'color': 'Blue', 'precio': 1570, 'stock': True, 'clave': 'A2', 'sku': '', 'wa': '', 'aviso': ''},
                        {'version': '1TB', 'color': 'Blue', 'precio': 1900, 'stock': False, 'clave': 'A3', 'sku': '', 'wa': '', 'aviso': ''}]}
    sello = '2026-11-12T13:05:00-03:00'
    gen = {'cuotas': 12, 'congelados': {'dia': '2026-11-06', 'cambian': '2026-11-09'}}
    base = armar_pagina(mp, 'apple-iphone-17-pro', pub, gen)
    cp = con_precio_del_dia(base, mp, gen, sello, pub + 'producto/apple-iphone-17-pro/')
    antes_js = cp.split('<script id="datos"')[0]
    ok('<b>USD 1.200</b><i>Precio al 12/11/2026, 13:05 · hasta 12 cuotas</i>' in cp, 'IA: el recuadro con el precio de la version con que abre y la hora')
    ok(antes_js.count('u$1.200') == 1 and 'u$1.570' in antes_js and 'u$1.900' not in antes_js
       and '<td>1TB</td><td>Blue</td><td class="num">—</td><td>Sin stock</td>' in antes_js,
       'IA: la tabla con precio en lo que tiene stock; lo agotado sin precio (D15 B)')
    ok('"lowPrice": 1200, "highPrice": 1570, "offerCount": 2, "availability": "https://schema.org/InStock"' in antes_js,
       'IA: la oferta en los datos para Google, sin lo agotado')
    ok('<b>Precios del viernes 06/11.</b> Es probable que cambien el lunes.' in cp and CONGELADO_VACIO not in cp,
       'IA: el aviso de los precios del viernes, con las palabras de la portada')
    ok('"sello": "%s"' % sello in cp and SCRIPT_SELLO in cp and '<script>%s</script>' % SCRIPT not in cp,
       'IA: los datos con la hora y el script que la respeta')
    ok('Precio al' not in base and 'lowPrice' not in base.split('<script id="datos"')[0] and 'sello' not in base,
       'IA: sin --con-precio la pagina sigue sin precio (W3-06)')
    agot = dict(mp, versiones=[dict(x, stock=False) for x in mp['versiones']], stock=False)
    ca = con_precio_del_dia(armar_pagina(agot, 's', pub, {'cuotas': 12}), agot, {'cuotas': 12}, sello, pub)
    ok('<b>Hoy sin stock</b><i>Al 12/11/2026, 13:05.' in ca and '"offers"' not in ca.split('<script id="datos"')[0]
       and 'u$' not in ca.split('<script id="datos"')[0], 'IA: todo agotado, "Hoy sin stock" y sin oferta ni precios')
    rara = base.replace('Consultá el precio', 'Otro texto', 1)
    ok(con_precio_del_dia(rara, mp, gen, sello, pub) == rara, 'IA: si algo no esta donde se lo espera, la pagina queda sin precio')
    ok(texto_congelados({'dia': '2026-11-06'}) == '' and texto_congelados(None) == '', 'IA: sin el dato completo, sin aviso')
    con_reg = armar_pagina(mp, 's', pub, dict(gen, registro='https://advapp.example/api?resource=eventos-web'))
    ok('"registro": "https://advapp.example/api?resource=eventos-web"' in con_reg and '"registro"' not in base
       and "anotar(Object.assign({ t: 'pagina_producto', ref }, entrada));" in SCRIPT
       and "if(!D.registro || navigator.doNotTrack === '1' || window.doNotTrack === '1') return;" in SCRIPT,
       'IA: la pagina anota de donde llego solo con el registro de la portada prendido')
    # La pauta y el toque a WhatsApp (13/11/2026). Lo que hace la pagina se
    # prueba en Chrome con herramientas/probar-pagina-modelo.py; aca se mira lo
    # que eso no ve: que las dos copias de pautaDe (esta y la de la portada)
    # sigan iguales, y que nada se caiga del script al escribir el precio.
    distinto = pauta_distinta_de_la_portada()
    ok(distinto is None and "'gclid', 'gbraid', 'wbraid', 'gad_source'" in SCRIPT and '\\u0300-\\u036f' in SCRIPT,
       'pauta: la pagina y la portada deciden igual si la visita llego por un aviso pago, y sacan lo mismo de la direccion', distinto)
    ok(pauta_distinta_de_la_portada('function pautaDe(busqueda){ try{ return { pauta: 1 }; }catch(e){ return {}; } }') is not None,
       'pauta: y si una de las dos copias cambia sola, se nota')
    ok(all(x in SCRIPT_SELLO for x in ("t: 'pagina_producto'", "desde: 'pagina',", "'pagina-pie'", 'const entrada = pautaDe(location.search);',
                                       "document.addEventListener('click', toque, true);"))
       and con_reg.count('<a class="wa" ') == 1,
       'pauta: la visita y el toque a WhatsApp siguen en el script con el precio escrito')
    pg = {'cuotas': 12, 'whatsapp': '5491100000000', 'direccion': 'Av. X 1, CABA', 'descripcion': 'Tienda de prueba.',
          'preguntas': [{'p': '¿Hacen envíos?', 'html': '<p>En moto:</p> <table class="ay-tabla"><tbody><tr><th scope="row">CABA</th>'
                                                        '<td>$15.000</td></tr></tbody></table>'},
                        {'p': '¿Toman mi usado?', 'html': '<p>Sí.</p> <a href="#cotizar-usado">Cotizar mi usado</a>'},
                        {'p': '', 'html': '<p>sin pregunta</p>'}]}
    hp = armar_preguntas(pg, pub)
    ok(hp and hp.count('class="bloque pregunta"') == 2 and 'href="../#cotizar-usado"' in hp and '"@type": "FAQPage"' in hp
       and '- CABA: $15.000' in hp, 'IA: preguntas/ con las de la portada, el cotizador en la portada y los datos FAQPage')
    ok(armar_preguntas({'preguntas': []}, pub) is None, 'IA: sin preguntas no se arma la pagina')
    ent = [{'slug': 'apple-iphone-17-pro', 'titulo': 'Apple iPhone 17 Pro', 'rubro': 'Celulares', 'desde': 1200, 'stock': True},
           {'slug': 'vieja', 'titulo': 'Vieja', 'rubro': 'Celulares'}]
    l1, l2 = armar_llms(pg, pub, ent, sello), armar_llms(pg, pub, ent)
    ok(l1.startswith('# Advance Tecno\n\n> Tienda de prueba.')
       and '- [Apple iPhone 17 Pro](%sproducto/apple-iphone-17-pro/): desde USD 1.200' % pub in l1
       and '- [Vieja](%sproducto/vieja/): hoy sin stock' % pub in l1 and 'del 12/11/2026, 13:05' in l1
       and 'Cotizar mi usado (%s#cotizar-usado)' % pub in l1 and '+54 9 11 0000-0000' in l1,
       'IA: llms.txt con la tienda, las preguntas en texto y cada modelo con su "desde" y la hora')
    ok('USD' not in l2 and 'sin stock' not in l2 and '- [Apple iPhone 17 Pro](%sproducto/apple-iphone-17-pro/)\n' % pub in l2,
       'IA: sin --con-precio, llms.txt sin precios')
    ok('<loc>%spreguntas/</loc>' % pub in texto_sitemap(pub, {'slugs': {}, 'lastmod': {}}, (), True)
       and 'preguntas' not in texto_sitemap(pub, {'slugs': {}, 'lastmod': {}}), 'IA: preguntas/ en el sitemap solo si se armo')
    print('\n%d falla(s)' % len(fallas) if fallas else '\nTODO OK')
    return 1 if fallas else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
