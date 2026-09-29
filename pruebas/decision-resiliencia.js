// Decisiones 1.1 a 1.6 de Pedro (29/09/2026): cuando ADVAPP falla.
// Muestra: muestras/auditoria/resiliencia.html. Pedro eligio la recomendada
// en las seis: 1B 2B 3A 4C 5A 6B.
//   1.1 B  la copia de la ultima respuesta buena de ADVAPP, con sello ambar
//          "Precios de las 01:52" y la franja con Reintentar
//   1.2 B  la copia vale 6 horas; despues, lo de la 3
//   1.3 A  sin copia, el aviso de no disponible (nunca mas la planilla)
//   1.4 C  el aviso corto, con Reintentar, WhatsApp y reintentos solos a los
//          5, 15 y 30 s y apenas vuelve la señal
//   1.5 A  el total del pedido y el mensaje dicen de que hora son los precios
//   1.6 B  al entrar, la copia al instante si lo nuevo tarda mas de 1 s, sin
//          pesos hasta que llegue el dolar
//
// Las caidas se simulan cambiando fetch solo para la URL que hace falta
// (ADVAPP, dolarapi, Google); lo demas pasa de largo. La copia vive en
// localStorage: se guarda la de la pagina al empezar y se devuelve al final.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);

const esperaRS = setInterval(() => {
  if(!MODELOS.length || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperaRS);
  for(let i=1;i<5000;i++) clearInterval(i);
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; })
    .finally(() => {
      try{ frenarReintentos(); }catch(e){}
      try{ pararPaseos(); }catch(e){}
      try{ pararOfertas(); }catch(e){}
      try{ pararMundos(); }catch(e){}
      for(let i=1;i<5000;i++) clearInterval(i);
      const pre=document.createElement('pre'); pre.id='RESULTADO';
      pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
      document.body.appendChild(pre);
    });
}, 150);

/* fetch cambiado mientras dura `hacer`. `cambiar(url, opts, fetchDeVerdad)` */
async function rsFetch(cambiar, hacer){
  const antes = window.fetch;
  window.fetch = (url, opts) => cambiar(String(url), opts || {}, antes);
  try{ return await hacer(); } finally { window.fetch = antes; }
}
const rsError   = () => Promise.resolve(new Response('fallo', { status: 500 }));
const rsCae     = () => Promise.reject(new TypeError('Failed to fetch'));
const rsDormir  = ms => new Promise(r => setTimeout(r, ms));
const rsTarde   = (ms, f, u, o) => new Promise((si, no) => setTimeout(() => f(u, o).then(si, no), ms));
const rsNunca   = o => new Promise((_, no) => o && o.signal && o.signal.addEventListener('abort',
  () => no(Object.assign(new Error('abortado'), { name: 'AbortError' }))));
const rsEsAdvapp = u => u.startsWith(ADVAPP_URL);
const rsEsDolar  = u => /dolarapi\.com/.test(u);
const rsEsGoogle = u => /docs\.google\.com/.test(u);
const rsEsPlanilla = u => FUENTES.some(f => u.startsWith(f));
const rsSello  = () => document.getElementById('stamp').textContent.trim();
const rsPunto  = () => document.querySelector('.stamp .dot');
const rsAmbar  = () => { const d = rsPunto(); return !!d && !d.classList.contains('live') && getComputedStyle(d).backgroundColor === 'rgb(201, 162, 39)'; };
const rsGris   = () => { const d = rsPunto(); return !!d && !d.classList.contains('live') && getComputedStyle(d).backgroundColor === 'rgb(90, 98, 115)'; };
const rsFranja = () => !document.getElementById('franja').hidden;
const rsFranjaTxt = () => document.getElementById('franja-txt').textContent.replace(/\s+/g, ' ').trim();
const rsAviso  = () => grid.querySelector('.msg.sin-catalogo');
const rsHH     = /^\d{2}:\d{2}$/;
// Algun precio a la vista (tarjetas, vidriera, rubros)
const rsPreciosALaVista = () => [...document.querySelectorAll('.card .usd, #of-pista .of-precio, #mosaico .usd, #extras .usd')]
  .filter(e => e.offsetParent !== null).length;
const rsPesos = () => [...document.querySelectorAll('#of-pista .of-precio i, .card .ars')].filter(e => e.textContent.trim()).length;

/* La copia de la pagina: se guarda al empezar y se devuelve al final */
const rsCopia = () => [localStorage.getItem(COPIA_KEY), localStorage.getItem(COPIA_HORA_KEY)];
const rsDevolver = ([c, h]) => {
  if(c === null) localStorage.removeItem(COPIA_KEY); else localStorage.setItem(COPIA_KEY, c);
  if(h === null) localStorage.removeItem(COPIA_HORA_KEY); else localStorage.setItem(COPIA_HORA_KEY, h);
};
// La copia de la pagina con otra hora
const rsCopiaDeHace = (ms, base) => {
  const c = JSON.parse(base[0]);
  c.hora = Date.now() - ms;
  localStorage.setItem(COPIA_KEY, JSON.stringify(c));
  localStorage.setItem(COPIA_HORA_KEY, String(c.hora));
  return c.hora;
};

async function correrPruebas(){
  ok(FUENTE && FUENTE.fuente === 'advapp', 'la pagina cargo desde ADVAPP (lo demas lo da por hecho)', FUENTE && FUENTE.fuente);
  const base = rsCopia();
  const pedido0 = localStorage.getItem(PEDIDO_KEY), PEDIDO0 = JSON.stringify(PEDIDO);
  try{
    await laCopia(base);
    await copiaConFranja(base);
    await seisHoras(base);
    await sinCopia(base);
    await elAviso(base);
    await elPedido(base);
    await alInstante(base);
    await loQueQuedoEscrito();
  }finally{
    rsDevolver(base);
    PEDIDO = JSON.parse(PEDIDO0);
    if(pedido0 === null) localStorage.removeItem(PEDIDO_KEY); else localStorage.setItem(PEDIDO_KEY, pedido0);
    try{ frenarReintentos(); }catch(e){}
    await actualizar(false);
    pintarPedido();
  }
}

/* ---- La copia: que se guarda, donde y con que ---- */
async function laCopia(base){
  let c = null;
  try{ c = JSON.parse(base[0]); }catch(e){}
  ok(!!c && Array.isArray(c.filas) && c.filas.length - 1 >= PRODUCTOS.length && Number(base[1]) === c.hora,
     '[1.1] la ultima carga de ADVAPP queda guardada como copia en este navegador, con su hora',
     c ? (c.filas.length - 1) + ' filas de las ' + hhmm(c.hora) : 'sin copia');
  ok(!!c && Object.keys(c).sort().join(',') === 'filas,hora,indice' && !/cotiz|"tc"/i.test(Object.keys(c).join(',')),
     '[1.6] la copia lleva filas, indice de fotos y hora, y no la cotizacion (los pesos son siempre del dolar de ahora)',
     c ? Object.keys(c).join(', ') : '');
  ok(!!c && c.indice && Array.isArray(c.indice.archivos) && c.indice.archivos.length === INDICE_FOTOS.size,
     '[1.6] con el indice de fotos de ese momento', c && c.indice ? c.indice.archivos.length + ' archivos' : 'sin indice');
  ok(hhmm(new Date(2026, 8, 29, 1, 52).getTime()) === '01:52' && hhmm(new Date(2026, 8, 29, 13, 5).getTime()) === '13:05',
     '[1.1] la hora va en 24 h, sin "a. m." ("01:52", "13:05")', hhmm(new Date(2026, 8, 29, 13, 5).getTime()));
}

/* ---- 1.1 B: la copia con sello ambar y franja ---- */
async function copiaConFranja(base){
  const hora = rsCopiaDeHace(2 * 3600 * 1000, base);
  let aPlanilla = 0;
  await rsFetch((u, o, f) => rsEsAdvapp(u) ? rsError() : (rsEsPlanilla(u) && aPlanilla++, f(u, o)), () => actualizar(false));
  const h = hhmm(hora);
  ok(FUENTE.fuente === 'copia' && FUENTE.hora === hora && HORA_DATOS === hora && aPlanilla === 0,
     '[1.1] con ADVAPP en 500 se ve la copia, con su hora, sin pedirle la planilla a Google',
     FUENTE.fuente + ' · ' + hhmm(FUENTE.hora || 0) + ' · ' + aPlanilla + ' pedidos a la planilla');
  ok(rsSello() === 'Precios de las ' + h && rsAmbar(), '[1.1] el sello dice "Precios de las ' + h + '", ambar y sin latir',
     rsSello() + (rsAmbar() ? '' : ' (no ambar)'));
  ok(rsSello() !== 'Actualizado hoy', '[1.1] nunca "Actualizado hoy" con la copia', rsSello());
  ok(rsFranja() && rsFranjaTxt() === 'Estás viendo los precios de las ' + h + '. No pudimos actualizarlos.'
     && document.querySelector('#franja-txt b') && document.querySelector('#franja-txt b').textContent === h,
     '[1.1] la franja dice «Estás viendo los precios de las ' + h + '. No pudimos actualizarlos.» con la hora en negrita', rsFranjaTxt());
  const fr = document.getElementById('franja');
  const topbar = document.querySelector('.topbar'), header = document.querySelector('header');
  ok(topbar.nextElementSibling === fr && fr.nextElementSibling === header,
     '[1.1] la franja va pegada abajo de la barra de arriba, antes del encabezado');
  ok(Math.abs(fr.getBoundingClientRect().width - document.documentElement.clientWidth) < 1
     && getComputedStyle(fr).backgroundColor === 'rgb(253, 244, 216)',
     '[1.1] a todo el ancho y en el ambar de la muestra (#FDF4D8)',
     Math.round(fr.getBoundingClientRect().width) + ' px · ' + getComputedStyle(fr).backgroundColor);
  const b = document.getElementById('franja-reint');
  ok(!!b && /Reintentar/.test(b.textContent) && b.tagName === 'BUTTON', '[1.1] con el boton Reintentar');
  ok(/Respaldo: la copia de las \d{2}:\d{2} guardada en este navegador \(ADVAPP: HTTP 500\)/.test(document.getElementById('stamp').title),
     '[1.1] pasando el mouse, el sello dice que es la copia y por que (para el equipo)', document.getElementById('stamp').title);
  // En el celular el boton baja a su renglon, alineado con el texto (regla de la muestra)
  let reglaCel = false;
  for(const h of document.styleSheets){
    let reglas = [];
    try{ reglas = [...h.cssRules]; }catch(e){}
    for(const r of reglas) if(r.media && /max-width:\s*560px/.test(r.media.mediaText))
      for(const x of r.cssRules) if(/\.franja \.b-reint/.test(x.selectorText || '') && x.style.marginLeft === '17px') reglaCel = true;
  }
  ok(reglaCel, '[1.1] en el celular (560 px o menos) el boton baja a su renglon, corrido como en la muestra');
  // La copia no se vuelve a guardar a si misma: su hora no cambia
  ok(Number(localStorage.getItem(COPIA_HORA_KEY)) === hora, '[1.1] mostrar la copia no la guarda de nuevo con otra hora');

  // Reintentar con ADVAPP de vuelta: lo nuevo, y la franja se va
  b.click();
  await rsDormir(50);
  for(let i = 0; i < 100 && FUENTE.fuente !== 'advapp'; i++) await rsDormir(100);
  ok(FUENTE.fuente === 'advapp' && !rsFranja() && !/^Precios de las/.test(rsSello()),
     '[1.1] Reintentar trae lo nuevo de ADVAPP y la franja se va', FUENTE.fuente + ' · ' + rsSello());
  ok(Date.now() - Number(localStorage.getItem(COPIA_HORA_KEY)) < 60000,
     '[1.1] y lo nuevo pasa a ser la copia', hhmm(Number(localStorage.getItem(COPIA_HORA_KEY))));
}

/* ---- 1.2 B: la copia vale 6 horas ---- */
async function seisHoras(base){
  ok(COPIA_VIGENCIA_MS === 6 * 60 * 60 * 1000, '[1.2] la copia vale 6 horas (COPIA_VIGENCIA_MS, en la configuracion)', COPIA_VIGENCIA_MS);
  const hora = 3600 * 1000, min = 60 * 1000;
  ok(copiaVigente(Date.now() - (6 * hora - min)) && !copiaVigente(Date.now() - (6 * hora + min)),
     '[1.2] una copia de 5:59 h vale y una de 6:01 h no');
  ok(!copiaVigente(Date.now() + 5 * min) && !copiaVigente(0) && !copiaVigente(NaN),
     '[1.2] una copia con la hora en el futuro (reloj cambiado) o sin hora no vale');

  rsCopiaDeHace(6 * hora + min, base);
  ok(leerCopia() === null && horaDeLaCopia() === 0, '[1.2] leerCopia no devuelve una copia de hace 6:01 h');
  let fallo = '';
  try{ await rsFetch((u, o, f) => rsEsAdvapp(u) ? rsError() : f(u, o), bajarDatos); }catch(e){ fallo = e.message; }
  ok(/sin copia/.test(fallo), '[1.2] con la copia vencida, ADVAPP caido no tiene respaldo: pasa lo de la 3', fallo || 'no fallo');

  /* Una pestaña abierta que pasa las 6 horas sin poder actualizarse: los
     precios que tiene son igual de viejos, asi que queda como la copia
     vencida (el aviso, sin precios). El pedido guarda sus lineas. */
  const k = clave(PRODUCTOS.find(p => p.stock) || PRODUCTOS[0]);
  if(!enPedido(k)) PEDIDO.push({ k, n: 1, color: '' });
  guardarPedido(); pintarPedido();
  const lineas = PEDIDO.length;
  HORA_DATOS = Date.now() - (6 * hora + min);
  await rsFetch((u, o, f) => rsEsAdvapp(u) ? rsError() : f(u, o), () => actualizar(false));
  let enLs = -1;
  try{ enLs = JSON.parse(localStorage.getItem(PEDIDO_KEY)).length; }catch(e){}
  ok(!!rsAviso() && rsPreciosALaVista() === 0 && document.body.classList.contains('sin-catalogo')
     && document.getElementById('barra-pedido').hidden && !FICHA,
     '[1.2] con la pestaña abierta, pasadas las 6 horas sin actualizar sale el aviso y no queda ningun precio a la vista',
     (rsAviso() ? 'aviso' : 'sin aviso') + ' · ' + rsPreciosALaVista() + ' precios · barra ' + (document.getElementById('barra-pedido').hidden ? 'oculta' : 'visible'));
  ok(PEDIDO.length === lineas && enLs === lineas, '[1.2] el pedido conserva sus lineas para cuando vuelva ADVAPP',
     PEDIDO.length + ' de ' + lineas + ' · guardadas ' + enLs);
  frenarReintentos();
  await actualizar(false);
  ok(!rsAviso() && MODELOS.length > 0 && !document.body.classList.contains('sin-catalogo') && FUENTE.fuente === 'advapp'
     && !document.getElementById('barra-pedido').hidden,
     '[1.2] con ADVAPP de vuelta se dibuja todo de nuevo, con el pedido', MODELOS.length + ' modelos · ' + FUENTE.fuente);
}

/* ---- 1.3 A: sin copia, nunca la planilla ---- */
async function sinCopia(base){
  const casos = [
    ['ADVAPP en 500', () => rsError()],
    ['sin conexion', () => rsCae()],
    ['sin JSON', () => Promise.resolve(new Response('<html>no</html>', { status: 200 }))],
    ['sin productos', () => Promise.resolve(new Response(JSON.stringify({ contrato: 'landing/1.3', filas: 0, productos: [] }), { status: 200 }))],
  ];
  borrarCopia();
  try{
    for(const [texto, responder] of casos){
      let aGoogle = 0, fallo = '';
      try{
        await rsFetch((u, o, f) => rsEsAdvapp(u) ? responder() : (rsEsPlanilla(u) && aGoogle++, f(u, o)), bajarDatos);
      }catch(e){ fallo = e.message; }
      ok(/^ADVAPP: .* · sin copia/.test(fallo) && aGoogle === 0,
         '[1.3] sin copia y ' + texto + ', no se cae a la planilla del 16/09: da error y no le pide nada a Google',
         (fallo || 'no dio error') + ' · ' + aGoogle + ' pedidos a la planilla');
    }
    // Y la pantalla: el aviso, sin ningun precio
    HORA_DATOS = 0; ULTIMA_OK = 0;
    let aPlanilla = 0;
    await rsFetch((u, o, f) => rsEsAdvapp(u) ? rsError() : (rsEsPlanilla(u) && aPlanilla++, f(u, o)), () => actualizar(false));
    ok(!!rsAviso() && rsPreciosALaVista() === 0 && aPlanilla === 0 && PRODUCTOS.length === 0,
       '[1.3] sin copia, el cliente ve el aviso de no disponible, sin precios', (rsAviso() ? 'aviso' : 'sin aviso') + ' · ' + rsPreciosALaVista() + ' precios');
    ok(/ADVAPP: HTTP 500/.test(ULTIMO_FALLO), '[1.3] el motivo queda para la medicion (ULTIMO_FALLO)', ULTIMO_FALLO);
  }finally{
    frenarReintentos();
    rsDevolver(base);
    await actualizar(false);
  }
}

/* ---- 1.4 C: el aviso corto que prueba solo ---- */
async function elAviso(base){
  borrarCopia();
  const llamadas = [];
  let advappVuelve = false;
  const cambio = (u, o, f) => {
    if(rsEsAdvapp(u)){ llamadas.push(Date.now()); return advappVuelve ? f(u, o) : rsError(); }
    return f(u, o);
  };
  const real = window.fetch;
  window.fetch = (url, opts) => cambio(String(url), opts || {}, real);
  try{
    HORA_DATOS = 0; ULTIMA_OK = 0;
    const t0 = Date.now();
    llamadas.length = 0;
    await actualizar(false);
    const m = rsAviso();
    ok(!!m && m.querySelector('h2') && m.querySelector('h2').textContent.trim() === 'No pudimos cargar el catálogo',
       '[1.4] el aviso dice «No pudimos cargar el catálogo»', m ? m.querySelector('h2').textContent : 'sin aviso');
    ok(!!m && !/planilla|Compartir|Drive|Sheet|Failed|HTTP/i.test(m.textContent) && !m.querySelector('code, ol'),
       '[1.4] sin los pasos de Google Drive ni el error crudo', m ? m.textContent.replace(/\s+/g, ' ').trim().slice(0, 140) : '');
    const linea = () => (rsAviso() && rsAviso().querySelector('.aviso-linea') || {}).textContent || '';
    ok(linea() === 'Probá de nuevo en un momento, o escribinos por WhatsApp.' && rsSello() === 'No disponible' && rsGris(),
       '[1.4] con señal: «Probá de nuevo en un momento, o escribinos por WhatsApp.» y el sello gris «No disponible»',
       linea() + ' · ' + rsSello());
    const bR = document.getElementById('aviso-reint'), bW = document.getElementById('aviso-wa');
    ok(!!bR && bR.tagName === 'BUTTON' && /Reintentar/.test(bR.textContent), '[1.4] con el boton Reintentar');
    ok(!!bW && /Escribinos por WhatsApp/.test(bW.textContent) && bW.getAttribute('href') === document.getElementById('wa-flotante').getAttribute('href'),
       '[1.4] y «Escribinos por WhatsApp», con el numero y el saludo del boton flotante', bW && bW.getAttribute('href'));
    const solo = () => { const s = document.getElementById('aviso-solo'); return s && !s.hidden ? s.textContent.replace(/\s+/g, ' ').trim() : ''; };
    ok(solo() === 'Probamos de nuevo solos en 5 s' && !!document.querySelector('#aviso-solo .giro'),
       '[1.4] con la linea «Probamos de nuevo solos en 5 s» y la ruedita', solo());
    ok(PRODUCTOS.length === 0 && rsPreciosALaVista() === 0, '[1.4] sin ningun precio a la vista');

    /* (29/09, revision) Con el aviso a la vista, buscar no lo tapa: decia
       "“iphone” no está en el catálogo" (falso: no cargo) y, al borrar, la
       grilla quedaba vacia sin aviso ni Reintentar */
    const q = document.getElementById('q');
    q.value = 'iphone'; q.dispatchEvent(new Event('input', { bubbles: true }));
    filtros.q = 'iphone'; aplicarFiltro(false);
    await rsDormir(400);
    const sug = document.getElementById('q-sug');
    ok(!!rsAviso() && !/no est[aá] en el cat[aá]logo/i.test(grid.textContent) && (sug.hidden || !/no est[aá] en el cat[aá]logo/i.test(sug.textContent)),
       '[1.3/1.4] escribiendo en el buscador sigue el aviso, sin «no está en el catálogo»',
       (rsAviso() ? 'aviso' : 'sin aviso') + ' · ' + grid.textContent.replace(/\s+/g, ' ').trim().slice(0, 60));
    q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true }));
    filtros.q = ''; aplicarFiltro(false);
    await rsDormir(300);
    ok(!!rsAviso() && !!document.getElementById('aviso-reint') && grid.children.length > 0,
       '[1.3/1.4] y al borrar la busqueda el aviso sigue, con Reintentar', grid.children.length + ' hijos en la grilla');
    ok(/^Probamos de nuevo solos en [1-5] s$/.test(solo()), '[1.4] con su cuenta del proximo intento', solo());

    // Sin señal, el aviso lo dice
    Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });
    try{
      dispatchEvent(new Event('offline'));
      ok(linea() === 'Revisá tu conexión y probá de nuevo.' && rsSello() === 'Sin conexión' && rsGris(),
         '[1.4] sin señal: «Revisá tu conexión y probá de nuevo.» y el sello «Sin conexión»', linea() + ' · ' + rsSello());
    }finally{ delete navigator.onLine; }
    dispatchEvent(new Event('offline'));     // vuelve a mirar: con señal otra vez
    ok(linea() === 'Probá de nuevo en un momento, o escribinos por WhatsApp.', '[1.4] y vuelve al de con señal', linea());

    // Los reintentos solos: a los 5, 15 y 30 s de cada falla, y para
    const antes = llamadas.length;
    const t1 = llamadas[antes - 1] || t0;
    await rsDormir(5500);
    const d1 = llamadas[antes] ? llamadas[antes] - t1 : -1;
    await rsDormir(10000);
    const cuenta15 = solo();
    await rsDormir(5500);
    const d2 = llamadas[antes + 1] ? llamadas[antes + 1] - llamadas[antes] : -1;
    await rsDormir(20000);
    const cuenta30 = solo();
    await rsDormir(10500);
    const d3 = llamadas[antes + 2] ? llamadas[antes + 2] - llamadas[antes + 1] : -1;
    const cerca = (x, s) => x >= s * 1000 - 50 && x <= s * 1000 + 600;
    ok(cerca(d1, 5) && cerca(d2, 15) && cerca(d3, 30),
       '[1.4] prueba solo a los 5, 15 y 30 s de cada falla', [d1, d2, d3].map(x => (x / 1000).toFixed(1) + ' s').join(' · '));
    ok(/^Probamos de nuevo solos en ([1-9]|1[0-5]) s$/.test(cuenta15) && /^Probamos de nuevo solos en ([1-9]|[12]\d|30) s$/.test(cuenta30),
       '[1.4] la linea cuenta hacia atras el que sigue', cuenta15 + ' · ' + cuenta30);
    const tras3 = llamadas.length;
    await rsDormir(12000);
    ok(llamadas.length === tras3 && tras3 === antes + 3 && solo() === '',
       '[1.4] despues del tercero para: no prueba mas y la linea se va', (llamadas.length - antes) + ' intentos · ' + (solo() || 'sin linea'));

    // Apenas vuelve la señal, prueba solo
    const n0 = llamadas.length;
    dispatchEvent(new Event('online'));
    await rsDormir(300);
    ok(llamadas.length === n0 + 1, '[1.4] apenas vuelve la señal (evento online) prueba solo', (llamadas.length - n0) + ' intento(s)');
    await rsDormir(300);

    // Reintentar a mano: mientras prueba se apaga, y con ADVAPP de vuelta trae el catalogo
    advappVuelve = true;
    const b = document.getElementById('aviso-reint');
    b.click();
    const apagado = b.getAttribute('aria-disabled') === 'true', probando = solo();
    ok(apagado && probando === 'Probando de nuevo…', '[1.4] al tocar Reintentar el boton se apaga y dice que esta probando',
       (apagado ? 'apagado' : 'prendido') + ' · ' + probando);
    for(let i = 0; i < 100 && (rsAviso() || !MODELOS.length); i++) await rsDormir(100);
    ok(!rsAviso() && MODELOS.length > 0 && FUENTE.fuente === 'advapp', '[1.4] y con ADVAPP de vuelta trae el catalogo',
       MODELOS.length + ' modelos');
    const n1 = llamadas.length;
    await rsDormir(6000);
    ok(llamadas.length === n1, '[1.4] y no quedan reintentos andando', (llamadas.length - n1) + ' pedidos de mas');
  }finally{
    window.fetch = real;
    frenarReintentos();
    rsDevolver(base);
  }
  // La ruedita respeta "reducir movimiento": su animacion vive adentro de no-preference
  let giroQuieto = false, giroSuelto = false;
  for(const h of document.styleSheets){
    let reglas = [];
    try{ reglas = [...h.cssRules]; }catch(e){}
    for(const r of reglas){
      if(r.selectorText === '.giro' && /animation/.test(r.cssText)) giroSuelto = true;
      if(r.media && /prefers-reduced-motion:\s*no-preference/.test(r.media.mediaText))
        for(const x of r.cssRules) if(x.selectorText === '.giro' && /giro/.test(x.style.animationName)) giroQuieto = true;
    }
  }
  ok(giroQuieto && !giroSuelto, '[1.4] la ruedita gira solo si el cliente no pidio "reducir movimiento"');
}

/* ---- 1.5 A: el total con la hora ---- */
async function elPedido(base){
  const dos = PRODUCTOS.filter(p => p.stock && p.precio !== null).slice(0, 2).map(p => clave(p));
  const PEDIDO_ANTES = JSON.stringify(PEDIDO);
  PEDIDO = dos.map(k => ({ k, n: 1, color: '' }));
  guardarPedido();
  const hora = rsCopiaDeHace(90 * 60 * 1000, base);
  const h = hhmm(hora);
  try{
    await rsFetch((u, o, f) => rsEsAdvapp(u) ? rsError() : f(u, o), () => actualizar(false));
    const av = document.getElementById('bp-aviso');
    ok(FUENTE.fuente === 'copia' && !!av && !av.hidden && av.textContent.trim() === 'Precios de las ' + h + ' · a confirmar'
       && document.getElementById('barra-pedido').classList.contains('con-aviso'),
       '[1.5] con la copia, la barra del pedido dice abajo del total «Precios de las ' + h + ' · a confirmar»',
       av ? av.textContent.trim() : 'sin aviso');
    ok(/^USD [\d.]+/.test(document.getElementById('bp-usd').textContent) && (!TC || /^\$ /.test(document.getElementById('bp-ars').textContent)),
       '[1.5] con el total en dolares y en pesos, como siempre', document.getElementById('bp-usd').textContent + ' · ' + document.getElementById('bp-ars').textContent);
    const msj = mensajePedido();
    const lineas = msj.split('\n');
    ok(lineas[lineas.length - 1] === 'Precios de las ' + h + ', a confirmar.' && /^Total: USD /.test(lineas[lineas.length - 2]),
       '[1.5] el mensaje termina con «Precios de las ' + h + ', a confirmar.» justo despues del total', lineas.slice(-2).join(' / '));
    ok(decodeURIComponent(document.getElementById('bp-enviar').href).includes('Precios de las ' + h + ', a confirmar.'),
       '[1.5] y es el que manda «Enviar pedido»');
    abrirPedido();
    const pri = document.querySelector('#pedido a.pri');
    ok(!!pri && decodeURIComponent(pri.href).includes('Precios de las ' + h + ', a confirmar.'),
       '[1.5] y el «Enviar por WhatsApp» de la ventana del pedido');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await rsDormir(50);
    // Con lo nuevo, la hora se va sola
    await actualizar(false);
    ok(FUENTE.fuente === 'advapp' && document.getElementById('bp-aviso').hidden && !/Precios de las/.test(mensajePedido())
       && !document.getElementById('barra-pedido').classList.contains('con-aviso'),
       '[1.5] con lo nuevo de ADVAPP, el total y el mensaje ya no llevan la hora', FUENTE.fuente);
  }finally{
    PEDIDO = JSON.parse(PEDIDO_ANTES);
    guardarPedido(); pintarPedido();
    rsDevolver(base);
  }
}

/* ---- 1.6 B: la copia al instante, solo si lo nuevo tarda mas de 1 s ----
   Se simula la entrada: la pantalla sin nada (vaciarCatalogo), sin
   cotizacion (al entrar no hay ninguna) y actualizar(true). */
async function alInstante(base){
  ok(COPIA_ESPERA_MS === 1000, '[1.6] la copia se muestra si lo nuevo tarda mas de 1 s (COPIA_ESPERA_MS)', COPIA_ESPERA_MS);
  const entrar = () => { vaciarCatalogo(); FUENTE = null; TC = null; TC_BUENA = null; ULTIMA_OK = 0; };
  const sellos = [];
  const obs = new MutationObserver(() => sellos.push(rsSello()));
  obs.observe(document.getElementById('stamp'), { childList: true, characterData: true, subtree: true });
  try{
    // a) Lo nuevo llega antes del segundo: la copia no se muestra (no titila)
    const hora = rsCopiaDeHace(40 * 60 * 1000, base);
    const h = hhmm(hora);
    entrar();
    sellos.length = 0;
    await rsFetch((u, o, f) => rsEsAdvapp(u) ? rsTarde(300, f, u, o) : f(u, o), () => actualizar(true));
    await rsDormir(1500);
    ok(FUENTE.fuente === 'advapp' && !sellos.some(s => /actualizando/.test(s)),
       '[1.6] si lo nuevo llega antes de 1 s, la copia no se muestra', FUENTE.fuente + ' · ' + (sellos.join(' → ') || 'sin cambios'));

    // a2) ADVAPP llega enseguida y solo tarda el dolar: no se muestran precios mas viejos que los que ya llegaron
    rsCopiaDeHace(40 * 60 * 1000, base);
    entrar();
    sellos.length = 0;
    await rsFetch((u, o, f) => rsEsAdvapp(u) ? rsTarde(200, f, u, o) : rsEsDolar(u) ? rsTarde(2500, f, u, o) : f(u, o), () => actualizar(true));
    ok(FUENTE.fuente === 'advapp' && !sellos.some(s => /actualizando/.test(s)),
       '[1.6] si lo nuevo de ADVAPP ya llego y solo falta el dolar, no se muestra la copia (seria mas vieja)',
       FUENTE.fuente + ' · ' + (sellos.join(' → ') || 'sin cambios'));

    // b) ADVAPP tarda 4 s y el dolar 2,5 s
    rsCopiaDeHace(40 * 60 * 1000, base);
    const h2 = hhmm(Number(localStorage.getItem(COPIA_HORA_KEY)));
    entrar();
    const vista = {};
    await rsFetch((u, o, f) => rsEsAdvapp(u) ? rsTarde(4000, f, u, o) : rsEsDolar(u) ? rsTarde(2500, f, u, o) : f(u, o), async () => {
      const p = actualizar(true);
      await rsDormir(900);
      vista.antes = { sk: grid.querySelectorAll('.skeleton').length, fuente: FUENTE && FUENTE.fuente, modelos: MODELOS.length };
      await rsDormir(400);
      vista.copia = { fuente: FUENTE && FUENTE.fuente, sello: rsSello(), ambar: rsAmbar(), franja: rsFranja(),
                      modelos: MODELOS.length, TC, pesos: rsPesos(), precios: rsPreciosALaVista() };
      await rsDormir(1700);
      vista.dolar = { fuente: FUENTE && FUENTE.fuente, TC, pesos: rsPesos(), sello: rsSello() };
      await p;
      vista.nuevo = { fuente: FUENTE && FUENTE.fuente, sello: rsSello(), franja: rsFranja(), modelos: MODELOS.length };
    });
    ok(vista.antes.fuente !== 'copia' && vista.antes.modelos === 0 && vista.antes.sk > 0,
       '[1.6] antes del segundo siguen los esqueletos', JSON.stringify(vista.antes));
    ok(vista.copia.fuente === 'copia' && vista.copia.modelos > 0 && vista.copia.precios > 0
       && vista.copia.sello === 'Precios de las ' + h2 + ' · actualizando…' && vista.copia.ambar && !vista.copia.franja,
       '[1.6] pasado el segundo, la copia con el sello ambar «Precios de las ' + h2 + ' · actualizando…» y sin franja',
       vista.copia.sello + ' · ' + vista.copia.modelos + ' modelos · franja ' + vista.copia.franja);
    ok(vista.copia.TC === null && vista.copia.pesos === 0, '[1.6] sin pesos: no hay cotizacion guardada',
       'TC ' + vista.copia.TC + ' · ' + vista.copia.pesos + ' precios en pesos');
    ok(vista.dolar.fuente === 'copia' && vista.dolar.TC > 0 && vista.dolar.pesos > 0 && /actualizando/.test(vista.dolar.sello),
       '[1.6] los pesos aparecen apenas llega el dolar, aunque ADVAPP siga sin contestar',
       vista.dolar.fuente + ' · TC ' + vista.dolar.TC + ' · ' + vista.dolar.pesos + ' en pesos');
    ok(vista.nuevo.fuente === 'advapp' && !/^Precios de las/.test(vista.nuevo.sello) && !vista.nuevo.franja && vista.nuevo.modelos > 0,
       '[1.6] cuando llega lo nuevo reemplaza a la copia solo', vista.nuevo.fuente + ' · ' + vista.nuevo.sello);

    // c) ADVAPP no contesta nunca: queda la copia y ahi si la franja
    rsCopiaDeHace(40 * 60 * 1000, base);
    const h3 = hhmm(Number(localStorage.getItem(COPIA_HORA_KEY)));
    entrar();
    await rsFetch((u, o, f) => rsEsAdvapp(u) ? rsNunca(o) : f(u, o), () => actualizar(true));
    ok(FUENTE.fuente === 'copia' && rsSello() === 'Precios de las ' + h3 && rsFranja() && MODELOS.length > 0,
       '[1.6] si ADVAPP termina sin contestar, queda la copia con su franja', FUENTE.fuente + ' · ' + rsSello() + ' · franja ' + rsFranja());
  }finally{
    obs.disconnect();
    rsDevolver(base);
    await actualizar(false);
  }
}

/* ---- (29/09, revision) Lo que quedo escrito de antes de la 1.3 A ----
   El CSS del error viejo (los pasos de Google Drive en <ol> y el error crudo
   en <code>) ya no lo usa nadie, y los comentarios que decian que la
   planilla es el respaldo o que la copia pesa 900 KB confunden al que toca
   esto despues. */
async function loQueQuedoEscrito(){
  let muertas = [];
  for(const h of document.styleSheets){
    let reglas = [];
    try{ reglas = [...h.cssRules]; }catch(e){}
    for(const r of reglas) if(r.selectorText && /\.msg (code|ol)\b/.test(r.selectorText)) muertas.push(r.selectorText);
  }
  ok(!muertas.length, '[1.3] sin el CSS del error viejo (.msg code, .msg ol)', muertas.join(', ') || 'no esta');
  const leer = async r => { try{ const x = await fetch(r + '?_=' + Date.now(), { cache: 'no-store' }); return x.ok ? await x.text() : ''; }catch(e){ return ''; } };
  const idx = await leer('index.html'), corr = await leer('pruebas/correr.py');
  ok(!!idx && !/sigue con la planilla/.test(idx) && !/900 KB/.test(idx),
     '[1.3] index.html ya no dice que ADVAPP caido "sigue con la planilla" ni que la copia pesa "900 KB"');
  const doc = (/^[\s\S]*?"""([\s\S]*?)"""/.exec(corr) || ['', ''])[1];
  ok(!!doc && !/planilla de Google[\s\S]{0,120}solo si ADVAPP falla/.test(doc) && /copia/.test(doc),
     '[1.3] el docstring de pruebas/correr.py dice la copia o el aviso, no la planilla', doc.replace(/\s+/g, ' ').slice(0, 90));
}
