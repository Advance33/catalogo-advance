// Decisiones 7.1 a 7.4 (Pedro eligio 1C, 2B, 3C y 4B el 29/09; muestra
// muestras/auditoria/pruebas.html, "Fallas nuevas y conocidas").
//
// Desde el 26/09 las pruebas terminaban en rojo todos los dias por cosas que
// ya se le habian pedido a ADVAPP. El 28/09 aparecieron 2 fallas nuevas y el
// aviso solo cambio el numero (de 2 a 4); PUBLICAR preguntaba "Publicar
// igual?" siempre, y de tanto contestar S se contestaba S tambien el dia que
// habia algo nuevo. Lo que se eligio:
//   7.1 C  correr.py resume en NUEVAS (fila por fila, con el nombre del
//          producto), CONOCIDAS (una linea por pedido, con los dias) y
//          ARREGLADAS, en lineas de 50 caracteres o menos.
//   7.2 B  PUBLICAR pregunta solo por lo nuevo (correr.py sale con 3 si lo
//          unico que falla ya esta pedido).
//   7.3 C  la revision de las 14:00 cuenta solo lo nuevo y avisa "Reclamar a
//          ADVAPP" cuando lo pedido lleva mas de 7 dias.
//   7.4 B  una falla pasa a conocida solo cuando alguien la anota con
//          herramientas/fallas-conocidas.py, contra un punto de
//          herramientas/pedidos-advapp.json de ESA fila o un pedido a mano.
//
// Una tanda de la pagina no corre Python: esto lee los archivos tal como los
// sirve el servidor local y mira que los arreglos sigan ahi. Lo que hacen las
// reglas lo prueban  python3 herramientas/fallas-conocidas.py --probar  y
// python3 revision-diaria.py --probar, que la revision corre todos los dias.
// Y con los datos de hoy: que cada ID tenga la forma que leen el script que
// inyecta correr.py y el Python, y que cada conocida anotada sea coherente
// (su CLAVE, a quien y cuando se pidio, su punto de esa fila, su prueba).
const R = []; let fallas = 0;
const ok = (c,t,x) => { R.push((c?'  OK  ':'FALLA ')+t+(x!==undefined?('  ['+x+']'):'')); if(!c) fallas++; };
const info = t => R.push('  --  ' + t);

const esperar = setInterval(() => {
  if(!MODELOS.length) return;
  clearInterval(esperar);
  for(let i=1;i<5000;i++) clearInterval(i);
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: '+(e&&e.stack||e)); fallas++; })
    .finally(() => {
      try{ pararPaseos(); pararOfertas(); }catch(e){}
      for(let i=1;i<5000;i++) clearInterval(i);
      const pre=document.createElement('pre'); pre.id='RESULTADO';
      pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
      document.body.appendChild(pre);
    });
}, 150);

/* Un archivo tal como lo sirve el servidor local, sin \r. null si no esta. */
async function paLeer(ruta){
  try{
    const r = await fetch(ruta.split('/').map(encodeURIComponent).join('/') + '?_=' + Date.now(), { cache: 'no-store' });
    return r.ok ? (await r.text()).replace(/\r/g, '') : null;
  }catch(e){ return null; }
}

/* El cuerpo de una funcion de Python de primer nivel. */
function paCuerpo(src, nombre){
  const i = (src || '').indexOf('\ndef ' + nombre + '(');
  if(i < 0) return '';
  const resto = src.slice(i + 1);
  const j = resto.slice(1).search(/\n(def |class |if __name__|[A-Z_]+ = )/);
  return j < 0 ? resto : resto.slice(0, j + 1);
}

/* Un tramo de un .command: desde `desde` hasta la primera de `hasta` que le sigue. */
function paTramo(src, desde, hasta){
  const i = (src || '').indexOf(desde);
  if(i < 0) return '';
  const resto = src.slice(i + desde.length);
  const j = Math.min(...hasta.map(h => { const k = resto.indexOf(h); return k < 0 ? Infinity : k; }));
  return j === Infinity ? resto : resto.slice(0, j);
}

/* Lo minimo de .gitignore (la misma idea que guardas-t3): '*', '/' al
   principio ancla, sin '/' vale para el nombre en cualquier carpeta. */
function paIgnorado(reglas, ruta){
  const aRegex = g => new RegExp('^' + g.replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]') + '$');
  const partes = ruta.split('/');
  let fuera = false;
  for(let l of reglas){
    if(!l.trim() || l.startsWith('#')) continue;
    const niega = l.startsWith('!');
    let p = niega ? l.slice(1) : l;
    const carpeta = p.endsWith('/');
    if(carpeta) p = p.slice(0, -1);
    const anclado = p.includes('/');
    if(p.startsWith('/')) p = p.slice(1);
    const re = aRegex(p);
    let pega = false;
    if(anclado){
      for(let i = 1; i <= partes.length; i++)
        if((carpeta ? i < partes.length : true) && re.test(partes.slice(0, i).join('/'))) pega = true;
    }else{
      partes.forEach((x, i) => { if((carpeta ? i < partes.length - 1 : true) && re.test(x)) pega = true; });
    }
    if(pega) fuera = !niega;
  }
  return fuera;
}

/* ¿La comprobacion sigue escrita en su tanda? (29/09, revision) Con el texto
   tal cual, o con un titulo que se arma al correr, como 'muestra hasta ' +
   MV_CINTA + ' productos…' o `[5.2 · ${ancho}] …`: los tramos literales de
   cada titulo armado, en orden y con algo entre medio, tienen que dar el
   texto entero. Antes se buscaba solo el texto tal cual y una conocida de
   titulo armado daba FALLA con todo sano. */
function paSigueEnLaTanda(src, texto){
  if(!src || !texto) return false;
  if(src.includes(texto)) return true;
  const lit = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  const trozos = [];
  for(let m; (m = lit.exec(src)); ) trozos.push({ a: m.index, b: lit.lastIndex, t: m[1] ?? m[2] ?? m[3], tpl: m[3] !== undefined });
  const des = t => t.replace(/\\(.)/g, '$1');
  const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for(let i = 0; i < trozos.length; i++){
    const piezas = [];
    const sumar = x => { if(!x.tpl){ piezas.push(des(x.t)); return; }
      x.t.split(/\$\{[^}]*\}/).forEach((q, k) => { if(k) piezas.push(null); piezas.push(des(q)); }); };
    sumar(trozos[i]);
    let j = i;
    while(j + 1 < trozos.length){
      const entre = src.slice(trozos[j].b, trozos[j + 1].a);
      if(/^\s*\+\s*$/.test(entre)){ j++; sumar(trozos[j]); continue; }
      if(/^\s*\+[^;'"`\n]{1,80}\+\s*$/.test(entre)){ piezas.push(null); j++; sumar(trozos[j]); continue; }
      break;
    }
    if(/^\s*\+\s*[\w$(]/.test(src.slice(trozos[j].b, trozos[j].b + 40))) piezas.push(null);
    if(/[\w$)\]]\s*\+\s*$/.test(src.slice(Math.max(0, trozos[i].a - 40), trozos[i].a))) piezas.unshift(null);
    if(!piezas.includes(null)) continue;
    const re = new RegExp('^' + piezas.map(q => q === null ? '.+?' : esc(q)).join('') + '$');
    if(re.test(texto)) return true;
  }
  return false;
}

const paHoy = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const paIso = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

async function correrPruebas(){
  const correrPy = await paLeer('pruebas/correr.py');
  const fc = await paLeer('herramientas/fallas-conocidas.py');
  const pub = await paLeer('PUBLICAR.command');
  const bat = await paLeer('PUBLICAR.bat');
  const probar = await paLeer('PROBAR.command');
  const rev = await paLeer('revision-diaria.py');
  const gi = await paLeer('.gitignore');
  ok(!!correrPy && !!fc && !!pub && !!bat && !!probar && !!rev && gi !== null,
     'se leen correr.py, fallas-conocidas.py, PUBLICAR, PROBAR, la revision y el .gitignore');
  if(!correrPy || !fc || !pub || !bat || !probar || !rev || gi === null) return;

  /* ---- 7.1 C: el resumen en tres grupos ---- */
  ok(/spec_from_file_location\('fallas_conocidas'/.test(correrPy) && /fc\.clasificar\(/.test(correrPy)
     && /fc\.lineas_grupos\(/.test(correrPy) && /fc\.resultado\(/.test(correrPy),
     'correr.py clasifica con herramientas/fallas-conocidas.py');
  ok(/^ANCHO = 50\b/m.test(correrPy) && /^ANCHO = 50\b/m.test(fc),
     'las lineas del resumen son de 50 caracteres o menos (ANCHO = 50 en los dos)');
  ok(fc.includes("'   %d NUEVA%s - frena%s la publicacion'") && fc.includes("'   %d CONOCIDA%s - ya pedida%s, no frena%s'")
     && fc.includes("'   %d ARREGLADA%s desde la corrida anterior%s'") && fc.includes("'   Fila por fila: pruebas/conocidas.json'"),
     'los tres grupos de la muestra: NUEVAS, CONOCIDAS (el detalle en conocidas.json) y ARREGLADAS');
  ok(fc.includes("'   La CLAVE de la primera es:'") && fc.includes("'       --conocida CLAVE --pedido r_codigo'"),
     'cada corrida con nuevas dice como anotarlas y la CLAVE de la primera (7.4 B)');
  /* Nunca conocidas: lo que se arregla, no se pide */
  const noSeAnotan = (fc.match(/^NO_SE_ANOTAN = \(([^)]*)\)/m) || ['', ''])[1];
  ok(['no_corrio', 'excepcion', 'sin_filas', 'no_se_ven'].every(t => noSeAnotan.includes("'" + t + "'")),
     'una tanda que no corre o revienta, una falla sin filas y lo que no se ve de una lista cortada nunca se anotan',
     noSeAnotan.trim());
  ok(/--detalle/.test(correrPy) && /--json/.test(correrPy) && /_ultima-corrida\.json/.test(correrPy),
     'correr.py tiene --detalle (cada FALLA tal cual) y --json, y deja siempre pruebas/_ultima-corrida.json');

  /* El nombre de cada fila lo anota un script que inyecta correr.py: que este
     en ESTA copia, y que la forma del ID sea la misma en el script y en el
     Python, y la de todos los IDs de hoy. */
  ok([...document.scripts].some(s => s.textContent.includes("x.id = 'NOMBRES_FILAS'") && s.textContent.includes('MutationObserver')),
     'esta copia trae el script de correr.py que anota el nombre de las filas del RESULTADO');
  const reJs = (correrPy.match(/\.match\(\/([^\/]+)\/g\)/) || [])[1];
  const rePy = (fc.match(/^RE_ID = re\.compile\(r'([^']+)'\)/m) || [])[1];
  ok(!!reJs && reJs === rePy, 'el script y fallas-conocidas.py leen el ID con la misma forma', reJs + ' / ' + rePy);
  if(rePy){
    const re = new RegExp('^(?:' + rePy + ')$');
    const raros = PRODUCTOS.filter(p => !re.test(p.id)).map(p => p.id);
    ok(!raros.length, 'todos los IDs de hoy tienen esa forma (si no, sus fallas no se podrian anotar)',
       raros.slice(0, 5).join(', ') || PRODUCTOS.length + ' IDs');
  }

  /* ---- 7.2 B: PUBLICAR pregunta solo por lo nuevo ---- */
  ok(/return envolver\('RESULTADO: nada nuevo[\s\S]{0,400}?\), 3\n/.test(fc) && fc.includes("'RESULTADO: %d NUEVA%s. Revisar antes de publicar.'"),
     'correr.py sale con 3 cuando falla solo lo conocido, y dice "RESULTADO: N NUEVA(S)" cuando hay nuevas');
  ok(pub.includes('PRUEBAS=${PIPESTATUS[0]}') && pub.includes("sed -n 's/^RESULTADO: \\([0-9][0-9]*\\) NUEVA"),
     'PUBLICAR.command lee el numero de nuevas del RESULTADO (tee + PIPESTATUS)');
  const rama1 = paTramo(pub, 'if [ "$PRUEBAS" = "1" ]; then', ['elif [ "$PRUEBAS" = "3" ]']);
  const rama3 = paTramo(pub, 'elif [ "$PRUEBAS" = "3" ]; then', ['elif ', '\nfi']);
  ok(rama1.includes('HAY $NUEVAS FALLAS NUEVAS') && rama1.includes('preguntar "Publicar igual?"'),
     'con nuevas dice cuantas y pregunta "Publicar igual?"');
  ok(!!rama3 && rama3.includes('Las pruebas no frenan: lo que falla ya esta pedido.') && !rama3.includes('preguntar'),
     'con solo conocidas lo recuerda y NO pregunta: sigue a "Publicar estos cambios?"');
  const bat3 = paTramo(bat, '\n:pruebas_conocidas', ['\n:fallan_pruebas']);
  ok(bat.includes('if "%PRUEBAS%"=="3" goto :pruebas_conocidas') && !!bat3 && !/choice/.test(bat3),
     'PUBLICAR.bat hace lo mismo (sin el numero: Windows no tiene tee)');
  ok(/"\$RESULTADO" = "3"/.test(probar) && probar.includes('NADA NUEVO') && probar.includes('HAY FALLAS NUEVAS'),
     'PROBAR.command distingue NADA NUEVO de HAY FALLAS NUEVAS');

  /* ---- 7.3 C: el aviso de las 14:00 ---- */
  const rmain = paCuerpo(rev, 'main');
  ok(/^DIAS_RECLAMO = 7$/m.test(rev) && /d > DIAS_RECLAMO/.test(paCuerpo(rev, 'reclamos')),
     'se reclama lo pedido hace MAS de 7 dias (DIAS_RECLAMO = 7, "d > DIAS_RECLAMO")');
  ok(rmain.includes("'%d falla(s) NUEVAS en la pagina. '") && rev.includes("'Reclamar a %s: %d fila(s) pedidas hace %s dias.'")
     && !rev.includes('prueba(s) de la pagina fallan'),
     'la notificacion dice "N falla(s) NUEVAS en la pagina" y "Reclamar a ADVAPP", ya no "N prueba(s) de la pagina fallan"');
  ok(rev.includes('RECLAMAR: %d fila(s) pedidas el %s siguen igual') && rmain.includes('Ademas hay %d conocida(s) pedidas hace %d dias o menos.'),
     'en el archivo: el RECLAMAR agrupado por pedido, y las recientes solo con el numero');
  ok(/if \(r\.returncode == 1 and graves\)[\s\S]{0,300}?\bor reclamar\b[^\n]*:\n/.test(rmain), 'un dia sin nuevas, el reclamo alcanza para dejar el aviso');
  ok(rmain.includes("'--detalle', '--json', json_p]") && /leer_corrida\(json_p\)/.test(rmain)
     && /analizar_pruebas\(salida_p, rc_p, sin_internet, corrida\)/.test(rmain),
     'la revision corre correr.py con --detalle --json y cuenta solo las nuevas');
  ok(rmain.includes("'fallas-conocidas.py'), '--probar']"), 'y corre todos los dias fallas-conocidas.py --probar');
  ok(/rc not in \(0, 3\)/.test(paCuerpo(rev, 'analizar_pruebas')), 'la salida 3 de correr.py no es "las pruebas terminaron mal"');

  /* ---- 7.4 B: el registro de conocidas ---- */
  ok(!/\.anotar\(/.test(correrPy) && !/guardar_conocidas/.test(correrPy) && /fc\.aplicar_arregladas\(/.test(correrPy),
     'correr.py nunca anota una conocida: solo pasa a arregladas las que dejaron de fallar');
  const aplicar = paCuerpo(fc, 'aplicar_arregladas');
  ok(/reg\['conocidas'\]\.pop\(/.test(aplicar) && !/reg\['conocidas'\]\[[^\]]+\]\s*=/.test(aplicar),
     'aplicar_arregladas saca de conocidas y no agrega');
  ok(/tempfile\.mkstemp\(/.test(paCuerpo(fc, 'guardar_conocidas')) && /os\.replace\(/.test(paCuerpo(fc, 'guardar_conocidas')),
     'el registro se escribe con un temporal y os.replace');
  const leerReg = paCuerpo(fc, 'leer_conocidas');
  ok(/except FileNotFoundError:/.test(leerReg) && /except \(OSError, ValueError\)[^\n]*\n\s*raise RegistroDanado/.test(leerReg),
     'un registro danado no se lee como vacio (RegistroDanado)');
  ok(/c\.get\('fuente'\) in \(None, 'advapp'\)/.test(paCuerpo(fc, 'clasificar')),
     'con ADVAPP caido (la pagina en la planilla o la copia), lo conocido no se da por arreglado');
  ok(/BORRADOR\|REEMPLAZADO/.test(paCuerpo(fc, 'archivo_del_pedido')),
     'un pedido a mano que dice que no se mando no sirve para anotar (PEDIDO-ADVAPP-26-09.txt: [REEMPLAZADO])');
  const reglas = gi.split('\n');
  ok(!paIgnorado(reglas, 'pruebas/conocidas.json') && paIgnorado(reglas, 'pruebas/_ultima-corrida.json'),
     'pruebas/conocidas.json va al repo y pruebas/_ultima-corrida.json no');

  // La busqueda de la comprobacion en su tanda entiende los titulos armados
  const ej = "ok(a, 'muestra hasta ' + MV_CINTA + ' productos de esa marca', n);\nok(b, `[5.2 · ${ancho}] los dos botones`);";
  ok(paSigueEnLaTanda(ej, 'muestra hasta 14 productos de esa marca') && paSigueEnLaTanda(ej, '[5.2 · 390] los dos botones') &&
     !paSigueEnLaTanda(ej, 'muestra hasta 14 cosas de esa marca') && !paSigueEnLaTanda(ej, 'otra cosa'),
     'una conocida de titulo armado al correr ("muestra hasta " + MV_CINTA + …) se encuentra en su tanda; una que cambio, no');

  /* Cada conocida anotada, contra los datos de hoy */
  const txt = await paLeer('pruebas/conocidas.json');
  if(txt === null){
    info('no hay pruebas/conocidas.json todavia: no hay conocidas que mirar');
    return;
  }
  let reg = null;
  try{ reg = JSON.parse(txt); }catch(e){ ok(false, 'pruebas/conocidas.json se lee', e.message); return; }
  const con = reg && typeof reg.conocidas === 'object' && !Array.isArray(reg.conocidas) ? reg.conocidas : null;
  ok(!!con && reg.arregladas && typeof reg.arregladas === 'object', 'pruebas/conocidas.json tiene "conocidas" y "arregladas"',
     con ? Object.keys(con).length + ' conocidas, ' + Object.keys(reg.arregladas || {}).length + ' arregladas' : 'no');
  if(!con) return;
  let env = {};
  try{ env = (JSON.parse(await paLeer('herramientas/pedidos-advapp.json') || '{}').enviados) || {}; }catch(e){ env = {}; }
  const vacias = new Set(((fc.match(/^VACIAS = \{([^}]*)\}/m) || ['', ''])[1].match(/'([a-z]+)'/g) || []).map(x => x.slice(1, -1)));
  const slug = s => { const w = String(s).normalize('NFKD').replace(/[^\x00-\x7f]/g, '').toLowerCase().match(/[a-z0-9]+/g) || [];
                      const u = w.filter(x => !vacias.has(x)); return (u.length ? u : w).slice(0, 4).join('-') || 'sin-texto'; };
  const hoy = paHoy();
  const malas = { clave: [], quien: [], punto: [], archivo: [], prueba: [] };
  const fuentes = {};
  for(const [k, e] of Object.entries(con)){
    if(k !== e.tanda + '|' + slug(e.comprobacion) + '|' + e.id) malas.clave.push(k);
    if(!String(e.a || '').trim() || !paIso(e.anotada) || e.anotada > hoy) malas.quien.push(k);
    if(e.punto){
      const v = env[e.punto];
      if(!v || v.id !== e.id || !paIso(v.enviado) || v.enviado > hoy) malas.punto.push(k + (v ? ' (es de ' + v.id + ')' : ' (no esta)'));
    }else if(!/\.txt$/.test(e.archivo || '') || !paIso(e.fecha) || e.fecha > hoy){
      malas.archivo.push(k);
    }
    if(!(e.tanda in fuentes)) fuentes[e.tanda] = await paLeer('pruebas/' + e.tanda + '.js');
    if(!paSigueEnLaTanda(fuentes[e.tanda], e.comprobacion)) malas.prueba.push(k);
  }
  const n = Object.keys(con).length;
  ok(!malas.clave.length, 'cada CLAVE es tanda|comprobacion|ID de su entrada', malas.clave.slice(0, 3).join(' | ') || n + ' conocidas');
  ok(!malas.quien.length, 'cada conocida dice a quien se le pidio y cuando se anoto (nunca en el futuro)', malas.quien.slice(0, 3).join(' | ') || n + ' conocidas');
  ok(!malas.punto.length, 'cada punto esta en pedidos-advapp.json y es de ESA fila (el error de la opcion A)', malas.punto.slice(0, 3).join(' | ') || 'bien');
  ok(!malas.archivo.length, 'lo pedido a mano dice en que archivo y que dia (no en el futuro)', malas.archivo.slice(0, 3).join(' | ') || 'bien');
  ok(!malas.prueba.length, 'cada comprobacion anotada sigue en su tanda con el mismo texto (si cambia, la conocida no vale)',
     malas.prueba.slice(0, 3).join(' | ') || 'bien');
}
