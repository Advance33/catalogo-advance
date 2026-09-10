// Foto por color: el puntito es un selector, no un adorno. Si el cliente elige
// Orange tiene que ver el naranja, y si esa foto no existe la ficha lo dice.
//
// Antes no lo decia: volvia a la foto principal en silencio. En el iPhone 17
// Pro 256GB se elegia Orange, el puntito quedaba marcado, el texto decia
// "Orange" y la foto era la plateada. Parecia la foto del color y no lo era.
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

async function correrPruebas(){
  /* ---- 1. El archivo de un color no puede ser el de otro color ----
     Dentro de un mismo modelo, dos colores distintos tienen que tener fotos
     distintas. Cuando coinciden es que un archivo quedo mal nombrado: asi
     estaba CEL-APP-068-orange.jpg, que adentro tenia el plateado. */
  const conColor = MODELOS.filter(m => m.multi || (m.color || '').includes('/'));
  let revisados = 0, repetidos = [];
  for(const m of conColor.slice(0, 40)){
    for(const v of (m.variantes || [m])){
      const cols = (v.color || '').split('/').map(s => s.trim()).filter(Boolean);
      if(cols.length < 2 || !v.id) continue;
      const vistos = new Map();
      for(const c of cols){
        // solo los archivos propios (por SKU o, de respaldo, por ID): los de
        // las hermanas de otra capacidad no cuentan para este chequeo
        const s = slugColor(c);
        const propias = new Set([v.sku, v.id].filter(Boolean).flatMap(b =>
          [s, s.replace(/-/g, '')].map(f => urlFoto(CARPETA_FOTOS + encodeURIComponent(b + '-' + f) + EXT_FOTOS))));
        const urls = fotosDeColor(v, c).filter(u => propias.has(u));
        if(!urls.length) continue;
        const url = urls[0];
        if(!(await existe(url))) continue;
        revisados++;
        // dos colores distintos apuntando al mismo archivo no puede pasar
        for(const [otro, u] of vistos) if(u === url) repetidos.push(v.id + ': ' + otro + ' y ' + c);
        vistos.set(c, url);
      }
    }
  }
  ok(!repetidos.length, 'ningun color usa el archivo de otro color',
     repetidos.length ? repetidos.slice(0, 3).join(' | ') : revisados + ' fotos de color revisadas');

  /* ---- 2. Elegir un color sin foto tiene que avisarlo ----
     Se busca una ficha a la que le falte la foto de alguno de sus colores. */
  let caso = null;
  for(const m of conColor){
    for(const v of (m.variantes || [m])){
      const cols = (v.color || '').split('/').map(s => s.trim()).filter(Boolean);
      if(cols.length < 2 || !v.id || !v.imagen) continue;
      for(const c of cols){
        const urls = fotosDeColor(v, c);
        let hay = false;
        for(const u of urls) if(await existe(u)) { hay = true; break; }
        if(!hay){ caso = { v, m, color: c }; break; }
      }
      if(caso) break;
    }
    if(caso) break;
  }

  if(!caso){
    ok(true, 'no hay ninguna ficha con un color sin foto: nada que avisar');
  }else{
    abrirFicha(clave(caso.v), false);
    await dormir(400);
    const d = document.querySelector('.fi') || document.querySelector('.ficha') || document;
    const boton = [...d.querySelectorAll('.fi-pintas button')]
                    .find(b => b.dataset.color === caso.color);
    ok(!!boton, 'la ficha tiene el puntito del color que no tiene foto',
       caso.v.id + ' / ' + caso.color);
    if(boton){
      boton.click();
      await dormir(600);
      const nota = d.querySelector('#fi-color-hint');
      const visible = nota && !nota.hasAttribute('hidden');
      ok(visible && /sin foto/i.test(nota.textContent),
         'al elegir un color sin foto, la ficha lo dice',
         nota ? (visible ? nota.textContent : '(el aviso quedo oculto)') : '(no hay aviso)');
    }
  }

  /* ---- 3. Con foto, el aviso no aparece ---- */
  let conFoto = null;
  for(const m of conColor){
    for(const v of (m.variantes || [m])){
      const cols = (v.color || '').split('/').map(s => s.trim()).filter(Boolean);
      if(cols.length < 2 || !v.id) continue;
      for(const c of cols){
        for(const u of fotosDeColor(v, c)) if(await existe(u)) { conFoto = { v, color: c }; break; }
        if(conFoto) break;
      }
      if(conFoto) break;
    }
    if(conFoto) break;
  }
  if(conFoto){
    abrirFicha(clave(conFoto.v), false);
    await dormir(400);
    const d = document.querySelector('.fi') || document.querySelector('.ficha') || document;
    const boton = [...d.querySelectorAll('.fi-pintas button')]
                    .find(b => b.dataset.color === conFoto.color);
    if(boton){
      boton.click();
      await dormir(600);
      const nota = d.querySelector('#fi-color-hint');
      const dice = nota && !nota.hasAttribute('hidden') ? nota.textContent : '';
      ok(!/sin foto/i.test(dice),
         'cuando la foto del color existe, no se avisa de mas',
         conFoto.v.id + ' / ' + conFoto.color + (dice ? ' dice: ' + dice : ''));
    }
  }
}
