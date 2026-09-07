// Pruebas del carrusel de ofertas. Se prueban los dos modos: con la columna
// "Oferta" cargada (lo normal cuando Pedro la complete) y sin ella (el
// respaldo de hoy, que muestra los que tienen regalo).
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };

const esperar = setInterval(() => {
  if(!MODELOS.length) return;
  // La portada muestra los rubros, no los productos. Para probar la grilla hay
  // que pedirla, igual que hace el cliente cuando toca "Ver todo".
  verTodoElCatalogo();
  if(!document.querySelectorAll('.card').length) return;
  clearInterval(esperar);
  for(let i=1;i<5000;i++) clearInterval(i);
  try{ correrPruebas(); }catch(e){ R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; }
  // Las pruebas vuelven a pintar, y cada pintado reengancha los paseos de las
  // pistas y el carrusel. Si queda alguno vivo, con el reloj acelerado del
  // headless el navegador no cierra nunca y la tanda figura como que no llego
  // a correr. Se frena todo DESPUES de correr, no antes.
  try{ pararPaseos(); }catch(e){}
  try{ pararOfertas(); }catch(e){}
  for(let i=1;i<5000;i++) clearInterval(i);

  const pre=document.createElement('pre'); pre.id='RESULTADO';
  pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
  document.body.appendChild(pre);
}, 150);

function correrPruebas(){
  /* Los productos fijados a mano llenan la vidriera y taparian el mecanismo que
     se quiere probar. Se apartan y se reponen al final: la tanda tiene que
     valer igual el dia que haya ocho fijos que el dia que no haya ninguno. */
  const FIJOS_DEL_DIA = [...VIDRIERA_FIJOS];
  VIDRIERA_FIJOS.length = 0;
  try{ pruebasDelCarrusel(); }
  finally{ VIDRIERA_FIJOS.push(...FIJOS_DEL_DIA); pintarOfertas(); }
}

function pruebasDelCarrusel(){
  const caja = $('ofertas');
  const slides = () => [...document.querySelectorAll('.of-slide')];

  /* ---- 1. Sin columna Oferta: el respaldo ---- */
  MODELOS.forEach(m => { m.antes = null; if(m.rep) m.rep.antes = null; });
  pintarOfertas();
  ok(!caja.hidden, 'sin precios anteriores igual se muestra algo');
  ok($('of-rotulo').textContent === 'Destacados',
     'y se llama "Destacados", no "Ofertas"', $('of-rotulo').textContent);
  const conRegaloVisible = slides().map(s => buscarModelo(s.dataset.key));
  ok(conRegaloVisible.every(m => /^\s*\+|🎁/.test(m.incluye || '')),
     'todos los que aparecen tienen un regalo cargado');
  ok(slides().every(s => !s.querySelector('.of-off')),
     'sin precio anterior no se marca ninguno como oferta');
  // "Sin cargador" vive en la misma columna y NO es un beneficio
  ok(conRegaloVisible.every(m => !/^sin /i.test((m.incluye||'').trim())),
     'no entra ningun "Sin cargador" como si fuera un regalo');

  /* ---- 2. Con la columna cargada ---- */
  const elegidos = MODELOS.filter(m => m.stock && m.precio !== null && m.imagen).slice(0, 4);
  const pcts = [0.25, 0.15, 0.40, 0.10];
  elegidos.forEach((m,i) => { const a = Math.round(m.precio/(1-pcts[i])); m.antes = a; m.rep.antes = a; });
  pintarOfertas();

  /* La vidriera se llena hasta OFERTAS_MAX: primero los que bajaron y, si
     faltan, los que tienen regalo. Por eso el rotulo dice "Ofertas" SOLO
     cuando todos los que se ven estan en baja; con la mezcla dice
     "Destacados", que es lo unico honesto. */
  const enPantalla = () => slides().map(s => buscarModelo(s.dataset.key));
  const enBaja = () => enPantalla().filter(enOferta);

  ok(enBaja().length === elegidos.length,
     'los que estan en promocion aparecen todos', enBaja().length + ' de ' + elegidos.length);
  ok(elegidos.every(m => enPantalla().includes(m)),
     'y son exactamente los que se marcaron');
  ok($('of-rotulo').textContent === (enPantalla().every(enOferta) ? 'Ofertas' : 'Destacados'),
     'el rotulo dice lo que de verdad hay', $('of-rotulo').textContent);
  // Como maximo dos del mismo rubro, para que la vidriera muestre variedad
  const porRubro = {};
  enPantalla().forEach(m => porRubro[m.cat] = (porRubro[m.cat] || 0) + 1);
  const amontonados = Object.entries(porRubro).filter(([, n]) => n > POR_RUBRO_MAX);
  ok(amontonados.length === 0 || Object.keys(porRubro).length === 1,
     'no se amontonan mas de ' + POR_RUBRO_MAX + ' del mismo rubro',
     Object.entries(porRubro).map(([c, n]) => c + ':' + n).join(' '));
  /* La etiqueta ya no dice cuanto bajo: en este rubro las bajas son chicas y
     un "4% OFF" resta mas de lo que suma. Queda el precio tachado al lado. */
  // Se miran solo las que estan en baja: las de relleno no llevan etiqueta
  const enBajaSlides = slides().filter(s => enOferta(buscarModelo(s.dataset.key)));
  const conNumero = enBajaSlides.filter(s => {
    const off = s.querySelector('.of-off');
    return !off || /\d/.test(off.textContent);
  });
  ok(conNumero.length === 0, 'la etiqueta dice "Oferta", sin ningun numero',
     enBajaSlides.map(s => s.querySelector('.of-off') && s.querySelector('.of-off').textContent).join(' '));
  ok(enBajaSlides.every(s => s.querySelector('.of-precio s')),
     'las que bajaron muestran el precio tachado');
  ok(slides().filter(s => !enOferta(buscarModelo(s.dataset.key)))
             .every(s => !s.querySelector('.of-off')),
     'y las de relleno no se disfrazan de oferta');
  // El mas descontado primero: es lo que conviene mostrar de entrada
  const offs = enBajaSlides.map(s => { const m = buscarModelo(s.dataset.key);
    return Math.round((1 - m.precio/m.antes)*100); });
  ok(offs.every((o,i) => i===0 || offs[i-1] >= o), 'ordenados de mayor a menor descuento',
     offs.join(' > '));

  /* ---- 3. Un precio anterior mas barato no es una oferta ---- */
  const m0 = elegidos[0], guardado = m0.antes;
  m0.antes = m0.precio - 50; m0.rep.antes = m0.antes;
  pintarOfertas();
  // Puede seguir en la vidriera como relleno, pero NUNCA como oferta
  const sl = slides().find(s => s.dataset.key === clave(m0.rep));
  ok(!sl || !sl.querySelector('.of-off'),
     'si el "antes" es MENOR que el precio de hoy, no se muestra como oferta');
  ok(!sl || !sl.querySelector('.of-precio s'), 'ni se le tacha ningun precio');
  m0.antes = guardado; m0.rep.antes = guardado;
  pintarOfertas();

  /* ---- 4. Los controles ---- */
  ok(document.querySelectorAll('.of-dots button').length === slides().length,
     'hay un puntito por oferta');
  const i0 = ofIndice;
  $('of-next').click();
  ok(ofIndice === i0 + 1, 'la flecha siguiente avanza', i0 + ' -> ' + ofIndice);
  $('of-prev').click();
  ok(ofIndice === i0, 'y la anterior vuelve');
  // Da la vuelta en la punta
  irOferta(slides().length - 1); $('of-next').click();
  ok(ofIndice === 0, 'al final vuelve al principio');
  // Los puntitos llevan a su oferta
  document.querySelectorAll('.of-dots button')[2]?.click();
  ok(ofIndice === 2, 'tocar un puntito lleva a esa oferta', ofIndice);

  /* ---- 5. Gira solo, pero se frena ---- */
  arrancarOfertas();
  ok(!!ofTimer, 'gira solo');
  /* Tiene que girar TAMBIEN con "reducir movimiento" puesto. Estaba atado a
     esa opcion de Windows y quedaba congelado sin que se notara por que: esa
     preferencia pide no animar, no dejar la vidriera quieta. */
  ok(!/\bquieto\b/.test(arrancarOfertas.toString()),
     'el giro no depende de "reducir movimiento"');
  ok(/\bquieto\b/.test(irOferta.toString()),
     'pero el deslizamiento suave si: con la opcion puesta cambia de golpe');
  caja.dispatchEvent(new MouseEvent('mouseenter'));
  ok(!ofTimer, 'se frena al pasar el mouse por arriba');
  caja.dispatchEvent(new MouseEvent('mouseleave'));
  ok(!!ofTimer, 'y vuelve a girar cuando te vas');

  /* ---- 6. Donde esta parado ---- */
  const rOf = caja.getBoundingClientRect();
  const rGrid = document.querySelector('.grid').getBoundingClientRect();
  const rCats = document.querySelector('.barra-cats').getBoundingClientRect();
  ok(rOf.top < rGrid.top, 'el carrusel va ARRIBA del catalogo',
     `carrusel y=${Math.round(rOf.top+scrollY)}, catalogo y=${Math.round(rGrid.top+scrollY)}`);
  ok(rOf.top < rCats.top, 'y arriba de la barra de categorias');
  ok(rOf.width <= innerWidth + 1, 'no se va de ancho', Math.round(rOf.width) + ' de ' + innerWidth);

  /* ---- 7. Tocar una oferta abre su ficha ---- */
  const s0 = slides()[0], k = s0.dataset.key;
  s0.click();
  const d = document.getElementById('ficha');
  ok(!!d, 'tocar una oferta abre la ficha');
  ok(d && FICHA === k, 'la del producto que tocaste', FICHA + ' vs ' + k);
  if(d) cerrarFicha();

  /* ---- 8. Sin nada para mostrar, no queda un hueco ---- */
  MODELOS.forEach(m => { m.antes = null; if(m.rep) m.rep.antes = null; });
  const incGuardado = MODELOS.map(m => m.incluye);
  MODELOS.forEach(m => { m.incluye = ''; });
  pintarOfertas();
  ok(caja.hidden, 'sin ofertas ni destacados, el carrusel no aparece');
  MODELOS.forEach((m,i) => { m.incluye = incGuardado[i]; });
  pintarOfertas();

  /* Se apaga antes de terminar. Si queda girando, con el reloj virtual del
     headless el auto-play dispara decenas de scrolls animados y Chrome no
     llega a cerrar dentro del tiempo que le da el runner. */
  pararOfertas();

    /* ---- 5. Los que se piden a mano ---- */
  ok(Array.isArray(VIDRIERA_FIJOS), 'hay una lista de fijos para la vidriera');
  const candidato = MODELOS.find(m => m.stock && m.precio !== null && m.imagen
                                   && !enOferta(m));
  VIDRIERA_FIJOS.push(candidato.rep.id);
  pintarOfertas();
  ok(slides().some(s => buscarModelo(s.dataset.key) === candidato),
     'un producto puesto a mano entra a la vidriera', candidato.desc.slice(0, 34));
  ok(slides()[0] && buscarModelo(slides()[0].dataset.key) === candidato,
     'y va primero, antes que las bajas automaticas');
  VIDRIERA_FIJOS.length = 0;
  pintarOfertas();
}
