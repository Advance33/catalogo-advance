// El contrato landing/1.1 (09/09/2026): lo que la web se comprometio a hacer
// de su lado. Que lea el manifiesto de la planilla (hoja Meta), que el sello
// "Actualizado" diga la verdad, que la portada sea la foto del primer color
// que la fila vende HOY, que la vidriera salga de la planilla y no de una
// lista fija, y que las categorias nuevas tengan lugar en la barra.
//
// Sin nombres fijos: los casos se buscan en la planilla del dia.
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
  try{ correrPruebas(); }catch(e){ R.push('EXCEPCION: ' + (e && e.stack || e)); fallas++; }
  try{ pararPaseos(); }catch(e){}
  try{ pararOfertas(); }catch(e){}
  for(let i = 1; i < 5000; i++) clearInterval(i);
  reportar();
}, 120);

function correrPruebas(){
  /* ---- 1. El manifiesto ----
     Desde el 29/09 la hoja Meta se pide solo si los datos salen de la
     planilla (o si ADVAPP vino corto): con ADVAPP andando META queda en null
     y lo de abajo no aplica. Se dice en vez de pasar en silencio. */
  ok(META === null || typeof META === 'object', 'META es el manifiesto o null (nunca revienta)');
  if(FUENTE && FUENTE.fuente === 'advapp'){
    ok(META === null, 'con ADVAPP la hoja Meta no se pide ni se usa', JSON.stringify(META));
    R.push('  --  la fuente es ADVAPP: el contrato y las ofertas de la hoja Meta no aplican');
  }else if(META){
    ok(/^landing\/1\./.test(META.contrato || ''), 'el contrato es de la familia landing/1.x', META.contrato);
    ok(typeof META.verificado_hoy === 'boolean', 'dice si la carga del dia corrio', String(META.verificado_hoy));
    ok(Array.isArray(META.ofertas), 'trae la lista de ofertas', (META.ofertas || []).length + ' IDs');
    /* Las ofertas del manifiesto y las que la web deduce de Precio anterior
       tienen que ser las mismas: si se separan, uno de los dos miente. */
    const enBaja = PRODUCTOS.filter(p => p.antes !== null && p.precio !== null && p.antes > p.precio).map(p => p.id).sort();
    const delMeta = [...(META.ofertas || [])].sort();
    ok(JSON.stringify(enBaja) === JSON.stringify(delMeta),
       'las ofertas del manifiesto son las que tienen Precio anterior', enBaja.length + ' vs ' + delMeta.length);
  }else{
    R.push('  --  el manifiesto no llego: se prueba solo lo que no depende de el');
  }

  /* ---- 2. El sello dice la verdad ----
     Contra el manifiesto de la fuente que se uso (FUENTE.manifiesto), no
     contra la hoja Meta: esa quedo congelada el 16/09 con verificado_hoy en
     true y hacia decir "hoy" sobre precios viejos. "Hoy" pide ademas que el
     manifiesto sea de hoy. 'En vivo' ya no es una respuesta valida: salia en
     verde justo cuando no habia carga (29/09). */
  const texto = document.getElementById('stamp').textContent.trim();
  const verde = document.querySelector('.stamp .dot').classList.contains('live');
  const man = FUENTE && FUENTE.manifiesto;
  const diaAR_ = t => new Date(t).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
  const deHoy = !!(man && man.verificado_hoy === true && man.generado_en
                   && diaAR_(man.generado_en) === diaAR_(Date.now()));
  /* 29/09 (decision 1.1 B): si lo que se ve es la copia de este navegador
     porque ADVAPP no contesto, el sello dice de que hora son los precios. */
  if(FUENTE && FUENTE.fuente === 'copia')
    ok(texto === 'Precios de las ' + hhmm(FUENTE.hora) && !verde,
       'con la copia de este navegador el sello dice la hora de esos precios, sin el punto verde', texto);
  else if(deHoy)
    ok(texto === 'Actualizado hoy' && verde, 'con carga de hoy el sello dice "Actualizado hoy" en verde', texto);
  else
    ok(/^Actualizado \d{1,2}\/\d{1,2}\/\d{2,4}$/.test(texto) && !verde,
       'sin carga de hoy el sello muestra la fecha real de la fila mas nueva, sin el punto verde',
       texto + (verde ? ' (verde)' : ''));

  /* ---- 3. El indice de fotos y la portada por variante ----
     Las fotos se llaman por el codigo del catalogo: AT-0142-01.jpg. Lo que
     se prueba aca es que el indice llegue y que la portada de cada fila sea
     un archivo que existe; el detalle de los codigos esta en codigos.js. */
  ok(INDICE_FOTOS instanceof Set && INDICE_FOTOS.size > 100, 'el indice de fotos llego',
     INDICE_FOTOS ? INDICE_FOTOS.size + ' archivos' : 'null');
  if(INDICE_FOTOS){
    const conFoto = PRODUCTOS.filter(p => p.imagen && p.imagen.includes(CARPETA_FOTOS));
    ok(conFoto.length > 0, 'hay productos con portada', conFoto.length);
    const fantasma = conFoto.filter(p =>
      !INDICE_FOTOS.has(decodeURIComponent(p.imagen.split('/').pop().split('?')[0])));
    ok(fantasma.length === 0, 'y ninguna apunta a un archivo que no esta',
       fantasma.slice(0, 3).map(p => p.id).join(', ') || conFoto.length + ' portadas');
    /* Un producto sin ningun archivo no manda a pedir nada: placeholder.
       29/09 (hallazgos 178 y 184): esto buscaba un producto sin imagen y
       comprobaba que no tuviera imagen, y no podia fallar nunca. Ahora se
       abre su ficha y se mira lo que ve el cliente: el cartel y ninguna foto.
       Entre las variantes y no entre las filas: una gemela escondida abre la
       ficha de la que se muestra, que puede tener foto. */
    const sinNada = MODELOS.flatMap(m => m.variantes).find(p => !p.imagen);
    if(sinNada){
      abrirFicha(clave(sinNada), null);
      const marco = document.querySelector('#ficha .fi-marco');
      const img = marco && marco.querySelector('img');
      ok(!!marco && !img && !!marco.querySelector('.sinfoto'),
         'sin archivos, la ficha muestra el cartel "sin imagen" y no pide ninguna foto',
         sinNada.id + (img ? ': muestra ' + img.getAttribute('src') : (marco ? '' : ': no se abrio la ficha')));
      try{ cerrarFicha(); }catch(e){}
    }else{
      R.push('  --  hoy todos los productos tienen foto: el cartel no se probo');
    }
    /* fotosDeColor no pide lo que el indice dice que no existe */
    let pedidas = 0, fantasmas = [];
    for(const p of PRODUCTOS.slice(0, 200)){
      for(const c of partirColores(p.color)){
        for(const u of fotosDeColor(p, c)){
          pedidas++;
          const n = decodeURIComponent(u.split('/').pop().split('?')[0]);
          if(!INDICE_FOTOS.has(n)) fantasmas.push(n);
        }
      }
    }
    ok(fantasmas.length === 0, 'fotosDeColor solo devuelve archivos que estan en el indice',
       fantasmas.slice(0, 3).join(' | ') || pedidas + ' urls');
  }

  /* ---- 4. La vidriera sale de la planilla ---- */
  ok(Array.isArray(VIDRIERA_FIJOS) && VIDRIERA_FIJOS.length === 0,
     'no hay IDs clavados en el codigo: las ofertas las define Precio anterior', VIDRIERA_FIJOS.length);

  /* ---- 5. Las categorias del contrato tienen lugar en la barra ---- */
  for(const c of ['E-Reader', 'Drone', 'Accesorio Drone'])
    ok(ORDEN_CATS.includes(c), 'ORDEN_CATS incluye ' + c);
}
