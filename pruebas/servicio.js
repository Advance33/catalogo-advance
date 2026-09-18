// Lo que se sumo el 15/09/2026 mirando otras tiendas: las preguntas frecuentes
// al final de la portada y, en la ficha, el envio, el retiro, la garantia y
// "Tambien te puede interesar". Los textos salen de la configuracion y los
// productos de la planilla, asi que se verifica que digan lo que tienen que
// decir, que aparezcan donde tienen que aparecer y que no prometan de mas.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const $$ = s => document.querySelectorAll(s);

const esperar = setInterval(() => {
  // Como extras.js, prueba la pagina tal como la ve el cliente al entrar
  if(!MODELOS.length || !$$('#cats .chip').length || !$('presupuesto')) return;
  clearInterval(esperar);
  for(let i=1;i<5000;i++) clearInterval(i);
  try{ correrPruebas(); }catch(e){ R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; }
  // Las pruebas vuelven a pintar y eso reengancha los paseos: si queda alguno
  // vivo, con el reloj acelerado del headless el navegador no cierra nunca.
  try{ pararPaseos(); }catch(e){}
  try{ pararOfertas(); }catch(e){}
  for(let i=1;i<5000;i++) clearInterval(i);

  const pre=document.createElement('pre'); pre.id='RESULTADO';
  pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
  document.body.appendChild(pre);
}, 150);

/* Nunca un plazo fijo de garantia: cada producto tiene la suya. El texto de
   formas de pago decia "garantia oficial de 1 año" y hubo que sacarlo. */
const PLAZO_FIJO = /\b(1|un|uno)\s+a[ñn]o\b/i;
const elegible = x => x.stock && x.imagen && x.precio > 0;

function correrPruebas(){
  /* ---- 1. Preguntas frecuentes ----
     Desde el 17/09 no son desplegables sueltos: son el bloque oscuro del final,
     con la lista a un lado y la respuesta al otro. Lo fino, en ayuda.js. */
  const ayuda = $('ayuda');
  ok(!!ayuda, 'la portada tiene preguntas frecuentes');
  if(!ayuda) return;
  const preg = [...ayuda.querySelectorAll('.ay-p')];
  const resp = [...ayuda.querySelectorAll('.ay-r')];
  ok(preg.length === PREGUNTAS.length && resp.length === PREGUNTAS.length,
     'una por cada pregunta de la configuracion', preg.length + ' de ' + PREGUNTAS.length);
  ok(preg.every((b, i) => b.textContent.includes(PREGUNTAS[i].p)),
     'las preguntas son las de la configuracion, en ese orden');
  ok(resp.every((r, i) => (PREGUNTAS[i].r || []).every(t => r.textContent.includes(t)) &&
                          (PREGUNTAS[i].lista || []).every(t => r.textContent.includes(t))),
     'y cada respuesta dice lo que dice la configuracion');
  // Una sola a la vista: las ocho abiertas serian un muro de texto
  ok(ayuda.querySelectorAll('.ay-r.ve').length === 1, 'se ve una sola respuesta por vez');

  ok(!PLAZO_FIJO.test(ayuda.textContent), 'ninguna respuesta promete un plazo fijo de garantia');
  ok(ayuda.textContent.includes(DIRECCION), 'la direccion es la de la configuracion');
  const mapa = [...ayuda.querySelectorAll('a')].find(a => a.getAttribute('href') === MAPA);
  ok(!!mapa, 'hay un link al mapa', MAPA);
  ok(mapa && mapa.target === '_blank' && /noopener/.test(mapa.rel),
     'y abre en otra pestaña sin darle acceso a la pagina');
  const otra = ayuda.querySelector('.ay-otra a');
  ok(!WHATSAPP || (otra && otra.href.startsWith('https://wa.me/' + WHATSAPP)),
     '"¿Te quedo otra duda?" va al WhatsApp de la tienda');

  // Van con el resto de la portada: al buscar se esconden, al volver estan
  filtros.q = 'iphone'; pintar();
  ok($('extras').hidden, 'al buscar, las preguntas se esconden con la portada');
  filtros.q = ''; pintar();
  ok(!$('extras').hidden && !!$('ayuda'), 'y vuelven al volver');

  /* ---- 2. Envio, retiro y garantia en la ficha ---- */
  const sinGar = MODELOS.find(m => elegible(m) && !m.rep.garantia);
  abrirFicha(clave(sinGar.rep));
  let serv = $('ficha').querySelector('.fi-servicio');
  ok(!!serv, 'la ficha muestra envio, retiro y garantia');
  const lineas = serv ? [...serv.querySelectorAll('li')] : [];
  ok(lineas.length === Object.keys(SERVICIO).length, 'una linea por cada una',
     lineas.map(l => l.dataset.servicio).join(', '));
  const botones = $('ficha').querySelector('.fi-botones');
  ok(botones && botones.nextElementSibling === serv,
     'justo debajo del boton, que es donde el cliente decide');
  const lineaGar = serv && serv.querySelector('[data-servicio="garantia"] i');
  ok(lineaGar && lineaGar.textContent === SERVICIO.garantia[1],
     'sin garantia propia en la planilla, dice la regla general', lineaGar && lineaGar.textContent);
  ok(serv && !PLAZO_FIJO.test(serv.textContent), 'y no inventa un plazo');
  quitarFicha();

  /* Si la planilla trae la garantia de ese producto, se muestra esa, y una
     sola vez: antes vivia en la tabla de datos y ahora se mudo al bloque. */
  const conGar = PRODUCTOS.find(p => p.garantia && p.stock && buscarModelo(clave(p)));
  if(!conGar){
    R.push('  --   hoy ningun producto trae su garantia en la planilla');
  }else{
    abrirFicha(clave(conGar));
    const g = $('ficha').querySelector('.fi-servicio [data-servicio="garantia"] i');
    ok(g && g.textContent === conGar.garantia, 'con garantia propia, muestra la del producto',
       conGar.id + ': ' + conGar.garantia);
    const enTabla = [...$('ficha').querySelectorAll('.fi-tabla dt')].some(dt => /garant/i.test(dt.textContent));
    ok(!enTabla, 'y no la repite en la tabla de datos');
    quitarFicha();
  }

  /* ---- 3. Tambien te puede interesar ----
     Se prueba con un producto del medio para arriba de un rubro grande: con el
     mas barato de todos, ordenar mal por precio pasaria igual la prueba. */
  const candidatos = MODELOS.filter(m => {
    if(!elegible(m)) return false;
    const pares = MODELOS.filter(x => x !== m && x.cat === m.cat && elegible(x));
    if(pares.length < 8 || new Set(pares.map(x => x.marca)).size < 2) return false;
    return pares.filter(x => x.precio < m.precio).length >= pares.length / 2;
  });
  const mR = candidatos[0];
  if(!mR){
    R.push('  --   hoy no hay un rubro con varias marcas para probar los sugeridos');
  }else{
    abrirFicha(clave(mR.rep));
    const tarjetas = [...$('ficha').querySelectorAll('.fi-rel .pc')];
    const sug = tarjetas.map(b => buscarModelo(b.dataset.key));
    ok(tarjetas.length === RELACIONADOS, 'la ficha sugiere ' + RELACIONADOS + ' productos',
       mR.desc + ': ' + tarjetas.length);
    ok(sug.every(Boolean), 'todos existen');
    ok(!sug.includes(mR), 'ninguno es el mismo que se esta mirando');
    ok(new Set(sug).size === sug.length, 'no se repite ninguno');
    ok(sug.every(x => x && x.cat === mR.cat), 'todos son del mismo rubro',
       sug.filter(x => x && x.cat !== mR.cat).map(x => x.cat).join(', ') || mR.cat);
    ok(sug.every(x => x && x.stock && x.imagen), 'ninguno esta agotado ni sin foto');

    /* Que sean de precio parecido se mide contra el rubro entero, sin copiar la
       cuenta del catalogo: una prueba que repite la formula que verifica valida
       el error en vez de encontrarlo. Los sugeridos tienen que estar, en
       promedio, bastante mas cerca en precio que un producto cualquiera. */
    const pares = MODELOS.filter(x => x !== mR && x.cat === mR.cat && elegible(x));
    const dist = x => Math.abs(Math.log(x.precio / mR.precio));
    const prom = l => l.reduce((s, x) => s + dist(x), 0) / l.length;
    const dSug = prom(sug.filter(Boolean)), dRubro = prom(pares);
    ok(dSug < dRubro / 2, 'son de precio parecido, no cualquiera del rubro',
       'USD ' + mR.precio + ' → ' + sug.filter(Boolean).map(x => x.precio).join(' / '));

    // Tocar uno abre esa ficha, en la misma ventana
    tarjetas[1].click();
    ok(FICHA_MODELO === sug[1], 'tocar un sugerido abre su ficha', sug[1] && sug[1].desc);
    ok($$('#ficha').length === 1, 'y reemplaza a la anterior, no apila otra ventana');
    quitarFicha();
  }

  /* Variedad de marcas. La primera version de esta prueba usaba el mismo
     producto de arriba y pasaba igual sin la regla: al iPhone 15 los cuatro de
     precio mas parecido ya le salian mitad Samsung y mitad Apple. Ahora se
     busca a proposito uno donde, sin la regla, saldrian los cuatro de la misma
     marca: es el unico caso en el que la regla hace algo. */
  const sinVariedad = MODELOS.find(m => {
    if(!elegible(m) || m.precio <= 0) return false;
    const pares = MODELOS.filter(x => x !== m && x.cat === m.cat && elegible(x));
    if(new Set(pares.map(x => x.marca)).size < 2) return false;
    const d = x => Math.abs(Math.log(x.precio / m.precio));
    const cerca = [...pares].sort((a, b) => d(a) - d(b)).slice(0, RELACIONADOS);
    return cerca.length === RELACIONADOS && new Set(cerca.map(x => x.marca)).size === 1;
  });
  if(!sinVariedad){
    R.push('  --   hoy ningun producto tiene sus cuatro mas parecidos de una sola marca');
  }else{
    const marcas = relacionados(sinVariedad).map(x => x.marca);
    ok(new Set(marcas).size >= 2,
       'si el rubro tiene otras marcas, no sugiere cuatro de la misma',
       sinVariedad.desc + ' → ' + marcas.join(' / '));
  }

  // Un rubro con un solo producto no muestra el titulo con la seccion vacia
  const solo = MODELOS.find(m => elegible(m) &&
    !MODELOS.some(x => x !== m && x.cat === m.cat && elegible(x)));
  if(!solo){
    R.push('  --   hoy no hay ningun rubro con un solo producto para probarlo');
  }else{
    abrirFicha(clave(solo.rep));
    ok(!$('ficha').querySelector('.fi-rel'), 'sin otros productos en su rubro, no muestra la seccion',
       solo.desc);
    quitarFicha();
  }

  /* Cambiar de version redibuja los datos de la ficha. Los sugeridos dependen
     del modelo, no de la version: tienen que quedar quietos, y el bloque de
     envio tiene que volver a aparecer una sola vez. */
  const multi = MODELOS.find(m => m.multi && elegible(m) && relacionados(m).length &&
    m.variantes.filter(v => v.stock).length >= 2);
  abrirFicha(clave(multi.rep));
  const relAntes = $('ficha').querySelector('.fi-rel');
  const op = [...$('ficha').querySelectorAll('.fi-op')].find(b => b.getAttribute('aria-pressed') !== 'true');
  op.click();
  ok($('ficha').querySelectorAll('.fi-rel').length === 1 &&
     $('ficha').querySelector('.fi-rel') === relAntes,
     'cambiar de version no redibuja ni duplica los sugeridos', multi.desc);
  ok($('ficha').querySelectorAll('.fi-servicio').length === 1,
     'y el envio y el retiro siguen estando, una sola vez');
  quitarFicha();
}
