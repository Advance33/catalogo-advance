// Las palabras escritas como suenan (05/11/2026). Benja pregunto que tan
// cubiertos estamos si alguien escribe mal, con una captura de "jaifon": la
// web decia "no esta en el catalogo" con 15 iPhone, y lo mismo "aifon",
// "ifon" y "plei". Ahora va como la correccion de tipeo (UD-03, ver
// decision-tipeo.js): la palabra que sola no encuentra nada prueba la lista
// ESCRITO_DE_OIDO, despues el tipeo y, de respaldo, una palabra del catalogo
// que suena igual (claveDeOido), con el aviso "Mostrando resultados de
// “iphone”".
//   [1] lo que pidio Benja: "jaifon", "aifon", "ifon", "plei", "eipods",
//       "sansung", "shaomi", "makbuk", "daison", "guatch"... traen lo mismo, y
//       en el mismo orden, que bien escritos, con el aviso; tambien dos o tres
//       palabras pegadas ("mac buk", "ai fon", "jota be ele")
//   [2] los numeros no se tocan: "jaifon 17" es "iphone 17" y "jaifon 18"
//       nunca pasa a 17
//   [3] manda lo escrito: lo que encuentra algo tal cual no se corrige
//       ("iphon", "samsun", "switch", "play station", "soni")
//   [4] la lista: cada escritura lleva a lo suyo con el catalogo de hoy, no
//       hay dos iguales al oido que vayan a lugares distintos, ninguna es una
//       palabra del catalogo, y va antes que el tipeo ("eirpods" son AirPods,
//       no EarPods); el respaldo de como suena ("selular", "konsola",
//       "kamara" con la tilde del catalogo), solo con 5 letras o mas
//   [5] nada raro: "funda", "templado", "vidrio", colores o "mate" no pasan
//       a otra cosa, ni mientras se escriben palabras comunes
//   [6] el aviso con "jaifon" y "mac buk": encabezado (el titulo con lo
//       escrito), desplegable, lector de pantalla y direccion
//   [7] las decisiones del buscador siguen andando escrito de oido: el
//       numero empieza palabra (DP-04), lo mas parecido (DP-05), lo sin stock
//       al final (DP-13), Enter baja a los resultados (U-02) y cambiar de
//       rubro no suelta la busqueda
// Los casos se usan si hoy el catalogo los tiene; si no, la comprobacion dice
// "--" y por que.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);
const odDormir = ms => new Promise(r => setTimeout(r, ms));

const esperaOD = setInterval(() => {
  if(!MODELOS.length || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperaOD);
  (async () => {
    try{ await odPruebas(); }catch(e){ R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; }
    try{ cerrarSug(); }catch(e){}
    try{ pararPaseos(); pararOfertas(); pararNuevos(); pararMarcas(); pararMundos(); }catch(e){}
    for(let i=1;i<5000;i++) clearInterval(i);
    const pre=document.createElement('pre'); pre.id='RESULTADO';
    pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
    document.body.appendChild(pre);
  })();
}, 150);

const odLimpiar = () => Object.assign(filtros, { q:'', cat:'', marca:'', rango:'', capacidad:'', ram:'', montura:'', apertura:'', soloStock:false, orden:'modelo', ...SIN_PROPIOS });
// Lo que muestra la grilla con esa busqueda, en todo el catalogo
const odLista = q => { odLimpiar(); filtros.q = q; return listaDeLaGrilla(); };
const odClaves = l => l.map(m => clave(m.rep || m)).join('|');
const odTxt = el => (el && el.textContent || '').replace(/\s+/g, ' ').trim();
const odAviso = w => `Mostrando resultados de “${w}”`;
// Lo que encuentra tal cual, sin ninguna correccion
const odTalCual = q => { const pal = prepararBusqueda(q); return MODELOS.filter(m => coincide(m, pal)).length; };

async function odPruebas(){
  document.documentElement.style.scrollBehavior = 'auto';

  /* ---- [1] Lo que pidio Benja ---- */
  // [escrito, como se busca, como lo dice el aviso (si no, igual)]
  const casos = [['jaifon', 'iphone'], ['aifon', 'iphone'], ['ifon', 'iphone'], ['aifone', 'iphone'],
                 ['plei', 'playstation'], ['pley', 'playstation'], ['pleisteishon', 'playstation'],
                 ['eipods', 'airpods'], ['eirpods', 'airpods'], ['aipad', 'ipad'], ['aypad', 'ipad'],
                 ['sansung', 'samsung'], ['shaomi', 'xiaomi'], ['chaomi', 'xiaomi'],
                 ['makbuk', 'macbook'], ['macbuk', 'macbook'], ['daison', 'dyson'], ['daisson', 'dyson'],
                 ['guatch', 'watch'], ['uach', 'watch'], ['wach', 'watch'],
                 ['joistic', 'joystick'], ['yoistic', 'joystick'], ['auris', 'auriculares'],
                 ['nintendo suich', 'nintendo switch'], ['kanon', 'canon'], ['naikon', 'nikon'], ['zony', 'sony'],
                 ['diyiai', 'dji'], ['yibiel', 'jbl'], ['reiban', 'rayban'], ['equisbox', 'xbox'],
                 ['maicrosoft', 'microsoft'], ['lojitek', 'logitech'], ['epol', 'apple'],
                 // Pegadas: dos o tres palabras que juntas son una
                 ['mac buk', 'macbook'], ['mac buk air', 'macbook air'], ['ai fon', 'iphone'],
                 ['jota be ele', 'jbl'], ['pley station', 'playstation'], ['equis box', 'xbox']];
  for(const [mal, bien, dice] of casos){
    const lb = odLista(bien);
    if(!lb.length){ info(`[1] hoy "${bien}" no trae nada: no se prueba "${mal}"`); continue; }
    const lm = odLista(mal);
    ok(lm.length === lb.length && odClaves(lm) === odClaves(lb),
       `[1] "${mal}" trae lo mismo y en el mismo orden que "${bien}" (${lb.length})`,
       lm.length + ' vs ' + lb.length + ': ' + lm.slice(0, 3).map(m => m.titulo || m.desc).join(', '));
    ok(avisoDeCorreccion(mal) === odAviso(dice || bien), `[1] y avisa «${odAviso(dice || bien)}»`, avisoDeCorreccion(mal) || 'sin aviso');
  }

  /* ---- [2] Los numeros no se tocan ---- */
  {
    for(const [mal, bien] of [['jaifon 17', 'iphone 17'], ['ai fon 17', 'iphone 17'], ['aifon 16 pro max', 'iphone 16 pro max'],
                              ['pleisteishon 5', 'playstation 5'], ['sansung s25', 'samsung s25'], ['makbuk air 13', 'macbook air 13']]){
      const lb = odLista(bien);
      if(!lb.length){ info(`[2] hoy "${bien}" no trae nada: no se prueba "${mal}"`); continue; }
      const lm = odLista(mal);
      ok(lm.length === lb.length && odClaves(lm) === odClaves(lb),
         `[2] "${mal}" trae lo mismo que "${bien}" (${lb.length})`, lm.length + ' vs ' + lb.length);
      ok(avisoDeCorreccion(mal) === odAviso(bien), `[2] y avisa «${odAviso(bien)}»`, avisoDeCorreccion(mal) || 'sin aviso');
    }
    // "jaifon 17": solo iPhone, ni el Xiaomi 17T ni un objetivo 17-70mm
    const l17 = odLista('jaifon 17');
    const otros = l17.filter(m => norm(m.marca) !== 'apple' || !/\biphone\b/.test(norm(m.desc)));
    if(l17.length) ok(!otros.length, '[2] "jaifon 17" trae solo iPhone', otros.slice(0, 3).map(m => m.marca + ' ' + m.desc).join(', '));
    // "jaifon 18" es "iphone 18", haya o no
    const c18 = correccionDe('jaifon 18');
    ok(!!c18 && c18.q === 'iphone 18', '[2] "jaifon 18" se busca como "iphone 18" (nunca 17)', c18 && c18.q);
    const l18 = odLista('jaifon 18'), b18 = odLista('iphone 18');
    ok(odClaves(l18) === odClaves(b18) && !l18.some(m => /\b17\b/.test(norm(m.desc))),
       `[2] y trae lo mismo que "iphone 18" (${b18.length}), ningun 17`, l18.slice(0, 3).map(m => m.desc).join(', '));
    ok(b18.length ? avisoDeCorreccion('jaifon 18') === odAviso('iphone 18') : !avisoDeCorreccion('jaifon 18'),
       b18.length ? '[2] con el aviso «iphone 18»' : '[2] y como no hay "iphone 18", sin aviso', avisoDeCorreccion('jaifon 18'));
    // Ningun numero cambia en ninguna correccion de esta tanda
    const malas = [...casos.map(x => x[0]), 'jaifon 17', 'jaifon 18', 'ai fon 17', 'pleisteishon 5', 'sansung s25'].filter(q => {
      const c = correccionDe(q);
      const nums = s => s.split(/\s+/).filter(w => /\d/.test(w)).join(' ');
      return c && nums(c.q) !== nums(norm(q));
    });
    ok(!malas.length, '[2] ningun numero escrito cambia al corregir', malas.join(', '));
  }

  /* ---- [3] Manda lo escrito ---- */
  {
    for(const q of ['iphon', 'samsun', 'airpod', 'switch', 'nintendo switch', 'play station', 'playstation', 'gopro', 'go pro',
                    'insta 360', 'rayban', 'ray ban', 'camara', 'cámara', 'auriculares', 'auri', 'cargador', 'joystick',
                    'watch', 'dyson', 'canon', 'nikon', 'sony', 'soni', 'fujifilm', 'dji', 'motorola', 'jbl', 'iphone',
                    'ipad', 'airpods', 'macbook', 'samsung', 'xiaomi', 'mac', 'air', 'iphone 17', 'ps5']){
      if(!odTalCual(q)){ info(`[3] hoy "${q}" no encuentra nada tal cual`); continue; }
      const c = correccionDe(q);
      ok(!c, `[3] "${q}" se busca tal cual`, c ? c.q : '');
    }
  }

  /* ---- [4] La lista y el respaldo de como suena ---- */
  {
    const escrituras = Object.entries(ESCRITO_DE_OIDO).flatMap(([bien, es]) => es.map(e => [e, bien]));
    info(`[4] la lista tiene ${escrituras.length} escrituras para ${Object.keys(ESCRITO_DE_OIDO).length} palabras`);
    // Cada escritura, con el catalogo de hoy, lleva a lo suyo (o se busca tal cual si encuentra algo)
    const mal = [], muertas = [], sinDestino = new Set();
    for(const [e, bien] of escrituras){
      const c = correccionDe(e);
      if(odTalCual(e)){ if(c) mal.push(`${e}→${c.q} (encontraba tal cual)`); else muertas.push(e); continue; }
      if(!odTalCual(bien)){ sinDestino.add(bien); continue; }
      if(!c || !c.hay || c.q !== bien) mal.push(`${e}→${c ? c.q : 'nada'} (iba a ${bien})`);
    }
    ok(!mal.length, '[4] cada escritura de la lista lleva a lo suyo', mal.slice(0, 6).join(', '));
    if(muertas.length) info('[4] encuentran algo tal cual y no se usan: ' + muertas.join(', '));
    if(sinDestino.size) info('[4] hoy no hay: ' + [...sinDestino].join(', '));
    // Dos escrituras que suenan igual van al mismo lado
    const porClave = new Map(), choques = [];
    for(const [e, bien] of escrituras){
      const k = claveDeOido(e);
      if(porClave.has(k) && porClave.get(k)[1] !== bien) choques.push(`${porClave.get(k)[0]}/${e}`);
      porClave.set(k, [e, bien]);
    }
    ok(!choques.length, '[4] no hay dos escrituras que suenen igual y vayan a lugares distintos', choques.join(', '));
    // Ninguna es una palabra del catalogo (seria otra cosa, o no se usaria nunca)
    const delCatalogo = new Set(palabrasDelCatalogo().map(x => x[0]));
    const son = escrituras.filter(([e]) => delCatalogo.has(e)).map(([e]) => e);
    ok(!son.length, '[4] ninguna escritura es una palabra del catalogo', son.join(', '));
    // A la derecha, una sola palabra de letras (el aviso la nombra entera)
    ok(Object.keys(ESCRITO_DE_OIDO).every(b => /^[a-z]+$/.test(b)), '[4] cada destino es una palabra, sin numeros');
    // La lista va antes que el tipeo: "eirpods" a una letra de "earpods"
    if(odTalCual('earpods') && odTalCual('airpods')){
      const c = correccionDe('eirpods');
      ok(!!c && c.q === 'airpods', '[4] "eirpods" son AirPods, aunque a una letra esten los EarPods', c && c.q);
    }
    // El respaldo de como suena: la primera letra cambia, el tipeo no llega
    for(const [w, bien] of [['selular', 'celular'], ['konsola', 'consola'], ['kontrol', 'control'], ['zamsung', 'samsung'], ['kamara', 'camara']]){
      if(!odTalCual(bien)){ info(`[4] hoy no hay "${bien}": no se prueba "${w}"`); continue; }
      const c = correccionDe(w);
      ok(!!c && c.hay && c.q === bien, `[4] "${w}" suena como "${bien}"`, c ? c.q : 'sin corregir');
    }
    {
      const c = correccionDe('kamara');
      if(c && c.hay) ok(c.mostrar === formaDelCatalogo('camara') && c.mostrar !== 'camara',
                        '[4] y el aviso con la tilde del catalogo: «' + formaDelCatalogo('camara') + '»', c.mostrar);
    }
    ok(claveDeOido('jaiphone') === claveDeOido('jaifone') && claveDeOido('daizon') === claveDeOido('daison') &&
       claveDeOido('macbuck') === claveDeOido('makbuk') && claveDeOido('llave') === claveDeOido('yave') &&
       claveDeOido('hola') === claveDeOido('ola') && claveDeOido('vaso') === claveDeOido('baso') &&
       claveDeOido('gente') === claveDeOido('jente') && claveDeOido('cine') === claveDeOido('sine') &&
       claveDeOido('queso') === claveDeOido('keso') && claveDeOido('shaomi') === claveDeOido('chaomi') &&
       claveDeOido('casa') !== claveDeOido('caja') && claveDeOido('mate') !== claveDeOido('mete'),
       '[4] como suena: ph/f, sh/ch, k/c/qu/ck, s/z/ce-ci, j/ge-gi, b/v, y/ll/i, h muda, dobles');
    // Con 4 letras, el respaldo no corre (lo de 4 va en la lista)
    for(const [w, no] of [['mate', 'matte'], ['graf', 'graph']]){
      const c = correccionDe(w);
      ok(!c || !c.hay || c.q !== no, `[4] "${w}" no pasa a "${no}" (4 letras: el respaldo no corre)`, c ? c.q : '');
    }
  }

  /* ---- [5] Nada raro ---- */
  {
    for(const w of ['funda', 'fundas', 'templado', 'vidrio', 'protector', 'hola', 'casa', 'precio', 'envio', 'cuotas',
                    'garantia', 'local', 'rosa', 'azul', 'verde', 'plata', 'dorado', 'nuevo', 'mate', 'termo', 'zzzz']){
      if(odTalCual(w)){ info(`[5] hoy "${w}" encuentra algo tal cual`); continue; }
      const c = correccionDe(w);
      ok(!c || !c.hay, `[5] "${w}" no pasa a otra cosa`, c ? c.q : '');
    }
    // Mientras se escriben palabras comunes, ningun pedazo pasa a otra cosa
    // por la lista o por como suena (lo que corrige el tipeo es de UD-03)
    const comunes = ['funda', 'templado', 'vidrio', 'protector', 'cuotas', 'garantia', 'envio', 'precio', 'oferta', 'usado',
                     'sellado', 'original', 'replica', 'cargador', 'cable', 'auricular', 'parlante', 'teclado', 'monitor',
                     'consola', 'control', 'camara', 'lente', 'objetivo', 'tripode', 'microfono', 'bateria', 'memoria',
                     'tarjeta', 'mochila', 'bolso', 'estuche', 'soporte', 'correa', 'malla', 'reloj', 'celular', 'tablet',
                     'notebook', 'computadora', 'impresora', 'televisor', 'gamer', 'juegos', 'plata', 'negro', 'blanco',
                     'azul', 'verde', 'rosa', 'dorado', 'violeta', 'grafito', 'titanio', 'natural', 'desierto', 'local',
                     'direccion', 'horario', 'mayorista', 'canje', 'permuta', 'financiacion', 'transferencia', 'efectivo',
                     'dolares', 'pesos', 'mercadopago', 'envios', 'retiro', 'cotizar', 'pantalla', 'cuero', 'silicona',
                     'magnetico', 'inalambrico', 'adaptador', 'pendrive', 'disco', 'router', 'proyector', 'linterna',
                     'termo', 'mate', 'heladera', 'ventilador', 'plancha', 'perfume', 'zapatillas', 'bicicleta', 'monopatin'];
    const raros = [], vistos = new Set();
    for(const w of comunes) for(let n = 4; n <= w.length; n++){
      const p = w.slice(0, n);
      if(vistos.has(p)) continue;
      vistos.add(p);
      const c = correccionDe(p);
      if(c && c.hay && !candidatosDeTipeo(p).includes(c.q)) raros.push(`${p}→${c.q}`);
    }
    ok(!raros.length, `[5] ninguno de ${vistos.size} pedazos de palabras comunes pasa a otra cosa por como suena`, raros.slice(0, 8).join(', '));
    // "jaifon funda": la funda no esta; sin aviso, y lo mas parecido son iPhone
    const c = correccionDe('jaifon funda');
    if(!odTalCual('iphone funda')){
      ok(!avisoDeCorreccion('jaifon funda') && !odLista('jaifon funda').length, '[5] "jaifon funda" no encuentra nada y no avisa', c && c.q);
      if(odLista('iphone').some(m => m.stock)){
        const p = parecidoDe('jaifon funda');
        ok(!!p && p.q === 'iphone', '[5] y lo mas parecido es "iphone" (no "funda")', p ? p.q : 'nada');
      }
    }
  }

  /* ---- [6] El aviso ---- */
  const nIph = odLista('iphone').length;
  if(!nIph) info('[6] hoy no hay iPhone: no se prueba el aviso con "jaifon"');
  else{
    odLimpiar(); filtros.q = 'jaifon'; $('q').value = 'jaifon'; aplicarFiltro(false);
    const cab = $('rubro-cab');
    const av = cab && cab.querySelector('.rc-tit .q-corregida');
    ok(!!av && odTxt(av) === odAviso('iphone'), '[6] el encabezado dice «Mostrando resultados de “iphone”»', odTxt(av));
    ok(LISTA.length === nIph && grid.querySelectorAll('.card').length > 0, '[6] y la grilla muestra los ' + nIph, LISTA.length);
    ok(odTxt(cab.querySelector('h2')).includes('jaifon'), '[6] el titulo sigue diciendo lo escrito', odTxt(cab.querySelector('h2')));
    ok(new URLSearchParams(location.search).get('q') === 'jaifon', '[6] la direccion sigue con lo escrito', location.search);
    let anuncio = '';
    for(let i = 0; i < 20 && !anuncio.includes('Mostrando'); i++){ await odDormir(150); anuncio = $('anuncio').textContent; }
    ok(anuncio.startsWith(odAviso('iphone') + '. '), '[6] el lector de pantalla oye el aviso antes de la cuenta', anuncio);
    pintarSug();
    const caja = $('q-sug');
    const avs = caja.querySelector('.qs-corregida');
    ok(!caja.hidden && !!avs && odTxt(avs) === odAviso('iphone') && caja.firstElementChild === avs,
       '[6] el desplegable dice lo mismo, arriba de todo', odTxt(avs));
    const sug = [...caja.querySelectorAll('.qs[data-key]')].map(b => buscarProducto(b.dataset.key));
    ok(sug.length > 0 && sug.every(p => p && norm(p.marca) === 'apple'), '[6] y sugiere productos Apple', sug.length + ' sugerencias');
    cerrarSug();
  }
  if(odLista('macbook').length){
    odLimpiar(); filtros.q = 'mac buk'; $('q').value = 'mac buk'; aplicarFiltro(false);
    const cab = $('rubro-cab');
    ok(odTxt(cab && cab.querySelector('.q-corregida')) === odAviso('macbook') && odTxt(cab.querySelector('h2')).includes('mac buk'),
       '[6] "mac buk": «Mostrando resultados de “macbook”» con el titulo como se escribio', odTxt(cab && cab.querySelector('.q-corregida')));
  }
  // Bien escrito, ningun aviso
  odLimpiar(); filtros.q = 'iphone'; $('q').value = 'iphone'; aplicarFiltro(false);
  ok(!document.querySelector('.q-corregida'), '[6] con "iphone" bien escrito no hay aviso');

  /* ---- [7] Las decisiones del buscador, escrito de oido ---- */
  {
    // DP-04: el numero empieza palabra ("jaifon 17" no trae un 117 ni un 17-70mm: ver [2])
    const zoom = MODELOS.find(m => /\b18-150mm\b/i.test(m.desc));
    if(zoom && odLista('canon 50mm').length){
      const l = odLista('kanon 50mm');
      ok(l.length === odLista('canon 50mm').length && !l.includes(zoom), '[7] DP-04 "kanon 50mm" no trae el ' + zoom.desc, l.length);
    }else info('[7] DP-04 hoy no hay 18-150mm o "canon 50mm" no trae nada');
    // DP-05: lo mas parecido con las palabras corregidas
    if(odLista('iphone 17').some(m => m.stock)){
      const p = parecidoDe('jaifon 17 zzzz');
      ok(!!p && p.q === 'iphone 17', '[7] DP-05 "jaifon 17 zzzz": lo mas parecido es "iphone 17" (no "17")', p ? p.q : 'nada');
    }
    if(MODELOS.some(m => m.stock && /\bcargador\b/.test(norm(m.desc))) && !odLista('cargador iphone').length){
      const p = parecidoDe('cargador aifon');
      ok(!!p && p.q === 'cargador', '[7] DP-05 "cargador aifon" ofrece cargadores', p ? p.q : 'nada');
    }
    // DP-13: con busqueda, lo sin stock al final
    const l = odLista('aipad');
    const primeraSin = l.findIndex(m => !m.stock);
    ok(l.length > 0 && (primeraSin === -1 || l.slice(primeraSin).every(m => !m.stock)),
       '[7] DP-13 "aipad" trae los iPad, con lo sin stock al final', l.slice(0, 3).map(m => (m.stock ? '' : '[sin] ') + m.desc).join(' | '));
    // U-02: Enter baja a los resultados
    if(nIph){
      irAlInicio(); await odDormir(60); scrollTo({ top: 0 });
      const q = $('q');
      q.value = 'jaifon';
      q.dispatchEvent(new Event('input', { bubbles: true }));
      q.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      await odDormir(900);
      const cab = $('rubro-cab');
      const ancla = cab && !cab.hidden ? cab : grid;
      ok(LISTA.length === nIph && scrollY > 0 && ancla.getBoundingClientRect().top < innerHeight,
         '[7] U-02 Enter con "jaifon" muestra los ' + nIph + ' y baja hasta ellos', `${LISTA.length}, scrollY ${Math.round(scrollY)}`);
    }
    // Cambiar de rubro no suelta la busqueda corregida
    const esIph = m => norm(m.marca) === 'apple' && /\biphone\b/.test(norm(m.desc)) && m.stock;
    const iph = MODELOS.find(m => esIph(m) && m.cat === 'Celular') || MODELOS.find(esIph);
    if(iph){
      odLimpiar(); filtros.q = 'jaifon'; $('q').value = 'jaifon';
      soltarBusquedaSinResultados(iph.cat);
      ok(filtros.q === 'jaifon', '[7] tocar ' + plural(iph.cat) + ' con "jaifon" buscado no borra la busqueda');
    }
  }
  odLimpiar(); $('q').value = ''; aplicarFiltro(false);
}
