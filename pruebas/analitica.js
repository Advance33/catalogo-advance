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

    const punto = document.querySelector('#ficha .fi-tono');
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

  /* ---- 8. La pauta (13/11/2026): si la visita llegó tocando un aviso pago ----
     Un clic pago de Google y uno gratis llegaban los dos como "www.google.com".
     pautaDe() lee la dirección de entrada y dice de quién es la pauta y la
     campaña; va en el evento "visita". La misma función está en las páginas de
     cada modelo (herramientas/paginas-producto.py --probar mira que sean iguales). */
  const pautaEs = (consulta, esperado, t) => {
    const dio = JSON.stringify(pautaDe(consulta));
    ok(dio === JSON.stringify(esperado), t, dio);
  };
  pautaEs('?gclid=EAIaIQobChMI', { pauta: 'google' }, 'un clic a un aviso de Google (gclid) es pauta de google');
  pautaEs('?gbraid=0AAAAA', { pauta: 'google' }, 'también con lo que manda en iPhone (gbraid)');
  pautaEs('?wbraid=0AAAAA', { pauta: 'google' }, 'o wbraid');
  pautaEs('?gad_source=1', { pauta: 'google' }, 'y cuando el navegador le sacó el gclid (queda gad_source)');
  pautaEs('?gclid=x&gad_source=1&gad_campaignid=22334455', { pauta: 'google', campania: '22334455' },
          'la campaña sale del número que pone Google');
  pautaEs('?gclid=x&gad_campaignid=1&utm_campaign=PS5+B%C3%BAsqueda', { pauta: 'google', campania: 'ps5 busqueda' },
          'y si el aviso trae un nombre escrito a mano, ese le gana al número (sin tildes ni mayúsculas)');
  pautaEs('?utm_source=Meta&utm_medium=CPC&utm_campaign=Consolas%20Nov%20%F0%9F%94%A5', { pauta: 'meta', campania: 'consolas nov' },
          'otra pauta se marca a mano: utm_medium=cpc y de quién es');
  pautaEs('?utm_medium=paid_social&utm_source=instagram', { pauta: 'instagram' }, 'paid_social también es pauta');
  pautaEs('?utm_medium=cpc', { pauta: 'otra' }, 'una pauta que no dice de quién es queda como "otra"');
  pautaEs('?utm_source=instagram&utm_medium=historia&utm_campaign=ps5', {}, 'un link marcado que no es pago no es pauta');
  pautaEs('?q=iphone&cat=Celular', {}, 'un link filtrado tampoco');
  pautaEs('', {}, 'ni entrar sin nada en la dirección');
  ok(!JSON.stringify(pautaDe('?gclid=CLIC-SECRETO-123&utm_campaign=a')).includes('SECRETO'), 'el código del clic no se guarda');
  const larga = pautaDe('?utm_medium=cpc&utm_source=' + 'x'.repeat(200) + '&utm_campaign=' + 'y'.repeat(200));
  ok(larga.pauta.length === 30 && larga.campania.length === 40, 'lo que se anota va recortado', larga.pauta.length + ' y ' + larga.campania.length);
  ok(JSON.stringify(PAUTA_ENTRADA) === JSON.stringify(pautaDe(location.search)), 'la pauta de esta visita se leyó al cargar', JSON.stringify(PAUTA_ENTRADA));
  // El evento "visita" sale una sola vez y antes de que corra esta tanda: se mira el código
  const codigo = [...document.scripts].map(s => s.textContent).join('\n');
  ok(/anotar\('visita', \{[^;]*\.\.\.PAUTA_ENTRADA \}\)/.test(codigo), 'y va en el evento "visita"');
}
