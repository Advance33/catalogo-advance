// Los rubros de la portada en movimiento (16/09): la foto de cada mundo se turna
// por el producto estrella de cada rubro, pasar el mouse por un rubro muestra el
// suyo, una luz recorre los bordes y la tarjeta se inclina apenas con el mouse.
// Se prueba que cada foto sea de verdad la del rubro que marca, que cambie de a
// una tarjeta y respete a la que alguien mira, y que no baje fotos de mas.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const $$ = s => document.querySelectorAll(s);

const esperar = setInterval(() => {
  if(!MODELOS.length || !$$('#cats .chip').length || !$$('#mosaico .mundo').length) return;
  clearInterval(esperar);
  for(let i=1;i<5000;i++) clearInterval(i);
  try{ correrPruebas(); }catch(e){ R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; }
  try{ pararPaseos(); pararOfertas(); pararNuevos(); pararMarcas(); pararMundos(); }catch(e){}
  for(let i=1;i<5000;i++) clearInterval(i);
  const pre=document.createElement('pre'); pre.id='RESULTADO';
  pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
  document.body.appendChild(pre);
}, 150);

const tarjetas = () => [...$$('#mosaico .mundo')];
const fotos = t => [...t.querySelectorAll('.mundo-foto img')];
const visible = t => fotos(t).findIndex(i => i.classList.contains('ve'));
// La direccion de una foto, con o sin bajar todavia
const srcDe = img => img.getAttribute('src') || img.dataset.src || '';

function correrPruebas(){
  const mundos = mundosDeLaPortada();

  /* ---- 1. Que fotos tiene cada mundo ---- */
  ok(tarjetas().every(t => fotos(t).length >= 1), 'todos los mundos tienen foto');
  ok(tarjetas().some(t => fotos(t).length >= 3), 'y los que tienen varios rubros, varias fotos para turnar',
     tarjetas().map(t => fotos(t).length).join(','));
  ok(tarjetas().every(t => new Set(fotos(t).map(srcDe)).size === fotos(t).length), 'ninguna foto se repite en un mismo mundo');
  ok(tarjetas().every(t => fotos(t).filter(i => i.classList.contains('ve')).length === 1), 'se ve una sola foto por mundo');

  /* Cada foto que dice ser de un rubro tiene que ser su producto estrella: el
     mas caro de ese rubro, con stock y con foto. Si no, al pasar por "Drones"
     se veria cualquier cosa, y el nombre que aparece no coincidiria. */
  const mal = [];
  tarjetas().forEach((t, i) => {
    const w = mundos[i];
    fotos(t).forEach((img, k) => {
      const j = Number(img.dataset.j);
      if(j < 0) return;
      // Si la primera no cargo, ya paso a su repuesto: eso no es un error, esta hecho para eso
      if(k === 0 && srcDe(img) !== w.fotos[0]) return;
      const cat = w.porRubro[j].cat;
      const estrella = MODELOS.filter(m => m.cat === cat && m.stock && m.imagen).sort((a, b) => (b.precio ?? 0) - (a.precio ?? 0))[0];
      if(!estrella || srcDe(img) !== estrella.imagen || img.dataset.prod !== nombreCorto(estrella)) mal.push(w.nombre + '/' + cat);
    });
  });
  ok(!mal.length, 'cada foto es la del producto estrella de su rubro, con su nombre', mal.join(', ') || 'todas bien');
  ok(tarjetas().every((t, i) => mundos[i].fotos.includes(srcDe(fotos(t)[0]))),
     'la que se ve al entrar es la de siempre (o su repuesto, si no cargo)');

  /* ---- 2. El rubro de la foto queda marcado ---- */
  const marcaBien = t => {
    const img = fotos(t)[visible(t)], marcados = [...t.querySelectorAll('.rubro.en-foto')];
    const botones = [...t.querySelectorAll('.rubro')];
    return img.dataset.j === '-1' ? !marcados.length : (marcados.length === 1 && botones.indexOf(marcados[0]) === Number(img.dataset.j));
  };
  ok(tarjetas().every(marcaBien), 'el rubro de la foto que se ve esta marcado, y solo ese');

  /* ---- 3. No baja fotos de mas ----
     Son mas de veinte fotos entre todos los mundos: de entrada baja la que se ve
     y la que sigue, y las demas recien cuando les va tocando. */
  const bajadas = tarjetas().map(t => fotos(t).filter(i => i.getAttribute('src')).length);
  ok(bajadas.every(n => n <= 2), 'de entrada baja como mucho la foto que se ve y la siguiente', bajadas.join(','));

  /* ---- 4. Se turnan de a una tarjeta ---- */
  const antes = tarjetas().map(visible);
  girarMundos();
  const despues = tarjetas().map(visible);
  const cambiaron = despues.filter((k, i) => k !== antes[i]).length;
  ok(cambiaron === 1, 'cada vuelta cambia una sola tarjeta', antes.join(',') + ' -> ' + despues.join(','));
  const t0 = tarjetas()[despues.findIndex((k, i) => k !== antes[i])];
  ok(t0 && t0.classList.contains('cambia'), 'y esa se lleva la vuelta de luz');
  ok(tarjetas().every(marcaBien), 'la marca del rubro acompaña a la foto nueva');
  ok(t0 && fotos(t0)[visible(t0)].getAttribute('src'), 'la foto que aparece ya tiene su archivo pedido');
  // Una vuelta completa pasa por todas las fotos de todas las tarjetas
  const vistas = tarjetas().map(t => new Set([visible(t)]));
  const total = tarjetas().reduce((s, t) => s + fotos(t).length, 0);
  for(let i = 0; i < total * tarjetas().length; i++){ girarMundos(); tarjetas().forEach((t, k) => vistas[k].add(visible(t))); }
  ok(tarjetas().every((t, k) => vistas[k].size === fotos(t).length), 'dando vueltas se ven todas las fotos de cada mundo',
     vistas.map(v => v.size).join(','));

  /* ---- 5. La que alguien mira no cambia sola ---- */
  const grande = tarjetas().find(t => fotos(t).length >= 3) || tarjetas()[0];
  grande.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
  const quieta = visible(grande);
  const otras = tarjetas().filter(t => t !== grande && fotos(t).length > 1);
  const antesOtras = otras.map(visible);
  for(let i = 0; i < tarjetas().length * 3; i++) girarMundos();
  ok(visible(grande) === quieta, 'con el mouse encima, esa tarjeta no cambia', grande.querySelector('h3').textContent);
  ok(otras.length && otras.every((t, i) => visible(t) !== antesOtras[i] || fotos(t).length === 1) || otras.some((t, i) => visible(t) !== antesOtras[i]),
     'las demas siguen girando', antesOtras.join(',') + ' -> ' + otras.map(visible).join(','));

  /* ---- 6. Pasar por un rubro muestra su producto ---- */
  const botones = [...grande.querySelectorAll('.rubro')];
  const conFoto = botones.map((b, j) => ({ b, j, k: fotos(grande).findIndex(i => i.dataset.j === String(j)) })).filter(x => x.k >= 0);
  const otro = conFoto.find(x => x.k !== visible(grande));
  otro.b.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
  const cap = grande.querySelector('.mundo-cap');
  ok(visible(grande) === otro.k, 'al pasar por un rubro se ve su producto', otro.b.textContent.trim());
  ok(cap.classList.contains('ve') && cap.textContent === fotos(grande)[otro.k].dataset.prod, 'con el nombre del producto', cap.textContent);
  ok(marcaBien(grande), 'y ese rubro queda marcado');
  grande.querySelector('.mundo-rubros').dispatchEvent(new PointerEvent('pointerleave'));
  ok(visible(grande) === grande._k && !cap.classList.contains('ve'), 'al salir de los rubros vuelve a la foto de la ronda');
  // Con el dedo no: tocar un rubro entra directo, no tiene que cambiar la foto antes
  const tocado = conFoto.find(x => x.k !== visible(grande));
  tocado.b.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch' }));
  ok(visible(grande) !== tocado.k, 'con el dedo, pasar por un rubro no cambia la foto');

  /* ---- 7. Inclinacion suave con el mouse ---- */
  const r = grande.getBoundingClientRect();
  grande.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: r.right - 1, clientY: r.top + 1 }));
  const ry = parseFloat(grande.style.getPropertyValue('--ry')), rx = parseFloat(grande.style.getPropertyValue('--rx'));
  ok(grande.classList.contains('sigue') && ry > 0 && rx > 0, 'se inclina hacia donde esta el mouse', 'rx ' + rx + ' / ry ' + ry);
  // Con el mouse en la esquina es lo mas que se inclina. La completa llegaba a 5 grados y competia con todo.
  ok(Math.abs(ry) <= 2.5 && Math.abs(rx) <= 2.5, 'y apenas: la version suave, menos de 2,5 grados en la esquina', 'rx ' + rx + ' / ry ' + ry);
  const img = fotos(grande)[visible(grande)];
  ok(getComputedStyle(img).mixBlendMode === 'multiply' && getComputedStyle(img.parentElement).transform === 'none',
     'la foto se corre sola, sin transformar su caja (si no, vuelve el fondo blanco de la toma)');
  grande.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
  ok(!grande.classList.contains('sigue') && !grande.style.getPropertyValue('--ry'), 'al irse el mouse vuelve derecha');
  const tocadaMover = tarjetas()[0];
  tocadaMover.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'touch', clientX: 10, clientY: 10 }));
  ok(!tocadaMover.classList.contains('sigue'), 'con el dedo no se inclina');

  /* ---- 8. La luz en los bordes ---- */
  const luz = getComputedStyle(tarjetas()[0], '::before');
  ok(luz.content !== 'none' && (quieto || luz.animationName === 'mundoLuz'), 'la luz recorre el borde', luz.animationName);

  /* ---- 9. Fuera de la portada se frena ---- */
  arrancarMundos();
  ok(!!mundosTimer || quieto, 'en la portada gira');
  const rubro = $$('#mosaico .rubro')[0];
  rubro.click();
  ok(!mundosTimer, 'al entrar a un rubro deja de girar', filtros.cat);
  [...$$('#cats .chip')].find(c => c.dataset.cat === '').click();
  ok(!!mundosTimer || quieto, 'y al volver a la portada gira de nuevo');
}
