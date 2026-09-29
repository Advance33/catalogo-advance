// La medición (17/09/2026): qué busca, qué mira y qué toca el cliente. Los
// eventos van a un endpoint propio de ADVAPP, sin terceros y sin cookies.
//
// Lo que se prueba acá es que mida lo que tiene que medir, que no mande NADA
// mientras ANALITICA_URL esté vacío ni si el navegador pide no ser seguido, y
// que un error al mandar no rompa la página. El envío se intercepta: en las
// pruebas no sale ningún pedido de verdad.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const dormir = ms => new Promise(r => setTimeout(r, ms));

const esperar = setInterval(() => {
  if(!MODELOS.length || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperar);
  for(let i=1;i<5000;i++) clearInterval(i);
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; })
    .finally(() => {
      try{ cerrarFicha(); }catch(e){}
      try{ pararPaseos(); pararOfertas(); }catch(e){}
      for(let i=1;i<5000;i++) clearInterval(i);
      const pre=document.createElement('pre'); pre.id='RESULTADO';
      pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
      document.body.appendChild(pre);
    });
}, 150);

/* Lo mandado queda acá en vez de salir a la red */
const mandados = [];
function interceptar(){
  const beaconReal = navigator.sendBeacon;
  const fetchReal = window.fetch;
  Object.defineProperty(navigator, 'sendBeacon', {
    configurable: true,
    value: (url, bolsa) => { mandados.push({ url, bolsa }); return true; }
  });
  window.fetch = (url, opts) => {
    if(String(url) === ANALITICA_URL){ mandados.push({ url, opts }); return Promise.resolve(new Response('')); }
    return fetchReal(url, opts);
  };
  return () => {
    if(beaconReal) Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: beaconReal });
    window.fetch = fetchReal;
  };
}
// 29/09: la bolsa se lee con fetch() de un blob: y no con bolsa.text(). La
// tanda borra todos los temporizadores (arriba) y Chrome, con
// --virtual-time-budget, cuando no le queda ni un temporizador ni un pedido
// pendiente da el presupuesto por gastado y vuelca el DOM. bolsa.text() no
// cuenta como pedido, y con la maquina cargada el volcado salia antes del
// RESULTADO: "NO LLEGO A CORRER" de a ratos (sola pasaba; con cinco corridas
// a la vez, 21 de 30), tambien con el index.html de HEAD. No era un error de
// JS ni un cambio en index.html. Un fetch si cuenta y el reloj lo espera. Un
// setInterval de latido no alcanza: el reloj salta de latido en latido y el
// presupuesto se quema igual. El blob: es local: no sale nada a la red.
// fetchDeVerdad se toma al cargar la tanda, antes de que interceptar()
// cambie window.fetch (un blob: igual no es ANALITICA_URL y pasaria).
const fetchDeVerdad = window.fetch.bind(window);
const leerBolsa = async b => {
  const u = URL.createObjectURL(b);
  try{ return await (await fetchDeVerdad(u)).text(); }
  finally{ URL.revokeObjectURL(u); }
};
const leer = async m => JSON.parse(m.bolsa ? await leerBolsa(m.bolsa) : m.opts.body);
// Los eventos se juntan y se mandan de a tandas: para leerlos hay que vaciar
// la cola primero, igual que hace la pagina al irse.
const eventos = async () => { ANALITICA.mandar(); return (await Promise.all(mandados.map(leer))).flatMap(x => x.eventos); };
const hubo = async t => (await eventos()).filter(e => e.t === t);

async function correrPruebas(){
  /* ---- 1. Apagada: no junta ni manda nada ----
     29/09 (hallazgo 187): decia "se publica apagada" y exigia la URL vacia en
     index.html. Encender la medicion es poner la direccion y publicar
     (MEDICION-ADVAPP.txt), y ese dia fallaban tres comprobaciones y PUBLICAR
     preguntaba "Publicar igual?". Ahora correr.py apaga la medicion en la
     copia de cada tanda (armar_probe), este encendida o no en index.html:
     ninguna prueba le manda eventos de verdad a ADVAPP desde localhost. Lo
     que se mira aca es que esa copia haya llegado apagada. */
  const original = ANALITICA_URL;
  ok(ANALITICA_URL === '', 'en la prueba arranca apagada (correr.py la apaga en su copia)', JSON.stringify(ANALITICA_URL));
  ok(ANALITICA.apagada() === true, 'la medición se declara apagada');
  anotar('prueba_apagada', { a: 1 });
  ok(ANALITICA.pendientes() === 0, 'con la medición apagada no se guarda ningún evento');

  /* ---- 2. Encendida: junta, manda de a tandas y no pierde la visita ---- */
  const soltar = interceptar();
  ANALITICA_URL = 'https://ejemplo.invalid/api/eventos';
  try{
    anotar('prueba', { a: 1 });
    ok(ANALITICA.pendientes() === 1, 'encendida, el evento queda en la cola');
    ANALITICA.mandar();
    ok(mandados.length === 1, 'y se manda cuando corresponde', mandados.length);
    const cuerpo = await leer(mandados[0]);
    ok(cuerpo.sitio === 'tecno-web' && cuerpo.v === 1 && Array.isArray(cuerpo.eventos),
       'el cuerpo lleva sitio, versión y la lista de eventos', JSON.stringify(cuerpo).slice(0, 120));
    ok(!!cuerpo.visita, 'y un número de visita');
    ok(mandados[0].bolsa && /^text\/plain/.test(mandados[0].bolsa.type),
       'va como text/plain, que es lo único que sendBeacon puede mandar sin preguntar antes',
       mandados[0].bolsa && mandados[0].bolsa.type);
    const primerEvento = cuerpo.eventos[0];
    ok(primerEvento.t === 'prueba' && primerEvento.a === 1 && typeof primerEvento.ms === 'number',
       'cada evento lleva su nombre, sus datos y el momento', JSON.stringify(primerEvento));

    anotar('prueba2');
    ANALITICA.mandar();
    const dos = await leer(mandados[1]);
    ok(dos.visita === cuerpo.visita, 'la visita es la misma en toda la sesión');

    /* ---- 3. Lo que de verdad importa medir ---- */
    const m = MODELOS.find(x => partirColores(x.color).length > 1) || MODELOS[0];
    const v = (m.variantes || [m]).find(x => partirColores(x.color).length > 1) || m.rep || m;
    abrirFicha(clave(v), null);
    const fichas = await hubo('ficha');
    ok(fichas.length === 1 && fichas[0].id === clave(v) && fichas[0].nombre,
       'abrir una ficha se mide, con el producto', JSON.stringify(fichas[0] || {}).slice(0, 110));

    const punto = document.querySelector('#ficha .fi-pintas button');
    if(punto){
      punto.click();
      const colores = await hubo('color');
      ok(colores.length >= 1 && colores[0].color, 'elegir un color se mide', JSON.stringify(colores[0] || {}).slice(0, 90));
    }else{
      R.push('  --   la ficha abierta no tiene puntitos de color');
    }

    const boton = document.querySelector('#ficha #fi-pedido');
    if(boton){
      boton.click();
      ok((await hubo('pedido_agregar')).length === 1, 'agregar al pedido se mide');
      document.querySelector('#ficha #fi-pedido').click();
      ok((await hubo('pedido_quitar')).length === 1, 'y sacarlo también');
    }
    cerrarFicha();

    /* ---- 4. El clic a WhatsApp: la conversión ---- */
    verTodoElCatalogo();
    await dormir(400);
    const wa = document.querySelector('.card a.wa') || document.querySelector('.card a[href*="wa.me/"]');
    if(wa){
      const antes = mandados.length;
      const frenar = e => e.preventDefault();          // que no abra WhatsApp en la prueba
      document.addEventListener('click', frenar);
      wa.click();
      document.removeEventListener('click', frenar);
      const clics = await hubo('whatsapp');
      ok(clics.length === 1 && clics[0].desde === 'tarjeta' && clics[0].id,
         'el clic a WhatsApp se mide, y dice desde dónde salió', JSON.stringify(clics[0] || {}).slice(0, 110));
      ok(mandados.length > antes, 'y se manda en el momento, sin esperar los 5 s');
    }else{
      R.push('  --   no hay botón de WhatsApp en la grilla (¿WHATSAPP vacío?)');
    }
    /* El WhatsApp escrito en el pie (6.7 B, 29/09) llega con desde: 'pie'
       (MEDICION-ADVAPP.txt); antes caia en 'otro' */
    const waPie = document.querySelector('#pie-id a[href*="wa.me/"]');
    if(waPie){
      const antesPie = (await hubo('whatsapp')).length;
      const frenar = e => e.preventDefault();
      document.addEventListener('click', frenar);
      waPie.click();
      document.removeEventListener('click', frenar);
      const todos = await hubo('whatsapp'), nuevo = todos.slice(antesPie);
      ok(nuevo.length === 1 && nuevo[0].desde === 'pie', 'el WhatsApp del pie se mide con desde: "pie"', JSON.stringify(nuevo[0] || {}).slice(0, 90));
    }else{
      R.push('  --   el pie no tiene WhatsApp (¿WHATSAPP vacío?)');
    }

    /* ---- 5. Buscar, entrar a un rubro y volver al menú ---- */
    $('q').value = 'iphone';
    filtros.q = 'iphone';
    aplicarFiltro(false);
    $('q').dispatchEvent(new Event('input'));
    await dormir(1800);
    const busq = await hubo('busqueda');
    ok(busq.length === 1 && busq[0].q === 'iphone' && typeof busq[0].resultados === 'number',
       'la búsqueda se mide con lo buscado y cuántos resultados dio', JSON.stringify(busq[0] || {}));
    filtros.q = ''; $('q').value = ''; aplicarFiltro(false);

    entrarAlRubro('Celular');
    ok((await hubo('rubro')).length === 1, 'entrar a un rubro se mide');
    irAlMenu();
    ok((await hubo('menu')).length === 1, 'y volver al menú también');

    /* ---- 6. Do Not Track: si el navegador lo pide, no se mide ---- */
    const dnt = Object.getOwnPropertyDescriptor(Navigator.prototype, 'doNotTrack') ||
                Object.getOwnPropertyDescriptor(navigator, 'doNotTrack');
    ANALITICA.mandar();            // se vacia lo de antes: lo que se prueba es lo de DESPUES
    Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '1' });
    const cuantos = mandados.length;
    anotar('no_deberia');
    ANALITICA.mandar();
    ok(ANALITICA.pendientes() === 0 && mandados.length === cuantos,
       'con Do Not Track no se junta ni se manda nada');
    Object.defineProperty(navigator, 'doNotTrack', dnt && dnt.get ? dnt : { configurable: true, value: null });

    /* ---- 7. Si el envío falla, la página sigue andando ---- */
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true, value: () => { throw new Error('sin red'); }
    });
    let reventó = false;
    try{ anotar('con_error'); ANALITICA.mandar(); }catch(e){ reventó = true; }
    ok(!reventó, 'un error al mandar no llega a la página');
  }finally{
    // Como estaba al entrar, no '' fijo (29/09)
    ANALITICA_URL = original;
    soltar();
  }

  ok(ANALITICA_URL === original && ANALITICA.apagada() === !original,
     'al terminar la prueba queda como estaba', JSON.stringify(ANALITICA_URL));
}
