// Los precios del viernes (Benja, 07/11/2026): «congelemos los del viernes
// avisando que es probable que el lunes cambien». El sábado no sale lista y
// el fin de semana (y los días que Tecno cierra) ADVAPP manda en el sobre
// precios_congelados = { dia, cambian }. La web lo dice en un renglón abajo
// de la barra: "Precios del viernes 06/11. Es probable que cambien el lunes."
//
// Se prueba: que el dato se lea y se valide, el texto exacto, que se muestre
// sólo con el dato de ADVAPP (nunca con la copia ni sin el dato), que con los
// datos de hoy diga lo que dice ADVAPP, y que a 390 y a 1280 no desborde.
const R = [];
let fallas = 0;
const ok = (c, t, x) => { R.push((c ? '  OK  ' : 'FALLA ') + t + (x !== undefined ? ('  [' + x + ']') : '')); if(!c) fallas++; };
const reportarPC = () => {
  const pre = document.createElement('pre');
  pre.id = 'RESULTADO';
  pre.textContent = '\n===== ' + (fallas ? fallas + ' FALLA(S)' : 'TODO OK') + ' =====\n' + R.join('\n');
  document.body.appendChild(pre);
};

const VIERNES_LUNES = { dia: '2026-11-06', cambian: '2026-11-09' };
const VIERNES_MIERCOLES = { dia: '2026-11-06', cambian: '2026-11-11' };
const textoPC = () => document.getElementById('aviso-congelados-txt').textContent;
const vistoPC = () => !document.getElementById('aviso-congelados').hidden;

function unidadPC(){
  ok(JSON.stringify(congeladosDe(VIERNES_LUNES)) === JSON.stringify(VIERNES_LUNES), 'congeladosDe lee { dia, cambian }');
  ok(JSON.stringify(congeladosDe({ ...VIERNES_LUNES, proveedor: 'X' })) === JSON.stringify(VIERNES_LUNES), 'y se queda sólo con las dos fechas');
  ok(congeladosDe(null) === null && congeladosDe(undefined) === null && congeladosDe({ dia: 'viernes', cambian: '2026-11-09' }) === null
     && congeladosDe({ dia: '2026-11-06' }) === null, 'sin dato o con una fecha rota: null (no se muestra nada)');
  const div = document.createElement('div');
  div.innerHTML = textoCongelados(VIERNES_LUNES);
  ok(div.textContent === 'Precios del viernes 06/11. Es probable que cambien el lunes.', 'el texto, con las palabras de Benja', div.textContent);
  div.innerHTML = textoCongelados(VIERNES_MIERCOLES);
  ok(div.textContent === 'Precios del viernes 06/11. Es probable que cambien el miércoles.', 'con el lunes y el martes cerrados: el miércoles', div.textContent);
  ok(div.querySelector('b') && div.querySelector('b').textContent === 'Precios del viernes 06/11.', 'la primera parte en negrita');
  ok(diaSemana('2026-11-07') === 'sábado' && ddmm('2026-11-07') === '07/11', 'el día y la fecha salen de la fecha, sin depender del huso');
}

function pintadoPC(){
  const antes = FUENTE;
  try{
    FUENTE = { fuente: 'advapp', manifiesto: { congelados: VIERNES_LUNES } };
    pintarCongelados();
    ok(vistoPC() && textoPC() === 'Precios del viernes 06/11. Es probable que cambien el lunes.', 'con el dato de ADVAPP se ve el aviso', textoPC());
    FUENTE = { fuente: 'advapp', manifiesto: { congelados: null } };
    pintarCongelados();
    ok(!vistoPC(), 'sin el dato (un día común) no se ve');
    FUENTE = { fuente: 'copia', manifiesto: null, hora: Date.now() };
    pintarCongelados();
    ok(!vistoPC(), 'con la copia de este navegador no se ve (ahí va la franja ámbar)');
    FUENTE = { fuente: 'planilla', manifiesto: { congelados: VIERNES_LUNES } };
    pintarCongelados();
    ok(!vistoPC(), 'sólo ADVAPP lo puede prender');
  }finally{
    FUENTE = antes;
    pintarCongelados();
  }
  const c = FUENTE && FUENTE.fuente === 'advapp' && FUENTE.manifiesto && FUENTE.manifiesto.congelados;
  ok(vistoPC() === !!c, 'con los datos de hoy dice lo que manda ADVAPP', c ? textoPC() : 'hoy no hay precios congelados');
  const el = document.getElementById('aviso-congelados');
  ok(el.getAttribute('role') === 'note', 'es una nota, no un aviso que se lee en voz alta en cada refresco');
  const fr = document.getElementById('franja');
  ok(document.querySelector('.topbar').nextElementSibling === fr && fr.nextElementSibling === el
     && el.nextElementSibling === document.querySelector('header'),
     'va entre la franja de la copia y el encabezado (la franja sigue pegada a la barra)');
}

// A 390 (el celular, en un iframe: el headless no baja de ~500) y a 1280.
const ANCHOS_PC = [390, 1280];
function anchosPC(i){
  if(i >= ANCHOS_PC.length){ reportarPC(); return; }
  const w = ANCHOS_PC[i];
  const f = document.createElement('iframe');
  f.style.cssText = `width:${w}px;height:700px;border:0;position:absolute;left:-9999px`;
  f.src = 'index.html';
  document.body.appendChild(f);
  f.onload = () => {
    const win = f.contentWindow;
    const listo = setInterval(() => {
      // MODELOS es `let`: no cuelga de window, se lee con eval
      let n = 0;
      try{ n = win.eval('MODELOS.length'); }catch{}
      if(!n) return;
      clearInterval(listo);
      try{ win.pararOfertas?.(); win.pararPaseos?.(); }catch{}
      try{
        win.eval("FUENTE = { fuente: 'advapp', manifiesto: { congelados: { dia: '2026-11-06', cambian: '2026-11-11' } } }; pintarCongelados();");
        const d = f.contentDocument, av = d.getElementById('aviso-congelados');
        const r = av.getBoundingClientRect(), p = d.getElementById('aviso-congelados-txt').getBoundingClientRect();
        const ancho = d.documentElement.clientWidth;
        ok(ancho === w, `${w}px: el iframe mide lo que tiene que medir (sin barra)`, ancho);
        ok(r.height > 20 && r.width <= w + 0.5, `${w}px: el aviso se ve y entra a lo ancho`, `${Math.round(r.width)}x${Math.round(r.height)}`);
        ok(p.right <= w + 0.5, `${w}px: el texto no se sale`, Math.round(p.right));
        ok(d.documentElement.scrollWidth <= ancho, `${w}px: sin desborde horizontal en la página`, d.documentElement.scrollWidth + ' vs ' + ancho);
        const top = d.querySelector('.topbar').getBoundingClientRect(), head = d.querySelector('header').getBoundingClientRect();
        ok(r.top >= top.bottom - 1 && r.bottom <= head.top + 1, `${w}px: va entre la barra de arriba y el encabezado`);
      }catch(e){ R.push('EXCEPCION ' + w + 'px: ' + (e && e.stack || e)); fallas++; }
      f.remove();
      anchosPC(i + 1);
    }, 150);
  };
}

const esperarPC = setInterval(() => {
  if(!MODELOS.length) return;
  clearInterval(esperarPC);
  try{ pararOfertas(); pararPaseos(); }catch(e){}
  try{ unidadPC(); }catch(e){ R.push('EXCEPCION: ' + (e && e.stack || e)); fallas++; }
  try{ pintadoPC(); }catch(e){ R.push('EXCEPCION: ' + (e && e.stack || e)); fallas++; }
  anchosPC(0);
}, 120);
