# -*- coding: utf-8 -*-
"""Prueba, en Chrome sin ventana, lo que anota la pagina de un modelo.

    python3 herramientas/probar-pagina-modelo.py

Las pruebas de paginas-producto.py (--probar) miran el texto de las paginas.
Esto abre una de verdad y mira lo que hace su script con la medicion: que
anote la visita con la pauta con la que se llego (Benja, 13/11/2026: «dale
con la medicion», antes de prender avisos en Google), que la saque de la
direccion y que anote cada toque a WhatsApp. Cada vez que se toque el final
de SCRIPT en paginas-producto.py hay que correr esto. El workflow de Publicar
lo corre en cada PR.

Nada sale a la red: la pagina se arma con un modelo de mentira, ADVAPP es un
archivo local y lo que la pagina manda al registro se intercepta. Hace falta
Chrome o Edge, como las pruebas de pruebas/.

Sale con 0 si todo anda, 1 si algo falla y 2 si no se pudo correr.
"""
import functools
import html
import http.server
import importlib.util
import io
import json
import os
import re
import shutil
import sys
import tempfile
import threading
import urllib.parse

AQUI = os.path.dirname(os.path.abspath(__file__))
SLUG = 'apple-iphone-17-pro'
PUBLICA = 'https://catalogo.advancetecno.com.ar/'
REGISTRO = 'https://registro.invalid/api?resource=eventos-web'

MODELO = {'familia': 'M:X', 'titulo': 'Apple iPhone 17 Pro', 'marca': 'Apple', 'categoria': 'Celular', 'rubro': 'Celulares',
          'clave': 'A1', 'sku': '', 'desde': 1200, 'hasta': 1900, 'stock': True, 'wa': 'https://wa.me/1?text=hola',
          'versiones': [{'version': '256GB', 'color': 'Orange', 'precio': 1200, 'stock': True, 'clave': 'A1', 'sku': '',
                         'wa': 'https://wa.me/1?text=a1', 'aviso': 'https://wa.me/1?text=aviso1'},
                        {'version': '512GB', 'color': 'Blue', 'precio': 1570, 'stock': True, 'clave': 'A2', 'sku': '',
                         'wa': 'https://wa.me/1?text=a2', 'aviso': 'https://wa.me/1?text=aviso2'},
                        {'version': '1TB', 'color': 'Blue', 'precio': 1900, 'stock': False, 'clave': 'A3', 'sku': '',
                         'wa': 'https://wa.me/1?text=a3', 'aviso': 'https://wa.me/1?text=aviso3'}]}
# Lo que contesta ADVAPP: la de 1TB, agotada (con precio, que la pagina no muestra)
ADVAPP = {'productos': [{'ID': 'A1', 'Precio USD': '1200', 'Stock': 'Si'}, {'ID': 'A2', 'Precio USD': '1570', 'Stock': 'Si'},
                        {'ID': 'A3', 'Precio USD': '1900', 'Stock': 'No'}]}

# Va ANTES del script de la pagina: lo que se manda al registro queda en __m y
# no sale. Con ?beacon=no sendBeacon contesta que no; con ?beacon=falta no
# existe; con ?dnt=1 el navegador pide no ser seguido; con ?sinstorage=1 no hay
# sessionStorage (incognito estricto).
ANTES = '''<script>
window.__m = []; window.__cuerpo = '';
(() => {
  const pide = new URLSearchParams(location.search);
  const BlobReal = window.Blob;
  window.Blob = function(partes, o){ window.__cuerpo = String(partes && partes[0]); return new BlobReal(partes, o); };
  Object.defineProperty(navigator, 'sendBeacon', { configurable: true,
    value: pide.get('beacon') === 'falta' ? undefined : (url) => {
      if(pide.get('beacon') === 'no') return false;
      window.__m.push({ via: 'beacon', url: String(url), cuerpo: JSON.parse(window.__cuerpo) });
      return true;
    } });
  const fetchReal = window.fetch.bind(window);
  window.fetch = (url, o) => {
    if(String(url).indexOf('registro.invalid') < 0) return fetchReal(url, o);
    window.__m.push({ via: 'fetch', url: String(url), cuerpo: JSON.parse(o.body), keepalive: o.keepalive === true,
                      tipo: (o.headers || {})['Content-Type'] });
    return Promise.resolve(new Response(''));
  };
  if(pide.get('dnt') === '1') Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '1' });
  if(pide.get('sinstorage') === '1')
    Object.defineProperty(window, 'sessionStorage', { configurable: true, get(){ throw new Error('bloqueado'); } });
})();
</script>
'''
# Va DESPUES: cuando ADVAPP ya contesto, toca el boton, elige la version
# agotada y lo toca de nuevo, toca el numero del pie, el boton con el boton del
# medio y con el derecho, y algo que no es WhatsApp. Deja todo en el RESULTADO.
DESPUES = '''<script>
setTimeout(() => {
  const frenar = (e) => e.preventDefault();      // que no abra WhatsApp
  document.addEventListener('click', frenar);
  document.addEventListener('auxclick', frenar);
  const out = { errores: [] };
  try{
    const boton = () => document.querySelector('a.wa');
    boton().click();
    [...document.querySelectorAll('[data-v]')].find((b) => b.dataset.v === '1TB').click();
    out.textoAgotada = boton().textContent;
    boton().click();
    document.querySelector('footer a[href*="wa.me/"]').click();
    boton().dispatchEvent(new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }));
    boton().dispatchEvent(new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 2 }));
    document.getElementById('precio').click();
  }catch(e){ out.errores.push(String((e && e.stack) || e)); }
  out.mandados = window.__m;
  out.direccion = location.search + location.hash;
  out.visitaGuardada = (() => { try{ return sessionStorage.getItem('advtecno.visita'); }catch(e){ return 'bloqueado'; } })();
  const pre = document.createElement('pre');
  pre.id = 'RESULTADO';
  pre.textContent = JSON.stringify(out);
  document.body.appendChild(pre);
}, 1500);
</script>
'''


def cargar_generador():
    """paginas-producto.py tiene un guion en el nombre: se carga por la ruta."""
    spec = importlib.util.spec_from_file_location('paginas_producto', os.path.join(AQUI, 'paginas-producto.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def con_arnes(pagina):
    assert pagina.count('<script id="datos"') == 1 and pagina.count('</body>') == 1, 'la pagina no tiene la forma esperada'
    return pagina.replace('<script id="datos"', ANTES + '<script id="datos"', 1).replace('</body>', DESPUES + '</body>', 1)


class Callado(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a, **k):
        pass


def main():
    PP = cargar_generador()
    VP = PP.cargar_vista_previa()
    fallas = []

    def ok(c, txt, detalle=None):
        print(('  OK  ' if c else 'FALLA ') + txt + ('' if c or detalle is None else '   [%s]' % json.dumps(detalle, ensure_ascii=False)[:700]))
        if not c:
            fallas.append(txt)

    raiz = tempfile.mkdtemp(prefix='pagina-modelo-')
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Callado, directory=raiz))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base_url = 'http://127.0.0.1:%d' % srv.server_address[1]
    try:
        general = {'cuotas': 12, 'whatsapp': '5491100000000', 'mapa': 'https://maps.app.goo.gl/x',
                   'advapp': base_url + '/advapp.json', 'registro': REGISTRO}
        sin_precio = PP.armar_pagina(MODELO, SLUG, PUBLICA, general)
        con_precio = PP.con_precio_del_dia(sin_precio, MODELO, general, '2026-11-12T13:05:00-03:00', PUBLICA)
        if con_precio == sin_precio or PP.SCRIPT_SELLO not in con_precio:
            print('NO SE PUDO CORRER: no se armo la pagina con el precio escrito.')
            return 2
        for variante, pagina in (('sin-precio', sin_precio), ('con-precio', con_precio)):
            carpeta = os.path.join(raiz, variante, 'producto', SLUG)
            os.makedirs(carpeta)
            with io.open(os.path.join(carpeta, 'index.html'), 'w', encoding='utf-8') as fh:
                fh.write(con_arnes(pagina))
        with io.open(os.path.join(raiz, 'advapp.json'), 'w', encoding='utf-8') as fh:
            json.dump(ADVAPP, fh)

        def visita(variante, consulta):
            dom, motivo = VP.abrir_en_chrome('%s/%s/producto/%s/%s' % (base_url, variante, SLUG, consulta))
            m = re.search(r'<pre id="RESULTADO">(.*?)</pre>', dom, re.S) if dom else None
            if not m:
                return None, motivo or 'la pagina no dejo su RESULTADO'
            return json.loads(html.unescape(m.group(1))), None

        primera, motivo = visita('sin-precio', '')
        if primera is None:
            print('NO SE PUDO CORRER: %s.' % motivo)
            return 2

        def eventos(r):
            return [m['cuerpo']['eventos'][0] for m in r['mandados']]

        for variante in ('sin-precio', 'con-precio'):
            print('--- La pagina %s, llegando por un aviso de Google' % ('sin precio escrito' if variante == 'sin-precio' else 'con el precio escrito'))
            r, motivo = visita(variante, '?gclid=CLIC-SECRETO-123&gad_source=1&gad_campaignid=998877')
            ok(r is not None and not r['errores'], 'la pagina abre y se la puede tocar', motivo or (r and r['errores']))
            if not r:
                continue
            ev = eventos(r)
            ok(len(ev) == 5 and all(len(m['cuerpo']['eventos']) == 1 and m['via'] == 'beacon' for m in r['mandados']),
               'cinco envios: la visita y cuatro toques a WhatsApp', ev)
            ok(all(m['url'] == REGISTRO and m['cuerpo']['v'] == 1 and m['cuerpo']['sitio'] == 'tecno-web' for m in r['mandados']),
               'todos al registro de la portada, con el formato de siempre')
            ok(len({m['cuerpo']['visita'] for m in r['mandados']}) == 1 and r['mandados'][0]['cuerpo']['visita'] == r['visitaGuardada'],
               'todos con la misma visita, la de sessionStorage')
            ok(ev[0].get('t') == 'pagina_producto' and ev[0].get('pagina') == SLUG and ev[0].get('ref') == ''
               and ev[0].get('pauta') == 'google' and ev[0].get('campania') == '998877',
               'la visita: pagina_producto con la pauta (google) y la campania', ev[0])
            ok('CLIC-SECRETO' not in json.dumps(r['mandados']), 'el codigo del clic no viaja en ningun evento')
            ok(r['direccion'] == '', 'leida, la pauta sale de la direccion', r['direccion'])
            ok(ev[1] == dict(ev[1], t='whatsapp', desde='pagina', id='A1', color='Orange', version='256GB', precio=1200, pagina=SLUG)
               and 'sin_stock' not in ev[1] and 'pauta' not in ev[1],
               'el boton: whatsapp desde "pagina", con la version elegida y el precio del momento', ev[1])
            ok(r.get('textoAgotada') == 'Avisame cuando entre' and ev[2].get('desde') == 'pagina' and ev[2].get('id') == 'A3'
               and ev[2].get('sin_stock') is True and 'precio' not in ev[2],
               'la agotada: "Avisame cuando entre" va con sin_stock y sin precio', ev[2])
            ok(ev[3].get('t') == 'whatsapp' and ev[3].get('desde') == 'pagina-pie' and 'id' not in ev[3] and ev[3].get('pagina') == SLUG,
               'el numero del pie: desde "pagina-pie", sin producto', ev[3])
            ok(ev[4].get('t') == 'whatsapp' and ev[4].get('desde') == 'pagina' and ev[4].get('id') == 'A3',
               'el boton del medio tambien se anota; el derecho y lo que no es WhatsApp, no', ev[4:])
            ok(all(isinstance(x.get('ms'), int) for x in ev), 'cada evento con su momento')

        print('--- Otras formas de llegar')
        r, _ = visita('sin-precio', '?utm_source=Meta&utm_medium=paid_social&utm_campaign=' + urllib.parse.quote('Consolas Nov 🔥'))
        e0 = eventos(r)[0]
        ok(e0.get('pauta') == 'meta' and e0.get('campania') == 'consolas nov' and r['direccion'] == '',
           'una pauta marcada a mano: de quien es y la campania, sin tildes ni simbolos', [e0, r['direccion']])
        r, _ = visita('sin-precio', '?utm_source=instagram&utm_medium=social_paid')
        ok(eventos(r)[0].get('pauta') == 'instagram', 'el medio pago se reconoce aunque "paid" no vaya adelante', eventos(r)[0])
        r, _ = visita('sin-precio', '?gclid=x&gad_campaignid=77&utm_campaign=' + urllib.parse.quote('🔥🔥'))
        ok(eventos(r)[0].get('campania') == '77', 'un nombre de campania que queda vacio no tapa el numero de Google', eventos(r)[0])
        r, _ = visita('sin-precio', '?utm_source=instagram&utm_medium=historia&utm_campaign=ps5')
        e0 = eventos(r)[0]
        ok('pauta' not in e0 and 'campania' not in e0 and len(r['mandados']) == 5 and 'utm_medium=historia' in r['direccion'],
           'un link marcado que no es pago: sin pauta, y la direccion queda como vino', [e0, r['direccion']])
        e0 = eventos(primera)[0]
        ok(e0.get('t') == 'pagina_producto' and 'pauta' not in e0 and len(primera['mandados']) == 5 and primera['direccion'] == '',
           'sin nada en la direccion: como siempre, sin pauta', e0)
        r, _ = visita('sin-precio', '?color=azul&gclid=x&utm_term=ps5#ficha')
        ok(r['direccion'] == '?color=azul#ficha', 'de la direccion sale solo lo del aviso: lo demas queda', r['direccion'])

        print('--- Cuando el navegador no ayuda')
        r, _ = visita('sin-precio', '?gclid=x&dnt=1')
        ok(not r['errores'] and r['mandados'] == [] and r['direccion'] == '?dnt=1',
           'con Do Not Track no se manda nada, ni la visita ni los toques', r['mandados'])
        r, _ = visita('sin-precio', '?gclid=x&sinstorage=1')
        ok(not r['errores'] and len(r['mandados']) == 5 and len({m['cuerpo']['visita'] for m in r['mandados']}) == 1,
           'sin sessionStorage igual anota, y todo con la misma visita', [m['cuerpo']['visita'] for m in r['mandados']])
        for modo, que in (('no', 'si sendBeacon no lo toma'), ('falta', 'si sendBeacon no existe')):
            r, _ = visita('sin-precio', '?gclid=x&beacon=' + modo)
            ok(not r['errores'] and len(r['mandados']) == 5
               and all(m['via'] == 'fetch' and m['keepalive'] and m['tipo'] == 'text/plain;charset=UTF-8' and m['url'] == REGISTRO for m in r['mandados'])
               and eventos(r)[0].get('pauta') == 'google' and eventos(r)[1].get('desde') == 'pagina',
               '%s, se manda con fetch (keepalive, text/plain)' % que, r['mandados'][:2])
    finally:
        srv.shutdown()
        shutil.rmtree(raiz, ignore_errors=True)
    print()
    print('%d falla(s)' % len(fallas) if fallas else 'TODO OK')
    return 1 if fallas else 0


if __name__ == '__main__':
    sys.exit(main())
