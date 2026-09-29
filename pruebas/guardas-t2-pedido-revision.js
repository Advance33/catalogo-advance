// Guardas del pedido a ADVAPP, del validador y de la revision diaria (29/09).
//
// Una auditoria encontro que los controles se quedaban ciegos sin avisar:
// con ADVAPP caido el pedido se armaba contra la planilla del 22/09 y le
// agradecia a ADVAPP 76 arreglos que no existian; un registro danado arrancaba
// de cero y con --enviado pisaba lo mandado el 21 y el 26/09; un punto
// arreglado que volvia figuraba como "sigue igual"; la revision diaria solo
// leia lineas con formato, asi que una herramienta que reventaba quedaba
// callada y hasta borraba el aviso del dia anterior; y nadie comparaba precios
// entre memorias ni miraba un CODIGO_VAR de otro producto.
//
// Lo que hacen las reglas lo prueban las propias herramientas con casos
// armados a mano (python3 herramientas/pedido-advapp.py --probar y
// python3 revision-diaria.py --probar, que la revision diaria corre todos los
// dias). Esta tanda mira que los arreglos sigan en el codigo -- que nadie
// vuelva a poner la planilla de respaldo en el pedido, ni el except que se
// traga el registro -- y que los archivos que se editan a mano se puedan leer.
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
  correrPruebas()
    .catch(e => { R.push('EXCEPCION: ' + (e && e.stack || e)); fallas++; })
    .then(() => {
      try{ pararPaseos(); }catch(e){}
      try{ pararOfertas(); }catch(e){}
      for(let i = 1; i < 5000; i++) clearInterval(i);
      reportar();
    });
}, 120);

const traer = async ruta => {
  const r = await fetch(ruta + '?_=' + Date.now(), { cache:'no-store' });
  if(!r.ok) throw new Error(ruta + ': ' + r.status);
  return (await r.text()).replace(/\r/g, '');
};

/* El cuerpo de una funcion de Python de primer nivel: desde su "def" hasta
   la proxima cosa de primer nivel. */
function cuerpo(src, nombre){
  const i = src.indexOf('\ndef ' + nombre + '(');
  if(i < 0) return '';
  const resto = src.slice(i + 1);
  const j = resto.slice(1).search(/\n(def |class |@regla\(|if __name__|[A-Z_]+ = )/);
  return j < 0 ? resto : resto.slice(0, j + 1);
}
/* La regla con su decorador: el tramo entre un "@regla(" y el siguiente. */
function regla(src, nombre){
  return src.split('\n@regla(').find(t => t.includes('\ndef ' + nombre + '(')) || '';
}
/* Lineas de codigo (sin comentarios) que llaman a algo */
const llama = (src, que) => src.split('\n').some(l => l.split('#')[0].includes(que));
const iso = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

async function correrPruebas(){
  const pedido = await traer('herramientas/pedido-advapp.py');
  const revision = await traer('revision-diaria.py');
  const validar = await traer('validar.py');

  /* ---- 1. El pedido se arma SOLO contra ADVAPP ----
     Con la planilla de respaldo le agradecia a ADVAPP arreglos que no
     existian y --enviado los grababa para siempre. */
  const main = cuerpo(pedido, 'main');
  ok(main.includes('validar.bajar_advapp()'), 'el pedido baja ADVAPP directo');
  ok(!llama(pedido, 'bajar_csv('), 'y nunca la planilla de respaldo (bajar_csv)');
  ok(/ADVAPP no contesto[\s\S]{0,400}return 2/.test(main), 'si ADVAPP no contesta sale con 2 sin escribir nada');
  const bajar = cuerpo(validar, 'bajar_advapp');
  ok(/declaradas/.test(bajar) && /ADVAPP_MINIMO/.test(bajar),
     'validar rechaza una carga cortada: menos filas que las declaradas, o mucho menos que la ultima buena');

  /* ---- 2. El registro de lo enviado ---- */
  const leer = cuerpo(pedido, 'leer_registro');
  ok(leer.includes('FileNotFoundError') && leer.includes('raise ArchivoDanado') && !/except Exception:\s*\n\s*return/.test(leer),
     'un registro que no se puede leer frena el pedido (no arranca de cero)');
  ok(cuerpo(pedido, 'guardar_registro').includes('os.replace'), 'el registro se escribe entero (temporal + reemplazo)');
  ok(!/json\.dump\([^\n]*open\(REGISTRO/.test(pedido), 'nadie escribe el registro directo con open(REGISTRO, "w")');
  const anotar = cuerpo(pedido, 'anotar_enviados');
  ok(anotar.includes('historial') && !/setdefault\(k, \{'enviado'/.test(anotar),
     'un punto arreglado que vuelve pasa al historial y se vuelve a pedir');
  ok(main.includes("'Volvieron: %d'") && /return 1 if \(nuevos or volvieron\)/.test(main),
     'los que volvieron se cuentan aparte y hacen salir con 1');

  /* ---- 3. Las reglas que no estaban ---- */
  const nuevas = {
    r_var_de_otro: 'el CODIGO_VAR de otro producto (Watch Ultra 3 Ocean)',
    r_fila_sin_color: 'el mismo SKU con una fila sin color (iPad Pro M4 512GB)',
    r_precio_de_otra_capacidad: 'el precio de otra memoria (S26 FE 8/512 a 730)',
    r_grupo_partido: 'el mismo producto en dos tarjetas (Esp, Cell 5G)',
    r_nombre_desparejo: 'el nombre escrito distinto que sus hermanas (Watch Series 11 46mm)',
    r_categoria: 'la categoria contra el prefijo del SKU (drones como accesorio)',
    r_montura: 'el lente sin montura',
    r_erratas: 'las erratas del nombre (Googles, Eor, Camcoder)',
    r_siglas: 'las siglas en Tipo Titulo (Ips, Hdr, Rc)',
    r_color_escrito: 'el color en minuscula, en castellano o escrito distinto',
    r_terminos: 'los terminos de busqueda de otro modelo',
    r_contrato: 'lo que falta en el contrato (Garantia, direccion de eventos)',
    r_color_sin_registrar: 'el color que el maestro no conoce (sin eso no hay foto)',
    r_preguntas: 'las preguntas a mano de preguntas-advapp.json',
  };
  const faltan = Object.keys(nuevas).filter(n => !regla(pedido, n));
  ok(!faltan.length, 'el pedido tiene sus ' + Object.keys(nuevas).length + ' reglas nuevas', faltan.join(', ') || 'todas');
  /* Precios y datos que se contradicen: se PREGUNTA, no se propone un valor */
  for(const n of ['r_precio_de_otra_capacidad', 'r_fila_sin_color', 'r_terminos', 'r_montura', 'r_dos_precios'])
    ok(/donde='pregunta'/.test(regla(pedido, n)), n + ' es una pregunta, no una correccion');
  ok(!/'poner': '(?!\?)[^']*USD/.test(regla(pedido, 'r_precio_de_otra_capacidad')),
     'la regla de precios nunca propone un precio sin "?"');
  ok(cuerpo(pedido, 'mismo_modelo').includes('memoria_distinta('),
     '"misma foto: otra capacidad" exige que la memoria sea distinta de verdad (no la malla del reloj)');
  ok(regla(pedido, 'r_sin_codigo_propio').includes("ctx.get('esperan')"),
     'las filas que esperan respuesta de ADVAPP no figuran como pendientes nuestros');
  ok(/Pendientes nuestros: %d/.test(pedido), 'el total de pendientes sale con la forma que lee la revision');

  /* ---- 4. La revision diaria se entera de lo que no pudo correr ---- */
  const pruebas = cuerpo(revision, 'analizar_pruebas');
  ok(pruebas.includes("'EXCEPCION'") && pruebas.includes('NO LLEGO A CORRER'),
     'las tandas que revientan o no llegan a correr llegan al aviso');
  ok(/rc == 1 and not graves/.test(cuerpo(revision, 'analizar_validar')), 'validar que revienta es una herramienta caida');
  ok(/rc not in \(0, 1\)/.test(cuerpo(revision, 'analizar_pedido')), 'el pedido que no se pudo armar se avisa');
  ok(cuerpo(revision, 'analizar_fotos').includes('LAS COLUMNAS DE LA PLANILLA NO COINCIDEN'),
     'los choques de CODIGO de verificar-fotos se avisan');
  const rmain = cuerpo(revision, 'main');
  ok(/or herramienta_mal/.test(rmain), 'una herramienta caida deja aviso (y no borra el de ayer)');
  // 29/09: sin internet verificar-fotos sale con 1 sin '<--' y eso dejaba el
  // AVISO cada dia sin conexion. Los casos van en revision-diaria.py --probar;
  // aca se mira que main le pase sin_internet, que --probar no ve.
  ok(/analizar_fotos\([^)]*sin_internet\)/.test(rmain),
     'sin internet, verificar-fotos que no pudo bajar la planilla no alarma (main le pasa sin_internet)');
  ok(/'--probar'\]/.test(rmain) && rmain.includes("'pedido-advapp.py'"), 'la revision corre las autopruebas todos los dias');
  ok(/Volvieron: \(\\d\+\)/.test(cuerpo(revision, 'analizar_pedido')), 'y avisa los puntos que volvieron');

  /* ---- 5. ADVAPP caido, y con que dato corrio ---- */
  ok(llama(validar, "print('FUENTE-RESPALDO"), 'validar dice con una linea fija que uso la planilla de respaldo');
  ok(/FUENTE-RESPALDO/.test(cuerpo(revision, 'analizar_validar')) && /NO CONTESTA/.test(rmain),
     'y la revision lo avisa primero');
  const est = cuerpo(revision, 'estado_advapp');
  ok(est.indexOf('urlopen') >= 0 && est.indexOf('weekday') > est.indexOf('urlopen'),
     'el fin de semana se saltea verificado_hoy, no la caida');
  ok(rmain.includes("env['ADVAPP_COPIA']") && validar.includes("COPIA_ENV = 'ADVAPP_COPIA'"),
     'validar, verificar-fotos y el pedido miran la misma copia de ADVAPP');
  ok(cuerpo(revision, 'limpiar_logs_viejos').includes("'advapp-*.json'"), 'y las copias viejas se borran');
  ok(llama(cuerpo(validar, 'main'), 'aviso_revision_diaria()'), 'PUBLICAR se entera si la revision diaria dejo de correr');

  /* ---- 6. Los archivos que se editan a mano ---- */
  let q = null;
  try{ q = JSON.parse(await traer('herramientas/preguntas-advapp.json')); }catch(e){ ok(false, 'preguntas-advapp.json se lee', e.message); }
  if(q){
    const lista = Array.isArray(q.preguntas) ? q.preguntas : [];
    ok(Array.isArray(q.preguntas), 'preguntas-advapp.json tiene su lista', lista.length + ' preguntas');
    const ids = lista.map(x => x.id);
    ok(new Set(ids).size === ids.length, 'sin ids repetidos');
    const malas = lista.filter(x => !x.id || !iso(x.fecha) || !String(x.pregunta || '').trim());
    ok(!malas.length, 'cada pregunta tiene id, fecha AAAA-MM-DD y texto', malas.map(x => x.id).join(', ') || 'bien');
    const sinNombre = lista.filter(x => x.espera_codigo && !(x.filas || []).every(f => f.ID && f.nombre));
    ok(!sinNombre.length, 'las que esperan codigo guardan el nombre de cada fila (ADVAPP reusa IDs)',
       sinNombre.map(x => x.id).join(', ') || 'bien');
  }
  let reg = null;
  try{ reg = JSON.parse(await traer('herramientas/pedidos-advapp.json')); }catch(e){ ok(false, 'pedidos-advapp.json se lee', e.message); }
  if(reg){
    const env = reg.enviados && typeof reg.enviados === 'object' ? reg.enviados : null;
    ok(!!env, 'el registro tiene sus enviados', env ? Object.keys(env).length + ' puntos' : 'no');
    const rotos = Object.entries(env || {}).filter(([, v]) =>
      !iso(v.enviado) || (v.arreglado && !iso(v.arreglado))
      || (v.historial && !(Array.isArray(v.historial) && v.historial.every(h => iso(h.enviado) && iso(h.arreglado)))));
    ok(!rotos.length, 'cada punto tiene sus fechas bien', rotos.slice(0, 3).map(([k]) => k).join(', ') || 'bien');
  }

  /* ---- 7. La medicion apagada sale en el pedido mientras falte ----
     29/09: se mira la linea del index.html servido y no la variable de esta
     pagina. correr.py (hallazgo 187) apaga ANALITICA_URL en todas las copias,
     asi que aca adentro siempre vale '' y el "ya tiene direccion" no salia
     nunca: con la medicion encendida y el bloque 'endpoint-eventos' sacado de
     r_contrato (que ya deja de pedirla solo), esto daba FALLA sin razon. Misma
     regex que RE_ANALITICA de correr.py (traer() ya saco los \r). Si la linea
     no esta, FALLA y no un "--" callado: sin ella correr.py tampoco corre. */
  const indexSrc = await traer('index.html');
  const lineaMedicion = indexSrc.match(/^let ANALITICA_URL = '([^'\n]*)';/m);
  if(!lineaMedicion)
    ok(false, 'index.html tiene su linea "let ANALITICA_URL = \'...\';"', 'no esta');
  else if(lineaMedicion[1] === '')
    ok(regla(pedido, 'r_contrato').includes('endpoint-eventos'),
       'sin direccion de eventos, el pedido se la pide a ADVAPP');
  else
    R.push('  --  la medicion ya tiene direccion: no hace falta pedirla');
}
