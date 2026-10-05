// Cotizá tu usado (Pedro, 05/10/2026). Muestrario de usados: eligio 1B 2A 3A
// 5A; en la portada no va nada (la G del muestrario de la seccion). Los
// valores los pasa el y se suben tal cual a datos/usados.json ("pasamelo a
// mi siempre").
//   datos  el archivo cumple usados/1, nada se saltea al leerlo, los valores
//          son numeros enteros en USD, ningun modelo repetido; iPhone con la
//          bateria (80 %, USD 20) y sus cuatro condiciones; PS4 y PS4 Pro.
//   1B     "🔁 Entregar mi usado" en la ficha con stock, al lado de "Agregar
//          al pedido" (y de "Quitar del pedido"); sin stock no esta.
//   2A     paso a paso: equipo, modelo, memoria (la caja en la PS4),
//          bateria y estado, con "Paso N de M"; Atras vuelve un paso; Escape,
//          la X y el Atras del navegador cierran solo el cotizador.
//   3A     el valor si cumple todo, la bateria que resta, "Lo revisamos en
//          persona" sin numero si algo no cumple, la cuenta con el producto
//          ("Te queda" / "Te queda a favor") y el mensaje de WhatsApp.
//   5A     "¿Entregás un usado?" en el pedido: el usado resta en el total, la
//          barra y el mensaje; "No" lo borra; sin usado el mensaje es el de
//          siempre. Si el usado paga todo, no se ofrecen cuotas.
//   360    en el celular los dos botones entran lado a lado en un renglon.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);

const esperaUZ = setInterval(() => {
  if(!MODELOS.length || !FUENTE || !USADOS || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperaUZ);
  for(let i=1;i<5000;i++) clearInterval(i);
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; })
    .finally(() => {
      try{ uzCerrarTodo(); }catch(e){}
      try{ pararPaseos(); pararOfertas(); pararMundos(); }catch(e){}
      for(let i=1;i<5000;i++) clearInterval(i);
      const pre=document.createElement('pre'); pre.id='RESULTADO';
      pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
      document.body.appendChild(pre);
    });
}, 150);

const uzDormir = ms => new Promise(r => setTimeout(r, ms));
async function uzEsperarA(cond, ms = 25000){
  const t0 = Date.now();
  while(Date.now() - t0 < ms){
    try{ if(cond()) return true; }catch(e){}
    await uzDormir(150);
  }
  return false;
}
const uzTxt = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
const uzPlata = n => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 });
// searchParams ya lo decodifica: otro decodeURIComponent rompe con el "80 %"
const uzWA = a => { try{ return new URL(a.href).searchParams.get('text') || ''; }catch(e){ return ''; } };
// Los renglones de una cuenta (cada div, sus partes con espacio), separados por " / "
const uzFilas = el => el ? [...el.querySelectorAll(':scope > div')].map(d => [...d.children].map(uzTxt).join(' ')).join(' / ') : '';
// En cuantos renglones se parte el texto de un boton
const uzRenglones = el => { const r = el.ownerDocument.createRange(); r.selectNodeContents(el);
  return new Set([...r.getClientRects()].filter(x => x.width > 0).map(x => Math.round(x.top))).size; };
const uzCot = () => document.getElementById('usado');
const uzPreg = () => uzTxt(uzCot() && uzCot().querySelector('#us-preg'));
const uzPaso = () => uzTxt(uzCot() && uzCot().querySelector('.us-paso'));
function uzTocar(sel){
  const b = uzCot() && uzCot().querySelector(sel);
  if(b) b.click();
  return !!b;
}
function uzCerrarTodo(){
  if(cerrarUsadoDOM){ usadoEmpujado = false; const c = cerrarUsadoDOM; cerrarUsadoDOM = null; c(); }
  if(cerrarPedidoDOM){ pedidoEmpujado = false; const c = cerrarPedidoDOM; cerrarPedidoDOM = null; c(); }
  if(FICHA) quitarFicha();
  try{ history.replaceState(null, '', location.pathname); }catch(e){}
}
// Una cotizacion completa, por los botones: equipo, modelo, opcion, bateria, condiciones
async function uzCotizar(e, m, o, bat, conds){
  if(uzCot().querySelector('.us-op[data-e]')) uzTocar(`.us-op[data-e="${e}"]`);
  uzTocar(`.us-op[data-m="${m}"]`);
  if(uzCot().querySelector('.us-op[data-o]')) uzTocar(`.us-op[data-o="${o}"]`);
  if(bat) uzTocar(`.us-op[data-bat="${bat}"]`);
  for(const [id, v] of Object.entries(conds)) uzTocar(`.pd-chip[data-cond="${id}"][data-v="${v ? 1 : 0}"]`);
  uzTocar('#us-ver');
  await uzDormir(30);
}
const uzTodoSi = e => Object.fromEntries(equipoUsado(e).condiciones.map(c => [c.id, true]));
// Los valores salen del archivo: si Pedro cambia uno, la prueba lo sigue
const uzVale = (e, m, o) => { const x = modeloUsado(equipoUsado(e), m); const op = x && x.opciones.find(y => y.nombre === o); return op ? op.usd : null; };
let V13, MAX, PSP, BAT;      // iPhone 13 128GB, 17 Pro Max 2TB, PS4 Pro sin caja, la bateria del iPhone

async function correrPruebas(){
  V13 = uzVale('iphone', 'iphone-13', '128GB'); MAX = uzVale('iphone', 'iphone-17-pro-max', '2TB');
  PSP = uzVale('playstation', 'ps4-pro', 'Sin caja'); BAT = equipoUsado('iphone') && equipoUsado('iphone').bateria;
  if(!V13 || !MAX || !PSP || !BAT){ ok(false, 'la lista tiene el iPhone 13 128GB, el 17 Pro Max 2TB, la PS4 Pro sin caja y la bateria del iPhone (los casos de esta tanda)'); return; }
  const crudo = await (await fetch('datos/usados.json', { cache: 'no-store' })).json();
  probarLosDatos(crudo);
  await probarLaFicha();
  await probarElPedido();
  await probarCelular();
}

/* ---- El archivo ---- */
function probarLosDatos(j){
  ok(j && j.formato === 'usados/1' && Array.isArray(j.equipos), 'datos/usados.json: formato usados/1', j && j.formato);
  const modelos = [], malas = [];
  (j.equipos || []).forEach(e => (e.grupos || []).forEach(g => (g.modelos || []).forEach(m => {
    modelos.push(m.id);
    (m.opciones || []).forEach(o => {
      if(typeof o.usd !== 'number' || !Number.isInteger(o.usd) || o.usd <= 0 || !String(o.nombre || '').trim())
        malas.push(m.id + ' ' + o.nombre + ': ' + JSON.stringify(o.usd));
    });
    if(!(m.opciones || []).length) malas.push(m.id + ' sin opciones');
  })));
  ok(!malas.length, 'cada opcion tiene nombre y un valor entero en USD (numero, no texto)', malas.slice(0, 3).join(' | ') || modelos.length + ' modelos');
  const rep = modelos.filter((x, i) => modelos.indexOf(x) !== i);
  ok(!rep.length, 'ningun modelo repetido', rep.join(', '));
  const leidos = USADOS.flatMap(e => e.grupos.flatMap(g => g.modelos));
  const opcionesCrudo = (j.equipos || []).flatMap(e => (e.grupos || []).flatMap(g => (g.modelos || []).flatMap(m => m.opciones || []))).length;
  ok(leidos.length === modelos.length && leidos.reduce((s, m) => s + m.opciones.length, 0) === opcionesCrudo,
     'la pagina lee el archivo entero: no se saltea ningun modelo ni opcion', leidos.length + ' modelos, ' + opcionesCrudo + ' opciones');
  const ip = equipoUsado('iphone');
  ok(ip && ip.bateria && ip.bateria.umbral > 0 && ip.bateria.umbral <= 100 && ip.bateria.resta >= 0, 'iPhone: la bateria tiene umbral y lo que resta', ip && JSON.stringify(ip.bateria));
  ok(ip && ip.condiciones.length > 0, 'iPhone: con condiciones', ip && ip.condiciones.map(c => c.texto).join(' | '));
  // Los de hoy, para leerlos en la salida (Pedro, 05/10: 13 128GB 220, 17 Pro Max 2TB 1220, PS4 Pro sin caja 130, bateria 80 % / USD 20)
  info(`valores de hoy: iPhone 13 128GB ${V13} · 17 Pro Max 2TB ${MAX} · PS4 Pro sin caja ${PSP} · bateria ${BAT.umbral} % / USD ${BAT.resta}`);
  const ps = equipoUsado('playstation');
  ok(ps && !ps.bateria && ps.condiciones.length > 0, 'PlayStation: sin bateria, con condiciones', ps && ps.condiciones.map(c => c.texto).join(' | '));
  // "Modelos que no figuren en lo escrito" no se toman: el 12 y el 12 mini no estan
  const nombres = leidos.map(m => m.nombre);
  ok(!nombres.includes('iPhone 12') && !nombres.includes('iPhone 12 mini'), 'lo que no esta en la lista no se ofrece (iPhone 12 y 12 mini)');
  // indiceUsados descarta lo que no sirve, sin romper
  const prueba = indiceUsados({ formato: 'usados/1', equipos: [{ id: 'x', nombre: 'X', grupos: [{ nombre: '', modelos: [
    { id: 'a', nombre: 'A', opciones: [{ nombre: '1', usd: '90' }, { nombre: '2', usd: 50 }] }, { id: 'b', nombre: 'B', opciones: [{ nombre: '1', usd: -3 }] }] }] }] });
  ok(prueba && prueba[0].grupos[0].modelos.length === 1 && prueba[0].grupos[0].modelos[0].opciones.length === 1,
     'un valor en texto o negativo no se muestra (ni el modelo que se queda sin opciones)');
  ok(indiceUsados({ formato: 'usados/2', equipos: [] }) === null && indiceUsados(null) === null, 'otro formato o nada: no hay cotizador');
}

/* ---- La ficha y el cotizador ---- */
async function probarLaFicha(){
  const conStock = PRODUCTOS.filter(p => p.stock && typeof p.precio === 'number' && p.precio > 0 && buscarModelo(clave(p)));
  const caro = conStock.find(p => p.precio > 400) || conStock[0];
  if(!caro){ info('no hay un producto con stock y precio: nada que probar'); return; }
  USADO = null; guardarUsado();
  PEDIDO = PEDIDO.filter(l => l.k !== clave(caro)); guardarPedido();
  abrirFicha(clave(caro), true);
  await uzDormir(60);
  let d = document.getElementById('ficha');
  const bu = d.querySelector('#fi-pedido-caja > #fi-usado'), bp = d.querySelector('#fi-pedido-caja > #fi-pedido');
  ok(!!bu && uzTxt(bu) === '🔁 Entregar mi usado' && bu.tagName === 'BUTTON' && bu.type === 'button',
     '[1B] la ficha con stock tiene «🔁 Entregar mi usado»', caro.desc);
  if(!bu){ quitarFicha(); return; }
  ok(bp && Math.abs(bp.getBoundingClientRect().top - bu.getBoundingClientRect().top) < 1 && bp.getBoundingClientRect().right <= bu.getBoundingClientRect().left,
     '[1B] al lado de «Agregar al pedido», en el mismo renglon', bp && uzTxt(bp));
  ok(bu.closest('.fi-botones') && !bu.classList.contains('pri'), '[1B] en el pie de botones de la ficha, sin competir con WhatsApp (no es el violeta lleno)');
  // Con el producto en el pedido: al lado de "Quitar del pedido"
  togglePedido(clave(caro));
  await uzDormir(20);
  const q = d.querySelector('#fi-pedido-caja > #fi-pedido'), u2 = d.querySelector('#fi-pedido-caja > #fi-usado');
  ok(q && u2 && uzTxt(q) === 'Quitar del pedido' && Math.abs(q.getBoundingClientRect().top - u2.getBoundingClientRect().top) < 1,
     '[1B] con el producto cargado, al lado de «Quitar del pedido»');
  togglePedido(clave(caro));
  await uzDormir(20);

  // 2A: el camino entero
  d.querySelector('#fi-usado').click();
  await uzDormir(40);
  ok(!!uzCot() && !!document.getElementById('ficha') && FICHA === clave(caro), '[2A] el cotizador se abre encima de la ficha, que queda abierta');
  ok(history.state && history.state.usado === true, '[2A] suma una entrada al historial (el Atras del celular lo cierra)');
  ok(uzPreg() === '¿Qué equipo entregás?' && uzPaso() === 'Paso 1 de 5', '[2A] primero el equipo: «Paso 1 de 5»', uzPreg() + ' · ' + uzPaso());
  ok([...uzCot().querySelectorAll('.us-op[data-e]')].map(uzTxt).join(',') === 'iPhone,PlayStation', '[2A] los equipos de la lista: iPhone y PlayStation');
  uzTocar('.us-op[data-e="iphone"]');
  ok(uzPreg() === '¿Qué modelo es?' && uzPaso() === 'Paso 2 de 5', '[2A] tocar avanza solo: el modelo', uzPaso());
  const grupos = [...uzCot().querySelectorAll('.us-grupo-rot')].map(uzTxt);
  ok(grupos[0] === 'iPhone 17' && grupos[grupos.length - 1] === 'iPhone 11', '[2A] los modelos por generacion, del 17 al 11', grupos.join(','));
  const b13 = uzCot().querySelector('.us-op[data-m="iphone-13-pro"]');
  ok(b13 && uzTxt(b13) === '13 Pro' && b13.getAttribute('aria-label') === 'iPhone 13 Pro', '[2A] adentro del grupo, «13 Pro» (el lector lee «iPhone 13 Pro»)');
  ok(/tomamos sólo estos modelos/.test(uzTxt(uzCot())), '[2A] dice que lo que no esta no se toma');
  uzTocar('.us-op[data-m="iphone-13"]');
  ok(uzPreg() === '¿Cuánta memoria tiene?' && [...uzCot().querySelectorAll('.us-op[data-o]')].map(uzTxt).join(',') === '128GB,256GB,512GB',
     '[2A] la memoria, con las del iPhone 13 de la lista');
  uzTocar('.us-op[data-o="128GB"]');
  ok(uzPreg() === '¿Cuánto marca la salud de la batería?' && [...uzCot().querySelectorAll('.us-op[data-bat]')].map(uzTxt).join(',') === `${BAT.umbral} % o más,Menos de ${BAT.umbral} %,No sé`,
     '[2A] la bateria: 80 % o mas, menos de 80 %, no se');
  // Atras vuelve un paso, con lo elegido marcado
  uzTocar('.us-atras');
  ok(uzPreg() === '¿Cuánta memoria tiene?' && uzCot().querySelector('.us-op[data-o="128GB"]').getAttribute('aria-pressed') === 'true',
     '[2A] «Atrás» vuelve un paso con lo elegido marcado');
  uzTocar('.us-op[data-o="128GB"]');
  uzTocar('.us-op[data-bat="si"]');
  ok(uzPreg() === '¿Cumple todo esto?' && uzPaso() === 'Paso 5 de 5', '[2A] el estado, ultimo paso');
  const ver = uzCot().querySelector('#us-ver');
  ok(ver && ver.disabled && /Respondé las 4 que faltan/.test(uzTxt(uzCot())), '[2A] «Ver cuánto vale» espera las cuatro respuestas');
  uzTocar('.pd-chip[data-cond="pantalla"][data-v="1"]');
  ok(document.activeElement && document.activeElement.dataset.cond === 'pantalla' && document.activeElement.getAttribute('aria-pressed') === 'true',
     '[2A] el Si queda marcado y con el foco');
  ['faceid', 'piezas', 'icloud'].forEach(id => uzTocar(`.pd-chip[data-cond="${id}"][data-v="1"]`));
  ok(!uzCot().querySelector('#us-ver').disabled, '[2A] con todo respondido se puede ver');
  ok(USADO === null, '[2A] hasta el resultado no se guarda nada (cerrar a mitad no cambia la cotizacion)');
  uzTocar('#us-ver');
  await uzDormir(30);

  // 3A
  const res = uzCot().querySelector('.us-res');
  ok(uzPreg() === 'Tu iPhone 13 128GB' && res && new RegExp('Te lo tomamos a\\s*USD ' + uzPlata(V13) + '\\b').test(uzTxt(res)) && /si cumple todas las condiciones/.test(uzTxt(res)),
     '[3A] el valor de la lista si cumple todo', uzTxt(res));
  const n = caro.precio - V13;
  const cuenta = uzFilas(uzCot().querySelector('.us-cuenta'));
  ok(cuenta.includes('USD ' + uzPlata(caro.precio)) && cuenta.includes('Tu iPhone 13 128GB − USD ' + uzPlata(V13)) && cuenta.includes('Te queda USD ' + uzPlata(n)),
     '[3A] la cuenta: el producto, menos el usado, lo que queda', cuenta.slice(0, 120));
  const a = uzCot().querySelector('.botones a.pri');
  const msj = a ? uzWA(a) : '';
  ok(a && uzTxt(a) === 'Lo quiero: seguir por WhatsApp' && msj.includes('quiero entregar mi usado como parte de pago') &&
     msj.includes(`Mi usado: iPhone 13 128GB, batería ${BAT.umbral} % o más, cumple todas las condiciones: USD ${uzPlata(V13)}`) &&
     msj.includes('Me queda: USD ' + uzPlata(n)), '[3A] el mensaje de WhatsApp con el usado y la cuenta', msj.replace(/\n/g, ' / ').slice(0, 160));
  ok(USADO && USADO.m === 'iphone-13' && JSON.parse(localStorage.getItem(USADO_KEY) || 'null')?.o === '128GB', '[3A] al llegar al resultado queda guardada');

  // Bateria por debajo: resta 20; "no se": el valor y lo que seria con la bateria baja
  uzTocar('.us-atras'); uzTocar('.us-atras');
  uzTocar('.us-op[data-bat="no"]'); uzTocar('#us-ver'); await uzDormir(20);
  ok(uzTxt(uzCot().querySelector('.us-res')).includes('USD ' + uzPlata(V13 - BAT.resta) + ' ') && uzTxt(uzCot()).includes(`Ya le restamos USD ${uzPlata(BAT.resta)} por la batería`),
     '[3A] bateria por debajo del umbral: el valor menos lo que resta, y lo dice', uzTxt(uzCot().querySelector('.us-res')).slice(0, 80));
  uzTocar('.us-atras'); uzTocar('.us-atras');
  uzTocar('.us-op[data-bat="nose"]'); uzTocar('#us-ver'); await uzDormir(20);
  const msjNs = uzWA(uzCot().querySelector('.botones a.pri'));
  ok(uzTxt(uzCot().querySelector('.us-res')).includes('USD ' + uzPlata(V13) + ' ') && msjNs.includes('no sé cómo está la batería') &&
     msjNs.includes(`USD ${uzPlata(V13)} (USD ${uzPlata(V13 - BAT.resta)} si la batería está por debajo del ${BAT.umbral} %)`), '[3A] bateria sin saber: el valor, y cuanto si esta baja', msjNs.split('\n')[2]);

  // Algo no cumple: sin numero
  uzTocar('.us-atras');
  uzTocar('.pd-chip[data-cond="pantalla"][data-v="0"]'); uzTocar('#us-ver'); await uzDormir(20);
  const rev = uzCot().querySelector('.us-res');
  const msjRev = uzWA(uzCot().querySelector('.botones a.pri'));
  ok(rev && rev.classList.contains('rev') && /Lo revisamos en persona/.test(uzTxt(rev)) && !/USD/.test(uzTxt(uzCot().querySelector('.caja'))),
     '[3A] si algo no cumple: «Lo revisamos en persona», sin ningun numero', uzTxt(rev).slice(0, 90));
  ok(msjRev.includes('Marqué que no cumple: pantalla y vidrios sin roturas. ¿Me lo revisan?') && !/USD \d/.test(msjRev.split('\n\n')[1] || ''),
     '[3A] y el mensaje dice lo que no cumple, sin valor', (msjRev.split('\n\n')[1] || '').slice(0, 120));

  // "Cotizar otro equipo": PS4 Pro sin caja, sin el paso de la bateria
  uzTocar('#us-otro');
  ok(uzPreg() === '¿Qué equipo entregás?', '[3A] «Cotizar otro equipo» vuelve al principio');
  uzTocar('.us-op[data-e="playstation"]');
  ok(uzPaso() === 'Paso 2 de 4', '[2A] la PlayStation tiene 4 pasos (sin bateria)', uzPaso());
  await uzCotizar('playstation', 'ps4-pro', 'Sin caja', '', uzTodoSi('playstation'));
  ok(uzPreg() === 'Tu PS4 Pro sin caja' && uzTxt(uzCot().querySelector('.us-res')).includes('USD ' + uzPlata(PSP) + ' '), '[3A] PS4 Pro sin caja: su valor de la lista', uzPreg());

  // A favor: un usado que vale mas que lo que mira
  const barato = conStock.filter(p => p.precio < MAX).sort((x, y) => x.precio - y.precio)[0];
  // Escape cierra solo el cotizador; la ficha sigue
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await uzEsperarA(() => !uzCot(), 3000);
  ok(!uzCot() && !!document.getElementById('ficha') && FICHA === clave(caro), '[2A] Escape cierra solo el cotizador: la ficha sigue abierta');
  await uzEsperarA(() => !(history.state && history.state.usado), 3000);
  ok(!(history.state && history.state.usado), '[2A] y saca su entrada del historial');
  if(barato){
    abrirFicha(clave(barato), false);
    await uzDormir(60);
    document.querySelector('#ficha #fi-usado').click();
    await uzDormir(30);
    ok(uzPreg() === 'Tu PS4 Pro sin caja', '[3A] con una cotizacion guardada, otra ficha abre directo en el resultado');
    uzTocar('#us-otro');
    await uzCotizar('iphone', 'iphone-17-pro-max', '2TB', 'si', uzTodoSi('iphone'));
    const c2 = uzFilas(uzCot().querySelector('.us-cuenta')) + ' ' + uzTxt(uzCot().querySelector('.us-cuenta .us-ayuda'));
    const msjF = uzWA(uzCot().querySelector('.botones a.pri'));
    ok(c2.includes('Te queda a favor USD ' + uzPlata(MAX - barato.precio)) && /coordinamos por WhatsApp/.test(c2) &&
       msjF.includes('Me queda a favor: USD ' + uzPlata(MAX - barato.precio)), '[3A] si el usado vale mas: «Te queda a favor USD X»', barato.desc + ' · ' + c2.slice(-70));
    // La X y el Atras del navegador
    uzTocar('.us-cerrar');
    await uzEsperarA(() => !uzCot(), 3000);
    ok(!uzCot() && !!document.getElementById('ficha'), '[2A] la X cierra el cotizador y deja la ficha');
    document.querySelector('#ficha #fi-usado').click();
    await uzDormir(30);
    history.back();
    await uzEsperarA(() => !uzCot(), 3000);
    ok(!uzCot() && !!document.getElementById('ficha'), '[2A] el Atras del navegador cierra el cotizador y deja la ficha');
  }
  quitarFicha();
  // Sin stock: no hay boton
  const agot = PRODUCTOS.find(p => !p.stock && buscarModelo(clave(p)) && buscarModelo(clave(p)).variantes.every(v => !v.stock));
  if(agot){
    abrirFicha(clave(agot), false);
    await uzDormir(40);
    ok(!document.querySelector('#ficha #fi-usado'), '[1B] sin stock no esta (solo «Avisame cuando entre»)', agot.desc);
    quitarFicha();
  }
  uzCerrarTodo();
}

/* ---- El pedido ---- */
async function probarElPedido(){
  const conStock = PRODUCTOS.filter(p => p.stock && typeof p.precio === 'number' && p.precio > 300 && buscarModelo(clave(p)));
  const p1 = conStock[0];
  if(!p1){ info('[5A] sin productos para el pedido'); return; }
  const antes = { pedido: PEDIDO.map(l => ({ ...l })), usado: USADO, cuotas: CUOTAS_PEDIDO };
  try{
    // Sin usado: el mensaje de siempre
    USADO = null; guardarUsado(); USADO_DIJO_NO = false;
    PEDIDO = [{ k: clave(p1), n: 1, color: '' }]; guardarPedido(); pintarPedido();
    const sin = mensajePedido();
    ok(!/usado/i.test(sin) && sin.includes('Total: USD ' + uzPlata(p1.precio)), '[5A] sin usado, el mensaje es el de siempre', sin.split('\n').slice(-1)[0]);
    abrirPedido();
    await uzDormir(30);
    let d = document.getElementById('pedido');
    const bloque = d.querySelector('.pd-usado');
    ok(bloque && uzTxt(bloque.querySelector('.pd-rot')) === '¿Entregás un usado? opcional' &&
       [...bloque.querySelectorAll('.pd-chip')].map(uzTxt).join(',') === 'No,Sí, cotizarlo' && bloque.nextElementSibling === d.querySelector('.pd-entrega'),
       '[5A] el pedido pregunta «¿Entregás un usado?» con No / Sí, cotizarlo, antes de «¿Cómo lo recibís?»');
    // "Sí, cotizarlo" abre el cotizador encima del pedido
    bloque.querySelector('[data-usado="si"]').click();
    await uzDormir(30);
    ok(!!uzCot() && !!document.getElementById('pedido'), '[5A] «Sí, cotizarlo» abre el cotizador encima del pedido');
    await uzCotizar('iphone', 'iphone-13', '128GB', 'si', uzTodoSi('iphone'));
    const cuentaP = uzFilas(uzCot().querySelector('.us-cuenta'));
    ok(cuentaP.startsWith('Tu pedido USD ' + uzPlata(p1.precio)) && cuentaP.includes('Te queda USD ' + uzPlata(p1.precio - V13)),
       '[3A] desde el pedido, la cuenta es con el total del pedido', cuentaP.slice(0, 90));
    ok(uzTxt(uzCot().querySelector('#us-listo')) === 'Listo: volver al pedido' && !uzCot().querySelector('a[href*="wa.me"]'),
       '[5A] y vuelve al pedido (el WhatsApp es el del pedido)');
    uzTocar('#us-listo');
    await uzEsperarA(() => !uzCot(), 3000);
    d = document.getElementById('pedido');
    ok(!uzCot() && !!d, '[5A] «Listo» cierra el cotizador y deja el pedido');
    const subs = uzFilas(d.querySelector('.pd-subs')), tot = uzTxt(d.querySelector('.pd-total'));
    ok(subs.includes('Productos USD ' + uzPlata(p1.precio)) && subs.includes('Tu iPhone 13 128GB − USD ' + uzPlata(V13)) && tot.startsWith('Total USD ' + uzPlata(p1.precio - V13)),
       '[5A] el usado resta en el total del pedido', subs + ' · ' + tot.slice(0, 30));
    ok(d.querySelector('[data-usado="si"]').getAttribute('aria-pressed') === 'true' && uzTxt(d.querySelector('.pd-usado')).includes(`iPhone 13 128GB: USD ${uzPlata(V13)} si cumple todas las condiciones`),
       '[5A] la pregunta queda en «Sí» con el usado y su valor', uzTxt(d.querySelector('.pd-usado .pd-ayuda')));
    ok(document.activeElement === d.querySelector('[data-usado="si"]'), '[5A] el foco vuelve a la pregunta del pedido');
    ok($('bp-usd').textContent === 'USD ' + uzPlata(p1.precio - V13), '[5A] la barra de abajo dice lo que queda', $('bp-usd').textContent);
    const msj = mensajePedido();
    ok(msj.includes(`Subtotal: USD ${uzPlata(p1.precio)}\nMi usado (iPhone 13 128GB, batería ${BAT.umbral} % o más, cumple todas las condiciones): − USD ${uzPlata(V13)}\nTotal: USD ${uzPlata(p1.precio - V13)}`),
       '[5A] el mensaje: subtotal, el usado restando y el total', msj.split('\n\n')[2]);
    // Las cuotas, sobre lo que queda
    if(CUOTAS.length && TC){
      const c = CUOTAS[CUOTAS.length - 1];
      CUOTAS_PEDIDO = c.cuotas;
      const x = cuentaCuotasPedido(), e = cuentaCuotas(p1.precio - V13, c.cuotas);
      ok(x && e && x.total === e.total, '[5A] las cuotas, sobre lo que queda por pagar', x && x.total);
      CUOTAS_PEDIDO = antes.cuotas;
    }
    // "No" lo borra
    d.querySelector('[data-usado="no"]').click();
    await uzDormir(20);
    d = document.getElementById('pedido');
    ok(USADO === null && !localStorage.getItem(USADO_KEY) && !d.querySelector('.pd-subs') && d.querySelector('[data-usado="no"]').getAttribute('aria-pressed') === 'true' &&
       uzTxt(d.querySelector('.pd-total')).startsWith('Total USD ' + uzPlata(p1.precio)), '[5A] «No» borra el usado y el total vuelve');
    // Revision en persona: el total no cambia y el mensaje lo cuenta
    USADO = { e: 'iphone', m: 'iphone-13', o: '128GB', bat: 'si', cond: { pantalla: true, faceid: false, piezas: true, icloud: true } };
    guardarUsado(); pintarPedido(); redibujarPedido();
    d = document.getElementById('pedido');
    ok(uzTxt(d.querySelector('.pd-total')).includes('menos tu usado, que lo revisamos en persona') && !d.querySelector('.pd-subs'),
       '[5A] un usado que se revisa en persona no resta: el total lo aclara');
    const msjR = mensajePedido();
    ok(msjR.includes('Total: USD ' + uzPlata(p1.precio)) && msjR.includes(`Mi usado: iPhone 13 128GB, batería ${BAT.umbral} % o más. Marqué que no cumple: ${equipoUsado('iphone').condiciones.find(c => c.id === 'faceid').texto.toLowerCase()}. ¿Me lo revisan?`),
       '[5A] y el mensaje lo dice aparte, sin valor', (msjR.split('\n\n')[3] || '').slice(0, 110));
    // A favor: el usado paga todo, sin cuotas
    const barato = PRODUCTOS.filter(p => p.stock && typeof p.precio === 'number' && p.precio > 0 && p.precio < MAX && buscarModelo(clave(p))).sort((x, y) => x.precio - y.precio)[0];
    if(barato){
      PEDIDO = [{ k: clave(barato), n: 1, color: '' }]; guardarPedido();
      USADO = { e: 'iphone', m: 'iphone-17-pro-max', o: '2TB', bat: 'si', cond: uzTodoSi('iphone') };
      guardarUsado(); pintarPedido(); redibujarPedido();
      d = document.getElementById('pedido');
      const fav = MAX - barato.precio;
      ok(uzTxt(d.querySelector('.pd-total')).startsWith('Te queda a favor USD ' + uzPlata(fav)) && !d.querySelector('.pd-cuotas'),
         '[5A] si el usado vale mas: «Te queda a favor» y no se ofrecen cuotas', uzTxt(d.querySelector('.pd-total')));
      ok(mensajePedido().includes('Me queda a favor: USD ' + uzPlata(fav)) && !/tarjeta/.test(mensajePedido()) && $('bp-usd').textContent === 'A favor USD ' + uzPlata(fav),
         '[5A] el mensaje y la barra dicen lo que queda a favor', $('bp-usd').textContent);
    }
    // "Cambiar" arranca del primer paso con lo de antes marcado
    USADO = { e: 'iphone', m: 'iphone-13', o: '128GB', bat: 'si', cond: uzTodoSi('iphone') };
    guardarUsado(); redibujarPedido();
    document.querySelector('#pedido .pd-cambiar-usado').click();
    await uzDormir(30);
    ok(uzPreg() === '¿Qué equipo entregás?' && uzCot().querySelector('.us-op[data-e="iphone"]').getAttribute('aria-pressed') === 'true',
       '[5A] «Cambiar» arranca del primer paso, con lo de antes marcado');
    // Escape: solo el cotizador
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await uzEsperarA(() => !uzCot(), 3000);
    ok(!uzCot() && !!document.getElementById('pedido'), '[5A] Escape cierra el cotizador y el pedido sigue abierto');
  } finally {
    uzCerrarTodo();
    PEDIDO = antes.pedido; guardarPedido();
    USADO = antes.usado; guardarUsado(); CUOTAS_PEDIDO = antes.cuotas;
    pintarPedido();
  }
}

/* ---- En el celular ---- */
async function probarCelular(){
  const p = PRODUCTOS.find(x => x.stock && typeof x.precio === 'number' && buscarModelo(clave(x)));
  if(!p) return;
  // El iframe lee la cotizacion de este navegador: sin ninguna, arranca del primer paso
  USADO = null; guardarUsado();
  for(const ancho of [360, 390]){
    const f = document.createElement('iframe');
    f.style.cssText = `width:${ancho}px;height:740px;border:0;position:absolute;left:-9999px;top:0`;
    f.src = 'index.html';
    document.body.appendChild(f);
    try{
      const listo = await uzEsperarA(() => f.contentWindow.eval('MODELOS.length && FUENTE && USADOS'), 40000);
      ok(listo, `[${ancho}] el celular carga, con la lista de usados`);
      if(!listo) continue;
      const w = f.contentWindow, doc = f.contentDocument;
      try{ w.pararOfertas?.(); w.pararPaseos?.(); w.pararMundos?.(); }catch(e){}
      w.eval(`abrirFicha(${JSON.stringify(clave(p))}, null)`);
      await uzDormir(400);
      const a = doc.querySelector('#ficha #fi-pedido'), u = doc.querySelector('#ficha #fi-usado');
      const ra = a && a.getBoundingClientRect(), ru = u && u.getBoundingClientRect();
      ok(ra && ru && Math.abs(ra.top - ru.top) < 1 && uzRenglones(a) === 1 && uzRenglones(u) === 1 && Math.abs(ra.height - ru.height) < 1,
         `[1B · ${ancho}] «Agregar al pedido» y «Entregar mi usado» lado a lado, en un renglon cada uno`, ra && ru && `${Math.round(ra.width)}x${Math.round(ra.height)} / ${Math.round(ru.width)}x${Math.round(ru.height)}`);
      ok(u && u.scrollWidth <= u.clientWidth + 1 && a.scrollWidth <= a.clientWidth + 1, `[1B · ${ancho}] el texto entra sin cortarse`);
      /* Con otra version del modelo en el pedido ("Ya tenés en el pedido",
         5.2): el del usado va debajo del pie, aparte de los dos botones del
         aviso, y el pie no crece (las guardas de la 5.2 y del pie) */
      const par = w.eval(`(() => { const m = MODELOS.find(x => x.variantes.filter(v => v.stock && typeof v.precio === 'number').length > 1);
        if(!m) return null; const vs = m.variantes.filter(v => v.stock && typeof v.precio === 'number'); return [clave(vs[0]), clave(vs[1])]; })()`);
      if(par){
        w.eval(`quitarFicha(); abrirFicha(${JSON.stringify(par[0])}, null)`);
        await uzDormir(400);
        const cta = doc.querySelector('#ficha .fi-botones .cta').getBoundingClientRect().height;
        w.eval(`togglePedido(${JSON.stringify(par[1])})`);
        await uzDormir(150);
        const pie = doc.querySelector('#ficha .fi-botones'), abajoU = doc.querySelector('#ficha .fi-usado-abajo');
        const ub = doc.querySelector('#ficha #fi-usado');
        ok(!!doc.getElementById('fi-ya') && abajoU && ub && ub.parentNode === abajoU && !pie.contains(ub) &&
           abajoU.previousElementSibling === doc.querySelector('#ficha .fi-ya-abajo') && doc.querySelectorAll('#ficha .fi-ya-abajo button').length === 2,
           `[1B · ${ancho}] con «Ya tenés en el pedido», el del usado va debajo del pie, despues de los dos del aviso`);
        ok(pie.getBoundingClientRect().height <= cta + 9 + 42 + 26 + 1, `[1B · ${ancho}] y el pie no crece`, Math.round(pie.getBoundingClientRect().height) + ' px');
        ok(ub && uzRenglones(ub) === 1, `[1B · ${ancho}] en un renglon`, ub && uzTxt(ub));
        ub && ub.click();
        await uzDormir(60);
        ok(!!doc.getElementById('usado'), `[1B · ${ancho}] y abre el cotizador`);
        w.eval('if(cerrarUsadoDOM){ usadoEmpujado = false; const c = cerrarUsadoDOM; cerrarUsadoDOM = null; c(); }');
        w.eval(`togglePedido(${JSON.stringify(par[1])})`);
        await uzDormir(150);
        ok(!doc.querySelector('#ficha .fi-usado-abajo') && doc.querySelectorAll('#ficha #fi-usado').length === 1 && doc.querySelector('#ficha #fi-pedido-caja > #fi-usado'),
           `[1B · ${ancho}] sin el aviso vuelve a su lugar, uno solo`);
        w.eval(`quitarFicha(); abrirFicha(${JSON.stringify(clave(p))}, null)`);
        await uzDormir(400);
      }
      doc.querySelector('#ficha #fi-usado').click();
      await uzDormir(100);
      const caja = doc.querySelector('#usado .caja');
      ok(caja && caja.scrollWidth <= caja.clientWidth + 1, `[2A · ${ancho}] el cotizador no se sale de costado`, caja && caja.scrollWidth + ' / ' + caja.clientWidth);
      w.eval(`document.querySelector('#usado .us-op[data-e="iphone"]').click()`);
      await uzDormir(60);
      const ops = [...doc.querySelectorAll('#usado .us-op[data-m]')];
      ok(ops.length && ops.every(b => b.getBoundingClientRect().height >= 44), `[2A · ${ancho}] los botones de los modelos se tocan con el dedo (44 px o mas)`, ops[0] && Math.round(ops[0].getBoundingClientRect().height));
      w.eval('if(cerrarUsadoDOM){ usadoEmpujado = false; const c = cerrarUsadoDOM; cerrarUsadoDOM = null; c(); } quitarFicha()');
    } catch(e){ ok(false, `[${ancho}] excepcion`, String(e).slice(0, 80)); }
    finally { f.remove(); }
  }
}
