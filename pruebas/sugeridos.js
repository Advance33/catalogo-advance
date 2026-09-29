// Recorre TODAS las categorias del catalogo y revisa que las recomendaciones
// tengan sentido: que existan, que no se recomiende lo mismo que estas viendo,
// que no se repitan entre si y que sean cosas comprables (con stock y precio).
const R = [];
let fallas = 0;
const ok = (c, t, x) => { R.push((c?'  OK  ':'FALLA ') + t + (x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };

const esperar = setInterval(() => {
  if(!MODELOS.length) return;
  // La portada muestra los rubros, no los productos. Para probar la grilla hay
  // que pedirla, igual que hace el cliente cuando toca "Ver todo".
  verTodoElCatalogo();
  if(!document.querySelectorAll('.card').length) return;
  clearInterval(esperar);
  for(let i = 1; i < 5000; i++) clearInterval(i);
  try{ correrPruebas(); }catch(e){ R.push('EXCEPCION: ' + (e && e.stack || e)); fallas++; }
  // Las pruebas vuelven a pintar, y cada pintado reengancha los paseos de las
  // pistas y el carrusel. Si queda alguno vivo, con el reloj acelerado del
  // headless el navegador no cierra nunca y la tanda figura como que no llego
  // a correr. Se frena todo DESPUES de correr, no antes.
  try{ pararPaseos(); }catch(e){}
  try{ pararOfertas(); }catch(e){}
  for(let i=1;i<5000;i++) clearInterval(i);

  const pre = document.createElement('pre');
  pre.id = 'RESULTADO';
  pre.textContent = '\n===== ' + (fallas ? fallas + ' FALLA(S)' : 'TODO OK') + ' =====\n' + R.join('\n');
  document.body.appendChild(pre);
}, 150);

function correrPruebas(){
  const cats = [...new Set(PRODUCTOS.map(p => p.cat))].sort();

  // En "Todo" ya no hay con que relacionar, pero se muestran las novedades
  filtros.cat = ''; pintar();
  const caja0 = $('sugeridos');
  ok(!caja0.hidden, 'en "Todo" se muestran novedades');
  ok(caja0.querySelector('.rotulo').textContent === 'Lo último que entró',
     'con su propio titulo', caja0.querySelector('.rotulo').textContent);
  const nov = [...caja0.querySelectorAll('.sug')].map(b => buscarModelo(b.dataset.key)).filter(Boolean);
  ok(nov.length === CUANTOS_SUGERIDOS, 'son tres', nov.length);
  ok(new Set(nov.map(m => m.cat)).size === nov.length,
     'cada una de un rubro distinto, para que se vea la variedad',
     nov.map(m => m.cat).join(' + '));
  ok(nov.every(m => m.stock && m.precio !== null && m.imagen),
     'todas con stock, precio y foto');
  /* (29/09) Aca se comprobaba "ordenadas de mas nueva a mas vieja" por fecha,
     y pasaba en vacio: ADVAPP manda las fechas en ISO y el regex no entendia
     ninguna. Si las entendiera fallaria por diseño, porque novedades() ordena
     por codigo AT. Ese orden ya lo prueba nuevos.js. */

  // Lo que el codigo puede ofrecer desde `cat`: comprable y, desde el 29/09,
  // compatible con lo que se mira (marca, montura). Sin la funcion, todo.
  const sirveDesde = cat => typeof sirveParaLoQueMira === 'function' ? sirveParaLoQueMira(cat) : () => true;
  const sinTecho = [];
  const sinMapa = [], vacias = [], detalle = [];
  cats.forEach(cat => {
    filtros.cat = cat;
    pintar();
    const caja = $('sugeridos');
    const items = [...caja.querySelectorAll('.sug')];
    const modelos = items.map(b => buscarModelo(b.dataset.key)).filter(Boolean);

    if(!COMPLEMENTOS[cat]){ sinMapa.push(cat); return; }
    /* Vacia es FALLA solo si habia algo para dar (29/09). El codigo esconde la
       caja a proposito cuando ningun complemento tiene nada con stock, precio
       y foto: el 28/09 ADVAPP dejo los Objetivos fuera de venta y esta tanda
       fallaba por algo que la pagina hacia bien. */
    const sirve = sirveDesde(cat);
    const habia = COMPLEMENTOS[cat].some(c => MODELOS.some(m => m.cat === c && m.stock
                    && m.precio !== null && m.imagen && sirve(m)));
    if(!items.length){ if(habia) vacias.push(cat); else sinTecho.push(cat + ' (nada comprable para ofrecer)'); return; }

    // Nunca recomendar lo mismo que estas mirando
    ok(modelos.every(m => m.cat !== cat), `${cat}: no se recomienda a sí misma`,
       modelos.map(m => m.cat).join(', '));
    // Solo categorias del mapa
    ok(modelos.every(m => COMPLEMENTOS[cat].includes(m.cat)),
       `${cat}: todo lo recomendado está en el mapa`, modelos.map(m => m.cat).join(', '));
    // Nada repetido
    const claves = modelos.map(m => clave(m.rep));
    ok(new Set(claves).size === claves.length, `${cat}: no repite productos`);
    // Comprable: con stock y con precio
    ok(modelos.every(m => m.stock && m.precio !== null),
       `${cat}: todo lo recomendado tiene stock y precio`);
    // Un complemento no puede costar mucho mas que lo que la persona vino a ver
    const techo = techoSugeridos();
    const caros = modelos.filter(m => m.precio > techo);
    // Variedad: si hay mas de una categoria complementaria con productos,
    // no deberian venir los 3 de la misma
    const catsRec = [...new Set(modelos.map(m => m.cat))];
    const disponibles = COMPLEMENTOS[cat].filter(c =>
      MODELOS.some(m => m.cat === c && m.stock && m.precio !== null && m.imagen
                        && m.precio <= techo && sirve(m)));
    /* Pasarse del techo es FALLA solo si habia algo por debajo (29/09). Si no
       habia nada, el codigo vuelve a elegir sin techo a proposito ("mas vale
       una sugerencia cara que un espacio en blanco") y se anota aparte. */
    if(caros.length && !disponibles.length) sinTecho.push(cat + ' (sin techo a propósito)');
    else ok(caros.length === 0, `${cat}: nada mas caro que el techo (USD ${techo})`,
       caros.map(m => m.desc.slice(0,24) + ' USD ' + m.precio).join(', ') || 'ninguno');
    ok(catsRec.length >= Math.min(disponibles.length, modelos.length),
       `${cat}: mezcla categorías en vez de repetir una`,
       catsRec.join(' + ') || 'ninguna');
    detalle.push(`  ${cat}  →  ` + modelos.map(m =>
      `${m.desc.slice(0,32)} (${m.cat}, USD ${m.precio})`).join('  ·  '));
  });

  ok(sinMapa.length === 0, 'ninguna categoría del catálogo quedó sin complementos definidos',
     sinMapa.join(', ') || 'ninguna');
  ok(vacias.length === 0, 'ninguna categoría con algo para ofrecer se quedó sin nada para mostrar',
     vacias.join(', ') || 'ninguna');
  // No es falla: es el dato del dia. Queda a la vista para el que lee el log.
  if(sinTecho.length) R.push('  --   por el dato de hoy, no por la pagina: ' + sinTecho.join(', '));

  // Tocar una recomendacion abre su ficha
  filtros.cat = 'Celular'; pintar();
  const b = $('sugeridos').querySelector('.sug');
  if(b){
    const k = b.dataset.key;
    b.click();
    const d = document.getElementById('ficha');
    ok(!!d, 'tocar una recomendación abre la ficha');
    ok(d && FICHA === k, 'y abre la que corresponde', FICHA + ' vs ' + k);
    if(d) cerrarFicha();
  }

  R.push('\n--- qué se recomienda en cada categoría ---');
  R.push(...detalle);
  filtros.cat = ''; pintar();
}
