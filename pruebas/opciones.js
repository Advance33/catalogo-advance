// Los botones de "Opciones" de la ficha, uno por VERSION (17/09/2026). El
// proveedor carga cada color en su propia fila, y la ficha del iPhone 17 Pro
// Max mostraba "256GB E-Sim · Orange", "· Blue" y "· Silver": tres botones de
// la misma version, al mismo precio. Ahora van en uno solo y el color se elige
// con los puntitos, que llevan a la fila de ese color con su precio.
//
// Sin nombres fijos: los casos se buscan en los productos del dia.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };

const esperar = setInterval(() => {
  if(!MODELOS.length || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperar);
  for(let i=1;i<5000;i++) clearInterval(i);
  try{ correrPruebas(); }catch(e){ R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; }
  try{ cerrarFicha(); }catch(e){}
  try{ pararPaseos(); }catch(e){}
  try{ pararOfertas(); }catch(e){}
  for(let i=1;i<5000;i++) clearInterval(i);
  const pre=document.createElement('pre'); pre.id='RESULTADO';
  pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
  document.body.appendChild(pre);
}, 150);

const versionesDe = m => {
  const mapa = new Map();
  m.variantes.forEach(v => { if(!mapa.has(v.opcion)) mapa.set(v.opcion, []); mapa.get(v.opcion).push(v); });
  return mapa;
};
const colores = v => partirColores(v.color).map(norm).filter(Boolean);
const botones = () => [...document.querySelectorAll('#ficha .fi-op')];
const texto = b => b.textContent.replace(/\s+/g, ' ').trim();

function correrPruebas(){
  PEDIDO = []; guardarPedido();
  const multi = MODELOS.filter(m => m.multi);

  /* ---- 1. En todas las fichas: un boton por version y ninguno repetido ---- */
  const malContados = [], repetidos = [];
  multi.forEach(m => {
    abrirFicha(clave(m.rep), null);
    const n = versionesDe(m).size;
    const bs = botones();
    if(bs.length !== (n > 1 ? n : 0)) malContados.push(m.desc + ': ' + bs.length + ' botones para ' + n + ' versiones');
    const textos = bs.map(b => b.querySelector('b').textContent.trim());
    if(new Set(textos).size !== textos.length) repetidos.push(m.desc + ': ' + textos.join(' / '));
    cerrarFicha();
  });
  ok(!malContados.length, 'cada ficha tiene un boton por version', malContados.slice(0, 3).join(' | ') || multi.length + ' fichas');
  ok(!repetidos.length, 'ningun boton dice lo mismo que otro', repetidos.slice(0, 3).join(' | ') || 'ninguno');

  /* ---- 2. Lo que se junta es seguro ---- */
  const inseguros = [];
  multi.forEach(m => versionesDe(m).forEach((grupo, op) => {
    if(grupo.length < 2) return;
    const todos = grupo.flatMap(colores);
    if(grupo.some(v => !colores(v).length) || new Set(todos).size !== todos.length)
      inseguros.push(m.desc + ' / ' + op + ': un color en dos filas');
    if(new Set(grupo.map(v => norm(v.teclado))).size > 1)
      inseguros.push(m.desc + ' / ' + op + ': distinto teclado');
    if(new Set(grupo.map(v => norm(v.etiquetaBase))).size > 1)
      inseguros.push(m.desc + ' / ' + op + ': distinta version');
  }));
  ok(!inseguros.length, 'solo se juntan filas de la misma version, con cada color en una sola fila y el mismo teclado',
     inseguros.slice(0, 3).join(' | ') || 'todas');

  const juntas = [];
  multi.forEach(m => versionesDe(m).forEach((grupo, op) => { if(grupo.length > 1) juntas.push({ m, op, grupo }); }));
  R.push('  --  ' + juntas.length + ' version(es) con varias filas de color en un solo boton');
  if(!juntas.length) return;

  /* ---- 3. El boton de una version junta: su precio y la fila que abre ---- */
  const conPrecios = juntas.find(j => new Set(j.grupo.map(v => v.precio)).size > 1) || null;
  const mismoPrecio = juntas.find(j => new Set(j.grupo.map(v => v.precio)).size === 1) || null;
  for(const [caso, esperado] of [[conPrecios, 'desde USD '], [mismoPrecio, 'USD ']]){
    if(!caso) continue;
    abrirFicha(clave(caso.m.rep), null);
    const b = botones().find(x => x.dataset.op === caso.op);
    const minimo = Math.min(...caso.grupo.map(v => v.precio).filter(x => x !== null));
    if(b) ok(texto(b).endsWith(esperado + plata(minimo)) && (esperado === 'USD ' ? !/desde/.test(texto(b)) : true),
             esperado === 'USD ' ? 'con todos los colores al mismo precio, el boton dice ese precio'
                                 : 'con colores a distinto precio, el boton dice "desde"',
             caso.m.desc + ': ' + texto(b));
    cerrarFicha();
  }

  /* ---- 4. Los puntitos llevan a la fila de su color ---- */
  const j = conPrecios || juntas[0];
  const a = j.grupo[0], b = j.grupo[1];
  abrirFicha(clave(a), null);
  const miBoton = botones().find(x => x.dataset.op === j.op);
  ok(miBoton && miBoton.getAttribute('aria-pressed') === 'true', 'la version abierta queda marcada', j.m.desc + ' / ' + j.op);
  const punto = [...document.querySelectorAll('#ficha .fi-pintas button')].find(x => x.dataset.k === clave(b));
  ok(!!punto, 'entre los colores estan los de las otras filas de la version', colores(b).join('/'));
  if(punto){
    punto.click();
    ok(FICHA === clave(b), 'tocar ese color pasa a su fila', FICHA + ' (' + b.color + ')');
    ok(document.querySelector('#ficha .fi-precio .usd').textContent.includes(b.precio === null ? 'Consultar' : plata(b.precio)),
       'con su precio', document.querySelector('#ficha .fi-precio .usd').textContent.trim());
    const sigue = botones().find(x => x.dataset.op === j.op);
    ok(sigue && sigue.getAttribute('aria-pressed') === 'true', 'y el boton de la version sigue marcado');
    document.querySelector('#ficha #fi-pedido').click();
    ok(PEDIDO.length === 1 && PEDIDO[0].k === clave(b), 'el pedido guarda la fila del color elegido', JSON.stringify(PEDIDO));
    PEDIDO = []; guardarPedido(); pintarPedido();
  }
  cerrarFicha();

  /* ---- 5. Cambiar de version mantiene el color, si la otra lo tiene ---- */
  let probado = false;
  for(const { m, op, grupo } of juntas){
    for(const [otraOp, otro] of versionesDe(m)){
      if(otraOp === op) continue;
      const comun = grupo.flatMap(colores).find(c => otro.flatMap(colores).includes(c));
      if(!comun) continue;
      const desde = grupo.find(v => colores(v).includes(comun));
      abrirFicha(clave(desde), null);
      const p = [...document.querySelectorAll('#ficha .fi-pintas button')].find(x => norm(x.dataset.color) === comun);
      if(p) p.click();
      const boton = botones().find(x => (x.dataset.op || x.querySelector('b').textContent.trim()) === otraOp);
      if(!boton){ cerrarFicha(); continue; }
      boton.click();
      const ahora = buscarProducto(FICHA);
      ok(ahora && ahora.opcion === otraOp && colores(ahora).includes(comun) && norm(COLOR_FICHA) === comun,
         'al pasar a otra version se queda con el color elegido', m.desc + ': ' + op + ' -> ' + otraOp + ' en ' + comun);
      cerrarFicha();
      probado = true;
      break;
    }
    if(probado) break;
  }
  if(!probado) R.push('  --  ninguna version junta comparte color con otra version: no se prueba el cambio de version');

  /* ---- 6. Dos filas que cambian de teclado no se juntan, y el boton lo dice ---- */
  const teclado = [];
  multi.forEach(m => {
    const porBase = new Map();
    m.variantes.forEach(v => { const k = norm(v.etiquetaBase); if(!porBase.has(k)) porBase.set(k, []); porBase.get(k).push(v); });
    porBase.forEach(g => {
      if(g.length > 1 && new Set(g.map(v => norm(v.teclado))).size > 1) teclado.push({ m, g });
    });
  });
  if(teclado.length){
    const mal = teclado.filter(({ g }) => new Set(g.map(v => v.opcion)).size !== g.length ||
                                        g.some(v => v.teclado && !/teclado/i.test(v.opcion)));
    ok(!mal.length, 'las versiones que cambian de teclado van separadas y el boton nombra el teclado',
       mal.map(({ m, g }) => m.desc + ': ' + g.map(v => v.opcion).join(' / ')).join(' | ') ||
       teclado.map(({ g }) => g.map(v => v.opcion).join(' / ')).join(' | '));
  }else{
    R.push('  --  hoy no hay versiones que cambien solo de teclado');
  }

  /* ---- 7. La tarjeta cuenta versiones ---- */
  const soloColor = MODELOS.find(m => m.multi && versionesDe(m).size === 1);
  if(soloColor) ok(htmlOpciones(soloColor) === '', 'un modelo que solo cambia de color no muestra opciones en la tarjeta', soloColor.desc);
  const conVarias = juntas.find(x => versionesDe(x.m).size > 1);
  if(conVarias){
    const t = htmlOpciones(conVarias.m);
    const n = versionesDe(conVarias.m).size;
    ok(t.includes(n + ' opciones') || t.split(' · ').length === n, 'y uno con varias versiones las cuenta por version, no por fila',
       conVarias.m.desc + ': ' + t);
  }
}
