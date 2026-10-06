// Guardas de la tanda B7, CSS y accesibilidad (auditoria del 29/09/2026).
// Cada bloque es un error que se encontro y se arreglo: si vuelve, falla aca.
// El numero entre corchetes es el del hallazgo.
//
//  [124] La ficha se podia arrastrar de costado (14 px en el celular, en 436
//        de 463 fichas) hasta que el cliente bajaba a "Tambien te puede
//        interesar": las pastillas esperan su entrada corridas 30 px.
//  [127] Con "reducir movimiento" seguian latiendo el punto de "Actualizado"
//        y el esqueleto de la carga, y El Primo entraba con el topetazo (un
//        zoom de 2,4x con giro): su regla pesaba mas que la que lo apagaba.
//  [132] CSS muerto y repetido: la base de .pc de las filas viejas de la
//        portada (y htmlProdChico, que nadie llamaba), el rotulo "Categoria"
//        siempre escondido, un .wa que .acciones .wa pisaba entero, y reglas
//        partidas en dos o tres lugares. El :hover de la base levantaba la
//        pastilla aun con "reducir movimiento".
//  [133] Con el teclado habia que pasar 36 Tabs (44 adentro de Celulares)
//        antes del catalogo; la cinta de rubros no era una zona con nombre.
//  [204] El titulo de la pestaña era siempre el mismo, con la ficha abierta
//        o adentro de un rubro.
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
const dormirB7 = ms => new Promise(r => setTimeout(r, ms));
const FRENOS_B7 = ['pararOfertas', 'pararPaseos', 'pararMundos', 'pararNuevos', 'pararMarcas'];

const esperaB7 = setInterval(() => {
  if(!MODELOS.length || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperaB7);
  correrPruebasB7()
    .catch(e => { R.push('EXCEPCION: ' + (e && e.stack || e)); fallas++; })
    .then(() => {
      try{ document.getElementById('egg')?.click(); }catch(e){}
      try{ quitarFicha(); }catch(e){}
      FRENOS_B7.forEach(n => { try{ window[n](); }catch(e){} });
      try{ VIGIAS.forEach(io => io.disconnect()); }catch(e){}
      for(let i = 1; i < 5000; i++) clearInterval(i);
      reportar();
    });
}, 150);

async function correrPruebasB7(){
  const bloques = [cssMuerto, pastillaEntera, fichaSinCorrerse, fichaSinCorrerseEnElCelular,
                   reducirMovimiento, saltarAlCatalogo, tituloDeLaPestana];
  for(const b of bloques){
    try{ await b(); }
    catch(e){ R.push('EXCEPCION en ' + b.name + ': ' + (e && e.stack || e)); fallas++; }
  }
}

const aLaPortadaB7 = () => { quitarFicha(); irAlMenu(); scrollTo(0, 0); };
// Un modelo con sugeridos: la cinta de la ficha es la que se corria
const conSugeridosB7 = () => MODELOS.find(m => relacionados(m).length >= 2) || MODELOS.find(m => relacionados(m).length);

// Todas las reglas de estilo, con la cadena de @media en la que viven
function reglasB7(){
  const out = [];
  const rec = (lista, ctx) => [...lista].forEach(r => {
    if(r.selectorText) out.push({ r, sel: r.selectorText, ctx });
    if(r.cssRules) rec(r.cssRules, r.conditionText ? ctx + ' @' + r.conditionText : ctx);
  });
  [...document.styleSheets].forEach(h => { try{ rec(h.cssRules, ''); }catch(e){} });
  return out;
}
const partesB7 = sel => sel.split(',').map(s => s.trim());

/* ---- [132] CSS muerto y repetido ---- */
function cssMuerto(){
  const reglas = reglasB7();
  ok(typeof htmlProdChico === 'undefined', '[132] htmlProdChico, la tarjeta chica de las filas viejas, no esta (nadie la llamaba)');

  // .pc solo existe en la cinta de la ficha: una base suelta es la de la portada vieja
  const pcSuelta = reglas.flatMap(x => partesB7(x.sel)).filter(s => /\.pc(-foto|-txt)?(?![\w-])/.test(s) && !/\.fi-rel\b/.test(s));
  ok(!pcSuelta.length, '[132] no quedan reglas de .pc fuera de .fi-rel (la base de las filas de la portada que salieron el 18/09)',
     pcSuelta.join(' | ') || 'ninguna');

  const rotulos = reglas.flatMap(x => partesB7(x.sel)).filter(s => /\.rotulo(?![\w-])/.test(s) && !/\.sugeridos\b/.test(s));
  ok(!rotulos.length && !document.querySelector('.barra-cats .rotulo'),
     '[132] ni el rotulo "Categoria" de la columna de filtros que no existe desde el 15/09, ni sus reglas', rotulos.join(' | ') || 'ninguna');

  const waMuerto = reglas.flatMap(x => partesB7(x.sel)).filter(s => s === '.wa' || s === '.wa:hover' || /\.card:hover \.wa$/.test(s));
  ok(!waMuerto.length, '[132] ni el .wa viejo que .acciones .wa pisaba entero (borde, 44 px, dos :hover)', waMuerto.join(' | ') || 'ninguno');
  ok([...document.querySelectorAll('a.wa')].every(a => a.closest('.acciones')),
     '[132] y el boton .wa sigue viviendo solo en .acciones, donde esta su estilo');

  // Las que estaban partidas en dos o tres lugares, una sola vez por contexto
  const cuenta = {};
  reglas.forEach(x => partesB7(x.sel).length === 1 && (cuenta[x.ctx + ' || ' + x.sel] = (cuenta[x.ctx + ' || ' + x.sel] || 0) + 1));
  const repetidas = ['#ficha .caja', '.fi-marca', '.fi-precio .sub', '.fi-eje-rot', '.rf-card .rc-acc']
    .flatMap(s => Object.entries(cuenta).filter(([k, n]) => k.endsWith(' || ' + s) && n > 1).map(([k, n]) => n + 'x ' + k));
  ok(!repetidas.length, '[132] #ficha .caja, .fi-marca, .fi-precio .sub, .fi-eje-rot y .rf-card .rc-acc van en una sola regla',
     repetidas.join(' | ') || 'una cada una');

  // Dos @media iguales seguidos (eran dos max-width:760px, uno atras del otro)
  const gemelos = [];
  const rec = lista => { let prev = null; [...lista].forEach(r => {
    if(r instanceof CSSMediaRule){
      if(prev instanceof CSSMediaRule && prev.conditionText === r.conditionText) gemelos.push(r.conditionText);
      rec(r.cssRules);
    }
    prev = r;
  }); };
  [...document.styleSheets].forEach(h => { try{ rec(h.cssRules); }catch(e){} });
  ok(!gemelos.length, '[132] no hay dos @media con la misma condicion uno atras del otro', gemelos.join(' | ') || 'ninguno');

  const transMundo = reglas.filter(x => x.sel === '.mundo-foto img' && !x.ctx && x.r.style.transition);
  ok(transMundo.length === 1, '[132] .mundo-foto img tiene una sola transition (la otra estaba pisada y no hacia nada)', transMundo.length);

  // El levante del mouse de la pastilla, solo sin "reducir movimiento"
  const levantan = reglas.filter(x => /\.pc:hover/.test(x.sel) && x.r.style.transform && x.r.style.transform !== 'none'
                                      && !/prefers-reduced-motion: no-preference/.test(x.ctx));
  ok(!levantan.length, '[132] ninguna regla levanta la pastilla con el mouse sin mirar "reducir movimiento"',
     levantan.map(x => x.sel + ' ' + x.ctx).join(' | ') || 'ninguna');
}

/* ---- [132] Lo que la cinta tomaba de la base de .pc sigue estando ---- */
async function pastillaEntera(){
  aLaPortadaB7();
  const m = conSugeridosB7();
  if(!m){ nota('[132] hoy ningun modelo tiene sugeridos: no hay pastilla que mirar'); return; }
  abrirFicha(clave(m.rep), null);
  await dormirB7(300);
  const pc = document.querySelector('#ficha .fi-rel .pc');
  ok(!!pc, '[132] la ficha de ' + m.desc + ' tiene su cinta de sugeridos');
  if(!pc){ quitarFicha(); return; }
  const cs = (s, el = pc) => getComputedStyle(s ? pc.querySelector(s) : el);
  const b = cs('.pc-txt b'), i = cs('.pc-txt i'), foto = cs('.pc-foto');
  ok(cs().cursor === 'pointer' && cs().textAlign === 'left', '[132] la pastilla sigue con la manito y el texto a la izquierda',
     cs().cursor + ', ' + cs().textAlign);
  /* Chrome informa el -webkit-box con recorte como flow-root: lo que importa
     es que haya recorte (line-clamp), que tape lo que sobra y que corte
     palabras largas en vez de estirar la pastilla. */
  ok(/^(-webkit-box|flow-root)$/.test(b.display) && b.webkitLineClamp !== 'none' && b.overflow === 'hidden' &&
     b.webkitBoxOrient === 'vertical' && b.overflowWrap === 'anywhere',
     '[132] el nombre se sigue recortando en sus renglones (no estira la pastilla)',
     [b.display, 'clamp ' + b.webkitLineClamp, b.overflow, b.webkitBoxOrient, b.overflowWrap].join(', '));
  ok(i.display === 'block' && i.fontStyle === 'normal', '[132] el precio va en su renglon y derecho, no en italica', i.display + ', ' + i.fontStyle);
  ok(foto.overflow === 'hidden', '[132] la foto que crece con el mouse no se sale de su cuadrado', foto.overflow);
  ok(reglasB7().some(x => /\.fi-rel \.pc:focus-visible/.test(x.sel) && /outline[^-]*solid/.test(x.r.style.cssText)),
     '[132] y tiene su anillo de foco para el teclado');
  quitarFicha();
}

/* ---- [124] La ficha no se arrastra de costado mientras espera la cinta ----
   Se mide el momento de la espera: las pastillas corridas 30 px, sin la .vis
   que las trae. Las transiciones se apagan un instante para medir ya. */
function medirEspera(doc){
  const caja = doc.querySelector('#ficha .caja'), rel = doc.querySelector('#ficha .fi-rel');
  const pcs = [...rel.querySelectorAll('.pc')];
  const habia = rel.classList.contains('vis');
  pcs.forEach(p => p.style.transition = 'none');
  rel.classList.remove('vis');
  const corrida = getComputedStyle(pcs[0]).translate;
  const r = { corrida, sw: caja.scrollWidth, cw: caja.clientWidth, ox: getComputedStyle(rel).overflowX, oy: getComputedStyle(rel).overflowY };
  caja.scrollLeft = 100;
  r.izq = caja.scrollLeft;
  caja.scrollLeft = 0;
  if(habia) rel.classList.add('vis');
  pcs.forEach(p => p.style.transition = '');
  return r;
}
async function fichaSinCorrerse(){
  aLaPortadaB7();
  const m = conSugeridosB7();
  if(!m){ nota('[124] hoy ningun modelo tiene sugeridos'); return; }
  abrirFicha(clave(m.rep), null);
  await dormirB7(300);
  const r = medirEspera(document);
  if(r.corrida === 'none') nota('[124] las pastillas no esperan corridas (reducir movimiento): se mide igual');
  ok(r.sw <= r.cw && r.izq === 0, '[124] a ' + innerWidth + ' px, con la cinta esperando su entrada, la ficha no se corre de costado',
     `scrollWidth ${r.sw} / clientWidth ${r.cw}, corrida ${r.corrida}, scrollLeft ${r.izq}`);
  ok(r.ox === 'clip' && r.oy === 'visible', '[124] la cinta recorta solo a lo ancho (clip): el levante y la sombra del mouse no se cortan',
     r.ox + ' / ' + r.oy);
  quitarFicha();
}
// El caso real era el celular: a 390 px, en un iframe (Chrome sin ventana no baja de 500)
async function fichaSinCorrerseEnElCelular(){
  const f = document.createElement('iframe');
  f.style.cssText = 'width:390px;height:844px;border:0;position:absolute;left:-9999px;top:0';
  f.src = 'index.html';
  document.body.appendChild(f);
  try{
    await new Promise(r => { f.onload = r; });
    const W = f.contentWindow;
    let listo = false;
    for(let i = 0; i < 150 && !listo; i++){
      try{ listo = W.eval('MODELOS.length') > 0; }catch(e){}
      if(!listo) await dormirB7(200);
    }
    if(!listo){ nota('[124] el catalogo del iframe de 390 px no llego a cargar'); return; }
    FRENOS_B7.forEach(n => { try{ W[n](); }catch(e){} });
    const k = W.eval('(() => { const m = MODELOS.find(m => relacionados(m).length >= 2) || MODELOS.find(m => relacionados(m).length); return m ? clave(m.rep) : ""; })()');
    if(!k){ nota('[124] hoy ningun modelo tiene sugeridos'); return; }
    W.abrirFicha(k, null);
    await dormirB7(400);
    const esperaba = !W.document.querySelector('#ficha .fi-rel').classList.contains('vis');
    const r = medirEspera(W.document);
    ok(r.sw <= r.cw && r.izq === 0, '[124] a 390 px la ficha tampoco se corre de costado' + (esperaba ? ' (la cinta todavia no habia entrado)' : ''),
       `scrollWidth ${r.sw} / clientWidth ${r.cw}, corrida ${r.corrida}, scrollLeft ${r.izq}`);
    FRENOS_B7.forEach(n => { try{ W[n](); }catch(e){} });
    try{ W.quitarFicha(); }catch(e){}
  }finally{ f.remove(); }
}

/* ---- [127] Con "reducir movimiento" no late ni salta nada ----
   Chrome sin ventana no deja pedirlo desde la pagina: se simula reescribiendo
   las @media de prefers-reduced-motion (reduce pasa a valer siempre y
   no-preference nunca) y al final se dejan como estaban. Lo que decide el
   script con matchMedia (quieto) no cambia: esto mira el CSS. */
function simularMenosMovimiento(){
  const cambios = [];
  const rec = lista => [...lista].forEach(r => {
    if(r instanceof CSSMediaRule){
      const t = r.media.mediaText;
      const n = t.replace(/\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/g, '(min-width: 0px)')
                 .replace(/\(\s*prefers-reduced-motion\s*:\s*no-preference\s*\)/g, '(max-width: 0px)');
      if(n !== t){ cambios.push([r, t]); r.media.mediaText = n; }
      rec(r.cssRules);
    }
  });
  [...document.styleSheets].forEach(h => { try{ rec(h.cssRules); }catch(e){} });
  return () => cambios.forEach(([r, t]) => { r.media.mediaText = t; });
}
/* El punto que late, armado para la prueba (29/09). El del sello lleva .live
   solo cuando ADVAPP confirma una carga de hoy (textoDelSello): los sabados,
   los domingos o con la planilla de respaldo no hay ningun .dot.live, y
   medir el de verdad reventaba la tanda y se salteaba el resto de [127]. Lo
   que se mira es el CSS, asi que alcanza uno igual, dentro del .stamp (para
   que le toque cualquier regla que mire ahi) y despues del real, que es el
   que agarran sello() y error(). Como el .skeleton, se saca al terminar. */
const puntoVivoB7 = () => {
  const d = document.createElement('span');
  d.className = 'dot live';
  d.setAttribute('aria-hidden', 'true');
  (document.querySelector('.stamp') || document.body).appendChild(d);
  return d;
};
const sinFinB7 = () => document.getAnimations()
  .filter(a => a instanceof CSSAnimation && a.effect.getComputedTiming().iterations === Infinity)
  .map(a => { const el = a.effect.target; return a.animationName + ' en ' + (el ? el.tagName.toLowerCase() + [...el.classList].map(c => '.' + c).join('') : '?') + (a.effect.pseudoElement || ''); });
async function reducirMovimiento(){
  aLaPortadaB7();
  await dormirB7(300);
  const restaurar = simularMenosMovimiento();
  try{
    await dormirB7(200);
    const portada = sinFinB7();
    ok(!portada.length, '[127] en la portada no queda ninguna animacion sin fin', [...new Set(portada)].join(' | ') || 'ninguna');
    const punto = puntoVivoB7();
    const late = getComputedStyle(punto).animationName;
    punto.remove();
    ok(late === 'none', '[127] el punto de "Actualizado" no late', late);
    const sk = document.createElement('div');
    sk.className = 'skeleton';
    document.getElementById('grid').appendChild(sk);
    ok(getComputedStyle(sk).animationName === 'none', '[127] el esqueleto de la carga queda quieto', getComputedStyle(sk).animationName);
    sk.remove();

    const cat = document.querySelector('#mosaico .rubro')?.dataset.cat;
    if(cat){
      entrarAlRubro(cat);
      await dormirB7(500);
      const rubro = sinFinB7();
      ok(!rubro.length, '[127] adentro de ' + cat + ' tampoco', [...new Set(rubro)].join(' | ') || 'ninguna');
    }
    const m = conSugeridosB7();
    if(m){
      abrirFicha(clave(m.rep), null);
      await dormirB7(300);
      const ficha = sinFinB7();
      ok(!ficha.length, '[127] ni con la ficha abierta', [...new Set(ficha)].join(' | ') || 'ninguna');
      quitarFicha();
    }

    // El Primo: la regla del topetazo pesa mas que #egg .frase span
    mostrarEgg('<p class="saludo">x</p><p class="frase"><span>El Primo</span></p><p class="gameplay">y</p>', 'primo', 60000,
               '<div class="egg-escena"><div class="egg-sway"><img class="egg-fig" alt=""></div></div>');
    await dormirB7(100);
    const span = document.querySelector('#egg.primo .frase span');
    ok(!!span && getComputedStyle(span).animationName === 'none', '[127] El Primo entra sin el topetazo (zoom de 2,4x con giro)',
       span ? getComputedStyle(span).animationName : 'sin egg');
    const moviles = ['#egg', '#egg .saludo', '#egg .frase', '#egg .gameplay', '#egg > div', '.egg-escena', '.egg-sway', '.egg-fig']
      .filter(s => document.querySelector(s) && getComputedStyle(document.querySelector(s)).animationName !== 'none');
    ok(!moviles.length, '[127] ni el resto del egg (entrada, baile, sacudon)', moviles.join(', ') || 'todo quieto');
    document.getElementById('egg')?.click();
  }finally{
    restaurar();
  }
  // Y sin simular, siguen animando: la guarda no apago todo de mas
  const sk2 = document.createElement('div');
  sk2.className = 'skeleton';
  document.getElementById('grid').appendChild(sk2);
  const punto2 = puntoVivoB7();
  if(matchMedia('(prefers-reduced-motion: no-preference)').matches)
    ok(getComputedStyle(punto2).animationName === 'pulse' && getComputedStyle(sk2).animationName === 'sk',
       '[127] sin "reducir movimiento" el punto late y el esqueleto brilla, como siempre',
       getComputedStyle(punto2).animationName + ' / ' + getComputedStyle(sk2).animationName);
  punto2.remove();
  sk2.remove();
  aLaPortadaB7();
}

/* ---- [133] Saltar al catalogo ---- */
async function saltarAlCatalogo(){
  aLaPortadaB7();
  await dormirB7(200);
  const saltar = document.getElementById('saltar'), main = document.getElementById('catalogo');
  ok(!!saltar && !!main && main.tagName === 'MAIN' && main.tabIndex === -1 && saltar.getAttribute('href') === '#catalogo',
     '[133] hay un "Saltar al catalogo" que lleva al <main> (#catalogo, enfocable)');
  if(!saltar || !main) return;
  const enfocables = [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')]
    .filter(el => !el.disabled && el.tabIndex >= 0 && !el.closest('[hidden]') &&
                  getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden');
  ok(enfocables[0] === saltar, '[133] es lo primero que agarra el Tab', enfocables[0] && (enfocables[0].id || enfocables[0].className));
  ok(saltar.getBoundingClientRect().bottom <= 0, '[133] sin foco no se ve (queda arriba, fuera de la pantalla)',
     Math.round(saltar.getBoundingClientRect().bottom));
  saltar.focus();
  const r = saltar.getBoundingClientRect();
  ok(r.top >= 0 && r.bottom <= innerHeight && r.width > 60, '[133] con el foco aparece', `${Math.round(r.top)}-${Math.round(r.bottom)}, ${Math.round(r.width)} px`);
  const barra = document.querySelector('.barra-cats');
  ok(barra.tagName === 'NAV' && !!barra.getAttribute('aria-label'), '[133] la cinta de rubros es una zona con nombre (nav)',
     barra.tagName + ' ' + barra.getAttribute('aria-label'));

  const probar = async donde => {
    scrollTo(0, 0);
    await dormirB7(50);
    const url = location.href, largo = history.length;
    saltar.focus();
    saltar.click();
    await dormirB7(100);
    const top = main.getBoundingClientRect().top, bajo = barra.getBoundingClientRect().bottom;
    ok(document.activeElement === main, '[133] ' + donde + ': el foco queda en el catalogo',
       document.activeElement && (document.activeElement.id || document.activeElement.tagName));
    ok(top >= bajo - 1 && top <= bajo + 40, '[133] ' + donde + ': baja hasta el catalogo y la cinta pegada arriba no lo tapa',
       `main en ${Math.round(top)}, cinta hasta ${Math.round(bajo)}`);
    ok(location.href === url && history.length === largo, '[133] ' + donde + ': sin #catalogo en la direccion ni una entrada de mas en el historial',
       location.href.replace(location.origin, ''));
  };
  await probar('en la portada');
  ok(enPortada(), '[133] y la portada sigue siendo la portada');
  const cat = document.querySelector('#mosaico .rubro')?.dataset.cat;
  if(cat){
    entrarAlRubro(cat);
    await dormirB7(400);
    await probar('adentro de ' + cat);
    ok(filtros.cat === cat && !enPortada(), '[133] y sigue adentro del rubro', filtros.cat);
  }
  aLaPortadaB7();
}

/* ---- [204] El titulo de la pestaña dice que se esta mirando ---- */
async function tituloDeLaPestana(){
  aLaPortadaB7();
  const og = document.querySelector('meta[property="og:title"]').content;
  ok(document.title === 'Catálogo Advance Tecno — Los precios de hoy', '[204] en la portada, el titulo de siempre', document.title);
  const cat = document.querySelector('#mosaico .rubro')?.dataset.cat;
  if(!cat){ nota('[204] no hay rubros en el mosaico'); return; }
  entrarAlRubro(cat);
  await dormirB7(200);
  ok(document.title.startsWith(plural(cat) + ' · '), '[204] adentro de un rubro, el rubro', document.title);

  const m = LISTA.find(x => x.variantes && x.variantes.length > 1) || LISTA[0];
  abrirFicha(clave(m.rep), null);
  await dormirB7(200);
  const nombre = document.querySelector('#ficha .fi-nombre').textContent.trim();
  const marca = document.querySelector('#ficha .fi-marca').textContent.trim();
  ok(document.title.includes(nombre) && (!marca || document.title.startsWith(marca)),
     '[204] con la ficha abierta, la marca y el nombre que dice la ficha', document.title + ' | ficha: ' + marca + ' ' + nombre);
  pintar();              // lo que hace el refresco de cada 5 minutos
  ok(document.title.includes(nombre), '[204] un refresco con la ficha abierta no le pisa el nombre', document.title);
  const otra = m.variantes.find(x => clave(x) !== FICHA);
  if(otra){
    elegirVariante(document.getElementById('ficha'), m, otra);
    const n2 = document.querySelector('#ficha .fi-nombre').textContent.trim();
    ok(document.title.includes(n2), '[204] al cambiar de version sigue diciendo lo mismo que la ficha', document.title + ' | ' + n2);
  }
  quitarFicha();
  ok(document.title.startsWith(plural(cat) + ' · '), '[204] al cerrarla vuelve al rubro, no al de la portada', document.title);

  irAlMenu();
  filtros.q = 'iphone'; pintar();
  ok(/“iphone”/.test(document.title), '[204] con una busqueda, lo buscado', document.title);
  filtros.q = ''; aLaPortadaB7();
  ok(document.title === 'Catálogo Advance Tecno — Los precios de hoy', '[204] y de vuelta en la portada, el de siempre', document.title);
  ok(document.querySelector('meta[property="og:title"]').content === og, '[204] lo que se ve al compartir el link (og:title) no se toca', og);
}
