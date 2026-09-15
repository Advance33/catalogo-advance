// Verifica el layout en tres anchos usando iframes: la ventana minima de
// Chrome en Windows es ~485px, asi que 390 "de verdad" solo se ve asi.
const R = [];
let fallas = 0;
const ok = (c, t, x) => { R.push((c?'  OK  ':'FALLA ') + t + (x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };

const ANCHOS = [390, 900, 1440, 1920];
let i = 0;

function probar(){
  if(i >= ANCHOS.length){
    const pre = document.createElement('pre');
    pre.id = 'RESULTADO';
    pre.textContent = '\n===== ' + (fallas ? fallas + ' FALLA(S)' : 'TODO OK') + ' =====\n' + R.join('\n');
    document.body.appendChild(pre);
    return;
  }
  const w = ANCHOS[i++];
  const f = document.createElement('iframe');
  f.style.cssText = `width:${w}px;height:900px;border:0;position:absolute;left:-9999px`;
  f.src = 'index.html';
  document.body.appendChild(f);
  /* El carrusel de cada copia se apaga apenas carga: son cuatro catalogos
     enteros a la vez y, con el reloj acelerado del headless, cuatro
     auto-plays deslizandose hacen que Chrome no llegue a terminar. */
  f.onload = () => {
    try{ f.contentWindow.pararOfertas?.(); }catch{}
    try{ f.contentWindow.pararPaseos?.(); }catch{}
    setTimeout(() => {
      try{ f.contentWindow.pararOfertas?.(); }catch{}
    try{ f.contentWindow.pararPaseos?.(); }catch{}
      // La portada muestra rubros: lo que se mide aca es el layout de la
      // grilla, asi que hay que pedirla como la pide el cliente.
      try{ f.contentWindow.verTodoElCatalogo?.(); }catch{}
      medir(f, w); f.remove(); probar();
    }, 3500);
  };
}

function medir(f, w){
  const d = f.contentDocument, win = f.contentWindow;
  const q = s => d.querySelector(s);
  const cs = el => win.getComputedStyle(el);
  R.push(`\n--- ${w}px ${w <= 760 ? '(celular: lo fijo sin banner)' : '(compu: lo fijo con banner)'} ---`);

  const cols = q('.columnas'), chips = q('#cats'), grid = q('.grid');
  const rGrid = grid.getBoundingClientRect(), rChips = q('#cats-wrap').getBoundingClientRect();

  /* Desde el 15/09/2026 no hay columna de filtros: cada vista de productos abre
     con su encabezado (nombre, marcas, Ordenar y Filtrar) y la grilla usa todo
     el ancho, en cualquier tamaño de pantalla. */
  const cab = q('#rubro-cab');
  ok(!q('.toolbar'), 'no queda la columna de filtros de antes');
  ok(cols && cs(cols).display !== 'grid', 'el cuerpo es una sola columna', cols && cs(cols).display);
  ok(cs(chips).flexDirection === 'row', 'las categorias siguen en cinta horizontal', cs(chips).flexDirection);
  ok(cab && !cab.hidden && cs(cab).display !== 'none', 'se ve el encabezado de la vista');
  if(cab && !cab.hidden){
    const rCab = cab.getBoundingClientRect();
    ok(rChips.top < rCab.top && rCab.bottom <= rGrid.top + 1, 'la cinta arriba, despues el encabezado y despues la grilla',
       `cinta ${Math.round(rChips.top)}, encabezado ${Math.round(rCab.top)}-${Math.round(rCab.bottom)}, grilla ${Math.round(rGrid.top)}`);
    ok(Math.abs(rCab.left - rGrid.left) < 2 && Math.abs(rCab.width - rGrid.width) < 2,
       'la grilla usa el mismo ancho que el encabezado: no hay nada al costado',
       `encabezado ${Math.round(rCab.width)}px, grilla ${Math.round(rGrid.width)}px`);
    ok(/catálogo/i.test(cab.querySelector('h2').textContent), 'dice que es el catalogo entero', cab.querySelector('h2').textContent);
    ok(q('#count') && /producto/.test(q('#count').textContent), 'con la cantidad', q('#count') && q('#count').textContent);
    const filtrar = cab.querySelector('.filtrar-btn'), orden = cab.querySelector('.orden-btn');
    ok(filtrar && filtrar.getBoundingClientRect().width > 40, 'el boton Filtrar se ve');
    ok(orden && /Ordenar/.test(orden.textContent), 'y Ordenar va aparte y lo dice', orden && orden.textContent.trim());
  }
  ok(cs(q('.seccion')).display === 'none', 'el titulo "Elegí un rubro" es solo de la portada');
  // Lo fijo: en la compu es el encabezado en chico; en el celular, sin el banner
  const tit = q('#rubro-fijo .rf-tit');
  if(tit) ok((cs(tit).display === 'none') === (w <= 760),
             w <= 760 ? 'en el celular lo fijo va sin el banner: solo marcas y botones'
                      : 'en la compu lo fijo es el banner en chico, con el nombre', cs(tit).display);

  // Las recomendaciones van siempre al final de la grilla, nunca antes
  const sug = q('#sugeridos');
  ok(!!sug && !sug.hidden, 'el bloque de recomendaciones esta a la vista');
  if(sug && !sug.hidden){
    const rSug = sug.getBoundingClientRect();
    ok(sug.querySelectorAll('.sug').length > 0, 'con productos adentro', sug.querySelectorAll('.sug').length);
    ok(sug.closest('main') !== null && rSug.top > rGrid.top, 'y va DESPUES de los productos',
       `sugeridos en ${Math.round(rSug.top)}, grilla desde ${Math.round(rGrid.top)}`);
    ok(win.getComputedStyle(sug).display !== 'none', 'y visible de verdad');
  }

  // Nada se desborda a lo ancho en ningun tamaño
  ok(d.documentElement.scrollWidth <= w + 1, 'la pagina no se va de ancho',
     d.documentElement.scrollWidth + ' vs ' + w);
  const cards = [...d.querySelectorAll('.card')];
  ok(cards.length > 0, 'hay tarjetas dibujadas', cards.length);
  const anchoCard = Math.round(cards[0].getBoundingClientRect().width);
  const porFila = cards.filter(c => Math.abs(c.getBoundingClientRect().top - cards[0].getBoundingClientRect().top) < 4).length;
  R.push(`       ${porFila} tarjetas por fila, de ${anchoCard}px`);

  // El nombre y el precio tienen que tener ancho de verdad (el bug de .cuerpo)
  const n = cards[0].querySelector('.nombre'), pr = cards[0].querySelector('.usd');
  ok(n && n.getBoundingClientRect().width > 60, 'el nombre del producto se ve',
     n ? Math.round(n.getBoundingClientRect().width) + 'px' : 'no esta');
  ok(pr && pr.getBoundingClientRect().width > 30, 'el precio se ve',
     pr ? Math.round(pr.getBoundingClientRect().width) + 'px' : 'no esta');

  // Las categorias son una cinta horizontal en TODOS los anchos: ahi arrastrar
  // tiene que cancelar el clic, que es para lo que se hizo. Las marcas, en
  // cambio, son lista vertical en la columna: ahi mover el mouse no debe
  // comerse el clic.
  const gesto = (chip, dx) => {
    const ev = (t, x) => chip.dispatchEvent(new win.PointerEvent(t,
      {bubbles:true, clientX:x, clientY:10, button:0, pointerType:'mouse'}));
    ev('pointerdown', 10); ev('pointermove', 10+dx); ev('pointerup', 10+dx);
    chip.click();
  };
  const chips2 = [...d.querySelectorAll('#cats .chip')];
  const cel = chips2.find(b => b.dataset.cat === 'Celular');
  const todo = chips2.find(b => b.dataset.cat === '');
  if(cel && todo){
    const antes = d.querySelectorAll('.card').length;
    gesto(cel, 2);
    const conClic = d.querySelectorAll('.card').length;
    ok(cel.getAttribute('aria-pressed') === 'true' && conClic !== antes,
       'un clic normal elige la categoria', antes + ' -> ' + conClic + ' tarjetas');

    gesto(todo, 16);
    ok(d.querySelectorAll('.card').length === conClic,
       'arrastrar la cinta NO cambia de categoria (a proposito)');

    // Con Celulares puesto aparecen las marcas en el encabezado, y filtran
    cel.click();
    const marcas = [...d.querySelectorAll('#rubro-cab .marca-chip')];
    ok(marcas.length > 1, 'adentro de Celulares el encabezado trae las marcas', marcas.length);
    if(marcas.length > 1){
      const antesM = d.querySelectorAll('.card').length;
      d.querySelectorAll('#rubro-cab .marca-chip')[1].click();
      ok(d.querySelectorAll('.card').length !== antesM, 'tocar una marca filtra',
         antesM + ' -> ' + d.querySelectorAll('.card').length + ' tarjetas');
      d.querySelector('#rubro-cab .marca-chip[data-marca=""]').click();
    }
    todo.click();
  }
}
probar();
