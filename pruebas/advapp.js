// ADVAPP como fuente de productos (17/09/2026). La web lee el JSON de ADVAPP.
// Aca se prueba que use ADVAPP cuando anda, que en cada caso en que no sirve
// (error, demora, vacio, cortado) use la copia de la ultima respuesta buena
// guardada en este navegador y nunca la planilla, que las claves de los
// productos sigan siendo los IDs de siempre y que las fotos de ADVAPP se usen
// solo cuando no hay archivo propio.
// (29/09: hasta la decision 1.3 A de Pedro esto exigia volver a la planilla
// del 16/09 en cada falla. Ahora la planilla no es respaldo: primero la copia
// y, sin copia, el aviso de no disponible. Ver decision-resiliencia.js.)
// (Decia tambien "que no la confunda con una respuesta cortada solo porque
// trae menos filas que la planilla": eso era cierto hasta que ADVAPP paso a
// traer mas. Ver la seccion 6, 29/09.)
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

  /* Las simulaciones de abajo pasan por bajarDatos(), que guarda en este
     navegador cuantas filas trajo la ultima carga aceptada: es la vara con
     la que decide si la proxima vino cortada. Sin devolverla, cada caso
     dejaba la vara del anterior y el siguiente probaba otra cosa (29/09). */
  const guardarVara = () => { try{ return [localStorage.getItem(ULTIMAS_FILAS), localStorage.getItem(FILAS_PENDIENTES)]; }catch(e){ return [null, null]; } };
  const devolverVara = ([a, b]) => {
    try{
      if(a === null) localStorage.removeItem(ULTIMAS_FILAS); else localStorage.setItem(ULTIMAS_FILAS, a);
      if(b === null) localStorage.removeItem(FILAS_PENDIENTES); else localStorage.setItem(FILAS_PENDIENTES, b);
    }catch(e){}
  };
  const vara = guardarVara();
  const conVara = async (hacer, antes) => {
    try{ if(antes !== undefined) devolverVara(antes); return await hacer(); } finally { devolverVara(vara); }
  };
  const total = real.productos.length;

  /* ---- 6. Una carga corta de ADVAPP ----
     Hasta el 29/09 esto exigia que "con el 85 % de las filas de la planilla
     siga usando ADVAPP" (496 de 583): era cuando ADVAPP traia MENOS filas que
     la planilla a proposito. Hoy es al reves (758 contra una planilla
     congelada en 583), y esa comprobacion fijaba justo el hueco del hallazgo
     181: una carga con el 65 % de los productos de hoy se usa como completa,
     porque la hoja Meta congelada la rescata. Que hacer ante una carga corta
     -mostrar lo que vino de ADVAPP y avisar, o volver a la planilla del
     16/09- lo decide Pedro; hasta entonces aca se informa lo que hace la
     pagina, sin darlo por bueno ni por malo. */
  {
    const n = Math.ceil(total * 0.65);
    const d = await conVara(() => conAdvapp(() => respuesta({ ...real, filas: n, productos: real.productos.slice(0, n) }), bajarDatos));
    R.push('  --  con ' + n + ' de los ' + total + ' productos de hoy (65 %) la pagina usa ' + d.fuente +
           (d.motivo ? ' (' + d.motivo + ')' : '') + ': que hacer ante una carga corta lo decide Pedro (hallazgo 181)');
    const nueva = await conVara(() => conAdvapp(() => respuesta({ ...real, filas: 100, productos: real.productos.slice(0, 100) }), bajarDatos),
                                [null, null]);
    R.push('  --  un visitante nuevo (sin carga anterior en su navegador) con 100 de ' + total + ' usa ' + nueva.fuente +
           (nueva.fuente === 'advapp' ? ': sin vara, no hay control de tamaño (hallazgo 181)' : ''));
  }

  /* ---- 6. Cada caso en que ADVAPP no sirve usa la copia, nunca la planilla ----
     29/09 (decision 1.3 A de Pedro): cada caso exigia "usa la planilla
     entera". Ahora exige la copia de la ultima respuesta buena de ADVAPP que
     este navegador guardo al cargar la pagina, entera y con su hora, sin
     pedirle la planilla a Google. La hoja Meta si se puede pedir: cuenta
     filas cuando ADVAPP viene corto, y no son los datos de la planilla. */
  const copia = leerCopia();
  ok(!!copia && copia.filas.length - 1 >= PRODUCTOS.length && Date.now() - copia.hora < 10 * 60000,
     'la carga de ADVAPP quedo guardada como copia en este navegador, con su hora',
     copia ? (copia.filas.length - 1) + ' filas de las ' + hhmm(copia.hora) : 'sin copia');
  const esPlanilla = u => FUENTES.some(f => String(u).startsWith(f));
  let aPlanilla = 0;
  const contando = async hacer => {
    const f = window.fetch;
    window.fetch = (u, o) => { if(esPlanilla(u)) aPlanilla++; return f(u, o); };
    try{ return await hacer(); } finally { window.fetch = f; }
  };
  const casos = [
    ['si ADVAPP da error', () => Promise.resolve(new Response('fallo', { status: 500 }))],
    ['si la conexion falla', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['si no devuelve JSON', () => Promise.resolve(new Response('<html>no</html>', { status: 200 }))],
    ['si trae 0 productos', () => respuesta({ ...real, filas: 0, productos: [] })],
    ['si trae menos productos de los que declara', () => respuesta({ ...real, productos: real.productos.slice(0, 100) })],
  ];
  /* Contra los productos de HOY y no contra las filas de la hoja Meta
     (29/09, hallazgo 181): la hoja quedo congelada en 583 y ADVAPP trae 758.
     Con la mitad, cualquiera sea la decision de arriba, no es un catalogo. */
  {
    const n = Math.floor(total * 0.5);
    casos.push(['si trae la mitad de los productos de la ultima carga',
                () => respuesta({ ...real, filas: n, productos: real.productos.slice(0, n) })]);
  }
  const esLaCopia = d => !!copia && d.fuente === 'copia' && d.hora === copia.hora && cantidad(d) === copia.filas.length - 1;
  for(const [texto, responder] of casos){
    aPlanilla = 0;
    const d = await conVara(() => contando(() => conAdvapp(responder, bajarDatos)));
    ok(esLaCopia(d) && aPlanilla === 0, texto + ', usa la copia entera con su hora y no la planilla',
       d.fuente + ' · ' + cantidad(d) + ' filas · ' + (d.motivo || 'sin motivo') + ' · ' + aPlanilla + ' pedidos a la planilla');
  }

  // La demora: ADVAPP no contesta nunca, y a los ADVAPP_ESPERA_MS se corta
  const t0 = Date.now();
  aPlanilla = 0;
  const lento = await contando(() => conAdvapp(opts => new Promise((_, rechazar) =>
    opts.signal.addEventListener('abort', () => rechazar(Object.assign(new Error('abortado'), { name: 'AbortError' })))),
    bajarDatos));
  ok(esLaCopia(lento) && aPlanilla === 0,
     `si ADVAPP tarda mas de ${ADVAPP_ESPERA_MS / 1000} s, usa la copia`, lento.motivo + ' · ' + (Date.now() - t0) + ' ms');

  /* Sin copia (primera visita, o vencida), ninguna falla termina en la
     planilla: bajarDatos da error, y actualizar() muestra el aviso. */
  {
    const c0 = localStorage.getItem(COPIA_KEY), h0 = localStorage.getItem(COPIA_HORA_KEY);
    try{
      borrarCopia();
      for(const [texto, responder] of casos.slice(0, 2)){
        aPlanilla = 0;
        let fallo = '';
        try{ await conVara(() => contando(() => conAdvapp(responder, bajarDatos))); }catch(e){ fallo = e.message; }
        ok(/sin copia/.test(fallo) && aPlanilla === 0, 'sin copia, ' + texto + ' no cae a la planilla: da error',
           (fallo || 'no dio error') + ' · ' + aPlanilla + ' pedidos a la planilla');
      }
    }finally{
      try{ if(c0 !== null) localStorage.setItem(COPIA_KEY, c0); if(h0 !== null) localStorage.setItem(COPIA_HORA_KEY, h0); }catch(e){}
    }
  }

  /* ---- 7. Fotos: la propia primero, la de ADVAPP solo si no hay ---- */
  /* "Con archivo propio" se pregunta de verdad, con fotoDeCarpeta, igual que
     al cargar. Antes se contaba toda fila con fotos de ADVAPP, y la que no
     tiene archivo propio -y por eso usa, bien, la de ADVAPP- hacia fallar la
     prueba: el Watch Ultra 3 Black Ocean trae en CODIGO_VAR la variante de
     otro producto (AT-0455-01 en una fila AT-0456) y no le toca ningun archivo. */
  const propia = p => fotoDeCarpeta(p, colorDeLaFila(p.color, p.desc || p.modelo));
  const conLas2 = PRODUCTOS.filter(p => p.imagen && Object.keys(p.fotosAdvapp || {}).length && propia(p));
  ok(conLas2.length > 0 && conLas2.every(p => !/googleusercontent|supabase/.test(p.imagen)),
     'con archivo propio en fotos/, la portada es la propia', conLas2.length + ' filas con las dos');
  const deAdvapp = PRODUCTOS.filter(p => /googleusercontent|supabase/.test(p.imagen || ''));
  R.push('  --  ' + deAdvapp.length + ' fila(s) sin foto propia usan la de ADVAPP'
         + (deAdvapp.length ? ': ' + deAdvapp.slice(0, 3).map(p => p.id).join(', ') : ''));

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
