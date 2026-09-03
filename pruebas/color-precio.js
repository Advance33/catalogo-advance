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

  /* ---- 4. Los botones de version siguen estando ---- */
  // Un modelo puede tener varias capacidades Y precio por color a la vez: los
  // puntitos resuelven el color, los botones siguen resolviendo la capacidad.
  const caps = new Set(casos[0].m.variantes.map(x => norm(x.etiquetaBase)));
  if(caps.size > 1)
    ok(document.querySelectorAll('.fi-op').length > 0,
       'con varias capacidades los botones de version siguen apareciendo', caps.size + ' capacidades');

  cerrarFicha();
}
