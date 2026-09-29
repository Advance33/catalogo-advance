/* Elegir desde las muestras (29/09/2026).

   Pedro pidio poder marcar la opcion de cada decision en la misma pagina y
   copiar todo lo elegido de una vez para mandarlo. Cada muestra la armo un
   agente distinto con su propio HTML, asi que esto no se engancha adentro de
   los dibujos: agrega al final de cada pagina un panel "Tus elecciones" con
   las decisiones de decisiones.js, y una barrita abajo que cuenta cuantas
   van. En el indice junta las 7 paginas y ofrece "Copiar todas".

   Lo elegido se guarda en el navegador (localStorage, mismo sitio para las 8
   paginas), asi se puede ir y venir. Si el navegador no deja guardar, cada
   pagina igual copia lo suyo. */
(function () {
  var CLAVE = 'advtecno.auditoria.elecciones.v1';
  var PAGINAS = window.DECISIONES || [];
  var memoria = {};

  function leer() {
    try { return JSON.parse(localStorage.getItem(CLAVE) || '{}') || {}; }
    catch (e) { return memoria; }
  }
  function guardar(d) {
    memoria = d;
    try { localStorage.setItem(CLAVE, JSON.stringify(d)); } catch (e) {}
  }

  /* El texto corto de una opcion: hasta los dos puntos o la primera coma
     larga, para que la lista copiada se lea de un vistazo. */
  function corto(t) {
    var s = String(t || '').replace(/\s+/g, ' ').trim();
    var i = s.search(/[:.](\s|$)/);
    if (i > 12 && i < 90) s = s.slice(0, i);
    return s.length > 90 ? s.slice(0, 88) + '…' : s;
  }

  function textoDe(pags, el) {
    var total = 0, elegidas = 0, L = [];
    pags.forEach(function (p) {
      L.push(p.n + '. ' + p.titulo);
      p.items.forEach(function (it) {
        total++;
        var e = el[it.id], linea;
        if (!e || !e.l) linea = 'sin elegir';
        else if (e.l === 'otra') { elegidas++; linea = 'Otra'; }
        else {
          elegidas++;
          var op = it.opciones.filter(function (o) { return o.letra === e.l; })[0];
          linea = e.l + ' · ' + corto(op ? op.texto : '') + (e.l === it.rec ? '  (la recomendada)' : '');
        }
        if (e && e.nota) linea += '  — ' + e.nota.trim();
        L.push('   ' + it.id + '  ' + linea);
      });
      L.push('');
    });
    return 'Elecciones de la auditoria (29/09): ' + elegidas + ' de ' + total + '\n\n' + L.join('\n').trim();
  }

  function copiar(texto, boton, area) {
    var ok = function () { var t = boton.textContent; boton.textContent = 'Copiado ✓'; setTimeout(function () { boton.textContent = t; }, 1800); };
    var aMano = function () {
      if (area) { area.hidden = false; area.value = texto; area.focus(); area.select(); }
      boton.textContent = 'Seleccionado: Cmd+C para copiar';
    };
    try {
      navigator.clipboard.writeText(texto).then(ok, function () {
        try { if (area) { area.hidden = false; area.value = texto; area.select(); if (document.execCommand('copy')) return ok(); } } catch (e) {}
        aMano();
      });
    } catch (e) { aMano(); }
  }

  var CSS = '' +
    '.el-panel{--el-ink:#170F28;--el-muted:#584D70;--el-faint:#6F6392;--el-line:#E0D4F7;--el-acento:#7C3AED;' +
    '--el-suave:#F1EAFD;--el-ok:#0F7A54;font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--el-ink);' +
    'max-width:880px;margin:40px auto 0;padding:0 16px 96px;box-sizing:border-box}' +
    '.el-panel *{box-sizing:border-box}' +
    '.el-panel h2{font:400 30px/1 "Lilita One","Futura","Avenir Next",system-ui,sans-serif;text-transform:uppercase;margin:0 0 8px}' +
    '.el-panel .el-bajada{color:var(--el-muted);margin:0 0 20px;max-width:64ch}' +
    '.el-dec{background:#fff;border:1px solid var(--el-line);border-radius:14px;padding:16px;margin:0 0 14px}' +
    '.el-dec legend{font-weight:600;padding:0;margin:0 0 10px;display:flex;gap:10px;align-items:baseline}' +
    '.el-dec legend .el-num{font:600 12px/1 ui-monospace,Menlo,monospace;color:var(--el-acento);flex:none}' +
    '.el-dec fieldset{border:0;margin:0;padding:0;min-width:0}' +
    '.el-ops{display:grid;gap:8px}' +
    '.el-op{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;padding:10px 12px;border:1px solid var(--el-line);' +
    'border-radius:11px;cursor:pointer;background:#fff}' +
    '.el-op:hover{border-color:var(--el-acento)}' +
    '.el-op input{position:absolute;opacity:0;pointer-events:none}' +
    '.el-op .el-l{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font:700 14px/1 system-ui,sans-serif;' +
    'border:2px solid var(--el-line);color:var(--el-muted)}' +
    '.el-op .el-t{font-size:14px;color:var(--el-ink)}' +
    '.el-op .el-rec{display:inline-block;margin-left:6px;font:600 10px/1.6 ui-monospace,Menlo,monospace;letter-spacing:.06em;' +
    'text-transform:uppercase;color:var(--el-ok);background:#E3F4EC;border-radius:5px;padding:0 6px;vertical-align:1px}' +
    '.el-op.el-si{border-color:var(--el-acento);background:var(--el-suave);box-shadow:inset 0 0 0 1px var(--el-acento)}' +
    '.el-op.el-si .el-l{background:var(--el-acento);border-color:var(--el-acento);color:#fff}' +
    '.el-op:focus-within{outline:2px solid var(--el-acento);outline-offset:2px}' +
    '.el-porque{font-size:13px;color:var(--el-muted);margin:10px 0 0}' +
    '.el-nota{width:100%;margin-top:10px;font:inherit;font-size:14px;padding:8px 10px;border:1px solid var(--el-line);border-radius:9px}' +
    '.el-acciones{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}' +
    '.el-btn{font:600 15px/1 system-ui,sans-serif;padding:13px 18px;border-radius:12px;border:1px solid var(--el-acento);' +
    'background:var(--el-acento);color:#fff;cursor:pointer;text-decoration:none;display:inline-block}' +
    '.el-btn.el-sec{background:#fff;color:var(--el-acento)}' +
    '.el-btn:focus-visible{outline:2px solid var(--el-ink);outline-offset:2px}' +
    '.el-area{width:100%;min-height:180px;margin-top:12px;font:13px/1.45 ui-monospace,Menlo,monospace;padding:10px;' +
    'border:1px solid var(--el-line);border-radius:10px}' +
    '.el-barra{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;display:flex;justify-content:center;gap:10px;' +
    'align-items:center;padding:10px 16px calc(10px + env(safe-area-inset-bottom,0px));background:#170F28;color:#fff;' +
    'font:600 14px/1.2 system-ui,sans-serif;box-shadow:0 -6px 20px rgba(23,15,40,.18)}' +
    '.el-barra a{color:#fff;background:#7C3AED;padding:9px 14px;border-radius:10px;text-decoration:none;white-space:nowrap}' +
    '.el-barra a:focus-visible{outline:2px solid #fff;outline-offset:2px}' +
    '.el-resumen{list-style:none;padding:0;margin:0 0 16px;display:grid;gap:6px}' +
    '.el-resumen li{display:flex;justify-content:space-between;gap:12px;padding:10px 14px;background:#fff;border:1px solid var(--el-line);border-radius:10px}' +
    '.el-resumen .el-cuenta{font:600 13px/1.4 ui-monospace,Menlo,monospace;color:var(--el-muted);white-space:nowrap}' +
    '.el-resumen .el-completa{color:var(--el-ok)}' +
    '@media (max-width:520px){.el-panel h2{font-size:24px}.el-barra{font-size:13px}}';

  function estilo() {
    var s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function nodo(tag, clase, texto) {
    var n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }

  function cuenta(p, el) {
    return p.items.filter(function (it) { return el[it.id] && el[it.id].l; }).length;
  }

  /* ---------- en una muestra ---------- */
  function montarMuestra(p) {
    var panel = nodo('section', 'el-panel');
    panel.id = 'elegir';
    panel.setAttribute('aria-labelledby', 'el-titulo');
    var h = nodo('h2', '', 'Tus elecciones');
    h.id = 'el-titulo';
    panel.appendChild(h);
    panel.appendChild(nodo('p', 'el-bajada',
      'Marcá una letra en cada decisión (arriba están dibujadas). Se guarda sola en este navegador. ' +
      'Cuando termines las 7 páginas, andá al índice y tocá "Copiar todas mis elecciones".'));

    var barra = nodo('div', 'el-barra');
    var txtBarra = nodo('span', '');
    var ir = nodo('a', '', 'Elegir ↓');
    ir.href = '#elegir';
    barra.appendChild(txtBarra);
    barra.appendChild(ir);

    function pintarBarra() {
      var el = leer(), n = cuenta(p, el);
      txtBarra.textContent = 'Elegiste ' + n + ' de ' + p.items.length + ' en esta página';
    }

    p.items.forEach(function (it) {
      var caja = nodo('div', 'el-dec');
      var fs = nodo('fieldset');
      var lg = nodo('legend');
      lg.appendChild(nodo('span', 'el-num', it.id));
      lg.appendChild(nodo('span', '', it.pregunta));
      fs.appendChild(lg);
      var ops = nodo('div', 'el-ops');
      var nombre = 'el-' + it.id.replace('.', '-');
      var opciones = it.opciones.concat([{ letra: 'otra', texto: 'Otra cosa o no estoy seguro (escribilo abajo)' }]);
      var etiquetas = [];
      opciones.forEach(function (o) {
        var lab = nodo('label', 'el-op');
        var inp = nodo('input');
        inp.type = 'radio'; inp.name = nombre; inp.value = o.letra;
        var l = nodo('span', 'el-l', o.letra === 'otra' ? '?' : o.letra);
        var t = nodo('span', 'el-t', o.texto);
        if (o.letra === it.rec) t.appendChild(nodo('span', 'el-rec', 'recomendada'));
        lab.appendChild(inp); lab.appendChild(l); lab.appendChild(t);
        ops.appendChild(lab);
        etiquetas.push([lab, inp]);
        inp.addEventListener('change', function () {
          var el = leer();
          el[it.id] = { l: o.letra, nota: (el[it.id] && el[it.id].nota) || '' };
          guardar(el);
          marcar();
          pintarBarra();
        });
      });
      fs.appendChild(ops);
      fs.appendChild(nodo('p', 'el-porque', 'Por qué recomiendo ' + it.porque));
      var nota = nodo('input', 'el-nota');
      nota.type = 'text';
      nota.placeholder = 'Algo para aclarar (opcional)';
      nota.setAttribute('aria-label', 'Aclaración para la decisión ' + it.id);
      nota.addEventListener('input', function () {
        var el = leer();
        el[it.id] = { l: (el[it.id] && el[it.id].l) || '', nota: nota.value };
        guardar(el);
      });
      fs.appendChild(nota);
      caja.appendChild(fs);
      panel.appendChild(caja);

      function marcar() {
        var e = leer()[it.id];
        etiquetas.forEach(function (x) {
          var si = !!(e && e.l === x[1].value);
          x[1].checked = si;
          x[0].classList.toggle('el-si', si);
        });
        if (e && e.nota && nota.value !== e.nota) nota.value = e.nota;
      }
      marcar();
    });

    var acc = nodo('div', 'el-acciones');
    var bCopiar = nodo('button', 'el-btn', 'Copiar lo elegido en esta página');
    bCopiar.type = 'button';
    var aIndice = nodo('a', 'el-btn el-sec', 'Ir al índice y copiar todo →');
    aIndice.href = 'index.html#elegir';
    acc.appendChild(bCopiar);
    acc.appendChild(aIndice);
    panel.appendChild(acc);
    var area = nodo('textarea', 'el-area');
    area.hidden = true;
    area.setAttribute('aria-label', 'Texto para copiar');
    area.readOnly = true;
    panel.appendChild(area);
    bCopiar.addEventListener('click', function () { copiar(textoDe([p], leer()), bCopiar, area); });

    document.body.appendChild(panel);
    document.body.appendChild(barra);
    document.body.style.paddingBottom = '72px';
    pintarBarra();
  }

  /* ---------- en el indice ---------- */
  function montarIndice() {
    var panel = nodo('section', 'el-panel');
    panel.id = 'elegir';
    panel.style.marginTop = '8px';
    var h = nodo('h2', '', 'Tus elecciones');
    panel.appendChild(h);
    panel.appendChild(nodo('p', 'el-bajada',
      'Lo que vas marcando en cada página se junta acá. Cuando termines, tocá el botón y pegámelo en el chat.'));
    var lista = nodo('ul', 'el-resumen');
    panel.appendChild(lista);
    var acc = nodo('div', 'el-acciones');
    var bCopiar = nodo('button', 'el-btn', 'Copiar todas mis elecciones');
    bCopiar.type = 'button';
    var bBorrar = nodo('button', 'el-btn el-sec', 'Empezar de cero');
    bBorrar.type = 'button';
    acc.appendChild(bCopiar);
    acc.appendChild(bBorrar);
    panel.appendChild(acc);
    var area = nodo('textarea', 'el-area');
    area.readOnly = true;
    area.setAttribute('aria-label', 'Vista previa de lo que se copia');
    panel.appendChild(area);

    function pintar() {
      var el = leer();
      lista.textContent = '';
      PAGINAS.forEach(function (p) {
        var li = nodo('li');
        var a = nodo('a', '', p.n + '. ' + p.titulo);
        a.href = p.archivo + '#elegir';
        var n = cuenta(p, el);
        var c = nodo('span', 'el-cuenta' + (n === p.items.length ? ' el-completa' : ''), n + ' de ' + p.items.length + (n === p.items.length ? ' ✓' : ''));
        li.appendChild(a); li.appendChild(c);
        lista.appendChild(li);
      });
      area.value = textoDe(PAGINAS, el);
    }
    bCopiar.addEventListener('click', function () { copiar(textoDe(PAGINAS, leer()), bCopiar, area); });
    var armado = false;
    bBorrar.addEventListener('click', function () {
      if (!armado) { armado = true; bBorrar.textContent = 'Tocá de nuevo para borrar todo'; setTimeout(function () { armado = false; bBorrar.textContent = 'Empezar de cero'; }, 3000); return; }
      guardar({}); armado = false; bBorrar.textContent = 'Empezar de cero'; pintar();
    });
    var main = document.querySelector('main') || document.body;
    main.appendChild(panel);
    pintar();
    window.addEventListener('pageshow', pintar);
    window.addEventListener('storage', pintar);
  }

  function arrancar() {
    estilo();
    var archivo = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    var p = PAGINAS.filter(function (x) { return x.archivo.toLowerCase() === archivo; })[0];
    if (p) montarMuestra(p);
    else montarIndice();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
})();
