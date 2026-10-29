// Guardas de los arreglos de la web de la auditoria del 08/10/2026 (paquete
// P4, 13/10/2026). El codigo entre corchetes es el del hallazgo
// (~/catalogo-advance-trabajo/auditoria-08-10/*/hallazgos.json) o la decision
// de Benja (D13 a D17):
//
//  [W3-03 W3-05] un link #p= (o una pagina p/) cuyo ID ya no esta abre el
//        mismo modelo en la version mas parecida antes de decir "Ya no esta";
//        las paginas p/ mandan su ID y su SKU de respaldo (&o= &s=).
//  [FOT-21] ninguna pagina p/ apunta a una foto que no existe.
//  [FOT-12] una foto que falla se vuelve a pedir y despues se prueba otra
//        copia de la misma antes de "sin imagen".
//  [W3-07 W3-13 W3-14] la busqueda: el equipo antes que sus accesorios, en
//        la grilla y en el desplegable, y el desplegable con el nombre de la
//        tarjeta.
//  [W3-06] las paginas para Google no fijan precio ni stock en el HTML.
//  [W3-11] la cinta del regalo con el 🎁 adelante y dos renglones en el celular.
//  [W3-10] los usados al final y diciendo que son.
//  [W3-12] la busqueda sin resultados ofrece lo parecido y el cotizador.
//  [W3-17] los productos se piden desde el <head>.
//  [DW-09] la descripcion del 4G del Redmi Note 15 Pro, solo en las filas que dicen 4G.
//  [D13] el pedido dice solo la cuota, sin el total en cuotas.
//  [D14] la pregunta "¿Los productos son nuevos?".
//  [D15] lo agotado no muestra precio.
//  [D16] Instagram @advancetecno en el pie y en la ayuda.
//  [D17] "+ N baterias" no es regalo y va en el nombre de la version.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);
const aviso = t => R.push('AVISO ' + t);

const esperaA8 = setInterval(() => {
  if(!MODELOS.length || !FUENTE || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperaA8);
  for(let i=1;i<5000;i++) clearInterval(i);
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; })
    .finally(() => {
      try{ quitarFicha(); }catch(e){}
      try{ pararPaseos(); }catch(e){}
      try{ pararOfertas(); }catch(e){}
      try{ pararMundos(); }catch(e){}
      for(let i=1;i<5000;i++) clearInterval(i);
      const pre=document.createElement('pre'); pre.id='RESULTADO';
      pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
      document.body.appendChild(pre);
    });
}, 150);

const a8Dormir = ms => new Promise(r => setTimeout(r, ms));
const a8Ej = (l, n = 3) => l.length ? l.slice(0, n).join(' | ') + (l.length > n ? ' ...' : '') : undefined;
const a8Precio = t => /USD\s?\d|\$\s?\d|u\$\s?\d/.test(t || '');
async function a8Leer(ruta){
  try{
    const r = await fetch(ruta + (ruta.includes('?') ? '&' : '?') + '_=' + Date.now(), { cache: 'no-store' });
    return r.ok ? await r.text() : null;
  }catch(e){ return null; }
}
/* ¿Esta el archivo? Solo la cabecera (HEAD), y con dos intentos mas si el
   servidor local no contesta: son cientos de pedidos y alguno se pierde. Un
   404 es un 404 a la primera. */
async function a8Existe(ruta){
  for(let i = 0; i < 3; i++){
    try{
      const r = await fetch(ruta + '?_=' + Date.now() + i, { method: 'HEAD', cache: 'no-store' });
      if(r.ok) return true;
      if(r.status === 404) return false;
    }catch(e){}
    await a8Dormir(150);
  }
  return false;
}
// Lo que dibuja la grilla con estos filtros (sin tocar los de verdad)
function a8Grilla(cambios){
  const antes = { ...filtros };
  Object.assign(filtros, { q: '', cat: '', marca: '', rango: '', soloStock: false, orden: ORDEN_DEF }, cambios);
  try{ return listaDeLaGrilla(); } finally { Object.assign(filtros, antes); }
}
const esAccesorioA8 = m => /^accesorio/.test(norm(m.cat));
/* De a tandas de 8: el servidor local cierra la conexion en cada respuesta y
   atiende de a 5 en espera; con cientos de pedidos a la vez deja algunos sin
   contestar ("connection reset", lo mismo que le pasa a decision-vista-previa
   de a ratos) */
async function a8DeATandas(lista, hacer, n = 8){
  const out = [];
  for(let i = 0; i < lista.length; i += n) out.push(...await Promise.all(lista.slice(i, i + n).map(hacer)));
  return out;
}

async function correrPruebas(){
  ok(FUENTE.fuente === 'advapp', 'la pagina cargo desde ADVAPP (lo demas lo da por hecho)', FUENTE.fuente);
  const indexSrc = await a8Leer('index.html');
  temprano(indexSrc);
  links();
  await paginasP();
  await fotos();
  busqueda();
  vacio();
  usados();
  agotados();
  await agotadosEnFicha();
  regalos();
  await cintaEnElCelular();
  cuotasPedido();
  textos();
  descripcionRedmi();
  await paginasGoogle();
  await garantiaDeAdvapp();
}

/* ---- La garantia de ADVAPP (coordinacion con ADVAPP PR #86, 13/10/2026) ----
   El feed suma la columna "Garantía" (Garantías por categoría; en usados, la
   del proveedor). La ficha la muestra si viene con texto; vacia o sin la
   columna, lo de siempre. Nunca un plazo inventado. */
async function garantiaDeAdvapp(){
  const real = await (await fetch(ADVAPP_URL, { cache: 'no-store' })).json();
  const prueba = '6 meses (prueba A8)';
  const conCol = JSON.parse(JSON.stringify(real));
  conCol.productos[0]['Garantía'] = prueba;
  conCol.productos.slice(1).forEach(p => { p['Garantía'] = ''; });   // la columna en todos, vacia en el resto
  const viaFetch = async (cuerpo) => {
    const antes = window.fetch;
    window.fetch = (u, o) => String(u).startsWith(ADVAPP_URL) ? Promise.resolve(new Response(JSON.stringify(cuerpo), { status: 200 })) : antes(u, o);
    try{ return armarCarga(await bajarAdvapp()).productos; } finally { window.fetch = antes; }
  };
  const ps = await viaFetch(conCol);
  const p0 = ps.find(p => p.id === String(conCol.productos[0].ID));
  ok(!!p0 && p0.garantia === prueba, '[Garantia] la columna "Garantía" de ADVAPP llega a la fila aunque no la nombre en `columnas`', p0 && p0.garantia);
  ok(ps.filter(p => p !== p0).every(p => !p.garantia || /a[ñn]o|mes/i.test(p.garantia)), '[Garantia] vacia, no se inventa nada');
  const h = htmlServicio(p0 || {});
  ok(h.includes(prueba), '[Garantia] y la ficha la muestra en el renglon de garantia', (h.match(/data-servicio="garantia"[\s\S]*?<\/li>/) || [''])[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  const sin = htmlServicio({ garantia: '' });
  ok(!SERVICIO.garantia || (sin.includes(esc(SERVICIO.garantia[1] || '')) && !sin.includes(prueba)),
     '[Garantia] sin dato, la ficha dice lo de siempre', SERVICIO.garantia && SERVICIO.garantia[1]);
  const ps2 = await viaFetch(real);
  const p2 = ps2.find(p => p.id === String(real.productos[0].ID));
  ok(!!p2 && (p2.garantia || '') === (PRODUCTOS.find(p => p.id === p2.id) || {}).garantia, '[Garantia] sin la columna (ADVAPP de hoy), como siempre');
}

/* ---- [W3-17] El pedido a ADVAPP sale desde el <head> ---- */
function temprano(src){
  if(!src){ ok(false, '[W3-17] se puede leer index.html'); return; }
  const head = src.slice(0, src.indexOf('</head>'));
  const m = /window\.ADVAPP_TEMPRANO = [\s\S]*?const url = '([^']+)'/.exec(head);
  ok(!!m && m[1] === ADVAPP_URL, '[W3-17] el <head> pide los productos a la misma ADVAPP_URL', m ? m[1] : 'no esta en el <head>');
  ok(!!m && head.indexOf('window.ADVAPP_TEMPRANO') < head.indexOf('<style>'),
     '[W3-17] y antes de la hoja de estilos (sale apenas llega el <head>)');
  ok(window.ADVAPP_TEMPRANO === null, '[W3-17] bajarAdvapp() lo uso una vez y lo solto (el refresco pide como siempre)',
     String(window.ADVAPP_TEMPRANO));
  ok(/temprano\.url === ADVAPP_URL/.test(src) && /corte\.signal\.addEventListener\('abort'/.test(src),
     '[W3-17] solo si es la misma direccion, y con el mismo tope de espera');
}

/* ---- [W3-03 W3-05] Los links viejos caen en el mismo modelo ---- */
function links(){
  const antes = location.hash;
  try{
    history.replaceState(history.state, '', location.pathname + location.search + '#p=AAA-BBB&o=CCC-DDD&s=EEE-FFF-GGG-1-2');
    ok(claveDeHash() === 'AAA-BBB' && JSON.stringify(respaldosDelHash()) === '["CCC-DDD","EEE-FFF-GGG-1-2"]',
       '[W3-03] el #p= de una pagina p/ trae el destino y, aparte, su ID y su SKU de respaldo', claveDeHash() + ' ' + JSON.stringify(respaldosDelHash()));
    history.replaceState(history.state, '', location.pathname + location.search + '#p=AAA-BBB');
    ok(claveDeHash() === 'AAA-BBB' && respaldosDelHash().length === 0, '[W3-03] y el #p= de siempre sigue igual');
  } finally { try{ history.replaceState(history.state, '', location.pathname + location.search + antes); }catch(e){} }

  // Una fila de hoy con forma de SKU y un "color que ya no esta": cae en el mismo modelo y la misma memoria
  /* Los usados no (19/10/2026): claveDelMismoModelo no cae nunca en un usado
     a proposito (14/10, seccion Usados). Cada uno es un equipo, y el link de
     uno que se vendio no es "el mismo modelo en otra version": da "Ya no
     esta". Eso se mira aparte, abajo. */
  const visibles = MODELOS.flatMap(m => m.variantes.map(v => [m, v]))
    .filter(([m, v]) => String(v.skuVariante || '').split('-').length >= 6 && !esUsado(v));
  const usadosConSku = MODELOS.flatMap(m => m.variantes)
    .filter(v => esUsado(v) && String(v.skuVariante || '').split('-').length >= 6);
  const usadoQueCae = usadosConSku.filter(v => {
    const b = String(v.skuVariante).toUpperCase().split('-');
    return claveDelMismoModelo([...b.slice(0, 4), 'ZZQ', ...b.slice(5)].join('-')) !== '';
  });
  ok(!usadoQueCae.length, '[W3-05] el SKU de un usado que ya no esta no cae en otro equipo ("Ya no esta")',
     a8Ej(usadoQueCae.map(v => v.id)) || usadosConSku.length + ' usados');
  const mal = [], vistos = [];
  for(const [m, v] of visibles){
    const b = String(v.skuVariante).toUpperCase().split('-');
    const falso = [...b.slice(0, 4), 'ZZQ', ...b.slice(5)].join('-');
    const k = claveDelMismoModelo(falso);
    const p = k && buscarProducto(k);
    const pb = p ? String(p.skuVariante).toUpperCase().split('-') : [];
    const mismaMemoria = m.variantes.some(x => String(x.skuVariante || '').toUpperCase().split('-')[3] === b[3]);
    if(!p || buscarModelo(k) !== m || (mismaMemoria && pb[3] !== b[3])) mal.push(falso + ' -> ' + (k || 'nada'));
    vistos.push(falso);
  }
  ok(visibles.length > 0 && !mal.length, '[W3-05] un SKU de un color que ya no esta abre el mismo modelo, en la misma memoria si la hay',
     a8Ej(mal) || vistos.length + ' versiones');
  // Un SKU de hoy abre esa misma fila (cambio solo el ID)
  const mismos = visibles.filter(([, v]) => { const k = claveDelMismoModelo(v.skuVariante); return k && buscarProducto(k).skuVariante.toUpperCase() !== String(v.skuVariante).toUpperCase(); });
  ok(!mismos.length, '[W3-05] con el mismo SKU, la misma fila', a8Ej(mismos.map(([, v]) => v.id)));
  ok(claveDelMismoModelo('TAB-APP-046') === '' && claveDelMismoModelo('ZZZ-NO-ESTA-999') === '',
     '[W3-05] un ID viejo no dice su modelo: no se adivina');
  const fila = visibles[0] && visibles[0][1];
  if(fila){
    const d = destinoDelLink('ZZZ-NO-ESTA-ID-999-X', [clave(fila)]);
    ok(d.clave === clave(fila), '[W3-03] si el destino de la pagina ya no esta, abre el ID de la fila (el iPad Pro M4 de TAB-APP-046)', JSON.stringify(d));
    const d2 = destinoDelLink('ZZZ-NO-ESTA-ID-999-X', ['OTRO-ID-QUE-NO-ESTA', fila.skuVariante]);
    ok(!!d2.clave && buscarModelo(d2.clave) === buscarModelo(clave(fila)), '[W3-03] y si tampoco esta, su SKU', JSON.stringify(d2));
  }
  if(FUENTE.fuente === 'advapp' && CATALOGO && CATALOGO.ids)
    ok(destinoDelLink('ZZZ-NO-ESTA-999').baja === true, '[W3-05] lo que no esta en ningun lado sigue siendo "Ya no esta"');
}

/* ---- [W3-03 FOT-21] Las paginas p/ ---- */
async function paginasP(){
  const listado = await a8Leer('p/');
  const nombres = listado ? [...new Set([...listado.matchAll(/href="([^"?\/]+)\.html"/g)].map(m => decodeURIComponent(m[1])))] : [];
  if(!nombres.length){ info('[FOT-21] no se pudo leer el listado de p/'); return; }
  const sinFoto = [], sinModelo = [];
  const leerP = async id => {
    const ruta = 'p/' + encodeURIComponent(id) + '.html';
    for(let i = 0; i < 3; i++){            // hasta tres intentos si el servidor no contesto
      const t = await a8Leer(ruta);
      if(t) return [id, t];
      await a8Dormir(200);
    }
    return [id, null];
  };
  const paginas = await a8DeATandas(nombres, leerP);
  const sinLeer = paginas.filter(([, t]) => !t).map(([id]) => id);
  ok(!sinLeer.length, '[FOT-21] se pudieron leer todas las paginas p/', a8Ej(sinLeer) || paginas.length + ' paginas');
  const imagenes = new Map();
  for(const [id, t] of paginas){
    if(!t) continue;
    const img = (/<meta property="og:image" content="https:\/\/[^\/]+\/([^"]+)">/.exec(t) || [])[1];
    if(img) imagenes.set(id, img);
    const va = (/location\.replace\("\.\.\/(#p=[^"]+)"\)/.exec(t) || [])[1] || '';
    const k = (/^#p=([^&]+)/.exec(va) || [])[1] || '';
    const resp = [...va.matchAll(/&(?:o|s)=([^&]+)/g)].map(m => m[1]);
    /* La pagina de una fila que hoy no esta, con un modelo que sigue
       publicado (mismo SKU madre): no puede dar "Ya no esta" */
    const madres = [k, ...resp].map(x => x.split('-').length >= 5 ? x.split('-').slice(0, 3).join('-').toUpperCase() : '').filter(Boolean);
    const sigue = madres.some(md => PRODUCTOS.some(p => madreDelSku(p.skuVariante) === md && buscarModelo(clave(p))));
    if(k && sigue && !destinoDelLink(k, resp).clave) sinModelo.push(id);
  }
  ok(!sinModelo.length, '[W3-05] ninguna pagina p/ de un modelo que sigue publicado abre "Ya no esta"', a8Ej(sinModelo) || paginas.length + ' paginas');
  const unicas = [...new Set(imagenes.values())];
  const existe = new Map(await a8DeATandas(unicas, async u => [u, await a8Existe(u)]));
  for(const [id, u] of imagenes) if(!existe.get(u)) sinFoto.push(id + ': ' + u);
  ok(!sinFoto.length, '[FOT-21] ninguna pagina p/ (tampoco las de filas dadas de baja) apunta a una foto que no existe',
     a8Ej(sinFoto) || imagenes.size + ' paginas, ' + unicas.length + ' fotos');
  // El generador manda el SKU de respaldo
  const vp = await a8Leer('herramientas/vista-previa.py');
  ok(!!vp && /def destino_del_link\(v\)/.test(vp) && /'&o=' \+ ide/.test(vp) && /'&s=' \+ sku/.test(vp),
     '[W3-03] herramientas/vista-previa.py arma el link con el ID y el SKU de respaldo');
}

/* ---- [FOT-12] La foto que falla se reintenta ---- */
async function fotos(){
  const R0 = [...FOTO_REINTENTOS];
  FOTO_REINTENTOS[0] = 40; FOTO_REINTENTOS[1] = 80;
  try{
    ok(JSON.stringify(fotosDeRepuesto('http://x/fotos/mini/sinfondo/AT-0002.webp')) === JSON.stringify(['http://x/fotos/mini/AT-0002.jpg', 'http://x/fotos/AT-0002.jpg'])
       && JSON.stringify(fotosDeRepuesto('http://x/fotos/sinfondo/AT-0072-03.webp')) === JSON.stringify(['http://x/fotos/AT-0072-03.jpg'])
       && JSON.stringify(fotosDeRepuesto('http://x/fotos/mini/AT-0002.jpg')) === JSON.stringify(['http://x/fotos/AT-0002.jpg'])
       && fotosDeRepuesto('https://lh3.googleusercontent.com/d/x=w400').length === 0,
       '[FOT-12] la copia de repuesto es siempre la MISMA foto (sin fondo -> jpg chica -> jpg grande); la de ADVAPP no tiene');
    // Una que no existe: 1 + 2 reintentos, despues "sin imagen"
    const caja = document.createElement('div');
    caja.style.cssText = 'position:absolute;left:-9999px;width:200px;height:200px';
    document.body.appendChild(caja);
    const pedidas = [];
    const p = { marca: 'Prueba', imagen: 'fotos/NO-EXISTE-FOT12.jpg', desc: 'x' };
    caja.innerHTML = htmlFoto(p, '');
    const img = caja.querySelector('img');
    const obs = new MutationObserver(() => { const i = caja.querySelector('img'); if(i) pedidas.push(i.getAttribute('src')); });
    obs.observe(caja, { attributes: true, subtree: true, attributeFilter: ['src'] });
    for(let i = 0; i < 60 && caja.querySelector('img'); i++) await a8Dormir(50);
    obs.disconnect();
    ok(!caja.querySelector('img') && !!caja.querySelector('.sinfoto') && caja.classList.contains('vacia'),
       '[FOT-12] una foto que de verdad no existe termina en "sin imagen", como siempre');
    ok(pedidas.filter(x => x === 'fotos/NO-EXISTE-FOT12.jpg').length >= 2, '[FOT-12] y antes se volvio a pedir (2 reintentos)', pedidas.length + ' pedidos');
    // Una que falla y tiene repuesto: queda el repuesto
    const real = [...INDICE_FOTOS][0];
    if(real){
      caja.classList.remove('vacia');
      caja.innerHTML = htmlFoto({ marca: 'Prueba', imagen: 'fotos/NO-EXISTE-FOT12b.jpg', desc: 'x' }, '');
      const i2 = caja.querySelector('img');
      i2.dataset.repuestos = CARPETA_FOTOS + real;
      for(let i = 0; i < 60 && !(i2.complete && i2.naturalWidth); i++) await a8Dormir(50);
      ok(caja.querySelector('img') === i2 && i2.naturalWidth > 0 && i2.getAttribute('src') === CARPETA_FOTOS + real,
         '[FOT-12] si la copia de repuesto existe, la tarjeta la muestra en vez de "sin imagen"', i2.getAttribute('src'));
    }
    caja.remove();
  } finally { FOTO_REINTENTOS[0] = R0[0]; FOTO_REINTENTOS[1] = R0[1]; }
  const src = htmlFoto({ marca: 'x', imagen: 'fotos/a.jpg', desc: 'x' }, '');
  ok(/onerror="fotoQueFalla\(this, 'vacia'\)"/.test(src), '[FOT-12] la foto de la tarjeta y de la ficha usa fotoQueFalla');
}

/* ---- [W3-07 W3-13 W3-14] La busqueda ---- */
function busqueda(){
  const casos = ['ipad', 'ps5', 'iphone', 'macbook', 'dji', 'apple', 'samsung', 'sony', 'galaxy'];
  const malGrilla = [], malSug = [], malNombre = [], mirados = [];
  for(const q of casos){
    const g = a8Grilla({ q }).filter(m => m.stock);
    const hayEquipo = g.some(m => !esAccesorioA8(m)), hayAcc = g.some(esAccesorioA8);
    const sug = candidatosSug(q).prods;
    if(hayEquipo && hayAcc){
      mirados.push(q);
      if(esAccesorioA8(g[0])) malGrilla.push(q + ': ' + (g[0].titulo || g[0].desc));
      if(sug.length && esAccesorioA8(sug[0])) malSug.push(q + ': ' + (sug[0].titulo || sug[0].desc));
      // ningun accesorio antes de un equipo (con stock). Un equipo usado no
      // cuenta (19/10/2026): los usados van siempre al final, tambien en la
      // busqueda, despues de los accesorios nuevos (Benja, 13-14/10, ordenar)
      const primerAcc = g.findIndex(esAccesorioA8), ultimoEq = g.map(m => !esAccesorioA8(m) && !esUsadoModelo(m)).lastIndexOf(true);
      if(primerAcc < ultimoEq && puntajeDeBusqueda(q, g)(g[ultimoEq]) > puntajeDeBusqueda(q, g)(g[primerAcc])) malGrilla.push(q + ': orden');
    }
  }
  ok(mirados.length > 0 && !malGrilla.length, '[W3-07] con algo buscado, la grilla pone el equipo antes que sus accesorios',
     a8Ej(malGrilla) || mirados.join(', '));
  ok(!malSug.length, '[W3-13] y el desplegable tambien (con "ps5", la consola antes que el VR2 y los joysticks)', a8Ej(malSug) || mirados.join(', '));
  // El desplegable con el nombre de la tarjeta
  const input = $('q'), antes = input.value;
  try{
    for(const q of ['iphone 17', 'kindle', 'galaxy', 'watch']){
      input.value = q; pintarSug();
      const nombres = [...document.querySelectorAll('#q-sug .qs[data-key] .qs-txt b')].map(b => b.textContent);
      const esperados = candidatosSug(q).prods.map(m => m.titulo || m.desc);
      if(JSON.stringify(nombres) !== JSON.stringify(esperados)) malNombre.push(q + ': ' + nombres.slice(0, 2).join(', '));
    }
  } finally { input.value = antes; cerrarSug(); }
  ok(!malNombre.length, '[W3-14] el desplegable nombra cada modelo como su tarjeta (sin memoria ni color de una version)', a8Ej(malNombre));
  // Lo que nombra el accesorio no baja
  const joy = a8Grilla({ q: 'joystick ps5' }).filter(m => m.stock);
  if(joy.length) ok(/joystick/i.test(joy[0].titulo || joy[0].desc), '[W3-13] "joystick ps5" pone primero un joystick (nombra el accesorio)', joy[0].titulo || joy[0].desc);
  else info('[W3-13] hoy no hay joysticks con stock');
  // Con otro orden pedido, manda el del cliente
  const asc = a8Grilla({ q: 'ipad', orden: 'asc' }).filter(m => m.stock && m.precio !== null);
  ok(asc.every((m, i) => !i || asc[i - 1].precio <= m.precio || asc[i - 1].stock !== m.stock), '[W3-07] con "Menor precio" manda el precio, no el parecido');
}

/* ---- [W3-12] La busqueda sin resultados ---- */
function vacio(){
  const m = MODELOS.find(x => x.stock && !esAccesorioA8(x) && norm(x.titulo || x.desc).split(/\s+/).length >= 2);
  if(!m){ info('[W3-12] no hay un modelo con stock de dos palabras'); return; }
  const q = norm(m.titulo || m.desc).split(/\s+/).slice(0, 2).join(' ') + ' zq9';
  const antes = { ...filtros };
  try{
    Object.assign(filtros, { q, cat: '', marca: '', rango: '', soloStock: false, orden: ORDEN_DEF });
    ok(!filtrar().length, '[W3-12] caso: "' + q + '" no da nada');
    const t = textosVacio();
    ok(/^Lo más parecido que tenemos: /.test(t.parecido) && /data-parecido="/.test(t.acc) && /data-pedilo/.test(t.acc),
       '[W3-12] ofrece lo mas parecido (sin el numero) y sigue ofreciendo preguntar por WhatsApp', t.parecido);
    const par = parecidoDe(q);
    ok(!!par && par.q === norm(m.titulo || m.desc).split(/\s+/).slice(0, 2).join(' ') && par.modelos.every(x => x.stock),
       '[W3-12] lo parecido es lo buscado sin la palabra con numero, y solo lo que tiene stock', par && par.q);
    filtros.q = 'cotizar mi usado';
    const u = textosVacio();
    if(USADOS) ok(/data-cotizar/.test(u.acc), '[W3-12] "cotizar mi usado" ofrece el cotizador', u.acc.slice(0, 60));
    else info('[W3-12] no cargo datos/usados.json: no se mira el cotizador');
    filtros.q = 'qzxw9 no existe';
    const n = textosVacio();
    ok(!n.parecido && !/data-cotizar/.test(n.acc), '[W3-12] sin nada parecido no inventa nada', n.parecido);
  } finally { Object.assign(filtros, antes); }
  ok(!parecidoDe('ipadx'), '[W3-12] con una sola palabra no hay nada que sacar');
}

/* ---- [W3-10] Los usados ---- */
function usados(){
  ok(esUsado({ condicion: 'Usado' }) && esUsado({ condicion: 'USADO A+' }) && esUsado({ condicion: 'Seminuevo' })
     && !esUsado({ condicion: 'Caja blanca' }) && !esUsado({ condicion: '' }) && !esUsado({ condicion: 'Nuevo' }),
     '[W3-10] "Usado" (y seminuevo, reacondicionado) es usado; "Caja blanca" no');
  const base = MODELOS.find(m => m.stock && m.precio !== null && m.variantes.length === 1);
  if(!base){ info('[W3-10] no hay un modelo de una sola version con stock'); return; }
  const fila = { ...base.variantes[0], id: 'A8-USADO-1', condicion: 'Usado' };
  /* Desde el 14/10/2026 (Benja, la seccion de usados) la familia de un usado
     es la fila misma, U:<ID>: una tarjeta por equipo. El resto de la seccion
     se prueba en usados-web.js */
  ok(familia(fila) !== familia(base.variantes[0]) && familia(fila) === 'U:A8-USADO-1', '[W3-10] el usado arma su propia tarjeta (familia)', familia(fila));
  const falso = { ...base, id: 'A8-USADO-1', idx: 99999, rep: fila, variantes: [fila], condicion: 'Usado' };
  MODELOS.push(falso);
  try{
    const g = a8Grilla({ cat: base.cat });
    ok(g[g.length - 1] === falso || (g.length && g[g.length - 1].id === 'A8-USADO-1'), '[W3-10] va al final de su rubro (despues de lo agotado)', g.length + ' tarjetas');
    const q = norm(base.titulo || base.desc).split(/\s+/)[0];
    const gq = a8Grilla({ q });
    ok(gq.length && gq[gq.length - 1].id === 'A8-USADO-1', '[W3-10] y al final de la busqueda ("' + q + '")');
    const el = tarjeta(falso);
    ok(/Usado/.test((el.querySelector('.usado-tag') || {}).textContent || ''), '[W3-10] la tarjeta dice "Usado"');
    ok(/usado/i.test(mensajeWA(fila)), '[W3-10] y el WhatsApp tambien', mensajeWA(fila));
    ok(!tarjeta(base).querySelector('.usado-tag'), '[W3-10] lo nuevo no dice nada');
  } finally { MODELOS.splice(MODELOS.indexOf(falso), 1); }
}

/* ---- [D15] Lo agotado no muestra precio ---- */
function agotados(){
  const agot = MODELOS.filter(m => !m.stock);
  const mal = [];
  for(const m of agot){
    const el = tarjeta(m);
    const t = (el.querySelector('.plata') || el).textContent + ' ' + ((el.querySelector('.badge.ahorro') || {}).textContent || '');
    if(a8Precio(t) || el.querySelector('s.antes')) mal.push((m.titulo || m.desc) + ': ' + t.trim().slice(0, 40));
  }
  if(agot.length) ok(!mal.length, '[D15] la tarjeta agotada no muestra precio, ni pesos, ni tachado, ni ahorro', a8Ej(mal) || agot.length + ' agotadas');
  else info('[D15] hoy no hay ninguna tarjeta agotada');
  ok(precioUSD({ stock: false, precio: 100 }) === 'Sin stock' && precioARS({ stock: false, precio: 100 }) === ''
     && ahorro({ stock: false, precio: 100, antes: 120 }) === 0 && precioUSD({ stock: true, precio: 100 }) === 'USD 100',
     '[D15] precioUSD, precioARS y ahorro: sin stock no hay numero');
  // Lo que se ve en la portada y en las secciones: ningun precio de algo agotado
  const malSec = [];
  document.querySelectorAll('[data-key]').forEach(el => {
    if(el.closest('#grid, #ficha')) return;
    const p = buscarProducto(el.dataset.key);
    const m = p && buscarModelo(el.dataset.key);
    if(m && !m.stock && a8Precio(el.textContent)) malSec.push(el.dataset.key);
  });
  ok(!malSec.length, '[D15] ninguna seccion de la portada muestra el precio de algo agotado', a8Ej(malSec));
}
async function agotadosEnFicha(){
  const modelos = MODELOS.filter(m => m.multi && m.variantes.some(v => !v.stock) && m.variantes.some(v => v.stock)).slice(0, 25);
  const mal = [];
  for(const m of modelos){
    const v = m.variantes.find(x => !x.stock);
    try{ quitarFicha(); }catch(e){}
    abrirFicha(clave(v), null);
    const d = document.getElementById('ficha');
    if(!d) continue;
    const usd = (d.querySelector('.fi-precio .usd') || {}).textContent || '';
    if(FICHA === clave(v) && a8Precio(usd + ((d.querySelector('.fi-precio .ars') || {}).textContent || ''))) mal.push(clave(v) + ' precio: ' + usd);
    d.querySelectorAll('.fi-op.agotada i, .fi-tono.agotada .pr, .fi-fila.agotada .p').forEach(x => {
      if(a8Precio(x.textContent)) mal.push(clave(v) + ' ' + x.className + ': ' + x.textContent);
    });
    quitarFicha();
  }
  if(modelos.length) ok(!mal.length, '[D15] en la ficha, la version, la pestaña, el color y el renglon agotados no muestran precio',
                        a8Ej(mal) || modelos.length + ' fichas');
  else info('[D15] hoy ningun modelo tiene versiones agotadas y con stock a la vez');
}

/* ---- [D17] Las baterias del kit ---- */
function regalos(){
  ok(!esRegalo('+ 4 Baterías') && !esRegalo('+ 2 Baterías') && !esRegalo('+ 1 Batería') && bateriasDelKit('+ 4 Baterías') === '4 baterías'
     && esRegalo('+ Cargador 20W') && esRegalo('+ 2 Baterías + Funda 🎁') === true,
     '[D17] "+ N baterias" no es regalo (es parte del kit); una funda de regalo sigue siendo regalo');
  ok(textoIncluye('+ 4 Baterías') === '+ 4 Baterías' && !/🎁/.test(textoCinta('+ 2 Baterías')), '[D17] sin el 🎁');
  const conBat = PRODUCTOS.filter(p => bateriasDelKit(p.incluye));
  const malEt = conBat.filter(p => { const m = buscarModelo(clave(p)); return m && m.multi && norm(p.etiqueta) === 'base'; });
  ok(!malEt.length, '[D17] la version con baterias no se llama "Base": dice cuantas (el DJI Mini 5 Pro de 4 baterias)',
     a8Ej(malEt.map(p => p.id)) || conBat.map(p => p.id + ' = ' + p.etiqueta).join(' | ') || 'hoy ninguna fila trae baterias');
  // [W3-11] el 🎁 adelante
  ok(textoCinta('+ Cargador 20W + Funda + Templado 🎁') === '🎁 Cargador 20W + Funda + Templado' && textoCinta('Sin cargador') === 'Sin cargador'
     && textoCinta('+ Solo el lápiz') === '+ Solo el lápiz',
     '[W3-11] la cinta lleva el 🎁 adelante, en lugar del "+"; lo que no es regalo va igual');
}

/* ---- [W3-11] La cinta en el celular, a 390 px ---- */
async function cintaEnElCelular(){
  const m = MODELOS.find(x => x.stock && esRegalo(x.incluye) && textoCinta(x.incluye).length > 24);
  if(!m){ info('[W3-11] hoy no hay un regalo largo'); return; }
  const f = document.createElement('iframe');
  f.style.cssText = 'width:390px;height:844px;border:0;position:absolute;left:-9999px;top:0';
  f.src = 'index.html?cat=' + encodeURIComponent(m.cat);
  document.body.appendChild(f);
  try{
    await new Promise(r => { f.onload = r; });
    const W = f.contentWindow;
    let listo = false;
    for(let i = 0; i < 150 && !listo; i++){
      try{ listo = W.eval('MODELOS.length > 0 && document.querySelectorAll("#grid .card").length > 0'); }catch(e){}
      if(!listo) await a8Dormir(200);
    }
    if(!listo){ info('[W3-11] el catalogo del iframe de 390 px no llego a cargar'); return; }
    try{ W.pararOfertas?.(); W.pararPaseos?.(); W.pararMundos?.(); }catch(e){}
    const r = JSON.parse(W.eval(`JSON.stringify([...document.querySelectorAll('#grid .card .cinta')].map(c => ({
      t: c.textContent, cortada: c.scrollHeight > c.clientHeight + 2 || c.scrollWidth > c.clientWidth + 2,
      renglones: Math.round(c.getBoundingClientRect().height / parseFloat(getComputedStyle(c).lineHeight)) })))`));
    const regalos = r.filter(x => /🎁/.test(x.t));
    ok(regalos.length > 0 && regalos.every(x => x.t.startsWith('🎁')), '[W3-11] a 390 px el 🎁 va adelante', a8Ej(regalos.map(x => x.t)));
    const cortadas = regalos.filter(x => x.cortada);
    ok(!cortadas.length, '[W3-11] y la cinta entra entera (hasta dos renglones)', a8Ej(cortadas.map(x => x.t)) || regalos.length + ' cintas');
  } finally { f.remove(); }
}

/* ---- [D13] Las cuotas del pedido ---- */
function cuotasPedido(){
  const m = MODELOS.find(x => x.stock && x.precio > 0);
  const plan = CUOTAS.find(c => c.cuotas > 1);
  if(!m || !plan || !TC){ info('[D13] sin producto, plan en cuotas o cotizacion: no se mira'); return; }
  const P0 = PEDIDO, C0 = CUOTAS_PEDIDO;
  try{
    PEDIDO = [{ k: clave(m.rep), n: 1, color: '' }];
    CUOTAS_PEDIDO = plan.cuotas;
    const r = renglonCuotas(), h = htmlCuotasPedido();
    ok(/cuotas de \$ [\d.]+/.test(h) && !/total/i.test(h.replace(/<[^>]+>/g, ' ').split('¿Pagás')[1] || ''),
       '[D13] el pedido dice solo la cuota, sin el total en cuotas', (h.match(/<p class="pd-ayuda">([\s\S]*?)<\/p>/) || [])[1]);
    ok(/aprox\. \$ [\d.]+ c\/u\.$/.test(r) && !/total/i.test(r), '[D13] y el mensaje de WhatsApp tampoco lo lleva', r);
  } finally { PEDIDO = P0; CUOTAS_PEDIDO = C0; }
}

/* ---- [D14] [D16] Textos ---- */
function textos(){
  const n = PREGUNTAS.find(x => /nuevos/i.test(x.p));
  /* (19/10/2026) Con la seccion Usados a la vista va el texto que Benja
     aprobo para ella el 14/10 (con la aclaracion de la caja blanca de D14 A);
     sin usados con stock, el de D14 A. Los dos los mira tambien usados-web.js. */
  const d14 = haySeccionUsados()
    ? 'Sí, todo es nuevo y sellado, salvo los de la sección Usados, que lo dicen en su tarjeta y en su ficha. Los de caja blanca vienen sin la caja original y también lo dice la ficha.'
    : 'Sí, nuevos. Los de caja blanca vienen sin la caja original y lo dice la ficha.';
  ok(!!n && n.r.join(' ') === d14,
     '[D14] "¿Los productos son nuevos?" dice lo que eligio Benja', n && n.r.join(' '));
  const pie = document.getElementById('pie-id');
  // Desde el 19/10 (4C) el pie va en columnas: "Instagram", "@advancetecno" y el link "Ver Instagram"
  const ig = pie && [...pie.querySelectorAll('a')].find(a => /instagram\.com\/advancetecno/.test(a.href));
  const colIg = ig && ig.closest('.pie-col');
  ok(!!ig && ig.textContent === 'Ver Instagram' && !!colIg && /@advancetecno/.test(colIg.textContent) && ig.target === '_blank' && /noopener/.test(ig.rel),
     '[D16] el pie dice "@advancetecno" con el link al perfil', ig && ig.href);
  const ay = document.querySelector('#ayuda .ay-otra');
  const ig2 = ay && ay.querySelector('a[href="https://ig.me/m/advancetecno"]');
  ok(!!ig2 && /Instagram @advancetecno/.test(ig2.textContent), '[D16] y la ayuda ofrece escribir por Instagram ademas de WhatsApp', ay && ay.textContent.replace(/\s+/g, ' ').trim());
}

/* ---- [DW-09] El Redmi Note 15 Pro 4G / 5G ----
   Desde el 27/10 (Benja: una descripcion dice solo lo comun a las versiones
   que pueden llegar) el 4G tiene su propia entrada, sin versiones, y AT-0514
   quedo sin descripcion: su fila 8/256 no dice 5G y puede ser 4G. Lo que se
   cuida es lo mismo de antes: una fila que dice 4G muestra la del 4G, y una
   que no lo dice no la muestra nunca (sin mirar el color). */
function descripcionRedmi(){
  if(typeof DESCRIPCIONES === 'undefined' || !DESCRIPCIONES){ info('[DW-09] las descripciones no cargaron todavia'); return; }
  const filas = PRODUCTOS.filter(p => ['AT-0119', 'AT-0120', 'AT-0514'].includes(String(p.codigo || '').toUpperCase()));
  const mal = [];
  for(const p of filas){
    const e = descripcionDe(p);
    const t = normDesc([p.desc, p.modelo, p.incluye].filter(Boolean).join(' '));
    const dice4g = t.includes('note 15 pro 4g') && !t.includes('note 15 pro 5g');
    const del4g = !!e && /\(4G\)/.test(e.modelo || '');
    if(dice4g !== del4g) mal.push(p.id + ': ' + (e ? e.modelo : 'sin descripcion') + (dice4g ? ' y no la del 4G' : ', que es la del 4G'));
  }
  if(filas.length) ok(!mal.length, '[DW-09] el Redmi Note 15 Pro: la descripcion del 4G si el nombre dice 4G, y nunca si no lo dice (sin mirar el color)',
                      a8Ej(mal) || filas.map(p => p.id.slice(-12) + '=' + ((descripcionDe(p) || {}).modelo || 'sin descripcion')).join(', '));
  else info('[DW-09] hoy no hay filas del Redmi Note 15 Pro');
}

/* ---- [W3-06] Las paginas para Google ---- */
async function paginasGoogle(){
  const py = await a8Leer('herramientas/paginas-producto.py');
  if(!py){ ok(false, '[W3-06] se puede leer herramientas/paginas-producto.py'); return; }
  const cuerpo = (re) => (py.match(re) || [''])[0];
  const desc = cuerpo(/def descripcion_corta\([\s\S]*?\n\n\n/);
  const ld = cuerpo(/def datos_para_google\([\s\S]*?\n\n\n/);
  ok(!!desc && !/Desde u\$|m\['desde'\]|m\['stock'\]/.test(desc), '[W3-06] la descripcion para Google no dice precio ni stock');
  ok(!!ld && !/'offers'|lowPrice|availability/.test(ld), '[W3-06] los datos para Google del HTML no traen oferta (la pone el script con lo del momento)');
  ok(/vivo = true/.test(py) && /porSku/.test(py) && /<b>Consultá el precio<\/b>/.test(py), '[W3-06] el script de la pagina pone precio y stock de ADVAPP; sin eso, "Consulta el precio"');
  // Lo publicado hoy, informativo: se rehace con el proximo PUBLICAR
  const ind = await a8Leer('producto/indice.json');
  let slugs = [];
  try{ slugs = Object.values(JSON.parse(ind || '{}').slugs || {}); }catch(e){}
  const muestra = [...new Set(slugs)].slice(0, 40);
  const viejas = [];
  for(const s of muestra){
    const t = await a8Leer('producto/' + s + '/');
    if(t && /content="Desde u\$/.test(t)) viejas.push(s);
  }
  if(viejas.length) aviso('[W3-06] ' + viejas.length + ' de ' + muestra.length + ' paginas de producto/ miradas todavia tienen el precio fijo del dia en que se armaron (se rehacen con el proximo PUBLICAR): ' + a8Ej(viejas));
  else info('[W3-06] las paginas de producto/ miradas ya no fijan precio');
}
