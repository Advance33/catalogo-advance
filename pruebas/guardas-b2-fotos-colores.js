// Guardas de la tanda B2, fotos y colores (auditoria del 29/09/2026). Cada
// bloque es un error que se encontro y se arreglo: si vuelve, falla aca. El
// numero entre corchetes es el del hallazgo.
//
//  [37] La celda CODIGO_VAR le ganaba al maestro para el MISMO color: el Watch
//       Ultra 3 "Natural – Blue Trail Loop M/L" salia con la Ocean Band.
//  [38] Dos colores tocados rapido: quedaba la foto del primero con el nombre
//       del segundo (y lo mismo con un color y enseguida otra version).
//  [40] Filas sin foto teniendo la del mismo color en otra memoria, y
//       tarjetas "sin imagen" porque el representante empatado no tenia foto.
//  [43] Una fila Gray con la foto general del producto, que es la Silver.
//  [45] Los colores de dos tonos se pintaban con el segundo tono.
//  [46] Claves repetidas en COLORES: corregir la de arriba no cambiaba nada.
//  [51] El mismo color a dos precios: el puntito llevaba al mas barato.
//
// Sin nombres fijos: los casos se buscan en los datos del dia, y donde hoy
// no hay ninguno se arma uno a mano con una fila real, para que la regla
// muerda igual. Todo lo que se cambia (CATALOGO, window.Image) se deja como
// estaba al terminar cada bloque.
const R = [];
let fallas = 0;
const ok = (c, txt, extra) => { R.push((c?'  OK  ':'FALLA ') + txt + (extra!==undefined?('  ['+extra+']'):'')); if(!c) fallas++; };
const reportar = () => {
  const pre = document.createElement('pre');
  pre.id = 'RESULTADO';
  pre.textContent = '\n===== ' + (fallas ? fallas + ' FALLA(S)' : 'TODO OK') + ' =====\n' + R.join('\n');
  document.body.appendChild(pre);
};

const esperaB2 = setInterval(() => {
  if(!MODELOS.length) return;
  verTodoElCatalogo();
  if(!document.querySelectorAll('.card').length) return;
  clearInterval(esperaB2);
  for(let i = 1; i < 5000; i++) clearInterval(i);
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: ' + (e && e.stack || e)); fallas++; })
    .then(() => {
      try{ cerrarFicha(); }catch(e){}
      try{ pararPaseos(); }catch(e){}
      try{ pararOfertas(); }catch(e){}
      for(let i=1;i<5000;i++) clearInterval(i);
      reportar();
    });
}, 120);

const dormirB2 = ms => new Promise(r => setTimeout(r, ms));
const archivoB2 = u => decodeURIComponent(String(u || '').split('/').pop().split('?')[0]).replace(/\.jpg$/i, '');
const enIndiceB2 = n => !!INDICE_FOTOS && INDICE_FOTOS.has(n + EXT_FOTOS);
const hermanasB2 = (m, v) => (m ? m.variantes : []).filter(x => x !== v &&
  norm(x.sim) === norm(v.sim) && norm(x.teclado) === norm(v.teclado));
const traerB2 = async ruta => {
  const r = await fetch(ruta + '?_=' + Date.now(), { cache:'no-store' });
  if(!r.ok) throw new Error(ruta + ': ' + r.status);
  return r.text();
};
const precargarB2 = urls => Promise.all(urls.filter(Boolean).map(u => new Promise(r => {
  const i = new Image(); i.onload = i.onerror = () => r(); i.src = u;
})));

async function correrPruebas(){
  columnaContraMaestro();
  await fotoDelUltimoToque();
  fotoDeLaHermana();
  sinFotoGeneralConColor();
  dosTonos();
  await clavesDeColores();
  mismoColorDosPrecios();
}

/* ---- [37] La celda CODIGO_VAR no le gana al maestro para el mismo color ----
   Si el maestro tiene ESTE texto de color registrado con una variante, la
   foto del color es esa, diga lo que diga la celda. El caso de la regla
   suelta (una celda que contradice al mapa) esta en CASOS_COLUMNA de
   catalogo_maestro.py y lo corre la tanda t1 contra la web y contra Python. */
function columnaContraMaestro(){
  const pisadas = [];
  let contradicen = 0, revisados = 0;
  for(const p of PRODUCTOS){
    if(!p.codigo) continue;
    for(const c of partirColores(p.color || '')){
      const exacta = archivoDeVariante(p.codigo, c);
      if(!exacta) continue;
      revisados++;
      // Cuantas celdas de ADVAPP dicen otra cosa (informativo: ya se pidio)
      const cols = partirColores(p.color);
      const celda = String(p.codigoVar || '').split('/').map(x => x.trim());
      const i = cols.findIndex(x => norm(x) === norm(c));
      if(celda.length === cols.length && /^AT-\d{4}-\d{2}$/.test(celda[i] || '') && celda[i] !== exacta) contradicen++;
      const primera = nombresDeFoto(p, [c], true)[0];
      if(primera !== exacta) pisadas.push(p.id + ' "' + c + '": ' + primera + ' y el maestro dice ' + exacta);
    }
  }
  ok(pisadas.length === 0, '[37] cuando el maestro tiene la escritura exacta del color, esa es la foto del color',
     pisadas.slice(0, 3).join(' · ') || revisados + ' colores con escritura exacta'
       + (contradicen ? ', ' + contradicen + ' con la celda de ADVAPP en contra (pedido)' : ''));
  // La portada tambien: el Ultra 3 Trail Loop salia con la Ocean Band
  const portadas = [];
  for(const p of PRODUCTOS){
    const c = partirColores(p.color || '')[0];
    if(!p.codigo || !c || !p.imagenGrande || !String(p.imagenGrande).includes(CARPETA_FOTOS)) continue;
    const exacta = archivoDeVariante(p.codigo, c);
    if(exacta && enIndiceB2(exacta) && archivoB2(p.imagenGrande) !== exacta)
      portadas.push(p.id + ': ' + archivoB2(p.imagenGrande) + ' en vez de ' + exacta);
  }
  ok(portadas.length === 0, '[37] ninguna portada usa la variante de la celda cuando el maestro dice otra para ese color',
     portadas.slice(0, 3).join(' · ') || 'ninguna');
}

/* ---- [38] La foto es la del ultimo toque ----
   Se demora a proposito la foto del primer color (se cambia window.Image
   solo para esa direccion) y se toca otra cosa enseguida. Cuando la lenta
   llega, ya no tiene que ponerse. */
const DEMORA_B2 = 700;
async function conFotoLentaB2(lenta, hacer){
  const Real = window.Image;
  window.Image = function(){
    const real = new Real();
    const falsa = { onload: null, onerror: null };
    Object.defineProperty(falsa, 'src', {
      get: () => real.src,
      set: u => {
        const d = u === lenta ? DEMORA_B2 : 0;
        real.onload  = () => setTimeout(() => falsa.onload  && falsa.onload(),  d);
        real.onerror = () => setTimeout(() => falsa.onerror && falsa.onerror(), d);
        real.src = u;
      }
    });
    return falsa;
  };
  try{ return await hacer(); } finally { window.Image = Real; }
}
const fotoFichaB2 = () => {
  const im = document.querySelector('#ficha .fi-marco img');
  return im ? im.getAttribute('src') : '';
};

async function fotoDelUltimoToque(){
  /* (a) Dos colores con fotos distintas: se toca A (lenta) y enseguida B */
  let casoA = null;
  for(const m of MODELOS){
    const v = m.rep;
    if(!v || !v.imagen) continue;
    const { lista } = coloresFicha(v, m);
    if(lista.length < 2) continue;
    const conUrl = lista.map(c => ({ c, u: fotosDeColor(c.fila, c.nombre)[0] || '' }))
                        .filter(x => x.u && x.u.includes(CARPETA_FOTOS));
    for(const a of conUrl){
      const b = conUrl.find(x => x !== a && x.u !== a.u);
      if(b){ casoA = { m, v, a, b }; break; }
    }
    if(casoA) break;
  }
  if(!casoA){
    R.push('  --  [38] hoy ninguna ficha tiene dos colores con fotos distintas');
  }else{
    const { v, a, b } = casoA;
    await precargarB2([a.u, b.u, v.imagenGrande, a.c.fila.imagenGrande, b.c.fila.imagenGrande]);
    await conFotoLentaB2(a.u, async () => {
      abrirFicha(clave(v), null);
      await dormirB2(200);
      const boton = n => [...document.querySelectorAll('#ficha .fi-tono')].find(x => x.dataset.color === n);
      boton(a.c.nombre)?.click();
      await dormirB2(30);
      boton(b.c.nombre)?.click();
      await dormirB2(DEMORA_B2 + 900);
    });
    const marcado = [...document.querySelectorAll('#ficha .fi-tono')]
                      .find(x => x.getAttribute('aria-pressed') === 'true');
    /* 30/09 (vitrina, opcion C): con un nombre de dos partes el renglon dice
       solo la que cambia ("Black Ocean Band" de "Black – Black Ocean Band");
       el color entero va en data-color */
    const nomB2 = document.querySelector('#fi-color-txt');
    const texto = nomB2?.textContent || '';
    ok(fotoFichaB2() === b.u && marcado && marcado.dataset.color === b.c.nombre &&
       nomB2?.dataset.color === b.c.nombre && b.c.nombre.includes(texto.trim()),
       '[38] dos colores tocados rapido: la foto, el puntito y el nombre son del segundo',
       v.id + ': ' + a.c.nombre + ' (lenta) y ' + b.c.nombre + ' -> foto ' + archivoB2(fotoFichaB2())
         + ', marcado ' + (marcado ? marcado.dataset.color : '-') + ', dice "' + texto + '"');
    cerrarFicha();
  }

  /* (b) Un color (lento) y enseguida el boton de otra version que no lo
     tiene: la foto tiene que ser la de la version nueva. Asi salia el iPhone
     Air 1TB Black con la foto Skyblue del 256. */
  /* Los candidatos salen de los datos: una ficha (cualquier variante, no solo
     la del "desde"), un color de la tira con foto propia, y otra version con
     boton (no una "version" que es un color) que no vende ese color y tiene
     otra foto. Se prueban unos pocos en la pagina, hasta que uno sirva. */
  const intentos = [];
  for(const m of MODELOS.filter(x => x.multi)){
    const grupoDe = op => m.variantes.filter(x => x.opcion === op);
    let uno = null;
    for(const v of m.variantes){
      if(!v.imagen) continue;
      for(const c of coloresFicha(v, m).lista){
        const u = fotosDeColor(c.fila, c.nombre)[0] || '';
        if(!u || !u.includes(CARPETA_FOTOS) || u === (v.imagenGrande || v.imagen)) continue;
        const tiene = x => partirColores(x.color || '').some(y => norm(y) === norm(c.nombre));
        const otras = m.variantes.filter(x => x.imagen && (x.imagenGrande || x.imagen) !== u
          && x.opcion !== v.opcion && x.opcion !== c.fila.opcion
          && !opcionEsColor(grupoDe(x.opcion), x.opcion) && !grupoDe(x.opcion).some(tiene));
        if(otras.length){ uno = { m, v, a: { c, u }, tiene, otras }; break; }
      }
      if(uno) break;
    }
    if(uno) intentos.push(uno);
    if(intentos.length >= 6) break;
  }
  let hecho = false;
  for(const { m, v, a, tiene, otras } of intentos){
    await precargarB2([a.u, ...otras.map(x => x.imagenGrande || x.imagen)]);
    let destino = null;
    await conFotoLentaB2(a.u, async () => {
      abrirFicha(clave(v), null);
      await dormirB2(200);
      [...document.querySelectorAll('#ficha .fi-tono')].find(x => x.dataset.color === a.c.nombre)?.click();
      await dormirB2(30);
      const op = [...document.querySelectorAll('#ficha .fi-op')].find(bt => {
        const grupo = m.variantes.filter(x => x.opcion === bt.dataset.op);
        const d = m.variantes.find(x => clave(x) === bt.dataset.k);
        return grupo.length && !grupo.some(x => clave(x) === FICHA) && !grupo.some(tiene)
               && d && otras.includes(d);
      });
      if(!op) return;
      op.click();
      destino = m.variantes.find(x => clave(x) === FICHA) || null;
      await dormirB2(DEMORA_B2 + 900);
    });
    if(!destino){ cerrarFicha(); continue; }
    const espera = destino.imagenGrande || destino.imagen;
    ok(fotoFichaB2() === espera,
       '[38] un color (lento) y enseguida otra version: queda la foto de la version nueva',
       v.id + ' ' + a.c.nombre + ' -> ' + destino.id + ': ' + archivoB2(fotoFichaB2()) + ' (tenia que ser ' + archivoB2(espera) + ')');
    cerrarFicha();
    hecho = true;
    break;
  }
  if(!hecho) R.push('  --  [38] hoy no hay un color con foto y otra version sin el para probar');
}

/* ---- [40] La foto de la hermana del mismo color ----
   Pedro, 26/09: el mismo modelo con otra memoria se ve igual. Sim/eSIM y
   teclado ES/EN no: son productos distintos. */
function fotoDeLaHermana(){
  const faltan = [];
  for(const m of MODELOS) for(const v of m.variantes){
    if(v.imagen) continue;
    const c = partirColores(v.color || '')[0];
    if(!c) continue;
    const hay = hermanasB2(m, v).find(x => nombresDeFoto(x, [c], true).some(enIndiceB2));
    if(hay) faltan.push(v.id + ' ' + c + (v.stock ? ' (con stock)' : '') + ' <- ' + hay.id);
  }
  ok(faltan.length === 0, '[40] ninguna variante queda sin foto si una hermana del mismo color, Sim y teclado la tiene',
     faltan.slice(0, 3).join(' · ') || 'ninguna');

  const distintas = MODELOS.filter(m => m.imagen !== m.rep.imagen || m.imagenGrande !== m.rep.imagenGrande);
  ok(distintas.length === 0, '[40] la tarjeta muestra la foto de su representante',
     distintas.slice(0, 3).map(m => m.desc).join(' · ') || MODELOS.length + ' modelos');

  // Entre empatados al precio del "desde", el representante es uno con foto
  const tapadas = MODELOS.filter(m => !m.imagen && m.variantes.some(x =>
    x.imagen && x.precio === m.precio && !!x.stock === !!m.rep.stock));
  ok(tapadas.length === 0, '[40] ninguna tarjeta sale sin foto teniendo una empatada en precio y stock que la tiene',
     tapadas.slice(0, 3).map(m => m.desc + ' (' + m.rep.id + ')').join(' · ') || 'ninguna');

  // Y nunca sube a una fila mas cara por tener foto: el "desde" es del rep
  const caras = MODELOS.filter(m => m.rep.precio !== m.precio);
  ok(caras.length === 0, '[40] el representante es siempre del precio "desde"',
     caras.slice(0, 3).map(m => m.desc).join(' · ') || 'todos');

  /* Las dos reglas sueltas, con copias de filas reales, para que muerdan
     aunque hoy los datos no traigan el caso (el empate del A57 y del MBP 16
     se deshizo solo cuando ADVAPP cambio los precios). El codigo AT-9998 no
     existe: esas filas no tienen ningun archivo propio. */
  const x = PRODUCTOS.find(p => p.imagen && p.precio !== null && p.codigo &&
    partirColores(p.color || '').length === 1 &&
    nombresDeFoto(p, partirColores(p.color), true).some(enIndiceB2));
  if(!x){ R.push('  --  [40] no hay ninguna fila de un color con foto propia para armar el caso'); return; }
  const c = partirColores(x.color)[0];
  const n = nombresDeFoto(x, [c], true).find(enIndiceB2);
  const sinNada = { codigo: 'AT-9998', codigoVar: '', imagen: '', imagenGrande: '', fotosAdvapp: {} };
  const conFoto = { ...x, id: 'PRUEBA-B2-F0' };
  const otraMemoria = { ...x, ...sinNada, id: 'PRUEBA-B2-F1', sku: 'PRUEBA-B2-F1', precio: x.precio + 1 };
  const otraSim = { ...x, ...sinNada, id: 'PRUEBA-B2-F2', sku: 'PRUEBA-B2-F2', precio: x.precio + 2,
                    sim: norm(x.sim) === 'sim' ? 'E-Sim' : 'Sim' };
  armarModelo([conFoto, otraMemoria, otraSim]);
  ok(otraMemoria.imagenGrande === urlFoto(CARPETA_FOTOS + encodeURIComponent(n) + EXT_FOTOS) && !otraSim.imagen,
     '[40] la fila sin foto toma la de la hermana del mismo color, y la de otra Sim no',
     x.id + ' ' + c + ': otra memoria -> ' + (archivoB2(otraMemoria.imagenGrande) || 'nada')
       + ', otra Sim -> ' + (archivoB2(otraSim.imagenGrande) || 'nada'));

  const r1 = { ...x, ...sinNada, id: 'PRUEBA-B2-R1', sku: 'PRUEBA-B2-R1', color: 'Zzz Uno', stock: true };
  const r2 = { ...x, id: 'PRUEBA-B2-R2', sku: 'PRUEBA-B2-R2', codigo: 'AT-9998', codigoVar: '', fotosAdvapp: {},
               color: 'Zzz Dos', stock: true };
  const mr = armarModelo([r1, r2]);
  ok(mr.rep === r2 && mr.imagen === r2.imagen,
     '[40] entre dos empatadas en precio y con stock, la tarjeta usa la que tiene foto',
     'rep ' + mr.rep.id + ', foto ' + (archivoB2(mr.imagen) || 'ninguna'));
}

/* ---- [43] Una fila con color no muestra una foto que no es de su color ----
   La portada de una fila con color tiene que ser la de alguno de SUS
   colores, o la del primero sacada de una hermana (ver [40]). Nunca la foto
   general del producto: esa no tiene color anotado. */
function sinFotoGeneralConColor(){
  const ajenas = [];
  let revisadas = 0;
  for(const m of MODELOS) for(const p of m.variantes){
    const cols = partirColores(p.color || '');
    if(!cols.length || !p.imagenGrande || !String(p.imagenGrande).includes(CARPETA_FOTOS)) continue;
    revisadas++;
    const validos = new Set(nombresDeFoto(p, cols, true));
    for(const x of hermanasB2(m, p)) for(const n of nombresDeFoto(x, [cols[0]], true)) validos.add(n);
    const n = archivoB2(p.imagenGrande);
    if(!validos.has(n)) ajenas.push(p.id + ' [' + p.color + '] -> ' + n);
  }
  ok(ajenas.length === 0, '[43] ninguna fila con color tiene de portada una foto que no es de su color',
     ajenas.slice(0, 3).join(' · ') || revisadas + ' filas con color y foto propia');

  // La regla suelta, para que muerda aunque hoy no haya ningun caso
  const guardado = CATALOGO;
  try{
    CATALOGO = { vars: { 'AT-9003': { '': 'AT-9003' } } };
    const conColor = nombresDeFoto({ codigo: 'AT-9003', color: 'Gray' }, ['Gray']);
    const sinColor = nombresDeFoto({ codigo: 'AT-9003', color: '' }, []);
    ok(!conColor.includes('AT-9003') && sinColor.includes('AT-9003'),
       '[43] un producto sin variantes da su foto a la fila sin color y no a la que dice un color',
       'con color: [' + conColor.join(', ') + '] · sin color: [' + sinColor.join(', ') + ']');
  }finally{ CATALOGO = guardado; }
}

/* ---- [45] Los de dos tonos se pintan con el primero ---- */
function dosTonos(){
  const hex = n => (pintas(n)[0] || {}).hex;
  ok(hex('Titanio Gris · Blanco') === COLORES['titanio gris'] &&
     hex('Shiny Black · Transitions Green') === COLORES['shiny black'] &&
     hex('Natural – Blue Trail Loop M/L') === COLORES['natural'],
     '[45] el tono de un color de dos tonos es el del primero',
     hex('Titanio Gris · Blanco') + ' / ' + hex('Shiny Black · Transitions Green') + ' / ' + hex('Natural – Blue Trail Loop M/L'));
  // Con guion sin espacios sigue siendo UN color (no se parte "Rose-Gold")
  ok(pintas('Rose-Gold').length === 1, '[45] "Rose-Gold" sigue siendo un solo color');

  // Los de hoy: ninguno con el primer tono conocido se pinta con otro
  const mal = new Set();
  for(const p of PRODUCTOS) for(const c of pintas(p.color || '')){
    const partes = c.nombre.split(/\s*·\s*|\s+[-–]\s+/);
    if(partes.length < 2) continue;
    const primero = hexColor(partes[0]);
    if(primero && c.hex !== primero) mal.add(c.nombre + ' -> ' + c.hex);
  }
  ok(mal.size === 0, '[45] ningun color de dos tonos de hoy se pinta con el segundo', [...mal].slice(0, 3).join(' · ') || 'ninguno');

  // Pero dos opciones distintas de la misma ficha no quedan del mismo tono
  // si el nombre entero las distingue (los Skyler: el cristal)
  const sky = { id: 'PRUEBA-B2-SKY', color: 'Shiny Black · Transitions Green/Shiny Black · Transitions Amethyst', precio: 100 };
  const l = coloresFicha(sky, { variantes: [sky] }).lista;
  ok(l.length === 2 && l[0].hex && l[1].hex && l[0].hex !== l[1].hex,
     '[45] dos colores de la misma ficha con el mismo primer tono se distinguen por el nombre entero',
     l.map(c => c.nombre + ' ' + c.hex).join(' / '));
  const iguales = [];
  for(const m of MODELOS) for(const v of m.variantes){
    const lista = coloresFicha(v, m).lista;
    for(let i = 0; i < lista.length; i++) for(let j = i + 1; j < lista.length; j++){
      const a = lista[i], b = lista[j];
      if(a.hex && a.hex === b.hex && ((a.hexEntero && a.hexEntero !== a.hex) || (b.hexEntero && b.hexEntero !== b.hex)))
        iguales.push(v.id + ': ' + a.nombre + ' = ' + b.nombre);
    }
  }
  ok(iguales.length === 0, '[45] en ninguna ficha de hoy dos colores que el nombre distingue quedan del mismo tono',
     iguales.slice(0, 3).join(' · ') || 'ninguna');
}

/* ---- [46] COLORES sin claves repetidas ----
   En un objeto vale la ULTIMA: con una clave dos veces, corregir el tono de
   la de arriba no cambia nada en pantalla. Se cuenta sobre el texto, porque
   el objeto ya armado no guarda las repetidas. validar.py avisa lo mismo. */
async function clavesDeColores(){
  // La pagina que esta corriendo (la copia que arma correr.py), no otra
  const src = await traerB2(location.pathname.replace(/^\//, '') || 'index.html');
  const bloque = (src.match(/const COLORES = \{([\s\S]*?)\r?\n\};/) || [])[1];
  ok(!!bloque, '[46] se encuentra el mapa COLORES en index.html');
  if(!bloque) return;
  const sinComentarios = bloque.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  const vistas = new Map();
  for(const m of sinComentarios.matchAll(/(?:'([^']+)'|([A-Za-z][A-Za-z0-9]*))\s*:\s*'#[0-9A-Fa-f]{6}'/g)){
    const k = norm(m[1] || m[2]);
    vistas.set(k, (vistas.get(k) || 0) + 1);
  }
  const repetidas = [...vistas].filter(([, n]) => n > 1).map(([k]) => k);
  ok(repetidas.length === 0, '[46] ninguna clave de COLORES esta dos veces', repetidas.join(', ') || vistas.size + ' claves');
  ok(vistas.size === Object.keys(COLORES).length, '[46] el texto y el mapa tienen las mismas claves',
     vistas.size + ' en el texto, ' + Object.keys(COLORES).length + ' en el mapa');
}

/* ---- [51] El mismo color a dos precios: el codigo no elige ----
   Hoy no hay ningun caso (validar.py lo marca GRAVE), asi que se arma con una
   fila real: la misma fila copiada con USD 10 mas. */
function mismoColorDosPrecios(){
  const v = PRODUCTOS.find(p => partirColores(p.color || '').length === 1 && p.precio !== null && p.id);
  if(!v){ R.push('  --  [51] no hay ninguna fila de un color con precio para armar el caso'); return; }
  const color = partirColores(v.color)[0];
  const a = { ...v, id: 'PRUEBA-B2-A' };
  const b = { ...v, id: 'PRUEBA-B2-B', precio: v.precio + 10 };
  const m = armarModelo([a, b]);
  ok(m.variantes.length === 2 && (b.hermanasColor || []).includes(a),
     '[51] el caso armado tiene las dos filas como hermanas de color', v.id + ' ' + color);
  const suyo = x => coloresFicha(x, m).lista.find(c => norm(c.nombre) === norm(color));
  ok(suyo(b) && suyo(b).k === clave(b) && suyo(a) && suyo(a).k === clave(a),
     '[51] en la ficha de cada fila, su propio color la deja en ella (no salta a la mas barata)',
     'la de ' + b.precio + ' -> ' + (suyo(b) ? suyo(b).k : '-') + ' · la de ' + a.precio + ' -> ' + (suyo(a) ? suyo(a).k : '-'));

  // Una fila que NO declara ese color no lo ofrece: no hay precio que darle
  const d = { id: 'PRUEBA-B2-D', color: 'Zzz Prueba', precio: v.precio + 20 };
  d.hermanasColor = [a, b, d];
  const ld = coloresFicha(d, null).lista.map(c => c.nombre);
  ok(!ld.some(n => norm(n) === norm(color)),
     '[51] un color a dos precios no aparece en la tira de una fila que no lo tiene', ld.join(' / '));

  // Con el mismo precio se sigue juntando: un puntito por color
  const p1 = { id: 'PRUEBA-B2-P1', color: 'White', precio: 100 };
  const p2 = { id: 'PRUEBA-B2-P2', color: 'White/Black', precio: 100 };
  p1.hermanasColor = p2.hermanasColor = [p1, p2];
  const l1 = coloresFicha(p1, null).lista.map(c => c.nombre);
  ok(l1.filter(n => n === 'White').length === 1 && l1.includes('Black'),
     '[51] el mismo color al mismo precio en dos filas sigue siendo un solo puntito', l1.join(' / '));
}
