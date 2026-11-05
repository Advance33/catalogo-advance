// La portada publicada, sin comentarios (auditoría 04/11/2026, TG-04; Benja dijo
// que sí el 05/11). Lo corre el workflow .github/workflows/publicar.yml en
// GitHub, nunca a mano: el index.html del repo NO se toca y sigue con todos
// sus comentarios, que son la documentación.
//
//   node .github/publicar/minificar.js ENTRADA.html SALIDA.html
//
// Qué saca:
//   - JavaScript de los <script> en línea: comentarios y espacios, con terser
//     (sin comprimir ni renombrar nada: compress y mangle apagados). Terser
//     lee el código entero y lo vuelve a escribir, así que no puede confundir
//     un "//" de una dirección o de una expresión regular con un comentario.
//   - CSS de los <style>: solo los comentarios /* */, respetando comillas y
//     url(...).
//   - HTML: los comentarios <!-- --> que están fuera de los <script> y <style>.
// Qué NO toca: los <script src>, los JSON (application/ld+json y otros
// tipos), el texto, los atributos y los espacios del HTML.
//
// Si terser no puede leer algún script, sale con error y el workflow no
// publica nada (queda lo que estaba).
'use strict';
const fs = require('fs');
const zlib = require('zlib');
const { minify } = require(process.env.TERSER || 'terser');

const [entrada, salida] = process.argv.slice(2);
if(!entrada || !salida){
  console.error('Uso: node minificar.js ENTRADA.html SALIDA.html');
  process.exit(2);
}

function cssSinComentarios(css){
  let out = '', i = 0;
  while(i < css.length){
    const c = css[i];
    if(c === '"' || c === "'"){                       // una cadena, entera
      let j = i + 1;
      while(j < css.length && css[j] !== c){ if(css[j] === '\\') j++; j++; }
      out += css.slice(i, j + 1); i = j + 1; continue;
    }
    if(css.startsWith('url(', i)){                     // url(...) sin comillas, entera
      const j = css.indexOf(')', i);
      const fin = j < 0 ? css.length : j + 1;
      out += css.slice(i, fin); i = fin; continue;
    }
    if(css.startsWith('/*', i)){
      const j = css.indexOf('*/', i + 2);
      i = j < 0 ? css.length : j + 2; continue;
    }
    out += c; i++;
  }
  // los renglones que quedaron vacíos
  return out.replace(/\n[ \t]*(?=\n)/g, '');
}

(async () => {
  const src = fs.readFileSync(entrada, 'utf8');
  const re = /(<script\b[^>]*>)([\s\S]*?)(<\/script>)|(<style\b[^>]*>)([\s\S]*?)(<\/style>)|<!--[\s\S]*?-->/gi;
  const partes = [];
  let ult = 0, m, scripts = 0, estilos = 0, comentariosHtml = 0;
  while((m = re.exec(src))){
    partes.push(src.slice(ult, m.index));
    if(m[1]){
      const tipo = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(m[1]);
      const esJs = !tipo || /^(text|application)\/(javascript|ecmascript)$|^module$/i.test(tipo[1]);
      if(/\bsrc\s*=/i.test(m[1]) || !esJs || !m[2].trim()){
        partes.push(m[0]);
      }else{
        let r;
        try{
          r = await minify(m[2], {
            compress: false, mangle: false, module: tipo && /^module$/i.test(tipo[1]),
            format: { comments: false, inline_script: true },
          });
        }catch(e){
          console.error('terser no pudo leer el <script> número ' + (scripts + 1) + ': ' + (e && e.message) +
                        (e && e.line ? ' (renglón ' + e.line + ' del script)' : ''));
          process.exit(1);
        }
        partes.push(m[1] + r.code + m[3]);
        scripts++;
      }
    }else if(m[4]){
      partes.push(m[4] + cssSinComentarios(m[5]) + m[6]);
      estilos++;
    }else{
      comentariosHtml++;                               // comentario HTML: afuera
    }
    ult = re.lastIndex;
  }
  partes.push(src.slice(ult));
  const out = partes.join('').replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n');
  fs.writeFileSync(salida, out);
  const gz = s => zlib.gzipSync(Buffer.from(s), { level: 6 }).length;
  const kb = n => (n / 1024).toFixed(0) + ' KB';
  console.log(`index.html: ${scripts} scripts, ${estilos} estilos y ${comentariosHtml} comentarios HTML`);
  console.log(`  antes:   ${kb(Buffer.byteLength(src))} (comprimido ${kb(gz(src))})`);
  console.log(`  después: ${kb(Buffer.byteLength(out))} (comprimido ${kb(gz(out))})`);
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
