/* Las vistas previas para WhatsApp, calculadas por la web misma.

   Pedro eligio el 29/09 la opcion B de la decision 4.2 (muestra
   muestras/auditoria/ficha.html, "La vista previa en WhatsApp"): el link de un
   producto llega con la foto propia de esa fila, el modelo de titulo y debajo
   la version y el color de esa fila, sin precio.

   Este archivo NO es parte del sitio: lo inyecta herramientas/vista-previa.py
   en una copia de index.html abierta en Chrome sin ventana (y la prueba
   pruebas/decision-vista-previa.js lo carga para comparar con lo publicado).
   Usa las funciones de la pagina -el titulo de la tarjeta, la version de la
   ficha, la foto que muestra la ficha- para que la vista previa diga siempre
   lo mismo que el catalogo: si mañana cambia como se arma un titulo, cambia
   aca solo. Por eso tiene que correr DESPUES de que la pagina armo MODELOS.

   vistasPrevias() devuelve
     { fuente, generado_en, filas, indice, problemas, vistas: [
         { id, destino, titulo, linea, foto } ] }
   - id:      el ID de la fila (el nombre del archivo p/<id>.html)
   - destino: la clave que abre su ficha (#p=destino); es el mismo id salvo en
              las filas que la web esconde por repetidas (colapsarIguales), que
              llevan a su gemela visible y dicen lo mismo que ella
   - titulo:  el titulo de la tarjeta con la marca ("Apple iPhone 17 Pro")
   - linea:   lo que distingue a la fila: la linea tecnica de la tarjeta, la
              version y el color ("256GB · E-Sim · Orange"); vacia si el
              titulo ya lo dice todo (un objetivo, un accesorio)
   - foto:    la foto propia que muestra la ficha al abrirse
              ("fotos/AT-0072-03.jpg"), o '' si muestra la de ADVAPP o ninguna */

/* Las partes de la version, partidas como las pestañas de la ficha: la memoria
   por un lado (memoriaDeOpcion) y el resto por el otro (restoDeOpcion). La
   RAM con el disco ("8GB/512GB") queda junta: partida decia "512GB · 8GB",
   que se lee como dos memorias. */
function vpPartesDeVersion(t){
  const partes = [];
  for(const seg of String(t || '').split(/\s+·\s+/)){
    const s = seg.trim();
    if(!s) continue;
    const dual = s.match(RE_DUAL_NOMBRE);
    if(dual){
      const d = dual[dual.length - 1];
      partes.push(d.replace(/\s+/g, '').replace(/gb/gi, 'GB').replace(/tb/gi, 'TB'));
      const resto = s.replace(d, ' ').replace(/\s{2,}/g, ' ').replace(/^[\s·\/|—–-]+|[\s·\/|—–-]+$/g, '').trim();
      if(resto) partes.push(resto);
      continue;
    }
    const mem = memoriaDeOpcion(s), resto = restoDeOpcion(s);
    if(mem) partes.push(mem);
    if(resto) partes.push(resto);
  }
  return partes;
}

/* La capacidad que dice el nombre de la fila ("8/256GB", "24GB/512GB",
   "128GB"), para las filas que no tienen pestañas: el titulo de la tarjeta
   la saca (nombreSinMemoria) y la ficha la muestra como chip. */
function vpCapacidadDelNombre(v){
  const d = String(v.desc || '').replace(RE_PAREN, ' ');
  const dual = d.match(RE_DUAL_NOMBRE);
  if(dual) return dual[dual.length - 1].replace(/\s+/g, '').replace(/gb/gi, 'GB').replace(/tb/gi, 'TB');
  return memoriaDeOpcion(d);
}

const vpPlano = t => ' ' + norm(t || '').replace(/[^a-z0-9+]+/g, ' ').trim() + ' ';
// ¿`dicho` ya contiene `parte` como palabras enteras?
const vpDice = (dicho, parte) => {
  const p = vpPlano(parte);
  return p.trim() !== '' && vpPlano(dicho).includes(p);
};
/* ¿Ya se dijo? Cada tramo de la parte ("Shiny Black · G15 Green") tiene que
   estar dicho: seguido, o con todas sus palabras. En los Ray-Ban el color de
   la fila repite el armazon y el cristal de la linea tecnica, en otro orden
   ("Cristal Transitions Graphite Green" y "Graphite Green Transitions"), y
   salia "Armazón Shiny Black · Cristal G15 Green · Shiny Black · G15 Green". */
function vpYaDicho(dicho, parte){
  const palabras = new Set(vpPlano(dicho).trim().split(' '));
  const tramos = String(parte || '').split(/\s+·\s+/).filter(t => vpPlano(t).trim());
  return tramos.length > 0 && tramos.every(t =>
    vpDice(dicho, t) || vpPlano(t).trim().split(' ').every(w => palabras.has(w)));
}

function vpLinea(m, v, titulo){
  const op = String(v.opcion || v.etiqueta || '')
    .replace(/\s*·\s*USD\s*[\d.,]+/gi, '')                  // el desempate por precio
    .replace(new RegExp('\\s*·\\s*' + escRe(String(v.id || '-')) + '\\b', 'g'), '')   // y por ID
    .trim();
  const grupo = m.variantes.filter(x => (x.opcion || x.etiqueta) === (v.opcion || v.etiqueta));
  const esVersion = m.multi && op && !opcionEsColor(grupo, v.opcion || v.etiqueta);
  const partes = [];
  if(m.tecnica) partes.push(m.tecnica);
  const version = esVersion ? vpPartesDeVersion(op) : [];
  // La memoria que no esta en ninguna pestaña (una sola version, o versiones
  // que son colores) sale del nombre de la fila
  if(!version.some(p => /\d\s*(GB|TB)\b/i.test(p))){
    const cap = vpCapacidadDelNombre(v);
    if(cap) version.unshift(cap);
  }
  partes.push(...version);
  // La Sim, si la fila la tiene y nadie la dijo (el iPhone 15 de una sola version)
  if(v.sim && !diceSim(titulo + ' ' + partes.join(' '))) partes.push(v.sim);
  const color = colorPorDefecto(v) || String(v.color || '').trim();
  if(color) partes.push(color);
  // Sin repetir lo que dice el titulo ni lo que ya se dijo, sin precio y sin ID.
  // Un precio es "USD" con un numero al lado (05/10/2026): el "USD" suelto de
  // los Tamron ("SP 24-70mm F/2.8 Di VC USD G2") es el motor del lente.
  const out = [];
  for(const p of partes.map(x => String(x || '').replace(/\s{2,}/g, ' ').trim())){
    if(!p || /\bUSD\s?\d|\$/.test(p) || (v.id && norm(p).includes(norm(v.id)))) continue;
    if(vpYaDicho([titulo, ...out].join(' · '), p)) continue;
    out.push(p);
  }
  return out.join(' · ');
}

// La foto propia de la ficha, como ruta del sitio ("fotos/AT-0072-03.jpg")
function vpFotoPropia(u){
  if(!u) return '';
  try{
    const x = new URL(u, document.baseURI);
    const raiz = new URL('./', document.baseURI);
    if(x.origin !== raiz.origin || !x.pathname.startsWith(raiz.pathname)) return '';
    const ruta = decodeURIComponent(x.pathname.slice(raiz.pathname.length));
    return new RegExp('^' + escRe(CARPETA_FOTOS) + '[^/]+\\' + EXT_FOTOS + '$').test(ruta) ? ruta : '';
  }catch(e){ return ''; }
}

function vistasPrevias(){
  const vistas = [], problemas = [];
  for(const p of PRODUCTOS){
    const id = clave(p);
    if(!p.id){ problemas.push('una fila sin ID (' + (p.desc || '') + '): sin pagina'); continue; }
    const m = buscarModelo(id);
    if(!m){ problemas.push(id + ': la web no la encuentra en ningun modelo'); continue; }
    // La fila escondida por repetida abre su gemela visible (abrirFicha daria m.rep)
    let v = m.variantes.find(x => clave(x) === id);
    if(!v){
      const firma = firmaVisible(p);
      v = m.variantes.find(x => firmaVisible(x) === firma && x.precio === p.precio)
       || m.variantes.find(x => firmaVisible(x) === firma) || m.rep;
    }
    const titulo = String(nombreConMarca({ marca: v.marca || m.marca, desc: m.titulo || m.desc }) || '').trim();
    vistas.push({
      id, destino: clave(v), titulo,
      linea: vpLinea(m, v, titulo),
      // la que abre la ficha: htmlFoto(v, '', true), la grande
      foto: vpFotoPropia(v.imagenGrande || v.imagen)
    });
  }
  return {
    fuente: FUENTE && FUENTE.fuente,
    generado_en: FUENTE && FUENTE.manifiesto && FUENTE.manifiesto.generado_en || '',
    filas: PRODUCTOS.length,
    indice: !!INDICE_FOTOS,
    problemas, vistas
  };
}
