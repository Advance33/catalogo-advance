// El contrato landing/1.1 (09/09/2026): lo que la web se comprometio a hacer
// de su lado. Que lea el manifiesto de la planilla (hoja Meta), que el sello
// "Actualizado" diga la verdad, que la portada sea la foto del primer color
// que la fila vende HOY, que la vidriera salga de la planilla y no de una
// lista fija, y que las categorias nuevas tengan lugar en la barra.
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
  /* ---- 1. El manifiesto ---- */
  ok(META === null || typeof META === 'object', 'META es el manifiesto o null (nunca revienta)');
  if(META){
    ok(/^landing\/1\./.test(META.contrato || ''), 'el contrato es de la familia landing/1.x', META.contrato);
    ok(typeof META.verificado_hoy === 'boolean', 'dice si la carga del dia corrio', String(META.verificado_hoy));
    ok(Array.isArray(META.ofertas), 'trae la lista de ofertas', (META.ofertas || []).length + ' IDs');
    /* Las ofertas del manifiesto y las que la web deduce de Precio anterior
       tienen que ser las mismas: si se separan, uno de los dos miente. */
    const enBaja = PRODUCTOS.filter(p => p.antes !== null && p.precio !== null && p.antes > p.precio).map(p => p.id).sort();
    const delMeta = [...(META.ofertas || [])].sort();
    ok(JSON.stringify(enBaja) === JSON.stringify(delMeta),
       'las ofertas del manifiesto son las que tienen Precio anterior', enBaja.length + ' vs ' + delMeta.length);
  }else{
    R.push('  --  el manifiesto no llego: se prueba solo lo que no depende de el');
  }

  /* ---- 2. El sello dice la verdad ---- */
  const texto = document.getElementById('stamp').textContent.trim();
  if(META && META.verificado_hoy === true)
    ok(texto === 'Actualizado hoy', 'con carga de hoy el sello dice "Actualizado hoy"', texto);
  else
    ok(/^Actualizado \d{1,2}\/\d{1,2}\/\d{2,4}$/.test(texto) || texto === 'En vivo',
       'sin carga de hoy el sello muestra la fecha real de la fila mas nueva', texto);

  /* ---- 3. El indice de fotos y la portada por primer color ---- */
  ok(INDICE_FOTOS instanceof Set && INDICE_FOTOS.size > 100, 'el indice de fotos llego', INDICE_FOTOS ? INDICE_FOTOS.size + ' archivos' : 'null');
  if(INDICE_FOTOS){
    let conFotoDeColor = 0, bien = 0, malos = [];
    for(const p of PRODUCTOS){
      const primero = partirColores(p.color)[0];
      if(!primero || !p.id) continue;
      const s = slugColor(primero);
      const cand = [s, s.replace(/-/g, '')].map(f => p.id + '-' + f + EXT_FOTOS).find(n => INDICE_FOTOS.has(n));
      if(!cand) continue;
      conFotoDeColor++;
      if((p.imagen || '').endsWith(encodeURIComponent(cand.replace(EXT_FOTOS, '')) + EXT_FOTOS)) bien++;
      else malos.push(p.id + ' -> ' + (p.imagen || '').split('/').pop());
    }
    ok(conFotoDeColor > 0, 'hay productos con foto de su primer color', conFotoDeColor);
    ok(malos.length === 0, 'y en todos ellos la portada ES esa foto', malos.slice(0, 3).join(' | ') || bien + ' de ' + conFotoDeColor);
    /* Sin foto del primer color pero con foto del ID, la portada es la del ID */
    const soloBase = PRODUCTOS.find(p => p.id && INDICE_FOTOS.has(p.id + EXT_FOTOS) && !partirColores(p.color)[0]);
    if(soloBase) ok((soloBase.imagen || '').endsWith(encodeURIComponent(soloBase.id) + EXT_FOTOS),
                    'sin color, la portada es la foto del ID', soloBase.id);
    /* Y un producto sin ningun archivo no manda a pedir nada: placeholder directo */
    const sinNada = PRODUCTOS.find(p => p.id && !INDICE_FOTOS.has(p.id + EXT_FOTOS) && ![...INDICE_FOTOS].some(n => n.startsWith(p.id + '-')));
    if(sinNada) ok(!sinNada.imagen, 'sin archivos, la portada queda vacia y no se pide nada', sinNada.id);
  }

  /* ---- 4. La vidriera sale de la planilla ---- */
  ok(Array.isArray(VIDRIERA_FIJOS) && VIDRIERA_FIJOS.length === 0,
     'no hay IDs clavados en el codigo: las ofertas las define Precio anterior', VIDRIERA_FIJOS.length);

  /* ---- 5. Las categorias del contrato tienen lugar en la barra ---- */
  for(const c of ['E-Reader', 'Drone', 'Accesorio Drone'])
    ok(ORDEN_CATS.includes(c), 'ORDEN_CATS incluye ' + c);
}
