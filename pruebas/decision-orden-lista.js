// El orden de la lista y la marca 🔥 (Pedro, 03/10/2026).
//
//   · "que el orden en la pagina sea correlativo (leyes de como se envian las
//     listas, que aplique lo mismo aca)": ADVAPP manda en la columna Orden el
//     lugar de cada modelo en la lista de WhatsApp (contrato landing/1.4), y
//     adentro de cada marca la grilla va en ese orden.
//   · Promo = destacado: la marca 🔥 en la tarjeta, sin ningun precio (el
//     inflado de la "ficticia" de las listas no se publica), y en la vidriera
//     despues de las bajas reales.
//
// Mientras el feed no traiga las columnas (ADVAPP sin el PR #32), la pagina
// anda como antes; por eso ademas se prueba con un orden puesto a mano.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);

const esperar = setInterval(() => {
  if(!MODELOS.length || !FUENTE || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperar);
  for(let i=1;i<5000;i++) clearInterval(i);
  try{ correrPruebas(); }catch(e){ R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; }
  try{ pararPaseos(); pararOfertas(); pararMundos(); }catch(e){}
  for(let i=1;i<5000;i++) clearInterval(i);
  const pre=document.createElement('pre'); pre.id='RESULTADO';
  pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
  document.body.appendChild(pre);
}, 150);

const limpiar = () => Object.assign(filtros, { q:'', cat:'', marca:'', rango:'', capacidad:'', ram:'', montura:'', apertura:'', soloStock:false, orden:'modelo' });

function correrPruebas(){
  probarLasColumnas();
  probarElOrdenDelFeed();
  probarElOrdenAMano();
  probarLaMarca();
  limpiar();
}

/* ---- Las columnas ---- */
function probarLasColumnas(){
  ok(PRODUCTOS.every(p => (p.orden === null || p.orden > 0) && typeof p.destacado === 'boolean'),
     'cada fila trae orden (numero o nada) y destacado (si/no)');
  ok(MODELOS.every(m => (m.orden === null || m.orden > 0) && typeof m.destacado === 'boolean'),
     'cada modelo tambien: el orden del primero de sus filas y destacado si alguna lo es');
  const conOrden = PRODUCTOS.filter(p => p.orden).length, dest = PRODUCTOS.filter(p => p.destacado).length;
  info('hoy: ' + conOrden + ' filas con Orden, ' + dest + ' destacadas (contrato ' + (FUENTE.contrato || '?') + ')');
  const m = MODELOS.find(x => x.variantes.length > 1 && x.variantes.some(v => v.orden));
  if(m) ok(m.orden === Math.min(...m.variantes.filter(v => v.orden).map(v => v.orden)),
           'el orden del modelo es el menor de sus filas', m.desc + ' #' + m.orden);
}

/* ---- Con el Orden del feed: adentro de cada marca, correlativo ---- */
function probarElOrdenDelFeed(){
  if(!PRODUCTOS.some(p => p.orden)){ info('el feed todavia no trae Orden: se prueba solo con el orden a mano'); return; }
  const mal = [];
  for(const cat of [...new Set(MODELOS.map(m => m.cat))]){
    limpiar(); filtros.cat = cat;
    const l = filtrar();
    for(let i = 1; i < l.length; i++){
      const a = l[i - 1], b = l[i];
      if(norm(a.marca) !== norm(b.marca) || a.stock !== b.stock || !a.orden || !b.orden) continue;
      if(b.orden < a.orden) mal.push(cat + ': ' + a.desc + ' #' + a.orden + ' antes que ' + b.desc + ' #' + b.orden);
    }
  }
  ok(!mal.length, 'en cada rubro y marca, los modelos van en el orden de la lista (con stock y sin stock aparte)', mal.slice(0, 3).join(' | ') || 'todos los rubros');
}

/* ---- Con un orden puesto a mano: el de la lista le gana al nombre ---- */
function probarElOrdenAMano(){
  // La marca con mas modelos con stock de un rubro; se le pone un orden al reves del alfabetico
  limpiar();
  const porMarca = new Map();
  MODELOS.filter(m => m.stock).forEach(m => { const k = m.cat + '|' + norm(m.marca); porMarca.set(k, [...(porMarca.get(k) || []), m]); });
  const grupo = [...porMarca.values()].sort((a, b) => b.length - a.length)[0];
  if(!grupo || grupo.length < 3){ info('no hay una marca con tres modelos con stock: no se prueba a mano'); return; }
  const guardado = new Map(grupo.map(m => [m, m.orden]));
  try{
    const alfa = [...grupo].sort((a, b) => norm(a.desc).localeCompare(norm(b.desc), 'es'));
    alfa.forEach((m, i) => { m.orden = alfa.length - i; });   // Z primero, A ultimo
    filtros.cat = grupo[0].cat; filtros.marca = grupo[0].marca;
    const l = filtrar().filter(m => grupo.includes(m));
    const nums = l.map(m => m.orden);
    ok(nums.every((n, i) => !i || n >= nums[i - 1]), 'con Orden, la marca va en ese orden y no por el nombre', l.map(m => m.desc + ' #' + m.orden).slice(0, 4).join(' · '));
    // Un modelo sin Orden va despues de los que tienen
    const ultimo = alfa[alfa.length - 1];
    ultimo.orden = null;
    const l2 = filtrar().filter(m => grupo.includes(m));
    ok(l2[l2.length - 1] === ultimo, 'sin Orden, al final de su marca (por nombre)', l2[l2.length - 1] && l2[l2.length - 1].desc);
    filtros.orden = 'asc';
    const l3 = filtrar().filter(m => grupo.includes(m) && m.precio !== null);
    ok(l3.every((m, i) => !i || porPrecioOk(l3[i - 1], m)), 'si el cliente pide «menor precio», manda el precio y no el Orden');
  } finally {
    grupo.forEach(m => { m.orden = guardado.get(m); });
  }
}
const porPrecioOk = (a, b) => (a.precio || 0) <= (b.precio || 0);

/* ---- La marca 🔥 ---- */
function probarLaMarca(){
  const m = MODELOS.find(x => x.stock && x.precio !== null);
  const sin = MODELOS.find(x => !x.stock);
  const antes = m.destacado, antesSin = sin && sin.destacado;
  try{
    m.destacado = true;
    const t = tarjeta(m);
    const chip = t.querySelector('.marca .destacado');
    ok(!!chip && chip.textContent === '🔥 Destacado', 'destacado y con stock: la tarjeta lleva «🔥 Destacado» al lado de la marca', chip && chip.textContent);
    ok(!/\$|USD|\d\s?%/.test(chip ? chip.textContent : ''), 'la marca no trae ningun precio ni porcentaje');
    m.destacado = false;
    ok(!tarjeta(m).querySelector('.destacado'), 'sin promo, sin marca');
    if(sin){ sin.destacado = true; ok(!tarjeta(sin).querySelector('.destacado'), 'sin stock no se destaca'); }
    // La vidriera: primero las bajas reales, despues los destacados, despues los regalos
    m.destacado = true;
    const ofs = ofertas();
    const pos = x => ofs.indexOf(x);
    const baja = ofs.filter(x => enOferta(x)), dest = ofs.filter(x => !enOferta(x) && x.destacado), reg = ofs.filter(x => !enOferta(x) && !x.destacado);
    ok(baja.every(x => dest.every(y => pos(x) < pos(y) || VIDRIERA_FIJOS.length)) && dest.every(x => reg.every(y => pos(x) < pos(y))),
       'en la vidriera: bajas reales, despues destacados, despues regalos', ofs.slice(0, 5).map(x => x.desc + (enOferta(x) ? ' (baja)' : x.destacado ? ' (🔥)' : '')).join(' · '));
  } finally {
    m.destacado = antes;
    if(sin) sin.destacado = antesSin;
  }
}
