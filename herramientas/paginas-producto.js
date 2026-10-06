/* Las páginas de producto para Google, calculadas por la web misma.

   Benja eligió el 05/10/2026 la opción A de la muestra "El catálogo en Google":
   cada modelo tiene su página propia (catalogo.advancetecno.com.ar/producto/
   <nombre>/), y en Google se ve con precio ("desde u$…").

   Este archivo NO es parte del sitio: lo inyecta herramientas/paginas-producto.py
   en una copia de index.html abierta en Chrome sin ventana, igual que
   vista-previa.js. Usa las funciones de la página -el modelo y sus versiones,
   el título de la tarjeta, la foto de cada color, el regalo, la descripción de
   la ficha, el mensaje de WhatsApp- para que la página diga siempre lo mismo
   que el catálogo. Corre DESPUÉS de que la página armó MODELOS y cargó las
   descripciones (paginasDeProducto es async por eso).

   Necesita vpFotoPropia() de vista-previa.js (se inyectan los dos juntos).

   paginasDeProducto() devuelve
     { generado_en, cotizacion: { tipo, recargo, recargoFijo, valor },
       whatsapp, cuotas, modelos: [ { familia, titulo, marca, rubro, categoria,
         clave, desde, hasta, stock, incluye, regalo, foto, foto_og, wa,
         versiones: [ { version, color, precio, stock, clave, foto } ],
         descripcion: { venta, importante: [{ t, x }], ficha: [{ grupo, filas }] } | null } ] } */

// La ruta de una foto dentro del sitio ("fotos/sinfondo/AT-0072-03.webp"); la de
// afuera (la de respaldo de ADVAPP) queda entera.
function ppRuta(u){
  if(!u) return '';
  try{
    const x = new URL(u, document.baseURI);
    const raiz = new URL('./', document.baseURI);
    if(x.origin !== raiz.origin || !x.pathname.startsWith(raiz.pathname)) return x.href;
    return decodeURIComponent(x.pathname.slice(raiz.pathname.length));
  }catch(e){ return ''; }
}

// La descripción de la ficha, con los textos de la versión ya elegidos. Lo que
// cambia con la versión y no se sabe cuál es, no va (como en la ficha).
function ppDescripcion(v){
  const e = descripcionDe(v);
  if(!e) return null;
  const ver = versionDescripcion(e, v);
  const venta = e.venta.filter(t => typeof t === 'string' && t.trim());
  const importante = e.importante.map(p => {
    if(!p) return null;
    const t = datoDesc(p.titulo, ver), d = datoDesc(p.texto, ver);
    return t.txt ? { t: t.txt, x: d.txt || '' } : null;
  }).filter(Boolean);
  const ficha = e.ficha.map(g => ({
    grupo: (g && g.grupo) || '',
    filas: (g && Array.isArray(g.datos) ? g.datos : []).map(r => {
      if(!Array.isArray(r) || typeof r[0] !== 'string') return null;
      const x = datoDesc(r[1], ver);
      const val = x.txt || (x.otros && x.otros.length ? x.otros.join(' · ') : '');
      return val ? [r[0], val] : null;
    }).filter(Boolean),
  })).filter(g => g.filas.length);
  return (venta.length || importante.length || ficha.length) ? { venta, importante, ficha } : null;
}

async function paginasDeProducto(){
  try{ await cargarDescripciones(); }catch(e){ /* sin descripción, la página sale igual */ }
  const modelos = [];
  for(const m of MODELOS){
    const vs = (m.variantes || [m]).filter(v => v && v.precio !== null && v.precio !== undefined);
    if(!vs.length) continue;
    const rep = vs.includes(m.rep) ? m.rep : vs[0];
    const titulo = String(nombreConMarca({ marca: rep.marca || m.marca, desc: m.titulo || m.desc }) || '').trim();
    if(!titulo) continue;
    const versiones = [];
    for(const v of vs){
      const colores = partirColores(v.color || '');
      // La versión sin el color: el color va en su propia fila de botones, como
      // en la ficha ("256GB · E-Sim", y aparte Orange, Blue, Silver)
      let version = String(v.etiqueta || '').split(/\s+·\s+/)
        .filter(p => p.trim() && !colores.some(c => norm(c) === norm(p))).join(' · ');
      /* El teclado y la condición ("Caja blanca") también, si la versión no
         los dice: antes solo aparecían adentro del mensaje (auditoría 06/10) */
      const tec = v.teclado ? nombreTeclado(v.teclado) : '';
      const cond = String(v.condicion || '').trim();
      for(const extra of [tec, cond]){
        if(extra && !norm(version).includes(norm(extra.replace(/^Teclado\s+/i, '')))) version = [version, extra].filter(Boolean).join(' · ');
      }
      for(const c of (colores.length ? colores : [''])){
        const foto = (c && fotosDeColor(v, c)[0]) || v.imagenGrande || v.imagen || '';
        // El WhatsApp de cada versión y color, el mismo de la ficha (06/10:
        // la página mandaba siempre el de la versión del "desde")
        versiones.push({ version, color: c, precio: Math.round(Number(v.precio)),
                         stock: !!v.stock, clave: clave(v), foto: ppRuta(foto),
                         wa: linkWA(v.stock ? mensajeWA(v, c) : mensajeAviso(v, c)) });
      }
    }
    const conStock = versiones.filter(x => x.stock);
    const precios = (conStock.length ? conStock : versiones).map(x => x.precio);
    const foto = rep.imagenGrande || rep.imagen || '';
    modelos.push({
      familia: familia(rep),
      titulo,
      nombre: String(m.titulo || m.desc || '').trim() || titulo,
      marca: rep.marca || m.marca || '',
      categoria: m.cat || rep.cat || '',
      rubro: plural(m.cat || rep.cat || ''),
      clave: clave(rep),
      desde: Math.min(...precios),
      hasta: Math.max(...precios),
      stock: versiones.some(x => x.stock),
      incluye: textoIncluye(rep.incluye || ''),
      regalo: esRegalo(rep.incluye || ''),
      foto: ppRuta(foto),
      foto_og: vpFotoPropia(foto),
      wa: linkWA(mensajeWA(rep)),
      // De la más barata a la más cara: la primera con stock es la del "desde"
      versiones: versiones.sort((a, b) => (b.stock - a.stock) || (a.precio - b.precio)),
      descripcion: ppDescripcion(rep),
    });
  }
  return {
    generado_en: (FUENTE && FUENTE.manifiesto && FUENTE.manifiesto.generado_en) || '',
    cotizacion: { tipo: CFG.tipo, recargo: Number(CFG.recargo) || 0, recargoFijo: Number(CFG.recargoFijo) || 0, valor: TC || null },
    whatsapp: WHATSAPP || '',
    direccion: DIRECCION || '',
    mapa: MAPA || '',
    cuotas: maxCuotas(),
    advapp: ADVAPP_URL,
    modelos,
  };
}
