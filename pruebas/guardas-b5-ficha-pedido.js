// Guardas de la tanda B5, ficha, pedido y WhatsApp (auditoria del 29/09/2026).
// Cada bloque es un error que se encontro y se arreglo: si vuelve, falla aca.
// El numero entre corchetes es el del hallazgo.
//
//  [78] El WhatsApp no decia el teclado: el MacBook Neo ES y el EN mandaban
//       la misma consulta, con precios distintos.
//  [89] El WhatsApp decia el color dos veces ("Magic Mouse 2 (White) en
//       White") y la marca dos veces ("Canon Flash Canon Speedlite").
//  [90] En el pedido "x2 — USD 260" no decia si 260 era el total o c/u.
//  [87] Un color guardado en el pedido que la fila ya no tiene seguia en el
//       mensaje ("Magic Mouse 2 (White) · Lime").
//  [93] Con dos pestanas, una pisaba el pedido de la otra. Y aparte: el
//       pedido de una visita anterior no volvia NUNCA (se leia antes de
//       definir acotarCant y el catch se tragaba el error).
//  [83] El Atras del celular no cerraba el pedido: cambiaba la pagina de
//       abajo y la lista seguia encima.
//  [81] X o Escape en una ficha abierta desde un sugerido volvian a la
//       ficha anterior, y el Atras reabria fichas ya cerradas.
//  [85] "De precio parecido" sobre sugeridos al doble o a la mitad.
//  [92] Despues de +, − o "Agregar al pedido" el foco se iba de la ventana.
//  [27] Los ejes de la ficha (Memoria, Version) sin nombre para el lector de
//       pantalla, y el "Sin stock" de una pestana solo en el title.
//
// Esta tanda recarga la pagina una vez, al principio, con un pedido guardado:
// es la unica forma de ver que el pedido de otra visita vuelve.
const R = [];
let fallas = 0;
const ok = (c, txt, extra) => { R.push((c?'  OK  ':'FALLA ') + txt + (extra!==undefined?('  ['+extra+']'):'')); if(!c) fallas++; };
const nota = txt => R.push('  --   ' + txt);
const reportar = () => {
  const pre = document.createElement('pre');
  pre.id = 'RESULTADO';
  pre.textContent = '\n===== ' + (fallas ? fallas + ' FALLA(S)' : 'TODO OK') + ' =====\n' + R.join('\n');
  document.body.appendChild(pre);
};

/* ---- [93] La recarga ----
   Primera vuelta: se guarda un pedido de dos unidades y se recarga. Segunda:
   se mira que PEDIDO lo tenga apenas termina el script de la pagina (esta
   tanda se inyecta al final del body, despues de el). */
const FASE_B5 = (() => { try{ return sessionStorage.getItem('b5.fase') || '0'; }catch(e){ return 'x'; } })();
const PEDIDO_AL_CARGAR_B5 = JSON.stringify(PEDIDO);
let GUARDADO_B5 = null;
try{ GUARDADO_B5 = JSON.parse(sessionStorage.getItem('b5.guardado') || 'null'); }catch(e){}

const esperaB5 = setInterval(() => {
  if(!MODELOS.length || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperaB5);
  if(FASE_B5 === '0'){
    const p = PRODUCTOS.find(x => x.stock && x.precio !== null && colorPorDefecto(x)) || PRODUCTOS[0];
    const linea = { k: clave(p), n: 2, color: colorPorDefecto(p) };
    try{
      localStorage.setItem(PEDIDO_KEY, JSON.stringify([linea]));
      sessionStorage.setItem('b5.guardado', JSON.stringify(linea));
      sessionStorage.setItem('b5.fase', '1');
      location.reload();
      return;
    }catch(e){ /* sin storage: la prueba de la recarga se saltea y avisa */ }
  }
  for(let i = 1; i < 5000; i++) clearInterval(i);
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: ' + (e && e.stack || e)); fallas++; })
    .then(() => {
      try{ document.getElementById('pedido') && document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); }catch(e){}
      try{ quitarFicha(); }catch(e){}
      try{ pararPaseos(); }catch(e){}
      try{ pararOfertas(); }catch(e){}
      try{ pararNuevos(); }catch(e){}
      try{ pararMarcas(); }catch(e){}
      try{ pararMundos(); }catch(e){}
      for(let i = 1; i < 5000; i++) clearInterval(i);
      reportar();
    });
}, 150);

async function correrPruebas(){
  const bloques = [pedidoDeOtraVisita, tecladoEnElMensaje, colorYMarcaUnaVez, unitarioEnElPedido,
                   colorQueYaNoEsta, dosPestanas, atrasCierraElPedido, sugeridoNoApila,
                   precioParecido, focoEnSuLugar, ejesConNombre];
  for(const b of bloques){
    try{ await b(); }
    catch(e){ R.push('EXCEPCION en ' + b.name + ': ' + (e && e.stack || e)); fallas++; }
  }
}

const dormirB5 = ms => new Promise(r => setTimeout(r, ms));
/* Espera el popstate que dispara history.back()/forward(). Se engancha ANTES
   de moverse; el de la pagina corre primero porque se registro antes. */
const popB5 = () => new Promise(r => {
  const f = () => { removeEventListener('popstate', f); setTimeout(() => r(true), 0); };
  addEventListener('popstate', f);
  setTimeout(() => { removeEventListener('popstate', f); r(false); }, 2000);
});
const vecesB5 = (t, x) => (norm(t).match(new RegExp('(^|[^a-z0-9])' + escRe(norm(x)) + '(?=$|[^a-z0-9])', 'g')) || []).length;
const conPedidoB5 = async (lineas, fn) => {
  const antes = JSON.stringify(PEDIDO);
  let ls = null;
  try{ ls = localStorage.getItem(PEDIDO_KEY); }catch(e){}
  PEDIDO = lineas.map(l => ({ ...l }));
  try{ return await fn(); }
  finally{
    PEDIDO = JSON.parse(antes);
    try{ if(ls === null) localStorage.removeItem(PEDIDO_KEY); else localStorage.setItem(PEDIDO_KEY, ls); }catch(e){}
    pintarPedido(); refrescarBotonesPedido();
  }
};

/* ---- [93] El pedido de otra visita vuelve ---- */
function pedidoDeOtraVisita(){
  if(FASE_B5 === 'x' || !GUARDADO_B5){ nota('[93] sin sessionStorage no se pudo probar la recarga'); return; }
  const leido = JSON.parse(PEDIDO_AL_CARGAR_B5);
  ok(leido.length === 1 && leido[0].k === GUARDADO_B5.k && leido[0].n === 2 && leido[0].color === GUARDADO_B5.color,
     '[93] al recargar, el pedido guardado en la visita anterior vuelve (con sus unidades y su color)',
     PEDIDO_AL_CARGAR_B5);
  ok(PEDIDO.some(l => l.k === GUARDADO_B5.k && l.n === 2),
     '[93] y sigue ahi despues de cargar los datos (limpiarPedido no lo borra)', JSON.stringify(PEDIDO));
}

/* ---- [78] Lo que distingue a la version va en el mensaje ---- */
function tecladoEnElMensaje(){
  // En los datos del dia: dos filas del mismo modelo con otro teclado u otra
  // Sim nunca mandan el mismo texto con el mismo color
  let pares = 0; const iguales = [];
  MODELOS.forEach(m => {
    const vs = m.variantes;
    vs.forEach((a, i) => vs.slice(i + 1).forEach(b => {
      if(norm(a.teclado) === norm(b.teclado) && norm(a.sim) === norm(b.sim)) return;
      const comunes = pintas(a.color).map(c => c.nombre).filter(c => pintas(b.color).some(y => norm(y.nombre) === norm(c)));
      (comunes.length ? comunes : ['']).forEach(c => {
        pares++;
        if(mensajeWA(a, c) === mensajeWA(b, c)) iguales.push(a.id + '/' + b.id);
      });
    }));
  });
  ok(!iguales.length, '[78] dos versiones con otro teclado u otra Sim no mandan la misma consulta',
     iguales.slice(0, 3).join(' · ') || pares + ' pares');
  // Cada fila con teclado de verdad lo dice en la consulta
  const esTeclado = p => TECLADO_SI.includes(p.cat) || /keyboard|teclado/i.test(p.desc || '');
  const mudas = PRODUCTOS.filter(p => p.teclado && esTeclado(p) &&
    !/teclado|ingles|english|espanol|spanish/.test(norm(mensajeWA(p, colorPorDefecto(p)))));
  ok(!mudas.length, '[78] toda fila con teclado dice cual en la consulta',
     mudas.slice(0, 3).map(p => p.id).join(', ') || PRODUCTOS.filter(p => p.teclado && esTeclado(p)).length + ' filas');
  const sinSim = PRODUCTOS.filter(p => p.sim && !diceSim(mensajeWA(p, colorPorDefecto(p))));
  ok(!sinSim.length, '[78] toda fila con Sim/eSIM la dice en la consulta', sinSim.slice(0, 3).map(p => p.id).join(', ') || 'bien');

  // Armado, para que muerda aunque ADVAPP escriba distinto los nombres
  const neo = (tec, extra) => ({ desc: 'Book Zzz 13" 8/256GB (Citrus)', marca: 'Zzz', cat: 'MacBook',
                                 color: 'Citrus', teclado: tec, sim: '', ...extra });
  const en = neo('EN'), es = neo('ES');
  ok(mensajeWA(en, 'Citrus') !== mensajeWA(es, 'Citrus') && /con teclado ingles/.test(norm(mensajeWA(en, 'Citrus'))) &&
     /con teclado espanol/.test(norm(mensajeAviso(es, 'Citrus'))),
     '[78] armado: la consulta y el aviso dicen "con teclado ingles/espanol"', mensajeWA(en, 'Citrus'));
  const dicho = mensajeWA(neo('EN', { desc: 'Book Zzz 13" 8/256GB Teclado EN' }), 'Citrus');
  ok(vecesB5(dicho, 'teclado') === 1, '[78] armado: si el nombre ya dice el teclado, no se repite', dicho);
  ok(!/teclado/.test(norm(mensajeWA({ desc: 'Z9 Body (Ingles)', marca: 'Zzz', cat: 'Cámara', teclado: 'EN', color: '' }))),
     '[78] armado: en una camara el "teclado" del SKU es el menu y no se nombra');
  const sim = s => ({ desc: 'Phone Zzz 256GB (Orange)', marca: 'Zzz', cat: 'Celular', color: 'Orange', sim: s, teclado: '' });
  ok(mensajeWA(sim('Sim'), 'Orange') !== mensajeWA(sim('E-Sim'), 'Orange') && /\bE-Sim\b/.test(mensajeWA(sim('E-Sim'), 'Orange')),
     '[78] armado: la Sim y la eSIM mandan consultas distintas', mensajeWA(sim('E-Sim'), 'Orange'));
  // La tarjeta es el modelo entero: con teclados mezclados no nombra uno
  const mezcla = { desc: 'Book Zzz', marca: 'Zzz', cat: 'MacBook', teclado: 'EN', color: '', variantes: [en, es] };
  ok(!/teclado/.test(norm(mensajeWA(mezcla))), '[78] armado: la tarjeta de un modelo con los dos teclados no elige uno',
     mensajeWA(mezcla));
  // El pedido dice lo mismo
  const conTec = PRODUCTOS.find(p => p.teclado && esTeclado(p) && !/teclado|ingles|english|espanol|spanish/.test(norm(p.desc)));
  if(conTec) return conPedidoB5([{ k: clave(conTec), n: 1, color: '' }], () => {
    ok(/con teclado (ingles|espanol)/.test(norm(mensajePedido())), '[78] y la linea del pedido tambien', conTec.id);
  });
}

/* ---- [89] El color y la marca, una sola vez ---- */
function colorYMarcaUnaVez(){
  const conColor = PRODUCTOS.filter(p => colorPorDefecto(p));
  const dos = conColor.filter(p => vecesB5(mensajeWA(p, colorPorDefecto(p)), colorPorDefecto(p)) > 1);
  ok(!dos.length, '[89] ninguna consulta de la ficha nombra el color dos veces',
     dos.slice(0, 2).map(p => mensajeWA(p, colorPorDefecto(p))).join(' · ') || conColor.length + ' filas con color');
  const ninguna = conColor.filter(p => !vecesB5(mensajeWA(p, colorPorDefecto(p)), colorPorDefecto(p)));
  ok(!ninguna.length, '[89] y todas lo nombran (sacar el repetido no puede perderlo)',
     ninguna.slice(0, 2).map(p => mensajeWA(p, colorPorDefecto(p))).join(' · ') || 'bien');
  const avisoDos = conColor.filter(p => vecesB5(mensajeAviso(p, colorPorDefecto(p)), colorPorDefecto(p)) > 1);
  ok(!avisoDos.length, '[89] el aviso "sin stock" tampoco', avisoDos.slice(0, 2).map(p => p.id).join(', ') || 'bien');
  const marcaDos = PRODUCTOS.filter(p => p.marca && vecesB5(mensajeWA(p), p.marca) > 1);
  ok(!marcaDos.length, '[89] ninguna consulta nombra la marca dos veces',
     marcaDos.slice(0, 2).map(p => mensajeWA(p)).join(' · ') || 'bien');
  const sinMarca = PRODUCTOS.filter(p => p.marca && !vecesB5(mensajeWA(p), p.marca));
  ok(!sinMarca.length, '[89] y todas la nombran (el vendedor tiene que saber de que marca es)',
     sinMarca.slice(0, 2).map(p => mensajeWA(p)).join(' · ') || 'bien');

  // Armado
  const f = (desc, color, extra) => ({ desc, marca: 'Zzz', cat: 'Accesorio', color, teclado: '', sim: '', ...extra });
  ok(mensajeWA(f('Mouse Zzz 2 (White)', 'White'), 'White') === 'Hola! Me interesa el Mouse Zzz 2 en White. ¿Me pasás info?',
     '[89] armado: "(White) en White" pasa a "en White"', mensajeWA(f('Mouse Zzz 2 (White)', 'White'), 'White'));
  ok(/\(M4\/M5\)/.test(mensajeWA(f('Teclado Zzz (M4/M5)', 'White'), 'White')),
     '[89] armado: un parentesis que no es un color se queda');
  ok(/^Hola! Me interesa el Zzz Mouse \(White\)\./.test(mensajeWA(f('Mouse (White)', 'White'))),
     '[89] armado: sin color elegido (la tarjeta) el nombre queda entero', mensajeWA(f('Mouse (White)', 'White')));
  ok(mensajeWA(f('Flash Zzz Speedlite', '')) === 'Hola! Me interesa el Flash Zzz Speedlite. ¿Me pasás info?',
     '[89] armado: la marca en el medio del nombre no se vuelve a poner adelante', mensajeWA(f('Flash Zzz Speedlite', '')));
  ok(/^Hola! Me interesa el Zzz Speedlite EL-5\./.test(mensajeWA(f('Speedlite EL-5', ''))),
     '[89] armado: sin la marca, se pone adelante', mensajeWA(f('Speedlite EL-5', '')));
  ok(/^Hola! Me interesa el Zzzpower Bank\./.test(mensajeWA(f('Zzzpower Bank', ''))),
     '[89] armado: si el nombre empieza con la marca, como antes, no se duplica');
  ok(/^Hola! Me interesa el Zzz Speedlite X Silver\./.test(mensajeWA(f('Speedlite X Silver', 'Silver'), 'Silver')),
     '[89] armado: si el nombre ya dice el color de una fila de un solo color, no lo repite',
     mensajeWA(f('Speedlite X Silver', 'Silver'), 'Silver'));
  // El pedido: una linea con color no lo dice dos veces
  const p = conColor.find(x => x.stock && /\(/.test(x.desc));
  if(p) return conPedidoB5([{ k: clave(p), n: 1, color: colorPorDefecto(p) }], () => {
    const l = mensajePedido().split('\n').find(x => /^1\. /.test(x)) || '';
    ok(vecesB5(l, colorPorDefecto(p)) === 1, '[89] la linea del pedido nombra el color una vez', l);
  });
}

/* ---- [90] Con varias unidades se dice el precio de cada una ---- */
function unitarioEnElPedido(){
  const p = PRODUCTOS.find(x => x.precio > 0);
  const q = PRODUCTOS.find(x => x.precio > 0 && x !== p);
  return conPedidoB5([{ k: clave(p), n: 3, color: '' }, { k: clave(q), n: 1, color: '' }], () => {
    const ls = mensajePedido().split('\n');
    const l1 = ls.find(x => /^1\. /.test(x)) || '', l2 = ls.find(x => /^2\. /.test(x)) || '';
    ok(l1.endsWith(`x3 — USD ${plata(p.precio * 3)} (USD ${plata(p.precio)} c/u)`),
       '[90] "x3 — USD <subtotal> (USD <unitario> c/u)"', l1);
    ok(!/c\/u/.test(l2) && l2.endsWith(`— USD ${plata(q.precio)}`), '[90] con una sola unidad, el precio y nada mas', l2);
  });
}

/* ---- [87] Un color que la fila ya no tiene se borra ---- */
function colorQueYaNoEsta(){
  // Todo color que la ficha puede guardar tiene que pasar la regla: si no,
  // la regla borraria elecciones buenas del cliente
  let malos = [];
  PRODUCTOS.forEach(p => {
    const m = buscarModelo(clave(p));
    const val = new Set(pintas(p.color).map(c => norm(c.nombre)));
    const cand = [colorPorDefecto(p)];
    if(m) coloresFicha(p, m).lista.filter(c => c.k === clave(p)).forEach(c => cand.push(c.nombre));
    cand.filter(Boolean).forEach(c => { if(!val.has(norm(c))) malos.push(p.id + ' ' + c); });
  });
  ok(!malos.length, '[87] todo color que ofrece la ficha es uno que el pedido acepta', malos.slice(0, 3).join(' · ') || 'bien');

  if(ADVAPP_URL && (!FUENTE || FUENTE.fuente !== 'advapp')){
    nota('[87] hoy no cargo ADVAPP: limpiarPedido no toca el pedido con el respaldo (a proposito)'); return;
  }
  const p = PRODUCTOS.find(x => pintas(x.color).length === 1);
  // Con varios colores en la fila se prueba uno que no es el primero; si hoy
  // no hay ninguna, el unico de otra fila
  const q = PRODUCTOS.find(x => pintas(x.color).length > 1 && x !== p) ||
            PRODUCTOS.find(x => pintas(x.color).length && x !== p);
  if(!p || !q){ nota('[87] no hay filas con color para probar'); return; }
  const bueno = pintas(q.color)[pintas(q.color).length - 1].nombre.toUpperCase();   // en mayusculas: se compara normalizado
  return conPedidoB5([{ k: clave(p), n: 1, color: 'Zzzverde' }, { k: clave(q), n: 1, color: bueno }], () => {
    limpiarPedido();
    ok(PEDIDO.find(l => l.k === clave(p))?.color === '', '[87] el color inventado se borra de la linea', JSON.stringify(PEDIDO[0]));
    ok(!/zzzverde/.test(norm(mensajePedido())), '[87] y no llega al mensaje');
    ok(PEDIDO.find(l => l.k === clave(q))?.color === bueno,
       '[87] un color que la fila tiene se queda (aunque no sea el primero)', JSON.stringify(PEDIDO[1]));
    let guardado = [];
    try{ guardado = JSON.parse(localStorage.getItem(PEDIDO_KEY) || '[]'); }catch(e){}
    ok(guardado.length === 2 && guardado[0].color === '', '[87] y queda guardado asi', JSON.stringify(guardado));
  });
}

/* ---- [93] Otra pestana cambia el pedido ---- */
async function dosPestanas(){
  const [a, b] = PRODUCTOS.filter(x => x.stock && x.precio > 0).slice(0, 2);
  return conPedidoB5([{ k: clave(a), n: 1, color: '' }], async () => {
    try{ localStorage.setItem(PEDIDO_KEY, JSON.stringify(PEDIDO)); }catch(e){ nota('[93] sin localStorage'); return; }
    abrirPedido();
    await dormirB5(50);
    // "La otra pestana" escribe y el navegador avisa a esta
    localStorage.setItem(PEDIDO_KEY, JSON.stringify([{ k: clave(a), n: 1, color: '' }, { k: clave(b), n: 2, color: '' }]));
    dispatchEvent(new StorageEvent('storage', { key: 'otra.cosa' }));
    ok(PEDIDO.length === 1, '[93] un cambio de otra clave del storage no toca el pedido');
    dispatchEvent(new StorageEvent('storage', { key: PEDIDO_KEY }));
    ok(PEDIDO.length === 2 && cantDe(clave(b)) === 2, '[93] lo que otra pestana guarda se lee aca', JSON.stringify(PEDIDO));
    ok(document.querySelectorAll('#pedido .pd-item').length === 2, '[93] y la lista abierta se redibuja con eso',
       document.querySelectorAll('#pedido .pd-item').length + ' filas');
    ok(/x2/.test(decodeURIComponent($('bp-enviar').getAttribute('href') || '')) || !WHATSAPP,
       '[93] y "Enviar pedido" manda el pedido nuevo');
    // Esta pestana toca + y no se pierde la linea de la otra
    cambiarCant(clave(a), 1);
    let g = [];
    try{ g = JSON.parse(localStorage.getItem(PEDIDO_KEY)); }catch(e){}
    ok(g.length === 2 && g.some(l => l.k === clave(b)), '[93] y al tocar + aca no se borra lo que agrego la otra', JSON.stringify(g));
    const pop = popB5();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await pop;
  });
}

/* ---- [83] El Atras cierra el pedido ---- */
async function atrasCierraElPedido(){
  const a = PRODUCTOS.find(x => x.stock && x.precio > 0);
  return conPedidoB5([{ k: clave(a), n: 1, color: '' }], async () => {
    // Con un filtro puesto, como en la sonda: el Atras cambiaba la grilla
    filtros.q = 'zzz-b5'; aplicarFiltro(true);
    const url0 = location.href, largo0 = history.length, q0 = filtros.q;
    abrirPedido();
    ok(history.length === largo0 + 1 && history.state && history.state.pedido,
       '[83] abrir el pedido suma una entrada al historial', history.length - largo0);
    let pop = popB5();
    history.back();
    ok(await pop, '[83] (el Atras llego)');
    ok(!document.getElementById('pedido'), '[83] el Atras cierra el pedido');
    ok(location.href === url0 && filtros.q === q0, '[83] y la pagina de abajo queda como estaba', location.search);
    ok(!document.body.classList.contains('modal-abierto'), '[83] y la pagina vuelve a moverse');

    // Escape hace "atras": no queda una entrada del pedido por delante
    abrirPedido();
    pop = popB5();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await pop;
    ok(!document.getElementById('pedido') && !(history.state && history.state.pedido) && location.href === url0,
       '[83] cerrar con Escape deja el historial donde estaba');
    // Adelante cae en la entrada del pedido cerrado: se neutraliza
    pop = popB5();
    history.forward();
    await pop;
    ok(!document.getElementById('pedido') && !(history.state && history.state.pedido),
       '[83] Adelante no deja una entrada fantasma del pedido');
    filtros.q = ''; aplicarFiltro(false);
  });
}

/* ---- [81] Un sugerido no apila historial ---- */
async function sugeridoNoApila(){
  const conRel = MODELOS.find(m => m.stock && relacionados(m).length);
  if(!conRel){ nota('[81] hoy ningun producto tiene sugeridos'); return; }
  if(FICHA) quitarFicha();
  escribirURL(false);
  const largo0 = history.length;
  abrirFicha(clave(conRel.rep));                 // como desde la grilla: con push
  const primera = FICHA;
  const largo1 = history.length;
  document.querySelector('#ficha .fi-rel .pc').click();
  ok(FICHA && FICHA !== primera, '[81] tocar un sugerido abre su ficha');
  ok(history.length === largo1 && largo1 === largo0 + 1, '[81] y no suma otra entrada al historial',
     (largo1 - largo0) + ' + ' + (history.length - largo1));
  ok(claveDeHash() === FICHA, '[81] el link apunta a la ficha que se esta mirando', location.hash);
  const pop = popB5();
  document.querySelector('#ficha .fi-cerrar').click();
  await pop;
  ok(!FICHA && !document.getElementById('ficha'), '[81] una sola X cierra la ficha (no vuelve a la anterior)', FICHA);
  ok(!location.hash, '[81] y el link queda sin ficha', location.hash);
}

/* ---- [85] "De precio parecido" solo si es verdad ---- */
function precioParecido(){
  let dicen = 0, noDicen = 0; const mal = [];
  MODELOS.forEach(m => {
    const h = htmlRelacionados(m);
    if(!h) return;
    const lista = relacionados(m);
    if(/precio parecido/.test(h)){
      dicen++;
      if(!(m.precio > 0) || lista.some(x => x.precio > 2 * m.precio || x.precio < m.precio / 2))
        mal.push(m.desc + ' USD ' + m.precio + ' → ' + lista.map(x => x.precio).join('/'));
    } else noDicen++;
  });
  ok(!mal.length, '[85] si la cinta dice "de precio parecido", todos estan entre la mitad y el doble',
     mal.slice(0, 2).join(' · ') || dicen + ' lo dicen, ' + noDicen + ' no');
  ok(dicen > 0, '[85] y lo sigue diciendo donde es verdad', dicen);
  // Sin precio no hay con que comparar
  const m = MODELOS.find(x => relacionados(x).length);
  if(m){
    const h = htmlRelacionados({ ...m, precio: null });
    ok(!/precio parecido/.test(h), '[85] armado: un modelo sin precio no promete precio parecido');
  }
  ok(MODELOS.filter(x => relacionados(x).length).every(x => relacionados(x).length === Math.min(RELACIONADOS,
       MODELOS.filter(y => y !== x && y.cat === x.cat && y.stock && y.imagen && y.precio > 0).length)),
     '[85] la cinta no se recorta: sigue completando con lo que haya del rubro');
}

/* ---- [92] El foco no se escapa ---- */
async function focoEnSuLugar(){
  const a = PRODUCTOS.find(x => x.stock && x.precio > 0);
  const act = () => document.activeElement;
  await conPedidoB5([{ k: clave(a), n: 1, color: '' }], async () => {
    abrirPedido();
    await dormirB5(50);
    const mas = () => document.querySelector(`#pedido .pd-item[data-key="${CSS.escape(clave(a))}"] .stepper button[data-d="1"]`);
    mas().focus();
    mas().click();
    ok(cantDe(clave(a)) === 2 && act() === mas(), '[92] despues del + del pedido el foco sigue en ese +',
       act() && (act().getAttribute('aria-label') || act().className || act().tagName));
    const x = document.querySelector('#pedido .pd-quitar');
    x.focus(); x.click();
    ok(document.getElementById('pedido')?.contains(act()) && act().classList.contains('caja'),
       '[92] despues de quitar la fila, el foco va a la ventana (no a la pagina ni al primer boton)',
       act() && (act().className || act().tagName));
    const pop = popB5();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await pop;
  });

  // La ficha: Agregar → el + del contador; Quitar → Agregar
  const p = PRODUCTOS.find(x => x.stock && x.precio > 0 && !enPedido(clave(x)));
  await conPedidoB5([], async () => {
    abrirFicha(clave(p), null);
    await dormirB5(50);
    let b = document.querySelector('#fi-pedido');
    b.focus(); b.click();
    ok(enPedido(clave(p)) && act() === document.querySelector('#fi-pedido-caja .stepper button[data-d="1"]'),
       '[92] despues de "Agregar al pedido" el foco va al + del contador', act() && (act().getAttribute('aria-label') || act().id));
    b = document.querySelector('#fi-pedido');
    b.focus(); b.click();
    ok(!enPedido(clave(p)) && act() === document.querySelector('#fi-pedido') && /Agregar/.test(act().textContent),
       '[92] despues de "Quitar del pedido" el foco va a "Agregar"', act() && act().textContent);
    quitarFicha();
  });

  // Cambiar de pestana (version) deja el foco en la pestana elegida
  const m = MODELOS.find(x => x.multi && htmlOpcionesFicha(x, x.rep).includes('fi-op'));
  if(!m){ nota('[92] hoy no hay fichas con pestanas'); return; }
  abrirFicha(clave(m.rep), null);
  await dormirB5(50);
  const otra = [...document.querySelectorAll('#ficha .fi-op')].find(t => t.getAttribute('aria-pressed') !== 'true');
  if(!otra){ quitarFicha(); nota('[92] la ficha no tiene otra pestana'); return; }
  const eje = otra.closest('.fi-ops').dataset.eje;
  otra.focus(); otra.click();
  ok(act() && act().classList.contains('fi-op') && act().getAttribute('aria-pressed') === 'true' &&
     act().closest('.fi-ops').dataset.eje === eje,
     '[92] despues de elegir otra version el foco queda en la pestana elegida', m.desc + ' / ' + (act() && act().textContent.trim().replace(/\s+/g, ' ')));
  quitarFicha();
}

/* ---- [27] Los ejes de la ficha tienen nombre ---- */
function ejesConNombre(){
  let grupos = 0, agotadas = 0; const mal = [];
  MODELOS.filter(m => m.multi).forEach(m => {
    const h = htmlOpcionesFicha(m, m.rep);
    if(!h) return;
    const d = document.createElement('div');
    d.innerHTML = h;
    d.querySelectorAll('.fi-eje').forEach(e => {
      grupos++;
      const ops = e.querySelector('.fi-ops'), rot = e.querySelector('.fi-eje-rot').textContent.trim();
      if(ops.getAttribute('role') !== 'group' || ops.getAttribute('aria-label') !== rot) mal.push(m.desc + ' ' + rot);
    });
    d.querySelectorAll('.fi-op').forEach(b => {
      const dice = [...b.querySelectorAll('.solo-lector')].some(s => /sin stock/i.test(s.textContent) && !s.closest('b'));
      if(b.classList.contains('agotada')){ agotadas++; if(!dice) mal.push(m.desc + ' agotada muda'); }
      else if(dice) mal.push(m.desc + ' dice sin stock y tiene');
      if(b.getAttribute('aria-pressed') === null) mal.push(m.desc + ' sin aria-pressed');
    });
  });
  ok(!mal.length, '[27] cada eje es un grupo con el nombre de su rotulo, y las agotadas dicen "sin stock" para el lector',
     mal.slice(0, 3).join(' · ') || grupos + ' grupos, ' + agotadas + ' agotadas');
  ok(!!document.querySelector('style') && [...document.styleSheets].some(s => { try{ return [...s.cssRules].some(r => r.selectorText === '.solo-lector'); }catch(e){ return false; } }),
     '[27] y la clase que lo esconde a la vista existe');
}
