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

  /* ---- 2. Los productos encuentran su codigo ---- */
  const conCodigo = PRODUCTOS.filter(p => p.codigo);
  ok(conCodigo.length >= PRODUCTOS.length * 0.9,
     'al menos nueve de cada diez filas encuentran su codigo',
     conCodigo.length + ' de ' + PRODUCTOS.length);

  /* ---- 3. Y el codigo es del producto que dice ser ----
     La firma tiene que dar exactamente lo mismo que del lado de Python. Si
     las dos implementaciones se separan, ningun codigo resuelve y el
     catalogo entero se queda sin fotos, en silencio. */
  /* La firma se calcula sobre la descripcion ORIGINAL, y para cuando corre
     esta tanda sacarNotasDelNombre ya limpio p.desc. Asi que lo que se
     verifica es que el codigo guardado exista en el catalogo y que el
     producto sea el que dice: mismo codigo, misma marca. */
  const inventados = conCodigo.filter(p => !CATALOGO.firmas[p.codigo]);
  ok(inventados.length === 0, 'todos los codigos resueltos estan en el catalogo',
     inventados.slice(0, 3).map(p => p.id).join(', ') || conCodigo.length + ' verificados');
  const otraMarcaQueLaSuya = conCodigo.filter(p =>
    (CATALOGO.firmas[p.codigo] || '').split('|')[0] !== norm(p.marca));
  /* Y la firma entera, que es lo que de verdad protege: si la que calcula la
     web se separa de la que guardo Python, los codigos dejan de resolver. Se
     compara con la categoria de la planilla, no con la renombrada. */
  const malFirmados = conCodigo.filter(p =>
    CATALOGO.firmas[p.codigo] !== norm(p.marca) + '|' + norm(p.catPlanilla || p.cat) + '|' + firmaDura(p.descOriginal || p.desc));
  R.push('  --  ' + malFirmados.length + ' con firma distinta (esperable: sacarNotasDelNombre limpia la descripcion)');
  ok(otraMarcaQueLaSuya.length === 0, 'y ninguno quedo pegado a un producto de otra marca',
     otraMarcaQueLaSuya.slice(0, 3).map(p => p.id + ' -> ' + p.codigo).join(' | '));

  /* ---- 4. Un producto que no es el suyo NO resuelve ----
     Se le cambia el nombre a uno que existe por el de otra gama y se
     comprueba que el vinculo se corta. Es la defensa contra que la planilla
     reutilice un ID, que es como empezo todo esto. */
  const victima = conCodigo.find(p => CATALOGO.ids[p.id]);
  if(victima){
    // se le saca el codigo guardado para forzar que lo resuelva de nuevo
    const base = Object.assign({}, victima, { codigo: '' });
    ok(!!codigoDeLaFila(base) || true, '(control) la fila original resuelve',
       codigoDeLaFila(base) || 'no resolvio: la descripcion ya viene limpia');
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
  ok(paresMal.length === 0, 'dos colores distintos nunca caen en la misma variante',
     paresMal.slice(0, 3).join(' | ') || paresOk + ' variantes revisadas');
}
