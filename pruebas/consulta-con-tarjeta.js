// La tarjeta en la consulta por WhatsApp (Benja, 16/11/2026: «agregalo»). El
// mensaje que arma la web al tocar «Consultar por WhatsApp» lleva al final, en
// un renglon aparte, el mismo link que manda Compartir (p/<ID>.html?v=…): a
// Advance le llega la consulta con la tarjeta de ese producto (la foto, el
// modelo, el precio y la hora).
//   [1] el mensaje con el link: al final y en un renglon aparte; en el del
//       usado, despues del primer parrafo; un segundo toque cambia el link, no
//       suma otro; el texto de siempre, con su precio en USD, queda igual
//   [2] la tarjeta de la grilla, con stock (la consulta) y sin stock (el
//       aviso): al tocar, el link de ESA fila; hasta el toque el boton dice
//       lo de siempre
//   [3] la ficha: la consulta (con el renglon de las cuotas, si lo tiene) y
//       «Avisame cuando entre», con el link de la fila que se mira
//   [4] Recien llegados
//   [5] el cotizador de usados: solo el mensaje que nombra el producto
//   [6] sin pagina en p/indice.json, o si el indice no llego, el mensaje sale
//       como antes (el #p= no arma tarjeta)
//   [7] las consultas generales no lo llevan: el flotante, el pedido, el pie,
//       las preguntas
//   [8] el indice se pide solo, un rato despues de la primera carga, y el
//       toque sigue su camino (lo ve la medicion)
// Los casos se usan si hoy el catalogo los tiene; si no, la comprobacion dice
// "--" y por que.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);
const ctDormir = ms => new Promise(r => setTimeout(r, ms));
// El mensaje que lleva un boton de WhatsApp
const ctTexto = a => { try{ return new URL(a.href).searchParams.get('text') || ''; }catch(e){ return ''; } };
/* Un toque que no abre WhatsApp: la pagina suma el link en la bajada del
   toque (oyente en document), y aca, en el boton, se frena el salto. Devuelve
   el mensaje con que habria salido. */
function ctTocar(a){
  const frenar = e => e.preventDefault();
  a.addEventListener('click', frenar);
  a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  a.removeEventListener('click', frenar);
  return ctTexto(a);
}
const CT_LINK = /\n\n(https:\/\/catalogo\.advancetecno\.com\.ar\/p\/([^\/?\s]+)\.html\?v=\d{12})$/;
// "antes" + dos saltos + el link de la fila k, y nada mas
const ctConLink = (antes, despues, k) => {
  const m = CT_LINK.exec(despues);
  return !!m && despues === antes + '\n\n' + m[1] && m[2] === encodeURIComponent(k);
};

const esperaCT = setInterval(() => {
  if(!MODELOS.length || !FUENTE || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperaCT);
  (async () => {
    try{ await ctPruebas(); }catch(e){ R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; }
    try{ quitarFicha(); }catch(e){}
    try{ pararPaseos(); pararOfertas(); pararNuevos(); pararMarcas(); pararMundos(); }catch(e){}
    for(let i=1;i<5000;i++) clearInterval(i);
    const pre=document.createElement('pre'); pre.id='RESULTADO';
    pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
    document.body.appendChild(pre);
  })();
}, 150);

async function ctPruebas(){
  /* ---- [8] el indice se pide solo ---- */
  await ctDormir(2500);
  ok(PAGINAS_P !== null, '[8] p/indice.json se pide solo, un rato despues de la primera carga (sin abrir ninguna ficha)');
  const ids = await paginasDeVistaPrevia();
  ok(ids instanceof Set && ids.size > 0 && PAGINAS_P_LEIDAS === ids, '[8] y queda leido', ids && ids.size + ' paginas');
  if(!(ids instanceof Set) || !ids.size) return;

  /* ---- [1] el mensaje con el link ---- */
  const L1 = URL_PUBLICA + 'p/CON-SON-003.html?v=202611161203', L2 = URL_PUBLICA + 'p/CON-SON-003.html?v=202611161210';
  const consulta = 'Hola! Me interesa la PlayStation 5 1TB Física (USD 915). ¿Me pasás info?';
  ok(mensajeConTarjeta(consulta, L1) === consulta + '\n\n' + L1, '[1] el link va al final, en un renglon aparte, y el mensaje de siempre queda igual (con su USD)');
  const conCuotasTxt = consulta + '\n\nLo pago con tarjeta en 6 cuotas: aprox. $ 355.000 c/u.';
  ok(mensajeConTarjeta(conCuotasTxt, L1) === conCuotasTxt + '\n\n' + L1, '[1] con el renglon de las cuotas, despues de las cuotas');
  ok(mensajeConTarjeta(mensajeConTarjeta(consulta, L1), L2) === consulta + '\n\n' + L2
     && mensajeConTarjeta(mensajeConTarjeta(conCuotasTxt, L1), L2) === conCuotasTxt + '\n\n' + L2,
     '[1] un segundo toque cambia el link por el de ese minuto: no suma otro');
  const usado = 'Hola! Me interesa el iPhone 17 Pro 256GB E-Sim en Orange y quiero entregar mi usado como parte de pago.'
              + '\n\nMi usado: iPhone 13 128GB, batería 86%: USD 300\niPhone 17 Pro 256GB E-Sim: USD 1.400\nMe queda: USD 1.100'
              + '\n\nTe paso fotos y los detalles:';
  const usadoCon = mensajeConTarjeta(usado, L1);
  ok(usadoCon === usado.replace('\n\nMi usado', '\n' + L1 + '\n\nMi usado') && usadoCon.endsWith('Te paso fotos y los detalles:'),
     '[1] en el del usado va despues del primer parrafo (al final quedaria como si fueran las fotos)', usadoCon.split('\n').slice(0, 2).join(' / '));
  ok(mensajeConTarjeta(usadoCon, L2) === usado.replace('\n\nMi usado', '\n' + L2 + '\n\nMi usado'), '[1] y ahi tambien se cambia, no se suma');
  ok(mensajeConTarjeta('', L1) === '\n\n' + L1 && mensajeConTarjeta(consulta + '\n\nhttps://otro.sitio/x', L1) === consulta + '\n\nhttps://otro.sitio/x\n\n' + L1,
     '[1] solo saca un link de pagina p/ con su ?v=: otro link que escribio el cliente se queda');

  /* ---- [2] la tarjeta de la grilla ---- */
  try{ if(!verTodo) verTodoElCatalogo(); }catch(e){}
  await ctDormir(600);
  const cards = [...grid.querySelectorAll('.card')].filter(c => c.querySelector('a.wa'));
  const conStock = cards.find(c => !c.classList.contains('agotado') && ids.has(c.dataset.key));
  const sinStock = cards.find(c => c.classList.contains('agotado') && ids.has(c.dataset.key));
  for(const [nombre, card, dice] of [['con stock', conStock, /^Hola! Me interesa .+\. ¿Me pasás info\?$/], ['sin stock', sinStock, /^Hola! .+ figuran? sin stock\. ¿Me avisan cuando entre\?$/]]){
    if(!card){ info('[2] hoy la grilla no tiene una tarjeta ' + nombre + ' con pagina: no se mira'); continue; }
    const a = card.querySelector('a.wa'), k = card.dataset.key;
    const antes = ctTexto(a);
    ok(dice.test(antes) && !/\/p\//.test(antes), '[2] la tarjeta ' + nombre + ': hasta el toque, el boton dice lo de siempre', antes);
    const despues = ctTocar(a);
    ok(ctConLink(antes, despues, k), '[2] al tocarla, el mensaje suma el link de la pagina de ESA fila, con su ?v=', k + ' · ' + despues.slice(-70).replace(/\n/g, ' / '));
    ok(a.href.startsWith('https://wa.me/' + WHATSAPP + '?text=') && !a.href.includes('+') && a.href.includes('%0A%0Ahttps%3A%2F%2F'),
       '[2] y sigue siendo un link a nuestro WhatsApp, codificado como siempre');
    const p = buscarModelo(k);
    if(p && p.stock && typeof p.precio === 'number') ok(/\((?:desde )?USD [\d.]+\)/.test(despues), '[2] con el precio en USD, como siempre (Benja, 26/10)', despues.slice(0, 90));
    const otra = ctTocar(a);
    ok(ctConLink(antes, otra, k) && (otra.match(/\/p\//g) || []).length === 1, '[2] un segundo toque no suma otro link');
  }

  /* ---- [6] sin pagina, o sin el indice ---- */
  if(conStock){
    const a = conStock.querySelector('a.wa'), k = conStock.dataset.key;
    const limpio = ctTexto(a).replace(CT_LINK, '');
    a.href = linkWA(limpio);
    const guardado = PAGINAS_P_LEIDAS;
    try{
      PAGINAS_P_LEIDAS = new Set([...guardado].filter(x => x !== k));
      ok(ctTocar(a) === limpio, '[6] si esa fila no tiene pagina en p/indice.json, el mensaje sale como antes (el #p= no arma tarjeta)');
      PAGINAS_P_LEIDAS = null;
      ok(ctTocar(a) === limpio, '[6] y si el indice todavia no llego, tambien');
    } finally { PAGINAS_P_LEIDAS = guardado; }
    ok(ctConLink(limpio, ctTocar(a), k), '[6] con el indice de vuelta, lo suma');
    a.href = linkWA(limpio);
  }

  /* ---- [4] Recien llegados ---- */
  const nv = [...document.querySelectorAll('.nv-tarj')].find(t => t.querySelector('a.nv-consultar') && ids.has(t.dataset.key));
  if(nv){
    const a = nv.querySelector('a.nv-consultar'), antes = ctTexto(a);
    ok(ctConLink(antes, ctTocar(a), nv.dataset.key), '[4] el «Consultar» de Recien llegados tambien lo suma', nv.dataset.key);
    a.href = linkWA(antes);
  } else info('[4] hoy no hay un Recien llegado con boton de consulta y pagina: no se mira');

  /* ---- [3] la ficha ---- */
  const abrir = async k => { quitarFicha(); abrirFicha(k, false); await ctDormir(700); return document.getElementById('ficha'); };
  const filaCon = PRODUCTOS.find(p => p.stock && typeof p.precio === 'number' && ids.has(clave(p)) && buscarModelo(clave(p)));
  const filaSin = PRODUCTOS.find(p => !p.stock && ids.has(clave(p)) && buscarModelo(clave(p)));
  for(const [nombre, fila, clase] of [['la consulta', filaCon, 'a.cta:not(.cta-aviso)'], ['«Avisame cuando entre»', filaSin, 'a.cta.cta-aviso']]){
    if(!fila){ info('[3] hoy no hay una fila para mirar ' + nombre + ' de la ficha'); continue; }
    const d = await abrir(clave(fila));
    const a = d && d.querySelector('.fi-botones > ' + clase);
    if(!a){ info('[3] la ficha de ' + clave(fila) + ' no abrio con ese boton (abrio ' + FICHA + '): no se mira ' + nombre); continue; }
    const antes = ctTexto(a);
    const despues = ctTocar(a);
    ok(ctConLink(antes, despues, FICHA) && ids.has(FICHA), '[3] ' + nombre + ' de la ficha suma el link de la fila que se mira', FICHA + ' · ' + despues.slice(-64).replace(/\n/g, ' / '));
    if(nombre === 'la consulta'){
      ok(/\(USD [\d.]+\)/.test(despues), '[3] con el precio en USD', despues.slice(0, 90));
      // El pedido y los demas links de la ficha no son la consulta del producto
      const otros = [...d.querySelectorAll('a[href*="wa.me/"]')].filter(x => x !== a);
      ok(otros.every(x => { const t0 = ctTexto(x); return ctTocar(x) === t0; }), '[3] los otros links a WhatsApp de la ficha no lo suman', otros.length + ' links');

      /* ---- [5] el cotizador de usados, con una ficha abierta ---- */
      const u = document.createElement('div');
      u.id = 'usado';
      u.innerHTML = '<a id="us-wa" target="_blank" rel="noopener"></a><a id="us-enviar" target="_blank" rel="noopener"></a><a class="otro" target="_blank" rel="noopener"></a>';
      document.body.appendChild(u);
      try{
        const [w, f, o] = u.querySelectorAll('a');
        w.href = linkWA(usado);
        const con = ctTocar(w);
        ok(con.startsWith('Hola! Me interesa') && new RegExp('parte de pago\\.\\nhttps://catalogo\\.advancetecno\\.com\\.ar/p/' + encodeURIComponent(FICHA).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.html\\?v=\\d{12}\\n\\nMi usado').test(con)
           && con.endsWith('Te paso fotos y los detalles:'),
           '[5] el cotizador abierto desde una ficha: el link de esa fila, despues del primer parrafo', con.split('\n').slice(0, 2).join(' / '));
        const fuera = 'Hola! Me interesa el iPhone 17 Pro (USD 1.400) y quiero entregar mi usado como parte de pago.\n\nMi usado (no está en el cotizador):\nQué es: Celular\n\n¿Cuánto me lo toman?';
        f.href = linkWA(fuera);
        ok(/parte de pago\.\nhttps:\/\/\S+\/p\/\S+\.html\?v=\d{12}\n\nMi usado \(no está/.test(ctTocar(f)), '[5] y «Otro equipo» igual');
        const solo = 'Hola! Quiero entregar mi usado como parte de pago.\n\nMi usado: iPhone 13 128GB: USD 300';
        w.href = linkWA(solo);
        ok(ctTocar(w) === solo, '[5] el cotizador sin producto (desde el pedido) no lleva link: no hay de que');
        o.href = linkWA(usado);
        ok(ctTocar(o) === usado, '[5] ni otro link del cotizador');
      } finally { u.remove(); }
    }
  }
  quitarFicha();

  /* ---- [7] las consultas generales ---- */
  const generales = [...document.querySelectorAll('a[href*="wa.me/"]')]
    .filter(a => !a.closest('.card, .nv-tarj, #ficha, #usado') && ctTexto(a));
  const tocadas = generales.filter(a => { const t0 = ctTexto(a); const t1 = ctTocar(a); return t1 !== t0 || /\/p\/\S+\.html\?v=/.test(t1); });
  ok(generales.length > 0 && !tocadas.length, '[7] las consultas generales (el flotante, el pie, las preguntas, el pedido) no llevan link',
     generales.length + ' links' + (tocadas.length ? ' · mal: ' + tocadas.map(a => a.id || a.className).join(', ') : ''));
  const flotante = document.getElementById('wa-flotante');
  if(flotante) ok(generales.includes(flotante), '[7] el flotante esta entre los que se miraron');

  /* ---- [8] el toque sigue su camino ---- */
  if(conStock){
    const a = conStock.querySelector('a.wa'), limpio = ctTexto(a).replace(CT_LINK, '');
    let visto = null;
    const oir = e => { visto = { frenado: e.defaultPrevented, link: e.target.closest('a') === a }; };
    document.addEventListener('click', oir);
    ctTocar(a);
    document.removeEventListener('click', oir);
    ok(!!visto && visto.link, '[8] el toque llega al resto de la pagina (la medicion lo sigue anotando)');
    a.href = linkWA(limpio);
  }
}
