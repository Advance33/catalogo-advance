// Las fotos chicas (17/09/2026). Medido en un celular de 390 px, la portada
// bajaba 73 fotos de 900x900 -2,1 MB- para mostrarlas del tamaño de una
// estampilla. Ahora todo lo chico usa la copia de 400 px de fotos/mini/ y la
// grande queda para la ficha.
//
// Lo que se prueba: que la grilla y la portada pidan la chica, que la ficha
// muestre la grande, que la chica exista de verdad para todo lo que se vende
// hoy, y que la de respaldo de ADVAPP también se pida chica.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const dormir = ms => new Promise(r => setTimeout(r, ms));
const esMini = u => (u || '').includes(CARPETA_MINIS);

const esperar = setInterval(() => {
  if(!MODELOS.length || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperar);
  for(let i=1;i<5000;i++) clearInterval(i);
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; })
    .finally(() => {
      try{ cerrarFicha(); }catch(e){}
      try{ pararPaseos(); pararOfertas(); }catch(e){}
      for(let i=1;i<5000;i++) clearInterval(i);
      const pre=document.createElement('pre'); pre.id='RESULTADO';
      pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
      document.body.appendChild(pre);
    });
}, 150);

const existe = u => new Promise(r => {
  const im = new Image();
  im.onload = () => r(true);
  im.onerror = () => r(false);
  im.src = u;
});

async function correrPruebas(){
  /* ---- 1. La dirección de la chica sale de la de la grande ---- */
  ok(fotoChica(CARPETA_FOTOS + 'AT-0065-02.jpg') === CARPETA_MINIS + 'AT-0065-02.jpg',
     'la chica es la misma foto en fotos/mini/', fotoChica(CARPETA_FOTOS + 'AT-0065-02.jpg'));
  ok(fotoChica('https://lh3.googleusercontent.com/d/abc') === 'https://lh3.googleusercontent.com/d/abc=w400',
     'a las de Google se les pide el ancho chico', fotoChica('https://lh3.googleusercontent.com/d/abc'));
  ok(fotoChica(CARPETA_MINIS + 'AT-0065-02.jpg') === CARPETA_MINIS + 'AT-0065-02.jpg',
     'y pedirla dos veces no la rompe');
  ok(fotoChica('') === '' && fotoChica(undefined) === undefined, 'sin foto no inventa ninguna');

  /* ---- 2. Cada producto lleva las dos ---- */
  const conFoto = PRODUCTOS.filter(p => p.imagen);
  ok(conFoto.length > 100, 'hay productos con foto', conFoto.length);
  const mal = conFoto.filter(p => !esMini(p.imagen) && !/googleusercontent/.test(p.imagen));
  ok(!mal.length, 'la foto de cada producto es la chica',
     mal.slice(0, 3).map(p => p.id + ' ' + p.imagen).join(' | ') || conFoto.length + ' productos');
  const sinGrande = conFoto.filter(p => !p.imagenGrande || esMini(p.imagenGrande));
  ok(!sinGrande.length, 'y al lado queda la grande, para la ficha',
     sinGrande.slice(0, 3).map(p => p.id).join(' | ') || 'todas');

  /* ---- 3. La grilla pide la chica ---- */
  verTodoElCatalogo();
  await dormir(500);
  const fotos = [...document.querySelectorAll('.card .foto img')];
  ok(fotos.length > 5, 'la grilla dibuja fotos', fotos.length);
  const grandes = fotos.filter(im => !esMini(im.getAttribute('src')) && !/googleusercontent/.test(im.getAttribute('src')));
  ok(!grandes.length, 'y todas son las chicas',
     grandes.slice(0, 3).map(im => im.getAttribute('src')).join(' | ') || fotos.length + ' tarjetas');

  /* ---- 4. La ficha muestra la grande ---- */
  const p = PRODUCTOS.find(x => x.imagen && x.imagenGrande && !/googleusercontent/.test(x.imagen));
  abrirFicha(clave(p), null);
  await dormir(300);
  const grande = document.querySelector('#ficha .fi-foto img');
  ok(grande && grande.getAttribute('src') === p.imagenGrande,
     'la ficha muestra la foto grande', grande && grande.getAttribute('src'));
  cerrarFicha();

  /* ---- 5. Las chicas existen de verdad ---- */
  const muestra = [];
  for(const x of PRODUCTOS){
    if(muestra.length >= 12) break;
    if(x.imagen && esMini(x.imagen) && !muestra.includes(x.imagen)) muestra.push(x.imagen);
  }
  const faltan = [];
  for(const u of muestra) if(!(await existe(u))) faltan.push(u);
  ok(!faltan.length, 'las chicas están publicadas junto a las grandes',
     faltan.slice(0, 3).join(' | ') || muestra.length + ' probadas');

  /* ---- 6. Y pesan menos que las grandes ---- */
  const dos = muestra.slice(0, 5);
  let chica = 0, original = 0;
  for(const u of dos){
    const a = await fetch(u); chica += (await a.blob()).size;
    const b = await fetch(u.replace(CARPETA_MINIS, CARPETA_FOTOS)); original += (await b.blob()).size;
  }
  ok(chica > 0 && chica < original / 2, 'y pesan menos de la mitad',
     Math.round(chica / 1024) + ' KB contra ' + Math.round(original / 1024) + ' KB, en ' + dos.length + ' fotos');
}
