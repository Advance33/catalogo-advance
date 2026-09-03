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
    setTimeout(() => {
      try{ f.contentWindow.pararOfertas?.(); }catch{}
      medir(f, w); f.remove(); probar();
    }, 3500);
  };
}

function medir(f, w){
  const d = f.contentDocument, win = f.contentWindow;
  const q = s => d.querySelector(s);
  const cs = el => win.getComputedStyle(el);
  const lateral = w >= 1180;
  R.push(`\n--- ${w}px ${lateral ? '(columna al costado)' : '(barra arriba)'} ---`);

  const cols = q('.columnas'), chips = q('#cats'), grid = q('.grid');
  const rGrid = grid.getBoundingClientRect(), rChips = q('#cats-wrap').getBoundingClientRect();

  if(lateral){
    ok(cs(cols).display === 'grid', 'el cuerpo es de dos columnas', cs(cols).display);
    ok(cs(chips).flexDirection === 'row', 'las categorias siguen siendo una cinta horizontal', cs(chips).flexDirection);
    ok(rChips.top < rGrid.top, 'la cinta de categorias esta ARRIBA de la grilla',
       `cinta ${Math.round(rChips.top)}, grilla ${Math.round(rGrid.top)}`);
    const rTool = q('.toolbar').getBoundingClientRect();
    ok(rTool.right <= rGrid.left + 1, 'los filtros quedan a la izquierda de la grilla',
       `filtros hasta ${Math.round(rTool.right)}, grilla desde ${Math.round(rGrid.left)}`);
    ok(rTool.height < 520, 'la columna es corta: no necesita scroll propio',
       Math.round(rTool.height) + 'px de alto');
    ok(q('.seccion') && cs(q('.seccion')).display !== 'none' && q('#sec-titulo').textContent.trim().length > 3,
       'hay titulo de seccion', q('#sec-titulo') && q('#sec-titulo').textContent);
    ok(q('#sec-count') && /producto/.test(q('#sec-count').textContent), 'con el conteo al lado',
       q('#sec-count') && q('#sec-count').textContent);
    ok(cs(q('#marcas-wrap .rotulo') || q('.rotulo')).display !== 'none', 'se ven los rotulos de cada bloque');
    ok(cs(q('#precio')).display !== 'none', 'los filtros estan a la vista sin desplegar');
    ok(cs(q('#filtros-btn')).display === 'none', 'el boton Filtros no hace falta');
    ok(cs(q('.toolbar')).position === 'sticky', 'la columna acompaña el scroll');
    // El aire de los costados: lo que sobra a cada lado de todo el contenido
    const sobra = Math.round((w - cols.getBoundingClientRect().width) / 2);
    ok(sobra < 140, 'no quedan lados vacios grandes', sobra + 'px por lado');
  } else {
    ok(cs(cols).display === 'block', 'el cuerpo vuelve a ser una sola columna', cs(cols).display);
    ok(cs(chips).flexDirection === 'row', 'las categorias siguen en cinta horizontal', cs(chips).flexDirection);
    ok(cs(q('.rotulo')).display === 'none', 'los rotulos quedan ocultos');
    ok(cs(q('.seccion')).display === 'none', 'el titulo de seccion no aparece en pantalla chica');
    ok(cs(q('#precio')).display === 'none', 'los filtros vuelven a estar plegados');
    ok(cs(q('#filtros-btn')).display !== 'none', 'y vuelve el boton Filtros');
    ok(rChips.top < rGrid.top, 'la cinta esta ARRIBA de la grilla',
       `cinta ${Math.round(rChips.top)}, grilla ${Math.round(rGrid.top)}`);
  }

  // Las recomendaciones cambian de lugar segun el ancho: en la columna de
  // filtros cuando hay lugar, y al final de la grilla en el celular. Nunca
  // pueden quedar ANTES de los productos.
  const sug = q('#sugeridos');
  ok(!!sug && !sug.hidden, 'el bloque de recomendaciones esta a la vista');
  if(sug && !sug.hidden){
    const rSug = sug.getBoundingClientRect();
    const items = sug.querySelectorAll('.sug').length;
    ok(items > 0, 'con productos adentro', items);
    if(lateral){
      ok(sug.closest('.toolbar') !== null, 'en pantalla ancha vive en la columna de filtros');
      ok(rSug.left < rGrid.left, 'a la izquierda de la grilla');
    } else {
      ok(sug.closest('main') !== null, 'en el celular vive dentro de la grilla');
      ok(rSug.top > rGrid.top, 'y va DESPUES de los productos, no antes',
         `sugeridos en ${Math.round(rSug.top)}, grilla desde ${Math.round(rGrid.top)}`);
      ok(rSug.width > w * 0.7, 'ocupando el ancho de la pantalla',
         Math.round(rSug.width) + ' de ' + w);
    }
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

    // Con Celulares puesto aparecen las marcas: ahi se prueba la lista vertical
    cel.click();
    const marcas = [...d.querySelectorAll('#marcas .chip')];
    if(lateral && marcas.length > 1){
      const antesM = d.querySelectorAll('.card').length;
      gesto(marcas[1], 16);   // movimiento grande sobre la lista vertical
      ok(d.querySelectorAll('.card').length !== antesM,
         'en la lista de marcas, mover el mouse no cancela el clic',
         antesM + ' -> ' + d.querySelectorAll('.card').length + ' tarjetas');
      marcas[0].click();
    }
    todo.click();
  }
}
probar();
