// Guardas de la tanda B6, la portada (auditoria del 29/09/2026).
// Cada bloque es un error que se encontro y se arreglo: si vuelve, falla aca.
// El numero entre corchetes es el del hallazgo.
//
//  [112] Codigo muerto del paseo viejo (activarPaseo, PASEOS, .fp-pista) y un
//        freno (est.rendida) que no se asignaba en ningun lado.
//  [102] Pasar el mouse por la cinta de rubros la mandaba al principio en vez
//        de pausarla (la regla CSS de la pausa apuntaba a .fp-pista).
//  [101] Elegido un rubro (desde el mosaico o la cinta), la cinta volvia a
//        desfilar sola a los 5 s, con el chip marcado fuera de la vista. Y
//        volviendo a la portada con el Atras quedaba quieta (29/09).
//  [106] Un refresco que rearmaba la cinta la dejaba quieta y sin copias
//        hasta recargar (el estado miraba la tira vieja).
//  [103] "¿Cuanto queres gastar?": ir con el mouse a "Ver los N" cruzaba las
//        pestañas de la derecha y cambiaba el tramo elegido.
//  [100] En Filmadoras se sugerian lentes que no pueden montar.
//  [110] "Te puede servir" ignoraba la marca y la montura: AirTag y Apple
//        Watch para un Samsung, una Canon EF-S para un lente Sony E.
//   [99] Con un rubro entero fuera de venta la caja se esconde a proposito
//        (y sugeridos.js ya no lo cuenta como falla de la pagina).
//  [109] La vidriera (Destacados) no se podia abrir con teclado; los puntitos
//        decian ser pestañas sin panel.
//  [108] Un toque con el dedo la frenaba para siempre; con el mouse encima,
//        las flechas y el refresco la hacian avanzar igual. Y el foco que
//        deja un clic en una flecha la dejaba frenada (29/09).
//  [206] La vidriera usaba la descripcion cruda y no el titulo de la tarjeta.
//   [18] "+ Solo el S-Pen" (una nota de caja) contaba como regalo y metia la
//        Tab S10 FE Plus en Destacados (29/09).
//  [107] El numero de cada rubro del mosaico no coincidia con el de adentro.
//  [125] La cinta de "Lo ultimo de la marca" seguia corriendo con el foco.
//  [126] Con "reducir movimiento" esa cinta mostraba la lista dos veces.
//  [142] Las piezas de la portada animaban y giraban fuera de la vista.
//  [136] Las preguntas frecuentes se anunciaban como botones de encendido.
//  [115] La medicion no veia el casillero "¿Buscas algo que no esta?", ni el
//        "Consultar" de Recien llegados, y las preguntas salian 'otro'.
//  [114] Se pedian logos que no existen (Motorola, Microsoft, Kieslect).
//  [113] Los easter eggs se bajaban (230 KB) en todas las visitas.
const R = [];
let fallas = 0;
const ok = (c, txt, extra) => { R.push((c?'  OK  ':'FALLA ') + txt + (extra!==undefined?('  ['+extra+']'):'')); if(!c) fallas++; };
const nota = txt => R.push('  --   ' + txt);
const reportar = () => {
  const pre = document.createElement('pre');
  pre.id = 'RESULTADO';
  pre.textContent = '\n===== ' + (fallas ? fallas + ' FALLA(S)' : 'TODO OK') + ' =====\n' + R.join('\n');
  document.body.appendChild(pre);
};
const dormirB6 = ms => new Promise(r => setTimeout(r, ms));
// [113] mira que archivos se pidieron. El registro del navegador guarda 250 por
// defecto y la portada baja mas que eso: sin agrandarlo ya, lo de despues no
// quedaria anotado y la prueba pasaria sin mirar nada.
try{ performance.setResourceTimingBufferSize(20000); }catch(e){}
const $$b6 = s => [...document.querySelectorAll(s)];

const esperaB6 = setInterval(() => {
  if(!MODELOS.length || !document.querySelectorAll('#cats .chip').length ||
     !document.getElementById('nuevos') || !document.getElementById('marcas-vitrina')) return;
  clearInterval(esperaB6);
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: ' + (e && e.stack || e)); fallas++; })
    .then(() => {
      try{ quitarFicha(); }catch(e){}
      try{ pararPaseos(); }catch(e){}
      try{ pararOfertas(); }catch(e){}
      try{ pararNuevos(); }catch(e){}
      try{ pararMarcas(); }catch(e){}
      try{ pararMundos(); }catch(e){}
      try{ VIGIAS.forEach(io => io.disconnect()); }catch(e){}
      for(let i = 1; i < 5000; i++) clearInterval(i);
      reportar();
    });
}, 150);

async function correrPruebas(){
  // [113] y [142] van primero: miran la portada tal como abre
  const bloques = [eggsSinPrecarga, fueraDeLaVista, codigoMuerto, pausaSinSalto, cintaQuietaEnElRubro,
                   refrescoDeLaCinta, presupuestoDePasada, filmadoras, sugeridosCompatibles,
                   cajaVaciaAProposito, vidrieraConTeclado, vidrieraConFrenos, vidrieraConTitulo, vidrieraSinSolo,
                   mosaicoCuentaLoDeAdentro, cintaDeMarcaConFoco, cintaDeMarcaQuieta,
                   preguntasDesplegables, medicionDeLaPortada, logosQueExisten];
  for(const b of bloques){
    try{ await b(); }
    catch(e){ R.push('EXCEPCION en ' + b.name + ': ' + (e && e.stack || e)); fallas++; }
  }
}

const volverALaPortada = () => { quitarFicha(); irAlMenu(); scrollTo(0, 0); };
const tiraCats = () => $('cats').querySelector('.fp-tira');
const desfila = () => !!tiraCats() && tiraCats().classList.contains('desfila');
const hayQuePasear = () => { const est = estadoCinta(); return !quieto && est && est.corrida > $('cats').clientWidth; };
const pedidos = () => performance.getEntriesByType('resource').map(r => r.name);

/* ---- [113] Los eggs no se bajan si nadie va a abrirlos ---- */
async function eggsSinPrecarga(){
  // La precarga vieja corria con requestIdleCallback y un tope de 5 s
  await dormirB6(5500);
  const eggs = ['el-primo.webp', 'vegetta-skin.png', 'el-primo-voz.mp3', 'vegetta-voz.mp3'];
  const bajados = eggs.filter(f => pedidos().some(u => u.includes('/assets/' + f)));
  ok(!bajados.length, '[113] al entrar no se baja ningun archivo de los easter eggs', bajados.join(', ') || 'ninguno');
  ok(vaParaElPrimo('pri') && vaParaElPrimo('El P') && vaParaElPrimo('primo') && vaParaElPrimo('el primo'),
     '[113] "pri", "el p", "primo" y "el primo" van camino al egg del Primo');
  ok(!vaParaElPrimo('pr') && !vaParaElPrimo('pro') && !vaParaElPrimo('iphone') && !vaParaElPrimo('el'),
     '[113] "pr", "pro", "el" o una busqueda comun no bajan nada');
  /* Lo que se trae se mira espiando fetch (asi lo pide precargarEgg): el
     registro de tiempos del navegador anota la descarga recien cuando termina,
     y con el reloj virtual de las pruebas eso llegaba o no segun el dia. */
  const traidos = [], fetchReal = window.fetch;
  window.fetch = (u, o) => { traidos.push(String(u)); return fetchReal(u, o); };
  try{
    // Escribir "pri" lo trae
    $('q').value = 'pri';
    $('q').dispatchEvent(new Event('input', { bubbles: true }));
    ok(traidos.some(u => u.includes('assets/el-primo.webp')) && traidos.some(u => u.includes('assets/el-primo-voz.mp3')),
       '[113] escribiendo "pri" en el buscador, el render y la voz del Primo se traen antes de abrirlo', traidos.join(' '));
    $('q').value = ''; filtros.q = ''; $('q').dispatchEvent(new Event('input', { bubbles: true }));
    await dormirB6(200);
    // Tres clics seguidos en el triangulo traen los de Vegetta
    eggN = 0; eggUltimo = 0;
    $('marca-btn').click(); $('marca-btn').click();
    ok(!traidos.some(u => u.includes('vegetta')), '[113] con dos clics en el triangulo todavia no se trae nada');
    $('marca-btn').click();
    ok(traidos.some(u => u.includes('assets/vegetta-skin.png')) && traidos.some(u => u.includes('assets/vegetta-voz.mp3')),
       '[113] con tres clics seguidos se traen los de Vegetta (se abre con ' + EGG_CLICS + ')', traidos.join(' '));
  }finally{ window.fetch = fetchReal; }
  eggN = 0; eggUltimo = 0;
  volverALaPortada();
}

/* ---- [142] Lo que no se ve no gira ni anima ---- */
async function fueraDeLaVista(){
  volverALaPortada();
  await dormirB6(400);
  const nv = $('nuevos'), mv = $('marcas-vitrina');
  ok(['nuevos', 'marcas-vitrina', 'ofertas', 'mosaico'].every(id => VIGIAS.get(id) && VIGIAS.get(id).avisar),
     '[142] las cuatro piezas de la portada tienen quien mire si se ven');
  /* El aviso de la carga: el observador avisa apenas se engancha. Si no llego
     a avisar (el Chrome sin ventana deja de dibujar despues de cargar), se
     anota y se prueba igual lo que hace cada aviso, llamandolo directo. */
  const lejos = el => el.getBoundingClientRect().top > innerHeight;
  if(lejos(nv) && nv.classList.contains('fuera-vista'))
    ok(nvFrenos.has('fuera'), '[142] al cargar, Recien llegados (dos pantallas abajo) quedo frenada', [...nvFrenos].join(',') || 'sin frenos');
  else nota('[142] el observador no llego a avisar al cargar: se prueba su aviso directo');
  VIGIAS.get('nuevos').avisar(false);
  VIGIAS.get('marcas-vitrina').avisar(false);
  ok(nv.classList.contains('fuera-vista') && nvFrenos.has('fuera'),
     '[142] fuera de la vista, Recien llegados no gira ni anima', [...nvFrenos].join(',') || 'sin frenos');
  ok(mv.classList.contains('fuera-vista') && mvFrenos.has('fuera'),
     '[142] Marcas tampoco', [...mvFrenos].join(',') || 'sin frenos');
  const flota = nv.querySelector('.nv-ancho.activa .nv-foto img');
  ok(!flota || quieto || getComputedStyle(flota).animationPlayState.includes('paused'),
     '[142] y lo que late (la foto que flota) queda en pausa', flota && getComputedStyle(flota).animationPlayState);
  arrancarNuevos();
  const antes = nvIndice;
  nvDesde = Date.now() - 3 * NUEVOS_MS;
  await dormirB6(700);
  ok(!!nvTimer && nvIndice === antes, '[142] y con el tiempo cumplido no pasa a la siguiente', nvIndice);
  VIGIAS.get('nuevos').avisar(true);
  VIGIAS.get('marcas-vitrina').avisar(true);
  ok(!nv.classList.contains('fuera-vista') && !nvFrenos.has('fuera') && !mvFrenos.has('fuera'),
     '[142] al llegar a la vista, las dos vuelven a girar', [...nvFrenos, ...mvFrenos].join(',') || 'sin frenos');
  // Las tarjetas que no se ven no animan su puntito ni su brillo
  const quieta = nv.querySelector('.nv-chico:not(.activa) .nv-nuevo');
  const anima = quieta && getComputedStyle(quieta, '::before').animationName;
  ok(!quieta || quieto || anima === 'none', '[142] las tarjetas escondidas no animan su puntito "Nuevo"', anima);
  const brillo = nv.querySelector('.nv-ancho:not(.activa) .nv-cinta');
  const animaB = brillo && getComputedStyle(brillo, '::after').animationName;
  ok(!brillo || quieto || animaB === 'none', '[142] ni el brillo de su cinta', animaB);
}

/* ---- [112] El paseo viejo no vuelve ---- */
function codigoMuerto(){
  ok(typeof activarPaseo === 'undefined' && typeof PASEOS === 'undefined' && typeof PASEO_PASO === 'undefined',
     '[112] el paseo viejo con setInterval (activarPaseo, PASEOS) no esta');
  const reglas = [];
  const juntar = lista => [...lista].forEach(r => { if(r.selectorText) reglas.push(r.selectorText); if(r.cssRules) juntar(r.cssRules); });
  [...document.styleSheets].forEach(h => { try{ juntar(h.cssRules); }catch(e){} });
  ok(!reglas.some(s => s.includes('fp-pista')), '[112] no quedan reglas CSS para .fp-pista, que ningun elemento lleva');
  ok(!/rendida/.test(desfilar.toString()), '[112] ni el freno est.rendida, que nadie asignaba');
  ok(typeof pararPaseos === 'function', '[112] pararPaseos sigue (la usan las pruebas y layout)');
}

/* ---- [102] El mouse pausa la cinta donde esta ---- */
function pausaSinSalto(){
  volverALaPortada();
  arrancarCintaAuto();
  const reglas = [];
  const juntar = lista => [...lista].forEach(r => { if(r.selectorText) reglas.push(r); if(r.cssRules) juntar(r.cssRules); });
  [...document.styleSheets].forEach(h => { try{ juntar(h.cssRules); }catch(e){} });
  ok(reglas.some(r => /#cats-wrap:hover/.test(r.selectorText) && /\.fp-tira\.desfila/.test(r.selectorText)
                      && r.style.animationPlayState === 'paused'),
     '[102] hay una regla que pausa la cinta con el mouse encima (#cats-wrap:hover)');
  if(!hayQuePasear()){ nota('[102] la cinta entra entera: no desfila y no hay salto que probar'); return; }
  const antes = tiraCats().style.getPropertyValue('--desde');
  $('cats-wrap').dispatchEvent(new MouseEvent('mouseenter'));
  ok(desfila(), '[102] el mouseenter no le saca "desfila" a la tira (era lo que la mandaba al principio)');
  $('cats-wrap').dispatchEvent(new MouseEvent('mouseleave'));
  ok(tiraCats().style.getPropertyValue('--desde') === antes,
     '[102] y al salir no la vuelve a arrancar desde cero', antes + ' -> ' + tiraCats().style.getPropertyValue('--desde'));
}

/* ---- [101] Con un rubro elegido la cinta se queda quieta ---- */
async function cintaQuietaEnElRubro(){
  volverALaPortada();
  arrancarCintaAuto();
  if(!hayQuePasear()){ nota('[101] la cinta entra entera: no desfila'); return; }
  const cinta = $('cats');
  const aLaVista = () => {
    const chip = cinta.querySelector('.chip[aria-pressed="true"]:not(.clon)');
    if(!chip) return false;
    const c = cinta.getBoundingClientRect(), b = chip.getBoundingClientRect();
    return b.left >= c.left - 1 && b.right <= c.right + 1;
  };
  // Desde el mosaico: el camino principal en el celular
  const rubros = $$b6('#mosaico .rubro');
  const boton = rubros[rubros.length - 1];          // el ultimo: el chip queda lejos a la derecha
  boton.click();
  ok(filtros.cat === boton.dataset.cat, '[101] tocar un rubro del mosaico lo abre', filtros.cat);
  ok(aLaVista(), '[101] y el chip del rubro queda a la vista en la cinta');
  await dormirB6(DESFILE_VUELVE + 1000);
  ok(!desfila(), '[101] pasado el tiempo de la pausa, la cinta NO vuelve a desfilar dentro del rubro', filtros.cat);
  ok(aLaVista(), '[101] y el chip sigue a la vista');
  // Desde la cinta: toque sobre un chip
  volverALaPortada();
  const est = estadoCinta();
  est.frenar(); est.arrancar();
  const chip = $$b6('#cats .chip:not(.clon)').find(c => c.dataset.cat && c.dataset.cat !== boton.dataset.cat);
  chip.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
  chip.click();
  await dormirB6(DESFILE_VUELVE + 1000);
  ok(filtros.cat === chip.dataset.cat && !desfila(),
     '[101] tocando el chip en la cinta, tampoco vuelve a desfilar', filtros.cat);
  // Y de vuelta en la portada, retoma sola
  $$b6('#cats .chip:not(.clon)').find(c => c.dataset.cat === '').click();
  await dormirB6(DESFILE_VUELVE + 1000);
  ok(enPortada() && desfila(), '[101] de vuelta en "Todo", la cinta vuelve a desfilar sola');
  /* Y volviendo con el Atras, que en el celular es la forma normal de volver
     (29/09): pasada la pausa adentro del rubro, solo irAlMenu la retomaba y
     la cinta quedaba quieta el resto de la visita. */
  const ultimo = $$b6('#mosaico .rubro').pop();
  ultimo.click();
  await dormirB6(DESFILE_VUELVE + 1000);
  ok(filtros.cat === ultimo.dataset.cat && !desfila(), '[101] otra vez adentro del rubro, pasada la pausa, quieta', filtros.cat);
  history.back();
  await dormirB6(DESFILE_VUELVE + 1000);
  ok(enPortada() && desfila(), '[101] volviendo con el Atras despues de la pausa, la cinta vuelve a desfilar sola',
     'portada=' + enPortada() + ' desfila=' + desfila());
  // Y con Adelante se entra al rubro con la cinta quieta y el chip a la vista
  history.forward();
  await dormirB6(DESFILE_VUELVE + 1000);
  ok(filtros.cat === ultimo.dataset.cat && !desfila() && aLaVista(),
     '[101] con Adelante se vuelve al rubro con la cinta quieta y el chip a la vista',
     filtros.cat + ' desfila=' + desfila() + ' a la vista=' + aLaVista());
  volverALaPortada();
}

/* ---- [106] Un refresco que rearma la cinta no la deja quieta ---- */
async function refrescoDeLaCinta(){
  volverALaPortada();
  arrancarCintaAuto();
  const vieja = tiraCats();
  // Cambia solo una marca: la cinta (que no muestra marcas) no se rearma
  const p = PRODUCTOS.find(x => x.marca && x.cat);
  const marca = p.marca;
  p.marca = 'Marca de prueba B6';
  try{ armarFiltros(); }
  finally{ p.marca = marca; armarFiltros(); }
  ok(tiraCats() === vieja, '[106] si cambian solo las marcas, la cinta no se rearma (no pierde scroll ni foco)');
  // Cambian los rubros: se rearma y tiene que seguir desfilando
  FIRMA_FILTROS = 'otra lista de rubros';
  armarFiltros();
  const nueva = tiraCats(), est = estadoCinta();
  ok(nueva !== vieja, '[106] con otra lista de rubros la cinta se rearma');
  ok(est && est.tira === nueva, '[106] y el desfile mira la tira nueva, no la que se fue');
  if(hayQuePasear()){
    ok(desfila() && nueva.querySelectorAll('.chip.clon').length > 0,
       '[106] la tira nueva desfila, con sus copias', nueva.querySelectorAll('.chip.clon').length + ' copias');
  }else nota('[106] la cinta entra entera: no desfila');
  ok(!vieja.isConnected && !vieja.classList.contains('desfila'), '[106] la vieja queda fuera y quieta');
}

/* ---- [103] De pasada no se cambia el tramo ---- */
async function presupuestoDePasada(){
  volverALaPortada();
  const sec = $('presupuesto');
  if(!sec || PV.length < 3){ nota('[103] no hay tres tramos para probar'); return; }
  const tab = v => sec.querySelector(`.pv-tab[data-pv="${v}"]`);
  const pasar = (el, desde) => {
    if(desde) desde.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, pointerType: 'mouse', relatedTarget: el }));
    el.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse', relatedTarget: desde || null }));
  };
  const a = PV[0].val;
  tab(a).click();
  ok(pvVal === a, '[103] el clic elige el tramo en el acto', a);
  // Camino al boton: cruza las demas pestañas a velocidad normal (< 100 ms cada una)
  let antes = tab(a);
  for(const t of PV.slice(1)){ pasar(tab(t.val), antes); antes = tab(t.val); await dormirB6(60); }
  const ver = sec.querySelector('.pv-cab [data-ver]') || sec.querySelector('[data-ver]');
  pasar(ver, antes);
  await dormirB6(PV_MIRA_MS + 200);
  ok(pvVal === a, '[103] cruzar las pestañas de camino a "Ver los N" no cambia el tramo elegido', pvVal);
  // Quedarse sobre un tramo si lo muestra
  const b = PV[1].val;
  pasar(tab(b), ver);
  await dormirB6(PV_MIRA_MS + 150);
  ok(pvVal === b, '[103] quedarse un momento sobre un tramo lo muestra', pvVal);
  tab(a).click();
}

/* ---- [100] Las filmadoras no llevan lentes ---- */
function filmadoras(){
  const mapa = COMPLEMENTOS['Filmadora'] || [];
  ok(!mapa.includes('Objetivo') && !mapa.includes('Accesorio Cámara'),
     '[100] a una filmadora (lente fijo) no se le sugieren lentes ni accesorios por montura', mapa.join(', '));
  volverALaPortada();
  filtros.cat = 'Filmadora'; pintar();
  const s = elegirSugeridos('Filmadora');
  ok(s.every(m => m.cat !== 'Objetivo' && m.cat !== 'Accesorio Cámara'), '[100] y en la pagina tampoco aparecen',
     s.map(m => m.cat).join(', ') || 'nada');
  volverALaPortada();
}

/* ---- [110] Lo que se sugiere le sirve a lo que se mira ---- */
function sugeridosCompatibles(){
  const cuerpo = (marca, desc) => monturasDelCuerpo({ cat: 'Cámara', marca, desc }).join(',');
  const casos = [['Canon', 'EOS 2000D Kit 18-55 III (T7)', 'Canon EF-S,Canon EF'],
                 ['Canon', 'EOS R10 Body', 'Canon RF,Canon RF-S'], ['Canon', 'EOS 5D Mark IV Body', 'Canon EF'],
                 ['Canon', 'PowerShot G7 X Mark III', ''], ['Sony', 'DSC RX100 VII', ''],
                 ['Sony', 'Alfa 7 III Body', 'Sony E'], ['Sony', 'ZV-E10 II Body', 'Sony E'], ['Sony', 'FX30 Body', 'Sony E'],
                 ['Nikon', 'Z30 Kit 16-50 Mm', 'Nikon Z'], ['Nikon', 'D7500 Kit 18-140', 'Nikon F'],
                 ['Fujifilm', 'Instax Mini 12', '']];
  const mal = casos.filter(([m, d, esp]) => cuerpo(m, d) !== esp);
  ok(!mal.length, '[110] la montura de cada cuerpo sale bien del nombre (las compactas no tienen)',
     mal.map(([m, d]) => d + ' -> ' + cuerpo(m, d)).join(' | ') || casos.length + ' casos');
  ok(plataformasDe({ desc: 'Volante Logitech G29 PS5/PS4/PC' }).join() === 'sony'
     && plataformasDe({ desc: 'Joystick Xbox S/X' }).join() === 'microsoft',
     '[110] y la consola de cada accesorio de gaming');

  const probar = (f, techo) => { volverALaPortada(); Object.assign(filtros, f); pintar();
                                 return elegirSugeridos(filtros.cat, techo); };
  const malos = [];
  // Otra marca en el mundo de la marca: nada de Apple
  MUNDO_DE_LA_MARCA.forEach(cat => {
    [...new Set(MODELOS.filter(m => m.cat === cat && norm(m.marca) !== 'apple').map(m => m.marca))].forEach(marca => {
      [undefined, Infinity].forEach(techo => {
        const s = probar({ cat, marca }, techo);
        if(s.some(m => norm(m.marca) === 'apple')) malos.push(cat + '+' + marca + ': ' + s.map(m => m.desc).join(' · '));
      });
    });
  });
  ok(!malos.length, '[110] con otra marca en Celulares, Tablets, etc. no se sugiere nada de Apple (tampoco sin techo)',
     malos.slice(0, 2).join(' | ') || 'ninguno');
  // Lentes: solo cuerpos a los que les entra esa montura
  const malM = [];
  [...new Set(MODELOS.filter(m => m.cat === 'Objetivo' && m.montura).map(m => m.montura))].forEach(montura => {
    [undefined, Infinity].forEach(techo => {
      probar({ cat: 'Objetivo', montura }, techo).filter(m => m.cat === 'Cámara')
        .forEach(m => { if(!monturasDelCuerpo(m).includes(montura)) malM.push(montura + ': ' + m.desc); });
    });
  });
  ok(!malM.length, '[110] mirando lentes de una montura, las camaras sugeridas son de esa montura (ni compactas ni EF-S para RF)',
     malM.slice(0, 3).join(' | ') || 'ninguna');
  // Camaras: solo lentes que les entran a los cuerpos de la pantalla
  const malC = [];
  [...new Set(MODELOS.filter(m => m.cat === 'Cámara').map(m => m.marca))].forEach(marca => {
    [undefined, Infinity].forEach(techo => {
      const s = probar({ cat: 'Cámara', marca }, techo);
      const entran = new Set(LISTA.filter(m => m.cat === 'Cámara').flatMap(monturasDelCuerpo));
      s.filter(m => m.cat === 'Objetivo').forEach(m => { if(!entran.has(m.montura)) malC.push(marca + ': ' + m.desc + ' (' + (m.montura || 'sin montura') + ')'); });
    });
  });
  ok(!malC.length, '[110] mirando camaras de una marca, los lentes sugeridos les entran', malC.slice(0, 3).join(' | ') || 'ninguno');
  // Consolas: solo accesorios de esa consola
  const malG = [];
  [...new Set(MODELOS.filter(m => m.cat === 'Consola').map(m => m.marca))].forEach(marca => {
    probar({ cat: 'Consola', marca }, Infinity).filter(m => m.cat === 'Accesorio Gaming')
      .forEach(m => { if(!plataformasDe(m).includes(norm(marca))) malG.push(marca + ': ' + m.desc); });
  });
  ok(!malG.length, '[110] mirando una consola, los accesorios de gaming son de esa consola', malG.join(' | ') || 'ninguno');
  volverALaPortada();
}

/* ---- [99] Sin nada comprable, la caja se esconde (a proposito) ---- */
function cajaVaciaAProposito(){
  const tocar = MODELOS.filter(m => (COMPLEMENTOS['Cámara'] || []).includes(m.cat));
  const guardado = tocar.map(m => m.stock);
  try{
    tocar.forEach(m => { m.stock = false; });
    volverALaPortada();
    filtros.cat = 'Cámara'; pintar();
    ok($('sugeridos').hidden && !$('sugeridos').querySelector('.sug'),
       '[99] con todos los complementos fuera de venta, "Te puede servir" no aparece (no se inventa nada)');
  }finally{
    tocar.forEach((m, i) => { m.stock = guardado[i]; });
    volverALaPortada();
  }
}

/* ---- [109] La vidriera se abre con el teclado ---- */
function vidrieraConTeclado(){
  pintarOfertas();
  if(!OF.length){ nota('[109] hoy la vidriera no tiene nada'); return; }
  irOferta(Math.min(1, OF.length - 1), false);
  const slides = $$b6('#of-pista .of-slide');
  const enfocables = slides.map(s => [...s.querySelectorAll('button, a, [tabindex]')].filter(b => b.tabIndex >= 0).length);
  ok(enfocables[ofIndice] === 1 && enfocables.every((n, i) => i === ofIndice || n === 0),
     '[109] la tarjeta que se ve tiene un boton enfocable, y las demas ninguno', enfocables.join(','));
  const b = slides[ofIndice].querySelector('.of-ver');
  ok(b && b.tagName === 'BUTTON', '[109] "Ver el producto" es un boton', b && b.tagName);
  const k = slides[ofIndice].dataset.key;
  b.click();
  ok(FICHA === k, '[109] y abre la ficha de esa tarjeta (Enter y Espacio hacen click en un boton)', FICHA + ' vs ' + k);
  quitarFicha();
  const dots = $$b6('#of-dots button');
  ok(!dots.some(d => d.getAttribute('role') === 'tab' || d.hasAttribute('aria-selected'))
     && $('of-dots').getAttribute('role') !== 'tablist',
     '[109] los puntitos ya no dicen ser pestañas sin panel');
  ok(dots.filter(d => d.getAttribute('aria-current') === 'true').length === 1
     && dots[ofIndice].getAttribute('aria-current') === 'true', '[109] el actual se marca con aria-current');
  /* El estilo dorado del actual se mira en la hoja de estilos y no en el ancho
     calculado: el ancho va con una transicion, y el Chrome sin ventana deja de
     dibujar cuadros despues de cargar, asi que a veces no avanzaba. */
  const reglas = [];
  const juntar = lista => [...lista].forEach(r => { if(r.selectorText) reglas.push(r.selectorText); if(r.cssRules) juntar(r.cssRules); });
  [...document.styleSheets].forEach(h => { try{ juntar(h.cssRules); }catch(e){} });
  ok(reglas.some(t => t.includes('.of-dots button[aria-current="true"]'))
     && !reglas.some(t => t.includes('.of-dots') && t.includes('aria-selected')),
     '[109] y sigue viendose distinto (el estilo dorado paso a aria-current)');
}

/* ---- [108] La vidriera: frenos por motivo ---- */
async function vidrieraConFrenos(){
  const caja = $('ofertas');
  pintarOfertas();
  if(OF.length < 2){ nota('[108] con menos de dos no gira'); return; }
  ofFrenos.clear();
  arrancarOfertas();
  ok(!!ofTimer, '[108] gira sola');
  caja.dispatchEvent(new MouseEvent('mouseenter'));
  ok(!!ofTimer, '[108] el mouseenter de compatibilidad (el que dispara un toque) ya no la frena para siempre');
  // El dedo: frena mientras toca y vuelve a los DESFILE_VUELVE ms de soltar
  caja.dispatchEvent(new Event('touchstart'));
  ok(!ofTimer, '[108] con el dedo encima se frena');
  caja.dispatchEvent(new Event('touchend'));
  await dormirB6(DESFILE_VUELVE + 500);
  ok(!!ofTimer, '[108] y despues de un deslizamiento con el dedo vuelve a girar sola');
  // El mouse encima: ni las flechas ni el refresco la hacen avanzar sola
  caja.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
  ok(!ofTimer, '[108] con el mouse encima se frena');
  /* En Chrome el clic en la flecha tambien la enfoca (29/09): .click() no lo
     hace, asi que se manda el focusin que llega con el clic de verdad. Ese
     foco no vino del teclado y no puede dejarla frenada al irse el mouse. */
  $('of-next').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  $('of-next').click();
  ok(!ofTimer, '[108] tocar la flecha con el mouse encima no la deja girando');
  pintarOfertas();
  ok(!ofTimer, '[108] el refresco tampoco');
  caja.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
  ok(!!ofTimer, '[108] al irse el mouse vuelve a girar', [...ofFrenos].join(',') || 'sin frenos');
  ok(!ofFrenos.has('foco'), '[108] el foco de un clic no la deja frenada', [...ofFrenos].join(',') || 'sin frenos');
  // Y el foco que llega con el teclado si la frena, hasta que se va
  $('of-next').focus({ preventScroll: true });
  if($('of-next').matches(':focus-visible')){
    ok(ofFrenos.has('foco') && !ofTimer, '[108] el foco del teclado la sigue frenando', [...ofFrenos].join(',') || 'sin frenos');
    $('of-next').blur();
    ok(!ofFrenos.size && !!ofTimer, '[108] y al irse el foco vuelve a girar', [...ofFrenos].join(',') || 'sin frenos');
  }else{
    $('of-next').blur();
    nota('[108] este Chrome no marca :focus-visible un foco puesto por script: no se prueba el del teclado');
  }
  pararOfertas();
}

/* ---- "+ Solo el S-Pen" no es un regalo (29/09) ----
   NOTAS_DEL_NOMBRE convierte "Incluye solo S-Pen" en incluye "+ Solo el
   S-Pen", y conRegalo contaba todo lo que empieza con "+": la Tab S10 FE Plus
   entraba a Destacados y dejaba afuera al iPhone 17 Pro Max. Lo que va en la
   vidriera lo decide Pedro, no una nota de caja. */
function vidrieraSinSolo(){
  const casos = [['+ Solo el S-Pen', false], ['+ Sólo el lápiz', false], ['+ Solo el lápiz', false],
                 ['Sin cargador', false], ['+ Lápiz', true], ['+ Funda + Solo el lápiz', true]];
  const mal = casos.filter(([t, e]) => conRegalo({ incluye: t }) !== e).map(([t]) => t);
  ok(!mal.length, '[18] "+ Solo el ..." no cuenta como regalo y "+ Funda + Solo el lapiz" si', mal.join(' | ') || casos.length + ' casos');
  // Uno en baja de verdad o pedido a mano por Pedro entra igual: eso no es por la nota
  const esSolo = m => /^\s*\+\s*s[oó]lo\b/i.test(m.incluye || '') && !enOferta(m)
                      && !m.variantes.some(v => VIDRIERA_FIJOS.includes(v.id));
  const conSolo = MODELOS.filter(esSolo);
  if(!conSolo.length){ nota('[18] hoy ningun producto trae "+ Solo ..." en incluye'); return; }
  pintarOfertas();
  const enVidriera = [...ofertas(), ...$$b6('#of-pista .of-slide').map(s => buscarModelo(s.dataset.key)).filter(Boolean)].filter(esSolo);
  ok(!enVidriera.length, '[18] ninguno con "+ Solo ..." entra a Destacados por su nota',
     enVidriera.map(m => m.desc).join(' | ') || conSolo.length + ' con "+ Solo" hoy, afuera');
  pararOfertas();
}

/* ---- [206] La vidriera dice el nombre de la tarjeta ---- */
function vidrieraConTitulo(){
  pintarOfertas();
  const mal = $$b6('#of-pista .of-slide').filter(s => {
    const m = buscarModelo(s.dataset.key);
    const tec = s.querySelector('.of-tec');
    return !m || s.querySelector('h3').textContent.trim() !== (m.titulo || m.desc).trim()
           || (m.tecnica ? !tec || tec.textContent.trim() !== m.tecnica : !!tec);
  });
  ok(!mal.length, '[206] cada tarjeta de la vidriera lleva el titulo y la linea tecnica de su tarjeta',
     mal.slice(0, 2).map(s => s.querySelector('h3').textContent).join(' | ') || $$b6('#of-pista .of-slide').length + ' tarjetas');
  volverALaPortada();
  filtros.cat = 'Celular'; pintar();
  const malS = $$b6('#sugeridos .sug').filter(b => { const m = buscarModelo(b.dataset.key);
    return !m || b.querySelector('b').textContent.trim() !== (m.titulo || m.desc).trim(); });
  ok(!malS.length, '[206] y "Te puede servir" tambien', malS.map(b => b.querySelector('b').textContent).join(' | ') || 'bien');
  volverALaPortada();
}

/* ---- [107] El numero del mosaico es el de adentro ---- */
function mosaicoCuentaLoDeAdentro(){
  volverALaPortada();
  const botones = $$b6('#mosaico .rubro').map(b => [b.dataset.cat, Number(b.querySelector('i').textContent)]);
  const mal = [];
  botones.forEach(([cat, n]) => {
    volverALaPortada();
    filtros.cat = cat; pintar();
    if(LISTA.length !== n) mal.push(cat + ': ' + n + ' vs ' + LISTA.length);
  });
  ok(!mal.length, '[107] cada rubro del mosaico dice lo mismo que la grilla al entrar', mal.slice(0, 3).join(' | ') || botones.length + ' rubros');
  volverALaPortada();
}

/* ---- [125] La cinta de la marca frena con el foco ---- */
async function cintaDeMarcaConFoco(){
  volverALaPortada();
  const sec = $('marcas-vitrina');
  sec.scrollIntoView({ block: 'center' });
  VIGIAS.get('marcas-vitrina')?.avisar?.(true);   // a la vista (ver [142])
  const des = sec.querySelector('.mv-desfile.anda');
  if(!des || quieto){ nota('[125] la marca de ahora no desfila'); scrollTo(0, 0); return; }
  const t = des.querySelector('.mv-p:not([aria-hidden="true"])');
  t.focus();
  ok(getComputedStyle(des).animationPlayState === 'paused', '[125] con el foco en una tarjeta, la cinta se frena',
     getComputedStyle(des).animationPlayState);
  t.blur();
  await dormirB6(100);
  ok(getComputedStyle(des).animationPlayState === 'running', '[125] y sigue al salir el foco (sin mouse encima)',
     getComputedStyle(des).animationPlayState);
  scrollTo(0, 0);
}

/* ---- [126] Con "reducir movimiento", la lista una sola vez ---- */
function cintaDeMarcaQuieta(){
  ok(/desfila\s*=\s*!quieto\b/.test(htmlPanelMarca.toString()),
     '[126] la copia de la cinta de la marca depende de que desfile, y con "reducir movimiento" no desfila');
  const x = MV.find(m => m.nuevos.length >= 6);
  if(x && !quieto){
    const d = document.createElement('div');
    d.innerHTML = htmlPanelMarca(x, false);
    ok(d.querySelectorAll('.mv-p[aria-hidden="true"]').length === x.nuevos.length,
       '[126] y cuando desfila, la copia sigue estando (sin ella la cinta corta)');
  }
}

/* ---- [136] Preguntas frecuentes: desplegables ---- */
function preguntasDesplegables(){
  volverALaPortada();
  const sec = $('ayuda');
  if(!sec){ nota('[136] no hay preguntas frecuentes'); return; }
  const ps = $$b6('#ayuda .ay-p');
  const mal = ps.filter(b => {
    const r = document.getElementById(b.getAttribute('aria-controls') || '-');
    return !b.hasAttribute('aria-expanded') || b.hasAttribute('aria-pressed') || !r
           || !r.classList.contains('ay-r') || r.dataset.ay !== b.dataset.ay;
  });
  ok(!mal.length, '[136] cada pregunta es un desplegable: aria-expanded y aria-controls hacia su respuesta',
     mal.map(b => b.dataset.ay).join(',') || ps.length + ' preguntas');
  const abiertas = ps.filter(b => b.getAttribute('aria-expanded') === 'true');
  ok(abiertas.length === 1 && Number(abiertas[0].dataset.ay) === ayIndice, '[136] una sola abierta, la que se ve');
  const otra = ps.find(b => b.getAttribute('aria-expanded') !== 'true');
  otra.click();
  ok(otra.getAttribute('aria-expanded') === 'true' && ps.filter(b => b.getAttribute('aria-expanded') === 'true').length === 1,
     '[136] tocar otra la abre y cierra la anterior');
  ok(getComputedStyle(otra, '::before').content !== 'none', '[136] y la abierta conserva su barrita (el CSS paso a aria-expanded)');
  ps[0].click();
}

/* ---- [115] La medicion ve las salidas a WhatsApp de la portada ---- */
async function medicionDeLaPortada(){
  const fetchBlob = window.fetch.bind(window);   // el de verdad, para leer los blob:
  volverALaPortada();
  const mandados = [];
  const beaconReal = navigator.sendBeacon, openReal = window.open;
  Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: (u, b) => { mandados.push(b); return true; } });
  window.open = () => null;
  const frenar = e => { if(e.target.closest && e.target.closest('a')) e.preventDefault(); };
  document.addEventListener('click', frenar);
  ANALITICA_URL = 'https://ejemplo.invalid/api/eventos';
  /* (29/09, revision) El Blob se lee con fetch() de un blob: y no con
     b.text(): el reloj virtual no espera a b.text() y la tanda salia "NO
     LLEGO A CORRER" de a ratos (lo explica pruebas/LEEME.txt y analitica.js,
     leerBolsa). Desde la 7.x eso frena PUBLICAR. */
  const leerBlob = async b => { const u = URL.createObjectURL(b);
                                try{ return await (await fetchBlob(u)).text(); } finally { URL.revokeObjectURL(u); } };
  const eventos = async () => { ANALITICA.mandar(); return (await Promise.all(mandados.map(leerBlob)))
                                  .flatMap(t => JSON.parse(t).eventos); };
  try{
    const otra = document.querySelector('#ayuda .ay-otra a');
    if(otra){
      otra.click();
      const e = (await eventos()).filter(x => x.t === 'whatsapp').pop();
      ok(e && e.desde === 'preguntas', '[115] "¿Te quedo otra duda?" se anota desde "preguntas"', JSON.stringify(e || {}));
    }else nota('[115] sin WhatsApp no hay link en las preguntas');
    const consultar = document.querySelector('#nuevos .nv-tarj.activa .nv-consultar') || document.querySelector('#nuevos .nv-consultar');
    if(consultar){
      consultar.click();
      const e = (await eventos()).filter(x => x.t === 'whatsapp').pop();
      const k = consultar.closest('.nv-tarj').dataset.key;
      ok(e && e.desde === 'nuevos' && e.id && buscarModelo(k) && buscarModelo(k).variantes.some(v => v.id === e.id),
         '[115] el "Consultar" de Recien llegados se anota desde "nuevos", con su producto', JSON.stringify(e || {}).slice(0, 120));
    }else nota('[115] hoy Recien llegados no tiene "Consultar"');
    const inp = $('pedilo-q'), bot = $('pedilo-btn');
    if(inp && bot){
      inp.value = 'Sony A7 IV'; inp.dispatchEvent(new Event('input', { bubbles: true }));
      bot.click();
      let e = (await eventos()).filter(x => x.t === 'pedilo');
      ok(e.length === 1 && e[0].q === 'Sony A7 IV', '[115] "¿Buscas algo que no esta?" se anota, con lo que pidio', JSON.stringify(e[0] || {}));
      inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      e = (await eventos()).filter(x => x.t === 'pedilo');
      ok(e.length === 2, '[115] tambien con Enter', e.length);
      inp.value = 'ab'; inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      e = (await eventos()).filter(x => x.t === 'pedilo');
      ok(e.length === 2, '[115] y con menos de 3 letras (que no manda nada) no se anota', e.length);
      inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }finally{
    ANALITICA_URL = '';
    document.removeEventListener('click', frenar);
    window.open = openReal;
    if(beaconReal) Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: beaconReal });
  }
}

/* ---- [114] Solo se piden los logos que existen ---- */
async function logosQueExisten(){
  volverALaPortada();
  const existe = async u => { try{ return (await fetch(u, { method: 'HEAD', cache: 'no-store' })).ok; }catch(e){ return false; } };
  const marcas = marcasParaLaFila().map(([m]) => m);
  const mal = [];
  for(const m of marcas){
    const hay = await existe(CARPETA_MARCAS + slugMarca(m) + '.png');
    if(hay !== hayLogo(m)) mal.push(m + (hay ? ': el archivo esta y no figura en LOGOS_MARCAS' : ': figura en LOGOS_MARCAS y no hay archivo'));
  }
  for(const s of LOGOS_MARCAS){
    if(!await existe(CARPETA_MARCAS + 'recortados/' + s + '.png')) mal.push(s + ': falta el recortado (herramientas/recortar-logos.py)');
  }
  ok(!mal.length, '[114] LOGOS_MARCAS coincide con los archivos de marcas/', mal.join(' | ') || marcas.length + ' marcas');
  const sinLogo = marcas.filter(m => !hayLogo(m));
  const pedidasSinArchivo = $$b6('#marcas-vitrina img, .fila-marcas img').filter(i => {
    const s = (i.getAttribute('src') || '') + ' ' + (i.dataset.orig || '');
    return sinLogo.some(m => s.includes('/' + slugMarca(m) + '.png'));
  });
  ok(!pedidasSinArchivo.length, '[114] a las marcas sin logo no se les pide ningun archivo (va su nombre)',
     sinLogo.join(', ') || 'todas tienen logo');
  // Los que pesan de mas, a la vista (no es falla: es para achicarlos)
  const pesos = [];
  for(const s of LOGOS_MARCAS){
    try{
      const r = await fetch(CARPETA_MARCAS + 'recortados/' + s + '.png', { cache: 'no-store' });
      const kb = (await r.arrayBuffer()).byteLength / 1024;
      if(kb > 15) pesos.push(s + ' ' + kb.toFixed(1) + ' KB');
    }catch(e){}
  }
  if(pesos.length) nota('[114] logos recortados de mas de 15 KB (se muestran de 30-48 px de alto): ' + pesos.join(', '));
}
