// Los pedidos de Benja del 13/10/2026 ("Cambios antes de publicar"):
//   [1] tocar la tarjeta de un mundo en cualquier lado lleva al rubro de la
//       foto que se esta viendo (con el drone a la vista, abre Drones); los
//       botones siguen llevando cada uno al suyo
//   [2] el nombre "Advance Tecno" de la barra de arriba es el mismo link al
//       inicio que el triangulo, y responde igual al mouse
//   [3] volver al inicio se nota: body.volviendo, y .entera cuando se viene de
//       otro lado; si ya se estaba en el inicio se mueve solo el logo
//   [5] los filtros propios de Camaras, Objetivos y Drones (FILTROS_RUBRO):
//       que cada opcion traiga lo que dice, contado aca por otro camino (el
//       SKU o el nombre a mano, sin pasar por rasgosDe), que viajen en el
//       link, que se suelten al salir del rubro y que un valor inventado no
//       deje la grilla vacia
//   [6] las reseñas de Google: el bloque de la portada y el sello del
//       encabezado dicen lo que dice datos/resenas.json, tal cual, y sin el
//       archivo (o con uno mal formado) no aparece nada
//   [8] "Desde" va con mayuscula en todos los lugares donde antecede un precio
// Y lo que eligio despues en el muestrario (mismo dia):
//   [4] el bloque "Quiénes somos" (diseño D): el texto, la direccion y el
//       equipo de NOSOTROS, la inicial donde no hay foto, y sin texto nada
//   [6] el boton "Dejá tu reseña", solo con un link de Google
//   [9] los links de la barra de arriba (NAV): que cada uno lleve a lo suyo
//       tambien desde un rubro, y que los que no entran pasen a "Más" sin
//       perderse ninguno
//   [8] el ejemplo del buscador con mayusculas y "Ver en el mapa" en el pie
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);
const $$ = s => document.querySelectorAll(s);

// El archivo de las reseñas, leido aparte de la pagina para comparar
let P13_RESENAS = null, p13Leido = false;
const p13T0 = Date.now();
fetch('datos/resenas.json', { cache: 'no-cache' }).then(r => r.json()).then(j => { P13_RESENAS = j; })
  .catch(() => {}).finally(() => { p13Leido = true; });

const esperaP13 = setInterval(() => {
  if(!MODELOS.length || !$$('#cats .chip').length || !$$('#mosaico .mundo').length) return;
  // La pagina lee las reseñas por su cuenta: se le da tiempo a que lleguen
  if(!p13Leido || (!RESENAS && Date.now() - p13T0 < 12000)) return;
  clearInterval(esperaP13);
  for(let i=1;i<5000;i++) clearInterval(i);
  try{ correrPruebas(); }catch(e){ R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; }
  try{ pararPaseos(); pararOfertas(); pararNuevos(); pararMarcas(); pararMundos(); }catch(e){}
  for(let i=1;i<5000;i++) clearInterval(i);
  const pre=document.createElement('pre'); pre.id='RESULTADO';
  pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
  document.body.appendChild(pre);
}, 150);

const p13Clic = el => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
const p13Tarjetas = () => [...$$('#mosaico .mundo')];
const p13Fotos = t => [...t.querySelectorAll('.mundo-foto img')];

function correrPruebas(){
  document.documentElement.style.scrollBehavior = 'auto';
  const mundos = mundosDeLaPortada();

  /* ---- [1] La tarjeta entera lleva al rubro de la foto ---- */
  ok(p13Tarjetas().every(t => getComputedStyle(t).cursor === 'pointer'), '[1] toda la tarjeta de un mundo tiene la manito');
  // Cada foto de cada mundo: se la pone a la vista y se toca el titulo
  const mal1 = [];
  let probadas = 0;
  mundos.forEach((w, i) => {
    const n = p13Fotos(p13Tarjetas()[i]).length;
    for(let k = 0; k < n; k++){
      const t = p13Tarjetas()[i];
      mostrarCapa(t, k, false);
      const j = Number(p13Fotos(t)[k].dataset.j);
      const espera = j >= 0 ? w.porRubro[j].cat
                   : (w.porRubro.find(x => norm(x.cat) === norm(w.foto)) || w.porRubro[0]).cat;
      p13Clic(t.querySelector('.mundo-cab h3'));
      probadas++;
      if(filtros.cat !== espera || enPortada()) mal1.push(w.nombre + ' foto ' + k + ': ' + (filtros.cat || 'no entro') + ' y era ' + espera);
      irAlInicio();
    }
  });
  ok(probadas > 6 && !mal1.length, '[1] tocar el titulo de la tarjeta abre el rubro de la foto que se ve, en cada foto de cada mundo',
     mal1.join(' | ') || probadas + ' fotos');

  // El caso del pedido: con el drone a la vista, la foto misma abre Drones
  const iFoto = mundos.findIndex(w => w.porRubro.some(r => r.cat === 'Drone' && r.foto));
  if(iFoto < 0) info('[1] hoy ningun mundo tiene la foto de Drones: no se mira el caso del pedido');
  else{
    const t = p13Tarjetas()[iFoto], jDrone = mundos[iFoto].porRubro.findIndex(r => r.cat === 'Drone');
    const k = p13Fotos(t).findIndex(img => img.dataset.j === String(jDrone));
    mostrarCapa(t, k, false);
    ok(t.querySelector('.rubro.en-foto')?.dataset.cat === 'Drone', '[1] con la foto del drone a la vista, el boton marcado es Drones');
    // La foto no recibe el clic (pointer-events:none): cae en la tarjeta
    p13Clic(t);
    ok(filtros.cat === 'Drone' && !enPortada(), '[1] y tocar la tarjeta ahi abre Drones', filtros.cat);
    ok(location.search.includes('cat=Drone'), '[1] con su direccion, como desde el boton', location.search);
    irAlInicio();
    // Un boton manda sobre la foto: con el drone a la vista, "Cámaras" abre Camaras
    const t2 = p13Tarjetas()[iFoto];
    mostrarCapa(t2, k, false);
    const otro = [...t2.querySelectorAll('.rubro')].find(b => b.dataset.cat !== 'Drone');
    if(otro){
      otro.click();
      ok(filtros.cat === otro.dataset.cat, '[1] los botones siguen llevando cada uno a su rubro, no al de la foto', otro.dataset.cat + ' -> ' + filtros.cat);
      irAlInicio();
    }
  }

  /* ---- [2] El nombre es el mismo link que el triangulo ---- */
  const nombre = document.querySelector('.topbar #logo-inicio b');
  ok(!!nombre && /advance\s*tecno/i.test(nombre.textContent), '[2] el nombre "Advance Tecno" esta adentro del link al inicio', nombre && nombre.textContent);
  entrarAlRubro('Celular');
  p13Clic(nombre);
  ok(enPortada() && !filtros.cat && location.search === '', '[2] tocar el nombre desde un rubro lleva al inicio', filtros.cat + ' ' + location.search);
  const css = [...document.styleSheets].flatMap(s => { try{ return [...s.cssRules]; }catch(e){ return []; } })
                .map(r => r.selectorText || '').join('\n');
  ok(/a\.logo:hover b/.test(css) && /a\.logo:hover \.marca-btn img/.test(css),
     '[2] al pasar el mouse por el link se encienden el nombre y el triangulo, los dos');
  ok(/a\.logo:active/.test(css), '[2] y al tocarlo se hunde el link entero, no solo el triangulo');

  /* ---- [3] La vuelta al inicio se nota ---- */
  if(quieto) info('[3] este navegador pide reducir movimiento: no hay animacion que mirar');
  else{
    const b = document.body;
    b.classList.remove('volviendo', 'entera');
    entrarAlRubro('Celular');
    irAlInicio();
    ok(b.classList.contains('volviendo') && b.classList.contains('entera'),
       '[3] al volver desde un rubro la portada entra animada (body.volviendo.entera)', b.className);
    const anima = sel => { const e = document.querySelector(sel); return e ? getComputedStyle(e).animationName : 'no esta'; };
    ok(anima('#mosaico') === 'inicioEntra' && anima('header .wrap') === 'inicioEntra',
       '[3] el encabezado y los rubros entran desde abajo', anima('header .wrap') + ' / ' + anima('#mosaico'));
    ok(anima('.topbar .marca-btn') === 'inicioLogo', '[3] y el triangulo da su vuelta', anima('.topbar .marca-btn'));
    ok(getComputedStyle(document.querySelector('.topbar'), '::after').animationName === 'inicioLinea', '[3] con la linea que cruza la barra de arriba');
    // Ya en el inicio y arriba de todo: solo el logo
    scrollTo(0, 0);
    irAlInicio();
    ok(b.classList.contains('volviendo') && !b.classList.contains('entera'),
       '[3] si ya se estaba en el inicio se mueve solo el logo: la pagina no se sacude', b.className);
    ok(anima('#mosaico') === 'none', '[3] (los rubros quedan quietos)', anima('#mosaico'));
    b.classList.remove('volviendo', 'entera');
  }

  /* ---- [5] Los filtros propios de cada rubro ---- */
  const tramo = p => String(p.skuVariante || '').toUpperCase().split('-').pop();
  const focal = p => { const m = /(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?mm/i.exec(p.desc || ''); return m ? [parseFloat(m[1]), parseFloat(m[2] || m[1])] : null; };
  // Lo que tiene que traer cada opcion, dicho por otro camino que rasgosDe
  const REGLA = {
    'Cámara|equipo|cuerpo': p => /^BODY/.test(tramo(p)),
    'Cámara|equipo|kit':    p => /^K\d/.test(tramo(p)),
    'Cámara|tipo|instantanea': p => /instax/i.test(p.desc),
    'Cámara|tipo|compacta':    p => /powershot|rx100/i.test(p.desc),
    'Cámara|tipo|reflex':      p => /\b(?:EOS \d+D|D\d{4})\b/i.test(p.desc),
    'Objetivo|optica|zoom': p => { const f = focal(p); return !!f && f[1] > f[0]; },
    'Objetivo|optica|fijo': p => { const f = focal(p); return !!f && f[1] === f[0]; },
    'Objetivo|optica|macro': p => /macro/i.test(p.desc),
    'Objetivo|focal|angular': p => { const f = focal(p); return !!f && f[0] < 35; },
    'Objetivo|focal|tele':    p => { const f = focal(p); return !!f && f[1] >= 85; },
    'Drone|combo|combo': p => /fly more|combo|bundle/i.test(p.desc),
    'Drone|combo|solo':  p => !/fly more|combo|bundle/i.test(p.desc),
  };
  const limpiar = () => Object.assign(filtros, { q:'', marca:'', rango:'', capacidad:'', ram:'', montura:'', apertura:'', soloStock:false, orden:'modelo', ...SIN_PROPIOS });
  const malCuenta = [], vacias = [];
  let opciones = 0;
  for(const f of FILTROS_RUBRO){
    for(const [v, t] of f.opciones){
      const regla = REGLA[f.rubro + '|' + f.campo + '|' + v];
      limpiar(); entrarAlRubro(f.rubro);
      filtros[f.campo] = v; aplicarFiltro(false);
      opciones++;
      if(!LISTA.length){ vacias.push(f.rubro + ' ' + t); continue; }
      if(!regla) continue;
      /* Los modelos del rubro con alguna version que cumple la regla, contados
         a mano. Se compara con filtrar(), que devuelve los de MODELOS tal
         cual: con un filtro de version, LISTA trae la vista filtrada de cada
         modelo, que es otro objeto. */
      const debe = MODELOS.filter(m => m.cat === f.rubro && m.variantes.some(regla));
      const dio = filtrar();
      const sobran = dio.filter(m => !debe.includes(m)), faltan = debe.filter(m => !dio.includes(m));
      if(sobran.length || faltan.length) malCuenta.push(`${f.rubro} ${t}: sobran ${sobran.map(m => m.desc).slice(0, 3).join(', ') || 0} · faltan ${faltan.map(m => m.desc).slice(0, 3).join(', ') || 0}`);
    }
  }
  ok(!malCuenta.length, '[5] cada opcion trae justo lo que dice, contado aca por el SKU y el nombre', malCuenta.join(' | ') || opciones + ' opciones');
  if(vacias.length) info('[5] hoy sin productos (el panel no las ofrece): ' + vacias.join(', '));

  // Ninguna camara, objetivo con focal ni drone se queda afuera de su grupo
  const sinTipo = PRODUCTOS.filter(p => p.cat === 'Cámara' && !p.rasgos.tipo.length).map(p => p.desc);
  ok(!sinTipo.length, '[5] todas las camaras tienen tipo', sinTipo.slice(0, 5).join(', ') || PRODUCTOS.filter(p => p.cat === 'Cámara').length + ' filas');
  const sinFocal = PRODUCTOS.filter(p => p.cat === 'Objetivo' && focal(p) && !(p.rasgos.focal.length && p.rasgos.optica.length)).map(p => p.desc);
  ok(!sinFocal.length, '[5] todo objetivo que dice sus mm tiene tipo y distancia focal', sinFocal.slice(0, 5).join(', ') || 'todos');
  const sinMm = PRODUCTOS.filter(p => p.cat === 'Objetivo' && !focal(p));
  ok(sinMm.every(p => !p.rasgos.focal.length && !p.rasgos.optica.filter(x => x !== 'macro').length),
     '[5] y al que no los dice (teleconversores) no se le inventa', sinMm.map(p => p.desc).join(', ') || 'ninguno');

  // El panel: los grupos aparecen en su rubro y solo ahi
  const gruposDe = cat => { limpiar(); entrarAlRubro(cat); abrirFiltros();
    const g = [...$$('#filtros-panel .mf-rot')].map(x => x.textContent);
    document.querySelector('#filtros-panel [data-cerrar]').click(); return g; };
  const gCam = gruposDe('Cámara'), gObj = gruposDe('Objetivo'), gDro = gruposDe('Drone'), gCel = gruposDe('Celular');
  ok(gCam.includes('Tipo de cámara') && gCam.includes('Viene con'), '[5] Filtrar en Camaras ofrece "Tipo de cámara" y "Viene con"', gCam.join(' · '));
  ok(gObj.includes('Tipo de objetivo') && gObj.includes('Distancia focal') && gObj.includes('Montura') && gObj.includes('Apertura'),
     '[5] en Objetivos suma "Tipo de objetivo" y "Distancia focal" a Montura y Apertura', gObj.join(' · '));
  ok(gDro.includes('Viene con'), '[5] en Drones, "Viene con"', gDro.join(' · '));
  ok(!FILTROS_RUBRO.some(f => gCel.includes(f.titulo)), '[5] y en Celulares ninguno de esos', gCel.join(' · '));

  // Elegir en el panel, la cruz, el link y la salida del rubro
  limpiar(); entrarAlRubro('Cámara'); abrirFiltros();
  document.querySelector('#filtros-panel [data-campo="equipo"][data-v="cuerpo"]').click();
  ok(filtros.equipo === 'cuerpo' && LISTA.length > 0 && LISTA.every(m => m.variantes.some(v => /^BODY/.test(tramo(v)))),
     '[5] tocar "Solo el cuerpo" en el panel filtra al toque', LISTA.length + ' modelos');
  ok(/[?&]equipo=cuerpo/.test(location.search), '[5] y viaja en el link', location.search);
  document.querySelector('#filtros-panel [data-cerrar]').click();
  const cruz = document.querySelector('#rubro-cab [data-quitar="equipo"]');
  ok(!!cruz && cruz.textContent === 'Solo el cuerpo', '[5] queda a la vista con su cruz', cruz && cruz.textContent);
  /* Con el filtro puesto, la tarjeta muestra el precio de ESA version: el de
     la mas barata con stock entre los cuerpos (o de todos, si ninguno tiene) */
  const conKit = LISTA.find(m => m.variantes.some(v => /^K\d/.test(tramo(v)) && v.precio !== null) &&
                                 m.variantes.some(v => /^BODY/.test(tramo(v)) && v.precio !== null));
  if(!conKit) info('[5] hoy ninguna camara tiene cuerpo y kit en la misma tarjeta: no se mira el precio de la version');
  else{
    const cuerpos = conKit.variantes.filter(v => /^BODY/.test(tramo(v)) && v.precio !== null);
    const hay = cuerpos.filter(v => v.stock);
    const minimo = Math.min(...(hay.length ? hay : cuerpos).map(v => v.precio));
    const card = [...$$('#grid .card')].find(c => c.querySelector('h3')?.textContent.includes(conKit.titulo || conKit.desc) ||
                                                  c.textContent.includes(nombreCorto(conKit)));
    ok(!!card && card.querySelector('.usd').textContent.includes('USD ' + plata(minimo)),
       '[5] y la tarjeta con cuerpo y kit muestra el precio del cuerpo', (conKit.titulo || conKit.desc) + ': ' + plata(minimo) + ' / ' + (card ? card.querySelector('.usd').textContent.trim() : 'sin tarjeta'));
  }
  cruz && cruz.click();
  ok(filtros.equipo === '' && !/equipo=/.test(location.search), '[5] la cruz lo saca', location.search);

  filtros.tipo = 'reflex'; aplicarFiltro(true);
  entrarAlRubro('Celular');
  ok(FILTROS_RUBRO.every(f => !filtros[f.campo]) && !/tipo=/.test(location.search), '[5] al pasar a otro rubro se sueltan solos', location.search);
  limpiar(); entrarAlRubro('Cámara');
  filtros.tipo = 'cualquiercosa'; aplicarFiltro(false);
  ok(filtros.tipo === '' && LISTA.length > 0, '[5] un valor que no existe (?tipo=cualquiercosa) se descarta: la grilla no queda vacia', LISTA.length + ' modelos');
  // Dos que no se cruzan: el vacio dice por que y ofrece la salida
  filtros.tipo = 'instantanea'; filtros.equipo = 'cuerpo'; aplicarFiltro(false);
  const vacio = document.querySelector('#grid .vacio');
  ok(!LISTA.length && !!vacio && /Instantánea/.test(vacio.textContent) && !!vacio.querySelector('[data-salida]'),
     '[5] dos filtros que no se cruzan: el vacio nombra los filtros y ofrece sacar uno', vacio && vacio.textContent.replace(/\s+/g, ' ').trim().slice(0, 110));
  irAlInicio();
  ok(enPortada() && FILTROS_RUBRO.every(f => !filtros[f.campo]), '[5] y el inicio los saca todos');

  /* ---- [6] Las reseñas de Google ---- */
  irAlInicio();
  const archivo = P13_RESENAS;
  if(!archivo) ok(false, '[6] datos/resenas.json se pudo leer para comparar');
  else{
    ok(!!RESENAS && RESENAS.puntaje === archivo.puntaje && RESENAS.cantidad === archivo.cantidad,
       '[6] la pagina leyo el puntaje y la cantidad del archivo', RESENAS && (RESENAS.puntaje + ' · ' + RESENAS.cantidad));
    pintarExtras();
    const sec = $('resenas'), nota = notaGoogle(archivo.puntaje);
    ok(!!sec && !sec.closest('[hidden]'), '[6] la portada tiene el bloque "Reseñas en Google"');
    ok(!!sec && sec.querySelector('.rs-nota > b').textContent === nota && sec.querySelector('.rs-nota').textContent.includes(plata(archivo.cantidad) + ' reseñas'),
       '[6] con el puntaje y la cantidad del archivo, sin redondear', sec && sec.querySelector('.rs-nota').textContent.replace(/\s+/g, ' ').trim());
    const tarjetas = sec ? [...sec.querySelectorAll('.rs-card:not(.rs-eco)')] : [];
    const distintas = archivo.resenas.filter((r, i) => !tarjetas[i] ||
      tarjetas[i].querySelector('blockquote').textContent !== r.texto.trim() ||
      tarjetas[i].querySelector('figcaption b').textContent !== r.autor ||
      tarjetas[i].querySelector('.rs-estrellas').style.getPropertyValue('--v') !== String(r.estrellas));
    ok(tarjetas.length === archivo.resenas.length && !distintas.length,
       '[6] una tarjeta por reseña del archivo, con el texto, el autor y las estrellas TAL CUAL', distintas.map(r => r.autor).join(', ') || tarjetas.length + ' reseñas');
    const ver = sec && sec.querySelector('.rs-ver');
    ok(!!ver && ver.href === archivo.ver && /(^|\.)google\.com$/.test(new URL(ver.href).hostname) && ver.target === '_blank',
       '[6] "Ver todas en Google" lleva a la ficha de Google, en otra pestaña', ver && ver.href);
    /* Ronda 3 del muestrario (19/10): banda oscura, el 4,9 arriba al centro y
       las reseñas pasan solas; la copia de la vuelta no la lee el lector */
    const pista = sec && sec.querySelector('.rs-pista'), ecos = sec ? [...sec.querySelectorAll('.rs-card.rs-eco')] : [];
    const corre = archivo.resenas.filter(r => r.estrellas === 5).length >= 3;
    ok(!!sec && sec.querySelector('h2').textContent === 'Lo que dicen en Google' && getComputedStyle(sec).backgroundColor === 'rgb(21, 18, 32)',
       '[6] la banda oscura con "Lo que dicen en Google" (19/10)', sec && sec.querySelector('h2').textContent);
    ok(!!pista && pista.classList.contains('corre') === corre && ecos.length === (corre ? tarjetas.length : 0) &&
       ecos.every(c => c.getAttribute('aria-hidden') === 'true' && c.inert),
       '[6] con tres o más, las reseñas pasan solas; la copia de la vuelta va escondida para el lector', ecos.length + ' copias');
    const larga = tarjetas.find(t => t.querySelector('[data-rs-mas]'));
    if(larga){
      larga.querySelector('[data-rs-mas]').click();
      ok(larga.classList.contains('entera') && larga.querySelector('[data-rs-mas]').getAttribute('aria-expanded') === 'true',
         '[6] una reseña larga se abre entera con "Leer completa"');
      ok(pista.classList.contains('quieta'), '[6] y con una abierta la cinta se frena');
      larga.querySelector('[data-rs-mas]').click();
      ok(!pista.classList.contains('quieta'), '[6] al cerrarla vuelve a andar');
    }else info('[6] hoy ninguna reseña pasa de ' + RESENA_LARGA + ' letras: no hay "Leer completa" que mirar');
    const sello = $('sello-google');
    // Desde el 19/10 es el primer renglón de las tres razones (2D): "4,9 en Google" / "469 reseñas de clientes"
    ok(!sello.hidden && sello.textContent.includes(nota + ' en Google') && sello.textContent.includes(plata(archivo.cantidad) + ' reseñas'),
       '[6] el sello del encabezado dice el puntaje y cuantas son', sello.textContent.replace(/\s+/g, ' ').trim());
    entrarAlRubro('Celular');
    p13Clic(sello);
    ok(enPortada() && !!$('resenas'), '[6] tocar el sello desde un rubro lleva al inicio, donde esta el bloque');
  }
  // Lo que no sirve no se muestra
  const base = { formato: 'resenas/1', puntaje: 4.9, cantidad: 469, ver: 'https://search.google.com/local/reviews?placeid=x',
                 resenas: [{ autor: 'A', estrellas: 5, texto: 'bien' }] };
  ok(!!validarResenas(base) && validarResenas(base).resenas.length === 1, '[6] un archivo bien formado se acepta');
  ok(validarResenas({ ...base, formato: 'otro' }) === null && validarResenas({ ...base, puntaje: 7 }) === null &&
     validarResenas({ ...base, cantidad: 0 }) === null && validarResenas({ ...base, ver: 'https://otro-sitio.com/x' }) === null &&
     validarResenas({ ...base, ver: 'javascript:alert(1)' }) === null,
     '[6] sin formato, con puntaje fuera de 1 a 5, sin cantidad o con un link que no es de Google: no se muestra nada');
  const filtradas = validarResenas({ ...base, resenas: [{ autor: '', estrellas: 5, texto: 'x' }, { autor: 'B', estrellas: 9, texto: 'x' },
                                                       { autor: 'C', estrellas: 5, texto: '' }, { autor: 'D', estrellas: 5, texto: 'ok' }] });
  ok(filtradas.resenas.length === 1 && filtradas.resenas[0].autor === 'D', '[6] una reseña sin autor, sin texto o con estrellas raras se saltea');
  // Benja, 19/10: "¿también se pueden evitar las malas?" Solo salen las de 5
  const malas = validarResenas({ ...base, resenas: [{ autor: 'E', estrellas: 4, texto: 'bien' }, { autor: 'F', estrellas: 1, texto: 'mal' },
                                                    { autor: 'G', estrellas: 5, texto: 'excelente' }] });
  ok(malas.resenas.map(r => r.autor).join() === 'G', '[6] solo se muestran las de 5 estrellas (19/10)', malas.resenas.map(r => r.autor + ':' + r.estrellas).join(', '));
  const guardada = RESENAS;
  RESENAS = null; FIRMA_EXTRAS = ''; pintarExtras(); pintarSelloGoogle();
  ok(!$('resenas') && $('sello-google').hidden && !!$('ayuda'), '[6] sin el archivo no hay bloque ni sello, y la portada sigue entera');
  RESENAS = guardada; FIRMA_EXTRAS = ''; pintarExtras(); pintarSelloGoogle();

  /* ---- [6b] "Dejá tu reseña" (lo eligio en el muestrario) ---- */
  irAlInicio(); FIRMA_EXTRAS = ''; pintarExtras();
  const dejar = document.querySelector('#resenas .rs-dejar');
  if(archivo && archivo.escribir)
    ok(!!dejar && dejar.href === archivo.escribir && /(^|\.)google\.com$/.test(new URL(dejar.href).hostname) && dejar.target === '_blank',
       '[6] "Dejá tu reseña" lleva al link de Google del archivo, en otra pestaña', dejar && dejar.href);
  ok(validarResenas({ ...base, escribir: 'https://otro-sitio.com/x' }).escribir === '' && validarResenas(base).escribir === '',
     '[6] sin ese link, o con uno que no es de Google, el boton no aparece');

  /* ---- [4] Quienes somos (diseño D del muestrario) ---- */
  const ns = $('nosotros');
  ok(!!ns && !ns.closest('[hidden]') && !!$('resenas') && (ns.compareDocumentPosition($('resenas')) & Node.DOCUMENT_POSITION_FOLLOWING),
     '[4] la portada tiene el bloque "Quiénes somos", arriba de las reseñas');
  if(ns){
    const parrafos = [...ns.querySelectorAll('.ns-txt p:not(.ns-dir)')].map(p => p.textContent);
    ok(parrafos.length === NOSOTROS.texto.length && parrafos.every((t, i) => t === NOSOTROS.texto[i]),
       '[4] con el texto de NOSOTROS, tal cual', parrafos.length + ' parrafos');
    ok(ns.querySelector('.ns-dir').textContent.includes(DIRECCION) && ns.querySelector('.ns-b[href="' + CSS.escape(MAPA) + '"]'),
       '[4] la direccion y el link al mapa son los de la configuracion', ns.querySelector('.ns-dir').textContent);
    const caras = [...ns.querySelectorAll('.ns-cara')];
    ok(caras.length === NOSOTROS.equipo.length && caras.every((c, i) =>
         c.querySelector('.ns-nom').textContent === NOSOTROS.equipo[i].nombre && c.querySelector('.ns-rol').textContent === NOSOTROS.equipo[i].rol),
       '[4] una cara por persona del equipo, con su nombre y lo que hace', caras.map(c => c.querySelector('.ns-nom').textContent).join(', '));
    const sinFoto = NOSOTROS.equipo.map((p, i) => [p, caras[i]]).filter(([p]) => !p.foto);
    ok(sinFoto.every(([p, c]) => !c.querySelector('img') && c.querySelector('.ns-foto b').textContent === p.nombre[0].toUpperCase()),
       '[4] sin foto cargada va la inicial, sin pedir ninguna imagen', sinFoto.length + ' sin foto');
    ok(!!NOSOTROS.local === !!ns.querySelector('.ns-local') && ns.classList.contains('sin-local') === !NOSOTROS.local,
       '[4] sin la foto del local el bloque va sin ese hueco');
  }
  const textoNs = NOSOTROS.texto;
  NOSOTROS.texto = []; FIRMA_EXTRAS = ''; pintarExtras(); pintarNav();
  ok(!$('nosotros') && !document.querySelector('#tb-nav [data-nav="nosotros"]') && !!$('ayuda'),
     '[4] sin texto no hay bloque ni link en la barra, y la portada sigue entera');
  NOSOTROS.texto = textoNs; FIRMA_EXTRAS = ''; pintarExtras(); pintarNav();

  /* ---- [9] Los links de la barra de arriba ---- */
  const nav = $('tb-nav');
  // Desde el 19/10 (1F) van en su fila: la cápsula y "Cotizá tu usado" aparte
  const enBarra = () => [...nav.querySelectorAll('a[data-nav]')].filter(a => !a.closest('#tb-menu'));
  const capsula = $('tb-capsula');
  const esperados = NAV.filter(([id]) => hayDestinoNav(id));
  ok(!nav.hidden && enBarra().map(a => a.dataset.nav).join() === esperados.map(x => x[0]).join() &&
     enBarra().map(a => a.textContent.trim()).join('|') === esperados.map(x => x[1]).join('|'),
     '[9] la barra trae los links de NAV, en su orden', enBarra().map(a => a.textContent).join(' · '));
  ok(esperados.length === NAV.length, '[9] hoy todos tienen a donde llevar', NAV.filter(([id]) => !hayDestinoNav(id)).map(x => x[1]).join(', ') || NAV.length + ' links');
  const usadoBoton = nav.querySelector('a[data-nav="usado"]');
  ok(document.querySelector('.topbar').classList.contains('con-nav') && nav.parentElement === document.querySelector('.topbar') && !nav.closest('.topbar .wrap') &&
     ($('q').compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING) && !!capsula &&
     (!usadoBoton || (usadoBoton.classList.contains('tb-usado') && !capsula.contains(usadoBoton))),
     '[9] van en su propia fila, abajo de la barra, y "Cotizá tu usado" aparte, como boton (1F, 19/10)');
  ok(enBarra().every(a => !!a.querySelector('svg')), '[9] cada link con su icono (1F)');
  const tocar = id => p13Clic(nav.querySelector('[data-nav="' + id + '"]'));
  entrarAlRubro('Celular'); tocar('resenas');
  ok(enPortada() && !!$('resenas'), '[9] "Reseñas" desde un rubro lleva al inicio, donde esta el bloque');
  entrarAlRubro('Celular'); tocar('nosotros');
  ok(enPortada() && !!$('nosotros'), '[9] "Quiénes somos", igual');
  for(const id of ['pagos', 'donde']){
    const i = PREGUNTAS.findIndex(q => q.nav === id);
    elegirPregunta(i === 0 ? 1 : 0);
    tocar(id);
    const abierta = document.querySelector('#ayuda .ay-p[aria-expanded="true"]');
    ok(i >= 0 && ayIndice === i && abierta && Number(abierta.dataset.ay) === i,
       '[9] "' + NAV.find(x => x[0] === id)[1] + '" abre su pregunta', i >= 0 ? PREGUNTAS[i].p : 'sin pregunta');
  }
  tocar('preguntas');
  ok(enPortada() && !!$('ayuda'), '[9] "Preguntas" lleva a las preguntas frecuentes');
  tocar('usado');
  ok(!!$('usado'), '[9] "Cotizá tu usado" abre el cotizador');
  if(cerrarUsadoDOM){ usadoEmpujado = false; const c = cerrarUsadoDOM; cerrarUsadoDOM = null; c(); }
  document.querySelectorAll('.modal').forEach(d => d.remove()); document.body.classList.remove('modal-abierto');
  // Con poco lugar, los que no entran pasan a "Más" y no se pierde ninguno
  if(NAV_CEL.matches) info('[9] esta ventana es de celular: ahi no hay "Más" que mirar');
  else{
    capsula.style.maxWidth = '250px'; acomodarNav();
    const enCapsula = [...capsula.querySelectorAll('a[data-nav]')];
    const visibles = enCapsula.filter(a => !a.classList.contains('fuera')), menu = [...$('tb-menu').querySelectorAll('a')];
    ok(!$('tb-mas').hidden && menu.length > 0 && visibles.length + menu.length === enCapsula.length &&
       [...visibles, ...menu, ...(usadoBoton ? [usadoBoton] : [])].map(a => a.dataset.nav).join() === esperados.map(x => x[0]).join(),
       '[9] con poco lugar, los ultimos pasan a "Más" y entre la fila y el menu estan todos', visibles.length + ' a la vista + ' + menu.length + ' en Más');
    ok(capsula.scrollWidth <= capsula.clientWidth + 1 && (!usadoBoton || !usadoBoton.classList.contains('fuera')),
       '[9] y lo que queda a la vista entra; "Cotizá tu usado" no pasa nunca a "Más"', capsula.scrollWidth + ' / ' + capsula.clientWidth);
    $('tb-mas').click();
    const rMas = $('tb-mas').getBoundingClientRect(), rMenu = $('tb-menu').getBoundingClientRect();
    ok(!$('tb-menu').hidden && $('tb-mas').getAttribute('aria-expanded') === 'true' && Math.abs(rMenu.left - rMas.left) < 2 && rMenu.top >= rMas.bottom - 4,
       '[9] "Más" abre su menu, debajo del boton', Math.round(rMenu.left) + ' / ' + Math.round(rMas.left));
    entrarAlRubro('Celular');
    p13Clic(menu[menu.length - 1]);
    ok($('tb-menu').hidden && (menu[menu.length - 1].dataset.nav === 'usado' ? !!$('usado') : enPortada()), '[9] un link del menu hace lo mismo que en la barra, y el menu se cierra');
    if(cerrarUsadoDOM){ usadoEmpujado = false; const c = cerrarUsadoDOM; cerrarUsadoDOM = null; c(); }
    document.querySelectorAll('.modal').forEach(d => d.remove()); document.body.classList.remove('modal-abierto');
    capsula.style.maxWidth = ''; acomodarNav();
    ok(enBarra().every(a => !a.classList.contains('fuera')) === (capsula.scrollWidth <= capsula.clientWidth + 1), '[9] al volver el lugar, vuelven a la fila los que entran');
  }
  const selloBarra = $('tb-sello');
  ok(!selloBarra.hidden && selloBarra.textContent.includes(notaGoogle(RESENAS.puntaje)), '[9] el puntaje de Google tambien esta en la barra', selloBarra.textContent);
  irAlInicio();

  /* ---- [8] Lo elegido de ortografia que es de la web ---- */
  ok($('q').placeholder === 'Buscar: iPhone 17, MacBook, Canon R6…', '[8] el ejemplo del buscador va con mayusculas', $('q').placeholder);
  ok(!/Ver en mapa/.test($('pie-id').textContent) && (!MAPA || /Ver en el mapa/.test($('pie-id').textContent)), '[8] el pie dice "Ver en el mapa"', $('pie-id').textContent.slice(0, 90));

  /* ---- [8] "Desde" con mayuscula ---- */
  const minuscula = /(^|[\s·>(])desde\s+USD/;
  const textos = [];
  textos.push(['la portada', document.querySelector('main').innerText + ' ' + (document.querySelector('#ofertas')?.innerText || '')]);
  limpiar(); entrarAlRubro('Celular');
  textos.push(['Celulares', document.querySelector('main').innerText]);
  const multi = LISTA.find(m => m.multi && m.precio !== null && m.precio !== m.precioMax && m.stock);
  if(multi){
    abrirFicha(clave(multi.rep), null);
    textos.push(['la ficha de ' + (multi.titulo || multi.desc), $('ficha') ? $('ficha').innerText : '']);
    quitarFicha();
  }
  const conMinuscula = textos.filter(([, t]) => minuscula.test(t)).map(([d, t]) => d + ': …' + t.slice(Math.max(0, t.search(minuscula) - 20), t.search(minuscula) + 30).replace(/\s+/g, ' '));
  ok(!conMinuscula.length, '[8] ningun precio dice "desde" en minuscula (portada, rubro y ficha)', conMinuscula.join(' | ') || textos.map(x => x[0]).join(', '));
  const conDesde = textos.filter(([, t]) => /Desde\s+USD|DESDE\s+USD/.test(t)).length;
  ok(conDesde >= 2, '[8] y si dice "Desde USD …" donde hay versiones a distinto precio', conDesde + ' de ' + textos.length + ' pantallas');
  const etiqueta = [...$$('#grid .card .usd .desde')][0];
  ok(!!etiqueta && etiqueta.textContent === 'Desde', '[8] la etiqueta de la tarjeta se escribe "Desde"', etiqueta && etiqueta.textContent);
  irAlInicio();
  const mundoTxt = [...$$('#mosaico .mundo-cab p')].map(p => p.textContent);
  ok(mundoTxt.length > 0 && mundoTxt.every(t => !/desde USD/.test(t)) && mundoTxt.some(t => /· Desde USD/.test(t)),
     '[8] tambien en el renglon de cada mundo ("239 productos · Desde USD 65")', mundoTxt[0]);
}
