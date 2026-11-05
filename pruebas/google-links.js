// Que Google llegue por links a cada pagina de producto/ (auditoria del
// 04/11/2026, TG-05, TG-11 y TG-12; Benja: "dale con Google", 05/11).
//
// En Search Console, al 22/10: 24 paginas indexadas y 453 sin indexar. Google
// conocia las 471 paginas de producto/ solo por el sitemap: ningun link
// llevaba a ellas. Desde el 05/11:
//   1. robots.txt le pide a Google que no lea las herramientas, las pruebas,
//      las muestras ni los .py, .command y .txt de la raiz (TG-12), sin
//      tocarle nada de lo que necesita para dibujar la portada;
//   2. producto/index.html, "Todos los modelos", linkea cada pagina del
//      sitemap, por rubro, y esta en el sitemap;
//   3. cada pagina de un modelo de hoy trae "Otros modelos" (hasta 6 del
//      mismo rubro o la misma marca) y en el pie "Todos los modelos";
//   4. todas dicen lang="es-AR" (TG-11).
// Lo que depende del dia (un modelo nuevo que todavia no tiene pagina, uno
// que volvio y su pagina sigue sin "Otros modelos") es AVISO: lo arregla el
// proximo PUBLICAR. Lo que esta mal armado es FALLA.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);
const aviso = t => R.push('AVISO ' + t);

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

/* Un archivo tal como lo sirve el servidor local. null si no esta. */
async function glLeer(ruta){
  try{
    const r = await fetch(ruta + (ruta.includes('?') ? '&' : '?') + '_=' + Date.now(), { cache: 'no-store' });
    return r.ok ? await r.text() : null;
  }catch(e){ return null; }
}
const glEj = (l, n = 4) => l.length ? l.slice(0, n).join(', ') + (l.length > n ? ' y ' + (l.length - n) + ' mas' : '') : '';

/* robots.txt como lo lee Google: las reglas del grupo "User-agent: *", '*'
   es cualquier cosa y '$' el final; gana la regla mas larga y, si empatan,
   Allow. */
function glReglas(txt){
  const reglas = [];
  let todos = false;
  for(const linea of String(txt || '').split('\n')){
    const m = linea.replace(/#.*/, '').trim().match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if(!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if(k === 'user-agent') todos = v === '*';
    else if(todos && (k === 'allow' || k === 'disallow') && v)
      reglas.push({ deja: k === 'allow', largo: v.length,
                    re: new RegExp('^' + v.split('*').map(x => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*').replace(/\\\$$/, '$')) });
  }
  return reglas;
}
function glDeja(reglas, ruta){
  let mejor = null;
  for(const r of reglas)
    if(r.re.test(ruta) && (!mejor || r.largo > mejor.largo || (r.largo === mejor.largo && r.deja))) mejor = r;
  return !mejor || mejor.deja;
}

async function correrPruebas(){
  // Lo que pidio la portada para dibujarse, antes de que esta tanda pida nada
  const pedidos = [...new Set(performance.getEntriesByType('resource')
    .map(e => { try{ return new URL(e.name); }catch(x){ return null; } })
    .filter(u => u && u.origin === location.origin && !/\/_probe-/.test(u.pathname))
    .map(u => decodeURIComponent(u.pathname)))];

  /* ---- 1. robots.txt (TG-12) ---- */
  const robots = await glLeer('robots.txt');
  ok(robots !== null, 'se puede leer robots.txt');
  const reglas = glReglas(robots);
  const afuera = ['/herramientas/', '/herramientas/catalogo-maestro.csv', '/herramientas/paginas-producto.py',
                  '/pruebas/', '/pruebas/LEEME.txt', '/pruebas/correr.py', '/muestras/', '/muestras/x.html',
                  '/PUBLICAR.command', '/PROBAR.command', '/validar.py', '/revision-diaria.py',
                  '/condicion-aceptada.txt', '/MEDICION-ADVAPP.txt', '/fotos-aceptadas.txt'];
  const adentro = ['/', '/index.html', '/404.html', '/sitemap.xml', '/robots.txt', '/producto/',
                   '/producto/apple-iphone-17-pro/', '/producto/indice.json', '/p/indice.json', '/p/CEL-APP-068.html',
                   '/datos/descripciones.json', '/datos/resenas.json', '/fotos/indice.json', '/fotos/AT-0072-03.jpg',
                   '/fotos/mini/sinfondo/AT-0072-03.webp', '/marian/marian.js', '/marian/marian.css',
                   '/assets/preview.png', '/assets/lilita-latin.woff2', '/marcas/apple.png'];
  const pasan = afuera.filter(r => glDeja(reglas, r));
  ok(!pasan.length, 'TG-12: robots.txt pide no leer herramientas/, pruebas/, muestras/ y los .py, .command y .txt',
     glEj(pasan) || afuera.length + ' casos');
  const trabados = adentro.filter(r => !glDeja(reglas, r));
  ok(!trabados.length, 'TG-12: y deja leer la portada, producto/, p/, datos/, fotos/, marian/, assets/ y marcas/',
     glEj(trabados) || adentro.length + ' casos');
  const sinPermiso = pedidos.filter(r => !glDeja(reglas, r));
  ok(pedidos.length > 0 && !sinPermiso.length,
     'TG-12: nada de lo que pidio la portada esta bloqueado (Google lo necesita para dibujarla)',
     glEj(sinPermiso) || pedidos.length + ' archivos');
  ok(/^Sitemap:\s*https:\/\/catalogo\.advancetecno\.com\.ar\/sitemap\.xml\s*$/mi.test(robots || ''),
     'robots.txt sigue diciendo donde esta el sitemap');

  /* ---- 2. El sitemap ---- */
  const sitemap = await glLeer('sitemap.xml');
  const locs = [...String(sitemap || '').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const slugs = locs.map(u => (u.match(/\/producto\/([a-z0-9-]+)\/$/) || [])[1]).filter(Boolean);
  const enSitemap = new Set(slugs);
  ok(slugs.length > 50, 'el sitemap lista las paginas de producto/', slugs.length);
  ok(locs.includes(URL_PUBLICA + 'producto/'), 'TG-05: y "Todos los modelos" (producto/)');

  /* ---- 3. "Todos los modelos" (producto/index.html) ---- */
  const indice = await glLeer('producto/');
  ok(indice !== null, 'TG-05: producto/ tiene su pagina ("Todos los modelos")');
  if(indice === null) return;
  ok(/<html lang="es-AR">/.test(indice) && indice.includes('<link rel="canonical" href="' + URL_PUBLICA + 'producto/">')
     && !/noindex/.test(indice),
     'TG-05: es para Google: es-AR, su canonica y sin noindex');
  const delIndice = [...indice.matchAll(/<li><a href="([a-z0-9-]+)\/">/g)].map(m => m[1]);
  const setIndice = new Set(delIndice);
  const sinLink = slugs.filter(s => !setIndice.has(s));
  ok(!sinLink.length, 'TG-05: linkea cada pagina del sitemap (ninguna queda sin un link que la traiga)',
     glEj(sinLink) || slugs.length + ' paginas');
  const deMas = delIndice.filter(s => !enSitemap.has(s));
  ok(!deMas.length && delIndice.length === setIndice.size,
     'TG-05: y nada que no este en el sitemap (ni un desvio), sin repetir', glEj(deMas) || delIndice.length + ' links');
  const anclas = new Set([...indice.matchAll(/<section class="bloque" id="([a-z0-9-]+)"/g)].map(m => m[1]));
  const chips = [...indice.matchAll(/<a href="#([a-z0-9-]+)">/g)].map(m => m[1]);
  ok(anclas.size > 3 && chips.length === anclas.size && chips.every(a => anclas.has(a)),
     'TG-05: un rubro por bloque, con su ancla y su boton arriba', anclas.size + ' rubros');

  /* ---- 4. Cada pagina del sitemap ---- */
  // Las de los modelos de hoy, por su familia (producto/indice.json)
  let familias = {};
  try{ familias = JSON.parse(await glLeer('producto/indice.json') || '{}').slugs || {}; }catch(e){}
  const deHoy = new Set(MODELOS.map(m => familias[familia(m.rep || m)]).filter(Boolean));
  const paginas = {};
  for(let i = 0; i < slugs.length; i += 16)
    await Promise.all(slugs.slice(i, i + 16).map(async s => { paginas[s] = await glLeer('producto/' + s + '/'); }));
  const mal = { faltan: [], lang: [], otros: [], propia: [], muchos: [], ancla: [], pie: [], sinOtros: [] };
  const entrantes = new Map();
  let conOtros = 0;
  for(const s of slugs){
    const t = paginas[s];
    if(t === null){ mal.faltan.push(s); continue; }
    if(!/<html lang="es-AR">/.test(t)) mal.lang.push(s);
    const b = t.match(/<section class="bloque" aria-labelledby="t-otros">([\s\S]*?)<\/section>/);
    if(!b){ if(deHoy.has(s)) mal.sinOtros.push(s); continue; }
    conOtros++;
    const ls = [...b[1].matchAll(/<li><a href="\.\.\/([^"/]+)\/">/g)].map(m => m[1]);
    if(ls.some(x => !enSitemap.has(x))) mal.otros.push(s + ' -> ' + ls.filter(x => !enSitemap.has(x))[0]);
    if(ls.includes(s)) mal.propia.push(s);
    if(!ls.length || ls.length > 6 || new Set(ls).size !== ls.length) mal.muchos.push(s + ' (' + ls.length + ')');
    const a = (b[1].match(/<a class="todos" href="\.\.\/#([a-z0-9-]+)">/) || [])[1];
    if(!a || !anclas.has(a)) mal.ancla.push(s + ' -> #' + a);
    if(!t.includes('<a href="../">Todos los modelos</a>')) mal.pie.push(s);
    for(const x of ls) if(x !== s) entrantes.set(x, (entrantes.get(x) || 0) + 1);
  }
  ok(!mal.faltan.length, 'cada pagina del sitemap existe', glEj(mal.faltan) || slugs.length + ' paginas');
  ok(!mal.lang.length, 'TG-11: todas dicen lang="es-AR"', glEj(mal.lang) || slugs.length + ' paginas');
  ok(conOtros > slugs.length / 2, 'TG-05: las paginas traen "Otros modelos"', conOtros + ' de ' + slugs.length);
  ok(!mal.otros.length, 'TG-05: cada link de "Otros modelos" lleva a una pagina del sitemap', glEj(mal.otros) || 'ninguna');
  ok(!mal.propia.length, 'TG-05: ninguna se nombra a si misma', glEj(mal.propia) || 'ninguna');
  ok(!mal.muchos.length, 'TG-05: de 1 a 6 modelos, sin repetir', glEj(mal.muchos) || 'ninguna');
  ok(!mal.ancla.length, 'TG-05: "Todos los modelos de ..." lleva a un rubro que esta en el indice', glEj(mal.ancla) || 'ninguna');
  ok(!mal.pie.length, 'TG-05: y el pie lleva a "Todos los modelos"', glEj(mal.pie) || 'ninguna');
  if(mal.sinOtros.length)
    aviso('TG-05: ' + mal.sinOtros.length + ' pagina(s) de modelos de hoy sin "Otros modelos" (las rehace el proximo PUBLICAR): ' + glEj(mal.sinOtros));
  const desdeOtra = slugs.filter(s => entrantes.has(s));
  const huerfanasDeHoy = slugs.filter(s => deHoy.has(s) && !entrantes.has(s));
  if(huerfanasDeHoy.length)
    aviso('TG-05: ' + huerfanasDeHoy.length + ' pagina(s) de modelos de hoy sin link desde otra pagina de modelo (solo desde el indice): ' + glEj(huerfanasDeHoy));
  info('TG-05: ' + slugs.filter(s => setIndice.has(s) || entrantes.has(s)).length + ' de ' + slugs.length +
       ' paginas con al menos un link que llega; ' + desdeOtra.length + ' tambien desde otra pagina de modelo; ' +
       deHoy.size + ' son de modelos de hoy');
  const nuevos = MODELOS.filter(m => (m.variantes || [m]).some(v => v && v.precio !== null && v.precio !== undefined)
                                  && !familias[familia(m.rep || m)]).map(m => m.desc);
  if(nuevos.length) info(nuevos.length + ' modelo(s) de hoy todavia sin pagina (la arma el proximo PUBLICAR): ' + glEj(nuevos, 3));
}
