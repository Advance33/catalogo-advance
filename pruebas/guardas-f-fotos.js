// Guardas de la tanda F-fotos (29/09/2026): el Galaxy S26 Ultra Black.
//
// Lo que paso: al elegir Black en la ficha del S26 Ultra, el cliente veia un
// Ultra BLANCO (fotos/AT-0102-03.jpg, el mismo render que la White
// recomprimido) o directamente un Galaxy S26 comun, con tres camaras y sin
// S Pen (AT-0103-01 y AT-0512-03, identicas). Tres filas con stock, el
// insignia, y las tres fotos figuraban "mirada" en fotos-revisadas.txt.
// Ninguna herramienta lo freno: el chequeo (13) de verificar-fotos.py
// comparaba bytes, y la blanca y la "negra" diferian en bytes.
//
// Esta tanda mira LA IMAGEN, no el nombre del archivo: la del Black tiene
// que ser oscura, no puede ser la misma que la del White del mismo equipo y
// no puede ser la de un Galaxy S26 comun. Y las dos fotos que se sacaron no
// pueden volver con el mismo contenido. Al final, lo mismo en general para
// todo el catalogo: dos colores de un producto no pueden ser la misma imagen
// aunque sean archivos distintos (seccion 7).
//
// Sin nombres fijos de archivo: las filas se buscan en los datos del dia.
// Si hoy no se vende el Black, no hay nada que mirar y no falla. Sin foto
// tampoco falla: "preferimos no mostrar nada antes que inventar".
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
      try{ cerrarFicha(); }catch(e){}
      try{ pararPaseos(); }catch(e){}
      try{ pararOfertas(); }catch(e){}
      for(let i=1;i<5000;i++) clearInterval(i);
      reportar();
    });
}, 120);

const dormir = ms => new Promise(r => setTimeout(r, ms));

// Las dos imagenes que se sacaron el 29/09 (SHA-256 del archivo grande). Si
// alguna vuelve a estar publicada, con cualquier nombre de S26 Ultra, es la
// foto equivocada que volvio: por un --volver, una copia vieja o un backup.
const SACADAS = {
  '58d7ac3b5c5b5a31551eabe54ce7eec564b186db5d2b4309ea827267a4530518': 'el Ultra blanco que estaba como Black (AT-0102-03)',
  'c719aef849f248562a41feb8174fadce41ffd5cd4a46bfc8f9f05f9e90abbaa5': 'el Galaxy S26 comun que estaba como Ultra Black (AT-0103-01 / AT-0512-03)'
};

// cargarImagen y no "cargar": index.html ya tiene una cargar() global, y
// declararla de nuevo tira la tanda entera antes de empezar ("no llego a
// correr", sin ningun otro aviso).
const cargarImagen = url => new Promise(r => {
  const im = new Image();
  im.onload = () => r(im);
  im.onerror = () => r(null);
  im.src = url;
});

async function huella(url){
  const b = await (await fetch(url, { cache: 'no-store' })).arrayBuffer();
  const h = await crypto.subtle.digest('SHA-256', b);
  return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join('');
}

/* La imagen reducida a lo que no es fondo y llevada a 96x96, en brillo y
   tono. El recorte hace que el mismo render reescalado o recomprimido de
   igual (asi estaban la White y la "Black" del 1TB), y separar el tono del
   brillo hace que un Silver y un Rose Gold NO den igual aunque solo cambie
   el marco. Se calibro el 29/09 con Pillow y en Chrome sobre las fotos de
   ese dia, y las dos mediciones coincidieron (0,000 y 0,038 en los casos
   malos). verificar-fotos.py no la tiene: su (13) sigue comparando md5. */
const LADO = 96;
function vista(im){
  const w = im.naturalWidth, h = im.naturalHeight;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for(let y = 0; y < h; y++) for(let i = 0; i < w; i++){
    const k = (y * w + i) * 4;
    if(0.299 * d[k] + 0.587 * d[k+1] + 0.114 * d[k+2] < 240){
      if(i < x0) x0 = i; if(i > x1) x1 = i; if(y < y0) y0 = y; if(y > y1) y1 = y;
    }
  }
  if(x1 < 0){ x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
  const c2 = document.createElement('canvas'); c2.width = LADO; c2.height = LADO;
  const x2 = c2.getContext('2d', { willReadFrequently: true });
  x2.imageSmoothingEnabled = true; x2.imageSmoothingQuality = 'high';
  x2.fillStyle = '#fff'; x2.fillRect(0, 0, LADO, LADO);
  x2.drawImage(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 0, 0, LADO, LADO);
  const e = x2.getImageData(0, 0, LADO, LADO).data;
  const px = [];
  for(let k = 0; k < e.length; k += 4){
    const Y = 0.299 * e[k] + 0.587 * e[k+1] + 0.114 * e[k+2];
    px.push([Y, e[k+2] - Y, e[k] - Y, Math.min(e[k], e[k+1], e[k+2])]);
  }
  return px;
}
// Que parte de la imagen cambia de verdad entre dos fotos: 0 es la misma
// imagen, 1 es otra cosa. Medido el 29/09: la White y la "Black" del 1TB
// daban 0,000; la Ultra negra buena contra la White, 0,83; el S26 comun
// contra la foto mala del Ultra, 0,04, y contra la buena, 0,35.
const distinto = (a, b) => a.filter((p, i) =>
  Math.abs(p[0] - b[i][0]) > 30 || Math.abs(p[1] - b[i][1]) > 10 || Math.abs(p[2] - b[i][2]) > 10).length / a.length;
// Que parte de lo que no es fondo es oscuro. Un equipo negro, aunque tenga
// la pantalla prendida al lado, pasa de la mitad; el blanco que estaba como
// Black daba 0,10.
function oscuro(v){
  const fig = v.filter(p => p[3] < 235);
  return fig.length ? fig.filter(p => p[0] < 90).length / fig.length : 0;
}

const UMBRAL_MISMA = 0.15;   // menos que esto es "la misma imagen"
const UMBRAL_OSCURO = 0.3;   // menos que esto no es un equipo negro
// La chica contra su grande se mide mas flojo: la chica esta reducida y
// recomprimida, y la misma foto da 0,07. Lo que se busca ahi es una chica
// VIEJA (la de la foto anterior), que da 0,8.
const UMBRAL_CHICA = 0.3;

const esUltra = p => /galaxy\s*s26\s*ultra/i.test(p.desc || '');
const esS26Comun = p => /galaxy\s*s26\b/i.test(p.desc || '') && !/ultra|\bfe\b|edge|plus|\+/i.test(p.desc || '');
const esNegro = c => /^black$|^negro$/i.test(String(c || '').trim());
const nombre = u => decodeURIComponent(String(u || '').split('/').pop());

async function correrPruebas(){
  await elUltraBlack();
  await dosColoresUnaImagen();
}

async function elUltraBlack(){
  const ultraNegras = PRODUCTOS.filter(p => esUltra(p) && partirColores(p.color || '').some(esNegro));
  if(!ultraNegras.length){
    // Linea informativa y no ok(true): un OK que no mira nada engorda el total
    // y no avisa de nada (29/09, tanda P, hallazgo 184)
    R.push('  --  hoy no se vende el Galaxy S26 Ultra en Black: nada que mirar');
    return;
  }

  /* Las fotos que ve el cliente al elegir Black: la del puntito (la chica) y
     la de la ficha (la grande), de cada fila que lo vende. */
  const porUrl = new Map();                 // url grande -> filas
  const sinFoto = [];
  for(const p of ultraNegras){
    const c = partirColores(p.color || '').find(esNegro);
    const u = fotosDeColor(p, c)[0];
    if(!u){ sinFoto.push(p.id); continue; }
    if(!porUrl.has(u)) porUrl.set(u, []);
    porUrl.get(u).push(p);
  }
  R.push('  --  filas del S26 Ultra que venden Black hoy: ' + ultraNegras.length + ' filas, '
     + porUrl.size + ' foto(s) distintas' + (sinFoto.length ? ', sin foto: ' + sinFoto.join(' ') : ''));

  // Las del Galaxy S26 comun, de todos sus colores, para no confundirlas
  const comunes = new Set();
  for(const p of PRODUCTOS.filter(esS26Comun))
    for(const c of partirColores(p.color || '')) for(const u of fotosDeColor(p, c).slice(0, 1)) comunes.add(u);
  const vistasComunes = [];
  for(const u of comunes){
    const im = await cargarImagen(u);
    if(im) vistasComunes.push([u, vista(im)]);
  }

  for(const [u, filas] of porUrl){
    const ids = filas.map(p => p.id).join(' ');
    const grande = await cargarImagen(u);
    ok(!!grande, 'la foto del Black esta publicada', nombre(u) + ' (' + ids + ')');
    if(!grande) continue;

    /* 1. No volvio ninguna de las que se sacaron */
    const h = await huella(u);
    ok(!SACADAS[h], 'no es una de las fotos que se sacaron por equivocadas',
       nombre(u) + (SACADAS[h] ? ': es ' + SACADAS[h] : ''));

    const v = vista(grande);
    /* 2. Es un equipo negro, no uno blanco */
    const o = oscuro(v);
    ok(o >= UMBRAL_OSCURO, 'la foto del Black muestra un equipo negro',
       nombre(u) + ': ' + Math.round(o * 100) + '% oscuro (minimo ' + Math.round(UMBRAL_OSCURO * 100) + '%)');

    /* 3. No es la misma imagen que la del White del mismo equipo */
    const p0 = filas[0];
    const blanca = fotosDeColor(p0, 'White')[0];
    if(blanca && blanca !== u){
      const imb = await cargarImagen(blanca);
      if(imb){
        const dif = distinto(v, vista(imb));
        ok(dif >= UMBRAL_MISMA, 'la foto del Black no es la del White con otro nombre',
           nombre(u) + ' contra ' + nombre(blanca) + ': ' + dif.toFixed(3));
      }
    }

    /* 4. No es la de un Galaxy S26 comun */
    let peor = null;
    for(const [uc, vc] of vistasComunes){
      const dif = distinto(v, vc);
      if(!peor || dif < peor[1]) peor = [uc, dif];
    }
    if(peor)
      ok(peor[1] >= UMBRAL_MISMA, 'la foto del Ultra Black no es la de un Galaxy S26 comun',
         nombre(u) + ' contra ' + nombre(peor[0]) + ': ' + peor[1].toFixed(3) + ' (' + vistasComunes.length + ' fotos del S26 comparadas)');

    /* 5. Y la chica, que es la del puntito, dice lo mismo que la grande */
    const chica = fotoChica(u);
    if(chica && chica !== u){
      const imc = await cargarImagen(chica);
      ok(!!imc, 'la foto chica del Black esta publicada', nombre(chica));
      if(imc){
        // La chica se rehace sola cuando la grande cambia (miniaturas.py mira
        // la fecha); si alguien copia la grande a mano y no corre
        // verificar-fotos.py, el puntito sigue mostrando la vieja.
        const vc = vista(imc);
        ok(oscuro(vc) >= UMBRAL_OSCURO, 'la chica del puntito tambien muestra un equipo negro',
           'mini/' + nombre(chica) + ': ' + Math.round(oscuro(vc) * 100) + '% oscuro');
        ok(distinto(v, vc) < UMBRAL_CHICA, 'y es la misma foto que la grande',
           'mini/' + nombre(chica) + ': ' + distinto(v, vc).toFixed(3) + ' contra la grande');
      }
    }
  }

  /* 6. Lo que se ve al abrir la ficha de una fila Black: la foto grande */
  const p = ultraNegras.find(x => porUrl.size && [...porUrl.values()].some(fs => fs.includes(x))
                               && partirColores(x.color || '').length === 1);
  if(p){
    abrirFicha(clave(p), false);
    await dormir(400);
    const img = document.querySelector('#ficha .fi-foto img') || document.querySelector('.fi-foto img');
    const src = img && img.getAttribute('src');
    const im = src ? await cargarImagen(src) : null;
    const o = im ? oscuro(vista(im)) : 0;
    ok(!!im && o >= UMBRAL_OSCURO, 'la ficha de ' + p.id + ' abre con un equipo negro',
       (src ? nombre(src) : '(sin foto)') + ': ' + Math.round(o * 100) + '% oscuro');
    cerrarFicha();
  }
}

/* 7. En TODO el catalogo: dos colores del mismo producto no pueden ser la
   misma imagen, aunque no sean los mismos bytes. Es la forma general del
   error del Ultra: el chequeo (13) de verificar-fotos.py compara md5, y un
   render recomprimido con otro nombre de color le pasa por al lado.

   Se mira la GRANDE, no la chica. Medido el 29/09 sobre las 325 parejas de
   colores que habia: con las grandes, las que de verdad son la misma imagen
   dan menos de 0,003 y la pareja distinta mas parecida (un MacBook Silver y
   Midnight, donde manda la pantalla) da 0,056; un Silver y un Rose Gold del
   Watch, que solo cambian en el marco, dan 0,09. Con las chicas (reducidas y
   recomprimidas) las dos puntas se tocaban: la misma imagen llegaba a 0,036
   y el Watch Silver contra el Space Gray daba 0,047. */
const UMBRAL_COLORES = 0.02;
/* Las parejas que ya se miraron y SON el mismo color escrito de dos maneras:
   ahi la misma foto es la correcta. No son un error de la pagina sino dos
   variantes del catalogo maestro que tal vez convenga fusionar. Si aparece
   otra, se mira la foto: si es el mismo color, va aca con el porque; si no,
   una de las dos esta mal y se saca (a _fotos-que-estan-mal/). */
const MISMO_COLOR_DOS_NOMBRES = {
  // El iPhone 17 no tiene un "Green": es como el proveedor escribio Sage
  // (la -06 se agrego sola el 14/09).
  'AT-0070-02|AT-0070-06': 'iPhone 17 256GB: Sage y Green son el mismo verde',
  // Anotado en el maestro el 15/09: la -02 "era el lente del mismo anteojo".
  'AT-0418-01|AT-0418-02': 'Meta Wayfarer 601ST350: la -02 es el lente del mismo anteojo que la -01'
};
/* Las identicas BYTE A BYTE no se cuentan aca: esas ya las marca el chequeo
   (13) de verificar-fotos.py, y el (11) frena si una fila las muestra. Se
   listan, pero no se dan por buenas. El 29/09 era una sola, AT-0455-04 y
   AT-0455-05 del Watch Ultra 3, y NO es el mismo color: la -05 ("Blue") es
   la que ADVAPP le da a SW-APP-016, que vende la Blue Trail Loop, y muestra
   la Anchor Blue Ocean Band. Queda para quien arregle las del Watch. */

async function dosColoresUnaImagen(){
  if(!INDICE_FOTOS){
    R.push('  --  sin indice de fotos no hay nada que comparar');
    return;
  }
  const porCodigo = new Map();
  for(const f of INDICE_FOTOS){
    const m = /^(AT-\d{4})-\d{2}\.jpg$/.exec(f);
    if(!m) continue;
    if(!porCodigo.has(m[1])) porCodigo.set(m[1], []);
    porCodigo.get(m[1]).push(f.slice(0, -4));
  }
  let parejas = 0, fotos = 0;
  const iguales = [], yaVistas = [], identicas = [], cerca = [];
  const t0 = performance.now();
  for(const [cod, vars] of porCodigo){
    if(vars.length < 2) continue;
    const vistas = [];
    for(const v of vars.sort()){
      const im = await cargarImagen(CARPETA_FOTOS + v + EXT_FOTOS);
      if(im){ vistas.push([v, vista(im)]); fotos++; }
    }
    for(let i = 0; i < vistas.length; i++) for(let j = i + 1; j < vistas.length; j++){
      parejas++;
      const d = distinto(vistas[i][1], vistas[j][1]);
      const par = vistas[i][0] + '|' + vistas[j][0];
      cerca.push([d, par]);
      if(d >= UMBRAL_COLORES) continue;
      const texto = par.replace('|', ' y ') + ' (' + d.toFixed(3) + ')';
      if(MISMO_COLOR_DOS_NOMBRES[par]){ yaVistas.push(texto); continue; }
      const [ha, hb] = [await huella(CARPETA_FOTOS + vistas[i][0] + EXT_FOTOS),
                        await huella(CARPETA_FOTOS + vistas[j][0] + EXT_FOTOS)];
      (ha === hb ? identicas : iguales).push(texto);
    }
  }
  ok(parejas > 50, 'se compararon las fotos de color de todo el catalogo',
     fotos + ' fotos, ' + parejas + ' parejas de colores del mismo producto, en '
     + Math.round((performance.now() - t0) / 1000) + ' s');
  ok(!iguales.length, 'ningun producto muestra la misma imagen en dos colores',
     iguales.length ? iguales.slice(0, 5).join(' | ')
                    : 'ya vistas como el mismo color: ' + (yaVistas.join(' | ') || 'ninguna'));
  if(identicas.length)
    R.push('  --  identicas byte a byte (las marca verificar-fotos.py, no se dan por buenas): ' + identicas.join(' | '));
  // Para calibrar si hace falta: las cinco parejas distintas mas parecidas
  const masCerca = cerca.filter(x => x[0] >= UMBRAL_COLORES).sort((a, b) => a[0] - b[0]).slice(0, 5);
  R.push('  --  las parejas distintas mas parecidas: ' + masCerca.map(x => x[1].replace('|', '/') + ' ' + x[0].toFixed(3)).join(' | '));
}
