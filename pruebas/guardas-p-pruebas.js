// Guardas de la tanda P (29/09/2026): las pruebas mismas.
//
// La auditoria encontro pruebas que ya no probaban nada y seguian en OK:
//
//  - foto-color.js buscaba archivos <SKU>-<color>.jpg y filas de dos colores,
//    y desde ADVAPP no hay ninguna de las dos cosas: "0 fotos revisadas" (47).
//  - agrupacion.js filtraba la categoria 'Lente', que la pagina renombra a
//    'Objetivo' al cargar: miraba 0 de 189 objetivos (179).
//  - codigos.js tenia un "(control)" con "|| true", y color-precio.js y
//    foto-color.js sumaban ok(true) cuando no habia nada que probar (184).
//  - precios.js probaba una COPIA de num(), no la de la pagina (185).
//  - layout.js no atrapaba sus errores y el runner lo culpaba a internet
//    (182); correr.py usaba un archivo y un puerto fijos, y dos corridas se
//    pisaban (183).
//  - con la medicion encendida, cada corrida de pruebas le iba a mandar
//    visitas falsas a ADVAPP desde localhost (187).
//
// Y del otro lado, pruebas que fallaban sin que hubiera un error: los choques
// de CODIGO que Pedro acepto (162), o el Mac Mini buscado por nombre (191).
//
// Esta tanda mira que esas formas no vuelvan: lee las tandas y correr.py tal
// como los sirve el servidor local (no puede correr Python) y abre la pagina
// en un iframe para ver con que se abre.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);

const esperar = setInterval(() => {
  if(!MODELOS.length) return;
  clearInterval(esperar);
  for(let i=1;i<5000;i++) clearInterval(i);
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; })
    .finally(() => {
      try{ pararPaseos(); pararOfertas(); }catch(e){}
      for(let i=1;i<5000;i++) clearInterval(i);
      const pre=document.createElement('pre'); pre.id='RESULTADO';
      pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
      document.body.appendChild(pre);
    });
}, 150);

/* Un archivo tal como lo sirve el servidor local. null si no esta. */
async function gpLeer(ruta){
  try{
    const r = await fetch(ruta.split('/').map(encodeURIComponent).join('/') + '?_=' + Date.now(), { cache: 'no-store' });
    return r.ok ? await r.text() : null;
  }catch(e){ return null; }
}

async function correrPruebas(){
  const correrPy = await gpLeer('pruebas/correr.py');
  const indexSrc = await gpLeer('index.html');
  const listado = await gpLeer('pruebas/');
  const nombres = listado ? [...new Set([...listado.matchAll(/href="([^"?\/]+\.js)"/g)].map(m => decodeURIComponent(m[1])))] : [];
  /* El codigo de cada tanda sin sus comentarios (que cuentan justamente lo
     que no hay que hacer), con las mismas lineas para poder decir donde. Esta
     tanda no se revisa a si misma: sus reglas se escriben con esos textos. */
  const sinComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, c => c.replace(/[^\n]/g, ''))
                               .replace(/^\s*\/\/.*$/gm, '');
  const tandas = [];
  for(const n of nombres){
    if(n === 'guardas-p-pruebas.js') continue;
    const src = await gpLeer('pruebas/' + n);
    if(src !== null) tandas.push([n, sinComentarios(src)]);
  }
  ok(!!correrPy && !!indexSrc, 'se leen correr.py e index.html');
  if(!tandas.length) info('no se pudo leer el listado de pruebas/: no se revisan las tandas');

  /* ---- 1. Cada corrida y cada tanda con su copia (183) ----
     Era RAIZ/_probe.html para todos: la revision de las 14:00 y un PUBLICAR a
     la vez se leian la tanda uno al otro. Lo mas directo es mirar con que
     nombre se abrio ESTA pagina. */
  ok(/^\/_probe-\d+-guardas-p-pruebas\.html$/.test(location.pathname),
     'esta tanda corre en una copia con el numero de la corrida y su nombre', location.pathname);
  if(correrPy){
    ok(!/['"]_probe\.html['"]/.test(correrPy) && /os\.getpid\(\)/.test(correrPy) && /glob\.escape\(PREFIJO_PROBE\)/.test(correrPy),
       'correr.py no vuelve al archivo fijo y al final borra solo las copias de su corrida');
    ok(/PRUEBAS_PUERTO/.test(correrPy) && /--puerto/.test(correrPy) && /^PUERTO  = 8765\r?$/m.test(correrPy),
       'el puerto se puede pedir con --puerto o PRUEBAS_PUERTO, y sin nada es el 8765 de siempre');
  }

  /* ---- 2. Una tanda que no llega, con su motivo (182) ---- */
  if(correrPy)
    ok(/SIN_TERMINAR/.test(correrPy) && /SIN_RESULTADO/.test(correrPy) && /print\('  %-14s NO LLEGO A CORRER' % nombre\)/.test(correrPy),
       'correr.py separa "Chrome no termino" de "la tanda no escribio su RESULTADO", y la linea sigue terminando en NO LLEGO A CORRER (la lee revision-diaria)');
  const sinAtrapar = tandas.filter(([n, s]) => /id\s*=\s*'RESULTADO'|pre\.id='RESULTADO'|pre\.id = 'RESULTADO'/.test(s) && !/EXCEPCION/.test(s)).map(([n]) => n);
  if(tandas.length)
    ok(!sinAtrapar.length, 'toda tanda atrapa sus errores y los escribe como EXCEPCION (layout.js no lo hacia)',
       sinAtrapar.join(', ') || tandas.length + ' tandas');
  /* 29/09: "no escribio su RESULTADO" no es "casi siempre un error de JS".
     analitica.js salia asi de a ratos (con cinco corridas a la vez, 21 de 30)
     porque esperaba un Blob.text() con los temporizadores borrados, y el
     reloj virtual de Chrome no lo cuenta: volcaba la pagina antes. El aviso
     de correr.py culpaba a index.html y dos tandas de la auditoria fueron a
     buscar ahi un error que no habia. Que no vuelvan ni la espera ni el
     aviso. */
  const analitica = tandas.find(([n]) => n === 'analitica.js');
  if(analitica)
    ok(!/\.bolsa\.text\(\)/.test(analitica[1]) && /URL\.createObjectURL\(/.test(analitica[1]),
       'analitica.js lee lo mandado con fetch() de un blob: y no con Blob.text(), que el reloj virtual no espera');
  if(correrPy)
    ok(!/un cambio en index\.html/.test(correrPy) && !/necesita mas presupuesto en PRESUPUESTO/.test(correrPy) &&
       /reloj virtual/.test(correrPy),
       'el aviso de "no escribio su RESULTADO" habla del reloj virtual y no culpa primero a index.html; el poco presupuesto va ahi y no en "no termino a tiempo"');

  /* ---- 3. Comprobaciones que no pueden fallar (184) ----
     "ok(true, ...)" y "ok(x || true, ...)" suman al total sin mirar nada.
     Cuando no hay nada que probar se escribe una linea '  --  '. */
  const siempreOk = [];
  for(const [n, s] of tandas){
    s.split('\n').forEach((l, i) => {
      if(/\bok\(\s*true\s*[,)]/.test(l) || /\bok\([^\n]*\|\|\s*true\s*[,)]/.test(l)) siempreOk.push(n + ':' + (i + 1));
    });
  }
  if(tandas.length)
    ok(!siempreOk.length, 'ninguna tanda tiene un ok(true) ni un "|| true" adentro de un ok()',
       siempreOk.slice(0, 5).join(', ') || tandas.length + ' tandas');

  /* ---- 4. Las pruebas usan la funcion de la pagina, no una copia (185) ---- */
  if(indexSrc){
    const cargar = (indexSrc.match(/async function cargar\(\)\{[\s\S]*?\n\}\r?\n/) || [''])[0];
    ok(/function leerPrecio\(/.test(indexSrc) && /const num = leerPrecio;/.test(cargar),
       'los precios los lee leerPrecio(), afuera de cargar(), y cargar() usa esa');
  }
  const copias = tandas.filter(([n, s]) => /const num = s =>/.test(s)).map(([n]) => n);
  if(tandas.length)
    ok(!copias.length, 'ninguna tanda tiene su propia copia de la lectura de precios', copias.join(', ') || 'ninguna');

  /* ---- 5. Ninguna tanda busca una categoria por el nombre que ya no se ve (179) ----
     categoriaReal() renombra al cargar (CATS_RENOMBRE: 'Lente' se ve
     'Objetivo'). Comparar m.cat o p.cat con el nombre viejo da siempre 0 y la
     prueba pasa sin mirar nada. */
  const viejas = Object.keys(CATS_RENOMBRE);
  const conViejo = [];
  for(const [n, s] of tandas){
    for(const m of s.matchAll(/(?:\.cat\s*===?\s*|cuenta\(\s*)'([^']+)'/g))
      if(viejas.includes(norm(m[1]))) conViejo.push(n + ': ' + m[0]);
  }
  if(tandas.length)
    ok(!conViejo.length, 'ninguna tanda compara la categoria con un nombre renombrado (' + viejas.join(', ') + ')',
       conViejo.slice(0, 3).join(' | ') || 'ninguna');

  /* ---- 6. Lo que separa un producto en los choques de CODIGO (162) ----
     codigos.js acepta "otra memoria del mismo modelo" (Pedro, 26/09) y frena
     Sim contra eSIM y teclado ES contra EN. Se apoya en estas funciones de
     la pagina: si dejan de separar, la aceptacion se tragaria los errores. */
  ok(simDelSku('celular~apple~17-iphone-pro~1tb-sim') === 'Sim' && simDelSku('celular~apple~17-iphone-pro~1tb-esim') === 'E-Sim',
     'el SKU separa Sim de eSIM');
  ok(tecladoDelSku('notebook~apple~a18-macbook-neo~13in-8gb-256gb-tecladoes') === 'ES' &&
     tecladoDelSku('notebook~apple~a18-macbook-neo~13in-8gb-256gb-tecladoen') === 'EN',
     'y el teclado ES del EN');
  const famP = d => familia({ cat: 'Celular', marca: 'Apple', desc: d, grupo: '' });
  ok(famP('iPhone 17 Pro 512GB E-Sim (Blue)') === famP('iPhone 17 Pro 1TB E-Sim (Orange)') &&
     famP('iPhone 17 Pro 512GB E-Sim (Blue)') !== famP('iPhone 17 512GB E-Sim (Blue)'),
     'familia() junta otra memoria del mismo modelo y separa el "Pro"');

  /* ---- 7. Las pruebas no le mandan eventos a ADVAPP (187) ----
     correr.py apaga la medicion en su copia, y los iframes que abren
     index.html van a otra copia apagada, con la misma ?busqueda y el mismo #. */
  ok(ANALITICA_URL === '', 'la copia de esta tanda tiene la medicion apagada', JSON.stringify(ANALITICA_URL));
  if(indexSrc){
    const lineas = [...indexSrc.matchAll(/^let ANALITICA_URL = '([^'\r\n]*)';\r?$/gm)];
    ok(lineas.length === 1 && (lineas[0][1] === '' || /^https:\/\/[^\s']+$/.test(lineas[0][1])),
       'index.html tiene UNA linea "let ANALITICA_URL = \'...\';", vacia o con una direccion https (correr.py la apaga por ese texto)',
       lineas.length + ' linea(s)' + (lineas[0] ? ': ' + JSON.stringify(lineas[0][1]) : ''));
  }
  const f = document.createElement('iframe');
  f.style.cssText = 'width:800px;height:600px;border:0;position:absolute;left:-9999px;top:0';
  f.src = 'index.html?q=guardas-p#p=NO-EXISTE';
  document.body.appendChild(f);
  const w = await new Promise(res => {
    f.onload = () => {
      let vueltas = 0;
      const iv = setInterval(() => {
        let listo = false;
        try{ listo = f.contentWindow.eval('typeof ANALITICA_URL === "string" && MODELOS.length > 0'); }catch(e){}
        if(listo || ++vueltas > 150){ clearInterval(iv); res(listo ? f.contentWindow : null); }
      }, 200);
    };
  });
  if(w){
    try{ w.pararOfertas?.(); w.pararPaseos?.(); }catch(e){}
    const x = JSON.parse(w.eval('JSON.stringify({ url: ANALITICA_URL, ruta: location.pathname, q: new URL(location.href).searchParams.get("q") })'));
    ok(x.url === '' && x.ruta !== '/index.html' && x.q === 'guardas-p',
       'un iframe con src "index.html" abre la copia apagada, con su ?busqueda', JSON.stringify(x));
  }else{
    ok(false, 'el iframe de index.html llega a cargar');
  }
  f.remove();

  /* ---- 8. Lo que se ve pero no se cuenta (190) ---- */
  if(correrPy)
    ok(/startswith\('AVISO'\)/.test(correrPy), 'correr.py muestra las lineas AVISO de las tandas (la planilla de respaldo recortada) sin contarlas como falla');
}
