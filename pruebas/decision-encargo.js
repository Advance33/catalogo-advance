// Metodología de encargo (Benja, 03/11/2026; datos de ADVAPP, contrato
// encargo/1). Con datos de ejemplo, escritos aparte de la pagina:
//   el archivo  lo que no sirve no sale: otro contrato o la lista vacia = sin
//               bloque; sin codigo ENC-####, sin nombre, sin marca, sin precio
//               entero o repetido = ese producto no sale; foto solo https.
//   la portada  el bloque va entre Recien llegados y Quienes somos. Es la
//               version B del muestrario (Benja 04/11: «B, titulo 1, pasos 1,
//               boton 1, plazo sí»): el titulo que manda ADVAPP, el total
//               grande (el plazo del ultimo paso: se cuentan desde la seña),
//               los pasos numerados con su plazo (el deposito con su «puede
//               variar», 04/11), lo que gana el cliente (el
//               precio final con viaje y aduana, y que si pesa mas puede haber
//               diferencia: Benja 04/11) y cada producto con marca, nombre,
//               detalle, garantia (si viene), precio en dolares tal cual y,
//               abajo, los pesos del catalogo (precioARS; sin dolar, nada), y el
//               link a la publicacion si viene (04/11, opcion A); el
//               codigo no se ve, va en el mensaje. El pago en un renglon: con
//               seña y el resto cuando llega (Benja 03/11: «Sí, con seña»), los
//               medios, y el monto de las cuotas por WhatsApp: las de un
//               encargo no son las del catalogo (Benja 04/11). Sin montos,
//               planes ni porcentajes; nada de demoras (va por WhatsApp). Y
//               «Pedir cotizacion» para lo que no esta; si pasa por debajo de
//               un flotante (WhatsApp o Marian), los dos se esconden (04/11).
//   WhatsApp    «Hola! Me interesa … (ENC-0001), por encargo, a USD 470.» y
//               la medicion lo anota con desde "encargo" y el codigo.
//   la carga    si ADVAPP falla, el bloque no esta; si llega, se suma solo.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);

const esperaEN = setInterval(() => {
  if(!MODELOS.length || !FUENTE || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperaEN);
  for(let i=1;i<5000;i++) clearInterval(i);
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; })
    .finally(() => {
      try{ pararPaseos(); pararOfertas(); pararMundos(); pararNuevos(); pararMarcas(); }catch(e){}
      for(let i=1;i<5000;i++) clearInterval(i);
      const pre=document.createElement('pre'); pre.id='RESULTADO';
      pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
      document.body.appendChild(pre);
    });
}, 150);

const enDormir = ms => new Promise(r => setTimeout(r, ms));
const enTxt = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';

// El ejemplo de ADVAPP del 03/11 (datos inventados), mas uno con garantia
const EN_EJEMPLO = {
  contrato: 'encargo/1', generado_en: '2026-11-03T17:59:13.873Z', seccion: 'Metodología de encargo',
  pasos: [{ paso: 'Seña', plazo: 'Hoy' }, { paso: 'Compramos', plazo: '24 a 48 h' }, { paso: 'Depósito EEUU', plazo: '3 a 5 días' },
          { paso: 'Vuela y aduana', plazo: '5 a 8 días' }, { paso: 'En tu puerta', plazo: '7 a 14 días' }],
  productos: [
    { id: 'ENC-0001', nombre: 'Sony WH-1000XM5', marca: 'Sony', detalle: 'Auriculares inalámbricos con cancelación de ruido · Negro',
      garantia: '', precio_usd: 470, foto: 'https://www.sony.com/image/ejemplo.png', link: 'https://tienda.example/sony-wh-1000xm5?id=7', revisado: '2026-11-02' },
    { id: 'ENC-0002', nombre: 'Kindle Paperwhite 16 GB', marca: 'Kindle', detalle: '', garantia: '', precio_usd: 265, foto: '', revisado: '2026-10-30' },
    { id: 'ENC-0003', nombre: 'Garmin Forerunner 265', marca: 'Garmin', detalle: '', garantia: '6 meses', precio_usd: 1015, foto: 'http://no-https.example/foto.png', link: 'javascript:alert(1)', revisado: '2026-11-03' },
  ],
};
const enCopia = () => JSON.parse(JSON.stringify(EN_EJEMPLO));

async function correrPruebas(){
  // Que termine la carga del arranque antes de tocar nada (si no, pisa ENCARGO)
  const real = await cargarEncargo();
  info('lo que contesta hoy ADVAPP: ' + (real ? real.productos.length + ' producto(s)' : 'nada (sin bloque)'));
  await enDormir(ENCARGO_ESPERA_MS + 500);
  const e0 = ENCARGO, f0 = window.fetch;
  try{
    probarElArchivo();
    await probarLaPortada();
    await probarLaCarga();
  } finally {
    window.fetch = f0;
    ENCARGO = e0; FIRMA_EXTRAS = ''; pintarExtras();
  }
}

/* ---- El archivo ---- */
function probarElArchivo(){
  const d = validarEncargo(enCopia());
  ok(d && d.seccion === 'Metodología de encargo' && d.pasos.length === 5 && d.productos.length === 3,
     'el ejemplo de ADVAPP pasa entero: titulo, 5 pasos y 3 productos', d && d.productos.map(p => p.id).join(','));
  ok(d && d.productos[0].precio === 470 && d.productos[0].foto === 'https://www.sony.com/image/ejemplo.png' &&
     d.productos[1].foto === '' && d.productos[2].foto === '', 'precio tal cual y foto solo https (la http se descarta, el producto queda)');
  ok(d && d.productos[0].link === 'https://tienda.example/sony-wh-1000xm5?id=7' && d.productos[1].link === '' && d.productos[2].link === '',
     'el link de la publicacion: solo http(s); sin link o con otro, nada (Benja 04/11, opcion A)', d && d.productos.map(p => p.link).join(' | '));
  ok(validarEncargo({ ...enCopia(), contrato: 'encargo/1.1' }) !== null, 'un encargo/1.x que suma campos tambien sirve');
  ok(validarEncargo({ ...enCopia(), contrato: 'encargo/2' }) === null && validarEncargo(null) === null &&
     validarEncargo({ ...enCopia(), productos: [] }) === null, 'otro contrato, nada o la lista vacia = sin bloque');
  const malos = enCopia();
  malos.productos.push(
    { id: 'ENC-12', nombre: 'Id corto', marca: 'X', precio_usd: 100 },
    { id: 'ENC-0010', nombre: 'Sin marca', marca: '', precio_usd: 100 },
    { id: 'ENC-0011', nombre: '', marca: 'Sin nombre', precio_usd: 100 },
    { id: 'ENC-0012', nombre: 'Precio con centavos', marca: 'X', precio_usd: 252.5 },
    { id: 'ENC-0013', nombre: 'Precio cero', marca: 'X', precio_usd: 0 },
    { id: 'ENC-0001', nombre: 'Repetido', marca: 'X', precio_usd: 100 });
  const dm = validarEncargo(malos);
  ok(dm && dm.productos.map(p => p.id).join(',') === 'ENC-0001,ENC-0002,ENC-0003' && dm.productos[0].nombre === 'Sony WH-1000XM5',
     'sin codigo ENC-####, sin marca, sin nombre, sin precio entero o repetido: ese producto no sale', dm && dm.productos.map(p => p.id).join(','));
  ok(validarEncargo({ ...enCopia(), seccion: '' }).seccion === 'Metodología de encargo', 'sin titulo, «Metodología de encargo»');
}

/* ---- La portada ---- */
async function probarLaPortada(){
  if(!enPortada()) irAlMenu();
  ENCARGO = null; FIRMA_EXTRAS = ''; pintarExtras();
  ok(!document.getElementById('encargo'), 'sin datos de ADVAPP no hay bloque');
  ENCARGO = validarEncargo(enCopia()); FIRMA_EXTRAS = ''; pintarExtras();
  const sec = document.getElementById('encargo');
  ok(!!sec, 'con datos, la portada suma el bloque');
  if(!sec) return;
  const nuevos = document.getElementById('nuevos'), nos = document.getElementById('nosotros');
  ok((!nuevos || !!(nuevos.compareDocumentPosition(sec) & Node.DOCUMENT_POSITION_FOLLOWING)) &&
     (!nos || !!(sec.compareDocumentPosition(nos) & Node.DOCUMENT_POSITION_FOLLOWING)),
     'va despues de Recien llegados y antes de Quienes somos', [nuevos && 'nuevos', 'encargo', nos && 'nosotros'].filter(Boolean).join(' > '));
  const h2 = sec.querySelector('h2');
  ok(enTxt(h2) === 'Metodología de encargo' && sec.getAttribute('aria-labelledby') === h2.id &&
     enTxt(sec.querySelector('.en-eyebrow')) === 'Cómo funciona',
     'el titulo de ADVAPP, leido como titulo del bloque, con «Cómo funciona» arriba');
  ok(enTxt(sec.querySelector('.en-total')) === '7 a 14 días desde la seña hasta tu puerta' &&
     enTxt(sec.querySelector('.en-cab')) === 'Cómo llega los días se cuentan desde la seña',
     'el total grande es el plazo del ultimo paso, contado desde la seña (Benja 04/11, «plazo sí»)', enTxt(sec.querySelector('.en-total')));
  const pasos = [...sec.querySelectorAll('.en-pasos li')].map(li => [...li.children].filter(x => !x.classList.contains('en-paso-nota')).map(enTxt).join(' '));
  // El deposito «puede variar» (Benja 04/11): sólo en ese paso, abajo del nombre
  const notas = [...sec.querySelectorAll('.en-pasos li')].map(li => enTxt(li.querySelector('.en-paso-nota')));
  const liDep = sec.querySelectorAll('.en-pasos li')[2], notaDep = liDep && liDep.querySelector('.en-paso-nota');
  ok(notas.join('|') === '||Puede variar según lo que tarde la tienda en despacharlo||' && notaDep.getBoundingClientRect().top >= liDep.querySelector('b').getBoundingClientRect().bottom - 1 &&
     !/%|recargo|inter[eé]s|cuotas|\d/i.test(enTxt(notaDep)),
     'en «Depósito EEUU», abajo del nombre: «Puede variar según lo que tarde la tienda en despacharlo»', notas.join('|'));
  const sinDep = validarEncargo({ ...enCopia(), pasos: [{ paso: 'Seña', plazo: 'Hoy' }, { paso: 'En tu puerta', plazo: '7 a 14 días' }] });
  ok(sinDep.pasos.every(p => !notaDelPaso(p)) && notaDelPaso({ paso: 'Deposito EEUU' }) === 'Puede variar según lo que tarde la tienda en despacharlo',
     'si ese paso no viene no hay nota; sin tilde tambien la encuentra');
  ok(pasos.length === 5 && pasos.join(' | ') === 'Seña Hoy | Compramos 24 a 48 h | Depósito EEUU 3 a 5 días | Vuela y aduana 5 a 8 días | En tu puerta 7 a 14 días' &&
     sec.querySelector('.en-pasos').tagName === 'OL', 'los 5 pasos en orden, con su plazo, en una lista numerada', pasos.join(' | '));
  const gana = [...sec.querySelectorAll('.en-gana li')].map(enTxt);
  ok(gana[0] === 'Lo compramos nosotros en EE. UU.: no necesitás tarjeta del exterior.' &&
     (ENCARGO_PRECIO_FINAL_OK
       ? gana.length === 2 && gana[1] === 'El precio es final, con el viaje y la aduana incluidos. Si al llegar pesa más de lo cotizado, puede haber una diferencia.'
       : gana.length === 1 && !/aduana incluid/i.test(enTxt(sec))),
     'lo que gana el cliente; el precio final con viaje y aduana siempre con la aclaracion del peso (Benja 04/11)', gana.join(' / '));
  const cards = [...sec.querySelectorAll('.en-prod')];
  ok(cards.map(c => c.dataset.enc).join(',') === 'ENC-0001,ENC-0002,ENC-0003' && !sec.classList.contains('muchos'),
     'una tarjeta por producto, en el orden de ADVAPP, al lado de los pasos');
  const [sony, kindle, garmin] = cards;
  ok(enTxt(sony.querySelector('.en-marca')) === 'Sony' && enTxt(sony.querySelector('.en-nom')) === 'Sony WH-1000XM5' &&
     enTxt(sony.querySelector('.en-det')) === 'Auriculares inalámbricos con cancelación de ruido · Negro' &&
     enTxt(sony.querySelector('.en-precio')) === 'USD 470' && enTxt(sony.querySelector('.en-pie small')) === 'precio final',
     'marca, nombre, detalle y precio en dolares tal cual, en la etiqueta oscura', enTxt(sony));
  const pub = sony.querySelector('a.en-publicacion');
  ok(pub && enTxt(pub) === 'Ver la publicación ↗' && pub.getAttribute('href') === 'https://tienda.example/sony-wh-1000xm5?id=7' &&
     pub.target === '_blank' && /\bnoopener\b/.test(pub.rel) && /\bnoreferrer\b/.test(pub.rel) && /\bnofollow\b/.test(pub.rel) &&
     !kindle.querySelector('.en-publicacion') && !garmin.querySelector('.en-publicacion'),
     'con link, «Ver la publicación ↗» en otra pestaña; sin link (o con uno que no sirve), nada', pub && pub.outerHTML.slice(0, 120));
  ok(cards.every(c => c.querySelectorAll('a.en-consultar').length === (WHATSAPP ? 1 : 0) && !c.querySelector('.en-publicacion[href*="wa.me"]')),
     'el Consultar sigue siendo uno solo por tarjeta');
  ok(cards.every(c => !c.querySelector('.en-id') && !/ENC-\d/.test(enTxt(c))),
     'el codigo ENC no se ve en la tarjeta (va en el mensaje de WhatsApp)');
  ok(sony.querySelector('.en-img img')?.getAttribute('src') === 'https://www.sony.com/image/ejemplo.png' &&
     !kindle.querySelector('.en-img img') && enTxt(kindle.querySelector('.en-img')) === 'Kindle' && !kindle.querySelector('.en-det'),
     'con foto, la foto; sin foto, la marca escrita; sin detalle, sin renglon');
  ok(!sony.querySelector('.en-gar') && enTxt(garmin.querySelector('.en-gar')) === 'Garantía: 6 meses' && enTxt(garmin.querySelector('.en-precio')) === 'USD 1.015',
     'la garantia solo si ADVAPP la manda («Garantía: 6 meses»); vacia, sin renglon');
  const pago = sec.querySelector('.en-pago');
  ok(enTxt(pago) === 'Se encarga con una seña y el resto se paga cuando llega, en efectivo, transferencia o en cuotas con tarjeta: el monto de las cuotas te lo pasamos por WhatsApp.' &&
     !!(sec.querySelector('.en-pasos').compareDocumentPosition(pago) & Node.DOCUMENT_POSITION_FOLLOWING) && !!pago.closest('.en-info'),
     'debajo de los pasos, el pago en un renglon: con seña y el resto cuando llega, y el monto de las cuotas por WhatsApp (Benja 04/11)', enTxt(pago));
  ok(!/mismas que en el resto del cat[aá]logo/i.test(enTxt(sec)) && !sec.querySelector('.cq, [data-cuotas]'),
     'las cuotas de un encargo no son las del catalogo: la seccion no dice «las mismas» ni calcula cuotas');
  // Los unicos pesos de la seccion son los «≈ $» de cada tarjeta (los de abajo)
  const sinPesos = (() => { const c = sec.cloneNode(true); c.querySelectorAll('.en-ars').forEach(x => x.remove()); return enTxt(c); })();
  ok(!/%|\$\s?\d|recargo|inter[eé]s|\d+\s*cuotas/i.test(sinPesos) && !/\d/.test(enTxt(pago)) &&
     !/seña\s*(de\s*)?(usd|u\$s|\$|\d)/i.test(enTxt(sec)),
     'sin montos de cuotas, planes ni porcentajes, y la seña sin decir cuanto', enTxt(sec).slice(0, 80));
  const fuera = [...sec.querySelectorAll('*')].filter(el => { const r = el.getBoundingClientRect(), s = sec.getBoundingClientRect();
    return r.width && (r.right > s.right + 0.5 || r.left < s.left - 0.5); });
  ok(!fuera.length, 'nada se sale del bloque de costado (' + innerWidth + ' px)', fuera.slice(0, 3).map(el => el.className).join(', '));
  /* Los pesos (Benja 04/11, «sumá los pesos al encargo»): abajo del precio en
     dolares, los mismos de la tarjeta del catalogo (precioARS, con el dolar del
     dia), y sin dolar, nada */
  const tc0 = TC;
  try{
    TC = 1500; FIRMA_EXTRAS = ''; pintarExtras();
    const s1 = document.querySelector('#encargo [data-enc="ENC-0001"]');
    const ars = s1 && s1.querySelector('.en-pie .en-ars');
    ok(!!ars && enTxt(ars) === '≈ $ ' + plata(470 * 1500) && ars.innerHTML === precioARS({ precio: 470 }) &&
       ars.querySelector('.aprox')?.title === REF_PESOS && ars.previousElementSibling === s1.querySelector('.en-precio'),
       'abajo del precio en dolares, los pesos como en el catalogo (precioARS, con el dolar del dia)', ars && enTxt(ars));
    ok(!/%|recargo|inter[eé]s|\d+\s*cuotas/i.test(enTxt(document.getElementById('encargo'))),
       'con los pesos, tampoco hay cuotas ni porcentajes');
    TC = null; FIRMA_EXTRAS = ''; pintarExtras();
    ok(!document.querySelector('#encargo .en-ars') && !/\$\s?\d/.test(enTxt(document.getElementById('encargo'))),
       'sin el dolar, no hay pesos (nunca un numero inventado)');
  }finally{
    TC = tc0; FIRMA_EXTRAS = ''; pintarExtras();
  }

  // Con mas de 3, los productos pasan abajo y a lo ancho
  const cuatro = enCopia();
  cuatro.productos.push({ id: 'ENC-0004', nombre: 'Otro', marca: 'Bose', detalle: '', garantia: '', precio_usd: 300, foto: '' });
  ENCARGO = validarEncargo(cuatro); FIRMA_EXTRAS = ''; pintarExtras();
  ok(document.getElementById('encargo')?.classList.contains('muchos') && document.querySelectorAll('#encargo .en-prod').length === 4,
     'con mas de 3 productos, el bloque los pone abajo y a lo ancho (.muchos)');
  ENCARGO = validarEncargo(enCopia()); FIRMA_EXTRAS = ''; pintarExtras();
  if(!WHATSAPP){ info('sin WhatsApp: no hay botones'); return; }
  const sec2 = document.getElementById('encargo');
  const a = sec2.querySelector('[data-enc="ENC-0001"] a.en-consultar');
  const msj = a ? decodeURIComponent(a.href.split('text=')[1] || '') : '';
  ok(msj === 'Hola! Me interesa Sony WH-1000XM5 (ENC-0001), por encargo, a USD 470. ¿Me pasás info?' && a.target === '_blank',
     'el «Consultar» abre WhatsApp con el producto, su codigo y el precio', msj);
  // La medicion: desde "encargo", con el codigo (sin salir a WhatsApp)
  const medir0 = ANALITICA.medir, mandar0 = ANALITICA.mandar, ev = [];
  ANALITICA.medir = (t, x) => { ev.push({ t, ...(x || {}) }); };
  ANALITICA.mandar = () => {};
  const frenar = e => e.preventDefault();
  document.addEventListener('click', frenar);
  try{ a.click(); }
  finally{ document.removeEventListener('click', frenar); ANALITICA.medir = medir0; ANALITICA.mandar = mandar0; }
  const w = ev.filter(x => x.t === 'whatsapp');
  ok(w.length === 1 && w[0].desde === 'encargo' && w[0].id === 'ENC-0001' && w[0].marca === 'Sony' && w[0].precio === 470 && !w[0].codigo,
     'la medicion anota el WhatsApp con desde «encargo» y el codigo ENC-0001', JSON.stringify(w));
  const c = sec2.querySelector('.en-otro a.en-cotizar');
  ok(getComputedStyle(sec2.querySelector('.en-otro')).justifyContent === 'flex-start',
     '«Pedir cotización» va a la izquierda: abajo a la derecha estan Marian y el WhatsApp flotante (Benja 04/11)');
  const msjC = c ? decodeURIComponent(c.href.split('text=')[1] || '') : '';
  ok(enTxt(sec2.querySelector('.en-otro p')) === '¿Buscás otro producto? Decinos cuál y te lo cotizamos.' &&
     msjC === 'Hola! Busco un producto que no está en la web. ¿Me lo cotizan por encargo?' && c.target === '_blank',
     '«Pedir cotización» abre WhatsApp para lo que no esta en la seccion', msjC);
  // Si un flotante queda encima de «Pedir cotización», los dos se hacen a un lado (Benja 04/11)
  const waF = document.getElementById('wa-flotante');
  if(waF && !waF.hidden && getComputedStyle(waF).display !== 'none'){
    c.scrollIntoView({ block: 'center' });
    const rc = c.getBoundingClientRect(), estilo = waF.getAttribute('style');
    revisarFlotantes();
    const libre = !document.body.classList.contains('flotantes-ceden');
    waF.style.cssText = (estilo || '') + `;left:${rc.left}px;top:${rc.top}px;right:auto;bottom:auto`;
    revisarFlotantes();
    const cede = document.body.classList.contains('flotantes-ceden') &&
                 getComputedStyle(waF).visibility === 'hidden' &&
                 (!document.querySelector('.mr-lanzar') || getComputedStyle(document.querySelector('.mr-lanzar')).visibility === 'hidden');
    if(estilo === null) waF.removeAttribute('style'); else waF.setAttribute('style', estilo);
    revisarFlotantes();
    ok(libre && cede && !document.body.classList.contains('flotantes-ceden'),
       'si un flotante queda encima de «Pedir cotización», el WhatsApp y Marian se esconden; cuando pasa, vuelven',
       [libre, cede, document.body.className].join(' '));
  }else info('sin WhatsApp flotante: no se prueba que se haga a un lado');
}

/* ---- La carga ---- */
async function probarLaCarga(){
  const responder = (cuerpo, estado = 200) => { window.fetch = async () => new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json' } }); };
  ENCARGO = null; FIRMA_EXTRAS = ''; pintarExtras();
  responder(enCopia());
  await cargarEncargo();
  ok(!!document.getElementById('encargo') && document.querySelectorAll('#encargo .en-prod').length === 3, 'cuando ADVAPP contesta, el bloque se suma solo a la portada');
  responder({ error: 'tecno-encargo: falta la tabla' }, 500);
  await cargarEncargo();
  ok(ENCARGO === null && !document.getElementById('encargo'), 'si ADVAPP falla (500), el bloque se va y la portada sigue');
  responder(enCopia());
  await cargarEncargo();
  responder({ ...enCopia(), productos: [] });
  await cargarEncargo();
  ok(ENCARGO === null && !document.getElementById('encargo'), 'si la lista viene vacia, tambien');
  ok(ENCARGO_PASOS.length === 5 && ENCARGO_PASOS[4].plazo === '7 a 14 días',
     'sin productos igual quedan los pasos de ADVAPP (Marian los cuenta, 04/11)', ENCARGO_PASOS.map(p => p.paso).join(','));
  responder({ error: 'otra vez' }, 500);
  await cargarEncargo();
  ok(ENCARGO_PASOS.length === 5, 'si ADVAPP falla, quedan los ultimos pasos buenos');
}
