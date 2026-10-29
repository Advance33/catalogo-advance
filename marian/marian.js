/* Marian, la guía de botones de la web (29/10/2026).
   Lo que pidió Benja (28/10): que ayude a encontrar lo que el cliente busca en
   la web y que lo demás vaya a WhatsApp. El 29/10: «A Marian la hagamos con
   botones», «habría que organizar esto, el cliente no logra ver de forma
   clara» y «una animación cada vez que se apriete un botón». Por eso no es un
   chat: son pantallas de menú (como una app), con «←» para volver, los textos
   de la propia web adentro del panel (PREGUNTAS, ENVIO_MOTO), un solo botón de
   WhatsApp abajo, y el panel se corre cuando lleva a algo de la página para
   que se vea. No escribe nada por su cuenta: todo sale de la configuración de
   index.html, así que si cambia una respuesta allá, cambia acá.
   Corre después de index.html (script clásico, defer) y usa directo sus
   funciones: irDesdeNav, elegirPregunta, abrirCotizador, linkWA, anotar… */
(() => {
  const ESTRELLA = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9z"/><path d="M19 14l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9z"/></svg>';
  const ATRAS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  const WA = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.6-.3z"/></svg>';
  const MSJ_WA = 'Hola, quería hacer una consulta';
  // La bienvenida sale una sola vez por navegador. Las pruebas la marcan como
  // vista antes de abrir la página (pruebas/correr.py), así no les tapa nada.
  const VISTA = 'advtecno.marian';

  const ls = {
    get(k){ try{ return localStorage.getItem(k); }catch{ return null; } },
    set(k, v){ try{ localStorage.setItem(k, v); }catch{} },
  };
  const estado = { abierto: false, pila: [], wa: MSJ_WA };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const quieto = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = (tag, clase, texto) => {
    const e = document.createElement(tag);
    if(clase) e.className = clase;
    if(texto !== undefined) e.textContent = texto;
    return e;
  };

  /* ---------- El registro: cada botón tocado ----------
     Va a la medición de la web (anotar → ANALITICA, MEDICION-ADVAPP.txt) como
     { t: 'marian', boton, accion } más rubro, marca, precio o seccion si los
     tiene. Con la medición apagada no sale nada. Nunca puede romper el panel. */
  function registrar(boton, accion, detalle){
    try{
      const d = { boton: String(boton || '').slice(0, 60), accion: accion || '' };
      Object.entries(detalle || {}).forEach(([k, v]) => { if(v) d[k] = v; });
      anotar('marian', d);
    }catch{}
  }

  /* ---------- Lo que hacen los botones en la web ---------- */
  function cerrarVentanas(){
    try{ if(cerrarUsadoDOM){ usadoEmpujado = false; const c = cerrarUsadoDOM; cerrarUsadoDOM = null; c(); } }catch{}
    try{ if(cerrarPedidoDOM){ pedidoEmpujado = false; const c = cerrarPedidoDOM; cerrarPedidoDOM = null; c(); } }catch{}
  }
  function irA(url){
    history.pushState(null, '', url);
    dispatchEvent(new PopStateEvent('popstate', { state: null }));
  }
  function llevarALaGrilla(){
    setTimeout(() => {
      const cab = document.getElementById('rubro-cab'), g = document.getElementById('grid');
      const ancla = cab && !cab.hidden ? cab : g;
      if(!ancla) return;
      const cinta = typeof altoCinta === 'function' ? altoCinta() : 70;
      scrollTo({ top: Math.max(0, ancla.getBoundingClientRect().top + scrollY - cinta - 12), behavior: 'smooth' });
    }, 60);
  }
  // Abre una pregunta frecuente de la portada (la primera cuyo título calza)
  function abrirPregunta(re, extra){
    cerrarVentanas();
    const i = PREGUNTAS.findIndex(q => re.test(q.p));
    if(i < 0){ if(FICHA) irAlInicio(); irDesdeNav('preguntas'); return; }
    if(!enPortada() || FICHA) irAlInicio();
    setTimeout(() => {
      elegirPregunta(i);
      const sec = document.getElementById('ayuda');
      if(extra && sec) extra(sec);
      const destino = (sec && sec.querySelector(`.ay-p[data-ay="${i}"]`)) || sec;
      destino && destino.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }
  function irASeccion(id){
    cerrarVentanas();
    if(id === 'ofertas' || id === 'nuevos'){
      if(!enPortada() || FICHA) irAlInicio();
      setTimeout(() => {
        const b = document.getElementById(id);
        if(b) b.scrollIntoView({ behavior: 'smooth', block: 'start' });
        else irDesdeNav('preguntas');
      }, 60);
      return;
    }
    if(FICHA) irAlInicio();
    irDesdeNav(id);
  }
  function hacer(b){
    if(b.accion === 'whatsapp'){
      const url = linkWA(b.mensaje || MSJ_WA);
      // Es la conversión: va como los demás WhatsApp de la web, y en el momento
      try{ anotar('whatsapp', { desde: 'marian' }); ANALITICA.mandar(); }catch{}
      if(url) window.open(url, '_blank', 'noopener');
      return;
    }
    if(b.accion === 'mapa'){ window.open(b.url, '_blank', 'noopener'); return; }
    // Lo que pasa en la página: el panel se corre para que se vea (en la
    // computadora tapaba la parte derecha, y el cotizador quedaba debajo)
    cerrar();
    try{
      if(b.accion === 'buscar'){
        cerrarVentanas();
        const u = new URL(location.href);
        u.hash = '';
        ['q', 'cat', 'marca', 'precio', 'orden', 'stock', 'montura', 'apertura', 'capacidad', 'ram']
          .concat((typeof FILTROS_RUBRO !== 'undefined' ? FILTROS_RUBRO : []).map(f => f.campo))
          .forEach(k => u.searchParams.delete(k));
        if(b.rubro) u.searchParams.set('cat', b.rubro);
        if(b.marca) u.searchParams.set('marca', b.marca);
        if(b.precio) u.searchParams.set('precio', b.precio);
        irA(u.pathname + u.search);
        llevarALaGrilla();
      }else if(b.accion === 'seccion'){
        irASeccion(b.seccion);
      }else if(b.accion === 'pregunta'){
        abrirPregunta(b.re);
      }else if(b.accion === 'cotizar_usado'){
        abrirCotizador();
      }
    }catch(e){ console.warn('Marian: no se pudo', b, e); }
  }

  /* ---------- Las pantallas ----------
     Cada pantalla es { ceja, titulo, texto, nodo, ops, acc, wa }:
       ops → la lista de opciones (renglones con flecha) que llevan a otra pantalla
       acc → botones que hacen algo (en la página, WhatsApp, el mapa)
       wa  → el mensaje del botón de WhatsApp de abajo mientras se ve esta pantalla */

  // El texto de una pregunta frecuente, tal cual lo tiene la web
  function preguntaDeLaWeb(re){
    try{ return PREGUNTAS.find(x => re.test(x.p)) || null; }catch{ return null; }
  }
  function nodoDePregunta(q){
    const d = el('div', 'mr-texto');
    [].concat(q.r || []).forEach(t => d.appendChild(el('p', '', t)));
    if(q.lista && q.lista.length){
      const ul = el('ul');
      q.lista.forEach(t => ul.appendChild(el('li', '', t)));
      d.appendChild(ul);
    }
    if(q.envioMoto && typeof ENVIO_MOTO !== 'undefined'){
      const tabla = el('div', 'mr-tabla');
      ENVIO_MOTO.forEach(z => {
        const fila = el('div', 'mr-fila');
        fila.append(el('span', '', z.zona), el('b', '', z.precio));
        tabla.appendChild(fila);
      });
      d.appendChild(tabla);
      const conLocalidades = ENVIO_MOTO.filter(z => z.localidades && z.localidades.length);
      if(conLocalidades.length){
        const det = el('details', 'mr-cordon');
        det.appendChild(el('summary', '', '¿En qué cordón estoy?'));
        conLocalidades.forEach(z => {
          det.appendChild(el('h4', '', z.zona));
          det.appendChild(el('p', '', z.localidades.join(', ') + '.'));
        });
        det.appendChild(el('p', 'mr-suave', 'Si tu localidad no está, consultanos por WhatsApp.'));
        d.appendChild(det);
      }
    }
    [].concat(q.despues || []).forEach(t => d.appendChild(el('p', '', t)));
    return d;
  }
  // Una opción del menú que muestra una pregunta frecuente
  const FAQ = (etiqueta, re, extra) => Object.assign({ etiqueta, faq: re }, extra || {});
  function pantallaDePregunta(op, ceja){
    const q = preguntaDeLaWeb(op.faq);
    const acc = (typeof op.acc === 'function' ? op.acc() : op.acc) ||
                [{ etiqueta: 'Verlo en la página', accion: 'pregunta', re: op.faq, sec: true }];
    return { ceja, titulo: q ? q.p : op.etiqueta.replace(/^[^\p{L}¿¡]+/u, ''),
             nodo: q ? () => nodoDePregunta(q) : null,
             texto: q ? '' : 'Lo encontrás en las preguntas frecuentes de la página.',
             acc, wa: op.wa };
  }
  function mapa(){ try{ return PREGUNTAS.find(q => q.link)?.link || null; }catch{ return null; } }

  const MENU = [
    { icono: '🔎', etiqueta: 'Busco un producto', detalle: 'Por rubro, marca y precio', paso: () => pantallaMundos() },
    { icono: '💳', etiqueta: 'Pagos y cuotas', sub: () => [
      FAQ('¿Cómo puedo pagar?', /c[oó]mo puedo pagar/i),
      FAQ('¿Puedo pagar en cuotas?', /cuotas/i),
      FAQ('¿Por qué cambia el precio en pesos?', /pesos/i) ] },
    FAQ('¿Hacen envíos?', /env[ií]os/i, { icono: '🛵', detalle: 'En moto en CABA y GBA, y al resto del país',
      acc: [], wa: 'Hola, quería consultar el envío a mi zona' }),
    FAQ('Tomamos tu usado', /usado/i, { icono: '📱', detalle: 'Cotizalo en el momento',
      acc: [{ etiqueta: 'Cotizar mi usado', accion: 'cotizar_usado' }] }),
    { icono: '🔥', etiqueta: 'Ofertas y recién llegados', sub: () => [
      document.getElementById('ofertas') && { etiqueta: 'Ver las ofertas', accion: 'seccion', seccion: 'ofertas' },
      document.getElementById('nuevos') && { etiqueta: 'Ver lo recién llegado', accion: 'seccion', seccion: 'nuevos' },
    ].filter(Boolean) },
    FAQ('Dónde estamos', /en persona|retirar/i, { icono: '📍', detalle: 'Dirección y horarios',
      acc: () => (mapa() ? [{ etiqueta: mapa()[0], accion: 'mapa', url: mapa()[1] }] : [])
        .concat({ etiqueta: 'Verlo en la página', accion: 'seccion', seccion: 'donde', sec: true }),
      wa: 'Hola, quería coordinar para ir a verlos' }),
    { icono: '🛡️', etiqueta: 'Garantía y si son nuevos', sub: () => [
      FAQ('¿Tienen garantía?', /garant/i),
      FAQ('¿Son nuevos?', /nuevos/i) ] },
    FAQ('¿Cómo hago el pedido?', /c[oó]mo hago el pedido/i, { icono: '🧾' }),
  ];

  function pantallaInicio(){
    return { titulo: '¡Hola! Soy Marian', texto: '¿Qué estás buscando? Tocá una opción.', ops: MENU };
  }

  /* Busco un producto: mundo → rubro → marca → precio, con los mismos filtros
     de la web (?cat, ?marca, ?precio). Se saltea el paso que tiene una sola
     opción, y el del precio cuando quedan pocos productos. */
  const CEJA_BUSCAR = 'Busco un producto';
  const hay = f => { try{ return MODELOS.filter(f); }catch{ return []; } };
  const nombreRubro = r => { try{ return plural(r); }catch{ return r; } };
  const enAlgunTramo = (m, r) => (m.variantes || [m]).some(v => enTramo(v.precio, r));
  function pantallaMundos(){
    const mundos = (typeof MUNDOS !== 'undefined' ? MUNDOS : [])
      .map(m => ({ m, rubros: m.rubros.filter(r => hay(x => x.cat === r).length) }))
      .filter(x => x.rubros.length);
    if(!mundos.length) return { ceja: CEJA_BUSCAR, titulo: 'Un segundo…',
      texto: 'La web todavía está cargando los productos. Volvé y probá de nuevo.' };
    return { ceja: CEJA_BUSCAR, titulo: '¿Qué estás buscando?', ops: mundos.map(x => ({
      etiqueta: x.m.nombre, cuenta: hay(m => x.rubros.includes(m.cat)).length,
      paso: () => x.rubros.length === 1 ? pantallaMarca(x.rubros[0]) : pantallaRubro(x.rubros) })) };
  }
  function pantallaRubro(rubros){
    return { ceja: CEJA_BUSCAR, titulo: '¿Cuál?', ops: rubros.map(r => ({
      etiqueta: nombreRubro(r), rubro: r, cuenta: hay(x => x.cat === r).length, paso: () => pantallaMarca(r) })) };
  }
  function pantallaMarca(rubro){
    const cuenta = new Map();
    hay(x => x.cat === rubro).forEach(x => cuenta.set(x.marca, (cuenta.get(x.marca) || 0) + 1));
    const marcas = [...cuenta.entries()].filter(([m]) => m).sort((a, b) => b[1] - a[1]);
    if(marcas.length <= 1) return pantallaPrecio(rubro, '');
    const ops = marcas.slice(0, 8).map(([m, n]) => ({ etiqueta: m, rubro, marca: m, cuenta: n, paso: () => pantallaPrecio(rubro, m) }));
    ops.push({ etiqueta: 'Todas las marcas', rubro, cuenta: hay(x => x.cat === rubro).length, paso: () => pantallaPrecio(rubro, '') });
    return { ceja: CEJA_BUSCAR + ' · ' + nombreRubro(rubro), titulo: '¿De qué marca?', ops };
  }
  function pantallaPrecio(rubro, marca){
    const base = hay(x => x.cat === rubro && (!marca || x.marca === marca));
    const tramos = RANGOS.filter(r => base.some(m => enAlgunTramo(m, r)));
    if(base.length <= 8 || tramos.length <= 1) return buscar(rubro, marca, '');
    return { ceja: CEJA_BUSCAR + ' · ' + nombreRubro(rubro) + (marca ? ' ' + marca : ''), titulo: '¿Cuánto querés gastar?',
      ops: tramos.map(r => ({ etiqueta: r[1], rubro, marca, precio: r[0], cuenta: base.filter(m => enAlgunTramo(m, r)).length,
        paso: () => buscar(rubro, marca, r[0]) }))
        .concat({ etiqueta: 'Cualquier precio', rubro, marca, cuenta: base.length, paso: () => buscar(rubro, marca, '') }) };
  }
  // El último paso: filtra la página, se corre para que se vea y deja el resumen para cuando vuelva
  function buscar(rubro, marca, precio){
    const r = RANGOS.find(x => x[0] === precio);
    const n = hay(x => x.cat === rubro && (!marca || x.marca === marca) && (!r || enAlgunTramo(x, r))).length;
    const que = nombreRubro(rubro).toLowerCase() + (marca ? ' ' + marca : '') +
      (r ? ' de ' + r[1].replace(/^Hasta/, 'hasta').replace(/^Más/, 'más') : '');
    const filtro = { accion: 'buscar', rubro, marca, precio };
    setTimeout(() => { registrar('¡Listo!', 'buscar', { rubro, marca, precio }); hacer(filtro); }, quieto() ? 300 : 900);
    return { ceja: CEJA_BUSCAR, titulo: '¡Listo!', listo: true,
      texto: `Te muestro ${n === 1 ? 'el único' : 'los ' + n} ${que} en la página. Si no está lo que buscás, consultalo por WhatsApp.`,
      acc: [{ etiqueta: 'Verlos en la página', ...filtro },
            { etiqueta: 'Buscar otra cosa', paso: () => pantallaMundos(), sec: true }],
      wa: `Hola, estoy buscando ${que}` };
  }

  /* ---------- El panel ---------- */
  const raiz = document.createElement('div');
  raiz.className = 'mr-raiz';
  raiz.innerHTML = `
    <button class="mr-lanzar" type="button" aria-haspopup="dialog">${ESTRELLA}<span>Preguntale a Marian</span><span class="mr-punto" hidden></span></button>
    <section class="mr-panel" role="dialog" aria-label="Marian" hidden>
      <div class="mr-cab">
        <button class="mr-atras" type="button" aria-label="Volver" hidden>${ATRAS}</button>
        <span class="mr-av" aria-hidden="true">M</span>
        <div><b>Marian</b><small>Te ayuda a encontrar lo que buscás en la web</small></div>
        <button class="mr-cerrar" type="button" aria-label="Cerrar">×</button></div>
      <div class="mr-cuerpo" aria-live="polite"></div>
      <div class="mr-pie"><button class="mr-wa-pie" type="button">${WA}<span>Hablar con una persona</span></button>
        <small>Para comprar te pasamos con una persona por WhatsApp.</small></div>
    </section>`;
  document.body.appendChild(raiz);
  const lanzar = raiz.querySelector('.mr-lanzar'), panel = raiz.querySelector('.mr-panel');
  const cuerpo = raiz.querySelector('.mr-cuerpo'), atras = raiz.querySelector('.mr-atras');

  /* La onda que sale del dedo al tocar un botón (Benja, 29/10: «una animación
     cada vez que se apriete un botón») */
  function onda(boton, e){
    if(quieto()) return;
    const r = boton.getBoundingClientRect(), lado = Math.max(r.width, r.height) * 2;
    const o = el('span', 'mr-onda');
    const x = (e && e.clientX ? e.clientX : r.left + r.width / 2) - r.left - lado / 2;
    const y = (e && e.clientY ? e.clientY : r.top + r.height / 2) - r.top - lado / 2;
    o.style.cssText = `width:${lado}px;height:${lado}px;left:${x}px;top:${y}px`;
    boton.appendChild(o);
    setTimeout(() => o.remove(), 600);
  }
  raiz.addEventListener('pointerdown', e => {
    const b = e.target.closest('.mr-op, .mr-btn, .mr-wa-pie, .mr-lanzar, .mr-atras');
    if(b) onda(b, e);
  });

  function dibujar(p, sentido){
    const pant = el('div', 'mr-pantalla ' + (sentido === 'atras' ? 'mr-desde-izq' : 'mr-desde-der'));
    if(p.ceja) pant.appendChild(el('p', 'mr-ceja', p.ceja));
    if(p.titulo){
      const h = el('h3', 'mr-titulo' + (p.listo ? ' mr-listo' : ''));
      if(p.listo) h.innerHTML = '<span class="mr-tilde" aria-hidden="true">✓</span>';
      h.appendChild(document.createTextNode(p.titulo));
      pant.appendChild(h);
    }
    if(p.texto) pant.appendChild(el('p', 'mr-intro', p.texto));
    if(p.nodo) pant.appendChild(p.nodo());
    if(p.ops && p.ops.length){
      const lista = el('div', 'mr-ops');
      p.ops.forEach((op, i) => {
        const b = el('button', 'mr-op');
        b.type = 'button';
        b.style.setProperty('--i', i);
        if(op.icono) b.appendChild(el('span', 'mr-op-ic', op.icono));
        const t = el('span', 'mr-op-t', op.etiqueta);
        if(op.detalle) t.appendChild(el('small', '', op.detalle));
        b.appendChild(t);
        if(op.cuenta !== undefined) b.appendChild(el('span', 'mr-op-n', String(op.cuenta)));
        b.insertAdjacentHTML('beforeend', '<span class="mr-op-fl" aria-hidden="true">›</span>');
        b.addEventListener('click', () => tocar(op, b));
        lista.appendChild(b);
      });
      pant.appendChild(lista);
    }
    if(p.acc && p.acc.length){
      const acc = el('div', 'mr-acc');
      p.acc.forEach((a, i) => {
        const b = el('button', 'mr-btn' + (a.sec ? ' mr-sec' : ''), a.etiqueta);
        b.type = 'button';
        b.style.setProperty('--i', i);
        b.addEventListener('click', () => tocar(a, b));
        acc.appendChild(b);
      });
      pant.appendChild(acc);
    }
    cuerpo.replaceChildren(pant);
    cuerpo.scrollTop = 0;
    atras.hidden = estado.pila.length <= 1;
    estado.wa = p.wa || MSJ_WA;
  }
  function ir(p){ estado.pila.push(p); dibujar(p, 'adelante'); }
  function volver(){
    if(estado.pila.length <= 1) return;
    estado.pila.pop();
    dibujar(estado.pila[estado.pila.length - 1], 'atras');
  }
  function inicio(){ estado.pila = []; ir(pantallaInicio()); }

  /* Al tocar: el renglón se marca un instante y recién ahí pasa a lo que
     sigue, así se ve qué se eligió */
  function tocar(op, boton){
    registrar(op.etiqueta, op.accion || (op.faq ? 'pregunta' : op.paso ? 'paso' : op.sub ? 'menu' : ''),
              { rubro: op.rubro, marca: op.marca, precio: op.precio, seccion: op.seccion });
    if(boton) boton.classList.add('mr-elegido');
    setTimeout(() => {
      if(op.paso) ir(op.paso());
      else if(op.sub) ir({ ceja: op.etiqueta, titulo: 'Elegí', ops: op.sub() });
      else if(op.faq) ir(pantallaDePregunta(op, op.icono ? '' : estado.pila[estado.pila.length - 1]?.ceja || ''));
      else if(op.accion){ if(boton) boton.classList.remove('mr-elegido'); hacer(op); }
    }, quieto() || !boton ? 0 : 170);
  }

  function abrir(){
    if(!estado.abierto) registrar('Abrir', 'abrir');
    estado.abierto = true;
    panel.hidden = false; lanzar.hidden = true;
    panel.classList.remove('mr-saliendo');
    raiz.querySelector('.mr-punto').hidden = true;
    if(!estado.pila.length) inicio();
  }
  function cerrar(){
    if(!estado.abierto) return;
    estado.abierto = false;
    lanzar.hidden = false;
    if(estado.pila.length > 1) raiz.querySelector('.mr-punto').hidden = false;
    if(quieto()){ panel.hidden = true; return; }
    panel.classList.add('mr-saliendo');
    setTimeout(() => { if(!estado.abierto){ panel.hidden = true; panel.classList.remove('mr-saliendo'); } }, 230);
  }

  lanzar.addEventListener('click', abrir);
  atras.addEventListener('click', volver);
  raiz.querySelector('.mr-cerrar').addEventListener('click', cerrar);
  raiz.querySelector('.mr-wa-pie').addEventListener('click', () => tocar({ etiqueta: 'Hablar con una persona', accion: 'whatsapp', mensaje: estado.wa }, null));
  addEventListener('keydown', e => { if(e.key === 'Escape' && estado.abierto && !document.querySelector('.modal')) cerrar(); });

  /* ---------- La bienvenida (B): una sola vez por navegador ----------
     Con ?bienvenida=1 sale siempre (para mostrarla). No sale si entró por el
     link de un producto (#p=…) ni si ya hay una ficha abierta. */
  function bienvenida(){
    if(estado.abierto || document.querySelector('.modal') || raiz.querySelector('.mr-velo')){ ls.set(VISTA, '1'); return; }
    const velo = el('div', 'mr-velo');
    const atajos = MENU.slice(0, 3);
    velo.innerHTML = `<div class="mr-bienvenida" role="dialog" aria-modal="true" aria-labelledby="mr-bv-t">
        <span class="mr-icono">${ESTRELLA}</span>
        <h2 id="mr-bv-t">Nuevo: conocé a Marian</h2>
        <p>Tocás lo que buscás y te lleva directo al producto, a cómo pagar, a los envíos o a cotizar tu usado.</p>
        <div class="mr-ejemplos">${atajos.map((o, i) => `<button class="mr-ej" type="button" data-i="${i}">${esc(o.icono + ' ' + o.etiqueta)}</button>`).join('')}</div>
        <div class="mr-btns"><button class="mr-btn mr-sec" type="button" data-no>Ahora no</button>
          <button class="mr-btn" type="button" data-si>Probar ahora</button></div>
      </div>`;
    raiz.appendChild(velo);
    const fuera = () => { velo.remove(); ls.set(VISTA, '1'); };
    velo.querySelector('[data-no]').addEventListener('click', () => { registrar('Bienvenida: Ahora no', 'bienvenida'); fuera(); });
    velo.querySelector('[data-si]').addEventListener('click', () => { registrar('Bienvenida: Probar ahora', 'bienvenida'); fuera(); abrir(); });
    velo.querySelectorAll('.mr-ej').forEach(b => b.addEventListener('click', () => {
      registrar('Bienvenida: ' + atajos[+b.dataset.i].etiqueta, 'bienvenida');
      fuera(); abrir(); tocar(atajos[+b.dataset.i], null);
    }));
    velo.addEventListener('click', e => { if(e.target === velo){ registrar('Bienvenida: cerrada', 'bienvenida'); fuera(); } });
    velo.querySelector('[data-si]').focus();
  }
  const forzar = new URL(location.href).searchParams.get('bienvenida') === '1';
  if(forzar || (!ls.get(VISTA) && !location.hash)){
    setTimeout(bienvenida, forzar ? 600 : 1500);
  }

  window.MARIAN = { abrir, cerrar, volver, inicio, hacer, tocar, bienvenida, MENU, estado, VISTA };
})();
