// La portada lleva a las paginas de producto/ con links de verdad (auditoria
// del 04/11/2026, TG-05; Benja: "dale con Google", 05/11).
//
// Google conocia las paginas de producto/ solo por el sitemap: en la portada
// no habia ningun link a ellas. Desde el 05/11:
//   1. el pie tiene, fijo en el HTML (sin JavaScript), el link a "Todos los
//      modelos" (producto/), que linkea cada pagina;
//   2. el nombre de cada tarjeta es un <a href="producto/<nombre>/">, con la
//      direccion de producto/indice.json; si el modelo todavia no tiene
//      pagina, va sin link;
//   3. el clic comun en el nombre sigue abriendo la ficha, sin salir de la
//      pagina; con Cmd/Ctrl el navegador abre la pagina del modelo en otra
//      pestaña; y la tarjeta se ve y se elige con el teclado como antes.
// Las paginas mismas y robots.txt los mira google-links.js.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);

const esperar = setInterval(() => {
  if(!MODELOS.length || !FUENTE) return;
  clearInterval(esperar);
  for(let i=1;i<5000;i++) clearInterval(i);
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; })
    .finally(() => {
      try{ cerrarFicha(); }catch(e){}
      try{ pararPaseos(); pararOfertas(); }catch(e){}
      for(let i=1;i<5000;i++) clearInterval(i);
      const pre=document.createElement('pre'); pre.id='RESULTADO';
      pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
      document.body.appendChild(pre);
    });
}, 150);

async function gpLeer(ruta){
  try{
    const r = await fetch(ruta + (ruta.includes('?') ? '&' : '?') + '_=' + Date.now(), { cache: 'no-store' });
    return r.ok ? await r.text() : null;
  }catch(e){ return null; }
}
const gpEspera = ms => new Promise(r => setTimeout(r, ms));
const gpEj = (l, n = 4) => l.length ? l.slice(0, n).join(', ') + (l.length > n ? ' y ' + (l.length - n) + ' mas' : '') : 'ninguna';

async function correrPruebas(){
  /* ---- 1. El pie: el link fijo a "Todos los modelos" ---- */
  const src = await gpLeer('index.html');
  ok(src !== null, 'se puede leer index.html');
  const pie = (String(src || '').match(/<footer>[\s\S]*?<\/footer>/) || [''])[0];
  ok(/<a class="pie-todos" href="producto\/">Todos los modelos<\/a>/.test(pie.replace(/<!--[\s\S]*?-->/g, '')),
     'TG-05: el pie trae en el HTML (sin JavaScript) el link a "Todos los modelos" (producto/)');
  const a = document.querySelector('footer .pie-legal a.pie-todos');
  ok(!!a && a.getAttribute('href') === 'producto/' && a.getBoundingClientRect().height > 0 && !a.target,
     'TG-05: y se ve en la portada, en la misma pestaña', a ? a.getAttribute('href') : 'no esta');
  ok(!!a && new URL(a.href).pathname.endsWith('/producto/') && new URL(a.href).origin === location.origin,
     'TG-05: lleva a producto/ del mismo sitio', a && a.href);

  /* ---- 2. El nombre de cada tarjeta ---- */
  const sitemap = await gpLeer('sitemap.xml');
  const enSitemap = new Set([...String(sitemap || '').matchAll(/\/producto\/([a-z0-9-]+)\/<\/loc>/g)].map(m => m[1]));
  let familias = {};
  try{ familias = JSON.parse(await gpLeer('producto/indice.json') || '{}').slugs || {}; }catch(e){}
  ok(Object.keys(familias).length > 50, 'se puede leer producto/indice.json', Object.keys(familias).length);
  verTodoElCatalogo();
  await gpEspera(300);
  await pedirPaginasProducto();
  await gpEspera(100);
  const cards = [...document.querySelectorAll('#grid .card')];
  ok(cards.length > 20, 'la grilla de "Ver todo el catalogo" dibujo tarjetas', cards.length);
  const porClave = new Map(LISTA.map(p => [clave(p), p]));
  const mal = { sinLink: [], otro: [], fuera: [], texto: [], tab: [] };
  let conLink = 0, sinPagina = 0;
  for(const c of cards){
    const p = porClave.get(c.dataset.key);
    if(!p) continue;
    const h = c.querySelector('.nombre'), l = h && h.querySelector('a.ir-pagina');
    const s = familias[familia(p.rep || p)];
    if((h && h.textContent.trim()) !== String(p.titulo || p.desc || '').trim()) mal.texto.push(c.dataset.key);
    if(!s){ sinPagina++; if(l) mal.otro.push(c.dataset.key + ' (sin pagina)'); continue; }
    if(!l){ mal.sinLink.push(c.dataset.key); continue; }
    conLink++;
    if(l.getAttribute('href') !== 'producto/' + s + '/') mal.otro.push(c.dataset.key + ' -> ' + l.getAttribute('href'));
    if(!enSitemap.has(s)) mal.fuera.push(s);
    if(l.getAttribute('tabindex') !== '-1') mal.tab.push(c.dataset.key);
  }
  ok(conLink > 0 && !mal.sinLink.length,
     'TG-05: el nombre de cada tarjeta con pagina es un link a producto/<nombre>/', gpEj(mal.sinLink) + ' · ' + conLink + ' con link');
  ok(!mal.otro.length, 'TG-05: a la pagina de su familia (producto/indice.json), y sin link si todavia no tiene', gpEj(mal.otro));
  ok(!mal.fuera.length, 'TG-05: y esa pagina esta en el sitemap', gpEj(mal.fuera));
  ok(!mal.texto.length, 'el nombre dice lo mismo que antes', gpEj(mal.texto));
  ok(!mal.tab.length, 'el link no suma una parada de Tab por tarjeta (tabindex -1)', gpEj(mal.tab));
  if(sinPagina) info(sinPagina + ' tarjeta(s) de modelos que todavia no tienen pagina (la arma el proximo PUBLICAR): van sin link');
  const l0 = document.querySelector('#grid .card .nombre a.ir-pagina');
  if(l0){
    const cs = getComputedStyle(l0), ch = getComputedStyle(l0.closest('.nombre'));
    ok(cs.color === ch.color && /none/.test(cs.textDecorationLine),
       'se ve igual que antes: el color del nombre y sin subrayar', cs.color + ' · ' + cs.textDecorationLine);
  }

  /* ---- 3. Las tarjetas dibujadas antes de que llegara el indice ---- */
  const guardado = SLUGS_PRODUCTO;
  SLUGS_PRODUCTO = null;
  pintar();
  await gpEspera(100);
  const antes = document.querySelectorAll('#grid .card .nombre a.ir-pagina').length;
  SLUGS_PRODUCTO = guardado;
  ponerLinksDePagina();
  const despues = document.querySelectorAll('#grid .card .nombre a.ir-pagina').length;
  ok(antes === 0 && despues > 0 && despues === document.querySelectorAll('#grid .card').length - sinPagina,
     'si el indice llega despues, las tarjetas ya dibujadas reciben su link', antes + ' -> ' + despues);

  /* ---- 4. El clic ---- */
  const link = document.querySelector('#grid .card .nombre a.ir-pagina');
  if(!link){ ok(false, 'hay una tarjeta con link para probar el clic'); return; }
  const ruta = location.pathname;
  let ultimo = null;
  const mirar = e => { if(e.target === link){ ultimo = e.defaultPrevented; e.preventDefault(); } };
  window.addEventListener('click', mirar);
  try{
    link.click();
    await gpEspera(300);
    ok(ultimo === true && location.pathname === ruta && !!FICHA && !!document.getElementById('ficha'),
       'el clic comun en el nombre abre la ficha, sin salir de la pagina', [ultimo, FICHA, location.pathname].join(' · '));
    try{ cerrarFicha(); }catch(e){}
    await gpEspera(300);
    ultimo = null;
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true, ctrlKey: true }));
    await gpEspera(300);
    ok(ultimo === false && !FICHA,
       'con Cmd/Ctrl la pagina no lo frena: el navegador abre producto/<nombre>/ en otra pestaña', [ultimo, FICHA].join(' · '));
  }finally{
    window.removeEventListener('click', mirar);
  }
  try{ cerrarFicha(); }catch(e){}
  // La tarjeta sigue eligiendose con el teclado: Enter sobre la tarjeta
  const card = document.querySelector('#grid .card');
  card.focus();
  card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await gpEspera(300);
  ok(!!FICHA && !!document.getElementById('ficha'), 'Enter sobre la tarjeta sigue abriendo la ficha', FICHA);
}
