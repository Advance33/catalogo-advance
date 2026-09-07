// Precio por color: hay modelos donde la misma capacidad vale distinto segun
// el color (el iPhone 17 Pro Max 512GB sale USD 1.490 en Orange y 1.520 en
// Silver). El proveedor confirmo que es real y pasa seguido, asi que el color
// dejo de ser una muestra y es un selector: tocarlo tiene que cambiar el precio.
//
// Sin numeros fijos: se busca el caso en la planilla del dia. Si algun dia no
// hay ninguno, el test lo dice y no falla.
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
  if(!MODELOS.length) return;
  // La portada muestra los rubros, no los productos. Para probar la grilla hay
  // que pedirla, igual que hace el cliente cuando toca "Ver todo".
  verTodoElCatalogo();
  if(!document.querySelectorAll('.card').length) return;
  clearInterval(esperar);
  for(let i = 1; i < 5000; i++) clearInterval(i);
  try{ correrPruebas(); }catch(e){ R.push('EXCEPCION: ' + (e && e.stack || e)); fallas++; }
  // Las pruebas vuelven a pintar, y cada pintado reengancha los paseos de las
  // pistas y el carrusel. Si queda alguno vivo, con el reloj acelerado del
  // headless el navegador no cierra nunca y la tanda figura como que no llego
  // a correr. Se frena todo DESPUES de correr, no antes.
  try{ pararPaseos(); }catch(e){}
  try{ pararOfertas(); }catch(e){}
  for(let i=1;i<5000;i++) clearInterval(i);

  reportar();
}, 120);

function correrPruebas(){
  const conVar = MODELOS.filter(m => m.multi);

  /* ---- 1. Las hermanas de color ---- */
  ok(conVar.every(m => m.variantes.every(v => (v.hermanasColor || []).includes(v))),
     'cada version esta entre sus propias hermanas de color');

  ok(conVar.every(m => m.variantes.every(v =>
       (v.hermanasColor || []).every(h => norm(h.etiquetaBase) === norm(v.etiquetaBase)))),
     'las hermanas de color comparten la misma capacidad');

  /* ---- 2. Los casos reales de la planilla de hoy ---- */
  const casos = [];
  conVar.forEach(m => m.variantes.forEach(v => {
    const h = (v.hermanasColor || []).filter(x => x.color);
    if(h.length > 1 && new Set(h.map(x => x.precio)).size > 1) casos.push({ m, v, h });
  }));

  if(!casos.length){
    R.push('  --  hoy la planilla no trae ningun precio por color: nada que probar');
    return;
  }
  R.push('  --  ' + casos.length + ' version(es) con precio distinto segun el color');

  /* ---- 3. La ficha: el puntito es el selector ---- */
  const { v, h } = casos[0];
  const nombre = v.desc + ' (' + v.id + ')';
  abrirFicha(clave(v), null);

  const puntos = [...document.querySelectorAll('.fi-pintas button')];
  ok(puntos.length >= 2, 'la ficha muestra los colores de todas las hermanas', nombre);

  const deOtra = puntos.filter(b => b.dataset.k && b.dataset.k !== clave(v));
  ok(deOtra.length > 0, 'hay puntitos que llevan a otra version', deOtra.length + ' de ' + puntos.length);

  ok(!!document.querySelector('#fi-color-hint'),
     'la ficha avisa que el precio cambia segun el color');

  if(deOtra.length){
    const antes = document.querySelector('.fi-precio .usd')?.textContent || '';
    deOtra[0].click();
    const despues = document.querySelector('.fi-precio .usd')?.textContent || '';
    ok(antes && despues && antes !== despues,
       'tocar un color de otra version cambia el precio', antes + ' -> ' + despues);

    // Y el color tocado queda marcado, no se pierde al redibujar la ficha
    const marcado = [...document.querySelectorAll('.fi-pintas button')]
                      .some(b => b.getAttribute('aria-pressed') === 'true');
    ok(marcado, 'el color elegido queda marcado despues de cambiar de version');
  }

  /* ---- 3b. Ningun color se dibuja dos veces ----
     Cuando el precio depende del color, la ficha junta los colores de TODAS
     las hermanas. Si dos hermanas declaran el mismo color se dibujaba un
     puntito por cada una: el iPhone 17 PRO 256GB son dos filas con los tres
     colores cada una y salian SEIS puntitos para tres colores.

     Ojo con como se elige el caso: la primera version de esta prueba miraba la
     ficha que ya estaba abierta, que es la del primer modelo con precio por
     color -un MacBook de cuatro colores distintos- y por eso daba OK aunque el
     arreglo estuviera sacado. Hay que ir a buscar el modelo que de verdad
     tiene hermanas con colores repetidos. */
  const conRepe = MODELOS.filter(m => m.multi).find(m =>
    m.variantes.some(v => {
      const suyos = pintas(v.color).map(c => norm(c.nombre));
      return (v.hermanasColor || []).some(h => h !== v &&
        pintas(h.color).some(c => suyos.includes(norm(c.nombre))));
    }));

  if(!conRepe){
    ok(true, 'no hay ningun modelo con hermanas que repitan color', 'nada que probar hoy');
  } else {
    abrirFicha(clave(conRepe.variantes[0]));
    const ns = [...document.querySelectorAll('.fi-pintas button')].map(b => norm(b.dataset.color));
    ok(ns.length > 0 && new Set(ns).size === ns.length,
       'ningun color se repite en los puntitos, ni juntando hermanas',
       conRepe.desc + ': ' + ns.join(' / '));
    cerrarFicha();
  }

  // Y el caso de una sola celda, que aparece si alguien escribe "Black/Black"
  const celdaRepetida = PRODUCTOS.filter(x => {
    const ns = pintas(x.color).map(c => norm(c.nombre));
    return new Set(ns).size !== ns.length;
  });
  ok(celdaRepetida.length === 0,
     'pintas() no devuelve dos veces el mismo color de una celda',
     celdaRepetida.slice(0, 3).map(x => x.id + ': ' + x.color).join(' | ') || 'ninguna');

  /* ---- 4. Los botones de version siguen estando ---- */
  // Un modelo puede tener varias capacidades Y precio por color a la vez: los
  // puntitos resuelven el color, los botones siguen resolviendo la capacidad.
  const caps = new Set(casos[0].m.variantes.map(x => norm(x.etiquetaBase)));
  if(caps.size > 1)
    ok(document.querySelectorAll('.fi-op').length > 0,
       'con varias capacidades los botones de version siguen apareciendo', caps.size + ' capacidades');

  cerrarFicha();
}
