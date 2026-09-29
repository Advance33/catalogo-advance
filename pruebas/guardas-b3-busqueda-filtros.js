// Guardas de la tanda B3, busqueda y filtros (auditoria del 29/09/2026). Cada
// bloque es un error que se encontro y se arreglo: si vuelve, falla aca. El
// numero entre corchetes es el del hallazgo.
//
//  [54] "celulares", "camaras", "objetivos" daban 0 (el desplegable ofrecia
//       el rubro y la grilla decia "No encontramos nada").
//  [55] "notebook", "lente", "tablet", "smartwatch": el renombre de rubros
//       los habia sacado del buscador.
//  [67] "rayban", "usbc", "macmini", "f1.8", "ps5", "a7 iv", "teclado espanol".
//  [26] El codigo propio AT-#### no se encontraba.
//  [57] Filtros combinados que se cumplian en variantes distintas.
//  [64] La RAM escrita "16GB/1TB" no se leia (filtro, ficha y validar.py).
//  [56] La apertura leia la F de "RF"/"EF" (21 Canon luminosos como Estandar).
//  [77] La montura "EF CANON" dada vuelta quedaba sin montura.
//  [71] "Hasta USD 200" dejaba afuera el de 200 justos.
//  [63] "Todo el catalogo" en el orden de IDs de ADVAPP (Airtag primero).
//  [61] Cambiar de rubro dejaba pegada una busqueda que ahi da 0.
//  [62] Una marca que no es del rubro quedaba puesta sin verse.
//  [65] Capacidad y memoria no viajaban en el link.
//  [75] Un link con "?cat=celular" se ignoraba.
//  [76] El chip "Todo" (codigo muerto): que siga volviendo a la portada.
//  [205] La barra ofrecia rubros sin stock. Y desde que no los ofrece, uno
//        abierto desde la vitrina de marcas o con el Atras quedaba sin
//        ningun chip marcado (29/09).
//  [68] Sugerencias sin relevancia ("ipad pro" daba teclados primero).
//  [72] El desplegable sin el "desde" de la tarjeta.
//  [73] "/" con la ficha abierta mandaba el foco atras del dialogo.
//  [59] Escape al cerrar una ventana borraba ademas la busqueda.
//  [74] Roles ARIA del buscador y del menu de orden que no se cumplian.
//  [120] El foco del teclado caia en BODY al elegir marca, orden o rubro.
//  [134] El lector de pantalla no se enteraba de cuantos resultados hubo.
//  [128] En el celular, el buscador cerrado recibia el foco sin verse.
//  [198] Un link filtrado abria sin una sola tarjeta en la primera pantalla.
//
// Sin numeros fijos: los casos se buscan en los datos del dia, y donde hoy no
// hay ninguno se dice y se sigue. Lo que se toca (filtros, URL) se deja como
// estaba al terminar cada bloque. [198] y [128] abren la pagina de nuevo en
// iframes (390 y 1440 px), como layout.js.
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

const esperaB3 = setInterval(() => {
  if(!MODELOS.length || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperaB3);
  for(let i = 1; i < 5000; i++) clearInterval(i);
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: ' + (e && e.stack || e)); fallas++; })
    .then(() => {
      try{ cerrarFicha(); }catch(e){}
      try{ pararPaseos(); }catch(e){}
      try{ pararOfertas(); }catch(e){}
      try{ pararMundos(); }catch(e){}
      for(let i = 1; i < 5000; i++) clearInterval(i);
      reportar();
    });
}, 120);

const dormirB3 = ms => new Promise(r => setTimeout(r, ms));
const VACIOS_B3 = { q:'', cat:'', marca:'', orden:ORDEN_DEF, soloStock:false, rango:'', montura:'', apertura:'', capacidad:'', ram:'' };
const URL_B3 = location.pathname + location.search;
// Con los filtros de `f` y nada mas, sin tocar la pantalla
function conB3(f, hacer){
  const antes = { ...filtros };
  Object.assign(filtros, VACIOS_B3, f);
  try{ return hacer(); } finally { Object.assign(filtros, antes); }
}
const buscarB3 = (q, f = {}) => conB3({ ...f, q }, () => filtrar());
// Deja la pagina como recien abierta: portada, sin filtros, buscador cerrado
function limpiarB3(){
  try{ cerrarSug(); }catch(e){}
  Object.assign(filtros, VACIOS_B3);
  $('q').value = ''; $('clear').hidden = true;
  verTodo = false;
  cerrarMenusOrden();
  cerrarBuscador();
  try{ history.replaceState(null, '', URL_B3); }catch(e){}
  sincronizarControles();
  pintar();
}
const cabB3 = () => $('rubro-cab');
const chipB3 = c => [...$('cats').querySelectorAll('.chip:not(.clon)')].find(b => (b.dataset.cat || '') === c);
const tecla = (el, key) => { const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }); el.dispatchEvent(e); return e; };
const conStockB3 = () => [...new Set(MODELOS.filter(m => m.stock).map(m => m.cat))];

async function correrPruebas(){
  const bloques = [plurales, aliasDeRubro, formasDeEscribir, codigoAT, filtrosJuntos, memoriaEnTB,
                   apertura, montura, tramos, ordenTodo, rubroSueltaBusqueda, marcaAjena, linkConCapacidad,
                   linkEnMinusculas, chipTodo, barraConStock, rubroSinStockPorOtroCamino, relevancia, desdeEnDesplegable,
                   barraConFicha, escape, aria, foco, anuncio, iframes];
  for(const b of bloques){
    try{ await b(); }
    catch(e){ R.push('EXCEPCION en ' + b.name + ': ' + (e && e.stack || e)); fallas++; }
    try{ limpiarB3(); }catch(e){}
  }
}

/* ---- [54] El plural trae lo mismo que el singular ---- */
function plurales(){
  const cats = [...new Set(MODELOS.map(m => m.cat))];
  const mal = [];
  cats.forEach(c => {
    const s = buscarB3(norm(c)), p = buscarB3(norm(plural(c)));
    const afuera = MODELOS.filter(m => m.cat === c && !p.includes(m)).length;
    if(afuera || s.length !== p.length || s.some(m => !p.includes(m)))
      mal.push(`"${norm(plural(c))}" ${p.length} contra ${s.length} en singular${afuera ? ', ' + afuera + ' del rubro afuera' : ''}`);
  });
  ok(!mal.length, '[54] cada rubro en plural trae lo mismo que en singular, y el rubro entero',
     mal.slice(0, 3).join(' · ') || cats.length + ' rubros');
  // La pantalla no se contradice: sugiere el rubro y la grilla dice "nada"
  const contradice = conStockB3().filter(c => {
    const q = norm(plural(c));
    return candidatosSug(q).cats.includes(c) && !buscarB3(q).length;
  });
  ok(!contradice.length, '[54] ningun plural ofrece el rubro arriba con la grilla vacia atras', contradice.join(', ') || 'ninguno');
  // Combinado con una marca: "celulares samsung"
  const m = MODELOS.find(x => x.marca && norm(plural(x.cat)) !== norm(x.cat));
  if(m){
    const q = norm(plural(m.cat)) + ' ' + norm(m.marca);
    ok(buscarB3(q).includes(m), '[54] el plural con una marca tambien encuentra', q);
  }
  // Lo que NO tiene que ensanchar: palabras con numeros o signos, y el
  // singular tiene que terminar palabra ("keys" no trae los "keyboard")
  const idEs = PRODUCTOS.map(p => norm(p.id)).find(id => /\d/.test(id) && /s$/.test(id));
  if(idEs){
    const r = buscarB3(idEs);
    ok(r.every(x => henoDe(x).includes(idEs)), '[54] un ID terminado en "s" no se achica (el teclado ES no trae el EN)', idEs + ' -> ' + r.length);
  }
  const malPal = ['keys', 'gris', 'af-s', 'plus'].filter(w =>
    buscarB3(w).some(x => !henoDe(x).includes(w) &&
      !new RegExp(w.slice(0, -1).replace(/[-]/g, '\\-') + '(?![a-z0-9])').test(henoDe(x))));
  ok(!malPal.length, '[54] "keys", "gris", "af-s": el singular solo cuenta si termina palabra', malPal.join(', ') || 'bien');
}

/* ---- [55] Los rubros renombrados se encuentran por su nombre de siempre ---- */
function aliasDeRubro(){
  const casos = [['MacBook','notebook'], ['MacBook','laptop'], ['Objetivo','lente'], ['Objetivo','lentes canon'],
                 ['iPad','tablet'], ['Apple Watch','smartwatch'], ['Apple Watch','reloj'], ['Smartwatch','reloj'],
                 ['Gafas Inteligentes','anteojos']];
  const mal = [], probados = [];
  casos.forEach(([cat, q]) => {
    let del = MODELOS.filter(m => m.cat === cat);
    if(/ /.test(q)) del = del.filter(m => norm(m.marca) === q.split(' ')[1]);
    if(!del.length) return;
    probados.push(q);
    const r = buscarB3(q);
    const faltan = del.filter(m => !r.includes(m));
    if(faltan.length) mal.push(`"${q}" deja afuera ${faltan.length} de ${del.length} ${cat}`);
  });
  ok(!mal.length, '[55] "notebook", "lente", "tablet", "smartwatch", "reloj"... traen su rubro entero',
     mal.slice(0, 3).join(' · ') || probados.join(', '));
  // No depende de que ADVAPP siga escribiendo "Lente": con "Objetivo" tambien
  const obj = MODELOS.find(m => m.cat === 'Objetivo');
  if(obj){
    const copia = { ...obj, catPlanilla: 'Objetivo' };
    ok(coincide(copia, prepararBusqueda('lente')), '[55] "lente" sigue encontrando aunque ADVAPP escriba "Objetivo"');
  }
  // El desplegable tambien ofrece el rubro por su alias
  if(conStockB3().includes('MacBook'))
    ok(candidatosSug('notebook').cats.includes('MacBook'), '[55] "notebook" ofrece el rubro MacBook arriba');
}

/* ---- [67] Palabras pegadas, guion, barra y formas cortas ---- */
function formasDeEscribir(){
  const tienen = re => MODELOS.filter(m => re.test(henoDe(m)));
  const faltan = (q, lista) => { const r = buscarB3(q); return lista.filter(m => !r.includes(m)); };
  const casos = [
    ['rayban',  MODELOS.filter(m => norm(m.marca) === 'ray-ban')],
    ['usbc',    tienen(/usb-c/)],
    ['macmini', tienen(/\bmac mini\b/)],
    ['f1.8',    tienen(/f\/1[.,]8\b/)],
    ['ps5',     tienen(/\bplay ?station ?5\b/)],
    ['alpha 7', tienen(/\balfa ?7/)],
    ['a7 iv',   tienen(/\balfa ?7 iv\b/)],
  ];
  const mal = [], vistos = [];
  casos.forEach(([q, lista]) => {
    if(!lista.length) return;
    vistos.push(q + ' ' + lista.length);
    const f = faltan(q, lista);
    if(f.length) mal.push(`"${q}" deja afuera ${f.length} de ${lista.length} (${f[0].desc})`);
  });
  ok(!mal.length, '[67] "rayban", "usbc", "macmini", "f1.8", "ps5", "a7 iv" encuentran lo escrito de otra forma',
     mal.slice(0, 3).join(' · ') || vistos.join(', '));
  // Compactar NO puede meter palabras nuevas: "garmin instinct" tiene "mini" adentro
  const mini = buscarB3('mini').filter(m => !henoDe(m).includes('mini'));
  ok(!mini.length, '[67] "mini" no trae nada que no diga "mini" (no se compacta el texto entero)',
     mini.map(m => m.desc).slice(0, 3).join(', ') || 'bien');
  // El teclado solo donde es un teclado: el SKU de las Nikon dice "-tecladoen"
  const camaras = buscarB3('teclado').filter(m => /c[aá]mara/i.test(m.cat));
  ok(!camaras.length, '[67] "teclado" no lista camaras', camaras.map(m => m.desc).slice(0, 3).join(', ') || 'ninguna');
  const mbEs = MODELOS.find(m => m.cat === 'MacBook' && m.variantes.some(v => /espa/i.test(nombreTeclado(v.teclado))));
  if(mbEs) ok(buscarB3('teclado español').includes(mbEs), '[67] "teclado español" encuentra el MacBook que lo tiene', mbEs.desc);
  else nota('[67] hoy no hay MacBook con teclado español para probar');
}

/* ---- [26] El codigo propio AT-#### ---- */
function codigoAT(){
  const con = MODELOS.filter(m => m.codigo && /^AT-\d{4}$/i.test(m.codigo)).slice(0, 6);
  if(!con.length){ nota('[26] hoy ningun modelo tiene codigo AT'); return; }
  const mal = [];
  con.forEach(m => {
    const c = m.codigo;
    [c, c.toLowerCase(), c.replace('-', '').toLowerCase()].forEach(q => {
      if(!buscarB3(q).includes(m)) mal.push(q + ' no trae ' + m.desc);
    });
  });
  ok(!mal.length, '[26] buscar el codigo AT (con o sin guion, en minusculas) trae su modelo', mal.slice(0, 3).join(' · ') || con.length + ' codigos');
  const conVar = MODELOS.find(m => m.variantes.some(v => /^AT-\d{4}-\d{2}/i.test(v.codigoVar || '')));
  if(conVar){
    const cv = conVar.variantes.map(v => v.codigoVar).find(x => /^AT-\d{4}-\d{2}/i.test(x || '')).split('/')[0].trim();
    ok(buscarB3(cv).includes(conVar), '[26] tambien el codigo de variante AT-####-NN', cv);
  }
  const conStock = con.find(m => m.stock);
  if(conStock) ok(candidatosSug(conStock.codigo).prods.includes(conStock), '[26] y el desplegable lo sugiere', conStock.codigo);
  // Los numeros cortos no se llenan de codigos: "50" y "35" son focales
  const ruido = ['50', '35', '15', '17', '85'].filter(n => buscarB3(n).some(m => !henoDe(m).includes(n)));
  ok(!ruido.length, '[26] buscar "50", "35", "15" no trae productos por el numero de su codigo', ruido.join(', ') || 'bien');
}

/* ---- [57] Todo lo pedido, en la MISMA variante ---- */
function filtrosJuntos(){
  const cumple = (v, f) => (!f.soloStock || v.stock) &&
    (!f.capacidad || capacidadDe(v) === f.capacidad) && (!f.ram || ramDe(v) === f.ram) &&
    (!f.rango || enTramo(v.precio, RANGOS.find(r => r[0] === f.rango)));
  let combos = 0; const mal = [];
  CATS_CON_CAPACIDAD.filter(c => MODELOS.some(m => m.cat === c)).forEach(cat => {
    const opciones = conB3({ cat }, () => ({
      capacidad: valoresDe('capacidad'), ram: valoresDe('ram'),
      rango: RANGOS.map(r => r[0]), soloStock: [true] }));
    const campos = Object.keys(opciones);
    for(let i = 0; i < campos.length; i++) for(let j = i + 1; j < campos.length; j++){
      opciones[campos[i]].forEach(a => opciones[campos[j]].forEach(b => {
        const f = { cat, [campos[i]]: a, [campos[j]]: b };
        const r = conB3(f, () => filtrar());
        if(!r.length) return;
        combos++;
        r.forEach(m => { if(!m.variantes.some(v => cumple(v, f))) mal.push(`${cat} ${a}+${b}: ${m.desc}`); });
      }));
    }
  });
  ok(!mal.length, '[57] con dos filtros de version, cada resultado tiene UNA variante que cumple los dos',
     mal.slice(0, 3).join(' · ') || combos + ' combinaciones');
  // Y el que si cumple no se pierde: cada variante entra con sus propios datos
  const perdidos = [];
  MODELOS.filter(m => CATS_CON_CAPACIDAD.includes(m.cat)).forEach(m => m.variantes.forEach(v => {
    const cap = capacidadDe(v), ram = ramDe(v), r = RANGOS.find(x => enTramo(v.precio, x));
    if(!cap || !ram || !r) return;
    const f = { cat: m.cat, capacidad: cap, ram, rango: r[0] };
    const vale = conB3({ cat: m.cat }, () => valoresDe('capacidad').includes(cap) && valoresDe('ram').includes(ram));
    if(vale && !conB3(f, () => filtrar()).includes(m)) perdidos.push(`${m.desc} ${ram}/${cap} ${r[0]}`);
  }));
  ok(!perdidos.length, '[57] ninguna variante real se pierde con su capacidad + memoria + precio', perdidos.slice(0, 3).join(' · ') || 'ninguna');
}

/* ---- [64] La RAM con el disco en TB ---- */
function memoriaEnTB(){
  const r = d => ramDe({ desc: d });
  ok(r('Galaxy S25 Ultra 16GB/1TB') === '16GB' && r('MacBook Pro M5 Max 16" 36GB/2TB') === '36GB'
     && r('MacBook Air 24GB/1,5TB') === '24GB',
     '[64] ramDe lee "16GB/1TB" y "36GB/2TB"', [r('Galaxy S25 Ultra 16GB/1TB'), r('MacBook Pro M5 Max 16" 36GB/2TB')].join(','));
  ok(r('Galaxy A56 12/256GB') === '12GB' && r('Mac Mini M4 16GB/256GB') === '16GB' && r('iPhone 17 256GB') === null,
     '[64] y lo de antes sigue igual', [r('Galaxy A56 12/256GB'), r('Mac Mini M4 16GB/256GB'), r('iPhone 17 256GB')].join(','));
  const s = specs({ desc: 'Galaxy S26 Ultra 16GB/1TB' });
  ok(s.includes('16GB RAM') && s.includes('1TB') && !s.some(x => /TBGB|GBGB/.test(x)),
     '[64] la ficha del S26 Ultra 16GB/1TB dice "16GB RAM" y "1TB"', s.join(', '));
  ok(capacidadDe({ desc: 'Galaxy S25 Ultra 16GB/1TB' }) === '1TB', '[64] la capacidad sigue siendo 1TB');
  const sinRam = PRODUCTOS.filter(p => /\d{1,2}\s*GB\s*\/\s*\d(?:[.,]\d)?\s*TB/i.test((p.desc || '') + ' ' + (p.modelo || '')) && !ramDe(p));
  ok(!sinRam.length, '[64] ninguna fila "NNGB/NTB" de hoy queda sin RAM', sinRam.map(p => p.id).slice(0, 3).join(', ') || 'ninguna');
  // El panel ofrece cada RAM que aparece en los nombres del rubro
  const faltan = [];
  CATS_CON_CAPACIDAD.forEach(cat => {
    const vals = conB3({ cat }, () => valoresDe('ram'));
    if(!vals.length) return;
    const todas = [...new Set(MODELOS.filter(m => m.cat === cat).flatMap(m => m.variantes.map(ramDe)).filter(Boolean))];
    todas.filter(x => !vals.includes(x)).forEach(x => faltan.push(cat + ' ' + x));
  });
  ok(!faltan.length, '[64] el panel Memoria ofrece todas las RAM del rubro', faltan.slice(0, 4).join(', ') || 'todas');
  // validar.py toma la expresion de specs() y no la primera "const dual"
  const src = document.documentElement.outerHTML;
  const ini = src.indexOf('function specs(');
  const m = /const dual\s*=\s*\/(.+?)\/[gimsuy]*\.exec/.exec(src.slice(ini));
  ok(ini >= 0 && m && new RegExp(m[1], 'i').test('16GB/1TB'),
     '[64] la expresion de specs() que lee validar.py entiende "16GB/1TB"');
}

/* ---- [56] La apertura no lee la F de RF/EF ---- */
function apertura(){
  const a = modelo => aperturaDe({ cat: 'Objetivo', modelo });
  const casos = [['RF 50 F1,8 STM', 'luminoso'], ['RF 45 F/1.2', 'luminoso'], ['EF 24-70 F/2.8 II', 'luminoso'],
                 ['RF 100-400 F/5.6-8 IS USM', 'cerrado'], ['AF-S 50 F/1.8G', 'luminoso'], ['FE 85 F/1.4 GM', 'luminoso'],
                 ['RF 1.4X EXTENDER', ''], ['Z TELECONVERTER TC-2X', '']];
  const mal = casos.filter(([n, e]) => a(n) !== e).map(([n, e]) => `${n}: ${a(n) || '(nada)'} y es ${e || '(nada)'}`);
  ok(!mal.length, '[56] la apertura sale de la F que empieza palabra, no de "RF 50"', mal.join(' · ') || casos.length + ' casos');
  const tele = MODELOS.filter(m => m.cat === 'Objetivo' && /extender|teleconverter/i.test(m.modelo || m.desc) && m.apertura);
  ok(!tele.length, '[56] ningun extender o teleconversor tiene apertura', tele.map(m => m.desc).join(', ') || 'ninguno');
}

/* ---- [77] La montura dada vuelta ---- */
function montura(){
  const mo = modelo => monturaDe({ cat: 'Objetivo', modelo });
  ok(mo('85MM F/1,4 DG HSM ART EF CANON') === 'Canon EF' && mo('18-50 F/2.8 DC DN CONTEMPORARY CANON RF') === 'Canon RF'
     && mo('RF 50 F1,8 STM') === 'Canon RF',
     '[77] "... ART EF CANON" es Canon EF, y lo de antes sigue', mo('85MM F/1,4 DG HSM ART EF CANON') || '(nada)');
}

/* ---- [71] Los tramos incluyen el tope ---- */
function tramos(){
  const mal = [];
  RANGOS.forEach((r, i) => {
    if(isFinite(r[3])){
      if(!enTramo(r[3], r)) mal.push(r[1] + ' no incluye ' + r[3]);
      if(RANGOS[i + 1] && enTramo(r[3], RANGOS[i + 1])) mal.push(r[3] + ' cae tambien en ' + RANGOS[i + 1][1]);
    }
  });
  if(!enTramo(0, RANGOS[0])) mal.push('el 0 no cae en el primero');
  if(RANGOS.some(r => enTramo(null, r))) mal.push('un "Consultar" cae en un tramo');
  ok(!mal.length, '[71] "Hasta USD 200" incluye el 200, y cada precio cae en un solo tramo', mal.join(' · ') || 'bien');
  const cuenta = [];
  datosPresupuesto().forEach(t => {
    const n = conB3({ rango: t.val }, () => filtrar().length);
    if(n !== t.n) cuenta.push(`${t.val}: dice ${t.n} y la grilla ${n}`);
  });
  ok(!cuenta.length, '[71] "Cuanto queres gastar" cuenta lo mismo que la grilla', cuenta.join(' · ') || 'igual');
  const enBorde = PRODUCTOS.filter(p => RANGOS.some(r => isFinite(r[3]) && p.precio === r[3]));
  const fuera = enBorde.filter(p => {
    const r = RANGOS.find(x => x[3] === p.precio);
    const m = MODELOS.find(x => x.variantes.includes(p));
    return m && !conB3({ rango: r[0] }, () => filtrar()).includes(m);
  });
  ok(!fuera.length, '[71] los de precio justo en el tope aparecen en ese tramo', fuera.map(p => p.id).slice(0, 3).join(', ') || enBorde.length + ' filas en un tope');
}

/* ---- [63] "Todo el catalogo" en el orden de la barra, no de los IDs ---- */
function ordenTodo(){
  const l = conB3({}, () => filtrar());
  const conSt = l.filter(m => m.stock);
  const esperado = conStockB3().sort(ordenCat)[0];
  ok(l[0] && l[0].cat === esperado, '[63] "Todo" arranca por el primer rubro de la barra con stock', (l[0] && l[0].cat) + ' / ' + esperado);
  const desorden = conSt.findIndex((m, i) => i && ordenCat(conSt[i - 1].cat, m.cat) > 0);
  ok(desorden < 0, '[63] los rubros siguen el orden de ORDEN_CATS', desorden < 0 ? 'bien' : conSt[desorden - 1].cat + ' antes que ' + conSt[desorden].cat);
  const dest = MARCA_DESTACADA['Celular'];
  const bloque = conSt.filter(m => m.cat === 'Celular');
  if(dest && bloque.some(m => m.marca === dest))
    ok(bloque[0].marca === dest, '[63] en "Todo" el bloque de Celulares abre con ' + dest, bloque[0].marca);
  // Adentro de un rubro, las marcas en el orden de sus botones
  const cat = conStockB3().sort(ordenCat).find(c => new Set(MODELOS.filter(m => m.cat === c).map(m => m.marca)).size > 2);
  if(cat){
    const [lista, botones] = conB3({ cat }, () => [filtrar(), marcasDisponibles().map(x => x[0])]);
    const rango = m => botones.indexOf(m.marca);
    const saltos = [true, false].map(st => lista.filter(m => m.stock === st))
      .filter(g => g.some((m, i) => i && rango(g[i - 1]) > rango(m)));
    ok(!saltos.length, '[63] en ' + cat + ' las marcas de la grilla van en el orden de los botones', botones.join(' > '));
  }
}

/* ---- [61] Cambiar de rubro suelta una busqueda que ahi da 0 ---- */
function rubroSueltaBusqueda(){
  const chips = [...$('cats').querySelectorAll('.chip:not(.clon)')].map(b => b.dataset.cat).filter(Boolean);
  const palabra = ['iphone', 'galaxy', 'canon', 'sony'].find(w => buscarB3(w).length && chips.some(c => !buscarB3(w, { cat: c }).length));
  if(!palabra){ nota('[61] hoy no hay una palabra que de 0 en otro rubro'); return; }
  const destino = chips.find(c => !buscarB3(palabra, { cat: c }).length);
  $('q').value = palabra; filtros.q = palabra; sincronizarControles(); aplicarFiltro(false);
  chipB3(destino).click();
  ok(filtros.cat === destino && filtros.q === '' && $('q').value === '' && LISTA.length > 0,
     '[61] con "' + palabra + '" buscado, tocar ' + destino + ' suelta la busqueda y muestra el rubro', 'q="' + filtros.q + '", ' + LISTA.length);
  limpiarB3();
  // Pero si en el rubro nuevo si hay, se queda: buscar "sony" y achicar a un rubro
  const cats = chips.filter(c => buscarB3('sony', { cat: c }).length);
  if(cats.length >= 2){
    $('q').value = 'sony'; filtros.q = 'sony'; sincronizarControles(); aplicarFiltro(false);
    chipB3(cats[1]).click();
    ok(filtros.q === 'sony' && LISTA.length > 0, '[61] con "sony" y ' + cats[1] + ' la busqueda se queda', LISTA.length);
  }
}

/* ---- [62] Una marca que no es del rubro se suelta ---- */
function marcaAjena(){
  const cats = conStockB3();
  let caso = null;
  for(const c of cats){
    const b = MODELOS.find(m => m.stock && m.cat !== c && m.marca && !MODELOS.some(x => x.cat === c && x.marca === m.marca));
    if(b){ caso = [c, b.marca]; break; }
  }
  if(!caso){ nota('[62] hoy no hay una marca ajena a algun rubro'); return; }
  const [cat, marca] = caso;
  // Por la sugerencia de rubro del buscador
  filtros.marca = marca; aplicarFiltro(false);
  const q = norm(plural(cat));
  $('q').value = q; filtros.q = q; sincronizarControles(); pintarSug();
  const sug = $('q-sug').querySelector(`.qs-cat[data-cat="${CSS.escape(cat)}"]`);
  if(sug){
    sug.click();
    ok(filtros.cat === cat && filtros.marca === '' && LISTA.length > 0,
       '[62] con ' + marca + ' puesta, la sugerencia "' + plural(cat) + '" la suelta', LISTA.length);
  }else nota('[62] "' + q + '" no sugirio el rubro');
  limpiarB3();
  // Por un link escrito a mano
  history.replaceState(null, '', location.pathname + '?cat=' + encodeURIComponent(cat) + '&marca=' + encodeURIComponent(marca));
  leerURL(); armarFiltros(); pintar();
  ok(filtros.cat === cat && filtros.marca === '' && !/[?&]marca=/.test(location.search),
     '[62] un link ?cat=' + cat + '&marca=' + marca + ' abre el rubro sin la marca, y la direccion lo dice', location.search);
  limpiarB3();
  // Red de seguridad: si igual queda puesta, se ve con su cruz
  filtros.cat = cat; filtros.marca = marca; verTodo = false; pintar();
  ok(!!cabB3().querySelector('[data-quitar="marca"]'), '[62] una marca puesta que no esta entre los botones se muestra con su cruz');
  // Desde el 29/09 (3.2 B) el vacio dice "En X no hay nada de <marca>" y
  // "Sin ese filtro hay N", con el boton "Quitar": ya no "Probá sacando alguno
  // de los filtros". Lo que se cuida es lo mismo: que no culpe a las palabras.
  ok(/filtro/.test(grid.textContent) && !/menos palabras/.test(grid.textContent),
     '[62] y la grilla vacia dice que son los filtros, no "menos palabras"', grid.textContent.trim().slice(0, 60));
}

/* ---- [65] Capacidad y memoria viajan en el link ---- */
function linkConCapacidad(){
  const cat = CATS_CON_CAPACIDAD.find(c => conB3({ cat: c }, () => valoresDe('capacidad').length && valoresDe('ram').length));
  if(!cat){ nota('[65] hoy ningun rubro tiene capacidad y memoria para elegir'); return; }
  const [cap, ram] = conB3({ cat }, () => [valoresDe('capacidad')[0], valoresDe('ram')[0]]);
  Object.assign(filtros, { cat, capacidad: cap, ram });
  const u = urlActual();
  ok(u.includes('capacidad=' + encodeURIComponent(cap)) && u.includes('ram=' + encodeURIComponent(ram)),
     '[65] el link lleva la capacidad y la memoria', u);
  history.replaceState(null, '', u);
  Object.assign(filtros, VACIOS_B3);
  leerURL(); armarFiltros();
  ok(filtros.cat === cat && filtros.capacidad === cap && filtros.ram === ram, '[65] y al abrirlo vuelven', filtros.capacidad + ' ' + filtros.ram);
  limpiarB3();
  history.replaceState(null, '', location.pathname + '?capacidad=256GB');
  leerURL(); armarFiltros(); pintar();
  ok(filtros.capacidad === '' && enPortada() && !/capacidad=/.test(location.search),
     '[65] sin rubro, una capacidad del link se descarta y queda la portada', location.search || '(sin parametros)');
}

/* ---- [75] Un link en minusculas o sin tilde ---- */
function linkEnMinusculas(){
  const cel = MODELOS.find(m => m.cat === 'Celular' && m.marca);
  const cam = MODELOS.find(m => m.cat === 'Cámara');
  if(cel){
    history.replaceState(null, '', location.pathname + '?cat=celular&marca=' + encodeURIComponent(cel.marca.toLowerCase()));
    leerURL(); armarFiltros(); pintar();
    ok(filtros.cat === 'Celular' && filtros.marca === cel.marca && LISTA.length > 0 && LISTA.every(m => m.marca === cel.marca),
       '[75] "?cat=celular&marca=' + cel.marca.toLowerCase() + '" abre los celulares de esa marca', LISTA.length);
    ok(/cat=Celular/.test(location.search), '[75] y la direccion queda escrita bien', location.search);
    limpiarB3();
  }
  if(cam){
    history.replaceState(null, '', location.pathname + '?cat=CAMARA');
    leerURL(); armarFiltros();
    ok(filtros.cat === 'Cámara', '[75] "?cat=CAMARA" (sin tilde) abre Camaras', filtros.cat || '(nada)');
  }
}

/* ---- [76] El chip "Todo" vuelve a la portada ---- */
function chipTodo(){
  const c = conStockB3()[0];
  chipB3(c).click();
  ok(filtros.cat === c && !enPortada(), '[76] tocar un rubro lo abre', c);
  chipB3('').click();
  ok(enPortada() && !verTodo && filtros.cat === '', '[76] y el chip "Todo" vuelve a la portada');
}

/* ---- [205] La barra ofrece solo rubros con stock ---- */
function barraConStock(){
  const chips = [...new Set([...$('cats').querySelectorAll('.chip')].map(b => b.dataset.cat).filter(Boolean))];
  const conSt = conStockB3();
  const deMas = chips.filter(c => !conSt.includes(c)), faltan = conSt.filter(c => !chips.includes(c));
  ok(!deMas.length && !faltan.length, '[205] los chips de la barra son los rubros con stock',
     (deMas.length ? 'de mas: ' + deMas.join(', ') : '') + (faltan.length ? ' faltan: ' + faltan.join(', ') : '') || chips.length + ' rubros');
  const mosaico = mundosDeLaPortada().flatMap(w => w.rubros);
  ok(chips.length === mosaico.length && chips.every(c => mosaico.includes(c)), '[205] y son los mismos que ofrece la portada');
  const sin = [...new Set(PRODUCTOS.map(p => p.cat))].find(c => !conSt.includes(c));
  if(!sin){ nota('[205] hoy todos los rubros tienen stock'); return; }
  history.replaceState(null, '', location.pathname + '?cat=' + encodeURIComponent(sin));
  leerURL(); FIRMA_FILTROS = ''; armarFiltros(); pintar();
  const chip = chipB3(sin);
  ok(filtros.cat === sin && chip && chip.getAttribute('aria-pressed') === 'true',
     '[205] un link a un rubro sin stock (' + sin + ') lo abre igual, con su chip marcado', filtros.cat);
  limpiarB3();
  FIRMA_FILTROS = ''; armarFiltros();
}

/* ---- [205] Un rubro sin stock abierto por otro camino tambien queda marcado (29/09) ----
   La barra trae los rubros con stock mas el elegido en el momento de armarla,
   pero se arma al cargar y no al elegir. La vitrina de marcas ofrecia rubros
   sin stock (Canon > Accesorios Camara, Microsoft > Accesorios Gaming,
   Kieslect > Smartwatches) y el Atras podia volver a una entrada ?cat= de
   uno: el rubro se abria sin ningun chip marcado, ni siquiera "Todo". */
async function rubroSinStockPorOtroCamino(){
  const conSt = conStockB3();
  const deMas = datosMarcas().flatMap(x => x.cats.filter(([c]) => !conSt.includes(c)).map(([c]) => x.marca + ': ' + c));
  ok(!deMas.length, '[205] la vitrina de marcas no ofrece rubros sin stock', deMas.join(' | ') || 'ninguno');
  const sin = [...new Set(MODELOS.map(m => m.cat))].find(c => !conSt.includes(c));
  if(!sin){ nota('[205] hoy todos los rubros tienen stock: no se prueba entrar a uno sin stock'); return; }
  const marca = (MODELOS.find(m => m.cat === sin) || {}).marca || '';
  const apretados = () => [...$('cats').querySelectorAll('.chip:not(.clon)[aria-pressed="true"]')].map(b => b.dataset.cat || 'Todo');
  const soloElSuyo = () => { const a = apretados(); return a.length === 1 && a[0] === sin; };
  try{
    // 1. entrarAlRubro, el camino de la vitrina de marcas (y del mosaico)
    limpiarB3(); FIRMA_FILTROS = ''; armarFiltros();
    entrarAlRubro(sin, marca);
    ok(filtros.cat === sin && soloElSuyo(),
       '[205] entrando a ' + sin + ' (' + marca + ') con entrarAlRubro, su chip queda marcado', apretados().join(',') || 'ninguno');
    // 2. El Atras hacia una entrada ?cat= de un rubro sin stock que la barra ya no tiene
    limpiarB3(); FIRMA_FILTROS = ''; armarFiltros();
    history.pushState(null, '', location.pathname + '?cat=' + encodeURIComponent(sin));
    chipB3(conSt[0]).click();
    ok(filtros.cat === conSt[0] && !chipB3(sin), '[205] (de ahi a ' + conSt[0] + ', con la barra sin el chip de ' + sin + ')', filtros.cat);
    history.back();
    await dormirB3(400);
    ok(filtros.cat === sin && soloElSuyo(),
       '[205] volviendo con el Atras a ?cat=' + sin + ', su chip queda marcado', filtros.cat + ' · ' + (apretados().join(',') || 'ninguno'));
  }finally{
    limpiarB3();
    FIRMA_FILTROS = ''; armarFiltros();
  }
}

/* ---- [68] Lo que mas se parece va primero en el desplegable ---- */
function relevancia(){
  const sug = q => candidatosSug(q).prods;
  const stock = MODELOS.filter(m => m.stock);
  const tit = m => norm(m.titulo || m.desc);
  if(stock.some(m => tit(m).startsWith('ipad pro'))){
    const p = sug('ipad pro')[0];
    ok(p && tit(p).startsWith('ipad pro'), '[68] "ipad pro" sugiere primero un iPad Pro', p && p.desc);
  }else nota('[68] hoy no hay iPad Pro con stock');
  const marcas = ['sony', 'canon', 'nikon', 'apple', 'samsung'].filter(b => stock.some(m => norm(m.marca) === b));
  const malM = marcas.filter(b => { const p = sug(b)[0]; return !p || norm(p.marca) !== b; });
  ok(!malM.length, '[68] buscar una marca sugiere primero algo de esa marca', malM.map(b => b + ': ' + (sug(b)[0] || {}).desc).join(' · ') || marcas.join(', '));
  const conMini = stock.filter(m => /(^|[^a-z0-9])mini/.test(tit(m)) && !/^accesorio/.test(norm(m.cat)));
  if(conMini.length >= 3){
    const acc = sug('mini').slice(0, 3).filter(m => /^accesorio/.test(norm(m.cat)));
    ok(!acc.length, '[68] "mini": ningun accesorio entre los 3 primeros', acc.map(m => m.desc).join(', ') || 'bien');
  }
  // El accesorio sigue primero cuando se lo busca a el
  const acc = stock.find(m => /^accesorio/.test(norm(m.cat)) && /^[a-z]{5,}/.test(tit(m)));
  if(acc){
    const w = tit(acc).split(/\s+/)[0];
    const p = sug(w)[0];
    ok(p && tit(p).startsWith(w), '[68] buscar el nombre de un accesorio lo sugiere primero', w + ' -> ' + (p && p.desc));
  }
}

/* ---- [72] El desplegable dice "desde" cuando la tarjeta lo dice ---- */
function desdeEnDesplegable(){
  const multi = MODELOS.find(m => m.stock && m.multi && m.precio !== null && m.precio !== m.precioMax);
  if(!multi){ nota('[72] hoy no hay un modelo con stock y varios precios'); return; }
  const q = norm(multi.desc).split(/\s+/).slice(0, 2).join(' ');
  $('q').value = q; filtros.q = q; sincronizarControles(); pintarSug();
  const mal = [...$('q-sug').querySelectorAll('.qs[data-key]')].filter(b => {
    const m = buscarModelo(b.dataset.key);
    const debe = m && m.multi && m.precio !== null && m.precio !== m.precioMax;
    return !!debe !== /desde USD/.test(b.textContent);
  });
  ok(!mal.length, '[72] el desplegable dice "desde" justo donde la tarjeta lo dice', mal.map(b => b.textContent.trim().slice(0, 30)).join(' · ') || q);
}

/* ---- [73] "/" con una ventana abierta no manda el foco atras ---- */
async function barraConFicha(){
  const m = MODELOS.find(x => x.stock) || MODELOS[0];
  abrirFicha(clave(m.rep));
  await dormirB3(80);
  const caja = document.querySelector('#ficha .caja');
  caja.focus();
  const e = tecla(caja, '/');
  ok(!barraArriba.classList.contains('buscando') && $('ficha').contains(document.activeElement) && !e.defaultPrevented,
     '[73] "/" con la ficha abierta no abre el buscador de atras', document.activeElement && (document.activeElement.id || document.activeElement.className));
  cerrarFicha();
  await dormirB3(250);
  tecla(document.body, '/');
  ok(barraArriba.classList.contains('buscando') && document.activeElement === $('q'), '[73] y sin ventana si lo abre');
}

/* ---- [59] Escape cierra lo de arriba sin borrar la busqueda ---- */
async function escape(){
  const cat = conStockB3().find(c => MODELOS.filter(m => m.cat === c && m.stock).length > 1);
  const palabra = norm(MODELOS.find(m => m.cat === cat && m.stock).marca || 'a');
  const poner = () => { filtros.cat = cat; $('q').value = palabra; filtros.q = palabra; sincronizarControles(); aplicarFiltro(false); };
  poner();
  // El panel Filtrar
  cabB3().querySelector('.filtrar-btn').click();
  await dormirB3(40);
  tecla(document.querySelector('#filtros-panel .caja'), 'Escape');
  ok(!$('filtros-panel') && filtros.q === palabra, '[59] Escape cierra Filtrar y la busqueda se queda', 'q="' + filtros.q + '"');
  // La ficha
  poner();
  abrirFicha(clave(LISTA[0].rep));
  await dormirB3(80);
  tecla(document.querySelector('#ficha .caja'), 'Escape');
  // Se mira en el acto: antes se borraba y el popstate la traia de vuelta
  // despues (parpadeo, y la entrada "adelante" del historial quedaba sin q)
  const alToque = filtros.q;
  await dormirB3(250);
  ok(!$('ficha') && alToque === palabra && filtros.q === palabra, '[59] Escape cierra la ficha y la busqueda se queda', 'q="' + alToque + '"');
  // El menu de orden
  poner();
  cabB3().querySelector('.orden-btn').click();
  tecla(document.activeElement, 'Escape');
  ok(!cabB3().querySelector('.orden-menu:not([hidden])') && filtros.q === palabra,
     '[59] Escape cierra el menu de orden y la busqueda se queda', 'q="' + filtros.q + '"');
  // Las sugerencias: el primero las cierra, el segundo vacia
  poner(); $('q').focus(); pintarSug();
  if(!$('q-sug').hidden){
    tecla($('q'), 'Escape');
    ok($('q-sug').hidden && filtros.q === palabra, '[59] el primer Escape cierra las sugerencias y deja lo escrito');
  }
  tecla($('q'), 'Escape');
  ok(filtros.q === '' && $('q').value === '', '[59] sin nada abierto, Escape vacia el buscador como siempre');
}

/* ---- [74] Los roles ARIA se cumplen ---- */
function aria(){
  const q = $('q');
  ok(q.getAttribute('role') === 'combobox' && q.getAttribute('aria-controls') === 'q-sug' && !!q.getAttribute('aria-label'),
     '[74] el buscador es un combobox con nombre, que controla #q-sug');
  const palabra = norm((MODELOS.find(m => m.stock) || MODELOS[0]).marca || 'pro');
  q.value = palabra; filtros.q = palabra; sincronizarControles(); pintarSug();
  const ops = [...$('q-sug').querySelectorAll('.qs')];
  ok(ops.length && ops.every(b => b.getAttribute('role') === 'option' && b.id), '[74] cada sugerencia es role="option" con id', ops.length);
  moverSug(1);
  const act = q.getAttribute('aria-activedescendant');
  const el = act && document.getElementById(act);
  ok(el && el.getAttribute('role') === 'option' && el.getAttribute('aria-selected') === 'true',
     '[74] la flecha marca la opcion con aria-activedescendant y aria-selected', act);
  cerrarSug();
  ok(!q.hasAttribute('aria-activedescendant') && q.getAttribute('aria-expanded') === 'false', '[74] y al cerrar se limpia');
  limpiarB3();
  filtros.cat = conStockB3()[0]; aplicarFiltro(false);
  const menu = cabB3().querySelector('.orden-menu');
  ok(menu && !cabB3().querySelector('[role="menu"],[role="menuitemradio"]') &&
     [...menu.querySelectorAll('[data-orden]')].every(b => b.hasAttribute('aria-pressed')),
     '[74] el menu de orden no promete un role="menu": son botones con aria-pressed');
}

/* ---- [120] El foco no cae en BODY ---- */
async function foco(){
  const enCab = sel => { const a = document.activeElement; return !!a && cabB3().contains(a) && a.matches(sel); };
  const cat = conStockB3().sort(ordenCat).find(c => new Set(MODELOS.filter(m => m.cat === c).map(m => m.marca)).size >= 2);
  if(!cat){ nota('[120] hoy no hay rubro con dos marcas'); return; }
  filtros.cat = cat; aplicarFiltro(false);
  const chip = cabB3().querySelector('.marca-chip:not([data-marca=""])');
  if(chip){
    const m = chip.dataset.marca;
    chip.focus(); chip.click();
    ok(enCab(`.marca-chip[data-marca="${CSS.escape(m)}"]`), '[120] despues de elegir una marca el foco sigue en esa marca', document.activeElement.tagName);
    cabB3().querySelector(`.marca-chip[data-marca="${CSS.escape(m)}"]`).click();
  }
  let b = cabB3().querySelector('.orden-btn'); b.focus(); b.click();
  const op = cabB3().querySelector('.orden-menu [data-orden="asc"]');
  op.focus(); op.click();
  ok(enCab('.orden-btn'), '[120] despues de elegir un orden el foco vuelve a "Ordenar"', document.activeElement.tagName);
  b = cabB3().querySelector('.orden-btn'); b.click();
  tecla(document.activeElement, 'Escape');
  ok(enCab('.orden-btn'), '[120] Escape en el menu devuelve el foco a "Ordenar"', document.activeElement.className);
  filtros.orden = ORDEN_DEF;
  Object.assign(filtros, { soloStock: true, rango: RANGOS.find(r => conB3({ cat }, () => filtrar().some(m => m.variantes.some(v => enTramo(v.precio, r)))))[0] });
  aplicarFiltro(false);
  const cruz = cabB3().querySelector('[data-quitar]');
  cruz.focus(); cruz.click();
  ok(enCab('[data-quitar],.filtrar-btn'), '[120] despues de sacar un filtro el foco va a la cruz que sigue', document.activeElement.className);
  Object.assign(filtros, { soloStock: false, rango: '' }); aplicarFiltro(false);
  // Filtrar: cambiar algo y cerrar
  const fb = cabB3().querySelector('.filtrar-btn'); fb.focus(); fb.click();
  await dormirB3(40);
  const opc = document.querySelector('#filtros-panel [data-stock]');
  opc.click();
  document.querySelector('#filtros-panel [data-cerrar]').click();
  ok(enCab('.filtrar-btn'), '[120] al cerrar Filtrar despues de un cambio el foco vuelve a "Filtrar"', document.activeElement.tagName);
  // Desde la portada: el titulo del rubro
  limpiarB3();
  const rubro = document.querySelector('#mosaico .rubro');
  if(rubro){
    rubro.focus(); rubro.click();
    ok(enCab('h2'), '[120] entrar a un rubro desde la portada deja el foco en su titulo', document.activeElement.tagName);
  }
}

/* ---- [134] El resultado se anuncia ---- */
async function anuncio(){
  const a = $('anuncio');
  ok(a && a.getAttribute('role') === 'status' && a.getAttribute('aria-live') === 'polite' && !a.closest('.seccion,#rubro-cab'),
     '[134] hay una region viva fija, afuera de lo que se rehace');
  /* (29/09, revision de la 3.1) Sin resultados se anuncia lo mismo que se
     ve en la grilla vacia (el titulo y la frase), no "No encontramos nada" */
  const vacioVisto = () => {
    const v = grid.querySelector('.msg.vacio'), t = e => e ? e.textContent.replace(/\s+/g, ' ').trim() : '';
    return v ? t(v.querySelector('h2')) + '.' + (v.querySelector('p') ? ' ' + t(v.querySelector('p')) : '') : '(sin vacio)';
  };
  $('q').value = 'zzqxw no existe'; filtros.q = $('q').value; sincronizarControles(); aplicarFiltro(false);
  await dormirB3(750);
  ok(a && a.textContent === vacioVisto() && a.textContent !== 'No encontramos nada',
     '[134] una busqueda sin resultados se anuncia, con lo que dice la grilla vacia', a && a.textContent);
  const w = norm((MODELOS.find(m => m.stock) || MODELOS[0]).marca || 'pro');
  $('q').value = w; filtros.q = w; aplicarFiltro(false);
  await dormirB3(750);
  ok(a && a.textContent === `${LISTA.length} producto${LISTA.length !== 1 ? 's' : ''}`, '[134] y con resultados dice cuantos', a && a.textContent);

  /* (29/09) anunciar() comparaba solo el texto: "airpods" y "gopro" dan 4
     cada una y la segunda quedaba muda, igual que dos busquedas seguidas sin
     nada. El refresco con los mismos filtros, en cambio, tiene que seguir
     callado, tambien con la ficha abierta (el #p= no cuenta). */
  if(!a) return;
  const escritos = [];
  const obs = new MutationObserver(() => escritos.push(a.textContent));
  obs.observe(a, { childList: true, characterData: true, subtree: true });
  const buscarYEsperar = async q => { $('q').value = q; filtros.q = q; aplicarFiltro(false); await dormirB3(750); };
  const cuantos = () => `${LISTA.length} producto${LISTA.length !== 1 ? 's' : ''}`;
  try{
    // Dos palabras que hoy den la misma cantidad con productos distintos
    const palabras = [...new Set(['airpods', 'gopro', 'ipad', 'macbook', 'watch', 'kindle', 'dji', 'playstation',
                                  ...MODELOS.map(m => norm(m.marca || '')).filter(Boolean)])];
    const porCuenta = new Map();
    for(const p of palabras){
      const lista = buscarB3(p);
      if(!lista.length) continue;
      if(!porCuenta.has(lista.length)) porCuenta.set(lista.length, []);
      porCuenta.get(lista.length).push([p, lista.map(m => clave(m.rep || m)).sort().join('|')]);
    }
    let par = null;
    for(const l of porCuenta.values()){
      for(let i = 0; i < l.length && !par; i++)
        for(let j = i + 1; j < l.length && !par; j++)
          if(l[i][1] !== l[j][1]) par = [l[i][0], l[j][0]];
      if(par) break;
    }
    if(par){
      await buscarYEsperar(par[0]);
      escritos.length = 0;
      await buscarYEsperar(par[1]);
      ok(escritos.includes(cuantos()),
         '[134] dos busquedas seguidas con la misma cantidad ("' + par[0] + '" y "' + par[1] + '") se anuncian las dos',
         cuantos() + ' · escrito: ' + (escritos.filter(Boolean).join(' | ') || 'nada'));
    }else nota('[134] hoy no hay dos busquedas con la misma cantidad y productos distintos');

    await buscarYEsperar('zzqxw uno');
    escritos.length = 0;
    await buscarYEsperar('zzqxw dos');
    ok(escritos.includes(vacioVisto()), '[134] dos busquedas seguidas sin nada se anuncian las dos',
       escritos.filter(Boolean).join(' | ') || 'nada');

    await buscarYEsperar(w);
    escritos.length = 0;
    pintarEnSuLugar('');
    await dormirB3(750);
    ok(!escritos.length, '[134] un refresco con los mismos filtros no vuelve a anunciar', escritos.join(' | ') || 'nada');
    if(LISTA.length){
      abrirFicha(clave(LISTA[0].rep || LISTA[0]), null);
      await dormirB3(100);
      escritos.length = 0;
      pintarEnSuLugar('');
      await dormirB3(750);
      ok(!escritos.length, '[134] ni con la ficha abierta', escritos.join(' | ') || 'nada');
      quitarFicha();
    }
  }finally{ obs.disconnect(); }
}

/* ---- [198] y [128]: la pagina abierta de nuevo en iframes ---- */
function abrirB3(url, ancho, alto){
  return new Promise(res => {
    const f = document.createElement('iframe');
    f.style.cssText = `width:${ancho}px;height:${alto}px;border:0;position:absolute;left:-9999px;top:0`;
    f.src = url;
    f.onload = () => {
      const t0 = Date.now();
      const iv = setInterval(() => {
        let listo = false;
        try{
          const w = f.contentWindow;
          w.pararOfertas?.(); w.pararPaseos?.();
          listo = w.eval('MODELOS.length > 0 && ULTIMA_OK > 0');
        }catch(e){}
        // 29/09: si se vence el tope sin cargar, devolvemos null y no el iframe a
        // medio armar. Antes volvia igual, LISTA seguia en [] y [198] lo anotaba
        // como "hoy no da resultados": una carga rota por ?q o ?cat daba TODO OK
        // sin haber probado nada. Igual que en links.js, una carga caida es FALLA.
        if(listo || Date.now() - t0 > 40000){ clearInterval(iv); if(!listo) f.remove(); setTimeout(() => res(listo ? f : null), 500); }
      }, 200);
    };
    document.body.appendChild(f);
  });
}
async function iframes(){
  const [cel, iph, nada] = await Promise.all([
    abrirB3('index.html?cat=Celular', 1440, 900),
    abrirB3('index.html?q=' + encodeURIComponent('iphone 17'), 390, 844),
    abrirB3('index.html', 390, 844)]);
  // 29/09: la carga se chequea aparte y va como FALLA, asi la nota "hoy no da
  // resultados" queda solo para una pagina que cargo y de verdad no trae nada.
  const cargo = (f, txt) => { ok(!!f, '[198] la pagina abierta ' + txt + ' llega a cargar el catalogo'); return !!f; };
  const mirar = (f, alto) => {
    const w = f.contentWindow, d = f.contentDocument;
    const cab = d.getElementById('rubro-cab');
    const cinta = parseFloat(w.getComputedStyle(d.documentElement).getPropertyValue('--alto-cinta')) || 0;
    const top = cab && !cab.hidden ? cab.getBoundingClientRect().top : NaN;
    const tarjetas = [...d.querySelectorAll('#grid .card')].filter(c => { const r = c.getBoundingClientRect(); return r.top < alto && r.bottom > 0; }).length;
    return { y: Math.round(w.scrollY), top: Math.round(top), cinta: Math.round(cinta), tarjetas };
  };
  [[cel, 900, '?cat=Celular a 1440'], [iph, 844, '?q=iphone 17 a 390']].forEach(([f, alto, txt]) => {
    if(!cargo(f, txt)) return;
    const v = mirar(f, alto);
    const hay = f.contentWindow.eval('LISTA.length');
    if(!hay){ nota('[198] ' + txt + ': hoy no da resultados'); return; }
    ok(v.y > 0 && v.top >= v.cinta - 2 && v.top < alto / 2 && v.tarjetas > 0,
       '[198] un link ' + txt + ' abre con el rubro y alguna tarjeta en la primera pantalla', JSON.stringify(v));
  });
  if(cargo(nada, 'sin parametros a 390')){
    ok(nada.contentWindow.scrollY === 0, '[198] sin parametros sigue abriendo arriba de todo', nada.contentWindow.scrollY);
    // [128] A 390 con el buscador cerrado, el Tab no entra al campo invisible
    const w = nada.contentWindow, d = nada.contentDocument;
    const q = d.getElementById('q');
    q.focus();
    ok(d.activeElement !== q, '[128] a 390 con el buscador cerrado, #q no toma el foco', d.activeElement && d.activeElement.tagName);
    d.getElementById('lupa').click();
    ok(d.activeElement === q && w.getComputedStyle(q).visibility === 'visible', '[128] y con la lupa si', d.activeElement && d.activeElement.id);
    /* [128] Escape con el buscador vacio lo cierra y el foco vuelve a la lupa
       (29/09): el campo pasa a hidden y el foco caia en BODY. Los 400 ms dejan
       vencer el cierre del blur (140 ms), para ver que no se va despues. */
    q.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await dormirB3(400);
    ok(d.activeElement === d.getElementById('lupa') && !d.querySelector('.topbar').classList.contains('buscando'),
       '[128] Escape con el buscador vacio a 390 deja el foco en la lupa', d.activeElement && (d.activeElement.id || d.activeElement.tagName));
  }
  if(cel){
    // En la compu la lupa no se ve: el foco se queda en el campo
    const d = cel.contentDocument, w = cel.contentWindow, q = d.getElementById('q');
    q.focus();
    q.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await dormirB3(400);
    ok(d.activeElement === q, '[128] a 1440 Escape deja el foco en el buscador, que se sigue viendo',
       d.activeElement && (d.activeElement.id || d.activeElement.tagName));
  }
  [cel, iph, nada].forEach(f => f && f.remove());
}
