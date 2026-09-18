// «¿Cuánto querés gastar?» (17/09): los tramos de precio en pestañas, cuatro
// productos de cada tramo en vitrinas y lo que miró este visitante al pie.
// Reemplazó a los botones de "Por presupuesto" y a la tira de "Seguí mirando".
// Se prueba que cada tramo muestre lo que dice, que "Ver los N" lleve a la
// grilla con ese tramo y que cambiar de tramo no haga saltar la página.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const $$ = s => document.querySelectorAll(s);

const esperar = setInterval(() => {
  if(!MODELOS.length || !$$('#cats .chip').length || !document.getElementById('presupuesto')) return;
  clearInterval(esperar);
  for(let i=1;i<5000;i++) clearInterval(i);
  try{ correrPruebas(); }catch(e){ R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; }
  try{ pararPaseos(); pararOfertas(); pararNuevos(); pararMarcas(); pararMundos(); }catch(e){}
  for(let i=1;i<5000;i++) clearInterval(i);
  const pre=document.createElement('pre'); pre.id='RESULTADO';
  pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
  document.body.appendChild(pre);
}, 150);

const sec = () => $('presupuesto');
const vitrinas = () => [...sec().querySelectorAll('.pv-vit')].map(b => buscarModelo(b.dataset.key));

function correrPruebas(){
  /* ---- 1. Dónde va y qué tramos tiene ---- */
  const hijos = [...$('extras').children];
  ok(hijos.indexOf(sec()) === hijos.indexOf($('marcas-vitrina')) + 1, 'va justo debajo de las marcas');
  ok(hijos.indexOf(sec()) < hijos.indexOf($('nuevos')), 'y antes de Recién llegados');
  const tabs = [...sec().querySelectorAll('.pv-tab')];
  const conProductos = RANGOS.filter(([, , min, max]) => MODELOS.some(m => m.variantes.some(v => v.precio !== null && v.precio >= min && v.precio < max)));
  ok(tabs.length === conProductos.length && tabs.every((b, i) => b.dataset.pv === conProductos[i][0]),
     'una pestaña por tramo con productos, en el orden de siempre', tabs.map(b => b.dataset.pv).join(' · '));
  const masGrande = PV.reduce((a, b) => b.n > a.n ? b : a);
  ok(sec().querySelector('.pv-tab[aria-pressed="true"]').dataset.pv === masGrande.val, 'abre en el tramo con más productos', masGrande.val);

  /* ---- 2. Lo que muestra cada tramo ---- */
  const mal = [], repetidos = [];
  PV.forEach(t => {
    elegirTramo(t.val);
    const ms = vitrinas();
    if(!ms.length || ms.length > PV_VITRINAS) mal.push(t.val + ': ' + ms.length + ' vitrinas');
    ms.forEach(m => {
      if(!m || !m.stock || !m.imagen || m.precio === null || m.precio < t.min || m.precio >= t.max) mal.push(t.val + ': ' + (m && m.desc));
    });
    // Uno por rubro mientras haya rubros distintos para elegir
    const rubrosDisponibles = new Set(MODELOS.filter(m => m.stock && m.imagen && m.precio !== null && m.precio >= t.min && m.precio < t.max).map(m => m.cat)).size;
    if(new Set(ms.map(m => m.cat)).size < Math.min(ms.length, rubrosDisponibles)) repetidos.push(t.val);
    const pressed = [...sec().querySelectorAll('.pv-tab[aria-pressed="true"]')].map(b => b.dataset.pv);
    if(pressed.length !== 1 || pressed[0] !== t.val) mal.push(t.val + ': pestaña marcada ' + pressed.join(','));
  });
  ok(!mal.length, 'cada tramo muestra hasta cuatro productos de ese precio, con stock y foto', mal.slice(0, 3).join(' | ') || 'todos bien');
  ok(!repetidos.length, 'en las vitrinas no se repite el rubro si hay otros', repetidos.join(', ') || 'ninguno');

  /* ---- 3. Cambiar de tramo no hace saltar la página ---- */
  const altos = PV.map(t => { elegirTramo(t.val); return Math.round(sec().getBoundingClientRect().height); });
  ok(new Set(altos).size === 1, 'el alto no cambia de un tramo a otro', altos.join(','));

  /* ---- 4. Con el mouse alcanza con pasar; con el dedo, no ---- */
  const [a, b] = [PV[0], PV[PV.length - 1]];
  elegirTramo(a.val);
  sec().querySelector(`.pv-tab[data-pv="${b.val}"]`).dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'touch' }));
  ok(pvVal === a.val, 'con el dedo, pasar por encima no cambia el tramo');
  sec().querySelector(`.pv-tab[data-pv="${b.val}"]`).dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
  ok(pvVal === b.val && vitrinas().every(m => m.precio >= b.min && m.precio < b.max), 'con el mouse, pasar por un tramo ya muestra los suyos', b.val);
  sec().querySelector(`.pv-tab[data-pv="${a.val}"]`).click();
  ok(pvVal === a.val, 'tocar un tramo lo elige', a.val);

  /* ---- 5. Adónde lleva cada cosa ---- */
  const m0 = vitrinas()[0];
  sec().querySelector('.pv-vit').click();
  ok(FICHA_MODELO === m0, 'tocar una vitrina abre la ficha de ese producto', m0 && m0.desc);
  quitarFicha();
  const t = PV.find(x => x.val === pvVal);
  sec().querySelector('[data-ver]').click();
  ok(filtros.rango === t.val && !enPortada() && !$('grid').hidden, '"Ver los N" abre la grilla con ese tramo', filtros.rango);
  ok(LISTA.length === t.n, 'y muestra exactamente los que prometía', LISTA.length + ' de ' + t.n);
  filtros.rango = ''; sincronizarControles(); pintar();
  ok(enPortada() && !!sec(), 'al sacar el filtro vuelve a la portada con la pieza');

  /* ---- 6. Lo visto hace poco, al pie ---- */
  const vistos = MODELOS.filter(m => m.stock && m.imagen).slice(0, 3);
  try{ localStorage.removeItem(MIRADOS_KEY); }catch(e){}
  FIRMA_EXTRAS = ''; pintarExtras();
  ok(!sec().querySelector('.pv-pie'), 'si no miró nada, no hay pie');
  vistos.slice().reverse().forEach(m => anotarMirado(clave(m.rep)));
  FIRMA_EXTRAS = ''; pintarExtras();
  const items = [...sec().querySelectorAll('.pv-vi')];
  ok(items.length === 3 && items.every((b, i) => b.dataset.key === clave(vistos[i])), 'con lo mirado, aparece al pie en orden', items.length);
  items[1].click();
  ok(FICHA_MODELO === vistos[1], 'tocar uno abre su ficha');
  quitarFicha();
  try{ localStorage.removeItem(MIRADOS_KEY); }catch(e){}
  FIRMA_EXTRAS = ''; pintarExtras();
}
