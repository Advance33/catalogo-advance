// Adelantar una parte (Benja, 26/10/2026) y en dólares por transferencia
// (Benja, 03/11/2026: «adelanto con transferencia en dólares»).
//   la cuenta  en efectivo o en pesos, el adelanto no lleva recargo. En
//              dólares por transferencia, el +3% de «¿Cómo puedo pagar?»
//              va encima de lo que cubre: cubre u$ 300 → transfiere u$ 309,
//              al dólar; si cubre todo, el precio + 3%. Lo que queda va a la
//              tarjeta con la cuenta de siempre. El bot hace la misma cuenta.
//   la ficha   con u$ elegido aparece «Efectivo» / «Transferencia (+3%)»; en
//              pesos, no. El monto sigue al cambiar de medio, el WhatsApp dice
//              las dos cifras y otra ficha arranca en efectivo.
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);

const esperaAD = setInterval(() => {
  if(!MODELOS.length || !FUENTE || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperaAD);
  for(let i=1;i<5000;i++) clearInterval(i);
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; })
    .finally(() => {
      try{ if(FICHA) quitarFicha(); }catch(e){}
      try{ pararPaseos(); pararOfertas(); pararMundos(); }catch(e){}
      for(let i=1;i<5000;i++) clearInterval(i);
      const pre=document.createElement('pre'); pre.id='RESULTADO';
      pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
      document.body.appendChild(pre);
    });
}, 150);

const adDormir = ms => new Promise(r => setTimeout(r, ms));
const adTxt = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
const adPlata = n => Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 });

async function correrPruebas(){
  probarElRecargo();
  probarLaCuenta();
  await probarLaFicha();
}

/* ---- El 3% es el de «¿Cómo puedo pagar?» ---- */
function probarElRecargo(){
  const pagar = PREGUNTAS.find(q => q.p === '¿Cómo puedo pagar?');
  const renglon = pagar && pagar.lista.find(x => /^Transferencia bancaria en dólares/.test(x));
  ok(RECARGO_TRANSF_USD === 3 && renglon === `Transferencia bancaria en dólares (+${RECARGO_TRANSF_USD}%)`,
     'el recargo del adelanto por transferencia es el de «¿Cómo puedo pagar?» (Benja 02/11: «3% para transferencia usd»)', renglon);
}

/* ---- La cuenta, con un producto de u$ 1.000 ---- */
function probarLaCuenta(){
  const a0 = { ...ADELANTO_FICHA };
  const v = { precio: 1000 };
  const con = (moneda, medio, monto) => { ADELANTO_FICHA = { abierto: true, moneda, medio, monto }; return restoAdelanto(v); };
  try{
    let r = con('usd', 'efectivo', 400);
    ok(r && r.usd === 600 && !r.paga && !r.medio && !('transfiere' in r) && textoAdelanto(r) === 'u$ 400 en efectivo',
       'en efectivo, como antes: adelanta u$ 400 y quedan u$ 600, sin recargo', JSON.stringify(r));
    r = con('usd', 'transferencia', 300);
    ok(r && r.medio === 'transferencia' && r.cubre === 300 && r.transfiere === 309 && r.usd === 700 && !r.paga,
       'por transferencia: cubre u$ 300, transfiere u$ 309 y quedan u$ 700', JSON.stringify(r));
    ok(textoAdelanto(r) === 'u$ 300 por transferencia en dólares (transfiero u$ 309 con el 3%)', 'el WhatsApp dice las dos cifras', textoAdelanto(r));
    ok(textoQuedaAdelanto(v) === 'Adelantás u$ 300: transferís u$ 309 (con el 3%) y quedan u$ 700 para pagar en cuotas.',
       'y la ficha también', textoQuedaAdelanto(v));
    if(TC){
      const c = CUOTAS.find(x => x.cuotas > 1) || CUOTAS[0];
      const x = cuentaFicha(v, c.cuotas), e = cuentaCuotasARS(Math.round(700 * TC), c.cuotas);
      ok(x && e && x.total === e.total && x.cuota === e.cuota, 'lo que queda va a la tarjeta con la cuenta de siempre (el 3% no toca las cuotas)', JSON.stringify(x));
    } else info('sin cotizacion: las cuotas en pesos no se prueban');
    r = con('usd', 'transferencia', 333);
    ok(r && r.transfiere === 343, 'al dólar más cercano: u$ 333 → u$ 343 (342,99)', r && r.transfiere);
    r = con('usd', 'transferencia', 1200);
    ok(r && r.paga && r.cubre === 1000 && r.transfiere === 1030 && r.usd === 0,
       'si cubre todo, transfiere el precio + 3% (u$ 1.030), aunque escriba más', JSON.stringify(r));
    ok(textoQuedaAdelanto(v) === 'Cubrís el precio entero: transferís u$ 1.030 (con el 3%).', 'y lo dice así', textoQuedaAdelanto(v));
    if(TC){
      r = con('ars', 'transferencia', 300000);
      ok(r && r.moneda === 'ars' && !r.medio && !('transfiere' in r) && textoAdelanto(r) === '$ 300.000 en efectivo o transferencia',
         'en pesos no cambia nada: efectivo o transferencia, sin recargo (aunque haya quedado «transferencia» de los dólares)', JSON.stringify(r));
    }
  } finally { ADELANTO_FICHA = a0; }
}

/* ---- La ficha ---- */
async function probarLaFicha(){
  const v = PRODUCTOS.find(p => conCuotas(p) && p.precio >= 300);
  if(!v){ info('no hay un producto con cuotas de u$ 300 o más: la ficha no se prueba'); return; }
  abrirFicha(clave(v), null);
  await adDormir(40);
  const d = document.getElementById('ficha');
  const caja = () => d.querySelector('.fi-adelanto');
  caja().querySelector('.fi-adelanto-abrir').click();
  await adDormir(20);
  const medio = () => [...caja().querySelectorAll('.fi-adelanto-medio button')];
  ok(ADELANTO_FICHA.medio === 'efectivo' && medio().map(adTxt).join(' | ') === 'Efectivo | Transferencia (+3%)' &&
     medio()[0].getAttribute('aria-pressed') === 'true' && medio()[1].getAttribute('aria-pressed') === 'false',
     'con u$, «Efectivo» / «Transferencia (+3%)», arranca en efectivo', medio().map(adTxt).join(' | '));
  ok(adTxt(caja().querySelector('.fi-adelanto-como')) === 'En dólares, en efectivo.', 'en efectivo dice «En dólares, en efectivo.»');
  const escribir = n => { const i = caja().querySelector('#fi-adelanto-monto'); i.value = String(n); i.dispatchEvent(new Event('input')); };
  escribir(300);
  medio()[1].click();
  await adDormir(20);
  ok(ADELANTO_FICHA.medio === 'transferencia' && ADELANTO_FICHA.monto === 300 && caja().querySelector('#fi-adelanto-monto').value === '300' &&
     medio()[1].getAttribute('aria-pressed') === 'true' && document.activeElement === medio()[1],
     'tocar «Transferencia» la marca, deja el foco ahí y el monto sigue (u$ 300 del precio)');
  const t = Math.round(300 * 1.03), queda = v.precio - 300;
  ok(adTxt(caja().querySelector('.fi-adelanto-queda')) === `Adelantás u$ 300: transferís u$ ${adPlata(t)} (con el 3%) y quedan u$ ${adPlata(queda)} para pagar en cuotas.`,
     'el recuadro dice cuánto transfiere y cuánto queda', adTxt(caja().querySelector('.fi-adelanto-queda')));
  ok(/lleva 3% encima de lo que adelantás/.test(adTxt(caja().querySelector('.fi-adelanto-como'))), 'y avisa el 3%', adTxt(caja().querySelector('.fi-adelanto-como')));
  const wa = d.querySelector('.fi-botones .cta:not(.cta-aviso)');
  if(wa && WHATSAPP){
    const msj = decodeURIComponent((wa.href.split('text=')[1] || '').replace(/\+/g, ' '));
    ok(msj.includes(`Adelanto u$ 300 por transferencia en dólares (transfiero u$ ${adPlata(t)} con el 3%) y el resto`),
       'el WhatsApp de la ficha lleva el adelanto por transferencia', msj.split('\n').pop());
  } else info('sin WhatsApp en la ficha');
  escribir(v.precio + 50);
  await adDormir(20);
  ok(adTxt(caja().querySelector('.fi-adelanto-queda')) === `Cubrís el precio entero: transferís u$ ${adPlata(Math.round(v.precio * 1.03))} (con el 3%).`,
     'si cubre todo, transfiere el precio + 3%', adTxt(caja().querySelector('.fi-adelanto-queda')));
  const pesos = caja().querySelector('.fi-adelanto-moneda button[data-moneda="ars"]');
  if(pesos){
    pesos.click();
    await adDormir(20);
    ok(!medio().length && adTxt(caja().querySelector('.fi-adelanto-como')) === 'En pesos, en efectivo o transferencia.',
       'en pesos no aparece el par efectivo / transferencia');
  } else info('sin cotizacion: no hay botón de pesos');
  quitarFicha();
  abrirFicha(clave(v), null);
  await adDormir(20);
  ok(ADELANTO_FICHA.medio === 'efectivo' && !ADELANTO_FICHA.abierto, 'otra ficha arranca sin adelanto y en efectivo');
  quitarFicha();
}
