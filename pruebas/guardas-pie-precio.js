// El precio arriba del pie pegado al abrir la ficha en el celular (Pedro,
// 01/10/2026: "dale"). El pie con "Consultar por WhatsApp" y "Agregar al
// pedido" (o "Ya tenés en el pedido") queda pegado abajo; con la foto siempre
// en 4:3, en una pantalla baja tapaba el precio: el 01/10, en 53 de 182 fichas
// a 390x664 y en 127 en un iPhone SE con la barra de Safari (375x553).
// ajustarFotoFicha() mide y le saca a la foto lo justo (nunca menos de
// FOTO_FICHA_MIN px). Esta tanda recorre TODAS las fichas con stock, con y sin
// "Ya tenés en el pedido", en tres altos de pantalla (iframes: el headless no
// baja de 500 px de ancho).
//   - 390x664 y 390x750: en ninguna ficha el precio queda debajo del pie.
//   - 375x553 (iPhone SE con la barra): la foto nunca baja del mínimo, y si
//     el precio queda tapado es sólo porque la foto ya está en el mínimo.
//   - en una pantalla alta la foto no se toca (sigue en 4:3);
//   - con la ficha bajada, ajustar no mueve nada; en la compu, tampoco.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);

const esperaPP = setInterval(() => {
  if(!MODELOS.length || !FUENTE) return;
  clearInterval(esperaPP);
  for(let i=1;i<5000;i++) clearInterval(i);
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; })
    .finally(() => {
      try{ pararPaseos(); pararOfertas(); pararMundos(); }catch(e){}
      for(let i=1;i<5000;i++) clearInterval(i);
      const pre=document.createElement('pre'); pre.id='RESULTADO';
      pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
      document.body.appendChild(pre);
    });
}, 150);

const ppDormir = ms => new Promise(r => setTimeout(r, ms));
async function ppEsperarA(cond, ms = 40000){
  const t0 = Date.now();
  while(Date.now() - t0 < ms){ try{ if(cond()) return true; }catch(e){} await ppDormir(150); }
  return false;
}

// Recorre todas las fichas con stock dentro de la ventana w y devuelve lo medido
function ppRecorrer(w){
  return w.eval(`(() => {
    try{ pararOfertas(); pararPaseos(); pararMundos(); }catch(e){}
    const out = { fichas: 0, tapadas: [], tapadasConFotoMin: 0, fotoMin: 1e9, fotoMax: 0, cuatroTercios: 0 };
    const antes = PEDIDO.slice();
    const medir = () => { try{ document.getAnimations().forEach(x => x.finish()); }catch(e){}
      const d = document.getElementById('ficha'); d.querySelector('.caja').scrollTop = 0;
      const u = d.querySelector('.fi-precio .usd').getBoundingClientRect(), p = d.querySelector('.fi-botones').getBoundingClientRect();
      const f = d.querySelector('.fi-marco'), rf = f.getBoundingClientRect();
      return { tapa: u.bottom > p.top + 0.5, foto: rf.height, ancho: rf.width, achicada: !!f.style.maxHeight };
    };
    const anotar = (x, nombre) => {
      out.fichas++;
      out.fotoMin = Math.min(out.fotoMin, x.foto); out.fotoMax = Math.max(out.fotoMax, x.foto);
      if(!x.achicada && Math.abs(x.foto - x.ancho * 3 / 4) < 2) out.cuatroTercios++;
      if(x.tapa){ out.tapadas.push(nombre); if(x.foto <= FOTO_FICHA_MIN + 0.5) out.tapadasConFotoMin++; }
    };
    try{
      for(const m of MODELOS.filter(x => x.stock)){
        PEDIDO = []; abrirFicha(clave(m.rep), null); anotar(medir(), m.desc); cerrarFicha();
        const otra = m.variantes.find(v => v.stock && clave(v) !== clave(m.rep));
        if(otra){ PEDIDO = [{ k: clave(otra), n: 1, color: '' }]; abrirFicha(clave(m.rep), null); anotar(medir(), m.desc + ' (con aviso)'); cerrarFicha(); }
      }
    } finally { PEDIDO = antes; }
    out.min = FOTO_FICHA_MIN;
    return JSON.stringify(out);
  })()`);
}

async function correrPruebas(){
  ok(typeof ajustarFotoFicha === 'function' && typeof FOTO_FICHA_MIN === 'number' && FOTO_FICHA_MIN >= 80,
     'la ficha tiene su ajuste de foto (ajustarFotoFicha) con un minimo razonable', typeof FOTO_FICHA_MIN === 'number' ? FOTO_FICHA_MIN + ' px' : '-');

  // En la compu no se toca nada
  const m0 = MODELOS.find(x => x.stock);
  abrirFicha(clave(m0.rep), null);
  await ppDormir(60);
  const marco0 = document.querySelector('#ficha .fi-marco');
  ok(!!marco0 && !marco0.style.maxHeight, 'en la compu la foto de la ficha queda como siempre', marco0 && (marco0.style.maxHeight || 'sin tope'));
  quitarFicha();

  for(const [ancho, alto] of [[390, 664], [390, 750], [375, 553]]){
    const f = document.createElement('iframe');
    f.style.cssText = `width:${ancho}px;height:${alto}px;border:0;position:absolute;left:-9999px;top:0`;
    f.src = 'index.html';
    document.body.appendChild(f);
    try{
      const listo = await ppEsperarA(() => f.contentWindow.eval('MODELOS.length && FUENTE'));
      ok(listo, `[${ancho}x${alto}] el celular carga`);
      if(!listo) continue;
      const r = JSON.parse(ppRecorrer(f.contentWindow));
      info(`[${ancho}x${alto}] ${r.fichas} fichas · foto entre ${Math.round(r.fotoMin)} y ${Math.round(r.fotoMax)} px · ${r.tapadas.length} con el precio tapado`);
      ok(r.fichas > 20, `[${ancho}x${alto}] se recorrieron las fichas con stock (con y sin "Ya tenés en el pedido")`, r.fichas);
      ok(r.fotoMin >= r.min - 3, `[${ancho}x${alto}] la foto nunca baja del minimo`, Math.round(r.fotoMin) + ' px');
      if(alto >= 660){
        ok(!r.tapadas.length, `[${ancho}x${alto}] en ninguna ficha el pie tapa el precio`, r.tapadas.slice(0, 3).join(' | ') || 'ninguna');
      }else{
        ok(r.tapadas.length === r.tapadasConFotoMin,
           `[${ancho}x${alto}] si el precio queda tapado es sólo porque la foto ya esta en el minimo`,
           r.tapadas.length + ' tapadas, ' + r.tapadasConFotoMin + ' con la foto en el minimo');
      }
      if(alto >= 740) ok(r.cuatroTercios > r.fichas / 2, `[${ancho}x${alto}] en una pantalla alta casi todas las fotos quedan en 4:3`, r.cuatroTercios + ' de ' + r.fichas);
      // Con la ficha bajada, ajustar no mueve nada
      const w = f.contentWindow, doc = f.contentDocument;
      const quieto = w.eval(`(() => {
        const m = MODELOS.find(x => x.stock); abrirFicha(clave(m.rep), null);
        try{ document.getAnimations().forEach(x => x.finish()); }catch(e){}
        const d = document.getElementById('ficha'), c = d.querySelector('.caja'), f = d.querySelector('.fi-marco');
        c.scrollTop = 200; const antes = f.style.maxHeight, top = c.scrollTop;
        ajustarFotoFicha(d);
        const igual = f.style.maxHeight === antes && c.scrollTop === top;
        cerrarFicha(); return igual; })()`);
      ok(quieto, `[${ancho}x${alto}] con la ficha bajada, ajustar la foto no mueve nada`);
    } finally { f.remove(); }
  }
}
