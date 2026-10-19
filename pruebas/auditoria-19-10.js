// La auditoria de toda la web del 19/10/2026 (Benja: "hace auditoria de toda
// la WEB"). Cada comprobacion lleva el numero del hallazgo:
//   DP-01 una pestaña de memoria que dice un precio lleva a una fila CON stock
//         de esa memoria (el S26 White tocaba «512GB · USD 920» y caia en el
//         512GB White agotado, con Black y Violet con stock)
//   DP-03 "16GB 512GB" sin barra: 512GB de capacidad y 16GB de RAM
//   DP-04 un numero buscado empieza palabra ("50mm" no trae el 18-150mm), "ii"
//         no es "iii" y "1.8" encuentra "F1.8"
//   DP-05 "cargador iphone" prueba primero sin la ultima palabra
//   DP-13 con una busqueda, lo que la tarjeta muestra sin stock va al final
//   T-01  "Más cámaras de precio parecido" (no "Otros Cámaras")
//   T-02  los otros equipos que se toman no dicen que Samsung es de Apple
//   T-03  en Filtrar, Memoria es el almacenamiento y RAM es la RAM
//   T-06  la marca no se repite escrita de otra forma ("GoPro Go Pro")
//   T-08  el articulo del mensaje concuerda ("la Batería", "las Hélices")
//   T-12  la pestaña dice Advance Tecno
//   T-13  el mensaje de un objetivo de caja blanca lo dice
//   U-01  con Filtrar abierto, el Atras cierra el panel y deja el rubro y lo
//         elegido
//   U-02  buscar con Enter baja hasta los resultados
//   U-06  el pedido tiene una X para cerrarlo
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);
const a19Dormir = ms => new Promise(r => setTimeout(r, ms));

const esperaA19 = setInterval(() => {
  if(!MODELOS.length || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperaA19);
  (async () => {
    try{ await a19Pruebas(); }catch(e){ R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; }
    try{ pararPaseos(); pararOfertas(); pararNuevos(); pararMarcas(); pararMundos(); }catch(e){}
    for(let i=1;i<5000;i++) clearInterval(i);
    const pre=document.createElement('pre'); pre.id='RESULTADO';
    pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
    document.body.appendChild(pre);
  })();
}, 150);

const a19Limpiar = () => Object.assign(filtros, { q:'', cat:'', marca:'', rango:'', capacidad:'', ram:'', montura:'', apertura:'', soloStock:false, orden:'modelo', ...SIN_PROPIOS });

async function a19Pruebas(){
  document.documentElement.style.scrollBehavior = 'auto';

  /* ---- DP-01 Las pestañas de memoria llevan a lo que tiene stock ---- */
  {
    let tocadas = 0;
    const mal = [];
    for(const m of MODELOS){
      if(!m.stock || (m.variantes || []).length < 2) continue;
      // Desde la que abre la tarjeta y desde hasta otras dos con stock (otro color u otra RAM)
      for(const pos of [...new Set([m.rep, ...m.variantes.filter(v => v.stock)])].slice(0, 3)){
        abrirFicha(clave(pos), null);
        const d = document.getElementById('ficha');
        if(!d) continue;
        const tabs = [...d.querySelectorAll('.fi-op[data-mem]')];
        for(let i = 0; i < tabs.length; i++){
          abrirFicha(clave(pos), null);
          const b = [...document.querySelectorAll('#ficha .fi-op[data-mem]')][i];
          if(!b || b.classList.contains('agotada') || b.getAttribute('aria-pressed') === 'true') continue;
          const dice = b.textContent.replace(/\s+/g, ' ').trim();
          b.click();
          tocadas++;
          const llega = buscarProducto(FICHA);
          if(llega && !llega.stock) mal.push(`${m.titulo || m.desc}: desde ${pos.id} «${dice}» -> ${llega.id} sin stock`);
        }
      }
      quitarFicha();
    }
    ok(tocadas > 20 && !mal.length, 'DP-01 cada pestaña de memoria con precio lleva a una fila con stock de esa memoria',
       mal.slice(0, 4).join(' | ') || tocadas + ' toques');
  }

  /* ---- DP-03 RAM y disco separados por un espacio ---- */
  {
    const f = desc => ({ desc, modelo: '' });
    ok(capacidadDe(f('Apple iMac 24 M4 16GB 512GB')) === '512GB' && ramDe(f('Apple iMac 24 M4 16GB 512GB')) === '16GB',
       'DP-03 "16GB 512GB": 512GB de disco y 16GB de RAM', capacidadDe(f('Apple iMac 24 M4 16GB 512GB')) + ' / ' + ramDe(f('Apple iMac 24 M4 16GB 512GB')));
    ok(capacidadDe(f('Mac Mini M5 Pro 24GB 1TB')) === '1TB' && ramDe(f('Mac Mini M5 Pro 24GB 1TB')) === '24GB',
       'DP-03 "24GB 1TB": 1TB y 24GB de RAM');
    const s = specs(f('Apple Mac Mini M6 16GB 512GB'));
    ok(s.includes('16GB RAM') && s.includes('512GB') && !s.includes('16GB'), 'DP-03 la ficha dice "16GB RAM" y "512GB"', s.join(', '));
    ok(capacidadDe(f('Samsung Galaxy A56 12/256GB')) === '256GB' && capacidadDe(f('Apple iPhone 17 Pro 256GB')) === '256GB',
       'DP-03 lo de siempre sigue igual ("12/256GB", "256GB")');
  }

  /* ---- DP-04 Los numeros buscados empiezan palabra ---- */
  {
    const p50 = prepararBusqueda('50mm');
    const zoom = MODELOS.find(m => /\b18-150mm\b/i.test(m.desc));
    const fijo = MODELOS.find(m => /(^|\s)50mm\b/i.test(m.desc));
    if(zoom) ok(!coincide(zoom, p50), 'DP-04 "50mm" no trae el ' + zoom.desc);
    else info('DP-04 no hay ningun 18-150mm hoy');
    if(fijo) ok(coincide(fijo, p50), 'DP-04 "50mm" si trae el ' + fijo.desc);
    const iii = MODELOS.find(m => /\bmark iii\b/i.test(m.desc) && !(m.variantes || []).some(v => /\bmark ii\b/i.test(v.desc || '')));
    if(iii) ok(!coincide(iii, prepararBusqueda('mark ii')), 'DP-04 "mark ii" no trae el ' + iii.desc);
    const sinBarra = MODELOS.find(m => /\bF1\.8\b/.test(m.desc));
    if(sinBarra) ok(coincide(sinBarra, prepararBusqueda('1.8')), 'DP-04 "1.8" encuentra la apertura sin barra: ' + sinBarra.desc);
    const conBarra = MODELOS.find(m => /F\/1\.8\b/.test(m.desc));
    if(conBarra) ok(coincide(conBarra, prepararBusqueda('1.8')), 'DP-04 y la escrita con barra: ' + conBarra.desc);
    const ip = MODELOS.find(m => /iphone 17 pro\b/i.test(m.desc));
    if(ip) ok(coincide(ip, prepararBusqueda('iphone 17')) && coincide(ip, prepararBusqueda('17 pro')), 'DP-04 "iphone 17" y "17 pro" siguen trayendo el iPhone 17 Pro');
  }

  /* ---- DP-05 Lo mas parecido, primero sin la ultima palabra ---- */
  {
    const hay = MODELOS.some(m => m.stock && /^cargador\b/i.test(norm(m.desc)) || (m.stock && /\bcargador\b/i.test(norm(m.desc)) && !/iphone/.test(norm(m.desc))));
    const p = parecidoDe('cargador iphone');
    if(hay) ok(!!p && p.q === 'cargador', 'DP-05 "cargador iphone" ofrece cargadores, no iPhones', p ? p.q + ': ' + p.modelos.map(m => m.desc).join(', ') : 'nada');
    else info('DP-05 hoy no hay cargadores con stock');
  }

  /* ---- DP-13 Con una busqueda, lo sin stock al final ---- */
  {
    a19Limpiar(); filtros.q = 'teclado español'; aplicarFiltro(false);
    const l = listaDeLaGrilla();
    const primeraSin = l.findIndex(m => !m.stock);
    ok(primeraSin === -1 || l.slice(primeraSin).every(m => !m.stock), 'DP-13 con "teclado español", lo que la tarjeta muestra sin stock va al final',
       l.slice(0, 4).map(m => (m.stock ? '' : '[sin] ') + m.desc).join(' | '));
    a19Limpiar(); aplicarFiltro(false);
  }

  /* ---- Textos ---- */
  ok(rubroEnFrase('Cámara') === 'cámaras' && rubroEnFrase('Apple Watch') === 'Apple Watch' && rubroEnFrase('MacBook') === 'MacBooks'
     && rubroEnFrase('Gafas Inteligentes') === 'gafas inteligentes' && rubroEnFrase('Dyson') === 'Dyson',
     'T-01 el rubro en la frase: "cámaras", "gafas inteligentes", y las marcas como son', ['Cámara', 'Apple Watch', 'Gafas Inteligentes'].map(rubroEnFrase).join(', '));
  {
    const m = MODELOS.find(x => x.stock && x.cat === 'Cámara' && relacionados(x).length);
    if(m){
      const h = htmlRelacionados(m);
      ok(/Más cámaras/.test(h) && !/Otros /.test(h), 'T-01 la cinta de la ficha dice "Más cámaras…"', (/fi-rel-porque">([^<]*)/.exec(h) || [])[1]);
    }
  }
  ok(!USADOS_OTROS || (!/Samsung y otros equipos de Apple/.test(USADOS_OTROS) && /Apple/.test(USADOS_OTROS)),
     'T-02 los otros equipos no dicen que Samsung es de Apple', USADOS_OTROS);
  {
    a19Limpiar(); entrarAlRubro('Celular');
    const t = gruposDeFiltros().map(g => g.titulo);
    ok(t.includes('Memoria') && t.includes('RAM') && !t.includes('Capacidad'), 'T-03 en Filtrar: Memoria (almacenamiento) y RAM', t.join(' / '));
    a19Limpiar(); aplicarFiltro(false);
  }
  {
    const n = (marca, desc) => nombreConMarca({ marca, desc });
    ok(n('GoPro', 'Go Pro Hero 13 Black') === 'Go Pro Hero 13 Black' && n('Ray-Ban', 'Rayban Meta Gen 2') === 'Rayban Meta Gen 2'
       && n('Insta360', 'Insta 360 X5') === 'Insta 360 X5' && n('Fujifilm', 'Fuji Instax Mini Twin Film') === 'Fuji Instax Mini Twin Film',
       'T-06 la marca escrita de otra forma no se repite ("GoPro Go Pro")', n('GoPro', 'Go Pro Hero 13 Black'));
    ok(n('Canon', 'EOS R6 Mark II') === 'Canon EOS R6 Mark II' && n('Motorola', 'Moto G57') === 'Motorola Moto G57' && n('DJI', 'Drone DJI Neo 2') === 'Drone DJI Neo 2',
       'T-06 y donde no esta, se sigue poniendo ("Canon EOS R6", "Motorola Moto G57")');
  }
  ok(articuloDe('Apple Batería MagSafe iPhone Air') === 'la' && articuloDe('DJI Hélices (Mini 3 Pro)') === 'las'
     && articuloDe('Memoria Nikon 64GB XQD') === 'la' && articuloDe('Apple iPhone 17 Pro') === 'el' && articuloDe('Mouse Zzz 2') === 'el',
     'T-08 el articulo del mensaje: "la Batería", "las Hélices", "el iPhone"');
  {
    const bat = MODELOS.flatMap(m => m.variantes || [m]).find(v => /^bater/i.test(norm(v.desc)));
    if(bat) ok(/^Hola! Me interesa la /.test(mensajeWA(bat)) && /^Hola! La .* figura sin stock/.test(mensajeAviso(bat)),
               'T-08 la consulta y el aviso de una batería', mensajeWA(bat).slice(0, 60));
  }
  ok(TITULO_BASE === 'Advance Tecno', 'T-12 la pestaña dice Advance Tecno', TITULO_BASE);
  {
    const cb = MODELOS.flatMap(m => m.variantes || [m]).find(v => /caja blanca/i.test(v.condicion || '') && !/caja blanca/i.test(v.desc));
    if(cb) ok(/\(caja blanca\)/.test(mensajeWA(cb)), 'T-13 la consulta de un objetivo de caja blanca lo dice', mensajeWA(cb).slice(0, 90));
    else info('T-13 hoy no hay nada de caja blanca');
  }

  /* ---- U-01 Filtrar y el Atras ---- */
  {
    const cat = ['Cámara', 'Celular'].find(c => MODELOS.some(m => m.cat === c && m.stock));
    a19Limpiar(); history.replaceState(null, '', location.pathname);
    entrarAlRubro(cat);
    await a19Dormir(60);
    document.querySelector('#rubro-cab .filtrar-btn, .filtrar-btn').click();
    await a19Dormir(60);
    const chip = document.querySelector('#filtros-panel .op-chip[data-campo]');
    ok(!!chip, 'U-01 el panel Filtrar se abre con opciones');
    if(chip){
      const campo = chip.dataset.campo, v = chip.dataset.v;
      chip.click();
      await a19Dormir(60);
      history.back();
      await a19Dormir(400);
      ok(!document.getElementById('filtros-panel') && filtros.cat === cat && filtros[campo] === v,
         'U-01 el Atras cierra Filtrar y deja el rubro y lo elegido', 'panel ' + !!document.getElementById('filtros-panel') + ' · cat ' + filtros.cat + ' · ' + campo + '=' + filtros[campo]);
      ok(new URLSearchParams(location.search).get('cat') === cat, 'U-01 y la direccion lo dice', location.search);
    }
    a19Limpiar(); aplicarFiltro(false);
  }

  /* ---- U-02 Buscar con Enter baja a los resultados ---- */
  {
    irAlInicio();
    await a19Dormir(60);
    scrollTo({ top: 0 });
    const q = document.getElementById('q');
    const palabra = norm(MODELOS.find(m => m.stock && m.marca).marca);
    q.value = palabra;
    q.dispatchEvent(new Event('input', { bubbles: true }));
    q.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await a19Dormir(900);
    const cab = document.getElementById('rubro-cab');
    const ancla = cab && !cab.hidden ? cab : document.getElementById('grid');
    const top = ancla.getBoundingClientRect().top;
    ok(top < innerHeight * 0.5, 'U-02 buscar con Enter baja hasta los resultados', 'encabezado en y=' + Math.round(top) + ' de ' + innerHeight);
    irAlInicio();
  }

  /* ---- U-06 El pedido tiene X para cerrar ---- */
  {
    const antes = JSON.stringify(PEDIDO);
    let ls = null;
    try{ ls = localStorage.getItem(PEDIDO_KEY); }catch(e){}
    const m = MODELOS.find(x => x.stock);
    PEDIDO = [{ k: clave(m.rep), n: 1 }]; guardarPedido(); pintarPedido();
    try{
      abrirPedido();
      await a19Dormir(60);
      const x = document.querySelector('#pedido .pd-cerrar');
      ok(!!x && x.getAttribute('aria-label') === 'Cerrar el pedido', 'U-06 el pedido tiene su X de cerrar');
      if(x){ x.click(); await a19Dormir(300); }
      ok(!document.getElementById('pedido') && PEDIDO.length === 1, 'U-06 la X cierra el pedido sin borrar nada', 'abierto ' + !!document.getElementById('pedido') + ' · lineas ' + PEDIDO.length);
    }finally{
      document.getElementById('pedido') && cerrarPedidoDOM && cerrarPedidoDOM();
      PEDIDO = JSON.parse(antes);
      try{ if(ls === null) localStorage.removeItem(PEDIDO_KEY); else localStorage.setItem(PEDIDO_KEY, ls); }catch(e){}
      pintarPedido();
    }
  }
}
