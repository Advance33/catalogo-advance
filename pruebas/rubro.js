// El encabezado de cada rubro (15/09/2026). Reemplazó a la columna de filtros:
// nombre, cantidad, foto, marcas, Ordenar y Filtrar arriba de la grilla; al
// bajar, una versión fija; y el panel que abre Filtrar. Las cuentas se hacen
// acá con MODELOS a mano, sin pasar por filtrar(): una prueba que repite la
// cuenta del catálogo valida el error en vez de encontrarlo.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const $$ = s => document.querySelectorAll(s);

const esperar = setInterval(() => {
  if(!MODELOS.length || !$$('#cats .chip').length) return;
  clearInterval(esperar);
  for(let i=1;i<5000;i++) clearInterval(i);
  try{ correrPruebas(); }catch(e){ R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; }
  try{ pararPaseos(); }catch(e){}
  try{ pararOfertas(); }catch(e){}
  for(let i=1;i<5000;i++) clearInterval(i);
  const pre=document.createElement('pre'); pre.id='RESULTADO';
  pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
  document.body.appendChild(pre);
}, 150);

const deRubro = cat => MODELOS.filter(m => m.cat === cat);
const cab = () => $('rubro-cab');
const panel = () => $('filtros-panel');
const limpiar = () => Object.assign(filtros, {q:'', marca:'', rango:'', capacidad:'', ram:'', montura:'', apertura:'', soloStock:false, orden:'modelo'});

function correrPruebas(){
  document.documentElement.style.scrollBehavior = 'auto';

  /* ---- 1. En la portada no hay encabezado ---- */
  ok(enPortada() && cab().hidden && $('rubro-fijo').hidden, 'en la portada no aparece el encabezado');

  /* ---- 2. Adentro de Celulares ---- */
  limpiar();
  entrarAlRubro('Celular');
  const cel = deRubro('Celular');
  ok(!cab().hidden, 'al entrar a un rubro aparece su encabezado');
  ok(cab().querySelector('h2').textContent === plural('Celular'), 'con el nombre del rubro', cab().querySelector('h2').textContent);
  ok($('count').textContent.startsWith(cel.length + ' producto'), 'la cantidad es la del rubro',
     $('count').textContent + ' / ' + cel.length);
  const precios = cel.map(m => m.precio).filter(x => x !== null && x > 0);
  ok(cab().querySelector('.rc-tit p').textContent.includes('desde USD ' + plata(Math.min(...precios))),
     'y el "desde" es el precio mas bajo del rubro', cab().querySelector('.rc-tit p').textContent);
  const img = cab().querySelector('.rc-foto img');
  ok(img && cel.some(m => m.imagen === img.getAttribute('src')), 'la foto es de un producto del rubro');

  // Las marcas: las del rubro, con cuantos productos tiene cada una
  const chips = [...cab().querySelectorAll('.marca-chip')];
  const todas = chips.find(b => b.dataset.marca === '');
  ok(todas && Number(todas.querySelector('i').textContent) === cel.length, '"Todas" cuenta el rubro entero',
     todas && todas.textContent);
  const marcasReales = [...new Set(cel.map(m => m.marca))].sort().join(',');
  ok(chips.filter(b => b.dataset.marca).map(b => b.dataset.marca).sort().join(',') === marcasReales,
     'hay un boton por cada marca del rubro, ni una mas', marcasReales);
  const malContadas = chips.filter(b => b.dataset.marca &&
    Number(b.querySelector('i').textContent) !== cel.filter(m => m.marca === b.dataset.marca).length);
  ok(malContadas.length === 0, 'cada marca dice cuantos productos tiene de verdad',
     malContadas.map(b => b.textContent).join(', ') || 'todas bien');

  const marca = chips.filter(b => b.dataset.marca).sort((a, b) => Number(b.querySelector('i').textContent) - Number(a.querySelector('i').textContent))[0].dataset.marca;
  cab().querySelector(`.marca-chip[data-marca="${marca}"]`).click();
  ok(filtros.marca === marca && LISTA.length && LISTA.every(m => m.marca === marca), 'tocar una marca filtra por ella', marca);
  ok(cab().querySelector(`.marca-chip[data-marca="${marca}"]`).getAttribute('aria-pressed') === 'true', 'y queda marcada');
  cab().querySelector(`.marca-chip[data-marca="${marca}"]`).click();
  ok(filtros.marca === '', 'tocarla de nuevo la saca');

  /* ---- 3. Ordenar va aparte y ordena ---- */
  const ordenBtn = cab().querySelector('.orden-btn');
  ok(/Ordenar/.test(ordenBtn.textContent), 'el boton dice "Ordenar"', ordenBtn.textContent.trim());
  ordenBtn.click();
  const menu = cab().querySelector('.orden-menu');
  ok(!menu.hidden, 'abre sus opciones');
  ok(!menu.querySelector('[data-orden="cat"]'), 'adentro de un rubro no ofrece "Agrupado por rubro"');
  menu.querySelector('[data-orden="asc"]').click();
  // Lo que tiene stock va siempre adelante; adentro de cada grupo, por precio
  const creciente = l => { const pr = l.map(m => m.precio).filter(x => x !== null); return pr.every((p, i) => i === 0 || pr[i - 1] <= p); };
  ok(filtros.orden === 'asc' && creciente(LISTA.filter(m => m.stock)) && creciente(LISTA.filter(m => !m.stock)),
     'y "Menor precio" ordena de verdad');
  filtros.orden = 'modelo'; aplicarFiltro(false);

  /* ---- 4. El panel de Filtrar ---- */
  cab().querySelector('.filtrar-btn').click();
  ok(!!panel(), 'Filtrar abre el panel');
  const titulos = () => [...panel().querySelectorAll('.mf-rot')].map(x => x.textContent);
  ok(['Precio', 'Capacidad', 'Memoria', 'Stock'].every(t => titulos().includes(t)) && !titulos().includes('Montura'),
     'en Celulares filtra precio, capacidad, memoria y stock', titulos().join(' / '));
  const opsCap = [...panel().querySelectorAll('[data-campo="capacidad"]')];
  const capMal = opsCap.filter(b => Number(b.querySelector('i').textContent) !==
    cel.filter(m => m.variantes.some(v => capacidadDe(v) === b.dataset.v)).length);
  ok(opsCap.length > 1 && capMal.length === 0, 'cada capacidad dice cuantos productos tiene de verdad',
     capMal.map(b => b.textContent).join(', ') || opsCap.map(b => b.textContent).join(', '));
  ok([...panel().querySelectorAll('.op-chip')].every(b => b.getAttribute('aria-pressed') === 'true' || Number(b.querySelector('i').textContent) > 0),
     'no ofrece opciones que dejarian la grilla vacia');

  const cap = opsCap[0].dataset.v;
  opsCap[0].click();
  ok(filtros.capacidad === cap && LISTA.every(m => m.variantes.some(v => capacidadDe(v) === cap)),
     'elegir una capacidad filtra al toque', cap + ': ' + LISTA.length);
  ok(panel() && panel().querySelector('.pri').textContent.includes(String(LISTA.length)),
     'y el boton dice cuantos quedan', panel() && panel().querySelector('.pri').textContent);
  ok(/1/.test(cab().querySelector('.filtrar-btn b')?.textContent || ''), 'el boton Filtrar cuenta el filtro puesto');
  panel().querySelector('[data-limpiar]').click();
  ok(filtros.capacidad === '' && LISTA.length === cel.length, '"Limpiar" saca los filtros del panel');
  panel().querySelector('.mf-cerrar').click();
  ok(!panel(), 'y la cruz cierra el panel');

  // Lo elegido aparece arriba con su cruz, y la cruz lo saca
  filtros.rango = RANGOS.find(r => cel.some(m => m.variantes.some(v => v.precio >= r[2] && v.precio < r[3])))[0];
  aplicarFiltro(false);
  const cruz = cab().querySelector('.activo[data-quitar="rango"]');
  ok(!!cruz, 'el filtro elegido aparece arriba de los productos', cruz && cruz.textContent);
  cruz && cruz.click();
  ok(filtros.rango === '', 'y tocar su cruz lo saca');

  /* ---- 5. Lo fijo al bajar ---- */
  limpiar(); aplicarFiltro(false);
  scrollTo(0, 0); revisarFijo();
  ok(!$('rubro-fijo').classList.contains('visible'), 'arriba de todo, lo fijo no aparece');
  scrollTo(0, document.documentElement.scrollHeight); revisarFijo();
  const fijo = $('rubro-fijo');
  ok(fijo.classList.contains('visible') && !fijo.inert, 'al bajar, aparece lo fijo');
  ok(fijo.querySelectorAll('.marca-chip').length === chips.length, 'con las mismas marcas que el encabezado');
  fijo.querySelector(`.marca-chip[data-marca="${marca}"]`).click();
  revisarFijo();
  ok(filtros.marca === marca, 'tocar una marca en lo fijo tambien filtra', marca);
  ok(cab().getBoundingClientRect().top >= 0 && !$('rubro-fijo').classList.contains('visible'),
     'y vuelve al encabezado para que se vea lo elegido', Math.round(cab().getBoundingClientRect().top));

  /* ---- 6. Objetivos: otros filtros ---- */
  limpiar();
  entrarAlRubro('Objetivo');
  cab().querySelector('.filtrar-btn').click();
  ok(['Precio', 'Montura', 'Apertura', 'Stock'].every(t => titulos().includes(t)) && !titulos().includes('Capacidad'),
     'en Objetivos filtra precio, montura, apertura y stock', titulos().join(' / '));
  const montura = panel().querySelector('[data-campo="montura"]');
  montura.click();
  ok(filtros.montura === montura.dataset.v, 'elegir una montura filtra', montura.dataset.v);
  panel().querySelector('.mf-cerrar').click();
  entrarAlRubro('Celular');
  ok(filtros.montura === '', 'al irse a otro rubro, la montura no queda puesta');

  /* ---- 7. El catalogo entero ---- */
  limpiar();
  verTodoElCatalogo(); filtros.cat = ''; aplicarFiltro(false);
  ok(!cab().hidden && /catálogo/i.test(cab().querySelector('h2').textContent), 'el catalogo entero tambien tiene encabezado');
  ok(cab().querySelectorAll('.marca-chip').length === 0, 'sin botones de marca: serian veinte y pico sin rubro');
  cab().querySelector('.orden-btn').click();
  ok(!!cab().querySelector('.orden-menu [data-orden="cat"]'), 'y ahi si ofrece "Agrupado por rubro"');
  cerrarMenusOrden();
  ok(!$('sugeridos').hidden && $('sugeridos').compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_PRECEDING,
     '"Te puede servir" va debajo de los productos');
  limpiar();
}
