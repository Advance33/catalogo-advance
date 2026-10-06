// El rotulo Sim / E-Sim de los botones de version (21/09/2026). El proveedor
// escribe "iPhone 17 Pro 512GB Sim (Blue)" pero tambien "iPhone 17 Pro 512GB
// (Orange)", que es el eSIM y no lo aclara: quedaban dos botones que el cliente
// no podia diferenciar, con precios distintos. El dato existe en el SKU que
// manda ADVAPP (-SIM / -ESIM) y de ahi se completa.
//
// Lo que se cuida: completar siempre que el SKU lo diga, aunque todas las
// versiones sean eSIM (Benja, 06/10/2026: "no sería distinto a lo que dice en
// la ficha técnica"), y no adivinar nunca (sin SKU, no se toca).
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };

const esperar = setInterval(() => {
  if(!MODELOS.length || !document.querySelectorAll('#cats .chip').length) return;
  clearInterval(esperar);
  for(let i=1;i<5000;i++) clearInterval(i);
  try{ correrPruebas(); }catch(e){ R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; }
  try{ cerrarFicha(); }catch(e){}
  try{ pararPaseos(); }catch(e){}
  try{ pararOfertas(); }catch(e){}
  for(let i=1;i<5000;i++) clearInterval(i);
  const pre=document.createElement('pre'); pre.id='RESULTADO';
  pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
  document.body.appendChild(pre);
}, 150);

const pelada = e => norm(String(e||'').replace(/\b(e-?\s?)?sim\b/ig,' ').replace(/\s+/g,' '));
// "E-Sim" y "e sim" son lo mismo escrito distinto
const igual = s => norm(s).replace(/[\s-]/g, '');

function correrPruebas(){

  /* ---- 1. La regla, sin depender de los datos del dia ---- */
  const caso = [
    { etiqueta:'512GB',     etiquetaBase:'512GB',     desc:'X 512GB (Orange)',   sim:'E-Sim' },
    { etiqueta:'512GB Sim', etiquetaBase:'512GB Sim', desc:'X 512GB Sim (Blue)', sim:'Sim'   },
    { etiqueta:'1TB',       etiquetaBase:'1TB',       desc:'X 1TB (Blue)',       sim:'E-Sim' },
  ];
  completarSim(caso);
  ok(caso[0].etiqueta === '512GB E-Sim', 'completa el que no aclara cuando una hermana si lo dice', caso[0].etiqueta);
  ok(caso[0].etiquetaBase === '512GB E-Sim', 'la etiqueta base acompana (los puntitos de color agrupan por ahi)', caso[0].etiquetaBase);
  ok(caso[1].etiqueta === '512GB Sim', 'no toca al que ya lo dice', caso[1].etiqueta);
  ok(caso[2].etiqueta === '1TB E-Sim', 'y aunque no haya con que confundirlo, lo dice (06/10)', caso[2].etiqueta);

  const todasEsim = [
    { etiqueta:'256GB', etiquetaBase:'256GB', desc:'Z 256GB (Orange)', sim:'E-Sim' },
    { etiqueta:'512GB', etiquetaBase:'512GB', desc:'Z 512GB (Blue)',   sim:'E-Sim' },
  ];
  completarSim(todasEsim);
  ok(todasEsim.every(v => v.etiqueta.endsWith(' E-Sim')), 'un modelo todo eSIM (17 Pro, 17e, Air) dice E-Sim en cada version',
     todasEsim.map(v => v.etiqueta).join(' | '));

  const sinDato = [
    { etiqueta:'256GB',     etiquetaBase:'256GB',     desc:'Y 256GB',     sim:'' },
    { etiqueta:'256GB Sim', etiquetaBase:'256GB Sim', desc:'Y 256GB Sim', sim:'Sim' },
  ];
  completarSim(sinDato);
  ok(sinDato[0].etiqueta === '256GB', 'sin SKU que lo diga, no adivina', sinDato[0].etiqueta);

  ok(simDelSku('CEL-APL-17P-512-ORG-ESIM') === 'E-Sim' &&
     simDelSku('celular~apple~17-iphone-pro-sim~512gb-sim') === 'Sim' &&
     simDelSku('CEL-APL-16P-256-000') === '', 'el SKU se lee por el final, no por adentro');
  ok(simDeLosSkus('[{"sku":"A-BLU-ESIM"},{"sku":"A-WHT-ESIM"}]') === 'E-Sim' &&
     simDeLosSkus('[{"sku":"A-BLU-ESIM"},{"sku":"A-WHT-SIM"}]') === '' &&
     simDeLosSkus('') === '', 'los SKU por color valen solo si todos dicen lo mismo');

  /* ---- 2. El catalogo de hoy: ninguna ficha queda ambigua ---- */
  const ambiguos = [], inventados = [], contradicen = [], callados = [];
  let completados = 0, conRotulo = null;
  MODELOS.forEach(m => {
    const vs = m.variantes;
    vs.forEach(v => {
      const loDice = diceSim(v.etiqueta);
      if(loDice && !diceSim(v.desc || '')){
        completados++;
        conRotulo = conRotulo || m;
        /* Lo agregado tiene que ser lo que dice el SKU, no otra cosa. La
           etiqueta puede seguir con el color ("1TB E-Sim · Blue") cuando dos
           filas quedan con el mismo nombre, asi que se compara la palabra. */
        const rotulo = (String(v.etiqueta).match(/\b(e-?\s?)?sim\b/i) || [''])[0];
        if(!v.sim || igual(rotulo) !== igual(v.sim)) contradicen.push(m.desc + ': ' + v.etiqueta);
        // Y solo donde el SKU lo dice: sin SKU no se inventa
        if(!v.sim) inventados.push(m.desc + ': ' + v.etiqueta);
      }
      // La fila sin versión (una sola memoria, como el iPhone 17) no tiene
      // botón de versión: su etiqueta es el color y ahí no va
      if(v.sim && !loDice && !v.sinVersion) callados.push(m.desc + ': "' + v.etiqueta + '"');
      if(!loDice && vs.some(x => diceSim(x.etiqueta) && pelada(x.etiqueta) === norm(v.etiqueta)))
        ambiguos.push(m.desc + ': "' + v.etiqueta + '"');
    });
  });
  ok(!ambiguos.length, 'no quedan dos versiones iguales donde una dice Sim y la otra calla', ambiguos.slice(0,4).join(' | '));
  ok(!inventados.length, 'el rotulo no aparece donde el SKU no lo dice', inventados.slice(0,4).join(' | '));
  ok(!callados.length, 'toda version cuyo SKU dice Sim o E-Sim lo muestra (06/10)', callados.slice(0,4).join(' | '));
  ok(!contradicen.length, 'lo que se muestra es lo que dice el SKU', contradicen.slice(0,4).join(' | '));
  R.push('      (hoy se completaron ' + completados + ' rotulos)');

  /* ---- 3b. Un modelo todo eSIM lo dice en la ficha (Benja, 06/10) ----
     En el chip de arriba del precio o en una pestaña a la vista: el 17 Pro
     256GB decía sólo "256GB" en la pestaña y el chip "eSIM" se sacaba. */
  const mudos = [];
  let mirados = 0;
  MODELOS.forEach(m => {
    (m.variantes || []).filter(v => norm(v.sim) === norm('E-Sim')).forEach(v => {
      if(mirados >= 40) return;
      mirados++;
      abrirFicha(clave(v), null);
      const d = document.getElementById('ficha');
      const se = [...d.querySelectorAll('.fi-datos .specs span, .fi-ops .fi-op[aria-pressed="true"] b, .fi-nombre, .fi-linea')]
        .map(x => x.textContent).join(' ');
      if(!/\be-?\s?sim\b/i.test(se)) mudos.push(m.desc + ' · ' + (v.opcion || v.etiqueta) + ': ' + se.replace(/\s+/g, ' ').trim().slice(0, 60));
      cerrarFicha();
    });
  });
  ok(!mudos.length, 'cada version eSIM lo dice en la ficha (chip, pestana o nombre)', mudos.slice(0, 3).join(' | ') || mirados + ' miradas');

  /* ---- 3. Y se ve en la ficha ---- */
  if(conRotulo){
    abrirFicha(clave(conRotulo.rep), null);
    const textos = [...document.querySelectorAll('#ficha .fi-op b')].map(b => b.textContent.trim());
    ok(textos.some(t => diceSim(t)), 'el boton de la ficha muestra el rotulo completo', textos.join(' · '));
    cerrarFicha();
  } else {
    R.push('      (ningun rotulo para completar hoy: ADVAPP ya los manda enteros)');
  }
}
