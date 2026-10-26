// Que cada producto esté escrito como corresponde (Benja, 26/10/2026: "quiero
// formar una estructura donde cada producto que esté en las listas de ADVAPP
// figure en la Landing escrito de forma correcta").
//
// Lo disparó la Sony Alfa 7 IV: el SKU decía BODY y el nombre no, la web la
// ofrecía como versión "Base" y la descripción decía "no está confirmado si
// trae lente"; y la 7R IV mostraba la foto de una 7R III. La auditoría de ese
// día encontró lo mismo en 38 filas (cámaras sin "Body", iPads sin "Wifi",
// consolas sin "Digital") y fotos repetidas entre modelos distintos.
//
// Tres comprobaciones, cada una con el ID de ADVAPP de cada fila, para que lo
// que ya se pidió se anote como conocido (herramientas/fallas-conocidas.py):
//   1. El nombre dice lo que dice el último bloque de su SKU.
//   2. Ninguna versión de un modelo con varias se llama "Base" o "Estándar".
//   3. Una misma foto (fotos/mini/huellas.json) no está en dos modelos que se
//      ven distintos. Los que por fuera son iguales van en PERMITIDAS.
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
  clearInterval(esperar);
  for(let i = 1; i < 5000; i++) clearInterval(i);
  Promise.resolve()
    .then(correrPruebas)
    .catch(e => { R.push('EXCEPCION: ' + (e && e.stack || e)); fallas++; })
    .finally(() => {
      try{ pararPaseos(); }catch(e){}
      try{ pararOfertas(); }catch(e){}
      for(let i = 1; i < 5000; i++) clearInterval(i);
      reportar();
    });
}, 120);

/* ---- 1. Lo que el SKU dice y el nombre tiene que decir ----
   El último bloque de SKU_VARIANTE (CAM-SON-A7IV-000-000-BODY → BODY). Sólo
   estos: son los que separan dos productos que se venden distinto. */
const TRAMOS = [
  { tramo: /^BODY$/, dice: /\b(body|cuerpo)\b/i, falta: 'Body' },
  { tramo: /^WIFI$/, dice: /\bwi-?fi\b/i, falta: 'Wifi' },
  { tramo: /^CELL/, dice: /\b(cell|cellular|celular|5g|lte)\b/i, falta: 'Cellular' },
  { tramo: /^DIG$/, dice: /\bdigital\b/i, falta: 'Digital' },
  { tramo: /^ESIM$/, dice: /\be-?sim\b/i, falta: 'E-Sim' },
  { tramo: /^ANC$/, dice: /\banc\b/i, falta: 'ANC' },
];

/* ---- 3. Fotos iguales que están bien ----
   Equipos que por fuera son iguales y por eso comparten la foto: el mismo
   chasis con otro chip, la misma tablet con otra memoria o conexión, el mismo
   objetivo con otra montura, el mismo dron en otro combo. Cada grupo son
   códigos AT (sin el -NN del color). Una foto compartida fuera de un grupo es
   la de otro modelo (la 7R III en la 7R IV, el Magic Keyboard del iPad Air en
   el del Pro) y falla. Sumar un grupo acá es decir "se ven iguales": mirarlas
   antes. */
const PERMITIDAS = [
  { motivo: 'MacBook Pro 14"/16": el mismo chasis con M4 Pro, M5, M5 Pro o M5 Max',
    codigos: ['AT-0435', 'AT-0438', 'AT-0440', 'AT-0442', 'AT-0443', 'AT-0444', 'AT-0445', 'AT-0446', 'AT-0447', 'AT-0523', 'AT-0532', 'AT-0538', 'AT-0539'] },
  { motivo: 'Mac mini: la misma caja con M4, M4 Pro, M5 Pro o M6',
    codigos: ['AT-0202', 'AT-0203', 'AT-0204', 'AT-0584', 'AT-0585', 'AT-0642'] },
  { motivo: 'iPad Pro 11": M4 y M5, Wifi y Cellular, son iguales por fuera',
    codigos: ['AT-0476', 'AT-0477', 'AT-0478', 'AT-0479', 'AT-0480', 'AT-0540'] },
  { motivo: 'iPad Air 11" M4: la misma tablet en otra memoria o con Cellular', codigos: ['AT-0468', 'AT-0469', 'AT-0470', 'AT-0578'] },
  { motivo: 'iPad Air 13": M3 y M4 son iguales por fuera', codigos: ['AT-0471', 'AT-0472', 'AT-0473'] },
  { motivo: 'iPad 11" A16: Wifi y Cellular son iguales por fuera', codigos: ['AT-0466', 'AT-0467', 'AT-0576', 'AT-0577'] },
  { motivo: 'DJI Mini 5 Pro: el mismo dron, en combos distintos', codigos: ['AT-0208', 'AT-0209', 'AT-0210', 'AT-0211'] },
  { motivo: 'Insta360 X5: la misma cámara, en dos combos', codigos: ['AT-0200', 'AT-0593'] },
  { motivo: 'Nikon Z 12-28mm PZ VR: el mismo objetivo escrito de dos formas', codigos: ['AT-0270', 'AT-0271'] },
  { motivo: 'Sigma 12-24mm F/4 Art: el mismo objetivo en montura Nikon y Canon', codigos: ['AT-0304', 'AT-0305'] },
  { motivo: 'Sigma 16mm F/1.4 Contemporary: montura Canon EF-M y Sony', codigos: ['AT-0313', 'AT-0315'] },
  { motivo: 'Sigma 50mm F/1.4 Art: montura Canon y Nikon', codigos: ['AT-0334', 'AT-0335'] },
  { motivo: 'Sigma 56mm F/1.4 Contemporary: montura Sony y Canon', codigos: ['AT-0336', 'AT-0337'] },
];

const baseAT = c => String(c || '').toUpperCase().replace(/-\d{2}$/, '');
const grupoPermitido = cods => PERMITIDAS.find(g => cods.every(c => g.codigos.includes(baseAT(c))));

async function correrPruebas(){
  /* ---- 1 ---- */
  const conTramo = PRODUCTOS.filter(p => p.skuVariante && String(p.skuVariante).split('-').length >= 6);
  const sinDecir = [];
  for(const p of conTramo){
    const tramo = String(p.skuVariante).split('-').pop().toUpperCase();
    const t = TRAMOS.find(x => x.tramo.test(tramo));
    // Corto: el resumen ya muestra el nombre de cada fila, y con 60 filas el
    // detalle largo se cortaba y las últimas no se veían
    if(t && !t.dice.test(p.desc || '')) sinDecir.push(`${p.id}: falta ${t.falta}`);
  }
  ok(conTramo.length > 100, '[1] hay filas con SKU para mirar', conTramo.length + ' filas');
  // "N: …" adelante: así fallas-conocidas.py sabe que no hay filas escondidas
  ok(sinDecir.length === 0, '[1] el nombre dice lo que dice su SKU (Body, Wifi, Cellular, Digital, E-Sim, ANC)',
     sinDecir.length ? sinDecir.length + ': ' + sinDecir.join(' | ') : conTramo.length + ' filas bien');

  /* ---- 2 ---- */
  const POBRE = /^(base|est[aá]ndar|standard|b[aá]sic[oa]|normal)?$/i;
  const pobres = [];
  for(const m of MODELOS.filter(x => x.multi)){
    for(const v of m.variantes){
      // Sin "|": es lo que separa una fila de otra en el detalle
      if(POBRE.test(String(v.etiqueta || '').trim())) pobres.push(`${v.id}: ${String(m.desc).replace(/\|/g, '/')} ofrece "${v.etiqueta || '(vacía)'}"`);
    }
  }
  ok(pobres.length === 0, '[2] ninguna versión se llama "Base" ni "Estándar": dice qué la distingue',
     pobres.length ? pobres.length + ': ' + pobres.join(' | ') : 'ninguna');

  /* ---- 3 ---- */
  let huellas = null;
  try{
    const r = await fetch('fotos/mini/huellas.json', { cache: 'no-cache' });
    huellas = r.ok ? await r.json() : null;
  }catch(e){ huellas = null; }
  ok(!!huellas && Object.keys(huellas).length > 100, '[3] se leen las huellas de las fotos', huellas ? Object.keys(huellas).length + ' fotos' : 'no se pudo leer fotos/mini/huellas.json');
  if(!huellas) return;
  // Por huella: qué códigos la usan y de qué modelos son (la madre del SKU; sin
  // SKU, el nombre del modelo de la web)
  const modeloDe = new Map();
  for(const m of MODELOS) for(const v of m.variantes) modeloDe.set(v.id, madreDelSku(v.skuVariante) || norm(m.desc));
  const porHuella = new Map();
  for(const p of PRODUCTOS){
    for(const cod of [p.codigoVar, p.codigo].filter(Boolean)){
      const h = huellas[String(cod).toUpperCase() + '.jpg'];
      if(!h) continue;
      if(!porHuella.has(h)) porHuella.set(h, new Map());
      const g = porHuella.get(h);
      const k = String(cod).toUpperCase();
      if(!g.has(k)) g.set(k, { ids: new Set(), modelos: new Set() });
      g.get(k).ids.add(p.id);
      g.get(k).modelos.add(modeloDe.get(p.id) || norm(p.desc));
      break;       // la foto de la fila es la de su color (CODIGO_VAR) si la hay
    }
  }
  const cruzadas = [];
  let filasCruzadas = 0;
  for(const g of porHuella.values()){
    const cods = [...g.keys()];
    const modelos = new Set(cods.flatMap(c => [...g.get(c).modelos]));
    if(cods.length < 2 || modelos.size < 2 || grupoPermitido(cods)) continue;
    const ids = [...new Set(cods.flatMap(c => [...g.get(c).ids]))];
    filasCruzadas += ids.length;
    cruzadas.push(`${ids.join(', ')}: la misma foto en ${cods.join(' = ')}`);
  }
  // El total son las filas (cada ID cuenta una), no los grupos
  ok(cruzadas.length === 0, '[3] una foto no está en dos modelos que se ven distintos',
     cruzadas.length ? filasCruzadas + ': ' + cruzadas.join(' | ') : 'ninguna');
  ok(PERMITIDAS.every(g => g.codigos.length >= 2 && g.motivo), '[3] cada grupo permitido dice por qué');
}
