// Marian, la guía de botones (29/10/2026, marian/marian.js). Benja la eligió
// solo con botones: «A Marian la hagamos con botones». Se prueba que cargue,
// que no haya nada para escribir ni la presente como IA, que cada pregunta del
// menú encuentre su respuesta en PREGUNTAS (si alguien cambia el título de una
// pregunta en index.html y la de Marian deja de calzar, falla acá), que los
// envíos muestren ENVIO_MOTO tal cual (sin el 3er cordón, 29/10), que cada
// botón quede en la medición y que la bienvenida salga una vez y no tape una
// ficha. correr.py marca la bienvenida como vista en todas las tandas; esta la
// borra para probarla.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const dormir = ms => new Promise(r => setTimeout(r, ms));

const esperar = setInterval(() => {
  if(!MODELOS.length || !document.querySelectorAll('#cats .chip').length || !window.MARIAN) return;
  clearInterval(esperar);
  for(let i=1;i<5000;i++) clearInterval(i);
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; })
    .finally(() => {
      try{ cerrarFicha(); }catch(e){}
      try{ pararPaseos(); pararOfertas(); pararNuevos(); pararMarcas(); pararMundos(); }catch(e){}
      for(let i=1;i<5000;i++) clearInterval(i);
      const pre=document.createElement('pre'); pre.id='RESULTADO';
      pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
      document.body.appendChild(pre);
    });
}, 150);

const raiz = () => document.querySelector('.mr-raiz');
const panel = () => raiz().querySelector('.mr-panel');
const titulo = () => (raiz().querySelector('.mr-titulo')?.textContent || '').replace('✓', '').trim();
const opciones = () => [...raiz().querySelectorAll('.mr-cuerpo .mr-op')];
const tocarTexto = async texto => {
  const b = [...raiz().querySelectorAll('.mr-cuerpo .mr-op, .mr-cuerpo .mr-btn')].find(x => x.textContent.includes(texto));
  if(b){ b.click(); await dormir(260); }
  return !!b;
};
// Las preguntas del menú, con las de los submenús
function preguntasDelMenu(){
  const todas = [];
  for(const op of MARIAN.MENU){
    if(op.faq) todas.push(op);
    if(op.sub) for(const s of op.sub()) if(s.faq) todas.push(s);
  }
  return todas;
}

async function correrPruebas(){
  /* ---- 1. Carga ---- */
  const lanzar = raiz() && raiz().querySelector('.mr-lanzar');
  ok(!!lanzar && !lanzar.hidden && /Preguntale a Marian/.test(lanzar.textContent),
     'el botón «Preguntale a Marian» está en la página');
  ok(panel() && panel().hidden, 'el panel arranca cerrado');
  ok(!raiz().querySelector('.mr-velo'), 'en las pruebas no sale la bienvenida (correr.py la marca vista)');

  /* ---- 2. Solo botones ---- */
  ok(!raiz().querySelector('input, textarea, select, form'), 'no hay nada para escribir: solo botones');

  /* ---- 3. El registro: cada botón va a la medición ---- */
  const medidos = [];
  const medirDeVerdad = ANALITICA.medir;
  ANALITICA.medir = (t, d) => medidos.push({ t, ...(d || {}) });
  const abrirVentana = window.open;
  let abierta = '';
  window.open = url => { abierta = String(url); return null; };
  try{
    /* ---- 4. El menú ---- */
    MARIAN.abrir();
    await dormir(100);
    ok(!panel().hidden, 'el botón abre el panel');
    ok(medidos.some(e => e.t === 'marian' && e.accion === 'abrir'), 'abrir el panel queda en la medición',
       JSON.stringify(medidos[0] || {}));
    ok(titulo() === '¡Hola! Soy Marian', 'arranca con el saludo', titulo());
    const etiquetas = opciones().map(b => b.querySelector('.mr-op-t').firstChild.textContent);
    ok(etiquetas.length === MARIAN.MENU.length && MARIAN.MENU.every((o, i) => o.etiqueta === etiquetas[i]),
       'muestra las ' + MARIAN.MENU.length + ' opciones del menú', etiquetas.join(' · '));
    ok(!/\bIA\b|inteligencia artificial/i.test(raiz().textContent), 'no se presenta como IA');

    /* ---- 5. Cada pregunta del menú está en la web ---- */
    for(const op of preguntasDelMenu()){
      const q = PREGUNTAS.find(x => op.faq.test(x.p));
      ok(!!q, '«' + op.etiqueta + '» encuentra su pregunta en PREGUNTAS', q ? q.p : String(op.faq));
    }

    /* ---- 6. Envíos: la tabla de ENVIO_MOTO tal cual ---- */
    medidos.length = 0;
    ok(await tocarTexto('¿Hacen envíos?'), 'se toca «¿Hacen envíos?»');
    ok(medidos.some(e => e.t === 'marian' && e.boton === '¿Hacen envíos?' && e.accion === 'pregunta'),
       'el botón queda en la medición con su texto', JSON.stringify(medidos[0] || {}));
    const filas = [...raiz().querySelectorAll('.mr-fila')].map(f => f.textContent);
    ok(filas.length === ENVIO_MOTO.length && ENVIO_MOTO.every((z, i) => filas[i] === z.zona + z.precio),
       'la tabla de la moto es la de ENVIO_MOTO', filas.join(' · '));
    const texto = raiz().querySelector('.mr-cuerpo').textContent;
    ok(!/3er cord|4to cord|\$45\.000|\$55\.000/.test(texto), 'del 3er cordón en adelante no aparece (29/10)');
    ok(!!raiz().querySelector('details.mr-cordon'), 'con «¿En qué cordón estoy?»');
    ok(!raiz().querySelector('.mr-atras').hidden, 'se puede volver con la flecha');

    /* ---- 7. El WhatsApp de abajo, con el mensaje de la pantalla ---- */
    medidos.length = 0;
    raiz().querySelector('.mr-wa-pie').click();
    await dormir(60);
    ok(/wa\.me\//.test(abierta) && /env%C3%ADo|envío/i.test(decodeURIComponent(abierta)),
       'abre WhatsApp con el mensaje de envíos', decodeURIComponent(abierta).slice(0, 90));
    ok(medidos.some(e => e.t === 'whatsapp' && e.desde === 'marian'), 'y se mide como whatsapp desde marian',
       JSON.stringify(medidos.map(e => e.t)));

    /* ---- 8. Volver y buscar un producto ---- */
    MARIAN.volver();
    await dormir(100);
    ok(titulo() === '¡Hola! Soy Marian', 'la flecha vuelve al menú', titulo());
    ok(raiz().querySelector('.mr-atras').hidden, 'en el menú no hay flecha');
    ok(await tocarTexto('Busco un producto'), 'se toca «Busco un producto»');
    const mundos = opciones();
    ok(mundos.length > 0 && mundos.every(b => Number(b.querySelector('.mr-op-n')?.textContent) > 0),
       'muestra los mundos, cada uno con productos', mundos.map(b => b.textContent.replace('›', '')).join(' · '));
    let pasos = 0;
    while(titulo() !== '¡Listo!' && opciones().length && pasos < 6){
      opciones()[0].click();
      await dormir(260);
      pasos++;
    }
    ok(titulo() === '¡Listo!', 'eligiendo, llega a «¡Listo!»', pasos + ' pasos');
    await dormir(1100);
    const cat = new URL(location.href).searchParams.get('cat');
    ok(!!cat && MODELOS.some(m => m.cat === cat), 'y filtra la página por el rubro elegido', cat);
    ok(panel().hidden, 'el panel se corre para que se vea la página');
    ok(medidos.some(e => e.t === 'marian' && e.accion === 'buscar' && e.rubro === cat),
       'el filtro queda en la medición', JSON.stringify(medidos.filter(e => e.accion === 'buscar')));

    /* ---- 9. La bienvenida: una vez, y nunca encima de una ficha ---- */
    try{ localStorage.removeItem(MARIAN.VISTA); }catch(e){}
    MARIAN.bienvenida();
    const velo = raiz().querySelector('.mr-velo');
    ok(!!velo && /conocé a Marian/.test(velo.textContent), 'la bienvenida presenta a Marian');
    ok(velo && velo.querySelectorAll('.mr-ej').length === 3, 'con tres atajos');
    velo && velo.querySelector('[data-no]').click();
    ok(!raiz().querySelector('.mr-velo'), '«Ahora no» la cierra');
    let vista = null;
    try{ vista = localStorage.getItem(MARIAN.VISTA); }catch(e){}
    ok(vista === '1', 'y queda vista: no vuelve a salir', vista);
    const m = MODELOS.find(x => x.rep);
    if(m){
      abrirFicha(clave(m.rep), null);
      await dormir(100);
      try{ localStorage.removeItem(MARIAN.VISTA); }catch(e){}
      MARIAN.bienvenida();
      ok(!raiz().querySelector('.mr-velo'), 'con una ficha abierta no se le cruza encima');
      cerrarFicha();
    }
  }finally{
    ANALITICA.medir = medirDeVerdad;
    window.open = abrirVentana;
    try{ localStorage.setItem(MARIAN.VISTA, '1'); }catch(e){}
  }
}
