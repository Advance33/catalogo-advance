// Decisiones 6.1 a 6.9 de Pedro (29/09/2026): identidad y legibilidad.
// Muestra: muestras/auditoria/identidad.html. Pedro eligio la recomendada en
// las nueve: 1B 2C 3B 4B 5B 6B 7B 8B 9C.
//   6.1 B  el icono: el triangulo del logo en blanco sobre el grafito #151220,
//          con trazo grueso en 16 y 32 px (assets/icono-16/32/180/192.png,
//          sacados de assets/icono.svg e icono-grande.svg); "Advance Tecno"
//          debajo del icono en el inicio; sin manifest
//   6.2 C  theme-color cambia sola: grafito mientras la barra de arriba o la
//          banda grafito de Destacados cruzan el borde de arriba (29/09,
//          revision: sin corte), lila #F4EFFD cuando queda pegada la cinta
//   6.3 B  "Elegi un rubro" en Lilita sin mayusculas en todos los anchos:
//          27 px en la compu (tambien por debajo de 1180) y 22 en el celular
//   6.4 B  --faint #726496 y #6B5F8C sobre el lila del mundo grande; la version
//          agotada ya no es transparente; el precio de la tarjeta agotada, sobre
//          la etiqueta oscura, se queda con #867AA6. Todo texto en el tenue da
//          4,5 de contraste o mas (tambien en lo nuevo: lista de versiones,
//          visor, pedido, avisos)
//   6.5 B  el verde #0A7050 (y su fondo y borde); no queda el #0F8A5F viejo
//   6.6 B  en pantallas tactiles, mas zona para el dedo con el mismo dibujo:
//          puntitos de 24, + y WhatsApp de 43x44, X de 44, contadores de 42 y
//          40, "Ver pedido" de 44 de alto, sin pisarse. En la compu, nada
//   6.7 B  el pie con "Advance Tecno · Av. De los Incas 5150, 1A, CABA · Ver
//          en mapa · WhatsApp +54 9 11 2475-1466 · Atencion con cita previa",
//          como la muestra B, todo de la configuracion (DIRECCION, MAPA,
//          WHATSAPP, SERVICIO.retiro); sin horario, redes ni razon social; lo
//          vacio no se muestra
//   6.8 B  en "Busca por marca" y "Tambien te puede interesar" el nombre es el
//          de la tarjeta: el modelo y abajo la linea tecnica
//   6.9 C  la cinta de la marca: primero lo que entro despues del 10/09 y
//          despues uno de cada rubro por turno; "Lo ultimo de" solo si arranca
//          con algo posterior al 10/09, si no "De <marca>"
// El celular y la compu chica se miran en iframes (el headless no baja de 500).
// Las pantallas tactiles se simulan copiando las reglas de @media (pointer:coarse).
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);

const esperaDI = setInterval(() => {
  if(!MODELOS.length || !FUENTE || !document.querySelectorAll('#cats .chip').length || !document.getElementById('marcas-vitrina')) return;
  clearInterval(esperaDI);
  for(let i=1;i<5000;i++) clearInterval(i);
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; })
    .finally(() => {
      try{ diCerrarTodo(); }catch(e){}
      try{ pararPaseos(); pararOfertas(); pararMundos(); pararNuevos(); pararMarcas(); }catch(e){}
      for(let i=1;i<5000;i++) clearInterval(i);
      const pre=document.createElement('pre'); pre.id='RESULTADO';
      pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
      document.body.appendChild(pre);
    });
}, 150);

const diDormir = ms => new Promise(r => setTimeout(r, ms));
async function diEsperarA(cond, ms = 25000){
  const t0 = Date.now();
  while(Date.now() - t0 < ms){
    try{ if(cond()) return true; }catch(e){}
    await diDormir(150);
  }
  return false;
}
const diTxt = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
const diLimpios = { q:'', cat:'', marca:'', soloStock:false, rango:'', montura:'', apertura:'', capacidad:'', ram:'' };
function diFiltrar(f){ Object.assign(filtros, diLimpios, f); pintar(); }
function diCerrarPedido(){
  pedidoEmpujado = false;
  const c = cerrarPedidoDOM; cerrarPedidoDOM = null;
  if(c) c();
}
function diCerrarTodo(){
  try{ if(cerrarVisorDOM){ visorEmpujado = false; const v = document.getElementById('visor'); if(v) v.remove(); cerrarVisorDOM = null; } }catch(e){}
  try{ diCerrarPedido(); }catch(e){}
  try{ quitarFicha(); }catch(e){}
  document.getElementById('di-dedo')?.remove();
}

/* ---- Colores y contraste (la formula de WCAG 2, la misma de la muestra) ---- */
const diRGBA = s => {
  const m = /rgba?\(([^)]+)\)/.exec(s || '');
  if(!m) return null;
  const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
  return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
};
const diHex = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const diLin = c => { c /= 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; };
const diLum = ([r, g, b]) => .2126 * diLin(r) + .7152 * diLin(g) + .0722 * diLin(b);
const diContraste = (a, b) => { const x = diLum(a), y = diLum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const diMismo = (css, hex, tol = 1) => { const c = diRGBA(css), h = diHex(hex); return !!c && c.slice(0, 3).every((v, i) => Math.abs(v - h[i]) <= tol); };
/* El fondo que tiene atras un elemento: los colores de fondo hacia arriba,
   mezclados sobre blanco. Un degrade sin color debajo no se puede medir: null */
function diFondo(el){
  const capas = [];
  for(let x = el; x && x.nodeType === 1; x = x.parentElement){
    const cs = getComputedStyle(x);
    const c = diRGBA(cs.backgroundColor);
    if(c && c[3] > 0){ capas.push(c); if(c[3] >= .999) break; }
    else if(cs.backgroundImage && cs.backgroundImage !== 'none') return null;
  }
  let base = [255, 255, 255];
  for(const c of capas.reverse()) base = base.map((v, i) => v * (1 - c[3]) + c[i] * c[3]);
  return base;
}
/* Todos los textos a la vista de `raiz` pintados en alguno de los `tonos`:
   {medidos, malos: [texto (contraste)], sinMedir} */
function diBarrer(raiz, tonos){
  const out = { medidos: 0, malos: [], sinMedir: 0, min: Infinity };
  for(const el of raiz.querySelectorAll('*')){
    if(!([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))) continue;
    if(!el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    if(cs.visibility !== 'visible' || !tonos.some(t => diMismo(cs.color, t))) continue;
    const fondo = diFondo(el);
    if(!fondo){ out.sinMedir++; continue; }
    const r = diContraste(diRGBA(cs.color), fondo);
    out.medidos++; out.min = Math.min(out.min, r);
    if(r < 4.5) out.malos.push((el.className || el.tagName) + ' «' + diTxt(el).slice(0, 24) + '» ' + r.toFixed(2));
  }
  return out;
}
const FAINT = '#726496', FAINT_LILA = '#6B5F8C', FAINT_VIEJO = '#867AA6', VERDE = '#0A7050';
const diVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

async function correrPruebas(){
  const pedidoAntes = PEDIDO.slice();
  try{
    await probarIcono();              // 6.1
    await probarBarraNavegador();     // 6.2
    probarTituloCompu();              // 6.3 (la compu grande)
    probarTenue();                    // 6.4
    probarVerde();                    // 6.5
    await probarDedo();               // 6.6
    probarPie();                      // 6.7
    await probarPieEnLaMedicion();    // 6.7 (lo que recibe ADVAPP)
    probarNombres();                  // 6.8
    await probarCintaDeMarca();       // 6.9
    await probarAnchos();             // 6.3 y 6.7 en el celular y la compu chica
  } finally {
    diCerrarTodo();
    PEDIDO = pedidoAntes; guardarPedido(); pintarPedido();
    Object.assign(filtros, diLimpios); pintar();
    scrollTo(0, 0);
  }
}

/* ---- 6.1 El icono ---- */
const diImagen = src => new Promise((ok_, mal) => { const i = new Image(); i.onload = () => ok_(i); i.onerror = () => mal(new Error('no carga ' + src)); i.src = src; });
async function probarIcono(){
  const links = [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')];
  const esperados = [['icon', '16x16', 'assets/icono-16.png', 16, true], ['icon', '32x32', 'assets/icono-32.png', 32, true],
                     ['icon', '192x192', 'assets/icono-192.png', 192, false], ['apple-touch-icon', null, 'assets/icono-180.png', 180, false]];
  for(const [rel, sizes, href, px, redondo] of esperados){
    const l = links.find(x => x.rel === rel && (!sizes || x.getAttribute('sizes') === sizes));
    ok(!!l && l.getAttribute('href') === href, `[6.1] ${rel}${sizes ? ' ' + sizes : ''} es ${href}`, l && l.getAttribute('href'));
    if(!l) continue;
    let img;
    try{ img = await diImagen(href); }catch(e){ ok(false, '[6.1] ' + href + ' se puede abrir', String(e)); continue; }
    ok(img.naturalWidth === px && img.naturalHeight === px, `[6.1] ${href} mide ${px}x${px}`, img.naturalWidth + 'x' + img.naturalHeight);
    const c = document.createElement('canvas'); c.width = c.height = px;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const px_ = (x, y) => [...g.getImageData(Math.floor(x), Math.floor(y), 1, 1).data];
    // El fondo: el borde izquierdo a media altura (el triangulo arranca al 16 %)
    const fondo = px_(px * .06, px * .5);
    ok(fondo[3] === 255 && diMismo(`rgb(${fondo[0]},${fondo[1]},${fondo[2]})`, '#151220', 3),
       `[6.1] ${href}: fondo grafito #151220`, fondo.join(','));
    // El triangulo: pixeles blancos (el trazo), y no demasiados
    const d = g.getImageData(0, 0, px, px).data;
    let blancos = 0;
    for(let i = 0; i < d.length; i += 4) if(d[i + 3] > 200 && diLum([d[i], d[i + 1], d[i + 2]]) > .45) blancos++;
    const parte = blancos / (px * px);
    ok(parte > .04 && parte < .35, `[6.1] ${href}: el triangulo en blanco`, Math.round(parte * 100) + ' % de pixeles claros');
    const esquina = px_(0, 0);
    ok(redondo ? esquina[3] < 255 : esquina[3] === 255,
       `[6.1] ${href}: ${redondo ? 'esquinas redondeadas (la pestaña)' : 'sin redondear (las pone el telefono)'}`, 'alfa ' + esquina[3]);
  }
  ok(!links.some(l => /logo-mark/.test(l.getAttribute('href') || '')), '[6.1] el PNG finito del logo ya no es el icono');
  /* (29/09, revision) Las paginas de vista previa (p/, las arma
     herramientas/vista-previa.py) y 404.html tambien llevan el icono nuevo */
  const iconosDe = async (ruta, base) => {
    let t = '';
    try{ const r = await fetch(ruta + '?_=' + Date.now(), { cache: 'no-store' }); t = r.ok ? await r.text() : ''; }catch(e){}
    const d = new DOMParser().parseFromString(t, 'text/html');
    const hs = [...d.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')].map(l => l.getAttribute('rel') + ' ' + (l.getAttribute('sizes') || '') + ' ' + l.getAttribute('href'));
    const quiere = ['icon 32x32 ' + base + 'icono-32.png', 'icon 16x16 ' + base + 'icono-16.png', 'icon 192x192 ' + base + 'icono-192.png', 'apple-touch-icon  ' + base + 'icono-180.png'];
    return { t, bien: !!t && quiere.every(q => hs.includes(q)) && !/logo-mark/.test(hs.join(' ')), hs };
  };
  const e404 = await iconosDe('404.html', 'https://catalogo.advancetecno.com.ar/assets/');
  ok(e404.bien, '[6.1] 404.html lleva los cuatro iconos nuevos (con la direccion entera)', e404.hs.join(' | ') || 'sin iconos');
  let idsP = [];
  try{ idsP = (await (await fetch('p/indice.json', { cache: 'no-store' })).json()).ids || []; }catch(e){}
  if(idsP.length){
    const muestra = [idsP[0], idsP[Math.floor(idsP.length / 2)], idsP[idsP.length - 1]];
    const malas = [];
    for(const id of muestra){ const x = await iconosDe('p/' + encodeURIComponent(id) + '.html', '../assets/'); if(!x.bien) malas.push(id + ': ' + x.hs.join(' | ')); }
    ok(!malas.length, '[6.1] las paginas de vista previa p/ llevan los cuatro iconos nuevos', malas.join(' || ') || muestra.join(', '));
  } else info('[6.1] no hay p/indice.json: no se miran los iconos de p/');
  ok(!document.querySelector('link[rel="manifest"]'), '[6.1] sin manifest: como se abre desde el inicio no cambia');
  const titulo = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  const sitio = document.querySelector('meta[property="og:site_name"]');
  ok(!!titulo && titulo.content === 'Advance Tecno' && sitio && sitio.content === titulo.content,
     '[6.1] en el inicio dice "Advance Tecno", el mismo nombre del link compartido', titulo && titulo.content);
  ok(!document.querySelector('meta[name="apple-mobile-web-app-capable"], meta[name="mobile-web-app-capable"]'),
     '[6.1] y se sigue abriendo con la barra del navegador');
  // Los SVG de donde salen los PNG: el triangulo calcado de la muestra
  const TRI = 'M75 3L2 132H147Z M75 3L110 117 M29 86L110 117L147 132 M2 132L91 58';
  const svg = await (await fetch('assets/icono.svg', { cache: 'no-store' })).text();
  const svgG = await (await fetch('assets/icono-grande.svg', { cache: 'no-store' })).text();
  ok(svg.includes(TRI) && /fill="#151220"/.test(svg) && /stroke="#fff"/.test(svg) && /stroke-width="11\.5"/.test(svg) && /rx="18"/.test(svg),
     '[6.1] icono.svg: blanco sobre grafito, trazo grueso (11,5) y esquinas redondeadas');
  ok(svgG.includes(TRI) && /fill="#151220"/.test(svgG) && /stroke-width="8\.5"/.test(svgG) && !/rx=/.test(svgG),
     '[6.1] icono-grande.svg: el mismo triangulo, trazo de 8,5 y sin redondear');
}

/* ---- 6.2 La barra del navegador ---- */
async function probarBarraNavegador(){
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  ok(metas.length === 1, '[6.2] hay un solo theme-color', metas.length);
  const meta = metas[0];
  const fuente = await (await fetch(location.href, { cache: 'no-store' })).text();
  ok(/<meta name="theme-color" content="#151220">/.test(fuente), '[6.2] la pagina abre pidiendo el grafito #151220 (antes, blanco)');
  diCerrarTodo(); diFiltrar({}); scrollTo(0, 0);
  const barra = document.querySelector('.topbar');
  ok(!!barra && diMismo(getComputedStyle(barra).backgroundColor, '#151220'), '[6.2] y ese es el grafito de la barra de arriba');
  const color = () => (meta.getAttribute('content') || '').toUpperCase();
  ok(await diEsperarA(() => color() === '#151220', 3000), '[6.2] arriba de todo: grafito', color());
  ok(!!BARRA_NAV && typeof BARRA_NAV.avisar === 'function' && typeof BARRA_NAV.decidir === 'function',
     '[6.2] hay quien mire que queda arriba de todo');
  if(!BARRA_NAV) return;
  /* (29/09, revision) Que mire lo que corresponde: la barra de arriba Y la
     banda grafito de Destacados. Mirando solo la barra, en el celular la
     etiqueta pasaba a lila con la banda oscura arriba (casi una pantalla) */
  const banda = document.querySelector('.ofertas > .wrap');
  ok(BARRA_NAV.barra === barra && Array.isArray(BARRA_NAV.oscuras) && BARRA_NAV.oscuras.includes(barra) &&
     !!banda && BARRA_NAV.oscuras.includes(banda),
     '[6.2] el observador mira la barra de arriba (.topbar) y la banda de Destacados (.ofertas > .wrap)',
     (BARRA_NAV.oscuras || []).map(x => x.className || x.tagName).join(', '));
  /* El Chrome sin ventana deja de mirar la vista despues de cargar: si el
     observador no avisa solo, se le pide que decida con lo que se ve (la
     misma cuenta que hace cuando avisa), como en [142], y se deja dicho */
  const avisarLoQueSeVe = async quiere => {
    if(await diEsperarA(() => color() === quiere, 1200)) return 'solo';
    BARRA_NAV.decidir();
    info('[6.2] el observador no aviso solo (Chrome sin ventana): se le pidio que decida a mano, esperando ' + quiere);
    return 'a mano';
  };
  // La banda grafito de Destacados cruzando el borde de arriba: grafito, sin corte
  const ofertas = document.getElementById('ofertas');
  if(banda && ofertas && !ofertas.hidden && banda.getBoundingClientRect().height > 120){
    scrollTo(0, banda.getBoundingClientRect().top + scrollY + 60);
    await diEsperarA(() => banda.getBoundingClientRect().top < 0, 1500);
    const rb = banda.getBoundingClientRect();
    ok(rb.top < 0 && rb.bottom > 0 && barra.getBoundingClientRect().bottom <= 0,
       '[6.2] (bajando hasta que la banda de Destacados cruza el borde de arriba, sin la barra)', Math.round(rb.top) + ' a ' + Math.round(rb.bottom));
    const comoB = await avisarLoQueSeVe('#151220');
    ok(color() === '#151220', '[6.2] con la banda grafito de Destacados arriba de todo, la barra del navegador sigue grafito',
       color() + ' (' + comoB + ')');
  } else info('[6.2] hoy no se ve la banda de Destacados: no se mira el corte');
  const cinta = document.querySelector('.barra-cats');
  scrollTo(0, cinta.getBoundingClientRect().top + scrollY + 600);
  const pegada = await diEsperarA(() => Math.abs(cinta.getBoundingClientRect().top) < 1, 3000);
  ok(pegada && barra.getBoundingClientRect().bottom <= 0, '[6.2] al bajar, la barra de arriba se va y la cinta de rubros queda pegada',
     Math.round(cinta.getBoundingClientRect().top));
  const como = await avisarLoQueSeVe('#F4EFFD');
  ok(color() === '#F4EFFD', '[6.2] y la barra del navegador pasa al lila de la pagina', color() + ' (' + como + ')');
  ok(diMismo(getComputedStyle(cinta).backgroundColor, '#F4EFFD'), '[6.2] que es el fondo de la cinta', getComputedStyle(cinta).backgroundColor);
  scrollTo(0, Math.floor(barra.offsetHeight / 2));
  ok(await diEsperarA(() => barra.getBoundingClientRect().bottom > 0 && barra.getBoundingClientRect().top < 0, 1000),
     '[6.2] (subiendo hasta ver media barra de arriba)', Math.round(barra.getBoundingClientRect().bottom));
  const como2 = await avisarLoQueSeVe('#151220');
  ok(color() === '#151220', '[6.2] con un pedazo de la barra de arriba a la vista, grafito otra vez', color() + ' (' + como2 + ')');
  scrollTo(0, 0);
}

/* ---- 6.3 El titulo de la portada, en la compu grande ---- */
function diTitulo(doc, w){
  const h = doc.getElementById('sec-titulo');
  const cs = w.getComputedStyle(h);
  return { h, texto: diTxt(h), familia: cs.fontFamily, tam: cs.fontSize, peso: cs.fontWeight, mayus: cs.textTransform };
}
function probarTituloCompu(){
  diCerrarTodo(); diFiltrar({});
  const t = diTitulo(document, window);
  ok(t.texto === 'Elegí un rubro' && /^"?Lilita One"?/.test(t.familia) && t.tam === '27px' && t.peso === '400' && t.mayus === 'none',
     '[6.3] compu de 1920: "Elegí un rubro" en Lilita, 27 px, sin mayusculas', [t.texto, t.familia.split(',')[0], t.tam, t.peso, t.mayus].join(' · '));
  ok(document.fonts.check('27px "Lilita One"', 'Elegí un rubro'), '[6.3] y la Lilita esta cargada');
}

/* ---- 6.4 El texto tenue ---- */
function probarTenue(){
  ok(diVar('--faint').toUpperCase() === FAINT && diVar('--faint-lila').toUpperCase() === FAINT_LILA,
     '[6.4] --faint #726496 y --faint-lila #6B5F8C', diVar('--faint') + ' / ' + diVar('--faint-lila'));
  diCerrarTodo(); diFiltrar({});
  // El mundo grande
  const g = document.querySelector('.mundo-grande');
  if(g){
    const p = g.querySelector('.mundo-cab p'), i = g.querySelector('.rubro i');
    ok(p && diMismo(getComputedStyle(p).color, FAINT_LILA) && i && diMismo(getComputedStyle(i).color, FAINT_LILA),
       '[6.4] en el mundo grande, el tenue es #6B5F8C (la cantidad y los numeros de los rubros)', p && getComputedStyle(p).color);
    const r = p ? diContraste(diRGBA(getComputedStyle(p).color), diFondo(p)) : 0;
    ok(r >= 4.5, '[6.4] y ahi da 4,5 o mas', r.toFixed(2));
  } else info('[6.4] hoy la portada no tiene mundo grande');
  const otro = document.querySelector('.mundo:not(.mundo-grande) .mundo-cab p');
  if(otro) ok(diMismo(getComputedStyle(otro).color, FAINT), '[6.4] en los otros mundos, el tenue comun', getComputedStyle(otro).color);
  const port = diBarrer(document.body, [FAINT, FAINT_LILA]);
  ok(port.medidos > 20 && !port.malos.length, '[6.4] portada: todo texto tenue da 4,5 o mas',
     port.malos.slice(0, 4).join(' | ') || port.medidos + ' textos, el peor ' + port.min.toFixed(2));

  // La tarjeta agotada: el precio sobre la etiqueta oscura se queda con el de antes
  const agot = MODELOS.find(m => !m.stock && m.precio !== null);
  if(agot){
    diFiltrar({ cat: agot.cat });
    const c = document.querySelector('#grid .card.agotado');
    const usd = c && c.querySelector('.usd');
    ok(!!usd && diMismo(getComputedStyle(usd).color, FAINT_VIEJO), '[6.4] la tarjeta agotada: el precio sigue en #867AA6 sobre la etiqueta oscura',
       usd && getComputedStyle(usd).color);
    if(usd) ok(diContraste(diRGBA(getComputedStyle(usd).color), diFondo(usd)) >= 4.5, '[6.4] y ahi se lee (4,5 o mas)',
               diContraste(diRGBA(getComputedStyle(usd).color), diFondo(usd)).toFixed(2));
    const grid = diBarrer(document.body, [FAINT, FAINT_LILA]);
    ok(grid.medidos > 0 && !grid.malos.length, '[6.4] ' + plural(agot.cat) + ' (con agotados): todo texto tenue da 4,5 o mas',
       grid.malos.slice(0, 4).join(' | ') || grid.medidos + ' textos, el peor ' + grid.min.toFixed(2));
  } else info('[6.4] hoy no hay ninguna tarjeta agotada');
  diFiltrar({});

  // La version agotada en las pestanas de la ficha
  const conAgotada = MODELOS.find(m => m.stock && m.variantes.length > 1 && m.variantes.some(v => !v.stock) &&
                                       m.variantes.length < 6);
  let vio = false;
  for(const m of [conAgotada, ...MODELOS.filter(x => x.stock && x.variantes.some(v => !v.stock))].filter(Boolean).slice(0, 25)){
    abrirFicha(clave(m.rep), null);
    const op = document.querySelector('#ficha .fi-op.agotada');
    if(!op){ quitarFicha(); continue; }
    vio = true;
    const cs = getComputedStyle(op), b = op.querySelector('b'), i = op.querySelector('i');
    ok(cs.opacity === '1', '[6.4] la version agotada ya no es transparente', (m.titulo || m.desc) + ' · opacity ' + cs.opacity);
    ok(b && /line-through/.test(getComputedStyle(b).textDecorationLine), '[6.4] y sigue tachada');
    if(i) ok(diMismo(getComputedStyle(i).color, FAINT) && diContraste(diRGBA(getComputedStyle(i).color), diFondo(i)) >= 4.5,
             '[6.4] su precio, en el tenue, se lee (4,5 o mas)', diContraste(diRGBA(getComputedStyle(i).color), diFondo(i)).toFixed(2));
    const f = diBarrer(document.getElementById('ficha'), [FAINT, FAINT_LILA]);
    ok(f.medidos > 0 && !f.malos.length, '[6.4] en esa ficha, todo texto tenue da 4,5 o mas', f.malos.slice(0, 4).join(' | ') || f.medidos + ' textos, el peor ' + f.min.toFixed(2));
    quitarFicha();
    break;
  }
  if(!vio) info('[6.4] hoy ninguna ficha tiene una pestaña agotada');

  // La lista de versiones (4.3 C), con una agotada
  const larga = MODELOS.find(m => m.stock && m.variantes.length >= 6 && m.variantes.some(v => !v.stock));
  if(larga){
    abrirFicha(clave(larga.rep), null);
    const todas = document.querySelector('#ficha .fi-todas');
    if(todas){
      todas.open = true;
      const fila = todas.querySelector('.fi-fila.agotada');
      const q = fila && fila.querySelector('.q'), p = fila && fila.querySelector('.p'), t = fila && fila.querySelector('.t');
      ok(!!fila && getComputedStyle(q).opacity === '1' && getComputedStyle(p).opacity === '1',
         '[6.4] la lista de versiones: la agotada tampoco es transparente', larga.titulo || larga.desc);
      if(fila) ok(/line-through/.test(getComputedStyle(t).textDecorationLine) && diMismo(getComputedStyle(p).color, FAINT),
                  '[6.4] va tachada y con el precio en el tenue', getComputedStyle(p).color);
      const f = diBarrer(document.getElementById('ficha'), [FAINT, FAINT_LILA]);
      ok(f.medidos > 0 && !f.malos.length, '[6.4] con la lista abierta, todo texto tenue da 4,5 o mas',
         f.malos.slice(0, 4).join(' | ') || f.medidos + ' textos, el peor ' + f.min.toFixed(2));
    } else info('[6.4] ' + (larga.titulo || larga.desc) + ' no muestra la lista de versiones');
    quitarFicha();
  } else info('[6.4] hoy ningun modelo de 6 versiones tiene una agotada');

  // El pedido y su barra
  const con = PRODUCTOS.find(p => p.stock && p.precio > 0 && buscarModelo(clave(p)));
  PEDIDO = [{ k: clave(con), n: 2, color: '' }]; guardarPedido(); pintarPedido();
  abrirPedido();
  const ped = diBarrer(document.getElementById('pedido'), [FAINT, FAINT_LILA]);
  const barra = diBarrer(document.getElementById('barra-pedido') || document.body, [FAINT, FAINT_LILA]);
  ok(ped.medidos > 0 && !ped.malos.length && !barra.malos.length, '[6.4] el pedido y su barra: todo texto tenue da 4,5 o mas',
     [...ped.malos, ...barra.malos].slice(0, 4).join(' | ') || ped.medidos + ' textos, el peor ' + ped.min.toFixed(2));
  diCerrarPedido();
}

/* ---- 6.5 El verde ---- */
function diReglas(){
  const out = [];
  const juntar = rules => { for(const r of rules){ out.push(r); if(r.cssRules) juntar(r.cssRules); } };
  for(const ss of document.styleSheets){ try{ juntar(ss.cssRules); }catch(e){} }
  return out;
}
function probarVerde(){
  ok(diVar('--ok').toUpperCase() === VERDE && /^rgba\(10,\s*112,\s*80,\s*\.?0?\.10?\)$/.test(diVar('--ok-soft')) &&
     /^rgba\(10,\s*112,\s*80,\s*\.?0?\.45\)$/.test(diVar('--ok-borde')),
     '[6.5] --ok #0A7050, con su fondo (10 %) y su borde (45 %)', [diVar('--ok'), diVar('--ok-soft'), diVar('--ok-borde')].join(' '));
  const viejo = diReglas().filter(r => /rgba?\(15,\s*138,\s*95/.test(r.cssText) || /#0f8a5f/i.test(r.cssText));
  ok(!viejo.length, '[6.5] no queda el verde viejo #0F8A5F en ninguna regla', viejo.slice(0, 2).map(r => r.cssText.slice(0, 60)).join(' | '));
  const conRegalo = MODELOS.find(m => m.stock && m.incluye);
  if(conRegalo){
    abrirFicha(clave(conRegalo.rep), null);
    const d = document.getElementById('ficha');
    const badge = d.querySelector('.badge.si'), inc = d.querySelector('.incluye');
    ok(!!badge && diMismo(getComputedStyle(badge).color, VERDE), '[6.5] "En stock" de la ficha en el verde nuevo', badge && getComputedStyle(badge).color);
    ok(!!inc && diMismo(getComputedStyle(inc).color, VERDE), '[6.5] y lo que incluye', inc && getComputedStyle(inc).color);
    const v = diBarrer(d, [VERDE]);
    ok(v.medidos > 0 && !v.malos.length, '[6.5] en la ficha, todo texto verde da 4,5 o mas',
       v.malos.slice(0, 3).join(' | ') || v.medidos + ' textos, el peor ' + v.min.toFixed(2));
    quitarFicha();
    diFiltrar({ cat: conRegalo.cat });
    const c = document.querySelector(`#grid .card[data-key="${CSS.escape(clave(conRegalo))}"] .cinta`) || document.querySelector('#grid .card .cinta');
    ok(!!c && diMismo(getComputedStyle(c).backgroundColor, VERDE), '[6.5] la cinta del regalo en la tarjeta, en el verde nuevo',
       c && getComputedStyle(c).backgroundColor);
    if(c) ok(diContraste([255, 255, 255], diRGBA(getComputedStyle(c).backgroundColor)) >= 4.5, '[6.5] y el blanco encima se lee',
             diContraste([255, 255, 255], diRGBA(getComputedStyle(c).backgroundColor)).toFixed(2));
    diFiltrar({});
  } else info('[6.5] hoy ningun producto trae regalo');
  // "Agregado": la tarjeta con el producto en el pedido
  const m = MODELOS.find(x => x.stock && x.precio > 0 && x.imagen);
  PEDIDO = [{ k: clave(m.rep), n: 1, color: '' }]; guardarPedido(); pintarPedido();
  diFiltrar({ cat: m.cat });
  const mas = document.querySelector(`#grid .card[data-key="${CSS.escape(clave(m))}"] .acciones .mas`);
  if(mas) ok(mas.getAttribute('aria-pressed') === 'true' && diMismo(getComputedStyle(mas).backgroundColor, VERDE),
             '[6.5] el + ya agregado, lleno del verde nuevo', getComputedStyle(mas).backgroundColor);
  else info('[6.5] la tarjeta de ' + (m.titulo || m.desc) + ' no quedo a mano');
  PEDIDO = []; guardarPedido(); pintarPedido(); diFiltrar({});
}

/* ---- 6.6 Botones a medida del dedo ---- */
/* La zona de un boton: su caja agrandada por el ::before (que se mide desde
   adentro del borde). null si no tiene. */
function diZona(el){
  const ps = getComputedStyle(el, '::before');
  if(!ps || ps.content === 'none' || ps.position !== 'absolute') return null;
  const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
  const bl = parseFloat(cs.borderLeftWidth) || 0, bt = parseFloat(cs.borderTopWidth) || 0;
  const w = parseFloat(ps.width), h = parseFloat(ps.height);
  const t = /translateY\(-50%\)|matrix\(1, 0, 0, 1, 0, -/.test(ps.transform) ? -h / 2 : 0;
  const left = r.left + bl + parseFloat(ps.left), top = r.top + bt + parseFloat(ps.top) + t;
  return { left, top, right: left + w, bottom: top + h, w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10 };
}
const diPisan = (a, b) => a && b && a.left < b.right - .5 && b.left < a.right - .5 && a.top < b.bottom - .5 && b.top < a.bottom - .5;
const diTam = z => z ? z.w + 'x' + z.h : 'sin zona';
async function probarDedo(){
  const reglas = diReglas().filter(r => r.type === CSSRule.MEDIA_RULE && /pointer:\s*coarse/.test(r.conditionText || r.media.mediaText));
  const dedo = reglas.find(r => /of-dots/.test(r.cssText) && /fi-cerrar/.test(r.cssText));
  ok(!!dedo, '[6.6] hay reglas para pantallas tactiles (@media (pointer:coarse))', reglas.length);
  if(!dedo) return;
  // En la compu (esta pantalla no es tactil) no cambia nada
  ok(!matchMedia('(pointer: coarse)').matches, '[6.6] la pantalla de las pruebas no es tactil');
  diCerrarTodo(); diFiltrar({});
  const X0 = (() => { const m = MODELOS.find(x => x.stock && x.imagen); abrirFicha(clave(m.rep), null);
                      const x = document.querySelector('#ficha .fi-cerrar'); const z = diZona(x); quitarFicha(); return z; })();
  const dot0 = document.querySelector('#of-dots button');
  ok(!X0 && (!dot0 || Math.round(dot0.getBoundingClientRect().width) <= 24 && Math.round(dot0.getBoundingClientRect().height) === 8),
     '[6.6] en la compu no cambia nada: sin zona extra y los puntitos de 8', dot0 && Math.round(dot0.getBoundingClientRect().height));

  /* Se simula la pantalla tactil: las mismas reglas, sin la condicion. Y sin
     transiciones ni animaciones, que en el Chrome sin ventana no avanzan (los
     puntitos quedaban a medio crecer y la ficha a medio entrar) */
  const st = document.createElement('style'); st.id = 'di-dedo';
  st.textContent = [...dedo.cssRules].map(r => r.cssText).join('\n') +
    '\n*,*::before,*::after{transition:none !important;animation:none !important}';
  document.head.appendChild(st);
  try{
    // Los puntitos de ofertas
    const dots = [...document.querySelectorAll('#of-dots button')];
    if(dots.length > 1){
      const rs = dots.map(d => d.getBoundingClientRect());
      const sel = dots.findIndex(d => d.getAttribute('aria-current') === 'true');
      const comun = rs.find((r, i) => i !== sel);
      ok(Math.round(comun.width) === 24 && Math.round(comun.height) === 24, '[6.6] los puntitos responden en 24x24', Math.round(comun.width) + 'x' + Math.round(comun.height));
      ok(sel >= 0 && Math.round(rs[sel].width) === 32, '[6.6] el de la oferta que pasa, 32 de ancho', sel >= 0 && Math.round(rs[sel].width));
      ok(rs.every((r, i) => i === 0 || Math.abs(r.left - rs[i - 1].right) < .6), '[6.6] pegados, sin pisarse');
      const pd = getComputedStyle(dots.find((d, i) => i !== sel), '::before'), ps = getComputedStyle(dots[sel], '::before');
      ok(diRGBA(getComputedStyle(comun ? dots[rs.indexOf(comun)] : dots[0]).backgroundColor)[3] === 0 && pd.width === '8px' && pd.height === '8px' &&
         ps.width === '24px' && diMismo(ps.backgroundColor, '#F0D98C'),
         '[6.6] y se ven igual: el punto de 8 y la pastilla dorada de 24 dibujados adentro', pd.width + ' / ' + ps.width + ' ' + ps.backgroundColor);
    } else info('[6.6] hoy no hay puntitos de ofertas');

    // La tarjeta: el + y el WhatsApp
    const m = MODELOS.find(x => x.stock && x.imagen && x.precio > 0);
    diFiltrar({ cat: m.cat });
    const card = [...document.querySelectorAll('#grid .card')].find(c => c.querySelector('.foto .acciones .mas') && c.querySelector('.foto .acciones .wa'));
    if(card){
      card.scrollIntoView({ block: 'center' });
      const mas = card.querySelector('.acciones .mas'), wa = card.querySelector('.acciones .wa');
      const zm = diZona(mas), zw = diZona(wa);
      const rm = mas.getBoundingClientRect();
      ok(Math.round(rm.width) === 36 && Math.round(rm.height) === 36, '[6.6] el + se ve igual (36)', Math.round(rm.width));
      ok(zm && zw && zm.w >= 43 && zm.h >= 44 && zw.w >= 43 && zw.h >= 44, '[6.6] el + y el WhatsApp responden en 43x44', diTam(zm) + ' / ' + diTam(zw));
      ok(zm && zw && !diPisan(zm, zw) && Math.abs(zm.right - zw.left) < .6, '[6.6] y no se pisan (se tocan en el medio del hueco)',
         zm && zw && (zw.left - zm.right).toFixed(1));
      const cual = document.elementFromPoint(rm.left - 3, rm.top + rm.height / 2);
      ok(cual === mas || mas.contains(cual), '[6.6] tocar 3 px afuera del + le da al +', cual && (cual.className || cual.tagName));
    } else info('[6.6] no hay tarjeta con + y WhatsApp a mano');
    diFiltrar({});

    // La ficha: la X, Compartir y el contador (el contador sale con el producto en el pedido)
    PEDIDO = [{ k: clave(m.rep), n: 1, color: '' }]; guardarPedido(); pintarPedido();
    abrirFicha(clave(m.rep), null);
    const d = document.getElementById('ficha');
    const X = d.querySelector('.fi-cerrar'), C = d.querySelector('.fi-compartir');
    const zX = diZona(X), zC = C && diZona(C);
    ok(Math.round(X.getBoundingClientRect().width) === 34, '[6.6] la X se ve igual (34)', Math.round(X.getBoundingClientRect().width));
    ok(zX && zX.w >= 43 && zX.h >= 44, '[6.6] la X responde en 44', diTam(zX));
    if(C) ok(zC && zC.w >= 43 && zC.h >= 44 && !diPisan(zX, zC), '[6.6] Compartir tambien, y no se pisa con la X', diTam(zC) + ' · hueco ' + (zX && zC ? (zX.left - zC.right).toFixed(1) : '?'));
    const lupa = d.querySelector('.fi-lupa');
    if(lupa && lupa.getClientRects().length) ok(diZona(lupa) && diZona(lupa).w >= 44 && diZona(lupa).h >= 44, '[6.6] la lupa de la foto, 44', diTam(diZona(lupa)));
    const bots = [...d.querySelectorAll('.fi-cant .stepper button')];
    if(bots.length === 2){
      const z1 = diZona(bots[0]), z2 = diZona(bots[1]);
      ok(Math.round(bots[0].getBoundingClientRect().width) === 30, '[6.6] el contador de la ficha se ve igual (30)');
      ok(z1 && z2 && z1.w >= 42 && z1.h >= 42 && z2.w >= 42 && !diPisan(z1, z2), '[6.6] y responde en 42, sin pisarse', diTam(z1));
    } else info('[6.6] la ficha no tiene contador a la vista');
    quitarFicha();

    // El pedido: el contador, la X de cada fila y "Ver pedido"
    const p2 = PRODUCTOS.filter(p => p.stock && p.precio > 0 && buscarModelo(clave(p))).slice(0, 2);
    PEDIDO = p2.map(p => ({ k: clave(p), n: 1, color: '' })); guardarPedido(); pintarPedido();
    const ver = document.getElementById('bp-ver');
    const zv = ver && diZona(ver);
    ok(!!zv && zv.h >= 44 && Math.abs((zv.top + zv.bottom) / 2 - (ver.getBoundingClientRect().top + ver.getBoundingClientRect().bottom) / 2) < 1,
       '[6.6] "Ver pedido" responde en 44 de alto, centrado', diTam(zv) + ' (se ve de ' + (ver ? Math.round(ver.getBoundingClientRect().height) : '?') + ')');
    abrirPedido();
    const fila = document.querySelector('#pedido .pd-item');
    if(fila){
      const [menos, mas] = fila.querySelectorAll('.stepper button'), quitar = fila.querySelector('.pd-quitar');
      const zm = diZona(menos), zM = diZona(mas), zq = diZona(quitar);
      ok(Math.round(menos.getBoundingClientRect().width) === 26, '[6.6] el contador del pedido se ve igual (26)');
      ok(zm && zM && zm.w >= 40 && zm.h >= 40 && zM.w >= 40 && !diPisan(zm, zM), '[6.6] y responde en 40, sin pisarse', diTam(zm));
      ok(zq && zq.w >= 40 && zq.h >= 40 && !diPisan(zM, zq), '[6.6] la X de la fila, 40x40, sin pisar al +', diTam(zq));
      const vecinos = [...document.querySelectorAll('#pedido button, #pedido a')].filter(b => b !== menos && b !== mas && b !== quitar && fila.contains(b));
      const pisa = vecinos.filter(b => { const r = b.getBoundingClientRect(); const z = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
                                         return [zm, zM, zq].some(x => diPisan(x, z)); });
      ok(!pisa.length, '[6.6] ni a la foto ni al nombre de la fila', pisa.map(b => b.className).join(', ') || vecinos.length + ' vecinos');
    } else info('[6.6] el pedido no mostro filas');
    diCerrarPedido();
  } finally {
    st.remove();
    PEDIDO = []; guardarPedido(); pintarPedido();
  }
}

/* ---- 6.7 El pie ---- */
function probarPie(){
  const pie = document.getElementById('pie-id');
  const footer = document.querySelector('footer');
  ok(!!pie && !pie.hidden && footer.contains(pie) && footer.firstElementChild === pie, '[6.7] la linea de contacto, arriba en el pie');
  if(!pie) return;
  const numero = WHATSAPP ? telefonoLegible(WHATSAPP) : '';
  ok(WHATSAPP !== '5491124751466' || numero === '+54 9 11 2475-1466', '[6.7] el numero se escribe como en la muestra (el de Tecno desde el 05/10)', numero);
  /* (29/09) Como la muestra B elegida: con la direccion y "Ver en mapa",
     que salen de DIRECCION y MAPA (las de la pregunta "¿Puedo ir a verlos?") */
  const partes = [...pie.children].filter(x => !x.classList.contains('sep')).map(diTxt);
  const cita = /cita previa/i.test((SERVICIO.retiro || []).join(' '));
  const esperado = ['Advance Tecno', ...(DIRECCION ? [DIRECCION] : []), ...(MAPA ? ['Ver en mapa'] : []),
                    ...(WHATSAPP ? ['WhatsApp ' + numero] : []), ...(cita ? ['Atención con cita previa'] : [])];
  ok(JSON.stringify(partes) === JSON.stringify(esperado), '[6.7] dice ' + esperado.join(' · '), partes.join(' · '));
  ok(DIRECCION !== 'Av. De los Incas 5150, 1A, CABA' || partes[1] === 'Av. De los Incas 5150, 1A, CABA',
     '[6.7] la direccion entera, con el 1A, como la muestra', partes[1]);
  const flot = document.getElementById('wa-flotante');
  const a = [...pie.querySelectorAll('a')].find(x => /wa\.me\//.test(x.getAttribute('href') || ''));
  if(WHATSAPP) ok(!!a && a.getAttribute('href') === flot.getAttribute('href') && a.target === '_blank' && /noopener/.test(a.rel),
                  '[6.7] el WhatsApp abre el mismo chat y saludo que el boton flotante', a && a.getAttribute('href'));
  const mapa = [...pie.querySelectorAll('a')].find(x => diTxt(x) === 'Ver en mapa');
  if(MAPA) ok(!!mapa && mapa.getAttribute('href') === MAPA && mapa.target === '_blank' && /noopener/.test(mapa.rel),
              '[6.7] "Ver en mapa" abre MAPA, el mismo link de la pregunta frecuente', mapa && mapa.getAttribute('href'));
  else info('[6.7] MAPA esta vacia: sin "Ver en mapa"');
  ok(pie.querySelectorAll('.sep').length === esperado.length - 1 && [...pie.querySelectorAll('.sep')].every(s => s.getAttribute('aria-hidden') === 'true'),
     '[6.7] separados por "·" que el lector no lee');
  const todo = diTxt(footer);
  ok(!/horario|raz[oó]n social|instagram|\[Pedro/i.test(todo),
     '[6.7] sin horario, redes ni razon social (eso es la C, con datos de Pedro)', todo.slice(0, 60));
  ok(footer.querySelector('.pie-legal #pie-cotiz') && /Precios sujetos a cambio sin previo aviso · Consultá disponibilidad antes de comprar/.test(todo),
     '[6.7] abajo sigue la cotizacion y "Precios sujetos a cambio"');
  const b = pie.querySelector('b'), csb = b && getComputedStyle(b), csp = getComputedStyle(pie);
  ok(csb && /Lilita/.test(csb.fontFamily) && csb.textTransform === 'uppercase' && csp.textTransform === 'none' && csp.fontSize === '13px',
     '[6.7] "Advance Tecno" en Lilita y el resto en letra comun de 13 px, como la muestra', csb && csb.fontFamily.split(',')[0]);
  const links = [...pie.querySelectorAll('a')];
  ok(links.length > 0 && links.every(x => diMismo(getComputedStyle(x).color, '#7C3AED') && /underline/.test(getComputedStyle(x).textDecorationLine)),
     '[6.7] "Ver en mapa" y el WhatsApp como links morados subrayados', links.map(diTxt).join(' · '));
  // Lo que queda vacio no se muestra
  const retiro = SERVICIO.retiro, href = flot.getAttribute('href');
  try{
    pintarPie({ direccion: '' });
    ok(!diTxt(pie).includes(DIRECCION) && (!MAPA || /Ver en mapa/.test(diTxt(pie))) && !pie.hidden,
       '[6.7] sin direccion, esa parte no va (el resto queda)', diTxt(pie));
    pintarPie({ mapa: '' });
    ok(!pie.querySelector('a[href="' + CSS.escape(MAPA) + '"]') && !/Ver en mapa/.test(diTxt(pie)) && diTxt(pie).includes(DIRECCION),
       '[6.7] sin mapa, no hay "Ver en mapa"', diTxt(pie));
    pintarPie({ mapa: 'javascript:alert(1)' });
    ok(!/Ver en mapa/.test(diTxt(pie)), '[6.7] y un mapa que no es https tampoco se pone');
    SERVICIO.retiro = ['Retiro en CABA', 'Lo coordinamos por WhatsApp.'];
    pintarPie();
    ok(!/cita previa/i.test(diTxt(pie)) && !pie.hidden, '[6.7] si el retiro no dice "cita previa", esa parte no va', diTxt(pie));
    flot.removeAttribute('href');
    pintarPie();
    ok(!/WhatsApp/.test(diTxt(pie)) && !pie.hidden, '[6.7] sin WhatsApp, esa parte no va', diTxt(pie));
    pintarPie({ direccion: '', mapa: '' });
    ok(pie.hidden && !diTxt(pie), '[6.7] y sin nada (ni direccion, ni mapa, ni WhatsApp, ni cita): la linea no aparece');
  } finally {
    SERVICIO.retiro = retiro;
    if(href) flot.setAttribute('href', href);
    pintarPie();
  }
  ok(!pie.hidden && diTxt(pie) === esperado.join('·'), '[6.7] y vuelve como estaba', diTxt(pie));
}
// El WhatsApp del pie se mide con su origen (la medicion la prueba analitica.js);
// aca, que ADVAPP lo tenga escrito
async function probarPieEnLaMedicion(){
  let med = '';
  try{ med = await (await fetch('MEDICION-ADVAPP.txt?_=' + Date.now(), { cache: 'no-store' })).text(); }catch(e){}
  const wa = (/\n\s*whatsapp\s[\s\S]*?(?=\n\s{3}pedilo)/.exec(med) || [''])[0].replace(/\s+/g, ' ');
  ok(/"pie"/.test(wa), '[6.7] MEDICION-ADVAPP.txt lista "pie" entre los desde del evento whatsapp', wa.slice(0, 120));
}

/* ---- 6.8 Los nombres, como la tarjeta ---- */
function diComoTarjeta(m){
  const el = tarjeta(m);
  return [diTxt(el.querySelector('.nombre')), diTxt(el.querySelector('.tecnica'))];
}
function probarNombres(){
  // Busca por marca: cada cinta
  const malos = [], repes = [];
  let vistos = 0;
  for(const x of MV){
    const d = document.createElement('div');
    d.innerHTML = htmlPanelMarca(x, false);
    const ps = [...d.querySelectorAll('.mv-p:not([aria-hidden="true"])')];
    const nombres = [];
    ps.forEach(p => {
      const m = buscarModelo(p.dataset.key);
      if(!m) return;
      vistos++;
      const [n, t] = diComoTarjeta(m);
      const b = diTxt(p.querySelector('b')), tec = p.querySelector('.mv-tec');
      if(b !== n || !tec || diTxt(tec) !== t) malos.push(x.marca + ': ' + b + ' / ' + diTxt(tec) + ' ≠ ' + n + ' / ' + t);
      nombres.push([b + '|' + diTxt(tec), m.precio]);
    });
    const vistosN = new Map();
    nombres.forEach(([k, pr]) => { if(vistosN.has(k) && vistosN.get(k) !== pr) repes.push(x.marca + ': ' + k.replace('|', ' / ')); vistosN.set(k, pr); });
  }
  ok(vistos > 50 && !malos.length, '[6.8] "Busca por marca": cada producto con el nombre y la linea tecnica de su tarjeta',
     malos.slice(0, 3).join(' | ') || vistos + ' productos en ' + MV.length + ' marcas');
  if(repes.length) info('[6.8] AVISO: en la misma cinta, mismo nombre y distinto precio: ' + repes.slice(0, 3).join(' | '));
  // El caso de la muestra: los Mini 5 Pro de DJI ya no se llaman los tres igual
  const minis = MODELOS.filter(m => m.marca === 'DJI' && /^Drone DJI Mini 5 Pro$/i.test(m.titulo || ''));
  if(minis.length > 1){
    const caras = new Set(minis.map(m => diComoTarjeta(m).join(' / ')));
    ok(caras.size === minis.length, '[6.8] los ' + minis.length + ' "Drone DJI Mini 5 Pro" se distinguen por la linea tecnica', [...caras].join(' | '));
  } else info('[6.8] hoy no hay varios DJI Mini 5 Pro');
  const unPanel = document.querySelector('#mv-lugar .mv-p .mv-tec');
  ok(!!unPanel && getComputedStyle(unPanel).whiteSpace === 'nowrap' && diMismo(getComputedStyle(unPanel).color, '#584D70'),
     '[6.8] la linea va en un renglon y en el gris de la linea tecnica de la tarjeta');
  const altos = new Set([...document.querySelectorAll('#mv-lugar .mv-p .mv-tec')].map(e => Math.round(e.getBoundingClientRect().height)));
  ok(altos.size === 1, '[6.8] con o sin linea, las tarjetas de la cinta quedan parejas', [...altos].join(','));

  // Tambien te puede interesar: todas las fichas
  const malosS = [];
  let n = 0;
  for(const m of MODELOS.filter(x => x.stock)){
    const d = document.createElement('div');
    d.innerHTML = htmlRelacionados(m);
    d.querySelectorAll('.pc').forEach(pc => {
      const x = buscarModelo(pc.dataset.key);
      if(!x) return;
      n++;
      const b = diTxt(pc.querySelector('.pc-txt b')), tec = pc.querySelector('.pc-tec');
      if(b !== (x.titulo || x.desc) || diTxt(tec) !== (x.tecnica || '') || (!x.tecnica && tec)) malosS.push((m.titulo || m.desc) + ' → ' + b + ' / ' + diTxt(tec));
    });
  }
  ok(n > 100 && !malosS.length, '[6.8] "Tambien te puede interesar": el modelo y, si la tiene, la linea tecnica, en todas las fichas',
     malosS.slice(0, 3).join(' | ') || n + ' pastillas');
  // Una ficha de verdad, contra la tarjeta
  const ap = MODELOS.find(m => m.stock && /AirPods Pro 3/i.test(m.titulo || m.desc)) || MODELOS.find(m => m.stock && relacionados(m).some(x => x.tecnica));
  if(ap){
    abrirFicha(clave(ap.rep), null);
    const pcs = [...document.querySelectorAll('#ficha .fi-rel .pc')];
    const mal = pcs.filter(pc => { const [nn, t] = diComoTarjeta(buscarModelo(pc.dataset.key)); return diTxt(pc.querySelector('b')) !== nn || diTxt(pc.querySelector('.pc-tec')) !== t; });
    ok(pcs.length > 0 && !mal.length, '[6.8] en la ficha de ' + (ap.titulo || ap.desc) + ' dicen lo mismo que sus tarjetas',
       pcs.map(pc => diTxt(pc.querySelector('.pc-txt b')) + (pc.querySelector('.pc-tec') ? ' / ' + diTxt(pc.querySelector('.pc-tec')) : '')).join(' | '));
    quitarFicha();
  }
}

/* ---- 6.9 La cinta de la marca ---- */
// La regla escrita aparte, sin usar cintaDeLaMarca
function diCintaEsperada(marca){
  const hay = MODELOS.filter(m => m.marca === marca && m.stock && m.precio !== null && m.imagen);
  const cod = m => Math.max(0, ...m.variantes.map(v => { const r = /^AT-(\d{4})/.exec(v.codigo || ''); return r ? +r[1] : 0; }));
  const orden = (a, b) => cod(b) - cod(a) || a.idx - b.idx;
  const nuevos = hay.filter(m => cod(m) >= 500).sort(orden);
  const resto = hay.filter(m => cod(m) < 500);
  const suyos = (RUBROS_POR_MARCA[marca] || []).map(norm);
  const rubros = [...new Set(resto.map(m => m.cat))].sort((a, b) => {
    const ia = suyos.includes(norm(a)) ? suyos.indexOf(norm(a)) : 99, ib = suyos.includes(norm(b)) ? suyos.indexOf(norm(b)) : 99;
    return ia - ib || a.localeCompare(b, 'es');
  });
  const pilas = rubros.map(c => resto.filter(m => m.cat === c).sort(orden));
  const out = nuevos.slice(0, 14);
  for(let i = 0; out.length < 14 && pilas.some(p => p[i]); i++) pilas.forEach(p => { if(out.length < 14 && p[i]) out.push(p[i]); });
  return { lista: out, nuevo: nuevos.length > 0 };
}
async function probarCintaDeMarca(){
  ok(ULTIMO_CODIGO_DEL_10_09 === 499, '[6.9] el corte del 10/09 es el AT-0499', ULTIMO_CODIGO_DEL_10_09);
  // Que el corte salga del catalogo maestro
  try{
    const r = await fetch('herramientas/catalogo-maestro.csv', { cache: 'no-store' });
    if(r.ok){
      /* CODIGO es la primera columna y Alta la primera fecha de la fila (los
         nombres pueden traer comas: no se parte por columnas) */
      const filas = (await r.text()).split(/\r?\n/).slice(1)
        .map(l => [/^AT-(\d{4})/.exec(l), /,(\d{4}-\d\d-\d\d),/.exec(l)])
        .filter(([c, a]) => c && a).map(([c, a]) => [+c[1], a[1]]);
      const del10 = filas.filter(f => f[1] === '2026-09-10').map(f => f[0]);
      const set10 = new Set(del10);
      const despues = filas.filter(f => f[1] > '2026-09-10' && !set10.has(f[0])).map(f => f[0]);
      ok(del10.length > 100 && Math.max(...del10) === ULTIMO_CODIGO_DEL_10_09 && despues.every(n => n > ULTIMO_CODIGO_DEL_10_09),
         '[6.9] en el maestro, lo del 10/09 llega hasta ese numero y lo que entro despues va arriba',
         del10.length + ' del 10/09 (hasta ' + Math.max(...del10) + '), ' + despues.length + ' despues (desde ' + Math.min(...despues) + ')');
    } else info('[6.9] no se pudo leer herramientas/catalogo-maestro.csv (' + r.status + ')');
  }catch(e){ info('[6.9] no se pudo leer el maestro: ' + e); }

  const malas = [], rotulos = [];
  for(const x of MV){
    const e = diCintaEsperada(x.marca);
    const tiene = x.nuevos.map(clave).join(',');
    if(tiene !== e.lista.map(clave).join(',')) malas.push(x.marca + ': ' + x.nuevos.slice(0, 4).map(m => m.titulo || m.desc).join(', '));
    const d = document.createElement('div'); d.innerHTML = htmlPanelMarca(x, false);
    const rot = diTxt(d.querySelector('.mv-rot'));
    const quiere = (e.nuevo ? 'Lo último de ' : 'De ') + x.marca;
    if(x.nuevos.length && rot !== quiere) rotulos.push(x.marca + ': «' + rot + '» (va «' + quiere + '»)');
  }
  ok(!malas.length, '[6.9] cada cinta: primero lo posterior al 10/09 y despues un producto de cada rubro por turno',
     malas.slice(0, 2).join(' | ') || MV.length + ' marcas');
  ok(!rotulos.length, '[6.9] "Lo último de" solo si arranca con algo posterior al 10/09; si no, "De <marca>"',
     rotulos.slice(0, 3).join(' | ') || MV.map(x => (x.hayNuevo ? 'Lo último de ' : 'De ') + x.marca).join(', '));
  /* Los casos de la muestra (Canon y Sony: nada posterior al 10/09, camaras y
     objetivos por turno, "De <marca>"). Se buscan por su forma en los datos
     de hoy (29/09, revision): el dia que Canon reciba un objetivo AT-05xx,
     ese va primero a proposito (la regla entera ya la mira la comprobacion
     de arriba) y aca baja a una linea '--' en vez de fallar con el sitio sano. */
  for(const marca of ['Canon', 'Sony']){
    const x = MV.find(y => y.marca === marca);
    if(!x){ info('[6.9] hoy ' + marca + ' no esta en la vitrina'); continue; }
    const e = diCintaEsperada(marca);
    if(e.nuevo){
      info('[6.9] hoy ' + marca + ' tiene algo posterior al 10/09 (' + (e.lista[0].titulo || e.lista[0].desc) +
           '): arranca con eso; el caso de la muestra ("De ' + marca + '") no se mira hoy');
      continue;
    }
    const cats = new Set(x.nuevos.map(m => m.cat));
    if(!(cats.has('Cámara') && cats.has('Objetivo'))){
      info('[6.9] hoy la cinta de ' + marca + ' no trae camaras y objetivos (' + [...cats].join(', ') + '): el caso de la muestra no se mira hoy');
      continue;
    }
    ok(x.nuevos[0].cat === 'Cámara' && !x.hayNuevo && x.nuevos.every(m => !entroDespuesDel10_09(m)),
       '[6.9] ' + marca + ': sin nada posterior al 10/09 arranca con una camara, trae camaras y objetivos y dice "De ' + marca + '"',
       x.nuevos.slice(0, 4).map(m => m.cat).join(', '));
  }
  const nikon = MV.find(y => y.marca === 'Nikon');
  const nuevoNikon = nikon && nikon.nuevos.find(entroDespuesDel10_09);
  if(nuevoNikon) ok(nikon.hayNuevo && nikon.nuevos[0] === nuevoNikon, '[6.9] Nikon: arranca con lo nuevo (' + (nuevoNikon.titulo || nuevoNikon.desc) + ') y dice "Lo último de Nikon"');
  else info('[6.9] hoy Nikon no tiene nada posterior al 10/09 en la cinta');
  // El panel a la vista usa el mismo rotulo
  const vivo = document.querySelector('#mv-lugar .mv-rot');
  ok(!!vivo && diTxt(vivo) === (MV[mvK].hayNuevo ? 'Lo último de ' : 'De ') + MV[mvK].marca, '[6.9] el panel a la vista lo dice igual', diTxt(vivo));
}

/* ---- 6.3 y 6.7 en el celular (390) y en una compu chica (900) ---- */
async function diIframe(ancho, alto){
  const f = document.createElement('iframe');
  f.style.cssText = `width:${ancho}px;height:${alto}px;border:0;position:absolute;left:-9999px;top:0`;
  f.src = 'index.html';
  document.body.appendChild(f);
  const listo = await diEsperarA(() => f.contentWindow.eval('MODELOS.length && FUENTE') && f.contentDocument.getElementById('sec-titulo'), 40000);
  if(!listo){ f.remove(); return null; }
  try{ f.contentWindow.pararOfertas?.(); f.contentWindow.pararPaseos?.(); f.contentWindow.pararMundos?.(); }catch(e){}
  await diEsperarA(() => f.contentDocument.fonts.check('22px "Lilita One"', 'Elegí un rubro'), 5000);
  return f;
}
async function probarAnchos(){
  for(const [ancho, tam] of [[900, '27px'], [390, '22px']]){
    const f = await diIframe(ancho, 700);
    ok(!!f, `[6.3] la pagina abre a ${ancho} px`);
    if(!f) continue;
    try{
      const w = f.contentWindow, doc = f.contentDocument;
      const t = diTitulo(doc, w);
      ok(t.texto === 'Elegí un rubro' && /^"?Lilita One"?/.test(t.familia) && t.tam === tam && t.peso === '400' && t.mayus === 'none',
         `[6.3] a ${ancho} px: Lilita, ${tam}, sin mayusculas (antes, la letra del sistema en negrita)`, [t.familia.split(',')[0], t.tam, t.peso, t.mayus].join(' · '));
      if(ancho === 390){
        const pie = doc.getElementById('pie-id'), cs = w.getComputedStyle(pie);
        const seps = [...pie.querySelectorAll('.sep')];
        ok(cs.display === 'flex' && cs.flexDirection === 'column' && seps.every(s => w.getComputedStyle(s).display === 'none'),
           '[6.7] en el celular, un dato por renglon y sin los "·"', cs.display + ' ' + cs.flexDirection);
        const rs = [...pie.children].filter(x => !x.classList.contains('sep')).map(x => x.getBoundingClientRect());
        ok(rs.every(r => r.right <= 390 && r.left >= 0) && rs.every((r, i) => i === 0 || r.top >= rs[i - 1].bottom - 1),
           '[6.7] y entra en el ancho', rs.map(r => Math.round(r.width)).join(','));
      }
    } finally { f.remove(); }
  }
}
