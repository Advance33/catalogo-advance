// Las decisiones de Benja del 21/10/2026 sobre la auditoria de la web del 19/10
// (sesion a-c2). Cada comprobacion lleva el numero de la decision y del hallazgo:
//   5 A (U-05)  en un modelo con 2 o mas colores, el + de la tarjeta (y el de
//               Recien llegados) abre la ficha para elegir el color, en la
//               version de la tarjeta, y no carga nada; con un color o ninguno
//               carga como siempre; con el modelo ya en el pedido, lo saca.
//               Cambia la 2.1 B del 29/09 solo en eso (decision-tarjeta.js).
//   6 A (U-04)  la cuota elegida en la ficha va en su WhatsApp con el mismo
//               renglon que el pedido ("Lo pago con tarjeta en 6 cuotas:
//               aprox. $ … c/u.", sin total: D13 A) y, al agregar, pasa a ser
//               la del pedido (CUOTAS_PEDIDO); sin plan, el del pedido queda.
//   8 A (G-03)  la portada dice que se vende y donde: title, meta description y
//               h1 con rubro y Parque Chas, CABA; y el JSON-LD Store con la
//               direccion, el mapa, el WhatsApp y el Instagram de la pagina,
//               sin horario (se atiende con cita previa).
//   2   (T-04, X-01) si ADVAPP manda la columna "Garantía" vacia para un
//               producto nuevo (sql/233 de ADVAPP), la ficha no tiene renglon de
//               garantia (ni "Cada producto tiene la suya"); en un usado y sin
//               la columna, lo de siempre.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);
const d21Dormir = ms => new Promise(r => setTimeout(r, ms));
async function d21EsperarA(cond, ms = 25000){
  const t0 = Date.now();
  while(Date.now() - t0 < ms){
    try{ if(cond()) return true; }catch(e){}
    await d21Dormir(150);
  }
  return false;
}

const esperaD21 = setInterval(() => {
  if(!MODELOS.length || !FUENTE || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperaD21);
  (async () => {
    const pedidoAntes = PEDIDO.slice(), cuotasAntes = CUOTAS_PEDIDO;
    try{ await d21Pruebas(); }catch(e){ R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; }
    finally{
      try{ quitarFicha(); }catch(e){}
      PEDIDO = pedidoAntes; guardarPedido(); CUOTAS_PEDIDO = cuotasAntes; guardarCuotasPedido(); pintarPedido();
      try{ d21Limpiar(); pintar(); }catch(e){}
    }
    try{ pararPaseos(); pararOfertas(); pararNuevos(); pararMarcas(); pararMundos(); }catch(e){}
    for(let i=1;i<5000;i++) clearInterval(i);
    const pre=document.createElement('pre'); pre.id='RESULTADO';
    pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
    document.body.appendChild(pre);
  })();
}, 150);

const d21Limpiar = () => Object.assign(filtros, { q:'', cat:'', marca:'', rango:'', capacidad:'', ram:'', montura:'', apertura:'', soloStock:false, orden:'modelo', ...SIN_PROPIOS });
const d21Txt = el => (el ? el.textContent : '').replace(/\s+/g, ' ').trim();
const d21Msg = a => a ? decodeURIComponent(a.href.replace(/^[^?]*\?text=/, '')) : '';
// Los colores del modelo contados aparte, sin coloresDelModelo: todos los de
// todas sus filas, tambien los agotados, una vez cada uno
const d21Colores = m => new Set(m.variantes.flatMap(v => pintas(v.color || '').map(c => norm(c.nombre)))).size;
const d21SinPedido = () => { PEDIDO = []; guardarPedido(); pintarPedido(); refrescarBotonesPedido(); };
// La regla de la pagina, si esta (sin el cambio del 21/10 no existe y cuenta como "no abre")
const d21Abre = m => typeof masAbreFicha === 'function' ? masAbreFicha(m) : false;

/* La tarjeta del modelo m dibujada en la grilla (entrando a su rubro y su marca) */
function d21Tarjeta(m){
  d21Limpiar(); Object.assign(filtros, { cat: m.cat, marca: m.marca }); pintar();
  const sel = `.card[data-key="${CSS.escape(clave(m.rep))}"]`;
  for(let i = 0; i < 30 && !grid.querySelector(sel) && dibujadas < LISTA.length; i++){
    try{ dibujarTanda(); }catch(e){ break; }
  }
  return grid.querySelector(sel);
}

async function d21Pruebas(){
  document.documentElement.style.scrollBehavior = 'auto';
  probarMasDeLaTarjeta();          // 5 A
  await probarNuevos();            // 5 A en Recien llegados
  probarCuotaDeLaFicha();          // 6 A
  probarPortadaParaGoogle();       // 8 A
  await probarPortadaEnElCelular(); // 8 A a 390 px
  await probarSinGarantia();       // 2
}

/* ---- 5 A · El + de la tarjeta con varios colores abre la ficha ---- */
function probarMasDeLaTarjeta(){
  const varios = MODELOS.filter(m => m.stock && d21Colores(m) > 1);
  const uno = MODELOS.filter(m => m.stock && d21Colores(m) <= 1);
  info('[5 A] hoy hay ' + varios.length + ' modelos con stock y 2 o mas colores, y ' + uno.length + ' con uno o ninguno');
  d21SinPedido();
  const abren = MODELOS.filter(m => m.stock && d21Abre(m));
  ok(abren.length === varios.length && abren.every(m => varios.includes(m)),
     '[5 A] el + abre la ficha justo en los modelos con 2 o mas colores (contados aparte, tambien los agotados)',
     abren.length + ' de ' + varios.length);

  // El caso de la auditoria: el iPhone 17 Pro (o el primero con varios colores)
  const m = varios.find(x => /iPhone 17 Pro$/i.test(x.titulo || '')) || varios[0];
  if(!m){ info('[5 A] hoy ningun modelo con stock tiene dos colores'); return; }
  const card = d21Tarjeta(m);
  ok(!!card && !!card.querySelector('.mas'), '[5 A] la tarjeta de ' + (m.titulo || m.desc) + ' esta en la grilla con su +');
  if(card){
    d21SinPedido();
    card.querySelector('.mas').click();
    const d = document.getElementById('ficha');
    ok(PEDIDO.length === 0, '[5 A] tocar el + no carga nada (antes cargaba la fila mas barata con su color)', JSON.stringify(PEDIDO));
    ok(!!d && FICHA === card.dataset.key, '[5 A] abre la ficha en la version de la tarjeta', FICHA + ' · tarjeta ' + card.dataset.key);
    const tonos = d ? d.querySelectorAll('.fi-colores .fi-tono') : [];
    ok(tonos.length > 1, '[5 A] y la ficha muestra los colores para elegir', tonos.length + ' colores');
    // Elegir otro color y agregar: la linea lleva ESE color
    const otro = [...tonos].find(b => !b.disabled && b.getAttribute('aria-pressed') !== 'true' && b.dataset.color);
    if(otro){
      otro.click();
      const elegido = COLOR_FICHA;
      document.getElementById('fi-pedido')?.click();
      ok(PEDIDO.length === 1 && norm(PEDIDO[0].color) === norm(elegido),
         '[5 A] agregar desde la ficha carga el color que eligio el cliente', JSON.stringify(PEDIDO) + ' · eligio ' + elegido);
    } else info('[5 A] en la ficha de ' + (m.titulo || m.desc) + ' no hay otro color con stock para elegir');
    quitarFicha();
    // Con el modelo ya en el pedido, el + lo saca (y no abre nada)
    const c2 = d21Tarjeta(m);
    if(PEDIDO.length && c2){
      ok(c2.querySelector('.mas').getAttribute('aria-pressed') === 'true', '[5 A] la tarjeta queda marcada como agregada');
      c2.querySelector('.mas').click();
      ok(PEDIDO.length === 0 && !document.getElementById('ficha'), '[5 A] y el + la saca, sin abrir la ficha', JSON.stringify(PEDIDO));
    }
  }
  // Con un filtro de version, la ficha abre en esa version (la 2.1 B sigue en eso)
  for(const f of [{ capacidad: '1TB' }, { capacidad: '512GB' }, { capacidad: '256GB' }]){
    d21Limpiar(); Object.assign(filtros, f); pintar();
    const x = LISTA.find(y => y.filtrada && y.stock && clave(y) !== clave(buscarModelo(clave(y)).rep) && d21Colores(buscarModelo(clave(y))) > 1);
    if(!x) continue;
    const c = grid.querySelector(`.card[data-key="${CSS.escape(clave(x))}"]`);
    if(!c) continue;
    d21SinPedido();
    c.querySelector('.mas').click();
    ok(PEDIDO.length === 0 && FICHA === clave(x), '[5 A] con ' + JSON.stringify(f) + ' el + abre la ficha en la version filtrada, no en la del modelo',
       (x.titulo || x.desc) + ' · ' + FICHA);
    quitarFicha();
    break;
  }
  // Un modelo de un solo color (o ninguno): el + carga como siempre
  const u = uno.find(x => x.imagen) || uno[0];
  if(u){
    const cu = d21Tarjeta(u);
    if(cu){
      d21SinPedido();
      cu.querySelector('.mas').click();
      ok(PEDIDO.length === 1 && buscarModelo(PEDIDO[0].k) === u && !document.getElementById('ficha'),
         '[5 A] con un color, el + lo carga sin abrir la ficha, como siempre', (u.titulo || u.desc) + ' · ' + JSON.stringify(PEDIDO));
      cu.querySelector('.mas').click();
      ok(PEDIDO.length === 0, '[5 A] y tocarlo otra vez lo saca');
    } else info('[5 A] la tarjeta de ' + (u.titulo || u.desc) + ' no quedo a mano');
  }
  d21SinPedido(); d21Limpiar(); pintar();
}

/* ---- 5 A · Lo mismo en Recien llegados ---- */
async function probarNuevos(){
  const sec = document.getElementById('nuevos');
  const tarjetas = sec ? [...sec.querySelectorAll('.nv-tarj')] : [];
  if(!tarjetas.length){ info('[5 A] hoy no hay Recien llegados'); return; }
  const conVarios = tarjetas.find(t => t.querySelector('.mas') && d21Colores(buscarModelo(t.dataset.key)) > 1);
  const conUno = tarjetas.find(t => t.querySelector('.mas') && d21Colores(buscarModelo(t.dataset.key)) <= 1);
  d21SinPedido();
  if(conVarios){
    conVarios.querySelector('.mas').click();
    ok(PEDIDO.length === 0 && !!document.getElementById('ficha') && FICHA === conVarios.dataset.key,
       '[5 A] en Recien llegados, el + de un modelo con varios colores abre su ficha', FICHA);
    quitarFicha();
  } else info('[5 A] hoy ningun Recien llegado tiene varios colores');
  if(conUno){
    conUno.querySelector('.mas').click();
    ok(PEDIDO.length === 1 && !document.getElementById('ficha'), '[5 A] y el de un solo color lo carga, como siempre', JSON.stringify(PEDIDO));
  }
  d21SinPedido();
}

/* ---- 6 A · La cuota de la ficha en su WhatsApp y en el pedido ---- */
function probarCuotaDeLaFicha(){
  const plan = CUOTAS.find(c => c.cuotas === 6) || CUOTAS.find(c => c.cuotas > 1);
  if(!plan){ info('[6 A] hoy no hay planes en cuotas'); return; }
  const n = plan.cuotas;
  const v = PRODUCTOS.find(p => conCuotas(p) && p.precio > 500 && buscarModelo(clave(p)) && pintas(p.color).length <= 1 &&
                              buscarModelo(clave(p)).variantes.length > 1) || PRODUCTOS.find(p => conCuotas(p) && buscarModelo(clave(p)));
  if(!v){ info('[6 A] hoy ningun producto con cuotas'); return; }
  d21SinPedido();
  CUOTAS_PEDIDO = 0; guardarCuotasPedido();
  abrirFicha(clave(v), null);
  let d = document.getElementById('ficha');
  const cta = () => d.querySelector('.fi-botones .cta');
  const sinPlan = d21Msg(cta());
  ok(!/Lo pago con tarjeta/.test(sinPlan), '[6 A] sin plan elegido, el WhatsApp de la ficha no nombra cuotas', sinPlan);
  const b = d.querySelector(`.fi-cuota[data-cuotas="${n}"]`);
  ok(!!b, '[6 A] la ficha ofrece ' + n + ' cuotas');
  if(!b) return;
  b.click();
  const x = cuentaCuotas(v.precio, n);
  const esperado = x ? (n === 1 ? `Lo pago con tarjeta en 1 pago: aprox. $ ${plata(x.total)}.` : `Lo pago con tarjeta en ${n} cuotas: aprox. $ ${plata(x.cuota)} c/u.`)
                     : `Lo pago con tarjeta en ${nombreCuotas(n)}.`;
  const con = d21Msg(cta());
  ok(con === sinPlan + '\n\n' + esperado, '[6 A] tocar ' + n + ' cuotas suma al WhatsApp el renglon del pedido', con.replace(/\n/g, ' / '));
  // Lo mismo que dice la ficha y sin el total en cuotas (D13 A) ni porcentajes
  const enFicha = d21Txt(d.querySelector('.fi-cuotas-res'));
  ok(!x || enFicha.includes(plata(x.cuota)), '[6 A] con la misma cuota que muestra la ficha', enFicha);
  ok(!x || (!con.includes(plata(x.total)) || n === 1) && !/%|recargo|\binter[eé]s\b|\btotal\b/i.test(con),
     '[6 A] sin el total en cuotas, sin porcentaje ni recargo');
  ok(!x || (con.match(/\$ [\d.]+/g) || []).length === 1, '[6 A] un solo monto en el mensaje', (con.match(/\$ [\d.]+/g) || []).join(' '));
  // Al cambiar de version el plan sigue, y el mensaje con el
  const m = buscarModelo(clave(v));
  const otraOp = [...d.querySelectorAll('.fi-op')].find(o => o.getAttribute('aria-pressed') !== 'true' && !o.classList.contains('agotada'));
  if(otraOp){
    otraOp.click();
    d = document.getElementById('ficha');
    const w = buscarProducto(FICHA);
    const msg = d21Msg(cta());
    ok(w && clave(w) !== clave(v) && (!conCuotas(w) || /Lo pago con tarjeta en \d+ cuotas|Lo pago con tarjeta en 1 pago/.test(msg)),
       '[6 A] al cambiar de version, el WhatsApp sigue con el plan', (w && w.desc) + ' · ' + msg.split('\n').pop());
    const vuelta = [...d.querySelectorAll('.fi-op')].find(o => o.dataset.k === clave(v) || (v.opcion && o.dataset.op === v.opcion));
    vuelta?.click();
    d = document.getElementById('ficha');
  } else info('[6 A] la ficha de ' + (m.titulo || m.desc) + ' no tiene otra version para cambiar');
  // Agregar: el plan pasa al pedido
  if(FICHA !== clave(v)){ abrirFicha(clave(v), null); d = document.getElementById('ficha'); d.querySelector(`.fi-cuota[data-cuotas="${n}"]`)?.click(); }
  d.querySelector('#fi-pedido')?.click();
  ok(enPedido(clave(v)) && CUOTAS_PEDIDO === n, '[6 A] al agregarlo al pedido, el plan elegido pasa a ser el del pedido', 'CUOTAS_PEDIDO=' + CUOTAS_PEDIDO);
  ok(renglonCuotas() && mensajePedido().endsWith(renglonCuotas()) || mensajePedido().includes(renglonCuotas()),
     '[6 A] y el mensaje del pedido lo dice', renglonCuotas());
  let guardado = null; try{ guardado = localStorage.getItem(CUOTAS_KEY); }catch(e){}
  ok(guardado === null || guardado === String(n), '[6 A] queda guardado como el plan del pedido', guardado);
  quitarFicha();
  // Tocarlo otra vez lo desmarca, y el mensaje vuelve a ser el de siempre
  abrirFicha(clave(v), null); d = document.getElementById('ficha');
  d.querySelector(`.fi-cuota[data-cuotas="${n}"]`)?.click();
  d.querySelector(`.fi-cuota[data-cuotas="${n}"]`)?.click();
  ok(d21Msg(cta()) === sinPlan, '[6 A] desmarcar el plan saca el renglon del WhatsApp');
  quitarFicha();
  // Sin plan en la ficha, el del pedido no se toca
  d21SinPedido();
  const otroPlan = (CUOTAS.find(c => c.cuotas !== n && c.cuotas > 1) || plan).cuotas;
  CUOTAS_PEDIDO = otroPlan; guardarCuotasPedido();
  abrirFicha(clave(v), null); d = document.getElementById('ficha');
  d.querySelector('#fi-pedido')?.click();
  ok(enPedido(clave(v)) && CUOTAS_PEDIDO === otroPlan, '[6 A] sin plan en la ficha, agregar deja el plan que tenia el pedido', 'CUOTAS_PEDIDO=' + CUOTAS_PEDIDO);
  quitarFicha();
  // Lo agotado: "Avisame cuando entre", sin plan
  const sin = PRODUCTOS.find(p => !p.stock && buscarModelo(clave(p)));
  if(sin){
    abrirFicha(clave(sin), null); d = document.getElementById('ficha');
    CUOTA_FICHA = n;
    ok(!/Lo pago con tarjeta/.test(d21Msg(d.querySelector('.fi-botones .cta'))) && (typeof mensajeWAFicha !== 'function' || mensajeWAFicha(sin) === mensajeWA(sin)),
       '[6 A] lo agotado no lleva plan en el aviso');
    CUOTA_FICHA = 0;
    quitarFicha();
  }
  d21SinPedido();
}

/* ---- 8 A · La portada para Google ---- */
function probarPortadaParaGoogle(){
  const t = TITULO_PORTADA;
  ok(/^Advance Tecno\b/.test(t) && /Parque Chas/.test(t) && /CABA/.test(t) && /Celulares/.test(t),
     '[8 A] el title de la portada dice la tienda, el rubro y el lugar', t);
  ok(t.length <= 70, '[8 A] y entra en lo que muestra Google (70 o menos)', t.length);
  d21Limpiar(); pintar();
  ok(document.title === t, '[8 A] en la portada la pestaña dice ese title', document.title);
  const desc = document.querySelector('meta[name="description"]')?.content || '';
  ok(/Parque Chas/.test(desc) && /CABA/.test(desc) && /iPhone|celular/i.test(desc) && /c[aá]mara/i.test(desc),
     '[8 A] la meta description dice que se vende y donde', desc);
  ok(desc.length >= 70 && desc.length <= 160, '[8 A] y mide entre 70 y 160 caracteres', desc.length);
  ok(!/%|recargo|inter[eé]s|\b1 a[ñn]o\b|garant/i.test(t + ' ' + desc), '[8 A] sin porcentajes, recargos ni garantias en el title y la description');
  const h1 = [...document.querySelectorAll('h1')];
  ok(h1.length === 1, '[8 A] la portada tiene un solo h1', h1.length);
  const th = d21Txt(h1[0]);
  ok(/Parque Chas/.test(th) && /CABA/.test(th) && /Celulares/.test(th), '[8 A] el h1 dice el rubro y el lugar', th);
  ok(!!h1[0] && h1[0].closest('header') && h1[0].offsetParent !== null, '[8 A] y se ve, arriba en el encabezado (no es texto escondido)');
  ok(/Los precios de hoy/.test(d21Txt(document.querySelector('header .titulo-h'))), '[8 A] el titulo grande sigue diciendo "Los precios de hoy"');

  // El JSON-LD de la tienda
  const lds = [...document.querySelectorAll('script[type="application/ld+json"]')];
  let tienda = null, errores = [];
  lds.forEach(s => { try{ const j = JSON.parse(s.textContent); (Array.isArray(j) ? j : [j]).forEach(x => { if(x && x['@type'] === 'Store') tienda = x; }); }catch(e){ errores.push(e.message); } });
  ok(lds.length >= 1 && !errores.length, '[8 A] el JSON-LD de la portada se lee (JSON valido)', lds.length + ' bloque(s)' + (errores.length ? ' · ' + errores[0] : ''));
  ok(!!tienda, '[8 A] y es una Store de schema.org');
  if(!tienda) return;
  ok(tienda['@context'] === 'https://schema.org' && tienda.name === 'Advance Tecno' && tienda.url === document.querySelector('link[rel="canonical"]').href,
     '[8 A] con el nombre y la direccion de la web (la canonical)', tienda.name + ' · ' + tienda.url);
  const a = tienda.address || {};
  const calle = DIRECCION.replace(/,\s*CABA$/i, '').trim();
  ok(a['@type'] === 'PostalAddress' && a.streetAddress === calle && /Buenos Aires/.test(a.addressLocality || '') && /Parque Chas/.test(a.addressLocality || '') && a.addressCountry === 'AR',
     '[8 A] la direccion es la de la pagina (DIRECCION), en Parque Chas', JSON.stringify(a));
  ok(String(tienda.telephone || '').replace(/\D/g, '') === WHATSAPP, '[8 A] el telefono es el WhatsApp de la pagina', tienda.telephone + ' · WHATSAPP ' + WHATSAPP);
  ok(tienda.hasMap === MAPA, '[8 A] el mapa es el link de la pagina (MAPA)', tienda.hasMap);
  const g = tienda.geo || {};
  ok(g['@type'] === 'GeoCoordinates' && Math.abs(g.latitude - (-34.5866172)) < 1e-6 && Math.abs(g.longitude - (-58.481116)) < 1e-6,
     '[8 A] las coordenadas son las del link de Maps (@-34.5866172,-58.481116)', g.latitude + ', ' + g.longitude);
  ok((tienda.sameAs || []).includes('https://www.instagram.com/' + INSTAGRAM_TECNO + '/'), '[8 A] con el Instagram de la pagina', (tienda.sameAs || []).join(' '));
  const horario = Object.keys(tienda).filter(k => /opening|hours/i.test(k));
  ok(!horario.length, '[8 A] sin horario (se atiende con cita previa)', horario.join(',') || 'sin horario');
  ok(!/%|recargo|inter[eé]s|garant/i.test(JSON.stringify(tienda)), '[8 A] sin porcentajes ni garantias en el JSON-LD');
  ['logo', 'image'].forEach(k => ok(/^https:\/\/catalogo\.advancetecno\.com\.ar\/assets\/[\w.-]+\.png$/.test(tienda[k] || ''), '[8 A] ' + k + ' es una imagen de la web', tienda[k]));
}

/* ---- 8 A · El h1 en el celular de 390 ---- */
async function probarPortadaEnElCelular(){
  const f = document.createElement('iframe');
  f.style.cssText = 'width:390px;height:844px;border:0;position:absolute;left:-9999px;top:0';
  f.src = 'index.html';
  document.body.appendChild(f);
  try{
    const listo = await d21EsperarA(() => f.contentWindow.eval('MODELOS.length && FUENTE') && f.contentDocument.querySelector('header h1'), 60000);
    let estado = '';
    try{ estado = f.contentWindow.location.href + ' · ' + f.contentDocument.title + ' · ' + f.contentDocument.scripts.length + ' scripts · ' + f.contentDocument.readyState + ' · ' + f.contentWindow.eval('typeof MODELOS === "undefined" ? "sin MODELOS" : MODELOS.length + " modelos · fuente " + (FUENTE && FUENTE.fuente)'); }catch(e){ estado = String(e && e.message || e); }
    ok(listo, '[8 A] la portada abre en 390 px', estado);
    if(!listo) return;
    const doc = f.contentDocument, w = f.contentWindow;
    await d21Dormir(900);      // la entrada del encabezado (subir, .6 s)
    const h1 = doc.querySelector('header h1'), tit = doc.querySelector('header .titulo-h');
    const r = h1.getBoundingClientRect(), rt = tit.getBoundingClientRect();
    const alto = parseFloat(w.getComputedStyle(h1).lineHeight) || 15;
    ok(r.left >= 15 && r.right <= 390 - 15, '[8 A · 390] el h1 entra en el ancho, con su margen', Math.round(r.left) + '..' + Math.round(r.right));
    ok(r.height <= alto * 2 + 2, '[8 A · 390] en dos renglones como mucho', Math.round(r.height) + ' px · renglon ' + alto);
    ok(rt.top >= r.bottom, '[8 A · 390] y el titulo grande va abajo, sin pisarlo', Math.round(r.bottom) + ' / ' + Math.round(rt.top));
    ok(doc.documentElement.scrollWidth <= 390, '[8 A · 390] la portada no se corre de costado', doc.documentElement.scrollWidth);
  } finally { f.remove(); }
}

/* ---- 2 · Sin renglon de garantia cuando ADVAPP la manda vacia ---- */
async function probarSinGarantia(){
  const real = await (await fetch(ADVAPP_URL, { cache: 'no-store' })).json();
  const vacias = (real.productos || []).filter(p => 'Garantía' in p && !String(p['Garantía'] || '').trim());
  info('[2] hoy ADVAPP manda ' + vacias.length + ' fila(s) con la garantia vacia' + (vacias.length ? ': ' + vacias.map(p => p.ID).slice(0, 12).join(', ') : ''));
  const viaFetch = async (cuerpo) => {
    const antes = window.fetch;
    window.fetch = (u, o) => String(u).startsWith(ADVAPP_URL) ? Promise.resolve(new Response(JSON.stringify(cuerpo), { status: 200 })) : antes(u, o);
    try{ return armarCarga(await bajarAdvapp()).productos; } finally { window.fetch = antes; }
  };
  const OFICIAL = 'Garantía oficial del fabricante';
  const con = JSON.parse(JSON.stringify(real));
  con.productos.forEach(p => { p['Garantía'] = OFICIAL; });
  con.productos[0]['Garantía'] = '';
  const ps = await viaFetch(con);
  const p0 = ps.find(p => p.id === String(con.productos[0].ID));
  const p1 = ps.find(p => p.id === String(con.productos[1].ID));
  const gar = h => (h.match(/data-servicio="garantia"[\s\S]*?<\/li>/) || [''])[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  ok(!!p0 && p0.sinGarantia === true && !gar(htmlServicio(p0)), '[2] la fila que ADVAPP manda sin garantia no tiene renglon de garantia', p0 && (gar(htmlServicio(p0)) || 'sin renglon'));
  ok(!!p0 && /data-servicio="retiro"/.test(htmlServicio(p0)), '[2] y el retiro sigue');
  ok(!!p1 && !p1.sinGarantia && gar(htmlServicio(p1)).includes(OFICIAL), '[2] las demas dicen la suya', p1 && gar(htmlServicio(p1)));
  ok(ps.filter(p => p.sinGarantia).length === 1, '[2] y ninguna otra queda sin garantia', ps.filter(p => p.sinGarantia).map(p => p.id).slice(0, 5).join(', '));
  // Un usado con la garantia vacia es "el proveedor no la dijo": el texto de siempre, sin plazo
  const usado = { ...p0, condicion: 'Usado' };
  ok(!!p0 && SERVICIO.garantia && gar(htmlServicio(usado)).includes(SERVICIO.garantia[1]),
     '[2] en un usado, vacia no la saca: el texto de siempre', gar(htmlServicio(usado)));
  // Sin la columna (un ADVAPP viejo o una copia de antes del 13/10): lo de siempre
  const sinCol = JSON.parse(JSON.stringify(real));
  sinCol.productos.forEach(p => { delete p['Garantía']; });
  if(Array.isArray(sinCol.columnas)) sinCol.columnas = sinCol.columnas.filter(c => norm(c) !== 'garantia');
  const ps2 = await viaFetch(sinCol);
  const q0 = ps2.find(p => p.id === String(sinCol.productos[0].ID));
  ok(!!q0 && !q0.sinGarantia && SERVICIO.garantia && gar(htmlServicio(q0)).includes(SERVICIO.garantia[1]),
     '[2] sin la columna, la ficha dice lo de siempre', q0 && gar(htmlServicio(q0)));
  // En la ficha de verdad
  const v = PRODUCTOS.find(p => p.stock && buscarModelo(clave(p)));
  const antes = { garantia: v.garantia, sinGarantia: v.sinGarantia };
  try{
    v.garantia = ''; v.sinGarantia = true;
    abrirFicha(clave(v), null);
    const d = document.getElementById('ficha');
    ok(!!d && !d.querySelector('[data-servicio="garantia"]') && !/Con garant[ií]a|tiene la suya/.test(d21Txt(d.querySelector('.fi-servicio'))),
       '[2] la ficha abierta no menciona garantia', d21Txt(d && d.querySelector('.fi-servicio')));
    quitarFicha();
  } finally { Object.assign(v, antes); }
  abrirFicha(clave(v), null);
  ok(!!document.querySelector('#ficha [data-servicio="garantia"]'), '[2] y con su garantia, el renglon vuelve');
  quitarFicha();
}
