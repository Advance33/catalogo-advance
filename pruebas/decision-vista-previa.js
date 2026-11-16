// Decision 4.2 (Pedro eligio la B el 29/09; muestra muestras/auditoria/ficha.html,
// "La vista previa en WhatsApp"): el link de un producto llega a WhatsApp con la
// foto propia de ESA fila, el modelo de titulo y debajo la version y el color,
// sin precio. Hasta ese dia todos los links llegaban con la misma tarjeta
// ("Stock y precios en tiempo real").
//
// Desde el 16/11/2026 (Benja: "hermoso, si" a la muestra) la IMAGEN de la
// tarjeta lleva ademas el precio y la hora: el og:image de cada pagina es la
// tarjeta que dibuja ADVAPP en el momento (resource=tecno-tarjeta&id=<ID>).
// La pagina sigue sin decir un precio, y la foto propia queda en el <img> del
// cuerpo, que es de donde la lee ADVAPP.
//
// Cada fila tiene su pagina chica p/<ID>.html, que arma herramientas/vista-previa.py
// en cada PUBLICAR con los textos y la foto que calcula la web misma
// (herramientas/vista-previa.js). Esta tanda mira:
//   1. el caso de la muestra (CEL-APP-068: "Apple iPhone 17 Pro" / "256GB · E-Sim ·
//      Orange") y como se parte una version;
//   2. en todas las filas de hoy: sin precio, sin ID interno, con titulo, y la linea
//      dice la memoria, la Sim y el color que el titulo no dice;
//   3. la foto: abre la ficha de verdad (todas las filas sin foto propia y una de
//      cada cinco de las demas) y tiene que ser la misma; y que este en
//      fotos/indice.json;
//   4. cada pagina publicada: og:title, og:image absoluta (la tarjeta con precio
//      de ADVAPP, de 1200 x 630 y sin og:url; con TARJETA_CON_PRECIO apagado
//      en vista-previa.py, la foto propia o la tarjeta general, con og:url),
//      twitter:card acorde a la
//      imagen, noindex, redireccion y link iguales hacia una ficha que abre,
//      sin precio; cada ID de p/indice.json con su archivo; y que ADVAPP haga
//      los pesos de la tarjeta con la misma cotizacion que la web;
//   5. las paginas contra lo que calculo la herramienta al armarlas
//      (p/_generado.json, local, no se publica): cualquier diferencia es un error
//      del generador (FALLA). Y contra lo que la web muestra hoy: las filas
//      nuevas, cambiadas o dadas de baja son AVISO, sin tope (se arreglan con el
//      proximo PUBLICAR). (29/09, revision: antes se aguantaba hasta un cuarto
//      distinto siempre, y una rotacion grande de IDs daba FALLA con todo sano.
//      No se compara por generado_en: ADVAPP lo cambia cada 60 a 90 s aunque los
//      datos sean los mismos);
//   6. que PUBLICAR la corra despues de las fotos y antes de las pruebas, que la
//      revision diaria avise las filas nuevas sin pagina, y que 404.html mande un
//      p/<ID>.html borrado a #p=<ID> sin tocar otras direcciones.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);
const aviso = t => R.push('AVISO ' + t);

const esperar = setInterval(() => {
  if(!MODELOS.length || !FUENTE || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperar);
  for(let i=1;i<5000;i++) clearInterval(i);
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; })
    .finally(() => {
      try{ cerrarFicha(); }catch(e){}
      try{ quitarFicha(); }catch(e){}
      try{ pararPaseos(); pararOfertas(); }catch(e){}
      for(let i=1;i<5000;i++) clearInterval(i);
      const pre=document.createElement('pre'); pre.id='RESULTADO';
      pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
      document.body.appendChild(pre);
    });
}, 150);

/* Un archivo tal como lo sirve el servidor local. null si no esta. */
async function leerVP(ruta){
  try{
    const r = await fetch(ruta + (ruta.includes('?') ? '&' : '?') + '_=' + Date.now(), { cache: 'no-store' });
    return r.ok ? await r.text() : null;
  }catch(e){ return null; }
}

function cargarScriptVP(src){
  return new Promise((si, no) => {
    const s = document.createElement('script');
    s.src = src + '?_=' + Date.now();
    s.onload = si; s.onerror = () => no(new Error('no se pudo cargar ' + src));
    document.head.appendChild(s);
  });
}

// ¿El texto dice todas las palabras del color? (independiente de vista-previa.js)
const vpPalabras = t => String(t || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const vpDiceElColor = (texto, color) => { const hay = new Set(vpPalabras(texto)); const c = vpPalabras(color); return c.length > 0 && c.every(w => hay.has(w)); };
const ejemplos = (lista, n = 3) => lista.length ? lista.slice(0, n).join(' | ') + (lista.length > n ? ' ...' : '') : undefined;
// Un precio es "USD" o "$" con un numero (05/10/2026): el "USD" suelto de los
// Tamron ("SP 24-70mm F/2.8 Di VC USD G2") es el motor del lente, no un precio.
const conPrecio = t => /\bUSD\s?\d|\$\s?\d|\d\s?(?:dólares|dolares)\b/i.test(t || '');

async function correrPruebas(){
  await cargarScriptVP('herramientas/vista-previa.js');
  ok(typeof vistasPrevias === 'function', 'se carga herramientas/vista-previa.js (el calculo de la web)');
  const PUBLICA = (document.querySelector('meta[property="og:url"]') || {}).content || '';
  ok(/^https:\/\/.+\/$/.test(PUBLICA), 'index.html dice su direccion publica (og:url)', PUBLICA);
  const hoyTodo = vistasPrevias();
  const hoy = new Map(hoyTodo.vistas.map(v => [v.id, v]));
  const conId = PRODUCTOS.filter(p => p.id).length;
  ok(hoyTodo.vistas.length === conId && !hoyTodo.problemas.length,
     'una vista previa por cada fila con ID, sin filas perdidas',
     hoyTodo.vistas.length + ' de ' + conId + (hoyTodo.problemas.length ? ' · ' + ejemplos(hoyTodo.problemas) : ''));

  /* ---- 1. El caso de la muestra y como se parte una version ---- */
  const c = PRODUCTOS.find(p => p.id === 'CEL-APP-068');
  if(c && /^iPhone 17 Pro 256GB E-Sim/i.test(c.desc) && norm(c.color) === 'orange'){
    const v = hoy.get('CEL-APP-068');
    ok(v && v.titulo === 'Apple iPhone 17 Pro' && v.linea === '256GB · E-Sim · Orange',
       'CEL-APP-068 llega como en la muestra: "Apple iPhone 17 Pro" / "256GB · E-Sim · Orange"',
       v ? v.titulo + ' / ' + v.linea : 'sin vista');
  } else {
    info('CEL-APP-068 ya no es el iPhone 17 Pro 256GB E-Sim Orange de la muestra (' +
         (c ? c.desc + ' / ' + c.color : 'no esta') + '): el caso de la muestra no se mira hoy');
  }
  const partes = t => JSON.stringify(vpPartesDeVersion(t));
  ok(partes('256GB E-Sim') === '["256GB","E-Sim"]', 'la version se parte como las pestañas: memoria y resto',
     partes('256GB E-Sim'));
  ok(partes('8GB/512GB') === '["8GB/512GB"]' && partes('12GB/512GB 5G') === '["12GB/512GB","5G"]',
     'la RAM con el disco va junta (partida se leia como dos memorias)', partes('12GB/512GB 5G'));
  ok(partes('24GB/1TB · Teclado inglés') === '["24GB/1TB","Teclado inglés"]',
     'el teclado queda como parte aparte', partes('24GB/1TB · Teclado inglés'));

  /* ---- 2. Todas las filas de hoy ---- */
  const sinTitulo = [], precio = [], conIdInterno = [], callaColor = [], callaMem = [], callaSim = [];
  for(const x of hoyTodo.vistas){
    if(!x.titulo.trim()) sinTitulo.push(x.id);
    if(conPrecio(x.titulo) || conPrecio(x.linea)) precio.push(x.id + ': ' + x.linea);
    if(norm(x.titulo + ' ' + x.linea).includes(norm(x.id))) conIdInterno.push(x.id);
    const m = buscarModelo(x.destino);
    const v = m && m.variantes.find(y => clave(y) === x.destino);
    if(!v) continue;
    const color = colorPorDefecto(v);
    /* Con todas sus palabras (el Ray-Ban lo dice como armazon y cristal). Es
       un control aparte, escrito aca (29/09, revision): antes usaba vpYaDicho,
       la misma funcion con que el generador decide omitir el color, y un
       error ahi no se veia. */
    if(color && !vpDiceElColor(x.titulo + ' · ' + x.linea, color)) callaColor.push(x.id + ' (' + color + ')');
    const op = v.opcion || v.etiqueta || '';
    const grupo = m.variantes.filter(y => (y.opcion || y.etiqueta) === op);
    const mem = m.multi && !opcionEsColor(grupo, op) ? memoriaDeOpcion(op) : '';
    if(mem && !vpDice(x.titulo, mem) && !x.linea.includes(mem)) callaMem.push(x.id + ' (' + mem + ')');
    if(v.sim && !diceSim(x.titulo) && !diceSim(x.linea)) callaSim.push(x.id + ' (' + v.sim + ')');
  }
  ok(!sinTitulo.length, 'todas las filas tienen titulo', ejemplos(sinTitulo) || hoyTodo.vistas.length + ' filas');
  ok(!precio.length, 'ninguna vista previa dice un precio (cambian todos los dias)', ejemplos(precio));
  ok(!conIdInterno.length, 'ni el ID interno', ejemplos(conIdInterno));
  ok(!callaColor.length, 'la linea dice el color de la fila si el titulo no lo dice', ejemplos(callaColor));
  ok(!callaMem.length, 'y la memoria de la version', ejemplos(callaMem));
  ok(!callaSim.length, 'y la Sim o E-Sim', ejemplos(callaSim));
  const sinLinea = hoyTodo.vistas.filter(x => !x.linea).length;
  info(sinLinea + ' filas sin linea: el titulo ya dice todo (objetivos, accesorios); no llevan og:description');

  /* ---- 3. La foto es la que muestra la ficha ----
     Salvo la foto ilustrativa de un usado (Benja, 14/10/2026, PR #21): la
     ficha la muestra con el cartel "Foto ilustrativa", pero WhatsApp muestra
     la imagen sola y el que recibe el link veria un iPhone nuevo como si
     fuera ese equipo. Ahi la vista previa va con la tarjeta general, a
     proposito. (19/10: esta tanda no lo sabia y los usados de la vitrina
     con foto ilustrativa daban FALLA.) */
  const distinta = [], fueraDelIndice = [], ilustrativas = [];
  let miradas = 0, i = 0;
  for(const x of hoyTodo.vistas){
    if(x.foto && !INDICE_FOTOS.has(x.foto.slice(CARPETA_FOTOS.length))) fueraDelIndice.push(x.id + ': ' + x.foto);
    if(x.foto && (i++ % 5)) continue;
    try{ quitarFicha(); }catch(e){}
    abrirFicha(x.destino, null);
    const img = document.querySelector('#ficha .fi-foto img');
    const ve = vpFotoPropia(img ? img.getAttribute('src') : '');
    const ilustrativa = !!document.querySelector('#ficha .fi-marco > .foto-ilus');
    if(ilustrativa) ilustrativas.push(x.id);
    if(FICHA !== x.destino || (ilustrativa ? x.foto !== '' : ve !== x.foto))
      distinta.push(x.id + ': ficha ' + (ve || 'sin propia') + (ilustrativa ? ' (ilustrativa)' : '') + ', vista ' + (x.foto || 'general'));
    miradas++;
    quitarFicha();
  }
  ok(!distinta.length, 'la foto de la vista previa es la que muestra la ficha al abrirse', ejemplos(distinta) || miradas + ' fichas abiertas');
  if(ilustrativas.length) info(ilustrativas.length + ' usado(s) con foto ilustrativa en la ficha, con la tarjeta general en WhatsApp: ' + ejemplos(ilustrativas, 8));
  ok(!fueraDelIndice.length, 'y esta en fotos/indice.json (se publica)', ejemplos(fueraDelIndice));
  const generales = hoyTodo.vistas.filter(x => !x.foto).map(x => x.id);
  info(generales.length + ' filas sin foto propia en la ficha (van con la tarjeta general, nunca con la de otro color)' +
       (generales.length ? ': ' + ejemplos(generales, 8) : ''));

  /* ---- 4. Las paginas publicadas ---- */
  const txtIndice = await leerVP('p/indice.json');
  let ids = null;
  try{ ids = JSON.parse(txtIndice || 'null').ids; }catch(e){}
  ok(Array.isArray(ids) && ids.length > 0, 'p/indice.json lista los IDs con pagina',
     Array.isArray(ids) ? ids.length + ' IDs' : 'no esta: correr python3 herramientas/vista-previa.py');
  if(!Array.isArray(ids)) return;
  const paginas = new Map(), faltan = [];
  /* De a 8 y con dos intentos mas (13/10/2026). Se pedian las ~775 a la vez
     y el servidor local (una conexion por respuesta, cinco en espera) dejaba
     alguna sin contestar: "cada ID tiene su pagina" fallaba de a ratos con
     paginas que estaban (07/10 ACC-APP-005, 13/10 ACC-APP-008) y frenaba
     PUBLICAR. Un archivo que de verdad falta sigue faltando al tercer intento. */
  const leerPagina = async id => {
    for(let i = 0; i < 3; i++){
      const t = await leerVP('p/' + encodeURIComponent(id) + '.html');
      if(t !== null) return paginas.set(id, t);
      await new Promise(r => setTimeout(r, 200));
    }
    faltan.push(id);
  };
  for(let i = 0; i < ids.length; i += 8) await Promise.all(ids.slice(i, i + 8).map(leerPagina));
  ok(!faltan.length, 'cada ID de p/indice.json tiene su p/<ID>.html', ejemplos(faltan) || ids.length + ' paginas');
  const general = PUBLICA + 'assets/preview.png';
  // (16/11/2026) La direccion de la tarjeta con precio, sin el ID, tal como la
  // escribio el generador: la primera que aparezca en una pagina (no se vuelve
  // a calcular aca). Vacia = paginas con la foto. Tiene que coincidir con el
  // interruptor TARJETA_CON_PRECIO de vista-previa.py: si esta prendido y las
  // paginas salieron con la foto, el generador cayo solo al modo de antes.
  const RE_TARJETA = /^https:\/\/[A-Za-z0-9.-]+\/api\/catalog\?resource=tecno-tarjeta&id=/;
  let TARJETA = '';
  for(const t of paginas.values()){
    const og = new DOMParser().parseFromString(t, 'text/html').querySelector('meta[property="og:image"]');
    TARJETA = (RE_TARJETA.exec(og ? og.getAttribute('content') || '' : '') || [''])[0];
    if(TARJETA) break;
  }
  const interruptor = /^TARJETA_CON_PRECIO = (True|False)[ \t]*$/m.exec(await leerVP('herramientas/vista-previa.py') || '');
  ok(!!interruptor && (interruptor[1] === 'True') === !!TARJETA,
     'las paginas van como dice TARJETA_CON_PRECIO de vista-previa.py (' + (interruptor ? interruptor[1] : 'no se pudo leer') + ')',
     TARJETA || 'con la foto');
  if(TARJETA){
    let mismo = false;
    try{ mismo = new URL(TARJETA).origin === new URL(ADVAPP_URL).origin; }catch(e){}
    ok(mismo, 'la tarjeta con precio se le pide al mismo ADVAPP que los productos', TARJETA);
  }
  const mal = { titulo: [], imagen: [], url: [], card: [], robots: [], ir: [], abre: [], precio: [], medidas: [] };
  const leidas = new Map();
  for(const [id, t] of paginas){
    const d = new DOMParser().parseFromString(t, 'text/html');
    const meta = k => { const e = d.querySelector(`meta[property="${k}"], meta[name="${k}"]`); return e ? e.getAttribute('content') : null; };
    // `foto`: la foto propia del cuerpo ("fotos/AT-0136.jpg"), de donde la lee ADVAPP
    const cuerpo = d.querySelector('main > img');
    const pag = { titulo: meta('og:title'), linea: meta('og:description') || '', imagen: meta('og:image') || '',
                  foto: cuerpo ? String(cuerpo.getAttribute('src') || '').replace(/^\.\.\//, '') : '',
                  sku: meta('advance:sku') || '',
                  ir: '#' + ((/location\.replace\("\.\.\/#([^"]+)"\)/.exec(t) || [])[1] || '') };
    leidas.set(id, pag);
    if(!pag.titulo || !pag.titulo.trim()) mal.titulo.push(id);
    const va = (/location\.replace\("\.\.\/#p=([^"]+)"\)/.exec(t) || [])[1];
    // La pagina de una fila escondida por repetida (lleva a su gemela) va con
    // la foto aunque haya tarjeta: con el precio de la escondida, la tarjeta
    // diria un precio y la ficha de la gemela, otro
    pag.conTarjeta = !!TARJETA && !!va && va.split('&')[0] === id;
    if(pag.conTarjeta){
      if(pag.imagen !== TARJETA + id) mal.imagen.push(id + ': ' + pag.imagen);
      if(pag.foto && !(pag.foto.startsWith(CARPETA_FOTOS) && pag.foto.endsWith(EXT_FOTOS))) mal.imagen.push(id + ': foto ' + pag.foto);
      if(meta('og:image:width') !== '1200' || meta('og:image:height') !== '630') mal.medidas.push(id);
      if(meta('og:url') !== null) mal.url.push(id + ': ' + meta('og:url'));
      if(meta('twitter:card') !== 'summary_large_image' || meta('twitter:image') !== pag.imagen)
        mal.card.push(id + ': ' + meta('twitter:card'));
    } else {
      const propia = pag.imagen.startsWith(PUBLICA + CARPETA_FOTOS) && pag.imagen.endsWith(EXT_FOTOS);
      if(!propia && pag.imagen !== general) mal.imagen.push(id + ': ' + pag.imagen);
      if(!(Number(meta('og:image:width')) > 0 && Number(meta('og:image:height')) > 0)) mal.medidas.push(id);
      if(meta('og:url') !== PUBLICA + 'p/' + id + '.html') mal.url.push(id + ': ' + meta('og:url'));
      if(meta('twitter:card') !== (propia ? 'summary' : 'summary_large_image') || meta('twitter:image') !== pag.imagen)
        mal.card.push(id + ': ' + meta('twitter:card'));
    }
    if(!/noindex/.test(meta('robots') || '')) mal.robots.push(id);
    const link = d.querySelector('a[href^="../#p="]');
    if(!va || !link || link.getAttribute('href') !== '../#p=' + va) mal.ir.push(id);
    else if(hoy.has(id)){
      /* El destino y, desde el 13/10/2026 (auditoria W3-03), el ID y el SKU de
         respaldo (&o= &s=): lo que se mira es lo que abre la web con eso
         (destinoDelLink), y tiene que ser el modelo de ESA fila. El iPad Pro
         M4 11" 512GB (TAB-APP-046) llevaba a una gemela que desaparecio y
         abria "Ya no esta" con stock. */
      const k = va.split('&')[0], resp = [...va.matchAll(/&(?:o|s)=([^&]+)/g)].map(x => x[1]);
      const dest = destinoDelLink(k, resp);
      const m = buscarModelo(id);
      if(!dest.clave || !m || buscarModelo(dest.clave) !== m) mal.abre.push(id + ' -> ' + va);
    }
    if(conPrecio(d.body ? d.body.textContent : '') || conPrecio(pag.titulo) || conPrecio(pag.linea)) mal.precio.push(id);
  }
  ok(!mal.titulo.length, 'cada pagina tiene og:title', ejemplos(mal.titulo));
  if(TARJETA){
    const gemelas = [...leidas.values()].filter(x => !x.conTarjeta).length;
    ok(!mal.imagen.length, 'og:image es la tarjeta con precio de ADVAPP para ESE ID, y la foto del cuerpo es una foto propia', ejemplos(mal.imagen));
    ok(!mal.medidas.length, 'de 1200 x 630', ejemplos(mal.medidas));
    ok(!mal.url.length, 'sin og:url (con el, Instagram reusa la tarjeta guardada aunque el link traiga ?v=)', ejemplos(mal.url));
    ok(!mal.card.length, 'twitter:card: summary_large_image, con la misma imagen', ejemplos(mal.card));
    if(gemelas) info(gemelas + ' pagina(s) de filas escondidas por repetidas: van con la foto, sin la tarjeta con precio');
  } else {
    info('las paginas van con la foto en el og:image, sin la tarjeta con precio (TARJETA_CON_PRECIO de vista-previa.py)');
    ok(!mal.imagen.length, 'og:image es una direccion completa: la foto propia o la tarjeta general', ejemplos(mal.imagen));
    ok(!mal.medidas.length, 'con su ancho y alto', ejemplos(mal.medidas));
    ok(!mal.url.length, 'og:url es la pagina misma', ejemplos(mal.url));
    ok(!mal.card.length, 'twitter:card: summary con la foto cuadrada, summary_large_image con la general', ejemplos(mal.card));
  }
  ok(!mal.robots.length, 'todas piden noindex', ejemplos(mal.robots));
  ok(!mal.ir.length, 'la redireccion y el link visible llevan al mismo #p=', ejemplos(mal.ir));
  ok(!mal.abre.length, 'y ese #p= abre la ficha del modelo de esa fila (con el ID y el SKU de respaldo, W3-03)', ejemplos(mal.abre));
  ok(!mal.precio.length, 'ninguna pagina dice un precio', ejemplos(mal.precio));

  /* ---- 4b. Los pesos de la tarjeta, como los de la web (16/11/2026) ----
     ADVAPP repite COTIZACION_TIPO, RECARGO_PCT y RECARGO_FIJO de index.html
     (api/_lib/tecno-tarjeta-handler.js). Si aca cambian y alla no, la tarjeta
     dice otros pesos que la ficha. Se pregunta por hasta tres filas: ADVAPP lee
     la pagina publicada, y una fila nueva todavia no la tiene (404). Si ADVAPP
     contesta pero no arma la tarjeta, es FALLA: las paginas apuntan a una
     imagen que no sale (pasa si se publica la web antes de que ADVAPP tenga
     resource=tecno-tarjeta). Si ni contesta (sin red), AVISO. */
  if(TARJETA){
    let c = null, contesto = [];
    for(const id of ids.slice(0, 3)){
      try{
        const r = await conTope(8000, senal => fetch(TARJETA + encodeURIComponent(id) + '&datos=1', { signal: senal, cache: 'no-store' }));
        contesto.push(r.status);
        c = r.ok ? ((await r.json()) || {}).cotizacion || null : null;
      }catch(e){ c = null; }
      if(c) break;
    }
    if(!c && !contesto.length) aviso('ADVAPP no contesto por la tarjeta (resource=tecno-tarjeta&datos=1): no se compara su cotizacion con la de la web');
    else if(!c) ok(false, 'ADVAPP arma la tarjeta con precio que nombran las paginas (resource=tecno-tarjeta)',
                   'contesto ' + contesto.join(', ') + ': si es 400, a ADVAPP en produccion todavia le falta la tarjeta');
    else ok(COTIZACION === 'auto' && c.tipo === COTIZACION_TIPO && c.recargo_pct === RECARGO_PCT && c.recargo_fijo === RECARGO_FIJO,
            'ADVAPP hace los pesos de la tarjeta con la misma cotizacion que la web',
            'web: ' + [COTIZACION, COTIZACION_TIPO, RECARGO_PCT, RECARGO_FIJO].join(' / ') + ' · ADVAPP: ' + [c.tipo, c.recargo_pct, c.recargo_fijo].join(' / '));
  }

  /* ---- 5a. Las paginas son lo que calculo la herramienta ---- */
  // "x" es una vista ({titulo, linea, foto}); devuelve que difiere, o ''
  const difiere = (pag, x) => {
    const nombre = x.foto ? x.foto.slice(CARPETA_FOTOS.length) : '';
    // Con la tarjeta de ADVAPP en el og:image, la foto es la del cuerpo
    const imagenBien = TARJETA
      ? (x.foto ? (pag.foto === x.foto || pag.foto === CARPETA_MINIS + nombre) : pag.foto === '')
      : (x.foto ? (pag.imagen === PUBLICA + x.foto || pag.imagen === PUBLICA + CARPETA_MINIS + nombre) : pag.imagen === general);
    // El SKU que declara la pagina (16/11/2026): si el de la fila cambio, ADVAPP
    // dibuja esa tarjeta sin precio hasta el proximo PUBLICAR. `x.sku` solo
    // viene en las vistas de hoy (5b), no en _generado.json
    const skuBien = !pag.conTarjeta || x.sku === undefined || pag.sku === (/^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/.test(x.sku || '') ? x.sku : '');
    if(imagenBien && !skuBien && pag.titulo === x.titulo && pag.linea === (x.linea || ''))
      return 'SKU ' + (pag.sku || '(ninguno)') + ' -> ' + (x.sku || '(ninguno)');
    return (pag.titulo !== x.titulo || pag.linea !== (x.linea || '') || !imagenBien)
      ? '"' + pag.titulo + ' / ' + pag.linea + '" -> "' + x.titulo + ' / ' + (x.linea || '') + '"' + (imagenBien ? '' : ' (foto)') : '';
  };
  let gen = null;
  try{ gen = JSON.parse(await leerVP('p/_generado.json') || 'null'); }catch(e){ gen = null; }
  if(gen && gen.vistas && typeof gen.vistas === 'object'){
    const malHechas = [];
    for(const id of ids){
      const x = gen.vistas[id], pag = leidas.get(id);
      if(!x){ malHechas.push(id + ': no esta en _generado.json'); continue; }
      if(!pag) continue;          // sin archivo: ya lo dice "cada ID de p/indice.json tiene su p/<ID>.html"
      const d = difiere(pag, x);
      if(d) malHechas.push(id + ': ' + d);
      // El link entero, con sus respaldos (13/10/2026: _generado.json trae "ir")
      else if(x.ir && pag.ir && pag.ir !== x.ir) malHechas.push(id + ': lleva a ' + pag.ir + ' y no a ' + x.ir);
    }
    const sobran = Object.keys(gen.vistas).filter(id => !ids.includes(id));
    ok(!malHechas.length && !sobran.length,
       'cada pagina dice exactamente lo que calculo la herramienta al armarla (p/_generado.json, ' + (gen.generado_en || '?') + ')',
       ejemplos(malHechas.concat(sobran.map(x => x + ': sin pagina')), 2) || ids.length + ' paginas');
  } else info('no hay p/_generado.json (se escribe en cada corrida de herramientas/vista-previa.py y no se publica): no se mira el generador');

  /* ---- 5b. Al dia con ADVAPP ---- */
  if(FUENTE.fuente !== 'advapp'){
    info('la web no esta usando ADVAPP ahora (' + FUENTE.fuente + '): no se comparan las paginas con los datos');
  } else {
    const nuevas = [], cambiadas = [], bajas = ids.filter(id => !hoy.has(id));
    for(const x of hoyTodo.vistas){
      const pag = leidas.get(x.id);
      if(!pag){ nuevas.push(x.id); continue; }
      const d = difiere(pag, x);
      if(d) cambiadas.push(x.id + ': ' + d);
    }
    const total = nuevas.length + cambiadas.length + bajas.length;
    // Lo que cambio en ADVAPP desde el ultimo PUBLICAR: AVISO, sin tope
    if(nuevas.length) aviso(nuevas.length + ' fila(s) nuevas sin pagina (se arman con el proximo PUBLICAR): ' + ejemplos(nuevas, 5));
    if(cambiadas.length) aviso(cambiadas.length + ' pagina(s) desactualizadas (se rehacen con el proximo PUBLICAR): ' + ejemplos(cambiadas, 2));
    if(bajas.length) aviso(bajas.length + ' pagina(s) de filas que ADVAPP ya no trae (se borran con el proximo PUBLICAR): ' + ejemplos(bajas, 5));
    if(!total) info('las ' + ids.length + ' paginas estan al dia');
  }

  /* ---- 6. PUBLICAR, la revision diaria y 404.html ---- */
  const pub = await leerVP('PUBLICAR.command');
  if(pub !== null){
    const lineas = pub.split('\n').filter(l => !/^\s*#/.test(l));
    const pos = re => lineas.findIndex(l => re.test(l));
    const fotos = pos(/\bverificar-fotos\.py\b/), vista = pos(/herramientas\/vista-previa\.py/),
          pruebas = pos(/pruebas\/correr\.py/);
    ok(vista !== -1 && fotos !== -1 && pruebas !== -1 && fotos < vista && vista < pruebas,
       'PUBLICAR.command arma las vistas previas despues de las fotos y antes de las pruebas',
       'lineas ' + [fotos, vista, pruebas].join(' / '));
  } else ok(false, 'se puede leer PUBLICAR.command');
  const rev = await leerVP('revision-diaria.py');
  ok(rev !== null && /def filas_sin_vista_previa\(/.test(rev) && (rev.match(/filas_sin_vista_previa\(/g) || []).length >= 2,
     'la revision diaria avisa las filas nuevas sin vista previa');
  const n404 = await leerVP('404.html');
  let destinoDe = null;
  try{
    const cuerpo = /function destinoDe404\(ruta\)\{([\s\S]*?)\n\}/.exec(n404 || '')[1];
    destinoDe = new Function('ruta', cuerpo);
  }catch(e){}
  ok(!!destinoDe, '404.html tiene destinoDe404()');
  if(destinoDe){
    const casos = [['/catalogo-advance/p/CEL-APP-068.html', '/catalogo-advance/#p=CEL-APP-068'],
                   ['/catalogo-advance/p/CEL-APP-068', '/catalogo-advance/#p=CEL-APP-068'],
                   ['/catalogo-advance/p/indice.json', ''], ['/catalogo-advance/otra.html', ''],
                   ['/catalogo-advance/', ''], ['/catalogo-advance/p/../index.html', ''],
                   // Con el dominio propio (05/10) el catalogo esta en la raiz
                   ['/p/CEL-APP-068.html', '/#p=CEL-APP-068'], ['/p/CEL-APP-068', '/#p=CEL-APP-068'],
                   ['/p/indice.json', ''], ['/', ''], ['//otro-sitio.com/p/X.html', '']];
    const malos = casos.filter(([r, esperado]) => destinoDe(r) !== esperado).map(([r]) => r + ' -> ' + destinoDe(r));
    ok(!malos.length, '404.html manda un p/<ID>.html borrado a su #p= y no toca otras direcciones', ejemplos(malos) || casos.length + ' casos');
    ok(/noindex/.test(n404), 'y pide noindex');
  }
}
