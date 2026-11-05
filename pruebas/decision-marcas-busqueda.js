// Las marcas en una busqueda (Benja, 05/11/2026): "busque tablets y no
// figuran los filtros para saber de que marca quiero". Salia "Resultados para
// “tablets” · 20 productos" con Ordenar y Filtrar y ningun boton de marca,
// con tablets de Apple, Samsung y Xiaomi.
//   [1] buscando sin rubro, con 2 marcas o mas, los botones de marca con su
//       cuenta, como en un rubro; tocar una filtra, la direccion suma
//       &marca= sin perder el ?q=, el titulo sigue diciendo lo buscado y el
//       Atras vuelve a todas
//   [2] Filtrar suma "Marca" buscando sin rubro (adentro de un rubro no: ahi
//       estan los botones), se combina con Precio y Stock, y Limpiar la saca
//   [3] la busqueda que nombra un rubro ("tablets", "celulares", "notebooks",
//       "camaras", "lentes"...) ofrece en Filtrar los filtros de ese rubro
//       (memoria y RAM, montura, tipo de camara...), con los mismos valores
//       que adentro del rubro; lo encontrado no cambia
//   [4] los filtros del rubro se sueltan cuando la busqueda deja de nombrarlo
//       ("lentes" → "lentes sony" sigue, → "iphone" se suelta), y un link
//       ?q=lentes&montura=… vale
//   [5] lo que no cambia: con una sola marca no hay botones; "Todo el
//       catalogo" sin buscar no tiene botones; adentro de un rubro, los del
//       rubro; Filtrar en un rubro no tiene Marca y Limpiar no la saca
//   [6] lo sin stock sigue al final (DP-13) con una marca elegida
// Los casos se usan si hoy el catalogo los tiene; si no, la comprobacion dice
// "--" y por que.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);
const mbDormir = ms => new Promise(r => setTimeout(r, ms));

const esperaMB = setInterval(() => {
  if(!MODELOS.length || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperaMB);
  (async () => {
    try{ await mbPruebas(); }catch(e){ R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; }
    try{ cerrarSug(); }catch(e){}
    try{ pararPaseos(); pararOfertas(); pararNuevos(); pararMarcas(); pararMundos(); }catch(e){}
    for(let i=1;i<5000;i++) clearInterval(i);
    const pre=document.createElement('pre'); pre.id='RESULTADO';
    pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
    document.body.appendChild(pre);
  })();
}, 150);

const mbLimpiar = () => { verTodo = false; Object.assign(filtros, { q:'', cat:'', marca:'', rango:'', capacidad:'', ram:'', montura:'', apertura:'', soloStock:false, orden:'modelo', ...SIN_PROPIOS }); };
// Buscar como el cliente: el texto en el buscador y la grilla dibujada
const mbBuscar = q => { mbLimpiar(); filtros.q = q; $('q').value = q; aplicarFiltro(false); };
const mbCab = () => $('rubro-cab');
const mbTxt = el => (el && el.textContent || '').replace(/\s+/g, ' ').trim();
const mbChips = () => [...mbCab().querySelectorAll('.rc-marcas .marca-chip')];
const mbCuenta = (l, k) => { const m = new Map(); l.forEach(x => m.set(x[k], (m.get(x[k]) || 0) + 1)); return m; };
const mbTitulos = () => gruposDeFiltros().map(g => g.titulo);
const mbPanel = () => $('filtros-panel');
const mbConFiltros = (f, hacer) => { const a = { ...filtros }; Object.assign(filtros, f); try{ return hacer(); } finally { Object.assign(filtros, a); } };

async function mbPruebas(){
  document.documentElement.style.scrollBehavior = 'auto';

  /* ---- [1] Los botones de marca buscando ---- */
  mbBuscar('tablets');
  const enTablets = mbCuenta(filtrar(), 'marca');
  if(enTablets.size < 2) info(`[1] hoy "tablets" trae ${enTablets.size} marca(s): no hay botones que probar`);
  else{
    const chips = mbChips();
    const dicen = chips.map(b => [b.dataset.marca, Number(mbTxt(b.querySelector('i')))]);
    ok(chips.length === enTablets.size + 1 && dicen[0][0] === '' && dicen[0][1] === LISTA.length,
       `[1] "tablets": "Todas ${LISTA.length}" y un boton por marca (${[...enTablets.keys()].join(', ')})`, chips.map(mbTxt).join(' · '));
    ok(dicen.slice(1).every(([m, n]) => enTablets.get(m) === n), '[1] cada boton con la cuenta de lo encontrado de esa marca',
       dicen.slice(1).map(x => x.join(' ')).join(', '));
    ok(dicen.slice(1).every(([, n], i, a) => !i || a[i - 1][1] >= n), '[1] la marca con mas productos primero');
    ok(!!$('rubro-fijo').querySelector('.rf-marcas .marca-chip'), '[1] y tambien en el encabezado pegado (rubro-fijo)');
    // Tocar una marca
    const [m, n] = dicen.slice(1).sort((a, b) => a[1] - b[1])[0];
    const antesURL = location.search;
    mbCab().querySelector(`.marca-chip[data-marca="${CSS.escape(m)}"]`).click();
    const u = new URLSearchParams(location.search);
    ok(filtros.marca === m && LISTA.length === n && LISTA.every(x => x.marca === m), `[1] tocar ${m} muestra sus ${n}`, LISTA.length);
    ok(u.get('q') === 'tablets' && u.get('marca') === m, '[1] la direccion sigue con ?q=tablets y suma la marca', location.search);
    ok(mbTxt(mbCab().querySelector('h2')) === 'Resultados para “tablets”', '[1] el titulo sigue diciendo lo buscado', mbTxt(mbCab().querySelector('h2')));
    ok(mbCab().querySelector(`.marca-chip[data-marca="${CSS.escape(m)}"]`).getAttribute('aria-pressed') === 'true',
       '[1] el boton de ' + m + ' queda marcado');
    // El Atras vuelve a todas
    history.back();
    for(let i = 0; i < 20 && filtros.marca; i++) await mbDormir(100);
    ok(!filtros.marca && filtros.q === 'tablets' && LISTA.length === dicen[0][1], '[1] el Atras vuelve a "tablets" con todas las marcas',
       `${filtros.marca || 'sin marca'}, ${LISTA.length}, ${location.search} (antes ${antesURL})`);
    // Tocar la marca puesta la saca, como en un rubro
    mbBuscar('tablets');
    mbCab().querySelector(`.marca-chip[data-marca="${CSS.escape(m)}"]`).click();
    mbCab().querySelector(`.marca-chip[data-marca="${CSS.escape(m)}"]`).click();
    ok(!filtros.marca, '[1] tocar otra vez la marca puesta la saca');
  }

  /* ---- [2] Filtrar suma la marca buscando ---- */
  mbBuscar('tablets');
  if(enTablets.size >= 2){
    ok(mbTitulos()[0] === 'Marca' && mbTitulos().includes('Precio'), '[2] buscando, Filtrar arranca con Marca', mbTitulos().join(' / '));
    mbCab().querySelector('.filtrar-btn').click();
    const ops = [...mbPanel().querySelectorAll('[data-campo="marca"]')];
    ok(ops.length === enTablets.size && ops.every(b => enTablets.get(b.dataset.v) === Number(mbTxt(b.querySelector('i')))),
       '[2] con cada marca y su cuenta', ops.map(mbTxt).join(' · '));
    // Con un precio puesto, las cuentas de marca son las de ese precio
    const rango = RANGOS.map(r => r[0]).find(r => mbConFiltros({ rango: r }, () => filtrar().length) > 0 &&
                                                   mbConFiltros({ rango: r }, () => filtrar().length) < LISTA.length);
    if(rango){
      mbPanel().querySelector(`[data-campo="rango"][data-v="${CSS.escape(rango)}"]`).click();
      const cuenta = mbCuenta(filtrar(), 'marca');
      const ops2 = [...mbPanel().querySelectorAll('[data-campo="marca"]')];
      ok(ops2.every(b => (cuenta.get(b.dataset.v) || 0) === Number(mbTxt(b.querySelector('i')))),
         '[2] con un precio puesto, cada marca cuenta lo de ese precio', ops2.map(mbTxt).join(' · '));
      const b = ops2.find(x => Number(mbTxt(x.querySelector('i'))) > 0);
      b.click();
      ok(filtros.marca === b.dataset.v && filtros.rango === rango && LISTA.every(x => x.marca === b.dataset.v),
         '[2] y elegir una marca en el panel se suma al precio', `${filtros.marca} + ${filtros.rango}: ${LISTA.length}`);
      ok(mbTxt(mbCab().querySelector('.filtrar-btn b')) === '2', '[2] el boton Filtrar cuenta los dos', mbTxt(mbCab().querySelector('.filtrar-btn')));
      const stock = mbPanel().querySelector('[data-stock]');
      stock.click();
      ok(filtros.soloStock && filtros.marca === b.dataset.v && LISTA.every(x => x.stock), '[2] y "Solo con stock" tambien', LISTA.length);
      mbPanel().querySelector('[data-limpiar]').click();
      ok(!filtros.marca && !filtros.rango && !filtros.soloStock && filtros.q === 'tablets', '[2] Limpiar saca la marca, el precio y el stock (y deja la busqueda)');
    }else info('[2] hoy ningun precio parte "tablets" en dos');
    mbPanel()?.querySelector('.mf-cerrar')?.click();
  }

  /* ---- [3] La busqueda que nombra un rubro ---- */
  const hay = c => MODELOS.some(m => m.cat === c);
  const casos = [['tablets', ['Tablet', 'iPad']], ['tablet', ['Tablet', 'iPad']], ['celulares', ['Celular']], ['celular', ['Celular']],
                 ['notebooks', ['Notebook', 'MacBook']], ['cámaras', ['Cámara']], ['camaras', ['Cámara']], ['auriculares', ['Auriculares']],
                 ['consolas', ['Consola']], ['objetivos', ['Objetivo']], ['lentes', ['Objetivo', 'Gafas Inteligentes']],
                 ['drones', ['Drone']], ['monitores', ['Monitor']], ['relojes', ['Apple Watch', 'Smartwatch']],
                 ['accesorios cámara', ['Accesorio Cámara']], ['ipad pro', ['iPad']], ['celulares samsung', ['Celular']]];
  for(const [q, esperados] of casos){
    const hoy = esperados.filter(hay);
    mbBuscar(q);
    const r = rubrosDeLaBusqueda();
    ok(hoy.every(c => r.includes(c)), `[3] "${q}" nombra ${hoy.join(' y ') || '(hoy no hay)'}`, r.join(', '));
  }
  for(const q of ['iphone', 'samsung', 'black', 'accesorios', 'cargador iphone', '512', 'zzzz']){
    mbBuscar(q);
    ok(!rubrosDeLaBusqueda().length, `[3] "${q}" no nombra ningun rubro`, rubrosDeLaBusqueda().join(', '));
  }
  // Los filtros del rubro: los mismos valores que adentro del rubro
  for(const [q, cat] of [['celulares', 'Celular'], ['notebooks', 'MacBook'], ['consolas', 'Consola']]){
    if(!hay(cat)){ info(`[3] hoy no hay ${cat}`); continue; }
    mbBuscar(q);
    const enBusqueda = { capacidad: valoresDe('capacidad'), ram: valoresDe('ram') };
    const enRubro = mbConFiltros({ q: '', cat }, () => ({ capacidad: valoresDe('capacidad'), ram: valoresDe('ram') }));
    const cats = rubrosDeLaBusqueda().filter(c => CATS_CON_CAPACIDAD.includes(c));
    // Con un solo rubro, los mismos valores; con dos ("notebooks"), los de los dos
    const igual = cats.length === 1
      ? JSON.stringify(enBusqueda) === JSON.stringify(enRubro)
      : enRubro.capacidad.every(v => enBusqueda.capacidad.includes(v));
    ok(igual && (enBusqueda.capacidad.length || !enRubro.capacidad.length),
       `[3] "${q}": Filtrar ofrece la memoria${enRubro.ram.length ? ' y la RAM' : ''} de ${plural(cat)}`,
       `${enBusqueda.capacidad.join(',')} / ${enBusqueda.ram.join(',')}`);
    ok(mbTitulos().includes('Memoria') === !!enBusqueda.capacidad.length, '[3] y "Memoria" esta en el panel', mbTitulos().join(' / '));
  }
  if(hay('Objetivo')){
    mbBuscar('objetivos');
    const t = mbTitulos();
    const enRubro = mbConFiltros({ q: '', cat: 'Objetivo' }, () => gruposDeFiltros().map(g => g.titulo));
    ok(enRubro.every(x => t.includes(x)) && t[0] === 'Marca', '[3] "objetivos": Marca y los filtros de Objetivos', t.join(' / '));
  }
  if(hay('Cámara')){
    mbBuscar('cámaras');
    const t = mbTitulos();
    ok(FILTROS_RUBRO.filter(f => f.rubro === 'Cámara').every(f => t.includes(f.titulo)), '[3] "cámaras": los filtros de Cámaras', t.join(' / '));
    // Un filtro propio de Cámaras, puesto desde la busqueda
    const f = FILTROS_RUBRO.find(x => x.campo === 'tipo');
    const op = f && f.opciones.find(([v]) => mbConFiltros({ tipo: v }, () => filtrar().length) > 0);
    if(op){
      filtros.tipo = op[0]; aplicarFiltro(false);
      ok(filtros.tipo === op[0] && LISTA.length > 0 && LISTA.every(m => m.cat === 'Cámara'),
         `[3] "cámaras" + "${op[1]}": solo camaras de ese tipo`, LISTA.length);
    }
  }
  if(hay('Celular')){
    // Lo encontrado no cambia: "celulares" trae lo mismo que el rubro
    mbBuscar('celulares');
    const l = filtrar();
    ok(l.length === MODELOS.filter(m => m.cat === 'Celular').length, '[3] "celulares" sigue trayendo lo que traia (los del rubro)', l.length);
    // Una memoria con dos marcas o mas, para que haya botones que contar
    const cap = valoresDe('capacidad').find(v => mbConFiltros({ capacidad: v }, () => mbCuenta(filtrar(), 'marca').size) >= 2);
    if(cap){
      filtros.capacidad = cap; aplicarFiltro(false);
      ok(filtros.capacidad === cap && LISTA.length > 0 && LISTA.every(m => (m.variantes || [m]).some(v => capacidadDe(v) === cap) || capacidadDe(m) === cap),
         `[3] "celulares" + ${cap}: solo los de ${cap}`, LISTA.length);
      const chips = mbChips().slice(1).map(b => [b.dataset.marca, Number(mbTxt(b.querySelector('i')))]);
      const cuenta = mbCuenta(filtrar(), 'marca');
      ok(chips.length === cuenta.size && chips.every(([m, n]) => cuenta.get(m) === n),
         '[3] y los botones de marca cuentan con la memoria puesta', chips.map(x => x.join(' ')).join(', '));
    }else info('[3] hoy ninguna memoria de Celulares tiene dos marcas');
  }
  // Con la correccion de lo mal escrito: "celualres", y si ya esta lo de oido (#89), "selulares"
  if(hay('Celular')){
    mbBuscar('celulraes');
    const c = correccionDe('celulraes');
    if(c && c.hay) ok(rubrosDeLaBusqueda().includes('Celular'), '[3] "celulraes" (corregido a "celulares") nombra Celular', rubrosDeLaBusqueda().join(', '));
    if(typeof claveDeOido === 'function'){
      mbBuscar('selulares');
      ok(rubrosDeLaBusqueda().includes('Celular'), '[3] "selulares" (escrito de oido) nombra Celular', rubrosDeLaBusqueda().join(', '));
    }else info('[3] lo escrito de oido (#89) todavia no esta: no se prueba "selulares"');
  }

  /* ---- [4] Se sueltan al dejar de nombrarlo ---- */
  if(hay('Objetivo')){
    mbBuscar('lentes');
    const g = gruposDeFiltros().find(x => x.campo === 'montura');
    const mont = g && g.opciones.map(o => o.v).find(v => mbConFiltros({ montura: v }, () => filtrar().length) > 0);
    if(mont){
      filtros.montura = mont; aplicarFiltro(false);
      ok(filtros.montura === mont && LISTA.length > 0, `[4] "lentes" + montura ${mont}`, LISTA.length);
      filtros.q = 'lentes sony'; aplicarFiltro(false);
      ok(filtros.montura === mont, '[4] "lentes sony" sigue nombrando Objetivos: la montura queda');
      filtros.q = 'iphone'; aplicarFiltro(false);
      ok(filtros.montura === '' && LISTA.length > 0, '[4] "iphone" ya no: la montura se suelta y no deja la grilla vacia', LISTA.length);
      // Un link ?q=lentes&montura=…: se valida antes y despues de que llegue el catalogo
      mbLimpiar(); filtros.q = 'lentes'; filtros.montura = mont;
      sincronizarLentes();
      ok(filtros.montura === mont, '[4] un link ?q=lentes&montura=' + mont + ' la deja puesta');
      const guardados = MODELOS; MODELOS = []; NOMBRES_DE_RUBRO = null;
      try{ sincronizarLentes(); ok(filtros.montura === mont, '[4] tambien antes de que llegue el catalogo'); }
      finally{ MODELOS = guardados; NOMBRES_DE_RUBRO = null; }
      ok(new URLSearchParams(urlActual().split('?')[1] || '').get('montura') === mont, '[4] y va en la direccion', urlActual());
    }else info('[4] hoy no hay monturas en Objetivos');
  }
  if(hay('Celular')){
    mbBuscar('celulares');
    const cap = valoresDe('capacidad')[0];
    if(cap){
      filtros.capacidad = cap; aplicarFiltro(false);
      filtros.q = 'samsung'; aplicarFiltro(false);
      ok(filtros.capacidad === '', '[4] "celulares" + memoria → "samsung": la memoria se suelta (ya no hay rubro)');
    }
  }

  /* ---- [5] Lo que no cambia ---- */
  {
    // Una sola marca: sin botones ni Marca en el panel
    const una = ['iphone', 'macbook', 'dyson', 'samsung'].find(q => { mbBuscar(q); return LISTA.length && mbCuenta(filtrar(), 'marca').size === 1; });
    if(una){
      mbBuscar(una);
      ok(!mbChips().length && !mbTitulos().includes('Marca'), `[5] "${una}" es de una sola marca: sin botones ni Marca en Filtrar`, mbChips().length + ' / ' + mbTitulos().join(' / '));
    }
    // Todo el catalogo sin buscar: sin botones (rubro.js)
    mbLimpiar(); verTodoElCatalogo(); filtros.cat = ''; aplicarFiltro(false);
    ok(!mbChips().length && !mbTitulos().includes('Marca'), '[5] "Todo el catalogo" sin buscar: sin botones de marca, como siempre');
    mbLimpiar(); aplicarFiltro(false);
    // Adentro de un rubro: los botones del rubro, y Filtrar sin Marca; Limpiar no saca la marca
    const cat = 'Celular';
    if(hay(cat)){
      mbLimpiar(); entrarAlRubro(cat);
      const enRubro = marcasDisponibles().map(x => x[0]);
      ok(mbChips().slice(1).map(b => b.dataset.marca).join('|') === enRubro.join('|') && !mbTitulos().includes('Marca'),
         '[5] en Celulares, los botones del rubro y Filtrar sin Marca', mbTitulos().join(' / '));
      mbCab().querySelector('.marca-chip[data-marca]:not([data-marca=""])').click();
      const m = filtros.marca;
      mbCab().querySelector('.filtrar-btn').click();
      mbPanel().querySelector('[data-limpiar]').click();
      ok(filtros.marca === m && !!m, '[5] y Limpiar no saca la marca del rubro', filtros.marca);
      mbPanel()?.querySelector('.mf-cerrar')?.click();
      // Con busqueda adentro del rubro, los botones son los del rubro con esa busqueda
      mbLimpiar(); entrarAlRubro(cat); filtros.q = 'galaxy'; $('q').value = 'galaxy'; aplicarFiltro(false);
      ok(!rubrosDeLaBusqueda().length && mbChips().slice(1).every(b => b.dataset.marca && MODELOS.some(x => x.cat === cat && x.marca === b.dataset.marca)),
         '[5] "galaxy" en Celulares: los botones del rubro, como siempre');
    }
  }

  /* ---- [6] DP-13 con una marca elegida ---- */
  if(enTablets.size >= 2){
    mbBuscar('tablets');
    const m = [...enTablets.keys()][0];
    filtros.marca = m; aplicarFiltro(false);
    const primeraSin = LISTA.findIndex(x => !x.stock);
    ok(LISTA.length > 0 && (primeraSin === -1 || LISTA.slice(primeraSin).every(x => !x.stock)),
       `[6] DP-13 "tablets" + ${m}: lo sin stock al final`, LISTA.slice(0, 3).map(x => (x.stock ? '' : '[sin] ') + x.desc).join(' | '));
  }
  mbLimpiar(); $('q').value = ''; aplicarFiltro(false);
}
