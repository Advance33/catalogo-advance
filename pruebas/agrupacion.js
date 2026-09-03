// Pruebas de agrupacion y categorias contra la planilla REAL.
// Sin numeros fijos: la planilla cambia todos los dias, asi que se verifican
// invariantes (nada se pierde, nada se agrupa de mas) y los conteos van al pie
// como informacion.
const R = [];
let fallas = 0;
const ok = (c, txt, extra) => { R.push((c?'  OK  ':'FALLA ') + txt + (extra!==undefined?('  ['+extra+']'):'')); if(!c) fallas++; };
const reportar = () => {
  const pre = document.createElement('pre');
  pre.id = 'RESULTADO';
  pre.textContent = '\n===== ' + (fallas ? fallas + ' FALLA(S)' : 'TODO OK') + ' =====\n' + R.join('\n');
  document.body.appendChild(pre);
};

const esperar = setInterval(() => {
  // Esperar los datos no alcanza: MODELOS se llena un instante antes de que se
  // dibujen los chips y la grilla, y el test arrancaba en ese hueco.
  if(!MODELOS.length || !document.querySelectorAll('#cats .chip').length) return;
  // La portada muestra los rubros, no los productos. Para probar la grilla hay
  // que pedirla, igual que hace el cliente cuando toca "Ver todo".
  verTodoElCatalogo();
  if(!document.querySelectorAll('.card').length) return;
  clearInterval(esperar);
  for(let i = 1; i < 5000; i++) clearInterval(i);   // el reloj virtual dispara el refresco
  try{ correrPruebas(); }catch(e){ R.push('EXCEPCION: ' + (e && e.stack || e)); fallas++; }
  reportar();
}, 120);

function correrPruebas(){
  const cuenta = c => PRODUCTOS.filter(p => p.cat === c).length;
  const baja = s => (s||'').toLowerCase();

  /* ---- 1. Categorias derivadas por marca ---- */
  ok(cuenta('Notebook') === 0, 'no quedan notebooks sin clasificar', cuenta('Notebook'));
  // Smartwatch dejo de estar vacia cuando entraron Garmin y Kieslect: lo que
  // importa es que ahi no quede ningun Apple, y que en Apple Watch no haya otra marca.
  ok(PRODUCTOS.filter(p => p.cat==='Smartwatch').every(p => norm(p.marca) !== 'apple'),
     'en Smartwatch no quedo ningun Apple',
     [...new Set(PRODUCTOS.filter(p=>p.cat==='Smartwatch').map(p=>p.marca))].join(', ') || 'vacia');
  ok(cuenta('iPad') > 0 && cuenta('MacBook') > 0 && cuenta('Apple Watch') > 0,
     'existen las categorias nuevas',
     cuenta('iPad') + ' iPad, ' + cuenta('MacBook') + ' MacBook, ' + cuenta('Apple Watch') + ' Apple Watch');
  /* Lo importante no es cuantos hay, sino que cada uno este donde va. Se
     mira la descripcion Y el modelo: la planilla dejo de repetir la marca
     en la descripcion ("Watch SE 3 GPS" con el modelo "Apple Watch SE 3"), asi
     que mirar solo la descripcion daba una falla que no era. */
  ok(PRODUCTOS.filter(p => p.cat==='iPad').every(p => /ipad/i.test(p.desc + ' ' + p.modelo)),
     'todo lo que esta en iPad es un iPad');
  ok(PRODUCTOS.filter(p => p.cat==='MacBook').every(p => /macbook/i.test(p.desc + ' ' + p.modelo)),
     'todo lo que esta en MacBook es un MacBook');
  ok(PRODUCTOS.filter(p => p.cat==='Apple Watch').every(p => /apple watch/i.test(p.desc + ' ' + p.modelo)),
     'todo lo que esta en Apple Watch es un Apple Watch');
  ok(PRODUCTOS.filter(p => p.cat==='Tablet').every(p => !/ipad/i.test(p.desc + ' ' + p.modelo)),
     'no quedo ningun iPad suelto en Tablet',
     [...new Set(PRODUCTOS.filter(p => p.cat==='Tablet').map(p=>p.marca))].join(','));
  ok(categoriaReal('Tablet','Samsung','Samsung GALAXY TAB') === 'Tablet' &&
     categoriaReal('Tablet','Apple','Apple iPad 11') === 'iPad' &&
     categoriaReal('Notebook','Asus','Asus Zenbook') === 'Notebook' &&
     categoriaReal('Celular','Apple','Apple IPHONE 16') === 'Celular',
     'la regla mira la marca: una notebook Asus seguiria en Notebook');

  /* ---- 2. Plural solo en la barra ---- */
  const chips = [...document.querySelectorAll('#cats .chip')];
  const txt = chips.map(b => b.textContent);
  ok(chips.length > 1, 'la barra tiene chips', chips.length);
  ok(!txt.some(t => /^(Celular|Lente|Cámara|Consola|Tablet|iPad|MacBook|Drone|Filmadora|Desktop)$/.test(t)),
     'ningun chip quedo en singular', txt.join(' | '));
  // Los plurales inventados aparecen solos cuando se agrega una categoria nueva
  const raros = txt.filter(t => /(ses|sses)$/i.test(t) || /Watchs|Auricularess/.test(t));
  ok(raros.length === 0, 'no se inventan plurales raros', raros.join(' | ') || 'ninguno');
  ok(plural('Lentes Inteligentes')==='Lentes Inteligentes' && plural('E-Reader')==='E-Readers' &&
     plural('Monitor')==='Monitores',
     'lo que ya viene en plural no se vuelve a pluralizar',
     plural('Lentes Inteligentes') + ' / ' + plural('E-Reader'));
  ok(plural('Consola')==='Consolas' && plural('Drone')==='Drones' && plural('Desktop')==='Desktops' &&
     plural('Cámara')==='Cámaras' && plural('Apple Watch')==='Apple Watch',
     'la funcion plural anda');
  // El VALOR del chip sigue en singular: es lo que viaja en el link
  ok(chips.every(b => b.dataset.cat === '' || PRODUCTOS.some(p => p.cat === b.dataset.cat)),
     'el filtro de cada chip apunta a una categoria real');

  /* ---- 3. Invariantes de la agrupacion ---- */
  ok(MODELOS.length < PRODUCTOS.length, 'hay menos tarjetas que filas',
     PRODUCTOS.length + ' filas -> ' + MODELOS.length + ' tarjetas');
  const suma = MODELOS.reduce((s,m) => s + m.variantes.length, 0);
  ok(suma === PRODUCTOS.length, 'no se perdio ni se duplico ninguna fila', suma);
  const ids = new Set(MODELOS.flatMap(m => m.variantes.map(v => v.id)));
  ok(ids.size === PRODUCTOS.length, 'cada fila esta en un solo grupo', ids.size);
  ok(MODELOS.every(m => m.variantes.every(v => v.cat === m.cat && v.marca === m.marca)),
     'nunca se mezclan categorias ni marcas dentro de un grupo');
  ok(MODELOS.every(m => m.precio === null || m.variantes.some(v => v.precio === m.precio)),
     'el precio de la tarjeta es el de alguna variante de verdad');
  ok(MODELOS.every(m => m.precio === null || m.variantes.every(v => v.precio === null || v.precio >= m.precio)),
     'y es el MENOR de todos (el "desde")');
  const repetidas = MODELOS.filter(m => new Set(m.variantes.map(v=>v.etiqueta)).size !== m.variantes.length);
  ok(repetidas.length === 0, 'en ningun modelo se repiten dos etiquetas',
     repetidas.map(m => m.desc + ': ' + m.variantes.map(v=>v.etiqueta).join('/')).join(' | ') || 'ninguno');
  /* Lo que distingue a dos versiones no puede perderse. Un parentesis que
     comparten TODAS las variantes es parte del nombre del modelo ("Garmin Epix
     Pro (Gen 2)") y ahi tiene que quedarse. Pero si lo trae una sola, es lo
     unico que la separa de sus hermanas y tiene que aparecer en su etiqueta:
     pasaba con los Magic Keyboard "(M4/M5)" y "(M2)", que quedaban los dos
     diciendo "Black" con precios distintos. */
  const parentesis = v => [...(v.desc||'').matchAll(/\(([^)]+)\)/g)]
    .map(x => x[1].trim())
    .filter(t => { const l = pintas(t); return !(l.length && l.every(c => c.hex)); });

  const perdidos = [];
  MODELOS.filter(m => m.multi).forEach(m => {
    m.variantes.forEach(v => {
      parentesis(v).forEach(t => {
        const comun = m.variantes.every(o => parentesis(o).includes(t));
        if(comun) return;                      // va en el nombre del modelo
        if(!norm(v.etiqueta).includes(norm(t).split(/\s+/)[0]))
          perdidos.push(`${m.desc}: "${t}" no quedo en "${v.etiqueta}"`);
      });
    });
  });
  ok(perdidos.length === 0,
     'lo que distingue una version de otra sobrevive en su etiqueta',
     perdidos.join(' | ') || 'nada se pierde');
  ok(MODELOS.every(m => m.stock === m.variantes.some(v => v.stock)),
     'el modelo figura con stock si al menos una variante lo tiene');

  // Lentes y camaras: lo mas delicado, no se debe agrupar NADA
  const lentes = MODELOS.filter(m => m.cat === 'Lente');
  ok(lentes.every(m => !m.multi), 'ningun lente se agrupo',
     lentes.filter(m=>m.multi).map(m=>m.desc).join(' / ') || 'ninguno');
  ok(lentes.length === cuenta('Lente'), 'los lentes siguen 1 a 1', lentes.length);
  ok(MODELOS.filter(m => m.cat === 'Cámara').every(m => !m.multi), 'ninguna camara se agrupo');

  /* ---- 4. Los grupos que si se formaron son coherentes ---- */
  const multi = MODELOS.filter(m => m.multi);
  ok(multi.length > 0, 'hay modelos agrupados',
     multi.length + ' modelos agrupan ' + multi.reduce((s,m)=>s+m.variantes.length,0) + ' filas');
  const malNombre = multi.filter(m => !m.variantes.every(v => baja(v.desc).startsWith(baja(m.desc))));
  ok(malNombre.length === 0, 'el nombre del grupo es el comienzo comun de todas sus variantes',
     malNombre.map(m=>m.desc)[0] || 'todos bien');
  ok(multi.every(m => m.desc.split(/\s+/).length >= 2), 'ningun grupo quedo con nombre de una palabra');

  const mini = MODELOS.find(m => /Mac Mini M4(?! Pro)/.test(m.desc));
  ok(mini && mini.multi, 'los Mac Mini M4 quedaron juntos',
     mini ? mini.desc + ' -> ' + mini.variantes.map(v=>v.etiqueta).join(' | ') : 'no esta');
  ok(MODELOS.some(m => /Mac Mini M4 Pro/.test(m.desc)), 'el M4 Pro sigue siendo un modelo aparte');

  // Un modelo agrupado por capacidad, el que haya: buscarlo por nombre fijo
  // rompe el test cada vez que cambia el catalogo (paso con el iPad 11 A16).
  const porCap = MODELOS.find(m => m.multi &&
    m.variantes.every(v => /\d+\s*(GB|TB)/i.test(v.etiqueta)));
  ok(!!porCap, 'hay modelos agrupados por capacidad',
     porCap ? porCap.desc + ' -> ' + porCap.variantes.map(v=>v.etiqueta).join(' | ') : 'ninguno');
  ok(!porCap || new Set(porCap.variantes.map(v=>v.precio)).size > 1,
     'y sus versiones tienen precios distintos');

  /* ---- 5. La tarjeta ---- */
  const conRango = MODELOS.filter(m => m.multi && m.precio !== m.precioMax);
  ok(conRango.length > 0, 'hay modelos cuyas versiones no valen lo mismo', conRango.length);
  const card = [...document.querySelectorAll('.card')].find(c => {
    const m = buscarModelo(c.dataset.key); return m && m.multi && m.precio !== m.precioMax;
  });
  ok(card && card.querySelector('.usd .desde'), 'esas tarjetas dicen "desde"',
     card && card.querySelector('.usd').textContent.replace(/\s+/g,' ').trim());
  ok(card && card.querySelector('.opciones'), 'y muestran las opciones',
     card && card.querySelector('.opciones').textContent);
  const simple = [...document.querySelectorAll('.card')].find(c => {
    const m = buscarModelo(c.dataset.key); return m && !m.multi;
  });
  ok(simple && !simple.querySelector('.usd .desde') && !simple.querySelector('.opciones'),
     'un producto sin variantes no dice "desde" ni muestra opciones');

  /* ---- 6. La ficha: elegir version cambia el precio ---- */
  PEDIDO = []; guardarPedido();
  const m0 = conRango[0];
  const barata = m0.variantes.find(v => v.precio === m0.precio);
  const cara   = m0.variantes.find(v => v.precio === m0.precioMax);
  abrirFicha(clave(barata), null);
  let d = document.getElementById('ficha');
  ok(!!d, 'abre la ficha');
  ok(d.querySelector('.fi-nombre').textContent === m0.desc, 'el titulo es el del modelo',
     d.querySelector('.fi-nombre').textContent);
  const ops = [...d.querySelectorAll('.fi-op')];
  ok(ops.length === m0.variantes.length, 'un boton por version', ops.length);
  ok(ops.every(b => /USD|Consultar/.test(b.textContent)), 'cada boton muestra su propio precio',
     ops.map(b=>b.textContent.replace(/\s+/g,' ').trim()).join(' / '));
  ok(d.querySelector('.fi-precio .usd').textContent.includes(plata(m0.precio)),
     'arranca mostrando el precio de la variante abierta');

  [...d.querySelectorAll('.fi-op')].find(b => b.dataset.k === clave(cara)).click();
  d = document.getElementById('ficha');
  ok(d.querySelector('.fi-precio .usd').textContent.includes(plata(m0.precioMax)),
     'al elegir otra version cambia el precio',
     d.querySelector('.fi-precio .usd').textContent.trim());
  ok(FICHA === clave(cara), 'la ficha pasa a apuntar a esa variante', FICHA);
  ok([...d.querySelectorAll('.fi-op')].find(b => b.dataset.k === clave(cara))
        .getAttribute('aria-pressed') === 'true', 'y queda marcada');
  const ars = d.querySelector('.fi-precio .ars');
  ok(!TC || !ars || ars.textContent.includes(plata(Math.round(m0.precioMax*TC))),
     'el precio en pesos acompana', ars && ars.textContent.trim());

  /* ---- 7. Color que vive en otra fila y cambia el precio ---- */
  const porColor = MODELOS.find(m => m.multi && m.precio !== m.precioMax &&
                                m.variantes.every(v => !/\d+\s*(gb|tb)/i.test(v.etiqueta)));
  if(porColor){
    abrirFicha(clave(porColor.rep), null);
    const dd = document.getElementById('ficha');
    const antes = dd.querySelector('.fi-precio .usd').textContent;
    [...dd.querySelectorAll('.fi-op')].find(b => b.dataset.k !== clave(porColor.rep)).click();
    ok(document.getElementById('ficha').querySelector('.fi-precio .usd').textContent !== antes,
       'elegir la version de otro color cambia el precio',
       porColor.desc + ': ' + porColor.variantes.map(v=>v.etiqueta+' USD '+v.precio).join(' | '));
    cerrarFicha();
  } else {
    R.push('  --   (hoy la planilla no tiene modelos que varien solo por color)');
  }

  /* ---- 8. El pedido guarda la VARIANTE ---- */
  abrirFicha(clave(cara), null);
  d = document.getElementById('ficha');
  d.querySelector('#fi-pedido').click();
  ok(PEDIDO.length === 1 && PEDIDO[0].k === clave(cara),
     'agrega la variante elegida, no el modelo', JSON.stringify(PEDIDO));
  ok(totalPedido() === m0.precioMax, 'el pedido usa el precio de esa variante', totalPedido());
  d.querySelector('#fi-pedido-caja .stepper button[data-d="1"]').click();
  ok(cantDe(clave(cara)) === 2 && totalPedido() === m0.precioMax*2,
     'las unidades siguen andando', totalPedido());
  ok(mensajePedido().includes(cara.id), 'el mensaje de WhatsApp nombra la variante');
  refrescarBotonesPedido();
  const cardM = [...document.querySelectorAll('.card')].find(c => c.dataset.key === clave(m0.rep));
  ok(!cardM || cardM.querySelector('.mas').getAttribute('aria-pressed') === 'true',
     'el + de la tarjeta reconoce que hay una variante cargada');
  togglePedidoModelo(clave(m0.rep));
  ok(PEDIDO.length === 0, 'y sacarla desde la tarjeta la quita', JSON.stringify(PEDIDO));
  cerrarFicha();

  /* ---- 9. Links a una variante ---- */
  abrirFicha(clave(cara), null);
  d = document.getElementById('ficha');
  ok(d.querySelector('.fi-nombre').textContent === m0.desc, 'un link a una variante abre el modelo');
  ok([...d.querySelectorAll('.fi-op')].find(b => b.dataset.k === clave(cara))
        .getAttribute('aria-pressed') === 'true', 'con esa variante ya elegida');
  cerrarFicha();

  /* ---- 10. Buscar y filtrar ---- */
  const guardado = JSON.stringify(filtros);
  filtros.q = cara.id; filtros.cat=''; filtros.marca=''; filtros.rango='';
  ok(filtrar().includes(m0), 'buscar por el ID de una variante encuentra el modelo');
  const cap = (cara.etiqueta.match(/\d+\s*(gb|tb)/i) || [''])[0];
  if(cap){
    filtros.q = cap;
    ok(filtrar().includes(m0), 'buscar por la capacidad de una variante tambien', cap);
  }
  filtros.q = '';
  const tramo = RANGOS.find(r => m0.precioMax >= r[2] && m0.precioMax < r[3]);
  filtros.rango = tramo[0];
  ok(filtrar().includes(m0), 'entra en el tramo de precio de su variante mas cara', tramo[1]);
  filtros.rango = '';
  filtros.cat = 'iPad';
  ok(filtrar().every(m => m.cat === 'iPad'), 'el filtro por categoria nueva anda',
     filtrar().length + ' iPads');
  Object.assign(filtros, JSON.parse(guardado));

  /* ---- 11. El contador ---- */
  pintar();
  ok($('count').textContent.startsWith(String(MODELOS.length)), 'el contador cuenta modelos',
     $('count').textContent);

  /* ---- Numeros de hoy, informativo ---- */
  R.push('\n--- la planilla de hoy ---');
  R.push('  ' + PRODUCTOS.length + ' filas -> ' + MODELOS.length + ' tarjetas');
  const porCat = {};
  PRODUCTOS.forEach(p => { porCat[p.cat] = (porCat[p.cat]||0)+1; });
  R.push('  ' + Object.entries(porCat).sort((a,b)=>b[1]-a[1]).map(x => x[0]+':'+x[1]).join('  '));
  R.push('  ' + multi.length + ' modelos agrupan ' +
         multi.reduce((s,m)=>s+m.variantes.length,0) + ' filas');
}
