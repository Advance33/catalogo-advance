// Las cuatro baterias y cargadores SmallRig sin foto (decision 1 A de Benja,
// 22/10/2026, sesion a-c2).
//
// La revision de las descripciones del 21/10 (notas-D17) encontro que las
// fotos de estas cuatro filas muestran OTRO producto:
//   AT-0019  ACC-CAN-001  Bateria Smallrig LP-E6NH Kit: el estuche cargador
//            tubular (familia 5105/5695), no el kit 3821
//   AT-0034  ACC-SON-004  Bateria Smallrig USB-C FW-50: un cargador que marca
//            2040 mAh, la LP-E6NH del kit 3821, no la NP-FW50
//   AT-0035  ACC-SON-006  Bateria Smallrig USB-C FZ-100: una bateria falsa con
//            cable D-Tap y un cargador doble, no una NP-FZ100 USB-C
//   AT-0508  ACC-SON-021  Cargador Smallrig + FZ-100: una NP-FZ100 USB-C suelta,
//            no el kit de cargador y dos baterias
// Benja eligio sacarlas y que queden SIN FOTO hasta que el proveedor diga el
// numero exacto de la caja. Se sacaron de los dos lados: los archivos de
// fotos/ (herramientas/sacar-fotos-malas.py, a _fotos-que-estan-mal/) y la
// foto de Drive que ADVAPP tenia para cada SKU (tecno_sku_fotos, con
// SIN-FOTOS-SMALLRIG-22-10.sql). ADVAPP mandaba LA MISMA imagen: sacar solo
// el archivo hacia que la web cayera a la de ADVAPP (fotoDeAdvapp) y el bot,
// que de respaldo usa fotos/indice.json, la siguiera mandando.
//
// Esta tanda mira que no vuelvan, por el contenido y no por el nombre (como
// la tabla SACADAS de guardas-f-fotos.js): ni el archivo con cualquier nombre
// de un producto SmallRig, ni la foto de Drive desde ADVAPP. Y que, sin foto,
// la tarjeta y la ficha muestren el cartel de siempre ("sin imagen" con la
// marca). Cuando el proveedor diga el numero de la caja y entre la foto
// correcta, esta tanda no falla: es otra imagen.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);

// Las cuatro filas, por su codigo del catalogo maestro
const FSR_CODIGOS = {
  'AT-0019': 'ACC-CAN-001 Bateria LP-E6NH Kit',
  'AT-0034': 'ACC-SON-004 Bateria USB-C FW-50',
  'AT-0035': 'ACC-SON-006 Bateria USB-C FZ-100',
  'AT-0508': 'ACC-SON-021 Cargador + FZ-100'
};
// SHA-256 de los archivos grandes que se sacaron (fotos/AT-####.jpg)
const FSR_SACADAS = {
  'a7967d315289960c67592c515790598cd1c8a98b2d77ea420c09f3b278777903': 'la de AT-0019 (estuche tubular)',
  '4216d09e48dd3dd03ec8265f3f9b6796dd64e5c0857e569462212e5afa6e5163': 'la de AT-0034 (cargador de LP-E6NH)',
  'a12657668e28a769f8117519dddc4a65a7eb278fdeb961541fab19fd834ecf0e': 'la de AT-0035 (bateria falsa con D-Tap)',
  '64f5927a7bef573e8cf9fe2b3987f539a345f14eab15282dc581bd6d14865f54': 'la de AT-0508 (NP-FZ100 suelta)'
};
// Las mismas cuatro, como las tenia ADVAPP: el archivo de Drive de cada SKU
const FSR_DRIVE = {
  '1n4H9oxaA9pM4V9JFMw8iUyQyLCaCkYRT': 'AT-0019',
  '1-HfSoSg7o3R4hSPJloIVmFaV4Z7tMhLo': 'AT-0034',
  '1Rdj3YbU2nS2H1Nt64YXyaQn9yy1Sn0O4': 'AT-0035',
  '1Ru8BxMyOAszOYghJi4kzZ7kS-i6-Jzct': 'AT-0508'
};
const fsrDeDrive = u => Object.keys(FSR_DRIVE).find(id => String(u || '').includes(id)) || '';

async function fsrHuella(url){
  const r = await fetch(url, { cache: 'no-store' });
  if(!r.ok) return '';
  const h = await crypto.subtle.digest('SHA-256', await r.arrayBuffer());
  return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join('');
}

const esperaFsr = setInterval(() => {
  if(!MODELOS.length || !FUENTE) return;
  clearInterval(esperaFsr);
  (async () => {
    try{ await fsrPruebas(); }catch(e){ R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; }
    finally{ try{ cerrarFicha(); }catch(e){} }
    try{ pararPaseos(); pararOfertas(); }catch(e){}
    for(let i=1;i<5000;i++) clearInterval(i);
    const pre=document.createElement('pre'); pre.id='RESULTADO';
    pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
    document.body.appendChild(pre);
  })();
}, 150);

async function fsrPruebas(){
  const codigoDe = p => String(p.codigo || '').trim().toUpperCase();
  const filas = PRODUCTOS.filter(p => FSR_CODIGOS[codigoDe(p)]);
  info('filas de hoy de las cuatro: ' + (filas.map(p => p.id + ' (' + codigoDe(p) + ')').join(', ') || 'ninguna'));

  /* ---- 1. Ningun archivo de un producto SmallRig es una de las cuatro ----
     Con cualquier nombre: la de AT-0035 parecia la de AT-0508 cruzada, y una
     foto equivocada puede volver como la de otro producto de la misma marca
     (por un --volver, una copia vieja o un backup). */
  if(!INDICE_FOTOS){
    info('sin indice de fotos no se pueden mirar los archivos');
  }else{
    const codigos = new Set(Object.keys(FSR_CODIGOS));
    for(const p of PRODUCTOS) if(norm(p.marca) === 'smallrig' && codigoDe(p)) codigos.add(codigoDe(p));
    const archivos = [...INDICE_FOTOS].filter(f => [...codigos].some(c => f === c + EXT_FOTOS || f.startsWith(c + '-')));
    const vueltas = [];
    for(const f of archivos){
      const h = await fsrHuella(CARPETA_FOTOS + f);
      if(FSR_SACADAS[h]) vueltas.push(f + ' es ' + FSR_SACADAS[h]);
    }
    ok(!vueltas.length, '[1 A] ninguna foto de un producto SmallRig es una de las cuatro que se sacaron',
       vueltas.join(' | ') || codigos.size + ' codigos SmallRig, ' + archivos.length + ' archivo(s) mirados');
    const propias = archivos.filter(f => Object.keys(FSR_CODIGOS).some(c => f === c + EXT_FOTOS || f.startsWith(c + '-')));
    if(propias.length) info('las cuatro tienen archivo otra vez (' + propias.join(', ') + '): otra imagen, la del numero de la caja');
  }

  /* ---- 2. ADVAPP no manda la de Drive ----
     Sin archivo propio la web cae a la de ADVAPP (y entonces tambien falla
     "todas las portadas usan una de esas" de codigos.js), y el bot la manda
     primero aunque la web tenga la suya. Si falla, falta correr
     SIN-FOTOS-SMALLRIG-22-10.sql en Supabase (o alguien volvio a correr el
     sql/172 de ADVAPP, que las sembro). */
  if(!filas.length){
    info('hoy ADVAPP no trae ninguna de las cuatro filas: no hay foto de ADVAPP que mirar');
  }else{
    const conDrive = filas.filter(p => Object.values(p.fotosAdvapp || {}).some(fsrDeDrive));
    ok(!conDrive.length, '[1 A] ADVAPP no manda la foto equivocada de Drive de ninguna de las cuatro (si falla: correr SIN-FOTOS-SMALLRIG-22-10.sql)',
       conDrive.map(p => p.id + ' (' + FSR_DRIVE[fsrDeDrive(Object.values(p.fotosAdvapp).find(fsrDeDrive))] + ')').join(', ') || filas.length + ' filas');
  }

  /* ---- 3. Sin foto, el cartel de siempre ----
     La tarjeta y la ficha de cada una que hoy no tiene foto: el cartel con la
     marca y "sin imagen", y ninguna <img>. Las que tienen foto (la correcta,
     cuando llegue, o la de ADVAPP si falta el SQL: eso lo dice el punto 2) no
     se miran aca. */
  const sinFoto = filas.filter(p => !p.imagen);
  if(!sinFoto.length){
    info('ninguna de las cuatro esta hoy sin foto: el cartel no se mira');
    return;
  }
  const malTarjeta = [], malFicha = [];
  for(const p of sinFoto){
    const m = buscarModelo(clave(p));
    if(!m){ malTarjeta.push(p.id + ': no tiene tarjeta'); continue; }
    if(m.imagen){ info(p.id + ': su tarjeta muestra la foto de otra version del modelo'); }
    else{
      const el = tarjeta(m);
      const cartel = el.querySelector('.sinfoto');
      if(el.querySelector('img') || !cartel || !/sin imagen/i.test(cartel.textContent) || !/smallrig/i.test(cartel.textContent))
        malTarjeta.push(p.id);
    }
    abrirFicha(clave(p), null);
    const marco = document.querySelector('#ficha .fi-marco');
    const img = marco && marco.querySelector('img');
    if(!marco || img || !marco.querySelector('.sinfoto'))
      malFicha.push(p.id + (img ? ': muestra ' + img.getAttribute('src') : (marco ? '' : ': no se abrio la ficha')));
    try{ cerrarFicha(); }catch(e){}
  }
  ok(!malTarjeta.length, '[1 A] sin foto, la tarjeta muestra el cartel "sin imagen" con la marca y ninguna foto',
     malTarjeta.join(', ') || sinFoto.map(p => p.id).join(', '));
  ok(!malFicha.length, '[1 A] sin foto, la ficha muestra el cartel "sin imagen" y no pide ninguna foto',
     malFicha.join(' | ') || sinFoto.map(p => p.id).join(', '));
}
