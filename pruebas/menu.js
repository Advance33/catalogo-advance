// El boton para volver al menu de rubros (16/09/2026). Pedro no encontraba
// como volver: estando en "Todo el catalogo" con Apple puesto, el chip "Todo"
// solo sacaba el rubro, la marca quedaba y la portada no aparecia nunca.
// Se prueba en la compu (esta ventana) y en 360 y 390 px con iframes, que es
// donde el boton tiene que entrar al lado de Ordenar y Filtrar.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const $$ = s => document.querySelectorAll(s);

function terminar(){
  for(let i=1;i<5000;i++) clearInterval(i);
  const pre=document.createElement('pre'); pre.id='RESULTADO';
  pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
  document.body.appendChild(pre);
}

const esperar = setInterval(() => {
  if(!MODELOS.length || !$$('#cats .chip').length) return;
  clearInterval(esperar);
  try{ pararPaseos(); }catch(e){}
  try{ pararOfertas(); }catch(e){}
  try{ enLaCompu(); }catch(e){ R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; }
  // El viaje hasta el menu es suave: se mide cuando termino
  try{
    filtros.marca = 'Apple'; aplicarFiltro(true);
    scrollTo(0, document.body.scrollHeight);
    $('rubro-cab').querySelector('[data-menu]').click();
  }catch(e){ R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; }
  setTimeout(() => {
    const tit = $('sec-titulo').getBoundingClientRect().top;
    ok(enPortada() && tit >= 0 && tit < innerHeight / 2, 'y baja hasta el titulo "Elegí un rubro", aunque vengas del fondo',
       Math.round(tit) + 'px');
    enCelular([360, 390]);
  }, 2500);
}, 150);

const vacio = () => !filtros.q && !filtros.cat && !filtros.marca && !filtros.rango && !filtros.soloStock
                    && !filtros.montura && !filtros.apertura && !filtros.capacidad && !filtros.ram;

function enLaCompu(){
  document.documentElement.style.scrollBehavior = 'auto';
  R.push('\n--- en la compu ---');

  /* ---- 1. El caso de Pedro: "Todo el catalogo" con Apple puesto ---- */
  filtros.marca = 'Apple';
  aplicarFiltro(true);
  ok(!enPortada(), 'con Apple puesto se ve la grilla');
  const boton = $('rubro-cab').querySelector('[data-menu]');
  ok(!!boton && /rubros/i.test(boton.textContent), 'el encabezado tiene el boton "Todos los rubros"',
     boton && boton.textContent.trim());
  boton.click();
  ok(enPortada() && vacio(), 'tocarlo vuelve al menu y no deja nada elegido', JSON.stringify(filtros));
  ok(!$('mosaico').hidden && $('grid').hidden, 'y se ven los rubros, no la grilla');
  ok(!/[?&](marca|cat|q)=/.test(location.search), 'la direccion tambien queda limpia', location.search);

  /* ---- 2. Desde un rubro con todo puesto, con el de la barra fija ---- */
  entrarAlRubro('Celular');
  filtros.marca = 'Apple'; filtros.soloStock = true; filtros.q = 'iphone';
  aplicarFiltro(true);
  const fijo = $('rubro-fijo').querySelector('[data-menu]');
  ok(!!fijo, 'la barra fija tambien lo tiene');
  fijo.click();
  ok(enPortada() && vacio(), 'desde la barra fija vuelve igual, con rubro, marca, busqueda y stock sacados',
     JSON.stringify(filtros));
  ok($('q').value === '', 'el buscador queda vacio');

  /* ---- 3. El orden elegido no se pierde: no es un filtro ---- */
  entrarAlRubro('Celular');
  filtros.orden = 'asc';
  aplicarFiltro(true);
  $('rubro-cab').querySelector('[data-menu]').click();
  ok(filtros.orden === 'asc', 'el orden elegido se respeta', filtros.orden);
  filtros.orden = ORDEN_DEF;

  /* ---- 4. El chip "Todo" de la cinta hace lo mismo ---- */
  filtros.marca = 'Apple';
  aplicarFiltro(true);
  ok(!enPortada(), 'otra vez con Apple puesto');
  [...$$('#cats .chip')].find(c => c.dataset.cat === '').click();
  ok(enPortada() && vacio(), '"Todo" en la cinta tambien lleva al menu, aunque haya una marca puesta',
     JSON.stringify(filtros));
  const marcado = [...$$('#cats .chip')].find(c => c.getAttribute('aria-pressed') === 'true');
  ok(marcado && marcado.dataset.cat === '', 'y la cinta queda en "Todo"', marcado && marcado.textContent);

}

function enCelular(anchos){
  if(!anchos.length) return terminar();
  const w = anchos[0];
  const f = document.createElement('iframe');
  f.style.cssText = `width:${w}px;height:800px;border:0;position:absolute;left:-9999px`;
  f.src = 'index.html';
  document.body.appendChild(f);
  f.onload = () => {
    // MODELOS y filtros son let/const: no cuelgan de window, se leen con eval
    const w2 = f.contentWindow;
    const listo = setInterval(() => {
      try{
        if(!w2.eval('typeof MODELOS !== "undefined" && MODELOS.length')
           || !f.contentDocument.querySelectorAll('#cats .chip').length) return;
      }catch(e){ return; }
      clearInterval(listo);
      try{ w2.pararOfertas?.(); w2.pararPaseos?.(); }catch(e){}
      try{ medir(f, w); }catch(e){ R.push('EXCEPCION ' + w + 'px: '+(e&&e.stack||e)); fallas++; }
      f.remove();
      enCelular(anchos.slice(1));
    }, 200);
  };
}

function medir(f, w){
  const d = f.contentDocument, win = f.contentWindow;
  R.push(`\n--- ${w}px ---`);
  for(const [cat, marca] of [['Celular', ''], ['', 'Apple']]){
    Object.assign(win.eval('filtros'), { cat, marca });
    win.aplicarFiltro(true);
    const donde = cat ? 'adentro de Celulares' : 'en "Todo" con Apple';
    const cab = d.querySelector('#rubro-cab [data-menu]');
    const rc = cab && cab.getBoundingClientRect();
    ok(cab && rc.width > 0 && rc.right <= w, `${donde}: el boton del encabezado se ve entero`,
       cab && `${Math.round(rc.left)}-${Math.round(rc.right)} de ${w}`);

    // La barra fija, forzada a la vista
    const fijo = d.getElementById('rubro-fijo');
    fijo.classList.add('visible'); fijo.inert = false;
    const card = fijo.querySelector('.rf-card');
    const btn = card.querySelector('[data-menu]');
    const acc = [...card.querySelectorAll('.rc-acc > *, .rc-acc .orden-btn')].filter(x => x.getBoundingClientRect().width);
    const rb = btn.getBoundingClientRect();
    ok(rb.width >= 36 && rb.height >= 36, `${donde}: en la barra fija el boton se puede tocar`,
       `${Math.round(rb.width)}x${Math.round(rb.height)}`);
    const fuera = [btn, ...acc].filter(x => x.getBoundingClientRect().right > w + 0.5 || x.getBoundingClientRect().left < -0.5);
    ok(!fuera.length, `${donde}: Rubros, Ordenar y Filtrar entran en ${w}px`,
       fuera.map(x => x.className + ' ' + Math.round(x.getBoundingClientRect().right)).join(', ') || 'todo adentro');
    const pisa = acc.filter(x => {
      const r = x.getBoundingClientRect();
      return r.left < rb.right - 0.5 && r.right > rb.left + 0.5 && r.top < rb.bottom - 0.5 && r.bottom > rb.top + 0.5;
    });
    ok(!pisa.length, `${donde}: y no se pisan`, pisa.map(x => x.className).join(', ') || 'ninguno');
    const filtrar = card.querySelector('.filtrar-btn').getBoundingClientRect();
    ok(Math.abs((filtrar.top + filtrar.bottom) / 2 - (rb.top + rb.bottom) / 2) < 4,
       `${donde}: van en la misma fila que Filtrar`, `${Math.round(rb.top)} / ${Math.round(filtrar.top)}`);
    fijo.classList.remove('visible');
  }
  win.irAlMenu();
  ok(win.eval('enPortada()'), `${w}px: y lleva al menu`);
}
