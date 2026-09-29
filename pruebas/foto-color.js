// Foto por color: el puntito es un selector, no un adorno. Si el cliente elige
// Orange tiene que ver el naranja, y si esa foto no existe la ficha lo dice.
//
// Antes no lo decia: volvia a la foto principal en silencio. En el iPhone 17
// Pro 256GB se elegia Orange, el puntito quedaba marcado, el texto decia
// "Orange" y la foto era la plateada. Parecia la foto del color y no lo era.
//
// Sin nombres fijos: los casos se buscan en los datos del dia.
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
  verTodoElCatalogo();
  if(!document.querySelectorAll('.card').length) return;
  clearInterval(esperar);
  for(let i = 1; i < 5000; i++) clearInterval(i);
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: ' + (e && e.stack || e)); fallas++; })
    .then(() => {
      try{ pararPaseos(); }catch(e){}
      try{ pararOfertas(); }catch(e){}
      for(let i=1;i<5000;i++) clearInterval(i);
      reportar();
    });
}, 120);

const dormir = ms => new Promise(r => setTimeout(r, ms));

// Existe de verdad el archivo, sin mirar el DOM: lo mismo que hace la ficha
const existe = url => new Promise(r => {
  const im = new Image();
  im.onload = () => r(true);
  im.onerror = () => r(false);
  im.src = url;
});

/* Los colores de cada ficha como los dibuja la ficha (coloresFicha): uno por
   puntito, cada uno con la fila que lo vende, igual que ficha.js.
   29/09 (hallazgo 47): hasta hoy esta tanda buscaba filas con dos o mas
   colores en la celda y archivos <SKU>-<color>.jpg. Desde ADVAPP cada fila
   trae un color (0 de 758 con dos) y las fotos se llaman AT-####-NN, asi que
   no revisaba nada y decia OK: "0 fotos de color revisadas" y "no hay
   ninguna ficha con un color sin foto", con el aviso sin ninguna prueba. */
function puntitosDeCadaFicha(){
  const vistas = new Set(), fichas = [];
  for(const m of MODELOS){
    for(const v of m.variantes){
      const { lista } = coloresFicha(v, m);
      if(lista.length < 2) continue;
      const firma = lista.map(x => clave(x.fila) + ':' + norm(x.nombre)).sort().join('|');
      if(vistas.has(firma)) continue;
      vistas.add(firma);
      fichas.push({ m, v, lista });
    }
  }
  return fichas;
}
const archivo = u => decodeURIComponent(String(u || '').split('/').pop() || '').replace(/\.[a-z]+$/i, '');

/* Abre la ficha, toca el puntito y cuenta lo que queda a la vista */
async function tocarColor(v, color){
  abrirFicha(clave(v), false);
  await dormir(400);
  const d = document.getElementById('ficha') || document;
  const boton = [...d.querySelectorAll('.fi-pintas button')].find(b => b.dataset.color === color);
  if(!boton) return null;
  boton.click();
  await dormir(600);
  const marco = d.querySelector('.fi-marco');
  const img = marco && marco.querySelector('img');
  const nota = d.querySelector('#fi-color-hint');
  return {
    img: img ? archivo(img.getAttribute('src')) : '',
    cartel: !img && !!(marco && marco.querySelector('.sinfoto')),
    aviso: !!nota && !nota.hasAttribute('hidden') && /sin foto/i.test(nota.textContent),
    nota: nota ? (nota.hasAttribute('hidden') ? '(oculto) ' : '') + nota.textContent : '(no hay aviso)'
  };
}

async function correrPruebas(){
  const fichas = puntitosDeCadaFicha();
  if(!fichas.length){
    R.push('  --  hoy ninguna ficha tiene dos colores para elegir: nada que probar');
  }

  /* ---- 1. En una ficha, el archivo de un color no puede ser el de otro ----
     Cuando dos colores muestran el mismo archivo, uno de los dos esta mal:
     asi estaba CEL-APP-068-orange.jpg, que adentro tenia el plateado, y asi
     el 29/09 el Watch Ultra 3 mostraba la Ocean Band al elegir la Blue Trail
     Loop (las dos filas con AT-0455-05). El juez es el mapa del catalogo, no
     el texto, como en codigos.js: esta mal si el mapa les da variantes
     distintas. "Sage" y "Green" del iPhone 17 son el mismo archivo y el mapa
     les da la misma variante. Si el mapa no conoce uno de los dos, no hay
     juez y se cuenta aparte. */
  let colores = 0, sinJuez = 0;
  const repetidos = [];
  for(const { v, lista } of fichas){
    const porArchivo = new Map();
    for(const x of lista){
      const u = fotosDeColor(x.fila, x.nombre)[0];
      if(!u) continue;
      colores++;
      const a = archivo(u);
      if(!porArchivo.has(a)) porArchivo.set(a, []);
      porArchivo.get(a).push(x);
    }
    for(const [a, xs] of porArchivo){
      if(xs.length < 2) continue;
      const mapas = xs.map(x => archivoDeVariante(x.fila.codigo, x.nombre));
      if(mapas.some(z => !z)){ sinJuez++; continue; }
      if(new Set(mapas).size > 1) repetidos.push(v.id + ': ' + xs.map(x => x.nombre).join(' y ') + ' -> ' + a);
    }
  }
  if(fichas.length)
    ok(colores > 0 && !repetidos.length, 'en ninguna ficha dos colores que el mapa separa muestran el mismo archivo',
       [...new Set(repetidos)].slice(0, 3).join(' | ') ||
       colores + ' fotos de color en ' + fichas.length + ' fichas' + (sinJuez ? ', ' + sinJuez + ' sin juez' : ''));

  /* ---- 2. Elegir un color sin foto nunca deja otra foto a la vista, callada ----
     Lo que se exige (verificacion del 29/09): la ficha muestra el cartel "sin
     imagen" (el marco sin foto) o el aviso "Sin foto de este color". Las dos
     cosas son honestas. Lo que no puede pasar es una foto a la vista sin
     aviso, que es como el iPhone 17 Pro mostraba la plateada con "Orange"
     marcado. Casos reales del 29/09: TAB-SAM-027 / Silver y TAB-SAM-044 /
     Black, que salen con el cartel. */
  const sinFoto = [];
  for(const f of fichas) for(const x of f.lista)
    if(!fotosDeColor(x.fila, x.nombre).length) sinFoto.push({ v: f.v, color: x.nombre });
  if(!sinFoto.length){
    R.push('  --  hoy ninguna ficha tiene un color sin foto: se prueba solo el caso forzado (2b)');
  }else{
    const mal = [], vistos = [];
    for(const c of sinFoto.filter((c, i) => sinFoto.findIndex(o => o.v === c.v) === i).slice(0, 3)){
      const r = await tocarColor(c.v, c.color);
      const txt = c.v.id + ' / ' + c.color;
      if(!r){ mal.push(txt + ': la ficha no tiene ese puntito'); continue; }
      vistos.push(txt + (r.cartel ? ' (cartel)' : ' (aviso)'));
      if(!r.cartel && !r.aviso) mal.push(txt + ': muestra ' + (r.img || 'nada') + ' y el aviso dice ' + r.nota);
    }
    ok(!mal.length, 'al elegir un color sin foto se ve el cartel o el aviso, nunca otra foto callada',
       mal.join(' | ') || sinFoto.length + ' colores sin foto; mirados: ' + vistos.join(', '));
  }

  /* ---- 2b. El aviso, a la fuerza ----
     Los casos de hoy salen con el cartel (sus filas no tienen ninguna foto) y
     el aviso quedaria sin probar. Se le saca a un color con foto sus archivos
     del indice -en su fila Y en sus hermanas, porque fotosDeColor() busca en
     las dos- y sus fotos de ADVAPP, que son el respaldo. La fila tiene que
     tener portada, para que la ficha tenga una foto que no sea la del color.
     Se devuelve todo recien despues del clic y la espera: mostrarFotoColor
     consulta el indice en el momento del clic. */
  const forzable = fichas.flatMap(f => f.lista.map(x => ({ v: f.v, x })))
    .find(({ v, x }) => v.imagen && x.fila.imagen && fotosDeColor(x.fila, x.nombre).length);
  if(forzable){
    const { v, x } = forzable;
    const hermanas = (buscarModelo(clave(x.fila)) || { variantes: [x.fila] }).variantes;
    const indice = INDICE_FOTOS;
    const advapp = new Map(hermanas.map(h => [h, h.fotosAdvapp]));
    let r = null;
    try{
      INDICE_FOTOS = new Set(indice);
      for(let i = 0; i < 10 && fotosDeColor(x.fila, x.nombre).length; i++){
        hermanas.forEach(h => { h.fotosAdvapp = {}; });
        fotosDeColor(x.fila, x.nombre).forEach(u => INDICE_FOTOS.delete(archivo(u) + EXT_FOTOS));
      }
      if(!fotosDeColor(x.fila, x.nombre).length) r = await tocarColor(v, x.nombre);
    }finally{
      INDICE_FOTOS = indice;
      advapp.forEach((f, h) => { h.fotosAdvapp = f; });
    }
    ok(!!r && r.aviso, 'al elegir un color al que se le sacaron las fotos, la ficha dice "sin foto"',
       v.id + ' / ' + x.nombre + ': ' + (r ? r.nota : 'no se pudo forzar'));
  }else if(fichas.length){
    R.push('  --  ningun color con foto en una fila con portada: el aviso no se forzo');
  }

  /* ---- 3. Con foto, el aviso no aparece ---- */
  let conFoto = null;
  for(const f of fichas){
    for(const x of f.lista){
      const u = fotosDeColor(x.fila, x.nombre)[0];
      if(u && await existe(u)){ conFoto = { v: f.v, color: x.nombre }; break; }
    }
    if(conFoto) break;
  }
  if(conFoto){
    const r = await tocarColor(conFoto.v, conFoto.color);
    ok(!!r && !r.aviso, 'cuando la foto del color existe, no se avisa de mas',
       conFoto.v.id + ' / ' + conFoto.color + (r ? (r.aviso ? ' dice: ' + r.nota : '') : ': no hay puntito'));
  }
  try{ cerrarFicha(); }catch(e){}

  /* ---- Filas SIN color cuyo nombre deja clara la variante ----
     "Alfa 7 III Body Black", "Magic Mouse 2 — White": la columna Color llega
     vacia y la foto esta guardada por color. El 15/09 eran 18 fichas con la foto
     cargada mostrando el logo. Si varianteSinColor() encuentra la variante y su
     foto existe, la portada tiene que tenerla. */
  const sinColor = PRODUCTOS.filter(p => !p.color && p.codigo);
  const perdidas = sinColor.filter(p => {
    const v = varianteSinColor(p.codigo, p.modelo ? p.modelo + ' ' + p.desc : p.desc);
    return v && INDICE_FOTOS && INDICE_FOTOS.has(v + EXT_FOTOS) && !p.imagen;
  });
  ok(!perdidas.length, 'una fila sin color cuyo nombre dice la variante muestra su foto',
     perdidas.length ? perdidas.slice(0, 3).map(p => p.id + ' ' + p.desc).join(' | ')
                     : sinColor.length + ' filas sin color');

  /* Y no inventa: con dos variantes nombradas no elige ninguna. */
  const cod = Object.keys((CATALOGO && CATALOGO.vars) || {}).find(c =>
    new Set(Object.values(CATALOGO.vars[c])).size >= 2);
  if(cod){
    const nombres = Object.keys(CATALOGO.vars[cod]).filter(k => k.length >= 3);
    const dos = nombres.filter((k, i) => nombres.findIndex(o => CATALOGO.vars[cod][o] !== CATALOGO.vars[cod][k]) >= 0);
    const a = nombres[0], b = nombres.find(k => CATALOGO.vars[cod][k] !== CATALOGO.vars[cod][a]);
    if(a && b && !a.includes(b) && !b.includes(a))
      ok(varianteSinColor(cod, 'Producto ' + a + ' ' + b) === '', 'con dos variantes en el nombre no elige ninguna', cod + ': ' + a + ' / ' + b);
  }
}
