// Los links que se comparten (29/09/2026, hallazgo 189 de la auditoria).
//
// "Mira los iPhone", "este es el que te dije": el link que se manda por
// WhatsApp es una herramienta de venta. Lo lee leerURL() (?cat, ?marca, ?q,
// ?precio, ?stock) y lo abre abrirFichaDesdeURL() (#p=). Hasta hoy ninguna
// prueba abria la pagina DESDE un link: correr.py abre siempre la copia sin
// ?busqueda ni #p=, asi que si esto se rompia nadie se enteraba hasta que un
// cliente se quejara.
//
// Se abre la pagina de nuevo en iframes, cada una con su link, y se mira lo
// que ve el cliente: el chip marcado, la grilla, el buscador, la ficha. Pocas
// y juntando parametros, porque cada una baja el catalogo entero.
//
// Sin claves fijas: los productos rotan. La variante y la gemela se sacan
// del catalogo de esta misma pagina, que es el mismo que bajan los iframes.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };

function lkTerminar(){
  for(let i=1;i<5000;i++) clearInterval(i);
  const pre=document.createElement('pre'); pre.id='RESULTADO';
  pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
  document.body.appendChild(pre);
}

/* Abre `link` en un iframe y espera a que tenga datos. Con tope: una carga
   caida sale como FALLA de esta tanda y no como "NO LLEGO A CORRER". */
function lkAbrir(link){
  return new Promise(res => {
    const f = document.createElement('iframe');
    f.style.cssText = 'width:1440px;height:900px;border:0;position:absolute;left:-9999px;top:0';
    f.src = link;
    f.onload = () => {
      let vueltas = 0;
      const iv = setInterval(() => {
        let listo = false;
        try{
          const w = f.contentWindow;
          w.pararOfertas?.(); w.pararPaseos?.();
          listo = w.eval('MODELOS.length > 0 && ULTIMA_OK > 0');
        }catch(e){}
        if(listo || ++vueltas > 200){
          clearInterval(iv);
          // un momento para que abrirFichaDesdeURL() y el primer pintado terminen
          setTimeout(() => res(listo ? f : null), 600);
        }
      }, 200);
    };
    document.body.appendChild(f);
  });
}
const lkLeer = (f, expr) => f.contentWindow.eval(expr);

async function lkCorrer(){
  /* ---- 1. Filtros: rubro con el nombre viejo, precio invalido, stock ----
     "Lente" es como venian los links de antes del renombre: tiene que abrir
     el rubro con su nombre de hoy (CATS_RENOMBRE, no 'Objetivo' escrito a
     mano). Un ?precio que no existe no deja la grilla vacia sin ningun
     filtro a la vista: se ignora.
     Lo que se espera de la grilla sale del dato del dia (29/09), no de que
     los Objetivos tengan stock: el 28/09 ADVAPP los dejo fuera de venta (ver
     sugeridos.js) y con eso esta tanda daba "0 tarjetas" como FALLA con la
     pagina andando bien. Sin stock, lo correcto es la grilla vacia con el
     aviso de que la vaciaron los filtros; sin el rubro, el renombre no se
     puede probar (armarFiltros vuelve a "todo") y se anota. Sigue siendo un
     solo iframe: cada uno baja el catalogo entero. */
  const catNueva = CATS_RENOMBRE['lente'];
  const hayRubro = MODELOS.some(m => m.cat === catNueva);
  const hayStock = MODELOS.some(m => m.cat === catNueva && m.stock);
  const f1 = await lkAbrir('index.html?cat=Lente&precio=cualquiera&stock=1');
  ok(!!f1, 'el link ?cat=Lente&precio=...&stock=1 carga el catalogo');
  if(f1){
    const fl = lkLeer(f1, 'JSON.stringify({ cat: filtros.cat, rango: filtros.rango, stock: filtros.soloStock })');
    const x = JSON.parse(fl);
    ok(x.rango === '', 'un ?precio que no existe se ignora', JSON.stringify(x.rango));
    ok(x.stock === true, '?stock=1 deja puesto "solo con stock"');
    const d = f1.contentDocument;
    const tarjetas = d.querySelectorAll('#grid .card').length;
    const enStock = lkLeer(f1, 'LISTA.every(m => m.stock)')
                 && (!hayRubro || lkLeer(f1, 'LISTA.every(m => m.cat === ' + JSON.stringify(catNueva) + ')'));
    if(hayRubro){
      ok(x.cat === catNueva, '?cat=Lente abre el rubro con su nombre de hoy', x.cat + ' (esperado ' + catNueva + ')');
      const chip = d.querySelector('#cats .chip[aria-pressed="true"]:not(.clon)');
      ok(!!chip && chip.dataset.cat === catNueva, 'y el chip del rubro queda marcado', chip ? chip.textContent : 'ninguno');
    }else{
      R.push('  --  hoy no hay ningun ' + catNueva + ' en el catalogo: el renombre ?cat=Lente no se probo');
    }
    if(hayStock || !hayRubro){
      ok(!d.getElementById('grid').hidden && tarjetas > 0 && enStock,
         hayRubro ? 'la grilla muestra ese rubro, solo con stock' : 'la grilla muestra solo lo que tiene stock',
         tarjetas + ' tarjetas');
    }else{
      const msg = d.querySelector('#grid .msg');
      ok(!d.getElementById('grid').hidden && tarjetas === 0 && !!msg && /filtros/i.test(msg.textContent),
         'hoy ningun ' + catNueva + ' tiene stock: la grilla queda vacia y dice que son los filtros',
         tarjetas + ' tarjetas · ' + (msg ? msg.textContent.replace(/\s+/g, ' ').trim() : 'sin aviso'));
    }
    f1.remove();
  }

  /* ---- 2. Marca y busqueda ---- */
  const marca = (MODELOS.find(m => /apple/i.test(m.marca)) || MODELOS[0]).marca;
  const f2 = await lkAbrir('index.html?marca=' + encodeURIComponent(marca) + '&q=' + encodeURIComponent('iphone'));
  ok(!!f2, 'el link ?marca=...&q=... carga el catalogo');
  if(f2){
    const x = JSON.parse(lkLeer(f2, 'JSON.stringify({ marca: filtros.marca, q: filtros.q, n: LISTA.length, todas: LISTA.every(m => m.marca === filtros.marca) })'));
    ok(x.marca === marca && x.q === 'iphone', '?marca y ?q se leen', x.marca + ' · ' + x.q);
    ok(f2.contentDocument.getElementById('q').value === 'iphone', 'y lo buscado aparece escrito en el buscador',
       JSON.stringify(f2.contentDocument.getElementById('q').value));
    ok(x.n > 0 && x.todas, 'la grilla muestra solo esa marca', x.n + ' modelos');
    f2.remove();
  }

  /* ---- 3. #p= de una variante que no es la de la tarjeta ----
     Lo que se comparte es exactamente lo que se miraba, no la version mas
     barata: la ficha abre con ESA variante puesta. */
  const conVarias = MODELOS.find(m => m.variantes.length > 1 && m.variantes.some(v => v !== m.rep));
  if(conVarias){
    const v = conVarias.variantes.find(x => x !== conVarias.rep);
    const k = clave(v);
    const f3 = await lkAbrir('index.html#p=' + encodeURIComponent(k));
    ok(!!f3, 'el link #p= carga el catalogo', k);
    if(f3){
      const ficha = f3.contentDocument.getElementById('ficha');
      const abierta = lkLeer(f3, 'FICHA');
      ok(!!ficha && abierta === k, '#p= de una variante abre su ficha con esa variante puesta',
         k + ' -> ' + (ficha ? abierta : 'sin ficha'));
      f3.remove();
    }
  }else{
    R.push('  --  hoy ningun modelo tiene mas de una variante: #p= de una variante no se probo');
  }

  /* ---- 4. #p= de una fila escondida detras de su gemela ----
     Un link viejo a una fila que hoy se colapsa tiene que seguir abriendo el
     producto (agrupacion.js lo prueba con buscarModelo; aca, entrando por el
     link), y la direccion pasa a la clave que se ve. */
  const conGemela = MODELOS.find(m => (m.gemelas || []).length);
  if(conGemela){
    const kg = clave(conGemela.gemelas[0]);
    const f4 = await lkAbrir('index.html#p=' + encodeURIComponent(kg));
    ok(!!f4, 'el link #p= de una gemela carga el catalogo', kg);
    if(f4){
      const x = JSON.parse(lkLeer(f4, 'JSON.stringify({ ficha: FICHA, del: FICHA_MODELO ? clave(FICHA_MODELO.rep) : "", hash: location.hash, visibles: FICHA_MODELO ? FICHA_MODELO.variantes.map(clave) : [] })'));
      const suyo = buscarModelo(kg);
      ok(!!f4.contentDocument.getElementById('ficha') && x.del === clave(suyo.rep) && x.visibles.includes(x.ficha),
         '#p= de una fila escondida abre la ficha de su producto', kg + ' -> ' + x.ficha);
      ok(x.hash === '#p=' + encodeURIComponent(x.ficha), 'y la direccion pasa a la clave que se ve', x.hash);
      f4.remove();
    }
  }else{
    R.push('  --  hoy ninguna fila esta escondida detras de su gemela: nada que probar');
  }

  /* ---- 5. El ?config del equipo no viaja en el link (29/09) ----
     Pedro prende el boton de la cotizacion abriendo una vez con ?config.
     urlActual() conserva los parametros que no conoce, asi que el ?config se
     quedaba pegado a cada rubro y busqueda, y el cliente que abria ese link
     copiado de la barra quedaba en modo equipo para siempre. Los iframes
     comparten el localStorage con esta pagina: se guarda y se devuelve. */
  const cfg0 = localStorage.getItem('advtecno.config');
  try{
    localStorage.removeItem('advtecno.config');
    const f5 = await lkAbrir('index.html?q=iphone&config');
    ok(!!f5, 'el link ?q=...&config carga el catalogo');
    if(f5){
      const w5 = f5.contentWindow;
      ok(lkLeer(f5, 'MODO_CONFIG') === true && localStorage.getItem('advtecno.config') === '1',
         '?config prende el modo equipo en este navegador');
      ok(!/config/.test(w5.location.search) && /q=iphone/.test(w5.location.search),
         'y sale de la direccion, sin llevarse los otros parametros', w5.location.search);
      const chip = [...f5.contentDocument.querySelectorAll('#cats .chip')].find(b => b.dataset.cat && !b.classList.contains('clon'));
      if(chip){
        chip.click();
        ok(!/config/.test(w5.location.search), 'al cambiar de rubro la direccion sigue sin config', w5.location.search);
      }
      f5.remove();
    }
  }finally{
    try{ if(cfg0 === null) localStorage.removeItem('advtecno.config'); else localStorage.setItem('advtecno.config', cfg0); }catch(e){}
  }
}

const lkEsperar = setInterval(() => {
  if(!MODELOS.length || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(lkEsperar);
  try{ pararPaseos(); }catch(e){}
  try{ pararOfertas(); }catch(e){}
  lkCorrer()
    .catch(e => { R.push('EXCEPCION: ' + (e && e.stack || e)); fallas++; })
    .finally(lkTerminar);
}, 150);
