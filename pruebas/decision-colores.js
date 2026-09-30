// Como se elige el color en la ficha: Pedro eligio la C, "Vitrina de fotos"
// (30/09/2026, muestra muestras/colores/index.html). Reemplaza la tira de
// fotitos al costado de la foto (21/09).
//   C.1  debajo de la foto grande, el rotulo "Color" con el nombre del elegido
//        y una fila de fotos A COLOR, una por color, con el nombre abajo; el
//        elegido con el borde violeta
//   C.2  agotado: la foto en gris con "Sin stock" encima y el nombre tachado;
//        se puede tocar y el boton pasa a "Avisame cuando entre" (sin
//        "Agregar al pedido", 2.6 B)
//   C.3  precio distinto: abajo de cada foto, el suyo; si valen todos lo
//        mismo, ninguno
//   C.4  sin puntito: es la foto; sin foto, un circulo de su tono o rayas.
//        Los nombres de dos partes (caja y malla, armazon y cristal) se parten
//        en el guion o el punto que ya traen: arriba lo que cambia, sin
//        agregar ninguna palabra
//   C.5  muchos colores: la fila se desliza de costado; en el celular se ven
//        cuatro y un pedacito del quinto, con el borde derecho esfumado
//   C.6  un solo color: el nombre, sin fila
// Y las reglas que la muestra comparte: se ven solo los colores de la
// version que estas mirando; al cambiar la memoria se queda el mismo color y
// si ahi no esta pasa al mas barato con stock; los colores en el mismo orden
// en todas las versiones. Mas lo que ya dependia de la tira: "Ver las N
// versiones" (4.3), Compartir (4.1), el visor (4.4), el aviso del pedido
// (5.2), el foco y el celular (2.7/2.8).
// Sin nombres fijos: los casos salen de los datos del dia (primero los de la
// muestra: iPhone 17 Pro, Watch Ultra 3, Ray-Ban). El celular se mira en un
// iframe de 390 x 664 (el headless no baja de 500).
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);

const esperaDC = setInterval(() => {
  if(!MODELOS.length || !FUENTE || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperaDC);
  for(let i=1;i<5000;i++) clearInterval(i);
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; })
    .finally(() => {
      try{ if(cerrarVisorDOM){ visorEmpujado = false; const c = cerrarVisorDOM; cerrarVisorDOM = null; c(); } }catch(e){}
      try{ quitarFicha(); }catch(e){}
      try{ pararPaseos(); pararOfertas(); pararMundos(); }catch(e){}
      for(let i=1;i<5000;i++) clearInterval(i);
      const pre=document.createElement('pre'); pre.id='RESULTADO';
      pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
      document.body.appendChild(pre);
    });
}, 150);

const dcDormir = ms => new Promise(r => setTimeout(r, ms));
async function dcEsperarA(cond, ms = 25000){
  const t0 = Date.now();
  while(Date.now() - t0 < ms){
    try{ if(cond()) return true; }catch(e){}
    await dcDormir(150);
  }
  try{ return !!cond(); }catch(e){ return false; }
}
const dcTxt = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
const dcCss = (el, p, w = window) => el ? w.getComputedStyle(el).getPropertyValue(p) : '';
function dcAbrir(k){
  try{ quitarFicha(); }catch(e){}
  abrirFicha(k, null);
  const d = document.getElementById('ficha');
  // La ventana entra con una animacion (cajaIn): se termina para medir
  try{ d.getAnimations({ subtree: true }).forEach(a => a.finish()); }catch(e){}
  return d;
}
const dcTonos = d => [...d.querySelectorAll('.fi-vitrina .fi-tono')];
const dcMarcado = d => d.querySelector('.fi-vitrina .fi-tono[aria-pressed="true"]');
const dcTono = (d, k) => dcTonos(d).find(b => b.dataset.k === k);
const dcFoto = b => b && b.querySelector('.fi-tono-img .ph, .fi-tono-img .sw');
const dcPrecio = c => c.precio === null || c.precio === undefined ? 'Consultar' : 'USD ' + plata(c.precio);
const dcCta = d => d.querySelector('.fi-botones .cta');
// "a color": sin gris y sin transparencia (lo agotado es lo unico apagado)
const dcAColor = b => { const f = dcFoto(b); return !!f && dcCss(f, 'filter') === 'none' && parseFloat(dcCss(f, 'opacity')) === 1; };

/* Todas las fichas con dos colores o mas, una por version (fila) */
function dcCasos(){
  const out = [];
  for(const m of MODELOS) for(const v of m.variantes){
    const { lista, precioVaria } = coloresFicha(v, m);
    if(lista.length >= 2) out.push({ m, v, lista, precioVaria });
  }
  return out;
}
// Primero los productos de la muestra, si estan hoy
const dcPrefiere = (lista, re) => lista.filter(x => re.test(x.m.titulo || x.m.desc || '')).concat(lista.filter(x => !re.test(x.m.titulo || x.m.desc || '')));

async function correrPruebas(){
  quitarFicha();
  const antesPedido = PEDIDO.slice();
  PEDIDO = []; guardarPedido();
  try{
    probarPiezas();
    const casos = dcCasos();
    info(casos.length + ' fichas (filas) con dos colores o mas hoy');
    if(!casos.length){ ok(false, 'hoy hay fichas con colores para elegir'); return; }
    probarFicha(casos);
    probarAgotado(casos);
    probarPrecios(casos);
    probarDosPartes(casos);
    probarUnColor();
    probarOrden(casos);
    probarVersion(casos);
    await probarDependencias(casos);
    probarCompu(casos);
    await probarCelular(casos);
  } finally {
    quitarFicha();
    PEDIDO = antesPedido; guardarPedido(); pintarPedido();
  }
}

/* ---- Las piezas, sin abrir fichas ---- */
function probarPiezas(){
  ok(typeof htmlColorFicha === 'undefined' && typeof htmlVitrinaFicha === 'function',
     'la tira vieja (htmlColorFicha) ya no esta; la arma htmlVitrinaFicha');
  const css = [...document.styleSheets].flatMap(s => { try{ return [...s.cssRules].map(r => r.cssText); }catch(e){ return []; } }).join('\n');
  ok(!/\.fi-pintas/.test(css) && !/\.fi-color-nom/.test(css), 'y su CSS (.fi-pintas, .fi-color-nom) tampoco');

  // [C.4] Los nombres de dos partes, con el corte que ya traen
  const casosPartes = [
    [['Natural – Blue Trail Loop M/L', 'Black – Black Ocean Band'], ['Blue Trail Loop M/L', 'Black Ocean Band'], ['Natural', 'Black']],
    [['Shiny Black · Transitions Green', 'Shiny Black · Transitions Amethyst'], ['Transitions Green', 'Transitions Amethyst'], ['Shiny Black', 'Shiny Black']],
    [['Black · English', 'White · English'], ['Black', 'White'], ['English', 'English']],
    [['Rose-Gold', 'Space Gray'], ['Rose-Gold', 'Space Gray'], ['', '']],               // sin espacios no es un corte
    [['Black – Ocean', 'White'], ['Black – Ocean', 'White'], ['', '']],                   // uno solo de dos partes: enteros
    [['Ice White · White Leather+White Silicone'], ['Ice White · White Leather+White Silicone'], ['']],   // un solo color: entero
    [['A – X', 'A – Y', 'B – X', 'B – Y'], ['A – X', 'A – Y', 'B – X', 'B – Y'], ['', '', '', '']]      // lo de arriba se repetiria
  ];
  const malos = casosPartes.filter(([n, tops, subs]) => {
    const r = partesDeColores(n);
    return r.map(x => x.top).join('|') !== tops.join('|') || r.map(x => x.sub).join('|') !== subs.join('|');
  }).map(([n]) => n.join(' / ') + ' -> ' + partesDeColores(n).map(x => x.top + ' (' + x.sub + ')').join(', '));
  ok(!malos.length, '[C.4] los nombres de dos partes se parten en el guion o el punto que traen, arriba lo que cambia',
     malos.join(' | ') || casosPartes.length + ' casos');
  const agregadas = [];
  casosPartes.forEach(([n]) => partesDeColores(n).forEach((x, i) => {
    const palabras = (x.top + ' ' + x.sub).split(/\s+/).filter(Boolean);
    if(palabras.some(p => !n[i].split(/\s+/).includes(p))) agregadas.push(n[i]);
  }));
  ok(!agregadas.length, '[C.4] y no se agrega ni se cambia ninguna palabra', agregadas.join(' | ') || 'ninguna');

  // [C.4] Sin foto: un circulo de su tono, o rayas si no lo sabemos pintar
  const p = { id: 'PRUEBA-DC-1', color: 'Blue/Zzz Prueba', precio: 100, stock: true };
  const caja = document.createElement('div');
  caja.innerHTML = htmlVitrinaFicha(p, null);
  const [azul, raro] = [...caja.querySelectorAll('.fi-tono')];
  ok(azul && raro && !caja.querySelector('.ph') && azul.querySelector('.sw:not(.raya)') &&
     /background/.test(azul.querySelector('.sw').getAttribute('style') || '') && raro.querySelector('.sw.raya') &&
     !raro.querySelector('.sw').getAttribute('style'),
     '[C.4] sin foto, el circulo de su tono; sin tono conocido, rayas (no se inventa)',
     [...caja.querySelectorAll('.sw')].map(s => s.className + ' ' + (s.getAttribute('style') || '')).join(' / '));
  // Una fila agotada con dos colores: las dos fotos van en gris con "Sin stock"
  const q = { id: 'PRUEBA-DC-2', color: 'Blue/Black', precio: 100, stock: false };
  caja.innerHTML = htmlVitrinaFicha(q, null);
  const ts = [...caja.querySelectorAll('.fi-tono')];
  ok(ts.length === 2 && ts.every(b => b.classList.contains('agotada') && dcTxt(b.querySelector('.sin')) === 'Sin stock' &&
     /sin stock/.test(b.getAttribute('aria-label'))) && /sin stock/.test(dcTxt(caja.querySelector('.fi-vit-cab'))),
     '[C.2] lo agotado lleva "Sin stock" sobre la foto, en su nombre para el lector y al lado del elegido',
     ts.map(b => b.getAttribute('aria-label')).join(' / '));
}

/* ---- C.1 La ficha: debajo de la foto, fotos a color ---- */
function probarFicha(casos){
  const x = dcPrefiere(casos.filter(c => c.v === c.m.rep), /iPhone 17 Pro$/i)[0] || casos[0];
  const d = dcAbrir(clave(x.v));
  const nombre = (x.m.titulo || x.m.desc) + ' (' + x.v.id + ')';
  const foto = d.querySelector('.fi-foto'), marco = d.querySelector('.fi-marco');
  const vit = d.querySelector('.fi-colores'), fila = d.querySelector('.fi-vitrina');
  ok(!!fila && vit.closest('.fi-foto') === foto && !d.querySelector('.fi-datos .fi-tono'),
     '[C.1] la vitrina va en el lado de la foto, no en la columna de datos', nombre);
  ok(fila && fila.getBoundingClientRect().top >= marco.getBoundingClientRect().bottom - 1,
     '[C.1] debajo de la foto grande', fila && Math.round(fila.getBoundingClientRect().top) + ' >= ' + Math.round(marco.getBoundingClientRect().bottom));
  const cab = d.querySelector('.fi-vit-cab');
  ok(cab && dcTxt(cab.querySelector('.fi-vit-rot')) === 'Color' && cab.getBoundingClientRect().bottom <= fila.getBoundingClientRect().top + 1,
     '[C.1] arriba de la fila, el rotulo "Color" con el nombre del elegido', dcTxt(cab));
  const tonos = dcTonos(d);
  ok(tonos.map(b => b.dataset.color).join('|') === x.lista.map(c => c.nombre).join('|'),
     '[C.1] una foto por color de la version, en el orden de coloresFicha', tonos.map(b => b.dataset.color).join(' / '));
  const marcados = tonos.filter(b => b.getAttribute('aria-pressed') === 'true');
  ok(marcados.length === 1 && norm(marcados[0].dataset.color) === norm(COLOR_FICHA) &&
     d.querySelector('#fi-color-txt').dataset.color === marcados[0].dataset.color,
     '[C.1] uno solo marcado: el elegido, el mismo que dice el nombre', marcados.map(b => b.dataset.color).join(', ') + ' / ' + COLOR_FICHA);
  const sinFoto = tonos.filter((b, i) => !!miniColorFicha(x.lista[i].fila, x.lista[i].nombre) !==
    /url\(/.test(b.querySelector('.ph')?.getAttribute('style') || ''));
  ok(!sinFoto.length, '[C.1] cada una con la foto de su color cuando la hay', sinFoto.map(b => b.dataset.color).join(', ') || tonos.length + ' fotos');
  const apagados = tonos.filter(b => !b.classList.contains('agotada') && !dcAColor(b));
  ok(!apagados.length, '[C.1] todas a color: en gris va solo lo agotado, no lo que no elegiste',
     apagados.map(b => b.dataset.color + ' ' + dcCss(dcFoto(b), 'filter')).join(', ') || 'ninguna apagada');
  const nm = tonos.filter(b => { const t = dcTxt(b.querySelector('.nm')); return !t || !b.dataset.color.includes(t); });
  ok(!nm.length, '[C.1] con su nombre abajo de cada foto', nm.map(b => b.dataset.color).join(', ') || tonos.map(b => dcTxt(b.querySelector('.nm'))).join(' / '));
  const borde = dcCss(marcados[0]?.querySelector('.fi-tono-img'), 'box-shadow');
  ok(/rgb\(124, 58, 237\)/.test(borde) && /2px/.test(borde), '[C.1] el elegido, con el borde violeta', borde);
  ok(!/El precio cambia según el color|Tocá un color para elegirlo/.test(dcTxt(d)),
     '[C.1] sin los avisos de la tira vieja ("El precio cambia…", "Tocá un color…")');
  ok(dcCss(fila, 'overflow-x') === 'auto' && dcCss(fila, 'flex-wrap') === 'nowrap', '[C.5] la fila no baja de renglon: se desliza');
  quitarFicha();
}

/* ---- C.2 Agotado: gris, "Sin stock", se puede tocar ---- */
function probarAgotado(casos){
  const conAgotado = casos.filter(x => x.v.stock && x.lista.some(c => c.fila && c.fila.stock === false && c.k !== clave(x.v)));
  const x = dcPrefiere(conAgotado, /Watch Ultra 3/i)[0];
  if(!x){ info('[C.2] hoy ninguna ficha con stock ofrece un color agotado de otra fila'); return; }
  const c = x.lista.find(y => y.fila.stock === false && y.k !== clave(x.v));
  const d = dcAbrir(clave(x.v));
  const b = dcTono(d, c.k);
  const f = dcFoto(b);
  ok(b && b.classList.contains('agotada') && dcTxt(b.querySelector('.sin')) === 'Sin stock' &&
     /grayscale/.test(dcCss(f, 'filter')) && parseFloat(dcCss(f, 'opacity')) < 1,
     '[C.2] el color agotado: la foto en gris con "Sin stock" encima', (x.m.titulo || x.m.desc) + ' / ' + c.nombre);
  ok(b && /line-through/.test(dcCss(b.querySelector('.nm'), 'text-decoration-line')) && !b.disabled,
     '[C.2] el nombre tachado, y el boton sigue andando');
  const libre = dcTonos(d).find(y => !y.classList.contains('agotada'));
  ok(!!libre && dcAColor(libre) && !/line-through/.test(dcCss(libre.querySelector('.nm'), 'text-decoration-line')),
     '[C.2] y los que tienen stock, a color y sin tachar', libre && libre.dataset.color);
  b.click();
  const dd = document.getElementById('ficha');
  const cta = dcCta(dd);
  ok(FICHA === c.k && dcMarcado(dd)?.dataset.k === c.k, '[C.2] tocarlo lo elige (pasa a su fila)', FICHA);
  ok(cta && dcTxt(cta) === 'Avisame cuando entre' && !dd.querySelector('#fi-pedido'),
     '[C.2] y el boton pasa a "Avisame cuando entre", sin "Agregar al pedido" (2.6 B)', dcTxt(cta));
  ok(/sin stock/.test(dcTxt(dd.querySelector('.fi-vit-cab'))) && /Sin stock/i.test(dcTxt(dd.querySelector('.fi-arriba'))),
     '[C.2] arriba de la vitrina y en la etiqueta de la foto dice sin stock', dcTxt(dd.querySelector('.fi-vit-cab')));
  const vuelta = dcTonos(dd).find(y => y.dataset.k === clave(x.v));
  vuelta?.click();
  const d3 = document.getElementById('ficha');
  ok(FICHA === clave(x.v) && dcTxt(dcCta(d3)) === 'Consultar por WhatsApp' && !!d3.querySelector('#fi-pedido') &&
     !/sin stock/.test(dcTxt(d3.querySelector('.fi-vit-cab'))),
     '[C.2] volver a uno con stock devuelve "Consultar por WhatsApp" y "Agregar al pedido"', dcTxt(dcCta(d3)));
  quitarFicha();
}

/* ---- C.3 Precio distinto por color ---- */
function probarPrecios(casos){
  const varia = dcPrefiere(casos.filter(x => x.precioVaria), /iPhone 17 Pro$/i)[0];
  if(!varia) info('[C.3] hoy ninguna version tiene precio distinto por color');
  else{
    const d = dcAbrir(clave(varia.v));
    const mal = dcTonos(d).filter((b, i) => dcTxt(b.querySelector('.pr')) !== dcPrecio(varia.lista[i]));
    ok(!mal.length, '[C.3] con precio distinto, cada foto dice el suyo abajo del nombre',
       mal.map(b => b.dataset.color + ': ' + dcTxt(b.querySelector('.pr'))).join(', ') ||
       dcTonos(d).map(b => b.dataset.color + ' ' + dcTxt(b.querySelector('.pr'))).join(' / '));
    const pr = d.querySelector('.fi-tono .pr'), nm = d.querySelector('.fi-tono .nm');
    ok(pr && nm && pr.getBoundingClientRect().top >= nm.getBoundingClientRect().bottom - 1, '[C.3] el precio va debajo del nombre');
    quitarFicha();
  }
  const igual = casos.find(x => !x.precioVaria);
  if(!igual) info('[C.3] hoy ninguna version tiene todos los colores al mismo precio');
  else{
    const d = dcAbrir(clave(igual.v));
    ok(!d.querySelector('.fi-tono .pr'), '[C.3] si valen todos lo mismo, ninguno dice precio', (igual.m.titulo || igual.m.desc));
    quitarFicha();
  }
}

/* ---- C.4 Los de dos partes (mallas, cristales) ---- */
function probarDosPartes(casos){
  const dos = dcPrefiere(casos.filter(x => partesDeColores(x.lista.map(c => c.nombre)).some(p => p.sub)), /Watch Ultra 3|Skyler/i)[0];
  if(!dos){ info('[C.4] hoy ninguna ficha tiene colores de dos partes'); return; }
  const partes = partesDeColores(dos.lista.map(c => c.nombre));
  const d = dcAbrir(clave(dos.v));
  const tonos = dcTonos(d);
  const mal = tonos.filter((b, i) => dcTxt(b.querySelector('.nm')) !== partes[i].top);
  ok(!mal.length, '[C.4] ' + (dos.m.titulo || dos.m.desc) + ': abajo de cada foto, la parte que cambia',
     mal.map(b => b.dataset.color).join(', ') || tonos.map(b => dcTxt(b.querySelector('.nm'))).join(' / '));
  const i = tonos.findIndex(b => b.getAttribute('aria-pressed') === 'true');
  const cab = d.querySelector('.fi-vit-cab');
  const smalls = [...cab.querySelectorAll('small:not([hidden])')].map(dcTxt);
  ok(i >= 0 && dcTxt(d.querySelector('#fi-color-txt')) === partes[i].top && smalls[0] === '· ' + partes[i].sub &&
     dcTxt(cab.querySelector('.fi-vit-rot')) === 'Color',
     '[C.4] arriba: "Color", lo que cambia y al lado la otra parte, sin palabras agregadas', dcTxt(cab));
  const elegido = dcTxt(d.querySelector('#fi-elegido'));
  ok(i >= 0 && elegido.includes(tonos[i].dataset.color) && decodeURIComponent(dcCta(d)?.href || '').includes(tonos[i].dataset.color),
     '[C.4] "Estás eligiendo" y el WhatsApp siguen con el nombre entero', elegido);
  quitarFicha();
}

/* ---- C.6 Un solo color: el nombre, sin fila ---- */
function probarUnColor(){
  const solos = MODELOS.filter(m => m.rep && m.rep.color && coloresFicha(m.rep, m).lista.length === 1);
  const m = solos.find(x => /·|\s[–-]\s/.test(x.rep.color)) || solos[0];
  if(!m){ info('[C.6] hoy ningun modelo tiene un solo color'); return; }
  const d = dcAbrir(clave(m.rep));
  const cab = d.querySelector('.fi-vit-cab');
  ok(cab && cab.classList.contains('solo') && dcTxt(cab.querySelector('.fi-vit-rot')) === 'Color' &&
     dcTxt(d.querySelector('#fi-color-txt')) === m.rep.color.trim() && !d.querySelector('.fi-vitrina, .fi-tono'),
     '[C.6] con un solo color, el nombre entero y sin fila', (m.titulo || m.desc) + ': ' + dcTxt(cab));
  // Su foto es la de ese color: nunca "sin foto de este color" (tampoco con el color guardado en el pedido)
  ok(!d.querySelector('#fi-color-hint'), '[C.6] y sin el aviso "sin foto de este color"');
  quitarFicha();
}

/* ---- Regla: los colores en el mismo orden en todas las versiones ---- */
function probarOrden(casos){
  const mal = [];
  const porModelo = new Map();
  casos.forEach(x => { if(!porModelo.has(x.m)) porModelo.set(x.m, []); porModelo.get(x.m).push(x.lista.map(c => norm(c.nombre))); });
  for(const [m, listas] of porModelo){
    for(const a of listas) for(const b of listas){
      const ca = a.filter(n => b.includes(n)), cb = b.filter(n => a.includes(n));
      if(ca.join('|') !== cb.join('|')){ mal.push((m.titulo || m.desc) + ': ' + a.join(',') + ' / ' + b.join(',')); break; }
    }
  }
  ok(!mal.length, '[orden] en ningun modelo el orden de los colores cambia entre versiones',
     [...new Set(mal)].slice(0, 3).join(' | ') || porModelo.size + ' modelos con colores');
}

/* ---- Reglas: solo los de la version, y al cambiar de memoria ---- */
function conMemorias(casos){
  return dcPrefiere(casos.filter(x => x.v === x.m.rep && x.m.multi), /iPhone 17 Pro$/i).find(x => {
    const d = dcAbrir(clave(x.v));
    const hay = d.querySelectorAll('.fi-ops[data-eje="memoria"] .fi-op').length >= 2 && dcTonos(d).length >= 2;
    quitarFicha();
    return hay;
  });
}
function probarVersion(casos){
  const x = conMemorias(casos);
  if(!x){ info('[version] hoy ninguna ficha tiene memorias y colores a la vez'); return; }
  const m = x.m, nombre = x.m.titulo || x.m.desc;
  let d = dcAbrir(clave(x.v));
  const op = buscarProducto(FICHA).opcion;
  const deOtra = dcTonos(d).filter(b => (buscarProducto(b.dataset.k) || {}).opcion !== op);
  ok(!deOtra.length, '[version] ' + nombre + ': se ven solo los colores de la version abierta (' + op + ')',
     deOtra.map(b => b.dataset.color + ' de ' + (buscarProducto(b.dataset.k) || {}).opcion).join(', ') || dcTonos(d).length + ' colores');
  const orden0 = dcTonos(d).map(b => norm(b.dataset.color));

  // Se queda el color: se elige uno que la otra memoria tambien tenga
  const tabs = [...d.querySelectorAll('.fi-ops[data-eje="memoria"] .fi-op')].filter(b => b.getAttribute('aria-pressed') !== 'true');
  let hecho = false;
  for(const tab of tabs){
    const grupo = m.variantes.filter(v => v.opcion === tab.dataset.op);
    const comun = dcTonos(d).find(b => grupo.some(v => partirColores(v.color).some(c => norm(c) === norm(b.dataset.color))) &&
                                       b.getAttribute('aria-pressed') !== 'true') ||
                  dcTonos(d).find(b => grupo.some(v => partirColores(v.color).some(c => norm(c) === norm(b.dataset.color))));
    if(!comun) continue;
    const color = comun.dataset.color;
    comun.click();
    d = document.getElementById('ficha');
    const tab2 = [...d.querySelectorAll('.fi-ops[data-eje="memoria"] .fi-op')].find(b => b.dataset.mem === tab.dataset.mem);
    tab2.click();
    d = document.getElementById('ficha');
    const ahora = buscarProducto(FICHA);
    ok(ahora && partirColores(ahora.color).some(c => norm(c) === norm(color)) && norm(COLOR_FICHA) === norm(color) &&
       norm(dcMarcado(d)?.dataset.color || '') === norm(color),
       '[version] al cambiar la memoria se queda el mismo color', nombre + ': ' + color + ' -> ' + (ahora && ahora.opcion));
    const orden1 = dcTonos(d).map(b => norm(b.dataset.color));
    ok(orden0.filter(n => orden1.includes(n)).join('|') === orden1.filter(n => orden0.includes(n)).join('|'),
       '[orden] y los colores siguen en el mismo orden', orden0.join(',') + ' -> ' + orden1.join(','));
    hecho = true;
    break;
  }
  if(!hecho) info('[version] ' + nombre + ': ninguna otra memoria comparte color');
  quitarFicha();

  /* Si ahi no esta, pasa al mas barato con stock. Se busca en los datos un
     boton de version o memoria que lleve a un grupo sin el color elegido. */
  let caso = null;
  const vistos = new Set();
  for(const y of casos.filter(z => z.m.multi)){
    if(vistos.has(y.m) || vistos.size >= 80) continue;
    vistos.add(y.m);
    const dy = dcAbrir(clave(y.v));
    const cy = norm(COLOR_FICHA);
    const b = [...dy.querySelectorAll('.fi-op')].find(t => {
      if(t.getAttribute('aria-pressed') === 'true') return false;
      const g = y.m.variantes.filter(v => v.opcion === t.dataset.op);
      return g.length > 1 && !g.some(v => clave(v) === FICHA) && !g.some(v => partirColores(v.color).some(c => norm(c) === cy));
    });
    if(b){ caso = { y, b, color: COLOR_FICHA }; break; }
    quitarFicha();
  }
  if(!caso){ info('[version] hoy ningun cambio de version lleva a una sin el color elegido'); return; }
  const g = caso.y.m.variantes.filter(v => v.opcion === caso.b.dataset.op);
  const conStock = g.filter(v => v.stock);
  const base = conStock.length ? conStock : g;
  const min = Math.min(...base.map(v => v.precio ?? Infinity));
  caso.b.click();
  const ahora = buscarProducto(FICHA);
  ok(ahora && g.includes(ahora) && (ahora.precio ?? Infinity) === min && (!conStock.length || ahora.stock),
     '[version] si la otra no tiene ese color, pasa al mas barato con stock',
     (caso.y.m.titulo || caso.y.m.desc) + ': ' + caso.color + ' -> ' + caso.b.dataset.op + ' · ' + (ahora && ahora.color) + ' USD ' + (ahora && ahora.precio) + ' (min ' + min + ')');
  ok(norm(dcMarcado(document.getElementById('ficha'))?.dataset.color || '') === norm(COLOR_FICHA),
     '[version] y la vitrina marca ese color', COLOR_FICHA);
  quitarFicha();
}

/* ---- Lo que ya dependia de la tira ---- */
async function probarDependencias(casos){
  // Un color de OTRA fila con stock (el clic cambia de fila)
  const pares = casos.filter(x => x.v.stock && x.lista.some(c => c.k !== clave(x.v) && c.fila.stock));
  const x = dcPrefiere(pares.filter(y => y.v === y.m.rep), /iPhone 17 Pro$/i)[0] || pares[0];
  if(!x){ info('hoy ninguna ficha con stock tiene otro color con stock en otra fila'); return; }
  const c = x.lista.find(y => y.k !== clave(x.v) && y.fila.stock);
  const nombre = (x.m.titulo || x.m.desc) + ' ' + c.nombre;

  // El foco: tocar un color con el teclado lo deja en el color elegido
  let d = dcAbrir(clave(x.v));
  const b = dcTono(d, c.k);
  b.focus();
  b.click();
  d = document.getElementById('ficha');
  const a = document.activeElement;
  ok(a && a.matches('.fi-tono[aria-pressed="true"]') && a.dataset.k === c.k && d.contains(a),
     '[foco] tocar un color que cambia de fila deja el foco en ese color, no en BODY', a ? (a.dataset.color || a.className || a.tagName) : 'nada');
  // 4.1 Compartir comparte la fila elegida
  ok(location.hash === '#p=' + encodeURIComponent(c.k), '[4.1] la direccion pasa a la fila de ese color', location.hash);
  const copiar = copiarAlPortapapeles;
  let copiado = '';
  copiarAlPortapapeles = async t => { copiado = t; return true; };
  try{ await compartirFicha(); } finally { copiarAlPortapapeles = copiar; }
  ok(copiado.includes(encodeURIComponent(c.k)) && copiado.startsWith(textoParaCompartir(buscarProducto(c.k), c.nombre)),
     '[4.1] y Compartir manda esa fila, con su color', copiado.replace(/\s+/g, ' ').slice(0, 110));
  // 4.4 El visor muestra la foto y el color que se estan mirando
  await dcDormir(1200);
  const lupa = d.querySelector('.fi-lupa');
  if(lupa && d.querySelector('.fi-marco > img')){
    const src = d.querySelector('.fi-marco > img').getAttribute('src');
    lupa.click(); await dcDormir(150);
    const v = document.getElementById('visor');
    ok(v && v.querySelector('img')?.getAttribute('src') === src && dcTxt(v.querySelector('.visor-rot')).endsWith(COLOR_FICHA),
       '[4.4] el visor muestra la foto y el color elegidos en la vitrina', src && decodeURIComponent(src.split('/').pop()));
    if(cerrarVisorDOM){ visorEmpujado = false; const cv = cerrarVisorDOM; cerrarVisorDOM = null; cv(); }
  } else info('[4.4] esa ficha no tiene foto para el visor');
  quitarFicha();

  // 4.3 "Ver las N versiones": tocar un renglon de otro color lo marca en la vitrina
  const conTodas = dcPrefiere(casos.filter(y => y.v === y.m.rep && y.m.variantes.length >= TODAS_DESDE), /iPhone 17 Pro$/i)[0];
  if(!conTodas) info('[4.3] hoy ninguna ficha con colores tiene "Ver las N versiones"');
  else{
    d = dcAbrir(clave(conTodas.v));
    const todas = d.querySelector('.fi-todas');
    if(todas){
      todas.open = true; TODAS_ABIERTA = true;
      const fila = [...d.querySelectorAll('.fi-fila')].find(f => f.dataset.color && f.dataset.k !== FICHA &&
        norm(f.dataset.color) !== norm(COLOR_FICHA) && (buscarProducto(f.dataset.k) || {}).opcion === buscarProducto(FICHA).opcion) ||
        [...d.querySelectorAll('.fi-fila')].find(f => f.dataset.color && norm(f.dataset.color) !== norm(COLOR_FICHA));
      if(fila){
        const k = fila.dataset.k, col = fila.dataset.color;
        fila.click();
        d = document.getElementById('ficha');
        ok(FICHA === k && norm(dcMarcado(d)?.dataset.color || '') === norm(col) &&
           norm(d.querySelector('#fi-color-txt')?.dataset.color || '') === norm(col) && d.querySelector('.fi-todas')?.open,
           '[4.3] un renglon de "Ver las N versiones" deja su color marcado en la vitrina (y la lista abierta)',
           (conTodas.m.titulo || conTodas.m.desc) + ': ' + col);
      } else info('[4.3] la lista no tiene un renglon de otro color');
    } else info('[4.3] la ficha no mostro la lista');
    quitarFicha();
  }

  // 5.2 El aviso de lo que ya esta en el pedido sigue al color tocado
  PEDIDO = [{ k: clave(x.v), n: 1, color: colorPorDefecto(x.v) }]; guardarPedido();
  d = dcAbrir(clave(x.v));
  dcTono(d, c.k).click();
  d = document.getElementById('ficha');
  ok(!!d.querySelector('#fi-ya') && /Ya tenés en el pedido/.test(dcTxt(d.querySelector('#fi-ya'))),
     '[5.2] con otro color cargado, tocar este avisa "Ya tenés en el pedido"', nombre + ': ' + dcTxt(d.querySelector('#fi-ya')).slice(0, 80));
  quitarFicha();
  PEDIDO = []; guardarPedido(); pintarPedido();
}

/* ---- La compu: fotos de 78 px, en la columna de la foto ---- */
function probarCompu(casos){
  const x = dcPrefiere(casos, /iPhone 17 Pro$/i)[0];
  const d = dcAbrir(clave(x.v));
  const t = dcTonos(d)[0];
  const rf = d.querySelector('.fi-foto').getBoundingClientRect(), rd = d.querySelector('.fi-datos').getBoundingClientRect();
  const rv = d.querySelector('.fi-vitrina').getBoundingClientRect();
  ok(t && Math.round(t.getBoundingClientRect().width) === 78 && rv.right <= rf.right + 1 && rv.right <= rd.left + 1,
     '[compu] fotos de 78 px, en la columna de la foto (a la izquierda de los datos)',
     t && Math.round(t.getBoundingClientRect().width) + ' px · ' + Math.round(rv.right) + ' <= ' + Math.round(rd.left));
  quitarFicha();
}

/* ---- C.5 El celular (390): la fila se desliza, 4 y un pedacito ---- */
async function probarCelular(casos){
  // Muchos colores, abierta en el ULTIMO: tiene que quedar a la vista
  const muchos = dcPrefiere(casos.filter(x => x.lista.length >= 5), /Watch Ultra 3/i)[0];
  if(!muchos){ info('[C.5] hoy ninguna ficha tiene cinco colores o mas'); return; }
  const ultimo = muchos.lista[muchos.lista.length - 1];
  const f = document.createElement('iframe');
  f.style.cssText = 'width:390px;height:664px;border:0;position:absolute;left:-9999px;top:0';
  f.src = 'index.html#p=' + encodeURIComponent(ultimo.k);
  document.body.appendChild(f);
  try{
    const listo = await dcEsperarA(() => f.contentWindow.eval('MODELOS.length && FUENTE && FICHA') &&
                                          f.contentDocument.querySelector('#ficha .fi-vitrina .fi-tono'), 40000);
    ok(listo, '[C.5 · 390] el celular abre la ficha del ' + (muchos.m.titulo || muchos.m.desc) + ' en ' + ultimo.nombre);
    if(!listo) return;
    const w = f.contentWindow, doc = f.contentDocument;
    try{ w.pararOfertas?.(); w.pararPaseos?.(); w.pararMundos?.(); }catch(e){}
    await dcDormir(300);
    try{ doc.getElementById('ficha').getAnimations({ subtree: true }).forEach(a => a.finish()); }catch(e){}
    await dcDormir(100);
    const fila = doc.querySelector('#ficha .fi-vitrina');
    const tonos = [...fila.querySelectorAll('.fi-tono')];
    const caja = doc.querySelector('#ficha .caja');
    const ancho = Math.round(tonos[0].getBoundingClientRect().width);
    ok(ancho >= 60 && ancho <= 74, '[C.5 · 390] fotos de 60 a 74 px (74 en la muestra, sin los margenes de la ficha)', ancho + ' px');
    const rf = fila.getBoundingClientRect();
    const sel = fila.querySelector('.fi-tono[aria-pressed="true"]');
    const rs = sel && sel.getBoundingClientRect();
    ok(sel && sel.dataset.k === ultimo.k && rs.left >= rf.left - 1 && rs.right <= rf.right + 1,
       '[C.5 · 390] abierta en el ultimo color, la fila se corre y el elegido se ve entero',
       sel && Math.round(rs.left - rf.left) + '-' + Math.round(rs.right - rf.left) + ' en ' + Math.round(rf.width));
    const datos = doc.querySelector('#ficha .fi-datos');
    ok(rf.bottom <= datos.getBoundingClientRect().top + 1 && rf.top >= doc.querySelector('#ficha .fi-marco').getBoundingClientRect().bottom - 1,
       '[C.5 · 390] entre la foto y el nombre del producto');
    fila.scrollLeft = 0;
    fila.dispatchEvent(new w.Event('scroll'));
    await dcDormir(120);
    const r0 = fila.getBoundingClientRect();
    const enteras = tonos.filter(b => { const r = b.getBoundingClientRect(); return r.left >= r0.left - 1 && r.right <= r0.right + 1; }).length;
    const quinta = tonos[4].getBoundingClientRect();
    ok(enteras === 4 && quinta.left < r0.right - 4 && quinta.right > r0.right,
       '[C.5 · 390] al principio se ven cuatro y un pedacito del quinto', enteras + ' enteras, la quinta hasta ' + Math.round(quinta.left - r0.left) + ' de ' + Math.round(r0.width));
    ok(fila.classList.contains('corre') && /gradient/.test(w.getComputedStyle(fila).webkitMaskImage || w.getComputedStyle(fila).maskImage || ''),
       '[C.5 · 390] y el borde derecho se esfuma (hay mas)', fila.className);
    fila.scrollLeft = fila.scrollWidth;
    fila.dispatchEvent(new w.Event('scroll'));
    await dcDormir(120);
    ok(!fila.classList.contains('corre'), '[C.5 · 390] al llegar al final ya no se esfuma');
    ok(caja.scrollWidth <= caja.clientWidth + 1 && doc.documentElement.scrollWidth <= 391,
       '[C.5 · 390] la ficha no se sale de costado', caja.scrollWidth + ' / ' + caja.clientWidth);
    // 2.7 / 2.8 siguen: los botones y la X pegados
    const cs = el => w.getComputedStyle(el);
    ok(cs(doc.querySelector('#ficha .fi-botones')).position === 'sticky' && cs(doc.querySelector('#ficha .fi-cerrar')).position === 'sticky',
       '[2.7/2.8 · 390] los botones y la X siguen pegados');
    // Tocar otro color en el celular: cambia la fila y la vitrina no vuelve al principio
    const otro = tonos.find(b => b.getAttribute('aria-pressed') !== 'true' && !b.classList.contains('agotada')) || tonos[0];
    fila.scrollLeft = fila.scrollWidth;
    const k = otro.dataset.k;
    otro.click();
    await dcDormir(100);
    const fila2 = doc.querySelector('#ficha .fi-vitrina');
    const sel2 = fila2.querySelector('.fi-tono[aria-pressed="true"]');
    const r2 = fila2.getBoundingClientRect(), rs2 = sel2 && sel2.getBoundingClientRect();
    ok(w.eval('FICHA') === k && sel2 && sel2.dataset.k === k && rs2.left >= r2.left - 1 && rs2.right <= r2.right + 1,
       '[C.5 · 390] tocar otro color lo marca y lo deja a la vista', sel2 && sel2.dataset.color);
  } finally {
    f.remove();
  }
}
