// Elegir la version en la ficha. El proveedor carga cada color en su propia
// fila, y la ficha del iPhone 17 Pro Max mostraba "256GB E-Sim · Orange",
// "· Blue" y "· Silver": tres botones de la misma version, al mismo precio.
// Van en uno solo y el color se elige en la tira de al lado de la foto, que
// lleva a la fila de ese color con su precio (17/09/2026).
//
// Desde el 21/09 la version se elige en DOS pasos: primero la memoria y
// despues, adentro de esa memoria, la version. Asi que ya no hay "un boton por
// version" a la vista: lo que se prueba es que a TODAS las versiones se pueda
// llegar, y que dos pestañas del mismo eje nunca digan lo mismo.
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
// Las pestañas de memoria llevan data-mem; las de version, no. Importa para
// mirar precios: la de memoria muestra el de TODA la memoria, no el de una.
const deVersion = () => botones().filter(b => !b.dataset.mem);
const texto = b => b.textContent.replace(/\s+/g, ' ').trim();

/* Llegar a una version desde la ficha recien abierta: si su pestaña esta a la
   vista, un toque; si esta en otra memoria, primero la pestaña de esa memoria
   y despues la suya. Devuelve el boton, o null si no se llega. */
function irAVersion(op){
  let d = document.getElementById('ficha');
  let b = [...d.querySelectorAll('.fi-op')].find(x => x.dataset.op === op);
  if(b) return b;
  const mm = memoriaDeOpcion(op);
  const tab = [...d.querySelectorAll('.fi-ops[data-eje="memoria"] .fi-op')]
                .find(x => x.dataset.mem === mm);
  if(!tab) return null;
  tab.click();
  d = document.getElementById('ficha');
  return [...d.querySelectorAll('.fi-op')].find(x => x.dataset.op === op) || null;
}

function correrPruebas(){
  PEDIDO = []; guardarPedido();
  const multi = MODELOS.filter(m => m.multi);

  /* ---- 1. A todas las versiones se llega, y ninguna pestaña se repite ----
     El recorte de la etiqueta ("256GB Sim" -> "Sim") es lo que puede fallar:
     si dos versiones quedan diciendo lo mismo, el cliente ve dos pestañas
     iguales con precios distintos y no tiene como saber cual es cual. */
  const sueltas = [], repetidos = [];
  multi.forEach(m => {
    const vs = versionesDe(m);
    for(const [op, grupo] of vs){
      abrirFicha(clave(m.rep), null);
      const d = document.getElementById('ficha');
      let llega = !!irAVersion(op);
      if(!llega){
        // Las versiones que son un color se eligen en la tira, no en pestañas
        const ks = new Set([...d.querySelectorAll('.fi-pintas button')].map(x => x.dataset.k));
        llega = grupo.some(v => ks.has(clave(v)));
      }
      if(!llega) sueltas.push(m.desc + ' / ' + op);
      cerrarFicha();
    }
    abrirFicha(clave(m.rep), null);
    document.querySelectorAll('#ficha .fi-ops').forEach(caja => {
      const t = [...caja.querySelectorAll('.fi-op b')].map(b => b.textContent.trim());
      if(new Set(t).size !== t.length)
        repetidos.push(m.desc + ' [' + caja.dataset.eje + ']: ' + t.join(' / '));
    });
    cerrarFicha();
  });
  ok(!sueltas.length, 'a todas las versiones se llega: por pestaña o por la tira de colores',
     sueltas.slice(0, 3).join(' | ') || multi.length + ' fichas');
  ok(!repetidos.length, 'ninguna pestaña dice lo mismo que otra del mismo eje',
     repetidos.slice(0, 3).join(' | ') || 'ninguna');

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
    irAVersion(caso.op);   // puede vivir en otra memoria
    // Solo del eje de version: la pestaña de memoria muestra el precio de toda
    // la memoria, que puede ser mas barato que el de esta version.
    let b = deVersion().find(x => x.dataset.op === caso.op);
    /* Si es la unica version de su memoria no tiene pestaña propia: la de la
       memoria es la suya, y entonces ese precio SI es el de esta version. */
    if(!b) b = botones().find(x => x.dataset.mem === memoriaDeOpcion(caso.op) &&
                                   x.dataset.op === caso.op);
    if(!b) R.push('  --  ' + caso.m.desc + ': ' + caso.op + ' no llega a tener pestaña');
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
      const boton = irAVersion(otraOp);
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

  /* ---- 7. Las pestañas salen por VERSION, no por fila ----
     Desde el 17/09 la tarjeta no las lista: era texto chico que nadie leia.
     Y desde el 21/09 la ficha las reparte en dos ejes, asi que la cuenta ya no
     es "una por version": lo que no puede pasar es que una fila de color se
     cuele como pestaña propia. La cuenta que si vale: nunca mas pestañas que
     versiones. */
  const conVarias = juntas.find(x => versionesDe(x.m).size > 1);
  if(conVarias){
    const m = conVarias.m;
    abrirFicha(clave(m.rep));
    const bs = [...document.querySelectorAll('#ficha .fi-ops .fi-op')];
    ok(bs.length > 0 && bs.length <= versionesDe(m).size,
       'las pestañas salen por version y nunca son mas que las versiones',
       m.desc + ': ' + bs.length + ' pestañas, ' + versionesDe(m).size + ' versiones, ' +
       m.variantes.length + ' filas');
    const dup = juntas.find(j => j.m === m) || conVarias;
    ok(!bs.some(b => dup.grupo.slice(1).some(v => b.dataset.k === clave(v) && b.dataset.op !== dup.op)),
       'y ninguna pestaña es una fila de color de otra version');
    quitarFicha();
  }
  const soloColor = MODELOS.find(m => m.multi && versionesDe(m).size === 1);
  if(soloColor){
    abrirFicha(clave(soloColor.rep));
    ok(!document.querySelector('#ficha .fi-ops'),
       'y un modelo que solo cambia de color no muestra versiones', soloColor.desc);
    quitarFicha();
  }
}
