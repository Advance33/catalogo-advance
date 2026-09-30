// Decisiones 2.1 a 2.8 de Pedro (29/09/2026): la tarjeta, el precio y la ficha.
// Muestra: muestras/auditoria/tarjeta-precio.html. Pedro eligio la recomendada
// en las ocho: 1B 2B 3B 4C 5B 6B 7B 8B.
//   2.1 B  con un filtro de version (1TB, memoria, tramo, "Con stock") la
//          tarjeta muestra el precio de las versiones que lo cumplen, "desde"
//          solo si entre ellas hay precios distintos; data-key, la foto y el +
//          son los de la mas barata con stock entre esas; la cabecera se
//          recalcula
//   2.2 B  los pesos con "≈" y el title "Referencia con la cotizacion del dia"
//          en la tarjeta, la ficha, la vidriera y el total del pedido; en la
//          barra del pedido del celular, sin marca
//   2.3 B  la ficha limpia los codigos del proveedor solo donde los hay (los
//          Ray-Ban "F … | L …" con su linea de armazon y cristal, y los
//          monitores "| Marca"); las demas fichas no cambian
//   2.4 C  el precio anterior tachado en la ficha y el "Ahorras USD …" arriba
//          de la foto, siempre de la version elegida (hoy ninguna fila lo trae:
//          se simula en una)
//   2.5 B  un renglon junto a retiro y garantia con "Ver formas de pago", con
//          los textos de PREGUNTAS tal cual
//   2.6 B  lo sin stock no se agrega: la tarjeta agotada sin +, la ficha solo
//          con "Avisame cuando entre"; lo que ya estaba guardado queda marcado,
//          sin borrarse y sin sumar
//   2.7 B  en el celular los botones de la ficha quedan pegados abajo
//   2.8 B  en el celular la X de cerrar acompana al bajar
// El celular se mira en un iframe de 390 x 664 (el headless no baja de 500).
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);

const esperaDT = setInterval(() => {
  if(!MODELOS.length || !FUENTE || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperaDT);
  for(let i=1;i<5000;i++) clearInterval(i);
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; })
    .finally(() => {
      try{ quitarFicha(); }catch(e){}
      try{ pararPaseos(); pararOfertas(); pararMundos(); }catch(e){}
      for(let i=1;i<5000;i++) clearInterval(i);
      const pre=document.createElement('pre'); pre.id='RESULTADO';
      pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
      document.body.appendChild(pre);
    });
}, 150);

const dtDormir = ms => new Promise(r => setTimeout(r, ms));
async function dtEsperarA(cond, ms = 25000){
  const t0 = Date.now();
  while(Date.now() - t0 < ms){
    try{ if(cond()) return true; }catch(e){}
    await dtDormir(150);
  }
  return false;
}
/* Esperar a que se asiente lo que se mide, con tope, y no un tiempo fijo
   (29/09). Las ventanas entran con una animacion (cajaIn: .3 s con
   scale(.97)) y, con la suite entera corriendo a la vez, un tiempo fijo a
   veces no alcanzaba: getBoundingClientRect medía la ventana a medio entrar
   (en decision-tarjeta, el pie de 114 px daba 111 = 114 x .97 y [2.7]
   fallaba de a ratos). dtQuieto espera, cuadro a cuadro, a que no quede
   ninguna animacion o transicion con final andando adentro de `raiz`; si al
   tope siguen, las termina (finish) para medir el estado final. dtHasta
   espera una condicion cuadro a cuadro (lo que depende de un ResizeObserver
   o de un repintado cambia recien en un cuadro). */
const dtCuadro = (w = window) => new Promise(r => {
  let ya = false; const fin = () => { if(!ya){ ya = true; r(); } };
  try{ w.requestAnimationFrame(fin); }catch(e){}
  setTimeout(fin, 50);                     // por si ese documento no dibuja
});
async function dtQuieto(raiz, ms = 3000){
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
    await dtCuadro(w);
  }
  andando().forEach(a => { try{ a.finish(); }catch(e){} });
  await dtCuadro(w);
  return false;
}
async function dtHasta(cond, w = window, ms = 3000){
  const t0 = Date.now();
  do{ try{ if(cond()) return true; }catch(e){} await dtCuadro(w); } while(Date.now() - t0 < ms);
  try{ return !!cond(); }catch(e){ return false; }
}
/* Cierra la lista del pedido sin el history.back() (abrirPedido empuja una entrada) */
function dtCerrarPedido(){
  pedidoEmpujado = false;
  const c = cerrarPedidoDOM; cerrarPedidoDOM = null;
  if(c) c();
}
const dtTxt = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
const dtREF = 'Referencia con la cotización del día';
const dtLimpios = { q:'', cat:'', marca:'', soloStock:false, rango:'', montura:'', apertura:'', capacidad:'', ram:'' };
function dtFiltrar(f){ Object.assign(filtros, dtLimpios, f); pintar(); }

/* La regla de 2.1 B escrita aparte, sin usar vistaFiltrada: que versiones
   cumplen el filtro puesto y que tiene que decir la tarjeta. */
function dtCumple(f){
  const r = f.rango ? RANGOS.find(x => x[0] === f.rango) : null;
  return v => (!f.soloStock || v.stock) &&
              (!f.capacidad || capacidadDe(v) === f.capacidad) &&
              (!f.ram || ramDe(v) === f.ram) &&
              (!r || enTramo(v.precio, r));
}
function dtEsperado(m, cumple){
  const vs = m.variantes.filter(cumple);
  const cp = vs.filter(v => v.precio !== null);
  const cs = cp.filter(v => v.stock);
  const base = cs.length ? cs : cp;
  const min = base.length ? Math.min(...base.map(v => v.precio)) : null;
  const max = cp.length ? Math.max(...cp.map(v => v.precio)) : null;
  return { vs, min, desde: vs.length > 1 && min !== null && min !== max,
           candidatas: base.filter(v => v.precio === min), stock: vs.some(v => v.stock) };
}

async function correrPruebas(){
  const pedidoAntes = PEDIDO.slice();
  try{
    await probarPesosEnLaPortada();    // 2.2 (vidriera y Recien llegados)
    probarFiltroDeVersion();           // 2.1
    probarPesos();                     // 2.2
    probarNombreFicha();               // 2.3
    probarPrecioAnterior();            // 2.4
    probarFormasDePago();              // 2.5
    await probarSinStock();            // 2.6
    await probarCelular();             // 2.7, 2.8 y la barra de 2.2
  } finally {
    PEDIDO = pedidoAntes; guardarPedido(); pintarPedido();
    Object.assign(filtros, dtLimpios); pintar();
  }
}

/* ---- 2.2 en la portada: la vidriera y Recien llegados ---- */
async function probarPesosEnLaPortada(){
  dtFiltrar({});
  ok(enPortada(), '[2.2] se arranca en la portada');
  if(!TC){ info('[2.2] hoy no hay cotizacion: no hay pesos para mirar'); return; }
  const vid = [...document.querySelectorAll('#of-pista .of-precio i')];
  const nv  = [...document.querySelectorAll('#nuevos .nv-precio i')];
  const bien = el => /^≈ \$ [\d.]+$/.test(dtTxt(el)) && el.querySelector('.aprox')?.title === dtREF;
  if(vid.length) ok(vid.every(bien), '[2.2] la vidriera: "≈ $ …" con el title de la cotizacion',
                    vid.length + ' · ' + dtTxt(vid[0]));
  else info('[2.2] hoy la vidriera no muestra pesos');
  if(nv.length) ok(nv.every(bien), '[2.2] Recien llegados: "≈ $ …" con el title', nv.length + ' · ' + dtTxt(nv[0]));
  else info('[2.2] hoy no hay Recien llegados con pesos');
}

/* ---- 2.1 El precio de lo que filtraste ---- */
function probarFiltroDeVersion(){
  /* El caso de la muestra: Celulares con 1TB y el iPhone 17 Pro Max, cuya
     tarjeta sin filtro es la de 256GB. (29/09, revision) Se busca por su
     forma en los datos de hoy: si ADVAPP deja de traer esa fila, cualquier
     modelo cuya tarjeta con un filtro de capacidad apunte a otra version que
     sin filtro; si no hay ninguno, una linea '--' en vez de fallar. */
  const formaDeLaMuestra = x => x.filtrada && clave(x) !== clave(buscarModelo(clave(x)).rep);
  let f1 = { cat: 'Celular', capacidad: '1TB' };
  dtFiltrar(f1);
  let pm = LISTA.find(x => /17 Pro Max/i.test(x.desc) && x.marca === 'Apple' && formaDeLaMuestra(x));
  if(pm) info('[2.1] el caso de la muestra: con Celulares + 1TB aparece el iPhone 17 Pro Max (' + LISTA.length + ' productos)');
  else {
    for(const f of [{ cat: 'Celular', capacidad: '1TB' }, { capacidad: '1TB' }, { capacidad: '512GB' }, { capacidad: '2TB' }, { capacidad: '256GB' }]){
      dtFiltrar(f);
      pm = LISTA.find(formaDeLaMuestra);
      if(pm){ f1 = f; break; }
    }
    if(pm) info('[2.1] hoy no esta el iPhone 17 Pro Max de 1TB: el caso se mira con ' + pm.desc + ' y ' + JSON.stringify(f1));
    else info('[2.1] hoy ningun modelo cambia de version con un filtro de capacidad: el caso de la muestra no se mira hoy');
  }
  const CAP = f1.capacidad;
  const cumple = dtCumple(f1);
  if(pm){
    const e = dtEsperado(pm, cumple);
    const card = [...grid.querySelectorAll('.card')].find(c => c.dataset.key === clave(pm));
    const v = buscarProducto(clave(pm));
    ok(v && capacidadDe(v) === CAP && v.stock && e.candidatas.includes(v),
       '[2.1] la tarjeta apunta a la version de ' + CAP + ' mas barata con stock (no a la del modelo sin filtro)', clave(pm) + ' · ' + (v && v.desc));
    ok(pm.precio === e.min && !!card && dtTxt(card.querySelector('.usd')).includes('USD ' + plata(e.min)),
       '[2.1] y muestra su precio', card && dtTxt(card.querySelector('.usd')) + ' · esperado USD ' + plata(e.min));
    ok(!!card && /desde/i.test(dtTxt(card.querySelector('.usd'))) === e.desde,
       '[2.1] "desde" solo si entre los ' + CAP + ' hay precios distintos', (e.desde ? 'con' : 'sin') + ' desde · ' +
       e.vs.map(x => x.precio).join('/'));
    const img = card && card.querySelector('.foto img');
    ok(!v || !v.imagen || (img && img.getAttribute('src') === v.imagen), '[2.1] la foto es la de esa version',
       img && img.getAttribute('src'));
    // La ficha abre en esa version
    if(card){
      card.click();
      const d = document.getElementById('ficha');
      ok(FICHA === clave(pm) && !!d && dtTxt(d.querySelector('#fi-elegido')).includes(CAP),
         '[2.1] tocarla abre la ficha en el ' + CAP, FICHA + ' · ' + dtTxt(d && d.querySelector('#fi-elegido')));
      quitarFicha();
      // El + carga esa misma
      const antes = PEDIDO.slice();
      PEDIDO = []; guardarPedido();
      card.querySelector('.mas')?.click();
      ok(PEDIDO.length === 1 && PEDIDO[0].k === clave(pm), '[2.1] el + carga esa misma version', JSON.stringify(PEDIDO));
      card.querySelector('.mas')?.click();
      ok(PEDIDO.length === 0, '[2.1] y el + la vuelve a sacar');
      PEDIDO = antes; guardarPedido(); pintarPedido();
    }
  }
  // La cabecera
  const precios = LISTA.map(x => x.precio).filter(x => x !== null && x > 0);
  const minimo = precios.length ? Math.min(...precios) : null;
  const cab = dtTxt(document.querySelector('#rubro-cab .rc-tit p'));
  ok(minimo !== null && cab.includes('desde USD ' + plata(minimo)), '[2.1] la cabecera se recalcula con lo filtrado', cab);
  ok(minimo !== null && MODELOS.some(m => m.variantes.some(v => cumple(v) && v.precio === minimo)),
     '[2.1] y hay un ' + CAP + ' a ese precio', 'USD ' + (minimo && plata(minimo)));

  // Todos los filtros de version, en toda la grilla
  const combos = [
    { capacidad: '1TB' }, { capacidad: '512GB' }, { cat: 'Celular', ram: '16GB' },
    { rango: '1000-2000' }, { rango: '500-1000' }, { soloStock: true },
    { cat: 'Celular', capacidad: '1TB', rango: '1000-2000' }
  ];
  combos.forEach(f => {
    dtFiltrar(f);
    const c = dtCumple(f);
    const nombre = JSON.stringify(f);
    if(!LISTA.length){ info('[2.1] ' + nombre + ': hoy no trae nada'); return; }
    const mal = LISTA.filter(x => {
      const e = dtEsperado(x, c);
      const v = buscarProducto(clave(x));
      return !v || !c(v) || x.precio !== e.min || !e.candidatas.includes(v) ||
             (e.stock && !v.stock) || x.stock !== e.stock;
    });
    ok(!mal.length, '[2.1] ' + nombre + ': cada tarjeta es la version mas barata con stock que cumple, con su precio',
       mal.slice(0, 3).map(x => x.desc + ' ' + clave(x) + ' USD ' + x.precio).join(' | ') || LISTA.length + ' tarjetas');
    const cards = [...grid.querySelectorAll('.card')];
    const malDom = cards.filter(card => {
      const x = LISTA.find(y => clave(y) === card.dataset.key);
      if(!x) return true;
      const e = dtEsperado(x, c);
      const usd = dtTxt(card.querySelector('.usd'));
      return /desde/i.test(usd) !== e.desde || (e.min !== null && !usd.includes('USD ' + plata(e.min)));
    });
    ok(!malDom.length, '[2.1] ' + nombre + ': el numero y el "desde" de cada tarjeta dibujada',
       malDom.slice(0, 3).map(c2 => c2.dataset.key + ' ' + dtTxt(c2.querySelector('.usd'))).join(' | ') || cards.length + ' dibujadas');
  });

  /* (29/09, revision) La regla del "desde" y del representante es una sola:
     vistaFiltrada la copiaba de armarModelo y habia que cambiarla dos veces */
  ok(typeof elegirRepresentante === 'function' && /elegirRepresentante\(/.test(vistaFiltrada.toString()) &&
     /elegirRepresentante\(/.test(armarModelo.toString()) && !/Math\.min\(/.test(vistaFiltrada.toString()),
     '[2.1] la tarjeta filtrada y el modelo eligen su fila con la misma funcion (elegirRepresentante)');
  // Sin filtro de version, la tarjeta es el modelo tal cual (no cambia nada)
  dtFiltrar({ cat: 'Celular' });
  ok(LISTA.every(x => MODELOS.includes(x) && !x.filtrada), '[2.1] sin filtro de version, las tarjetas son los modelos de siempre');
  // El mismo modelo del caso de arriba (el 17 Pro Max, o el que se uso hoy)
  const pmM = pm ? buscarModelo(clave(pm)) : null;
  if(pmM) dtFiltrar({ cat: pmM.cat });
  const pm2 = pmM ? LISTA.find(x => buscarModelo(clave(x)) === pmM) : null;
  if(pm2) ok(clave(pm2) === clave(pm2.rep), '[2.1] y sin filtro ' + (pm2.titulo || pm2.desc) + ' vuelve al "desde" del modelo', clave(pm2));
  else info('[2.1] sin el caso de arriba no se mira la vuelta al "desde" del modelo');
  // togglePedidoModelo con la clave de una version carga esa version
  const multi = MODELOS.find(m => m.stock && m.variantes.filter(v => v.stock).length > 1);
  if(multi){
    const otra = multi.variantes.find(v => v.stock && clave(v) !== clave(multi.rep));
    const antes = PEDIDO.slice();
    PEDIDO = [];
    togglePedidoModelo(clave(otra));
    ok(PEDIDO.length === 1 && PEDIDO[0].k === clave(otra), '[2.1] togglePedidoModelo carga la version de la clave, no la del "desde"',
       clave(otra) + ' · ' + JSON.stringify(PEDIDO));
    togglePedidoModelo(clave(multi.rep));
    ok(PEDIDO.length === 0, '[2.1] y desde otra version del mismo modelo la saca', JSON.stringify(PEDIDO));
    PEDIDO = antes; guardarPedido(); pintarPedido();
  } else info('[2.1] hoy no hay un modelo con dos versiones con stock para togglePedidoModelo');
}

/* ---- 2.2 Los pesos, aproximados ---- */
function probarPesos(){
  if(!TC){ info('[2.2] hoy no hay cotizacion: se saltea'); return; }
  dtFiltrar({ cat: 'Celular' });
  const ars = [...grid.querySelectorAll('.card .ars')];
  ok(ars.length && ars.every(el => /^≈ \$ [\d.]+$/.test(dtTxt(el)) && el.querySelector('.aprox')?.title === dtREF),
     '[2.2] la tarjeta: "≈ $ …" con el title "Referencia con la cotización del día"', ars.length + ' · ' + dtTxt(ars[0]));
  const m = LISTA.find(x => x.stock && x.precio);
  const v = m.rep;
  ok(dtTxt(ars.find(el => el.closest('.card').dataset.key === clave(m))) === '≈ $ ' + plata(Math.round(m.precio * TC)),
     '[2.2] el monto es el de siempre, solo cambia la marca', dtTxt(ars[0]));
  abrirFicha(clave(v), null);
  const fa = document.querySelector('#ficha .fi-precio .ars');
  ok(fa && dtTxt(fa) === '≈ $ ' + plata(Math.round(v.precio * TC)) && fa.querySelector('.aprox')?.title === dtREF,
     '[2.2] la ficha: lo mismo en la etiqueta oscura', dtTxt(fa));
  // El subtotal de la ficha con dos unidades
  const antes = PEDIDO.slice();
  PEDIDO = [{ k: clave(v), n: 2, color: '' }]; guardarPedido(); pintarPedido(); refrescarFicha();
  const sub = document.querySelector('#ficha #fi-sub');
  ok(sub && !sub.hidden && dtTxt(sub).includes('≈ $ ' + plata(Math.round(v.precio * 2 * TC))),
     '[2.2] el subtotal de la ficha tambien', dtTxt(sub));
  quitarFicha();
  // El total del pedido (la lista) y la barra en la compu
  abrirPedido();
  const tot = document.querySelector('#pedido .pd-total i');
  ok(tot && dtTxt(tot) === '≈ $ ' + plata(Math.round(totalPedido() * TC)) && tot.querySelector('.aprox')?.title === dtREF,
     '[2.2] el total del pedido: "≈ $ …" con el title', dtTxt(tot));
  ok(tot && getComputedStyle(tot.querySelector('.aprox')).textTransform === 'none',
     '[2.2] y en la letra de los pesos, no en la del rotulo "Total"');
  dtCerrarPedido();
  const bp = document.getElementById('bp-ars');
  const antesSigno = getComputedStyle(bp, '::before').content;
  ok(/^\$ [\d.]+$/.test(bp.textContent) && antesSigno === '"≈ "' && bp.title === dtREF,
     '[2.2] la barra del pedido en la compu: "≈ " adelante de los pesos, con el title', antesSigno + ' ' + bp.textContent);
  ok(/\(aprox\. \$ [\d.]+\)/.test(mensajePedido()), '[2.2] el mensaje de WhatsApp sigue diciendo "aprox."');
  PEDIDO = antes; guardarPedido(); pintarPedido();
}

/* ---- 2.3 El nombre en la ficha ---- */
function probarNombreFicha(){
  const conCodigos = m => /\s+F\s+.+?\s*\|\s*L\s+/.test(m.desc || '') ||
    (() => { const r = String(m.desc || '').match(/^\s*((?:[^\s|]+\s){0,2}[^\s|]+)\s*\|\s*(.+)$/);
             return !!r && !!m.marca && norm(r[2]).startsWith(norm(m.marca) + ' '); })();
  const cod = MODELOS.filter(conCodigos);
  info('[2.3] hoy ' + cod.length + ' fichas traen codigos del proveedor: ' + cod.map(m => clave(m.rep)).join(', '));
  const sucias = [];
  MODELOS.forEach(m => m.variantes.forEach(v => {
    const t = nombreFicha(m, v);
    if(/\s+F\s+.+\|\s*L\s+/.test(t) || (m.marca && new RegExp('\\|\\s*' + escRe(m.marca) + '\\b', 'i').test(t))) sucias.push(v.id + ': ' + t);
  }));
  ok(!sucias.length, '[2.3] ninguna ficha muestra "F … | L …" ni "| Marca"', sucias.slice(0, 3).join(' | ') || 'ninguna');
  // Solo cambian esas: las demas quedan como antes (el nombre de siempre, sin linea)
  const cambian = [];
  MODELOS.forEach(m => m.variantes.forEach(v => {
    const x = partirNombreFicha(m, v);
    if(x.nombre !== nombreDeLaFicha(m.desc || '', v) || x.linea) cambian.push(m);
  }));
  const distintos = [...new Set(cambian)];
  ok(distintos.length === cod.length && distintos.every(m => cod.includes(m)),
     '[2.3] solo cambian las fichas con codigos, las demas se leen igual', distintos.length + ' de ' + MODELOS.length);

  // Un Ray-Ban: titulo corto y la linea de armazon y cristal, entera
  const rb = MODELOS.find(m => /\s+F\s+.+?\s*\|\s*L\s+/.test(m.desc || ''));
  if(rb){
    abrirFicha(clave(rb.rep), null);
    const d = document.getElementById('ficha');
    const h3 = dtTxt(d.querySelector('.fi-nombre')), linea = d.querySelector('.fi-linea');
    const [, a, b] = rb.desc.match(/\s+F\s+(.+?)\s*\|\s*L\s+(.+)$/);
    ok(h3 === rb.titulo && !/\|| F /.test(h3), '[2.3] Ray-Ban: el titulo es el modelo, igual que la tarjeta', h3);
    ok(linea && dtTxt(linea) === 'Armazón ' + a.trim() + ' · Cristal ' + b.trim() && linea.previousElementSibling === d.querySelector('.fi-nombre'),
       '[2.3] y debajo, "Armazón … · Cristal …" entera', dtTxt(linea));
    ok(linea && getComputedStyle(linea).whiteSpace !== 'nowrap', '[2.3] la linea puede bajar de renglon');
    ok(dtTxt(d.querySelector('#fi-elegido b')) === h3, '[2.3] "Estás eligiendo" dice lo mismo', dtTxt(d.querySelector('#fi-elegido')));
    ok(!/\|/.test(document.title), '[2.3] el titulo de la pestaña tampoco lleva la barra', document.title);
    /* (29/09, revision) El dialogo se anunciaba con el texto crudo
       ("… F Shiny Black | L …"): ahora con el mismo nombre que la pestaña */
    const dlg = d.querySelector('.caja[role="dialog"]'), al = dlg && dlg.getAttribute('aria-label');
    ok(al === [rb.rep.marca, h3].filter(Boolean).join(' ') && !/\|| F /.test(al) && document.title.startsWith(al + ' · '),
       '[2.3] el lector de pantalla anuncia la ficha con ese mismo nombre (marca + modelo), no con los codigos', al);
    quitarFicha();
  } else info('[2.3] hoy no hay Ray-Ban con "F … | L …"');
  // Un monitor: sin "| Marca", sin linea
  const mon = MODELOS.find(m => conCodigos(m) && !/\s+F\s+/.test(m.desc));
  if(mon){
    abrirFicha(clave(mon.rep), null);
    const d = document.getElementById('ficha');
    const h3 = dtTxt(d.querySelector('.fi-nombre'));
    const ref = mon.desc.split('|')[0].trim();
    ok(h3.startsWith(ref + ' ') && !h3.includes('|') && !new RegExp('\\b' + escRe(mon.marca) + '\\b', 'i').test(h3) && !d.querySelector('.fi-linea'),
       '[2.3] monitor: la referencia adelante, sin "| ' + mon.marca + '" y sin linea aparte', mon.desc + ' -> ' + h3);
    const alM = d.querySelector('.caja[role="dialog"]').getAttribute('aria-label');
    ok(alM === [mon.rep.marca, h3].filter(Boolean).join(' ') && !alM.includes('|'), '[2.3] y el dialogo se anuncia igual, sin "|"', alM);
    quitarFicha();
  } else info('[2.3] hoy no hay un monitor con "| Marca"');
  // Una ficha comun no cambia
  const comun = MODELOS.find(m => m.multi && /iPhone 17 Pro$/i.test(m.titulo || '')) || MODELOS.find(m => !conCodigos(m));
  ok(nombreFicha(comun, comun.rep) === nombreDeLaFicha(comun.desc, comun.rep) && !partirNombreFicha(comun, comun.rep).linea,
     '[2.3] una ficha sin codigos queda igual', nombreFicha(comun, comun.rep));
}

/* ---- 2.4 El precio anterior en la ficha ---- */
function probarPrecioAnterior(){
  const conAntes = PRODUCTOS.filter(p => ahorro(p) > 0);
  info('[2.4] hoy ' + conAntes.length + ' filas traen "Precio anterior": se simula en una');
  const m = MODELOS.find(x => x.stock && x.variantes.filter(v => v.precio !== null).length > 1 &&
                              new Set(x.variantes.map(v => v.precio)).size > 1);
  if(!m){ info('[2.4] no hay un modelo con dos precios para probarlo'); return; }
  const v = m.variantes.find(x => x.stock && x.precio !== null);
  const w = m.variantes.find(x => x !== v && x.precio !== null && x.precio !== v.precio);
  const guardados = m.variantes.map(x => x.antes);
  try{
    m.variantes.forEach(x => { x.antes = null; });
    v.antes = v.precio + 20;
    abrirFicha(clave(v), null);
    const d = document.getElementById('ficha');
    const s = d.querySelector('.fi-precio s.antes');
    ok(s && dtTxt(s) === 'USD ' + plata(v.precio + 20), '[2.4] el precio anterior tachado al lado del de hoy', dtTxt(s));
    ok(s && s.previousElementSibling === d.querySelector('.fi-precio .usd'), '[2.4] pegado al precio, antes de los pesos');
    ok(s && getComputedStyle(s).color === 'rgb(165, 151, 196)' && /line-through/.test(getComputedStyle(s).textDecorationLine),
       '[2.4] tachado y en lila #A597C4', s && getComputedStyle(s).color);
    const arriba = d.querySelector('.fi-arriba');
    const aho = arriba && arriba.querySelector('.badge.ahorro');
    ok(aho && dtTxt(aho) === 'Ahorrás USD 20' && arriba.querySelector('.badge.si') && aho.previousElementSibling === arriba.querySelector('.badge.si'),
       '[2.4] y el cartel "Ahorrás USD 20" arriba de la foto, al lado de "En stock"', dtTxt(arriba));
    ok(aho && aho.outerHTML === htmlAhorro(v).trim(), '[2.4] el mismo cartel que la tarjeta');
    elegirVariante(d, m, w);
    ok(!d.querySelector('.fi-precio s.antes') && !d.querySelector('.fi-arriba .badge.ahorro'),
       '[2.4] otra version sin precio anterior: los dos se van solos', clave(w));
    elegirVariante(d, m, v);
    ok(!!d.querySelector('.fi-precio s.antes') && !!d.querySelector('.fi-arriba .badge.ahorro'),
       '[2.4] y vuelven con la version que lo tiene (es de la version, no del modelo)');
    quitarFicha();
  } finally {
    m.variantes.forEach((x, i) => { x.antes = guardados[i]; });
  }
}

/* ---- 2.5 Sin factura y formas de pago ----
   (30/09) Pedro saco la factura: ya no hay "¿El precio incluye IVA?" y el
   renglon dice "¿Cómo puedo pagar?", sin respuesta abajo (decision-cuotas). */
function probarFormasDePago(){
  const iva = PREGUNTAS.find(q => q.p === '¿El precio incluye IVA?');
  const pagar = PREGUNTAS.find(q => q.p === '¿Cómo puedo pagar?');
  ok(!iva && !!pagar, '[2.5] PREGUNTAS tiene "¿Cómo puedo pagar?" y ya no "¿El precio incluye IVA?"');
  ok(!!ICONOS_SERVICIO.pago, '[2.5] hay icono para el renglon en ICONOS_SERVICIO');
  const m = MODELOS.find(x => x.stock && x.multi);
  abrirFicha(clave(m.rep), null);
  let d = document.getElementById('ficha');
  const lis = [...d.querySelectorAll('.fi-servicio > li')];
  const li = d.querySelector('.fi-servicio li[data-servicio="pago"]');
  ok(li && lis.map(x => x.dataset.servicio).join(',') === 'retiro,garantia,pago',
     '[2.5] un renglon nuevo junto a retiro y garantia', lis.map(x => x.dataset.servicio).join(','));
  ok(li && dtTxt(li.querySelector('b')) === pagar.p && !li.querySelector('i'),
     '[2.5] con la pregunta «¿Cómo puedo pagar?», tal cual', li && dtTxt(li.querySelector('b')));
  const bot = li && li.querySelector('.fi-desplegar');
  const caja = li && li.querySelector('#fi-pagos');
  ok(bot && dtTxt(bot) === 'Ver formas de pago' && bot.getAttribute('aria-expanded') === 'false' && caja && caja.hidden &&
     bot.getAttribute('aria-controls') === 'fi-pagos', '[2.5] "Ver formas de pago", cerrado al abrir la ficha');
  if(bot){
    bot.click();
    ok(bot.getAttribute('aria-expanded') === 'true' && !caja.hidden && caja.offsetHeight > 0, '[2.5] tocarlo despliega la respuesta');
    const esperado = [...pagar.r, ...(pagar.lista || [])];
    ok(esperado.every(t => dtTxt(caja).includes(t)) && caja.querySelectorAll('li').length === (pagar.lista || []).length,
       '[2.5] la respuesta de "¿Cómo puedo pagar?" entera, con su lista', caja.querySelectorAll('li').length + ' formas');
    ok(caja.querySelector('li') && getComputedStyle(caja.querySelector('li')).display === 'list-item',
       '[2.5] la lista se ve como lista (no como los renglones de servicio)');
    bot.click();
    ok(bot.getAttribute('aria-expanded') === 'false' && caja.hidden, '[2.5] y tocarlo otra vez la cierra');
  } else info('[2.5] sin el boton no se prueba el desplegar');
  // Nada inventado: fuera de PREGUNTAS, solo el texto del boton
  let resto = dtTxt(li);
  [pagar.p, ...pagar.r, ...(pagar.lista || []), 'Ver formas de pago'].forEach(t => { resto = resto.split(t).join(''); });
  ok(li && !resto.replace(/\s+/g, ''), '[2.5] ningun texto que no este en PREGUNTAS', resto.trim() || 'nada');
  // Cambiar de version no lo duplica ni lo pierde
  const otra = [...d.querySelectorAll('.fi-op')].find(b => b.getAttribute('aria-pressed') !== 'true');
  if(otra){
    otra.click();
    d = document.getElementById('ficha');
    ok(d.querySelectorAll('.fi-servicio li[data-servicio="pago"]').length === 1, '[2.5] cambiar de version lo deja una sola vez');
    const b2 = d.querySelector('.fi-desplegar');
    b2 && b2.click();
    ok(b2 && !d.querySelector('#fi-pagos').hidden, '[2.5] y sigue desplegando');
  } else info('[2.5] esa ficha no tiene otra version para cambiar');
  quitarFicha();
}

/* ---- 2.6 Pedir algo sin stock ---- */
async function probarSinStock(){
  const sinP = buscarProducto('ACC-CAN-001');
  const sin = (sinP && !sinP.stock) ? sinP : PRODUCTOS.find(p => !p.stock && p.precio && buscarModelo(clave(p)));
  const con = PRODUCTOS.find(p => p.stock && p.precio && buscarModelo(clave(p)));
  if(!sin){ info('[2.6] hoy no hay nada sin stock'); return; }
  info('[2.6] se prueba con ' + sin.id + ' (' + sin.desc + ')');
  const mSin = buscarModelo(clave(sin));
  // La tarjeta agotada pierde el +
  if(!mSin.stock){
    const t = tarjeta(mSin);
    ok(!t.querySelector('.mas') && t.querySelector('a.wa') && /^Avisame cuando entre/.test(t.querySelector('a.wa').getAttribute('aria-label')),
       '[2.6] la tarjeta agotada no tiene + y queda "Avisame cuando entre"');
  }
  const todas = MODELOS.map(m => tarjeta(m));
  const malas = todas.filter((t, i) => !!t.querySelector('.mas') !== !!MODELOS[i].stock);
  ok(!malas.length, '[2.6] ninguna tarjeta agotada tiene +, todas las que tienen stock si',
     malas.slice(0, 3).map(t => t.dataset.key).join(', ') || MODELOS.filter(m => !m.stock).length + ' agotadas');
  dtFiltrar({ q: '' , cat: mSin.cat });
  const enGrilla = [...grid.querySelectorAll('.card.agotado')];
  ok(enGrilla.every(c => !c.querySelector('.mas')), '[2.6] en la grilla tambien', enGrilla.length + ' agotadas dibujadas');

  // La ficha deja solo "Avisame cuando entre"
  abrirFicha(clave(sin), null);
  const d = document.getElementById('ficha');
  const bots = d.querySelector('.fi-botones');
  const caja = d.querySelector('#fi-pedido-caja');
  ok(bots.querySelectorAll('a, button').length === 1 && bots.querySelector('.cta.cta-aviso') &&
     /Avisame cuando entre/.test(dtTxt(bots)) && !d.querySelector('#fi-pedido'),
     '[2.6] la ficha sin stock deja solo "Avisame cuando entre"', dtTxt(bots));
  ok(!caja || getComputedStyle(caja).display === 'none', '[2.6] sin el hueco de la caja del pedido');
  quitarFicha();

  // No se puede agregar por ningun camino
  const antes = PEDIDO.slice();
  PEDIDO = []; guardarPedido();
  togglePedido(clave(sin));
  togglePedidoModelo(clave(sin));
  ok(PEDIDO.length === 0, '[2.6] togglePedido y togglePedidoModelo no lo agregan', JSON.stringify(PEDIDO));

  // Lo que ya estaba guardado y se quedo sin stock: marcado, sin borrarse, sin sumar
  PEDIDO = [{ k: clave(con), n: 1, color: '' }, { k: clave(sin), n: 2, color: '' }]; guardarPedido();
  limpiarPedido();
  ok(PEDIDO.length === 2 && lineaPedido(clave(sin)), '[2.6] lo guardado sin stock no se borra solo', JSON.stringify(PEDIDO));
  ok(totalPedido() === con.precio, '[2.6] y no suma al total', 'USD ' + totalPedido() + ' (con stock: ' + con.precio + ')');
  pintarPedido();
  ok(document.getElementById('bp-usd').textContent === 'USD ' + plata(con.precio), '[2.6] la barra muestra el total sin eso',
     document.getElementById('bp-usd').textContent);
  abrirPedido();
  const fila = document.querySelector(`#pedido .pd-item[data-key="${CSS.escape(clave(sin))}"]`);
  ok(fila && dtTxt(fila.querySelector('.pd-precio .badge.no')) === 'Sin stock' && /no suma al total/.test(dtTxt(fila.querySelector('.pd-precio'))),
     '[2.6] en la lista: "Sin stock" y "no suma al total"', fila && dtTxt(fila.querySelector('.pd-precio')));
  const mas = fila && fila.querySelector('.stepper button[data-d="1"]');
  const menos = fila && fila.querySelector('.stepper button[data-d="-1"]');
  ok(mas && mas.disabled && menos && !menos.disabled && fila.querySelector('.pd-quitar'),
     '[2.6] se puede bajar o quitar, pero no sumar unidades');
  ok(dtTxt(document.querySelector('#pedido .pd-total')).includes('más 1 producto sin stock'),
     '[2.6] abajo del total: "más 1 producto sin stock"', dtTxt(document.querySelector('#pedido .pd-total')));
  dtCerrarPedido();
  cambiarCant(clave(sin), 1);
  ok(cantDe(clave(sin)) === 2, '[2.6] cambiarCant no le suma unidades', cantDe(clave(sin)));
  const msj = mensajePedido();
  ok(new RegExp('\\(' + escRe(sin.id) + '\\) · x2 — sin stock \\(avisame cuando entre\\)').test(msj),
     '[2.6] el mensaje lo pide como aviso', (msj.split('\n').find(l => l.includes(sin.id)) || '').slice(0, 120));
  ok(/Total: USD [\d.]+( \(aprox\. \$ [\d.]+\))?(, más los productos a consultar)?, más los productos sin stock/.test(msj),
     '[2.6] y el total cierra con ", más los productos sin stock"', (msj.split('\n').find(l => /^Total/.test(l)) || ''));
  cambiarCant(clave(sin), -1);
  ok(cantDe(clave(sin)) === 1, '[2.6] bajar si se puede', cantDe(clave(sin)));

  /* (29/09, revision) Si en el pedido SOLO queda algo sin stock no hay total
     que dar: decia "USD 0 · ≈ $ 0", que se lee como un precio de cero */
  PEDIDO = [{ k: clave(sin), n: 2, color: '' }]; guardarPedido(); pintarPedido();
  const bpU = document.getElementById('bp-usd').textContent, bpA = document.getElementById('bp-ars').textContent;
  ok(bpU === 'Sin stock' && !bpA, '[2.6] con solo algo sin stock, la barra no dice "USD 0" ni pesos', bpU + ' · ' + (bpA || 'sin pesos'));
  abrirPedido();
  const tot = document.querySelector('#pedido .pd-total');
  ok(tot && !tot.querySelector('b') && !/USD|\$/.test(dtTxt(tot)) && dtTxt(tot.querySelector('.pd-mas')) === '1 producto sin stock',
     '[2.6] el total de la lista dice solo "1 producto sin stock", sin monto', dtTxt(tot));
  dtCerrarPedido();
  const msj0 = mensajePedido();
  ok(!/Total:|USD 0|\$ 0\b/.test(msj0) && /— sin stock \(avisame cuando entre\)/.test(msj0),
     '[2.6] y el mensaje no trae "Total: USD 0": cada renglon ya dice sin stock', msj0.split('\n').slice(-1)[0].slice(0, 80));
  // Con algo con stock, el total vuelve como siempre
  PEDIDO = [{ k: clave(con), n: 1, color: '' }, { k: clave(sin), n: 1, color: '' }]; guardarPedido(); pintarPedido();
  ok(document.getElementById('bp-usd').textContent === 'USD ' + plata(con.precio) && /^Total: USD /m.test(mensajePedido()),
     '[2.6] con algo con stock, la barra y el mensaje llevan el total de siempre', document.getElementById('bp-usd').textContent);

  /* (29/09, revision) A 360 la cruz de la linea sin stock bajaba sola a un
     tercer renglon, pegada a la izquierda: "no suma al total" se parte */
  const f = document.createElement('iframe');
  f.style.cssText = 'width:360px;height:640px;border:0;position:absolute;left:-9999px;top:0';
  f.src = 'index.html';
  document.body.appendChild(f);
  try{
    const listo = await dtEsperarA(() => f.contentWindow.eval('MODELOS.length && FUENTE && !document.getElementById("barra-pedido").hidden'), 40000);
    ok(listo, '[2.6 · 360] el celular de 360 carga con el pedido');
    if(listo){
      const w = f.contentWindow, doc = f.contentDocument;
      try{ w.pararOfertas?.(); w.pararPaseos?.(); w.pararMundos?.(); }catch(e){}
      w.eval('abrirPedido()');
      await dtQuieto(doc.getElementById('pedido'));   // la ventana ya entro entera
      const fila = doc.querySelector(`#pedido .pd-item[data-key="${CSS.escape(clave(sin))}"]`);
      const pr = fila && fila.querySelector('.pd-precio'), x = fila && fila.querySelector('.pd-quitar');
      const rp = pr && pr.getBoundingClientRect(), rx = x && x.getBoundingClientRect(), rs = fila && fila.querySelector('.stepper').getBoundingClientRect();
      ok(!!rx && !!rp && rx.top < rp.bottom && rx.bottom > rp.top && rx.left >= rp.right - 1 && Math.abs(rs.top - rp.top) < rp.height,
         '[2.6 · 360] en la linea sin stock la cruz queda en el renglon del precio, a su derecha',
         rx && rp && 'cruz ' + Math.round(rx.left) + ',' + Math.round(rx.top) + ' · precio ' + Math.round(rp.right) + ',' + Math.round(rp.top) + '-' + Math.round(rp.bottom));
      const caja = doc.querySelector('#pedido .caja');
      ok(caja && caja.scrollWidth <= caja.clientWidth + 1, '[2.6 · 360] y nada se sale de costado');
    }
  } finally {
    f.remove();
  }
  PEDIDO = antes; guardarPedido(); pintarPedido();
}

/* ---- 2.7 y 2.8 (y la barra de 2.2) en un celular de 390 x 664 ---- */
async function probarCelular(){
  // En la compu no cambia nada
  const m = MODELOS.find(x => x.stock && x.multi && /iPhone 17 Pro$/i.test(x.titulo || '')) || MODELOS.find(x => x.stock && x.multi);
  abrirFicha(clave(m.rep), null);
  let d = document.getElementById('ficha');
  ok(getComputedStyle(d.querySelector('.fi-botones')).position === 'static' &&
     getComputedStyle(d.querySelector('.fi-cerrar')).position === 'absolute',
     '[2.7/2.8] en la compu, los botones y la X como siempre');
  quitarFicha();

  // Un pedido guardado, para que el celular tenga la barra
  const antes = PEDIDO.slice();
  const con = PRODUCTOS.find(p => p.stock && p.precio > 1000 && buscarModelo(clave(p)));
  PEDIDO = [{ k: clave(con), n: 1, color: '' }]; guardarPedido();
  const f = document.createElement('iframe');
  f.style.cssText = 'width:390px;height:664px;border:0;position:absolute;left:-9999px;top:0';
  f.src = 'index.html#p=' + encodeURIComponent(clave(m.rep));
  document.body.appendChild(f);
  try{
    const listo = await dtEsperarA(() => {
      const w = f.contentWindow;
      /* MODELOS, FUENTE y FICHA son let: no cuelgan de window, se leen con el
         eval de la pagina del iframe */
      return w.eval('MODELOS.length && FUENTE && FICHA') && w.document.querySelector('#ficha .fi-botones .cta');
    }, 40000);
    ok(listo, '[2.7] el celular de 390 px abre la ficha del ' + (m.titulo || m.desc));
    if(!listo) return;
    const w = f.contentWindow, doc = f.contentDocument;
    try{ w.pararOfertas?.(); w.pararPaseos?.(); w.pararMundos?.(); }catch(e){}
    await dtQuieto(doc.getElementById('ficha'));     // la ficha ya entro entera (cajaIn)
    const caja = doc.querySelector('#ficha .caja');
    const bots = doc.querySelector('#ficha .fi-botones');
    const cta = bots.querySelector('.cta');
    const X = doc.querySelector('#ficha .fi-cerrar');
    const cs = el => w.getComputedStyle(el);
    ok(caja.scrollHeight > caja.clientHeight + 100, '[2.7] la ficha es mas alta que la pantalla (hay que bajar)',
       caja.scrollHeight + ' > ' + caja.clientHeight);
    // 2.7 B
    ok(cs(bots).position === 'sticky' && cs(bots).bottom === '0px' && cs(bots).borderTopStyle === 'solid' &&
       cs(bots).backgroundColor !== 'rgba(0, 0, 0, 0)', '[2.7] los botones van pegados abajo, con fondo y borde arriba',
       cs(bots).position + ' ' + cs(bots).bottom + ' ' + cs(bots).backgroundColor);
    caja.scrollTop = 0;
    await dtDormir(100);
    let rc = caja.getBoundingClientRect(), rb = cta.getBoundingClientRect();
    ok(rb.top >= rc.top && rb.bottom <= rc.bottom + 1, '[2.7] "Consultar por WhatsApp" se ve sin bajar',
       Math.round(rb.top - rc.top) + '-' + Math.round(rb.bottom - rc.top) + ' en una caja de ' + Math.round(rc.height));
    ok(dtTxt(cta).includes('Consultar por WhatsApp') && cta.href.includes('wa.me'), '[2.7] y es el mismo boton de siempre');
    caja.scrollTop = caja.scrollHeight;
    await dtDormir(100);
    const env = doc.querySelector('#ficha .fi-envio');
    rb = bots.getBoundingClientRect();
    ok(env && rb.bottom <= env.getBoundingClientRect().top + 1, '[2.7] al llegar al envio se sueltan (no lo tapan)',
       Math.round(rb.bottom) + ' <= ' + Math.round(env.getBoundingClientRect().top));
    /* (29/09, revisiones de la 2.7 y la 4.3) Con el teclado, lo enfocado no
       queda detras del pie pegado: la ficha reserva abajo su alto medido.
       (29/09) Contra el alto de layout (offsetHeight, el mismo que mide la
       pagina) leido en el mismo momento que el scroll-padding: el de
       getBoundingClientRect cambia con la animacion de entrada (dio 126 px
       con un pie de 111 bajo carga). Y si el pie cambio de alto, se espera
       con tope a que el ResizeObserver de la pagina lo alcance. */
    const reserva = () => [parseFloat(cs(caja).scrollPaddingBottom), bots.offsetHeight];
    await dtHasta(() => { const [s, a] = reserva(); return Math.abs(s - (a + 12)) <= 2; }, w);
    const [sp, altoPie] = reserva();
    ok(Math.abs(sp - (altoPie + 12)) <= 2, '[2.7] la ficha reserva abajo el alto del pie para el foco',
       sp + ' px con un pie de ' + altoPie);
    const tapados = async sel => {
      const malos = [], els = [...doc.querySelectorAll(sel)].filter(el => el.getClientRects().length);
      for(const el of els){
        caja.scrollTop = 0; await dtDormir(30);
        el.focus(); await dtDormir(60);
        const r = el.getBoundingClientRect(), rp = bots.getBoundingClientRect();
        if(r.bottom > rp.top + 1) malos.push(dtTxt(el).slice(0, 24) + ' ' + Math.round(r.bottom) + '>' + Math.round(rp.top));
      }
      return { n: els.length, malos };
    };
    const pest = await tapados('#ficha .fi-op');
    if(pest.n) ok(!pest.malos.length, '[2.7] con el Tab, ninguna pestaña de version queda detras del pie', pest.malos.join(' | ') || pest.n + ' enfocadas');
    else info('[2.7] esa ficha no tiene pestañas de version');
    const todas = doc.querySelector('#ficha .fi-todas');
    if(todas){
      todas.open = true; await dtDormir(80);
      const filas = await tapados('#ficha .fi-todas .fi-fila');
      ok(filas.n > 0 && !filas.malos.length, '[4.3 · 390] con el Tab, ningun renglon de "Ver las N versiones" queda detras del pie',
         filas.malos.slice(0, 4).join(' | ') || filas.n + ' renglones');
      todas.open = false;
    } else info('[4.3 · 390] esa ficha no tiene "Ver las N versiones"');
    caja.scrollTop = 0;
    // 2.8 B
    ok(cs(X).position === 'sticky' && cs(X).top === '14px', '[2.8] la X es sticky arriba', cs(X).position + ' ' + cs(X).top);
    caja.scrollTop = 0;
    await dtDormir(80);
    const cols = doc.querySelector('#ficha .fi-cols');
    ok(Math.abs(cols.getBoundingClientRect().top - caja.getBoundingClientRect().top) <= 1,
       '[2.8] no empuja la foto: arriba de todo sigue la foto', Math.round(cols.getBoundingClientRect().top - caja.getBoundingClientRect().top) + ' px');
    let rx = X.getBoundingClientRect(); rc = caja.getBoundingClientRect();
    ok(Math.abs(rx.top - rc.top - 14) <= 2 && Math.abs(rc.right - rx.right - 14) <= 3, '[2.8] arriba a la derecha, como antes',
       Math.round(rx.top - rc.top) + ' / ' + Math.round(rc.right - rx.right));
    caja.scrollTop = 560;
    await dtDormir(100);
    rx = X.getBoundingClientRect(); rc = caja.getBoundingClientRect();
    ok(caja.scrollTop > 400 && Math.abs(rx.top - rc.top - 14) <= 2, '[2.8] bajando 560 px la X sigue a la vista', Math.round(rx.top - rc.top) + ' px');
    const arriba = doc.elementFromPoint(rx.left + rx.width / 2, rx.top + rx.height / 2);
    ok(arriba === X, '[2.8] y no queda tapada por lo que pasa por debajo', arriba && (arriba.className || arriba.tagName));
    X.click();
    await dtDormir(150);
    ok(!doc.getElementById('ficha'), '[2.8] y cierra la ficha');
    // 2.2: la barra del pedido del celular, sin marca y en un renglon
    const bp = doc.getElementById('bp-ars');
    await dtEsperarA(() => w.eval('TC') && bp.textContent, 15000);
    if(w.eval('TC')){
      ok(w.getComputedStyle(bp, '::before').content === 'none' && /^\$ [\d.]+$/.test(bp.textContent),
         '[2.2] la barra del pedido del celular va sin "≈"', w.getComputedStyle(bp, '::before').content + ' ' + bp.textContent);
      const alto = parseFloat(cs(bp).lineHeight) || parseFloat(cs(bp).fontSize);
      ok(bp.getBoundingClientRect().height <= alto * 1.6, '[2.2] y los pesos no bajan de renglon',
         Math.round(bp.getBoundingClientRect().height) + ' px');
    } else info('[2.2] el celular no tiene cotizacion: no se mira la barra');
  } finally {
    f.remove();
    PEDIDO = antes; guardarPedido(); pintarPedido();
  }
}
