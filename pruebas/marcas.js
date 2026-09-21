// La vitrina de marcas de la portada (16/09): una cinta de logos que se turna
// sola cada MARCAS_MS y, abajo, la vitrina de la marca del centro. Reemplazo a
// la fila de circulos que estaba casi al final. Se prueba que los numeros sean
// los que despues muestra la grilla, que lo que se ve sea de esa marca, que
// gire sin que la pagina salte y que cada boton lleve adonde dice.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const $$ = s => document.querySelectorAll(s);

const esperar = setInterval(() => {
  if(!MODELOS.length || !$$('#cats .chip').length || !document.getElementById('marcas-vitrina')) return;
  clearInterval(esperar);
  for(let i=1;i<5000;i++) clearInterval(i);
  try{ correrPruebas(); }catch(e){ R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; }
  try{ probarGiro(terminar); }catch(e){ R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; terminar(); }
}, 150);

function terminar(){
  try{ pararPaseos(); pararOfertas(); pararNuevos(); pararMarcas(); }catch(e){}
  for(let i=1;i<5000;i++) clearInterval(i);
  const pre=document.createElement('pre'); pre.id='RESULTADO';
  pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
  document.body.appendChild(pre);
}

// Cuantos productos muestra la grilla con estos filtros, con filtrar() de verdad
function cuantosCon(extra){
  const guardado = JSON.stringify(filtros);
  Object.assign(filtros, { q:'', cat:'', marca:'', soloStock:false, rango:'', montura:'', apertura:'' }, extra);
  const n = filtrar().length;
  Object.assign(filtros, JSON.parse(guardado));
  return n;
}
const vitrina = () => $('marcas-vitrina');
const activa = () => Number(vitrina().querySelector('.mv-it.activa').dataset.k);

function correrPruebas(){
  const n = MV.length;

  /* ---- 1. Que marcas y con que numeros ---- */
  ok(n >= 3 && n <= CUANTAS_MARCAS, 'muestra las marcas principales', n);
  ok(JSON.stringify(MV.map(x => x.marca)) === JSON.stringify(marcasParaLaFila().map(x => x[0])),
     'las mismas y en el mismo orden que la fila de marcas');

  /* ---- 1b. El orden lo elige Pedro, no la cantidad (21/09) ----
     Antes salian de mayor a menor cantidad de productos y la fila arrancaba
     con Canon y Sony, que son las de fotografia; los celulares, que es lo que
     mas se busca, quedaban en el medio. Ahora manda ORDEN_MARCAS.

     Ojo con como se compara: contra la lista, no contra marcasParaLaFila(),
     que es justo la funcion que se quiere verificar. */
  /* La lista va escrita ACA, a mano, y no se lee de ORDEN_MARCAS: si la
     prueba mirara la misma constante que verifica, darla vuelta pasaria en
     verde. Escrita aparte, cambiar el orden obliga a tocar los dos lados, que
     es lo que se quiere: es el orden que eligio Pedro, no un detalle. */
  const ELEGIDO = ['Apple', 'Samsung', 'Xiaomi', 'Motorola', 'Microsoft',
                   'Canon', 'Sony', 'Nikon', 'Sigma', 'Tamron',
                   'DJI', 'Ray-Ban', 'Kieslect'];
  const hay = m => MODELOS.some(x => norm(x.marca) === norm(m));
  const esperado = ELEGIDO.filter(hay);
  ok(CUANTAS_MARCAS >= esperado.length,
     'el cupo alcanza para todas las marcas elegidas que hay hoy',
     CUANTAS_MARCAS + ' lugares para ' + esperado.length);
  const enLista = MV.map(x => x.marca).filter(m => esperado.some(e => norm(e) === norm(m)));
  ok(JSON.stringify(enLista.map(norm)) === JSON.stringify(esperado.slice(0, enLista.length).map(norm)),
     'las marcas de la lista van en el orden que eligio Pedro',
     enLista.join(', '));

  /* Las que no estan en la lista no se pierden, pero van atras de todas las
     que si estan: si una se colara adelante, el orden elegido deja de valer. */
  const posicion = MV.map((x, i) => [i, esperado.some(e => norm(e) === norm(x.marca))]);
  const ultimaDeLista = Math.max(-1, ...posicion.filter(p => p[1]).map(p => p[0]));
  const coladas = posicion.filter(p => !p[1] && p[0] < ultimaDeLista);
  ok(!coladas.length, 'y ninguna de afuera se cuela adelante',
     coladas.map(p => MV[p[0]].marca).join(', ') || 'ninguna');

  ok(MV.every(x => x.n > 0), 'ninguna marca se muestra vacia',
     MV.filter(x => !x.n).map(x => x.marca).join(', ') || MV.length + ' marcas');
  /* Como en los atajos de presupuesto: el numero que promete tiene que ser el
     que despues muestra la grilla. Se compara contra filtrar(), no contra una
     cuenta copiada, que validaria el error en vez de encontrarlo. */
  const malN = MV.filter(x => cuantosCon({ marca: x.marca }) !== x.n);
  ok(!malN.length, 'cada marca dice cuantos productos tiene de verdad', malN.map(x => x.marca).join(', ') || 'todas bien');
  const malCats = [];
  MV.forEach(x => x.cats.forEach(([cat, k]) => { if(cuantosCon({ marca: x.marca, cat }) !== k) malCats.push(x.marca + '/' + cat); }));
  ok(!malCats.length, 'y cada rubro de la marca tambien', malCats.join(', ') || 'todos bien');

  /* ---- 2. La cinta ---- */
  const items = [...vitrina().querySelectorAll('.mv-it')];
  ok(items.length === 3 * n, 'la cinta lleva la lista tres veces, para dar la vuelta sin cortes', items.length);
  const decorado = items.filter(b => b.dataset.copia !== '1');
  ok(decorado.every(b => b.getAttribute('aria-hidden') === 'true' && b.tabIndex === -1),
     'las copias de los costados no se leen ni se alcanzan con el teclado');
  ok(items.filter(b => b.dataset.copia === '1').every(b => b.hasAttribute('aria-pressed')),
     'la copia del medio dice cual esta elegida');

  /* ---- 3. Elegir una marca ---- */
  irMarca(n + 2, false);
  const el = vitrina().querySelector('.mv-tira').children[mvPos];
  const banda = vitrina().querySelector('.mv-banda').getBoundingClientRect(), r = el.getBoundingClientRect();
  ok(Math.abs((r.left + r.width / 2) - (banda.left + banda.width / 2)) < 2, 'la marca elegida queda en el centro',
     Math.round((r.left + r.width / 2) - (banda.left + banda.width / 2)) + 'px');
  ok(activa() === 2 && vitrina().querySelectorAll('.mv-it.activa').length === 3,
     'queda marcada en sus tres copias', MV[2].marca);
  const x = MV[2], panel = $('mv-lugar');
  ok(panel.querySelector('.mv-ver').textContent.includes(x.marca), 'la vitrina de abajo es de esa marca',
     panel.querySelector('.mv-ver').textContent.trim());
  const prods = [...panel.querySelectorAll('.mv-p')].map(b => buscarModelo(b.dataset.key));
  ok(prods.length >= 1 && prods.length <= 4 && prods.every(m => m && m.marca === x.marca && m.stock && m.precio !== null && m.imagen),
     'muestra hasta cuatro productos de esa marca, con stock, precio y foto', prods.length);
  const codigos = prods.map(codigoMasAlto);
  ok(codigos.every((c, i) => i === 0 || codigos[i - 1] >= c), 'lo ultimo que entro va primero', codigos.join(' > '));
  // Tocar un logo de la cinta lo trae al centro
  const otro = vitrina().querySelector('.mv-it[data-copia="1"][data-k="4"]');
  otro.click();
  ok(activa() === 4 && panel.querySelector('.mv-ver').textContent.includes(MV[4].marca), 'tocar un logo lo elige', MV[4].marca);

  /* ---- 4. Girar no hace saltar la pagina ----
     Unas marcas tienen tres rubros y otras uno, unos nombres ocupan dos
     renglones: sin reservar el alto de la mas larga, todo lo de abajo subia y
     bajaba cada vez que cambiaba. */
  const altos = MV.map((_, k) => { irMarca(n + k, false); return Math.round(vitrina().getBoundingClientRect().height); });
  ok(new Set(altos).size === 1, 'el alto no cambia de una marca a otra', altos.join(','));
  /* En la pantalla ancha de las pruebas hoy todas ocupan lo mismo, y asi la
     prueba de arriba pasaria aunque no se reservara nada. En angosto si varian:
     primero se confirma eso, y despues que la reserva lo tapa. */
  const caja = vitrina(), lugar = $('mv-lugar');
  caja.style.width = '360px';
  lugar.style.minHeight = '';
  const naturales = MV.map((_, k) => { irMarca(n + k, false); return lugar.offsetHeight; });
  reservarAltoMarcas();
  const angostos = MV.map((_, k) => { irMarca(n + k, false); return Math.round(caja.getBoundingClientRect().height); });
  ok(new Set(naturales).size > 1, 'en angosto las marcas ocupan distinto alto (lo que hay que tapar)', [...new Set(naturales)].join(','));
  ok(new Set(angostos).size === 1, 'y aun asi la vitrina no cambia de alto', angostos.join(','));
  caja.style.width = '';
  reservarAltoMarcas();

  /* ---- 5. Adonde lleva cada cosa ---- */
  irMarca(n, false);
  const primera = MV[0];
  panel.querySelector('.mv-p').click();
  ok(FICHA_MODELO && FICHA_MODELO.marca === primera.marca, 'tocar un producto abre su ficha', FICHA_MODELO && FICHA_MODELO.desc);
  quitarFicha();
  irMarca(n, false);
  $('mv-lugar').querySelector('.mv-ver').click();
  ok(filtros.marca === primera.marca && !filtros.cat, '"Ver los N" muestra todo lo de la marca', filtros.marca);
  ok($('extras').hidden && !mvTimer, 'y la portada se apaga, con la vitrina frenada');
  [...$$('#cats .chip')].find(c => c.dataset.cat === '').click();
  filtros.marca = ''; pintar();
  ok(!!vitrina() && !!mvTimer, 'al volver a la portada gira de nuevo');
  irMarca(n, false);
  const chip = $('mv-lugar').querySelector('.mv-chip');
  const cat = chip.dataset.cat;
  chip.click();
  ok(filtros.cat === cat && filtros.marca === primera.marca, 'tocar un rubro de la marca abre ese rubro con la marca puesta',
     filtros.cat + ' / ' + filtros.marca);
  ok([...$$('#cats .chip')].some(c => c.dataset.cat === cat && c.getAttribute('aria-pressed') === 'true'),
     'y la cinta de rubros lo marca');
  entrarAlRubro('');
  filtros.cat = ''; filtros.marca = ''; pintar();
}

/* ---- 6. El giro, con el reloj corriendo ---- */
function probarGiro(fin){
  const n = MV.length;
  if(!vitrina()){ ok(false, 'la vitrina volvio a la portada'); return fin(); }
  arrancarMarcas();
  irMarca(n, false);
  mvDesde = Date.now() - MARCAS_MS;          // como si ya hubiera pasado el tiempo
  setTimeout(() => {
    ok(activa() === 1, 'pasado el tiempo, sigue sola con la siguiente marca', MV[activa()].marca);
    frenarMarcas('prueba');
    const quieta = activa();
    mvDesde = Date.now() - 3 * MARCAS_MS;
    setTimeout(() => {
      ok(activa() === quieta, 'con el mouse encima no cambia', MV[activa()].marca);
      soltarMarcas('prueba');
      pararMarcas();
      // La vuelta: de la ultima a la primera sigue para el mismo lado y despues
      // salta, sin que se vea, a la copia del medio
      irMarca(n + n - 1, false);
      irMarca(2 * n, true);
      ok(activa() === 0, 'despues de la ultima viene la primera', MV[activa()].marca);
      setTimeout(() => {
        ok(mvPos === n, 'y la cinta vuelve sola a la copia del medio', 'posicion ' + mvPos);
        fin();
      }, 1200);
    }, 700);
  }, 700);
}
