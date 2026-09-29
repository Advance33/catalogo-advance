// Guardas de la carga de datos, la cotizacion, el sello y los refrescos
// (auditoria del 29/09/2026). Cada bloque es un error que se encontro y se
// arreglo: si vuelve, falla aca. El numero entre corchetes es el del hallazgo.
//
// Las caidas y las demoras se simulan cambiando fetch solo para la URL que
// hace falta (ADVAPP, dolarapi, Google, indice.json); lo demas pasa de largo.
// Todo lo que se toca se deja como estaba al terminar cada bloque.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };

const esperaB1 = setInterval(() => {
  if(!MODELOS.length || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperaB1);
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

/* fetch cambiado mientras dura `hacer`. `cambiar(url, opts, fetchDeVerdad)` */
async function b1Fetch(cambiar, hacer){
  const antes = window.fetch;
  window.fetch = (url, opts) => cambiar(String(url), opts || {}, antes);
  try{ return await hacer(); } finally { window.fetch = antes; }
}
const b1Json   = obj => Promise.resolve(new Response(JSON.stringify(obj), { status: 200 }));
const b1Nunca  = () => new Promise(() => {});            // no contesta ni hace caso de la señal
const b1Cae    = () => Promise.reject(new TypeError('Failed to fetch'));
const b1Error  = () => Promise.resolve(new Response('fallo', { status: 500 }));
const esAdvapp = u => u.startsWith(ADVAPP_URL);
const esDolar  = u => /dolarapi\.com/.test(u);
const esGoogle = u => /docs\.google\.com/.test(u);
const esIndice = u => /indice\.json/.test(u);
const b1Sello  = () => document.getElementById('stamp').textContent.trim();
const b1Verde  = () => document.querySelector('.stamp .dot').classList.contains('live');
const b1Pie    = () => document.getElementById('pie-cotiz').textContent;
const b1Dormir = ms => new Promise(r => setTimeout(r, ms));
const b1Fecha  = /^Actualizado \d{2}\/\d{2}\/\d{4}$/;

async function correrPruebas(){
  const hoy = await (await fetch(ADVAPP_URL, { cache: 'no-store' })).json();
  const nHoy = hoy.productos.length;
  const cargarReal = cargar;
  ok(FUENTE && FUENTE.fuente === 'advapp', 'la pagina cargo desde ADVAPP (lo demas lo da por hecho)',
     FUENTE && FUENTE.fuente);

  /* ---- [150] La conexion a ADVAPP y a dolarapi se abre antes ---- */
  const pre = [...document.querySelectorAll('link[rel=preconnect]')];
  const hay = origen => pre.some(l => l.href.replace(/\/$/, '') === origen && l.hasAttribute('crossorigin'));
  ok(hay(new URL(ADVAPP_URL).origin), 'preconnect a ADVAPP con crossorigin (si cambia ADVAPP_URL, cambiarlo)',
     new URL(ADVAPP_URL).origin);
  ok(hay('https://dolarapi.com'), 'preconnect a dolarapi con crossorigin');

  /* ---- [4] Con ADVAPP andando no se le pide nada a Google ---- */
  const aGoogleAlCargar = performance.getEntriesByType('resource').filter(e => esGoogle(e.name)).length;
  ok(aGoogleAlCargar === 0, 'la primera carga no pidio la hoja Meta', aGoogleAlCargar + ' pedidos');
  {
    let aGoogle = 0;
    metaHora = 0;
    await b1Fetch((u, o, f) => { if(esGoogle(u)) aGoogle++; return f(u, o); }, () => actualizar(false));
    ok(aGoogle === 0 && META === null, 'un refresco con ADVAPP tampoco', aGoogle + ' pedidos, META ' + JSON.stringify(META));
  }

  /* ---- [3] Ningun tercero colgado traba la carga ---- */
  {
    let corto = '';
    try{ await conTope(30, () => b1Nunca()); }catch(e){ corto = e.message; }
    ok(/no contesto/.test(corto), 'conTope corta un pedido que no contesta (aunque no haga caso de la señal)', corto);

    const tc0 = TC, pie0 = b1Pie();
    const t0 = Date.now();
    await b1Fetch((u, o, f) => (esDolar(u) || esGoogle(u)) ? b1Nunca() : f(u, o), () => actualizar(false));
    const tardo = Date.now() - t0;
    ok(tardo < COTIZACION_ESPERA_MS + 3000 && !/^Sin/.test(b1Sello()),
       'con dolarapi y Google sin contestar, el refresco termina igual', tardo + ' ms · ' + b1Sello());
    /* [14] y los pesos siguen con la ultima cotizacion buena, con su pie */
    ok(TC === tc0 && b1Pie() === pie0, 'si dolarapi no contesta, siguen los pesos de la ultima cotizacion buena y su pie',
       TC + ' · ' + b1Pie());

    const t1 = Date.now();
    await b1Fetch((u, o, f) => esAdvapp(u) ? b1Error() : esGoogle(u) ? b1Nunca() : f(u, o), () => actualizar(false));
    ok(Date.now() - t1 < META_ESPERA_MS + 2 * PLANILLA_ESPERA_MS + 5000 && /^Sin actualizar desde/.test(b1Sello()),
       'con ADVAPP caido y Google colgado, termina y avisa que no se pudo actualizar',
       (Date.now() - t1) + ' ms · ' + b1Sello());
    /* [147] el error dice las dos cosas, y queda para la medicion */
    ok(/ADVAPP: HTTP 500/.test(ULTIMO_FALLO) && /planilla: no contesto/.test(ULTIMO_FALLO),
       'con las dos fuentes caidas, el motivo dice por que fallo cada una', ULTIMO_FALLO);
    ok(/carga_fallida/.test(actualizar.toString()) && /motivo/.test(actualizar.toString()),
       'la medicion anota la visita que no cargo y el motivo del respaldo');
    await actualizar(false);
    ok(ULTIMO_FALLO === '' && !/^Sin/.test(b1Sello()), 'y al volver todo, se limpia', b1Sello());
  }

  /* ---- [6] Stock y Activo: si, no, o no se entiende ---- */
  {
    const casos = [['Sí', true], ['si', true], ['S', true], ['true', true], ['1', true], ['x', true],
                   ['No', false], ['n', false], ['false', false], ['0', false], ['Sin stock', false],
                   ['Agotado', false], ['Consultar', null], ['', null], [true, true], [false, false]];
    const mal = casos.filter(([v, e]) => siNo(v) !== e).map(([v, e]) => JSON.stringify(v) + '->' + siNo(v));
    ok(!mal.length, 'siNo entiende las formas de decir si y no, y "Sin stock" es no', mal.join(' | ') || casos.length + ' casos');

    const conSi = hoy.productos.filter(p => siNo(p.Stock) === true).length;
    const bool = await b1Fetch((u, o, f) => esAdvapp(u)
      ? b1Json({ ...hoy, productos: hoy.productos.map(p => ({ ...p, Stock: siNo(p.Stock) === true, Activo: true })) })
      : f(u, o), () => cargar());
    ok(bool.fuente.fuente === 'advapp' && bool.productos.filter(p => p.stock).length === conSi,
       'Stock y Activo en true/false se leen bien', bool.productos.filter(p => p.stock).length + ' de ' + conSi);

    const raro = await b1Fetch((u, o, f) => esAdvapp(u)
      ? b1Json({ ...hoy, productos: hoy.productos.map(p => ({ ...p, Stock: siNo(p.Stock) ? 'Disponible' : 'No' })) })
      : f(u, o), bajarDatos);
    ok(conSi < nHoy * 0.1 || (raro.fuente === 'planilla' && /Stock/.test(raro.motivo)),
       'un Stock que la web no entiende no se toma como "sin stock": va a la planilla', raro.fuente + ' · ' + raro.motivo);

    const inactivos = await b1Fetch((u, o, f) => esAdvapp(u)
      ? b1Json({ ...hoy, productos: hoy.productos.map(p => ({ ...p, Activo: 'No' })) }) : f(u, o), bajarDatos);
    ok(inactivos.fuente === 'planilla' && /activa/.test(inactivos.motivo),
       'ADVAPP con ninguna fila activa no vacia el catalogo', inactivos.fuente + ' · ' + inactivos.motivo);

    // El seguro de actualizar(): cero productos no se aplica ni poda el pedido
    const prods0 = PRODUCTOS, pedido0 = JSON.stringify(PEDIDO);
    cargar = async () => ({ productos: [], fuente: FUENTE });
    try{ await actualizar(false); } finally { cargar = cargarReal; }
    ok(PRODUCTOS === prods0 && JSON.stringify(PEDIDO) === pedido0 && /^Sin actualizar desde/.test(b1Sello()),
       'una carga con cero productos no pisa el catalogo ni el pedido', b1Sello());
    await actualizar(false);

    // Los datos de hoy: si ADVAPP cambia el formato, la revision diaria lo avisa
    const noSe = hoy.productos.filter(p => siNo(p.Stock) === null || (p.Activo !== '' && siNo(p.Activo) === null));
    ok(!noSe.length, 'hoy ADVAPP manda Stock y Activo en un formato que la web entiende',
       noSe.slice(0, 3).map(p => p.ID + ' ' + JSON.stringify([p.Stock, p.Activo])).join(' | ') || nHoy + ' filas');
  }

  /* ---- [7] Sin precio es "Consultar", nunca "USD 0" ni el precio anterior ---- */
  {
    const ids = hoy.productos.slice(0, 3).map(p => p.ID);
    const vacios = await b1Fetch((u, o, f) => esAdvapp(u)
      ? b1Json({ ...hoy, productos: hoy.productos.map((p, i) => i < 3 ? { ...p, 'Precio USD': ['', '—', '0'][i] } : p) })
      : f(u, o), () => cargar());
    const ps = ids.map(id => vacios.productos.find(p => p.id === id));
    ok(ps.every(p => p && p.precio === null && precioUSD(p) === 'Consultar'),
       'un precio vacio, "—" o 0 sale "Consultar"', ps.map(p => p && precioUSD(p)).join(' | '));

    const sinCol = await b1Fetch((u, o, f) => esAdvapp(u)
      ? b1Json({ ...hoy, columnas: hoy.columnas.filter(c => c !== 'Precio USD' && c !== 'CODIGO'),
                 productos: hoy.productos.map(p => { const q = { ...p, 'Precio anterior': '999' };
                                                     delete q['Precio USD']; delete q.CODIGO; return q; }) })
      : f(u, o), () => cargar());
    ok(sinCol.productos.every(p => p.precio === null),
       'sin la columna Precio USD no se toma "Precio anterior" como precio',
       sinCol.productos.filter(p => p.precio !== null).length + ' con precio');
    ok(sinCol.productos.every(p => !p.codigo || /^AT-\d{4}$/.test(p.codigo)),
       'sin la columna CODIGO no se toma CODIGO_VAR como codigo',
       sinCol.productos.filter(p => p.codigo && !/^AT-\d{4}$/.test(p.codigo)).slice(0, 2).map(p => p.codigo).join(' | '));
  }

  /* ---- [8] Una baja real de ADVAPP no deja pegado a la planilla ---- */
  {
    const filas0 = localStorage.getItem('advtecno.filas'), pend0 = localStorage.getItem('advtecno.filas.pendiente');
    metaHora = 0;
    const filasMeta = Number((await metaDelCiclo())?.filas) || 0;
    const n = Math.floor(filasMeta * 0.7);
    if(filasMeta && n < nHoy * ADVAPP_MINIMO){
      localStorage.setItem('advtecno.filas', String(nHoy));
      localStorage.removeItem('advtecno.filas.pendiente');
      const corto = gen => b1Json({ ...hoy, filas: n, generado_en: gen, productos: hoy.productos.slice(0, n) });
      const d1 = await b1Fetch((u, o, f) => esAdvapp(u) ? corto('2026-09-29T10:00:00Z') : f(u, o), bajarDatos);
      const d2 = await b1Fetch((u, o, f) => esAdvapp(u) ? corto('2026-09-29T10:00:00Z') : f(u, o), bajarDatos);
      const d3 = await b1Fetch((u, o, f) => esAdvapp(u) ? corto('2026-09-29T10:02:00Z') : f(u, o), bajarDatos);
      ok(d1.fuente === 'planilla' && d2.fuente === 'planilla',
         'una baja de golpe no se cree de entrada, ni con la misma copia repetida', d1.fuente + ' · ' + d2.fuente);
      ok(d3.fuente === 'advapp' && filasDeAyer() === n,
         'otra respuesta con la misma cantidad es una baja real: se acepta y pasa a ser la vara',
         d3.fuente + ' · ' + filasDeAyer());
    }else{
      R.push('  --   la hoja Meta no dice cuantas filas tiene: no se prueba la baja real');
    }
    try{
      if(filas0 === null) localStorage.removeItem('advtecno.filas'); else localStorage.setItem('advtecno.filas', filas0);
      if(pend0 === null) localStorage.removeItem('advtecno.filas.pendiente'); else localStorage.setItem('advtecno.filas.pendiente', pend0);
    }catch(e){}
  }

  /* ---- [3] Meta lenta: el tope no deja pasar el recorte del 15/09 (29/09) ----
     Con el tope de META_ESPERA_MS, una Meta que contestaba a los 7 s daba
     "sin Meta": bajarCSV se quedaba con la primera fuente (gviz, que hoy trae
     54 de 583) y bajarDatos aceptaba un ADVAPP corto y bajaba la vara. Meta
     acá contesta de verdad, pero un segundo despues del tope. */
  {
    const filas0 = localStorage.getItem('advtecno.filas'), pend0 = localStorage.getItem('advtecno.filas.pendiente');
    const esMeta = u => u.startsWith(META_URL);
    const metaLenta = (u, o, f) => new Promise((si, no) => {
      const t = setTimeout(() => f(u, o).then(si, no), META_ESPERA_MS + 1000);
      if(o.signal) o.signal.addEventListener('abort', () => {
        clearTimeout(t); no(Object.assign(new Error('abortado'), { name: 'AbortError' }));
      });
    });
    const nFilas = filas => filas.filter(f => f.some(c => String(c).trim())).length - 1;
    metaPromesa = null;
    const filasMeta = Number((await metaDelCiclo())?.filas) || 0;
    if(!filasMeta){
      R.push('  --   [3] la hoja Meta no dice cuantas filas tiene: no se prueba la Meta lenta');
    }else{
      try{
        metaPromesa = null;
        const lenta = await b1Fetch((u, o, f) => esAdvapp(u) ? b1Error() : esMeta(u) ? metaLenta(u, o, f) : f(u, o), bajarDatos);
        ok(lenta.fuente === 'planilla' && nFilas(lenta.filas) >= filasMeta,
           '[3] con ADVAPP caido y la hoja Meta lenta, el respaldo trae la planilla entera y no la fuente recortada',
           lenta.fuente + ' · ' + nFilas(lenta.filas) + ' de ' + filasMeta);
        metaPromesa = null;
        const conError = await b1Fetch((u, o, f) => esAdvapp(u) || esMeta(u) ? b1Error() : f(u, o), bajarDatos);
        ok(conError.fuente === 'planilla' && nFilas(conError.filas) >= filasMeta,
           '[3] y con la hoja Meta en error, lo mismo',
           conError.fuente + ' · ' + nFilas(conError.filas) + ' de ' + filasMeta);

        const n = Math.floor(filasMeta * 0.7);
        if(n < nHoy * ADVAPP_MINIMO){
          const corto = gen => b1Json({ ...hoy, filas: n, generado_en: gen, productos: hoy.productos.slice(0, n) });
          localStorage.setItem('advtecno.filas', String(nHoy));
          localStorage.removeItem('advtecno.filas.pendiente');
          metaPromesa = null;
          const d1 = await b1Fetch((u, o, f) => esAdvapp(u) ? corto('2026-09-29T11:00:00Z')
                                             : esMeta(u) ? metaLenta(u, o, f) : f(u, o), bajarDatos);
          ok(d1.fuente === 'planilla' && filasDeAyer() === nHoy,
             '[3] un ADVAPP corto con la hoja Meta lenta no se acepta ni baja la vara',
             d1.fuente + ' · vara ' + filasDeAyer() + ' (era ' + nHoy + ')');

          localStorage.removeItem('advtecno.filas.pendiente');
          metaPromesa = null;
          const d2 = await b1Fetch((u, o, f) => esAdvapp(u) ? corto('2026-09-29T11:00:00Z')
                                             : esGoogle(u) ? b1Cae() : f(u, o), bajarDatos);
          ok(d2.fuente === 'advapp' && nFilas(d2.filas) === n && filasDeAyer() === nHoy && /Meta no contesto/.test(d2.motivo || ''),
             '[3] con Google caido tambien, se muestra el ADVAPP corto de ultimo recurso, sin bajar la vara',
             d2.fuente + ' · ' + nFilas(d2.filas) + ' filas · vara ' + filasDeAyer() + ' · ' + d2.motivo);

          // Y la baja de verdad se confirma sola: otra respuesta, misma cantidad
          metaPromesa = null;
          const d3 = await b1Fetch((u, o, f) => esAdvapp(u) ? corto('2026-09-29T11:05:00Z')
                                             : esMeta(u) ? metaLenta(u, o, f) : f(u, o), bajarDatos);
          ok(d3.fuente === 'advapp' && filasDeAyer() === n,
             '[3] otra respuesta con la misma cantidad confirma la baja aunque Meta no conteste',
             d3.fuente + ' · vara ' + filasDeAyer());
        }else{
          R.push('  --   [3] con los datos de hoy un 70 % de Meta no es una carga corta: no se prueba el ADVAPP corto');
        }
      }finally{
        metaPromesa = null;
        try{
          if(filas0 === null) localStorage.removeItem('advtecno.filas'); else localStorage.setItem('advtecno.filas', filas0);
          if(pend0 === null) localStorage.removeItem('advtecno.filas.pendiente'); else localStorage.setItem('advtecno.filas.pendiente', pend0);
        }catch(e){}
      }
    }
  }

  /* ---- [9] Dos refrescos cruzados: gana el mas nuevo que salio bien ---- */
  {
    const pedido0 = JSON.stringify(PEDIDO);
    let llamadas = 0;
    const colgarPrimera = (u, o, f) => {
      if(esAdvapp(u) && ++llamadas === 1)
        return new Promise((_, no) => o.signal.addEventListener('abort',
          () => no(Object.assign(new Error('abortado'), { name: 'AbortError' }))));
      return f(u, o);
    };
    /* Se compara contra lo que dejo el refresco nuevo, no contra las filas
       crudas de ADVAPP (29/09): cargar() saca las filas con Activo 'No' o sin
       descripcion, y ADVAPP puede sumar o sacar una fila entre la bajada del
       principio de la tanda y este refresco (hoy paso de 757 a 758). Con
       nHoy la guarda quedaba en rojo por un dato y no por un error, como el
       hallazgo 191. Lo que se prueba es que el viejo no pise al nuevo. */
    let buenos = null, fuenteBuena = '', orden = '';
    await b1Fetch(colgarPrimera, async () => {
      const p1 = actualizar(false).then(() => { orden += 'viejo '; });
      await b1Dormir(1000);
      const p2 = actualizar(false).then(() => { orden += 'nuevo '; });
      await p2;
      buenos = PRODUCTOS; fuenteBuena = FUENTE.fuente;
      await p1;
    });
    ok(fuenteBuena === 'advapp' && FUENTE.fuente === 'advapp' && PRODUCTOS === buenos && !/^Sin/.test(b1Sello()),
       'el refresco viejo que termina despues no pisa los datos buenos',
       FUENTE.fuente + ' · ' + PRODUCTOS.length + (PRODUCTOS === buenos ? ' (los del nuevo)' : ' (otros)') +
       ' · ' + b1Sello() + ' · terminaron: ' + orden.trim());
    ok(JSON.stringify(PEDIDO) === pedido0, 'y el pedido no pierde lineas');

    // El viejo que falla del todo despues de uno bueno no pone "Sin actualizar"
    llamadas = 0;
    await b1Fetch((u, o, f) => (llamadas === 0 && esGoogle(u)) ? b1Cae() : colgarPrimera(u, o, f), async () => {
      const p1 = actualizar(false);
      await b1Dormir(1000);
      const p2 = actualizar(false);
      await p2;
      llamadas = 0;
      await p1;
    });
    ok(!/^Sin/.test(b1Sello()), 'y el viejo que falla no tapa con un aviso los datos buenos', b1Sello());
  }

  /* ---- [1] y [2] El respaldo: el sello no dice "hoy" y el pedido no pierde lineas ---- */
  {
    const csv = parseCSV(await bajarCSV());
    const iId = csv[0].map(norm).indexOf('id');
    const enPlanilla = new Set(csv.slice(1).map(f => f[iId]));
    const faltan = PRODUCTOS.filter(p => !enPlanilla.has(p.id)).slice(0, 3).map(p => clave(p));
    const pedido0 = JSON.stringify(PEDIDO), ls0 = localStorage.getItem(PEDIDO_KEY);
    faltan.forEach(k => { if(!enPedido(k)) PEDIDO.push({ k, n: 1, color: '' }); });
    guardarPedido();
    const lineas = PEDIDO.length;
    await b1Fetch((u, o, f) => esAdvapp(u) ? b1Error() : f(u, o), () => actualizar(false));
    ok(FUENTE.fuente === 'planilla', 'con ADVAPP en 500 se usa la planilla', FUENTE.fuente + ' · ' + FUENTE.motivo);
    ok(b1Sello() !== 'Actualizado hoy' && !b1Verde() && b1Fecha.test(b1Sello()),
       'con el respaldo el sello dice la fecha de la planilla, sin "hoy" ni punto verde',
       b1Sello() + (b1Verde() ? ' (verde)' : ''));
    ok(/Respaldo/.test(document.getElementById('stamp').title), 'y el sello dice que es el respaldo (al pasar el mouse)',
       document.getElementById('stamp').title);
    let enLs = -1;
    try{ enLs = JSON.parse(localStorage.getItem(PEDIDO_KEY)).length; }catch(e){}
    ok(!faltan.length || (PEDIDO.length === lineas && enLs === lineas),
       'con el respaldo el pedido guardado no pierde las lineas que la planilla no tiene',
       PEDIDO.length + ' de ' + lineas + ' · guardadas ' + enLs + ' · ' + faltan.join(', '));
    await actualizar(false);
    ok(FUENTE.fuente === 'advapp' && faltan.every(k => itemsPedido().some(it => clave(it.p) === k)),
       'al volver ADVAPP esas lineas se vuelven a ver', FUENTE.fuente);
    PEDIDO = JSON.parse(pedido0);
    try{ if(ls0 === null) localStorage.removeItem(PEDIDO_KEY); else localStorage.setItem(PEDIDO_KEY, ls0); }catch(e){}
    pintarPedido();
  }

  /* ---- [5] Las fechas ISO de ADVAPP se leen, y "hoy" pide un manifiesto de hoy ---- */
  {
    ok(msDeFecha('2026-09-24T17:17:35.791+00:00') > 0 && msDeFecha('2026-09-18T00:12:46.288217+00:00') > 0
       && msDeFecha('24/08/2026') > 0 && msDeFecha('cualquier cosa') === 0,
       'msDeFecha entiende la fecha de la planilla y la ISO de ADVAPP (con 3 o 6 decimales)');
    ok(diaAR(msDeFecha('24/08/2026')) === '24/08/2026', 'la de la planilla sale el mismo dia', diaAR(msDeFecha('24/08/2026')));
    ok(!!fechaMasNueva(PRODUCTOS), 'con ADVAPP hay fecha de la fila mas nueva', fechaMasNueva(PRODUCTOS));
    const con = man => b1Fetch((u, o, f) => esAdvapp(u) ? b1Json({ ...hoy, ...man }) : f(u, o), () => actualizar(false));
    await con({ verificado_hoy: true, generado_en: new Date().toISOString() });
    ok(b1Sello() === 'Actualizado hoy' && b1Verde(), 'con carga de hoy: "Actualizado hoy" en verde', b1Sello());
    await con({ verificado_hoy: true, generado_en: '2026-09-16T15:42:25' });
    ok(b1Sello() !== 'Actualizado hoy' && !b1Verde(), 'un manifiesto viejo con verificado_hoy no dice "hoy"', b1Sello());
    await con({ verificado_hoy: false });
    ok(b1Fecha.test(b1Sello()) && !b1Verde(), 'sin carga de hoy: la fecha, en ambar, nunca "En vivo"', b1Sello());
    await actualizar(false);
  }

  /* ---- [11] Sin ninguna carga buena, el sello no inventa una hora ---- */
  {
    const ultima = ULTIMA_OK;
    ULTIMA_OK = 0;
    await b1Fetch((u, o, f) => (esAdvapp(u) || esGoogle(u)) ? b1Cae() : f(u, o), () => actualizar(false));
    ok(b1Sello() === 'Sin conexión' && !!grid.querySelector('.msg'),
       'si nunca hubo una carga buena, es la pantalla de error y no "Sin actualizar desde 21:00"', b1Sello());
    // Como la primera vez: la firma vacia, y la carga siguiente dibuja todo
    FIRMA_DATOS = '';
    await actualizar(false);
    ok(ULTIMA_OK > 0 && !grid.querySelector('.msg') && MODELOS.length > 0, 'y la carga siguiente la reemplaza', b1Sello());
    if(!ULTIMA_OK) ULTIMA_OK = ultima;
  }

  /* ---- [12] El link #p= se abre con la primera carga que anda ---- */
  {
    const m = MODELOS.find(x => x.stock && x.variantes.length > 1) || MODELOS[0];
    const k = clave(m.variantes[m.variantes.length - 1]);
    if(FICHA) quitarFicha();
    const url0 = location.href;
    history.replaceState(history.state, '', location.pathname + location.search + '#p=' + encodeURIComponent(k));
    fichaPendiente = true;
    await actualizar(false);
    ok(FICHA === k, 'si la primera carga fallo, el link #p= abre la ficha con la siguiente', FICHA + ' vs ' + k);
    quitarFicha();
    history.replaceState(history.state, '', url0.replace(/#.*$/, ''));
  }

  /* ---- [14] y [148] La cotizacion: el pie siempre dice la que se usa ---- */
  {
    ok(cotizacionRara({ venta: 1565, compra: 1545, fechaActualizacion: new Date().toISOString() },
                      [{ venta: 1545 }, { venta: 1565 }, { venta: 1556 }]) === '', 'una cotizacion normal pasa');
    const raras = [
      [{ venta: 156.5, compra: 154.5 }, 'diez veces mas chica'],
      [{ venta: 15650, compra: 15450 }, 'diez veces mas grande'],
      [{ venta: '1.565' }, 'con punto de miles, que Number lee 1,565'],
      [{ venta: 1500, compra: 1600 }, 'compra mayor que venta'],
      [{ venta: -5 }, 'negativa'],
      [{ venta: 1565, compra: 1545, fechaActualizacion: '2026-01-02T00:00:00Z' }, 'de hace meses'],
    ].filter(([d]) => !cotizacionRara(d, [{ venta: 1545 }, { venta: 1565 }, { venta: 1556 }, d]));
    ok(!raras.length, 'una cotizacion rara no se usa', raras.map(r => r[1]).join(' | ') || '6 casos');
    ok(cotizacionRara({ venta: 2700, compra: 2650 }, [{ venta: 1000 }, { venta: 2700 }, { venta: 2600 }]) === '',
       'un blue que vale 2,7 veces el oficial (como en 2023) pasa');

    const tc0 = TC, pie0 = b1Pie();
    if(tc0){
      ok(pie0.includes('$' + plata(Math.round(TC))), 'el pie dice el numero con que se calculan los pesos', pie0 + ' · ' + TC);
      const diezMenos = () => b1Json([{ casa: 'oficial', nombre: 'Oficial', venta: 1545, compra: 1495 },
                                      { casa: CFG.tipo, nombre: 'X', venta: 156.5, compra: 154.5 },
                                      { casa: 'bolsa', nombre: 'Bolsa', venta: 1556, compra: 1544 }]);
      await b1Fetch((u, o, f) => esDolar(u) ? diezMenos() : f(u, o), () => actualizar(false));
      ok(TC === tc0 && b1Pie() === pie0, 'dolarapi con un valor diez veces mas chico: siguen los pesos buenos', TC);
      await b1Fetch((u, o, f) => (esAdvapp(u) || esGoogle(u)) ? b1Cae()
                              : esDolar(u) ? b1Json([{ casa: CFG.tipo, nombre: 'X', venta: 9999, compra: 9990 }]) : f(u, o),
                    () => actualizar(false));
      ok(TC === tc0 && b1Pie() === pie0, 'si la carga falla, el pie no pasa a una cotizacion que no se usa', b1Pie());
      if(TC_BUENA) TC_BUENA.hora = Date.now() - 2 * COTIZACION_VIGENCIA_MS;
      await b1Fetch((u, o, f) => esDolar(u) ? b1Cae() : f(u, o), () => actualizar(false));
      ok(TC === null && b1Pie() === '', 'pasada la vigencia, sin cotizacion buena: solo dolares', TC + ' · ' + b1Pie());
      await actualizar(false);
      ok(TC > 0 && b1Pie() !== '', 'y vuelven los pesos cuando dolarapi contesta', TC);
    }else{
      R.push('  --   hoy no hay cotizacion: no se prueba el pie');
    }
  }

  /* ---- [15] indice.json se revalida, no se baja entero cada vez ---- */
  {
    let pedido = null;
    await b1Fetch((u, o, f) => { if(esIndice(u)) pedido = { u, cache: o.cache }; return f(u, o); }, cargarIndiceFotos);
    ok(pedido && !/[?&]_=/.test(pedido.u) && pedido.cache === 'no-cache',
       'indice.json va sin ?_= y con cache no-cache (304 si no cambio)', pedido && (pedido.u + ' · ' + pedido.cache));
  }

  /* ---- [39] Si indice.json falla en un refresco, siguen las fotos ---- */
  {
    const indice0 = INDICE_FOTOS, mapa0 = CATALOGO;
    const c = await b1Fetch((u, o, f) => esIndice(u) ? b1Cae() : f(u, o), () => cargar());
    ok(INDICE_FOTOS === indice0 && CATALOGO === mapa0 && INDICE_FOTOS instanceof Set,
       'un indice.json que no llega no borra el indice que ya estaba');
    INDICE_FOTOS = indice0; CATALOGO = mapa0;      // para que lo que sigue pruebe con el indice
    const fantasma = c.productos.filter(p => p.imagen && p.imagen.includes(CARPETA_FOTOS)
      && !indice0.has(decodeURIComponent(p.imagen.split('/').pop().split('?')[0])));
    ok(!fantasma.length, 'y ningun producto pasa a pedir un archivo que no existe',
       fantasma.slice(0, 3).map(p => p.id).join(', ') || c.productos.length + ' productos');
  }

  /* ---- [88] La ficha abierta sigue a los datos del refresco ---- */
  {
    const m = MODELOS.find(x => x.stock && x.precio !== null && x.variantes.every(v => v.stock));
    abrirFicha(clave(m.rep), null);
    const k = FICHA;
    cargar = async () => { const c = await cargarReal();
      c.productos.forEach(p => { if(clave(p) === k){ p.precio = p.precio + 100; p.stock = false; } }); return c; };
    try{ await actualizar(false); } finally { cargar = cargarReal; }
    const usd = document.querySelector('#ficha .fi-datos .usd');
    ok(usd && usd.textContent.trim() === precioUSD(buscarProducto(FICHA)),
       'con la ficha abierta, un precio nuevo se ve en la ficha', usd && usd.textContent + ' vs ' + precioUSD(buscarProducto(FICHA)));
    const cta = document.querySelector('#ficha .fi-botones .cta');
    ok(!cta || /Avisame/.test(cta.textContent), 'y el boton sigue al stock', cta && cta.textContent.trim());
    cargar = async () => { const c = await cargarReal(); c.productos = c.productos.filter(p => clave(p) !== k); return c; };
    try{ await actualizar(false); } finally { cargar = cargarReal; }
    const botones = document.querySelector('#ficha .fi-botones');
    ok(botones && /ya no está/.test(botones.textContent) && !document.querySelector('#ficha #fi-pedido'),
       'si el producto sale del catalogo, la ficha lo dice y no deja agregarlo', botones && botones.textContent.trim());
    quitarFicha();
    await actualizar(false);
  }

  /* ---- [88] El refresco con la ficha abierta no tira el foco a BODY (29/09) ----
     refrescarFichaAbierta rehace .fi-datos y .fi-colores como elegirVariante,
     pero sin devolver el foco: quedaba en BODY y el Tab siguiente salia del
     dialogo. Pasa con cualquier refresco que cambie la firma: aca cambia el
     precio de OTRO producto. Primero se espera el requestAnimationFrame con
     el que montarModal lleva el foco a la ventana: si cae en medio del
     refresco, mueve el foco por su cuenta y tapa el error. */
  {
    const cuadro = () => new Promise(r => { let listo = false;
      requestAnimationFrame(() => { listo = true; r(true); }); setTimeout(() => { if(!listo) r(false); }, 1500); });
    const otroPrecio = k => async () => { const c = await cargarReal();
      const p = c.productos.find(x => clave(x) !== k && x.precio !== null); p.precio = p.precio + 1; return c; };
    let m = null, d = null;
    for(const x of MODELOS.filter(x => x.stock && x.precio !== null && x.variantes.length > 1).slice(0, 40)){
      quitarFicha();
      abrirFicha(clave(x.rep), null);
      d = document.getElementById('ficha');
      if(d && d.querySelector('.fi-op[aria-pressed="true"]:not(:disabled)')){ m = x; break; }
    }
    const huboCuadro = m ? await cuadro() : false;
    await b1Dormir(50);
    if(!m) R.push('  --   [88] hoy ninguna ficha con stock tiene pestañas de version: no se prueba el foco');
    else if(!huboCuadro || document.activeElement !== d.querySelector('.caja'))
      R.push('  --   [88] el foco de la ficha no llego a la ventana (sin cuadros en este Chrome): no se prueba el foco');
    else {
      const k = FICHA;
      const op = d.querySelector('.fi-op[aria-pressed="true"]');
      const eje = op.closest('.fi-ops')?.dataset.eje || '';
      op.focus();
      cargar = otroPrecio(k);
      try{ await actualizar(false); } finally { cargar = cargarReal; }
      const a = document.activeElement;
      ok(a && a.classList.contains('fi-op') && a.getAttribute('aria-pressed') === 'true' && d.contains(a)
         && (a.closest('.fi-ops')?.dataset.eje || '') === eje,
         '[88] con el foco en la pestaña marcada, un refresco con cambios lo deja en ella',
         a ? (a.id || a.className || a.tagName) : 'nada');
      const pinta = d.querySelector('.fi-pintas button[aria-pressed="true"]');
      if(pinta){
        pinta.focus();
        await actualizar(false);
        const b = document.activeElement;
        ok(b && b.matches('.fi-pintas button[aria-pressed="true"]') && d.contains(b),
           '[88] y con el foco en el puntito elegido, en el puntito', b ? (b.id || b.className || b.tagName) : 'nada');
      }
      const ped = d.querySelector('#fi-pedido');
      (ped || d.querySelector('.fi-op[aria-pressed="true"]')).focus();
      cargar = async () => { const c = await cargarReal(); c.productos = c.productos.filter(p => clave(p) !== k); return c; };
      try{ await actualizar(false); } finally { cargar = cargarReal; }
      const c = document.activeElement;
      ok(/ya no está/.test((d.querySelector('.fi-botones') || {}).textContent || '') && c === d.querySelector('.caja'),
         '[88] si sale del catalogo con el foco en ' + (ped ? 'el boton del pedido' : 'una pestaña') + ', el foco va a la ventana y no a BODY',
         c ? (c.id || c.className || c.tagName) : 'nada');
    }
    quitarFicha();
    await actualizar(false);
  }

  /* ---- [88] y [2] Con el respaldo, la ficha no da de baja lo que la planilla no tiene (29/09) ----
     La planilla congelada no tiene 263 productos de ADVAPP. Con la ficha de
     uno de ellos abierta (un 17 Pro Max 2TB), una caida de ADVAPP decia "ya
     no esta en el catalogo", sacaba el WhatsApp y apagaba la tira, mientras
     el pedido guardaba la linea porque vuelve sola. La baja la dice ADVAPP. */
  {
    const csv = parseCSV(await bajarCSV());
    const iId = csv[0].map(norm).indexOf('id');
    const enPlanilla = new Set(csv.slice(1).map(f => f[iId]));
    const p = PRODUCTOS.find(x => x.stock && !enPlanilla.has(x.id));
    if(!p) R.push('  --   [88] hoy no hay productos con stock de ADVAPP que falten en la planilla: se saltea');
    else {
      abrirFicha(clave(p), null);
      const k = FICHA;
      await b1Fetch((u, o, f) => esAdvapp(u) ? b1Error() : f(u, o), () => actualizar(false));
      const d = document.getElementById('ficha');
      const precio = d && d.querySelector('.fi-precio');
      ok(FUENTE.fuente === 'planilla' && FICHA === k && !!d
         && !/ya no está/.test((d.querySelector('.fi-botones') || {}).textContent || '')
         && !!d.querySelector('.fi-botones .cta') && !!precio && precio.style.display !== 'none'
         && !d.querySelector('.fi-pintas button:disabled, .fi-op:disabled'),
         'con el respaldo, la ficha de algo que la planilla no tiene no dice "ya no esta" ni pierde el WhatsApp',
         k + ' · ' + FUENTE.fuente);
      await actualizar(false);
      ok(FUENTE.fuente === 'advapp' && FICHA === k && !!document.querySelector('#ficha .fi-botones .cta'),
         'y al volver ADVAPP la ficha sigue con su WhatsApp', FUENTE.fuente);
      quitarFicha();
    }
  }

  /* ---- [111] Un refresco sin cambios no rehace nada, y con cambios no pierde el lugar ---- */
  {
    if(!enPortada()) irAlMenu();
    const mundo0 = document.querySelector('#mosaico .mundo');
    await actualizar(false);
    ok(!mundo0 || document.querySelector('#mosaico .mundo') === mundo0, 'sin cambios la portada no se rehace');

    verTodoElCatalogo();
    while(dibujadas < 150 && dibujadas < LISTA.length){ const d0 = dibujadas; dibujarTanda(); if(dibujadas === d0) break; }
    const cards = [...grid.querySelectorAll('.card')];
    const c150 = cards[Math.min(149, cards.length - 1)];
    c150.scrollIntoView({ block: 'start' });
    await b1Dormir(50);
    const top0 = c150.getBoundingClientRect().top, key = c150.dataset.key, d0 = dibujadas;
    await actualizar(false);
    ok(c150.isConnected, 'sin cambios las tarjetas siguen siendo las mismas');
    cargar = async () => { const c = await cargarReal();
      const p = c.productos.find(x => x.precio !== null); p.precio = p.precio + 1; return c; };
    try{ await actualizar(false); } finally { cargar = cargarReal; }
    const nueva = [...grid.querySelectorAll('.card')].find(c => c.dataset.key === key);
    const top1 = nueva ? nueva.getBoundingClientRect().top : NaN;
    ok(nueva && Math.abs(top1 - top0) < 3 && dibujadas >= Math.min(d0, LISTA.length),
       'con cambios, la tarjeta que se miraba queda en su lugar', Math.round(top0) + ' -> ' + Math.round(top1) + ' · ' + dibujadas + ' tarjetas');
    ok(nueva && nueva.classList.contains('vis'), 'y no repite la entrada');
    irAlMenu();
    await actualizar(false);
    scrollTo(0, 0);
  }

  /* ---- [146] Con la pestaña de fondo no se baja nada ---- */
  {
    let pedidos = 0;
    Object.defineProperty(document, 'hidden', { get: () => true, configurable: true });
    try{
      await b1Fetch((u, o, f) => { if(esAdvapp(u)) pedidos++; return f(u, o); },
                    async () => { refrescoPeriodico(); await b1Dormir(100); });
    }finally{ delete document.hidden; }
    ok(pedidos === 0, 'el refresco de cada 5 minutos no corre con la pestaña de fondo', pedidos + ' pedidos');
  }

  /* ---- [13] [131] [144] El panel de la cotizacion ---- */
  {
    const btn = document.getElementById('cfg-btn');
    ok(btn.hidden && btn.offsetParent === null, 'el boton de la cotizacion no se le muestra al cliente');
    const ls0 = localStorage.getItem(CFG_KEY), cfg0 = CFG, modo0 = MODO_CONFIG;
    try{
      localStorage.setItem(CFG_KEY, JSON.stringify({ modo: 'manual', valor: 1, base: huellaCfg() }));
      MODO_CONFIG = false;
      ok(JSON.stringify(leerCfg()) === JSON.stringify(cfgPorDefecto()),
         'sin ?config una cotizacion guardada no se aplica (el cliente que la toco no tendria como volver)');
      MODO_CONFIG = true;
      localStorage.setItem(CFG_KEY, JSON.stringify({ modo: 'manual', valor: '1"><img src=x onerror="window.__xssB1=1">',
        recargo: '<img src=x onerror="window.__xssB1=1">', recargoFijo: -5, tipo: 'blue/../x', base: huellaCfg() }));
      const c = leerCfg();
      ok(c.valor === null && c.recargo === RECARGO_PCT && c.recargoFijo === RECARGO_FIJO && c.tipo === COTIZACION_TIPO,
         'lo guardado se valida campo por campo', JSON.stringify(c));
      localStorage.setItem(CFG_KEY, JSON.stringify({ modo: 'manual', valor: 1500 }));
      ok(!leerCfg().propia, 'lo guardado con otros valores del codigo deja de valer');
      ok(aplicarRecargo(1500, 'x') && (CFG = { ...cfgPorDefecto(), recargoFijo: -99999 }, aplicarRecargo(1500, 'x')) === null,
         'un recargo que deja la cotizacion en cero no da pesos');

      CFG = { modo: 'manual', valor: '1"><img src=x onerror="window.__xssB1=1">', tipo: 'blue',
              recargo: '"><img src=x onerror="window.__xssB1=1">', recargoFijo: 0 };
      abrirPanel();
      const panel = document.getElementById('panel');
      ok(panel && !panel.querySelector('img'), 'el panel no mete como HTML lo guardado');
      const caja = panel.querySelector('.caja'), cs = getComputedStyle(caja);
      ok(caja.getAttribute('aria-modal') === 'true', 'el panel es aria-modal como las otras ventanas');
      ok(['p-tipo', 'p-valor', 'p-recargo', 'p-fijo'].every(id => document.getElementById(id).getAttribute('aria-label')),
         'cada campo tiene nombre para un lector de pantalla');
      ok(cs.overflowY === 'auto' && cs.maxHeight !== 'none', 'con el celular acostado la caja scrollea y Guardar se alcanza',
         cs.overflowY + ' · ' + cs.maxHeight);
      localStorage.removeItem(CFG_KEY);
      panel.querySelector('input[name=modo][value=auto]').checked = true;
      document.getElementById('p-recargo').value = '-5';
      document.getElementById('p-ok').click();
      ok(!localStorage.getItem(CFG_KEY) && document.getElementById('panel')
         && document.getElementById('p-recargo').getAttribute('aria-invalid') === 'true',
         'un recargo negativo no se guarda: se marca el campo');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await b1Dormir(50);
      ok(window.__xssB1 === undefined && !document.getElementById('panel'), 'nada de lo guardado se ejecuto');
    }finally{
      CFG = cfg0; MODO_CONFIG = modo0;
      try{ if(ls0 === null) localStorage.removeItem(CFG_KEY); else localStorage.setItem(CFG_KEY, ls0); }catch(e){}
    }
  }
}
