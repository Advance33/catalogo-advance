// Decisiones 3.1 a 3.4 de Pedro (29/09/2026): la busqueda sin resultados.
// Muestra: muestras/auditoria/busqueda.html. Pedro eligio la recomendada en
// las cuatro: 1B 2B 3A 4B.
//   3.1 B  adentro de un rubro se busca en el rubro y se ofrece salir: el
//          titulo dice “airpods” en Celulares · 0 productos, el desplegable
//          muestra lo mismo que la grilla, y los dos ofrecen "Buscar en todo
//          el catalogo" con la cantidad
//   3.2 B  si un filtro deja la grilla vacia: la causa ("En Consolas no hay
//          nada de mas de USD 5.000") y un boton con la cantidad ("Quitar
//          'Mas de USD 5.000'" 12)
//   3.3 A  si lo buscado no esta en ningun lado, "Preguntanos si lo
//          conseguimos", que abre WhatsApp con el mismo mensaje de la portada;
//          solo con 3 letras o mas y nunca cuando la grilla la vacio un filtro
//   3.4 B  al cambiar de rubro, el precio se saca solo si en el rubro nuevo
//          no queda nada, con el aviso "Sacamos 'Mas de USD 5.000': en
//          Consolas no habia nada en ese precio."
// Los casos de la muestra (Celulares + "airpods", Consolas + "Mas de USD
// 5.000", "xiaomi 15 ultra", Camaras -> Consolas) se usan si hoy siguen
// siendo ese caso; si no, se busca otro en los datos del dia.
// El celular se mira en un iframe de 390 px (el headless no baja de 500).
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);

const esperaDB = setInterval(() => {
  if(!MODELOS.length || !FUENTE || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperaDB);
  for(let i=1;i<5000;i++) clearInterval(i);
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; })
    .finally(() => {
      try{ cerrarSug(); }catch(e){}
      try{ quitarFicha(); }catch(e){}
      try{ pararPaseos(); pararOfertas(); pararMundos(); }catch(e){}
      for(let i=1;i<5000;i++) clearInterval(i);
      const pre=document.createElement('pre'); pre.id='RESULTADO';
      pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
      document.body.appendChild(pre);
    });
}, 150);

const dbDormir = ms => new Promise(r => setTimeout(r, ms));
async function dbEsperarA(cond, ms = 25000){
  const t0 = Date.now();
  while(Date.now() - t0 < ms){
    try{ if(cond()) return true; }catch(e){}
    await dbDormir(150);
  }
  return false;
}
/* Esperar a que se asiente lo que se mide, con tope, y no un tiempo fijo
   (29/09). Las ventanas entran con una animacion (cajaIn: .3 s con
   scale(.97)) y, con la suite entera corriendo a la vez, un tiempo fijo a
   veces no alcanzaba: getBoundingClientRect medía la ventana a medio entrar
   (en decision-tarjeta, el pie de 114 px daba 111 = 114 x .97 y [2.7]
   fallaba de a ratos). dbQuieto espera, cuadro a cuadro, a que no quede
   ninguna animacion o transicion con final andando adentro de `raiz`; si al
   tope siguen, las termina (finish) para medir el estado final. dbHasta
   espera una condicion cuadro a cuadro (lo que depende de un ResizeObserver
   o de un repintado cambia recien en un cuadro). */
const dbCuadro = (w = window) => new Promise(r => {
  let ya = false; const fin = () => { if(!ya){ ya = true; r(); } };
  try{ w.requestAnimationFrame(fin); }catch(e){}
  setTimeout(fin, 50);                     // por si ese documento no dibuja
});
async function dbQuieto(raiz, ms = 3000){
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
    await dbCuadro(w);
  }
  andando().forEach(a => { try{ a.finish(); }catch(e){} });
  await dbCuadro(w);
  return false;
}
async function dbHasta(cond, w = window, ms = 3000){
  const t0 = Date.now();
  do{ try{ if(cond()) return true; }catch(e){} await dbCuadro(w); } while(Date.now() - t0 < ms);
  try{ return !!cond(); }catch(e){ return false; }
}
const dbTxt = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
const dbLimpios = { q:'', cat:'', marca:'', soloStock:false, rango:'', montura:'', apertura:'', capacidad:'', ram:'' };
const dbURL = location.pathname + location.search;
// Cuantos da la grilla con estos filtros y nada mas (sin tocar la pantalla)
function dbCuantos(f){
  const antes = { ...filtros };
  Object.assign(filtros, dbLimpios, f);
  try{ return filtrar().length; } finally { Object.assign(filtros, antes); }
}
// Pone estos filtros como si los hubiera elegido el cliente
function dbPoner(f){
  try{ cerrarSug(); }catch(e){}
  Object.assign(filtros, dbLimpios, f);
  verTodo = false;
  sincronizarControles();
  aplicarFiltro(false);
}
function dbLimpiar(){
  try{ cerrarSug(); }catch(e){}
  Object.assign(filtros, dbLimpios);
  verTodo = false;
  AVISO_RUBRO = null;
  $('q').value = ''; $('clear').hidden = true;
  try{ cerrarBuscador(); }catch(e){}
  try{ history.replaceState(null, '', dbURL); }catch(e){}
  sincronizarControles();
  pintar();
}
const dbChip = c => [...$('cats').querySelectorAll('.chip:not(.clon)')].find(b => (b.dataset.cat || '') === c);
const dbCab = () => $('rubro-cab');
const dbH2 = () => dbTxt(dbCab().querySelector('h2'));
const dbCuenta = () => dbTxt(dbCab().querySelector('.rc-tit p'));
const dbVacio = () => grid.querySelector('.msg.vacio');
const dbEtiqueta = r => (RANGOS.find(x => x[0] === r) || [0, r])[1];
const dbConStock = () => [...new Set(MODELOS.filter(m => m.stock).map(m => m.cat))];
const dbN = n => n + ' producto' + (n !== 1 ? 's' : '');

async function correrPruebas(){
  for(const b of [siempre, rubroYBusqueda, desplegableComoLaGrilla, filtroQueVacia, consulta, precioAlCambiarDeRubro, celular]){
    try{ await b(); }
    catch(e){ R.push('EXCEPCION en ' + b.name + ': ' + (e && e.stack || e)); fallas++; }
    try{ dbLimpiar(); }catch(e){}
  }
}

/* Un rubro y una palabra que ahi da 0 y en todo el catalogo no. Primero el de
   la muestra. */
function casoRubroVacio(){
  if(dbConStock().includes('Celular') && !dbCuantos({ cat: 'Celular', q: 'airpods' }) && dbCuantos({ q: 'airpods' }))
    return ['Celular', 'airpods'];
  for(const c of dbConStock()){
    const otro = MODELOS.find(m => m.stock && m.cat !== c && m.marca);
    const w = otro && norm(otro.desc).split(/\s+/)[0];
    if(w && w.length >= 3 && !dbCuantos({ cat: c, q: w }) && dbCuantos({ q: w })) return [c, w];
  }
  return null;
}

/* ---- Lo que va igual en cualquier opcion (la muestra, arriba) ---- */
function siempre(){
  const caso = casoRubroVacio();
  if(!caso){ info('[3.1] hoy no hay un rubro donde una busqueda de 0 y afuera no'); return; }
  const [cat, w] = caso;
  dbPoner({ cat, q: w });
  ok(dbH2() === `“${w}” en ${plural(cat)}`, '[3.1] el titulo dice que se busca y donde', dbH2());
  ok(dbCuenta().startsWith('0 productos'), '[3.1] y la cantidad dice 0 productos, no queda en blanco', dbCuenta());
  ok(document.title.startsWith(`“${w}” en ${plural(cat)} · `), '[3.1] la pestaña dice lo mismo', document.title);
  const fijo = $('rubro-fijo');
  ok(dbTxt(fijo.querySelector('h3')) === `“${w}” en ${plural(cat)}`, '[3.1] y la barra fija tambien', dbTxt(fijo.querySelector('h3')));
  ok(!/menos palabras/.test(grid.textContent), '[3.1] no dice "Probá con menos palabras" si hay una salida', dbTxt(grid).slice(0, 60));
  const haySug = elegirSugeridos(cat).length;
  ok($('sugeridos').hidden === !haySug && (!haySug || /Te puede servir/.test($('sugeridos').textContent)),
     '[3.1] "Te puede servir" sigue abajo como siempre', haySug + ' sugeridos');
  // Con resultados en el rubro el titulo tambien lo dice
  const m = MODELOS.find(x => x.cat === cat && x.stock);
  const w2 = m && norm(m.marca || m.desc).split(/\s+/)[0];
  if(w2){
    dbPoner({ cat, q: w2 });
    ok(LISTA.length > 0 && dbH2() === `“${w2}” en ${plural(cat)}`, '[3.1] con resultados tambien: “' + w2 + '” en ' + plural(cat), dbH2() + ' · ' + LISTA.length);
  }
  // Sin rubro sigue "Resultados para"
  dbPoner({ q: w });
  ok(dbH2() === `Resultados para “${w}”`, '[3.1] sin rubro, "Resultados para …" como siempre', dbH2());
}

/* ---- 3.1 B: la grilla y el desplegable ofrecen todo el catalogo ---- */
async function rubroYBusqueda(){
  const caso = casoRubroVacio();
  if(!caso){ info('[3.1] hoy no hay un caso'); return; }
  const [cat, w] = caso;
  const total = dbCuantos({ q: w });
  info(`[3.1] caso: ${plural(cat)} + "${w}" da 0, en todo el catalogo ${total}`);
  dbPoner({ cat, q: w });
  const v = dbVacio();
  ok(!!v, '[3.1] la grilla vacia tiene el aviso nuevo');
  if(!v) return;
  ok(dbTxt(v.querySelector('h2')) === `No hay “${w}” en ${plural(cat)}`, '[3.1] dice que en el rubro no hay', dbTxt(v.querySelector('h2')));
  ok(dbTxt(v.querySelector('p')) === `En todo el catálogo hay ${total}.`, '[3.1] y cuantos hay en todo el catalogo', dbTxt(v.querySelector('p')));
  const b = v.querySelectorAll('button, a');
  ok(b.length === 1 && b[0].matches('button.b-salida[data-salida]') && dbTxt(b[0]) === `Buscar en todo el catálogo ${total}` &&
     dbTxt(b[0].querySelector('b')) === String(total), '[3.1] un solo boton, "Buscar en todo el catálogo" con la cantidad', dbTxt(b[0]));
  ok(!v.querySelector('a[data-pedilo]'), '[3.1] no ofrece preguntar por WhatsApp: esta en el catalogo');
  /* (29/09, revision) El lector de pantalla oye lo mismo que se ve: decia
     siempre "No encontramos nada" y no se enteraba de la salida */
  await dbEsperarA(() => $('anuncio').textContent, 2000);
  ok($('anuncio').textContent === `No hay “${w}” en ${plural(cat)}. En todo el catálogo hay ${total}.`,
     '[3.1] el lector de pantalla dice la causa y la salida, no "No encontramos nada"', $('anuncio').textContent);

  // El desplegable dice lo mismo
  $('q').value = w; pintarSug();
  const caja = $('q-sug');
  const nada = caja.querySelector('.qs-nada'), fila = caja.querySelector('.qs[data-todo]');
  ok(!caja.hidden && !!nada && dbTxt(nada) === `En ${plural(cat)} no hay “${w}”`, '[3.1] el desplegable dice que en el rubro no hay', dbTxt(nada));
  ok(!!fila && dbTxt(fila.querySelector('b')) === `Buscar “${w}” en todo el catálogo` && dbTxt(fila.querySelector('i')) === dbN(total),
     '[3.1] y ofrece "Buscar … en todo el catálogo" con la misma cantidad', dbTxt(fila));
  ok(!caja.querySelector('.qs[data-key]'), '[3.1] sin sugerir productos de otro rubro (antes sugeria los ' + total + ')');
  const bFila = fila && fila.querySelector('b');
  ok(!!bFila && getComputedStyle(bFila).whiteSpace === 'normal' && getComputedStyle(bFila).overflow === 'visible',
     '[3.1] el renglon "Buscar … en todo el catálogo" puede ocupar dos lineas: no se corta con "…"', bFila && getComputedStyle(bFila).whiteSpace);
  ok(fila && fila.getAttribute('role') === 'option' && fila.id && fila.getAttribute('aria-describedby') === nada.id,
     '[3.1] el renglon es una opcion, con el rotulo como descripcion');
  // Con las flechas y Enter
  moverSug(1);
  ok($('q').getAttribute('aria-activedescendant') === (fila && fila.id), '[3.1] la flecha lo marca');
  const e = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  $('q').dispatchEvent(e);
  await dbDormir(50);
  ok(filtros.cat === '' && filtros.q === w && LISTA.length === total, '[3.1] Enter sale del rubro con lo buscado y muestra los ' + total,
     `cat="${filtros.cat}" q="${filtros.q}" ${LISTA.length}`);
  ok(dbChip('').getAttribute('aria-pressed') === 'true' && !/[?&]cat=/.test(location.search) && /[?&]q=/.test(location.search),
     '[3.1] la cinta marca "Todo" y la direccion lo dice', location.search);
  ok(dbH2() === `Resultados para “${w}”` && dbCuenta().startsWith(dbN(total)), '[3.1] y el titulo es el de todo el catalogo', dbH2() + ' · ' + dbCuenta());
  ok($('q-sug').hidden, '[3.1] el desplegable se cierra');

  // El boton de la grilla hace lo mismo
  dbPoner({ cat, q: w });
  dbVacio().querySelector('[data-salida]').click();
  await dbDormir(50);
  ok(filtros.cat === '' && filtros.q === w && LISTA.length === total, '[3.1] el boton de la grilla tambien', LISTA.length);
  ok(document.activeElement === dbCab().querySelector('h2'), '[3.1] y el foco queda en el titulo, no en BODY', document.activeElement && document.activeElement.tagName);

  // Con un precio puesto: todo el catalogo con ese precio; si ahi tampoco, sin filtros
  const conPrecio = RANGOS.map(r => r[0]).find(r => dbCuantos({ q: w, rango: r }) > 0);
  if(conPrecio){
    const n = dbCuantos({ q: w, rango: conPrecio });
    dbPoner({ cat, q: w, rango: conPrecio });
    ok(dbTxt(dbVacio().querySelector('p')) === `En todo el catálogo hay ${n}.`, '[3.1] con "' + dbEtiqueta(conPrecio) + '" cuenta con ese precio', dbTxt(dbVacio()));
    dbVacio().querySelector('[data-salida]').click();
    ok(filtros.cat === '' && filtros.rango === conPrecio && LISTA.length === n, '[3.1] y al salir el precio se queda', filtros.rango + ' · ' + LISTA.length);
  } else info('[3.1] "' + w + '" no tiene ningun precio con resultados: no se mira la salida con precio');
  const sinPrecio = RANGOS.map(r => r[0]).find(r => !dbCuantos({ q: w, rango: r }));
  if(sinPrecio){
    dbPoner({ cat, q: w, rango: sinPrecio });
    const v2 = dbVacio();
    ok(dbTxt(v2.querySelector('p')) === `En todo el catálogo, sin los filtros, hay ${total}.` &&
       dbTxt(v2.querySelector('button')) === `Buscar en todo el catálogo, sin filtros ${total}`,
       '[3.1] si con el precio tampoco hay afuera, lo ofrece sin filtros', dbTxt(v2));
    v2.querySelector('button').click();
    ok(filtros.cat === '' && filtros.rango === '' && LISTA.length === total, '[3.1] y saca el precio', LISTA.length);
  } else info('[3.1] "' + w + '" tiene algo en todos los precios: no se mira la salida sin filtros');
}

/* ---- 3.1 B: el desplegable muestra lo mismo que la grilla ---- */
function desplegableComoLaGrilla(){
  // Una palabra que en el rubro da algo y afuera tambien (la marca del rubro)
  let caso = null;
  for(const c of dbConStock()){
    for(const m of MODELOS.filter(x => x.cat === c && x.stock && x.marca)){
      const w = norm(m.marca);
      if(MODELOS.some(x => x.cat !== c && x.stock && norm(x.marca) === w)){ caso = [c, w]; break; }
    }
    if(caso) break;
  }
  if(!caso){ info('[3.1] hoy no hay una marca en dos rubros'); return; }
  const [cat, w] = caso;
  dbPoner({ cat, q: w });
  $('q').value = w; pintarSug();
  const keys = [...$('q-sug').querySelectorAll('.qs[data-key]')].map(b => b.dataset.key);
  const deLaGrilla = new Set(LISTA.map(m => clave(m.rep)));
  const ajenos = keys.filter(k => !deLaGrilla.has(k));
  ok(keys.length > 0 && !ajenos.length, `[3.1] en ${plural(cat)}, "${w}" sugiere solo lo que muestra la grilla`,
     keys.length + ' sugeridos' + (ajenos.length ? ', ajenos: ' + ajenos.slice(0, 3).join(', ') : ''));
  ok(!$('q-sug').querySelector('[data-todo]'), '[3.1] con resultados en el rubro no aparece el renglon de todo el catalogo');
  // Sin rubro sugiere de todos lados, como siempre
  dbPoner({ q: w });
  const palabras = prepararBusqueda(w);
  const todos = MODELOS.filter(m => m.stock && coincide(m, palabras));
  const sinRubro = candidatosSug(w).prods;
  ok(sinRubro.length === Math.min(SUG_MAX, todos.length) && sinRubro.every(m => todos.includes(m)),
     '[3.1] sin rubro, el desplegable sigue buscando en todo el catalogo', sinRubro.length + ' de ' + todos.length);
  // Con un filtro de version, la sugerencia abre la misma version que la tarjeta (2.1 B)
  const cap = CATS_CON_CAPACIDAD.find(c => dbConStock().includes(c) &&
    (() => { const a = { ...filtros }; Object.assign(filtros, dbLimpios, { cat: c }); try{ return valoresDe('capacidad').length; } finally { Object.assign(filtros, a); } })());
  if(cap){
    const antes = { ...filtros }; Object.assign(filtros, dbLimpios, { cat: cap });
    const vals = valoresDe('capacidad'); Object.assign(filtros, antes);
    const val = vals[vals.length - 1];
    const m = MODELOS.find(x => x.cat === cap && x.stock && x.variantes.some(v => capacidadDe(v) === val) &&
                                 x.variantes.some(v => capacidadDe(v) !== val));
    if(m){
      const w3 = norm(m.titulo || m.desc).split(/\s+/).slice(0, 2).join(' ');
      dbPoner({ cat: cap, capacidad: val, q: w3 });
      $('q').value = w3; pintarSug();
      const ks = [...$('q-sug').querySelectorAll('.qs[data-key]')].map(b => b.dataset.key);
      const tarjetas = new Set(LISTA.map(x => clave(x.rep)));
      ok(ks.length && ks.every(k => tarjetas.has(k)) && ks.every(k => capacidadDe(buscarProducto(k)) === val),
         `[3.1] con ${val} puesto, "${w3}" sugiere la version de ${val}, la misma de la tarjeta`, ks.slice(0, 3).join(', '));
    }
  }
}

/* Un rubro y un tramo de precio que ahi da 0. Primero el de la muestra. */
function casoPrecioVacio(){
  if(dbConStock().includes('Consola') && !dbCuantos({ cat: 'Consola', rango: '5000+' }) && dbCuantos({ cat: 'Consola' }))
    return ['Consola', '5000+'];
  for(const c of dbConStock())
    for(const r of RANGOS.map(x => x[0]).reverse())
      if(!dbCuantos({ cat: c, rango: r })) return [c, r];
  return null;
}

/* ---- 3.2 B: la causa y un boton con la cantidad ---- */
async function filtroQueVacia(){
  const caso = casoPrecioVacio();
  if(!caso){ info('[3.2] hoy no hay un rubro que quede vacio con un precio'); return; }
  const [cat, r] = caso, t = dbEtiqueta(r), n = dbCuantos({ cat });
  const frase = 'de ' + t.replace(/^(Hasta|Más)/, x => x.toLowerCase());
  info(`[3.2] caso: ${plural(cat)} + "${t}" da 0, sin el filtro ${n}`);
  dbPoner({ cat, rango: r });
  ok(dbH2() === plural(cat) && dbCuenta().startsWith('0 productos'), '[3.2] el encabezado: el rubro y 0 productos', dbH2() + ' · ' + dbCuenta());
  const v = dbVacio();
  ok(!!v && dbTxt(v.querySelector('h2')) === `En ${plural(cat)} no hay nada ${frase}`, '[3.2] dice la causa', dbTxt(v && v.querySelector('h2')));
  ok(!!v && dbTxt(v.querySelector('p')) === `Sin ese filtro hay ${n}.`, '[3.2] y cuantos hay sin ese filtro', dbTxt(v && v.querySelector('p')));
  const bs = v ? v.querySelectorAll('button, a') : [];
  ok(bs.length === 1 && dbTxt(bs[0]) === `Quitar “${t}” ${n}` && dbTxt(bs[0].querySelector('b')) === String(n),
     '[3.2] un solo boton: Quitar “' + t + '” con la cantidad (no va "Ver tambien los sin stock")', bs.length + ' · ' + dbTxt(bs[0]));
  ok(!!bs[0] && bs[0].matches('button.b-salida[data-salida]'), '[3.2] es el mismo boton que el de todo el catalogo (3.1)');
  ok(!/menos palabras/.test(v.textContent), '[3.2] sin "Probá con menos palabras": no se escribio nada');
  ok(!v.querySelector('a[data-pedilo]'), '[3.2] y sin la consulta por WhatsApp: lo vacio un filtro');
  bs[0].click();
  await dbDormir(50);
  ok(filtros.rango === '' && filtros.cat === cat && LISTA.length === n, '[3.2] el boton saca el filtro y se ven los ' + n, LISTA.length);
  ok(!/[?&]precio=/.test(location.search) && document.activeElement === dbCab().querySelector('h2'),
     '[3.2] la direccion lo dice y el foco queda en el titulo', location.search);

  // Con dos filtros: el titulo nombra los dos y el boton saca el que alcanza
  const nStock = dbCuantos({ cat, soloStock: true });
  if(nStock){
    dbPoner({ cat, rango: r, soloStock: true });
    const v2 = dbVacio();
    ok(dbTxt(v2.querySelector('h2')) === `En ${plural(cat)} no hay nada ${frase} y con stock` &&
       dbTxt(v2.querySelector('p')) === `Sin “${t}” hay ${nStock}.` && dbTxt(v2.querySelector('button')) === `Quitar “${t}” ${nStock}`,
       '[3.2] con "Con stock" tambien: nombra los dos y saca el precio', dbTxt(v2));
  } else info('[3.2] ' + plural(cat) + ' no tiene nada con stock: no se mira con dos filtros');
  // Una busqueda + el precio: la causa es el precio
  const m = MODELOS.find(x => x.cat === cat && x.stock);
  const w = m && norm(m.titulo || m.desc).split(/\s+/)[0];
  if(w && dbCuantos({ cat, q: w })){
    const nq = dbCuantos({ cat, q: w });
    dbPoner({ cat, q: w, rango: r });
    const v3 = dbVacio();
    ok(dbTxt(v3.querySelector('h2')) === `En ${plural(cat)} no hay “${w}” ${frase}` && dbTxt(v3.querySelector('p')) === `Sin ese filtro hay ${nq}.`,
       '[3.2] con algo escrito, dice que eso no esta en ese precio', dbTxt(v3));
  } else info('[3.2] no hay una palabra para buscar en ' + plural(cat));
  // Una marca que quedo puesta sin ser del rubro (red de seguridad de [62])
  const ajena = MODELOS.find(x => x.marca && x.cat !== cat && !MODELOS.some(y => y.cat === cat && y.marca === x.marca));
  if(ajena){
    dbPoner({ cat, marca: ajena.marca });
    ok(dbTxt(dbVacio().querySelector('h2')) === `En ${plural(cat)} no hay nada de ${ajena.marca}` &&
       dbTxt(dbVacio().querySelector('button')) === `Quitar “${ajena.marca}” ${n}`, '[3.2] con una marca ajena: la nombra y la saca', dbTxt(dbVacio()));
  } else info('[3.2] hoy no hay una marca ajena a ' + plural(cat));
}

/* ---- 3.3 A: preguntar por lo que no esta ---- */
async function consulta(){
  // (29/09) Lo que recibe ADVAPP esta escrito para ellos: 'pedilo' con desde "busqueda"
  try{
    const med = await (await fetch('MEDICION-ADVAPP.txt?_=' + Date.now(), { cache: 'no-store' })).text();
    const pedilo = (/\n\s*pedilo\s[\s\S]*?(?=\n\s*\n)/.exec(med) || [''])[0];
    ok(/desde:\s*"busqueda"/.test(pedilo) && /Preguntanos\s+si lo conseguimos/.test(pedilo.replace(/\s+/g, ' ')),
       '[3.3] MEDICION-ADVAPP.txt dice que "pedilo" puede traer desde: "busqueda" (el de la grilla vacia)', pedilo.replace(/\s+/g, ' ').slice(0, 80));
  }catch(e){ ok(false, '[3.3] se puede leer MEDICION-ADVAPP.txt', String(e)); }
  const q = ['xiaomi 15 ultra', 'qzxw 9999 no existe'].find(x => !dbCuantos({ q: x }));
  info('[3.3] caso: "' + q + '"');
  dbPoner({ q });
  ok(dbH2() === `Resultados para “${q}”` && dbCuenta().startsWith('0 productos'), '[3.3] el encabezado: lo buscado y 0 productos', dbH2() + ' · ' + dbCuenta());
  const v = dbVacio();
  ok(!!v && dbTxt(v.querySelector('h2')) === `“${q}” no está en el catálogo`, '[3.3] dice que no esta en el catalogo', dbTxt(v && v.querySelector('h2')));
  const bajada = 'Conseguimos más marcas y modelos de los que están cargados acá.';
  ok(!!v && dbTxt(v.querySelector('p')) === bajada && htmlAyuda().replace(/\s+/g, ' ').includes(bajada),
     '[3.3] con el texto del recuadro de la portada, tal cual', dbTxt(v && v.querySelector('p')));
  const a = v && v.querySelector('a[data-pedilo]');
  const esperado = linkWA('Hola! Estoy buscando: ' + q + '\n¿Lo consiguen?');
  ok(!!a && dbTxt(a) === 'Preguntanos si lo conseguimos' && a.href === esperado && a.target === '_blank' && /noopener/.test(a.rel),
     '[3.3] el boton "Preguntanos si lo conseguimos" abre WhatsApp con lo buscado', a && decodeURIComponent(a.href.split('text=')[1] || ''));
  ok(!!a && !!a.querySelector('svg') && v.querySelectorAll('button, a').length === 1, '[3.3] con el icono de WhatsApp, y es la unica salida');
  ok(!/te lo conseguimos|lo conseguimos seguro|garantizamos/i.test(v.textContent), '[3.3] pregunta, no promete');
  const hayNov = novedades().length;
  ok($('sugeridos').hidden === !hayNov && (!hayNov || /Lo último que entró/.test($('sugeridos').textContent)),
     '[3.3] "Lo último que entró" sigue abajo', hayNov + ' novedades');

  // El mismo mensaje que el recuadro de la portada
  dbLimpiar();
  const inp = $('pedilo-q'), bot = $('pedilo-btn');
  if(inp && bot){
    const abrir = window.open; let abierto = '';
    window.open = u => { abierto = String(u); return null; };
    try{ inp.value = q; inp.dispatchEvent(new Event('input')); bot.click(); }
    finally{ window.open = abrir; }
    ok(abierto === esperado, '[3.3] es el mismo mensaje del "¿Buscás algo que no está?" de la portada', decodeURIComponent(abierto.split('text=')[1] || ''));
  }else info('[3.3] la portada no tiene el recuadro de "¿Buscás algo que no está?"');

  // Se mide como "pedilo", desde la busqueda, y no como otro WhatsApp
  dbPoner({ q });
  const medir = ANALITICA.medir, mandar = ANALITICA.mandar, anotados = [];
  ANALITICA.medir = (t, d) => anotados.push({ t, ...(d || {}) });
  ANALITICA.mandar = () => {};
  const frenar = e => e.preventDefault();          // que no abra WhatsApp en la prueba
  const link = dbVacio().querySelector('a[data-pedilo]');
  link.addEventListener('click', frenar);
  try{ link.click(); }
  finally{ link.removeEventListener('click', frenar); ANALITICA.medir = medir; ANALITICA.mandar = mandar; }
  ok(anotados.length === 1 && anotados[0].t === 'pedilo' && anotados[0].q === q && anotados[0].desde === 'busqueda',
     '[3.3] el clic se anota como "pedilo", con lo buscado y desde la busqueda', JSON.stringify(anotados));

  // Solo con 3 letras o mas
  const dos = ['zq', 'qz', 'xq'].find(x => !dbCuantos({ q: x }));
  if(dos){
    dbPoner({ q: dos });
    ok(!dbVacio().querySelector('a[data-pedilo]') && /menos palabras/.test(dbVacio().textContent),
       '[3.3] con 2 letras ("' + dos + '") no ofrece preguntar: queda el texto de siempre', dbTxt(dbVacio()));
  } else info('[3.3] todas las busquedas de dos letras de prueba dan algo');
  // En un rubro, si no esta en ningun lado, tambien (no lo vacio un filtro)
  const cat = dbConStock()[0];
  dbPoner({ cat, q });
  ok(!!dbVacio().querySelector('a[data-pedilo]') && dbH2() === `“${q}” en ${plural(cat)}`, '[3.3] adentro de un rubro tambien la ofrece', dbTxt(dbVacio()));
  // Nunca cuando lo que vacio la grilla es un filtro
  const caso = casoPrecioVacio();
  if(caso){
    dbPoner({ cat: caso[0], rango: caso[1] });
    ok(!dbVacio().querySelector('a[data-pedilo]'), '[3.3] con la grilla vacia por un filtro, no');
  } else info('[3.3] hoy ningun rubro queda vacio con un precio');
}

/* ---- 3.4 B: el precio que no sirve en el rubro nuevo se saca, con aviso ---- */
function casoCambioDeRubro(){
  const stock = dbConStock();
  const pares = [];
  if(stock.includes('Cámara') && stock.includes('Consola')) pares.push(['Cámara', 'Consola', '5000+']);
  for(const r of RANGOS.map(x => x[0]).reverse())
    for(const a of stock) for(const b of stock) if(a !== b) pares.push([a, b, r]);
  return pares.find(([a, b, r]) => dbCuantos({ cat: a, rango: r }) && !dbCuantos({ cat: b, rango: r }) && dbCuantos({ cat: b }) && dbChip(b));
}
async function precioAlCambiarDeRubro(){
  const caso = casoCambioDeRubro();
  if(!caso){ info('[3.4] hoy no hay un par de rubros para probar'); return; }
  const [a, b, r] = caso, t = dbEtiqueta(r), nb = dbCuantos({ cat: b });
  const texto = `Sacamos “${t}”: en ${plural(b)} no había nada en ese precio.`;
  info(`[3.4] caso: ${plural(a)} con "${t}" (${dbCuantos({ cat: a, rango: r })}) y despues ${plural(b)} (0 en ese precio, ${nb} sin el)`);
  const aviso = $('aviso-rubro');
  ok(!!aviso && aviso.hidden, '[3.4] el aviso existe y arranca escondido');
  dbPoner({ cat: a, rango: r });
  dbChip(b).click();
  await dbDormir(50);
  ok(filtros.cat === b && filtros.rango === '' && LISTA.length === nb, '[3.4] al tocar ' + plural(b) + ' el precio se saca y se ven los ' + nb,
     `rango="${filtros.rango}" ${LISTA.length}`);
  ok(!aviso.hidden && dbTxt(aviso) === texto, '[3.4] con el aviso', dbTxt(aviso));
  ok(!!(dbCab().compareDocumentPosition(aviso) & Node.DOCUMENT_POSITION_FOLLOWING) &&
     !!(aviso.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING), '[3.4] entre el encabezado y la grilla, como en la muestra');
  ok(!dbCab().querySelector('[data-quitar="rango"]') && !/[?&]precio=/.test(location.search), '[3.4] sin la cruz del precio y sin ?precio en la direccion', location.search);
  await dbDormir(750);
  ok($('anuncio').textContent.includes(texto), '[3.4] el lector de pantalla lo escucha', $('anuncio').textContent);
  pintar();              // el refresco de cada 5 minutos
  ok(!aviso.hidden && dbTxt(aviso) === texto, '[3.4] el refresco no lo borra');
  const marca = dbCab().querySelector('.marca-chip:not([data-marca=""])');
  if(marca){
    marca.click();
    ok(aviso.hidden, '[3.4] cambiar algo (una marca) lo saca');
  } else info('[3.4] ese rubro no tiene marcas para tocar');
  dbPoner({ cat: a, rango: r }); dbChip(b).click();
  ok(!aviso.hidden, '[3.4] (de nuevo en ' + plural(b) + ')');
  irAlMenu();
  ok(aviso.hidden, '[3.4] en la portada no se ve');

  // Si en el rubro nuevo hay algo en ese precio, se queda
  const otro = dbConStock().find(c => c !== a && dbCuantos({ cat: c, rango: r }) && dbChip(c));
  if(otro){
    dbPoner({ cat: a, rango: r });
    dbChip(otro).click();
    ok(filtros.rango === r && LISTA.length === dbCuantos({ cat: otro, rango: r }) && aviso.hidden,
       `[3.4] en ${plural(otro)}, que tiene algo de "${t}", el precio se queda y no hay aviso`, LISTA.length);
  }else info('[3.4] ningun otro rubro tiene algo en "' + t + '"');

  // Por la sugerencia de rubro del buscador, lo mismo que la cinta
  dbPoner({ cat: a, rango: r });
  const q = norm(plural(b));
  $('q').value = q; filtros.q = q; pintarSug();
  const sug = $('q-sug').querySelector(`.qs-cat[data-cat="${CSS.escape(b)}"]`);
  if(sug){
    sug.click();
    ok(filtros.cat === b && filtros.rango === '' && !aviso.hidden && dbTxt(aviso) === texto,
       '[3.4] entrando por la sugerencia "' + plural(b) + '" del buscador, igual', `rango="${filtros.rango}"`);
  }else info('[3.4] "' + q + '" no sugirio el rubro');

  // La marca la sigue sacando la cinta sin aviso (lo de siempre)
  const ajena = MODELOS.find(x => x.cat === a && x.marca && !MODELOS.some(y => y.cat === b && y.marca === x.marca));
  if(ajena){
    dbPoner({ cat: a, marca: ajena.marca });
    dbChip(b).click();
    ok(filtros.marca === '' && aviso.hidden, '[3.4] la marca se sigue sacando sola, sin aviso, como antes');
  } else info('[3.4] hoy no hay una marca de ' + plural(a) + ' que no este en ' + plural(b));
}

/* ---- El celular: nada se sale de los 390 px ---- */
async function celular(){
  const caso = casoPrecioVacio();
  const q = ['xiaomi 15 ultra', 'qzxw 9999 no existe'].find(x => !dbCuantos({ q: x }));
  const casos = [];
  if(caso) casos.push(['index.html?cat=' + encodeURIComponent(caso[0]) + '&precio=' + encodeURIComponent(caso[1]), '.b-salida', '3.2']);
  casos.push(['index.html?q=' + encodeURIComponent(q), '.b-consulta', '3.3']);
  for(const [src, sel, d] of casos){
    const f = document.createElement('iframe');
    f.style.cssText = 'width:390px;height:844px;border:0;position:absolute;left:-9999px;top:0';
    f.src = src;
    document.body.appendChild(f);
    try{
      const listo = await dbEsperarA(() => f.contentWindow.eval('MODELOS.length') && f.contentDocument.querySelector('#grid ' + sel), 40000);
      ok(listo, `[${d}] a 390 px el vacio tiene su boton`, src);
      if(!listo) continue;
      const w = f.contentWindow, doc = f.contentDocument;
      try{ w.pararOfertas?.(); w.pararPaseos?.(); w.pararMundos?.(); }catch(e){}
      const bt = doc.querySelector('#grid ' + sel).getBoundingClientRect();
      const h2 = doc.querySelector('#grid .msg.vacio h2').getBoundingClientRect();
      ok(bt.left >= 0 && bt.right <= 390 && h2.left >= 0 && h2.right <= 390 && doc.documentElement.scrollWidth <= 391,
         `[${d}] a 390 px el titulo y el boton entran a lo ancho`, Math.round(bt.left) + '-' + Math.round(bt.right) + ' · ' + doc.documentElement.scrollWidth);
    }finally{ f.remove(); }
  }
  /* (29/09, revision) A 390, el renglon "Buscar … en todo el catálogo, sin
     los filtros" del desplegable se cortaba con "…" justo en lo que hace */
  const rv = casoRubroVacio();
  if(rv){
    const [cat, w] = rv;
    const conPrecio = RANGOS.map(r => r[0]).find(r => !dbCuantos({ q: w, rango: r }));
    const f = document.createElement('iframe');
    f.style.cssText = 'width:390px;height:844px;border:0;position:absolute;left:-9999px;top:0';
    f.src = 'index.html?cat=' + encodeURIComponent(cat) + (conPrecio ? '&precio=' + encodeURIComponent(conPrecio) : '');
    document.body.appendChild(f);
    try{
      const listo = await dbEsperarA(() => f.contentWindow.eval('MODELOS.length && FUENTE') && f.contentDocument.querySelector('#cats .chip'), 40000);
      ok(listo, '[3.1] a 390 px carga ' + plural(cat));
      if(listo){
        const w2 = f.contentWindow, doc = f.contentDocument;
        try{ w2.pararOfertas?.(); w2.pararPaseos?.(); w2.pararMundos?.(); }catch(e){}
        // Como el cliente: toca la lupa (en el celular el buscador se abre a lo ancho) y escribe
        w2.scrollTo(0, 0);
        doc.getElementById('lupa').click();
        await dbQuieto(doc.querySelector('.topbar'));
        const q = doc.getElementById('q');
        q.value = w; q.dispatchEvent(new w2.Event('input', { bubbles: true }));
        await dbHasta(() => doc.querySelector('#q-sug .qs[data-todo] .qs-txt b'), w2);
        await dbQuieto(doc.querySelector('.topbar'));
        const b = doc.querySelector('#q-sug .qs[data-todo] .qs-txt b');
        ok(!!b && b.getBoundingClientRect().width > 150 && b.scrollWidth <= b.clientWidth + 1 && b.getBoundingClientRect().right <= 391,
           '[3.1] a 390 px el renglon "' + dbTxt(b) + '" se lee entero (puede ir en dos lineas)',
           b && Math.round(b.getBoundingClientRect().width) + ' px, ' + Math.round(b.getBoundingClientRect().height) + ' de alto');
      }
    }finally{ f.remove(); }
  } else info('[3.1] hoy no hay un caso de rubro vacio para mirar el desplegable a 390');
}
