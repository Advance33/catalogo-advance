const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const esperar = setInterval(() => {
  if(!MODELOS.length || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperar);
  for(let i=1;i<5000;i++) clearInterval(i);
  try{ correrPruebas(); }catch(e){ R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; }
  const pre=document.createElement('pre'); pre.id='RESULTADO';
  pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
  document.body.appendChild(pre);
}, 150);

function correrPruebas(){
  /* ---- El orden pedido ---- */
  const cats = [...document.querySelectorAll('#cats .chip')].map(b => b.dataset.cat).filter(Boolean);
  const esperado = ['Celular','Accesorio Apple','Auriculares','Consola','Accesorio Gaming',
                    'MacBook','iPad','Monitor','Desktop','Apple Watch','Tablet'];
  const presentes = esperado.filter(c => cats.includes(c));
  ok(presentes.every((c,i) => i===0 || cats.indexOf(presentes[i-1]) < cats.indexOf(c)),
     'la barra sigue el orden pedido', cats.slice(0,7).join(' > '));
  ok(cats[0] === 'Celular', 'arranca por Celulares');
  const todas = [...new Set(PRODUCTOS.map(p => p.cat))];
  ok(cats.length === todas.length, 'no falta ninguna categoria', cats.length + ' de ' + todas.length);
  // Cualquier categoria que no figure en ORDEN_CATS tiene que aparecer igual,
  // al final. Se prueba con las que haya hoy, no con un nombre fijo: el
  // catalogo cambia (E-Reader existia ayer y hoy no).
  const fuera = cats.filter(c => !ORDEN_CATS.includes(c));
  ok(fuera.every(c => ORDEN_CATS.filter(x => cats.includes(x))
       .every(x => cats.indexOf(x) < cats.indexOf(c))),
     'lo que no esta en la lista aparece igual, al final',
     fuera.join(', ') || 'hoy no hay ninguna fuera de la lista');

  /* ---- Destacar SIN esconder ---- */
  Object.entries(MARCA_DESTACADA).forEach(([cat, marca]) => {
    filtros.cat = cat; filtros.marca = ''; filtros.orden = 'modelo'; filtros.q = '';
    pintar();
    const res = filtrar();
    const total = MODELOS.filter(m => m.cat === cat).length;

    // Lo esencial: no se esconde nada
    ok(res.length === total, `${cat}: se siguen viendo TODOS los productos`,
       res.length + ' de ' + total);
    ok(filtros.marca === '', `${cat}: no queda ninguna marca puesta como filtro`);

    // Los de la marca destacada arriba
    const conStock = res.filter(m => m.stock);
    const primeros = conStock.slice(0, conStock.filter(m => norm(m.marca) === norm(marca)).length);
    ok(primeros.every(m => norm(m.marca) === norm(marca)),
       `${cat}: los ${marca} van arriba de todo`,
       conStock.slice(0,4).map(m => m.marca).join(', '));

    // Y las otras marcas siguen ahi, abajo
    const otras = [...new Set(res.map(m => m.marca))].filter(m => norm(m) !== norm(marca));
    ok(otras.length > 0, `${cat}: las otras marcas siguen presentes`, otras.join(', '));

    // La destacada, primera en la lista lateral
    const lista = marcasDisponibles();
    ok(lista.length && norm(lista[0][0]) === norm(marca),
       `${cat}: ${marca} queda primera en la lista de marcas`,
       lista.map(x => x[0]+' '+x[1]).join(' | '));
  });

  /* ---- Si el cliente pide otro orden, manda el suyo ---- */
  filtros.cat = 'Celular'; filtros.marca = ''; filtros.orden = 'asc';
  const porPrecio = filtrar().filter(m => m.stock);
  const precios = porPrecio.map(m => m.precio).filter(p => p !== null);
  ok(precios.every((p,i) => i===0 || precios[i-1] <= p),
     'con "precio menor a mayor" manda el precio, no la marca destacada',
     porPrecio.slice(0,3).map(m => m.marca+' '+m.precio).join(', '));
  filtros.orden = 'modelo';

  /* ---- Una categoria sin destacada no cambia ---- */
  filtros.cat = 'Objetivo'; pintar();
  ok(!marcaDestacada(), 'en Objetivos no hay marca destacada, queda como estaba');

  /* ---- Si la marca no existe en esa categoria, no se rompe ---- */
  const guardado = MARCA_DESTACADA['Objetivo'];
  MARCA_DESTACADA['Objetivo'] = 'MarcaQueNoExiste';
  filtros.cat = 'Objetivo';
  ok(marcaDestacada() === '' && filtrar().length > 0,
     'una destacada inexistente se ignora sin romper nada', filtrar().length + ' lentes');
  if(guardado === undefined) delete MARCA_DESTACADA['Objetivo']; else MARCA_DESTACADA['Objetivo'] = guardado;

  filtros.cat = ''; pintar();
  /* ---- La fila de marcas entre los productos ---- */
  filtros.cat = ''; filtros.marca = ''; filtros.q = ''; pintar();
  const fila = document.getElementById('fila-marcas');
  ok(!!fila, 'en "Todo" aparece la fila de marcas');
  if(fila){
    const mks = [...fila.querySelectorAll('.mk')];
    ok(mks.length >= 3 && mks.length <= CUANTAS_MARCAS, 'con las marcas principales', mks.length);
    const nums = mks.map(b => +b.querySelector('i').textContent);
    ok(nums.every((n,i) => i === 0 || nums[i-1] >= n), 'ordenadas por cantidad',
       mks.map(b => b.dataset.marca + ' ' + b.querySelector('i').textContent).join(', '));
    ok(mks.every(b => MODELOS.some(m => m.marca === b.dataset.marca)),
       'todas las marcas de la fila existen en el catalogo');
    const rf = fila.getBoundingClientRect(), rg = grid.getBoundingClientRect();
    ok(Math.abs(rf.width - rg.width) < 4, 'ocupa el ancho completo de la grilla',
       Math.round(rf.width) + ' vs ' + Math.round(rg.width));
    const pos = [...grid.children].indexOf(fila);
    ok(pos === MARCAS_DESPUES_DE, 'va despues de ' + MARCAS_DESPUES_DE + ' productos', 'posicion ' + pos);
    const largos = mks.filter(b => b.dataset.marca.length > 8);
    ok(largos.every(b => b.querySelector('b').dataset.largo === 'mucho'),
       'los nombres largos entran en el circulo',
       largos.map(b => b.dataset.marca).join(', ') || 'no hay nombres largos hoy');
    const antesF = document.querySelectorAll('.card').length;
    const marcaF = mks[0].dataset.marca;
    mks[0].click();
    ok(filtros.marca === marcaF, 'tocar una marca la pone como filtro', filtros.marca);
    // La grilla dibuja de a tandas, asi que la CANTIDAD puede no cambiar:
    // lo que importa es que todo lo que se ve sea de esa marca.
    ok([...document.querySelectorAll('.card')]
         .every(c => buscarModelo(c.dataset.key)?.marca === marcaF),
       'y todo lo que queda es de esa marca',
       marcaF + ': ' + document.querySelectorAll('.card').length + ' tarjetas');
    ok(!document.getElementById('fila-marcas'),
       'con la marca puesta la fila se retira (ya elegiste)');
    filtros.marca = ''; pintar();
  }
  filtros.cat = 'Celular'; pintar();
  ok(!document.getElementById('fila-marcas'),
     'dentro de una categoria no aparece: las marcas ya estan en la columna');
  filtros.cat = ''; pintar();

  R.push('\n--- la barra queda asi ---');
  R.push('  ' + cats.join('  ·  '));
}
