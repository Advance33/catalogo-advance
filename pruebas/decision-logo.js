// El logo como boton de inicio (pedido de Pedro, 29/09/2026).
// Los dos logos -el de la barra de arriba y el de la cinta de rubros pegada-
// eran un <span> que no hacia nada. Ahora son un link de verdad a la
// direccion de la portada, con aria-label "Ir al inicio":
//   - el clic comun no recarga: irAlInicio() cierra lo abierto (ficha, visor,
//     pedido, "Ya no esta", Filtrar), saca rubro, busqueda, filtros y orden,
//     deja la direccion limpia como al entrar y sube arriba de todo
//   - el historial como un link: suma una entrada si se estaba en otro lado
//     (el Atras vuelve), reemplaza la del pedido o el visor, y no suma nada si
//     ya se estaba en el inicio (el triangulo sigue siendo el easter egg de
//     7 clics y no pueden ser 7 Atras)
//   - con Cmd, Ctrl, Shift o Alt, o con otro boton, lo hace el navegador
//     (otra pestaña): el sitio no toca nada
//   - se ve igual: solo cambia la manito y el foco con el teclado
// El celular se mira en un iframe de 390 px (el headless no baja de 500).
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);

const esperaDL = setInterval(() => {
  if(!MODELOS.length || !FUENTE || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperaDL);
  for(let i=1;i<5000;i++) clearInterval(i);
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; })
    .finally(() => {
      try{ dlSinVentanas(); }catch(e){}
      try{ pararPaseos(); pararOfertas(); pararMundos(); }catch(e){}
      for(let i=1;i<5000;i++) clearInterval(i);
      const pre=document.createElement('pre'); pre.id='RESULTADO';
      pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
      document.body.appendChild(pre);
    });
}, 150);

const dlDormir = ms => new Promise(r => setTimeout(r, ms));
async function dlEsperarA(cond, ms = 15000){
  const t0 = Date.now();
  while(Date.now() - t0 < ms){
    try{ if(cond()) return true; }catch(e){}
    await dlDormir(100);
  }
  try{ return !!cond(); }catch(e){ return false; }
}
const dlLimpios = { q:'', cat:'', marca:'', orden: ORDEN_DEF, soloStock:false, rango:'', montura:'', apertura:'', capacidad:'', ram:'' };
const dlInicio = location.pathname;
const dlDir = () => location.pathname + location.search + location.hash;
const dlEnInicio = () => enPortada() && filtros.orden === ORDEN_DEF &&
  Object.keys(dlLimpios).every(k => filtros[k] === dlLimpios[k]);

/* Cierra todo sin tocar el historial (las pruebas no tienen que depender del
   history.back() de cada ventana) */
function dlSinVentanas(){
  if(cerrarVisorDOM){ visorEmpujado = false; const c = cerrarVisorDOM; cerrarVisorDOM = null; c(); }
  if(FICHA) quitarFicha();
  if(cerrarPedidoDOM){ pedidoEmpujado = false; const c = cerrarPedidoDOM; cerrarPedidoDOM = null; c(); }
  if(cerrarYaNoEstaDOM){ const c = cerrarYaNoEstaDOM; cerrarYaNoEstaDOM = null; c(); }
  document.querySelectorAll('.modal').forEach(d => d.remove());
  document.body.classList.remove('modal-abierto');
}

/* Espia: anota si el clic quedo con preventDefault (lo hizo el sitio) y
   despues lo frena igual, para que un clic con Cmd no abra otra pestaña ni
   uno comun que el sitio no atendio se lleve la pagina de las pruebas. Va en
   window, en burbuja: corre despues del oyente del link. */
let dlUltimo = null;
addEventListener('click', e => {
  if(!e.target.closest || !e.target.closest('#logo-inicio, #cats-logo')) return;
  dlUltimo = { prevenido: e.defaultPrevented };
  e.preventDefault();
});
function dlClic(el, extra = {}){
  dlUltimo = null;
  el.dispatchEvent(new MouseEvent('click', Object.assign({ bubbles: true, cancelable: true, button: 0, view: window }, extra)));
  return dlUltimo;
}

async function correrPruebas(){
  window.__dlSinRecargar = 'sigue';
  try{
    probarMarcado();
    await probarDireccion();
    await probarDesdeUnRubro();
    await probarVentanas();
    probarYaEnElInicio();
    probarConModificadores();
    await probarEasterEgg();
    await probarCelular();
  } finally {
    dlSinVentanas();
    Object.assign(filtros, dlLimpios); verTodo = false;
    sincronizarControles(); cerrarBuscador();
    try{ history.replaceState(null, '', dlInicio); }catch(e){}
    pintar();
  }
}

/* ---- Los dos son links, con su nombre, y se ven igual ---- */
function probarMarcado(){
  const a = $('logo-inicio'), c = $('cats-logo');
  ok(a && a.tagName === 'A' && a.classList.contains('logo') && a.closest('.topbar'),
     '[logo] el de la barra de arriba es un <a class="logo">', a && a.outerHTML.slice(0, 60));
  ok(c && c.tagName === 'A' && c.classList.contains('cats-logo') && c.closest('.barra-cats'),
     '[logo] el de la cinta de rubros es un <a class="cats-logo">', c && c.outerHTML.slice(0, 60));
  if(!a || !c) return;
  const portada = new URL('./', location.href).href;
  [[a, 'arriba'], [c, 'cinta']].forEach(([el, d]) => {
    ok(el.getAttribute('href') === './' && el.href === portada,
       '[logo · ' + d + '] el href es la direccion de la portada (./)', el.getAttribute('href') + ' -> ' + el.href);
    ok(el.getAttribute('aria-label') === 'Ir al inicio', '[logo · ' + d + '] aria-label "Ir al inicio"', el.getAttribute('aria-label'));
    ok(!el.closest('[aria-hidden="true"]') && el.tabIndex === 0 && !el.hasAttribute('tabindex'),
       '[logo · ' + d + '] se alcanza con el teclado y no esta escondido del lector', el.tabIndex);
    ok(!el.querySelector('button, a, input, select'), '[logo · ' + d + '] no tiene otro control adentro (HTML valido)');
    const img = el.querySelector('img');
    ok(img && img.getAttribute('src') === 'assets/logo-mark.png' && img.alt === '',
       '[logo · ' + d + '] el triangulo de siempre, sin texto alternativo (lo nombra el link)');
    ok(getComputedStyle(el).cursor === 'pointer', '[logo · ' + d + '] la manito de un link', getComputedStyle(el).cursor);
    el.focus();
    ok(document.activeElement === el, '[logo · ' + d + '] toma el foco');
    if(el.matches(':focus-visible')){
      const cs = getComputedStyle(el);
      ok(cs.outlineStyle === 'solid' && parseFloat(cs.outlineWidth) >= 2,
         '[logo · ' + d + '] con el foco del teclado se ve el contorno', cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor);
    } else info('[logo · ' + d + '] el navegador no marco :focus-visible con focus(): el contorno no se mira');
    el.blur();
  });
  // El easter egg sigue en el triangulo de arriba
  const tri = $('marca-btn');
  ok(tri && a.contains(tri) && tri.querySelector('img'), '[logo] el triangulo del easter egg sigue adentro del logo de arriba');
  // Se ve igual que cuando era un span: sin subrayado ni colores de link
  const b = a.querySelector('b'), bs = b && b.querySelector('span');
  ok(b && getComputedStyle(b).textDecorationLine === 'none' && getComputedStyle(b).color === 'rgb(255, 255, 255)' &&
     bs && getComputedStyle(bs).color === 'rgb(196, 166, 255)',
     '[logo] "Advance Tecno" como siempre: blanco y lila, sin subrayar',
     b && getComputedStyle(b).color + ' / ' + (bs && getComputedStyle(bs).color) + ' / ' + getComputedStyle(b).textDecorationLine);
  const cc = getComputedStyle(c);
  // Desde el 05/10/2026 (Benja) el de la cinta se ve como boton: el cuadrado
  // negro de la barra de arriba con el triangulo blanco, de 38 px (34 en el
  // celular). Gris y de 20 px no se notaba que llevaba al inicio.
  const cuadro = getComputedStyle(c, '::before');
  ok(cc.display === 'grid' && cc.borderRightStyle === 'solid' &&
     Math.abs(c.querySelector('img').getBoundingClientRect().height - (innerWidth <= 520 ? 34 : 38)) < 0.6 &&
     cuadro.backgroundColor === 'rgb(21, 18, 32)',
     '[logo] el de la cinta con su raya a la derecha, y como boton: cuadrado negro con el triangulo',
     cc.display + ' ' + cc.borderRightStyle + ' ' + cuadro.backgroundColor + ' ' + Math.round(c.querySelector('img').getBoundingClientRect().height) + 'px');
  const ra = a.getBoundingClientRect(), rt = tri.getBoundingClientRect();
  ok(Math.abs(rt.height - 24) < 0.6 && Math.abs(ra.height - 24) < 0.6,
     '[logo] el de arriba mide lo mismo que antes (24 px de alto)', Math.round(ra.height) + ' / ' + Math.round(rt.height));
}

/* ---- ./ es la portada de verdad (con Cmd+clic se abre eso) ---- */
async function probarDireccion(){
  let txt = '';
  try{ txt = await (await fetch($('logo-inicio').href, { cache: 'no-store' })).text(); }catch(e){ txt = 'ERROR ' + e; }
  ok(txt.includes('id="logo-inicio"') && txt.includes('id="mosaico"'),
     '[logo] la direccion del link sirve el catalogo', txt.slice(0, 40));
}

/* ---- Desde un rubro con busqueda, filtros y orden, bien abajo ---- */
async function probarDesdeUnRubro(){
  dlSinVentanas();
  const chip = [...document.querySelectorAll('#cats .chip')].find(b => b.dataset.cat);
  const cat = chip && chip.dataset.cat;
  ok(!!cat, '[logo] hay un rubro para entrar', cat);
  if(!cat) return;
  Object.assign(filtros, dlLimpios, { cat, q: 'a', soloStock: true, orden: 'asc' });
  verTodo = false;
  sincronizarControles(); escribirURL(true); pintar();
  scrollTo(0, 2500);
  await dlDormir(50);
  const antesDir = dlDir(), largo = history.length, altoAntes = scrollY;
  ok(antesDir.includes('cat=') && antesDir.includes('q=') && antesDir.includes('orden=asc') && !enPortada(),
     '[logo] arranca adentro del rubro, con busqueda, stock y orden', antesDir);
  const c = dlClic($('logo-inicio'));
  ok(c && c.prevenido, '[logo · arriba] el clic comun lo atiende el sitio (no recarga)', JSON.stringify(c));
  ok(window.__dlSinRecargar === 'sigue', '[logo] la pagina no se recargo');
  ok(dlEnInicio() && !verTodo, '[logo] queda sin rubro, sin busqueda, sin filtros y con el orden de siempre', JSON.stringify(filtros));
  ok(dlDir() === dlInicio, '[logo] la direccion queda limpia, como al entrar', dlDir());
  ok(history.length === largo + 1 && history.state === null,
     '[logo] suma una entrada al historial, como un link', largo + ' -> ' + history.length);
  ok(scrollY === 0, '[logo] sube arriba de todo', altoAntes + ' -> ' + scrollY);
  ok(document.body.classList.contains('portada') && !$('mosaico').hidden && $('mosaico').children.length && $('grid').hidden,
     '[logo] se ve la portada con los rubros');
  ok($('q').value === '' && !document.querySelector('.topbar').classList.contains('buscando'),
     '[logo] el buscador queda vacio y cerrado', JSON.stringify($('q').value));
  ok(!document.querySelector('#cats .chip[aria-pressed="true"][data-cat]:not([data-cat=""])'),
     '[logo] ningun rubro queda marcado en la cinta');
  // El Atras vuelve al rubro, como con un link
  history.back();
  const volvio = await dlEsperarA(() => filtros.cat === cat && location.search.includes('cat='));
  ok(volvio && filtros.q === 'a' && filtros.orden === 'asc', '[logo] con Atras vuelve al rubro de antes', dlDir());

  // El de la cinta hace lo mismo
  scrollTo(0, 2500);
  await dlDormir(50);
  const c2 = dlClic($('cats-logo').querySelector('img'));
  ok(c2 && c2.prevenido && dlEnInicio() && dlDir() === dlInicio && scrollY === 0,
     '[logo · cinta] el triangulo de la cinta tambien lleva al inicio', dlDir() + ' y=' + scrollY);

  // "Ver todo el catalogo" (sin cambio de direccion): vuelve a los rubros sin sumar historial
  verTodoElCatalogo();
  const l2 = history.length;
  ok(!enPortada(), '[logo] con "Ver todo" puesto, la grilla entera');
  dlClic($('logo-inicio'));
  ok(enPortada() && !verTodo && history.length === l2, '[logo] desde "Ver todo" vuelve a los rubros sin sumar un Atras que no haria nada',
     l2 + ' -> ' + history.length);
}

/* ---- Con una ventana abierta ---- */
async function probarVentanas(){
  dlSinVentanas();
  const m = MODELOS.find(x => x.stock && x.variantes.length > 1) || MODELOS.find(x => x.stock);
  const k = clave(m.rep);

  // Ficha (con su #p=): se cierra; Atras la vuelve a abrir, como un link
  abrirFicha(k);
  await dlDormir(50);
  ok(!!document.getElementById('ficha') && location.hash.startsWith('#p='), '[ficha] abierta con su #p=', location.hash);
  let largo = history.length;
  dlClic($('logo-inicio'));
  ok(!document.getElementById('ficha') && FICHA === null && !document.body.classList.contains('modal-abierto'),
     '[ficha] el logo la cierra');
  ok(dlDir() === dlInicio && history.length === largo + 1, '[ficha] direccion limpia, sin el #p=, y una entrada nueva',
     dlDir() + ' ' + largo + ' -> ' + history.length);
  history.back();
  const reabre = await dlEsperarA(() => FICHA === k && document.getElementById('ficha'));
  ok(reabre, '[ficha] con Atras vuelve la ficha', location.hash);
  dlSinVentanas();
  try{ history.replaceState(null, '', dlInicio); }catch(e){}

  // Ficha + visor (4.4 B): se van los dos; la entrada del visor se reemplaza
  abrirFicha(k);
  await dlDormir(50);
  const d = document.getElementById('ficha');
  const lupa = d && d.querySelector('.fi-lupa');
  if(lupa && d.querySelector('.fi-marco > img')){
    abrirVisor(d);
    await dlDormir(50);
    const hay = !!document.getElementById('visor') && history.state && history.state.visor;
    ok(hay, '[visor] abierto, con su entrada en el historial');
    largo = history.length;
    dlClic($('cats-logo'));
    ok(!document.getElementById('visor') && !document.getElementById('ficha') && !cerrarVisorDOM && !visorEmpujado,
       '[visor] el logo cierra el visor y la ficha');
    ok(dlDir() === dlInicio && history.state === null && history.length === largo,
       '[visor] la entrada del visor se reemplaza (el Atras no reabre la foto)', largo + ' -> ' + history.length);
    history.back();
    await dlEsperarA(() => FICHA === k);
    ok(FICHA === k && !document.getElementById('visor'), '[visor] Atras vuelve a la ficha, sin el visor');
  } else info('[visor] esa ficha no tiene foto: no se prueba el visor');
  dlSinVentanas();
  try{ history.replaceState(null, '', dlInicio); }catch(e){}

  // Pedido, adentro de un rubro
  const chip = [...document.querySelectorAll('#cats .chip')].find(b => b.dataset.cat);
  Object.assign(filtros, dlLimpios, { cat: chip.dataset.cat });
  sincronizarControles(); escribirURL(true); pintar();
  const antesPedido = PEDIDO.slice();
  try{
    const p = PRODUCTOS.find(x => x.stock && x.precio > 0 && buscarModelo(clave(x)));
    PEDIDO = [{ k: clave(p), n: 1, color: '' }]; guardarPedido(); pintarPedido();
    abrirPedido();
    await dlDormir(50);
    ok(!!document.getElementById('pedido') && history.state && history.state.pedido, '[pedido] abierto, con su entrada');
    largo = history.length;
    dlClic($('logo-inicio'));
    ok(!document.getElementById('pedido') && !cerrarPedidoDOM && !pedidoEmpujado, '[pedido] el logo lo cierra');
    ok(dlEnInicio() && dlDir() === dlInicio && history.state === null && history.length === largo,
       '[pedido] al inicio, reemplazando la entrada del pedido', dlDir() + ' ' + largo + ' -> ' + history.length);
    ok(PEDIDO.length === 1, '[pedido] lo cargado no se toca');
    history.back();
    await dlEsperarA(() => filtros.cat === chip.dataset.cat);
    ok(filtros.cat === chip.dataset.cat && !document.getElementById('pedido'), '[pedido] Atras vuelve al rubro, sin reabrir el pedido');
  } finally {
    dlSinVentanas();
    PEDIDO = antesPedido; guardarPedido(); pintarPedido();
  }
  try{ history.replaceState(null, '', dlInicio); }catch(e){}

  // "Ya no esta" (4.5)
  avisarYaNoEsta();
  ok(!!document.getElementById('ya-no-esta'), '[ya no esta] abierto');
  dlClic($('logo-inicio'));
  ok(!document.getElementById('ya-no-esta') && !cerrarYaNoEstaDOM, '[ya no esta] el logo lo cierra');

  // Filtrar, adentro de un rubro
  Object.assign(filtros, dlLimpios, { cat: chip.dataset.cat });
  sincronizarControles(); escribirURL(true); pintar();
  abrirFiltros();
  ok(!!document.getElementById('filtros-panel'), '[filtrar] abierto');
  dlClic($('cats-logo'));
  ok(!document.getElementById('filtros-panel') && !document.querySelector('.modal') && !document.body.classList.contains('modal-abierto') && dlEnInicio(),
     '[filtrar] el logo lo cierra y va al inicio');
}

/* ---- Ya en el inicio: no suma historial ni redibuja ---- */
function probarYaEnElInicio(){
  dlSinVentanas();
  Object.assign(filtros, dlLimpios); verTodo = false;
  try{ history.replaceState(null, '', dlInicio); }catch(e){}
  pintar();
  const primero = $('mosaico').firstElementChild, largo = history.length;
  scrollTo(0, 900);
  dlClic($('logo-inicio'));
  ok(history.length === largo && dlDir() === dlInicio, '[inicio] ya en el inicio no suma una entrada', largo + ' -> ' + history.length);
  ok($('mosaico').firstElementChild === primero, '[inicio] y no redibuja los rubros (las fotos no vuelven a la primera)');
  ok(scrollY === 0, '[inicio] pero sube arriba de todo', scrollY);
}

/* ---- Cmd, Ctrl, Shift, Alt u otro boton: lo hace el navegador ---- */
function probarConModificadores(){
  const chip = [...document.querySelectorAll('#cats .chip')].find(b => b.dataset.cat);
  Object.assign(filtros, dlLimpios, { cat: chip.dataset.cat });
  sincronizarControles(); escribirURL(true); pintar();
  const dir = dlDir(), largo = history.length;
  [['metaKey', 'Cmd'], ['ctrlKey', 'Ctrl'], ['shiftKey', 'Shift'], ['altKey', 'Alt']].forEach(([k, n]) => {
    [['logo-inicio', 'arriba'], ['cats-logo', 'cinta']].forEach(([id, d]) => {
      const c = dlClic($(id), { [k]: true });
      ok(c && !c.prevenido && dlDir() === dir && filtros.cat === chip.dataset.cat && history.length === largo,
         '[' + n + '+clic · ' + d + '] el sitio no lo toca: el navegador abre la portada en otra pestaña', JSON.stringify(c) + ' ' + dlDir());
    });
  });
  const c = dlClic($('logo-inicio'), { button: 1 });
  ok(c && !c.prevenido && filtros.cat === chip.dataset.cat, '[rueda] el boton del medio tampoco lo toca el sitio', JSON.stringify(c));
  dlClic($('logo-inicio'));
  ok(dlEnInicio() && dlDir() === dlInicio, '[logo] y el clic comun, despues, si');
}

/* ---- El easter egg sigue contando en el triangulo ---- */
async function probarEasterEgg(){
  dlSinVentanas();
  Object.assign(filtros, dlLimpios); verTodo = false;
  try{ history.replaceState(null, '', dlInicio); }catch(e){}
  pintar();
  eggN = 0; eggUltimo = 0;
  const largo = history.length;
  $('marca-btn').click(); $('marca-btn').click(); $('marca-btn').click();
  ok(eggN === 3, '[egg] los clics en el triangulo siguen contando para el easter egg', eggN);
  ok(history.length === largo && dlDir() === dlInicio && !document.getElementById('egg'),
     '[egg] y en el inicio no suman entradas al historial', largo + ' -> ' + history.length);
  eggN = 0; eggUltimo = 0;
}

/* ---- En el celular (390 px): el de la cinta pegada, bien abajo ---- */
async function probarCelular(){
  const chip = [...document.querySelectorAll('#cats .chip')].find(b => b.dataset.cat);
  const f = document.createElement('iframe');
  f.style.cssText = 'width:390px;height:700px;border:0;position:absolute;left:-9999px;top:0';
  f.src = 'index.html?cat=' + encodeURIComponent(chip.dataset.cat) + '&q=a';
  document.body.appendChild(f);
  try{
    const listo = await dlEsperarA(() => f.contentWindow.eval('MODELOS.length && FUENTE') &&
                                        f.contentDocument.querySelectorAll('#cats .chip').length, 40000);
    ok(listo, '[390] el celular abre el rubro con busqueda');
    if(!listo) return;
    const w = f.contentWindow, doc = f.contentDocument;
    try{ w.pararOfertas?.(); w.pararPaseos?.(); w.pararMundos?.(); }catch(e){}
    const a = doc.getElementById('logo-inicio'), c = doc.getElementById('cats-logo');
    ok(a && a.getBoundingClientRect().width > 0 && c && c.getBoundingClientRect().width > 0, '[390] los dos logos se ven');
    w.scrollTo(0, 1800);
    const pegada = await dlEsperarA(() => Math.abs(c.getBoundingClientRect().top) <= 2 && w.scrollY > 1000, 5000);
    ok(pegada, '[390] bajando, el logo de la cinta queda pegado arriba', Math.round(c.getBoundingClientRect().top) + ' y=' + Math.round(w.scrollY));
    const r = c.getBoundingClientRect();
    ok(doc.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('#cats-logo') === c,
       '[390] y se puede tocar (nada lo tapa)');
    let prev = null;
    w.addEventListener('click', e => { prev = e.defaultPrevented; e.preventDefault(); });
    c.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, view: w }));
    const fue = await dlEsperarA(() => w.scrollY === 0 && w.eval('enPortada()'), 3000);
    ok(prev === true && fue && w.location.search === '' && w.location.hash === '',
       '[390] tocarlo lleva al inicio, arriba de todo y con la direccion limpia',
       prev + ' y=' + w.scrollY + ' ' + w.location.search);
    ok(doc.getElementById('q').value === '' && !doc.querySelector('.topbar').classList.contains('buscando'),
       '[390] con el buscador cerrado y vacio');
  } finally {
    f.remove();
  }
}
