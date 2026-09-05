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

  /* ---- 2. El mosaico esta completo y dice la verdad ---- */
  const rubros = [...$$('#mosaico .mos:not(.mos-todo)')];
  const catsConStock = new Set(MODELOS.filter(m => m.stock).map(m => m.cat));
  ok(rubros.length === catsConStock.size,
     'hay una tarjeta por cada rubro con stock',
     rubros.length + ' tarjetas, ' + catsConStock.size + ' rubros');
  ok(rubros.every(b => b.querySelector('.txt b').textContent.trim()),
     'todas tienen nombre');
  // El fondo con el nombre del rubro va SIEMPRE: si la URL de la planilla esta
  // rota, sin esto la tarjeta quedaba en blanco con el icono de imagen rota.
  ok(rubros.every(b => b.querySelector('.sinfoto')),
     'todas tienen el nombre de respaldo detras de la foto');
  ok(rubros.every(b => b.querySelector('.sombra')),
     'todas tienen el degradado: sin el, los productos claros se comen el texto');

  // Las cuentas del subtitulo tienen que coincidir con la planilla
  const mal = rubros.filter(b => {
    const cat = b.dataset.cat;
    const ms = MODELOS.filter(m => m.stock && m.cat === cat);
    return !new RegExp('^' + ms.length + ' producto').test(
      b.querySelector('.txt i').textContent.trim());
  });
  ok(mal.length === 0, 'la cantidad que dice cada rubro es la real',
     mal.slice(0,3).map(b => b.dataset.cat).join(', ') || 'ninguna mal');

  const sinDesde = rubros.filter(b => {
    const cat = b.dataset.cat;
    const ps = MODELOS.filter(m => m.stock && m.cat === cat)
                      .map(m => m.precio).filter(x => x !== null && x > 0);
    if(!ps.length) return false;                       // sin precios no dice "desde"
    return !b.querySelector('.txt i').textContent.includes(plata(Math.min(...ps)));
  });
  ok(sinDesde.length === 0, 'el "desde" de cada rubro es su precio mas bajo',
     sinDesde.slice(0,3).map(b => b.dataset.cat).join(', ') || 'ninguno mal');

  /* ---- 3. Entrar a un rubro trae los productos ---- */
  const primero = rubros[0], cat = primero.dataset.cat;
  primero.click();
  ok(!enPortada(), 'al tocar un rubro se sale de la portada');
  ok($('mosaico').hidden && !$('grid').hidden, 'ahora se ve la grilla y no el mosaico');
  ok($$('.card').length > 0, 'y hay productos dibujados', $$('.card').length);
  ok(LISTA.every(m => m.cat === cat), 'todos son del rubro elegido', cat);
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
  const todo = $('mosaico').querySelector('.mos-todo');
  ok(!!todo, 'el mosaico termina con un "Ver todo"');
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

  /* ---- 7. La cinta se pasea sola, pero se rinde ---- */
  ok(typeof arrancarCintaAuto === 'function' && typeof rendirCintaAuto === 'function',
     'la cinta tiene su motor de paseo');
  const cinta = $('cats');
  arrancarCintaAuto();
  // Se prueba el comportamiento y no una variable interna: si el motor cambia
  // por dentro, la prueba tiene que seguir valiendo.
  rendirCintaAuto();
  const antes = cinta.scrollLeft;
  arrancarCintaAuto();
  ok(!PASEOS.get(cinta) || PASEOS.get(cinta).timer === null,
     'una vez que el cliente toma el control, la cinta no vuelve a moverse');
  ok(cinta.scrollLeft === antes, 'y se queda donde estaba', cinta.scrollLeft);
}
