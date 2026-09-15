// La planilla se lee por dos caminos (FUENTES). El 15/09/2026 quedo un filtro
// puesto en la hoja Landing y el primero, gviz, devolvio 19 filas de 556: la
// pagina publicada mostro 19 productos sin que nada avisara. Esta tanda simula
// ese recorte y exige que la pagina lo note contando contra Meta.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };

const esperar = setInterval(() => {
  if(!MODELOS.length || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperar);
  for(let i=1;i<5000;i++) clearInterval(i);
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; })
    .finally(() => {
      try{ pararPaseos(); }catch(e){}
      try{ pararOfertas(); }catch(e){}
      for(let i=1;i<5000;i++) clearInterval(i);
      const pre=document.createElement('pre'); pre.id='RESULTADO';
      pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
      document.body.appendChild(pre);
    });
}, 150);

const contarFilas = txt => parseCSV(txt).filter(f => f.some(c => c.trim())).length - 1;
const aCSV = filas => filas.map(f => f.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');

/* Cambia fetch por uno que recorta lo que devuelve cada fuente a la cantidad de
   filas pedida. Lo demas (Meta, cotizacion, fotos) pasa de largo. */
async function conFuentesRecortadas(recortes, hacer){
  const fetchReal = window.fetch;
  window.fetch = async (url, opts) => {
    const r = await fetchReal(url, opts);
    const i = FUENTES.findIndex(f => String(url).startsWith(f));
    if(i === -1 || recortes[i] === undefined) return r;
    const filas = parseCSV(await r.text());
    return new Response(aCSV(filas.slice(0, recortes[i] + 1)), { status: 200 });
  };
  try{ return await hacer(); } finally { window.fetch = fetchReal; }
}

async function correrPruebas(){
  const meta = await metaDelCiclo();
  const esperadas = Number(meta && meta.filas) || 0;
  if(!esperadas){
    R.push('  --   la planilla no trae en Meta cuantas filas escribio: no hay contra que contar');
    return;
  }

  // 1. Con la planilla de hoy, tal cual este
  const hoy = contarFilas(await bajarCSV());
  ok(hoy >= esperadas, 'la pagina lee todas las filas que dice Meta', hoy + ' de ' + esperadas);

  // 2. La primera fuente llega recortada, como con el filtro del 15/09
  const recortada = contarFilas(await conFuentesRecortadas([19], bajarCSV));
  ok(recortada >= esperadas, 'si la primera fuente llega recortada, se usa la otra',
     recortada + ' de ' + esperadas);

  // 3. Las dos llegan recortadas: tiene que quedarse con la que mas trajo, no
  //    con la primera que respondio
  const ambas = contarFilas(await conFuentesRecortadas([10, 30], bajarCSV));
  ok(ambas === 30, 'si ninguna llega completa, usa la que mas filas trajo', ambas);
}
