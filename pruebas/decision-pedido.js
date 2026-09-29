// Decisiones 5.1 a 5.4 de Pedro (29/09/2026): el pedido.
// Muestra: muestras/auditoria/pedido.html. Pedro eligio la recomendada en las
// cuatro (1B 2B 3A 4B). La 3 primero quedo como hoy (la consigna lo decia asi)
// y despues Pedro confirmo la A de la muestra: retiro o envio.
//   5.1 B  la foto y el nombre de cada linea del pedido se tocan y abren la
//          ficha en la version y el color de esa linea; el renglon "Cambiar
//          version o color ›" va solo en las lineas que tienen algo para
//          cambiar (otra fila del modelo con stock, o mas de un color). Primero
//          se cierra el pedido y despues se abre la ficha: nunca dos ventanas.
//          Al cerrar la ficha se queda en la pagina, sin entrada del pedido
//          en el historial.
//   5.2 B  la ficha avisa "Ya tenes en el pedido: 512GB E-Sim · Orange ×1"
//          cuando la version que se mira no esta y otra del modelo si; el
//          boton pasa a "Agregar tambien" y, con UNA version cargada, se suma
//          "Cambiar por esta": reemplaza la linea en su lugar, con las mismas
//          unidades y el color de la version nueva (nunca el de la otra)
//   5.3 A  en "Tu pedido", entre el total y "Enviar", el recuadro "¿Como lo
//          recibis? opcional" con dos botones, "Retiro en CABA" / "Envio" (y
//          la ayuda de SERVICIO debajo); si elige envio, el campo "Localidad".
//          El mensaje suma un renglon al final: "Lo retiro en CABA." o "Me lo
//          mandan a Rosario?" ("Me lo mandan?" sin localidad). Sin elegir
//          nada sale igual que hoy. Nada de forma de pago (eso era la B).
//          Queda guardado en el navegador; "Vaciar" no lo borra, asi que
//          "Deshacer" lo encuentra igual. La medicion anota solo "retiro" o
//          "envio" en el evento whatsapp del pedido, nunca la localidad.
//   5.4 B  "Vaciar el pedido" es un link chico abajo, aparte; "Enviar por
//          WhatsApp" queda solo y a todo el ancho. Vaciar vacia de una y deja
//          "Vaciaste el pedido. [Deshacer]" mientras la ventana siga abierta,
//          sin temporizador y sin el cartel del navegador; Deshacer devuelve
//          los mismos productos, colores, unidades y orden
// El celular se mira en un iframe de 390 x 664 (el headless no baja de 500).
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);

const esperaDP = setInterval(() => {
  if(!MODELOS.length || !FUENTE || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperaDP);
  for(let i=1;i<5000;i++) clearInterval(i);
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; })
    .finally(() => {
      try{ dpCerrarTodo(); }catch(e){}
      try{ pararPaseos(); pararOfertas(); pararMundos(); }catch(e){}
      for(let i=1;i<5000;i++) clearInterval(i);
      const pre=document.createElement('pre'); pre.id='RESULTADO';
      pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
      document.body.appendChild(pre);
    });
}, 150);

const dpDormir = ms => new Promise(r => setTimeout(r, ms));
async function dpEsperarA(cond, ms = 25000){
  const t0 = Date.now();
  while(Date.now() - t0 < ms){
    try{ if(cond()) return true; }catch(e){}
    await dpDormir(150);
  }
  return false;
}
/* Esperar a que se asiente lo que se mide, con tope, y no un tiempo fijo
   (29/09). Las ventanas entran con una animacion (cajaIn: .3 s con
   scale(.97)) y, con la suite entera corriendo a la vez, un tiempo fijo a
   veces no alcanzaba: getBoundingClientRect medía la ventana a medio entrar
   (en decision-tarjeta, el pie de 114 px daba 111 = 114 x .97 y [2.7]
   fallaba de a ratos). dpQuieto espera, cuadro a cuadro, a que no quede
   ninguna animacion o transicion con final andando adentro de `raiz`; si al
   tope siguen, las termina (finish) para medir el estado final. dpHasta
   espera una condicion cuadro a cuadro (lo que depende de un ResizeObserver
   o de un repintado cambia recien en un cuadro). */
const dpCuadro = (w = window) => new Promise(r => {
  let ya = false; const fin = () => { if(!ya){ ya = true; r(); } };
  try{ w.requestAnimationFrame(fin); }catch(e){}
  setTimeout(fin, 50);                     // por si ese documento no dibuja
});
async function dpQuieto(raiz, ms = 3000){
  if(!raiz) return true;
  const w = (raiz.ownerDocument && raiz.ownerDocument.defaultView) || window;
  const andando = () => {
    let as = [];
    try{ as = raiz.getAnimations({ subtree: true }); }catch(e){}
    return as.filter(a => { try{ return a.playState === 'running' && isFinite(a.effect.getComputedTiming().endTime); }catch(e){ return false; } });
  };
  const t0 = Date.now();
  while(Date.now() - t0 < ms){
    if(!andando().length) return true;
    await dpCuadro(w);
  }
  andando().forEach(a => { try{ a.finish(); }catch(e){} });
  await dpCuadro(w);
  return false;
}
async function dpHasta(cond, w = window, ms = 3000){
  const t0 = Date.now();
  do{ try{ if(cond()) return true; }catch(e){} await dpCuadro(w); } while(Date.now() - t0 < ms);
  try{ return !!cond(); }catch(e){ return false; }
}
// Espera el popstate de un history.back(); se engancha ANTES de moverse
const dpPop = () => new Promise(r => {
  const f = () => { removeEventListener('popstate', f); setTimeout(() => r(true), 0); };
  addEventListener('popstate', f);
  setTimeout(() => { removeEventListener('popstate', f); r(false); }, 3000);
});
const dpTxt = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
/* Cierra lo que haya abierto sin tocar el historial (abrirPedido empuja una
   entrada, y la ficha tambien) */
function dpCerrarTodo(){
  if(cerrarPedidoDOM){ pedidoEmpujado = false; const c = cerrarPedidoDOM; cerrarPedidoDOM = null; c(); }
  if(FICHA) quitarFicha();
  try{ history.replaceState(null, '', location.pathname); }catch(e){}
}
/* Arma un pedido para una prueba y despues deja el de antes, tambien en el
   navegador */
async function dpConPedido(lineas, fn){
  const antes = JSON.stringify(PEDIDO);
  let ls = null;
  try{ ls = localStorage.getItem(PEDIDO_KEY); }catch(e){}
  PEDIDO = lineas.map(l => ({ ...l })); guardarPedido(); pintarPedido(); refrescarBotonesPedido();
  try{ return await fn(); }
  finally{
    dpCerrarTodo();
    PEDIDO = JSON.parse(antes);
    try{ if(ls === null) localStorage.removeItem(PEDIDO_KEY); else localStorage.setItem(PEDIDO_KEY, ls); }catch(e){}
    pintarPedido(); refrescarBotonesPedido();
  }
}
const dpGuardado = () => { try{ return JSON.parse(localStorage.getItem(PEDIDO_KEY) || '[]'); }catch(e){ return null; } };

/* La regla de 5.1 escrita aparte: hay algo para cambiar si el modelo tiene
   OTRA fila con stock, o si la fila trae mas de un color para elegir. Los
   AirPods o una consola de una fila y un color, no. */
function dpParaCambiar(p){
  const m = buscarModelo(clave(p));
  return !!m && m.variantes.some(v => clave(v) !== clave(p) && v.stock) || pintas(p.color).length > 1;
}

/* Los productos de la prueba. El caso de la muestra si sigue en ADVAPP: el
   iPhone 17 Pro 512GB E-Sim Orange en el pedido y la ficha en 256GB E-Sim
   Orange. Si no, un modelo cualquiera con tres versiones con stock. */
function dpElegir(){
  let a = buscarProducto('CEL-APP-071'), b = buscarProducto('CEL-APP-068');
  const muestra = !!(a && b && a.stock && b.stock && buscarModelo('CEL-APP-071') &&
                     buscarModelo('CEL-APP-071') === buscarModelo('CEL-APP-068') &&
                     a.opcion === '512GB E-Sim' && a.color === 'Orange' && b.opcion === '256GB E-Sim' && b.color === 'Orange');
  if(!muestra){
    const m = MODELOS.find(x => x.variantes.filter(v => v.stock && v.precio > 0).length >= 3);
    const vs = m.variantes.filter(v => v.stock && v.precio > 0);
    a = vs[1]; b = vs[0];
  }
  const m = buscarModelo(clave(a));
  const c = m.variantes.find(v => v.stock && v.precio > 0 && clave(v) !== clave(a) && clave(v) !== clave(b));
  // Otra version del mismo modelo, con otro color que la de la linea
  const otroColor = m.variantes.find(v => v.stock && v.precio > 0 && clave(v) !== clave(a) &&
                                          pintas(v.color).length === 1 && norm(v.color) !== norm(a.color));
  const unaSola = p => p && p.stock && p.precio > 0 && buscarModelo(clave(p))?.variantes.length === 1 && pintas(p.color).length <= 1;
  const airpods = buscarProducto('AUD-APP-004');
  const solo = unaSola(airpods) ? airpods : PRODUCTOS.find(p => unaSola(p) && p.imagen);
  const solo2 = PRODUCTOS.find(p => p !== solo && unaSola(p) && p.imagen);
  return { a, b, c, m, otroColor, solo, solo2, muestra };
}

async function correrPruebas(){
  dpCerrarTodo();
  const P = dpElegir();
  info('pedido de prueba: ' + [P.a, P.solo, P.solo2].map(p => clave(p) + ' ' + p.desc).join(' · ') +
       (P.muestra ? ' (el de la muestra)' : ''));
  await probarDelPedidoALaFicha(P);      // 5.1
  await probarLaFichaAvisa(P);           // 5.2
  await probarElMensaje(P);              // 5.3
  await probarVaciar(P);                 // 5.4
  await probarCelular(P);                // 5.1, 5.2, 5.3 y 5.4 a 390 px
}

/* ---- 5.1 B Del pedido a la ficha ---- */
async function probarDelPedidoALaFicha(P){
  const lineas = [{ k: clave(P.a), n: 1, color: P.a.color || '' }, { k: clave(P.solo), n: 2, color: '' },
                  { k: clave(P.solo2), n: 1, color: '' }];
  await dpConPedido(lineas, async () => {
    const L0 = history.length;
    abrirPedido();
    await dpDormir(60);
    const d = document.getElementById('pedido');
    const items = [...d.querySelectorAll('.pd-item')];
    ok(items.length === 3, '[5.1] la lista tiene las tres lineas', items.length);
    const sinBoton = items.filter(it => {
      const b = it.querySelector('button.pd-abre-txt');
      return !b || !b.querySelector('.pd-txt b') || dpTxt(b.querySelector('.pd-txt b')) !== buscarProducto(it.dataset.key).desc;
    });
    ok(!sinBoton.length, '[5.1] el nombre de cada linea es un boton con el mismo texto de siempre',
       sinBoton.map(it => it.dataset.key).join(', ') || 'las 3');
    const fotos = items.filter(it => buscarProducto(it.dataset.key).imagen);
    ok(fotos.every(it => { const b = it.querySelector('button.pd-abre-foto');
                          return b && b.querySelector('img.pd-foto') && b.tabIndex === -1 && /^Ver /.test(b.getAttribute('aria-label') || ''); }),
       '[5.1] la foto es un boton ("Ver …"), fuera del Tab: el nombre es la parada del teclado', fotos.length + ' con foto');
    ok(items.every(it => it.querySelector('.pd-abre-txt').tabIndex === 0), '[5.1] el nombre si se alcanza con el Tab');
    // El renglon, solo donde hay algo para cambiar
    const conR = it => it.querySelector('.pd-abre-txt .pd-cambiar');
    const ren = conR(items[0]);
    ok(ren && dpTxt(ren) === 'Cambiar versión o color', '[5.1] ' + P.a.desc + ': «Cambiar versión o color»', dpTxt(ren));
    ok(ren && getComputedStyle(ren, '::after').content !== 'none' && getComputedStyle(ren, '::after').borderTopStyle === 'solid',
       '[5.1] con su flechita ›');
    ok(ren && getComputedStyle(ren).textTransform === 'uppercase' &&
       getComputedStyle(ren).color === getComputedStyle(document.documentElement).getPropertyValue('--acento').trim().replace(/^#(..)(..)(..)$/,
         (x, r, g, b) => `rgb(${parseInt(r,16)}, ${parseInt(g,16)}, ${parseInt(b,16)})`),
       '[5.1] en mayusculas y en el violeta de acento, como la muestra', ren && getComputedStyle(ren).color);
    ok(!conR(items[1]) && !conR(items[2]), '[5.1] ' + P.solo.desc + ' y ' + P.solo2.desc + ' (una version, un color) no lo llevan');
    // La regla, contra una lista mas larga: cada modelo con varias filas y 40 de una sola
    const muchas = MODELOS.filter(m => m.variantes.length > 1).map(m => m.variantes.find(v => v.stock) || m.rep)
      .concat(MODELOS.filter(m => m.variantes.length === 1).slice(0, 40).map(m => m.rep));
    PEDIDO = muchas.map(p => ({ k: clave(p), n: 1, color: '' }));
    redibujarPedido?.();
    const todos = [...d.querySelectorAll('.pd-item')];
    const mal = todos.filter(it => !!conR(it) !== dpParaCambiar(buscarProducto(it.dataset.key)));
    ok(todos.length === muchas.length && !mal.length,
       '[5.1] el renglon va justo en las lineas con otra fila con stock o mas de un color',
       mal.slice(0, 3).map(it => it.dataset.key).join(', ') || (todos.filter(conR).length + ' de ' + todos.length + ' lo llevan'));
    ok(todos.filter(conR).length > 0 && todos.filter(it => !conR(it)).length > 0, '[5.1] (y hay de las dos clases en la lista)');
    // Un modelo cuyas otras filas estan todas agotadas: nada para cambiar
    const agotadas = MODELOS.filter(m => m.variantes.length > 1 && !m.variantes.slice(1).some(v => v.stock));
    if(agotadas.length) ok(agotadas.every(m => hayParaCambiar(m.variantes[0]) === (pintas(m.variantes[0].color).length > 1)),
                           '[5.1] si las otras filas estan agotadas, no hay nada para cambiar', agotadas.length + ' modelos asi');
    else info('[5.1] hoy ningun modelo tiene todas las otras filas agotadas');
    PEDIDO = lineas.map(l => ({ ...l })); guardarPedido();
    redibujarPedido?.();
    ok(document.querySelectorAll('#pedido .pd-item').length === 3, '[5.1] (vuelve el pedido de tres lineas)');
    // Subrayado al pasar el mouse, en la compu
    const reglaHover = [...document.styleSheets].some(s => { try{ return [...s.cssRules].some(r =>
      /\.pd-abre-txt:hover b/.test(r.selectorText || '') && /underline/.test(r.style.textDecoration || r.style.textDecorationLine || '')); }catch(e){ return false; } });
    ok(reglaHover, '[5.1] en la compu el nombre se subraya al pasar el mouse');
    ok(getComputedStyle(document.querySelector('#pedido .pd-abre-txt')).cursor === 'pointer', '[5.1] con la manito');

    // Tocar el nombre: se cierra el pedido y despues se abre la ficha
    ok(history.length === L0 + 1 && history.state && history.state.pedido, '[5.1] (el pedido sumo su entrada al historial)', history.length - L0);
    // En el momento justo en que entra la ficha, ¿sigue el pedido en la pagina?
    const orden = [];
    const obs = new MutationObserver(ms => ms.forEach(m => {
      m.removedNodes.forEach(n => { if(n.id === 'pedido') orden.push('-pedido'); });
      m.addedNodes.forEach(n => { if(n.id === 'ficha') orden.push('+ficha'); });
    }));
    obs.observe(document.body, { childList: true });
    const poner = document.body.appendChild;
    let conPedido = null;
    document.body.appendChild = function(n){
      if(n && n.id === 'ficha') conPedido = !!document.getElementById('pedido');
      return poner.call(this, n);
    };
    try{ document.querySelector(`#pedido .pd-item[data-key="${CSS.escape(clave(P.a))}"] .pd-abre-txt`).click(); }
    finally{ document.body.appendChild = poner; }
    await dpDormir(80);
    obs.disconnect();
    ok(orden.join(' ') === '-pedido +ficha' && conPedido === false, '[5.1] primero se cierra el pedido y despues se abre la ficha',
       orden.join(' ') + (conPedido ? ' (con el pedido todavia abierto)' : ''));
    ok(!document.getElementById('pedido') && document.querySelectorAll('.modal').length === 1,
       '[5.1] nunca dos ventanas una arriba de la otra', document.querySelectorAll('.modal').length + ' ventana(s)');
    ok(FICHA === clave(P.a), '[5.1] la ficha abre en la version de la linea', FICHA);
    ok(!P.a.color || (COLOR_FICHA === P.a.color && document.querySelector('#ficha .fi-pintas button[aria-pressed="true"]')?.dataset.color === P.a.color) ||
       (pintas(P.a.color).length < 2 && dpTxt(document.getElementById('fi-color-txt')) === P.a.color),
       '[5.1] y en el color de la linea', COLOR_FICHA);
    if(P.muestra) ok(/512GB/.test(dpTxt(document.getElementById('fi-elegido'))) && /Orange/.test(dpTxt(document.getElementById('fi-elegido'))),
                     '[5.1] el caso de la muestra: «Estás eligiendo: iPhone 17 Pro 512GB E-Sim, color Orange»', dpTxt(document.getElementById('fi-elegido')));
    else info('[5.1] hoy no esta el caso de la muestra: se miro ' + dpTxt(document.getElementById('fi-elegido')));
    ok(history.length === L0 + 1 && !(history.state && history.state.pedido) && location.hash === '#p=' + encodeURIComponent(clave(P.a)),
       '[5.1] la ficha toma la entrada del pedido: no queda una entrada del pedido en el historial',
       (history.length - L0) + ' · ' + location.hash);
    // La X deja la pagina, sin el pedido
    const pop = dpPop();
    document.querySelector('#ficha .fi-cerrar').click();
    ok(await pop, '[5.1] (la X hace atras)');
    await dpDormir(60);
    ok(!document.getElementById('ficha') && !document.getElementById('pedido') && !FICHA,
       '[5.1] al cerrar la ficha se queda en la pagina: el pedido no vuelve solo');
    ok(!location.hash && !(history.state && history.state.pedido) && !document.body.classList.contains('modal-abierto'),
       '[5.1] y el historial queda donde estaba antes de abrir el pedido', location.hash + ' · ' + history.length);
    ok(!$('barra-pedido').hidden, '[5.1] el pedido se vuelve a abrir desde la barra de abajo');

    // La foto de una linea sin renglon tambien abre su ficha
    abrirPedido();
    await dpDormir(60);
    const fotoSolo = document.querySelector(`#pedido .pd-item[data-key="${CSS.escape(clave(P.solo2))}"] .pd-abre-foto`);
    if(fotoSolo){
      fotoSolo.click();
      await dpDormir(60);
      ok(FICHA === clave(P.solo2) && !document.getElementById('pedido'), '[5.1] la foto de ' + P.solo2.desc + ' (sin renglon) abre su ficha', FICHA);
      let p2 = dpPop(); cerrarFicha(); await p2;
    } else info('[5.1] ' + P.solo2.desc + ' no mostro la foto');
    // Tocar el renglon mismo (va adentro del boton del nombre)
    abrirPedido();
    await dpDormir(60);
    document.querySelector(`#pedido .pd-item[data-key="${CSS.escape(clave(P.a))}"] .pd-cambiar`).click();
    await dpDormir(60);
    ok(FICHA === clave(P.a) && !document.getElementById('pedido'), '[5.1] tocar el renglon tambien abre la ficha', FICHA);
    // Con el teclado: Escape cierra la ficha y el historial queda bien
    const p3 = dpPop();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    ok(await p3, '[5.1] (el Escape hace atras)');
    await dpDormir(40);
    ok(!FICHA && !location.hash && !(history.state && history.state.pedido), '[5.1] Escape en esa ficha tambien vuelve a la pagina');
    // Sin la entrada del pedido (file://), la ficha suma la suya como siempre
    abrirPedido();
    await dpDormir(40);
    const L1 = history.length;
    pedidoEmpujado = false;
    try{ history.replaceState(null, '', location.href); }catch(e){}
    document.querySelector(`#pedido .pd-item[data-key="${CSS.escape(clave(P.solo))}"] .pd-abre-txt`).click();
    await dpDormir(40);
    ok(FICHA === clave(P.solo) && fichaEmpujada === true && history.length === L1 + 1,
       '[5.1] si el pedido no habia sumado su entrada, la ficha suma la suya', history.length - L1);
    const p4 = dpPop(); cerrarFicha(); await p4;
  });
}

/* ---- 5.2 B La ficha sabe lo que ya cargaste ---- */
async function probarLaFichaAvisa(P){
  const nombreA = nombreDeLaVersion(P.a, P.a.color || '');
  const caja = () => document.getElementById('fi-pedido-caja');
  // Nada cargado: como siempre
  await dpConPedido([], async () => {
    abrirFicha(clave(P.b), null);
    ok(!document.getElementById('fi-ya') && dpTxt(document.getElementById('fi-pedido')) === 'Agregar al pedido',
       '[5.2] sin nada del modelo en el pedido, «Agregar al pedido» como siempre');
    quitarFicha();
  });
  // Una version cargada, la ficha en otra
  await dpConPedido([{ k: clave(P.solo), n: 1, color: '' }, { k: clave(P.a), n: 3, color: P.a.color || '' },
                     { k: clave(P.solo2), n: 1, color: '' }], async () => {
    abrirFicha(clave(P.b), null);
    const ya = document.getElementById('fi-ya');
    ok(ya && ya.closest('#fi-pedido-caja') && ya.closest('.fi-botones'), '[5.2] el aviso va donde estaba «Agregar al pedido»');
    const esperado = 'Ya tenés en el pedido: ' + nombreA + ' ×3';
    ok(ya && dpTxt(ya.querySelector('p')) === esperado, '[5.2] «' + esperado + '»', ya && dpTxt(ya.querySelector('p')));
    if(P.muestra) ok(nombreA === '512GB E-Sim · Orange', '[5.2] el caso de la muestra: «512GB E-Sim · Orange»', nombreA);
    else info('[5.2] hoy no esta el caso de la muestra: se miro ' + nombreA);
    ok(ya && ya.querySelector('p b') && /×3$/.test(dpTxt(ya.querySelector('p b'))) && ya.querySelector('p b').innerHTML.includes('&nbsp;×'),
       '[5.2] la version y las unidades en negrita, sin cortar el ×3');
    const bs = ya ? [...ya.querySelectorAll('.fila button')] : [];
    ok(bs.map(dpTxt).join(' | ') === 'Cambiar por esta | Agregar también', '[5.2] los dos botones, en ese orden',
       bs.map(dpTxt).join(' | '));
    ok(!/Agregar al pedido/.test(dpTxt(caja())), '[5.2] ya no dice «Agregar al pedido» como si nada');
    ok(getComputedStyle(ya).borderTopStyle === 'solid' && getComputedStyle(ya.querySelector('p'), '::before').content !== 'none' &&
       getComputedStyle(document.getElementById('fi-cambiar')).color !== getComputedStyle(document.getElementById('fi-pedido')).color,
       '[5.2] el recuadro con el punto violeta, y «Cambiar por esta» marcado', getComputedStyle(document.getElementById('fi-cambiar')).color);
    // Cambiar por esta
    const f0 = document.getElementById('fi-cambiar');
    f0.focus(); f0.click();
    ok(PEDIDO.length === 3 && PEDIDO[1].k === clave(P.b) && PEDIDO[0].k === clave(P.solo) && PEDIDO[2].k === clave(P.solo2),
       '[5.2] «Cambiar por esta» reemplaza la linea en su lugar', PEDIDO.map(l => l.k).join(', '));
    ok(PEDIDO[1].n === 3, '[5.2] con las mismas unidades', PEDIDO[1].n);
    ok(PEDIDO[1].color === COLOR_FICHA && (!PEDIDO[1].color || pintas(P.b.color).some(c => c.nombre === PEDIDO[1].color)),
       '[5.2] y el color de la version nueva (el que muestra la ficha)', PEDIDO[1].color);
    ok(!enPedido(clave(P.a)), '[5.2] la otra version sale del pedido');
    const g = dpGuardado();
    ok(g && g.length === 3 && g[1].k === clave(P.b) && g[1].n === 3, '[5.2] y queda guardado asi', g && JSON.stringify(g[1]));
    ok(!document.getElementById('fi-ya') && dpTxt(caja().querySelector('.fi-cant .n')) === '3' &&
       dpTxt(document.getElementById('fi-pedido')) === 'Quitar del pedido',
       '[5.2] la ficha pasa al contador (3 unidades) y «Quitar del pedido»');
    ok(document.activeElement === caja().querySelector('.stepper button[data-d="1"]'),
       '[5.2] el foco va al + del contador, como despues de «Agregar»',
       document.activeElement && (document.activeElement.getAttribute('aria-label') || document.activeElement.id));
    ok(new RegExp(escRe(clave(P.b))).test(mensajePedido()) && !new RegExp(escRe(clave(P.a)) + '\\b').test(mensajePedido()),
       '[5.2] el mensaje ya pide la version nueva');
    ok($('bp-ver').textContent === `Ver pedido (${unidadesPedido()})` && $('bp-usd').textContent.includes(plata(totalPedido())),
       '[5.2] y la barra de abajo se actualiza', $('bp-usd').textContent);
    /* (29/09, revision) Antes se buscaba la tarjeta en la portada, donde la
       grilla esta vacia, y el if la salteaba siempre: ahora se entra al rubro
       y a la marca del modelo, y la tarjeta tiene que estar. */
    const mm = buscarModelo(clave(P.b));
    const filtrosAntes = { ...filtros };
    Object.assign(filtros, { q: '', cat: mm.cat, marca: mm.marca, soloStock: false, rango: '' });
    pintar();
    for(let i = 0; i < 20 && !grid.querySelector(`.card[data-key="${CSS.escape(clave(mm.rep))}"]`) && dibujadas < LISTA.length; i++){
      try{ dibujarTanda(); }catch(e){ break; }
    }
    const card = grid.querySelector(`.card[data-key="${CSS.escape(clave(mm.rep))}"] .mas`);
    ok(!!card && card.getAttribute('aria-pressed') === 'true', '[5.2] la tarjeta sigue marcada como agregada',
       card ? card.getAttribute('aria-pressed') : 'no esta la tarjeta de ' + (mm.titulo || mm.desc) + ' en ' + mm.cat);
    Object.assign(filtros, filtrosAntes); pintar();
    quitarFicha();
  });
  // Nunca se copia un color que la version nueva no tiene
  if(P.otroColor && P.a.color){
    await dpConPedido([{ k: clave(P.a), n: 1, color: P.a.color }], async () => {
      abrirFicha(clave(P.otroColor), null);
      document.getElementById('fi-cambiar')?.click();
      const l = PEDIDO[0];
      ok(l && l.k === clave(P.otroColor) && norm(l.color) !== norm(P.a.color) && (!l.color || pintas(P.otroColor.color).some(c => c.nombre === l.color)),
         '[5.2] cambiando a ' + nombreDeLaVersion(P.otroColor, '') + ' no se copia el ' + P.a.color, l && l.color);
      quitarFicha();
    });
  } else info('[5.2] no hay otra version de otro color para probar el color');
  // Con un color que la fila no tiene (a mano), va sin color
  await dpConPedido([{ k: clave(P.a), n: 1, color: '' }], async () => {
    cambiarPorEsta(clave(P.b), 'ColorQueNoExiste');
    ok(PEDIDO[0] && PEDIDO[0].k === clave(P.b) && PEDIDO[0].color === '', '[5.2] un color ajeno a la fila no se guarda', PEDIDO[0] && PEDIDO[0].color);
  });
  // Agregar tambien
  await dpConPedido([{ k: clave(P.a), n: 1, color: P.a.color || '' }], async () => {
    abrirFicha(clave(P.b), null);
    const b = document.getElementById('fi-pedido');
    b.focus(); b.click();
    ok(PEDIDO.length === 2 && enPedido(clave(P.a)) && enPedido(clave(P.b)), '[5.2] «Agregar también» suma la otra version (dos lineas)',
       PEDIDO.map(l => l.k).join(', '));
    ok(!document.getElementById('fi-ya') && dpTxt(document.getElementById('fi-pedido')) === 'Quitar del pedido',
       '[5.2] y la ficha pasa al contador');
    quitarFicha();
  });
  // Dos versiones cargadas: las nombra y no ofrece cambiar
  if(P.c){
    await dpConPedido([{ k: clave(P.a), n: 1, color: P.a.color || '' }, { k: clave(P.c), n: 2, color: '' }], async () => {
      abrirFicha(clave(P.b), null);
      const ya = document.getElementById('fi-ya');
      const esperado = 'Ya tenés en el pedido: ' + nombreA + ' ×1 y ' + nombreDeLaVersion(P.c, '') + ' ×2';
      ok(ya && dpTxt(ya.querySelector('p')) === esperado, '[5.2] con dos cargadas las nombra: «' + esperado + '»', ya && dpTxt(ya.querySelector('p')));
      ok(ya && !document.getElementById('fi-cambiar') && dpTxt(document.getElementById('fi-pedido')) === 'Agregar también',
         '[5.2] y no ofrece «Cambiar por esta», solo «Agregar también»');
      cambiarPorEsta(clave(P.b), '');
      ok(PEDIDO.length === 2 && !enPedido(clave(P.b)), '[5.2] (cambiarPorEsta tampoco cambia nada con dos)');
      quitarFicha();
    });
  } else info('[5.2] el modelo no tiene una tercera version con stock');
  // La version que se mira ya esta cargada: el contador, sin aviso
  await dpConPedido([{ k: clave(P.a), n: 1, color: P.a.color || '' }, { k: clave(P.b), n: 1, color: '' }], async () => {
    abrirFicha(clave(P.b), null);
    ok(!document.getElementById('fi-ya') && dpTxt(document.getElementById('fi-pedido')) === 'Quitar del pedido',
       '[5.2] si la version que se mira ya esta, el contador de siempre (sin aviso)');
    quitarFicha();
  });
  // Cambiar de pestana dentro de la ficha rehace el aviso
  await dpConPedido([{ k: clave(P.a), n: 1, color: P.a.color || '' }], async () => {
    abrirFicha(clave(P.a), null);
    ok(!document.getElementById('fi-ya'), '[5.2] en la version cargada no hay aviso');
    const m = buscarModelo(clave(P.a));
    elegirVariante(document.getElementById('ficha'), m, P.b);
    ok(!!document.getElementById('fi-ya') && !!document.getElementById('fi-cambiar'), '[5.2] al pasar a otra version, aparece');
    elegirVariante(document.getElementById('ficha'), m, P.a);
    ok(!document.getElementById('fi-ya'), '[5.2] y al volver, se va');
    quitarFicha();
  });
  // Una version sin stock: nada (2.6 B), ni aviso
  const agot = P.m.variantes.find(v => !v.stock);
  if(agot){
    await dpConPedido([{ k: clave(P.a), n: 1, color: '' }], async () => {
      ok(htmlPedidoFicha(clave(agot)) === '', '[5.2] en una version agotada no hay aviso: la ficha deja solo «Avisame cuando entre» (2.6 B)');
      cambiarPorEsta(clave(agot), '');
      ok(PEDIDO[0].k === clave(P.a), '[5.2] y no se puede cambiar por una agotada');
    });
  } else info('[5.2] ' + (P.m.titulo || P.m.desc) + ' no tiene versiones agotadas: no se mira el aviso en una agotada');
  // Todo el catalogo: cada modelo con dos versiones con stock
  const malos = [];
  let n = 0;
  await dpConPedido([], async () => {
    MODELOS.forEach(m => {
      const vs = m.variantes.filter(v => v.stock);
      if(vs.length < 2) return;
      n++;
      PEDIDO = [{ k: clave(vs[0]), n: 1, color: '' }];
      const h = htmlPedidoFicha(clave(vs[1]));
      const nom = nombreDeLaVersion(vs[0], '');
      const partes = nom.split(' · ').map(norm);
      if(!h.includes('id="fi-ya"') || !h.includes('Cambiar por esta') || !h.includes('Agregar también') ||
         !h.includes(esc(nom) + '&nbsp;×1') || !nom.trim() || /undefined|null/.test(nom) ||
         new Set(partes).size !== partes.length) malos.push(clave(vs[1]) + ' «' + nom + '»');
      PEDIDO = [];
      if(htmlPedidoFicha(clave(vs[1])).includes('fi-ya')) malos.push(clave(vs[1]) + ' avisa sin nada cargado');
    });
  });
  ok(n > 0 && !malos.length, '[5.2] en todos los modelos con dos versiones con stock el aviso nombra la cargada, sin repetir',
     malos.slice(0, 3).join(' · ') || n + ' modelos');
}

/* ---- 5.3 A Retiro o envio, en el mismo mensaje ----
   (29/09) Hasta la tanda "decision-53" esta parte fijaba "como hoy": la
   consigna de la primera vuelta lo pedia asi. Pedro confirmo la A. */
/* Arranca sin eleccion y despues deja la de antes, tambien la guardada */
async function dpConEntrega(fn){
  const antes = JSON.stringify(ENTREGA);
  let ls = null;
  try{ ls = localStorage.getItem(ENTREGA_KEY); }catch(e){}
  ENTREGA = { entrega: '', localidad: '' }; guardarEntrega(); pintarPedido();
  try{ return await fn(); }
  finally{
    ENTREGA = JSON.parse(antes);
    try{ if(ls === null) localStorage.removeItem(ENTREGA_KEY); else localStorage.setItem(ENTREGA_KEY, ls); }catch(e){}
    pintarPedido();
  }
}
const dpEntregaGuardada = () => { try{ return localStorage.getItem(ENTREGA_KEY); }catch(e){ return 'ERROR'; } };
const dpDelLink = a => a ? decodeURIComponent(a.href.split('text=')[1] || '') : '';
/* Toca "Enviar por WhatsApp" sin salir a WhatsApp y devuelve lo que anoto la
   medicion: se cambia ANALITICA.medir un momento (anotar lo busca en cada
   llamada), asi no sale nada a la red */
function dpClicWA(a){
  const medir0 = ANALITICA.medir, mandar0 = ANALITICA.mandar, ev = [];
  ANALITICA.medir = (t, x) => { ev.push({ t, ...(x || {}) }); };
  ANALITICA.mandar = () => {};
  const frenar = e => e.preventDefault();
  document.addEventListener('click', frenar);
  try{ a.click(); }
  finally{ document.removeEventListener('click', frenar); ANALITICA.medir = medir0; ANALITICA.mandar = mandar0; }
  return ev.filter(x => x.t === 'whatsapp');
}

async function probarElMensaje(P){
  const lineas = [{ k: clave(P.a), n: 1, color: P.a.color || '' }, { k: clave(P.solo), n: 2, color: '' }];
  await dpConEntrega(async () => {
  await dpConPedido(lineas, async () => {
    // Sin elegir nada: como hoy
    const msj0 = mensajePedido();
    const partes = msj0.split('\n\n');
    ok(partes[0] === 'Hola! Te paso mi pedido:' && partes.length === 3 && /^1\. .+\n2\. .+$/.test(partes[1]) &&
       /^Total: USD [\d.]+( \(aprox\. \$ [\d.]+\))?(\nPrecios de las \d\d:\d\d, a confirmar\.)?$/.test(partes[2]),
       '[5.3] sin elegir nada, el mensaje sale como hoy: el saludo, la lista y el total', JSON.stringify(partes[2]));
    ok(!/retir|mandan|localidad|pago con|efectivo|transferencia|cripto|paypal/i.test(msj0),
       '[5.3] (sin retiro, envio, localidad ni forma de pago)');
    abrirPedido();
    await dpDormir(40);
    const d = document.getElementById('pedido');
    const chip = v => d.querySelector(`.pd-chip[data-entrega="${v}"]`);
    const loc = () => d.querySelector('#pd-localidad');
    const pri = () => d.querySelector('.botones a.pri');
    const apretado = b => !!b && b.getAttribute('aria-pressed') === 'true';
    const e = d.querySelector('.pd-entrega');
    if(!WHATSAPP){
      ok(!e, '[5.3] sin WhatsApp no hay mensaje: tampoco el recuadro');
      return;
    }
    ok(!!e, '[5.3] la ventana del pedido pregunta «¿Cómo lo recibís?»');
    if(!e) return;
    const tot = d.querySelector('.pd-total'), bot = d.querySelector('.botones');
    ok(!!tot && !!bot && !!(tot.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING) &&
       !!(e.compareDocumentPosition(bot) & Node.DOCUMENT_POSITION_FOLLOWING) &&
       e.getBoundingClientRect().top >= tot.getBoundingClientRect().bottom && bot.getBoundingClientRect().top >= e.getBoundingClientRect().bottom,
       '[5.3] va entre el total y «Enviar por WhatsApp», como la muestra');
    const rot = e.querySelector('.pd-rot');
    ok(dpTxt(rot) === '¿Cómo lo recibís? opcional' && dpTxt(rot && rot.querySelector('i')) === 'opcional',
       '[5.3] el rotulo: «¿Cómo lo recibís?» y, aparte, «opcional»', dpTxt(rot));
    ok(e.getAttribute('role') === 'group' && document.getElementById(e.getAttribute('aria-labelledby')) === rot,
       '[5.3] el lector de pantalla lo lee como un grupo con ese rotulo');
    const cse = getComputedStyle(e);
    ok(cse.backgroundColor === 'rgb(241, 234, 253)' && parseFloat(cse.borderTopLeftRadius) === 14,
       '[5.3] en el recuadro lila de la muestra', cse.backgroundColor + ' · ' + cse.borderTopLeftRadius);
    const chips = [...e.querySelectorAll('.pd-chip')];
    ok(chips.map(dpTxt).join(' | ') === 'Retiro en CABA | Envío' && chips.every(b => b.tagName === 'BUTTON' && b.type === 'button' && b.tabIndex === 0),
       '[5.3] dos botones: «Retiro en CABA» y «Envío», que se alcanzan con el Tab', chips.map(dpTxt).join(' | '));
    ok(chips.length === 2 && chips.every(b => b.getAttribute('aria-pressed') === 'false'), '[5.3] de entrada ninguno marcado: es opcional');
    ok(!e.querySelector('.pd-ayuda') && !loc(), '[5.3] sin elegir, ni ayuda ni localidad');
    ok(!d.querySelector('select, textarea') && !/pago|recargo/i.test(dpTxt(e)), '[5.3] nada de forma de pago (eso era la B)');
    const w0 = dpClicWA(pri());
    ok(w0.length === 1 && w0[0].desde === 'pedido' && !('entrega' in w0[0]),
       '[5.3] sin elegir, la medicion del clic a WhatsApp queda como antes (sin entrega)', JSON.stringify(w0[0] || {}).slice(0, 100));

    // Retiro
    chip('retiro').focus();
    chip('retiro').click();
    await dpDormir(30);
    ok(apretado(chip('retiro')) && !apretado(chip('envio')), '[5.3] tocar «Retiro en CABA» lo marca');
    ok(getComputedStyle(chip('retiro')).backgroundColor === 'rgb(124, 58, 237)' && getComputedStyle(chip('envio')).backgroundColor === 'rgb(255, 255, 255)',
       '[5.3] (el marcado en violeta y el otro en blanco, como la muestra)', getComputedStyle(chip('retiro')).backgroundColor);
    ok(dpTxt(d.querySelector('.pd-entrega .pd-ayuda')) === SERVICIO.retiro[1],
       '[5.3] debajo, la ayuda de retiro de la ficha (SERVICIO)', dpTxt(d.querySelector('.pd-ayuda')));
    ok(!loc(), '[5.3] retiro no pide localidad');
    const m1 = mensajePedido();
    ok(m1 === msj0 + '\n\nLo retiro en CABA.', '[5.3] el mensaje suma al final «Lo retiro en CABA.» y lo demas queda igual', JSON.stringify(m1.slice(-40)));
    ok(dpDelLink(pri()) === m1 && $('bp-enviar').href === pri().href,
       '[5.3] «Enviar por WhatsApp» y «Enviar pedido» de la barra mandan ese mismo mensaje');
    ok(dpEntregaGuardada() === '{"entrega":"retiro","localidad":""}', '[5.3] queda guardado en el navegador', dpEntregaGuardada());
    ok(document.activeElement === chip('retiro'), '[5.3] el foco se queda en el boton que toco',
       document.activeElement && (document.activeElement.dataset.entrega || document.activeElement.className));

    // Envio
    chip('envio').click();
    await dpDormir(30);
    ok(apretado(chip('envio')) && !apretado(chip('retiro')), '[5.3] tocar «Envío» cambia la eleccion: uno solo marcado');
    ok(dpTxt(d.querySelector('.pd-entrega .pd-ayuda')) === SERVICIO.envio[1],
       '[5.3] con la ayuda de envio de la ficha', dpTxt(d.querySelector('.pd-ayuda')));
    let l = loc();
    const lab = l && l.closest('label.pd-campo');
    ok(!!l && l.type === 'text' && !!lab && lab.closest('.pd-entrega') === d.querySelector('.pd-entrega') && dpTxt(lab.querySelector('span')) === 'Localidad' &&
       l.placeholder === 'Por ejemplo: Rosario' && l.getAttribute('autocomplete') === 'address-level2' && l.value === '',
       '[5.3] aparece el campo «Localidad», vacio, con «Por ejemplo: Rosario»', l && l.placeholder);
    ok(!!l && l.maxLength === 60, '[5.3] (hasta 60 letras)', l && l.maxLength);
    ok(mensajePedido() === msj0 + '\n\nMe lo mandan?', '[5.3] sin localidad el renglon es «Me lo mandan?»', JSON.stringify(mensajePedido().slice(-30)));
    l.focus(); l.value = 'Rosario'; l.dispatchEvent(new Event('input', { bubbles: true }));
    ok(mensajePedido() === msj0 + '\n\nMe lo mandan a Rosario?', '[5.3] con la localidad: «Me lo mandan a Rosario?»', JSON.stringify(mensajePedido().slice(-30)));
    ok(dpDelLink(pri()) === mensajePedido() && $('bp-enviar').href === pri().href, '[5.3] los dos botones ya lo mandan, letra por letra');
    ok(loc() === l && document.activeElement === l, '[5.3] escribir no redibuja la ventana: el campo no pierde el foco');
    ok(dpEntregaGuardada() === '{"entrega":"envio","localidad":"Rosario"}', '[5.3] y queda guardado', dpEntregaGuardada());
    const w1 = dpClicWA(pri());
    ok(w1.length === 1 && w1[0].desde === 'pedido' && w1[0].entrega === 'envio',
       '[5.3] la medicion del clic a WhatsApp del pedido anota entrega: "envio"', JSON.stringify(w1[0] || {}).slice(0, 120));
    ok(w1.length === 1 && !('localidad' in w1[0]) && !JSON.stringify(w1[0]).includes('Rosario'), '[5.3] y nunca la localidad');
    l.value = '  Villa   María '; l.dispatchEvent(new Event('input', { bubbles: true }));
    ok(mensajePedido().endsWith('\n\nMe lo mandan a Villa María?'), '[5.3] los espacios de mas no pasan al mensaje', JSON.stringify(mensajePedido().slice(-32)));
    // Lo que escribe el cliente no se vuelve HTML al redibujar
    window.__dp53 = 0;
    l.value = '<img src=x onerror="window.__dp53=1">'; l.dispatchEvent(new Event('input', { bubbles: true }));
    redibujarPedido();
    await dpDormir(60);
    ok(!d.querySelector('.pd-entrega img') && window.__dp53 === 0 && loc() && loc().value === '<img src=x onerror="window.__dp53=1">',
       '[5.3] lo escrito en la localidad vuelve como texto, nunca como HTML');
    l = loc(); l.value = 'Rosario'; l.dispatchEvent(new Event('input', { bubbles: true }));

    // Tocar el marcado lo desmarca
    chip('envio').click();
    await dpDormir(30);
    ok(!apretado(chip('envio')) && !apretado(chip('retiro')) && !loc() && !d.querySelector('.pd-entrega .pd-ayuda'),
       '[5.3] tocar otra vez el marcado lo desmarca: vuelve a «nada»');
    ok(mensajePedido() === msj0 && dpDelLink(pri()) === msj0, '[5.3] y el mensaje vuelve a salir como hoy');
    chip('envio').click();
    await dpDormir(30);
    ok(loc() && loc().value === 'Rosario' && mensajePedido().endsWith('\n\nMe lo mandan a Rosario?'),
       '[5.3] (la localidad escrita se recuerda si vuelve a elegir envio)');

    // Con la hora de la copia (1.5 A): la hora va con el total y el renglon despues
    const f0 = FUENTE, h0 = HORA_DATOS;
    try{
      FUENTE = { ...(FUENTE || {}), fuente: 'copia' }; HORA_DATOS = Date.now() - 3600e3;
      const mh = mensajePedido();
      ok(/\nTotal: USD [^\n]+\nPrecios de las \d\d:\d\d, a confirmar\.\n\nMe lo mandan a Rosario\?$/.test(mh),
         '[5.3 + 1.5] con la copia, «Precios de las …» sigue pegado al total y el renglon va despues', JSON.stringify(mh.slice(-80)));
    } finally { FUENTE = f0; HORA_DATOS = h0; }

    // Vaciar y Deshacer (5.4 B): Vaciar no borra la eleccion, asi que Deshacer la encuentra
    document.getElementById('pd-vaciar').click();
    await dpDormir(30);
    ok(!d.querySelector('.pd-entrega') && !!d.querySelector('.pd-deshecho'), '[5.3 + 5.4] con el pedido vaciado no se pregunta nada: queda solo «Deshacer»');
    ok(ENTREGA.entrega === 'envio' && ENTREGA.localidad === 'Rosario' && dpEntregaGuardada() === '{"entrega":"envio","localidad":"Rosario"}',
       '[5.3 + 5.4] «Vaciar el pedido» no borra la eleccion (la muestra: «Vaciar no lo borra»)', dpEntregaGuardada());
    document.getElementById('pd-deshacer').click();
    await dpDormir(30);
    ok(apretado(chip('envio')) && loc() && loc().value === 'Rosario' && mensajePedido().endsWith('\n\nMe lo mandan a Rosario?') && dpDelLink(pri()) === mensajePedido(),
       '[5.3 + 5.4] «Deshacer» devuelve el pedido con «Envío» y «Rosario» como estaban, y el mensaje con su renglon');

    // Cerrar y volver a abrir: sigue
    dpCerrarTodo();
    abrirPedido();
    await dpDormir(40);
    const d2 = document.getElementById('pedido');
    const chip2 = v => d2.querySelector(`.pd-chip[data-entrega="${v}"]`);
    ok(apretado(chip2('envio')) && d2.querySelector('#pd-localidad') && d2.querySelector('#pd-localidad').value === 'Rosario',
       '[5.3] al volver a abrir el pedido la eleccion sigue ahi');

    // Otra pestana la cambia: esta ventana y la barra dicen lo mismo
    localStorage.setItem(ENTREGA_KEY, JSON.stringify({ entrega: 'retiro', localidad: 'Rosario' }));
    dispatchEvent(new StorageEvent('storage', { key: ENTREGA_KEY }));
    await dpDormir(30);
    ok(ENTREGA.entrega === 'retiro' && apretado(chip2('retiro')) && !d2.querySelector('#pd-localidad') &&
       dpDelLink($('bp-enviar')).endsWith('\n\nLo retiro en CABA.'),
       '[5.3] si otra pestaña la cambia, esta ventana y «Enviar pedido» se enteran');

    // Lo guardado que no sirve, y el navegador que no deja guardar
    localStorage.setItem(ENTREGA_KEY, '{"entrega":"moto","localidad":5}');
    ok(JSON.stringify(leerEntrega()) === '{"entrega":"","localidad":""}', '[5.3] lo guardado que no sirve se ignora', JSON.stringify(leerEntrega()));
    localStorage.setItem(ENTREGA_KEY, '{roto');
    ok(leerEntrega() === null, '[5.3] y si no se puede leer, la copia en memoria no se toca (null)');
    guardarEntrega();
    const sp = Storage.prototype, gi = sp.getItem, si = sp.setItem, ri = sp.removeItem;
    const errores = [];
    const alError = ev => errores.push(String(ev.message || ev.error));
    addEventListener('error', alError);
    try{
      sp.getItem = sp.setItem = sp.removeItem = function(){ throw new Error('bloqueado'); };
      chip2('envio').click();
      await dpDormir(30);
      releerEntrega();
    } finally { sp.getItem = gi; sp.setItem = si; sp.removeItem = ri; removeEventListener('error', alError); }
    ok(!errores.length && ENTREGA.entrega === 'envio' && ENTREGA.localidad === 'Rosario' && mensajePedido().endsWith('\n\nMe lo mandan a Rosario?'),
       '[5.3] sin poder guardar (incognito, bloqueado) igual anda, sin errores', errores.join(' | ') || ENTREGA.entrega);
  });

  // Con productos sin stock (2.6 B): sus avisos quedan y el renglon va al final
  const sin = PRODUCTOS.find(p => !p.stock);
  if(!sin){ info('[5.3 + 2.6] hoy no hay ningun producto sin stock para probar'); return; }
  ENTREGA = { entrega: 'retiro', localidad: '' };
  await dpConPedido([{ k: clave(P.a), n: 1, color: P.a.color || '' }, { k: clave(sin), n: 1, color: '' }], async () => {
    const m = mensajePedido();
    ok(/ — sin stock \(avisame cuando entre\)\n/.test(m) && /, más los productos sin stock/.test(m) && m.endsWith('\n\nLo retiro en CABA.'),
       '[5.3 + 2.6] con algo sin stock, su aviso y el del total quedan, y el renglon va al final', JSON.stringify(m.slice(-60)));
  });
  await dpConPedido([{ k: clave(sin), n: 1, color: '' }], async () => {
    const partes = mensajePedido().split('\n\n');
    ok(partes.length === 3 && / — sin stock \(avisame cuando entre\)$/.test(partes[1]) && partes[2] === 'Lo retiro en CABA.',
       '[5.3 + 2.6] con todo sin stock no hay total, y el renglon igual va', JSON.stringify(partes.slice(1)));
  });
  });
}

/* ---- 5.4 B Vaciar, aparte y con Deshacer ---- */
async function probarVaciar(P){
  const lineas = [{ k: clave(P.a), n: 1, color: P.a.color || '' }, { k: clave(P.solo), n: 2, color: '' },
                  { k: clave(P.solo2), n: 3, color: '' }];
  const confirmar = window.confirm, alertar = window.alert;
  let cartel = 0;
  window.confirm = () => { cartel++; return true; };
  window.alert = () => { cartel++; };
  try{
    await dpConPedido(lineas, async () => {
      abrirPedido();
      await dpQuieto(document.getElementById('pedido'));
      const d = document.getElementById('pedido');
      const bot = d.querySelector('.botones');
      const v = document.getElementById('pd-vaciar');
      if(WHATSAPP){
        const a = bot && bot.querySelector('a.pri');
        ok(bot && bot.children.length === 1 && a && dpTxt(a) === 'Enviar por WhatsApp',
           '[5.4] abajo queda solo «Enviar por WhatsApp»', bot && [...bot.children].map(dpTxt).join(' | '));
        ok(a && Math.abs(a.getBoundingClientRect().width - bot.getBoundingClientRect().width) < 1,
           '[5.4] y ocupa todo el ancho', a && Math.round(a.getBoundingClientRect().width) + ' de ' + Math.round(bot.getBoundingClientRect().width));
      }
      ok(v && v.tagName === 'BUTTON' && v.classList.contains('pd-link') && dpTxt(v) === 'Vaciar el pedido' && !v.closest('.botones'),
         '[5.4] «Vaciar el pedido» es un link chico aparte, fuera de los botones', v && dpTxt(v));
      ok(v && (!bot || (bot.compareDocumentPosition(v) & Node.DOCUMENT_POSITION_FOLLOWING)) &&
         (!bot || v.getBoundingClientRect().top >= bot.getBoundingClientRect().bottom),
         '[5.4] va abajo, despues de «Enviar»');
      const cs = v && getComputedStyle(v);
      ok(cs && parseFloat(cs.fontSize) <= 11 && /underline/.test(cs.textDecorationLine) && cs.backgroundColor === 'rgba(0, 0, 0, 0)' &&
         parseFloat(cs.borderTopWidth) === 0, '[5.4] chico, subrayado y sin fondo ni borde', cs && cs.fontSize);
      ok(!d.querySelector('.botones .sec'), '[5.4] ya no hay un «Vaciar» del mismo tamaño pegado a «Enviar»');

      // Vaciar
      const antes = JSON.stringify(PEDIDO);
      v.focus(); v.click();
      await dpDormir(30);
      ok(PEDIDO.length === 0 && (dpGuardado() || []).length === 0, '[5.4] vacia de una, tambien lo guardado');
      ok(cartel === 0, '[5.4] sin el cartel del navegador («¿Estás seguro?»)', cartel);
      ok($('barra-pedido').hidden, '[5.4] la barra de abajo se va');
      const ds = d.querySelector('.pd-deshecho');
      ok(ds && dpTxt(ds.querySelector('p')) === 'Vaciaste el pedido.' && dpTxt(ds.querySelector('button')) === 'Deshacer' &&
         ds.getAttribute('aria-live') === 'polite', '[5.4] «Vaciaste el pedido.» con «Deshacer»', ds && dpTxt(ds));
      ok(!d.querySelector('.pd-item, .pd-total, .botones, #pd-vaciar, .pd-vacio'),
         '[5.4] sin lista, total ni botones: solo el aviso', [...d.querySelectorAll('.pd-item, .pd-total, .botones, #pd-vaciar, .pd-vacio')].map(x => x.className || x.id).join(','));
      ok(document.activeElement === document.getElementById('pd-deshacer'), '[5.4] el foco queda en «Deshacer»',
         document.activeElement && (document.activeElement.id || document.activeElement.className));
      /* (29/09, revision) Con un solo boton la trampa del Tab no actuaba: el
         Tab se iba a la pagina de atras con la ventana abierta */
      for(const shiftKey of [false, true]){
        const ev = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
        document.activeElement.dispatchEvent(ev);
        ok(ev.defaultPrevented && document.activeElement === document.getElementById('pd-deshacer'),
           `[5.4] con «Vaciaste el pedido» a la vista, el ${shiftKey ? 'Shift+Tab' : 'Tab'} no se escapa: queda en «Deshacer»`,
           (ev.defaultPrevented ? 'frenado' : 'se escapa') + ' · ' + (document.activeElement && (document.activeElement.id || document.activeElement.tagName)));
      }
      // No se va solo
      await dpDormir(6000);
      ok(!!document.getElementById('pd-deshacer') && !!document.getElementById('pedido'), '[5.4] no se va solo (6 s despues sigue)');
      // Deshacer
      document.getElementById('pd-deshacer')?.click();
      await dpDormir(30);
      ok(JSON.stringify(PEDIDO) === antes, '[5.4] «Deshacer» devuelve los mismos productos, colores, unidades y orden', JSON.stringify(PEDIDO));
      ok(JSON.stringify(dpGuardado()) === antes, '[5.4] tambien en lo guardado');
      ok(!$('barra-pedido').hidden && $('bp-ver').textContent === 'Ver pedido (6)', '[5.4] y vuelve la barra', $('bp-ver').textContent);
      ok(d.querySelectorAll('.pd-item').length === 3 && !d.querySelector('.pd-deshecho') && !!document.getElementById('pd-vaciar'),
         '[5.4] y la lista, con «Vaciar el pedido» otra vez');
      // Cerrar la ventana es quedarse con el pedido vacio
      document.getElementById('pd-vaciar').click();
      await dpDormir(30);
      const pop = dpPop();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await pop;
      ok(!document.getElementById('pedido') && PEDIDO.length === 0 && (dpGuardado() || []).length === 0,
         '[5.4] si se cierra la ventana, queda vacio');
      abrirPedido();
      await dpDormir(40);
      const d2 = document.getElementById('pedido');
      ok(d2 && !d2.querySelector('.pd-deshecho') && d2.querySelector('.pd-vacio') && !d2.querySelector('#pd-vaciar, .botones'),
         '[5.4] al volver a abrirla ya no hay «Deshacer», ni «Vaciar» sin nada que vaciar');
      // Sin ningun boton, el Tab tampoco se va: queda en la ventana
      await dpDormir(40);
      const ev0 = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      document.activeElement.dispatchEvent(ev0);
      ok(ev0.defaultPrevented && !!d2 && d2.contains(document.activeElement),
         '[5.4] con el pedido vacio (sin botones) el Tab tampoco sale de la ventana',
         document.activeElement && (document.activeElement.className || document.activeElement.tagName));
      // Otra pestana carga algo mientras esta el Deshacer: no se pisa
      dpCerrarTodo();
      PEDIDO = lineas.map(l => ({ ...l })); guardarPedido(); pintarPedido();
      abrirPedido();
      await dpDormir(40);
      document.getElementById('pd-vaciar').click();
      PEDIDO = [{ k: clave(P.b), n: 1, color: '' }]; guardarPedido();
      redibujarPedido?.();
      ok(!document.getElementById('pd-deshacer') && document.querySelectorAll('#pedido .pd-item').length === 1,
         '[5.4] si otra pestana carga algo, se muestra eso y ya no hay nada que deshacer');
    });
  } finally {
    window.confirm = confirmar; window.alert = alertar;
  }
}

/* ---- A 390 px (iframe) ---- */
async function probarCelular(P){
  const antes = JSON.stringify(PEDIDO);
  let ls = null;
  try{ ls = localStorage.getItem(PEDIDO_KEY); }catch(e){}
  PEDIDO = [{ k: clave(P.a), n: 1, color: P.a.color || '' }, { k: clave(P.solo), n: 2, color: '' },
            { k: clave(P.solo2), n: 1, color: '' }];
  guardarPedido();
  // Con "Envío" y "Rosario" guardados (5.3 A): el recuadro entero a la vista
  let lsE = null;
  try{ lsE = localStorage.getItem(ENTREGA_KEY); localStorage.setItem(ENTREGA_KEY, JSON.stringify({ entrega: 'envio', localidad: 'Rosario' })); }catch(e){}
  // El pedido de los dos anchos: el de 390 lo cambia ("Cambiar por esta") y
  // lo guarda, y el storage de la otra ventana tambien lo trae aca
  const pedidoCel = JSON.stringify(PEDIDO);
  for(const ancho of [390, 360]){
    const f = document.createElement('iframe');
    f.style.cssText = `width:${ancho}px;height:664px;border:0;position:absolute;left:-9999px;top:0`;
    f.src = 'index.html';
    document.body.appendChild(f);
    try{
      const listo = await dpEsperarA(() => f.contentWindow.eval('MODELOS.length && FUENTE && !document.getElementById("barra-pedido").hidden'), 40000);
      ok(listo, `[${ancho}] el celular de ${ancho} px carga con el pedido`);
      if(!listo) continue;
      const w = f.contentWindow, doc = f.contentDocument;
      try{ w.pararOfertas?.(); w.pararPaseos?.(); w.pararMundos?.(); }catch(e){}
      w.eval('abrirPedido()');
      await dpQuieto(doc.getElementById('pedido'));   // la ventana ya entro entera
      const caja = doc.querySelector('#pedido .caja');
      const it = doc.querySelector(`#pedido .pd-item[data-key="${CSS.escape(clave(P.a))}"]`);
      const btn = it && it.querySelector('.pd-abre-txt');
      const r = btn && btn.getBoundingClientRect(), ri = it && it.getBoundingClientRect();
      ok(r && Math.abs(r.width - ri.width) < 2 && r.top <= it.querySelector('.stepper').getBoundingClientRect().top,
         `[5.1 · ${ancho}] el nombre ocupa su renglon entero, arriba de la foto y el contador`, r && Math.round(r.width) + ' de ' + Math.round(ri.width));
      const ren = it && it.querySelector('.pd-cambiar');
      const rr = ren && ren.getBoundingClientRect(), rc = caja.getBoundingClientRect();
      ok(ren && rr.height > 0 && rr.right <= rc.right && rr.height < 16, `[5.1 · ${ancho}] «Cambiar versión o color ›» a la vista, en un renglon`,
         rr && Math.round(rr.width) + 'x' + Math.round(rr.height));
      const bot = doc.querySelector('#pedido .botones'), v = doc.getElementById('pd-vaciar');
      if(WHATSAPP) ok(bot && Math.abs(bot.querySelector('a.pri').getBoundingClientRect().width - bot.getBoundingClientRect().width) < 1 &&
                      v.getBoundingClientRect().top >= bot.getBoundingClientRect().bottom, `[5.4 · ${ancho}] «Enviar» a todo el ancho y «Vaciar el pedido» abajo`);
      ok(caja.scrollWidth <= caja.clientWidth + 1, `[${ancho}] la ventana del pedido no se sale de costado`, caja.scrollWidth + ' / ' + caja.clientWidth);
      if(WHATSAPP){
        const e = doc.querySelector('#pedido .pd-entrega');
        const cs = e ? [...e.querySelectorAll('.pd-chip')] : [];
        const inp = doc.getElementById('pd-localidad');
        const re = e && e.getBoundingClientRect(), rcj = caja.getBoundingClientRect();
        ok(!!e && cs.length === 2 && Math.abs(cs[0].getBoundingClientRect().top - cs[1].getBoundingClientRect().top) < 1 &&
           cs.every(b => b.getBoundingClientRect().right <= re.right + 0.5) && re.right <= rcj.right + 0.5,
           `[5.3 · ${ancho}] «Retiro en CABA» y «Envío» en un renglon, adentro del recuadro`, cs.map(b => Math.round(b.getBoundingClientRect().width)).join(' + '));
        ok(!!inp && inp.value === 'Rosario' && inp.getBoundingClientRect().right <= re.right + 0.5 &&
           cs[1] && cs[1].getAttribute('aria-pressed') === 'true',
           `[5.3 · ${ancho}] lo guardado vuelve: «Envío» marcado y «Rosario» en la localidad`);
        ok(!!inp && parseFloat(w.getComputedStyle(inp).fontSize) >= 16,
           `[5.3 · ${ancho}] la localidad en 16 px: el iPhone no agranda la pagina al tocarla`, inp && w.getComputedStyle(inp).fontSize);
        ok(w.eval('mensajePedido()').endsWith('\n\nMe lo mandan a Rosario?') &&
           decodeURIComponent(doc.getElementById('bp-enviar').href.split('text=')[1] || '').endsWith('\n\nMe lo mandan a Rosario?'),
           `[5.3 · ${ancho}] y el mensaje, tambien el de «Enviar pedido» de la barra, lo trae`);
      }
      // Al tocar el nombre, la ficha; y en otra version, el aviso en el pie pegado (2.7 B)
      btn.click();
      await dpDormir(300);
      ok(!doc.getElementById('pedido') && w.eval('FICHA') === clave(P.a), `[5.1 · ${ancho}] tocar el nombre abre la ficha`);
      w.eval(`elegirVariante(document.getElementById('ficha'), buscarModelo(${JSON.stringify(clave(P.b))}), buscarProducto(${JSON.stringify(clave(P.b))}))`);
      await dpQuieto(doc.getElementById('ficha'));     // la ficha ya entro entera (cajaIn)
      /* (29/09, revision) En el celular el aviso queda en el pie pegado, pero
         sus dos botones van fuera, justo debajo (.fi-ya-abajo): con ellos
         adentro el pie media 183-227 px y tapaba el precio y el nombre. */
      const ya = doc.getElementById('fi-ya');
      const pieF = doc.querySelector('#ficha .fi-botones');
      const abajo = doc.querySelector('#ficha .fi-ya-abajo');
      ok(ya && ya.closest('.fi-botones') && !ya.querySelector('button'),
         `[5.2 · ${ancho}] el aviso va en el pie pegado, solo con su linea`);
      ok(!!abajo && abajo.previousElementSibling === pieF && !pieF.contains(abajo) && abajo.querySelectorAll('button').length === 2,
         `[5.2 · ${ancho}] y sus dos botones, fuera del pie y justo debajo`);
      if(ya && abajo){
        const bs = [...abajo.querySelectorAll('.fila button')];
        const rf = doc.querySelector('#ficha .caja').getBoundingClientRect();
        ok(bs.length === 2 && bs.every(b => b.getBoundingClientRect().height < 42 && b.scrollWidth <= b.clientWidth + 1),
           `[5.2 · ${ancho}] los dos botones no se parten`, bs.map(b => Math.round(b.getBoundingClientRect().width) + 'x' + Math.round(b.getBoundingClientRect().height)).join(' '));
        ok(bs.every(b => b.getBoundingClientRect().left >= rf.left && b.getBoundingClientRect().right <= rf.right + 0.5),
           `[5.2 · ${ancho}] ni se salen de la ficha`);
        ok(bs.map(dpTxt).join(' | ') === 'Cambiar por esta | Agregar también', `[5.2 · ${ancho}] son los mismos, en el mismo orden`, bs.map(dpTxt).join(' | '));
        /* El pie chico: el aviso ocupa lo mismo que el boton "Agregar al
           pedido" al que reemplaza (una linea, sin recuadro), asi el pie no
           crece y el precio se ve sin bajar */
        doc.querySelector('#ficha .caja').scrollTop = 0;
        await dpQuieto(doc.getElementById('ficha'));
        const usd = doc.querySelector('#ficha .fi-precio .usd'), rp = usd && usd.getBoundingClientRect(), rpie = pieF.getBoundingClientRect();
        const cta = pieF.querySelector('.cta').getBoundingClientRect(), ry = ya.getBoundingClientRect();
        ok(ry.height <= 42 && rpie.height <= cta.height + 9 + 42 + 26 + 1,
           `[5.2 · ${ancho}] el aviso en el pie no es mas alto que el boton al que reemplaza`,
           'aviso ' + Math.round(ry.height) + ' px, pie ' + Math.round(rpie.height) + ' px');
        ok(!!rp && rp.bottom <= rpie.top + 0.5, `[5.2 · ${ancho}] el pie con el aviso no tapa el precio`,
           rp && 'precio hasta ' + Math.round(rp.bottom) + ', pie desde ' + Math.round(rpie.top) + ' (' + Math.round(rpie.height) + ' px)');
        // Los botones mudados andan: "Cambiar por esta" cambia la linea
        const antesN = w.eval('PEDIDO.length');
        doc.getElementById('fi-cambiar').focus();
        doc.getElementById('fi-cambiar').click();
        /* Se espera a que pase, no un tiempo fijo (29/09): con la suite entera
           corriendo a la vez, 100 ms a veces no alcanzaban y esto fallaba de a
           ratos, lo que frena PUBLICAR sin motivo. Tope: 2 s. */
        const cambio = () => w.eval('PEDIDO.length') === antesN && w.eval(`PEDIDO.some(l => l.k === ${JSON.stringify(clave(P.b))})`) &&
           !doc.querySelector('#ficha .fi-ya-abajo') && doc.activeElement === doc.querySelector('#ficha #fi-pedido-caja .stepper button[data-d="1"]');
        for(let i = 0; i < 20 && !cambio(); i++) await dpDormir(100);
        ok(cambio(),
           `[5.2 · ${ancho}] desde abajo, «Cambiar por esta» cambia la linea, los botones de abajo se van y el foco va al +`,
           doc.activeElement && (doc.activeElement.getAttribute('aria-label') || doc.activeElement.id || doc.activeElement.tagName));
        w.eval(`PEDIDO = ${pedidoCel}; guardarPedido(); pintarPedido(); refrescarBotonesPedido();`);
        localStorage.setItem(PEDIDO_KEY, pedidoCel);
      }
    } finally {
      f.remove();
    }
  }
  PEDIDO = JSON.parse(antes);
  try{ if(ls === null) localStorage.removeItem(PEDIDO_KEY); else localStorage.setItem(PEDIDO_KEY, ls); }catch(e){}
  try{ if(lsE === null) localStorage.removeItem(ENTREGA_KEY); else localStorage.setItem(ENTREGA_KEY, lsE); }catch(e){}
  pintarPedido(); refrescarBotonesPedido();
}
