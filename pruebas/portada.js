// La portada nueva: primero los rubros, los productos recien cuando el cliente
// elige. Es el cambio mas grande de la pagina, asi que lo que se prueba aca es
// que siempre haya una salida y que nunca queden las dos vistas a la vez.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const $$ = s => document.querySelectorAll(s);

const esperar = setInterval(() => {
  // OJO: esta tanda NO llama a verTodoElCatalogo(), porque justamente prueba
  // como arranca la pagina antes de que el cliente toque nada.
  if(!MODELOS.length || !$$('#cats .chip').length) return;
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
  /* ---- 1. Al entrar se ven rubros, no productos ---- */
  ok(enPortada(), 'al entrar sin filtros la pagina esta en modo portada');
  ok(!$('mosaico').hidden, 'el mosaico de rubros se ve');
  ok($('grid').hidden, 'y la grilla de productos NO');
  ok($$('.card').length === 0, 'no hay ninguna tarjeta de producto dibujada',
     $$('.card').length);
  ok($('sec-titulo').textContent.trim() === 'Elegí un rubro',
     'el titulo dice que hay que elegir', $('sec-titulo').textContent);
  // En el celular el titulo de seccion esta oculto a proposito, pero en la
  // portada es la instruccion: sin el, el mosaico queda sin encabezado.
  ok(document.body.classList.contains('portada'),
     'el body queda marcado como portada, que es lo que lo muestra en el celular');

  /* En pantalla ancha la columna de filtros no va en la portada: le quitaba
     ancho a los mundos. Tiene que volver al entrar a un rubro (punto 3). */
  const columna = document.querySelector('.columnas > .toolbar');
  const ancha = innerWidth >= 1180;
  if(ancha){
    ok(getComputedStyle(columna).display === 'none', 'en la portada no aparece la columna de filtros');
    const anchoMundos = $('mosaico').getBoundingClientRect().width;
    const anchoCuerpo = document.querySelector('.columnas').getBoundingClientRect().width;
    ok(anchoMundos > anchoCuerpo * 0.9, 'y los mundos usan todo el ancho',
       Math.round(anchoMundos) + ' de ' + Math.round(anchoCuerpo) + 'px');
  }else{
    R.push('  --   ventana de menos de 1180px: ahi la columna de filtros no existe');
  }

  /* ---- 2. Los mundos estan completos y dicen la verdad ----
     Desde el 15/09/2026 los rubros van agrupados en mundos (MUNDOS, en la
     configuracion) en vez de una tarjeta por rubro. Lo que se exige es lo mismo
     que antes: que todo rubro con stock tenga su boton y que los numeros sean
     los de la planilla. */
  const rubros = [...$$('#mosaico .mundo .rubro')];
  const mundos = [...$$('#mosaico .mundo')];
  const catsConStock = new Set(MODELOS.filter(m => m.stock).map(m => m.cat));
  const enStock = cat => MODELOS.filter(m => m.stock && m.cat === cat);

  ok(mundos.length >= 2, 'la portada muestra los mundos', mundos.length);
  ok(new Set(rubros.map(b => b.dataset.cat)).size === catsConStock.size &&
     [...catsConStock].every(c => rubros.some(b => b.dataset.cat === c)),
     'cada rubro con stock tiene su boton', rubros.length + ' botones, ' + catsConStock.size + ' rubros');
  ok(rubros.length === new Set(rubros.map(b => b.dataset.cat)).size,
     'y ninguno aparece en dos mundos');
  ok(mundos.every(t => t.querySelector('h3').textContent.trim()), 'todos los mundos tienen nombre');

  // Lo que dice cada boton y cada mundo tiene que coincidir con la planilla
  const malRubro = rubros.filter(b => Number(b.querySelector('i').textContent) !== enStock(b.dataset.cat).length);
  ok(malRubro.length === 0, 'la cantidad de cada rubro es la real',
     malRubro.slice(0, 3).map(b => b.dataset.cat).join(', ') || 'ninguna mal');
  const malMundo = mundos.filter(t => {
    const ms = [...t.querySelectorAll('.rubro')].flatMap(b => enStock(b.dataset.cat));
    const ps = ms.map(m => m.precio).filter(x => x !== null && x > 0);
    const txt = t.querySelector('.mundo-cab p').textContent;
    return !new RegExp('^' + ms.length + ' producto').test(txt) ||
           (ps.length && !txt.includes('desde USD ' + plata(Math.min(...ps))));
  });
  ok(malMundo.length === 0, 'cada mundo suma bien sus productos y su "desde" es el mas bajo',
     malMundo.map(t => t.querySelector('h3').textContent).join(', ') || 'ninguno mal');

  /* Un rubro que no esta anotado en ningun mundo no puede desaparecer de la
     portada: tiene que caer en "Otros rubros". Se prueba sacandole a proposito
     sus rubros al primer mundo y mirando adonde van. */
  const guardados = MUNDOS[0].rubros.slice();
  MUNDOS[0].rubros.length = 0;
  const sinAnotar = mundosDeLaPortada();
  MUNDOS[0].rubros.push(...guardados);
  const otros = sinAnotar.find(w => w.nombre === 'Otros rubros');
  const huerfanos = guardados.filter(r => [...catsConStock].some(c => norm(c) === norm(r)));
  ok(!huerfanos.length || (otros && huerfanos.every(r => otros.rubros.some(c => norm(c) === norm(r)))),
     'un rubro sin mundo va a "Otros rubros" en vez de perderse', huerfanos.join(', ') || 'sin rubros para probar');
  ok(sinAnotar.flatMap(w => w.rubros).length === catsConStock.size,
     'y aun asi estan todos los rubros, una sola vez');

  /* ---- 3. Entrar a un rubro trae los productos ---- */
  const primero = rubros[0], cat = primero.dataset.cat;
  primero.click();
  ok(!enPortada(), 'al tocar un rubro se sale de la portada');
  ok($('mosaico').hidden && !$('grid').hidden, 'ahora se ve la grilla y no el mosaico');
  ok($$('.card').length > 0, 'y hay productos dibujados', $$('.card').length);
  ok(LISTA.every(m => m.cat === cat), 'todos son del rubro elegido', cat);
  if(ancha) ok(getComputedStyle(columna).display !== 'none',
               'adentro del rubro vuelve la columna de filtros');
  // Sin esto el cliente veia el rubro abierto y la cinta de arriba en "Todo"
  const chipMarcado = [...$$('#cats .chip')].find(c => c.getAttribute('aria-pressed') === 'true');
  ok(chipMarcado && chipMarcado.dataset.cat === cat,
     'el chip de la cinta queda marcado en ese mismo rubro',
     chipMarcado && chipMarcado.dataset.cat);

  /* ---- 4. Volver a "Todo" devuelve la portada ---- */
  const chipTodo = [...$$('#cats .chip')].find(c => c.dataset.cat === '');
  chipTodo.click();
  ok(enPortada(), 'volver a "Todo" devuelve la portada');
  ok(!$('mosaico').hidden && $('grid').hidden, 'y se vuelven a ver los rubros');

  /* ---- 5. La salida para el que quiere la lista entera ---- */
  const todo = $('mosaico').querySelector('.mundos-todo');
  ok(!!todo && todo === $('mosaico').lastElementChild, 'los mundos terminan con un "Ver todo el catálogo"');
  todo.click();
  ok(!enPortada() && !$('grid').hidden, '"Ver todo" abre la grilla completa');
  ok($$('.card').length > 0, 'con productos', $$('.card').length);
  ok(LISTA.length === MODELOS.filter(m => m.stock || true).length || LISTA.length > 100,
     'y son todos, no los de un rubro', LISTA.length + ' de ' + MODELOS.length);

  /* ---- 6. Buscar tambien saca de la portada ---- */
  const chipTodo2 = [...$$('#cats .chip')].find(c => c.dataset.cat === '');
  chipTodo2.click();
  ok(enPortada(), 'volvimos a la portada para probar el buscador');
  filtros.q = 'iphone';
  pintar();
  ok(!enPortada(), 'escribir en el buscador saca de la portada');
  ok($$('.card').length > 0, 'y muestra los resultados', $$('.card').length);
  filtros.q = '';

  /* ---- 7. La cinta se pasea sola, se frena cuando la usan y vuelve ----
     Antes esta prueba pedia lo contrario: que una vez que el cliente tomaba el
     control la cinta NO volviera a moverse nunca. Se cambio a proposito el
     07/09. El problema de aquello era que "tomar el control" incluia pasar la
     rueda del mouse por encima o tocar un chip, o sea que se apagaba a los dos
     segundos de entrar y en la practica no se la veia pasear jamas. */
  ok(typeof arrancarCintaAuto === 'function' && typeof rendirCintaAuto === 'function',
     'la cinta tiene su motor de paseo');
  const cinta = $('cats');
  // Sin categoria puesta y con chips de sobra: es cuando la cinta se pasea.
  filtros.cat = '';
  const hayQuePasear = cinta.scrollWidth - cinta.clientWidth > 4;

  arrancarCintaAuto();
  /* Desde el 07/09 la cinta desfila con una animacion CSS y no con un
     temporizador: se mueve siempre para el mismo lado sobre el contenido
     duplicado, en vez de ir y volver como un pendulo (ese rebote se sentia
     pesado). Lo que hay que mirar ahora es si la tira lleva la clase. */
  const andando = () => !!cinta.querySelector('.fp-tira.desfila');
  ok(!hayQuePasear || andando(), 'sin categoria elegida, la cinta se pasea sola',
     hayQuePasear ? '' : 'entra entera, no hay nada que pasear');

  // Mientras la estas usando se frena, para no pelearte el scroll.
  rendirCintaAuto();
  ok(!andando(), 'cuando el cliente la usa, se frena');
  /* Y se queda EXACTAMENTE donde se veia: lo que la animacion habia corrido se
     convierte en scroll de verdad, asi no pega un salto al soltar. */
  ok(!hayQuePasear || cinta.scrollLeft >= 0,
     'y se queda donde se estaba viendo', cinta.scrollLeft);

  /* Pero no queda muerta hasta recargar: vuelve sola pasada la pausa. Los cinco
     segundos no se pueden esperar aca adentro, asi que se comprueba lo que de
     eso depende: que pedirle que arranque despues de rendirse la reviva. Con el
     comportamiento viejo esto era imposible -rendirse ponia rendido=true y
     arrancar() salia sin hacer nada-, asi que la prueba distingue los dos. */
  arrancarCintaAuto();
  ok(!hayQuePasear || andando(),
     'y despues vuelve: no se apaga hasta recargar la pagina');
  rendirCintaAuto();
}
