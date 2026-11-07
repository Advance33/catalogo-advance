// Los precios del viernes (Benja, 07/11/2026): «congelemos los del viernes
// avisando que es probable que el lunes cambien». El sábado no sale lista y
// el fin de semana (y los días que Tecno cierra) ADVAPP manda en el sobre
// precios_congelados = { dia, cambian }. La web lo dice en un renglón abajo
// de la barra: "Precios del viernes 06/11. Es probable que cambien el lunes."
//
// Esos días el sello de arriba dice «Precios del viernes 06/11» (no
// «Actualizado hoy») y el renglón del encabezado «Precios y stock de hoy · Sin
// listas viejas…» pasa a «Precios del viernes · Siguen valiendo hasta la
// próxima lista». El título grande no cambia.
//
// Se prueba: que el dato se lea y se valide, el texto exacto, que se muestre
// sólo con el dato de ADVAPP (nunca con la copia ni sin el dato), el sello y
// el renglón (y que vuelvan solos), que con los datos de hoy diga lo que dice
// ADVAPP, y que a 390 y a 1280 no desborde. Pasa cualquier día: los casos van
// con fechas fijas y lo de hoy se compara con lo que manda ADVAPP.
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
const razonPC = () => [...document.querySelectorAll('#razon-hoy .rz-txt b, #razon-hoy .rz-txt span')].map(x => x.textContent).join(' · ');
const RAZON_DE_SIEMPRE = 'Precios y stock de hoy · Sin listas viejas: se actualizan solos durante el día';

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
    FUENTE = { fuente: 'advapp', manifiesto: { congelados: null } };
    pintarCongelados();
    ok(razonPC() === RAZON_DE_SIEMPRE, 'un día común el encabezado dice lo de siempre', razonPC());
    FUENTE = { fuente: 'advapp', manifiesto: { congelados: VIERNES_LUNES } };
    pintarCongelados();
    ok(vistoPC() && textoPC() === 'Precios del viernes 06/11. Es probable que cambien el lunes.', 'con el dato de ADVAPP se ve el aviso', textoPC());
    ok(razonPC() === 'Precios del viernes · Siguen valiendo hasta la próxima lista', 'el renglón del encabezado dice de qué día son los precios', razonPC());
    ok(/hoy\.[\s\S]*hoy\./i.test(document.querySelector('.titulo-h').textContent), 'el título grande queda como está', document.querySelector('.titulo-h').textContent);
    const [ts, vivo] = textoDelSello();
    ok(ts === 'Precios del viernes 06/11' && vivo === false, 'el sello dice «Precios del viernes 06/11», en ámbar y sin latir', ts + ' · ' + vivo);
    FUENTE = { fuente: 'advapp', manifiesto: { congelados: { dia: '2026-11-05', cambian: '2026-11-09' }, verificado_hoy: true, generado_en: new Date().toISOString() } };
    pintarCongelados();
    ok(textoDelSello()[0] === 'Precios del jueves 05/11' && razonPC().startsWith('Precios del jueves · '), 'si la lista vigente es la del jueves, dice el jueves (aunque ADVAPP haya cargado hoy)', textoDelSello()[0]);
    FUENTE = { fuente: 'advapp', manifiesto: { congelados: null, verificado_hoy: true, generado_en: new Date().toISOString() } };
    pintarCongelados();
    ok(!vistoPC(), 'sin el dato (un día común) no se ve');
    ok(razonPC() === RAZON_DE_SIEMPRE && textoDelSello()[0] === 'Actualizado hoy', 'y el encabezado y el sello vuelven a lo de siempre', razonPC() + ' · ' + textoDelSello()[0]);
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
  ok(c ? razonPC().startsWith('Precios del ') : razonPC() === RAZON_DE_SIEMPRE, 'y el encabezado también', razonPC());
  const el = document.getElementById('aviso-congelados');
  ok(el.getAttribute('role') === 'note', 'es una nota, no un aviso que se lee en voz alta en cada refresco');
  const fr = document.getElementById('franja');
  ok(document.querySelector('.topbar').nextElementSibling === fr && fr.nextElementSibling === el
     && el.nextElementSibling === document.querySelector('header'),
     'va entre la franja de la copia y el encabezado (la franja sigue pegada a la barra)');
}

/* Las páginas de producto (producto/…) dicen lo mismo, abajo del recuadro del
   precio. De punta a punta: una página de verdad, con los productos de hoy de
   ADVAPP más precios_congelados, servidos desde un blob (no sale nada a
   producción: estas páginas no miden). */
async function productoPC(){
  const indice = await (await fetch('producto/index.html', { cache: 'no-store' })).text();
  const slug = (/href="([a-z0-9-]+)\/"/.exec(indice) || [])[1];
  ok(!!slug, 'hay páginas de producto para probar', slug);
  if(!slug) return;
  const pag = await (await fetch('producto/' + slug + '/', { cache: 'no-store' })).text();
  ok(pag.includes('<p class="congelado" id="congelado" hidden></p>') && pag.includes('j.precios_congelados'),
     'la página trae el renglón (escondido) y el código que lo llena', slug);
  const datos = JSON.parse((/<script id="datos" type="application\/json">([\s\S]*?)<\/script>/.exec(pag) || [])[1] || '{}');
  const real = await (await fetch(ADVAPP_URL, { cache: 'no-store' })).json();
  const probar = async (congelados) => {
    const blob = URL.createObjectURL(new Blob([JSON.stringify({ ...real, precios_congelados: congelados })], { type: 'application/json' }));
    const html = pag.replace('<head>', '<head><base href="' + location.origin + '/producto/' + slug + '/">')
                    .split(JSON.stringify(datos.advapp).slice(1, -1)).join(blob);
    const f = document.createElement('iframe');
    f.style.cssText = 'width:390px;height:700px;border:0;position:absolute;left:-9999px';
    f.srcdoc = html;
    document.body.appendChild(f);
    await new Promise(r => { f.onload = r; });
    let el = null;
    for(let n = 0; n < 40; n++){
      await new Promise(r => setTimeout(r, 150));
      el = f.contentDocument.getElementById('congelado');
      if(congelados ? el && !el.hidden : f.contentDocument.getElementById('precio').textContent.trim() !== 'Consultá el precio') break;
    }
    const d = f.contentDocument, out = { visto: !!el && !el.hidden, texto: el ? el.textContent : '', ancho: d.documentElement.scrollWidth, cw: d.documentElement.clientWidth };
    f.remove(); URL.revokeObjectURL(blob);
    return out;
  };
  const con = await probar(VIERNES_MIERCOLES);
  ok(con.visto && con.texto === 'Precios del viernes 06/11. Es probable que cambien el miércoles.',
     'con precios_congelados la página de producto lo dice, con las mismas palabras', con.texto);
  ok(con.ancho <= con.cw, '390px: la página de producto no desborda', con.ancho + ' vs ' + con.cw);
  const sin = await probar(null);
  ok(!sin.visto, 'sin el dato no se ve', sin.texto);
}

// A 390 (el celular, en un iframe: el headless no baja de ~500) y a 1280.
const ANCHOS_PC = [390, 1280];
function anchosPC(i){
  if(i >= ANCHOS_PC.length){
    productoPC().catch(e => { R.push('EXCEPCION producto/: ' + (e && e.stack || e)); fallas++; }).then(reportarPC);
    return;
  }
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
        win.eval("FUENTE = { fuente: 'advapp', manifiesto: { congelados: { dia: '2026-11-06', cambian: '2026-11-11' } } }; pintarCongelados(); sello(...textoDelSello());");
        const d = f.contentDocument, av = d.getElementById('aviso-congelados');
        const r = av.getBoundingClientRect(), p = d.getElementById('aviso-congelados-txt').getBoundingClientRect();
        const ancho = d.documentElement.clientWidth;
        ok(ancho === w, `${w}px: el iframe mide lo que tiene que medir (sin barra)`, ancho);
        ok(r.height > 20 && r.width <= w + 0.5, `${w}px: el aviso se ve y entra a lo ancho`, `${Math.round(r.width)}x${Math.round(r.height)}`);
        ok(p.right <= w + 0.5, `${w}px: el texto no se sale`, Math.round(p.right));
        ok(d.documentElement.scrollWidth <= ancho, `${w}px: sin desborde horizontal en la página`, d.documentElement.scrollWidth + ' vs ' + ancho);
        const top = d.querySelector('.topbar').getBoundingClientRect(), head = d.querySelector('header').getBoundingClientRect();
        ok(r.top >= top.bottom - 1 && r.bottom <= head.top + 1, `${w}px: va entre la barra de arriba y el encabezado`);
        const st = d.querySelector('.stamp').getBoundingClientRect(), tb = d.querySelector('.topbar');
        ok(d.getElementById('stamp').textContent === 'Precios del viernes 06/11' && st.right <= w + 0.5 && st.left >= 0 && tb.scrollWidth <= tb.clientWidth + 1,
           `${w}px: el sello «Precios del viernes 06/11» entra en la barra`, `${Math.round(st.left)}-${Math.round(st.right)}, barra ${tb.scrollWidth}/${tb.clientWidth}`);
        const rz = d.getElementById('razon-hoy').getBoundingClientRect();
        ok(rz.right <= w + 0.5, `${w}px: el renglón del encabezado entra`, Math.round(rz.right));
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
