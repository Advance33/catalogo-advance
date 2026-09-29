// Guardas del catalogo maestro y de las herramientas que lo escriben (29/09).
//
// Una auditoria encontro que altas-catalogo.py, "el trabajo de todos los
// dias", iba a dejar el maestro con ocho colores repetidos (AT-0511-07 "Lime"
// al lado de la AT-0511-02 "lima"), un color metido en otro producto (el
// Ocean Band del Ultra 3 en el Milanese) y, con un CODIGO mal tipeado por
// ADVAPP, un producto fantasma y el contador saltando del 537 al 600 para
// siempre. Las herramientas ya no lo hacen; esto mira que el resultado no
// aparezca igual por otro camino, porque el maestro SOLO CRECE y lo que entra
// mal no sale.
//
// Tambien controla que la copia de varianteDeLaColumna() que usan los
// informes de Python siga haciendo lo mismo que la web: los casos viven en
// herramientas/catalogo_maestro.py (CASOS_COLUMNA) y se corren en las dos
// puntas.
//
// Lee el maestro de herramientas/catalogo-maestro.csv y no de fotos/indice.json:
// el indice se regenera recien al publicar (verificar-fotos.py), y lo que se
// vigila aca es lo que quedo escrito en el maestro.
//
// Sin nombres fijos de productos: los casos se buscan en los datos del dia.
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
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: ' + (e && e.stack || e)); fallas++; })
    .then(() => {
      try{ pararPaseos(); }catch(e){}
      try{ pararOfertas(); }catch(e){}
      for(let i = 1; i < 5000; i++) clearInterval(i);
      reportar();
    });
}, 120);

const traer = async ruta => {
  const r = await fetch(ruta + '?_=' + Date.now(), { cache:'no-store' });
  if(!r.ok) throw new Error(ruta + ': ' + r.status);
  return r.text();
};

/* El CSV del maestro, con comillas ("" adentro) y CRLF. */
function parsearCSV(txt){
  const filas = [];
  let fila = [], campo = '', entre = false;
  for(let i = 0; i < txt.length; i++){
    const c = txt[i];
    if(entre){
      if(c === '"'){ if(txt[i + 1] === '"'){ campo += '"'; i++; } else entre = false; }
      else campo += c;
    }
    else if(c === '"') entre = true;
    else if(c === ','){ fila.push(campo); campo = ''; }
    else if(c === '\n'){ fila.push(campo.replace(/\r$/, '')); filas.push(fila); fila = []; campo = ''; }
    else campo += c;
  }
  if(campo || fila.length){ fila.push(campo.replace(/\r$/, '')); filas.push(fila); }
  const cab = filas.shift() || [];
  return filas.filter(f => f.length > 1).map(f => Object.fromEntries(cab.map((k, i) => [k, f[i] || ''])));
}

/* CM.lista(): varios valores separados por barra, con \| para la barra del texto. */
function lista(t){
  const partes = [];
  let actual = '';
  t = t || '';
  for(let i = 0; i < t.length; i++){
    if(t[i] === '\\' && i + 1 < t.length){ actual += t[i + 1]; i++; }
    else if(t[i] === '|'){ partes.push(actual); actual = ''; }
    else actual += t[i];
  }
  partes.push(actual);
  return partes.map(x => x.trim()).filter(Boolean);
}
const escriturasDe = f => new Set([f.Variante, ...lista(f.Escrituras)].map(x => norm(x || '')).filter(Boolean));

/* difflib.SequenceMatcher(None, a, b).ratio(), sin basura (las palabras son cortas). */
function parecidoLetras(a, b){
  if(!a.length && !b.length) return 1;
  const iguales = (alo, ahi, blo, bhi) => {
    let mejor = [alo, blo, 0], antes = {};
    for(let i = alo; i < ahi; i++){
      const ahora = {};
      for(let j = blo; j < bhi; j++){
        if(a[i] !== b[j]) continue;
        const k = (antes[j - 1] || 0) + 1;
        ahora[j] = k;
        if(k > mejor[2]) mejor = [i - k + 1, j - k + 1, k];
      }
      antes = ahora;
    }
    const [i, j, k] = mejor;
    return k ? k + iguales(alo, i, blo, j) + iguales(i + k, ahi, j + k, bhi) : 0;
  };
  return 2 * iguales(0, a.length, 0, b.length) / (a.length + b.length);
}

async function correrPruebas(){
  const [csv, contadorTxt, cm] = await Promise.all([
    traer('herramientas/catalogo-maestro.csv'),
    traer('herramientas/catalogo-ultimo-codigo.txt'),
    traer('herramientas/catalogo_maestro.py'),
  ]);
  const maestro = parsearCSV(csv);
  ok(maestro.length > 300, 'el maestro se lee entero', maestro.length + ' filas');

  // La misma regla que CM.misma_escritura(), con su tabla y su umbral leidos
  // del archivo de Python: si alguien los cambia alla, se usan aca.
  const TR = {};
  const tabla = (cm.match(/TRADUCCIONES = \{([\s\S]*?)\}/) || [])[1] || '';
  for(const m of tabla.matchAll(/'([^']+)':\s*'([^']+)'/g)) TR[m[1]] = m[2];
  const UMBRAL = parseFloat((cm.match(/PARECIDO_COLOR = ([\d.]+)/) || [])[1] || '0.85');
  ok(Object.keys(TR).length >= 5, 'la tabla de traducciones de colores se lee de catalogo_maestro.py',
     Object.keys(TR).length);
  const mismaEscritura = (a, b) => {
    const x = norm(a), y = norm(b);
    if(!x || !y) return false;
    if(x === y || TR[x] === y || TR[y] === x) return true;
    return x.length >= 5 && y.length >= 5 && parecidoLetras(x, y) >= UMBRAL;
  };

  const vivas = maestro.filter(f => !(f.Baja || '').trim() && (f.NumVar || '').trim());
  const porCodigo = {};
  for(const f of vivas) (porCodigo[f.CODIGO] = porCodigo[f.CODIGO] || []).push(f);

  /* ---- 1. Ningun producto con dos variantes que son el mismo color ----
     Es lo que dejaba altas-catalogo.py numerando por texto exacto: "Lime" al
     lado de "lima", "Lavender" al lado de "lavander", "Pistachio" al lado de
     "Pistacho". Cada una de mas es para siempre y deja la foto revisada sin
     nadie que la pida. Si esto salta, la de mas se da de baja y su texto pasa
     a Escrituras de la buena. */
  const repetidas = [];
  for(const [cod, fs] of Object.entries(porCodigo)){
    for(let i = 0; i < fs.length; i++){
      for(let j = i + 1; j < fs.length; j++){
        const a = [...escriturasDe(fs[i])], b = [...escriturasDe(fs[j])];
        const par = a.flatMap(x => b.filter(y => mismaEscritura(x, y)).map(y => x + '/' + y))[0];
        if(par) repetidas.push(fs[i].CODIGO_VAR + ' y ' + fs[j].CODIGO_VAR + ' (' + par + ')');
      }
    }
  }
  ok(repetidas.length === 0, 'ningun producto tiene dos variantes vivas que son el mismo color escrito distinto',
     repetidas.slice(0, 4).join(' · ') || vivas.length + ' variantes vivas');
  // Que la regla muerda: con la variante de mas que proponia la herramienta
  // el 28/09, tiene que verla.
  ok(mismaEscritura('Lime', 'lima') && mismaEscritura('Lavender', 'lavander')
     && mismaEscritura('Pistachio', 'Pistacho') && !mismaEscritura('grey', 'gre')
     && !mismaEscritura('Blue', 'Black'),
     'la regla de "mismo color escrito distinto" reconoce Lime/lima, Lavender/lavander, Pistachio/Pistacho y no junta Grey con Gre');

  /* ---- 2. La numeracion no salta ----
     El contador NO BAJA NUNCA. Con un CODIGO mal tipeado (AT-0600 en vez de
     AT-0060) la herramienta vieja lo tomaba como producto existente y el
     contador pasaba de 537 a 600: 62 numeros quemados que no vuelven. Los
     dos huecos que hay son historicos y se quedan para siempre porque los
     numeros no se reusan: el AT-0500 (se entrego el 11/09 y el producto no
     quedo) y el AT-0509 (el +1 de mas de altas-catalogo del 14/09). Uno
     nuevo es un salto. */
  const nums = [...new Set(maestro.map(f => f.CODIGO).filter(c => /^AT-\d{4}$/.test(c))
                                  .map(c => parseInt(c.slice(3), 10)))].sort((a, b) => a - b);
  const alto = nums[nums.length - 1] || 0;
  const at = n => 'AT-' + String(n).padStart(4, '0');
  const hay = new Set(nums);
  const HISTORICOS = new Set([500, 509]);
  const huecos = [];
  for(let n = 1; n <= alto; n++) if(!hay.has(n) && !HISTORICOS.has(n)) huecos.push(n);
  ok(huecos.length === 0, 'la numeracion de productos no tiene huecos nuevos',
     huecos.length ? huecos.length + ' (' + at(huecos[0]) + '...)' : 'hasta ' + at(alto));
  const contador = parseInt((contadorTxt.split(/\r?\n/).map(l => l.split('#')[0].trim()).find(l => /^\d+$/.test(l))) || '0', 10);
  ok(contador === alto, 'el contador es el ultimo codigo del maestro', contador + ' / ' + at(alto));

  /* ---- 3. Lo que ADVAPP ya nos dijo queda escrito ----
     Dos filas del mismo producto y el mismo color: una trae CODIGO_VAR y la
     web le muestra nuestra foto; la hermana llega sin CODIGO_VAR y, si el
     maestro no tiene esa forma de escribir el color, sale sin foto. Asi
     estaba el 16 Pro Max 512GB Natural (USD 1260, con stock) mientras el de
     256GB mostraba AT-0068-03. Se arregla con altas-catalogo.py, que ahora
     anota la escritura cuando se parece a la variante que dice ADVAPP. */
  const tablaDe = cod => {
    const t = {};
    for(const f of porCodigo[cod] || []) for(const e of escriturasDe(f)) t[e] = f.CODIGO_VAR;
    return t;
  };
  const palabras = s => ' ' + norm(s || '').replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
  const seParece = (texto, cv, cod) => {
    const f = (porCodigo[cod] || []).find(x => x.CODIGO_VAR === cv);
    if(!f) return false;
    if([...escriturasDe(f)].some(e => mismaEscritura(texto, e))) return true;
    const t = palabras(texto);
    if(t.trim().length < 3) return false;
    const donde = (porCodigo[cod] || []).filter(x => [...escriturasDe(x)].some(e => palabras(e).includes(t)));
    return donde.length === 1 && donde[0] === f;
  };
  const porColumna = {};
  for(const p of PRODUCTOS){
    if(!p.codigo) continue;
    for(const c of partirColores(p.color)){
      const v = varianteDeLaColumna(p, p.codigo, c);
      if(v) porColumna[p.codigo + '|' + norm(c)] = v;
    }
  }
  const faltan = [];
  for(const p of PRODUCTOS){
    if(!p.codigo) continue;
    for(const c of partirColores(p.color)){
      const v = porColumna[p.codigo + '|' + norm(c)];
      if(!v || varianteDeLaColumna(p, p.codigo, c)) continue;      // la hermana con columna, o esta misma
      if(tablaDe(p.codigo)[norm(c)]) continue;                      // el maestro ya la tiene
      if(!seParece(c, v, p.codigo)) continue;                       // no se parece: es un error de ADVAPP, otra cosa
      faltan.push(p.id + ' "' + c + '" -> ' + v);
    }
  }
  ok(faltan.length === 0,
     'ninguna fila se queda sin foto por una escritura que ADVAPP ya dio en otra fila (altas-catalogo.py la anota)',
     faltan.slice(0, 4).join(' · ') || Object.keys(porColumna).length + ' colores por columna');

  /* ---- 4. La copia de Python de varianteDeLaColumna() hace lo mismo ----
     Los casos estan en herramientas/catalogo_maestro.py (CASOS_COLUMNA) y
     Python los corre contra su copia al arrancar altas-catalogo y
     revisar-catalogo. Aca se corren contra la web. El 28/09 los informes
     decian "sin foto" en 8 fichas que la web mostraba bien, porque Python no
     miraba la columna. */
  const bloque = (cm.match(/CASOS_COLUMNA = r'''([\s\S]*?)'''/) || [])[1];
  ok(!!bloque, 'los casos de la columna se leen de catalogo_maestro.py');
  if(bloque){
    const datos = JSON.parse(bloque);
    const guardado = CATALOGO;
    const mal = [];
    try{
      CATALOGO = { vars: datos.vars };
      for(const [colores, color, celda, cod, espera, porque] of datos.casos){
        const da = varianteDeLaColumna({ color: colores, codigoVar: celda }, cod, color);
        if(da !== espera) mal.push(porque + ': dio "' + da + '"');
      }
    }finally{ CATALOGO = guardado; }
    ok(mal.length === 0, 'varianteDeLaColumna() pasa los mismos casos que su copia en Python',
       mal.slice(0, 3).join(' · ') || datos.casos.length + ' casos');
  }

  /* ---- 5. Las claves del mapa de colores se pueden leer ----
     validar.py y colores-nuevos.py leen COLORES con una expresion que solo
     acepta letras, numeros y espacios. Una clave pegada con guion
     ('jet-black') la registran como "black" y el aviso de "sin puntito" no se
     apaga nunca; sin comillas, directamente rompe el script (29/09). */
  const raras = Object.keys(COLORES).filter(k => !/^[a-z][a-z0-9 ]*$/i.test(k));
  ok(raras.length === 0, 'todas las claves de COLORES son letras, numeros y espacios', raras.join(', ') || Object.keys(COLORES).length);

  /* ---- 6. Los comandos que sugieren las herramientas son de la Mac ----
     Desde el 25/09 todo corre en la Mac, donde "python" no existe: cada
     comando sugerido con "python x.py" fallaba con "command not found" al
     copiarlo. */
  const mias = ['herramientas/altas-catalogo.py', 'herramientas/confirmar-altas.py',
                'herramientas/revisar-catalogo.py', 'herramientas/miniaturas.py',
                'herramientas/colores-nuevos.py', 'herramientas/catalogo_maestro.py'];
  const conPython = [];
  for(const ruta of mias){
    const txt = await traer(ruta);
    if(/(^|[\s'"(])python (?=[\w\/.-]+\.py\b)/m.test(txt)) conPython.push(ruta.split('/').pop());
  }
  ok(conPython.length === 0, 'las herramientas del maestro sugieren python3 y no python', conPython.join(', ') || mias.length + ' archivos');

  /* ---- 7. Cada foto chica sabe de que grande salio ----
     miniaturas.py rehace la chica cuando cambia el CONTENIDO de la grande,
     no la fecha (en la Mac el Finder y Drive conservan la fecha vieja). Si
     el registro existe, tiene que cubrir todas las fotos del indice. */
  let huellas = null;
  try{ huellas = JSON.parse(await traer('fotos/mini/huellas.json')); }catch(e){ huellas = null; }
  if(!huellas){
    R.push('  --  fotos/mini/huellas.json todavia no existe: lo crea verificar-fotos.py al publicar');
  }else{
    const sin = [...(INDICE_FOTOS || [])].filter(n => /\.jpg$/i.test(n) && !huellas[n]);
    ok(sin.length === 0, 'todas las fotos tienen la huella de su chica', sin.slice(0, 4).join(', ') || Object.keys(huellas).length);
  }

  /* ---- 8. revisar-catalogo elige la portada con la copia de todos ----
     El 29/09 revisar-catalogo decia "el cliente ve el logo" en 33 fichas y
     eran 4: tenia su propia prediccion de portada y no se entero de
     fotoDeHermana(). validar.py y verificar-fotos.py ya usaban
     validar.PortadaWeb; con una copia sola, las tres dicen lo mismo. */
  const rc = await traer('herramientas/revisar-catalogo.py');
  ok(/validar\.PortadaWeb\(/.test(rc) && /portada\.de\(/.test(rc),
     'revisar-catalogo.py elige la portada con validar.PortadaWeb, como validar.py y verificar-fotos.py');
}
