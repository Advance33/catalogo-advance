// Guardas de la tanda T3 (29/09/2026): las herramientas de fotos, PUBLICAR y
// lo que el repo publica. Son cosas que el cliente no ve en la pagina pero
// que terminan en ella, o en lo que GitHub Pages sirve a cualquiera:
//
//  - fotos/indice.json SIN el mapa del catalogo: si el maestro se rompia,
//    verificar-fotos lo escribia igual, sin 'catalogo', y la web no podia
//    traducir un color a su AT-####-NN (193 productos sin ninguna foto).
//  - verificar-fotos reescribia el indice todos los dias solo por la fecha,
//    y eso escondia que PUBLICAR no reintentaba un push que habia fallado.
//  - --aceptar borraba las aceptaciones que ese dia no aparecian.
//  - el chequeo (11) buscaba portadas por SKU y daba 0 siempre, mientras
//    SW-APP-016 mostraba otra malla.
//  - 15 notas internas publicadas porque el .gitignore no las agarraba, y
//    ninguna linea para .DS_Store.
//  - servidor.py atendia a toda la red local, con el listado de carpetas.
//  - un robots.txt que no hacia nada y un comentario que decia que si.
//  - los textos que seguian mandando a pedirle al "equipo del sheet".
//
// Casi todo se mira leyendo los archivos tal como los sirve el servidor
// local, que es lo unico que una tanda de la pagina puede hacer: no corre
// Python ni git. Son alambres: si alguien vuelve atras uno de los arreglos,
// salta aca con el motivo.
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
      try{ cerrarFicha(); }catch(e){}
      try{ pararPaseos(); pararOfertas(); }catch(e){}
      for(let i=1;i<5000;i++) clearInterval(i);
      const pre=document.createElement('pre'); pre.id='RESULTADO';
      pre.textContent='\n===== '+(fallas?fallas+' FALLA(S)':'TODO OK')+' =====\n'+R.join('\n');
      document.body.appendChild(pre);
    });
}, 150);

/* Un archivo tal como lo sirve el servidor local. null si no esta. */
async function leer(ruta){
  try{
    const r = await fetch(ruta.split('/').map(encodeURIComponent).join('/') + '?_=' + Date.now(),
                          { cache: 'no-store' });
    return r.ok ? await r.text() : null;
  }catch(e){ return null; }
}

/* Lo minimo de las reglas de .gitignore para saber si un archivo de la raiz o
   de una carpeta queda afuera: '*', '?' y '[0-9]', '/' al principio ancla a
   la raiz, sin '/' vale para el nombre en cualquier carpeta, y '/' al final
   es una carpeta. No es git, pero alcanza para los patrones de este repo. */
function ignorado(reglas, ruta){
  const aRegex = g => new RegExp('^' + g.replace(/[.+^${}()|\\]/g, '\\$&')
                                        .replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]') + '$');
  const partes = ruta.split('/');
  let fuera = false;
  for(let linea of reglas){
    linea = linea.replace(/\r$/, '');
    if(!linea.trim() || linea.startsWith('#')) continue;
    const niega = linea.startsWith('!');
    let p = niega ? linea.slice(1) : linea;
    const carpeta = p.endsWith('/');
    if(carpeta) p = p.slice(0, -1);
    const anclado = p.startsWith('/') || p.includes('/');
    if(p.startsWith('/')) p = p.slice(1);
    const re = aRegex(p);
    let pega = false;
    if(anclado){
      // la ruta entera, o una carpeta de la que cuelga
      for(let i = 1; i <= partes.length; i++){
        if((carpeta ? i < partes.length : true) && re.test(partes.slice(0, i).join('/'))) pega = true;
      }
    } else {
      partes.forEach((x, i) => {
        if((carpeta ? i < partes.length - 1 : true) && re.test(x)) pega = true;
      });
    }
    if(pega) fuera = !niega;
  }
  return fuera;
}

async function correrPruebas(){
  /* ---- 1. El indice de fotos llega con el mapa del catalogo (hallazgo 160) ----
     El 29/09 se probo con una celda CODIGO_VAR vacia en el maestro:
     verificar-fotos escribia fotos/indice.json con solo 'archivos' y
     'generado', y la web solo probaba AT-#### a secas. Esta es la ultima red
     antes de publicar: PUBLICAR corre las pruebas despues de las fotos. */
  const txtIndice = await leer('fotos/indice.json');
  let indice = null;
  try{ indice = JSON.parse(txtIndice || 'null'); }catch(e){}
  ok(indice && Array.isArray(indice.archivos) && indice.archivos.length > 100,
     'fotos/indice.json trae la lista de archivos',
     indice && indice.archivos ? indice.archivos.length + ' archivos' : 'no se pudo leer');
  const cat = indice && indice.catalogo;
  const vars = cat && cat.vars ? Object.keys(cat.vars).length : 0;
  ok(cat && vars > 100 && cat.ids && Object.keys(cat.ids).length > 100,
     'y trae el mapa del catalogo (sin el, los productos con fotos por color se quedan sin ninguna)',
     cat ? vars + ' productos con variantes' : 'SIN catalogo');
  ok(CATALOGO && CATALOGO.vars && Object.keys(CATALOGO.vars).length === vars,
     'la pagina lo cargo entero', CATALOGO ? Object.keys(CATALOGO.vars || {}).length : 'null');
  // Formato: CRLF, sort_keys, indent=0 -- lo que evita diffs del archivo entero.
  if(txtIndice){
    const lineas = txtIndice.split('\n').length;
    ok(txtIndice.includes('\r\n') && !/[^\r]\n/.test(txtIndice),
       'fotos/indice.json va con CRLF, como lo escribe verificar-fotos', lineas + ' lineas');
  }

  /* ---- 2. verificar-fotos: los arreglos siguen puestos (158, 160, 161, 169) ---- */
  const vf = await leer('verificar-fotos.py');
  ok(vf !== null, 'se puede leer verificar-fotos.py');
  if(vf){
    ok(/if previo != indice:/.test(vf) && !/indice = \{'generado'/.test(vf),
       'el indice se escribe solo si cambio algo mas que la fecha (158)');
    ok((vf.match(/CM\.leer\(/g) || []).length === 1 && /except CM\.CatalogoRoto[^\n]*\n(?:[^\n]*print\([^\n]*\n)*\s*return 1/.test(vf),
       'el maestro se lee una sola vez y, roto, se sale con 1 sin escribir nada (160)',
       (vf.match(/CM\.leer\(/g) || []).length + ' lectura(s)');
    ok(/<-- arreglarlo primero/.test(vf),
       'y el maestro roto deja una linea "<--" que la revision diaria levanta (160)');
    ok(!/candidatos_portada\(/.test(vf) && /def de_la_columna\(/.test(vf),
       'el (11) arma la foto de cada color por codigo, como la web, y no por SKU (161)');
    ok(!/migrar-fotos-a-sku\.py --aplicar/.test(vf) && !/\bperdidas\b/.test(vf.replace(/#.*$/gm, '')),
       'no recomienda migrar-fotos-a-sku.py ni cuenta el 5b vacio (161)');
    const ramaAceptar = (vf.split("if '--aceptar' in sys.argv:")[1] || '').split('return 0')[0];
    ok(/fusionar_aceptadas\(/.test(ramaAceptar),
       '--aceptar suma a lo que ya estaba en vez de regenerar el archivo (169)');
    ok(!/equipo de la planilla/.test(vf.replace(/#.*$/gm, '')),
       'y ya no manda a pedirle al "equipo de la planilla" (172)');
  }

  /* ---- 3. PUBLICAR: lo que quedo sin subir se sube (159) ---- */
  // Sin los .bat desde el 04/10/2026: la PC se retiro el 25/09
  const pub = await leer('PUBLICAR.command');
  ok(pub !== null, 'se puede leer PUBLICAR.command');
  if(pub){
    ok(/rev-list --count origin\/main\.\.main/.test(pub) &&
       /\[ "\$CANT" = "0" \] && \[ "\$PEND" = "0" \]/.test(pub),
       'PUBLICAR.command cuenta los commits sin subir antes de decir "ya esta al dia"');
    ok(/rejected\|non-fast-forward\|fetch first/.test(pub),
       'y separa el rechazo de GitHub de la falta de conexion');
    ok(/--ignore-cr-at-eol/.test(pub),
       'y avisa cuando un archivo cambio todos sus finales de linea (170)');
  }

  /* ---- 4. Los textos ya no mandan a la planilla (172) ---- */
  const revisar = await leer('REVISAR CATALOGO.command');
  const viejos = [];
  for(const [nombre, txt] of [['PUBLICAR.command', pub], ['REVISAR CATALOGO.command', revisar]]){
    if(txt === null) continue;
    const sinComentarios = txt.split('\n').filter(l => !/^\s*(#|rem\b)/i.test(l)).join('\n');
    for(const frase of ['equipo del sheet', 'Revisando la planilla', 'hoja Landing', 'lee la planilla en vivo'])
      if(sinComentarios.includes(frase)) viejos.push(nombre + ': "' + frase + '"');
  }
  ok(!viejos.length, 'PUBLICAR y REVISAR dicen ADVAPP, no "planilla" ni "equipo del sheet"',
     viejos.join(' | ') || 'ninguno');

  /* ---- 5. Lo que el repo NO tiene que publicar (140, 174) ---- */
  const gi = await leer('.gitignore');
  ok(gi !== null, 'se puede leer el .gitignore');
  if(gi){
    const reglas = gi.split('\n');
    const afuera = ['.DS_Store', 'fotos/.DS_Store', 'sondas_x/a.js', '_notas/x.txt',
                    'RESPUESTA-AL-SHEET-16-09-b.txt', 'PEDIDO-ADVAPP-26-09.txt',
                    'PEDIDO-BOTONES-21-09.txt', 'SUMAR-AL-PEDIDO-21-09.txt',
                    'CARGA-CODIGOS-ADVAPP-26-09.txt', 'PEDIDO-ADVAPP.txt', 'logs/x.txt'];
    const seCuelan = afuera.filter(r => !ignorado(reglas, r));
    ok(!seCuelan.length, 'el .gitignore deja afuera las notas internas, .DS_Store y las sondas',
       seCuelan.join(' | ') || afuera.length + ' casos');
    // Y no se lleva puesto lo que SI tiene que estar: condicion-aceptada.txt
    // lo lee validar.py y MEDICION-ADVAPP.txt es la especificacion que cita
    // index.html.
    const adentro = ['index.html', 'condicion-aceptada.txt', 'MEDICION-ADVAPP.txt',
                     'fotos-aceptadas.txt', 'fotos-revisadas.txt', 'fotos/indice.json',
                     'fotos/AT-0455-04.jpg', 'herramientas/pedidos-advapp.json',
                     'herramientas/catalogo-maestro.csv', 'verificar-fotos.py', 'robots.txt'];
    const tapados = adentro.filter(r => ignorado(reglas, r));
    ok(!tapados.length, 'y no deja afuera nada que el sitio o las herramientas necesiten',
       tapados.join(' | ') || adentro.length + ' casos');
  }
  const ga = await leer('.gitattributes');
  ok(ga !== null && ga.trim() === '* -text',
     '.gitattributes sigue en "* -text" (decision del 26/08: git no toca los finales de linea)',
     ga === null ? 'no se pudo leer' : JSON.stringify(ga.trim()));

  /* ---- 6. El servidor local atiende solo a esta compu (173) ---- */
  const srv = await leer('servidor.py');
  ok(srv && /ThreadingTCPServer\(\('127\.0\.0\.1', PUERTO\)/.test(srv) &&
     !/ThreadingTCPServer\(\('', PUERTO\)/.test(srv),
     'servidor.py escucha en 127.0.0.1 y no en toda la red');

  /* ---- 7. El noindex es el que manda, y el robots.txt no lo tapa (143) ----
     Los buscadores solo leen el robots.txt de la raiz del dominio, asi que el
     de /catalogo-advance/ no hace nada. Y si algun dia hiciera algo, un
     "Disallow: /" les impediria bajar el HTML y ver el noindex. Cuando el
     catalogo salga al publico se borra el meta, y con el esta comprobacion. */
  const meta = document.querySelector('meta[name="robots"]');
  ok(meta && /noindex/.test(meta.content),
     'el catalogo sigue pidiendo noindex (uso interno por ahora)', meta ? meta.content : 'sin meta');
  const robots = await leer('robots.txt');
  ok(robots === null || !/^\s*Disallow:\s*\/\s*$/mi.test(robots),
     'robots.txt no bloquea todo: si se leyera, taparia el noindex');

  /* ---- 8. El LEEME de pruebas nombra todas las tandas (188) ----
     Describia 9 de 29 tandas y mandaba a PROBAR.bat. La lista de archivos
     sale del listado de carpetas del servidor local; si no hay listado, no
     se puede mirar y no cuenta como falla. */
  const leeme = await leer('pruebas/LEEME.txt');
  const listado = await leer('pruebas/');
  const tandas = listado ? [...new Set([...listado.matchAll(/href="([^"?\/]+\.js)"/g)]
                                          .map(m => decodeURIComponent(m[1])))] : [];
  if(leeme && tandas.length){
    const faltan = tandas.filter(t => !leeme.includes(t) &&
                                      !(t.startsWith('guardas-') && leeme.includes('guardas-*.js')));
    ok(!faltan.length, 'pruebas/LEEME.txt nombra cada tanda de la carpeta',
       faltan.join(', ') || tandas.length + ' tandas');
    ok(/PROBAR\.command/.test(leeme) && /python3 pruebas\/correr\.py/.test(leeme) &&
       /ADVAPP/.test(leeme),
       'y dice como se corren en la Mac y de donde salen los datos');
  } else {
    info('no se pudo leer el listado de pruebas/ (' + (leeme ? 'sin listado' : 'sin LEEME') + '): el LEEME no se reviso');
  }
}
