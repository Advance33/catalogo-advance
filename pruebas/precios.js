// Como se leen los precios de la planilla y como se muestran las ofertas.
// Los precios se cargan a mano y cada uno escribe distinto: "8500", "USD 8500",
// "8.500". El punto de miles hacia que el precio entrara como 8,5 y el producto
// se caia de las ofertas sin avisar.
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
  /* ---- 1. Como se lee cada forma de escribir un precio ----
     Con la funcion de la pagina, leerPrecio(), la misma que usa cargar().
     Hasta el 29/09 vivia adentro de cargar() y aca se probaba una COPIA: si
     alguien cambiaba la del index, esto seguia en OK (hallazgo 185; extras.js
     lo dice: una prueba que copia la cuenta que quiere verificar no
     verifica nada). */
  ok(typeof leerPrecio === 'function', 'la pagina lee los precios con leerPrecio()');
  const num = typeof leerPrecio === 'function' ? leerPrecio : () => NaN;
  [['8500',8500],['USD 8500',8500],['$8500',8500],['8.500',8500],['8,500',8500],
   ['1.234.567',1234567],['1.585,50',1585.5],['12,5',12.5],['1585.75',1585.75],
   ['',0],['—',0],['sin precio',0]
  ].forEach(([txt, esp]) => ok(num(txt) === esp,
      `"${txt}" se lee como ${esp}`, num(txt)));

  /* ---- 2. Los precios reales del catalogo quedaron sanos ---- */
  const conPrecio = PRODUCTOS.filter(p => p.precio !== null && p.precio > 0);
  ok(conPrecio.length > PRODUCTOS.length * 0.9, 'casi todos los productos tienen precio',
     conPrecio.length + ' de ' + PRODUCTOS.length);
  const bajos = conPrecio.filter(p => p.precio < 5);
  ok(bajos.length === 0, 'ninguno quedo con un precio ridiculamente bajo',
     bajos.slice(0,3).map(p => p.id + '=' + p.precio).join(', ') || 'ninguno');
  const altos = conPrecio.filter(p => p.precio > 50000);
  ok(altos.length === 0, 'ni ridiculamente alto',
     altos.slice(0,3).map(p => p.id + '=' + p.precio).join(', ') || 'ninguno');

  /* ---- 3. El carrusel no muestra el porcentaje ----
     En este rubro las bajas son chicas y un "4% OFF" resta en vez de sumar:
     queda el precio tachado, que se entiende solo. */
  const m0 = MODELOS.filter(m => m.stock && m.precio !== null && m.imagen)[0];
  const guardado = m0.antes;
  m0.antes = Math.round(m0.precio * 1.06);        // una baja chica, del 6%
  if(m0.rep) m0.rep.antes = m0.antes;
  pintarOfertas();

  const badge = document.querySelector('.of-off');
  ok(!!badge, 'el producto en promocion muestra su etiqueta');
  ok(badge && !/%/.test(badge.textContent),
     'la etiqueta NO dice ningun porcentaje', badge && badge.textContent);
  const tach = document.querySelector('.of-precio s');
  ok(!!tach && /\d/.test(tach.textContent),
     'pero si se ve el precio anterior tachado', tach && tach.textContent);
  /* El rotulo dice "Ofertas" solo si TODAS las de la vidriera estan en baja.
     No se compara contra un valor fijo: depende de que haya cargado en la
     planilla ese dia. Antes esta prueba pedia "Destacados" y empezo a fallar el
     dia que se cargaron ofertas de verdad, que es justo cuando NO tenia que
     fallar. Lo que importa es que el rotulo no mienta. */
  const enVidriera = [...document.querySelectorAll('#ofertas .of-slide')]
    .map(s => buscarModelo(s.dataset.key)).filter(Boolean);
  const rotulo = document.querySelector('#of-rotulo').textContent;
  ok(rotulo === (enVidriera.every(enOferta) ? 'Ofertas' : 'Destacados'),
     'el rotulo dice lo que de verdad hay en la vidriera',
     rotulo + ' con ' + enVidriera.filter(enOferta).length + ' de ' +
     enVidriera.length + ' en baja');

  /* Con un "antes" escrito con punto de miles tambien tiene que funcionar.
     Hasta el 29/09 se miraba m0.antes despues de asignarle num('8.500'): la
     copia contra si misma (hallazgo 185). Ahora se mira lo que se VE: el
     precio tachado de ese producto en la vidriera. */
  m0.antes = num('8.500'); if(m0.rep) m0.rep.antes = m0.antes;
  pintarOfertas();
  const suSlide = [...document.querySelectorAll('#ofertas .of-slide')].find(s => buscarModelo(s.dataset.key) === m0);
  const suTachado = suSlide && suSlide.querySelector('.of-precio s');
  ok(!!suTachado && suTachado.textContent.includes(plata(8500)),
     'un precio anterior escrito "8.500" se ve tachado como ' + plata(8500),
     suTachado ? suTachado.textContent : (suSlide ? 'sin tachado' : 'no esta en la vidriera'));

  m0.antes = guardado; if(m0.rep) m0.rep.antes = guardado;
  pintarOfertas();
  pararOfertas();   // que no quede girando y trabe el headless
}
