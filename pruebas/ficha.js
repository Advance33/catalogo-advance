// La ficha de producto (21/09). Pedro la armó eligiendo de a una cosa, igual
// que la tarjeta: la foto sin caja con los colores en tira a la derecha,
// apagados menos el elegido y con el nombre debajo; memoria y versión como
// pestañas con el rótulo a la izquierda; el precio en etiqueta oscura; y una
// franja oscura que cruza la ficha con el envío. Esta tanda fija esas
// elecciones, para que un cambio de otro lado no las desarme sin que nadie se
// dé cuenta.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
// $ ya existe en el catalogo (getElementById): aca van con otro nombre
const uno = s => document.querySelector(s);
const todos = s => [...document.querySelectorAll(s)];

const esperar = setInterval(() => {
  if(!MODELOS.length || !document.querySelectorAll('#cats .chip').length ||
     typeof INDICE_FOTOS === 'undefined' || !INDICE_FOTOS) return;
  clearInterval(esperar);
  for(let i=1;i<5000;i++) clearInterval(i);
  try{ correrPruebas(); }catch(e){ R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; }
  // La foto del color se pide recién al tocarlo: esa parte va aparte y cierra
  const seguir = () => { try{ probarEntradaCinta(terminar); }
                         catch(e){ R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; terminar(); } };
  try{ probarFotoDeColor(seguir); }
  catch(e){ R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; seguir(); }
}, 150);

function terminar(){
  try{ cerrarFicha(); }catch(e){}
  try{ pararPaseos(); pararOfertas(); pararNuevos(); pararMarcas(); pararMundos(); }catch(e){}
  for(let i=1;i<5000;i++) clearInterval(i);
  const pre=document.createElement('pre'); pre.id='RESULTADO';
  pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
  document.body.appendChild(pre);
}

const estilo = (el, p) => getComputedStyle(el).getPropertyValue(p);
/* Los colores llegan de dos formas: "rgb(23, 15, 40)" desde getComputedStyle y
   "#170F28" desde las variables del :root. Las dos terminan en [r,g,b]. */
function rgb(t){
  t = String(t || '').trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(t);
  if(hex){
    const h = hex[1].length === 3 ? hex[1].replace(/./g, c => c + c) : hex[1];
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  }
  const n = (t.match(/[\d.]+/g) || []).map(Number);
  return n.length >= 3 ? n.slice(0, 3) : [];
}
/* En el navegador sin ventana el reloj corre solo: las transiciones arrancan y
   se quedan en el primer cuadro, asi que medir el filtro justo despues de un
   clic devuelve el valor VIEJO. Se las termina a mano antes de mirar. */
const terminarTransiciones = () => document.getAnimations()
  .filter(a => a instanceof CSSTransition).forEach(a => a.finish());
const transparente = t => /^(transparent|rgba\(0,\s*0,\s*0,\s*0\))$/.test(String(t).trim());
const cerca = (a, b, tol = 6) => a.length === 3 && b.length === 3 &&
                                 a.every((x, i) => Math.abs(x - b[i]) <= tol);
const variable = n => rgb(getComputedStyle(document.documentElement).getPropertyValue(n));
/* Espera a que se cumpla algo, sin colgarse: a los 4 segundos sigue igual. El
   observador que revela la cinta avisa en su propio tiempo, y en el navegador
   sin ventana ese tiempo no es el mismo en cada corrida. */
const cuando = (cond, sigue, t0 = Date.now()) =>
  (cond() || Date.now() - t0 > 4000) ? sigue() : setTimeout(() => cuando(cond, sigue, t0), 120);

// Versiones del modelo, por el mismo criterio que usa la ficha
const versionesDe = m => {
  const mapa = new Map();
  m.variantes.forEach(v => { const o = v.opcion || v.etiqueta;
    if(!mapa.has(o)) mapa.set(o, []); mapa.get(o).push(v); });
  return mapa;
};
const conPestanas = m => [...versionesDe(m).entries()]
  .filter(([o, g]) => !opcionEsColor(g, o)).length > 1;

function correrPruebas(){
  PEDIDO = []; guardarPedido();

  /* ---- 1. La foto salió de la caja ----
     multiply es lo que funde el fondo blanco de la foto del proveedor con la
     página. Se corta si CUALQUIER padre tiene transform, filter, opacity o
     isolation propios: eso arma un grupo aparte y la foto vuelve a quedar en
     un recuadro blanco, que es justo lo que se sacó. */
  const conFoto = MODELOS.find(m => m.imagen && m.stock);
  abrirFicha(clave(conFoto.rep), null);
  let d = document.getElementById('ficha');
  const marco = d.querySelector('.fi-marco');
  const img = marco && marco.querySelector('img');
  ok(!!marco && !!img, 'la foto vive adentro de .fi-marco', conFoto.desc);
  ok(img && estilo(img, 'mix-blend-mode') === 'multiply',
     'y se funde con la página en vez de vivir en un recuadro',
     img && estilo(img, 'mix-blend-mode'));

  /* multiply mezcla contra lo que este pintado DEBAJO dentro de su grupo, y la
     ventana entra con una animacion de opacity+transform que arma uno propio.
     Por eso el fondo tiene que estar en .fi-foto, que queda adentro del grupo,
     y entre la foto y ese fondo no puede haber nada que arme otro grupo. */
  const lado = d.querySelector('.fi-foto');
  ok(!transparente(estilo(lado, 'background-color')),
     'el lado de la foto tiene fondo propio, para que haya contra que mezclar',
     estilo(lado, 'background-color'));

  const rompen = [];
  for(let el = img && img.parentElement; el && el !== lado.parentElement; el = el.parentElement){
    const s = getComputedStyle(el);
    const mal = [];
    if(s.transform !== 'none') mal.push('transform');
    if(s.filter !== 'none') mal.push('filter');
    if(parseFloat(s.opacity) < 1) mal.push('opacity');
    if(s.isolation === 'isolate') mal.push('isolation');
    if(s.mixBlendMode !== 'normal') mal.push('mix-blend-mode');
    if(s.perspective !== 'none') mal.push('perspective');
    if(mal.length) rompen.push((el.className || el.id || el.tagName) + ': ' + mal.join('+'));
  }
  ok(!rompen.length, 'y entre la foto y ese fondo no hay nada que corte la mezcla',
     rompen.join(' | ') || 'ninguno');

  const fondoFoto = rgb(estilo(lado, 'background-color'));
  const fondoDatos = rgb(estilo(d.querySelector('.fi-datos'), 'background-color'));
  ok(!cerca(fondoFoto, [255, 255, 255], 0) && !cerca(fondoFoto, variable('--foto-bg'), 2),
     'el lado de la foto no es ni blanco puro ni el lila de la caja de antes',
     estilo(lado, 'background-color'));
  ok(cerca(fondoDatos, [255, 255, 255], 0), 'y el de los datos si es blanco',
     estilo(d.querySelector('.fi-datos'), 'background-color'));
  cerrarFicha();

  /* ---- 2. El precio, en etiqueta oscura ---- */
  abrirFicha(clave(conFoto.rep), null);
  d = document.getElementById('ficha');
  const precio = d.querySelector('.fi-precio');
  ok(precio && cerca(rgb(estilo(precio, 'background-color')), variable('--ink')),
     'el precio va en etiqueta oscura', precio && estilo(precio, 'background-color'));
  ok(precio && cerca(rgb(estilo(precio.querySelector('.usd'), 'color')), [255, 255, 255]),
     'con el numero en blanco encima');
  ok(precio && precio.querySelector('.usd').textContent.includes(
       conFoto.rep.precio === null ? 'Consultar' : plata(conFoto.rep.precio)),
     'y dice el precio de la variante abierta', precio && precio.querySelector('.usd').textContent.trim());
  cerrarFicha();

  /* ---- 3. La franja de envio ----
     Va entre los datos y los sugeridos, y una sola vez. El texto es el de
     SERVICIO: no hay nada escrito a mano en el catalogo. */
  abrirFicha(clave(conFoto.rep), null);
  d = document.getElementById('ficha');
  const franja = d.querySelector('.fi-envio');
  ok(!!franja, 'la ficha cruza una franja de envio');
  ok(franja && franja.textContent.includes(SERVICIO.envio[0]) &&
     franja && franja.textContent.includes(SERVICIO.envio[1]),
     'con el texto de SERVICIO, entero', franja && franja.textContent.replace(/\s+/g,' ').trim());
  ok(franja && cerca(rgb(estilo(franja, 'background-color')), variable('--ink')),
     'del mismo oscuro que la etiqueta del precio', franja && estilo(franja, 'background-color'));
  ok(franja && franja.previousElementSibling &&
     franja.previousElementSibling.classList.contains('fi-cols'),
     'justo despues de la foto y los datos');
  ok(d.querySelectorAll('.fi-envio').length === 1, 'y una sola vez');
  cerrarFicha();

  /* ---- 4. Los colores, en tira al costado de la foto ----
     Que "hoy no hay ninguna" no puede ser la salida facil: si la planilla dice
     que este modelo tiene varios colores, la ficha TIENE que mostrar la tira.
     Sin esto, borrar la tira entera hacia que esta parte se saltara sola. */
  /* Ojo con como se cuentan: preguntarle a coloresFicha() cuantos colores
     hay es repetir la cuenta que se quiere verificar, y si esa funcion
     devuelve cero la prueba se salta sola. Se cuenta de la planilla: una
     celda de color con dos nombres adentro ("Purple/Red/Yellow") son dos
     colores para elegir, diga lo que diga el catalogo. */
  const deberian = MODELOS.filter(m => partirColores(m.color || '').length >= 2);
  /* Se prefiere un modelo cuyos colores viven TODOS en la misma fila: ahi
     tocar un color solo cambia el color (elegirColorFicha). Cuando cada color
     es una fila distinta, el clic se va por el camino de cambiar de version y
     nunca se probaria el otro. */
  let conColores = null, cualquiera = null;
  for(const m of deberian){
    abrirFicha(clave(m.rep), null);
    const bs = [...document.querySelectorAll('#ficha .fi-pintas button')];
    const unaSola = bs.length >= 2 && new Set(bs.map(b => b.dataset.k)).size === 1;
    cerrarFicha();
    if(bs.length >= 2 && !cualquiera) cualquiera = m;
    if(unaSola){ conColores = m; break; }
  }
  conColores = conColores || cualquiera;
  ok(!deberian.length || !!conColores,
     'las fichas de varios colores muestran la tira',
     deberian.length + ' modelo(s) con varios colores en la planilla');
  if(!conColores){
    R.push('  --  hoy ninguna ficha tiene dos colores para elegir');
  }else{
    abrirFicha(clave(conColores.rep), null);
    d = document.getElementById('ficha');
    const tira = d.querySelector('.fi-pintas');
    const botones = [...tira.querySelectorAll('button')];
    ok(tira.closest('.fi-foto') === d.querySelector('.fi-foto'),
       'la tira de colores cuelga de la foto, no de la columna de datos', conColores.desc);
    ok(estilo(tira, 'position') === 'absolute' && estilo(tira, 'flex-direction') === 'column',
       'va en vertical, al costado', estilo(tira, 'position') + ' / ' + estilo(tira, 'flex-direction'));
    // A la derecha: el borde izquierdo de la tira pasa del medio de la foto
    const rf = d.querySelector('.fi-foto').getBoundingClientRect();
    const rt = tira.getBoundingClientRect();
    ok(rt.left > rf.left + rf.width / 2, 'y a la derecha de la foto',
       Math.round(rt.left) + ' > ' + Math.round(rf.left + rf.width / 2));

    // Puede abrir sin color elegido (nadie lo toco todavia): se elige uno
    if(!botones.some(b => b.getAttribute('aria-pressed') === 'true')) botones[0].click();
    terminarTransiciones();
    const vivos = [...document.querySelectorAll('#ficha .fi-pintas button')];
    const elegido = vivos.find(b => b.getAttribute('aria-pressed') === 'true');
    const otro = vivos.find(b => b !== elegido);
    ok(!!elegido && !!otro, 'hay un color elegido y otros para elegir',
       vivos.map(b => b.dataset.color).join(' / '));
    ok(estilo(elegido, 'filter') === 'none' && parseFloat(estilo(elegido, 'opacity')) === 1,
       'el color elegido se ve a color', estilo(elegido, 'filter'));
    ok(/grayscale/.test(estilo(otro, 'filter')) && parseFloat(estilo(otro, 'opacity')) < 1,
       'y los demas, apagados', estilo(otro, 'filter') + ' / ' + estilo(otro, 'opacity'));

    const nom = d.querySelector('#fi-color-txt');
    ok(!!nom && nom.closest('.fi-foto') === d.querySelector('.fi-foto'),
       'el nombre del color va debajo de la foto');
    ok(nom && nom.getBoundingClientRect().top > d.querySelector('.fi-marco').getBoundingClientRect().top,
       'debajo y no encima');

    // Tocar un color lo elige: queda marcado, lo dice el nombre y viaja al pedido
    otro.click();
    terminarTransiciones();
    d = document.getElementById('ficha');
    const ahora = [...d.querySelectorAll('.fi-pintas button')]
                    .find(b => b.dataset.color === otro.dataset.color);
    ok(ahora && ahora.getAttribute('aria-pressed') === 'true',
       'tocar un color lo deja marcado', otro.dataset.color);
    ok(d.querySelector('#fi-color-txt').textContent.trim() === otro.dataset.color,
       'y el nombre de abajo lo dice', d.querySelector('#fi-color-txt').textContent.trim());
    ok(COLOR_FICHA === otro.dataset.color, 'y queda elegido para el pedido', COLOR_FICHA);
    cerrarFicha();

    /* ---- 4b. El camino corto: el color de la MISMA fila ----
       Tocar un color puede ir por dos caminos. Si ese color vive en otra fila
       se cambia de version (elegirVariante); si es de la fila abierta, solo
       cambia el color (elegirColorFicha).

       Hoy la planilla no trae NINGUNA fila con dos colores en una celda -cada
       color es su propia fila-, asi que tocando la tira nunca se llega al
       segundo camino y romperlo no se notaria. Se lo llama derecho, que es la
       misma funcion que usa la ficha, para que quede cubierto igual: la
       planilla ya trajo celdas asi antes ("Purple/Red/Yellow") y va a volver. */
    abrirFicha(clave(conColores.rep), null);
    d = document.getElementById('ficha');
    const fila = buscarProducto(FICHA);
    const nomAntes = d.querySelector('#fi-color-txt').textContent.trim();
    /* Uno DISTINTO del que ya dice el nombre: si se prueba con el mismo, la
       ficha ya lo mostraba antes de llamar a nada y la prueba pasa sola. */
    const suyo = [...d.querySelectorAll('.fi-pintas button')]
                   .map(b => b.dataset.color).find(c => c && c !== nomAntes);
    if(!suyo){
      R.push('  --  la ficha abierta tiene un solo color: no se prueba el camino corto');
    }else{
      const antesWA = (d.querySelector('.fi-botones .cta') || {}).href || '';
      elegirColorFicha(d, fila, suyo);
      ok(COLOR_FICHA === suyo, 'elegir un color de la misma fila lo deja elegido para el pedido',
         fila.id + ' / ' + nomAntes + ' -> ' + COLOR_FICHA);
      ok(d.querySelector('#fi-color-txt').textContent.trim() === suyo,
         'y el nombre debajo de la foto lo dice',
         nomAntes + ' -> ' + d.querySelector('#fi-color-txt').textContent.trim());
      const marcado = [...d.querySelectorAll('.fi-pintas button')]
                        .find(b => b.getAttribute('aria-pressed') === 'true');
      ok(marcado && marcado.dataset.color === suyo, 'y queda marcado en la tira',
         marcado && marcado.dataset.color);
      const ahoraWA = (d.querySelector('.fi-botones .cta') || {}).href || '';
      ok(!antesWA || (ahoraWA !== antesWA && decodeURIComponent(ahoraWA).includes(suyo)),
         'y el mensaje de WhatsApp nombra ese color');
    }
    cerrarFicha();
  }

  /* ---- 5. Memoria y version, como pestañas con el rotulo a la izquierda ---- */
  const dosEjes = MODELOS.find(m => {
    if(!m.multi || !conPestanas(m)) return false;
    abrirFicha(clave(m.rep), null);
    const n = document.querySelectorAll('#ficha .fi-ops').length;
    cerrarFicha();
    return n === 2;
  });
  if(!dosEjes){
    R.push('  --  hoy ninguna ficha parte la version en memoria y version');
  }else{
    abrirFicha(clave(dosEjes.rep), null);
    d = document.getElementById('ficha');
    const ejes = todos('#ficha .fi-eje');
    ok(ejes.length === 2, 'la version se elige en dos ejes', dosEjes.desc);
    ok(ejes[0].querySelector('.fi-eje-rot').textContent.trim() === 'Memoria' &&
       ejes[1].querySelector('.fi-eje-rot').textContent.trim() === 'Versión',
       'primero la memoria y despues la version',
       ejes.map(e => e.querySelector('.fi-eje-rot').textContent.trim()).join(' / '));
    // El rótulo a la izquierda: su borde derecho no pasa el izquierdo de las pestañas
    const rot = ejes[0].querySelector('.fi-eje-rot').getBoundingClientRect();
    const ops = ejes[0].querySelector('.fi-ops').getBoundingClientRect();
    ok(rot.right <= ops.left + 1, 'con el rotulo a la izquierda, no encima',
       Math.round(rot.right) + ' <= ' + Math.round(ops.left));
    // Ninguna pestaña es una caja: son texto con una linea abajo
    const una = ejes[0].querySelector('.fi-op');
    ok(estilo(una, 'border-top-width') === '0px' &&
       transparente(estilo(una, 'background-color')),
       'las pestañas son texto, no botones con caja',
       estilo(una, 'border-top-width') + ' / ' + estilo(una, 'background-color'));

    cerrarFicha();
  }

  /* Cambiar de memoria no cambia de version si la otra memoria la tiene: el
     que mira un 256GB Sim y toca 512GB quiere el 512GB Sim, no el E-Sim.
     El caso se busca a proposito: tiene que ser uno donde "mantener la
     version" y "agarrar la mas barata con stock" den DISTINTO. Si no, la
     prueba pasa igual aunque el codigo no mantenga nada. */
  const casoMem = (() => {
    const porPrecio = (a, b) => (a.precio ?? Infinity) - (b.precio ?? Infinity);
    for(const m of MODELOS){
      if(!m.multi || !conPestanas(m)) continue;
      const reales = [...versionesDe(m).entries()].filter(([o, g]) => !opcionEsColor(g, o));
      const mems = [...new Set(reales.map(([o]) => memoriaDeOpcion(o)))];
      if(mems.length < 2 || !mems.every(Boolean)) continue;
      for(const [op, g] of reales){
        const resto = restoDeOpcion(op);
        for(const mm of mems){
          if(mm === memoriaDeOpcion(op)) continue;
          const alla = reales.filter(([o]) => memoriaDeOpcion(o) === mm);
          if(!alla.some(([o]) => restoDeOpcion(o) === resto)) continue;
          const filas = alla.flatMap(([, gg]) => gg);
          const conStock = filas.filter(x => x.stock);
          const sola = [...(conStock.length ? conStock : filas)].sort(porPrecio)[0];
          if(restoDeOpcion(sola.opcion || sola.etiqueta) === resto) continue;
          return { m, desde: g[0], mem: mm, resto, op };
        }
      }
    }
    return null;
  })();
  if(!casoMem){
    R.push('  --  hoy ninguna ficha distingue entre mantener la version y agarrar la mas barata');
  }else{
    abrirFicha(clave(casoMem.desde), null);
    const tab = todos('#ficha .fi-ops[data-eje="memoria"] .fi-op')
                  .find(b => b.dataset.mem === casoMem.mem);
    ok(!!tab, 'la otra memoria tiene su pestaña', casoMem.m.desc + ' / ' + casoMem.mem);
    if(tab){
      tab.click();
      const ahora = buscarProducto(FICHA) || {};
      ok(memoriaDeOpcion(ahora.opcion) === casoMem.mem,
         'tocar otra memoria lleva a esa memoria', casoMem.op + ' -> ' + ahora.opcion);
      ok(restoDeOpcion(ahora.opcion) === casoMem.resto,
         'y se queda con la misma version, no con la mas barata de esa memoria',
         casoMem.op + ' -> ' + ahora.opcion);
    }
    cerrarFicha();
  }

  /* ---- 6. Cambiar de version redibuja la tira ----
     La tira cuelga de la foto, no de .fi-datos: si no se redibuja aparte queda
     mostrando los colores y los precios de la version anterior. */
  const conAmbos = MODELOS.find(m => {
    if(!m.multi || !conPestanas(m)) return false;
    abrirFicha(clave(m.rep), null);
    const hay = document.querySelectorAll('#ficha .fi-pintas button').length >= 2 &&
                document.querySelectorAll('#ficha .fi-op').length >= 2;
    cerrarFicha();
    return hay;
  });
  if(!conAmbos){
    R.push('  --  hoy ninguna ficha tiene pestañas y tira de colores a la vez');
  }else{
    abrirFicha(clave(conAmbos.rep), null);
    d = document.getElementById('ficha');
    const antes = todos('#ficha .fi-pintas button').map(b => b.dataset.k).join(',');
    const otra = todos('#ficha .fi-op').find(b => b.getAttribute('aria-pressed') !== 'true');
    otra.click();
    const despues = todos('#ficha .fi-pintas button').map(b => b.dataset.k).join(',');
    const suyos = new Set((buscarModelo(FICHA).variantes || []).map(clave));
    ok(todos('#ficha .fi-pintas button').every(b => suyos.has(b.dataset.k)),
       'al cambiar de version la tira sigue siendo del mismo modelo', conAmbos.desc);
    ok(todos('#ficha .fi-pintas').length === 1 && todos('#ficha .fi-colores').length === 1,
       'y no se duplica');
    R.push('  --  ' + conAmbos.desc + ': ' + (antes === despues ? 'la tira no cambio' : 'la tira se redibujo'));
    cerrarFicha();
  }

  /* ---- 7. Los sugeridos: la cinta (21/09) ----
     Pedro la eligio del muestrario. Lo que la define y hay que sostener: la
     foto en un cuadrado FIJO (ninguna puede quedar mas grande que otra) y el
     precio en texto, no en etiqueta oscura. */
  const conRel = MODELOS.find(m => relacionados(m).length);
  abrirFicha(clave(conRel.rep), null);
  d = document.getElementById('ficha');
  const pc = d.querySelector('.fi-rel .pc');
  ok(!!pc, 'la ficha sugiere otros productos', conRel.desc);
  ok(pc && estilo(pc, 'flex-direction') === 'row',
     'los sugeridos son pastillas, con la foto al costado del nombre',
     pc && estilo(pc, 'flex-direction'));
  ok(pc && !transparente(estilo(pc, 'background-color')),
     'cada una con su fondo', pc && estilo(pc, 'background-color'));

  const pf = pc && pc.querySelector('.pc-foto');
  const rp = pf && pf.getBoundingClientRect();
  ok(rp && rp.width > 0 && Math.abs(rp.width - rp.height) <= 1,
     'la foto va en un cuadrado fijo: ninguna puede entrar mas grande que otra',
     rp && Math.round(rp.width) + 'x' + Math.round(rp.height));
  /* Esta es la que se rompe sola en cuanto alguien toque la animacion: al
     animar opacity y translate la pastilla arma un grupo de composicion, y
     adentro de el la foto deja de fundirse si el cuadrado no tiene fondo. */
  ok(pf && !transparente(estilo(pf, 'background-color')),
     'y el cuadrado tiene fondo propio, para que la foto siga fundiendose al animarse',
     pf && estilo(pf, 'background-color'));

  const pcPrecio = pc && pc.querySelector('.pc-txt i');
  ok(pcPrecio && transparente(estilo(pcPrecio, 'background-color')),
     'el precio va en texto, no en etiqueta oscura',
     pcPrecio && estilo(pcPrecio, 'background-color'));
  ok(pcPrecio && cerca(rgb(estilo(pcPrecio, 'color')), variable('--glow'), 12),
     'y con el color de los links', pcPrecio && estilo(pcPrecio, 'color'));
  const pcImg = pc && pc.querySelector('.pc-foto img');
  ok(!pcImg || estilo(pcImg, 'mix-blend-mode') === 'multiply',
     'y la foto fundida con el fondo');
  ok(todos('#ficha .fi-rel .pc').every((b, i) => b.style.getPropertyValue('--i') === String(i)),
     'cada una sabe su lugar en la fila, que es lo que escalona la entrada');
  cerrarFicha();
}

/* ---- 8. La cinta entra de costado ----
   La entrada NO se dispara al abrir la ficha: los sugeridos estan abajo de
   todo y se la perderia justo el que despues baja a mirarlos. La revela un
   IntersectionObserver cuando el bloque aparece adentro de la ventana.

   Ese disparo no se puede probar aca: el navegador sin ventana corre con reloj
   virtual y nunca entrega los avisos del observador, que dependen de que se
   dibuje un cuadro. Lo que si se prueba es el contrato de las dos puntas --
   arranca escondida y corrida, y con .vis termina quieta en su lugar -- que es
   donde se rompe si alguien toca el CSS. El disparo se verifica con captura. */
function probarEntradaCinta(listo){
  const conRel = MODELOS.find(m => relacionados(m).length);
  if(!conRel){ R.push('  --  hoy ningun producto tiene sugeridos'); return listo(); }
  /* Quien mira si el bloque aparece es un IntersectionObserver, y el navegador
     sin ventana no le entrega nada. Pero si se puede ver que lo PONGA a mirar:
     se le cambia la clase por una que anota a quien observa. Sin esto, sacar
     la llamada a revelarSugeridos() no lo notaba nadie y la cinta se quedaba
     escondida para siempre. */
  const observados = [];
  const IOreal = window.IntersectionObserver;
  if(IOreal) window.IntersectionObserver = class extends IOreal {
    observe(el){ observados.push(el); return super.observe(el); }
  };
  abrirFicha(clave(conRel.rep), null);
  if(IOreal) window.IntersectionObserver = IOreal;

  const d = document.getElementById('ficha');
  const rel = d.querySelector('.fi-rel');
  const pc = rel && rel.querySelector('.pc');
  ok(rel && !rel.classList.contains('vis'),
     'la cinta arranca escondida y no se revela sola al abrir la ficha');
  // De costado y no de abajo: un translate de 0 en X pasaria el "no es none"
  const corridaX = t => Math.abs(parseFloat(String(t).trim().split(/\s+/)[0]) || 0);
  ok(pc && parseFloat(estilo(pc, 'opacity')) === 0 && corridaX(estilo(pc, 'translate')) >= 10,
     'las pastillas arrancan corridas de costado',
     pc && estilo(pc, 'opacity') + ' / ' + estilo(pc, 'translate'));
  ok(!IOreal || observados.includes(rel),
     'y alguien la pone a mirar, para revelarla cuando el bloque aparezca',
     observados.length + ' observado(s)');

  rel.classList.add('vis');
  terminarTransiciones();
  /* "0px" y no "none": el reposo se escribe translate:0 0 a proposito, porque
     interpolar hasta none no es igual de seguro en todos los navegadores. Eso
     deja un grupo de composicion vivo, y por eso el cuadrado de la foto lleva
     su propio fondo (se prueba arriba). */
  const quieto = t => t === 'none' || /^0(px)?( 0(px)?)?$/.test(String(t).trim());
  ok(pc && parseFloat(estilo(pc, 'opacity')) === 1 && quieto(estilo(pc, 'translate')),
     'revelada, la cinta queda quieta en su lugar',
     pc && estilo(pc, 'opacity') + ' / ' + estilo(pc, 'translate'));
  R.push('  --  el disparo por scroll no corre en el navegador sin ventana: se mira con captura');
  cerrarFicha();
  listo();
}

/* ---- 8. Tocar un color cambia la foto grande ----
   La foto del color se pide recien al tocarlo, asi que esto va aparte. Se
   busca a proposito un color cuya foto EXISTA: si no, lo que se probaria es
   el aviso de "sin foto", que ya tiene su tanda. */
function probarFotoDeColor(listo){
  /* Los colores se buscan con el mismo criterio que la ficha (coloresFicha),
     no adivinando: la mayoria de los modelos trae un color por fila y ahi las
     fotos estan, mientras que las filas con varios colores en una sola celda
     casi nunca tienen una foto por color. */
  let caso = null, exacto = false;
  /* El mejor caso es un color que tiene ARCHIVO PROPIO, distinto de la foto de
     su fila: ahi la foto solo puede aparecer si funciona la busqueda por color.
     Si el archivo del color fuera la misma foto de la fila, cambiar de fila ya
     la pondria y la prueba pasaria con el buscador de fotos roto. */
  for(const m of MODELOS){
    const v = m.rep;
    if(!v || !v.imagen) continue;
    const { lista } = coloresFicha(v, m);
    if(lista.length < 2) continue;
    const base = v.imagenGrande || v.imagen;
    const c = lista.find(x => {
      const u = fotosDeColor(x.fila, x.nombre)[0] || '';
      // ni la foto de su fila ni la que la ficha ya esta mostrando
      return u && u !== (x.fila.imagenGrande || x.fila.imagen) && u !== base;
    });
    if(c){ caso = { m, v, color: c.nombre, fila: c.fila }; exacto = true; break; }
  }
  for(let i = 0; !caso && i < MODELOS.length; i++){
    const m = MODELOS[i], v = m.rep;
    if(!v || !v.imagen) continue;
    const { lista } = coloresFicha(v, m);
    if(lista.length < 2) continue;
    const base = v.imagenGrande || v.imagen;
    /* Un color de OTRA fila y con otra foto: si es el color con el que la ficha
       ya abrio, tocarlo no tiene por que cambiar nada y no se probaria nada. */
    const c = lista.find(x => clave(x.fila) !== clave(v) &&
                              (fotosDeColor(x.fila, x.nombre)[0] || '') !== base &&
                              fotosDeColor(x.fila, x.nombre).length);
    if(c) caso = { m, v, color: c.nombre, fila: c.fila };
  }
  if(!caso){
    R.push('  --  hoy ninguna ficha tiene la foto de otro de sus colores');
    return listo();
  }
  // Que la foto este en el navegador antes de medir: el reloj del headless
  // corre mas rapido que la descarga y si no se ve el cambio por medio segundo
  const urls = [...new Set(fotosDeColor(caso.fila, caso.color).flatMap(u => [u, fotoChica(u)]))];
  let faltan = urls.length;
  const seguir = () => { if(--faltan <= 0) medir(); };
  urls.forEach(u => { const i = new Image(); i.onload = i.onerror = seguir; i.src = u; });

  function medir(){
    abrirFicha(clave(caso.v), null);
    const d = document.getElementById('ficha');
    const img = d.querySelector('.fi-marco img');
    const antes = img && img.getAttribute('src');
    const boton = [...d.querySelectorAll('.fi-pintas button')]
                    .find(b => b.dataset.color === caso.color);
    if(!boton){
      R.push('  --  ' + caso.v.id + ': el color ' + caso.color + ' no salio en la tira');
      return listo();
    }
    // La tira muestra la foto de cada color cuando la hay
    ok(/url\(/.test(boton.getAttribute('style') || ''),
       'el boton del color muestra la foto de ese color',
       caso.v.id + ' / ' + caso.color);
    boton.click();
    setTimeout(() => {
      const dd = document.getElementById('ficha');
      const ahora = dd && dd.querySelector('.fi-marco img');
      const src = ahora && ahora.getAttribute('src');
      /* Con archivo propio, la foto tiene que ser ESA. Sin archivo propio vale
         tambien la foto de la fila del color: cuando cada color es una fila,
         esa YA es la del color. Lo que nunca puede ser es la de otra fila. */
      const suyas = exacto
        ? fotosDeColor(caso.fila, caso.color)
        : [...fotosDeColor(caso.fila, caso.color),
           caso.fila.imagenGrande, caso.fila.imagen].filter(Boolean);
      ok(src && src !== antes && suyas.includes(src),
         'tocar un color cambia la foto grande a la de ese color',
         caso.v.id + ' / ' + caso.color + (exacto ? ' (archivo propio)' : '') + ': ' + src);
      listo();
    }, 700);
  }
}
