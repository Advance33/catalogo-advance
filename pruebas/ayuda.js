// La ayuda del final de la portada (17/09): las ocho preguntas numeradas a un
// lado, la respuesta al otro y, al pie, el pedido de lo que no está en el
// catálogo. Reemplazó a la caja "¿No lo encontrás?" y a los desplegables de
// "Preguntas frecuentes", que eran dos piezas claras una encima de la otra.
// Se prueba que diga lo que dice la configuración, que cambiar de pregunta no
// haga saltar la página y que el casillero mande lo escrito por WhatsApp.
// Desde el 23/10/2026, también el horario de la respuesta de retiro
// (decisión 4A de Benja: con cita previa, sábados de 11:15 a 14:45), y la
// respuesta de envíos con la moto por cordón (decisión 3 de Benja, 23/10).
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const $$ = s => document.querySelectorAll(s);

const esperar = setInterval(() => {
  if(!MODELOS.length || !$$('#cats .chip').length || !document.getElementById('ayuda')) return;
  clearInterval(esperar);
  for(let i=1;i<5000;i++) clearInterval(i);
  try{ correrPruebas(); }catch(e){ R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; }
  try{ pararPaseos(); pararOfertas(); pararNuevos(); pararMarcas(); pararMundos(); }catch(e){}
  for(let i=1;i<5000;i++) clearInterval(i);
  const pre=document.createElement('pre'); pre.id='RESULTADO';
  pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
  document.body.appendChild(pre);
}, 150);

const sec = () => $('ayuda');
const preguntas = () => [...sec().querySelectorAll('.ay-p')];
const respuestas = () => [...sec().querySelectorAll('.ay-r')];
const alAire = () => respuestas().findIndex(r => r.classList.contains('ve'));

function correrPruebas(){
  /* ---- 1. Dónde va y qué muestra ---- */
  const hijos = [...$('extras').children];
  ok(hijos[hijos.length - 1] === sec(), 'es lo último de la portada');
  ok(!$('extras').querySelector('.pedilo, .faq'), 'las dos cajas viejas ya no están');

  const preg = preguntas(), resp = respuestas();
  ok(preg.length === PREGUNTAS.length, 'una pregunta por cada una de la configuración',
     preg.length + ' de ' + PREGUNTAS.length);
  const numeros = preg.map(b => b.querySelector('.ay-n').textContent);
  ok(numeros.every((n, i) => n === String(i + 1).padStart(2, '0')), 'van numeradas en orden', numeros.join(' '));
  const mal = preg.filter((b, i) => !b.textContent.includes(PREGUNTAS[i].p));
  ok(!mal.length, 'y dicen la pregunta de la configuración', mal.map(b => b.textContent.trim()).join(' | ') || 'todas bien');

  /* ---- 2. Cada respuesta es la suya ---- */
  const malR = [];
  PREGUNTAS.forEach((q, i) => {
    const r = resp[i];
    // h3 desde el 29/09: el bloque es un h2 y cada pregunta cuelga de el
    if(!r.querySelector('h3') || !r.querySelector('h3').textContent.includes(q.p)) malR.push(q.p + ': sin título');
    // `despues` (23/10/2026): los párrafos que van después de la tabla del envío
    [...(q.r || []), ...(q.despues || [])].forEach(t => { if(!r.textContent.includes(t)) malR.push(q.p + ': falta un párrafo'); });
    (q.lista || []).forEach(t => { if(!r.textContent.includes(t)) malR.push(q.p + ': falta "' + t + '"'); });
    if(!!q.lista !== !!r.querySelector('ul')) malR.push(q.p + ': la lista');
    if(!!q.link !== !!r.querySelector('a')) malR.push(q.p + ': el link');
  });
  ok(!malR.length, 'cada respuesta dice lo de la configuración, con su lista y su link',
     malR.slice(0, 3).join(' | ') || 'todas bien');
  // La garantía es por producto: prometer un plazo fijo es un problema con el cliente
  ok(!/\b(1|un|uno)\s+a[ñn]o\b/i.test(sec().textContent), 'ninguna promete un plazo fijo de garantía');
  ok(!/últimas unidades|quedan pocas|stock limitado|por tiempo limitado/i.test(sec().textContent),
     'no inventa urgencias');

  /* ---- 3. Se ve una sola, y es la marcada ---- */
  // aria-expanded desde el 29/09: cada pregunta es un desplegable, no un
  // boton que se prende (guardas-b6-portada.js, [136])
  const marcadas = () => preg.filter(b => b.getAttribute('aria-expanded') === 'true').map(b => Number(b.dataset.ay));
  ok(respuestas().filter(r => r.classList.contains('ve')).length === 1, 'se ve una sola respuesta');
  ok(marcadas().length === 1 && marcadas()[0] === alAire() && alAire() === ayIndice,
     'la marcada en la lista es la que se ve', ayIndice);

  /* ---- 4. Cambiar de pregunta ---- */
  preg[3].click();
  ok(ayIndice === 3 && alAire() === 3 && marcadas()[0] === 3, 'tocar una pregunta la abre', ayIndice);
  ok(respuestas()[3].textContent.includes(PREGUNTAS[3].r[0]), 'y el panel muestra su respuesta');

  // Con el dedo, pasar por encima no tiene que abrir nada: el pointerover llega
  // junto con el toque y abriría la pregunta de al lado.
  preg[6].dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'touch' }));
  ok(ayIndice === 3, 'con el dedo, pasar por encima no cambia de pregunta');
  preg[6].dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
  ok(ayIndice === 6 && alAire() === 6, 'con el mouse alcanza con pasar por encima', ayIndice);

  /* ---- 5. Cambiar de pregunta no hace saltar la página ----
     Las ocho respuestas están apiladas en la misma celda: el alto es el de la
     más larga y no se mueve. (En el celular no se apilan, y ahí no importa:
     la respuesta queda debajo de la lista, no por encima del dedo.) */
  ok(getComputedStyle(respuestas()[0]).display !== 'none', 'en pantalla ancha están apiladas');
  const pila = sec().querySelector('.ay-pila');
  const masAlta = Math.max(...respuestas().map(r => r.offsetHeight));
  ok(pila.offsetHeight <= masAlta + 2, 'ocupan todas el mismo lugar, no una debajo de la otra',
     pila.offsetHeight + ' vs ' + masAlta);
  const altos = PREGUNTAS.map((_, i) => { elegirPregunta(i); return Math.round(sec().getBoundingClientRect().height); });
  ok(new Set(altos).size === 1, 'el alto no cambia de una pregunta a otra', altos.join(','));

  /* ---- 6. En el celular, la respuesta va debajo de la pregunta ----
     Con la lista de ocho, tenerla siempre al pie obligaba a bajar hasta el
     final para leerla. Se simula el celular cambiando ayEnCelular: achicar la
     ventana del headless no es opción, la suite entera corre a 1920. */
  const comoEsta = ayEnCelular;
  try{
    ayEnCelular = () => true;
    elegirPregunta(2);
    const sueltas = () => [...sec().querySelectorAll('.ay-lista .ay-r')];
    ok(sueltas().length === 1 && sueltas()[0].dataset.ay === '2', 'en el celular sale una sola de la pila', sueltas().length);
    ok(sueltas()[0].previousElementSibling === sec().querySelector('.ay-p[data-ay="2"]'),
       'y queda justo debajo de su pregunta');
    elegirPregunta(5);
    ok(sueltas().length === 1 && sueltas()[0].dataset.ay === '5', 'al cambiar, la anterior vuelve a la pila');
  } finally {
    ayEnCelular = comoEsta;
  }
  acomodarAyuda();
  const enPila = [...sec().querySelectorAll('.ay-pila > .ay-r')];
  ok(enPila.length === PREGUNTAS.length && enPila.every((r, i) => Number(r.dataset.ay) === i),
     'en pantalla ancha vuelven todas a la pila, en orden', enPila.length);

  /* ---- 7. Los links ---- */
  const conLink = PREGUNTAS.findIndex(q => q.link);
  if(conLink >= 0){
    const a = respuestas()[conLink].querySelector('a');
    ok(a.getAttribute('href') === PREGUNTAS[conLink].link[1], 'el link de la respuesta es el de la configuración');
    ok(a.target === '_blank' && /noopener/.test(a.rel), 'y abre aparte sin dar acceso a la página');
  }
  const otra = sec().querySelector('.ay-otra a');
  ok(!WHATSAPP || (otra && otra.href.startsWith('https://wa.me/' + WHATSAPP)),
     '"¿Te quedó otra duda?" va al WhatsApp de la tienda');

  /* ---- 8. Pedí lo que no está ---- */
  const inp = $('pedilo-q'), bot = $('pedilo-btn');
  ok(!!inp && !!bot && sec().contains(inp), 'el casillero está dentro del mismo bloque');
  ok(bot.disabled, 'arranca apagado: sin texto no hay nada que consultar');
  inp.value = 'so';
  inp.dispatchEvent(new Event('input'));
  ok(bot.disabled, 'con dos letras sigue apagado', inp.value);
  inp.value = 'Sony A7 IV';
  inp.dispatchEvent(new Event('input'));
  ok(!bot.disabled, 'y se prende al escribir algo', inp.value);
  // Que el botón mande lo escrito: se espía el open en vez de abrir una pestaña
  const abrir = window.open;
  let salio = '';
  window.open = u => { salio = u; return null; };
  try{ bot.click(); } finally { window.open = abrir; }
  ok(!WHATSAPP || salio.startsWith('https://wa.me/' + WHATSAPP), 'el botón abre el WhatsApp de la tienda');
  ok(decodeURIComponent(salio).includes('Estoy buscando: Sony A7 IV'), 'con lo que escribió el cliente', decodeURIComponent(salio).slice(-60));

  /* ---- 9. Entra y sale con la portada ---- */
  const elegida = ayIndice;
  [...$$('#cats .chip')].find(c => c.dataset.cat).click();
  // Fuera de la portada se esconde pero no se borra: volver es instantaneo
  ok($('extras').hidden, 'al entrar a un rubro no se ve', filtros.cat);
  [...$$('#cats .chip')].find(c => c.dataset.cat === '').click();
  ok(!$('extras').hidden && !!$('ayuda'), 'y al volver a la portada está de nuevo');
  ok(ayIndice === elegida && alAire() === elegida, 'con la misma pregunta abierta', ayIndice);

  /* ---- 10. El horario (23/10/2026, decisión 4A de Benja) ----
     El texto decidido, tal cual, en la respuesta de retiro: siempre con cita
     previa, y el sábado de 11:15 a 14:45 (ya no "11 a 14"). Se escribe acá
     a mano a propósito: si alguien lo cambia en PREGUNTAS sin que Benja lo
     decida, esta prueba lo avisa. */
  const HORARIO_4A = 'Atendemos solo con cita previa, de lunes a viernes de 10 a 18 y sábados de 11:15 a 14:45.';
  const iDonde = PREGUNTAS.findIndex(q => q.nav === 'donde');
  ok(iDonde >= 0 && respuestas()[iDonde].textContent.includes(HORARIO_4A),
     '[4A] la respuesta de retiro dice el horario decidido, con cita previa',
     iDonde >= 0 ? PREGUNTAS[iDonde].r.join(' ').slice(0, 120) : 'sin la pregunta de "Dónde estamos"');
  const visible = [sec(), $('nosotros'), $('pie-id')].filter(Boolean).map(x => x.textContent).join(' ');
  const viejo = /\b11\s*(a|-|–)\s*14\b/i.exec(visible);
  ok(!viejo, '[4A] en las preguntas, "Quiénes somos" y el pie no queda el sábado viejo de 11 a 14',
     viejo ? visible.slice(Math.max(0, viejo.index - 30), viejo.index + 12) : 'nada');

  probarEnvios();
}

/* ---- 11. Los envíos (23/10/2026, decisión 3 de Benja) ----
   El texto del estándar, tal cual, con la tabla de la moto en el medio: lo
   que cuesta cada zona, en este orden. Se escribe acá a mano a propósito: si
   alguien cambia un precio o el texto sin que Benja lo decida, esta prueba lo
   avisa. Las localidades de cada cordón van en "¿En qué cordón estoy?",
   cerrado al entrar. El "50 % de recargo" de la lluvia es del envío: la regla
   de Pedro del 03/10 (ni % ni "recargo") es solo para el interés de las
   cuotas, y la mira decision-cuotas.js sobre los textos de las cuotas. */
function probarEnvios(){
  const ANTES = 'En CABA y GBA te lo llevamos en moto en el día:';
  const TABLA = [['CABA', '$12.000'], ['1er cordón', '$15.000'], ['2do cordón', '$25.000'],
                 ['3er cordón', '$45.000'], ['4to cordón', '$55.000']];
  const DESPUES = ['Los días de lluvia, 50 % de recargo.',
                   'Al resto del país lo mandamos por la paquetería que elijas, recomendamos Andreani: el costo y la demora los pone la empresa.'];
  const i = PREGUNTAS.findIndex(q => q.p === '¿Hacen envíos?');
  ok(i >= 0, '[envíos] está la pregunta «¿Hacen envíos?»');
  if(i < 0) return;
  const r = respuestas()[i];
  const txt = el => (el ? el.textContent : '').replace(/\s+/g, ' ').trim();
  const ps = [...r.querySelectorAll(':scope > p')].map(txt);
  ok(JSON.stringify(ps) === JSON.stringify([ANTES, ...DESPUES]),
     '[envíos] dice el texto del estándar, tal cual: la moto, la lluvia y el resto del país', ps.join(' | ').slice(0, 160));
  const tabla = r.querySelector('table.ay-tabla');
  const filas = tabla ? [...tabla.querySelectorAll('tr')].map(tr => [txt(tr.querySelector('th')), txt(tr.querySelector('td'))]) : [];
  ok(JSON.stringify(filas) === JSON.stringify(TABLA), '[envíos] la tabla de la moto: cada zona con su precio, en orden',
     filas.map(f => f.join(' ')).join(' · '));
  const pAntes = [...r.querySelectorAll(':scope > p')].find(p => txt(p) === ANTES);
  const pLluvia = [...r.querySelectorAll(':scope > p')].find(p => txt(p) === DESPUES[0]);
  const despues = (a, b) => !!a && !!b && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  ok(despues(pAntes, tabla) && despues(tabla, pLluvia), '[envíos] la tabla va entre «en el día:» y la lluvia');

  // ¿En qué cordón estoy?
  const zonas = r.querySelector('details.ay-zonas');
  ok(!!zonas && txt(zonas.querySelector('summary')) === '¿En qué cordón estoy?' && !zonas.open,
     '[envíos] las localidades van en «¿En qué cordón estoy?», cerrado al entrar');
  if(zonas){
    const cordones = [...zonas.querySelectorAll('dt')].map(dt => [txt(dt), txt(dt.nextElementSibling).replace(/\.$/, '').split(', ')]);
    ok(JSON.stringify(cordones.map(c => [c[0], c[1].length])) === JSON.stringify([['1er cordón', 14], ['2do cordón', 20], ['3er cordón', 25], ['4to cordón', 5]]),
       '[envíos] los cuatro cordones, con sus 14, 20, 25 y 5 localidades', cordones.map(c => c[0] + ': ' + c[1].length).join(' · '));
    const todas = cordones.flatMap(c => c[1]);
    ok(new Set(todas).size === todas.length, '[envíos] ninguna localidad está en dos cordones', todas.length + ' localidades');
    const en = (n, l) => (cordones[n - 1] || [, []])[1].includes(l);
    ok(en(1, 'Olivos') && en(1, 'Wilde') && en(2, 'José León Suárez') && en(2, 'Aldo Bonzi') && en(3, 'Nordelta') && en(3, 'Don Torcuato') && en(4, 'La Plata'),
       '[envíos] cada localidad en su cordón (José León Suárez en el 2º hasta que Benja confirme)');
    ok(/Si tu localidad no está, consultanos por WhatsApp\./.test(txt(zonas)), '[envíos] la que no está se consulta por WhatsApp');
    ok(!zonas.querySelector('ul') && !zonas.querySelector('a'), '[envíos] sin viñetas ni links de más en la respuesta');
  }

  // Abierta, la tabla y las localidades entran en la respuesta, sin pasarse de ancho
  const antes = ayIndice;
  elegirPregunta(i);
  if(zonas) zonas.open = true;
  const ancho = r.getBoundingClientRect().right + 1;
  const pasados = [tabla, zonas].filter(Boolean).filter(el => el.getBoundingClientRect().right > ancho || el.scrollWidth > el.clientWidth + 1);
  ok(!pasados.length, '[envíos] la tabla y las localidades entran en el ancho de la respuesta', pasados.map(el => el.className).join(', ') || 'entran');
  if(zonas) zonas.open = false;
  elegirPregunta(antes);

  // La ficha y el pedido dicen lo mismo: moto en CABA y GBA, paquetería para el resto
  ok(/CABA y GBA/.test(SERVICIO.envio[1]) && /moto/.test(SERVICIO.envio[1]) && /paqueter/.test(SERVICIO.envio[1]),
     '[envíos] el detalle de la ficha y del pedido (SERVICIO) nombra la moto y la paquetería', SERVICIO.envio[1]);
  const todo = [sec().textContent, SERVICIO.envio.join(' '), $('pie-id') ? $('pie-id').textContent : ''].join(' ');
  ok(!/v[ií]a ?cargo|\b\d+\s*a\s*\d+\s*d[ií]as\b/i.test(todo), '[envíos] nada promete otra empresa ni otra demora');
}
