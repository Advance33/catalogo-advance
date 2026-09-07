// Notas de carga en el nombre del producto. La planilla trae cosas que son
// para adentro -"+ Capa" es funda en portugués, "C/C" es con cargador, "CAJA
// BLANCA" es que viene sin caja- y el cliente las lee tal cual.
//
// El catálogo las saca al cargar y las manda a donde van. Se limpia acá y no
// sólo en la planilla porque la carga diaria la reescribe desde la lista del
// proveedor: arreglar la celda de hoy no alcanza para mañana.
//
// Se prueban las dos cosas: la función con casos armados, que no dependen de
// lo que traiga la planilla del día, y el catálogo entero, que es lo que ve
// el cliente.
const R = [];
let fallas = 0;
const ok = (c, txt, extra) => { R.push((c?'  OK  ':'FALLA ') + txt + (extra!==undefined?('  ['+extra+']'):'')); if(!c) fallas++; };
const reportar = () => {
  const pre = document.createElement('pre');
  pre.id = 'RESULTADO';
  pre.textContent = '\n===== ' + (fallas ? fallas + ' FALLA(S)' : 'TODO OK') + ' =====\n' + R.join('\n');
  document.body.appendChild(pre);
};

const esperar = setInterval(() => {
  if(!MODELOS.length) return;
  clearInterval(esperar);
  for(let i = 1; i < 5000; i++) clearInterval(i);
  try{ correrPruebas(); }catch(e){ R.push('EXCEPCION: ' + (e && e.stack || e)); fallas++; }
  try{ pararPaseos(); }catch(e){}
  try{ pararOfertas(); }catch(e){}
  for(let i = 1; i < 5000; i++) clearInterval(i);
  reportar();
}, 120);

function correrPruebas(){
  /* ---- 1. La lista existe ----
     Si alguien la vacía, el catálogo deja de limpiar y nadie se entera: las
     notas vuelven al nombre en silencio. */
  ok(Array.isArray(NOTAS_DEL_NOMBRE) && NOTAS_DEL_NOMBRE.length > 0,
     'hay una lista de notas para sacar del nombre',
     (NOTAS_DEL_NOMBRE || []).length + ' patrones');
  ok((NOTAS_DEL_NOMBRE || []).every(n => n.busca instanceof RegExp && n.que),
     'cada nota dice qué busca y qué es');

  /* ---- 2. La funcion, con casos armados ---- */
  const capa = sacarNotasDelNombre({ desc: 'Galaxy Tab S10 (X400) + Capa (Gray)', incluye: '' });
  ok(!/capa/i.test(capa.desc), 'saca "+ Capa" del nombre', capa.desc);
  ok(/funda/i.test(capa.incluye || ''), 'y lo manda a Incluye como funda', capa.incluye);
  ok(/\(gray\)/i.test(capa.desc), 'sin llevarse por delante el color que venía al lado');

  const repe = sacarNotasDelNombre({ desc: 'Tablet + Capa', incluye: '+ Cargador + Funda' });
  ok((String(repe.incluye).match(/funda/gi) || []).length === 1,
     'no repite lo que Incluye ya decía', repe.incluye);

  const carg = sacarNotasDelNombre({ desc: 'iPhone 15 128GB C/C', incluye: '' });
  ok(!/c\/c/i.test(carg.desc), 'saca el "C/C" del nombre', carg.desc);
  ok(/cargador/i.test(carg.incluye || ''), 'y avisa que viene con cargador', carg.incluye);

  const caja = sacarNotasDelNombre({ desc: 'MacBook Air M4 CAJA BLANCA', incluye: '', condicion: '' });
  ok(!/caja blanca/i.test(caja.desc), 'saca "CAJA BLANCA" del nombre', caja.desc);
  ok(/caja blanca/i.test(caja.condicion || ''),
     'y lo pone en Condición, que es lo que le importa al cliente', caja.condicion);
  ok(!/caja/i.test(caja.incluye || ''), 'y no lo ofrece como si fuera un regalo');

  const batt = sacarNotasDelNombre({ desc: 'Drone DJI Mini 5 Pro 4 BATT', incluye: '' });
  ok(!/batt/i.test(batt.desc), 'saca las baterías del nombre', batt.desc);
  ok(/4/.test(batt.incluye || ''), 'y se acuerda de cuántas eran', batt.incluye);

  const limpio = sacarNotasDelNombre({ desc: 'iPhone 17 Pro 256GB (Orange)', incluye: '+ Cargador 20W' });
  ok(limpio.desc === 'iPhone 17 Pro 256GB (Orange)', 'un nombre sin notas queda igual');
  ok(limpio.incluye === '+ Cargador 20W', 'y su Incluye tampoco se toca');

  /* ---- 3. El catalogo de hoy ---- */
  const todos = MODELOS.flatMap(m => m.variantes || [m]);
  const sucios = todos.filter(v => NOTAS_DEL_NOMBRE.some(n => n.busca.test(v.desc || '')));
  ok(!sucios.length, 'ningún producto muestra una nota de carga en el nombre',
     sucios.length ? sucios.slice(0, 3).map(v => v.id + ': ' + v.desc).join(' | ')
                   : todos.length + ' productos');
}
