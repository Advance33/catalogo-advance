// El codigo propio del catalogo: la tercera identidad, y la primera que no
// sale de un texto que escribe otro. Cada producto tiene AT-####, cada
// variante AT-####-NN, y las fotos se llaman asi.
//
// Lo que se prueba aca es lo unico que puede volver a romper las fichas: que
// la web llegue del producto de la planilla al archivo correcto, y que NO
// llegue cuando el vinculo dejo de ser de fiar. Sin foto es barato; con la
// foto de otro producto es el error que costo tres rediseños.
//
// Sin nombres fijos: los casos se buscan en la planilla del dia.
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
  try{ correrPruebas(); }catch(e){ R.push('EXCEPCION: ' + (e && e.stack || e)); fallas++; }
  try{ pararPaseos(); }catch(e){}
  try{ pararOfertas(); }catch(e){}
  for(let i = 1; i < 5000; i++) clearInterval(i);
  reportar();
}, 120);

function correrPruebas(){
  /* ---- 1. El mapa llego ---- */
  ok(CATALOGO && typeof CATALOGO === 'object', 'el mapa del catalogo viaja en el indice');
  if(!CATALOGO){
    R.push('  --  sin mapa no se prueba nada mas: la web cae a los nombres por SKU');
    return;
  }
  ok(Object.keys(CATALOGO.ids || {}).length > 100, 'trae el vinculo por ID',
     Object.keys(CATALOGO.ids || {}).length);
  ok(Object.keys(CATALOGO.firmas || {}).length > 100, 'trae la firma de cada producto',
     Object.keys(CATALOGO.firmas || {}).length);

  /* ---- 2. Los productos encuentran su codigo ----
     Lo que se mide NO es el porcentaje de filas con codigo. Ese numero baja
     solo cuando el proveedor carga altas -- el 14/09 entraron 95 lentes de
     una -- y una prueba que salta por eso no avisa de nada: avisa de que el
     negocio crecio. Lo que importa es que ninguna fila que el catalogo YA
     CONOCE se quede sin resolver, porque eso si es algo roto. */
  const conCodigo = PRODUCTOS.filter(p => p.codigo);
  const conocidas = PRODUCTOS.filter(p => {
    const clave = (CATALOGO.ids || {})[p.id] || (CATALOGO.skus || {})[p.sku];
    return !!clave;
  });
  const perdidas = conocidas.filter(p => !p.codigo);
  ok(perdidas.length === 0,
     'ninguna fila que el catalogo ya conoce se quedo sin codigo',
     perdidas.slice(0, 4).map(p => p.id).join(', ')
     || conocidas.length + ' conocidas, todas resueltas');
  R.push('  --  ' + conCodigo.length + ' de ' + PRODUCTOS.length +
         ' filas con codigo (' + (PRODUCTOS.length - conCodigo.length) +
         ' esperan que el sheet las numere)');

  /* ---- 3. Y el codigo es del producto que dice ser ----
     La firma tiene que dar exactamente lo mismo que del lado de Python. Si
     las dos implementaciones se separan, ningun codigo resuelve y el
     catalogo entero se queda sin fotos, en silencio. */
  /* La firma se calcula sobre la descripcion ORIGINAL, y para cuando corre
     esta tanda sacarNotasDelNombre ya limpio p.desc. Asi que lo que se
     verifica es que el codigo guardado exista en el catalogo y que el
     producto sea el que dice: mismo codigo, misma marca. */
  /* Cada producto trae una LISTA de firmas, una por cada nombre y cada
     categoria con que se lo vio: el proveedor reescribe los nombres y mueve
     las categorias, y con una sola firma la web desconoceria justo lo que
     alguien ya confirmo a mano. */
  const firmasDe = c => [].concat(CATALOGO.firmas[c] || []);
  const inventados = conCodigo.filter(p => !firmasDe(p.codigo).length);
  ok(inventados.length === 0, 'todos los codigos resueltos estan en el catalogo',
     inventados.slice(0, 3).map(p => p.id).join(', ') || conCodigo.length + ' verificados');
  const otraMarcaQueLaSuya = conCodigo.filter(p =>
    !firmasDe(p.codigo).some(s => s.split('|')[0] === norm(p.marca)));
  /* Y la firma entera, que es lo que de verdad protege: si la que calcula la
     web se separa de la que guardo Python, los codigos dejan de resolver. Se
     compara con la categoria de la planilla, no con la renombrada. */
  const malFirmados = conCodigo.filter(p => !firmasDe(p.codigo).includes(
    norm(p.marca) + '|' + norm(p.catPlanilla || p.cat) + '|' + firmaDura(p.descOriginal || p.desc)));
  R.push('  --  ' + malFirmados.length + ' con firma distinta (esperable: sacarNotasDelNombre limpia la descripcion)');
  ok(otraMarcaQueLaSuya.length === 0, 'y ninguno quedo pegado a un producto de otra marca',
     otraMarcaQueLaSuya.slice(0, 3).map(p => p.id + ' -> ' + p.codigo).join(' | '));

  /* ---- 4. Un producto que no es el suyo NO resuelve ----
     Se le cambia el nombre a uno que existe por el de otra gama y se
     comprueba que el vinculo se corta. Es la defensa contra que la planilla
     reutilice un ID, que es como empezo todo esto. */
  /* 29/09 (hallazgo 184): el "(control)" decia ok(... || true) y no podia
     fallar nunca. Como ADVAPP ya manda el codigo en casi todas las filas, la
     firma casi no se usa al cargar: si se rompia, esto seguia en OK y las dos
     de abajo pasaban solas (una fila que no resuelve tampoco resuelve con otro
     nombre). Ahora la victima es una fila que SI resuelve sin su codigo, y que
     haya una es la comprobacion de verdad del camino por firma. */
  const victima = conCodigo.find(p => CATALOGO.ids[p.id] && codigoDeLaFila({ ...p, codigo: '' }));
  ok(!!victima, 'la firma que calcula la web resuelve al menos una fila conocida sin su columna CODIGO',
     victima ? victima.id + ' -> ' + codigoDeLaFila({ ...victima, codigo: '' }) : 'ninguna resuelve');
  if(victima){
    // se le saca el codigo guardado para forzar que lo resuelva de nuevo
    const base = Object.assign({}, victima, { codigo: '' });
    const falso = Object.assign({}, base, { desc: base.desc + ' Pro Max 999GB' });
    ok(!codigoDeLaFila(falso), 'si el nombre cambia de gama, el vinculo se corta',
       victima.id + ' -> ' + (codigoDeLaFila(falso) || 'sin codigo'));
    const otraMarca = Object.assign({}, base, { marca: 'Marca Que No Existe' });
    ok(!codigoDeLaFila(otraMarca), 'y si cambia la marca, tambien');
  }

  /* ---- 5. La portada de los que tienen foto sale del codigo ---- */
  if(INDICE_FOTOS){
    const porCodigo = [...INDICE_FOTOS].filter(n => /^AT-\d{4}(-\d{2})?\./.test(n));
    ok(porCodigo.length > 0, 'hay fotos con nombre de codigo en la carpeta', porCodigo.length);
    if(porCodigo.length){
      const conFoto = PRODUCTOS.filter(p => p.imagen);
      const viejas = conFoto.filter(p => !/AT-\d{4}/.test(decodeURIComponent(p.imagen)));
      ok(viejas.length === 0, 'y todas las portadas usan una de esas',
         viejas.slice(0, 3).map(p => p.id + ' -> ' + p.imagen.split('/').pop()).join(' | ')
         || conFoto.length + ' portadas');
    }
    /* Ninguna portada puede apuntar a un archivo que no existe */
    const fantasma = PRODUCTOS.filter(p => p.imagen && p.imagen.includes(CARPETA_FOTOS))
      .filter(p => !INDICE_FOTOS.has(decodeURIComponent(p.imagen.split('/').pop().split('?')[0])));
    ok(fantasma.length === 0, 'ninguna portada apunta a un archivo que no esta',
       fantasma.slice(0, 3).map(p => p.id).join(', '));
  }

  /* ---- 6. Elegir un color no devuelve la foto general del producto ----
     Devolver la del producto es exactamente lo que hacia parecer que la foto
     era la del color elegido cuando no lo era. */
  let revisados = 0, generales = [];
  for(const p of PRODUCTOS.slice(0, 200)){
    for(const c of partirColores(p.color)){
      for(const u of fotosDeColor(p, c)){
        revisados++;
        const n = decodeURIComponent(u.split('/').pop().split('?')[0]).replace(EXT_FOTOS, '');
        if(/^AT-\d{4}$/.test(n) || n === p.sku || n === p.id) generales.push(p.id + ' -> ' + n);
      }
    }
  }
  ok(generales.length === 0, 'la foto de un color nunca es la foto general del producto',
     generales.slice(0, 3).join(' | ') || revisados + ' urls revisadas');

  /* ---- 7. Dos variantes distintas del mismo producto, dos archivos ---- */
  let paresOk = 0, paresMal = [];
  for(const p of PRODUCTOS){
    const cod = p.codigo;
    const cols = partirColores(p.color);
    if(!cod || cols.length < 2) continue;
    const vistos = new Map();
    for(const c of cols){
      const v = archivoDeVariante(cod, c);
      if(!v) continue;
      for(const [otro, x] of vistos)
        if(x === v && slugColor(otro) !== slugColor(c)) paresMal.push(p.id + ': ' + otro + ' y ' + c);
      vistos.set(c, v);
      paresOk++;
    }
  }
  /* Con ADVAPP cada fila trae un color (29/09: 0 de 758 con dos), asi que
     casi siempre no hay nada que mirar aca: se dice, en vez de sumar un OK
     con "[0 variantes revisadas]" (hallazgo 184). Lo mismo entre filas lo
     mira la seccion 10. */
  if(paresOk)
    ok(paresMal.length === 0, 'dos colores distintos nunca caen en la misma variante',
       paresMal.slice(0, 3).join(' | ') || paresOk + ' variantes revisadas');
  else
    R.push('  --  ninguna fila trae dos colores en su celda: dos colores en la misma variante se mira entre filas (10)');

  /* ---- 8. Las columnas del contrato landing/1.3 ----
     Desde el 11/09/2026 la planilla trae CODIGO y CODIGO_VAR. Es el final del
     camino: la identidad deja de deducirse y viene escrita en la fila. Lo que
     se prueba es que la columna y el mapa digan lo MISMO, porque los dos
     salen del mismo catalogo maestro; si dejan de coincidir, una de las dos
     puntas cambio y la otra no se entero. */
  const conCol = PRODUCTOS.filter(p => (p.codigo || '').trim());
  ok(conCol.length > 0, 'la planilla trae la columna CODIGO poblada',
     conCol.length + ' de ' + PRODUCTOS.length);

  /* Que la columna y el mapa no coincidan NO siempre es un error (29/09,
     hallazgo 162). Pedro decidio el 26/09 que el mismo modelo con otra
     memoria se ve igual: ADVAPP le pone al 16 Pro Max 512 el codigo del 256
     (AT-0068) y la foto del hermano esta bien. Esta comprobacion fallaba
     todos los dias por esos (36 de 51 el 29/09) y mostraba solo 3: una
     alarma que no podia ponerse verde nunca, ni con ADVAPP corrigiendo todo,
     y detras de la cual una falla nueva pasaba sin que nadie la viera.
     Lo que SI es un error, siempre: Sim contra eSIM y teclado ES contra EN,
     que son productos distintos (Pedro, 26/09), o el codigo de otro modelo.

     Como se decide, con las funciones de la pagina y sin copiar el criterio
     de Python: se miran las filas que ese codigo "tiene de verdad" (las que
     la columna Y el mapa le dan). Si ninguna vende la misma Sim y el mismo
     teclado (del SKU: simDelSku, tecladoDelSku), es otro producto. Si alguna
     es de la misma familia() -la regla con la que la pagina junta un modelo
     con sus memorias-, es otra memoria. Si ninguna fila tiene ese codigo,
     desde la web no se puede juzgar: queda como aviso y lo decide
     verificar-fotos.py, que tiene el catalogo maestro. */
  const mapaDe = p => codigoDeLaFila({...p, codigo: '', codigoVar: ''});
  const choques = conCol.filter(p => {
    const porElMapa = mapaDe(p);
    return porElMapa && porElMapa !== p.codigo.trim().toUpperCase();
  });
  // Sin la marca adelante: ADVAPP escribe "Samsung Galaxy S26" y "Galaxy S26"
  const fam = p => familia({ ...p, grupo: '', desc: sinMarca(p.desc, p.marca) });
  const simTec = p => (simDelSku(p.sku) || '-') + '/' + (tecladoDelSku(p.sku) || '-');
  const otraMemoria = [], sinReferencia = [], deOtro = [];
  for(const p of choques){
    const X = p.codigo.trim().toUpperCase();
    const suyas = PRODUCTOS.filter(q => q !== p && (q.codigo || '').trim().toUpperCase() === X && mapaDe(q) === X);
    const igual = suyas.filter(q => simTec(q) === simTec(p));
    if(!suyas.length) sinReferencia.push(p.id + ' -> ' + X);
    else if(!igual.length) deOtro.push(p.id + ' (' + simTec(p) + ') lleva ' + X + ', que es ' + simTec(suyas[0]) + ' (' + suyas[0].id + ')');
    else if(igual.some(q => fam(q) === fam(p))) otraMemoria.push(p.id + ' -> ' + X);
    else deOtro.push(p.id + ' lleva ' + X + ', que es otro modelo (' + igual[0].id + ')');
  }
  ok(deOtro.length === 0,
     'la columna CODIGO nunca apunta a otro producto (otra Sim, otro teclado u otro modelo)',
     deOtro.length ? deOtro.length + ': ' + deOtro.slice(0, 20).join(' | ') + (deOtro.length > 20 ? ' | ...' : '')
                   : conCol.length + ' verificadas');
  R.push('  --  ' + choques.length + ' donde la columna y el mapa no coinciden: ' + otraMemoria.length +
         ' son otra memoria del mismo modelo (aceptado, Pedro 26/09), ' + sinReferencia.length +
         ' sin otra fila con ese codigo para comparar' +
         (sinReferencia.length ? ' (' + sinReferencia.join(', ') + ')' : '') +
         ' y ' + deOtro.length + ' de otro producto');

  /* La celda de variantes tiene que tener tantas posiciones como colores la
     fila: una celda corrida le da a un color el archivo del color de al lado,
     que es el error que el codigo propio vino a terminar. */
  const corridas = PRODUCTOS.filter(p => {
    const cols = partirColores(p.color);
    const celda = (p.codigoVar || '').trim();
    return cols.length && celda && celda.split('/').length !== cols.length;
  });
  ok(corridas.length === 0, 'CODIGO_VAR trae un codigo por color, en el mismo orden',
     corridas.slice(0, 3).map(p => p.id).join(' | '));

  /* Y que la variante que manda la planilla no choque con la del mapa.
     Que difieran no siempre es un error: la fila del Watch Ultra 3 Alpine
     Loop dice "Black" en Color y CODIGO_VAR apunta a "Black Alpine Loop M",
     que es la correcta para ESA fila aunque el mapa, leyendo solo el texto
     "Black", conteste la Black a secas. La planilla sabe de que fila habla y
     el texto no.

     Lo que si es siempre un error es que un color se lleve la variante de
     OTRO color de la misma fila: eso es una celda dada vuelta, y es la unica
     forma en que la columna pondria la foto equivocada. */
  let cruzadas = 0;
  const distintas = [];
  for(const p of PRODUCTOS){
    const cols = partirColores(p.color);
    const celda = (p.codigoVar || '').trim();
    if(!cols.length || !celda) continue;
    const partes = celda.split('/').map(x => x.trim());
    if(partes.length !== cols.length) continue;
    cols.forEach((c, i) => {
      const porTexto = archivoDeVariante(p.codigo, c);
      if(porTexto && partes[i] && porTexto !== partes[i])
        distintas.push(p.id + ' ' + c + ': planilla ' + partes[i] + ', mapa ' + porTexto);
      if(porTexto && partes[i]) cruzadas++;
    });
  }
  R.push('  --  ' + cruzadas + ' colores cruzados, ' + distintas.length +
         ' donde la planilla y el mapa no dicen lo mismo');
  distintas.slice(0, 3).forEach(d => R.push('        ' + d));

  const dadasVuelta = [];
  for(const p of PRODUCTOS){
    const cols = partirColores(p.color);
    if(!cols.length || !p.codigo) continue;
    for(const c of cols){
      const usa = varianteDeLaColumna(p, p.codigo, c);
      if(!usa) continue;
      const otro = cols.find(x => norm(x) !== norm(c) && archivoDeVariante(p.codigo, x) === usa);
      if(otro) dadasVuelta.push(p.id + ': ' + c + ' se lleva la variante de ' + otro + ' (' + usa + ')');
    }
  }
  ok(dadasVuelta.length === 0,
     'la celda nunca le da a un color la variante de OTRO color de la fila',
     dadasVuelta.slice(0, 3).join(' | ') || cruzadas + ' colores revisados');

  /* Las dos guardas de varianteDeLaColumna(), probadas a mano: una celda
     corrida y un codigo que es de otro producto NO se usan. Son las dos
     formas en que una columna mal escrita pondria la foto de otro. */
  /* 29/09 (hallazgo 180): solo corrian si ADVAPP mandaba una fila de varios
     colores con CODIGO_VAR, y ADVAPP manda un color por fila: todos los dias
     decia "las guardas no se probaron" y se podian romper sin que nada
     avisara. Si no hay una fila asi, se arma una con un producto del mapa de
     hoy que tenga dos variantes con nombre (sin nombres fijos). Los casos
     inventados de punta a punta (AT-9001) estan en CASOS_COLUMNA de
     herramientas/catalogo_maestro.py, que corre guardas-t1. */
  const armarFila = () => {
    for(const cod of Object.keys(CATALOGO.vars || {})){
      const t = CATALOGO.vars[cod];
      const nombres = Object.keys(t).filter(k => /^[a-z]{4,}$/.test(k));
      const a = nombres[0], b = nombres.find(k => t[k] !== t[a]);
      if(!a || !b) continue;
      const fila = { id: '(armada)', codigo: cod, color: a + '/' + b, codigoVar: t[a] + '/' + t[b] };
      if(partirColores(fila.color).length === 2) return fila;
    }
    return null;
  };
  const deVerdad = PRODUCTOS.find(p => (p.codigoVar || '').includes('/')
                                  && partirColores(p.color).length > 1);
  const conVar = deVerdad || armarFila();
  if(conVar){
    R.push('  --  las guardas de la celda se prueban con ' + (deVerdad
      ? 'la fila ' + conVar.id : 'una fila armada con ' + conVar.codigo + ' (' + conVar.color + ') del mapa de hoy'));
    const cols = partirColores(conVar.color);
    // una variante con la forma de las del producto, pero dada de baja
    let muerta = '';
    for(let n = 99; n > 0 && !muerta; n--){
      const v = conVar.codigo + '-' + String(n).padStart(2, '0');
      if(!Object.values((CATALOGO.vars || {})[conVar.codigo] || {}).includes(v)) muerta = v;
    }
    const deBaja = {...conVar, codigoVar: [muerta, ...conVar.codigoVar.split('/').slice(1)].join('/')};
    ok(varianteDeLaColumna(deBaja, conVar.codigo, cols[0]) === '',
       'ni una variante que ya no esta en el catalogo', muerta);
    const bueno = varianteDeLaColumna(conVar, conVar.codigo, cols[0]);
    ok(bueno === conVar.codigoVar.split('/')[0].trim(),
       'varianteDeLaColumna toma la posicion del color', bueno);
    const corrida = {...conVar, codigoVar: conVar.codigoVar.split('/').slice(0, -1).join('/')};
    ok(varianteDeLaColumna(corrida, conVar.codigo, cols[0]) === '',
       'y no usa una celda a la que le falta una posicion');
    const ajena = {...conVar, codigoVar: cols.map(() => 'AT-9999-01').join('/')};
    ok(varianteDeLaColumna(ajena, conVar.codigo, cols[0]) === '',
       'ni una variante que es de otro producto');
    const alReves = {...conVar, codigoVar: conVar.codigoVar.split('/').reverse().join('/')};
    const cruzado = varianteDeLaColumna(alReves, conVar.codigo, cols[0]);
    ok(!cruzado || cruzado !== archivoDeVariante(conVar.codigo, cols[1]),
       'ni una celda dada vuelta, que le daria a un color la foto del de al lado', cruzado);
  } else {
    R.push('  --  ninguna fila con varios colores trae CODIGO_VAR: las guardas no se probaron');
  }

  /* ---- 9. Preguntarle a una hermana por un color que ella no vende ----
     fotosDeColor() busca la foto del color en la fila y despues en sus
     hermanas: es lo que hace que el MacBook Neo 8/256 muestre la Indigo que
     esta cargada en la fila de 8/512. Pero la hermana tiene que contestar por
     ESE color, no por el suyo.

     El 21/09 contestaba por el suyo: leia su celda CODIGO_VAR con la lista de
     colores que le pasaban de afuera, y la fila Icyblue del Galaxy S25 FE
     devolvia su propia foto cuando le preguntaban por White. Eran cinco
     productos mostrando la foto de otro color, en la ficha y en la grilla. */
  /* Como se decide que es "otro color", sin ponerse a comparar textos: la
     escritura no sirve de juez -- el catalogo anota "natural titanium" y la
     planilla manda "Natural", o anota "lavander" y la planilla "Lavender", y
     eso es el MISMO color escrito distinto. Lo que se mira es el catalogo:
     el archivo esta mal si es el que el catalogo le dio a OTRO color que este
     mismo modelo vende. Ahi no hay duda posible. */
  const deOtroColor = [];
  for(const m of MODELOS){
    const suyos = [...new Set(m.variantes.flatMap(v => partirColores(v.color)))];
    for(const v of m.variantes){
      for(const c of suyos){
        for(const u of fotosDeColor(v, c)){
          const arch = decodeURIComponent((u.split('/').pop() || '')).replace(/\.[a-z]+$/i, '');
          if(!/^AT-\d{4}-\d{2}$/.test(arch)) continue;
          const cod = arch.slice(0, 7);
          // Si ese archivo TAMBIEN es el del color pedido, es el mismo color
          // escrito de dos formas ("Black" y "negro" apuntan al mismo): no hay
          // nada que reprochar.
          if(archivoDeVariante(cod, c) === arch) continue;
          const duenio = suyos.find(x => norm(x) !== norm(c) &&
                                         archivoDeVariante(cod, x) === arch);
          if(duenio) deOtroColor.push(v.id + ' pide ' + c + ' y le dan ' + arch +
                                      ', que el catalogo le dio a ' + duenio);
        }
      }
    }
  }
  ok(deOtroColor.length === 0,
     'nadie devuelve, para un color, el archivo que el catalogo le dio a otro',
     [...new Set(deOtroColor)].slice(0, 4).join(' | ') || 'ninguno');

  /* ---- 10. Dos filas del mismo producto, dos colores, dos fotos ----
     Lo que MUESTRA la web, entre filas y no dentro de una (29/09, hallazgo
     180). El Watch Ultra 3 "Natural – Blue Trail Loop M/L" (SW-APP-016) y
     "Natural – Anchor Blue Ocean Band" (SW-APP-017) traian las dos
     CODIGO_VAR AT-0455-05 y salian con la misma foto, la de la Ocean Band: la
     celda pasaba todas las guardas (una fila, un color, codigo propio y vivo)
     y lo de arriba solo mira dentro de cada fila. El juez es el mapa, no el
     texto: esta mal si el mapa le da a los dos colores variantes DISTINTAS y
     la web les muestra el mismo archivo. Mismo color en otra memoria ("foto
     del hermano", Pedro 26/09) da la misma variante y no cuenta. */
  const porProducto = new Map();
  for(const p of PRODUCTOS){
    const cols = partirColores(p.color);
    if(!p.codigo || cols.length !== 1) continue;
    const arch = decodeURIComponent(((fotosDeColor(p, cols[0])[0] || '').split('/').pop() || ''))
                   .replace(/\.[a-z]+$/i, '');
    const mapa = archivoDeVariante(p.codigo, cols[0]);
    if(!/^AT-\d{4}-\d{2}$/.test(arch) || !mapa) continue;
    if(!porProducto.has(p.codigo)) porProducto.set(p.codigo, []);
    porProducto.get(p.codigo).push({ p, c: cols[0], arch, mapa });
  }
  const mismaFoto = [];
  let filasVistas = 0;
  for(const filas of porProducto.values()){
    filasVistas += filas.length;
    filas.forEach((a, i) => filas.slice(i + 1).forEach(b => {
      if(a.arch === b.arch && a.mapa !== b.mapa)
        mismaFoto.push(a.p.id + ' (' + a.c + ') y ' + b.p.id + ' (' + b.c + ') muestran ' + a.arch +
                       '; el mapa dice ' + a.mapa + ' y ' + b.mapa);
    }));
  }
  ok(mismaFoto.length === 0,
     'dos filas del mismo producto con colores que el mapa separa nunca muestran la misma foto',
     mismaFoto.slice(0, 3).join(' | ') || filasVistas + ' filas con foto de su color');
}
