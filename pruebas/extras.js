// Los bloques que se agregaron debajo del mosaico, mas el buscador con
// sugerencias y el aviso de stock. Todos aparecen solos y todos se apagan
// cuando el cliente pone un filtro: eso es lo que se verifica aca.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const $$ = s => document.querySelectorAll(s);

const esperar = setInterval(() => {
  // Como portada.js, esta tanda NO pide la grilla: prueba la pagina tal como
  // la ve el cliente al entrar.
  if(!MODELOS.length || !$$('#cats .chip').length || !$('presupuesto')) return;
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
  /* ---- 1. Por presupuesto ----
     Desde el 17/09 son pestañas con vitrinas (lo fino, en presupuesto.js).
     Si el numero que promete un tramo no es el que despues muestra la grilla,
     el cliente siente que le mentimos. Se compara contra filtrar() DE VERDAD:
     antes esta prueba re-implementaba la formula del catalogo, asi que validaba
     el error en vez de encontrarlo, y por eso el desfasaje vivio meses dando
     OK. Una prueba que copia la cuenta que quiere verificar no verifica nada. */
  const tramos = [...$$('#presupuesto .pv-tab')];
  ok(tramos.length >= 3, 'hay tramos por presupuesto', tramos.length);
  const malCuenta = tramos.filter(b => {
    elegirTramo(b.dataset.pv);
    const guardado = JSON.stringify(filtros);
    Object.assign(filtros, { q:'', cat:'', marca:'', soloStock:false,
                             rango:b.dataset.pv, montura:'', apertura:'' });
    const n = filtrar().length;
    Object.assign(filtros, JSON.parse(guardado));
    return !$('presupuesto').querySelector('[data-ver]').textContent.startsWith('Ver los ' + n + ' ');
  });
  ok(malCuenta.length === 0, 'cada tramo dice cuantos productos tiene de verdad',
     malCuenta.map(b => b.dataset.pv).join(', ') || 'todos bien');
  ok(tramos.every(b => RANGOS.some(r => r[0] === b.dataset.pv)),
     'todos apuntan a un tramo de precio que existe');

  /* ---- 2. Recién llegados ----
     Desde el 16/09 ocupa el lugar de "Lo que miraste", "Lo último que entró" y
     las cinco filas por rubro. Lo fino se prueba en nuevos.js; aca, que este. */
  ok(!!$('nuevos') && $('nuevos').querySelectorAll('.nv-ancho').length >= 2,
     'esta la vidriera de recien llegados', $$('#nuevos .nv-ancho').length);
  ok(!$$('#extras .pc').length, 'y ya no estan las filas de tarjetas chicas', $$('#extras .pc').length);

  /* ---- 3. Elegir un rubro apaga la portada ---- */
  const chip = [...$$('#cats .chip')].find(c => c.dataset.cat);
  chip.click();
  ok(filtros.cat === chip.dataset.cat, 'elegir un rubro lo abre', filtros.cat);
  ok($('extras').hidden, 'y los bloques de la portada se apagan');
  ok(!$('grid').hidden, 'ahora se ve la grilla');

  /* ---- 4. Volver a la portada los trae de nuevo ---- */
  [...$$('#cats .chip')].find(c => c.dataset.cat === '').click();
  ok(!$('extras').hidden, 'al volver a "Todo" los bloques vuelven');
  ok(!!$('nuevos') && !!$('presupuesto'), 'y se redibujan enteros', $('extras').children.length);

  /* ---- 5. Las marcas ----
     Desde el 16/09 no son una fila de circulos casi al final: son la vitrina
     que se turna sola, pegada debajo de los rubros. Lo fino, en marcas.js. */
  const vitrina = $('marcas-vitrina');
  ok(!!vitrina && $('extras').firstElementChild === vitrina,
     'la vitrina de marcas es lo primero debajo de los rubros');
  ok(!$('extras').querySelector('.fila-marcas'), 'y la fila de circulos ya no esta en la portada');

  /* ---- 6. Pedí lo que no está ---- */
  const inp = $('pedilo-q'), bot = $('pedilo-btn');
  ok(!!inp && !!bot, 'esta el pedido de lo que no figura');
  ok(bot.disabled, 'el boton arranca apagado: sin texto no hay nada que consultar');
  inp.value = 'sony a7 iv';
  inp.dispatchEvent(new Event('input'));
  ok(!bot.disabled, 'y se prende al escribir algo', inp.value);

  /* ---- 7. Sugerencias del buscador ---- */
  $('q').value = 'iphone';
  pintarSug();
  const sug = [...$$('#q-sug .qs')];
  ok(sug.length > 0, 'escribir sugiere productos', sug.length);
  ok(!$('q-sug').hidden, 'y el panel se abre');
  // Sugerir algo que despues la grilla no encuentra seria peor que no sugerir
  const prodsSug = sug.filter(b => b.dataset.key);
  ok(prodsSug.every(b => {
    const m = buscarModelo(b.dataset.key);
    return m && m.stock && henoDe(m).includes('iphone');
  }), 'todo lo sugerido coincide de verdad con lo escrito');
  cerrarSug();
  ok($('q-sug').hidden, 'Escape / clic afuera lo cierra');
  // Con una sola letra no se sugiere nada: serian 400 resultados
  $('q').value = 'i'; pintarSug();
  ok($('q-sug').hidden, 'con una sola letra no sugiere nada');
  $('q').value = '';
  // Un rubro entero se sugiere antes que sus productos
  $('q').value = 'celular'; pintarSug();
  const prim = $('q-sug').querySelector('.qs');
  ok(prim && prim.classList.contains('qs-cat'),
     'buscar el nombre de un rubro lo ofrece primero',
     prim && prim.textContent.trim().slice(0, 30));
  cerrarSug(); $('q').value = ''; filtros.q = '';

  /* ---- 8. Aviso de stock ----
     Sin stock, el boton de siempre manda a preguntar por algo que no hay. */
  const sinStock = MODELOS.find(m => !m.stock);
  if(!sinStock){
    R.push('  --   hoy no hay ningun producto sin stock para probar el aviso');
  }else{
    abrirFicha(clave(sinStock.rep));
    const cta = document.querySelector('.fi-botones .cta');
    ok(!!cta, 'la ficha de un agotado tiene boton');
    ok(cta && /avisame/i.test(cta.textContent), 'y dice "Avisame cuando entre"',
       cta && cta.textContent.trim());
    ok(cta && cta.classList.contains('cta-aviso'), 'con su propio estilo, no el de comprar');
    ok(cta && /avisan%20cuando%20entre|avisan cuando entre/i.test(decodeURIComponent(cta.href)),
       'el mensaje de WhatsApp pide el aviso');
    quitarFicha();
  }

  const conStock = MODELOS.find(m => m.stock);
  abrirFicha(clave(conStock.rep));
  const cta2 = document.querySelector('.fi-botones .cta');
  ok(cta2 && /consultar/i.test(cta2.textContent),
     'con stock sigue diciendo "Consultar por WhatsApp"', cta2 && cta2.textContent.trim());
  quitarFicha();

  /* ---- 9. Lo que miraste ----
     Es del navegador de cada visitante, no un ranking de la tienda. */
  ok(typeof anotarMirado === 'function' && typeof modelosMirados === 'function',
     'existe el registro de lo que miro este visitante');
  ok(modelosMirados().some(m => m === conStock),
     'abrir una ficha deja al producto en esa lista');
}
