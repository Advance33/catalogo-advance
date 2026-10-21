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

  /* ---- 6. Una carga corta de ADVAPP: la ultima lista completa hasta que otra respuesta la confirme ----
     Hasta el 29/09 esto exigia que "con el 85 % de las filas de la planilla
     siga usando ADVAPP" (496 de 583): era cuando ADVAPP traia MENOS filas que
     la planilla a proposito. Despues fue al reves (758, y 881 el 19/10, contra
     una planilla congelada en 583), y esa comprobacion fijaba justo el hueco
     del hallazgo 181: una carga con el 65 % de los productos de hoy se usaba
     como completa, porque la hoja Meta congelada la rescataba. Hasta el 21/10
     aca solo se informaba lo que hacia la pagina: "que hacer ante una carga
     corta lo decide Pedro (hallazgo 181)".
     YA ESTA DECIDIDO: decision 4 A de Benja, 21/10 (Benja es el "Pedro" de
     las notas viejas; T-07 de la auditoria web del 19/10). La web sigue
     mostrando la ultima lista completa -la copia guardada en este navegador,
     con su hora y la franja, como sin conexion- hasta que OTRA respuesta de
     ADVAPP, con otro generado_en, confirme la baja; ahi se acepta. La hoja
     Meta ya no se consulta. Sin copia que valga se muestra lo que llego (son
     filas de ADVAPP de ahora), sin bajar la vara; y en la primera visita no
     hay con que comparar. */
  {
    const n = Math.ceil(total * 0.65), m = Math.ceil(total * 0.4);
    const ahora = Date.now();
    const g1 = new Date(ahora - 60000).toISOString(), g2 = new Date(ahora).toISOString();
    // ADVAPP verificado y de hoy: lo que antes salia "Actualizado hoy"
    const corto = (gen, cant = n, extra = {}) => respuesta({ ...real, ...extra, filas: cant, generado_en: gen,
                                                            verificado_hoy: true, productos: real.productos.slice(0, cant) });
    const copia0 = leerCopia();
    const nCopia = copia0 ? copia0.filas.length - 1 : 0;
    const esLaCopia0 = d => !!copia0 && d.fuente === 'copia' && d.hora === copia0.hora && cantidad(d) === nCopia;
    const desdeHoy = [String(total), null];      // la vara de hoy, sin ninguna baja pendiente
    const pend = p => p ? p.n + ' · ' + p.generado_en : 'sin pendiente';
    const sinLaCopia = async hacer => {
      const c = localStorage.getItem(COPIA_KEY), h = localStorage.getItem(COPIA_HORA_KEY);
      borrarCopia();
      try{ return await hacer(); }
      finally{ try{ if(c !== null) localStorage.setItem(COPIA_KEY, c); if(h !== null) localStorage.setItem(COPIA_HORA_KEY, h); }catch(e){} }
    };
    let aGoogle = 0;
    const contandoGoogle = async hacer => {
      const f = window.fetch;
      window.fetch = (u, o) => { if(/docs\.google/.test(String(u))) aGoogle++; return f(u, o); };
      try{ return await hacer(); } finally { window.fetch = f; }
    };
    ok(!!copia0 && Math.abs(nCopia - total) <= total * 0.02, '[4 A] hay copia guardada de la carga de hoy para comparar', nCopia + ' filas · hoy ' + total);

    const a = await conVara(async () => {
      aGoogle = 0;
      const d1 = await contandoGoogle(() => conAdvapp(() => corto(g1), bajarDatos));
      const r1 = { d1, v1: filasDeAyer(), p1: leerPendiente(), google: aGoogle };
      const d2 = await conAdvapp(() => corto(g1), bajarDatos);            // la misma, del cache
      const d3 = await conAdvapp(() => corto(g2, n - 3), bajarDatos);     // otra, casi la misma cantidad
      return { ...r1, d2, d3, v3: filasDeAyer(), p3: leerPendiente() };
    }, desdeHoy);
    ok(esLaCopia0(a.d1), '[4 A] con ' + n + ' de los ' + total + ' productos de hoy (65 %) y copia guardada, se usa la copia entera, no la corta',
       a.d1.fuente + ' · ' + cantidad(a.d1) + ' filas · ' + (a.d1.motivo || 'sin motivo'));
    ok(a.v1 === total && a.p1 && a.p1.n === n && a.p1.generado_en === g1,
       '[4 A] la carga corta no baja la vara y queda anotada como pendiente, con su generado_en',
       'vara ' + a.v1 + ' · ' + pend(a.p1));
    ok(a.google === 0, '[4 A] y no se le pregunta a la hoja Meta (congelada en 583 desde el 16/09)', a.google + ' pedidos a Google');
    ok(esLaCopia0(a.d2), '[4 A] la misma respuesta otra vez (mismo generado_en, la del cache) no confirma la baja: sigue la copia',
       a.d2.fuente + ' · ' + cantidad(a.d2) + ' filas');
    ok(a.d3.fuente === 'advapp' && !a.d3.motivo && cantidad(a.d3) === n - 3 && a.v3 === n - 3 && a.p3 === null,
       '[4 A] otra respuesta con otro generado_en y casi la misma cantidad confirma la baja: se acepta y pasa a ser la vara',
       a.d3.fuente + ' · ' + cantidad(a.d3) + ' filas · vara ' + a.v3 + ' · ' + pend(a.p3));

    const otra = await conVara(async () => {
      await conAdvapp(() => corto(g1), bajarDatos);
      const d = await conAdvapp(() => corto(g2, m), bajarDatos);
      return { d, v: filasDeAyer(), p: leerPendiente() };
    }, desdeHoy);
    ok(esLaCopia0(otra.d) && otra.v === total && otra.p && otra.p.n === m && otra.p.generado_en === g2,
       '[4 A] otra respuesta corta pero con otra cantidad (' + m + ', 40 %) no confirma: sigue la copia y queda ella de pendiente',
       otra.d.fuente + ' · vara ' + otra.v + ' · ' + pend(otra.p));

    const vuelve = await conVara(async () => {
      await conAdvapp(() => corto(g1), bajarDatos);
      const d = await conAdvapp(() => respuesta({ ...real, generado_en: g2 }), bajarDatos);
      return { d, v: filasDeAyer(), p: leerPendiente() };
    }, desdeHoy);
    ok(vuelve.d.fuente === 'advapp' && !vuelve.d.motivo && cantidad(vuelve.d) === total && vuelve.v === total && vuelve.p === null,
       '[4 A] si la respuesta siguiente viene entera, se usa y la baja pendiente se olvida',
       vuelve.d.fuente + ' · ' + cantidad(vuelve.d) + ' filas · ' + pend(vuelve.p));

    const sinCopia = await sinLaCopia(() => conVara(async () => {
      const d = await conAdvapp(() => corto(g1), bajarDatos);
      return { d, v: filasDeAyer(), p: leerPendiente() };
    }, desdeHoy));
    ok(sinCopia.d.fuente === 'advapp' && cantidad(sinCopia.d) === n && /sin copia/.test(sinCopia.d.motivo || '')
       && sinCopia.v === total && sinCopia.p && sinCopia.p.n === n,
       '[4 A] sin copia que valga (vencida o sin guardar) se muestra lo que llego, con su motivo y sin bajar la vara',
       sinCopia.d.fuente + ' · ' + cantidad(sinCopia.d) + ' filas · vara ' + sinCopia.v + ' · ' + (sinCopia.d.motivo || 'sin motivo'));

    const nueva = await sinLaCopia(() => conVara(async () => {
      const d = await conAdvapp(() => corto(g1, 100), bajarDatos);
      return { d, v: filasDeAyer() };
    }, [null, null]));
    ok(nueva.d.fuente === 'advapp' && !nueva.d.motivo && cantidad(nueva.d) === 100 && nueva.v === 100,
       '[4 A] primera visita (sin vara ni copia): no hay con que comparar y se muestra lo que llegue',
       nueva.d.fuente + ' · ' + cantidad(nueva.d) + ' de ' + total + ' · vara ' + nueva.v);

    // ADVAPP manda desde el 20/10 hoy_como_domingo en el sobre (el feriado cerrado)
    const feriado = await conVara(async () => {
      const d1 = await conAdvapp(() => corto(g1, n, { hoy_como_domingo: 'Feriado de prueba' }), bajarDatos);
      const d2 = await conAdvapp(() => respuesta({ ...real, hoy_como_domingo: 'Feriado de prueba', generado_en: g2 }), bajarDatos);
      return { d1, d2 };
    }, desdeHoy);
    ok(esLaCopia0(feriado.d1) && feriado.d2.fuente === 'advapp' && !feriado.d2.motivo && cantidad(feriado.d2) === total,
       '[4 A] con hoy_como_domingo en el sobre todo sigue igual: la corta va a la copia y la entera se usa',
       feriado.d1.fuente + ' · ' + feriado.d2.fuente + ' ' + cantidad(feriado.d2));

    /* Lo que ve el cliente: actualizar(), como en el refresco de cada
       REFRESCO_MIN. Se deja todo como estaba: la vara (conVara), la copia, el
       pedido (limpiarPedido lo poda contra la lista corta) y la pantalla. */
    if(copia0){
      const crudo = [localStorage.getItem(COPIA_KEY), localStorage.getItem(COPIA_HORA_KEY)];
      const pedido0 = localStorage.getItem(PEDIDO_KEY), PEDIDO0 = JSON.stringify(PEDIDO);
      const nAntes = PRODUCTOS.length, h = hhmm(copia0.hora);
      const sello = () => document.getElementById('stamp').textContent.trim();
      const franja = () => !document.getElementById('franja').hidden;
      const franjaTxt = () => document.getElementById('franja-txt').textContent.replace(/\s+/g, ' ').trim();
      const devolverCopia = () => {
        try{
          if(crudo[0] === null) localStorage.removeItem(COPIA_KEY); else localStorage.setItem(COPIA_KEY, crudo[0]);
          if(crudo[1] === null) localStorage.removeItem(COPIA_HORA_KEY); else localStorage.setItem(COPIA_HORA_KEY, crudo[1]);
        }catch(e){}
      };
      try{
        await conVara(async () => {
          await conAdvapp(() => corto(g1), () => actualizar(false));
          const c1 = leerCopia();
          ok(FUENTE.fuente === 'copia' && PRODUCTOS.length === nAntes,
             '[4 A] en pantalla queda la ultima lista completa (la copia), no la corta',
             FUENTE.fuente + ' · ' + PRODUCTOS.length + ' de ' + nAntes + ' productos');
          ok(sello() === 'Precios de las ' + h && franja() && franjaTxt() === 'Estás viendo los precios de las ' + h + '. No pudimos actualizarlos.',
             '[4 A] con el sello y la franja de la copia, como sin conexion: nunca "Actualizado hoy"',
             sello() + ' · ' + (franja() ? franjaTxt() : 'sin franja'));
          ok(!!c1 && c1.hora === copia0.hora && c1.filas.length - 1 === nCopia,
             '[4 A] la copia buena de este navegador no se pisa con la corta',
             c1 ? (c1.filas.length - 1) + ' filas de las ' + hhmm(c1.hora) : 'sin copia');

          await conAdvapp(() => corto(g2, n - 3), () => actualizar(false));
          const c2 = leerCopia();
          ok(FUENTE.fuente === 'advapp' && !FUENTE.motivo && PRODUCTOS.length === n - 3 && sello() === 'Actualizado hoy' && !franja(),
             '[4 A] la segunda respuesta, con otro generado_en, confirma la baja: se ve la lista nueva, de hoy y sin franja',
             FUENTE.fuente + ' · ' + PRODUCTOS.length + ' productos · ' + sello() + (franja() ? ' · con franja' : ''));
          ok(!!c2 && c2.filas.length - 1 === n - 3,
             '[4 A] y pasa a ser la copia de este navegador', c2 ? (c2.filas.length - 1) + ' filas' : 'sin copia');
        }, desdeHoy);
      }finally{
        PEDIDO = JSON.parse(PEDIDO0);
        try{ if(pedido0 === null) localStorage.removeItem(PEDIDO_KEY); else localStorage.setItem(PEDIDO_KEY, pedido0); }catch(e){}
        devolverCopia();
        await actualizar(false);         // la lista de verdad, como al empezar
        devolverCopia();
        pintarPedido();
      }
      ok(FUENTE.fuente === 'advapp' && PRODUCTOS.length === nAntes, 'despues de las simulaciones la pagina vuelve a la lista de hoy',
         FUENTE.fuente + ' · ' + PRODUCTOS.length);
    }
  }

  /* ---- 6. Cada caso en que ADVAPP no sirve usa la copia, nunca la planilla ----
     29/09 (decision 1.3 A de Pedro): cada caso exigia "usa la planilla
     entera". Ahora exige la copia de la ultima respuesta buena de ADVAPP que
     este navegador guardo al cargar la pagina, entera y con su hora, sin
     pedirle la planilla a Google. (Hasta el 21/10 la hoja Meta si se pedia,
     para contar filas cuando ADVAPP venia corto; desde la decision 4 A ya no:
     ver la seccion 6 de arriba.) */
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
     Con la mitad no es un catalogo (y desde la 4 A, 21/10, tampoco con el 65 %:
     seccion 6). */
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
