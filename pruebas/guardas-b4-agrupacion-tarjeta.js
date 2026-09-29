// Guardas de la tanda B4, agrupacion, versiones, titulos y tarjeta (auditoria
// del 29/09/2026). Cada bloque es un error que se encontro y se arreglo: si
// vuelve, falla aca. El numero entre corchetes es el del hallazgo.
//
//  [19] El "desde" y la fila de la tarjeta salian de una variante AGOTADA
//       (iPhone Air "desde USD 1.030" con lo disponible desde 1.200; el +
//       cargaba la fila sin stock). Lo mismo el "desde" de las pestanas.
//  [20] Dos tarjetas "Quest 3S" iguales: el bundle perdia el "+ Batman".
//  [21] Pestanas recortadas que se contradicen ("8GB" contra "5G").
//  [24] Pestanas del teclado en minuscula ("ingles / espanol").
//  [25] La firma de gemelas no miraba la Sim: una Sim y una eSIM iguales
//       se colapsaban (y validar.py tiene que mirar lo mismo).
//  [29] La marca dos veces: "APPLE / Apple iPhone 17 Pro Max".
//  [23] Pestana "Base" cuando el SKU dice que es la Wifi.
//  [70] La tarjeta agotada mandaba "Me interesa" en vez del aviso.
//  [129] Botones de la tarjeta y del pedido sin el nombre del producto.
//  [135] Niveles de titulo: los productos al mismo nivel que su seccion.
//  [18] "3Y Warranty", "White Box" e "Incluye Solo S-Pen" en el nombre.
//  [195] Los Magic Keyboard con "Chip M3" como si tuvieran procesador.
//  [84] "Estas eligiendo" repetia el color cuando la version es un color.
//
// Los casos se buscan en los datos del dia, y ademas cada regla se prueba con
// filas armadas (copias de una fila real con otro nombre, codigo AT-9997 que
// no existe), para que muerda aunque ADVAPP arregle el dato de hoy.
const R = [];
let fallas = 0;
const ok = (c, txt, extra) => { R.push((c?'  OK  ':'FALLA ') + txt + (extra!==undefined?('  ['+extra+']'):'')); if(!c) fallas++; };
const nota = txt => R.push('  --   ' + txt);
const reportar = () => {
  const pre = document.createElement('pre');
  pre.id = 'RESULTADO';
  pre.textContent = '\n===== ' + (fallas ? fallas + ' FALLA(S)' : 'TODO OK') + ' =====\n' + R.join('\n');
  document.body.appendChild(pre);
};

const esperaB4 = setInterval(() => {
  if(!MODELOS.length || !document.querySelectorAll('#cats .chip').length ||
     typeof INDICE_FOTOS === 'undefined' || !INDICE_FOTOS) return;
  clearInterval(esperaB4);
  for(let i = 1; i < 5000; i++) clearInterval(i);
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: ' + (e && e.stack || e)); fallas++; })
    .then(() => {
      try{ cerrarFicha(); }catch(e){}
      try{ pararPaseos(); }catch(e){}
      try{ pararOfertas(); }catch(e){}
      try{ pararNuevos(); }catch(e){}
      try{ pararMarcas(); }catch(e){}
      try{ pararMundos(); }catch(e){}
      for(let i = 1; i < 5000; i++) clearInterval(i);
      reportar();
    });
}, 150);

async function correrPruebas(){
  // [135] va primero: mira la portada tal como abre, antes de tocar nada
  const bloques = [niveles, desdeConStock, agregadoDelGrupo, pestanasQueSeContradicen, tecladoConMayuscula,
                   simEnLaFirma, marcaDosVeces, pestanaBase, tarjetaAgotada, botonesConNombre,
                   notasDelProveedor, chipDelTeclado, colorRepetido];
  for(const b of bloques){
    try{ await b(); }
    catch(e){ R.push('EXCEPCION en ' + b.name + ': ' + (e && e.stack || e)); fallas++; }
  }
}

/* ---- Filas armadas ----
   Una fila real de base, con otro nombre, sin fotos (AT-9997 no existe) y
   sin nada de lo que distingue: cada caso pone lo que necesita. */
const baseB4 = () => {
  const x = PRODUCTOS.find(p => p.precio !== null && p.marca) || PRODUCTOS[0];
  return { ...x, codigo: 'AT-9997', codigoVar: '', imagen: '', imagenGrande: '', fotosAdvapp: {},
           grupo: 'prueba-b4', color: '', incluye: '', teclado: '', condicion: '', garantia: '',
           sim: '', conexion: '', stock: true, antes: null, marca: 'Zzz' };
};
let nFilaB4 = 0;
const filaB4 = (desc, extra = {}) => {
  nFilaB4++;
  return { ...baseB4(), id: 'PRUEBA-B4-' + nFilaB4, sku: 'prueba~b4~' + nFilaB4, desc, ...extra };
};
// Las pestanas de la ficha de m abierta en v, como {rot, tabs:[{t, p, k, op, agotada}]}
function ejesB4(m, v){
  const h = htmlOpcionesFicha(m, v);
  if(!h) return [];
  const d = document.createElement('div');
  d.innerHTML = h;
  return [...d.querySelectorAll('.fi-eje')].map(e => ({
    rot: e.querySelector('.fi-eje-rot').textContent.trim(),
    chicas: e.querySelector('.fi-ops').classList.contains('chicas'),
    tabs: [...e.querySelectorAll('.fi-op')].map(b => ({
      t: b.querySelector('b').textContent.trim(), p: b.querySelector('i').textContent.trim(),
      k: b.dataset.k, op: b.dataset.op, mem: b.dataset.mem, agotada: b.classList.contains('agotada') }))
  }));
}
const numB4 = s => { const m = /USD\s*([\d.]+)/.exec(s || ''); return m ? Number(m[1].replace(/\./g, '')) : null; };

/* ---- [19] El "desde" es de lo que se puede comprar ---- */
function desdeConStock(){
  const vendibles = m => {
    const cp = m.variantes.filter(v => v.precio !== null);
    return cp.some(v => v.stock) ? cp.filter(v => v.stock) : cp;
  };
  const malDesde = MODELOS.filter(m => {
    const b = vendibles(m);
    return b.length && m.precio !== Math.min(...b.map(v => v.precio));
  });
  ok(!malDesde.length, '[19] el "desde" de cada tarjeta es la mas barata CON stock (o de todas si ninguna tiene)',
     malDesde.slice(0, 3).map(m => m.desc + ' ' + m.precio).join(' · ') || MODELOS.length + ' modelos');
  const repAgotado = MODELOS.filter(m => m.stock && m.variantes.some(v => v.stock && v.precio !== null) && !m.rep.stock);
  ok(!repAgotado.length, '[19] una tarjeta con stock nunca abre ni carga al pedido una fila agotada (m.rep)',
     repAgotado.slice(0, 3).map(m => m.desc + ' -> ' + m.rep.id).join(' · ') || 'ninguna');
  ok(MODELOS.every(m => m.precio === null || m.rep.precio === m.precio),
     '[19] el rep es del precio del "desde" (el "Ahorras" resta dos numeros de la MISMA fila)');

  // Las pestanas de la ficha: el numero de una disponible es el de una fila con stock
  const malas = [];
  MODELOS.filter(m => m.multi).forEach(m => ejesB4(m, m.rep).forEach(e => e.tabs.forEach(t => {
    const n = numB4(t.p);
    if(t.agotada || n === null) return;
    if(!m.variantes.some(v => v.stock && v.precio === n)) malas.push(m.desc + ' ' + t.t + ' "' + t.p + '"');
  })));
  ok(!malas.length, '[19] ninguna pestana disponible anuncia el precio de una fila agotada',
     malas.slice(0, 3).join(' · ') || 'ninguna');

  // Armado: la mas barata agotada, dentro de la misma memoria y en el modelo
  const r1 = filaB4('Zzz Prueba 128GB (Black)', { color: 'Black', precio: 110 });
  const r2 = filaB4('Zzz Prueba 256GB (Black)', { color: 'Black', precio: 100, stock: false });
  const r3 = filaB4('Zzz Prueba 256GB (White)', { color: 'White', precio: 120 });
  const m = armarModelo([r1, r2, r3]);
  ok(m.precio === 110 && m.rep === r1 && m.precioMax === 120,
     '[19] armado: con la de USD 100 agotada, la tarjeta dice 110 y abre en esa fila',
     'precio ' + m.precio + ', rep ' + m.rep.desc);
  const tab = (ejesB4(m, r1)[0] || { tabs: [] }).tabs.find(t => t.mem === '256GB');
  ok(!!tab && numB4(tab.p) === 120 && clave(r3) === tab.k,
     '[19] armado: la pestana 256GB dice el precio de la fila a la que lleva (120, no el 100 agotado)',
     tab ? tab.t + ' ' + tab.p : 'sin pestana');
  const todas = armarModelo([filaB4('Zzz Otro 128GB', { precio: 90, stock: false }),
                             filaB4('Zzz Otro 256GB', { precio: 80, stock: false })]);
  ok(todas.precio === 80, '[19] armado: si ninguna tiene stock, el de siempre (la mas barata de todas)', todas.precio);
}

/* ---- [20] El agregado comun ("+ Batman") no se pierde ---- */
function agregadoDelGrupo(){
  const por = new Map();
  MODELOS.forEach(m => {
    const k = [m.marca, m.titulo || m.desc, m.tecnica || ''].map(norm).join('|');
    if(!por.has(k)) por.set(k, []);
    por.get(k).push(m);
  });
  const iguales = [...por.entries()].filter(([, l]) => l.length > 1);
  ok(!iguales.length, '[20] no hay dos tarjetas con la misma marca, titulo y linea tecnica',
     iguales.slice(0, 3).map(([k, l]) => k + ' x' + l.length).join(' · ') || MODELOS.length + ' tarjetas');

  const bat = MODELOS.find(m => m.multi && m.variantes.every(v => /\+\s*batman/i.test(v.desc)));
  if(bat){
    const [n, ver] = partesElegido(bat, bat.rep);
    ok(/batman/i.test(bat.desc) && /batman/i.test(mensajeWA(bat)) && !bat.variantes.some(v => /batman/i.test(v.opcion || v.etiqueta)) &&
       ((n + ver).match(/batman/ig) || []).length === 1,
       '[20] el Quest 3S + Batman: el WhatsApp de la tarjeta lo nombra, los botones dicen solo la memoria y "Estas eligiendo" no lo repite',
       bat.titulo + ' / ' + bat.tecnica + ' / ' + n + ver);
  }else nota('[20] hoy no hay un modelo "+ Batman" con varias versiones');

  const a = armarModelo([filaB4('Zzz Prueba 128GB + Extra Uno'), filaB4('Zzz Prueba 256GB + Extra Uno', { precio: 999 })]);
  const pa = partirTitulo(a);
  ok(a.desc === 'Zzz Prueba + Extra Uno' && a.variantes.map(v => v.etiqueta).sort().join(',') === '128GB,256GB' &&
     pa.titulo === 'Zzz Prueba' && pa.tecnica === '+ Extra Uno',
     '[20] armado: "+ Extra" comun va al nombre (linea tecnica) y sale de los botones',
     a.desc + ' / ' + a.variantes.map(v => v.etiqueta).join(','));
  const g = armarModelo([filaB4('Zzz Prueba 128GB - Extra'), filaB4('Zzz Prueba 256GB - Extra', { precio: 999 })]);
  ok(g.desc === 'Zzz Prueba - Extra' && g.variantes.map(v => v.etiqueta).sort().join(',') === '128GB,256GB',
     '[20] armado: con " - " igual', g.desc + ' / ' + g.variantes.map(v => v.etiqueta).join(','));
  const c = armarModelo([filaB4('Zzz Prueba 128GB 5G'), filaB4('Zzz Prueba 256GB 5G', { precio: 999 })]);
  ok(c.desc === 'Zzz Prueba', '[20] armado: un "5G" comun al final no es un agregado y no se toca', c.desc);
}

/* ---- [21] Un eje recortado no inventa diferencias ---- */
function pestanasQueSeContradicen(){
  ok(JSON.stringify(sinLoComun(['8GB 5G', '8GB'])) === JSON.stringify(['8GB 5G', '8GB']),
     '[21] si a una pestana no le queda nada, el eje no se recorta', sinLoComun(['8GB 5G', '8GB']).join(' / '));
  ok(JSON.stringify(sinLoComun(['Teclado inglés', 'Teclado español'])) === JSON.stringify(['inglés', 'español']),
     '[21] y si a todas les queda algo, se recorta como siempre', sinLoComun(['Teclado inglés', 'Teclado español']).join(' / '));
  // En los datos: una palabra que tienen TODAS las versiones no puede verse en unas si y en otras no
  const mal = [], vistos = new Set();
  MODELOS.filter(m => m.multi).forEach(m => m.variantes.forEach(v => ejesB4(m, v).forEach(e => {
    if(!e.chicas || e.tabs.length < 2) return;
    const k = m.desc + '|' + e.tabs.map(t => t.t).join('/');
    if(vistos.has(k)) return;
    vistos.add(k);
    const restos = e.tabs.map(t => norm(restoDeOpcion(t.op)).split(/\s+/).filter(Boolean));
    const comunes = restos[0].filter(w => restos.every(r => r.includes(w)));
    comunes.forEach(w => {
      const la = e.tabs.filter(t => norm(t.t).split(/\s+/).includes(w)).length;
      if(la && la < e.tabs.length) mal.push(m.desc + ': ' + e.tabs.map(t => t.t).join(' / '));
    });
  })));
  ok(!mal.length, '[21] ninguna pestana de version muestra una palabra comun a todas que a otra se le saco',
     mal.slice(0, 3).join(' · ') || vistos.size + ' ejes de version');
}

/* ---- [24] El idioma del teclado, con mayuscula ---- */
function tecladoConMayuscula(){
  const minus = [];
  MODELOS.filter(m => m.multi).forEach(m => m.variantes.forEach(v => ejesB4(m, v).forEach(e =>
    e.tabs.forEach(t => { if(/^(inglés|español|ingles|espanol)/.test(t.t)) minus.push(m.desc + ': ' + t.t); }))));
  ok(!minus.length, '[24] ninguna pestana arranca con el idioma en minuscula', [...new Set(minus)].slice(0, 3).join(' · ') || 'ninguna');
  const m = armarModelo([filaB4('Zzz Mac 8GB/256GB Teclado ES'), filaB4('Zzz Mac 8GB/256GB Teclado EN', { precio: 998 }),
                         filaB4('Zzz Mac 8GB/512GB Teclado ES', { precio: 999 })]);
  const ver = ejesB4(m, m.variantes[0]).find(e => e.chicas);
  const txt = ver ? ver.tabs.map(t => t.t).sort().join(' / ') : '';
  ok(txt === 'Español / Inglés' && ver.tabs.every(t => /teclado (español|inglés)/i.test(t.op)),
     '[24] armado: "Español / Inglés", y la opcion (data-op) sigue como estaba', txt + ' · ' + (ver ? ver.tabs.map(t => t.op).join(' / ') : ''));
}

/* ---- [25] La Sim entra en la firma de gemelas ---- */
async function simEnLaFirma(){
  const a = filaB4('Zzz Prueba 256GB (Black)', { color: 'Black', precio: 500, sim: 'Sim' });
  const b = filaB4('Zzz Prueba 256GB (Black)', { color: 'Black', precio: 500, sim: 'E-Sim' });
  const c = filaB4('Zzz Prueba 512GB (Black)', { color: 'Black', precio: 600, sim: 'Sim' });
  const m = armarModelo([a, b, c]);
  ok(m.variantes.length === 3 && !m.gemelas.length,
     '[25] armado: una Sim y una eSIM con el mismo nombre, color y precio no se colapsan',
     m.variantes.length + ' variantes, ' + m.gemelas.length + ' gemelas');
  ok(a.etiqueta === '256GB Sim' && b.etiqueta === '256GB E-Sim' && c.etiqueta === '512GB',
     '[25] armado: y cada boton dice la suya, sin el ID interno', [a, b, c].map(v => v.etiqueta).join(' / '));
  const d = filaB4('Zzz Prueba 256GB (Black)', { color: 'Black', precio: 500, sim: 'Sim' });
  const e = filaB4('Zzz Prueba 256GB (Black)', { color: 'Black', precio: 500, sim: 'Sim' });
  const m2 = armarModelo([d, e]);
  ok(m2.variantes.length === 1 && m2.gemelas.length === 1, '[25] armado: dos filas iguales de verdad se siguen colapsando',
     m2.variantes.length + ' variantes');
  // validar.py tiene que mirar lo mismo que firmaVisible (su comentario lo exige)
  let py = '';
  try{ const r = await fetch('validar.py', { cache: 'no-store' }); if(r.ok) py = await r.text(); }catch(err){}
  if(!py){ nota('[25] no pude leer validar.py desde la pagina'); return; }
  // Las dos lineas del `extra` de sin_color (validar.py va con CRLF)
  const extra = (/extra = \(\(f\.get\('Incluye'\)[^\n]*\n[^\n]*/.exec(py) || [''])[0];
  ok(/v\.sim/.test(String(firmaVisible)) && /sim_de_la_fila\(f\)/.test(extra),
     '[25] firmaVisible() y el sin_color de validar.py miran los dos la Sim', extra.trim().replace(/\s+/g, ' ').slice(0, 120));
}

/* ---- [29] La marca no se repite en el titulo ---- */
function marcaDosVeces(){
  const empieza = m => {
    const t = m.titulo || m.desc || '', s = sinMarca(t, m.marca);
    return s !== t && s.split(/\s+/).filter(Boolean).length >= 2;
  };
  const mal = MODELOS.filter(m => empieza(m) || empieza({ titulo: m.desc, marca: m.marca }));
  ok(!mal.length, '[29] ningun titulo ni nombre de modelo empieza con su marca (la marca va arriba)',
     mal.slice(0, 3).map(m => m.marca + ' / ' + (m.titulo || m.desc)).join(' · ') || MODELOS.length + ' modelos');
  const pm = MODELOS.find(m => m.variantes.every(v => norm(v.desc).startsWith(norm(m.marca) + ' ')) && m.multi);
  if(pm) ok(norm(nombreConMarca(pm)).startsWith(norm(pm.marca) + ' '), '[29] y el WhatsApp la sigue nombrando', nombreConMarca(pm));
  else nota('[29] hoy ningun modelo trae la marca en todas sus filas');
  const n1 = nombreGrupo([{ desc: 'Apple iPhone 99 Pro 128GB', marca: 'Apple' }, { desc: 'Apple iPhone 99 Pro 256GB', marca: 'Apple' }]);
  const n2 = nombreGrupo([{ desc: 'Apple Pencil', marca: 'Apple' }]);
  ok(n1 === 'iPhone 99 Pro' && n2 === 'Apple Pencil',
     '[29] armado: "Apple iPhone 99 Pro" sale sin la marca, "Apple Pencil" no queda en "Pencil"', n1 + ' / ' + n2);
}

/* ---- [23] "Wifi" y no "Base" cuando el SKU lo dice ---- */
function pestanaBase(){
  ok(conexionDelSku('tablet~apple~ipad-m5-pro~11in-256gb-wifi') === 'Wifi' &&
     conexionDelSku('TAB-APL-IPADPRO11M5-256-SBK-CELL') === 'Cellular' &&
     conexionDelSku('tablet~samsung~x~12gb-256gb-wifipen') === '' && conexionDelSku('') === '',
     '[23] Wifi / Cellular se leen del final del SKU ("-wifipen" no cuenta)');
  const mal = [];
  MODELOS.filter(m => m.multi).forEach(m => ejesB4(m, m.rep).concat(...m.variantes.map(v => ejesB4(m, v))).forEach(e => {
    const base = e.tabs.find(t => t.t === 'Base');
    if(!base) return;
    const g = m.variantes.filter(x => (x.opcion || x.etiqueta) === base.op);
    if(g.every(x => x.conexion === 'Wifi') && e.tabs.some(t => /cell/i.test(t.t))) mal.push(m.desc);
  }));
  ok(!mal.length, '[23] ninguna pestana dice "Base" al lado de Cellular si ADVAPP dice que es la Wifi',
     [...new Set(mal)].slice(0, 3).join(' · ') || 'ninguna');
  const w = filaB4('Zzz Tab 256GB', { conexion: 'Wifi', precio: 500 });
  const cel = filaB4('Zzz Tab 256GB Cellular', { conexion: 'Cellular', precio: 600 });
  const m = armarModelo([w, cel, filaB4('Zzz Tab 512GB', { conexion: 'Wifi', precio: 700 })]);
  const ver = ejesB4(m, w).find(e => e.chicas);
  ok(!!ver && ver.tabs.map(t => t.t).sort().join('/') === 'Cellular/Wifi',
     '[23] armado: "Wifi" contra "Cellular"', ver ? ver.tabs.map(t => t.t).join('/') : 'sin eje');
  const w2 = filaB4('Zzz Tab 256GB', { precio: 500 });
  const m2 = armarModelo([w2, filaB4('Zzz Tab 256GB Cellular', { conexion: 'Cellular', precio: 600 }),
                          filaB4('Zzz Tab 512GB', { precio: 700 })]);
  const ver2 = ejesB4(m2, w2).find(e => e.chicas);
  ok(!!ver2 && ver2.tabs.some(t => t.t === 'Base'), '[23] armado: sin SKU que lo diga sigue "Base" (no se adivina)',
     ver2 ? ver2.tabs.map(t => t.t).join('/') : 'sin eje');
}

/* ---- [70] La tarjeta agotada manda el aviso ---- */
function tarjetaAgotada(){
  if(!WHATSAPP){ nota('[70] sin numero de WhatsApp configurado no hay boton'); return; }
  const sin = MODELOS.filter(m => !m.stock), con = MODELOS.filter(m => m.stock);
  const texto = a => a ? decodeURIComponent(a.getAttribute('href').split('text=')[1] || '') : '';
  const malSin = sin.filter(m => {
    const a = tarjeta(m).querySelector('a.wa');
    return !a || !/figura sin stock/.test(texto(a)) || !/^Avisame cuando entre/.test(a.getAttribute('aria-label'));
  });
  ok(!malSin.length, '[70] cada tarjeta sin stock manda "figura sin stock" y dice "Avisame cuando entre"',
     malSin.slice(0, 3).map(m => m.desc).join(' · ') || sin.length + ' sin stock');
  const malCon = con.slice(0, 80).filter(m => {
    const a = tarjeta(m).querySelector('a.wa');
    return !a || !/Me interesa/.test(texto(a)) || !/^Consultar por WhatsApp/.test(a.getAttribute('aria-label'));
  });
  ok(!malCon.length, '[70] y la que tiene stock sigue con la consulta de siempre',
     malCon.slice(0, 3).map(m => m.desc).join(' · ') || 'bien');
}

/* ---- [129] El lector de pantalla sabe de que producto es cada boton ---- */
function botonesConNombre(){
  const mal = MODELOS.slice(0, 120).filter(m => {
    const el = tarjeta(m), n = nombreCorto(m);
    const mas = el.querySelector('.mas'), wa = el.querySelector('a.wa');
    // La agotada no tiene + desde el 29/09 (decision 2.6 B, decision-tarjeta.js):
    // ahi se mira solo el WhatsApp; con stock, el + tiene que estar
    if(!mas) return !!m.stock || (wa && !wa.getAttribute('aria-label').includes(n));
    return !mas.getAttribute('aria-label').includes(n) || (wa && !wa.getAttribute('aria-label').includes(n));
  });
  ok(!mal.length, '[129] el "+" y el WhatsApp de la tarjeta nombran el producto',
     mal.slice(0, 3).map(m => m.desc).join(' · ') || 'bien');
  // El pedido: dos productos, cada fila con su nombre en la cruz y en el - / +
  const antes = PEDIDO.slice();
  try{
    const dos = MODELOS.filter(m => m.stock && m.precio !== null).slice(0, 2);
    PEDIDO = [];
    dos.forEach(m => togglePedido(clave(m.rep)));
    abrirPedido();
    const filas = [...document.querySelectorAll('#pedido .pd-item')];
    const labels = filas.map(f => [f.querySelector('.pd-quitar'), ...f.querySelectorAll('.stepper button')]
      .map(b => b.getAttribute('aria-label')));
    const bien = filas.length === dos.length && filas.every((f, i) => {
      const p = buscarProducto(f.dataset.key);
      return p && labels[i].every(l => l.includes(p.desc));
    }) && new Set(labels.map(l => l[0])).size === filas.length;
    ok(bien, '[129] en el pedido, la cruz y el - / + de cada fila dicen de que producto son',
       labels.map(l => l[0]).join(' · '));
  }finally{
    document.getElementById('pedido')?.remove();
    PEDIDO = antes; guardarPedido(); pintarPedido(); refrescarBotonesPedido();
  }
}

/* ---- [135] Los niveles de titulo siguen la estructura de la pagina ---- */
async function niveles(){
  const nivel = h => Number(h.tagName.slice(1));
  const ids = { 'nv-titulo': 'Recien llegados', 'mv-titulo': 'Busca por marca', 'pv-titulo': 'Cuanto queres gastar', 'ay-titulo': 'Preguntas frecuentes' };
  const hay = Object.keys(ids).filter(id => document.getElementById(id));
  if(!hay.length) nota('[135] la portada no dibujo sus bloques');
  const malos = hay.filter(id => document.getElementById(id).tagName !== 'H2');
  ok(!malos.length, '[135] los bloques de la portada son secciones (h2), al lado de "Elegi un rubro"',
     malos.map(id => ids[id] + ' es ' + document.getElementById(id).tagName).join(' · ') || hay.length + ' bloques');
  const adentro = [...document.querySelectorAll('#nuevos .nv-nom, #ayuda .ay-r > h1, #ayuda .ay-r > h2, #ayuda .ay-r > h3, #ayuda .ay-r > h4')];
  ok(adentro.every(h => h.tagName === 'H3'), '[135] y lo de adentro (cada producto nuevo, cada pregunta) es h3',
     [...new Set(adentro.map(h => h.tagName))].join(',') || 'sin bloques');
  // Sin saltos de nivel en lo que se ve (h1 -> h3 sin h2 en el medio)
  const salto = hs => {
    let prev = 0;
    for(const h of hs){ if(nivel(h) > prev + 1 && prev) return h.tagName + ' "' + h.textContent.trim().slice(0, 30) + '"'; prev = nivel(h); }
    return '';
  };
  const visibles = () => [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(h => h.offsetParent !== null && !h.closest('.modal'));
  const s1 = salto(visibles());
  ok(!s1, '[135] la portada no saltea niveles de titulo', s1 || visibles().length + ' titulos');
  // Adentro de un rubro, los productos cuelgan de su titulo
  const antes = { ...filtros };
  filtros.cat = MODELOS.find(m => m.stock).cat;
  try{
    pintar();
    await new Promise(r => setTimeout(r, 400));
    const cab = document.querySelector('#rubro-cab h2');
    const nombres = [...document.querySelectorAll('#grid .card .nombre')];
    ok(!!cab && nombres.length && nombres.every(h => h.tagName === 'H3'),
       '[135] en un rubro, el titulo es h2 y cada producto de la grilla h3',
       (cab ? cab.textContent : 'sin titulo') + ' · ' + [...new Set(nombres.map(h => h.tagName))].join(','));
    const s2 = salto(visibles());
    ok(!s2, '[135] y tampoco saltea niveles', s2 || 'bien');
  }finally{
    Object.assign(filtros, antes);
    try{ pintar(); }catch(e){}
  }
}

/* ---- [18] Las notas del proveedor salen del nombre y van a su lugar ---- */
async function notasDelProveedor(){
  const d = sacarNotasDelNombre({ desc: 'P2725H | Dell 27" FHD (1920x1080 · USB · 3Y Warranty)', incluye: '', condicion: '', garantia: '' });
  ok(d.garantia === '3 años' && d.desc === 'P2725H | Dell 27" FHD (1920x1080 · USB)',
     '[18] "3Y Warranty" va a la garantia y el parentesis queda cerrado', d.desc + ' · ' + d.garantia);
  const l = sacarNotasDelNombre({ desc: 'RF 24-105mm F/4 IS USM White Box', incluye: '', condicion: '', garantia: '' });
  ok(l.condicion === 'Caja blanca' && l.desc === 'RF 24-105mm F/4 IS USM', '[18] "White Box" es Caja blanca', l.desc + ' · ' + l.condicion);
  const t = sacarNotasDelNombre({ desc: 'Galaxy Tab S10 FE Plus 256GB · Incluye Solo S-Pen (Silver)', incluye: '', condicion: '', garantia: '' });
  ok(t.incluye === '+ Solo el S-Pen' && t.desc === 'Galaxy Tab S10 FE Plus 256GB (Silver)',
     '[18] "Incluye Solo S-Pen" va a Incluye', t.desc + ' · ' + t.incluye);
  const quedan = PRODUCTOS.filter(p => /\bWarranty\b|\bWhite Box\b|\bIncluye solo\b|\s\)/i.test(p.desc || ''));
  ok(!quedan.length, '[18] ningun nombre del catalogo de hoy sigue con esas notas ni con un " )" suelto',
     quedan.slice(0, 3).map(p => p.id + ' ' + p.desc).join(' · ') || PRODUCTOS.length + ' filas');
  /* El caso real se busca por su forma y no por ID (29/09): ADVAPP renumera,
     y el Dell P2725H (AT-0421) ya fue MON-DEL-010, 012 y 014 segun el
     maestro. Con el ID fijo, el dia que el 014 fuera el P2425H esto fallaba
     con la pagina bien, y el dia que el P2725H cambiara de numero dejaba de
     mirar sin avisar. Tampoco por el AT: si ADVAPP saca "3Y Warranty" del
     nombre, la web no tiene de donde sacar el plazo y no lo inventa. Se mira
     toda fila de ADVAPP que HOY trae "NY Warranty" en el nombre crudo.
     Lo que no se pudo mirar se dice (29/09): una fila con Warranty que no se
     cruzo con la pagina, o que trae su propia Garantia, sale en una linea
     '--' con su ID. Antes caia en "hoy ninguna fila trae Warranty" teniendola. */
  const { reales, sueltas, propias, sinMirar } = await conWarrantyHoy();
  if(sinMirar){ nota('[18] la garantia real no se mira: ' + sinMirar); return; }
  if(sueltas.length)
    nota('[18] ' + sueltas.length + ' fila(s) con "NY Warranty" en ADVAPP no se cruzaron con la pagina ' +
         '(inactivas, o renumeradas entre la carga y esta bajada): ' + sueltas.slice(0, 5).join(' · '));
  if(propias.length)
    nota('[18] ' + propias.length + ' fila(s) con "NY Warranty" traen su propia Garantia en ADVAPP, y manda esa: ' +
         propias.slice(0, 5).join(' · '));
  if(!reales.length){
    if(!sueltas.length && !propias.length)
      nota('[18] hoy ninguna fila de ADVAPP trae "NY Warranty" en el nombre: no hay garantia real que mirar');
    return;
  }
  const mal = reales.filter(r => r.p.garantia !== r.plazo);
  ok(!mal.length, '[18] las ' + reales.length + ' fila(s) de hoy con "NY Warranty" (' +
     reales.map(r => r.p.codigo || r.p.id).join(', ') + ') tienen su garantia en su renglon',
     mal.slice(0, 3).map(r => (r.p.codigo || r.p.id) + ': ' + (r.p.garantia || 'vacia') + ' y el nombre dice ' + r.plazo).join(' · ') || 'bien');
}

/* Las filas de hoy cuyo nombre crudo en ADVAPP dice "3Y Warranty" (o "2 Years
   Warranty"), con el producto de la pagina y el plazo que tiene que mostrar.
   La expresion es propia y no la de NOTAS_DEL_NOMBRE: con la de la pagina la
   prueba daria siempre la razon. El producto se busca por ID Y por codigo AT,
   asi una renumeracion entre la carga de la pagina y esta bajada no cruza
   filas. Vacio si la pagina no cargo de ADVAPP (la planilla numera distinto).

   El AT se compara solo si la fila lo trae (29/09): sin CODIGO, la pagina
   saca el codigo del mapa (codigoDeLaFila) y el '' de ADVAPP no daba igual
   nunca. Un alta nueva, que llega sin AT hasta que se lo damos, quedaba
   afuera sin avisar. Para esas, el ID y el Modelo tal cual vino.
   Si la fila trae su propia columna Garantia, la pagina muestra esa y no la
   del nombre (sacarNotasDelNombre no pisa lo que ya esta): esa fila no se
   compara contra el nombre, se anota aparte. */
async function conWarrantyHoy(){
  const nada = sinMirar => ({ reales: [], sueltas: [], propias: [], sinMirar });
  if(!FUENTE || FUENTE.fuente !== 'advapp') return nada('la pagina no cargo de ADVAPP');
  let filas = [];
  try{ filas = (await (await fetch(ADVAPP_URL, { cache: 'no-store' })).json()).productos || []; }
  catch(e){ return nada('no pude volver a bajar ADVAPP (' + (e && e.message || e) + ')'); }
  const txt = v => limpio(v === null || v === undefined ? '' : String(v));
  const out = { reales: [], sueltas: [], propias: [] };
  for(const x of filas){
    const m = /\b(\d+)\s*Y(?:ears?)?\s+Warranty\b/i.exec(txt(x['Descripción completa']) || txt(x.Modelo));
    if(!m) continue;
    const cod = txt(x.CODIGO), quien = x.ID + (cod ? ' (' + cod + ')' : ' (sin AT)');
    const kGar = Object.keys(x).find(k => norm(k).startsWith('garantia'));
    if(kGar && txt(x[kGar])){ out.propias.push(quien + ': ' + txt(x[kGar])); continue; }
    const p = PRODUCTOS.find(q => q.id === x.ID && (cod ? q.codigo === cod : q.modelo === txt(x.Modelo)));
    if(p) out.reales.push({ p, plazo: m[1] === '1' ? '1 año' : m[1] + ' años' });
    else out.sueltas.push(quien);
  }
  return out;
}

/* ---- [195] "Chip M3" solo en lo que tiene procesador ---- */
function chipDelTeclado(){
  const tec = specs({ desc: 'Magic Keyboard For 11" iPad Air M3/M4 (Black · English)', cat: 'Accesorio Apple' });
  const mac = specs({ desc: 'MacBook Air M4 13" 16GB/512GB', cat: 'MacBook' });
  ok(!tec.some(s => /^Chip/.test(s)) && tec.includes('11"') && mac.includes('Chip M4'),
     '[195] el teclado no tiene chip y la MacBook si', tec.join(', ') + ' · ' + mac.join(', '));
  const mal = [];
  MODELOS.forEach(m => m.variantes.forEach(v => { if(!CATS_CON_CHIP.includes(v.cat) && specs(v).some(s => /^Chip/.test(s))) mal.push(v.cat + ': ' + v.desc); }));
  ok(!mal.length, '[195] en el catalogo de hoy, ningun accesorio muestra "Chip"', mal.slice(0, 3).join(' · ') || 'ninguno');
}

/* ---- [84] "Estas eligiendo" dice el color una sola vez ---- */
function colorRepetido(){
  const mal = [];
  MODELOS.filter(m => m.multi).forEach(m => m.variantes.forEach(v => {
    const op = v.opcion || v.etiqueta;
    const g = m.variantes.filter(x => (x.opcion || x.etiqueta) === op);
    const [, ver] = partesElegido(m, v);
    if(opcionEsColor(g, op) && ver.trim()) mal.push(m.desc + ver + ', color ' + colorPorDefecto(v));
  }));
  ok(!mal.length, '[84] cuando la version es un color, no se escribe: ya va en ", color X"',
     mal.slice(0, 3).join(' · ') || 'ninguna');
  const w = filaB4('Zzz Mouse (White)', { color: 'White', precio: 100 });
  const m = armarModelo([w, filaB4('Zzz Mouse (Black)', { color: 'Black', precio: 101 })]);
  const [n, ver] = partesElegido(m, w);
  ok(ver === '' && !/white/i.test(n), '[84] armado: "Zzz Mouse" + ", color White", sin repetirlo', n + ver);
}
