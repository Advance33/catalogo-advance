// ADVAPP como fuente de productos (17/09/2026). La web lee primero el JSON de
// ADVAPP y queda la planilla de respaldo. Aca se prueba que use ADVAPP cuando
// anda, que vuelva a la planilla en cada caso en que no sirve (error, demora,
// vacio, cortado), que no la confunda con una respuesta cortada solo porque
// trae menos filas que la planilla (las trae a proposito), que las claves de
// los productos sigan siendo los IDs de siempre y que las fotos de ADVAPP se
// usen solo cuando no hay archivo propio.
//
// Las demoras y los errores se simulan cambiando fetch solo para la URL de
// ADVAPP: la planilla, Meta, la cotizacion y las fotos pasan de largo.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };

const esperar = setInterval(() => {
  if(!MODELOS.length || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperar);
  for(let i=1;i<5000;i++) clearInterval(i);
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; })
    .finally(() => {
      try{ pararPaseos(); }catch(e){}
      try{ pararOfertas(); }catch(e){}
      for(let i=1;i<5000;i++) clearInterval(i);
      const pre=document.createElement('pre'); pre.id='RESULTADO';
      pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
      document.body.appendChild(pre);
    });
}, 150);

/* fetch cambiado solo para ADVAPP */
async function conAdvapp(responder, hacer){
  const real = window.fetch;
  window.fetch = (url, opts) => String(url).startsWith(ADVAPP_URL) ? responder(opts) : real(url, opts);
  try{ return await hacer(); } finally { window.fetch = real; }
}
const respuesta = obj => Promise.resolve(new Response(JSON.stringify(obj), { status: 200 }));
const cantidad = d => d.filas.length - 1;

async function correrPruebas(){
  ok(typeof ADVAPP_URL === 'string' && ADVAPP_URL.startsWith('https://'), 'ADVAPP es la fuente configurada', ADVAPP_URL);

  /* ---- 1. Con ADVAPP andando, la pagina usa ADVAPP ---- */
  const real = await (await fetch(ADVAPP_URL, { cache: 'no-store' })).json();
  const meta = await metaDelCiclo();
  const filasMeta = Number(meta && meta.filas) || 0;
  ok(FUENTE && FUENTE.fuente === 'advapp', 'la pagina cargo desde ADVAPP',
     FUENTE && (FUENTE.fuente + (FUENTE.motivo ? ' · ' + FUENTE.motivo : '')));
  ok(PRODUCTOS.length === real.productos.length, 'con todos sus productos', PRODUCTOS.length + ' de ' + real.productos.length);

  /* ---- 2. Las claves siguen siendo los IDs de la planilla ---- */
  const idsJson = real.productos.map(p => p.ID).sort().join('|');
  const idsWeb = PRODUCTOS.map(p => clave(p)).sort().join('|');
  ok(idsJson === idsWeb, 'la clave de cada producto es su ID de siempre (links #p=, pedido, vistos)');

  /* ---- 3. Los precios son los de ADVAPP, sin tocar ---- */
  const porId = new Map(real.productos.map(p => [p.ID, p]));
  const distintos = PRODUCTOS.filter(p => {
    const j = porId.get(p.id);
    const n = Number(String(j['Precio USD']).replace(/[^\d.]/g, ''));
    return j && n > 0 && p.precio !== n;
  });
  ok(!distintos.length, 'cada precio es el que manda ADVAPP',
     distintos.slice(0, 3).map(p => p.id + ' ' + p.precio + ' vs ' + porId.get(p.id)['Precio USD']).join(' | ') || 'todos');

  /* ---- 4. El sello sale del manifiesto de ADVAPP, no de la hoja Meta ---- */
  const sello = document.getElementById('stamp').textContent.trim();
  if(FUENTE && FUENTE.manifiesto && FUENTE.manifiesto.verificado_hoy)
    ok(sello === 'Actualizado hoy', 'con verificado_hoy de ADVAPP el sello dice "Actualizado hoy"', sello);
  else
    ok(sello !== 'Actualizado hoy', 'sin verificado_hoy de ADVAPP el sello no dice "hoy"', sello);

  /* ---- 5. Con ADVAPP bien, no se le pide nada a la planilla ----
     La hoja Meta es un pedido a Google que tarda y casi siempre confirma lo que
     ya sabemos. Se consulta sólo si algo no cierra (ver bajarDatos). */
  {
    const real2 = window.fetch;
    let aGoogle = 0;
    window.fetch = (url, opts) => { if(/docs\.google/.test(String(url))) aGoogle++; return real2(url, opts); };
    try{
      const d = await bajarDatos();
      ok(d.fuente === 'advapp' && aGoogle === 0,
         'con ADVAPP andando no se pide ni la planilla ni su hoja Meta', d.fuente + ' · ' + aGoogle + ' pedidos a Google');
    }finally{ window.fetch = real2; }
  }

  /* ---- 6. Menos filas que la planilla NO es estar cortado ---- */
  if(filasMeta){
    const n = Math.ceil(filasMeta * 0.85);
    const d = await conAdvapp(() => respuesta({ ...real, filas: n, productos: real.productos.slice(0, n) }), bajarDatos);
    ok(d.fuente === 'advapp', 'con el 85 % de las filas de la planilla sigue usando ADVAPP', cantidad(d) + ' de ' + filasMeta);
  }else{
    R.push('  --   la hoja Meta no dice cuantas filas tiene: no se prueba el margen');
  }

  /* ---- 6. Cada caso en que ADVAPP no sirve vuelve a la planilla ---- */
  const casos = [
    ['si ADVAPP da error', () => Promise.resolve(new Response('fallo', { status: 500 }))],
    ['si la conexion falla', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['si no devuelve JSON', () => Promise.resolve(new Response('<html>no</html>', { status: 200 }))],
    ['si trae 0 productos', () => respuesta({ ...real, filas: 0, productos: [] })],
    ['si trae menos productos de los que declara', () => respuesta({ ...real, productos: real.productos.slice(0, 100) })],
  ];
  if(filasMeta){
    const n = Math.floor(filasMeta * 0.5);
    casos.push(['si trae menos del 80 % de las filas de la planilla',
                () => respuesta({ ...real, filas: n, productos: real.productos.slice(0, n) })]);
  }
  for(const [texto, responder] of casos){
    const d = await conAdvapp(responder, bajarDatos);
    ok(d.fuente === 'planilla' && cantidad(d) >= filasMeta, texto + ', usa la planilla entera',
       d.fuente + ' · ' + cantidad(d) + ' filas · ' + (d.motivo || 'sin motivo'));
  }

  // La demora: ADVAPP no contesta nunca, y a los ADVAPP_ESPERA_MS se corta
  const t0 = Date.now();
  const lento = await conAdvapp(opts => new Promise((_, rechazar) =>
    opts.signal.addEventListener('abort', () => rechazar(Object.assign(new Error('abortado'), { name: 'AbortError' })))),
    bajarDatos);
  ok(lento.fuente === 'planilla' && cantidad(lento) >= filasMeta,
     `si ADVAPP tarda mas de ${ADVAPP_ESPERA_MS / 1000} s, usa la planilla`, lento.motivo + ' · ' + (Date.now() - t0) + ' ms');

  /* ---- 7. Fotos: la propia primero, la de ADVAPP solo si no hay ---- */
  const conLas2 = PRODUCTOS.filter(p => p.imagen && Object.keys(p.fotosAdvapp || {}).length);
  ok(conLas2.length > 0 && conLas2.every(p => !/googleusercontent|supabase/.test(p.imagen)),
     'con archivo propio en fotos/, la portada es la propia', conLas2.length + ' filas con las dos');

  // Una fila de varios colores alineados con CODIGO_VAR, sin sus archivos
  const caso = PRODUCTOS.find(p => {
    const cols = partirColores(p.color), cvs = String(p.codigoVar).split('/');
    return cols.length >= 2 && cvs.length === cols.length && cvs.every(cv => (p.fotosAdvapp || {})[cv]);
  });
  if(caso){
    const guardado = INDICE_FOTOS;
    INDICE_FOTOS = new Set([...guardado].filter(f => !f.startsWith(caso.codigo)));
    try{
      const cols = partirColores(caso.color), cvs = caso.codigoVar.split('/');
      ok(fotoDeCarpeta(caso, caso.color) === '', 'sin archivos del producto no hay foto local', caso.id);
      ok(fotoDeAdvapp(caso, caso.color) === caso.fotosAdvapp[cvs[0]],
         'la portada de respaldo es la de ADVAPP del primer color', cols[0] + ' -> ' + cvs[0]);
      const ult = cols.length - 1;
      ok((fotosDeColor(caso, cols[ult])[0] || '') === caso.fotosAdvapp[cvs[ult]],
         'y al elegir un color, la de su posicion en CODIGO_VAR', cols[ult] + ' -> ' + cvs[ult]);
    }finally{
      INDICE_FOTOS = guardado;
    }
  }else{
    R.push('  --   no hay fila de varios colores con fotos de ADVAPP para probar el respaldo');
  }

  // Lo que no se puede saber, no se adivina
  const u = n => 'https://lh3.googleusercontent.com/d/prueba' + n;
  ok(fotoDeAdvapp({ color: 'Black/White', codigoVar: '', codigo: 'AT-9999',
                    fotosAdvapp: { 'AT-9999-01': u(1), 'AT-9999-02': u(2) } }, 'White') === '',
     'con dos SKUs y CODIGO_VAR vacio no elige ninguna foto');
  ok(fotoDeAdvapp({ color: 'Starlight · S/M', codigoVar: '/', codigo: 'AT-9999',
                    fotosAdvapp: { 'AT-9999-02': u(3) } }, 'Starlight · S/M') === u(3),
     'un solo color y un solo SKU alcanza aunque CODIGO_VAR venga cortado');
  ok(fotoDeAdvapp({ color: '', codigoVar: '', codigo: 'AT-9999',
                    fotosAdvapp: { 'AT-9999': u(4) } }) === u(4),
     'sin colores, la foto del producto');
  ok(fotosDeLosSkus('[{"sku":"X","at":"at-0001-01","fotos":["javascript:alert(1)","https://x/y"]}]')['AT-0001-01'] === undefined,
     'solo se aceptan links http(s) en la primera foto de cada SKU');
}
