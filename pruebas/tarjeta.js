// La tarjeta de producto de la grilla (17/09). Pedro la armó en un muestrario,
// eligiendo de a una cosa: foto sin caja, precio en etiqueta oscura, cinco por
// fila, botones al pasar el mouse, y a la vista los colores, el regalo y el
// precio en pesos. Esta tanda fija esas elecciones, para que un cambio de otro
// lado no las desarme sin que nadie se dé cuenta.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const $$ = s => document.querySelectorAll(s);

const esperar = setInterval(() => {
  if(!MODELOS.length || !$$('#cats .chip').length || typeof INDICE_FOTOS === 'undefined' || !INDICE_FOTOS) return;
  clearInterval(esperar);
  for(let i=1;i<5000;i++) clearInterval(i);
  try{ correrPruebas(); }catch(e){ R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; }
  // Las fotos de los colores se cargan de a una: esa parte va aparte y cierra la tanda
  try{ probarColores(terminar); }catch(e){ R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; terminar(); }
}, 150);

function terminar(){
  try{ pararPaseos(); pararOfertas(); pararNuevos(); pararMarcas(); pararMundos(); }catch(e){}
  for(let i=1;i<5000;i++) clearInterval(i);
  const pre=document.createElement('pre'); pre.id='RESULTADO';
  pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
  document.body.appendChild(pre);
}

// Solo las transiciones: la página tiene animaciones infinitas que no se pueden terminar
const terminarTransiciones = () => document.getAnimations().filter(a => a instanceof CSSTransition).forEach(a => a.finish());

// Espera a que se cumpla algo, sin colgarse: a los 4 segundos sigue igual
const cuando = (cond, sigue, t0 = Date.now()) =>
  cond() || Date.now() - t0 > 4000 ? sigue() : setTimeout(() => cuando(cond, sigue, t0), 100);

const cards = () => [...$$('#grid .card')];
const estilo = (el, p) => getComputedStyle(el).getPropertyValue(p);

function correrPruebas(){
  document.documentElement.style.scrollBehavior = 'auto';
  Object.assign(filtros, { q:'', marca:'', rango:'', soloStock:false, orden:'modelo' });
  entrarAlRubro('Celular');
  // Que aparezcan ya, sin esperar a que el scroll las revele
  cards().forEach(c => c.classList.add('vis'));
  const cs = cards();
  ok(cs.length > 5, 'hay tarjetas en la grilla', cs.length);

  /* ---- 1. Cinco por fila ---- */
  const top0 = cs[0].getBoundingClientRect().top;
  const porFila = cs.filter(c => Math.abs(c.getBoundingClientRect().top - top0) < 4).length;
  ok(innerWidth < 1300 || porFila === 5, 'en una pantalla ancha entran cinco por fila', porFila + ' a ' + innerWidth + 'px');

  /* ---- 2. Lo que se ve y lo que no ---- */
  const conRegalo = cs.filter(c => buscarModelo(c.dataset.key)?.incluye);
  const malRegalo = cs.filter(c => {
    const p = buscarModelo(c.dataset.key), cinta = c.querySelector('.foto .cinta');
    return !!(p && p.incluye) !== !!cinta || (cinta && cinta.textContent !== p.incluye);
  });
  ok(conRegalo.length > 0 && !malRegalo.length, 'el regalo va como cinta sobre la foto, con el texto de la planilla',
     malRegalo.map(c => c.dataset.key).slice(0, 3).join(', ') || conRegalo.length + ' con regalo');
  const conColor = cs.filter(c => { const p = buscarModelo(c.dataset.key); return p && pintas(p.color || '').some(x => x.hex); });
  ok(conColor.length > 0 && conColor.every(c => c.querySelector('.marca .pintas')), 'los colores van como puntitos al lado de la marca',
     conColor.length);
  ok(!cs.some(c => c.querySelector('.meta, .specs, .opciones, .incluye')),
     'no quedaron los colores escritos, las capacidades, las opciones ni la caja verde');
  ok(!TC || cs.every(c => c.querySelector('.pie .ars')), 'el precio en pesos va en la etiqueta');

  /* ---- 3. La etiqueta oscura, pareja en toda la fila ---- */
  const pies = cs.filter(c => Math.abs(c.getBoundingClientRect().top - top0) < 4).map(c => c.querySelector('.pie').getBoundingClientRect());
  // Un píxel de tolerancia: con anchos fraccionarios el navegador redondea distinto
  const parejo = xs => Math.max(...xs) - Math.min(...xs) <= 1;
  ok(parejo(pies.map(r => r.top)) && parejo(pies.map(r => r.height)),
     'las etiquetas de una fila arrancan y terminan a la misma altura, lleven "desde" o no',
     pies.map(r => Math.round(r.top) + '/' + Math.round(r.height)).join(' '));
  const fondo = estilo(cs[0].querySelector('.pie'), 'background-color');
  ok(fondo !== 'rgba(0, 0, 0, 0)' && fondo !== 'transparent', 'la etiqueta tiene fondo propio', fondo);

  /* ---- 4. La foto sin caja ----
     Se funde con el papel con mix-blend-mode. Si .card tuviera transform,
     opacity o filter, la foto quedaría aislada y volvería el rectángulo blanco
     del proveedor: por eso se mira la tarjeta ya revelada. */
  const img = cs.map(c => c.querySelector('.foto img')).find(Boolean);
  ok(img && estilo(img, 'mix-blend-mode') === 'multiply', 'la foto se funde con el fondo de la página');
  const c0 = cs[0];
  ok(estilo(c0, 'transform') === 'none' && estilo(c0, 'opacity') === '1' && estilo(c0, 'filter') === 'none',
     'la tarjeta no tiene nada que aísle la foto', [estilo(c0, 'transform'), estilo(c0, 'opacity'), estilo(c0, 'filter')].join(' | '));
  ok(['rgba(0, 0, 0, 0)', 'transparent'].includes(estilo(c0.querySelector('.foto'), 'background-color')), 'y la foto no tiene caja');

  /* ---- 5. Los botones, sobre la foto ---- */
  const acc = c0.querySelector('.foto .acciones');
  ok(!!acc && acc.querySelector('.mas') && acc.querySelector('.wa, .mas'), 'agregar y WhatsApp van sobre la foto');
  // Quieta, sin mouse encima, no se ven (con el dedo el CSS los deja fijos)
  ok(matchMedia('(hover:none)').matches || estilo(acc, 'opacity') === '0', 'sin el mouse encima están escondidos', estilo(acc, 'opacity'));
  const m0 = buscarModelo(c0.dataset.key);
  const antes = enPedidoModelo(m0);
  acc.querySelector('.mas').click();
  ok(enPedidoModelo(m0) !== antes && cards()[0].querySelector('.mas').getAttribute('aria-pressed') === String(!antes),
     'agregar lo suma al pedido y queda marcado');
  cards()[0].querySelector('.mas').click();
  ok(enPedidoModelo(m0) === antes, 'y tocarlo de nuevo lo saca');
  const wa = c0.querySelector('.foto .wa');
  ok(!WHATSAPP || (wa && decodeURIComponent(wa.href).includes(m0.desc.split(' ')[0])), 'el WhatsApp va con el producto escrito');

  /* ---- 6. Sin fotos cargadas, los botones vuelven a la etiqueta ---- */
  const guardado = CON_FOTOS;
  try{
    CON_FOTOS = false;
    const t = tarjeta(m0.rep || m0);
    ok(!t.querySelector('.foto') && t.querySelector('.pie .acciones .mas'), 'sin fotos, los botones quedan en la etiqueta');
  } finally {
    CON_FOTOS = guardado;
  }

  /* ---- 7. Salen de la caja (18/09) ----
     La foto arranca abajo, escondida en su recuadro, y sube cuando la tarjeta
     se revela. Se terminan las transiciones a mano: acá el reloj no corre. */
  const movido = matchMedia('(prefers-reduced-motion: no-preference)').matches;
  const tc = cards().find(c => c.querySelector('.foto img.ok')) || cards().find(c => c.querySelector('.foto img'));
  const im = tc.querySelector('.foto img');
  im.classList.add('ok');
  const bajada = () => parseFloat((estilo(im, 'translate') || '0 0').split(' ')[1] || 0);
  tc.classList.remove('vis');
  terminarTransiciones();
  ok(!movido || bajada() > 20, 'antes de revelarse, el producto está abajo, adentro de la caja', estilo(im, 'translate'));
  ok(estilo(tc.querySelector('.foto'), 'overflow') === 'hidden', 'y la caja no lo deja asomar por encima del nombre');
  tc.classList.add('vis');
  terminarTransiciones();
  ok(Math.abs(bajada()) < 1 && estilo(im, 'opacity') === '1', 'al revelarse sube a su lugar', estilo(im, 'translate'));
  // El escalonado va en --i, no en una demora de la tarjeta (que ya no anima nada)
  const nuevas = [0, 1, 2, 3].map(() => tarjeta(m0.rep || m0));
  nuevas.forEach(n => grid.appendChild(n));
  revelar(nuevas);
  ok(nuevas.every((n, i) => n.style.getPropertyValue('--i') === String(i)) && !nuevas.some(n => n.style.transitionDelay),
     'revelar escalona con --i', nuevas.map(n => n.style.getPropertyValue('--i')).join(','));
  nuevas.forEach(n => n.remove());
}

/* ---- 8. Los puntitos cambian la foto (18/09) ----
   Se busca un modelo donde cada color es una fila con su código: ahí
   preguntarle a la fila principal devolvía la misma foto para todos. */
function probarColores(fin){
  const filaDe = (m, n) => m.variantes.find(v => partirColores(v.color || '').some(x => norm(x) === norm(n))) || m.rep;
  const archivo = u => decodeURIComponent(String(u || '').split('/').pop().split('?')[0]);
  const candidata = cards().map(c => {
    const m = buscarModelo(c.dataset.key);
    const dots = [...c.querySelectorAll('.pintas i')];
    if(!m || dots.length < 2) return null;
    const fotos = dots.map(d => archivo(fotosDeColor(filaDe(m, d.dataset.color), d.dataset.color)[0]));
    return fotos[0] && fotos[1] && fotos[0] !== fotos[1] ? { c, m, dots, fotos } : null;
  }).filter(Boolean).sort((a, b) => new Set(b.m.variantes.map(v => v.codigo)).size - new Set(a.m.variantes.map(v => v.codigo)).size)[0];
  if(!candidata){ R.push('  --  hoy no hay en Celulares un modelo con fotos distintas por color'); entrarAlRubro(''); return fin(); }
  const { c, m, dots, fotos } = candidata;
  const foto = c.querySelector('.foto');
  const alt = () => foto.querySelector('img.alt');
  const muestra = k => foto.classList.contains('otro') && alt() && archivo(alt().src) === fotos[k];

  /* Las fotos se bajan antes de probar. Acá el reloj corre más rápido que la
     red: sin esto, una foto que no estaba en caché "tardaba" más de los 4
     segundos de espera aunque llegara enseguida. */
  const bajar = u => new Promise(r => { const i = new Image(); i.onload = i.onerror = r; i.src = u; });
  const urls = dots.slice(0, 2).flatMap(d => fotosDeColor(filaDe(m, d.dataset.color), d.dataset.color)).flatMap(u => [fotoChica(u), u]);
  Promise.all(urls.map(bajar)).then(() => {
  dots[1].dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
  cuando(() => muestra(1), () => {
    ok(muestra(1), 'con el mouse, pasar por un color muestra su foto', m.desc + ' → ' + dots[1].dataset.color + ' ' + (alt() && archivo(alt().src)));
    ok(dots[1].classList.contains('elegido'), 'y el puntito queda marcado');
    // Sin demora: con la de la entrada, la principal tardaba en apagarse y se veían las dos
    const principal = foto.querySelector('img:not(.alt)');
    ok(getComputedStyle(principal).transitionDelay.split(',').every(d => parseFloat(d) === 0),
       'al cambiar de color la principal se apaga sin demora', getComputedStyle(principal).transitionDelay);
    terminarTransiciones();
    ok(alt() && !alt().classList.contains('ok') && getComputedStyle(principal).opacity === '0',
       'y queda apagada mientras se ve la otra (si no, se superponen)',
       'principal ' + getComputedStyle(principal).opacity + ' / otra ' + (alt() && getComputedStyle(alt()).opacity) + ' / ' + (alt() && alt().className) + ' / ' + foto.className);
    dots[0].dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
    cuando(() => muestra(0), () => {
      ok(muestra(0), 'otro color, otra foto: cada uno se le pide a la fila que lo vende', dots[0].dataset.color + ' ' + (alt() && archivo(alt().src)));
      c.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, pointerType: 'mouse', relatedTarget: document.body }));
      terminarTransiciones();
      ok(!foto.classList.contains('otro') && !c.querySelector('.pintas i.elegido'), 'al salir de la tarjeta vuelve la foto principal');
      // Lo que se VE, no solo las clases: la del color apagada y la principal prendida
      ok(getComputedStyle(alt()).opacity === '0' && getComputedStyle(foto.querySelector('img:not(.alt)')).opacity === '1',
         'y la del color queda apagada: no se superponen',
         'principal ' + getComputedStyle(foto.querySelector('img:not(.alt)')).opacity + ' / otra ' + getComputedStyle(alt()).opacity);

      // Con el dedo: tocar el puntito cambia la foto y NO abre la ficha
      quitarFicha();
      dots[1].click();
      cuando(() => muestra(1), () => {
        ok(muestra(1) && !FICHA_MODELO, 'con el dedo, tocar el puntito cambia la foto y no abre la ficha', FICHA_MODELO && FICHA_MODELO.desc);
        c.querySelector('.nombre').click();
        ok(FICHA_MODELO === m, 'tocar el resto de la tarjeta sí abre la ficha');
        quitarFicha();
        entrarAlRubro('');
        fin();
      });
    });
  });
  });
}
