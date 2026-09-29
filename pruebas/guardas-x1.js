// Guardas de la tanda x1 (auditoria del 29/09/2026). Lo que quedo sin hacer
// de otras tandas porque tocaba index.html. El numero entre corchetes es el
// del hallazgo:
//
//  [39]  La primera carga SIN indice.json pedia fotos por SKU y por ID, y de
//        esas ya no queda ninguna: 424 productos apuntaban a archivos que no
//        existen, 285 de ellos con la foto de ADVAPP a mano.
//  [196] La montura sale del SKU de ADVAPP: 9 lentes que dicen solo "CANON"
//        quedaban afuera del filtro, y 7 Tamron "III NIKON" salian Nikon F.
//        Y validar.py la mira igual (revision del 29/09): seguia leyendo
//        solo el nombre y le pedia a ADVAPP la montura de 8 que ya la traen.
//  [17] "3Y Warranty" en el nombre va al renglon de garantia, con el plazo
//        que dice el nombre y nunca uno por defecto.
//  [145] [143] Comentarios de index.html que decian lo que no pasa (el 304
//        de ADVAPP, el robots.txt).
//  [188] Textos de correr.py, PROBAR.command y tarjeta.js de la epoca de la
//        planilla y de los puntitos de la tarjeta.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);

const esperaX1 = setInterval(() => {
  if(!MODELOS.length || !document.querySelectorAll('#cats .chip').length || !INDICE_FOTOS) return;
  clearInterval(esperaX1);
  for(let i=1;i<5000;i++) clearInterval(i);
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; })
    .finally(() => {
      try{ pararPaseos(); }catch(e){}
      try{ pararOfertas(); }catch(e){}
      try{ pararMundos(); }catch(e){}
      for(let i=1;i<5000;i++) clearInterval(i);
      const pre=document.createElement('pre'); pre.id='RESULTADO';
      pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
      document.body.appendChild(pre);
    });
}, 150);

/* Un archivo tal como lo sirve el servidor local. null si no esta. */
async function x1Leer(ruta){
  try{
    const r = await fetch(ruta.split('/').map(encodeURIComponent).join('/') + '?_=' + Date.now(), { cache: 'no-store' });
    return r.ok ? await r.text() : null;
  }catch(e){ return null; }
}

/* El archivo de fotos/ al que apunta una direccion, o '' si no es de fotos/ */
const x1Archivo = u => (u && u.includes(CARPETA_FOTOS))
  ? decodeURIComponent(u.split('/').pop().split('?')[0]) : '';
const X1_NOMBRE_AT = /^AT-\d{4}(-\d{2})?\.jpg$/;

async function correrPruebas(){
  const hoy = await (await fetch(ADVAPP_URL, { cache: 'no-store' })).json();
  const crudo = new Map((hoy.productos || []).map(x => [x.ID, x]));
  ok(FUENTE && FUENTE.fuente === 'advapp', 'la pagina cargo desde ADVAPP (lo demas lo da por hecho)',
     FUENTE && FUENTE.fuente);

  await sinIndice(crudo);
  montura(crudo);
  await garantia(crudo);
  const indexSrc = await x1Leer('index.html');
  comentarios(indexSrc);
  monturaEnValidar(indexSrc, await x1Leer('validar.py'));
  await textosDePruebas();
}

/* ---- [39] La primera carga sin indice.json ---- */
async function sinIndice(crudo){
  const indice0 = INDICE_FOTOS, mapa0 = CATALOGO, modelos0 = MODELOS;

  /* Con el indice (la carga de hoy): ninguna portada ni ningun candidato es
     un nombre por SKU o por ID. */
  const noAT = PRODUCTOS.filter(p => x1Archivo(p.imagenGrande) && !X1_NOMBRE_AT.test(x1Archivo(p.imagenGrande)));
  ok(!noAT.length, '[39] con indice, toda portada de fotos/ es un AT-####',
     noAT.slice(0, 3).map(p => p.id + ' ' + x1Archivo(p.imagenGrande)).join(' | ') || PRODUCTOS.length + ' productos');
  const candidatosMalos = [];
  for(const p of PRODUCTOS)
    for(const n of nombresDeFoto(p, partirColores(p.color || '')))
      if(!/^AT-\d{4}(-\d{2})?$/.test(n)) candidatosMalos.push(p.id + ' ' + n);
  ok(!candidatosMalos.length, '[39] nombresDeFoto() ya no propone nombres por SKU ni por ID',
     candidatosMalos.slice(0, 3).join(' | ') || PRODUCTOS.length + ' productos');

  /* Casos armados, sin depender de los datos de hoy */
  const urlAdvapp = 'https://lh3.googleusercontent.com/x1-prueba=w900';
  const fila = { id: 'CEL-APP-066', sku: 'celular~apple~17-iphone~256gb', codigo: 'AT-9001',
                 color: 'Black', codigoVar: 'AT-9001-01', fotosAdvapp: { 'AT-9001-01': urlAdvapp } };
  try{
    INDICE_FOTOS = null; CATALOGO = null;
    const n = nombresDeFoto({ id: 'CEL-APP-066', sku: 'celular~apple~17-iphone~256gb', codigo: '', color: 'Black' }, ['Black']);
    ok(n.length === 0, '[39] sin codigo y sin mapa no se inventa ningun nombre (antes: <SKU>-black, <ID>-black...)', n.join(', '));
    ok(fotoDePortada(fila, 'Black') === urlAdvapp,
       '[39] sin indice, la portada es la foto de ADVAPP de ese color y no un archivo a ciegas', fotoDePortada(fila, 'Black'));
    const sinAdvapp = fotoDePortada({ ...fila, fotosAdvapp: {} }, 'Black');
    ok(x1Archivo(sinAdvapp) === 'AT-9001.jpg',
       '[39] sin indice y sin foto de ADVAPP, el codigo a secas y que el onerror decida', sinAdvapp);
    INDICE_FOTOS = new Set(['AT-9001.jpg']);
    ok(x1Archivo(fotoDePortada(fila, 'Black')) === 'AT-9001.jpg',
       '[39] con indice, el archivo propio va antes que la foto de ADVAPP', fotoDePortada(fila, 'Black'));
  }finally{ INDICE_FOTOS = indice0; CATALOGO = mapa0; }

  /* La carga de verdad, con indice.json cortado y sin indice anterior: lo
     que pasa en la primera visita si el indice no llega. */
  const fetchReal = window.fetch;
  let c;
  try{
    window.fetch = (u, o) => /indice\.json/.test(String(u)) ? Promise.reject(new TypeError('Failed to fetch')) : fetchReal(u, o);
    INDICE_FOTOS = null; CATALOGO = null;
    c = await cargar();
  }finally{ window.fetch = fetchReal; }
  try{
    ok(INDICE_FOTOS === null, '[39] la carga corrio de verdad sin indice');
    const fantasmas = c.productos.filter(p => x1Archivo(p.imagenGrande) && !indice0.has(x1Archivo(p.imagenGrande)));
    const porSku = fantasmas.filter(p => !X1_NOMBRE_AT.test(x1Archivo(p.imagenGrande)));
    ok(!porSku.length, '[39] sin indice, ningun producto pide una foto por SKU o por ID',
       porSku.slice(0, 3).map(p => p.id + ' ' + x1Archivo(p.imagenGrande)).join(' | ') || c.productos.length + ' productos');
    const color = p => colorDeLaFila(p.color, p.desc || p.modelo);
    const pudiendo = fantasmas.filter(p => fotoDeAdvapp(p, color(p)));
    ok(!pudiendo.length, '[39] y ninguno pide un archivo que no existe teniendo la foto de ADVAPP (eran 285)',
       pudiendo.slice(0, 3).map(p => p.id + ' ' + x1Archivo(p.imagenGrande)).join(' | ') || fantasmas.length + ' a ciegas, todos sin foto de ADVAPP');
    const conAdvapp = c.productos.filter(p => !crudo.get(p.id) || !(crudo.get(p.id).Imagen || '').trim())
                                 .filter(p => fotoDeAdvapp(p, color(p)));
    const distinta = conAdvapp.filter(p => p.imagenGrande !== fotoDeAdvapp(p, color(p)));
    ok(conAdvapp.length > 0 && !distinta.length, '[39] cada producto con foto de ADVAPP la usa de portada',
       distinta.slice(0, 3).map(p => p.id).join(', ') || conAdvapp.length + ' productos');

    /* La tira de colores de la ficha, con las filas de esa carga */
    MODELOS = agrupar(c.productos);
    let colores = 0;
    const malos = [];
    for(const p of c.productos){
      for(const col of partirColores(p.color || '')){
        const u = fotosDeColor(p, col)[0] || '';
        if(!u) continue;
        colores++;
        if(x1Archivo(u) && !indice0.has(x1Archivo(u))) malos.push(p.id + ' ' + col + ' -> ' + x1Archivo(u));
      }
    }
    ok(colores > 0 && !malos.length, '[39] sin indice, la foto de un color en la ficha nunca es un archivo que no existe',
       malos.slice(0, 3).join(' | ') || colores + ' colores con foto');
  }finally{
    INDICE_FOTOS = indice0; CATALOGO = mapa0; MODELOS = modelos0;
  }
}

/* ---- [196] La montura, del SKU de ADVAPP ---- */
function montura(crudo){
  ok(monturaDelSku('lente~sigma~canon-dg~50-f1.4-art-hsm-canef') === 'Canon EF'
     && monturaDelSku('LEN-TAM-1120F28-000-000-CANRF') === 'Canon RF',
     '[196] el final del SKU dice la montura (CANEF, CANRF)');
  ok(monturaDelSku('x-CANRFS') === 'Canon RF-S' && monturaDelSku('x-CANEFS') === 'Canon EF-S'
     && monturaDelSku('x-CANEFM') === 'Canon EF-M' && monturaDelSku('x-NIKZ') === 'Nikon Z'
     && monturaDelSku('x-NIKF') === 'Nikon F' && monturaDelSku('x-SONYE') === 'Sony E',
     '[196] el sufijo se compara entero: CANRFS no es CANRF');
  ok(monturaDelSku('LEN-SIG-56F14DNCONT-000-000-000') === '' && monturaDelSku('x-FUJIX') === ''
     && monturaDelSku('x-constructor') === '' && monturaDelSku('') === '',
     '[196] "-000" o un sufijo que no esta en la tabla no dan montura');
  const skus = (...s) => JSON.stringify(s.map(sku => ({ sku })));
  ok(monturaDeLosSkus(skus('A-CANEF', 'B-CANEF')) === 'Canon EF'
     && monturaDeLosSkus(skus('A-CANEF', 'B-CANRF')) === ''
     && monturaDeLosSkus(skus('A-CANEF', 'B-000')) === ''
     && monturaDeLosSkus('no es json') === '' && monturaDeLosSkus('[]') === '',
     '[196] con varios SKU, solo si todos dicen lo mismo');

  const lentes = PRODUCTOS.filter(esLente);
  const fin = x => { const m = /[-~]([a-z0-9]+)$/i.exec(String(x || '')); return m ? m[1].toUpperCase() : ''; };
  const ESPERADA = { CANRFS:'Canon RF-S', CANRF:'Canon RF', CANEFS:'Canon EF-S', CANEFM:'Canon EF-M',
                     CANEF:'Canon EF', SONYE:'Sony E', NIKZ:'Nikon Z', NIKF:'Nikon F' };
  const contra = [], inventadas = [];
  let conSku = 0;
  for(const p of lentes){
    const f = crudo.get(p.id);
    if(!f) continue;
    const dichos = [...new Set((f.SKUS || []).map(s => fin(s && s.sku)))];
    const esperada = dichos.length === 1 ? (ESPERADA[dichos[0]] || '') : '';
    if(esperada){
      conSku++;
      if(p.montura !== esperada) contra.push(p.id + ' ' + (p.montura || '-') + ' (SKU ' + dichos[0] + ')');
    }else if(dichos.every(d => d === '000') && !monturaDe(p) && p.montura){
      inventadas.push(p.id + ' ' + p.montura);
    }
  }
  ok(conSku > 0 && !contra.length, '[196] todo lente cuyo SKU dice la montura la muestra, aunque el nombre diga otra cosa',
     contra.slice(0, 4).join(' | ') || conSku + ' de ' + lentes.length + ' lentes');
  ok(!inventadas.length, '[196] el que no la dice ni en el SKU ni en el nombre queda sin montura: no se inventa',
     inventadas.join(' | ') || lentes.filter(p => !p.montura).map(p => p.id).join(', ') || 'hoy todos la dicen');
  const casos = [['LEN-SIG-007', 'Canon EF', 'CANEF'], ['LEN-TAM-001', 'Canon RF', 'CANRF'], ['LEN-TAM-004', 'Nikon Z', 'NIKZ']];
  for(const [id, m, suf] of casos){
    const p = PRODUCTOS.find(x => x.id === id), f = crudo.get(id);
    if(!p || !f || !(f.SKUS || []).every(s => fin(s && s.sku) === suf)){ info('[196] ' + id + ' ya no viene con -' + suf + ': no se prueba'); continue; }
    ok(p.montura === m, '[196] ' + id + ' "' + (p.modelo || p.desc) + '" es ' + m, p.montura || 'sin montura');
    const mod = buscarModelo(clave(p));
    ok(!!mod && mod.montura === m, '[196] y su tarjeta entra en el filtro ' + m, mod && mod.montura);
  }
  const noLentes = PRODUCTOS.filter(p => !esLente(p) && p.montura);
  ok(!noLentes.length, '[196] fuera de los objetivos nadie tiene montura',
     noLentes.slice(0, 3).map(p => p.id + ' ' + p.montura).join(' | ') || 'ninguno');
}

/* ---- [196] validar.py mira la montura como la web ----
   El aviso "sin montura" de validar.py leia solo el nombre, y cuando la web
   paso a leer primero el SKU nadie volvio sobre el: avisaba 8 lentes que la
   web si filtra y al PUBLICAR (--pedido) le pedia a ADVAPP un dato que ya
   manda (revision del 29/09). montura_de() copia la formula de p.montura y
   lee la tabla del index: si cambia una de las dos, esto lo dice. */
function monturaEnValidar(indexSrc, validarSrc){
  if(!indexSrc || !validarSrc){ ok(false, '[196] no se pudieron leer index.html y validar.py'); return; }
  ok(indexSrc.includes('p.montura = (esLente(p) && p.monturaSku) || monturaDe(p)'),
     '[196] p.montura sigue siendo "SKU y despues nombre", la formula que copia montura_de() de validar.py (si cambia, cambiar las dos)');
  const def = n => {
    const i = validarSrc.indexOf('\ndef ' + n + '(');
    if(i < 0) return '';
    const j = validarSrc.indexOf('\ndef ', i + 5);
    return validarSrc.slice(i, j < 0 ? undefined : j);
  };
  const md = def('montura_de'), rl = def('regla_lentes');
  const iSku = md.indexOf('montura_del_sku_de_la_fila('), iNombre = md.indexOf('for rx, m in monturas');
  ok(iSku >= 0 && iNombre > iSku && rl.includes('monturas_del_sku_del_index()') && rl.includes('montura_de(f, monturas, del_sku)'),
     '[196] regla_lentes de validar.py mira primero el SKU y despues el nombre, como la web');
  // La tabla, leida con la expresion que usa validar.py (sacada de su codigo)
  const rx = /re\.findall\(r"""(.+?)"""/.exec(def('monturas_del_sku_del_index'));
  const ini = indexSrc.indexOf('const MONTURAS_DEL_SKU = {'), fin = indexSrc.indexOf('};', ini);
  const leida = {};
  if(rx && ini >= 0) for(const m of indexSrc.slice(ini, fin).matchAll(new RegExp(rx[1], 'g'))) leida[m[1]] = m[2];
  const a = JSON.stringify(Object.entries(leida).sort()), b = JSON.stringify(Object.entries(MONTURAS_DEL_SKU).sort());
  ok(!!rx && a === b, '[196] validar.py lee MONTURAS_DEL_SKU entera y con los mismos valores que la web',
     a === b ? Object.keys(leida).length + ' sufijos' : 'validar ' + a + ' · web ' + b);
}

/* ---- [17] La garantia en ingles, al renglon de garantia ---- */
async function garantia(crudo){
  const g = d => sacarNotasDelNombre({ desc: d, incluye: '', condicion: '', garantia: '' });
  const a = g('P2725H | Dell 27" FHD (1920x1080 · Vesa · USB · 3Y Warranty)');
  ok(a.garantia === '3 años' && a.desc === 'P2725H | Dell 27" FHD (1920x1080 · Vesa · USB)',
     '[17] "3Y Warranty" pasa al renglon como "3 años" y sale del nombre', a.desc + ' · ' + a.garantia);
  const b = g('Monitor X (FHD · 2 Years Warranty)');
  ok(b.garantia === '2 años' && b.desc === 'Monitor X (FHD)', '[17] tambien "2 Years Warranty"', b.desc + ' · ' + b.garantia);
  const c = g('Monitor X (FHD / 1Y Warranty)'), d = g('Monitor X · Garantía 1 Año');
  ok(c.garantia === '1 año' && d.garantia === '1 año', '[17] con un año dice "1 año", no "1 años"', c.garantia + ' · ' + d.garantia);
  const e = g('Monitor X 27" FHD');
  ok(e.garantia === '', '[17] sin garantia en el nombre no se pone ninguna por defecto', e.garantia || 'vacia');

  /* La ficha real se elige por su forma y no por ID (29/09): ADVAPP renumera
     (el Dell P2725H, AT-0421, ya fue MON-DEL-010, 012 y 014), y con el
     'MON-DEL-014' fijo esto fallaba con la pagina bien el dia que ese numero
     fuera otro monitor, o decia "no esta" teniendolo. Se abre la primera
     fila con stock cuyo nombre crudo en ADVAPP trae "NY Warranty", y se
     espera el plazo que dice ese nombre. La expresion es propia: con la de
     la pagina la prueba daria siempre la razon. ID y codigo AT juntos, asi
     una renumeracion entre la carga y la bajada de crudo no cruza filas. */
  if(!FUENTE || FUENTE.fuente !== 'advapp'){ info('[17] la pagina no cargo de ADVAPP: no se abre ninguna ficha'); return; }
  let caso = null;
  for(const x of crudo.values()){
    const m = /\b(\d+)\s*Y(?:ears?)?\s+Warranty\b/i.exec(x['Descripción completa'] || x.Modelo || '');
    const p = m && PRODUCTOS.find(q => q.id === x.ID && (q.codigo || '') === (x.CODIGO || ''));
    if(p && p.stock && buscarModelo(clave(p))){ caso = { p, plazo: m[1] === '1' ? '1 año' : m[1] + ' años' }; break; }
  }
  if(!caso){ info('[17] hoy ninguna fila con stock trae "NY Warranty" en el nombre: no se abre ninguna ficha'); return; }
  const quien = (caso.p.codigo || caso.p.id) + ' ' + caso.p.desc;
  abrirFicha(clave(caso.p), null);
  try{
    const f = document.getElementById('ficha');
    const linea = f && f.querySelector('.fi-servicio [data-servicio="garantia"] i');
    ok(!!linea && linea.textContent === caso.plazo, '[17] la ficha de ' + quien + ' dice su garantia, "' + caso.plazo + '"', linea && linea.textContent);
    ok(!!f && !/Warranty/i.test(f.textContent), '[17] y en la ficha no queda "Warranty" en ningun lado');
  }finally{ quitarFicha(); }
}

/* ---- [145] [143] Comentarios que decian lo que no pasa ---- */
function comentarios(src){
  if(!src){ ok(false, 'se lee index.html'); return; }
  ok(!/65 KB/.test(src) && !/lo normal entre los\s+refrescos/.test(src),
     '[145] el comentario de bajarAdvapp ya no da el 304 por hecho ni dice 65 KB');
  ok(/hallazgo 145/.test(src) && /P-04/.test(src), '[145] y dice por que casi nunca llega y que se le pidio a ADVAPP');
  ok(!/y tambi[eé]n el robots\.txt que est[aá] al lado del index/.test(src),
     '[143] el comentario del noindex ya no manda a borrar tambien el robots.txt');
  ok(/lo [ÚU]NICO que lo evita/.test(src), '[143] y dice que el meta noindex es lo unico que sirve');
}

/* ---- [188] Textos de las pruebas ---- */
async function textosDePruebas(){
  const correrPy = await x1Leer('pruebas/correr.py');
  const probar = await x1Leer('PROBAR.command');
  const tarjeta = await x1Leer('pruebas/tarjeta.js');
  ok(!!correrPy && !!probar && !!tarjeta, '[188] se leen correr.py, PROBAR.command y tarjeta.js');
  if(correrPy)
    ok(!/contra la planilla|planilla de (verdad|hoy)|bajan la planilla/i.test(correrPy) && /PROBAR\.command/.test(correrPy),
       '[188] correr.py habla de los datos de ADVAPP y de PROBAR.command, no de la planilla');
  if(probar)
    ok(!/planilla de verdad/i.test(probar) && /ADVAPP/.test(probar), '[188] PROBAR.command dice que usa los datos de ADVAPP');
  if(tarjeta){
    ok(!/puntitos cambian la foto/i.test(tarjeta) && !/(ya se ve|ya esta) en los puntitos/i.test(tarjeta),
       '[188] tarjeta.js no tiene el encabezado huerfano ni dice que la tarjeta tiene puntitos');
    const ult = [...tarjeta.matchAll(/\/\* ---- [0-9a-z]+\./g)].pop();
    ok(!!ult && /\bok\(/.test(tarjeta.slice(ult.index)), '[188] y su ultima seccion tiene comprobaciones abajo',
       ult && tarjeta.slice(ult.index, ult.index + 40));
  }
}
