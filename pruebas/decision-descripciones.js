// La descripcion de cada producto en la ficha: Pedro eligio la A2 (30/09/2026,
// muestra muestras/descripciones-desplegables/index.html), "Acordeon: Por que
// elegirlo / Lo mas importante / Ficha tecnica".
//   A2.1  tres renglones que se abren de a uno: "Por que elegirlo" abierto al
//         entrar; abrir otro cierra el que estaba; tocar el abierto lo cierra
//   A2.2  cada titulo con su contador ("2 frases", "5 puntos", "31 datos")
//   A2.3  el dato que cambia con la version: resaltado el de la version
//         elegida, con los de las otras en chiquito; en los puntos, la marca
//         "segun version"
//   A2.4  lo que no sale del fabricante lleva "proveedor" y abajo, en
//         chiquito, el aviso lo dice. Las fuentes oficiales NO se muestran
//         (Pedro, 03/10/2026: "sacá las fuentes"); siguen en el archivo
//   A2.5  donde: en el celular antes de "Estas eligiendo" y del pie pegado; en
//         la compu abajo de los botones, antes de retiro y garantia
//   A2.6  un producto sin descripcion se ve como antes: ningun hueco
// Y los datos: datos/descripciones.json (formato en datos/LEEME-descripciones.md)
//   D.1   el formato: codigos AT que existen en herramientas/catalogo-maestro.csv,
//         ninguno en dos entradas, versiones que cubren sus codigos, cada dato
//         que cambia cubre todas las versiones, fuente oficial presente, lo del
//         proveedor con su fuente, y ninguna palabra comercial (precio, cuota,
//         envio, garantia, stock, "el mejor"): eso lo define Pedro, no la ficha
//   D.2   la web lo pide recien al abrir la primera ficha, con tope de tiempo;
//         si no llega (o no esta), la ficha queda como antes
//   D.3   la entrada se busca por el CODIGO de la fila; la version, por lo que
//         la ficha sabe de la fila (Sim, memoria, montura, nombre), porque la
//         columna CODIGO de ADVAPP trae codigos de otra memoria o de la eSIM
//   D.4   (01/10, Pedro: "una estructura con un agente para que no se filtren
//         datos erroneos") ninguna entrada se publica sin pasar por el
//         verificador: la huella (sha256, sin "notas") de cada entrada tiene
//         que estar en datos/descripciones-verificadas.json, que escribe
//         herramientas/verificar-descripciones.py con los veredictos "ok" del
//         agente verificador-descripciones. Si una entrada cambia despues de
//         verificarse, su huella ya no esta y la publicacion se frena.
// Mas la convivencia con lo que ya estaba: la vitrina de colores, las
// pestanas de version, "Ver las N versiones", el pie pegado, Compartir y el
// visor. Los casos salen de los datos del dia y del JSON, sin nombres fijos
// (salvo que se prefieren los de la muestra). El celular se mira en un iframe
// de 390 x 664 (el headless no baja de 500).
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);

const esperaPD = setInterval(() => {
  if(!MODELOS.length || !FUENTE || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperaPD);
  for(let i=1;i<5000;i++) clearInterval(i);
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; })
    .finally(() => {
      try{ if(cerrarVisorDOM){ visorEmpujado = false; const c = cerrarVisorDOM; cerrarVisorDOM = null; c(); } }catch(e){}
      try{ quitarFicha(); }catch(e){}
      try{ pararPaseos(); pararOfertas(); pararMundos(); }catch(e){}
      for(let i=1;i<5000;i++) clearInterval(i);
      const pre=document.createElement('pre'); pre.id='RESULTADO';
      pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
      document.body.appendChild(pre);
    });
}, 150);

const pdDormir = ms => new Promise(r => setTimeout(r, ms));
async function pdEsperarA(cond, ms = 25000){
  const t0 = Date.now();
  while(Date.now() - t0 < ms){
    try{ if(cond()) return true; }catch(e){}
    await pdDormir(150);
  }
  try{ return !!cond(); }catch(e){ return false; }
}
const pdTxt = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
const pdCss = (el, p, w = window) => el ? w.getComputedStyle(el).getPropertyValue(p) : '';
function pdAbrir(k){
  try{ quitarFicha(); }catch(e){}
  abrirFicha(k, null);
  const d = document.getElementById('ficha');
  try{ d.getAnimations({ subtree: true }).forEach(a => a.finish()); }catch(e){}
  return d;
}
// Las animaciones del acordeon (0,3 s) terminadas, para medir
async function pdQuieto(d){ await pdDormir(380); try{ d.getAnimations({ subtree: true }).forEach(a => a.finish()); }catch(e){} }
const pdBotones = d => [...d.querySelectorAll('.fi-desc .fi-acd-b')];
const pdAbierto = d => pdBotones(d).filter(b => b.getAttribute('aria-expanded') === 'true').map(b => b.dataset.desc).join(',');
const pdN = t => norm(String(t || ''));

/* ---------- D.1 el formato del JSON (tambien lo usa la autoprueba) ---------- */
const PD_SI = ['sim', 'memoria', 'teclado', 'montura', 'texto', 'sin'];
const PD_PROHIBIDAS = /\b(precio|cuota|envio|garantia|stock)(s|es)?\b|\bel mejor\b/;
function pdValidar(j, maestro){
  const malos = [];
  const mal = (e, t) => malos.push((e && e.modelo ? e.modelo : '?') + ': ' + t);
  if(!j || j.formato !== 'descripciones/1') malos.push('formato no es "descripciones/1"');
  const lista = j && Array.isArray(j.descripciones) ? j.descripciones : null;
  if(!lista || !lista.length){ malos.push('sin lista "descripciones"'); return malos; }
  const vistos = new Map();
  const esTexto = x => typeof x === 'string' && x.trim().length > 0;
  lista.forEach((e, i) => {
    if(!e || typeof e !== 'object'){ malos.push('entrada ' + i + ' no es un objeto'); return; }
    if(!esTexto(e.modelo)) mal(e, 'sin "modelo"');
    const cods = Array.isArray(e.codigos) ? e.codigos : [];
    if(!cods.length) mal(e, 'sin codigos');
    cods.forEach(c => {
      if(typeof c !== 'string' || !/^AT-\d{4}$/.test(c)) mal(e, 'codigo con otra forma: ' + c);
      else if(maestro && !maestro.has(c)) mal(e, c + ' no esta en el maestro');
      if(vistos.has(c)) mal(e, c + ' repetido (tambien en ' + vistos.get(c) + ')');
      else vistos.set(c, e.modelo);
    });
    // Versiones: cada codigo en una sola, y las condiciones que la web conoce
    const vs = Array.isArray(e.versiones) ? e.versiones : [];
    if(e.versiones !== undefined && !Array.isArray(e.versiones)) mal(e, '"versiones" no es una lista');
    const nombres = vs.map(v => v && v.nombre);
    if(nombres.some(n => !esTexto(n)) || new Set(nombres).size !== nombres.length) mal(e, 'versiones sin nombre o con el nombre repetido');
    if(vs.length){
      const deVer = new Map();
      vs.forEach(v => {
        (Array.isArray(v && v.codigos) ? v.codigos : []).forEach(c => {
          if(!cods.includes(c)) mal(e, 'la version ' + v.nombre + ' tiene ' + c + ', que la entrada no tiene');
          if(deVer.has(c)) mal(e, c + ' en dos versiones');
          deVer.set(c, v.nombre);
        });
        const si = v && v.si;
        if(!si || typeof si !== 'object' || !Object.keys(si).length) mal(e, 'la version ' + (v && v.nombre) + ' no dice como se la reconoce ("si")');
        else Object.keys(si).forEach(k => { if(!PD_SI.includes(k)) mal(e, 'condicion desconocida "' + k + '" en ' + v.nombre); });
      });
      cods.forEach(c => { if(!deVer.has(c)) mal(e, c + ' no esta en ninguna version'); });
    }
    // Los datos: texto o {segun, proveedor}, cubriendo todas las versiones
    let hayProv = false;
    const dato = (x, donde) => {
      if(esTexto(x)) return;
      if(!x || typeof x !== 'object'){ mal(e, donde + ': vacio'); return; }
      const claves = Object.keys(x);
      if(claves.some(k => k !== 'segun' && k !== 'proveedor')) mal(e, donde + ': solo lleva "segun" y "proveedor"');
      if(typeof x.proveedor === 'string' && !x.segun){ hayProv = true; return; }
      if(!vs.length){ mal(e, donde + ': cambia con la version pero la entrada no tiene versiones'); return; }
      const seg = x.segun && typeof x.segun === 'object' ? x.segun : {};
      const prv = x.proveedor && typeof x.proveedor === 'object' ? x.proveedor : {};
      if(Object.keys(prv).length) hayProv = true;
      [...Object.entries(seg), ...Object.entries(prv)].forEach(([k, t]) => {
        if(!nombres.includes(k)) mal(e, donde + ': version desconocida "' + k + '"');
        if(!esTexto(t)) mal(e, donde + ': texto vacio en ' + k);
      });
      Object.keys(seg).forEach(k => { if(k in prv) mal(e, donde + ': ' + k + ' esta en "segun" y en "proveedor"'); });
      nombres.forEach(n => { if(!(n in seg) && !(n in prv)) mal(e, donde + ': falta la version ' + n); });
    };
    if(!Array.isArray(e.venta) || !e.venta.length || !e.venta.every(esTexto)) mal(e, '"venta" vacia');
    if(!Array.isArray(e.importante) || !e.importante.length) mal(e, '"importante" vacio');
    else e.importante.forEach((p, i) => { dato(p && p.titulo, 'importante ' + (i + 1) + ' titulo'); dato(p && p.texto, 'importante ' + (i + 1) + ' texto'); });
    if(!Array.isArray(e.ficha) || !e.ficha.length) mal(e, '"ficha" vacia');
    else e.ficha.forEach(g => {
      if(!g || !esTexto(g.grupo) || !Array.isArray(g.datos) || !g.datos.length){ mal(e, 'grupo de la ficha sin nombre o sin datos'); return; }
      g.datos.forEach(r => {
        if(!Array.isArray(r) || r.length !== 2 || !esTexto(r[0])){ mal(e, g.grupo + ': un dato no es [nombre, valor]'); return; }
        dato(r[1], g.grupo + ' / ' + r[0]);
      });
    });
    // La fuente oficial, siempre
    const fs = Array.isArray(e.fuentes) ? e.fuentes : [];
    if(!fs.length) mal(e, 'sin fuente');
    fs.forEach(f => { if(!f || !esTexto(f.texto) || !/^https:\/\/[^\s]+$/.test(String(f.url || ''))) mal(e, 'fuente sin texto o sin https: ' + JSON.stringify(f)); });
    if(hayProv && !(e.proveedor && esTexto(e.proveedor.fuente))) mal(e, 'tiene datos del proveedor y no dice de donde ("proveedor.fuente")');
    // Ninguna palabra comercial: eso lo define Pedro
    const textos = [];
    // Todos los textos de la entrada, menos las direcciones (url)
    const juntar = x => {
      if(typeof x === 'string') textos.push(x);
      else if(Array.isArray(x)) x.forEach(juntar);
      else if(x && typeof x === 'object') Object.entries(x).forEach(([k, y]) => { if(k !== 'url') juntar(y); });
    };
    juntar(e);
    textos.forEach(t => { const m = pdN(t).match(PD_PROHIBIDAS); if(m) mal(e, 'palabra comercial "' + m[0] + '": ' + t.slice(0, 60)); });
  });
  return malos;
}

async function correrPruebas(){
  quitarFicha();
  const antesPedido = PEDIDO.slice();
  PEDIDO = []; guardarPedido();
  try{
    // [D.2] Nada pedido antes de la primera ficha
    // (la prueba baja el archivo por su lado con ?prueba: ese no cuenta)
    const pedidos = () => performance.getEntriesByType('resource').filter(x => /datos\/descripciones\.json(?!\?prueba)/.test(x.name)).length;
    ok(typeof DESCRIPCIONES !== 'undefined' && DESCRIPCIONES === null && DESC_P === null && pedidos() === 0,
       '[D.2] la portada no pide datos/descripciones.json (se pide con la primera ficha)', pedidos() + ' pedidos');
    ok(typeof DESC_ESPERA_MS === 'number' && DESC_ESPERA_MS >= 1000 && DESC_ESPERA_MS <= 15000,
       '[D.2] con tope de tiempo', DESC_ESPERA_MS + ' ms');

    const j = await fetch('datos/descripciones.json?prueba', { cache: 'no-store' }).then(r => r.json());
    const csv = await fetch('herramientas/catalogo-maestro.csv', { cache: 'no-store' }).then(r => r.text());
    const filasCsv = parseCSV(csv);
    const col = filasCsv[0].indexOf('CODIGO');
    const maestro = new Set(filasCsv.slice(1).map(f => f[col]).filter(Boolean));
    info(j.descripciones.length + ' descripciones cargadas; el maestro tiene ' + maestro.size + ' codigos');
    probarFormato(j, maestro);
    await probarVerificadas(j);

    // Las filas de hoy que tienen descripcion (por su codigo)
    const porCodigo = new Map();
    j.descripciones.forEach(e => e.codigos.forEach(c => porCodigo.set(c, e)));
    const casos = [];
    for(const m of MODELOS) for(const v of m.variantes){
      const e = porCodigo.get(String(v.codigo || '').toUpperCase());
      if(e) casos.push({ m, v, e });
    }
    info(casos.length + ' filas de hoy tienen descripcion, en ' + new Set(casos.map(c => c.m)).size + ' fichas');
    if(!casos.length){ ok(false, 'hoy hay filas con descripcion'); return; }
    const prefiere = casos.find(c => /iphone 17 pro/i.test(c.v.desc) && c.v.sim === 'Sim') || casos[0];

    await probarCarga(prefiere, pedidos);
    probarVersiones(casos);
    await probarFicha(casos);
    await probarAcordeon(prefiere);
    await probarVersionCambia(casos);
    await probarConvivencia(prefiere);
    probarSinDescripcion(porCodigo);
    await probarFalla(prefiere);
    await probarCelular(prefiere);
  } finally {
    quitarFicha();
    PEDIDO = antesPedido; guardarPedido(); pintarPedido();
  }
}

/* ---- D.1 ---- */
/* ---- D.4 ---- La huella de una entrada: sha256 del JSON canonico (claves
   ordenadas, sin espacios, sin "notas"). Es la misma cuenta que huella() de
   herramientas/verificar-descripciones.py; la prueba lo comprueba con una
   entrada fija cuya huella calculo la herramienta. */
function pdCanon(x){
  if(Array.isArray(x)) return '[' + x.map(pdCanon).join(',') + ']';
  if(x && typeof x === 'object') return '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + pdCanon(x[k])).join(',') + '}';
  return JSON.stringify(x);
}
async function pdHuella(e){
  const x = {}; Object.keys(e).forEach(k => { if(k !== 'notas') x[k] = e[k]; });
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pdCanon(x)));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function probarVerificadas(j){
  if(!(window.crypto && crypto.subtle)){ ok(false, '[D.4] el navegador de la prueba calcula sha256 (crypto.subtle)'); return; }
  const fija = { modelo: 'Prueba ñ "x" / 6,3\"', codigos: ['AT-0001'], venta: ['a\nb'],
                 ficha: [{ grupo: 'G', datos: [['k', { segun: { b: '2', a: '1' } }]] }], notas: 'no cuenta' };
  const hf = await pdHuella(fija);
  ok(hf === '5ea600cf5bece0806d558e85aaa039416e028bae707b72be18699b0302964849',
     '[D.4] la prueba y herramientas/verificar-descripciones.py calculan la misma huella', hf);
  let reg = null;
  try{ reg = await fetch('datos/descripciones-verificadas.json?prueba', { cache: 'no-store' }).then(r => r.ok ? r.json() : null); }catch(e){}
  ok(!!reg && reg.formato === 'verificadas/1' && reg.verificadas && typeof reg.verificadas === 'object',
     '[D.4] esta el registro de descripciones verificadas (datos/descripciones-verificadas.json)');
  if(!reg) return;
  const sin = [];
  for(const e of j.descripciones){ if(!reg.verificadas[await pdHuella(e)]) sin.push(e.modelo); }
  ok(!sin.length, '[D.4] cada descripcion paso por el verificador y no cambio despues (si no: python3 herramientas/verificar-descripciones.py)',
     sin.length ? sin.length + ' sin verificar: ' + sin.slice(0, 4).join(' | ') : j.descripciones.length + ' verificadas');
  // Cambiar una coma deja la huella afuera; cambiar las notas, no
  const e0 = JSON.parse(JSON.stringify(j.descripciones[0]));
  const h0 = await pdHuella(e0);
  e0.notas = 'otra nota'; const h1 = await pdHuella(e0);
  e0.venta = e0.venta.map((t, i) => i ? t : t + ','); const h2 = await pdHuella(e0);
  ok(h0 === h1 && h1 !== h2, '[D.4] la huella cambia con cualquier cambio del texto, y no con las notas');
}

function probarFormato(j, maestro){
  const malos = pdValidar(j, maestro);
  ok(!malos.length, '[D.1] datos/descripciones.json cumple el formato (codigos del maestro, sin repetidos, versiones, fuente, sin palabras comerciales)',
     malos.slice(0, 6).join(' | ') || j.descripciones.length + ' entradas');
  // La validacion no es de adorno: con cada error plantado, lo encuentra
  const base = JSON.parse(JSON.stringify(j.descripciones[0]));
  const plantar = cambio => {
    const e = JSON.parse(JSON.stringify(base)); cambio(e);
    return pdValidar({ formato: 'descripciones/1', descripciones: [e] }, maestro).length > 0;
  };
  const plantados = {
    'codigo que no esta en el maestro': e => { e.codigos.push('AT-9999'); if(e.versiones && e.versiones[0]) e.versiones[0].codigos.push('AT-9999'); },
    'codigo repetido entre entradas': null,
    'sin fuente': e => { e.fuentes = []; },
    'fuente sin https': e => { e.fuentes = [{ texto: 'x', url: 'http://x' }]; },
    'palabra "precio"': e => { e.venta = ['El mejor precio del mercado']; },
    'palabra "cuotas"': e => { e.venta = ['En 12 cuotas']; },
    'palabra "envío"': e => { e.importante[0].texto = 'Con envío gratis'; },
    'palabra "garantía"': e => { e.ficha[0].datos.push(['Garantía', '1 año']); },
    'palabra "stock"': e => { e.venta = ['Últimas unidades en stock']; },
    '"el mejor"': e => { e.venta = ['Es el mejor teléfono']; },
    'dato que no cubre una version': e => {
      if(!e.versiones || !e.versiones.length){ e.importante[0].titulo = { segun: { X: 'y' } }; return; }
      e.importante[0].titulo = { segun: { [e.versiones[0].nombre]: 'y' } };
      if(e.versiones.length < 2) e.versiones.push({ nombre: 'Otra', codigos: [], si: { sim: 'Z' } });
    },
    'proveedor sin fuente': e => { e.importante[0].texto = { proveedor: 'dice el proveedor' }; delete e.proveedor; }
  };
  const noVistos = Object.entries(plantados).filter(([t, f]) => {
    if(f) return !plantar(f);
    return pdValidar({ formato: 'descripciones/1', descripciones: [base, JSON.parse(JSON.stringify(base))] }, maestro).length === 0;
  }).map(([t]) => t);
  ok(!noVistos.length, '[D.1] la validacion encuentra cada error plantado', noVistos.join(', ') || Object.keys(plantados).length + ' errores');
}

/* ---- D.2 y A2.6: la carga, recien con la primera ficha ---- */
async function probarCarga(c, pedidos){
  const d = pdAbrir(c.v.id);
  ok(!d.querySelector('.fi-desc') && !d.querySelector('.fi-acd'), '[D.2] al abrir la primera ficha, mientras llega, no hay hueco');
  const llego = await pdEsperarA(() => DESCRIPCIONES && document.querySelector('#ficha .fi-desc'), 12000);
  ok(llego && pedidos() === 1, '[D.2] el archivo se pide una vez y la descripcion aparece sola en la ficha abierta', pedidos() + ' pedidos');
  if(!llego) return;
  const ds = document.querySelector('#ficha .fi-desc');
  ok(ds.previousElementSibling && ds.previousElementSibling.classList.contains('fi-botones'),
     '[A2.5 · compu] y cae abajo de los botones', ds.previousElementSibling && ds.previousElementSibling.className);
  pdAbrir(casoOtro(c).v.id);
  await pdDormir(300);
  ok(pedidos() === 1, '[D.2] la segunda ficha no lo vuelve a pedir', pedidos() + ' pedidos');
}
const casoOtro = c => ({ v: c.m.variantes.find(x => x !== c.v) || c.v });

/* ---- D.3: la version de cada fila, por lo que la ficha sabe ---- */
function probarVersiones(casos){
  const conVer = casos.filter(c => Array.isArray(c.e.versiones) && c.e.versiones.length);
  const malas = conVer.filter(c => !versionDescripcion(c.e, c.v))
    .map(c => c.v.id + ' (' + c.v.desc + ')');
  ok(!malas.length, '[D.3] cada fila de hoy con descripcion calza en una sola version', malas.slice(0, 5).join(' | ') || conVer.length + ' filas');
  // Donde la columna CODIGO apunta a otra version, se sigue a la fila, no al codigo
  const cruzadas = conVer.filter(c => {
    const ver = versionDescripcion(c.e, c.v);
    const delCodigo = c.e.versiones.find(x => (x.codigos || []).includes(String(c.v.codigo).toUpperCase()));
    return ver && delCodigo && delCodigo.nombre !== ver;
  });
  info(cruzadas.length + ' filas traen en CODIGO el de otra version (se usa la de la fila): ' +
       cruzadas.slice(0, 3).map(c => c.v.id + ' ' + c.v.codigo).join(', '));
  const iphoneSim = conVer.find(c => c.v.sim === 'Sim' && /iphone 17 pro/i.test(c.v.desc) && c.v.codigo === 'AT-0071');
  if(iphoneSim) ok(versionDescripcion(iphoneSim.e, iphoneSim.v) === 'Sim',
    '[D.3] el ' + iphoneSim.v.desc + ' (CODIGO AT-0071, el de la eSIM) muestra los datos de la Sim', versionDescripcion(iphoneSim.e, iphoneSim.v));
}

// Lo que tiene que decir un dato en la version `ver`
function pdEsperado(x, ver){
  if(typeof x === 'string') return { txt: x, varia: false, prov: false };
  if(typeof x.proveedor === 'string' && !x.segun) return { txt: x.proveedor, varia: false, prov: true };
  const seg = x.segun || {}, prv = x.proveedor || {};
  if(ver in seg) return { txt: seg[ver], varia: true, prov: false };
  if(ver in prv) return { txt: prv[ver], varia: true, prov: true };
  return { txt: '', varia: true, prov: false };
}

/* ---- A2.1 a A2.4 en cada ficha con descripcion (compu) ---- */
async function probarFicha(casos){
  const malos = { tit: [], cont: [], inicio: [], var: [], puntos: [], fuente: [], region: [], prov: [] };
  const TITULOS = ['Por qué elegirlo', 'Lo más importante', 'Ficha técnica'];
  for(const c of casos){
    const d = pdAbrir(c.v.id);
    const ds = d.querySelector('.fi-desc');
    if(!ds){ malos.tit.push(c.v.id + ' sin descripcion'); continue; }
    const bs = pdBotones(d);
    const tits = bs.map(b => pdTxt(b.querySelector('span:not(.fi-acd-num)')));
    if(tits.join('|') !== TITULOS.join('|')) malos.tit.push(c.v.id + ': ' + tits.join(' / '));
    const ver = versionDescripcion(c.e, c.v);
    // Contadores
    const nDatos = c.e.ficha.reduce((n, g) => n + g.datos.length, 0);
    const nPuntos = c.e.importante.filter(p => pdEsperado(p.titulo, ver).txt).length;
    const pl = (n, a, b) => n + ' ' + (n === 1 ? a : b);
    const cuenta = bs.map(b => pdTxt(b.querySelector('small'))).join('|');
    const quiere = [pl(c.e.venta.length, 'frase', 'frases'), pl(nPuntos, 'punto', 'puntos'), pl(nDatos, 'dato', 'datos')].join('|');
    if(cuenta !== quiere) malos.cont.push(c.v.id + ': ' + cuenta + ' (y son ' + quiere + ')');
    // Al entrar: "Por que elegirlo" abierto y los otros dos cerrados
    if(pdAbierto(d) !== 'por') malos.inicio.push(c.v.id + ': ' + pdAbierto(d));
    // Cada boton controla su panel, con rol de region y su titulo
    bs.forEach(b => {
      const r = d.querySelector('#' + b.getAttribute('aria-controls'));
      if(!r || r.getAttribute('role') !== 'region' || r.getAttribute('aria-labelledby') !== b.id || b.tagName !== 'BUTTON' || !b.closest('h4'))
        malos.region.push(c.v.id + ' ' + b.dataset.desc);
    });
    // La ficha tecnica: el de la version elegida resaltado, el resto en chiquito
    // (por grupo: el iPhone tiene "Video" en Camaras y en Bateria)
    const secs = [...ds.querySelectorAll('.fi-desc-sec')];
    c.e.ficha.flatMap(g => g.datos.map(r => [g.grupo, ...r])).forEach(([grupo, nombre, x]) => {
      const esp = pdEsperado(x, ver);
      const sec = secs.find(s => pdTxt(s.querySelector('h5')).toLowerCase() === grupo.toLowerCase());
      const dt = sec && [...sec.querySelectorAll('dt')].find(t => pdTxt(t) === nombre);
      const dd = dt && dt.nextElementSibling;
      if(!dd){ malos.var.push(c.v.id + ': falta ' + nombre); return; }
      if(esp.varia){
        const b = dd.querySelector('b');
        const bien = dd.classList.contains('var') && b && pdTxt(b) === esp.txt && /En esta versi/.test(pdTxt(dd.querySelector('small')));
        if(!bien) malos.var.push(c.v.id + ' ' + nombre + ': "' + pdTxt(dd) + '" (y es "' + esp.txt + '" en ' + ver + ')');
        if(esp.prov && !dd.querySelector('.fi-desc-prov')) malos.prov.push(c.v.id + ' ' + nombre);
      } else if(dd.classList.contains('var') || !pdTxt(dd).startsWith(esp.txt)) malos.var.push(c.v.id + ' ' + nombre + ': "' + pdTxt(dd) + '"');
    });
    // Los puntos: "segun version" en los que cambian, "proveedor" en los que no son del fabricante
    const lis = [...ds.querySelectorAll('.fi-desc-puntos li')];
    c.e.importante.forEach((p, i) => {
      const t = pdEsperado(p.titulo, ver), x = pdEsperado(p.texto, ver);
      const li = lis.find(l => pdTxt(l.querySelector('b')).startsWith(t.txt));
      if(!li){ malos.puntos.push(c.v.id + ': falta "' + t.txt + '"'); return; }
      const varia = !!li.querySelector('.fi-desc-varia'), prov = !!li.querySelector('.fi-desc-prov');
      if(varia !== (t.varia || x.varia) || prov !== (t.prov || x.prov) || (x.txt && pdTxt(li.querySelector('div > span')) !== x.txt))
        malos.puntos.push(c.v.id + ' "' + t.txt + '": varia ' + varia + ', proveedor ' + prov);
    });
    // Abajo: sin links de fuentes (03/10); el aviso del proveedor, chiquito, si hay
    const fu = ds.querySelector('.fi-desc-fuente');
    const links = fu ? [...fu.querySelectorAll('a')] : [];
    const tam = parseFloat(pdCss(fu, 'font-size'));
    const hrefs = links.map(a => a.getAttribute('href')).join('|');
    const hayProv = c.e.importante.some(p => pdEsperado(p.titulo, ver).prov || pdEsperado(p.texto, ver).prov) ||
                    c.e.ficha.some(g => g.datos.some(r => pdEsperado(r[1], ver).prov));
    const dice = fu ? pdTxt(fu.querySelector('.prov')) : '';
    /* Con versiones, el aviso nombra la version («4 baterías»: ...). Sin
       versiones (01/10: el combo Switch 2 + Mario Kart, que trae el juego
       segun el proveedor) no hay version que nombrar: el aviso va solo. */
    const provVersion = ver ? dice.includes('«' + ver + '»') : !dice.includes('«');
    if(links.length || /Fuente:/.test(pdTxt(ds)) || hrefs || (hayProv !== !!fu) ||
       (fu && (!(tam <= 11) || fu !== ds.lastElementChild || !(provVersion && dice.includes(c.e.proveedor.aviso)))))
      malos.fuente.push(c.v.id + ': ' + (fu ? pdTxt(fu).slice(0, 80) + ' · ' + tam + 'px' : 'sin aviso del proveedor'));
  }
  const n = casos.length + ' fichas';
  ok(!malos.tit.length, '[A2.1] los tres renglones, en orden: Por que elegirlo / Lo mas importante / Ficha tecnica', malos.tit.slice(0, 4).join(' | ') || n);
  ok(!malos.inicio.length, '[A2.1] al entrar, "Por que elegirlo" abierto y los otros cerrados', malos.inicio.slice(0, 4).join(' | ') || n);
  ok(!malos.region.length, '[A2.1] cada titulo es un boton que controla su panel (region con su titulo)', malos.region.slice(0, 4).join(' | ') || n);
  ok(!malos.cont.length, '[A2.2] los contadores de los titulos dicen lo que hay', malos.cont.slice(0, 4).join(' | ') || n);
  ok(!malos.var.length, '[A2.3] la ficha tecnica: el dato de la version elegida resaltado, con los otros en chiquito', malos.var.slice(0, 4).join(' | ') || n);
  ok(!malos.puntos.length, '[A2.3] los puntos: "segun version" y "proveedor" donde corresponde', malos.puntos.slice(0, 4).join(' | ') || n);
  ok(!malos.prov.length, '[A2.4] un dato del proveedor en la tabla lleva su marca', malos.prov.slice(0, 4).join(' | ') || n);
  ok(!malos.fuente.length, '[A2.4] sin las fuentes a la vista; abajo, chiquito, el aviso del proveedor solo cuando hay datos suyos', malos.fuente.slice(0, 4).join(' | ') || n);
  const conProv = casos.filter(c => c.e.proveedor && versionDescripcion(c.e, c.v) &&
    c.e.ficha.some(g => g.datos.some(r => pdEsperado(r[1], versionDescripcion(c.e, c.v)).prov)));
  info(conProv.length + ' fichas con datos del proveedor: ' + conProv.map(c => c.v.id).join(', '));

  // El resaltado se ve: fondo y la raya violeta de la izquierda
  const c0 = casos.find(c => c.e.ficha.some(g => g.datos.some(r => typeof r[1] !== 'string')));
  if(c0){
    const d = pdAbrir(c0.v.id);
    const dd = d.querySelector('.fi-desc dd.var');
    ok(dd && pdCss(dd, 'background-color') !== 'rgba(0, 0, 0, 0)' && /inset/.test(pdCss(dd, 'box-shadow')),
       '[A2.3] el dato de la version se ve resaltado', dd && pdCss(dd, 'background-color'));
    const v = d.querySelector('.fi-desc .fi-desc-varia');
    ok(!v || pdTxt(v).toLowerCase() === 'según versión', '[A2.3] la marca dice "segun version"', v && pdTxt(v));
  }
}

/* ---- A2.1: de a uno, y tocar el abierto lo cierra ---- */
async function probarAcordeon(c){
  const d = pdAbrir(c.v.id);
  const b = k => d.querySelector(`.fi-acd-b[data-desc="${k}"]`);
  const visible = k => pdCss(d.querySelector('#fi-desc-' + k), 'visibility') === 'visible';
  await pdQuieto(d);
  ok(visible('por') && !visible('imp') && !visible('ficha'), '[A2.1] lo cerrado no se ve (ni se enfoca con Tab)');
  const cont = b('imp').querySelector('small');
  b('imp').click(); await pdQuieto(d);
  ok(pdAbierto(d) === 'imp' && visible('imp') && !visible('por'), '[A2.1] abrir "Lo mas importante" cierra "Por que elegirlo"', pdAbierto(d));
  ok(pdCss(cont, 'visibility') === 'hidden' && pdCss(b('por').querySelector('small'), 'visibility') === 'visible',
     '[A2.2] el contador del abierto se esconde; el de los cerrados se ve');
  b('ficha').click(); await pdQuieto(d);
  ok(pdAbierto(d) === 'ficha' && visible('ficha') && !visible('imp'), '[A2.1] abrir "Ficha tecnica" cierra el anterior', pdAbierto(d));
  b('ficha').click(); await pdQuieto(d);
  ok(pdAbierto(d) === '' && !visible('ficha'), '[A2.1] tocar el abierto lo cierra: quedan los tres cerrados', pdAbierto(d) || 'ninguno');
  // Con el teclado: es un boton de verdad (Enter y espacio los da el navegador)
  b('imp').focus();
  ok(document.activeElement === b('imp'), '[A2.1] se llega con el teclado');
  // Rehacer la ficha (un refresco de datos) no pierde lo abierto ni el foco
  b('imp').click(); await pdQuieto(d);
  b('imp').focus();
  refrescarFichaAbierta();
  const b2 = d.querySelector('.fi-acd-b[data-desc="imp"]');
  ok(pdAbierto(d) === 'imp' && document.activeElement === b2, '[A2.1] un refresco de datos no cierra lo abierto ni pierde el foco',
     pdAbierto(d) + ' / ' + (document.activeElement && document.activeElement.className));
  // Otra ficha arranca de nuevo con "Por que elegirlo"
  const d2 = pdAbrir(c.v.id);
  ok(pdAbierto(d2) === 'por', '[A2.1] al volver a entrar, "Por que elegirlo" abierto otra vez', pdAbierto(d2));
}

/* ---- Cambiar de version: cambian los datos, lo abierto sigue abierto ---- */
async function probarVersionCambia(casos){
  // Una ficha con pestanas cuyas versiones tengan datos distintos
  const conPest = casos.filter(c => c.m.variantes.length > 1 && c.e.versiones && c.e.versiones.length > 1);
  const c = conPest.find(x => /iphone 17 pro/i.test(x.v.desc) && x.v.sim === 'Sim') || conPest[0];
  if(!c){ info('hoy ninguna ficha con descripcion tiene versiones distintas'); return; }
  const d = pdAbrir(c.v.id);
  d.querySelector('.fi-acd-b[data-desc="ficha"]').click();
  await pdQuieto(d);
  const ver0 = versionDescripcion(c.e, c.v);
  // Una pestana que lleve a otra version de la descripcion
  const pest = [...d.querySelectorAll('.fi-op')].find(b => {
    const x = buscarProducto(b.dataset.k);
    return x && versionDescripcion(c.e, x) && versionDescripcion(c.e, x) !== ver0;
  });
  if(!pest){ info('la ficha de ' + c.v.desc + ' no tiene pestana a otra version'); return; }
  const antes = pdTxt(d.querySelector('.fi-desc dd.var b'));
  pest.click();
  await pdDormir(100);
  const v1 = buscarProducto(FICHA), ver1 = versionDescripcion(c.e, v1);
  const despues = pdTxt(d.querySelector('.fi-desc dd.var b'));
  const primero = c.e.ficha.flatMap(g => g.datos).find(r => typeof r[1] !== 'string');
  ok(pdAbierto(d) === 'ficha' && ver1 !== ver0 && despues === pdEsperado(primero[1], ver1).txt,
     '[A2.3] tocar la pestana ' + pdTxt(pest.querySelector('b')) + ' cambia el dato resaltado y no cierra la ficha tecnica',
     ver0 + ': ' + antes + ' -> ' + ver1 + ': ' + despues + ' · abierto ' + pdAbierto(d));
}

/* ---- Convivencia: vitrina, "Ver las N versiones", visor, Compartir, lugar ---- */
async function probarConvivencia(c){
  let d = pdAbrir(c.v.id);
  d.querySelector('.fi-acd-b[data-desc="imp"]').click();
  await pdQuieto(d);
  // La vitrina de colores: otro color (otra fila) no cierra lo abierto
  const tono = [...d.querySelectorAll('.fi-vitrina .fi-tono')].find(b => b.getAttribute('aria-pressed') !== 'true');
  if(tono){
    tono.click(); await pdDormir(100);
    ok(d.querySelector('.fi-desc') && pdAbierto(d) === 'imp' && d.querySelector('.fi-vitrina .fi-tono[aria-pressed="true"]').dataset.color === tono.dataset.color,
       '[vitrina] elegir otro color no cierra la descripcion', tono.dataset.color + ' · ' + pdAbierto(d));
  } else info('la ficha de ' + c.v.desc + ' no tiene otro color');
  // "Ver las N versiones" sigue y elegir un renglon cambia la version de la descripcion
  const todas = d.querySelector('.fi-todas');
  ok(!!todas, '[4.3] "Ver las N versiones" sigue en la ficha');
  if(todas){
    todas.open = true;
    await pdDormir(60);          // el 'toggle' llega despues: ahi se anota TODAS_ABIERTA
    const fila = [...d.querySelectorAll('.fi-fila')].find(b => { const x = buscarProducto(b.dataset.k);
      return x && versionDescripcion(c.e, x) && versionDescripcion(c.e, x) !== versionDescripcion(c.e, buscarProducto(FICHA)); });
    if(fila){
      fila.click(); await pdDormir(100);
      const v = buscarProducto(FICHA);
      const li = [...d.querySelectorAll('.fi-desc-puntos li')].find(l => l.querySelector('.fi-desc-varia'));
      const p = c.e.importante.find(x => typeof x.titulo !== 'string' || typeof x.texto !== 'string');
      ok(li && pdTxt(li.querySelector('b')).startsWith(pdEsperado(p.titulo, versionDescripcion(c.e, v)).txt) && pdAbierto(d) === 'imp' && d.querySelector('.fi-todas').open,
         '[4.3] elegir un renglon de "Ver las N versiones" cambia los puntos de la descripcion y deja todo abierto', versionDescripcion(c.e, v));
    }
  }
  // Lugar en la compu: abajo de los botones, antes de retiro y garantia
  const ds = d.querySelector('.fi-desc');
  const sig = ds.nextElementSibling;
  ok(ds.previousElementSibling.classList.contains('fi-botones') && (!sig || sig.classList.contains('fi-servicio') || sig.classList.contains('fi-nota')),
     '[A2.5 · compu] en la columna de la derecha, abajo de los botones y antes de retiro y garantia',
     ds.previousElementSibling.className + ' > fi-desc > ' + (sig && sig.className));
  // La foto y la vitrina quedan a la vista mientras se lee
  d.querySelector('.fi-acd-b[data-desc="ficha"]').click();
  await pdQuieto(d);
  const caja = d.querySelector('.caja');
  // El final de la descripcion, abajo de todo de lo que se ve
  caja.scrollTop += ds.getBoundingClientRect().bottom - caja.getBoundingClientRect().bottom;
  await pdDormir(100);
  const rc = caja.getBoundingClientRect(), rv = d.querySelector('.fi-colores').getBoundingClientRect();
  ok(pdCss(d.querySelector('.fi-foto'), 'position') === 'sticky' && rv.top >= rc.top - 1 && rv.bottom <= rc.bottom + 1,
     '[vitrina · compu] con la ficha tecnica abierta y abajo de todo, la foto y los colores siguen a la vista',
     pdCss(d.querySelector('.fi-foto'), 'position') + ' · colores ' + Math.round(rv.top - rc.top) + '-' + Math.round(rv.bottom - rc.top) + ' de ' + Math.round(rc.height));
  caja.scrollTop = 0;
  // El visor de la foto y Compartir siguen
  const lupa = d.querySelector('.fi-lupa');
  if(lupa){
    lupa.click(); await pdDormir(150);
    ok(!!document.getElementById('visor'), '[4.4] la lupa sigue abriendo el visor');
    try{ if(cerrarVisorDOM){ visorEmpujado = false; const x = cerrarVisorDOM; cerrarVisorDOM = null; x(); } }catch(e){}
  }
  const comp = d.querySelector('.fi-compartir');
  ok(comp && !comp.disabled && typeof comp.onclick === 'function' && !comp.closest('.fi-datos'), '[4.1] Compartir sigue en su lugar');
  // Un producto sin descripcion: la foto no se pega (la ficha queda como estaba)
  const sin = MODELOS.find(m => m.variantes.length === 1 && !descripcionDe(m.rep) && m.rep.imagen);
  if(sin){
    const d2 = pdAbrir(sin.rep.id);
    ok(pdCss(d2.querySelector('.fi-foto'), 'position') !== 'sticky', '[A2.6] sin descripcion, la columna de la foto queda como estaba', sin.rep.desc);
  }
}

/* ---- A2.6: sin entrada, nada ---- */
function probarSinDescripcion(porCodigo){
  const sin = MODELOS.filter(m => !m.variantes.some(v => porCodigo.has(String(v.codigo || '').toUpperCase())));
  const muestra = sin.filter((m, i) => i % Math.max(1, Math.floor(sin.length / 12)) === 0).slice(0, 12);
  const malos = muestra.filter(m => {
    const d = pdAbrir(m.rep.id);
    return d.querySelector('.fi-desc, .fi-acd, .fi-plg, .fi-desc-fuente');
  }).map(m => m.rep.id);
  ok(!malos.length, '[A2.6] un producto sin descripcion no muestra nada (ningun renglon vacio)', malos.join(', ') || muestra.length + ' fichas');
  // Una fila sin codigo tampoco
  ok(htmlDescripcion({ codigo: '' }) === '' && htmlDescripcion({ codigo: 'AT-9999' }) === '', '[A2.6] sin codigo o con un codigo sin entrada: nada');
}

/* ---- D.2: si el archivo no llega o no esta, la ficha queda como antes ---- */
async function probarFalla(c){
  const real = window.fetch;
  const guardado = DESCRIPCIONES;
  try{
    // No contesta nunca: se corta a los DESC_ESPERA_MS
    window.fetch = (u, o) => /datos\/descripciones\.json/.test(String(u))
      ? new Promise((_, no) => { if(o && o.signal) o.signal.addEventListener('abort', () => no(new Error('cortado'))); })
      : real(u, o);
    DESCRIPCIONES = null; DESC_P = null;
    const t0 = Date.now();
    const d = pdAbrir(c.v.id);
    const r = await Promise.race([cargarDescripciones(), pdDormir(DESC_ESPERA_MS + 4000).then(() => 'colgado')]);
    const tardo = Date.now() - t0;
    ok(r === null && DESC_P === null && tardo < DESC_ESPERA_MS + 2500, '[D.2] si no contesta, a los ' + DESC_ESPERA_MS / 1000 + ' s se deja de esperar', tardo + ' ms · ' + r);
    ok(!d.querySelector('.fi-desc, .fi-acd') && d.querySelector('.fi-botones .cta'), '[D.2] y la ficha queda como antes, sin hueco');
    // No esta (404)
    window.fetch = (u, o) => /datos\/descripciones\.json/.test(String(u)) ? Promise.resolve(new Response('no', { status: 404 })) : real(u, o);
    const d2 = pdAbrir(c.v.id);
    const r2 = await cargarDescripciones();
    ok(r2 === null && !d2.querySelector('.fi-desc'), '[D.2] si no esta, tampoco hay hueco');
    // Vuelve a andar: la ficha siguiente la trae
    window.fetch = real;
    const d3 = pdAbrir(c.v.id);
    const vuelve = await pdEsperarA(() => d3.querySelector('.fi-desc'), 8000);
    ok(vuelve, '[D.2] cuando vuelve a andar, la ficha siguiente la trae');
  } finally {
    window.fetch = real;
    if(!DESCRIPCIONES) DESCRIPCIONES = guardado;
  }
}

/* ---- A2.5 en el celular (390) ---- */
async function probarCelular(c){
  const f = document.createElement('iframe');
  // A la vista y no en -9999: Chrome no le actualiza el dibujo (ni avisa que
  // cruzo los 640 px) a un iframe que esta fuera de la pantalla
  f.style.cssText = 'width:390px;height:664px;border:0;position:fixed;left:0;top:0;z-index:2147483647';
  f.src = 'index.html#p=' + encodeURIComponent(c.v.id);
  document.body.appendChild(f);
  try{
    const listo = await pdEsperarA(() => f.contentWindow.eval('MODELOS.length && FUENTE && FICHA') &&
                                          f.contentDocument.querySelector('#ficha .fi-desc'), 40000);
    ok(listo, '[A2.5 · 390] el celular abre la ficha del ' + c.v.desc + ' con su descripcion');
    if(!listo) return;
    const w = f.contentWindow, doc = f.contentDocument;
    try{ w.pararOfertas?.(); w.pararPaseos?.(); w.pararMundos?.(); }catch(e){}
    await pdDormir(400);
    try{ doc.getElementById('ficha').getAnimations({ subtree: true }).forEach(a => a.finish()); }catch(e){}
    const ds = doc.querySelector('#ficha .fi-desc');
    const eleg = doc.getElementById('fi-elegido'), pie = doc.querySelector('#ficha .fi-botones');
    ok(ds.nextElementSibling === eleg && (ds.compareDocumentPosition(pie) & 4),
       '[A2.5 · 390] antes de "Estas eligiendo" y del pie con los botones', (ds.nextElementSibling && ds.nextElementSibling.id) || '');
    const cs = el => w.getComputedStyle(el);
    ok(cs(pie).position === 'sticky', '[2.7 · 390] el pie con los botones sigue pegado');
    const caja = doc.querySelector('#ficha .caja');
    // Mientras se lee la descripcion, el boton de WhatsApp sigue a la vista
    ds.querySelector('.fi-acd-b[data-desc="imp"]').click();
    await pdDormir(400);
    caja.scrollTop = ds.getBoundingClientRect().top - caja.getBoundingClientRect().top + caja.scrollTop - 40;
    await pdDormir(150);
    const rc = caja.getBoundingClientRect(), rp = pie.getBoundingClientRect(), rd = ds.getBoundingClientRect();
    ok(rp.bottom <= rc.bottom + 1 && rp.top < rc.bottom && rd.top < rp.top,
       '[A2.5 · 390] leyendo la descripcion, el boton de WhatsApp queda pegado abajo', 'pie ' + Math.round(rp.top - rc.top) + '-' + Math.round(rp.bottom - rc.top) + ' de ' + Math.round(rc.height));
    const altos = [...ds.querySelectorAll('.fi-acd-b')].map(b => Math.round(b.getBoundingClientRect().height));
    ok(altos.every(h => h >= 44 && h <= 56), '[A2.2 · 390] los tres titulos con su contador entran en un renglon (y se tocan con el dedo)', altos.join(', ') + ' px');
    ok(caja.scrollWidth <= caja.clientWidth + 1 && doc.documentElement.scrollWidth <= 391,
       '[A2.5 · 390] la ficha no se sale de costado', caja.scrollWidth + ' / ' + caja.clientWidth);
    // La vitrina sigue arriba, entre la foto y los datos
    const vit = doc.querySelector('#ficha .fi-colores'), datos = doc.querySelector('#ficha .fi-datos');
    ok(!vit || vit.getBoundingClientRect().bottom <= datos.getBoundingClientRect().top + 1, '[vitrina · 390] los colores siguen debajo de la foto');
    // Al pasar a compu (mas de 640) el mismo nodo se muda abajo de los botones, abierto como estaba
    /* El headless casi no le da cuadros al iframe, y el aviso de que cruzo
       los 640 px (el 'change' de matchMedia) sale en un cuadro: a veces
       llega a los segundos y a veces no llega. Si la media ya cambio y el
       aviso no vino, se le manda el mismo aviso a mano: lo que se prueba es
       que el que escucha (alCruzar) mude la descripcion. */
    const mq = w.eval('FICHA_CELULAR');     // (un const de la pagina: no cuelga de window)
    const cruzar = async (ancho, celular, llego) => {
      f.style.width = ancho;
      await pdEsperarA(() => mq.matches === celular, 5000);
      if(!await pdEsperarA(llego, 3000))
        mq.dispatchEvent(new w.MediaQueryListEvent('change', { matches: celular, media: mq.media }));
      await pdEsperarA(llego, 3000);
    };
    await cruzar('900px', false, () => doc.querySelector('#ficha .fi-desc').previousElementSibling === doc.querySelector('#ficha .fi-botones'));
    const ds2 = doc.querySelector('#ficha .fi-desc');
    ok(ds2 === ds && ds2.previousElementSibling === doc.querySelector('#ficha .fi-botones') &&
       ds2.querySelector('.fi-acd-b[data-desc="imp"]').getAttribute('aria-expanded') === 'true',
       '[A2.5] al cruzar los 640 px se muda abajo de los botones sin cerrar lo abierto',
       ds2.previousElementSibling && ds2.previousElementSibling.className);
    await cruzar('390px', true, () => doc.querySelector('#ficha .fi-desc').nextElementSibling === doc.getElementById('fi-elegido'));
    ok(doc.querySelector('#ficha .fi-desc').nextElementSibling === doc.getElementById('fi-elegido'), '[A2.5] y al volver a 390, otra vez antes de "Estas eligiendo"');
  } finally {
    f.remove();
  }
}
