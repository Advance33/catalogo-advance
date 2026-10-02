// Decisiones 4.1, 4.3, 4.4 y 4.5 de Pedro (29/09/2026), y la parte de la web
// de la 4.2: cuatro agregados a la ficha. Muestra: muestras/auditoria/ficha.html.
// Pedro eligio la recomendada en todas: 1B 2B 3C 4B 5B.
//   4.1 B  boton Compartir: icono redondo arriba, al lado de la X, con el
//          mismo estilo y 8 px de aire. Manda el nombre con la version y el
//          color que se mira, y el link publico, sin precio. En el celular
//          abre el menu Compartir del telefono (navigator.share); en la compu
//          copia y avisa "Link copiado". En el celular va pegado arriba con
//          la X (2.8 B)
//   4.2 B  (la parte de la web) el link es la pagina de vista previa de la
//          fila, https://advance33.github.io/catalogo-advance/p/<ID>.html, si
//          p/indice.json la nombra (se lee una vez, con tope de tiempo); si
//          no, el #p=<ID> de siempre
//   4.3 C  "Ver las N versiones": la lista de todas las filas, partida por
//          memoria como las pestanas, con precio y stock tal cual; arranca
//          cerrada, solo en modelos con 6 versiones o mas, y tocar un renglon
//          elige esa fila
//   4.4 B  visor a pantalla completa en la compu y en el celular: lupa en la
//          foto (o tocar la foto), fondo claro de la ficha, se cierra con la
//          X, tocando afuera, con Esc o con el Atras; sin galeria
//   4.5 B  un #p= con un ID viejo abre el producto de hoy (CATALOGO.ids) y la
//          direccion pasa al ID nuevo; si el producto ya no esta, la
//          ventanita "Ya no esta" con "Escribinos por WhatsApp" (el mensaje
//          del boton flotante) y "Ver el catalogo", y el #p= sale de la
//          direccion. Con la copia del navegador no se da nada de baja
// Los casos de la muestra (iPhone 17 Pro CEL-APP-068, #p=NB-APP-104 y
// #p=AUD-APP-005) se usan si hoy siguen siendo ese caso; si no, se busca otro
// en los datos del dia. El celular se mira en un iframe de 390 x 664 (el
// headless no baja de 500).
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);

const esperaDF = setInterval(() => {
  if(!MODELOS.length || !FUENTE || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperaDF);
  for(let i=1;i<5000;i++) clearInterval(i);
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; })
    .finally(() => {
      try{ dfRestaurar(); }catch(e){}
      try{ if(cerrarVisorDOM){ visorEmpujado = false; const c = cerrarVisorDOM; cerrarVisorDOM = null; c(); } }catch(e){}
      try{ quitarFicha(); }catch(e){}
      try{ document.getElementById('ya-no-esta')?.remove(); }catch(e){}
      try{ pararPaseos(); pararOfertas(); pararMundos(); }catch(e){}
      for(let i=1;i<5000;i++) clearInterval(i);
      const pre=document.createElement('pre'); pre.id='RESULTADO';
      pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
      document.body.appendChild(pre);
    });
}, 150);

const dfDormir = ms => new Promise(r => setTimeout(r, ms));
async function dfEsperarA(cond, ms = 25000){
  const t0 = Date.now();
  while(Date.now() - t0 < ms){
    try{ if(cond()) return true; }catch(e){}
    await dfDormir(150);
  }
  return false;
}
/* Esperar a que se asiente lo que se mide, con tope, y no un tiempo fijo
   (29/09). Las ventanas entran con una animacion (cajaIn: .3 s con
   scale(.97)) y, con la suite entera corriendo a la vez, un tiempo fijo a
   veces no alcanzaba: getBoundingClientRect medía la ventana a medio entrar
   (en decision-tarjeta, el pie de 114 px daba 111 = 114 x .97 y [2.7]
   fallaba de a ratos). dfQuieto espera, cuadro a cuadro, a que no quede
   ninguna animacion o transicion con final andando adentro de `raiz`; si al
   tope siguen, las termina (finish) para medir el estado final. dfHasta
   espera una condicion cuadro a cuadro (lo que depende de un ResizeObserver
   o de un repintado cambia recien en un cuadro). */
const dfCuadro = (w = window) => new Promise(r => {
  let ya = false; const fin = () => { if(!ya){ ya = true; r(); } };
  try{ w.requestAnimationFrame(fin); }catch(e){}
  setTimeout(fin, 50);                     // por si ese documento no dibuja
});
async function dfQuieto(raiz, ms = 3000){
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
    await dfCuadro(w);
  }
  andando().forEach(a => { try{ a.finish(); }catch(e){} });
  await dfCuadro(w);
  return false;
}
async function dfHasta(cond, w = window, ms = 3000){
  const t0 = Date.now();
  do{ try{ if(cond()) return true; }catch(e){} await dfCuadro(w); } while(Date.now() - t0 < ms);
  try{ return !!cond(); }catch(e){ return false; }
}
const dfTxt = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
const dfCerca = (a, b, tol = 1.5) => Math.abs(a - b) <= tol;

/* Lo que la tanda pisa (el portapapeles, navigator.share, matchMedia) se
   devuelve siempre, pase lo que pase */
const dfOriginal = { matchMedia: window.matchMedia };
function dfRestaurar(){
  try{ delete navigator.clipboard; }catch(e){}
  try{ delete navigator.share; }catch(e){}
  window.matchMedia = dfOriginal.matchMedia;
}
let dfCopiado = null;
function dfPisarPortapapeles(){
  dfCopiado = null;
  Object.defineProperty(navigator, 'clipboard', { configurable: true,
    value: { writeText: async t => { dfCopiado = t; } } });
}
// "Es un celular": (pointer: coarse) da true, lo demas como siempre
function dfComoCelular(){
  window.matchMedia = q => /pointer:\s*coarse/.test(q)
    ? { matches: true, media: q, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} }
    : dfOriginal.matchMedia.call(window, q);
}

/* La fila de la muestra: el iPhone 17 Pro 256GB E-Sim Orange. Se busca por
   su forma y no por su ID (29/09, revision): los IDs rotan y CEL-APP-068
   puede pasar a ser otro producto, otro color o salir. null si hoy no esta. */
function dfMuestra(){
  const es = p => !!p && p.marca === 'Apple' && /^iPhone 17 Pro 256GB E-Sim\b/i.test(p.desc || '') && norm(p.color || '') === 'orange';
  const p068 = buscarProducto('CEL-APP-068');
  return es(p068) ? p068 : (PRODUCTOS.find(es) || null);
}
// El modelo de la muestra (iPhone 17 Pro) si tiene las versiones de la lista
// (4.3); si no, uno con muchas versiones y stock
function dfModeloGrande(){
  const mu = dfMuestra(), mm = mu && buscarModelo(clave(mu));
  if(mm && mm.variantes.length >= TODAS_DESDE) return mm;
  return MODELOS.find(m => m.multi && m.stock && m.variantes.length >= TODAS_DESDE && /data-mem=/.test(htmlOpcionesFicha(m, m.rep)))
      || MODELOS.find(m => m.multi && m.variantes.length >= TODAS_DESDE);
}
// La clave con que se abre: la fila de la muestra si es de ese modelo
function dfClaveDe(m){
  const mu = dfMuestra();
  return mu && buscarModelo(clave(mu)) === m ? clave(mu) : clave(m.rep);
}
// Abre la ficha como la abre el cliente desde un link (escribe el #p=)
/* montarModal enfoca la caja en un requestAnimationFrame. Con el reloj
   virtual de las pruebas los cuadros casi no corren, y ese foco llegaba
   cuando ya se estaba mirando otra cosa (el visor, un renglon). Mientras se
   abre la ficha, el cuadro corre enseguida, como en un navegador de verdad. */
async function dfAbrir(k){
  quitarFicha();
  const raf = window.requestAnimationFrame;
  window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 0);
  try{ abrirFicha(k, false); } finally { window.requestAnimationFrame = raf; }
  // La entrada de la caja (cajaIn) es una animacion de .3 s: se espera a
  // que termine, con tope, y no 500 ms fijos (29/09)
  await dfQuieto(document.getElementById('ficha'));
  return document.getElementById('ficha');
}

async function correrPruebas(){
  const pedidoAntes = PEDIDO.slice();
  try{
    await probarCompartirEnLaCompu();    // 4.1 y 4.2
    await probarCompartirEnElCelular();  // 4.1 (navigator.share)
    await probarTodasLasVersiones();     // 4.3
    await probarVisor();                 // 4.4
    probarLinksViejos();                 // 4.5 (la regla)
    await probarLinkQueEspera();         // 4.5 (con la copia se espera)
    await probarCelular();               // 4.1, 4.4 y 4.5 a 390 px
  } finally {
    dfRestaurar();
    PEDIDO = pedidoAntes; guardarPedido(); pintarPedido();
    quitarFicha(); escribirURL(false);
  }
}

/* ---- 4.1 B y 4.2 B en la compu ---- */
async function probarCompartirEnLaCompu(){
  const m = dfModeloGrande();
  ok(!!m, '[4.1] hay un modelo con varias versiones para mirar', m && m.rep.id);
  if(!m) return;
  const k0 = dfClaveDe(m);
  const d = await dfAbrir(k0);
  const X = d.querySelector('.caja > .fi-cerrar'), C = d.querySelector('.caja > .fi-compartir');
  ok(!!C && C.tagName === 'BUTTON' && C.getAttribute('aria-label') === 'Compartir' && !!C.querySelector('svg'),
     '[4.1] la ficha tiene el boton Compartir, un icono con nombre para el lector', C && C.outerHTML.slice(0, 80));
  if(!C || !X) return;
  /* (29/09, revision) En el HTML va ANTES que la X: en pantalla esta a su
     izquierda y el Tab los recorre de izquierda a derecha, como se ven */
  ok(C.nextElementSibling === X, '[4.1] va al lado de la X (antes que ella en el HTML: el Tab sigue el orden de la pantalla)');
  // Con mouse el :hover; con el dedo no queda pintado despues del toque
  const reglas = sel => {
    const out = [];
    const mirar = (lista, media) => { for(const r of lista){
      if(r.cssRules && r.media) mirar(r.cssRules, r.conditionText || r.media.mediaText);
      else if(r.selectorText && r.selectorText.split(',').some(x => x.trim() === sel)) out.push(media || '');
    } };
    for(const h of document.styleSheets){ try{ mirar(h.cssRules, ''); }catch(e){} }
    return out;
  };
  const hov = ['.fi-compartir:hover', '.fi-lupa:hover'].map(sel => [sel, reglas(sel)]);
  ok(hov.every(([, ms]) => ms.length > 0 && ms.every(x => /hover:\s*hover/.test(x))),
     '[4.1/4.4] el :hover de Compartir y de la lupa va solo con mouse (@media (hover:hover)): en el celular no quedan violetas',
     hov.map(([sel, ms]) => sel + ' ' + (ms.join(' / ') || 'sin regla')).join(' · '));
  const cx = getComputedStyle(X), cc = getComputedStyle(C);
  const mismo = ['position','top','width','height','borderRadius','backgroundColor','borderTopColor','borderTopWidth','color']
    .filter(p => cx[p] !== cc[p]);
  ok(!mismo.length, '[4.1] mismo estilo que la X (redondo, 34 px, mismo fondo y borde)', mismo.join(',') || cc.width + ' ' + cc.borderRadius);
  const rx = X.getBoundingClientRect(), rc = C.getBoundingClientRect();
  ok(dfCerca(rx.top, rc.top) && dfCerca(rx.left - rc.right, 8), '[4.1] a la misma altura y con 8 px de aire',
     Math.round(rx.top - rc.top) + ' / ' + (rx.left - rc.right).toFixed(1) + ' px');
  // El nombre y la marca no quedan abajo de los dos botones
  for(const sel of ['.fi-marca', '.fi-nombre']){
    const el = d.querySelector('.fi-datos ' + sel);
    if(!el) continue;
    const r = el.getBoundingClientRect(), pr = parseFloat(getComputedStyle(el).paddingRight);
    ok(r.right - pr <= rc.left + 1, '[4.1] ' + sel + ' deja lugar a Compartir', Math.round(r.right - pr) + ' <= ' + Math.round(rc.left));
  }

  // 4.2: el indice de p/ se lee una vez y con tope de tiempo
  ok(paginasDeVistaPrevia() === paginasDeVistaPrevia(), '[4.2] p/indice.json se pide una sola vez por visita');
  ok(PAGINAS_P_ESPERA_MS > 0 && PAGINAS_P_ESPERA_MS <= 10000 && /conTope\(PAGINAS_P_ESPERA_MS/.test(paginasDeVistaPrevia.toString()),
     '[4.2] y con tope de tiempo', PAGINAS_P_ESPERA_MS + ' ms');
  const ids = await paginasDeVistaPrevia();
  let deVerdad = null;
  try{ deVerdad = (await (await fetch('p/indice.json', { cache: 'no-store' })).json()).ids; }catch(e){}
  ok(Array.isArray(deVerdad) && ids.size === new Set(deVerdad).size && deVerdad.every(x => ids.has(x)),
     '[4.2] la web leyo p/indice.json entero', ids.size + ' de ' + (deVerdad ? deVerdad.length : '?'));

  // Tocar Compartir en la compu: copia el texto y el link, y lo avisa
  dfPisarPortapapeles();
  const p = buscarProducto(FICHA);
  C.click();
  await dfEsperarA(() => dfCopiado !== null && document.getElementById('brindis')?.classList.contains('ver'), 5000);
  const esperado = textoParaCompartir(p, COLOR_FICHA) + '\n' + URL_PUBLICA +
    (ids.has(FICHA) ? 'p/' + encodeURIComponent(FICHA) + '.html' : '#p=' + encodeURIComponent(FICHA));
  ok(dfCopiado === esperado, '[4.1] copia el nombre y el link de la fila que se mira', JSON.stringify(dfCopiado));
  const b = document.getElementById('brindis');
  const rb = b && b.getBoundingClientRect();
  ok(!!b && dfTxt(b) === 'Link copiado' && b.classList.contains('ver') && b.getAttribute('role') === 'status'
     && rb.width > 0 && rb.bottom <= innerHeight && Number(getComputedStyle(b).zIndex) > Number(getComputedStyle(d).zIndex),
     '[4.1] y avisa "Link copiado" a la vista, encima de la ficha', b && (dfTxt(b) + ' z' + getComputedStyle(b).zIndex));
  const [nombre = '', link = ''] = String(dfCopiado || '').split('\n');
  ok(link.startsWith('https://advance33.github.io/catalogo-advance/') && !/localhost|127\.0\.0\.1|file:/.test(dfCopiado || ''),
     '[4.1] el link es siempre el publico, aunque se abra desde la compu local', link);
  ok(!/USD|\$|\d\.\d{3}/.test(nombre), '[4.1] sin precio', nombre);
  const partes = partesMensaje(p, COLOR_FICHA);
  ok(nombre.startsWith(textoMensaje(partes)) && (!partes.color || nombre.endsWith('(' + partes.color + ')')),
     '[4.1] el nombre lleva la version y el color que se mira', nombre);
  const mu = dfMuestra();
  if(mu && FICHA === clave(mu))
    ok(/^Apple iPhone 17 Pro 256GB E-Sim \(Orange\)$/.test(nombre), '[4.1] el caso de la muestra', nombre);
  else info('[4.1] hoy no esta el iPhone 17 Pro 256GB E-Sim Orange de la muestra: se miro ' + FICHA);
  // 4.2: el link de la pagina existe y lleva a esa ficha
  if(ids.has(FICHA)){
    ok(link === URL_PUBLICA + 'p/' + encodeURIComponent(FICHA) + '.html', '[4.2] con pagina de vista previa, el link es p/<ID>.html', link);
    let html = '';
    try{ const r = await fetch('p/' + encodeURIComponent(FICHA) + '.html', { cache: 'no-store' }); html = r.ok ? await r.text() : ''; }catch(e){}
    ok(html.includes('#p=' + FICHA) && /og:image/.test(html), '[4.2] y esa pagina existe y lleva a esta ficha', html.length + ' letras');
  } else info('[4.2] ' + FICHA + ' todavia no tiene pagina: va el #p=');
  // Sin pagina, el #p= de siempre; el ID va codificado
  ok(linkParaCompartir('ZZZ-NO-ESTA-999', ids) === URL_PUBLICA + '#p=ZZZ-NO-ESTA-999' &&
     linkParaCompartir('A B/1', new Set(['A B/1'])) === URL_PUBLICA + 'p/A%20B%2F1.html' &&
     linkParaCompartir('A B/1', null) === URL_PUBLICA + '#p=A%20B%2F1',
     '[4.2] si la fila no tiene pagina (o no se pudo leer el indice), el #p= de siempre, y el ID codificado');

  // Otra version: el link sigue a la fila elegida
  const otra = [...d.querySelectorAll('.fi-op')].find(o => o.getAttribute('aria-pressed') !== 'true' && !o.classList.contains('agotada'));
  if(otra){
    otra.click();
    await dfDormir(200);
    dfCopiado = null;
    d.querySelector('.caja > .fi-compartir').click();
    await dfEsperarA(() => dfCopiado !== null, 5000);
    ok(String(dfCopiado).endsWith(ids.has(FICHA) ? 'p/' + encodeURIComponent(FICHA) + '.html' : '#p=' + encodeURIComponent(FICHA))
       && !String(dfCopiado).includes(k0 + '.html') && FICHA !== k0,
       '[4.1] al elegir otra version, se comparte esa', FICHA + ' · ' + String(dfCopiado).split('\n')[1]);
  } else info('[4.1] el modelo no tiene otra pestana con stock');
  dfRestaurar();
}

/* ---- 4.1 B en el celular: el menu Compartir del telefono ---- */
async function probarCompartirEnElCelular(){
  const m = dfModeloGrande();
  if(!m) return;
  const d = await dfAbrir(clave(m.rep));
  let datos = null, error = null;
  dfPisarPortapapeles();
  dfComoCelular();
  Object.defineProperty(navigator, 'share', { configurable: true, value: async x => { datos = x; if(error) throw error; } });
  d.querySelector('.caja > .fi-compartir').click();
  await dfEsperarA(() => datos !== null, 5000);
  const ids = await paginasDeVistaPrevia();
  const link = linkParaCompartir(FICHA, ids);
  ok(!!datos && datos.url === link && datos.text === textoParaCompartir(buscarProducto(FICHA), COLOR_FICHA),
     '[4.1] en el celular abre el menu Compartir con el nombre y el link', JSON.stringify(datos));
  await dfDormir(300);
  ok(dfCopiado === null, '[4.1] y no copia nada (el menu del telefono ya se ve)');
  // Si el cliente cierra el menu, nada; si el telefono no deja, se copia
  datos = null; dfCopiado = null;
  error = new DOMException('cancelado', 'AbortError');
  d.querySelector('.caja > .fi-compartir').click();
  await dfEsperarA(() => datos !== null, 5000); await dfDormir(300);
  ok(dfCopiado === null, '[4.1] si lo cierra sin elegir, no pasa nada mas');
  datos = null; dfCopiado = null;
  error = new DOMException('no', 'NotAllowedError');
  d.querySelector('.caja > .fi-compartir').click();
  await dfEsperarA(() => dfCopiado !== null, 5000);
  ok(dfCopiado && dfCopiado.endsWith(link), '[4.1] si el telefono no lo deja compartir, se copia', dfCopiado);
  // En la compu no se usa el menu aunque el navegador lo tenga (como la muestra)
  window.matchMedia = dfOriginal.matchMedia;
  datos = null; dfCopiado = null; error = null;
  d.querySelector('.caja > .fi-compartir').click();
  await dfEsperarA(() => dfCopiado !== null, 5000);
  ok(datos === null && dfCopiado !== null, '[4.1] en la compu copia aunque exista navigator.share');
  dfRestaurar();
}

/* ---- 4.3 C Todas las versiones ---- */
async function probarTodasLasVersiones(){
  const grandes = MODELOS.filter(m => m.multi && m.variantes.length >= TODAS_DESDE);
  ok(TODAS_DESDE === 6, '[4.3] la lista va en los modelos con 6 versiones o mas', TODAS_DESDE);
  info('[4.3] hoy son ' + grandes.length + ' modelos (la muestra decia 26)');
  // Donde va y donde no
  const mal = MODELOS.filter(m => m.multi).filter(m => {
    const h = htmlTodasFicha(m, m.rep);
    return (m.variantes.length >= TODAS_DESDE) !== /class="fi-todas"/.test(h);
  });
  ok(!mal.length, '[4.3] esta en todos los de 6 o mas y en ninguno de menos', mal.slice(0, 5).map(m => m.rep.id).join(', '));
  // Todas las filas, una vez cada una, en todos los modelos
  const rotas = grandes.filter(m => {
    const caja = document.createElement('div');
    caja.innerHTML = htmlTodasFicha(m, m.rep);
    const ks = [...caja.querySelectorAll('.fi-fila')].map(b => b.dataset.k);
    return ks.length !== m.variantes.length || new Set(ks).size !== ks.length || !m.variantes.every(v => ks.includes(clave(v)));
  });
  ok(!rotas.length, '[4.3] cada fila de ADVAPP es un renglon, sin perder ni repetir ninguna', rotas.map(m => m.rep.id).join(', '));
  // El orden adentro de cada grupo, en todos los modelos: stock primero, despues precio
  const desordenados = grandes.filter(m => {
    const caja = document.createElement('div');
    caja.innerHTML = htmlTodasFicha(m, m.rep);
    let prev = null;
    for(const el of caja.querySelector('.fi-lista').children){
      if(el.classList.contains('fi-grupo')){ prev = null; continue; }
      const v = buscarProducto(el.dataset.k);
      if(prev && v && ((!prev.stock && v.stock) || (!!prev.stock === !!v.stock && (prev.precio ?? Infinity) > (v.precio ?? Infinity)))) return true;
      prev = v;
    }
    return false;
  });
  ok(!desordenados.length, '[4.3] en todos, adentro de cada grupo primero lo que tiene stock y despues por precio',
     desordenados.map(m => m.rep.id).join(', ') || grandes.length + ' modelos');

  const m = dfModeloGrande();
  if(!m) return;
  const d = await dfAbrir(clave(m.rep));
  let t = d.querySelector('.fi-datos .fi-todas');
  ok(!!t && t.tagName === 'DETAILS' && !t.open, '[4.3] en la ficha, cerrada al abrir');
  if(!t) return;
  const hay = m.variantes.filter(v => v.stock).length;
  const sum = dfTxt(t.querySelector('summary'));
  ok(sum.replace(/\s+/g, '') === `Verlas${m.variantes.length}versiones${hay}constock` &&
     dfTxt(t.querySelector('summary .cuenta')) === `${hay} con stock`,
     '[4.3] "Ver las N versiones" con cuantas tienen stock', sum);
  const ejes = t.previousElementSibling;
  ok(ejes && ejes.classList.contains('fi-ejes'), '[4.3] va justo debajo de las pestanas');
  t.open = true;
  await dfDormir(100);
  // Los grupos son las pestanas de Memoria, en el mismo orden
  const mems = [...d.querySelectorAll('.fi-ops[data-eje="memoria"] .fi-op b')].map(dfTxt);
  const grupos = [...t.querySelectorAll('.fi-grupo')].map(dfTxt);
  if(mems.length) ok(JSON.stringify(mems) === JSON.stringify(grupos), '[4.3] partida por memoria, como las pestanas', grupos.join(' · '));
  else info('[4.3] este modelo no tiene pestana de memoria: ' + grupos.join(' · '));
  // Adentro: primero lo que tiene stock, despues por precio; precio y stock tal cual
  let orden = true, datos = true, pintas_ = true, cual = '';
  let prev = null;
  for(const el of t.querySelector('.fi-lista').children){
    if(el.classList.contains('fi-grupo')){ prev = null; continue; }
    const v = buscarProducto(el.dataset.k);
    if(!v){ datos = false; cual = el.dataset.k; continue; }
    if(dfTxt(el.querySelector('.p')) !== precioUSD(v) || el.classList.contains('agotada') === !!v.stock
       || dfTxt(el.querySelector('.q i')) !== (v.stock ? 'En stock' : 'Sin stock')){ datos = false; cual = v.id; }
    const hexes = pintas(v.color).filter(c => c.hex).map(c => c.hex.toLowerCase());
    const puestos = [...el.querySelectorAll('.pinta')].map(s => s.getAttribute('style').replace(/^background:/, '').toLowerCase());
    if(JSON.stringify(hexes) !== JSON.stringify(puestos)){ pintas_ = false; cual = v.id; }
    if(prev && ((!prev.stock && v.stock) || (prev.stock === v.stock && (prev.precio ?? Infinity) > (v.precio ?? Infinity)))){ orden = false; cual = prev.id + ' > ' + v.id; }
    prev = v;
  }
  ok(orden, '[4.3] adentro de cada memoria, primero lo que tiene stock y despues por precio', cual);
  ok(datos, '[4.3] cada renglon con su precio y su stock tal cual', cual);
  ok(pintas_, '[4.3] el puntito solo con un color que sabemos pintar (no se inventa)', cual);
  const muL = dfMuestra();
  if(muL && buscarModelo(clave(muL)) === m){
    const r068 = t.querySelector(`.fi-fila[data-k="${CSS.escape(clave(muL))}"] .t`);
    // La versión ("E-Sim") va sólo si en esa memoria hay más de una. Desde el
    // 02/10 ADVAPP separó el 17 Pro Sim (otro SKU madre): en 256GB quedan sólo
    // E-Sim y el renglón dice "Orange" a secas, que también está bien
    const memMu = memoriaDeOpcion(muL.opcion || muL.etiqueta || '');
    const hermanas = new Set(m.variantes.filter(x => memoriaDeOpcion(x.opcion || x.etiqueta || '') === memMu)
      .map(x => x.opcion || x.etiqueta || ''));
    const espera = hermanas.size > 1 ? 'E-Sim · Orange' : 'Orange';
    ok(dfTxt(r068) === espera, '[4.3] el renglon de la muestra: "' + espera + '" en 256GB', dfTxt(r068));
  } else info('[4.3] hoy la lista no es la del iPhone 17 Pro de la muestra: no se mira su renglon');
  ok(t.querySelector('.fi-fila[aria-pressed="true"]')?.dataset.k === FICHA, '[4.3] el renglon de la fila que se mira va marcado');

  // Tocar un renglon de otra memoria la elige, y la lista sigue abierta
  const actual = FICHA;
  const destino = [...t.querySelectorAll('.fi-fila:not(.agotada)')].find(b => {
    const v = buscarProducto(b.dataset.k);
    return v && memoriaDeOpcion(v.opcion || '') !== memoriaDeOpcion(buscarProducto(actual).opcion || '');
  }) || [...t.querySelectorAll('.fi-fila')].find(b => b.dataset.k !== actual);
  if(destino){
    const k = destino.dataset.k, v = buscarProducto(k);
    destino.focus();
    destino.click();
    const foco = document.activeElement;
    await dfDormir(200);
    t = d.querySelector('.fi-datos .fi-todas');
    ok(FICHA === k, '[4.3] tocar un renglon elige esa fila', FICHA + ' ← ' + k);
    ok(dfTxt(d.querySelector('.fi-precio .usd')) === precioUSD(v), '[4.3] cambia el precio', dfTxt(d.querySelector('.fi-precio .usd')));
    const memV = memoriaDeOpcion(v.opcion || '');
    const pestana = d.querySelector('.fi-ops[data-eje="memoria"] .fi-op[aria-pressed="true"] b');
    if(pestana) ok(dfTxt(pestana) === memV, '[4.3] cambian las pestanas', dfTxt(pestana));
    else info('[4.3] este modelo no tiene pestana de memoria');
    ok(dfTxt(d.querySelector('#fi-elegido')).includes(memV || ''), '[4.3] cambia el "Estas eligiendo"', dfTxt(d.querySelector('#fi-elegido')));
    const colores = partirColores(v.color);
    if(colores.length === 1) ok(norm(COLOR_FICHA) === norm(colores[0]), '[4.3] con el color de ese renglon', COLOR_FICHA);
    ok(!!t && t.open, '[4.3] y la lista sigue abierta');
    ok(foco && foco.isConnected && foco.matches('.fi-fila[aria-pressed="true"]') && foco.dataset.k === k,
       '[4.3] el foco queda en el renglon elegido', foco && foco.className);
    ok(location.hash === '#p=' + encodeURIComponent(k), '[4.3] y el link apunta a esa fila', location.hash);
    refrescarFichaAbierta();
    ok(d.querySelector('.fi-datos .fi-todas')?.open, '[4.3] un refresco con la ficha abierta no la cierra');
  }
  // Al volver a abrir la ficha, arranca cerrada
  const d2 = await dfAbrir(clave(m.rep));
  ok(!d2.querySelector('.fi-todas').open, '[4.3] cada ficha nueva la trae cerrada');

  // Sin pestana de memoria: partida por version; sin pestanas: sin grupos
  const porVersion = grandes.find(x => /class="fi-eje"/.test(htmlOpcionesFicha(x, x.rep)) && !/data-mem=/.test(htmlOpcionesFicha(x, x.rep)));
  if(porVersion){
    const caja = document.createElement('div');
    caja.innerHTML = htmlOpcionesFicha(porVersion, porVersion.rep) + htmlTodasFicha(porVersion, porVersion.rep);
    const tabs = [...caja.querySelectorAll('.fi-op b')].map(dfTxt);
    const gs = [...caja.querySelectorAll('.fi-grupo')].map(dfTxt);
    ok(gs.length === tabs.length && tabs.every(x => gs.includes(x)), '[4.3] sin pestana de memoria, partida por version como sus pestanas',
       porVersion.rep.id + ': ' + gs.join(' · '));
  } else info('[4.3] hoy no hay modelo de 6+ con una sola fila de pestanas');
  const sinTabs = grandes.find(x => !htmlOpcionesFicha(x, x.rep));
  if(sinTabs){
    const caja = document.createElement('div');
    caja.innerHTML = htmlTodasFicha(sinTabs, sinTabs.rep);
    ok(!caja.querySelector('.fi-grupo') && caja.querySelectorAll('.fi-fila').length === sinTabs.variantes.length,
       '[4.3] sin pestanas (las versiones son colores), una lista sin grupos', sinTabs.rep.id);
  } else info('[4.3] hoy no hay modelo de 6+ sin pestanas');
}

/* ---- 4.4 B El visor ---- */
async function probarVisor(){
  const g = dfModeloGrande();
  const m = g && g.rep.imagenGrande ? g : MODELOS.find(x => x.multi && x.stock && x.rep.imagenGrande);
  ok(!!m, '[4.4] hay un modelo con foto para mirar', m && m.rep.id);
  if(!m) return;
  const d = await dfAbrir(clave(m.rep));
  const marco = d.querySelector('.fi-marco');
  const lupa = marco && marco.querySelector('.fi-lupa');
  const foto = marco && marco.querySelector(':scope > img');
  ok(!!lupa && lupa.getAttribute('aria-label') === 'Ver la foto en grande' && getComputedStyle(lupa).display !== 'none',
     '[4.4] la foto tiene la lupa, con nombre para el lector', lupa && getComputedStyle(lupa).display);
  if(!lupa || !foto) return;
  await dfEsperarA(() => foto.complete && foto.naturalWidth > 0, 8000);
  const rf = foto.getBoundingClientRect(), rl = lupa.getBoundingClientRect(), rm = marco.getBoundingClientRect();
  ok(dfCerca(rl.left, rm.left) && dfCerca(rl.bottom, rm.bottom), '[4.4] abajo a la izquierda de la foto',
     Math.round(rl.left - rm.left) + ' / ' + Math.round(rm.bottom - rl.bottom));
  ok(getComputedStyle(foto).cursor === 'zoom-in', '[4.4] la foto avisa que se agranda (cursor)', getComputedStyle(foto).cursor);
  // Sin foto no hay lupa
  const vacio = document.createElement('div');
  vacio.className = 'fi-marco';
  vacio.innerHTML = htmlFoto({ marca: 'X' }, '', true) + htmlLupa();
  marco.parentElement.appendChild(vacio);
  ok(getComputedStyle(vacio.querySelector('.fi-lupa')).display === 'none', '[4.4] sin foto no hay lupa');
  vacio.remove();

  const estadoAntes = history.state;
  lupa.focus();
  lupa.click();
  await dfDormir(150);
  let v = document.getElementById('visor');
  ok(!!v && v.getAttribute('role') === 'dialog' && v.getAttribute('aria-modal') === 'true',
     '[4.4] la lupa abre el visor');
  if(!v) return;
  const im = v.querySelector('img');
  await dfEsperarA(() => im.complete && im.naturalWidth > 0, 8000);
  const rv = v.getBoundingClientRect(), ri = im.getBoundingClientRect();
  const cv = getComputedStyle(v);
  ok(cv.position === 'fixed' && dfCerca(rv.width, innerWidth, 2) && dfCerca(rv.height, innerHeight, 2)
     && Number(cv.zIndex) > Number(getComputedStyle(d).zIndex), '[4.4] a pantalla completa, encima de la ficha', Math.round(rv.width) + 'x' + Math.round(rv.height));
  const fondo = getComputedStyle(document.documentElement).getPropertyValue('--ficha-bg').trim();
  const prueba = document.createElement('i'); prueba.style.color = fondo; document.body.appendChild(prueba);
  const fondoRGB = getComputedStyle(prueba).color; prueba.remove();
  ok(cv.backgroundColor === fondoRGB, '[4.4] con el fondo claro de la ficha', cv.backgroundColor + ' = ' + fondo);
  ok(im.getAttribute('src') === foto.getAttribute('src') || im.src === foto.currentSrc, '[4.4] es la misma foto de la ficha', im.getAttribute('src'));
  ok(ri.width > rf.width * 1.4 && ri.width <= 901 && ri.height <= innerHeight, '[4.4] mucho mas grande (hasta 900 px) y entera en la pantalla',
     Math.round(rf.width) + ' → ' + Math.round(ri.width) + ' px');
  const p = buscarProducto(FICHA);
  const rot = dfTxt(v.querySelector('.visor-rot'));
  ok(rot === [p.marca, partirNombreFicha(m, p).nombre, COLOR_FICHA].filter(Boolean).join(' · '), '[4.4] arriba, la marca, el modelo y el color', rot);
  ok(dfTxt(v.querySelector('.visor-pie')) === 'Tocá afuera o apretá Esc para cerrar', '[4.4] en la compu dice como se cierra', dfTxt(v.querySelector('.visor-pie')));
  ok(!v.querySelector('.flecha, [data-galeria], .vi img + img'), '[4.4] sin galeria ni flechas');
  ok(/pinch-zoom/.test(getComputedStyle(im).touchAction), '[4.4] la foto se deja pellizcar', getComputedStyle(im).touchAction);
  const X = v.querySelector('.fi-cerrar');
  ok(document.activeElement === X, '[4.4] el foco va a la X del visor',
     document.activeElement && (document.activeElement.className || document.activeElement.tagName));
  // Si algo manda el foco a la ficha de atras (su caja se enfoca sola al
  // abrirla), vuelve a la X
  d.querySelector('.caja').focus();
  ok(document.activeElement === X, '[4.4] el foco no se va a la ficha de atras', document.activeElement && document.activeElement.className);
  // Tab no se escapa a la ficha de atras: parado en algo de atras, vuelve a la X
  lupa.focus();
  const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  lupa.dispatchEvent(tab);
  ok(document.activeElement === X && tab.defaultPrevented, '[4.4] el Tab no sale del visor', document.activeElement && document.activeElement.className);
  // Tocar la foto no cierra
  im.click();
  await dfDormir(100);
  ok(!!document.getElementById('visor'), '[4.4] tocar la foto no la cierra');
  ok(!!(history.state && history.state.visor), '[4.4] suma una entrada al historial (el Atras lo cierra)', JSON.stringify(history.state));
  // Esc cierra el visor y deja la ficha
  X.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await dfEsperarA(() => !document.getElementById('visor'), 3000);
  ok(!document.getElementById('visor') && !!document.getElementById('ficha') && FICHA === clave(m.rep),
     '[4.4] Esc cierra el visor y la ficha sigue abierta');
  await dfDormir(200);
  ok(document.activeElement === lupa, '[4.4] el foco vuelve a la lupa', document.activeElement && document.activeElement.className);
  ok(JSON.stringify(history.state) === JSON.stringify(estadoAntes), '[4.4] y el historial queda como estaba', JSON.stringify(history.state));
  // Tocar la foto de la ficha lo abre; tocar afuera lo cierra
  d.querySelector('.fi-marco > img').click();
  await dfDormir(150);
  v = document.getElementById('visor');
  ok(!!v, '[4.4] tocar la foto de la ficha tambien lo abre');
  if(v){
    v.click();
    await dfEsperarA(() => !document.getElementById('visor'), 3000);
    ok(!document.getElementById('visor') && !!document.getElementById('ficha'), '[4.4] tocar afuera lo cierra');
  }
  // La X
  lupa.click(); await dfDormir(150);
  v = document.getElementById('visor');
  ok(!!v, '[4.4] la lupa lo vuelve a abrir');
  if(v){
    v.querySelector('.fi-cerrar').click();
    await dfEsperarA(() => !document.getElementById('visor'), 3000);
    ok(!document.getElementById('visor') && !!document.getElementById('ficha'), '[4.4] la X lo cierra');
  }
  // El Atras
  lupa.click(); await dfDormir(150);
  ok(!!document.getElementById('visor'), '[4.4] y otra vez, para el Atras');
  if(document.getElementById('visor')){
    history.back();
    await dfEsperarA(() => !document.getElementById('visor'), 3000);
    ok(!document.getElementById('visor') && !!document.getElementById('ficha') && FICHA === clave(m.rep),
       '[4.4] el Atras cierra el visor y deja la ficha');
  }
  // Con otro color elegido, el visor muestra la foto que esta en la ficha
  const pinta = [...d.querySelectorAll('.fi-tono')].find(b => b.getAttribute('aria-pressed') !== 'true');
  if(pinta){
    pinta.click();
    await dfDormir(1500);
    const src = d.querySelector('.fi-marco > img')?.getAttribute('src');
    d.querySelector('.fi-lupa').click(); await dfDormir(150);
    v = document.getElementById('visor');
    ok(v && v.querySelector('img').getAttribute('src') === src && dfTxt(v.querySelector('.visor-rot')).endsWith(COLOR_FICHA),
       '[4.4] con otro color, la foto y el color que se estan mirando', src);
    if(v){ v.querySelector('.fi-cerrar').click(); await dfEsperarA(() => !document.getElementById('visor'), 3000); }
  } else info('[4.4] esta ficha tiene un solo color: no se mira el visor con otro');
  // En un telefono dice que se pellizca
  dfComoCelular();
  d.querySelector('.fi-lupa').click(); await dfDormir(150);
  v = document.getElementById('visor');
  ok(v && dfTxt(v.querySelector('.visor-pie')) === 'Pellizcá para agrandar más', '[4.4] en el celular: "Pellizcá para agrandar más"', v && dfTxt(v.querySelector('.visor-pie')));
  if(v){ v.querySelector('.fi-cerrar').click(); await dfEsperarA(() => !document.getElementById('visor'), 3000); }
  window.matchMedia = dfOriginal.matchMedia;
  // Si la ficha se cierra, el visor se va con ella
  d.querySelector('.fi-lupa').click(); await dfDormir(150);
  quitarFicha();
  await dfDormir(100);
  ok(!document.getElementById('visor') && cerrarVisorDOM === null, '[4.4] si la ficha se cierra, el visor tambien');
  escribirURL(false);
}

/* ---- 4.5 La regla de los links viejos ---- */
// A donde tiene que llevar un ID viejo, calculado aparte (sin claveDeHoy): la
// fila de la tarjeta si es de ese codigo, o la mas barata con stock; '' si ya
// no queda ninguna fila con ese codigo
function dfEsperadoViejo(k){
  const cod = CATALOGO && CATALOGO.ids ? CATALOGO.ids[k] : '';
  if(!cod || buscarProducto(k)) return '';
  const filas = PRODUCTOS.filter(p => p.codigo === cod && buscarModelo(clave(p)));
  if(!filas.length) return '';
  const m = buscarModelo(clave(filas[0]));
  const suyas = m.variantes.filter(v => v.codigo === cod);
  if(!suyas.length) return clave(filas[0]);
  if(suyas.some(v => clave(v) === clave(m.rep))) return clave(m.rep);
  const con = suyas.filter(v => v.stock), base = con.length ? con : suyas;
  return clave([...base].sort((a, b) => (a.precio ?? Infinity) - (b.precio ?? Infinity))[0]);
}
function probarLinksViejos(){
  if(!CATALOGO || !CATALOGO.ids){ info('[4.5] no se leyo fotos/indice.json: no hay mapa de IDs viejos'); return; }
  const viejos = Object.keys(CATALOGO.ids).filter(k => !buscarProducto(k));
  const mal = [], vivos = [], bajas = [];
  for(const k of viejos){
    const esperado = dfEsperadoViejo(k), hoy = claveDeHoy(k);
    if(hoy !== esperado) mal.push(k + '→' + (hoy || '(nada)') + ' y no ' + (esperado || '(nada)'));
    (esperado ? vivos : bajas).push(k);
  }
  ok(!mal.length, '[4.5] un ID viejo lleva a la fila de hoy de su mismo codigo AT (la de la tarjeta o la mas barata con stock), y a nada si no queda ninguna',
     mal.slice(0, 4).join(', ') || viejos.length + ' IDs viejos');
  info(`[4.5] hoy: ${viejos.length} IDs viejos, ${vivos.length} abren el producto de hoy y ${bajas.length} ya no estan (la muestra: 152, 143 y 9)`);
  ok(vivos.every(k => buscarProducto(claveDeHoy(k))?.codigo === CATALOGO.ids[k]), '[4.5] y siempre es el mismo producto (mismo codigo AT)');
  // Lo que existe hoy no se toca
  // (29/09, revision) Sin IDs cableados: todas las filas de las tarjetas de hoy
  const cambian = MODELOS.filter(m => claveDeHoy(clave(m.rep)) !== clave(m.rep)).map(m => clave(m.rep));
  ok(!cambian.length, '[4.5] un ID de hoy abre esa misma fila', cambian.slice(0, 4).join(', ') || MODELOS.length + ' filas');
  // Con la copia del navegador (o sin el indice de fotos) no se da nada de baja
  const fuente = FUENTE, catalogo = CATALOGO;
  try{
    const baja = 'ZZZ-NO-ESTA-999';
    if(!ADVAPP_URL || fuente.fuente === 'advapp')
      ok(destinoDelLink(baja).baja === true, '[4.5] con ADVAPP, un ID que no esta en ningun lado es "Ya no esta"',
         JSON.stringify(destinoDelLink(baja)));
    else info('[4.5] hoy los datos no son de ADVAPP (' + fuente.fuente + '): no se mira la baja');
    FUENTE = { ...fuente, fuente: 'copia' };
    ok(destinoDelLink(baja).espera === true, '[4.5] con la copia del navegador, se espera a la carga siguiente', JSON.stringify(destinoDelLink(baja)));
    FUENTE = fuente; CATALOGO = null;
    ok(destinoDelLink(baja).espera === true, '[4.5] sin el indice de fotos (no se pueden traducir IDs viejos), tambien', JSON.stringify(destinoDelLink(baja)));
  } finally { FUENTE = fuente; CATALOGO = catalogo; }
}

/* El #p= que llega con la pagina: con la copia se espera (no se muestra
   nada y el #p= queda para la carga siguiente); con ADVAPP, "Ya no esta" */
async function probarLinkQueEspera(){
  if(ADVAPP_URL && FUENTE.fuente !== 'advapp'){ info('[4.5] hoy los datos no son de ADVAPP: no se mira la espera'); return; }
  const fuente = FUENTE, antes = location.href;
  const baja = 'ZZZ-NO-ESTA-999';
  quitarFicha();
  try{
    history.replaceState(history.state, '', location.pathname + location.search + '#p=' + baja);
    FUENTE = { ...fuente, fuente: 'copia' };
    const r1 = abrirFichaDesdeURL();
    ok(r1 === false && !document.getElementById('ya-no-esta') && !FICHA && location.hash === '#p=' + baja,
       '[4.5] con la copia, el link no se da por perdido: nada a la vista y el #p= se queda', r1 + ' ' + location.hash);
    FUENTE = fuente;
    const r2 = abrirFichaDesdeURL();
    const y = document.getElementById('ya-no-esta');
    ok(r2 === true && !!y && !location.hash, '[4.5] con la carga de ADVAPP, "Ya no esta" y sin #p=', r2 + ' ' + location.hash);
    y?.querySelector('.fi-cerrar').click();
    await dfDormir(100);
    ok(!document.getElementById('ya-no-esta'), '[4.5] la X la cierra');
  } finally {
    FUENTE = fuente;
    document.getElementById('ya-no-esta')?.remove();
    try{ history.replaceState(history.state, '', antes.replace(/#.*$/, '')); }catch(e){}
  }
  // Y actualizar() lo vuelve a probar en la carga siguiente (esta envuelta
  // por la medicion: se lee el index.html)
  let src = '';
  try{ src = await (await fetch('index.html', { cache: 'no-store' })).text(); }catch(e){}
  ok(/if\(fichaPendiente\) fichaPendiente = !FICHA && !abrirFichaDesdeURL\(\);/.test(src),
     '[4.5] el link que espera se vuelve a probar con la carga siguiente', src.length + ' letras');
}

/* ---- A 390 px: la X y Compartir pegados, el visor, y los links viejos ---- */
async function dfIframe(hash, cond){
  const f = document.createElement('iframe');
  f.style.cssText = 'width:390px;height:664px;border:0;position:absolute;left:-9999px;top:0';
  f.src = 'index.html' + hash;
  document.body.appendChild(f);
  const listo = await dfEsperarA(() => {
    const w = f.contentWindow;
    return w.eval('MODELOS.length && FUENTE && typeof HORA_DATOS !== "undefined" && HORA_DATOS') && cond(w, f.contentDocument);
  }, 40000);
  try{ f.contentWindow.pararOfertas?.(); f.contentWindow.pararPaseos?.(); f.contentWindow.pararMundos?.(); }catch(e){}
  return listo ? f : (f.remove(), null);
}

async function probarCelular(){
  const m = dfModeloGrande();
  if(!m) return;
  const k = dfClaveDe(m);
  let f = await dfIframe('#p=' + encodeURIComponent(k), (w, doc) => doc.querySelector('#ficha .fi-compartir'));
  ok(!!f, '[4.1] el celular de 390 px abre la ficha con Compartir');
  if(f){
    try{
      const w = f.contentWindow, doc = f.contentDocument;
      await dfQuieto(doc.getElementById('ficha'));   // la ficha ya entro entera (cajaIn)
      const caja = doc.querySelector('#ficha .caja'), X = doc.querySelector('#ficha .fi-cerrar'), C = doc.querySelector('#ficha .fi-compartir');
      const cs = el => w.getComputedStyle(el);
      ok(cs(C).position === 'sticky' && cs(C).top === '14px', '[4.1] en el celular Compartir va pegado arriba, como la X', cs(C).position + ' ' + cs(C).top);
      caja.scrollTop = 0; await dfDormir(80);
      const cols = doc.querySelector('#ficha .fi-cols');
      ok(dfCerca(cols.getBoundingClientRect().top, caja.getBoundingClientRect().top, 1), '[4.1] no empuja la foto',
         Math.round(cols.getBoundingClientRect().top - caja.getBoundingClientRect().top) + ' px');
      let rx = X.getBoundingClientRect(), rc = C.getBoundingClientRect(), rk = caja.getBoundingClientRect();
      ok(dfCerca(rc.top, rx.top) && dfCerca(rx.left - rc.right, 8) && dfCerca(rk.right - rx.right, 14, 3),
         '[4.1] a la izquierda de la X, a la misma altura y con 8 px de aire', Math.round(rc.top - rx.top) + ' / ' + (rx.left - rc.right).toFixed(1));
      caja.scrollTop = 560; await dfDormir(100);
      rx = X.getBoundingClientRect(); rc = C.getBoundingClientRect(); rk = caja.getBoundingClientRect();
      ok(caja.scrollTop > 400 && dfCerca(rc.top - rk.top, 14, 2) && dfCerca(rx.top, rc.top), '[4.1] bajando 560 px siguen los dos a la vista',
         Math.round(rc.top - rk.top) + ' px');
      const arriba = doc.elementFromPoint(rc.left + rc.width / 2, rc.top + rc.height / 2);
      ok(arriba === C || C.contains(arriba), '[4.1] y no queda tapado', arriba && arriba.tagName);
      const arribaX = doc.elementFromPoint(rx.left + rx.width / 2, rx.top + rx.height / 2);
      ok(arribaX === X, '[2.8] la X sigue sin tapar', arribaX && (arribaX.className || arribaX.tagName));
      // El visor en el celular: la foto a lo ancho
      caja.scrollTop = 0; await dfDormir(80);
      doc.querySelector('#ficha .fi-marco > img').click();
      await dfDormir(200);
      const v = doc.getElementById('visor');
      ok(!!v, '[4.4] en el celular, tocar la foto abre el visor');
      if(v){
        const im = v.querySelector('img');
        await dfEsperarA(() => im.complete && im.naturalWidth > 0, 8000);
        const rv = v.getBoundingClientRect(), ri = im.getBoundingClientRect();
        ok(dfCerca(rv.width, 390, 2) && dfCerca(rv.height, 664, 2) && ri.width <= 391 && ri.width >= 300,
           '[4.4] a pantalla completa y la foto a lo ancho', Math.round(rv.width) + 'x' + Math.round(rv.height) + ' · ' + Math.round(ri.width) + ' px');
        /* (29/09, revision) El rotulo usa hasta tres lineas: en una sola se
           cortaba el color (el final) en 111 de 749 filas a 390, y con dos
           todavia en los monitores MSI. Se prueba con el rotulo de cada fila
           con foto, armado como en abrirVisor, y que no pise la foto. */
        const rot = v.querySelector('.visor-rot'), original = rot.textContent;
        const rotulos = w.eval(`PRODUCTOS.filter(p => p.imagen && buscarModelo(clave(p))).map(p =>
          [p.marca, partirNombreFicha(buscarModelo(clave(p)), p).nombre, colorPorDefecto(p)].filter(Boolean).join(' · '))`);
        const cortados = rotulos.filter(t => { rot.textContent = t; return rot.scrollHeight > rot.clientHeight + 1; });
        rot.textContent = original;
        const largo = rotulos.reduce((a, b) => a.length >= b.length ? a : b, '');
        rot.textContent = largo;
        const pisa = rot.getBoundingClientRect().bottom > v.querySelector('.vi').getBoundingClientRect().top;
        rot.textContent = original;
        ok(w.getComputedStyle(rot).webkitLineClamp === '3' && !cortados.length && !pisa,
           '[4.4 · 390] el rotulo del visor entra entero (hasta tres lineas), con el color al final, sin pisar la foto',
           cortados.slice(0, 2).join(' | ') || rotulos.length + ' rotulos' + (pisa ? ' (el mas largo pisa la foto)' : ''));
        v.querySelector('.fi-cerrar').click();
        await dfEsperarA(() => !doc.getElementById('visor'), 3000);
        ok(!doc.getElementById('visor') && !!doc.getElementById('ficha'), '[4.4] y la X lo cierra dejando la ficha');
      }
    } finally { f.remove(); }
  }

  // 4.5: un ID viejo abre el producto de hoy y la direccion pasa al ID nuevo
  const viejos = CATALOGO && CATALOGO.ids ? Object.keys(CATALOGO.ids).filter(x => !buscarProducto(x)) : [];
  const viejo = ['NB-APP-104'].concat(viejos).find(x => viejos.includes(x) && dfEsperadoViejo(x));
  if(viejo){
    const hoy = dfEsperadoViejo(viejo);
    f = await dfIframe('#p=' + encodeURIComponent(viejo), w => w.eval('FICHA'));
    ok(!!f, '[4.5] #p=' + viejo + ' (ID viejo) abre una ficha');
    if(f){
      try{
        const w = f.contentWindow;
        ok(w.eval('FICHA') === hoy && w.location.hash === '#p=' + encodeURIComponent(hoy),
           '[4.5] la del producto de hoy, y la direccion pasa al ID nuevo', viejo + ' → ' + w.location.hash);
        ok(!f.contentDocument.getElementById('ya-no-esta'), '[4.5] sin ningun aviso');
      } finally { f.remove(); }
    }
  } else info('[4.5] hoy no hay IDs viejos que sigan publicados');

  // 4.5 B: el que ya no esta
  const baja = ['AUD-APP-005'].concat(viejos).find(x => viejos.includes(x) && !dfEsperadoViejo(x)) || 'ZZZ-NO-ESTA-999';
  /* La pagina de vista previa de una fila dada de baja se borra (4.2), y
     404.html manda su direccion a #p=<ID>: se entra por donde manda 404.html */
  let hash404 = '';
  try{
    const s = await (await fetch('404.html', { cache: 'no-store' })).text();
    const fn = /function destinoDe404\([\s\S]*?\n\}/.exec(s);
    const dest = fn ? new Function(fn[0] + '\nreturn destinoDe404;')()('/catalogo-advance/p/' + baja + '.html') : '';
    hash404 = dest.slice(dest.indexOf('#'));
    ok(dest === '/catalogo-advance/#p=' + baja, '[4.5] 404.html manda la pagina borrada p/' + baja + '.html a este #p=', dest);
  }catch(e){ ok(false, '[4.5] 404.html se pudo leer', String(e)); }
  f = await dfIframe(hash404 || '#p=' + encodeURIComponent(baja), (w, doc) => doc.getElementById('ya-no-esta'));
  ok(!!f, '[4.5] #p=' + baja + ' (ya no esta) muestra la ventanita');
  if(f){
    try{
      const w = f.contentWindow, doc = f.contentDocument;
      const y = doc.getElementById('ya-no-esta');
      ok(y.classList.contains('modal') && !!y.querySelector('.caja[role="dialog"][aria-modal="true"]') && !doc.getElementById('ficha'),
         '[4.5] es una ventana como las del sitio, en el lugar de la ficha');
      ok(dfTxt(y.querySelector('h3')) === 'Ya no está' && dfTxt(y.querySelector('p')).startsWith('Ese producto ya no está en el catálogo.'),
         '[4.5] dice "Ya no está"', dfTxt(y.querySelector('p')));
      const wa = y.querySelector('.botones a.pri'), flot = doc.getElementById('wa-flotante');
      ok(!!wa && dfTxt(wa) === 'Escribinos por WhatsApp' && flot && wa.getAttribute('href') === flot.getAttribute('href') && wa.target === '_blank',
         '[4.5] "Escribinos por WhatsApp" con el mismo mensaje que el boton flotante', wa && wa.getAttribute('href'));
      const botones = [...y.querySelectorAll('.botones > *')];
      ok(botones.length === 2 && botones[0] === wa && dfTxt(botones[1]) === 'Ver el catálogo', '[4.5] arriba WhatsApp y abajo "Ver el catalogo"',
         botones.map(dfTxt).join(' / '));
      ok(!!y.querySelector('.fi-cerrar[aria-label]'), '[4.5] con su X');
      ok(!/#p=/.test(w.location.href), '[4.5] el #p= sale de la direccion', w.location.href.replace(/^.*\//, ''));
      await dfQuieto(y);                                 // la ventanita ya entro entera
      const r = y.querySelector('.caja').getBoundingClientRect();
      ok(r.left >= 0 && r.right <= 390 && r.width >= 300, '[4.5] entra en el celular', Math.round(r.left) + '-' + Math.round(r.right));
      botones[1].click();
      await dfDormir(150);
      ok(!doc.getElementById('ya-no-esta'), '[4.5] "Ver el catalogo" la cierra');
      // Pegar otro link en la misma pestana tambien pasa por la regla
      w.location.hash = '#p=' + encodeURIComponent(baja);
      await dfEsperarA(() => doc.getElementById('ya-no-esta'), 5000);
      ok(!!doc.getElementById('ya-no-esta') && !/#p=/.test(w.location.href), '[4.5] tambien con un link pegado en la misma pestana');
      doc.getElementById('ya-no-esta')?.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await dfDormir(150);
      ok(!doc.getElementById('ya-no-esta'), '[4.5] Esc la cierra');
      /* (29/09, revision) Con "Ya no esta" a la vista, pegar el link de un
         producto que si esta: una sola ventana, la ficha. Quedaban las dos y,
         al cerrar la ficha, "Ya no esta" reaparecia */
      w.location.hash = '#p=' + encodeURIComponent(baja);
      await dfEsperarA(() => doc.getElementById('ya-no-esta'), 5000);
      const vivo = w.eval('clave(MODELOS[0].rep)');
      w.location.hash = '#p=' + encodeURIComponent(vivo);
      await dfEsperarA(() => doc.getElementById('ficha'), 5000);
      ok(!!doc.getElementById('ficha') && !doc.getElementById('ya-no-esta') && doc.querySelectorAll('.modal').length === 1,
         '[4.5] con "Ya no esta" abierto, pegar otro link deja una sola ventana (la ficha)',
         [...doc.querySelectorAll('.modal')].map(x => x.id).join(','));
      doc.querySelector('#ficha .fi-cerrar')?.click();
      await dfDormir(300);
      ok(!doc.getElementById('ficha') && !doc.getElementById('ya-no-esta'), '[4.5] y al cerrar la ficha no reaparece');
    } finally { f.remove(); }
  }
}
