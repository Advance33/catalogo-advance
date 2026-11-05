// Los errores de tipeo en el buscador (Benja eligio la B de la auditoria del
// 04/11/2026, hallazgo UD-03): con una letra mal, "samsumg", "macbok",
// "aipods" o "playstaion" decian "no esta en el catalogo" con 29 Samsung y 10
// MacBook, y "iphnoe 17" ofrecia un Xiaomi 17T y un objetivo Tamron 17-70mm.
// Ahora la palabra que no encuentra nada se cambia por la del catalogo mas
// parecida y se avisa "Mostrando resultados de “samsung”".
//   [1] los casos de UD-03 traen lo mismo, y en el mismo orden, que bien
//       escritos, con el aviso; "iphnoe 17" trae iPhone 17 y nada mas
//   [2] manda lo escrito: lo que encuentra algo tal cual no se corrige, y
//       ninguna palabra del catalogo se corrige nunca
//   [3] los numeros no se corrigen ni se corrige a un numero ("17", "s25",
//       "512"): "s24" no pasa a "s25" ni "iphone 19" a "iphone 17"
//   [4] escala con el largo: nada de 1 a 3 letras; con 4, solo dos vecinas
//       invertidas; un error de 5 a 8; dos desde 9; la primera letra se
//       respeta; una letra de mas al final solo si repite ("gamer" no es
//       "game"); nunca a una palabra de menos de 4 letras
//   [5] el aviso: en el encabezado (debajo de la cuenta, con el titulo que
//       dice lo escrito), arriba del desplegable, al lector de pantalla, y en
//       el vacio de un rubro ("No hay “samsung” en …"); la direccion sigue
//       con lo escrito; el aviso con las tildes del catalogo
//   [6] las decisiones del buscador siguen con un error de tipeo: el numero
//       empieza palabra (DP-04), lo mas parecido sin la ultima palabra y con
//       las palabras corregidas (DP-05), lo sin stock al final (DP-13), Enter
//       baja a los resultados (U-02) y cambiar de rubro no suelta la busqueda
//       corregida
// Los casos se usan si hoy el catalogo los tiene (29 Samsung, 10 MacBook...);
// si no, la comprobacion dice "--" y por que.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);
const tpDormir = ms => new Promise(r => setTimeout(r, ms));

const esperaTP = setInterval(() => {
  if(!MODELOS.length || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperaTP);
  (async () => {
    try{ await tpPruebas(); }catch(e){ R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; }
    try{ cerrarSug(); }catch(e){}
    try{ pararPaseos(); pararOfertas(); pararNuevos(); pararMarcas(); pararMundos(); }catch(e){}
    for(let i=1;i<5000;i++) clearInterval(i);
    const pre=document.createElement('pre'); pre.id='RESULTADO';
    pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
    document.body.appendChild(pre);
  })();
}, 150);

const tpLimpiar = () => Object.assign(filtros, { q:'', cat:'', marca:'', rango:'', capacidad:'', ram:'', montura:'', apertura:'', soloStock:false, orden:'modelo', ...SIN_PROPIOS });
// Lo que muestra la grilla con esa busqueda, en todo el catalogo
const tpLista = q => { tpLimpiar(); filtros.q = q; return listaDeLaGrilla(); };
const tpClaves = l => l.map(m => clave(m.rep || m)).join('|');
const tpTxt = el => (el && el.textContent || '').replace(/\s+/g, ' ').trim();
const tpAviso = w => `Mostrando resultados de “${w}”`;

async function tpPruebas(){
  document.documentElement.style.scrollBehavior = 'auto';

  /* ---- [1] Los casos de UD-03 ---- */
  const casos = [['samsumg', 'samsung'], ['samnsung', 'samsung'], ['macbok', 'macbook'], ['mackbook', 'macbook'],
                 ['aipods', 'airpods'], ['playstaion', 'playstation'], ['joistick', 'joystick'],
                 ['ipone 17', 'iphone 17'], ['iphnoe 17', 'iphone 17'], ['galaxi s25', 'galaxy s25']];
  for(const [mal, bien] of casos){
    const lb = tpLista(bien);
    if(!lb.length){ info(`[1] hoy "${bien}" no trae nada: no se prueba "${mal}"`); continue; }
    const lm = tpLista(mal);
    ok(lm.length === lb.length && tpClaves(lm) === tpClaves(lb),
       `[1] "${mal}" trae lo mismo y en el mismo orden que "${bien}" (${lb.length})`,
       lm.length + ' vs ' + lb.length + ': ' + lm.slice(0, 3).map(m => m.titulo || m.desc).join(', '));
    ok(avisoDeCorreccion(mal) === tpAviso(bien), `[1] y avisa «${tpAviso(bien)}»`, avisoDeCorreccion(mal) || 'sin aviso');
  }
  {
    const l = tpLista('iphnoe 17');
    // Los mismos que "iphone 17" (ya comparado arriba): todos iPhone, ningun Xiaomi ni objetivo
    const otros = l.filter(m => norm(m.marca) !== 'apple' || !/\biphone\b/.test(norm(m.desc)));
    if(tpLista('iphone 17').length)
      ok(l.length > 0 && !otros.length, '[1] "iphnoe 17" trae solo iPhone: ni el Xiaomi 17T ni el Tamron 17-70mm',
         otros.slice(0, 3).map(m => m.marca + ' ' + m.desc).join(', ') || l.map(m => m.titulo || m.desc).join(', '));
    tpLimpiar(); filtros.q = 'iphnoe 17'; aplicarFiltro(false);
    ok(!parecidoDe('iphnoe 17') || parecidoDe('iphnoe 17').q.startsWith('iphone'),
       '[1] y lo mas parecido, si se pidiera, empieza por "iphone" (no "17")');
  }

  /* ---- [2] Manda lo escrito ---- */
  {
    for(const q of ['samsung', 'iphone 17', 's25', '512', 'ps5', 'lente 50mm', 'teclado español', 'cargador iphone', 'gopro']){
      const c = correccionDe(q);
      ok(!c || !c.hay, `[2] "${q}" se busca tal cual`, c ? c.q : 'sin corregir');
    }
    // Ninguna palabra del catalogo se corrige, ni sola ni en un par
    const pals = palabrasDelCatalogo().map(x => x[0]);
    const corregidas = pals.filter(w => correccionDe(w));
    ok(pals.length > 100 && !corregidas.length, `[2] ninguna de las ${pals.length} palabras del catalogo se corrige`,
       corregidas.slice(0, 6).join(', '));
    const pares = pals.slice(0, 200).map((w, i) => w + ' ' + pals[(i * 7 + 3) % pals.length]).filter(q => correccionDe(q));
    ok(!pares.length, '[2] ni dos palabras del catalogo juntas (aunque juntas no encuentren nada)', pares.slice(0, 4).join(' | '));
  }

  /* ---- [3] Los numeros no se tocan ---- */
  {
    for(const q of ['s24', '17', '512', 'x5', 'r50', 'a7iv', 'iphone 19', 'iphone 17 1tb', 'galaxy s24']){
      const c = correccionDe(q);
      ok(!c, `[3] "${q}" no se corrige`, c ? c.q : '');
    }
    const c = correccionDe('iphnoe 19');
    ok(!!c && c.q === 'iphone 19', '[3] "iphnoe 19": se corrige la palabra y el 19 queda 19 (nunca 17)', c && c.q);
    ok(!avisoDeCorreccion('iphnoe 19') || tpLista('iphone 19').length > 0,
       '[3] y si "iphone 19" no esta, no dice "Mostrando resultados de"', avisoDeCorreccion('iphnoe 19'));
    // Ninguna palabra con numeros sale distinta de una correccion
    const malas = casos.map(([mal]) => [mal, correccionDe(mal)]).filter(([mal, cc]) => cc &&
      cc.q.split(' ').some((w, i) => /\d/.test(mal.split(' ')[i] || '') && w !== mal.split(' ')[i]));
    ok(!malas.length, '[3] en los casos de UD-03 los numeros quedan como se escribieron', malas.map(x => x[0]).join(', '));
    ok(!palabrasDelCatalogo().some(([w]) => /\d/.test(w)), '[3] nada se corrige a una palabra con numeros');
  }

  /* ---- [4] Cuanto se corrige segun el largo ---- */
  {
    const d = distanciaDeTipeo;
    ok(d('samsumg', 'samsung') === 1 && d('samnsung', 'samsung') === 1 && d('macbok', 'macbook') === 1 &&
       d('iphnoe', 'iphone') === 1 && d('ab', 'ba') === 1 && d('templado', 'teclado') === 2 && d('sony', 'sony') === 0,
       '[4] la distancia: una letra cambiada, de mas, de menos o dos vecinas invertidas cuentan 1');
    const nunca = { sam: '1 a 3 letras', smg: '1 a 3 letras', ipd: '1 a 3 letras', son: '1 a 3 letras',
                    plat: '4 letras con una cambiada ("play")', mode: '4 letras ("more")', rode: '4 letras ("rose")',
                    bose: 'la primera letra ("rose")', acer: 'a menos de 4 letras ("ace")',
                    gamer: 'una letra de mas al final ("game")',
                    templado: '8 letras con dos errores ("teclado")', zzzz: 'nada parecido' };
    for(const [w, por] of Object.entries(nunca)){
      const c = correccionDe(w);
      ok(!c || !c.hay, `[4] "${w}" no se corrige: ${por}`, c ? c.q : '');
    }
    const hay = w => palabrasDelCatalogo().some(([x]) => x === w);
    const si = [['ipda', 'ipad', '4 letras con dos vecinas invertidas'], ['sonyy', 'sony', 'letra de mas repetida al final'],
                ['pihone', 'iphone', 'las dos primeras invertidas'], ['auriculres', 'auriculares', '10 letras'],
                ['objetvo', 'objetivo', 'una de menos']];
    for(const [w, bien, por] of si){
      if(!hay(bien)){ info(`[4] hoy no hay "${bien}" en el catalogo: no se prueba "${w}"`); continue; }
      const c = correccionDe(w);
      ok(!!c && c.hay && c.q === bien, `[4] "${w}" pasa a "${bien}": ${por}`, c ? c.q : 'sin corregir');
    }
  }

  /* ---- [5] El aviso ---- */
  const nSam = tpLista('samsung').length;
  if(!nSam) info('[5] hoy no hay nada Samsung: no se prueba el aviso con "samsumg"');
  else{
    // En el encabezado
    tpLimpiar(); filtros.q = 'samsumg'; $('q').value = 'samsumg'; aplicarFiltro(false);
    const cab = $('rubro-cab');
    const av = cab && cab.querySelector('.rc-tit .q-corregida');
    ok(!!av && tpTxt(av) === tpAviso('samsung'), '[5] el encabezado dice «Mostrando resultados de “samsung”»', tpTxt(av));
    ok(LISTA.length === nSam && grid.querySelectorAll('.card').length > 0, '[5] y la grilla muestra los ' + nSam, LISTA.length);
    ok(tpTxt(cab.querySelector('h2')).includes('samsumg'), '[5] el titulo sigue diciendo lo escrito', tpTxt(cab.querySelector('h2')));
    ok(av && av.previousElementSibling && av.previousElementSibling.querySelector('#count'), '[5] el aviso va debajo de la cuenta');
    ok(av && getComputedStyle(av).color !== getComputedStyle(cab.querySelector('.rc-tit p')).color || av && getComputedStyle(av).fontSize !== getComputedStyle(cab.querySelector('.rc-tit p')).fontSize,
       '[5] el aviso no se ve como la cuenta (otra letra)', av && getComputedStyle(av).fontSize);
    ok(new URLSearchParams(location.search).get('q') === 'samsumg', '[5] la direccion sigue con lo escrito', location.search);
    // Al lector de pantalla
    let anuncio = '';
    for(let i = 0; i < 20 && !anuncio.includes('Mostrando'); i++){ await tpDormir(150); anuncio = $('anuncio').textContent; }
    ok(anuncio.startsWith(tpAviso('samsung') + '. '), '[5] el lector de pantalla oye el aviso antes de la cuenta', anuncio);
    // En el desplegable
    pintarSug();
    const caja = $('q-sug');
    const avs = caja.querySelector('.qs-corregida');
    ok(!caja.hidden && !!avs && tpTxt(avs) === tpAviso('samsung') && caja.firstElementChild === avs,
       '[5] el desplegable dice lo mismo, arriba de todo', tpTxt(avs));
    ok(avs && !avs.matches('[role="option"]') && !avs.matches('.qs'), '[5] el aviso no es una opcion (las flechas no lo marcan)');
    const sug = [...caja.querySelectorAll('.qs[data-key]')].map(b => buscarProducto(b.dataset.key));
    ok(sug.length > 0 && sug.every(p => p && norm(p.marca) === 'samsung'), '[5] y sugiere productos Samsung', sug.length + ' sugerencias');
    cerrarSug();
    // Sin error, ningun aviso
    tpLimpiar(); filtros.q = 'samsung'; $('q').value = 'samsung'; aplicarFiltro(false);
    ok(!document.querySelector('.q-corregida'), '[5] con "samsung" bien escrito no hay aviso');
    pintarSug();
    ok(!$('q-sug').querySelector('.qs-corregida'), '[5] ni en el desplegable');
    cerrarSug();
    // Adentro de un rubro sin Samsung: el vacio dice lo buscado, corregido
    const sinSam = [...new Set(MODELOS.filter(m => m.stock).map(m => m.cat))]
      .find(c => !MODELOS.some(m => m.cat === c && norm(m.marca) === 'samsung'));
    if(sinSam){
      tpLimpiar(); filtros.cat = sinSam; filtros.q = 'samsumg'; $('q').value = 'samsumg'; aplicarFiltro(false);
      const t = textosVacio();
      ok(t.h === `No hay “samsung” en ${plural(sinSam)}` && t.p === `En todo el catálogo hay ${nSam}.`,
         '[5] en ' + plural(sinSam) + ' el vacio dice "No hay “samsung”" y cuantos hay en todo el catalogo', t.h + ' / ' + t.p);
      ok(!!document.querySelector('#rubro-cab .q-corregida'), '[5] con el aviso arriba');
      pintarSug();
      const fila = $('q-sug').querySelector('.qs[data-todo]');
      ok(!!fila && tpTxt(fila.querySelector('b')) === 'Buscar “samsung” en todo el catálogo',
         '[5] y el desplegable ofrece "Buscar “samsung” en todo el catálogo"', tpTxt(fila));
      fila && fila.click();
      ok(filtros.cat === '' && LISTA.length === nSam, '[5] que lleva a los ' + nSam, LISTA.length);
      cerrarSug();
    }else info('[5] hoy todos los rubros tienen Samsung');
  }
  {
    // El aviso con las tildes del catalogo
    const conTilde = palabrasDelCatalogo().map(([w]) => [w, formaDelCatalogo(w)]).find(([w, f]) => f !== w && w.length >= 6);
    if(conTilde){
      const [w, f] = conTilde;
      const mal = w.slice(0, 2) + w.slice(3);   // una letra de menos
      const c = correccionDe(mal);
      ok(!!c && c.hay && c.q === w && c.mostrar === f, `[5] "${mal}" avisa con la tilde del catalogo: "${f}"`, c ? c.mostrar : 'sin corregir');
    }else info('[5] hoy no hay palabras con tilde');
  }

  /* ---- [6] Las decisiones del buscador, con un error de tipeo ---- */
  {
    // DP-04: el numero empieza palabra
    const zoom = MODELOS.find(m => /\b18-150mm\b/i.test(m.desc));
    if(zoom && tpLista('lente 50mm').length){
      const l = tpLista('lentte 50mm');
      ok(l.length === tpLista('lente 50mm').length && !l.includes(zoom), '[6] DP-04 "lentte 50mm" no trae el ' + zoom.desc, l.length);
    }else info('[6] DP-04 hoy no hay 18-150mm o "lente 50mm" no trae nada');
    // DP-05: sin la ultima palabra, y con las palabras corregidas
    const hayCargador = MODELOS.some(m => m.stock && /\bcargador\b/.test(norm(m.desc)));
    if(hayCargador && !tpLista('cargador iphone').length){
      const p = parecidoDe('cargdor iphone');
      ok(!!p && p.q === 'cargador', '[6] DP-05 "cargdor iphone" ofrece cargadores', p ? p.q : 'nada');
    }else info('[6] DP-05 hoy no aplica (sin cargadores o "cargador iphone" trae algo)');
    if(tpLista('iphone 17').some(m => m.stock)){
      const p = parecidoDe('iphnoe 17 zzzz');
      ok(!!p && p.q === 'iphone 17', '[6] "iphnoe 17 zzzz" no esta, y lo mas parecido es "iphone 17" (no "17")', p ? p.q : 'nada');
    }
    // DP-13: con busqueda, lo sin stock al final
    const l = tpLista('tecaldo español');
    const primeraSin = l.findIndex(m => !m.stock);
    ok(l.length > 0 && (primeraSin === -1 || l.slice(primeraSin).every(m => !m.stock)),
       '[6] DP-13 "tecaldo español" trae los teclados, con lo sin stock al final', l.slice(0, 3).map(m => (m.stock ? '' : '[sin] ') + m.desc).join(' | '));
    // U-02: Enter baja a los resultados
    if(nSam){
      irAlInicio(); await tpDormir(60); scrollTo({ top: 0 });
      const q = $('q');
      q.value = 'samsumg';
      q.dispatchEvent(new Event('input', { bubbles: true }));
      q.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      await tpDormir(900);
      const cab = $('rubro-cab');
      const ancla = cab && !cab.hidden ? cab : grid;
      ok(LISTA.length === nSam && scrollY > 0 && ancla.getBoundingClientRect().top < innerHeight,
         '[6] U-02 Enter con "samsumg" muestra los ' + nSam + ' y baja hasta ellos', `${LISTA.length}, scrollY ${Math.round(scrollY)}`);
    }
    // Cambiar de rubro no suelta la busqueda corregida
    const catSam = MODELOS.find(m => norm(m.marca) === 'samsung' && m.stock);
    if(catSam){
      tpLimpiar(); filtros.q = 'samsumg'; $('q').value = 'samsumg';
      soltarBusquedaSinResultados(catSam.cat);
      ok(filtros.q === 'samsumg', '[6] tocar ' + plural(catSam.cat) + ' con "samsumg" buscado no borra la busqueda');
    }
  }
  tpLimpiar(); $('q').value = ''; aplicarFiltro(false);
}
