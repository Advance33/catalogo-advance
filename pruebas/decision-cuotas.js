// Cuotas con tarjeta (Pedro, 30/09/2026). Muestra: muestras/cuotas. Eligio la
// recomendada en las cuatro (1B 2B 3C 4A), confirmo la cuenta y pidio sacar
// todo lo de la factura ("ya no podemos hacer mas").
//   la cuenta  pesos = USD x cotizacion (el mismo "≈ $"), total = pesos x
//              (1 + recargo del plan), cuota = total / cuotas. Los planes
//              salen de CUOTAS, junto a la cotizacion: nada se escribe aparte.
//   1B  la tarjeta dice "Hasta 12 cuotas" debajo de la etiqueta, sin monto.
//       En la agotada y la de "Consultar" el renglon esta pero invisible,
//       para que las etiquetas de una fila queden parejas.
//   2B  la ficha lleva los planes como botones ADENTRO de la etiqueta del
//       precio; tocar uno dice la cuota ("6 cuotas de $ 471.437", sin "≈" ni
//       el renglon del total: Pedro los saco al verlo publicado), tocarlo
//       otra vez lo desmarca. Sigue al cambiar de version; arranca sin nada en cada ficha.
//   3C  el pedido pregunta "¿Pagás con tarjeta? opcional" debajo de "¿Cómo lo
//       recibís?"; el plan elegido va al mensaje con los montos y a la
//       medicion (cuotas: N). Queda guardado aparte del pedido.
//   4A  "¿Cómo puedo pagar?" suma la tarjeta y hay una pregunta nueva
//       "¿Puedo pagar en cuotas?". Desde el 03/10 el interés de las cuotas no
//       se ve en ningún lado (Pedro): ni el porcentaje ni una mención; los
//       recargos de cripto y PayPal sí.
//   Sin factura: ni la pregunta del IVA ni ningun "IVA" o "factura" a la vista.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);

const esperaCU = setInterval(() => {
  if(!MODELOS.length || !FUENTE || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperaCU);
  for(let i=1;i<5000;i++) clearInterval(i);
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; })
    .finally(() => {
      try{ cuCerrarTodo(); }catch(e){}
      try{ pararPaseos(); pararOfertas(); pararMundos(); }catch(e){}
      for(let i=1;i<5000;i++) clearInterval(i);
      const pre=document.createElement('pre'); pre.id='RESULTADO';
      pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
      document.body.appendChild(pre);
    });
}, 150);

const cuDormir = ms => new Promise(r => setTimeout(r, ms));
async function cuEsperarA(cond, ms = 25000){
  const t0 = Date.now();
  while(Date.now() - t0 < ms){
    try{ if(cond()) return true; }catch(e){}
    await cuDormir(150);
  }
  return false;
}
const cuTxt = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
// El resultado de la ficha son renglones (b y span en bloque): se leen con espacio
const cuRenglones = el => el ? [...el.children].map(cuTxt).join(' ') : '';
function cuCerrarTodo(){
  if(cerrarPedidoDOM){ pedidoEmpujado = false; const c = cerrarPedidoDOM; cerrarPedidoDOM = null; c(); }
  if(FICHA) quitarFicha();
  try{ history.replaceState(null, '', location.pathname); }catch(e){}
}
// La cuenta, escrita aparte de la pagina: si alguien cambia cuentaCuotas, no coincide
const cuEsperado = (usd, c) => {
  const total = Math.round(Math.round(usd * TC) * (1 + c.recargo / 100));
  return { total, cuota: Math.round(total / c.cuotas) };
};
const cuPlata = n => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 });

async function correrPruebas(){
  await probarElArchivoDelBot();
  probarLosPlanes();
  probarLasPreguntas();
  probarLaTarjeta();
  await probarLaFicha();
  await probarElPedido();
  await probarCelular();
}

/* ---- datos/cuotas.json: lo que lee el bot (06/10/2026) ----
   Pedro eligio que Pancho diga la cuota igual que la web. El bot no puede
   leer index.html, asi que los planes y el dolar estan tambien en
   datos/cuotas.json: si alguien cambia uno y no el otro, esto falla. */
async function probarElArchivoDelBot(){
  let j = null;
  try{ j = await (await fetch('datos/cuotas.json?_=' + Date.now(), { cache: 'no-store' })).json(); }catch(e){}
  ok(!!j && j.formato === 'cuotas/1', 'datos/cuotas.json esta y tiene formato cuotas/1');
  if(!j) return;
  ok(JSON.stringify((j.planes || []).map(c => [c.cuotas, c.recargo])) === JSON.stringify(CUOTAS.map(c => [c.cuotas, c.recargo])),
     'los planes de datos/cuotas.json son los de CUOTAS (el bot dice la misma cuota)', JSON.stringify(j.planes));
  const d = j.dolar || {};
  ok(d.tipo === COTIZACION_TIPO && Number(d.recargo) === RECARGO_PCT && Number(d.recargo_fijo) === RECARGO_FIJO &&
     (typeof COTIZACION === 'number' ? d.cotizacion === COTIZACION : d.cotizacion === null),
     'y el dolar tambien: la misma casa, el mismo recargo y los mismos pesos fijos', JSON.stringify(d));
  ok(j.letra_chica === LETRA_CHICA_CUOTAS, 'y la letra chica', j.letra_chica);
}

/* ---- Los planes y la cuenta ---- */
function probarLosPlanes(){
  info('planes: ' + CUOTAS.map(c => nombreCuotas(c.cuotas) + ' (recargo ' + c.recargo + ')').join(' · ') + ' · cotizacion ' + TC);
  const ns = CUOTAS.map(c => c.cuotas);
  ok(CUOTAS.length > 0 && CUOTAS.every(c => Number.isInteger(c.cuotas) && c.cuotas > 0 && typeof c.recargo === 'number' && c.recargo >= 0 && c.recargo < 1000) &&
     ns.every((n, i) => !i || n > ns[i - 1]),
     'CUOTAS: planes con cuotas enteras, de menor a mayor, y un recargo en numero (decimal con punto)', ns.join(','));
  // Pedro, 03/10: "no quiero bajo ningún concepto que figuren los intereses en
  // las cuotas" — ni el número ni la mención, en ningún texto de las cuotas
  const delInteres = /\d\s?%|recargo|inter[eé]s/i;
  const textos = [];
  const pCuotas = PREGUNTAS.find(q => q.p === '¿Puedo pagar en cuotas?');
  if(pCuotas) textos.push(['«¿Puedo pagar en cuotas?»', [pCuotas.p, ...(pCuotas.r || []), ...(pCuotas.lista || [])].join(' ')]);
  textos.push(['«Tarjeta por Mercado Pago»', renglonTarjetaPagos().join(' ')]);
  const muestra = PRODUCTOS.find(p => p.stock && p.precio > 0);
  if(muestra){
    textos.push(['la tarjeta', htmlCuotasTarjeta(muestra)]);
    const f0 = CUOTA_FICHA, p0 = CUOTAS_PEDIDO, tc0 = TC;
    try{
      for(const c of CUOTAS){
        CUOTA_FICHA = c.cuotas; CUOTAS_PEDIDO = c.cuotas;
        textos.push(['la ficha (' + c.cuotas + ')', textoCuotasFicha(muestra)]);
        textos.push(['el pedido (' + c.cuotas + ')', htmlCuotasPedido()]);
      }
      TC = null;   // sin cotizacion: el plan solo, tampoco con el interes
      CUOTA_FICHA = CUOTAS[CUOTAS.length - 1].cuotas; CUOTAS_PEDIDO = CUOTA_FICHA;
      textos.push(['la ficha sin cotizacion', textoCuotasFicha(muestra)], ['el pedido sin cotizacion', htmlCuotasPedido()]);
    } finally { CUOTA_FICHA = f0; CUOTAS_PEDIDO = p0; TC = tc0; }
  }
  const conInteres = textos.filter(([, t]) => delInteres.test(String(t).replace(/<[^>]+>/g, ' '))).map(([d, t]) => d + ': ' + String(t).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 60));
  ok(!conInteres.length && typeof pctCuotas === 'undefined', 'el interes de las cuotas no se ve en ningun lado (ni % ni «recargo»): pregunta, renglon de tarjeta, tarjeta, ficha y pedido',
     conInteres.slice(0, 3).join(' | ') || textos.length + ' textos');
  ok(nombreCuotas(1) === '1 pago' && nombreCuotas(6) === '6 cuotas', 'un plan de 1 es «1 pago»; los demas, «N cuotas»');
  ok(maxCuotas() === Math.max(...CUOTAS.filter(c => c.cuotas > 1).map(c => c.cuotas)), '«Hasta N cuotas» es el plan mas largo', maxCuotas());
  if(!TC){ info('sin cotizacion: la cuenta en pesos no se prueba'); return; }
  const malas = [];
  PRODUCTOS.filter(p => p.precio > 0).slice(0, 80).forEach(p => CUOTAS.forEach(c => {
    const x = cuentaCuotas(p.precio, c.cuotas), e = cuEsperado(p.precio, c);
    if(!x || x.total !== e.total || x.cuota !== e.cuota) malas.push(p.id + ' ' + c.cuotas + ': ' + JSON.stringify(x) + ' vs ' + JSON.stringify(e));
  }));
  ok(!malas.length, 'la cuenta de cada plan: pesos del sitio × (1 + recargo) ÷ cuotas, al peso', malas.slice(0, 2).join(' | ') || '80 productos');
  const tc0 = TC;
  TC = null;
  try{ ok(cuentaCuotas(1000, CUOTAS[0].cuotas) === null, 'sin cotizacion no hay montos en pesos (null, no un numero inventado)'); }
  finally{ TC = tc0; }
  ok(cuentaCuotas(1000, 5) === null || !!planCuotas(5), 'un plan que no esta en CUOTAS no da cuenta');
}

/* ---- 4A y sin factura ---- */
function probarLasPreguntas(){
  const todo = JSON.stringify(PREGUNTAS);
  ok(!/\bIVA\b|factura/i.test(todo), 'PREGUNTAS no habla de IVA ni de factura (Pedro: ya no se hace)');
  ok(!PREGUNTAS.some(q => /IVA/.test(q.p)), 'la pregunta «¿El precio incluye IVA?» ya no esta');
  const i = PREGUNTAS.findIndex(q => q.p === '¿Cómo puedo pagar?');
  const pagar = PREGUNTAS[i], cuotas = PREGUNTAS[i + 1];
  const ult = pagar && pagar.lista[pagar.lista.length - 1];
  ok(ult === renglonTarjetaPagos()[0] && /^Tarjeta por Mercado Pago: en 1 pago o en cuotas \(mirá «¿Puedo pagar en cuotas\?»\)$/.test(ult),
     '[4A] «¿Cómo puedo pagar?» suma la tarjeta al final de su lista', ult);
  ok(pagar && pagar.lista.slice(0, 5).join('|') === 'Efectivo en dólares|Efectivo en pesos|Transferencia bancaria en pesos (sin recargo)|Criptomonedas (+2%)|PayPal, Payoneer o Prex (+10%)',
     '[4A] las otras formas de pago, con su recargo (cripto y PayPal si se muestran, Pedro 03/10)');
  ok(cuotas && cuotas.p === '¿Puedo pagar en cuotas?', '[4A] justo despues, la pregunta nueva «¿Puedo pagar en cuotas?»', cuotas && cuotas.p);
  if(cuotas){
    ok(!cuotas.lista && /^Se paga en pesos, con el dólar del día que ves en la página\./.test(cuotas.r[1]) && /ves cuánto es cada cuota\.$/.test(cuotas.r[1]),
       '[4A] en pesos con el dolar del dia y donde ver cada cuota; sin lista de planes ni intereses', cuotas.r[1]);
    const ns = CUOTAS.filter(c => c.cuotas > 1).map(c => c.cuotas);
    ok(cuotas.r[0].startsWith(`Sí, en ${ns.slice(0, -1).join(', ')} o ${ns[ns.length - 1]} cuotas, con cualquier tarjeta bancarizada vinculada a tu cuenta de Mercado Pago.`) &&
       /Vale para todos los productos\.$/.test(cuotas.r[0]) && /en pesos, con el dólar del día/.test(cuotas.r[1]),
       '[4A] dice con que tarjeta, que vale para todo y que es en pesos con el dolar del dia', cuotas.r.join(' '));
  }
  const ayuda = document.getElementById('ayuda');
  if(ayuda){
    const t = cuTxt(ayuda);
    ok(t.includes('¿Puedo pagar en cuotas?') && t.includes('Tarjeta por Mercado Pago') && !/\bIVA\b|factura/i.test(t),
       '[4A] las preguntas de la pagina muestran la nueva, y nada de IVA ni factura');
  } else info('sin #ayuda en esta vista');
  ok(!/\bIVA\b|factura/i.test(document.body.innerText), 'en toda la pagina a la vista no dice IVA ni factura');
}

/* ---- 1B La tarjeta ---- */
function probarLaTarjeta(){
  verTodoElCatalogo();
  const cards = [...document.querySelectorAll('#grid .card, .grid .card')];
  ok(cards.length > 0, '[1B] hay tarjetas para mirar', cards.length);
  const malas = [];
  let con = 0, sin = 0;
  cards.forEach(el => {
    const m = buscarModelo(el.dataset.key);
    const cq = el.querySelectorAll('.cq');
    if(cq.length !== 1){ malas.push(el.dataset.key + ': ' + cq.length + ' renglones'); return; }
    const vis = getComputedStyle(cq[0]).visibility !== 'hidden';
    const debe = m && m.stock && m.precio !== null;
    if(debe){ con++; if(!vis || cuTxt(cq[0]) !== `Hasta ${maxCuotas()} cuotas`) malas.push(el.dataset.key + ' «' + cuTxt(cq[0]) + '» ' + vis); }
    else { sin++; if(vis || cq[0].getAttribute('aria-hidden') !== 'true') malas.push(el.dataset.key + ' agotada/consultar con cuotas a la vista'); }
    const pie = el.querySelector('.pie');
    if(pie && !(pie.compareDocumentPosition(cq[0]) & Node.DOCUMENT_POSITION_FOLLOWING)) malas.push(el.dataset.key + ' el renglon no va debajo de la etiqueta');
  });
  ok(!malas.length, '[1B] cada tarjeta con stock y precio dice «Hasta ' + maxCuotas() + ' cuotas» debajo de la etiqueta; las demas lo tienen invisible',
     malas.slice(0, 3).join(' | ') || con + ' con, ' + sin + ' sin');
  ok(!cards.some(el => /\$\s*[\d.]+\s*$/.test(cuTxt(el.querySelector('.cq')))), '[1B] sin monto: no dice cuanto es la cuota');
  // Las etiquetas de una misma fila, a la misma altura
  const filas = {};
  cards.slice(0, 40).forEach(el => { const r = el.getBoundingClientRect(); if(r.height) (filas[Math.round(r.top)] ||= []).push(el.querySelector('.pie').getBoundingClientRect().top); });
  const torcidas = Object.values(filas).filter(xs => xs.length > 1 && Math.max(...xs) - Math.min(...xs) > 1);
  ok(!torcidas.length, '[1B] las etiquetas de una fila quedan parejas (tambien con agotadas al lado)', Object.keys(filas).length + ' filas');
}

/* ---- 2B La ficha ---- */
async function probarLaFicha(){
  const m = MODELOS.find(x => x.stock && x.multi && x.precio !== null &&
    x.variantes.filter(v => v.stock && v.precio !== null).length > 1);
  if(!m){ info('[2B] no hay un modelo con dos versiones con stock: nada que probar'); return; }
  const v = m.variantes.find(x => clave(x) === clave(m.rep)) || m.rep;
  abrirFicha(clave(v), null);
  await cuDormir(40);
  let d = document.getElementById('ficha');
  const pr = d.querySelector('.fi-precio');
  let box = pr && pr.querySelector('.fi-cuotas');
  ok(!!box, '[2B] los planes van ADENTRO de la etiqueta del precio', m.desc);
  if(!box){ quitarFicha(); return; }
  const rot = box.querySelector('.fi-cuotas-rot');
  ok(cuTxt(rot) === 'Con tarjeta, en cuotas' && box.getAttribute('role') === 'group' && document.getElementById(box.getAttribute('aria-labelledby')) === rot,
     '[2B] con el rotulo «Con tarjeta, en cuotas», leido como grupo');
  let bs = [...box.querySelectorAll('.fi-cuota')];
  ok(bs.length === CUOTAS.length && bs.every((b, i) => Number(b.dataset.cuotas) === CUOTAS[i].cuotas && b.tagName === 'BUTTON' && b.type === 'button'),
     '[2B] un boton por plan', bs.map(cuTxt).join(' | '));
  ok(bs.every((b, i) => cuTxt(b) === CUOTAS[i].cuotas + (CUOTAS[i].cuotas === 1 ? ' pago' : ' cuotas')), '[2B] el lector lee «1 pago», «3 cuotas»…');
  ok(bs.every(b => b.getAttribute('aria-pressed') === 'false') && cuTxt(box.querySelector('.fi-cuotas-res')) === 'Tocá un plan y ves cuánto es cada cuota.',
     '[2B] arranca sin plan marcado, con la invitacion a tocar');
  const nota = d.querySelector('.fi-cuotas-nota');
  ok(nota && cuTxt(nota) === LETRA_CHICA_CUOTAS && nota.previousElementSibling === pr && !/IVA|factura/i.test(cuTxt(nota)),
     '[2B] debajo de la etiqueta, la letra chica (sin IVA)', cuTxt(nota));
  const c6 = CUOTAS.find(c => c.cuotas > 1 && c.cuotas < maxCuotas()) || CUOTAS[CUOTAS.length - 1];
  const b6 = box.querySelector(`.fi-cuota[data-cuotas="${c6.cuotas}"]`);
  b6.focus(); b6.click();
  await cuDormir(20);
  const res = () => cuRenglones(d.querySelector('.fi-cuotas-res'));
  const esperado = vv => { const e = cuEsperado(vv.precio, c6); return `${c6.cuotas} cuotas de $ ${cuPlata(e.cuota)}`; };
  if(TC) ok(res() === esperado(v), `[2B] tocar ${c6.cuotas} dice la cuota y nada mas (sin «≈» ni total)`, res());
  ok(b6.getAttribute('aria-pressed') === 'true' && document.activeElement === b6 && d.querySelector('.fi-cuotas') === box,
     '[2B] queda marcado, con el foco, y sin rehacer la ficha');
  ok(getComputedStyle(b6).backgroundColor === 'rgb(124, 58, 237)', '[2B] el marcado en violeta, como la muestra', getComputedStyle(b6).backgroundColor);
  const uno = box.querySelector('.fi-cuota[data-cuotas="1"]');
  if(uno && TC){
    uno.click();
    const e1 = cuEsperado(v.precio, planCuotas(1));
    ok(res() === `1 pago de $ ${cuPlata(e1.total)}`, '[2B] «1 pago» dice cuanto es, con el recargo ya sumado', res());
    uno.click();
    ok(uno.getAttribute('aria-pressed') === 'false' && res() === 'Tocá un plan y ves cuánto es cada cuota.', '[2B] tocar el marcado lo desmarca');
    b6.click();
  }
  // Otra version: el plan sigue, con el precio de la nueva
  const otra = m.variantes.find(x => x.stock && x.precio !== null && x.precio !== v.precio) || m.variantes.find(x => x !== v && x.stock && x.precio !== null);
  d.querySelector(`.fi-cuota[data-cuotas="${c6.cuotas}"]`).focus();
  elegirVariante(d, m, otra);
  await cuDormir(20);
  const b6b = d.querySelector(`.fi-cuota[data-cuotas="${c6.cuotas}"]`);
  ok(b6b && b6b.getAttribute('aria-pressed') === 'true' && (!TC || res() === esperado(otra)),
     '[2B] al cambiar de version el plan sigue marcado y la cuenta es la de la nueva', clave(otra) + ' ' + res());
  ok(document.activeElement === b6b, '[2B] y el foco vuelve al mismo plan (no se escapa de la ventana)', document.activeElement && document.activeElement.className);
  quitarFicha();
  abrirFicha(clave(v), null);
  await cuDormir(20);
  d = document.getElementById('ficha');
  ok([...d.querySelectorAll('.fi-cuota')].every(b => b.getAttribute('aria-pressed') === 'false'), '[2B] otra ficha arranca sin plan marcado');
  // El renglon de pago de la ficha: sin la pregunta del IVA
  const li = d.querySelector('.fi-servicio li[data-servicio="pago"]');
  ok(li && cuTxt(li.querySelector('b')) === '¿Cómo puedo pagar?' && !li.querySelector('i'),
     'el renglon de pago de la ficha dice «¿Cómo puedo pagar?», sin la respuesta del IVA', li && cuTxt(li.querySelector('b')));
  ok(!/\bIVA\b|factura/i.test(cuTxt(d)), 'la ficha no dice IVA ni factura en ningun lado');
  quitarFicha();
  // Agotado: sin planes
  const ag = PRODUCTOS.find(p => !p.stock);
  if(ag){
    abrirFicha(clave(ag), null);
    await cuDormir(20);
    const fa = buscarProducto(FICHA);
    ok(fa && (fa.stock || !document.querySelector('#ficha .fi-cuotas, #ficha .fi-cuotas-nota')), '[2B] una version agotada no ofrece cuotas', clave(ag));
    quitarFicha();
  }
}

/* ---- 3C El pedido ---- */
async function cuConPedidoYCuotas(lineas, fn){
  const antes = JSON.stringify(PEDIDO), antesE = JSON.stringify(ENTREGA), antesC = CUOTAS_PEDIDO;
  const ls = {};
  [PEDIDO_KEY, ENTREGA_KEY, CUOTAS_KEY].forEach(k => { try{ ls[k] = localStorage.getItem(k); }catch(e){} });
  PEDIDO = lineas.map(l => ({ ...l })); guardarPedido();
  ENTREGA = { entrega: '', localidad: '' }; guardarEntrega();
  CUOTAS_PEDIDO = 0; guardarCuotasPedido();
  pintarPedido(); refrescarBotonesPedido();
  try{ return await fn(); }
  finally{
    cuCerrarTodo();
    PEDIDO = JSON.parse(antes); ENTREGA = JSON.parse(antesE); CUOTAS_PEDIDO = antesC;
    Object.entries(ls).forEach(([k, x]) => { try{ if(x === null || x === undefined) localStorage.removeItem(k); else localStorage.setItem(k, x); }catch(e){} });
    pintarPedido(); refrescarBotonesPedido();
  }
}
function cuClicWA(a){
  const medir0 = ANALITICA.medir, mandar0 = ANALITICA.mandar, ev = [];
  ANALITICA.medir = (t, x) => { ev.push({ t, ...(x || {}) }); };
  ANALITICA.mandar = () => {};
  const frenar = e => e.preventDefault();
  document.addEventListener('click', frenar);
  try{ a.click(); }
  finally{ document.removeEventListener('click', frenar); ANALITICA.medir = medir0; ANALITICA.mandar = mandar0; }
  return ev.filter(x => x.t === 'whatsapp');
}
async function probarElPedido(){
  if(!WHATSAPP){ info('[3C] sin WhatsApp no hay mensaje ni recuadro'); return; }
  const dos = PRODUCTOS.filter(p => p.stock && p.precio !== null).slice(0, 2);
  const lineas = [{ k: clave(dos[0]), n: 1, color: '' }, { k: clave(dos[1]), n: 2, color: '' }];
  await cuConPedidoYCuotas(lineas, async () => {
    const msj0 = mensajePedido();
    ok(!/tarjeta|cuota/i.test(msj0), '[3C] sin elegir plan, el mensaje no dice nada de tarjeta');
    abrirPedido();
    await cuDormir(40);
    const d = document.getElementById('pedido');
    const box = d.querySelector('.pd-cuotas'), ent = d.querySelector('.pd-entrega'), bot = d.querySelector('.botones');
    ok(!!box && !!ent && ent.nextElementSibling === box && !!(box.compareDocumentPosition(bot) & Node.DOCUMENT_POSITION_FOLLOWING),
       '[3C] «¿Pagás con tarjeta?» va debajo de «¿Cómo lo recibís?» y antes de «Enviar»');
    if(!box) return;
    const rot = box.querySelector('.pd-rot');
    ok(cuTxt(rot) === '¿Pagás con tarjeta? opcional' && box.getAttribute('role') === 'group' && document.getElementById(box.getAttribute('aria-labelledby')) === rot,
       '[3C] el rotulo, con «opcional», leido como grupo', cuTxt(rot));
    ok(getComputedStyle(box).backgroundColor === getComputedStyle(ent).backgroundColor, '[3C] en el mismo recuadro lila que la entrega');
    const chip = n => box.querySelector(`.pd-chip[data-cuotas="${n}"]`);
    const chips = [...box.querySelectorAll('.pd-chip')];
    ok(chips.map(cuTxt).join(' | ') === CUOTAS.map(c => nombreCuotas(c.cuotas)).join(' | ') && chips.every(b => b.getAttribute('aria-pressed') === 'false'),
       '[3C] un boton por plan, ninguno marcado', chips.map(cuTxt).join(' | '));
    ok(cuTxt(box.querySelector('.pd-ayuda')) === 'Por Mercado Pago, con cualquier tarjeta bancarizada. Si no marcás nada, lo hablamos por WhatsApp.',
       '[3C] sin elegir, la ayuda dice con que se paga');
    const w0 = cuClicWA(d.querySelector('.botones a.pri'));
    ok(w0.length === 1 && !('cuotas' in w0[0]), '[3C] sin elegir, la medicion no anota cuotas');
    const c = CUOTAS.find(x => x.cuotas > 1);
    chip(c.cuotas).focus(); chip(c.cuotas).click();
    await cuDormir(30);
    const b2 = document.getElementById('pedido').querySelector('.pd-cuotas');
    const ch2 = b2.querySelector(`.pd-chip[data-cuotas="${c.cuotas}"]`);
    ok(ch2.getAttribute('aria-pressed') === 'true' && document.activeElement === ch2, `[3C] tocar «${nombreCuotas(c.cuotas)}» lo marca y el foco se queda ahi`);
    let guardado = null; try{ guardado = localStorage.getItem(CUOTAS_KEY); }catch(e){}
    ok(guardado === String(c.cuotas), '[3C] queda guardado en el navegador', guardado);
    const e = TC ? cuEsperado(totalPedido(), c) : null;
    const renglon = e ? `Lo pago con tarjeta en ${c.cuotas} cuotas: aprox. $ ${cuPlata(e.cuota)} c/u (total aprox. $ ${cuPlata(e.total)}).`
                      : `Lo pago con tarjeta en ${c.cuotas} cuotas.`;
    if(e) ok(cuTxt(b2.querySelector('.pd-ayuda')) === `${c.cuotas} cuotas de $ ${cuPlata(e.cuota)} · total $ ${cuPlata(e.total)}`,
             '[3C] la ayuda dice la cuota y el total del pedido', cuTxt(b2.querySelector('.pd-ayuda')));
    const partes = mensajePedido().split('\n\n');
    ok(partes[partes.length - 1] === renglon, '[3C] el mensaje suma el plan, con los montos, al final', partes[partes.length - 1]);
    const a = document.querySelector('#pedido .botones a.pri');
    ok(a && decodeURIComponent(a.href.split('text=')[1] || '').includes(renglon), '[3C] y el link de «Enviar por WhatsApp» lo lleva');
    const w1 = cuClicWA(a);
    ok(w1.length === 1 && w1[0].cuotas === c.cuotas, '[3C] la medicion del clic anota cuotas: ' + c.cuotas, JSON.stringify(w1[0] || {}).slice(0, 120));
    // Con retiro tambien: primero el plan, despues la entrega
    const ret = document.querySelector('#pedido .pd-chip[data-entrega="retiro"]');
    ret.click();
    await cuDormir(20);
    const p2 = mensajePedido().split('\n\n');
    ok(p2.slice(-2).join(' / ') === renglon + ' / Lo retiro en CABA.', '[3C] con retiro elegido: primero el plan y despues «Lo retiro en CABA.»', p2.slice(-2).join(' / '));
    ok(document.querySelector('#pedido .pd-chip[data-cuotas="' + c.cuotas + '"]').getAttribute('aria-pressed') === 'true',
       '[3C] elegir la entrega no desmarca el plan (cada recuadro con lo suyo)');
    // Tocar el marcado lo desmarca
    document.querySelector(`#pedido .pd-chip[data-cuotas="${c.cuotas}"]`).click();
    await cuDormir(20);
    let g2 = 'x'; try{ g2 = localStorage.getItem(CUOTAS_KEY); }catch(e){}
    ok(CUOTAS_PEDIDO === 0 && g2 === null && !/tarjeta/i.test(mensajePedido()), '[3C] tocar el marcado lo desmarca y se borra del navegador');
  });
  // Con algo "a consultar", el plan va sin montos (el total no es el del pedido)
  const cons = PRODUCTOS.find(p => p.stock && p.precio === null);
  if(cons){
    await cuConPedidoYCuotas([{ k: clave(dos[0]), n: 1, color: '' }, { k: clave(cons), n: 1, color: '' }], async () => {
      CUOTAS_PEDIDO = maxCuotas();
      const u = mensajePedido().split('\n\n').pop();
      ok(u === `Lo pago con tarjeta en ${maxCuotas()} cuotas.`, '[3C] con un producto a consultar, el plan sin montos', u);
    });
  } else info('[3C] hoy no hay productos «a consultar»');
}

/* ---- A 360 px, en un iframe (el headless no baja de 500) ---- */
async function probarCelular(){
  const m = MODELOS.find(x => x.stock && x.precio !== null && x.imagen);
  if(!m) return;
  const f = document.createElement('iframe');
  f.style.cssText = 'width:360px;height:700px;border:0;position:absolute;left:-9999px;top:0';
  f.src = 'index.html';
  document.body.appendChild(f);
  try{
    const listo = await cuEsperarA(() => f.contentWindow.eval('MODELOS.length && FUENTE'), 40000);
    ok(listo, '[360] el celular carga');
    if(!listo) return;
    const w = f.contentWindow, doc = f.contentDocument;
    try{ w.pararOfertas?.(); w.pararPaseos?.(); w.pararMundos?.(); }catch(e){}
    w.eval(`abrirFicha(${JSON.stringify(clave(m.rep))}, null)`);
    await cuDormir(400);
    const pr = doc.querySelector('#ficha .fi-precio'), bs = [...doc.querySelectorAll('#ficha .fi-cuota')];
    const rp = pr && pr.getBoundingClientRect();
    ok(bs.length === CUOTAS.length && bs.every(b => { const r = b.getBoundingClientRect(); return r.left >= rp.left && r.right <= rp.right + 0.5 && Math.abs(r.top - bs[0].getBoundingClientRect().top) < 1; }),
       '[2B · 360] los botones entran en una fila, adentro de la etiqueta', bs.map(b => Math.round(b.getBoundingClientRect().width)).join(','));
    ok(bs.every(b => b.getBoundingClientRect().height >= 36), '[2B · 360] y se pueden tocar con el dedo (36 px o mas de alto)', bs[0] && Math.round(bs[0].getBoundingClientRect().height));
    const caja = doc.querySelector('#ficha .caja');
    ok(caja && caja.scrollWidth <= caja.clientWidth + 1, '[2B · 360] la ficha no se sale de costado', caja && caja.scrollWidth + ' / ' + caja.clientWidth);
    w.eval('quitarFicha()');
    const cq = doc.querySelector('.card .cq:not(.vacio)');
    if(cq){ const r = cq.getBoundingClientRect(), rc = cq.closest('.card').getBoundingClientRect();
      ok(r.height < 20 && r.right <= rc.right + 0.5, '[1B · 360] «Hasta 12 cuotas» entra en un renglon dentro de la tarjeta', Math.round(r.width) + 'x' + Math.round(r.height)); }
  } finally { f.remove(); }
}
