# -*- coding: utf-8 -*-
"""Las paginas de producto para Google: producto/<nombre>/index.html y sitemap.xml.

    python3 herramientas/paginas-producto.py              las arma con lo de hoy
    python3 herramientas/paginas-producto.py --puerto N   con el servidor en ese puerto
    python3 herramientas/paginas-producto.py --probar     las pruebas de este archivo

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
    """5491124751466 -> +54 9 11 2475-1466 (como el pie del catalogo)."""
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
'''

# El script de la pagina: elegir version y color, y traer el precio y el stock
# del momento (13/10/2026, W3-06: el HTML ya no trae ninguno de los dos).
SCRIPT = r'''
(() => {
  const D = JSON.parse(document.getElementById('datos').textContent);
  const $ = (id) => document.getElementById(id);
  const plata = (n) => Math.round(n).toLocaleString('es-AR');
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
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
    if(wa && (x.wa || x.aviso)){ wa.href = (sin ? x.aviso : x.wa) || x.wa; wa.textContent = sin ? 'Avisame cuando entre' : 'Consultar por WhatsApp'; }
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
})();
'''


def armar_pagina(m, s, publica, general):
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
    versiones = [{k: x.get(k) or '' for k in ('version', 'color', 'clave', 'sku', 'foto', 'wa', 'aviso')}
                 for x in m['versiones']]
    # El dolar del dia en que se armo NO va (19/10/2026): el script no lo usa
    # (los pesos salen de dolarapi al abrir; sin eso no hay pesos), y como
    # cambia todos los dias cada PUBLICAR reescribia todas las paginas y les
    # ponia la fecha de hoy en el sitemap aunque nada mas hubiera cambiado.
    cotiz = {k: v for k, v in (general.get('cotizacion') or {}).items() if k != 'valor'}
    datos = {'versiones': versiones, 'advapp': general.get('advapp') or '', 'cuotas': cuotas,
             'cotizacion': cotiz, 'oferta': oferta_sin_precio(m, url)}
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
    return '''<!doctype html>
<html lang="es">
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
</main>
<footer>
  <b>Advance Tecno</b>
  <span>{direccion} · Envíos a todo el país · Atención con cita previa</span>
  {contacto}
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
        filas=filas, datos=json.dumps(datos, ensure_ascii=False).replace('</', '<\\/'), script=SCRIPT)


# --------------------------------------------------------------------------
# Escribir
# --------------------------------------------------------------------------

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
    nuevo = sin_precio_viejo(nuevo)
    return escribir_si_cambio(ruta, nuevo) if nuevo != t else False


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
<html lang="es">
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


def texto_sitemap(publica, indice, fuera=()):
    """fuera: las direcciones que hoy son un desvio (no se le listan a Google)."""
    hoy = datetime.date.today().isoformat()
    urls = ['  <url><loc>%s</loc><changefreq>daily</changefreq></url>' % e(publica)]
    for s in sorted(set(indice['slugs'].values()) - set(fuera)):
        urls.append('  <url><loc>%sproducto/%s/</loc><lastmod>%s</lastmod></url>' % (e(publica), e(s), indice['lastmod'].get(s, hoy)))
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s\n</urlset>\n' % '\n'.join(urls)


def aplicar(datos, publica, carpeta=CARPETA, raiz=RAIZ):
    global INDICE, SITEMAP
    indice = leer_indice()
    modelos = datos.get('modelos') or []
    slugs = asignar_slugs(modelos, indice)
    hoy = datetime.date.today().isoformat()
    res = {'nuevas': 0, 'cambiadas': 0, 'iguales': 0, 'sin_stock': 0, 'desvios': 0, 'desvios_nuevos': 0}
    presentes = set()
    for m in modelos:
        s = slugs[m['familia']]
        presentes.add(s)
        ruta = os.path.join(carpeta, s, 'index.html')
        existia = os.path.exists(ruta)
        if escribir_si_cambio(ruta, armar_pagina(m, s, publica, datos)):
            res['cambiadas' if existia else 'nuevas'] += 1
            indice['lastmod'][s] = hoy
        else:
            res['iguales'] += 1
    fuera = set()
    for f, s in slugs.items():
        if s in presentes:
            continue
        ruta = os.path.join(carpeta, s, 'index.html')
        texto = leer_pagina(ruta)
        # Ya es un desvio: queda como esta (si el modelo vuelve con esta
        # familia, el for de arriba la rearma entera)
        if desvio_de(texto):
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
    escribir_si_cambio(os.path.join(carpeta, 'indice.json'),
                       json.dumps({'slugs': dict(sorted(slugs.items())), 'lastmod': dict(sorted(indice['lastmod'].items()))},
                                  ensure_ascii=False, indent=1) + '\n')
    res['sitemap'] = escribir_si_cambio(os.path.join(raiz, 'sitemap.xml'),
                                        texto_sitemap(publica, {'slugs': slugs, 'lastmod': indice['lastmod']}, fuera))
    return res


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
    res = aplicar(datos, publica)
    print('  %d modelos: %d nuevas, %d cambiadas, %d sin cambios; %d de modelos que hoy no estan, pasadas a sin stock.%s'
          % (len(datos['modelos']), res['nuevas'], res['cambiadas'], res['iguales'], res['sin_stock'],
             ' sitemap.xml actualizado.' if res['sitemap'] else ''))
    if res['desvios']:
        print('  %d direccion(es) vieja(s) llevan a la de hoy del mismo modelo (%d nueva(s) en esta pasada); no van al sitemap.'
              % (res['desvios'], res['desvios_nuevos']))
    return 0


def probar():
    fallas = []

    def ok(c, txt):
        print(('  OK  ' if c else 'FALLA ') + txt)
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
                      {'cuotas': 12, 'whatsapp': '5491124751466', 'mapa': 'https://maps.app.goo.gl/x', 'direccion': 'Av. de los Incas 5150, 1A, CABA'})
    ok('?cat=Accesorio%20Apple' in h3 and '?cat=Accesorio Apple' not in h3, 'la direccion del rubro va codificada (migas y datos para Google)')
    ok('<tbody id="filas">' in h3 and 'tb.innerHTML' in h3 and 'lowPrice: Math.min(...ps)' in h3, 'al abrir se rehacen la tabla y los datos para Google')
    ok('wa.href = (sin ? x.aviso : x.wa) || x.wa' in h3, 'el WhatsApp sigue a la version elegida y al stock del momento')
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
    ok('WhatsApp +54 9 11 2475-1466' in h3 and 'Ver en el mapa' in h3, 'el pie con el WhatsApp y el mapa')
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
        for sl, mo in (('samsung-galaxy-tab-a11', a11p), ('samsung-galaxy-tab-a11-2', a11)):
            os.makedirs(os.path.join(car, sl))
            with io.open(os.path.join(car, sl, 'index.html'), 'w', encoding='utf-8') as fh:
                fh.write(armar_pagina(mo, sl, pub, {'cuotas': 12}))
        t_a11 = leer(car, 'samsung-galaxy-tab-a11-2', 'index.html')
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
           'G-08: el sitemap lleva la nueva y no la vieja, el A11 queda igual y la vieja sigue guardada en el indice')
        r2 = pasada()
        ok(r2['desvios'] == 1 and r2['desvios_nuevos'] == 0 and r2['nuevas'] == 0 and r2['cambiadas'] == 0
           and leer(car, 'samsung-galaxy-tab-a11', 'index.html') == vieja,
           'G-08: y en la pasada siguiente no se mueve nada')
    finally:
        INDICE = antes
        shutil.rmtree(tmp, ignore_errors=True)
    print('\n%d falla(s)' % len(fallas) if fallas else '\nTODO OK')
    return 1 if fallas else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
