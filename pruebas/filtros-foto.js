// Los filtros de foto del 04/11/2026 (Benja, con el panel Filtrar abierto en
// "Accesorios Cámara": "acá estaría bueno que puedan filtrar monturas y
// demás"). Lo que se suma a FILTROS_RUBRO:
//   [1] en Cámaras, "Montura": la del cuerpo, del nombre del modelo
//       (monturaDelCuerpo); las compactas y las instantáneas no tienen
//   [2] en Accesorios Cámara, "Para cámaras" (la marca: del SKU, del "para
//       Canon" del nombre o de la línea, LP-E, EN-EL, NP-FZ…)
//   [3] y "Tipo de accesorio" (Baterías, Flashes, Grips…), del nombre
// Cada opción se cuenta acá por otro camino (el SKU o el nombre, a mano, sin
// pasar por rasgosDe). Y que funcionen como los de siempre:
//   [4] el panel: los grupos en su rubro y solo ahí, cada chip con su cuenta
//       y sin chips en 0, y "Ver N productos" dice lo que queda
//   [5] se combinan con Precio y Stock (la misma versión cumple todo)
//   [6] "Limpiar" los saca
//   [7] lo elegido se ve arriba con su cruz ("Para Sony", "Sony E"), el
//       boton Filtrar lo cuenta, viaja en el link y la cruz lo saca
//   [8] el Atrás cierra Filtrar y deja lo elegido
//   [9] el link ?para=, ?accesorio= y ?bayoneta= abre lo que dice; un valor
//       inventado se descarta, y al irse del rubro o al inicio se sueltan
//  [10] dos que no se cruzan: el vacio lo dice y ofrece la salida
//  [11] a 390 y a 1280 px el panel entra en la pantalla, sin nada cortado
// Lo que queda sin dato (sin montura siendo de objetivo intercambiable, sin
// marca de cámara, sin tipo) se lista como "--" con su ID: es lo que hay que
// mirar en ADVAPP. No es una falla: un micrófono inalámbrico sirve para
// cualquier cámara y no tiene por qué tener marca.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);
const ffDormir = ms => new Promise(r => setTimeout(r, ms));
const $$ = s => document.querySelectorAll(s);

const esperaFF = setInterval(() => {
  if(!MODELOS.length || !$$('#cats .chip').length) return;
  clearInterval(esperaFF);
  (async () => {
    try{ await ffPruebas(); }catch(e){ R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; }
    try{ pararPaseos(); pararOfertas(); pararNuevos(); pararMarcas(); pararMundos(); }catch(e){}
    for(let i=1;i<5000;i++) clearInterval(i);
    const pre=document.createElement('pre'); pre.id='RESULTADO';
    pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
    document.body.appendChild(pre);
  })();
}, 150);

const ffLimpiar = () => Object.assign(filtros, { q:'', marca:'', rango:'', capacidad:'', ram:'', montura:'', apertura:'',
                                                 soloStock:false, orden:'modelo', ...SIN_PROPIOS });
const ffPanel = () => document.getElementById('filtros-panel');
const ffCab = () => document.getElementById('rubro-cab');
const ffTramo = v => String(v.skuVariante || '').toUpperCase().split('-').pop();
const ffBloque = v => String(v.skuVariante || '').toUpperCase().split('-')[1] || '';
const ffId = v => v.id || v.skuVariante || v.desc;
// Los grupos del panel abierto: { titulo: [[valor, numero], ...] }
const ffGrupos = () => Object.fromEntries([...ffPanel().querySelectorAll('.mf-grupo')].map(g =>
  [g.querySelector('.mf-rot').textContent, [...g.querySelectorAll('.op-chip')].map(b =>
    [b.dataset.v ?? 'stock', Number(b.querySelector('i').textContent), b])]));
const ffVer = () => Number((ffPanel().querySelector('.mf-pie .pri').textContent.match(/\d+/) || [NaN])[0]);

/* Lo que tiene que traer cada opción, dicho por otro camino que rasgosDe:
   en Cámaras el nombre del modelo con reglas escritas de nuevo; en los
   accesorios, la marca por el SKU (el final si la dice, si no su segundo
   bloque) o por el "para Canon" del nombre, y el tipo por las palabras del
   nombre. Un accesorio cuya marca este camino no sabe (null: el SKU no la
   trae y el nombre no dice "para") no se compara: lo mira la regla de la
   línea, más arriba. Si algún día no coinciden es que el SKU, el nombre o la
   regla de la página dicen otra cosa: se mira. */
const FF_SKU = { CAN: 'canon', NIK: 'nikon', SON: 'sony', FUJ: 'fujifilm', GPR: 'gopro' };
const ffPara = v => {
  const dicho = (/\bpara (Canon|Nikon|Sony|Fujifilm|GoPro)\b/i.exec(v.desc) || [])[1];
  const m = FF_SKU[ffTramo(v)] || (dicho ? dicho.toLowerCase() : '') || FF_SKU[ffBloque(v)] || null;
  return m === 'fujifilm' && /\binstax mini\b/i.test(v.desc) ? 'instax-mini' : m;
};
const FF_REGLA = {
  'Cámara|bayoneta|canon-rf':   v => /canon/i.test(v.marca) && /\bEOS R/i.test(v.desc),
  'Cámara|bayoneta|canon-ef':   v => /canon/i.test(v.marca) && /\bEOS \d{1,4}D\b/i.test(v.desc),
  'Cámara|bayoneta|canon-ef-m': v => /canon/i.test(v.marca) && /\bEOS M\d/i.test(v.desc),
  'Cámara|bayoneta|nikon-z':    v => /nikon/i.test(v.marca) && /^(?:Nikon\s+)?Z/i.test(v.desc),
  'Cámara|bayoneta|nikon-f':    v => /nikon/i.test(v.marca) && /^(?:Nikon\s+)?D\d/i.test(v.desc),
  'Cámara|bayoneta|sony-e':     v => /sony/i.test(v.marca) && /\b(?:Alfa|Alpha) (?:[179]\b|[179][A-Z]|\d{4}\b)|\bZV-E|\bFX\d/i.test(v.desc),
  'Cámara|bayoneta|fujifilm-x': v => /fujifilm/i.test(v.marca) && /\bX-(?:T|S|H|E|M|A|Pro)\d/i.test(v.desc),
  'Accesorio Cámara|accesorio|baterias':   v => (/^Bater[ií]a\b/i.test(v.desc) && !/^Bater[ií]a (?:Grip|Cargador)\b/i.test(v.desc)) || /bater/i.test(v.incluye || ''),
  'Accesorio Cámara|accesorio|cargadores': v => /\bCargador\b/i.test(v.desc),
  'Accesorio Cámara|accesorio|flashes':    v => /\bFlash\b/i.test(v.desc),
  'Accesorio Cámara|accesorio|grips':      v => /\bGrip\b/i.test(v.desc),
  'Accesorio Cámara|accesorio|adaptadores':v => /\badaptador|\badapter\b/i.test(v.desc),
  'Accesorio Cámara|accesorio|microfonos': v => /\bmicr[oó]fono/i.test(v.desc),
  'Accesorio Cámara|accesorio|remotos':    v => /\bcontrol remoto|\bdisparador/i.test(v.desc),
  'Accesorio Cámara|accesorio|memorias':   v => /\bmemoria\b|\bXQD\b|\bCFexpress\b/i.test(v.desc),
  'Accesorio Cámara|accesorio|peliculas':  v => /\bpel[ií]cula|\brollo/i.test(v.desc),
  'Accesorio Cámara|accesorio|estabilizadores': v => /\bOsmo Mobile\b|\bgimbal\b|\bestabilizador/i.test(v.desc),
};
['canon', 'nikon', 'sony', 'gopro', 'fujifilm', 'instax-mini'].forEach(m => { FF_REGLA['Accesorio Cámara|para|' + m] = v => ffPara(v) === null ? null : ffPara(v) === m; });

async function ffPruebas(){
  document.documentElement.style.scrollBehavior = 'auto';
  const nuevos = FILTROS_RUBRO.filter(f => ['bayoneta', 'para', 'accesorio'].includes(f.campo));
  ok(nuevos.length === 3 && nuevos.every(f => f.opciones.length), 'los tres filtros nuevos estan en FILTROS_RUBRO', nuevos.map(f => f.rubro + ' ' + f.titulo).join(' · '));

  /* ---- [1] La montura del cuerpo, del nombre ---- */
  const casos = [['Canon', 'EOS R10 Body', 'Canon RF'], ['Canon', 'Canon EOS R50 V Kit 14-30', 'Canon RF'],
                 ['Canon', 'EOS 2000D Kit 18-55 III (T7)', 'Canon EF'], ['Canon', 'EOS 5D Mark IV Body', 'Canon EF'],
                 ['Canon', 'EOS M50 Mark II', 'Canon EF-M'], ['Canon', 'PowerShot G7 X Mark III', ''],
                 ['Nikon', 'Z30 Kit 16-50 mm', 'Nikon Z'], ['Nikon', 'ZR 6K Cinema Body', 'Nikon Z'], ['Nikon', 'D7500 Kit 18-140', 'Nikon F'],
                 ['Sony', 'Alfa 7 IV Body', 'Sony E'], ['Sony', 'Alfa 6400 Kit 16-50 II', 'Sony E'], ['Sony', 'FX3 Body', 'Sony E'],
                 ['Sony', 'ZV-E10 II Body', 'Sony E'], ['Sony', 'DSC RX100 VII', ''], ['Sony', 'Alfa 99 II', ''],
                 ['Fujifilm', 'Fujifilm X-T5 Kit 16-50 (Black)', 'Fujifilm X'], ['Fujifilm', 'X100VI', ''],
                 ['Fujifilm', 'GFX100S II', 'Fujifilm G'], ['Fujifilm', 'Instax Mini 12', ''],
                 ['Panasonic', 'Lumix S5 II', 'L-Mount'], ['Panasonic', 'Lumix GH7', 'Micro 4/3']];
  const malCaso = casos.filter(([marca, desc, esp]) => monturaDelCuerpo({ cat: 'Cámara', marca, desc }) !== esp);
  ok(!malCaso.length, '[1] la montura de cada cuerpo sale bien del nombre (compactas, X100, instantaneas y la Alfa 99 de montura A, ninguna)',
     malCaso.map(([m, d]) => d + ' -> ' + (monturaDelCuerpo({ cat: 'Cámara', marca: m, desc: d }) || 'ninguna')).join(' | ') || casos.length + ' casos');
  ok(monturasDelCuerpo({ cat: 'Cámara', marca: 'Canon', desc: 'EOS 2000D Kit 18-55 III (T7)' }).join() === 'Canon EF-S,Canon EF'
     && monturasDelCuerpo({ cat: 'Cámara', marca: 'Canon', desc: 'EOS R10 Body' }).join() === 'Canon RF,Canon RF-S',
     '[1] y los lentes que le entran siguen igual (los de "Te puede servir": a un 2000D, EF-S y EF)');
  ok(monturaDelCuerpo({ cat: 'Objetivo', marca: 'Sony', desc: 'FE 50mm F1.8' }) === '', '[1] fuera de Cámaras no hay montura de cuerpo');
  // Ninguna camara de objetivo intercambiable sin montura; ninguna compacta con una
  const camaras = PRODUCTOS.filter(p => p.cat === 'Cámara');
  const intercambiable = p => p.rasgos.tipo.some(t => t === 'sin-espejo' || t === 'reflex');
  const sinMontura = camaras.filter(p => intercambiable(p) && !p.rasgos.bayoneta.length);
  if(sinMontura.length) info('[1] de objetivo intercambiable y sin montura (mirar en ADVAPP o sumar la regla): ' +
                             sinMontura.map(p => ffId(p) + ' ' + p.desc).join(' | '));
  else ok(camaras.filter(intercambiable).length > 0, '[1] toda camara de objetivo intercambiable tiene montura', camaras.filter(intercambiable).length + ' filas');
  const fijaCon = camaras.filter(p => p.rasgos.tipo.some(t => t === 'compacta' || t === 'instantanea') && p.rasgos.bayoneta.length);
  ok(!fijaCon.length, '[1] y ninguna compacta ni instantanea tiene montura', fijaCon.map(p => ffId(p) + ' ' + p.desc).join(' | ') || 'ninguna');
  ok(!PRODUCTOS.some(p => p.cat !== 'Cámara' && (p.rasgos.bayoneta || []).length), '[1] la montura del cuerpo es solo de las camaras');

  /* ---- [2] y [3] Los accesorios: para que camaras y que son ---- */
  const acc = PRODUCTOS.filter(p => p.cat === 'Accesorio Cámara');
  if(!acc.length) info('[2] hoy no hay ningun accesorio de camara en ADVAPP');
  else{
    const sinPara = acc.filter(p => !p.rasgos.para.length), sinTipo = acc.filter(p => !p.rasgos.accesorio.length);
    info('[2] sin marca de camara (' + sinPara.length + ' de ' + acc.length + '): ' + (sinPara.map(p => ffId(p) + ' ' + p.desc).join(' | ') || 'ninguno'));
    info('[3] sin tipo (' + sinTipo.length + ' de ' + acc.length + '): ' + (sinTipo.map(p => ffId(p) + ' ' + p.desc).join(' | ') || 'ninguno'));
    // La línea dice la marca: una LP-E de Canon nunca puede ir a Sony
    const LINEA = [[/\bLP-?E\d/i, 'canon'], [/\bEN-?EL\s?\d/i, 'nikon'], [/\bNP-?F[ZW]\d|\bF[ZW]-?\d{2,3}\b/i, 'sony']];
    const contra = acc.filter(p => LINEA.some(([re, m]) => re.test(p.desc) && p.rasgos.para.length && !p.rasgos.para.includes(m)));
    ok(!contra.length, '[2] la bateria de una linea (LP-E, EN-EL, NP-FZ, FW-50) va con su marca de camara',
       contra.map(p => ffId(p) + ' ' + p.desc + ' -> ' + p.rasgos.para.join(',')).join(' | ') || 'todas');
    ok(!acc.some(p => /\bosmo mobile\b/i.test(p.desc) && p.rasgos.para.length), '[2] el Osmo Mobile (para el celular) no se ofrece como accesorio de camaras DJI');
    const gripBat = acc.filter(p => /\bgrip\b/i.test(p.desc) && p.rasgos.accesorio.includes('baterias'));
    ok(!gripBat.length, '[3] un "Bateria Grip" es un grip y no una bateria', gripBat.map(p => p.desc).join(' | ') || 'ninguno');
    const kit = acc.filter(p => /\d\s*Bater[ií]as\s*\+\s*Cargador/i.test(p.desc));
    ok(kit.every(p => p.rasgos.accesorio.includes('baterias') && p.rasgos.accesorio.includes('cargadores')),
       '[3] un kit "2 Baterias + Cargador" esta en las dos', kit.map(p => p.desc).join(' | ') || 'hoy no hay kits');
    ok(!acc.some(p => /fujifilm/i.test(p.desc) && !/pel[ií]cula|film\b|rollo/i.test(p.desc) && p.rasgos.accesorio.includes('peliculas')),
       '[3] "Fujifilm" no se lee como "film"');
  }
  ok(!PRODUCTOS.some(p => p.cat !== 'Accesorio Cámara' && ((p.rasgos.para || []).length || (p.rasgos.accesorio || []).length)),
     '[2] para que camaras y el tipo son solo de los accesorios de camara');

  // Cada opción trae justo lo que dice, contada por el SKU y el nombre
  const malCuenta = [], vacias = [];
  let probadas = 0;
  for(const f of nuevos){
    if(!MODELOS.some(m => m.cat === f.rubro)){ info('[4] hoy no hay ' + plural(f.rubro)); continue; }
    for(const [v, t] of f.opciones){
      ffLimpiar(); entrarAlRubro(f.rubro);
      filtros[f.campo] = v; aplicarFiltro(false);
      if(!LISTA.length){ vacias.push(t); continue; }
      const regla = FF_REGLA[f.rubro + '|' + f.campo + '|' + v];
      if(!regla){ info('[4] ' + f.rubro + ' ' + t + ': sin regla aparte para contarla (' + LISTA.length + ')'); continue; }
      probadas++;
      // Lo que este camino no sabe (null) queda afuera de las dos cuentas
      const sabe = m => m.variantes.every(x => regla(x) !== null);
      const debe = MODELOS.filter(m => m.cat === f.rubro && sabe(m) && m.variantes.some(regla));
      const dio = filtrar().filter(sabe);
      const sobran = dio.filter(m => !debe.includes(m)), faltan = debe.filter(m => !dio.includes(m));
      if(sobran.length || faltan.length) malCuenta.push(`${f.rubro} ${t}: sobran ${sobran.map(m => m.desc).slice(0, 3).join(', ') || 0} · faltan ${faltan.map(m => m.desc).slice(0, 3).join(', ') || 0}`);
    }
  }
  ok(probadas > 0 && !malCuenta.length, '[2] [3] cada opcion trae justo lo que dice, contado aca por el SKU y el nombre',
     malCuenta.join(' | ') || probadas + ' opciones');
  if(vacias.length) info('[4] hoy sin productos (el panel no las ofrece): ' + vacias.join(', '));

  /* ---- [4] El panel ---- */
  const abrir = cat => { ffLimpiar(); entrarAlRubro(cat); ffCab().querySelector('.filtrar-btn').click(); return ffGrupos(); };
  const cerrar = () => ffPanel()?.querySelector('.mf-cerrar').click();
  const titulos = {};
  for(const cat of ['Cámara', 'Accesorio Cámara', 'Objetivo', 'Celular', 'Drone', 'Filmadora', 'Accesorio Drone']){
    if(!MODELOS.some(m => m.cat === cat)) continue;
    titulos[cat] = Object.keys(abrir(cat)); cerrar();
  }
  if(titulos['Cámara'])
    ok(titulos['Cámara'].includes('Montura') && titulos['Cámara'].indexOf('Montura') < titulos['Cámara'].indexOf('Tipo de cámara'),
       '[4] en Camaras, "Montura" antes de "Tipo de cámara"', titulos['Cámara'].join(' · '));
  if(titulos['Accesorio Cámara']){
    const t = titulos['Accesorio Cámara'];
    ok(t[0] === 'Precio' && t.includes('Para cámaras') && t.includes('Tipo de accesorio') && t[t.length - 1] === 'Stock',
       '[4] en Accesorios Camara, Precio, "Para cámaras", "Tipo de accesorio" y Stock', t.join(' · '));
  }
  if(titulos['Objetivo'])
    ok(titulos['Objetivo'].filter(x => x === 'Montura').length === 1, '[4] en Objetivos sigue una sola "Montura" (la del lente)', titulos['Objetivo'].join(' · '));
  const ajenos = Object.entries(titulos).filter(([cat, t]) =>
    nuevos.some(f => f.rubro !== cat && t.includes(f.titulo) && !(cat === 'Objetivo' && f.titulo === 'Montura')));
  ok(!ajenos.length, '[4] y en Celulares, Drones, Filmadoras y Accesorios Drone ninguno de los nuevos',
     ajenos.map(([c, t]) => c + ': ' + t.join(' · ')).join(' | ') || Object.keys(titulos).join(', '));

  // Cada chip dice cuántos quedan si se lo toca, y "Ver N" dice lo que queda
  const malChip = [];
  for(const cat of ['Cámara', 'Accesorio Cámara']){
    if(!titulos[cat]) continue;
    const g = abrir(cat);
    for(const tit of ['Montura', 'Para cámaras', 'Tipo de accesorio']){
      for(const [v, n] of (g[tit] || [])){
        if(n === 0) malChip.push(cat + ' ' + tit + ' ' + v + ': en 0');
        const b = ffPanel().querySelector(`[data-campo][data-v="${CSS.escape(v)}"]`);
        const campo = b.dataset.campo;
        b.click();
        if(LISTA.length !== n || ffVer() !== n) malChip.push(`${cat} ${v}: el chip decia ${n}, quedaron ${LISTA.length}, "Ver" dice ${ffVer()}`);
        ffPanel().querySelector(`[data-campo="${campo}"][data-v="${CSS.escape(v)}"]`).click();   // se saca
      }
    }
    cerrar();
  }
  ok(!malChip.length, '[4] cada chip nuevo dice cuantos quedan al tocarlo, ninguno en 0, y "Ver N productos" dice lo mismo',
     malChip.slice(0, 4).join(' | ') || 'todos');

  /* ---- [5] Con Precio y Stock ---- */
  if(titulos['Accesorio Cámara']){
    const g = abrir('Accesorio Cámara');
    const [para] = (g['Para cámaras'] || []).slice().sort((a, b) => b[1] - a[1])[0] || [];
    if(!para) info('[5] hoy ningun accesorio tiene marca de camara');
    else{
      ffPanel().querySelector(`[data-campo="para"][data-v="${para}"]`).click();
      const tramo = (ffGrupos()['Precio'] || [])[0];
      if(tramo) ffPanel().querySelector(`[data-campo="rango"][data-v="${tramo[0]}"]`).click();
      ffPanel().querySelector('[data-stock]').click();
      const r = RANGOS.find(x => x[0] === filtros.rango);
      // La misma versión tiene que cumplir las tres cosas
      const debe = MODELOS.filter(m => m.cat === 'Accesorio Cámara' &&
        m.variantes.some(v => v.stock && tieneRasgo(v, 'para', para) && (!r || enTramo(v.precio, r))));
      const dio = filtrar();
      ok(filtros.para === para && filtros.soloStock && dio.length === debe.length && dio.every(m => debe.includes(m)),
         '[5] "Para cámaras" se combina con Precio y Stock: la misma version cumple todo', `para ${para}, ${filtros.rango || 'sin precio'}, con stock: ${dio.length} / ${debe.length}`);
      ok(ffVer() === LISTA.length, '[5] y "Ver N productos" lo cuenta', ffVer() + ' / ' + LISTA.length);
      /* ---- [6] Limpiar ---- */
      ffPanel().querySelector('[data-limpiar]').click();
      ok(!filtros.para && !filtros.accesorio && !filtros.rango && !filtros.soloStock &&
         LISTA.length === MODELOS.filter(m => m.cat === 'Accesorio Cámara').length,
         '[6] "Limpiar" saca la marca de camara, el precio y el stock', LISTA.length + ' productos');
    }
    cerrar();
  }

  /* ---- [7] La cruz de arriba, el boton y el link ---- */
  const conDos = (() => {
    const p = PRODUCTOS.find(x => x.cat === 'Accesorio Cámara' && x.rasgos.para.length && x.rasgos.accesorio.length);
    return p ? [p.rasgos.para[0], p.rasgos.accesorio[0]] : null;
  })();
  if(!conDos) info('[7] hoy no hay un accesorio con marca y tipo');
  else{
    ffLimpiar(); entrarAlRubro('Accesorio Cámara');
    filtros.para = conDos[0]; filtros.accesorio = conDos[1]; aplicarFiltro(true);
    const cruzP = ffCab().querySelector('[data-quitar="para"]'), cruzA = ffCab().querySelector('[data-quitar="accesorio"]');
    ok(!!cruzP && cruzP.textContent === 'Para ' + textoPropio('para', conDos[0]) && !!cruzA && cruzA.textContent === textoPropio('accesorio', conDos[1]),
       '[7] lo elegido se ve arriba con su cruz ("Para …" y el tipo)', (cruzP && cruzP.textContent) + ' · ' + (cruzA && cruzA.textContent));
    ok(/\b2\b/.test(ffCab().querySelector('.filtrar-btn b')?.textContent || ''), '[7] el boton Filtrar cuenta los dos', ffCab().querySelector('.filtrar-btn').textContent);
    const s = new URLSearchParams(location.search);
    ok(s.get('para') === conDos[0] && s.get('accesorio') === conDos[1], '[7] y viajan en el link', location.search);
    cruzP && cruzP.click();
    ok(!filtros.para && filtros.accesorio === conDos[1] && !new URLSearchParams(location.search).get('para'),
       '[7] la cruz saca solo ese', location.search);
  }
  const bay = PRODUCTOS.find(p => p.cat === 'Cámara' && p.rasgos.bayoneta.length);
  if(bay){
    ffLimpiar(); entrarAlRubro('Cámara');
    filtros.bayoneta = bay.rasgos.bayoneta[0]; aplicarFiltro(true);
    const cruz = ffCab().querySelector('[data-quitar="bayoneta"]');
    ok(!!cruz && cruz.textContent === textoPropio('bayoneta', bay.rasgos.bayoneta[0]) &&
       new URLSearchParams(location.search).get('bayoneta') === bay.rasgos.bayoneta[0],
       '[7] en Camaras la montura elegida se ve arriba ("Sony E", como en Objetivos) y va en el link', (cruz && cruz.textContent) + ' · ' + location.search);
    cruz && cruz.click();
    ok(!filtros.bayoneta, '[7] y su cruz la saca');
  }

  /* ---- [8] El Atrás cierra Filtrar y deja lo elegido ---- */
  if(titulos['Accesorio Cámara']){
    ffLimpiar(); history.replaceState(null, '', location.pathname);
    entrarAlRubro('Accesorio Cámara');
    await ffDormir(60);
    ffCab().querySelector('.filtrar-btn').click();
    await ffDormir(60);
    const chip = ffPanel()?.querySelector('[data-campo="accesorio"], [data-campo="para"]');
    if(!chip) info('[8] hoy el panel no ofrece ninguno de los nuevos');
    else{
      const campo = chip.dataset.campo, v = chip.dataset.v;
      chip.click();
      await ffDormir(60);
      history.back();
      await ffDormir(400);
      ok(!ffPanel() && filtros.cat === 'Accesorio Cámara' && filtros[campo] === v,
         '[8] el Atras cierra Filtrar y deja el rubro y lo elegido', 'panel ' + !!ffPanel() + ' · ' + campo + '=' + filtros[campo]);
      ok(new URLSearchParams(location.search).get(campo) === v, '[8] y la direccion lo dice', location.search);
    }
  }

  /* ---- [9] El link, el valor inventado y la salida del rubro ---- */
  if(conDos){
    ffLimpiar();
    history.replaceState(null, '', location.pathname + '?cat=' + encodeURIComponent('Accesorio Cámara') + '&para=' + conDos[0] + '&accesorio=' + conDos[1]);
    leerURL(); aplicarFiltro(false);
    ok(filtros.cat === 'Accesorio Cámara' && filtros.para === conDos[0] && filtros.accesorio === conDos[1] && LISTA.length > 0 &&
       LISTA.every(m => m.variantes.some(v => tieneRasgo(v, 'para', conDos[0]) && tieneRasgo(v, 'accesorio', conDos[1]))),
       '[9] el link ?para=&accesorio= abre el rubro con los dos puestos', location.search + ' · ' + LISTA.length);
    filtros.para = 'cualquiercosa'; aplicarFiltro(false);
    ok(!filtros.para && LISTA.length > 0, '[9] un valor que no existe (?para=cualquiercosa) se descarta: la grilla no queda vacia', LISTA.length + ' productos');
    filtros.para = conDos[0]; filtros.bayoneta = 'sony-e'; aplicarFiltro(false);
    ok(!filtros.bayoneta, '[9] la montura de camaras no vale en Accesorios');
    entrarAlRubro('Cámara');
    ok(!filtros.para && !filtros.accesorio, '[9] al pasar a Camaras se sueltan la marca y el tipo del accesorio', location.search);
    if(bay){
      filtros.bayoneta = bay.rasgos.bayoneta[0]; aplicarFiltro(false);
      entrarAlRubro('Objetivo');
      ok(!filtros.bayoneta && !filtros.montura, '[9] y la montura de la camara no pasa a Objetivos', location.search);
    }
    filtros.cat = 'Accesorio Cámara'; filtros.para = conDos[0]; aplicarFiltro(false);
    irAlInicio();
    ok(enPortada() && !filtros.para && !filtros.accesorio && !filtros.bayoneta, '[9] y el inicio los saca');
  }

  /* ---- [10] Dos que no se cruzan ---- */
  {
    ffLimpiar(); entrarAlRubro('Accesorio Cámara');
    const g = abrir('Accesorio Cámara'); cerrar();
    const paras = (g['Para cámaras'] || []).map(x => x[0]), tipos = (g['Tipo de accesorio'] || []).map(x => x[0]);
    let par = null;
    for(const p of paras) for(const t of tipos)
      if(!par && !MODELOS.some(m => m.cat === 'Accesorio Cámara' && m.variantes.some(v => tieneRasgo(v, 'para', p) && tieneRasgo(v, 'accesorio', t)))) par = [p, t];
    if(!par) info('[10] hoy toda marca tiene de todos los tipos');
    else{
      filtros.para = par[0]; filtros.accesorio = par[1]; aplicarFiltro(false);
      const vacio = document.querySelector('#grid .vacio');
      const txt = vacio ? vacio.textContent.replace(/\s+/g, ' ').trim() : '';
      ok(!LISTA.length && !!vacio && txt.includes('para cámaras ' + textoPropio('para', par[0])) && !!vacio.querySelector('[data-salida]'),
         '[10] dos que no se cruzan: el vacio dice "para cámaras …" y ofrece sacar uno', txt.slice(0, 120));
    }
    ffLimpiar(); aplicarFiltro(false);
  }

  /* ---- [11] El panel a 390 y a 1280 px ---- */
  for(const [w, h] of [[390, 844], [1280, 900]]){
    const f = document.createElement('iframe');
    f.style.cssText = `width:${w}px;height:${h}px;border:0;position:absolute;left:-9999px;top:0`;
    f.src = 'index.html?cat=' + encodeURIComponent('Accesorio Cámara');
    document.body.appendChild(f);
    let W = null;
    for(let i = 0; i < 160; i++){
      await ffDormir(150);
      try{ if(f.contentWindow.eval('typeof MODELOS !== "undefined" && MODELOS.length > 0 && !!document.querySelector("#rubro-cab .filtrar-btn")')){ W = f.contentWindow; break; } }catch(e){}
    }
    if(!W){ ok(false, '[11] el iframe de ' + w + ' px llega a cargar'); f.remove(); continue; }
    try{ W.eval('pararPaseos(); pararOfertas(); pararNuevos(); pararMarcas(); pararMundos();'); }catch(e){}
    W.eval('abrirFiltros()');
    await ffDormir(400);
    const d = f.contentDocument;
    // Se mide donde queda: con la entrada del panel a mitad, la caja esta corrida
    for(const a of (d.getAnimations ? d.getAnimations() : [])){ try{ a.finish(); }catch(e){} }
    const caja = d.querySelector('#filtros-panel .caja');
    const rc = caja.getBoundingClientRect();
    const chips = [...caja.querySelectorAll('.op-chip')];
    const fuera = chips.filter(b => { const r = b.getBoundingClientRect(); return r.left < rc.left - 1 || r.right > rc.right + 1 || b.scrollWidth > b.clientWidth + 1; });
    const ver = caja.querySelector('.mf-pie .pri').getBoundingClientRect();
    const grupos = [...caja.querySelectorAll('.mf-rot')].map(x => x.textContent);
    ok(rc.left >= -1 && rc.right <= w + 1 && rc.bottom <= h + 1 && d.documentElement.scrollWidth <= w,
       `[11] a ${w} px el panel entra en la pantalla`, `${Math.round(rc.left)}-${Math.round(rc.right)} x ${Math.round(rc.top)}-${Math.round(rc.bottom)}`);
    ok(grupos.includes('Para cámaras') && grupos.includes('Tipo de accesorio') && !fuera.length,
       `[11] a ${w} px los chips nuevos entran enteros, sin cortarse`, fuera.map(b => b.textContent).join(', ') || chips.length + ' chips');
    ok(ver.bottom <= h + 1 && ver.top >= rc.top, `[11] a ${w} px "Ver N productos" se ve sin bajar`, Math.round(ver.top) + '-' + Math.round(ver.bottom));
    f.remove();
  }
  ffLimpiar(); history.replaceState(null, '', location.pathname); aplicarFiltro(false);
}
