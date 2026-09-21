// La tarjeta de producto de la grilla (17/09). Pedro la armó en un muestrario,
// eligiendo de a una cosa: foto sin caja, precio en etiqueta oscura, cinco por
// fila, botones al pasar el mouse, y a la vista el regalo y el precio en pesos.
// El 21/09 se sumó: en la tarjeta va SOLO el nombre del modelo, más grande, y
// ni la memoria ni los colores, que se ven adentro de la ficha.
// Esta tanda fija esas elecciones, para que un cambio de otro lado no las
// desarme sin que nadie se dé cuenta.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const $$ = s => document.querySelectorAll(s);

const esperar = setInterval(() => {
  if(!MODELOS.length || !$$('#cats .chip').length || typeof INDICE_FOTOS === 'undefined' || !INDICE_FOTOS) return;
  clearInterval(esperar);
  for(let i=1;i<5000;i++) clearInterval(i);
  try{ correrPruebas(); }catch(e){ R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; }
  terminar();
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
  /* Los colores salieron de la tarjeta el 21/09 y se ven adentro de la ficha,
     en la tira al costado de la foto. Con ellos se fue tambien lo que colgaba:
     pasar el mouse por un color y ver esa foto en la grilla. */
  const conColor = cs.filter(c => { const p = buscarModelo(c.dataset.key); return p && pintas(p.color || '').some(x => x.hex); });
  ok(conColor.length > 0 && !cs.some(c => c.querySelector('.pintas')),
     'los colores no estan en la tarjeta', conColor.length + ' modelos con color');
  if(conColor.length){
    abrirFicha(conColor[0].dataset.key, null);
    const tira = document.querySelectorAll('#ficha .fi-pintas button, #ficha #fi-color-txt');
    ok(tira.length > 0, 'y si adentro de la ficha',
       buscarModelo(conColor[0].dataset.key).desc + ': ' + tira.length + ' elemento(s)');
    cerrarFicha();
  }
  ok(!cs.some(c => c.querySelector('.meta, .specs, .opciones, .incluye')),
     'no quedaron los colores escritos, las capacidades, las opciones ni la caja verde');
  ok(!TC || cs.every(c => c.querySelector('.pie .ars')), 'el precio en pesos va en la etiqueta');

  /* ---- 2b. En la tarjeta, solo el nombre del modelo (21/09) ----
     Pedro: "aca figura la memoria de los celulares y en otros no". Pasaba
     porque el nombre lo escribe el proveedor: una fila sola llegaba con la
     capacidad adentro ("iPhone 15 Plus 128GB (Yellow)") y un modelo que agrupa
     dos capacidades se quedaba sin ella. Ahora en la grilla va el modelo y la
     capacidad se elige adentro de la ficha. El color tampoco esta en el texto:
     ya se ve en los puntitos de al lado de la marca. */
  const CAP = /\d+(?:[.,]\d+)?\s*(?:GB|TB)\b/i;
  const conMemoria = cs.filter(c => CAP.test(c.querySelector('.nombre').textContent || ''));
  ok(!conMemoria.length, 'en la tarjeta el nombre no trae la memoria',
     conMemoria.slice(0, 3).map(c => '"' + c.querySelector('.nombre').textContent.trim() + '"').join(' | ')
     || cs.length + ' tarjetas');
  ok(cs.every(c => (c.querySelector('.nombre').textContent || '').trim().length > 1),
     'y ningun nombre se quedo vacio al recortarlo');

  /* Lo mismo con Sim / E-Sim (22/09). La tarjeta nombra al modelo; cual de
     las dos versiones se lleva se elige adentro. Ojo que en los BOTONES de la
     ficha la palabra tiene que quedarse -- son dos productos con precios
     distintos -- y eso lo cuida la tanda de sim.

     El 4G y el 5G NO entran en el recorte: Pedro los dejo como estaban,
     porque ahi son parte de como se llama el producto, no una version. */
  const RE_SIM = /\bsim\b|\be-?\s?sim\b/i;
  const dicenSim = cs.filter(c => RE_SIM.test(c.querySelector('.nombre').textContent || ''));
  ok(!dicenSim.length, 'en la tarjeta el nombre no dice Sim ni E-Sim',
     dicenSim.slice(0, 3).map(c => '"' + c.querySelector('.nombre').textContent.trim() + '"').join(' | ')
     || cs.length + ' tarjetas');
  /* Que no sea vacuo: tiene que haber a quien recortarle. Si manana la
     planilla deja de escribirlo, esta comprobacion avisa en vez de callarse. */
  const traianSim = MODELOS.filter(m => RE_SIM.test(m.desc || ''));
  ok(traianSim.length > 0 && traianSim.every(m => !RE_SIM.test(m.titulo || '')),
     'y los que lo traian en la descripcion quedaron con el modelo solo',
     traianSim.slice(0, 3).map(m => '"' + m.desc + '" -> "' + m.titulo + '"').join(' | ')
     || 'hoy ninguna fila lo trae');
  const RE_G = /\b[45]\s?G\b/i;
  const conG = MODELOS.filter(m => RE_G.test(m.desc || ''));
  const perdieronG = conG.filter(m => !RE_G.test(m.titulo || ''));
  ok(conG.length > 0 && !perdieronG.length, 'el 4G y el 5G se quedan donde estaban',
     perdieronG.slice(0, 3).map(m => '"' + m.desc + '" -> "' + m.titulo + '"').join(' | ')
     || conG.length + ' modelos lo conservan');
  /* Y se nota: es lo que el cliente busca en la grilla. Desde el 21/09 va en
     la letra de display y en mayusculas, la misma de los titulos de rubro y de
     los precios: Pedro la eligio de un muestrario de seis. */
  const h2 = cs[0].querySelector('.nombre');
  const tam = parseFloat(estilo(h2, 'font-size'));
  ok(tam >= 16, 'el nombre se lee grande', tam + 'px');
  ok(tam > parseFloat(estilo(cs[0].querySelector('.marca'), 'font-size')),
     'y manda sobre la marca');
  ok(estilo(h2, 'text-transform') === 'uppercase', 'va en mayusculas',
     estilo(h2, 'text-transform'));
  /* La misma familia que los titulos de rubro: si alguien le cambia la letra a
     uno de los dos, la grilla deja de hablar el idioma de la pagina. */
  const tituloRubro = document.getElementById('sec-titulo');
  ok(!tituloRubro || estilo(h2, 'font-family') === estilo(tituloRubro, 'font-family'),
     'con la misma letra que los titulos de rubro',
     estilo(h2, 'font-family').split(',')[0]);

  /* Que la capacidad siga estando donde se decide: en la ficha. Con una sola
     va en los chips de arriba; con varias, en las pestañas de memoria. */
  const conCaps = MODELOS.find(m => (m.variantes || [m]).some(v => CAP.test(v.desc || '')));
  if(conCaps){
    abrirFicha(clave(conCaps.rep), null);
    const d = document.getElementById('ficha');
    const texto = [...d.querySelectorAll('.fi-datos .specs span, .fi-ops .fi-op b')]
                    .map(x => x.textContent).join(' ');
    ok(CAP.test(texto), 'y adentro de la ficha si figura, en los chips o en las pestañas',
       conCaps.desc + ': ' + texto.replace(/\s+/g, ' ').trim().slice(0, 60));
    cerrarFicha();
  }

  /* Dos tarjetas con el mismo nombre y distinto precio serian peor que un
     nombre largo. Por eso el recorte se decide mirando a TODOS los modelos:
     los Ray-Ban Meta, donde el parentesis del armazon es lo unico que los
     separa, se quedan con el nombre entero. */
  const porTitulo = new Map();
  MODELOS.forEach(m => {
    const t = m.titulo || m.desc;
    if(!porTitulo.has(t)) porTitulo.set(t, []);
    porTitulo.get(t).push(m);
  });
  const chocan = [...porTitulo.entries()].filter(([, l]) =>
    l.length > 1 && l.some(x => x.desc !== l[0].desc));
  ok(!chocan.length, 'y el recorte nunca deja dos modelos distintos llamandose igual',
     chocan.slice(0, 3).map(([t, l]) => '"' + t + '" x' + l.length).join(' | ')
     || MODELOS.length + ' modelos');

  /* Se compara contra el original: "EOS R100 Kit 18-45 / 55-210" ya viene con
     esa barra de la planilla y esta bien. Lo que no puede pasar es que la
     limpieza AGREGUE una que antes no estaba. */
  const barras = t => (String(t).match(/\s[\/·–-]\s/g) || []).length;
  const rotos = MODELOS.filter(m => {
    const n = nombreSinMemoria(m.desc);
    return !n.trim() || /\s{2,}/.test(n) || barras(n) > barras(m.desc) ||
           /^[\/·–-]|[\/·–-]$/.test(n.trim());
  });
  ok(!rotos.length, 'en ningun rubro el nombre queda partido al sacarle la memoria',
     rotos.slice(0, 3).map(m => '"' + m.desc + '" -> "' + nombreSinMemoria(m.desc) + '"').join(' | ')
     || MODELOS.length + ' modelos');

  /* El color tampoco: ya esta en los puntitos de al lado de la marca, y
     repetirlo entre parentesis era la otra mitad de lo que emparejaba mal la
     fila. Solo cuenta cuando el parentesis ES exactamente sus colores; los que
     dicen otra cosa ("Pack x4", "Mini 3 Pro") se quedan. */
  const repiteColor = MODELOS.filter(m => {
    const par = (/\(([^)]*)\)\s*$/.exec(nombreSinMemoria(m.desc)) || [])[1];
    if(!par) return false;
    const suyos = partirColores(m.color || '').map(norm);
    const partes = partirColores(par).map(norm);
    return partes.length && partes.every(p => suyos.includes(p));
  });
  ok(!repiteColor.length, 'ni deja entre parentesis el color, que ahora se ve en la ficha',
     repiteColor.slice(0, 3).map(m => '"' + nombreSinMemoria(m.desc) + '"').join(' | ')
     || MODELOS.length + ' modelos');

  /* El recorte es SOLO para mostrar: el nombre entero sigue siendo el de la
     planilla, que es lo que viaja al mensaje de WhatsApp, al pedido y al
     buscador. Acortarlo ahi seria perder el dato. */
  if(conCaps){
    ok(CAP.test(conCaps.desc) || (conCaps.variantes || []).some(v => CAP.test(v.desc)),
       'el nombre completo no se toca: sigue yendo al WhatsApp y al pedido',
       conCaps.desc);
    ok(decodeURIComponent(mensajeWA(conCaps.rep)).includes(conCaps.rep.desc),
       'y el mensaje lo nombra entero', conCaps.rep.desc);
  }

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
