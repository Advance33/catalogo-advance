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

  /* ---- 3. El SKU, el indice de fotos y la portada por primer color ----
     Desde landing/1.2 las fotos se llaman por SKU (la identidad sin colores,
     compartida por las hermanas de otro color): la portada de una fila es
     fotos/<SKU>-<primer color>.jpg, y <SKU>.jpg solo si no vende colores.
     El nombre por ID queda de respaldo. */
  const sinSku = PRODUCTOS.filter(p => !p.sku);
  ok(sinSku.length === 0, 'todas las filas traen SKU', sinSku.length ? sinSku.slice(0, 3).map(p => p.id).join(', ') : PRODUCTOS.length + ' filas');
  const skuRaro = PRODUCTOS.filter(p => p.sku && !/^[a-z0-9~.\-]{1,79}$/.test(p.sku));
  ok(skuRaro.length === 0, 'el SKU usa solo el alfabeto del contrato [a-z0-9~.-]', skuRaro.slice(0, 3).map(p => p.sku).join(' | '));
  const hermanas = new Map();
  for(const p of PRODUCTOS) if(p.sku) hermanas.set(p.sku, (hermanas.get(p.sku) || 0) + 1);
  const compartidos = [...hermanas.values()].filter(n => n > 1).length;
  R.push('  --  ' + hermanas.size + ' SKU distintos, ' + compartidos + ' compartidos por hermanas de otro color');
  ok(INDICE_FOTOS instanceof Set && INDICE_FOTOS.size > 100, 'el indice de fotos llego', INDICE_FOTOS ? INDICE_FOTOS.size + ' archivos' : 'null');
  if(INDICE_FOTOS){
    const arch = n => encodeURIComponent(n) + EXT_FOTOS;
    let conFotoDeColor = 0, bien = 0, porSku = 0, malos = [];
    for(const p of PRODUCTOS){
      const primero = partirColores(p.color)[0];
      if(!primero || !(p.sku || p.id)) continue;
      const s = slugColor(primero);
      const formas = [s, s.replace(/-/g, '')];
      const cand = [p.sku, p.id].filter(Boolean).flatMap(b => formas.map(f => b + '-' + f)).find(n => INDICE_FOTOS.has(n + EXT_FOTOS));
      if(!cand) continue;
      conFotoDeColor++;
      if(p.sku && cand.startsWith(p.sku + '-')) porSku++;
      if((p.imagen || '').endsWith(arch(cand))) bien++;
      else malos.push(p.id + ' -> ' + (p.imagen || '').split('/').pop());
    }
    ok(conFotoDeColor > 0, 'hay productos con foto de su primer color', conFotoDeColor);
    ok(malos.length === 0, 'y en todos ellos la portada ES esa foto', malos.slice(0, 3).join(' | ') || bien + ' de ' + conFotoDeColor);
    ok(porSku > 0, 'y esas fotos se llaman por SKU, no por ID', porSku + ' de ' + conFotoDeColor);
    /* Dos hermanas con el mismo SKU y distinto primer color: portadas distintas */
    const porSkuLista = new Map();
    for(const p of PRODUCTOS) if(p.sku && p.imagen){ if(!porSkuLista.has(p.sku)) porSkuLista.set(p.sku, []); porSkuLista.get(p.sku).push(p); }
    let paresOk = 0, paresMal = [];
    for(const [sku, lst] of porSkuLista){
      if(lst.length < 2) continue;
      for(let i = 0; i < lst.length; i++) for(let j = i + 1; j < lst.length; j++){
        const a = partirColores(lst[i].color)[0], b = partirColores(lst[j].color)[0];
        if(!a || !b || slugColor(a) === slugColor(b)) continue;
        if(lst[i].imagen !== lst[j].imagen) paresOk++;
        else paresMal.push(lst[i].id + '/' + lst[j].id + ' -> ' + lst[i].imagen.split('/').pop());
      }
    }
    ok(paresMal.length === 0, 'hermanas del mismo SKU con distinto primer color tienen portadas distintas', paresMal.slice(0, 3).join(' | ') || paresOk + ' pares');
    /* Sin color: la portada es <SKU>.jpg */
    const soloBase = PRODUCTOS.find(p => p.sku && INDICE_FOTOS.has(p.sku + EXT_FOTOS) && !partirColores(p.color)[0]);
    if(soloBase) ok((soloBase.imagen || '').endsWith(arch(soloBase.sku)),
                    'sin color, la portada es <SKU>.jpg', soloBase.id);
    else R.push('  --  ningun producto sin color tiene <SKU>.jpg: no se prueba ese caso');
    /* Y un producto sin ningun archivo no manda a pedir nada: placeholder directo */
    const todos = [...INDICE_FOTOS];
    const tiene = b => b && (INDICE_FOTOS.has(b + EXT_FOTOS) || todos.some(n => n.startsWith(b + '-')));
    const sinNada = PRODUCTOS.find(p => p.id && !tiene(p.sku) && !tiene(p.id));
    if(sinNada) ok(!sinNada.imagen, 'sin archivos, la portada queda vacia y no se pide nada', sinNada.id);
    /* fotosDeColor no pide lo que el indice dice que no existe */
    let pedidas = 0, fantasmas = [];
    for(const p of PRODUCTOS.slice(0, 200)){
      for(const c of partirColores(p.color)){
        for(const u of fotosDeColor(p, c)){
          pedidas++;
          const n = decodeURIComponent(u.split('/').pop().split('?')[0]);
          if(!INDICE_FOTOS.has(n)) fantasmas.push(n);
        }
      }
    }
    ok(fantasmas.length === 0, 'fotosDeColor solo devuelve archivos que estan en el indice', fantasmas.slice(0, 3).join(' | ') || pedidas + ' urls');
  }

  /* ---- 4. La vidriera sale de la planilla ---- */
  ok(Array.isArray(VIDRIERA_FIJOS) && VIDRIERA_FIJOS.length === 0,
     'no hay IDs clavados en el codigo: las ofertas las define Precio anterior', VIDRIERA_FIJOS.length);

  /* ---- 5. Las categorias del contrato tienen lugar en la barra ---- */
  for(const c of ['E-Reader', 'Drone', 'Accesorio Drone'])
    ok(ORDEN_CATS.includes(c), 'ORDEN_CATS incluye ' + c);
}
