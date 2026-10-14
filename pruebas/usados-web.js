// La seccion de usados de la web (Benja, 13-14/10/2026): iPhone usados de un
// solo proveedor, cargados a mano en ADVAPP como productos del padron con
// Condicion "Usado". Hoy ADVAPP no manda ninguno, asi que esta tanda le agrega
// a la respuesta de ADVAPP, ADENTRO de la pagina (fetch envuelto), seis filas
// de ejemplo con la forma en que llegaria un usado (usados-carga.md, 13/10), y
// vuelve a cargar con actualizar(). El feed de verdad no se toca: al final se
// carga otra vez sin ellas y todo tiene que volver a como estaba.
//   [0] sin ningun usado no se ve nada: ni chip, ni mundo, ni rubro, y la
//       pregunta "¿Los productos son nuevos?" queda como D14 A
//   [1] el rubro "Usado" (plural "Usados"): cada usado sale de su categoria
//       (Celular) y cuenta en el suyo; el chip al final de la cinta; el mundo
//       "Usados seleccionados" del tamaño normal, sin pisar a los demas; el
//       encabezado; ?cat=Usados lo abre y un ?cat=Celular viejo no los mezcla.
//       La marca "iPhone" que manda ADVAPP pasa a Apple; "Celular Usado" con
//       la Condicion vacia tambien es usado
//   [2] una tarjeta por equipo: dos del mismo modelo, memoria, color y SKU
//       madre son dos tarjetas; uno con el SKU madre del nuevo no se mete en
//       la tarjeta del nuevo
//   [3] la tarjeta es la de los nuevos con el rotulo "Usado" (y con cuotas)
//   [4] la ficha: el rotulo, la bateria y el estado (Detalle), "Condicion:
//       Usado", la garantia que viene en la columna y, si no viene, ninguna
//       inventada; las cuotas como en los nuevos; sin pestañas de otros equipos
//   [5] el WhatsApp dice "usado" y el codigo del equipo; lo nuevo, sin codigo
//   [6] la pregunta frecuente con el texto que aprobo Benja
//   [7] las vitrinas de la portada que mezclan rubros no muestran usados
//   [8] el link de un usado vendido no abre otro equipo ni el nuevo
//   [9] la busqueda: "usado" los trae; con el modelo, van al final
//  [10] las fotos del equipo salen de ADVAPP aunque no tengan codigo AT: la
//       primera en la tarjeta, todas en la ficha (tocar una la pone grande);
//       las fotos de lo nuevo, exactamente las mismas que sin usados
//  [11] la bateria en la tarjeta, "Batería 88%", solo si el Detalle la dice
//       sin dudas
//  [12] la foto ilustrativa (Benja, 14/10/2026): el usado sin ninguna foto
//       suya muestra la del mismo modelo nuevo y del mismo color, con el
//       cartel "Foto ilustrativa" en la tarjeta, en la ficha y en el visor
//       (tambien a 390 px) y en el texto alternativo. El modelo, por la madre
//       sin el tramo del equipo (CEL-APL-16PMU0007 -> CEL-APL-16PM) o, sin
//       madre, por el nombre; otra memoria y la eSIM no importan. Un color que
//       el nuevo no tiene: sin foto, como antes. Con foto suya (ADVAPP o el
//       archivo de su codigo): la suya, sin cartel. La vista previa de
//       WhatsApp y og:image/datos para Google de las paginas no la usan. Lo
//       nuevo, igual que sin usados
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);
const $$ = s => document.querySelectorAll(s);

const UW_HOY = new Date().toISOString();
// Una fila como la manda ADVAPP (contrato landing/1.4, con la columna Garantia del PR #86)
const uwFila = c => Object.assign({
  'ID': '', 'Categoría': 'Celular', 'Marca': 'iPhone', 'Modelo': '', 'Descripción completa': '',
  'Precio USD': '', 'Color': '', 'Stock': 'Sí', 'Términos de búsqueda': '', 'Última actualización': UW_HOY,
  'Activo': 'Sí', 'Incluye': 'Solo el equipo', 'Teclado': '', 'Condición': 'Usado', 'Detalle': '',
  'Imagen': '', 'Precio anterior': '', 'Grupo': '', 'SKU': '', 'SKU_COLOR': '', 'CODIGO': '',
  'CODIGO_VAR': '', 'SKU_MADRE': '', 'SKU_MADRE_SLUG': '', 'SKU_VARIANTE': '', 'Promo': '', 'Orden': '',
  'Garantía': '', 'SKUS': []
}, c);
const UW_FILAS = [
  // Dos iPhone 15 iguales (modelo, memoria, color y madre): dos equipos
  uwFila({ 'ID': 'UW-USADO-1', 'Modelo': 'IPHONE 15', 'Descripción completa': 'iPhone 15 128GB Sim (Blue)',
           'Precio USD': '520', 'Color': 'Blue', 'Detalle': 'Batería 91 %. Sin marcas de uso.', 'Garantía': '30 días',
           'CODIGO': 'AT-0065', 'CODIGO_VAR': 'AT-0065-02', 'SKU_MADRE': 'CEL-APL-15US',
           'SKU_VARIANTE': 'CEL-APL-15US-128-BLU-U0001' }),
  uwFila({ 'ID': 'UW-USADO-2', 'Modelo': 'IPHONE 15', 'Descripción completa': 'iPhone 15 128GB Sim (Blue)',
           'Precio USD': '495', 'Color': 'Blue', 'Detalle': 'Batería 86 %. Un rayón chico en el marco.',
           'CODIGO': 'AT-0065', 'CODIGO_VAR': 'AT-0065-02', 'SKU_MADRE': 'CEL-APL-15US',
           'SKU_VARIANTE': 'CEL-APL-15US-128-BLU-U0002' }),
  // Con el SKU madre del 16 Pro Max nuevo y la marca Apple
  uwFila({ 'ID': 'UW-USADO-3', 'Marca': 'Apple', 'Modelo': 'IPHONE 16 PRO MAX',
           'Descripción completa': 'iPhone 16 Pro Max 256GB (Desert Titanium)', 'Precio USD': '980',
           'Color': 'Desert Titanium', 'Detalle': 'Batería 94 %. Con caja.', 'Garantía': '30 días',
           'CODIGO': 'AT-0068', 'CODIGO_VAR': 'AT-0068-02', 'SKU_MADRE': 'CEL-APL-16PM',
           'SKU_VARIANTE': 'CEL-APL-16PM-256-DST-U0003' }),
  // Vendido sin dar de baja: sin stock, y sin foto
  uwFila({ 'ID': 'UW-USADO-4', 'Modelo': 'IPHONE 13', 'Descripción completa': 'iPhone 13 128GB (Midnight)',
           'Precio USD': '390', 'Color': 'Midnight', 'Stock': 'No', 'Detalle': 'Batería 88 %.',
           'SKU_MADRE': 'CEL-APL-13US', 'SKU_VARIANTE': 'CEL-APL-13US-128-MID-U0004' }),
  // Lo que pasa si alguien toca "Guardar datos" en la ficha de LISTAS: la
  // categoria llega "Celular Usado" (riesgo 9 de usados-carga.md); aca ademas
  // con la Condicion vacia
  uwFila({ 'ID': 'UW-USADO-5', 'Categoría': 'Celular Usado', 'Condición': '', 'Modelo': 'IPHONE 14',
           'Descripción completa': 'iPhone 14 128GB (Purple)', 'Precio USD': '450', 'Color': 'Purple',
           'Detalle': 'Batería entre 85 y 90 %.', 'CODIGO': 'AT-0064', 'CODIGO_VAR': 'AT-0064-02',
           'SKU_MADRE': 'CEL-APL-14US', 'SKU_VARIANTE': 'CEL-APL-14US-128-PUR-U0005' }),
  // Como lo carga ADVAPP desde el 14/10 (PR #96): ID propio, sin codigo AT y
  // con las fotos que le subio Benja en SKUS, sin `at`
  uwFila({ 'ID': 'UW-USADO-6', 'Modelo': 'IPHONE 13', 'Descripción completa': 'iPhone 13 128GB (Starlight)',
           'Precio USD': '470', 'Color': 'Starlight', 'Detalle': 'batería al 87 %. Marca en el marco.', 'Garantía': '30 días',
           'SKU_MADRE': 'CEL-APL-13U0006', 'SKU_VARIANTE': 'CEL-APL-13U0006-128-STL-000',
           'SKUS': [{ sku: 'CEL-APL-13U0006-128-STL-000', at: null,
                      fotos: ['https://advapp.invalid/tecno-productos/skus/usado-0006-a.jpg',
                              'https://advapp.invalid/tecno-productos/skus/usado-0006-b.jpg',
                              'https://advapp.invalid/tecno-productos/skus/usado-0006-c.jpg'] }] }),
  // [12] La foto ilustrativa (14/10/2026). Como los carga ADVAPP desde la lista
  // de LUCAS IMPORT: ID propio, madre del nuevo con la U y el numero, el color
  // con el nombre oficial, sin codigo AT y sin fotos.
  // El 16 Pro Max de 1TB Black Titanium: el nuevo no tiene 1TB (la foto es la
  // misma) y es el mas caro de los usados (el mundo prefiere una foto propia)
  uwFila({ 'ID': 'UW-USADO-7', 'Marca': 'Apple', 'Modelo': 'IPHONE 16 PRO MAX',
           'Descripción completa': 'iPhone 16 Pro Max 1TB (Black Titanium)', 'Precio USD': '1150',
           'Color': 'Black Titanium', 'Detalle': 'Batería 90 %.', 'Garantía': '30 días',
           'SKU_MADRE': 'CEL-APL-16PMU0007', 'SKU_VARIANTE': 'CEL-APL-16PMU0007-1TB-BLK-000' }),
  // eSIM, y el iPhone 15 nuevo es Sim: la foto es la misma
  uwFila({ 'ID': 'UW-USADO-8', 'Modelo': 'IPHONE 15', 'Descripción completa': 'iPhone 15 128GB E-Sim (Pink)',
           'Precio USD': '540', 'Color': 'Pink', 'SKU': 'celular~apple~15-iphone-usado-u0008~128-esim',
           'SKU_MADRE': 'CEL-APL-15U0008', 'SKU_VARIANTE': 'CEL-APL-15U0008-128-PNK-ESIM' }),
  // Un color que el 16 Pro Max nuevo no tiene: sin foto (otro color engaña)
  uwFila({ 'ID': 'UW-USADO-9', 'Marca': 'Apple', 'Modelo': 'IPHONE 16 PRO MAX',
           'Descripción completa': 'iPhone 16 Pro Max 256GB (Pink)', 'Precio USD': '900', 'Color': 'Pink',
           'SKU_MADRE': 'CEL-APL-16PMU0009', 'SKU_VARIANTE': 'CEL-APL-16PMU0009-256-PNK-000' }),
  // Sin madre: el mismo modelo, por el nombre
  uwFila({ 'ID': 'UW-USADO-10', 'Marca': 'Apple', 'Modelo': 'IPHONE 16 PRO MAX',
           'Descripción completa': 'iPhone 16 Pro Max 256GB (Natural)', 'Precio USD': '960', 'Color': 'Natural' }),
  // Con una foto suya en ADVAPP: la suya, sin cartel
  uwFila({ 'ID': 'UW-USADO-11', 'Marca': 'Apple', 'Modelo': 'IPHONE 16 PRO MAX',
           'Descripción completa': 'iPhone 16 Pro Max 256GB (Desert Titanium)', 'Precio USD': '990',
           'Color': 'Desert Titanium', 'SKU_MADRE': 'CEL-APL-16PMU0011', 'SKU_VARIANTE': 'CEL-APL-16PMU0011-256-DST-000',
           'SKUS': [{ sku: 'CEL-APL-16PMU0011-256-DST-000', at: null,
                      fotos: ['https://advapp.invalid/tecno-productos/skus/usado-0011-a.jpg'] }] }),
];
const UW_FOTOS = UW_FILAS[5]['SKUS'][0].fotos;
const UW_N = UW_FILAS.length;
const UW_IDS = UW_FILAS.map(f => f['ID']);
const UW_APROBADO = 'Sí, todo es nuevo y sellado, salvo los de la sección Usados, que lo dicen en su tarjeta y en su ficha. Los de caja blanca vienen sin la caja original y también lo dice la ficha.';
const UW_D14 = 'Sí, nuevos. Los de caja blanca vienen sin la caja original y lo dice la ficha.';
const uwEsUsadoCrudo = p => RE_USADO.test(norm(p['Condición'] || '')) || RE_USADO.test(norm(p['Categoría'] || ''));

/* Carga otra vez la pagina con la respuesta de ADVAPP cambiada: sin los
   usados que traiga de verdad (para que lo de abajo no dependa del dia) y
   con `agregar` al final. Sin `cambiar`, la de verdad. */
async function uwCargar(agregar){
  const antes = window.fetch;
  if(agregar){
    window.fetch = (url, opts) => {
      const u = String(url);
      if(!ADVAPP_URL || !u.startsWith(ADVAPP_URL)) return antes(url, opts);
      return antes(url, opts).then(r => r.json()).then(j => {
        j.productos = j.productos.filter(p => !uwEsUsadoCrudo(p)).concat(agregar);
        j.filas = j.productos.length;
        if(Array.isArray(j.columnas) && !j.columnas.includes('Garantía')) j.columnas.push('Garantía');
        return new Response(JSON.stringify(j), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });
    };
  }
  try{ await actualizar(false); } finally { window.fetch = antes; }
  for(let i=1;i<5000;i++) clearInterval(i);
  try{ pararPaseos(); pararOfertas(); pararNuevos(); pararMarcas(); pararMundos(); }catch(e){}
}

/* [12] Lo mismo adentro de un iframe (el celular de 390 px): la pagina del
   iframe es otra, con su propio fetch y su propio ADVAPP_URL. */
async function uwCargarEn(w, agregar){
  const url = w.eval('ADVAPP_URL'), antes = w.fetch;
  w.fetch = (u, o) => {
    if(!url || !String(u).startsWith(url)) return antes.call(w, u, o);
    return antes.call(w, u, o).then(r => r.json()).then(j => {
      j.productos = j.productos.filter(p => !uwEsUsadoCrudo(p)).concat(agregar);
      j.filas = j.productos.length;
      if(Array.isArray(j.columnas) && !j.columnas.includes('Garantía')) j.columnas.push('Garantía');
      return new w.Response(JSON.stringify(j), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
  };
  try{ await w.actualizar(false); } finally { w.fetch = antes; }
  try{ w.pararPaseos(); w.pararOfertas(); w.pararNuevos(); w.pararMarcas(); w.pararMundos(); }catch(e){}
}
const uwDormir = ms => new Promise(r => setTimeout(r, ms));
async function uwEsperarA(cond, ms = 25000){
  const t0 = Date.now();
  while(Date.now() - t0 < ms){
    try{ if(cond()) return true; }catch(e){}
    await uwDormir(150);
  }
  return false;
}
// Un script de herramientas/ (vista-previa.js, paginas-producto.js), como
// decision-vista-previa.js. Hasta tres veces: con la suite entera, el servidor
// local a veces corta una conexion mientras la pagina baja las fotos (paso una
// vez en la primera corrida de esta tanda, 14/10/2026)
function uwScript(src, vez = 1){
  return new Promise((si, no) => {
    const s = document.createElement('script');
    s.src = src + '?_=' + Date.now();
    s.onload = si; s.onerror = () => { s.remove(); no(new Error('no se pudo cargar ' + src)); };
    document.head.appendChild(s);
  }).catch(e => vez < 3 ? uwDormir(500 * vez).then(() => uwScript(src, vez + 1)) : Promise.reject(e));
}
// Las cajas: `a` adentro de `b`, y si dos se pisan
const uwAdentro = (a, b) => a.left >= b.left - 1 && a.right <= b.right + 1 && a.top >= b.top - 1 && a.bottom <= b.bottom + 1;
const uwPisan = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
const uwCaja = r => r ? Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) : '-';
// Donde se ve la foto de la ficha: cuadrada (como todas las de fotos/), centrada en el marco
const uwCuadro = r => {
  const s = Math.min(r.width, r.height), x = r.left + (r.width - s) / 2, y = r.top + (r.height - s) / 2;
  return { left: x, top: y, right: x + s, bottom: y + s, width: s, height: s };
};

const uwChips = () => [...$$('#cats .chip:not(.clon)')];
const uwMundoUsados = () => [...$$('#mosaico .mundo')].find(t => /usados/i.test(t.querySelector('h3')?.textContent || ''));
const uwFaq = () => {
  const i = PREGUNTAS.findIndex(q => q.p === '¿Los productos son nuevos?');
  const r = i >= 0 && document.getElementById('ay-r-' + i);
  return r ? [...r.querySelectorAll('p')].map(p => p.textContent.trim()).join(' ') : null;
};
function uwGrilla(cambios){
  const antes = { ...filtros };
  Object.assign(filtros, { q: '', cat: '', marca: '', rango: '', soloStock: false, orden: ORDEN_DEF }, cambios);
  try{ return listaDeLaGrilla(); } finally { Object.assign(filtros, antes); }
}
const uwEsDeEjemplo = m => (m.variantes || [m]).some(v => UW_IDS.includes(v.id));
const uwTexto = el => (el && el.textContent || '').replace(/\s+/g, ' ').trim();
const uwWA = href => { try{ return decodeURIComponent(String(href).split('text=')[1] || ''); }catch(e){ return ''; } };

const esperaUW = setInterval(() => {
  if(!MODELOS.length || !$$('#cats .chip').length || !$$('#mosaico .mundo').length) return;
  clearInterval(esperaUW);
  for(let i=1;i<5000;i++) clearInterval(i);
  correrUW()
    .catch(e => { R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; })
    .finally(() => {
      try{ frenarReintentos(); }catch(e){}
      try{ pararPaseos(); pararOfertas(); pararNuevos(); pararMarcas(); pararMundos(); }catch(e){}
      for(let i=1;i<5000;i++) clearInterval(i);
      const pre=document.createElement('pre'); pre.id='RESULTADO';
      pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
      document.body.appendChild(pre);
    });
}, 150);

async function correrUW(){
  document.documentElement.style.scrollBehavior = 'auto';
  ok(FUENTE && FUENTE.fuente === 'advapp', 'la pagina cargo desde ADVAPP (lo demas lo da por hecho)', FUENTE && FUENTE.fuente);
  const reales = PRODUCTOS.filter(esUsado).length;
  info(reales ? 'hoy ADVAPP manda ' + reales + ' usado(s): se sacan para [0] y para el ejemplo'
              : 'hoy ADVAPP no manda ningun usado');

  /* ---- [0] Sin usados no se ve nada ---- */
  await uwCargar([]);
  irAlInicio();
  ok(!PRODUCTOS.some(esUsado) && !MODELOS.some(m => m.cat === CAT_USADO), '[0] sin usados en ADVAPP no hay ningun producto en el rubro Usado');
  ok(!uwChips().some(b => b.dataset.cat === CAT_USADO), '[0] ni chip "Usados" en la cinta', uwChips().map(b => b.textContent).slice(-3).join(' · '));
  ok(!mundosDeLaPortada().some(w => w.rubros.includes(CAT_USADO)) && !uwMundoUsados(), '[0] ni mundo de usados en la portada',
     [...$$('#mosaico .mundo h3')].map(uwTexto).join(' · '));
  ok(!haySeccionUsados() && uwFaq() === UW_D14, '[0] y "¿Los productos son nuevos?" dice lo de D14 A', uwFaq());
  const sinMundos = [...$$('#mosaico .mundo')].length;
  const fotosSinUsados = new Map(PRODUCTOS.map(p => [clave(p), [p.imagen, p.imagenGrande]]));
  // [12] La foto de cada tarjeta de lo nuevo sin usados: la clase, la foto, su
  // texto alternativo y si lleva el cartel
  const uwFotoTarjeta = m => {
    const f = tarjeta(m).querySelector('.foto'), img = f && f.querySelector('img');
    return f ? [f.className, img && img.getAttribute('src'), img && img.getAttribute('alt'), !!f.querySelector('.foto-ilus')].join('|') : '';
  };
  const tarjetasSinUsados = new Map(MODELOS.map(m => [clave(m.rep), uwFotoTarjeta(m)]));

  /* ---- Con los usados de ejemplo ---- */
  await uwCargar(UW_FILAS);
  irAlInicio();
  const filas = UW_IDS.map(buscarProducto);
  ok(filas.every(Boolean), 'las filas de ejemplo llegaron a la pagina', filas.filter(Boolean).length + ' de ' + UW_N);
  if(!filas.every(Boolean)) return;
  const [u1, u2, u3, u4, u5, u6] = filas;

  /* ---- [1] El rubro ---- */
  ok(filas.every(p => p.cat === CAT_USADO && esUsado(p)), '[1] los usados de ejemplo estan en el rubro "Usado"', filas.map(p => p.cat).join(','));
  ok(u1.catPlanilla === 'Celular' && u5.catPlanilla === 'Celular Usado', '[1] la categoria de ADVAPP queda en catPlanilla (la firma de las fotos)', u1.catPlanilla + ' / ' + u5.catPlanilla);
  ok(u1.marca === 'Apple' && u1.marcaPlanilla === 'iPhone' && u3.marca === 'Apple' && !u3.marcaPlanilla,
     '[1] la marca "iPhone" que manda ADVAPP pasa a Apple, como la de los nuevos', u1.marca + ' / ' + u1.marcaPlanilla);
  ok(u5.condicion === 'Usado' && !!htmlUsado(u5), '[1] "Celular Usado" con la Condicion vacia tambien es usado, con su rotulo', u5.condicion);
  ok(u1.codigo === 'AT-0065' && !!u1.imagen, '[1] la foto se sigue encontrando (codigo y firma con lo de ADVAPP)', u1.codigo + ' ' + (u1.imagen || '').split('/').pop());
  ok(plural(CAT_USADO) === 'Usados', '[1] el plural es "Usados"', plural(CAT_USADO));
  const chips = uwChips();
  const chipU = chips.find(b => b.dataset.cat === CAT_USADO);
  ok(!!chipU && chipU.textContent.trim() === 'Usados', '[1] la cinta tiene el chip "Usados"', chipU && chipU.textContent);
  ok(chipU && chips[chips.length - 1] === chipU, '[1] y va al final, como en las listas', chips.slice(-3).map(b => b.textContent).join(' · '));
  ok(MODELOS.filter(m => m.cat === 'Celular').every(noEsUsado) && uwGrilla({ cat: 'Celular' }).every(m => !uwEsDeEjemplo(m)),
     '[1] en Celulares no queda ningun usado mezclado');

  // El mundo
  const w = mundosDeLaPortada().find(x => x.rubros.includes(CAT_USADO));
  ok(!!w && w.nombre === 'Usados seleccionados' && w.rubros.length === 1 && w.tamano === '',
     '[1] el mundo "Usados seleccionados", solo con el rubro Usados y del tamaño normal', w && [w.nombre, w.rubros.join('+'), w.tamano || 'normal'].join(' · '));
  ok(!!w && w.n === UW_N, '[1] cuenta todos (con y sin stock, como los demas mundos)', w && w.n);
  ok(!!w && w.desde === 450, '[1] el "Desde" del mundo es el mas barato con stock', w && w.desde);
  const t = uwMundoUsados();
  ok(!!t && !/mundo-(alto|grande|otros)/.test(t.className), '[1] la tarjeta del mundo esta en la portada', t && t.className);
  ok([...$$('#mosaico .mundo')].length === sinMundos + 1, '[1] es una tarjeta mas: los otros mundos siguen', sinMundos + ' -> ' + $$('#mosaico .mundo').length);
  if(t){
    const b = t.querySelector('.rubro');
    ok(!!b && b.dataset.cat === CAT_USADO && uwTexto(b).replace(/\s/g, '') === 'Usados' + UW_N, '[1] con su boton "Usados ' + UW_N + '"', b && uwTexto(b));
    ok(uwTexto(t.querySelector('.mundo-cab p')) === UW_N + ' productos · Desde USD 450', '[1] y "' + UW_N + ' productos · Desde USD 450"', uwTexto(t.querySelector('.mundo-cab p')));
    // Que no desarme la grilla: ninguna tarjeta se pisa con otra
    const rs = [...$$('#mosaico .mundo')].map(x => x.getBoundingClientRect());
    const pisan = [];
    rs.forEach((a, i) => rs.forEach((c, j) => { if(j > i && a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1) pisan.push(i + '/' + j); }));
    ok(!pisan.length, '[1] ningun mundo se pisa con otro (1920 px)', pisan.join(' ') || rs.length + ' tarjetas');
    const dy = [...$$('#mosaico .mundo')].find(x => /dyson/i.test(x.querySelector('h3')?.textContent || ''));
    if(dy) ok(Math.abs(dy.getBoundingClientRect().top - t.getBoundingClientRect().top) < 2, '[1] y va en la fila de Dyson, que tenia lugar');
    // Tocarlo abre el rubro
    b && b.click();
    ok(filtros.cat === CAT_USADO && !enPortada(), '[1] el boton del mundo abre el rubro', filtros.cat);
    const cab = document.getElementById('rubro-cab');
    ok(/Usados/.test(uwTexto(cab && cab.querySelector('h2'))), '[1] el encabezado dice "Usados"', uwTexto(cab && cab.querySelector('h2')));
    ok(/Desde USD 450/.test(uwTexto(cab)), '[1] con el "Desde" de lo que tiene stock', uwTexto(cab).slice(0, 80));
    ok(location.search.includes('cat=Usado'), '[1] y la direccion ?cat=Usado', location.search);
    const lista = LISTA.slice();
    ok(lista.length === UW_N && lista.every(uwEsDeEjemplo), '[1] adentro, solo los usados', lista.length);
    ok(lista[lista.length - 1].variantes[0].id === 'UW-USADO-4', '[1] el que no tiene stock, al final');
    irAlInicio();
  }
  // Los links
  history.replaceState(null, '', location.pathname + '?cat=Usados');
  leerURL(); armarFiltros(); aplicarFiltro(false);
  ok(filtros.cat === CAT_USADO && LISTA.length === UW_N, '[1] ?cat=Usados (como dice el chip) abre el rubro', filtros.cat + ' ' + LISTA.length);
  history.replaceState(null, '', location.pathname + '?cat=Celular');
  leerURL(); armarFiltros(); aplicarFiltro(false);
  ok(filtros.cat === 'Celular' && LISTA.length > 0 && !LISTA.some(uwEsDeEjemplo) && !LISTA.some(esUsadoModelo),
     '[1] un link viejo ?cat=Celular no muestra usados', LISTA.length + ' tarjetas');
  irAlInicio();

  /* ---- [2] Una tarjeta por equipo ---- */
  const m1 = buscarModelo('UW-USADO-1'), m2 = buscarModelo('UW-USADO-2'), m3 = buscarModelo('UW-USADO-3');
  ok(m1 && m2 && m1 !== m2 && m1.variantes.length === 1 && m2.variantes.length === 1,
     '[2] dos iPhone 15 iguales (modelo, memoria, color y SKU madre) son dos tarjetas', m1 && m2 && (m1.variantes.length + ' y ' + m2.variantes.length + ' versiones'));
  ok(familia(u1) === 'U:UW-USADO-1' && familia(u2) === 'U:UW-USADO-2', '[2] la familia de un usado es su fila (U:ID)', familia(u1));
  const nuevo16 = MODELOS.find(m => m.cat === 'Celular' && m.variantes.some(v => madreDelSku(v.skuVariante) === 'CEL-APL-16PM'));
  ok(!!m3 && m3.variantes.length === 1 && (!nuevo16 || !nuevo16.variantes.includes(u3)),
     '[2] el usado con el SKU madre del 16 Pro Max nuevo no se mete en su tarjeta', nuevo16 ? nuevo16.variantes.length + ' versiones del nuevo' : 'hoy no hay 16 Pro Max nuevo');
  ok(UW_IDS.every(id => MODELOS.filter(m => m.variantes.some(v => v.id === id)).length === 1), '[2] cada equipo esta en una sola tarjeta');

  /* ---- [3] La tarjeta ---- */
  // Un celular nuevo comparable: con stock, un solo precio y sin promo
  const nuevo = MODELOS.find(m => m.cat === 'Celular' && m.stock && m.precio !== null && noEsUsado(m) && !conDesde(m) && !ahorro(m))
             || MODELOS.find(m => m.cat === 'Celular' && m.stock && m.precio !== null && noEsUsado(m));
  const c1 = tarjeta(m1), cn = nuevo && tarjeta(nuevo);
  ok(uwTexto(c1.querySelector('.usado-tag')) === 'Usado', '[3] la tarjeta del usado dice "Usado"', uwTexto(c1.querySelector('.usado-tag')));
  ok(!!cn && !cn.querySelector('.usado-tag'), '[3] la del nuevo no');
  // Las partes de la tarjeta, sin lo que depende del producto (regalo, promo, "Desde", la linea tecnica)
  const forma = el => [...el.querySelectorAll('*')].map(x => x.className && typeof x.className === 'string' ? x.className.split(' ')[0] : x.tagName)
                       .filter(x => !/usado-tag|cinta|badge|ahorro|antes|destacado|desde|tecnica/.test(x)).join(',');
  ok(!!cn && forma(c1.querySelector('.cuerpo')) === forma(cn.querySelector('.cuerpo')), '[3] y es la misma tarjeta que la de un nuevo (mismas partes)',
     cn && (forma(c1.querySelector('.cuerpo')).slice(0, 60) + ' | ' + forma(cn.querySelector('.cuerpo')).slice(0, 60)));
  ok(/USD 520/.test(uwTexto(c1.querySelector('.plata'))), '[3] con su precio', uwTexto(c1.querySelector('.plata')));
  if(maxCuotas() > 0){
    ok(conCuotas(u1) && !!c1.querySelector('.cq:not(.vacio)') && uwTexto(c1.querySelector('.cq')) === uwTexto(cn.querySelector('.cq')),
       '[3] y con cuotas, igual que los nuevos', uwTexto(c1.querySelector('.cq')));
  } else info('[3] hoy no hay planes de cuotas: no se miran');
  ok(!!tarjeta(buscarModelo('UW-USADO-5')).querySelector('.usado-tag'), '[3] el de "Celular Usado" tambien dice "Usado"');

  /* ---- [4] La ficha ---- */
  abrirFicha('UW-USADO-1', false);
  let d = document.getElementById('ficha');
  ok(!!d && FICHA === 'UW-USADO-1', '[4] la ficha del usado abre', FICHA);
  if(d){
    ok(uwTexto(d.querySelector('.fi-marca .usado-tag')) === 'Usado', '[4] con el rotulo "Usado" al lado de la marca');
    ok(uwTexto(d.querySelector('.fi-detalle')) === 'Batería 91 %. Sin marcas de uso.', '[4] la bateria y el estado (Detalle)', uwTexto(d.querySelector('.fi-detalle')));
    const tabla = [...d.querySelectorAll('.fi-tabla dt')].map(x => uwTexto(x) + ': ' + uwTexto(x.nextElementSibling));
    ok(tabla.includes('Condición: Usado'), '[4] la tabla dice "Condición: Usado"', tabla.join(' | ').slice(0, 90));
    const gar = d.querySelector('[data-servicio="garantia"]');
    ok(!!gar && /30 días/.test(uwTexto(gar)), '[4] la garantia de la columna: 30 dias', uwTexto(gar));
    ok(!d.querySelector('[data-op], [data-mem]'), '[4] sin pestañas: el otro iPhone 15 igual es otro equipo, no una version');
    if(maxCuotas() > 0) ok(!!d.querySelector('.fi-cuotas') && !!d.querySelector('.fi-cuotas-nota'), '[4] con los planes de cuotas, como los nuevos');
    const cta = d.querySelector('a.cta');
    ok(!!cta && /usado/i.test(uwWA(cta.href)) && uwWA(cta.href).includes('UW-USADO-1'), '[4] el WhatsApp de la ficha dice cual es', cta && uwWA(cta.href));
  }
  quitarFicha();
  abrirFicha('UW-USADO-2', false);
  d = document.getElementById('ficha');
  if(d){
    const gar = d.querySelector('[data-servicio="garantia"]');
    ok(!!gar && !/\d+\s*(días|dias|meses|año)/i.test(uwTexto(gar)) && uwTexto(gar).includes(SERVICIO.garantia[1]),
       '[4] sin la columna Garantia no se inventa un plazo: el texto de siempre', uwTexto(gar));
    ok(uwTexto(d.querySelector('.fi-detalle')) === 'Batería 86 %. Un rayón chico en el marco.', '[4] y su propio estado', uwTexto(d.querySelector('.fi-detalle')));
  }
  quitarFicha();

  /* ---- [5] El WhatsApp ---- */
  const wa1 = mensajeWA(u1), wa2 = mensajeWA(u2), av4 = mensajeAviso(u4);
  ok(/\busado\b/.test(wa1) && wa1.includes(', código UW-USADO-1.'), '[5] el mensaje dice "usado" y el codigo del equipo', wa1);
  ok(wa1 !== wa2 && wa2.includes('UW-USADO-2'), '[5] dos equipos iguales mandan mensajes distintos', wa2);
  ok(/\busado\b/.test(av4) && av4.includes('UW-USADO-4'), '[5] el "Avisame cuando entre" tambien', av4);
  ok(!!nuevo && !/código|\(c[oó]digo/i.test(mensajeWA(nuevo.rep)) && !mensajeWA(nuevo.rep).includes(nuevo.rep.id), '[5] lo nuevo sigue sin codigo', nuevo && mensajeWA(nuevo.rep));
  const enTarjeta = c1.querySelector('a.wa');
  ok(!!enTarjeta && uwWA(enTarjeta.href) === wa1, '[5] la tarjeta manda el mismo mensaje que la ficha');

  /* ---- [6] La pregunta frecuente ---- */
  irAlInicio();
  pintarExtras();
  ok(haySeccionUsados() && uwFaq() === UW_APROBADO, '[6] "¿Los productos son nuevos?" dice el texto que aprobo Benja', uwFaq());
  const gq = PREGUNTAS.find(q => q.p === '¿Los productos tienen garantía?');
  info('[6] "¿Los productos tienen garantía?" queda igual: ' + (gq ? gq.r.join(' ') : '(no esta)'));

  /* ---- [7] Las vitrinas que mezclan rubros ---- */
  ok(!novedades(99, false).some(esUsadoModelo), '[7] Recien llegados / Lo ultimo que entro: sin usados');
  ok(!ofertas().some(esUsadoModelo), '[7] la vidriera de ofertas: sin usados');
  ok(!datosPresupuesto().some(t => t.prods.some(esUsadoModelo)), '[7] ¿Cuanto queres gastar?: sin usados en las vitrinas');
  ok(!datosMarcas().some(x => x.nuevos.some(esUsadoModelo)), '[7] la cinta de cada marca: sin usados');
  ok(!$$('#extras [data-key^="UW-USADO"]').length, '[7] y ninguna tarjeta de la portada es de un usado', $$('#extras [data-key^="UW-USADO"]').length);
  ok(uwGrilla({}).filter(uwEsDeEjemplo).length === UW_N, '[7] "Ver todo el catalogo" si los trae (al final)');

  /* ---- [8] El link de un usado que se vendio ---- */
  const k9 = claveDelMismoModelo('CEL-APL-15US-128-BLU-U0009');
  ok(!k9, '[8] un usado vendido no cae en otro equipo del mismo modelo', k9 || '(ninguno)');
  const k16 = claveDelMismoModelo('CEL-APL-16PM-256-DST-ZZZ');
  ok(!UW_IDS.includes(k16), '[8] y el link viejo de un nuevo no cae en un usado', k16 || '(ninguno)');

  /* ---- [9] La busqueda ---- */
  const qu = uwGrilla({ q: 'usado' });
  ok(qu.filter(uwEsDeEjemplo).length === UW_N && qu.every(esUsadoModelo), '[9] buscar "usado" trae los usados (y no el vacio del cotizador)', qu.length);
  const q15 = uwGrilla({ q: 'iphone 15' });
  const i1 = q15.findIndex(uwEsDeEjemplo);
  ok(i1 > 0 && q15.slice(i1).every(esUsadoModelo), '[9] "iphone 15": primero los nuevos y los usados al final', q15.length + ' tarjetas, el primer usado en ' + i1);

  /* ---- [10] Las fotos del equipo, de ADVAPP y sin codigo AT ---- */
  ok(!u6.codigo && u6.fotosUsado.length === 3 && u6.fotosUsado.every((x, i) => x === UW_FOTOS[i]),
     '[10] el usado sin codigo AT trae sus tres fotos de ADVAPP, en orden', u6.fotosUsado.length);
  ok(u6.imagenGrande === UW_FOTOS[0] && u6.imagen === fotoChica(UW_FOTOS[0]), '[10] la primera es la de la tarjeta', u6.imagen);
  const c6 = tarjeta(buscarModelo('UW-USADO-6'));
  ok((c6.querySelector('.foto img') || {}).getAttribute?.('src') === fotoChica(UW_FOTOS[0]), '[10] y la tarjeta la muestra');
  ok(u1.codigo === 'AT-0065' && u1.imagen && !u1.imagen.includes('advapp.invalid'), '[10] el que tiene archivo propio sigue con el suyo', u1.imagen.split('/').pop());
  const malNuevas = PRODUCTOS.filter(p => !esUsado(p)).filter(p => {
    const antes = fotosSinUsados.get(clave(p));
    return (p.fotosUsado || []).length || (antes && (antes[0] !== p.imagen || antes[1] !== p.imagenGrande));
  });
  ok(!malNuevas.length, '[10] las fotos de lo nuevo son exactamente las mismas que sin usados',
     malNuevas.slice(0, 3).map(clave).join(' ') || PRODUCTOS.filter(p => !esUsado(p)).length + ' filas');
  const sinAt = JSON.stringify([{ sku: 'X', at: null, fotos: ['https://x.invalid/a.jpg', 'https://x.invalid/b.jpg'] }]);
  ok(!fotosDelUsado(sinAt, '', 'Celular').length && fotosDelUsado(sinAt, 'Usado', 'Celular').length === 2
     && fotosDelUsado(sinAt, '', 'Celular Usado').length === 2 && !Object.keys(fotosDeLosSkus(sinAt)).length,
     '[10] una foto sin `at` la toma solo un usado: para lo nuevo sigue sin servir');
  abrirFicha('UW-USADO-6', false);
  d = document.getElementById('ficha');
  const fes = d ? [...d.querySelectorAll('.fi-equipo .fi-fe')] : [];
  const grande = () => (d.querySelector('.fi-marco > img') || {}).getAttribute?.('src');
  ok(fes.length === 3 && fes[0].getAttribute('aria-pressed') === 'true' && grande() === UW_FOTOS[0],
     '[10] la ficha muestra las tres, con la primera grande y marcada', fes.length + ' · ' + grande());
  if(fes[1]){
    fes[1].click();
    ok(grande() === UW_FOTOS[1] && fes[1].getAttribute('aria-pressed') === 'true' && fes[0].getAttribute('aria-pressed') === 'false',
       '[10] tocar la segunda la pone grande', grande());
  }
  ok(!!fes[0] && getComputedStyle(fes[0].querySelector('img')).position === 'static', '[10] las miniaturas no se apilan sobre la foto grande');
  quitarFicha();
  abrirFicha('UW-USADO-1', false);
  ok(!document.querySelector('#ficha .fi-fe'), '[10] con una sola foto (o ninguna de ADVAPP) no hay fila');
  quitarFicha();
  if(nuevo){
    abrirFicha(clave(nuevo.rep), false);
    ok(!document.querySelector('#ficha .fi-fe'), '[10] y lo nuevo no la tiene');
    quitarFicha();
  }

  /* ---- [11] La bateria en la tarjeta ---- */
  const bat = x => bateriaDe({ variantes: [{ condicion: 'Usado', detalle: x }] });
  const leidas = ['Batería 92 %. Sin marcas.', 'batería al 88 %', 'Batería: 100%', '88% de batería', '🔋 85%', 'BATERÍA 90%'].map(bat);
  ok(leidas.join('|') === 'Batería 92%|Batería 88%|Batería 100%|Batería 88%|Batería 85%|Batería 90%',
     '[11] se lee "Batería 92 %", "batería al 88 %", "Batería: 100%", "88% de batería", "🔋 85%" y en mayusculas', leidas.join(' | '));
  const dudosas = ['Batería 89–95%', 'Batería 88 %, antes 92% de batería', 'Batería entre 85 y 90 %.', 'Batería 150%',
                   'Batería 0%', 'Batería buena', 'Sin marcas. 90%', ''];
  ok(dudosas.every(x => bat(x) === ''), '[11] un rango, dos numeros, uno imposible o algo no claro: nada', dudosas.filter(x => bat(x)).join(' | '));
  ok(bateriaDe({ variantes: [{ condicion: '', detalle: 'Batería 92 %' }] }) === '', '[11] en un nuevo nunca');
  const linea = id => uwTexto(tarjeta(buscarModelo(id)).querySelector('.tecnica'));
  ok(/^Batería 91%( ·|$)/.test(linea('UW-USADO-1')) && /^Batería 86%( ·|$)/.test(linea('UW-USADO-2')),
     '[11] los dos iPhone 15 iguales ya se distinguen en la tarjeta', linea('UW-USADO-1') + ' | ' + linea('UW-USADO-2'));
  ok(/^Batería 87%( ·|$)/.test(linea('UW-USADO-6')), '[11] "batería al 87 %" se escribe "Batería 87%", chica, primera en la linea de abajo del nombre (el color largo la cortaba en el celular)', linea('UW-USADO-6'));
  ok(!/Batería/.test(linea('UW-USADO-5')), '[11] "Batería entre 85 y 90 %" no pone nada', linea('UW-USADO-5') || '(sin linea)');
  const conBat = MODELOS.filter(noEsUsado).filter(m => bateriaDe(m) || /Batería \d/.test(uwTexto(tarjeta(m).querySelector('.tecnica'))));
  ok(!conBat.length, '[11] ninguna tarjeta nueva lleva bateria', conBat.slice(0, 3).map(m => m.desc).join(' | '));
  const c4 = tarjeta(buscarModelo('UW-USADO-1'));
  ok(c4.querySelector('.nombre').nextElementSibling === c4.querySelector('.tecnica'), '[11] va debajo del nombre');

  /* ---- [12] La foto ilustrativa (Benja, 14/10/2026) ---- */
  const [u7, u8, u9, u10, u11] = ['UW-USADO-7', 'UW-USADO-8', 'UW-USADO-9', 'UW-USADO-10', 'UW-USADO-11'].map(buscarProducto);
  // Las fotos de ese color en el modelo nuevo de esa madre: las que muestra su
  // ficha al elegir el color (fotosDeColor), sin pasar por lo que se prueba
  const uwFotosNuevas = (madre, color) => {
    const m = MODELOS.find(x => noEsUsado(x) && x.variantes.some(v => madreDelSku(v.skuVariante) === madre));
    return new Set(m ? m.variantes.flatMap(v => fotosDeColor(v, color)) : []);
  };
  const archivo = u => String(u || '(ninguna)').split('/').pop();
  const bt16 = uwFotosNuevas('CEL-APL-16PM', 'Black Titanium');
  if(bt16.size)
    ok(u7.fotoIlustrativa === true && bt16.has(u7.imagenGrande) && u7.imagen === fotoChica(u7.imagenGrande),
       '[12] el 16 Pro Max usado sin foto lleva la del 16 Pro Max nuevo Black Titanium (y es de 1TB, que el nuevo no tiene: la memoria no importa)',
       archivo(u7.imagenGrande));
  else info('[12] hoy el 16 Pro Max nuevo no tiene foto Black Titanium: no se mira el de 1TB');
  const pk15 = uwFotosNuevas('CEL-APL-15', 'Pink');
  const simDelNuevo = PRODUCTOS.filter(p => !esUsado(p) && madreDelSku(p.skuVariante) === 'CEL-APL-15' &&
                                            partirColores(p.color).some(c => norm(c) === 'pink')).map(p => p.sim || '-');
  if(pk15.size)
    ok(u8.sim === 'E-Sim' && u8.fotoIlustrativa === true && pk15.has(u8.imagenGrande),
       '[12] el iPhone 15 E-Sim usado lleva la del iPhone 15 nuevo Pink, aunque sea Sim (la Sim no importa)',
       u8.sim + ' / el nuevo: ' + simDelNuevo.join(',') + ' · ' + archivo(u8.imagenGrande));
  else info('[12] hoy el iPhone 15 nuevo no tiene foto Pink: no se mira la eSIM');
  if(!uwFotosNuevas('CEL-APL-16PM', 'Pink').size)
    ok(!u9.imagen && !u9.imagenGrande && !u9.fotoIlustrativa && !!tarjeta(buscarModelo('UW-USADO-9')).querySelector('.foto.vacia')
       && !tarjeta(buscarModelo('UW-USADO-9')).querySelector('.foto-ilus'),
       '[12] un color que el 16 Pro Max nuevo no tiene (Pink): sin foto y sin cartel, como antes; nunca la de otro color',
       archivo(u9.imagenGrande) + ' · el nuevo tiene ' + uwFotosNuevas('CEL-APL-16PM', 'Desert Titanium').size + ' foto(s) Desert Titanium');
  else info('[12] hoy el 16 Pro Max nuevo tiene foto Pink: no se mira el color que falta');
  const nt16 = uwFotosNuevas('CEL-APL-16PM', 'Natural');
  if(nt16.size)
    ok(!madreDelSku(u10.skuVariante) && u10.fotoIlustrativa === true && nt16.has(u10.imagenGrande),
       '[12] sin madre, el modelo sale del nombre: la del 16 Pro Max nuevo Natural', archivo(u10.imagenGrande));
  else info('[12] hoy el 16 Pro Max nuevo no tiene foto Natural: no se mira el nombre');
  ok(!u11.fotoIlustrativa && u11.imagenGrande === UW_FILAS[10]['SKUS'][0].fotos[0],
     '[12] con una foto suya en ADVAPP, la suya: la ilustrativa no entra', archivo(u11.imagenGrande));
  ok([u1, u2, u3, u5, u6].every(p => p.imagen && !p.fotoIlustrativa) &&
     [u1, u3, u6, u11].every(p => !tarjeta(buscarModelo(p.id)).querySelector('.foto-ilus')),
     '[12] los que tienen foto suya (el archivo de su codigo o las de ADVAPP) siguen con la suya, sin cartel');
  if(!PRODUCTOS.some(p => !esUsado(p) && /iphone 13\b/i.test(p.desc || '')))
    ok(!u4.imagen && !u4.fotoIlustrativa, '[12] el iPhone 13 usado (no hay 13 nuevo): sin foto, como antes');

  // La tarjeta, en la grilla del rubro (1920 px)
  irAlInicio();
  entrarAlRubro(CAT_USADO);
  const k7 = document.querySelector('#grid .card[data-key="UW-USADO-7"]');
  if(k7 && u7.fotoIlustrativa){
    const fo = k7.querySelector('.foto'), ci = fo && fo.querySelector('.foto-ilus'), cin = fo && fo.querySelector('.cinta');
    const rf = fo && fo.getBoundingClientRect(), rc = ci && ci.getBoundingClientRect(), rcin = cin && cin.getBoundingClientRect();
    ok(!!ci && uwTexto(ci) === 'Foto ilustrativa' && getComputedStyle(ci).display !== 'none' && rc.width > 0,
       '[12] la tarjeta dice "Foto ilustrativa" sobre la foto', uwTexto(ci));
    ok(!!ci && uwAdentro(rc, rf) && (!rcin || !uwPisan(rc, rcin)) && rc.width < rf.width * .5,
       '[12] chico, adentro de la foto y sin pisar la cinta ("Solo el equipo")', 'cartel ' + uwCaja(rc) + ' · foto ' + uwCaja(rf) + ' · cinta ' + uwCaja(rcin));
    ok(/\(foto ilustrativa\)$/.test(k7.querySelector('.foto img')?.alt || ''), '[12] y el texto alternativo tambien', k7.querySelector('.foto img')?.alt);
  } else info('[12] la tarjeta del 16 Pro Max usado no esta en la grilla o no tiene la ilustrativa');
  irAlInicio();

  // La ficha y el visor
  abrirFicha('UW-USADO-7', false);
  d = document.getElementById('ficha');
  if(d && u7.fotoIlustrativa){
    const marco = d.querySelector('.fi-marco'), ci = marco.querySelector(':scope > .foto-ilus'), lupa = marco.querySelector('.fi-lupa');
    const rm = marco.getBoundingClientRect(), rc = ci && ci.getBoundingClientRect(), rl = lupa && lupa.getBoundingClientRect();
    const rq = uwCuadro(rm);
    ok(!!ci && uwTexto(ci) === 'Foto ilustrativa' && getComputedStyle(ci).display !== 'none' && uwAdentro(rc, rq)
       && rq.bottom - rc.bottom < 30 && rq.right - rc.right < 30 && (!rl || !uwPisan(rc, rl)),
       '[12] la ficha lo dice sobre la foto (en su esquina, no en la del marco), sin pisar la lupa',
       'cartel ' + uwCaja(rc) + ' · foto ' + uwCaja(rq) + ' · marco ' + uwCaja(rm) + ' · lupa ' + uwCaja(rl));
    ok(/\(foto ilustrativa\)$/.test(marco.querySelector(':scope > img')?.alt || ''), '[12] con el texto alternativo', marco.querySelector(':scope > img')?.alt);
    abrirVisor(d);
    const vi = document.getElementById('visor');
    ok(!!vi && uwTexto(vi.querySelector('.visor-ilus')) === 'Foto ilustrativa' && /foto ilustrativa/.test(vi.querySelector('.vi img')?.alt || ''),
       '[12] y la foto en grande (el visor) tambien', vi && uwTexto(vi.querySelector('.visor-ilus')));
    if(cerrarVisorDOM){ visorEmpujado = false; const c = cerrarVisorDOM; cerrarVisorDOM = null; c(); }
  }
  quitarFicha();
  abrirFicha('UW-USADO-3', false);
  d = document.getElementById('ficha');
  if(d){
    abrirVisor(d);
    ok(!d.querySelector('.foto-ilus') && !document.querySelector('#visor .visor-ilus'), '[12] la ficha de un usado con foto suya, ni en la foto ni en el visor');
    if(cerrarVisorDOM){ visorEmpujado = false; const c = cerrarVisorDOM; cerrarVisorDOM = null; c(); }
  }
  quitarFicha();
  if(nuevo){
    abrirFicha(clave(nuevo.rep), false);
    ok(!document.querySelector('#ficha .foto-ilus'), '[12] ni la de un nuevo');
    quitarFicha();
  }

  // El mundo y el encabezado de Usados (ahi va la foto sin cartel): primero una propia
  const wU = mundosDeLaPortada().find(x => x.rubros.includes(CAT_USADO));
  const caro = MODELOS.filter(m => m.cat === CAT_USADO && m.stock && m.imagen).sort((a, b) => b.precio - a.precio)[0];
  const deLaFoto = u => MODELOS.find(m => m.cat === CAT_USADO && m.imagen === u);
  if(caro && caro.fotoIlustrativa)
    ok(!!wU && !!deLaFoto(wU.fotos[0]) && !deLaFoto(wU.fotos[0]).fotoIlustrativa && !!deLaFoto(fotoDelRubro(CAT_USADO))
       && !deLaFoto(fotoDelRubro(CAT_USADO)).fotoIlustrativa,
       '[12] el mundo y el encabezado de Usados muestran una foto propia antes que la ilustrativa del mas caro',
       wU && archivo(wU.fotos[0]) + ' (el mas caro: ' + caro.desc + ')');

  // Lo nuevo, igual
  ok(!PRODUCTOS.some(p => !esUsado(p) && p.fotoIlustrativa), '[12] ninguna fila nueva queda marcada como ilustrativa');
  const cambiadas = MODELOS.filter(noEsUsado).filter(m => tarjetasSinUsados.has(clave(m.rep)) && tarjetasSinUsados.get(clave(m.rep)) !== uwFotoTarjeta(m));
  ok(!cambiadas.length, '[12] la foto de cada tarjeta nueva (la foto, su texto alternativo, sin cartel) es la misma que sin usados',
     cambiadas.slice(0, 3).map(m => clave(m.rep)).join(' ') || tarjetasSinUsados.size + ' tarjetas');

  // La vista previa de WhatsApp y las paginas para Google
  try{
    await uwScript('herramientas/vista-previa.js');
    await uwScript('herramientas/paginas-producto.js');
    const vp = vistasPrevias().vistas, vpDe = id => vp.find(x => x.id === id) || {};
    if(u7.fotoIlustrativa)
      ok(vpDe('UW-USADO-7').foto === '', '[12] la vista previa de WhatsApp no usa la ilustrativa (la imagen va sola, sin cartel): la tarjeta general',
         JSON.stringify(vpDe('UW-USADO-7').foto));
    ok(/AT-0065-02\.jpg$/.test(vpDe('UW-USADO-1').foto || ''), '[12] la foto propia si va', vpDe('UW-USADO-1').foto);
    const pp = (await paginasDeProducto()).modelos, ppDe = id => pp.find(x => x.clave === id);
    const p7 = ppDe('UW-USADO-7');
    if(u7.fotoIlustrativa)
      ok(!!p7 && p7.ilustrativa === true && !!p7.foto && !p7.foto_og,
         '[12] la pagina para Google la muestra marcada (cartel y texto alternativo) y sin og:image ni datos para Google',
         p7 && [p7.foto, JSON.stringify(p7.foto_og)].join(' · '));
    ok(!pp.some(x => 'ilustrativa' in x && !UW_IDS.includes(x.clave)) && !!ppDe('UW-USADO-3') && !('ilustrativa' in ppDe('UW-USADO-3'))
       && !!ppDe('UW-USADO-3').foto_og, '[12] lo nuevo y el usado con foto suya, sin la marca y con su foto para Google',
       ppDe('UW-USADO-3') && ppDe('UW-USADO-3').foto_og);
  }catch(e){ ok(false, '[12] se cargan herramientas/vista-previa.js y paginas-producto.js', e && e.message); }

  // A 390 px (el celular): en un iframe, con los mismos usados de ejemplo
  if(u7.fotoIlustrativa){
    const f = document.createElement('iframe');
    f.style.cssText = 'width:390px;height:844px;border:0;position:absolute;left:-9999px;top:0';
    f.src = 'index.html';
    document.body.appendChild(f);
    try{
      const listo = await uwEsperarA(() => f.contentWindow.eval('MODELOS.length && FUENTE') && f.contentDocument.querySelector('#cats .chip'), 40000);
      ok(listo, '[12 · 390] el celular carga');
      if(listo){
        const w = f.contentWindow, doc = f.contentDocument;
        await uwCargarEn(w, UW_FILAS);
        w.eval(`irAlInicio(); entrarAlRubro(${JSON.stringify(CAT_USADO)})`);
        const k = await uwEsperarA(() => doc.querySelector('#grid .card[data-key="UW-USADO-7"] .foto-ilus'), 10000)
          && doc.querySelector('#grid .card[data-key="UW-USADO-7"]');
        if(k){
          const fo = k.querySelector('.foto'), ci = fo.querySelector('.foto-ilus'), cin = fo.querySelector('.cinta');
          const rf = fo.getBoundingClientRect(), rc = ci.getBoundingClientRect(), rcin = cin && cin.getBoundingClientRect();
          ok(w.getComputedStyle(ci).display !== 'none' && uwAdentro(rc, rf) && (!rcin || !uwPisan(rc, rcin)) && rc.width < rf.width * .6,
             '[12 · 390] en la tarjeta el cartel se ve, entra en la foto y no pisa la cinta',
             'cartel ' + uwCaja(rc) + ' · foto ' + uwCaja(rf) + ' · cinta ' + uwCaja(rcin));
          // Y en el celular mas angosto que se usa (360)
          f.style.width = '360px';
          await uwDormir(300);
          const rf3 = fo.getBoundingClientRect(), rc3 = ci.getBoundingClientRect(), rcin3 = cin && cin.getBoundingClientRect();
          ok(uwAdentro(rc3, rf3) && (!rcin3 || !uwPisan(rc3, rcin3)),
             '[12 · 360] y a 360 tampoco', 'cartel ' + uwCaja(rc3) + ' · foto ' + uwCaja(rf3) + ' · cinta ' + uwCaja(rcin3));
          f.style.width = '390px';
          await uwDormir(300);
        } else ok(false, '[12 · 390] la tarjeta del 16 Pro Max usado, con el cartel');
        w.eval("abrirFicha('UW-USADO-7', false)");
        const marco = doc.querySelector('#ficha .fi-marco'), ci = marco && marco.querySelector(':scope > .foto-ilus'), lupa = marco && marco.querySelector('.fi-lupa');
        const rm = marco && marco.getBoundingClientRect(), rc = ci && ci.getBoundingClientRect(), rl = lupa && lupa.getBoundingClientRect();
        const rq = rm && uwCuadro(rm);
        ok(!!ci && w.getComputedStyle(ci).display !== 'none' && uwAdentro(rc, rq) && (!rl || !uwPisan(rc, rl)),
           '[12 · 390] en la ficha tambien, sobre la foto y sin pisar la lupa',
           'cartel ' + uwCaja(rc) + ' · foto ' + uwCaja(rq) + ' · lupa ' + uwCaja(rl));
        try{ w.eval('quitarFicha()'); }catch(e){}
      }
    } finally { f.remove(); }
  }

  /* ---- Y sin los de ejemplo, todo como estaba ---- */
  await uwCargar(null);
  irAlInicio();
  pintarExtras();
  ok(!UW_IDS.some(id => buscarProducto(id)), 'despues: las filas de ejemplo ya no estan');
  ok(!!reales || (!uwChips().some(b => b.dataset.cat === CAT_USADO) && !uwMundoUsados() && uwFaq() === UW_D14),
     'despues: sin chip, sin mundo y la pregunta como antes', uwFaq());
}
