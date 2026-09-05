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
     num() vive dentro del parseo y no se exporta, asi que se prueba la misma
     logica: si esta copia y la del index se separan, la prueba deja de servir
     y hay que mirar las dos. */
  const num = s => {
    const t = String(s ?? '').replace(/[^\d.,-]/g, '');
    if(!t) return 0;
    const corte = Math.max(t.lastIndexOf('.'), t.lastIndexOf(','));
    if(corte === -1) return parseFloat(t) || 0;
    const decimales = t.length - corte - 1;
    const esMiles = (t.includes('.') && t.includes(','))
      ? false
      : (t.match(/[.,]/g) || []).length > 1 || decimales === 3;
    return parseFloat(esMiles
      ? t.replace(/[.,]/g, '')
      : t.slice(0, corte).replace(/[.,]/g, '') + '.' + t.slice(corte + 1)) || 0;
  };
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
  ok(document.querySelector('#of-rotulo').textContent === 'Ofertas',
     'y el titulo pasa a "Ofertas"');

  // Con un "antes" escrito con punto de miles tambien tiene que funcionar
  m0.antes = num('8.500'); if(m0.rep) m0.rep.antes = m0.antes;
  pintarOfertas();
  ok(m0.antes === 8500, 'un precio anterior escrito "8.500" vale 8500', m0.antes);

  m0.antes = guardado; if(m0.rep) m0.rep.antes = guardado;
  pintarOfertas();
  pararOfertas();   // que no quede girando y trabe el headless
}
