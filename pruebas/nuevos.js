// La vidriera de "Recién llegados" y la tira de "Seguí mirando", que desde el
// 16/09 reemplazan a "Lo que miraste", "Lo último que entró" y las cinco filas
// por rubro de la portada. Se prueba que muestre lo último de verdad (por código
// AT), que diga lo que dice la planilla, que gire sin que la página salte y que
// sus botones hagan lo mismo que los de la tarjeta.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const $$ = s => document.querySelectorAll(s);

const esperar = setInterval(() => {
  // Como portada.js, esta tanda NO pide la grilla: prueba la portada tal cual
  if(!MODELOS.length || !$$('#cats .chip').length || !document.getElementById('nuevos')) return;
  clearInterval(esperar);
  for(let i=1;i<5000;i++) clearInterval(i);
  try{ correrPruebas(); }catch(e){ R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; }
  // El giro solo se puede ver dejando correr el reloj: va aparte y cierra la tanda
  try{ probarGiro(terminar); }catch(e){ R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; terminar(); }
}, 150);

function terminar(){
  // Cada pintado reengancha paseos y vidrieras: con alguno vivo el headless no cierra
  try{ pararPaseos(); pararOfertas(); pararNuevos(); }catch(e){}
  for(let i=1;i<5000;i++) clearInterval(i);
  const pre=document.createElement('pre'); pre.id='RESULTADO';
  pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
  document.body.appendChild(pre);
}

const activas = sec => [...sec.querySelectorAll('.nv-pila')].map(p =>
  [...p.children].findIndex(t => t.classList.contains('activa')));

function correrPruebas(){
  let sec = $('nuevos');
  const n = NV.length;

  /* ---- 1. Qué muestra ---- */
  const elegibles = MODELOS.filter(m => m.stock && m.precio !== null && m.imagen);
  ok(n >= 2 && n <= NUEVOS_MAX, 'la vidriera tiene entre 2 y ' + NUEVOS_MAX + ' novedades', n);
  ok(NV.every(m => elegibles.includes(m)), 'todas con stock, precio y foto');
  ok(new Set(NV.map(m => m.cat)).size === n, 'una por rubro', NV.map(m => m.cat).join(', '));
  /* Lo nuevo sale del codigo AT: se asigna en orden y no se reusa. La fecha de
     la planilla es la misma en todas las filas, asi que ordenando por fecha la
     vidriera mostraba lo que estuviera primero en la hoja. */
  const codigos = NV.map(codigoMasAlto);
  const maximo = Math.max(...elegibles.map(codigoMasAlto));
  ok(maximo > 0 && codigos[0] === maximo, 'la primera es la del código AT más alto', codigos[0] + ' de ' + maximo);
  ok(codigos.every((c, i) => i === 0 || codigos[i - 1] >= c), 'y siguen de la más nueva a la más vieja', codigos.join(' > '));
  // Ningun rubro que falta tiene algo mas nuevo que la ultima que entro
  const rubros = new Set(NV.map(m => m.cat));
  const salteado = n < NUEVOS_MAX ? null
    : elegibles.find(m => !rubros.has(m.cat) && codigoMasAlto(m) > codigos[n - 1]);
  ok(!salteado, 'no se saltea un rubro con algo más nuevo', salteado ? salteado.desc : 'ninguno');

  /* ---- 2. Lo que dice es lo de la planilla ---- */
  const grandes = [...sec.querySelectorAll('.nv-pila[data-paso="0"] > .nv-ancho')];
  ok(grandes.length === n, 'el banner tiene una por novedad', grandes.length);
  const mal = grandes.filter((t, i) => {
    const m = NV[i];
    if(t.dataset.key !== clave(m)) return true;
    if(t.querySelector('.nv-precio b').textContent !== 'USD ' + plata(m.precio)) return true;
    if(!!t.querySelector('.nv-precio small') !== (m.multi && m.precio !== m.precioMax)) return true;
    const ars = t.querySelector('.nv-precio i');
    if(TC && (!ars || ars.textContent !== precioARS(m))) return true;
    if(conRegalo(m) !== !!t.querySelector('.incluye')) return true;
    if(m.multi !== !!t.querySelector('.nv-opciones')) return true;
    return false;
  });
  ok(!mal.length, 'precio, "desde", pesos, regalo y opciones coinciden con cada producto',
     mal.map(t => t.dataset.key).join(', ') || 'todas bien');
  ok(!/últimas unidades|quedan pocas|stock limitado|por tiempo limitado/i.test(sec.textContent),
     'no promete urgencias que la planilla no dice');
  const wa = grandes[0].querySelector('.nv-consultar');
  ok(!WHATSAPP || (wa && decodeURIComponent(wa.href).includes(nombreConMarca(NV[0]))),
     'Consultar abre WhatsApp con el nombre del producto');

  /* ---- 3. Qué se ve en cada momento ---- */
  const pilas = sec.querySelectorAll('.nv-pila').length;
  irNuevo(0);
  ok(JSON.stringify(activas(sec)) === JSON.stringify([0, 1, 2].slice(0, pilas)),
     'se ve la primera y abajo las dos que siguen', activas(sec));
  irNuevo(n - 1);
  const a = activas(sec);
  ok(a[0] === n - 1 && a[1] === 0 && (pilas < 3 || a[2] === 1 % n),
     'en la última, abajo vuelven las primeras', a);
  ok(sec.querySelectorAll('.nv-pila > .activa').length === pilas, 'una sola visible por pila');
  const puntos = [...sec.querySelectorAll('.nv-puntos button')];
  ok(puntos.length === n && puntos.filter(b => b.getAttribute('aria-current') === 'true').length === 1
     && puntos[n - 1].getAttribute('aria-current') === 'true', 'los puntitos marcan cuál se ve');
  puntos[1].click();
  ok(nvIndice === 1 && activas(sec)[0] === 1, 'tocar un puntito salta a esa', nvIndice);

  /* ---- 4. Girar no hace saltar la página ----
     Estan todas apiladas en la misma celda: el alto es el de la mas larga y no
     cambia al pasar de una a otra. Sin apilar, o se veian las seis una abajo de
     la otra, o todo lo de abajo subia y bajaba cada cinco segundos. */
  const pila = sec.querySelector('.nv-pila');
  const masAlta = Math.max(...[...pila.children].map(t => t.offsetHeight));
  ok(pila.offsetHeight <= masAlta + 2, 'las novedades están apiladas en el mismo lugar',
     pila.offsetHeight + ' vs ' + masAlta);
  const altos = NV.map((_, i) => { irNuevo(i); return Math.round(sec.getBoundingClientRect().height); });
  ok(new Set(altos).size === 1, 'el alto de la sección no cambia al girar', altos.join(','));

  /* ---- 5. Agregar al pedido ---- */
  irNuevo(0);
  const t0 = sec.querySelector('.nv-pila[data-paso="0"] > .activa');
  const m0 = buscarModelo(t0.dataset.key);
  const antes = enPedidoModelo(m0);
  t0.querySelector('.mas').click();
  ok(enPedidoModelo(m0) !== antes, '"Agregar al pedido" lo carga');
  ok(!FICHA, 'y no abre la ficha');
  // El mismo producto esta en las tres pilas: todas tienen que decir lo mismo
  const marcas = [...sec.querySelectorAll('.nv-tarj')].filter(t => t.dataset.key === t0.dataset.key)
    .map(t => t.querySelector('.mas').getAttribute('aria-pressed'));
  ok(marcas.length >= 2 && marcas.every(v => v === String(enPedidoModelo(m0))),
     'queda marcado como agregado en todos los lugares donde aparece', marcas.join(','));
  t0.querySelector('.mas').click();
  ok(enPedidoModelo(m0) === antes, 'tocarlo otra vez lo saca');

  /* ---- 6. Tocar la novedad abre su ficha ---- */
  t0.querySelector('.nv-nom').click();
  ok(FICHA_MODELO === m0, 'tocar la novedad abre su ficha', FICHA_MODELO && FICHA_MODELO.desc);
  quitarFicha();

  /* ---- 7. Seguí mirando, sin repetidos ----
     Se guarda la variante que se abrio: dos capacidades del mismo modelo son
     dos claves, y antes el mismo producto salia dos veces seguidas. */
  const multi = MODELOS.find(m => m.multi && m.stock && m.imagen && m.variantes.length >= 2);
  const otro = MODELOS.find(m => m !== multi && m.stock && m.imagen);
  localStorage.removeItem(MIRADOS_KEY);
  anotarMirado(clave(otro.rep));
  anotarMirado(clave(multi.variantes[0]));
  anotarMirado(clave(multi.variantes[1]));
  const mirados = modelosMirados();
  ok(mirados.filter(m => m === multi).length === 1, 'dos versiones del mismo modelo cuentan una vez',
     mirados.map(m => m.desc).join(' | '));
  ok(mirados[0] === multi && mirados[1] === otro, 'y lo último que abrió va primero');
  FIRMA_EXTRAS = ''; pintarExtras();
  // Desde el 17/09 lo mirado va al pie de «¿Cuánto querés gastar?»
  const tira = [...$$('#presupuesto .pv-vi')];
  ok(tira.length === 2 && tira[0].dataset.key === clave(multi), 'la tira lo muestra una sola vez', tira.length);
  tira[1].click();
  ok(FICHA_MODELO === otro, 'tocar uno de la tira abre su ficha');
  quitarFicha();
  localStorage.removeItem(MIRADOS_KEY);
  FIRMA_EXTRAS = ''; pintarExtras();
  ok(!$$('#presupuesto .pv-pie').length, 'sin nada mirado, la tira no aparece');

  /* ---- 8. Fuera de la portada se frena ---- */
  arrancarNuevos();
  ok(!!nvTimer, 'en la portada gira sola');
  [...$$('#cats .chip')].find(c => c.dataset.cat).click();
  ok(!nvTimer, 'al entrar a un rubro deja de girar', filtros.cat);
  [...$$('#cats .chip')].find(c => c.dataset.cat === '').click();
  ok(!!nvTimer && !!$('nuevos'), 'y al volver a la portada gira de nuevo');
}

/* ---- 9. El giro, con el reloj corriendo ---- */
function probarGiro(fin){
  arrancarNuevos();
  irNuevo(0);
  nvDesde = Date.now() - NUEVOS_MS;          // como si ya hubieran pasado los 5 segundos
  setTimeout(() => {
    ok(nvIndice === 1, 'pasado el tiempo, pasa sola a la siguiente', nvIndice);
    ok(activas($('nuevos'))[0] === 1, 'y se ve la nueva');
    frenarNuevos('prueba');
    const quieta = nvIndice;
    nvDesde = Date.now() - 3 * NUEVOS_MS;
    setTimeout(() => {
      ok(nvIndice === quieta, 'con el mouse encima no cambia', nvIndice);
      soltarNuevos('prueba');
      fin();
    }, 700);
  }, 700);
}
