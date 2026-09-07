/**
 * Control de color y precio para la hoja Landing.
 *
 * Lo generó herramientas/generar-control-sheet.py desde el catálogo: NO editar
 * a mano la lista de COLORES, se pisa en la próxima corrida.
 *
 * Qué mira: que un mismo color no aparezca en dos filas del mismo producto con
 * precios distintos. Cuando pasa, ese color tiene dos precios y no hay dato en
 * ningún lado que diga cuál vale. El catálogo no puede resolverlo solo y la
 * publicación se frena. Es la misma regla que validar.py y con la misma lista
 * de colores, para que las dos digan siempre lo mismo.
 *
 * Por qué hace falta la lista de colores y no alcanza una fórmula: la columna
 * Color a veces no trae colores. El Watch Ultra dice "Black/Black Ocean Band
 * M/L", los Ray-Ban "Shiny Black/Polarized Gradient Graphite" y la Z6 III dice
 * "—". Una fórmula ve "Black" repetido en dos Watch de distinto precio y los
 * pinta, cuando lo que los separa es la correa. Probado sobre la planilla del
 * 07/09/2026: la fórmula marcaba 16 filas y 12 estaban bien.
 *
 * Instalación (una sola vez):
 *   1. En la planilla: Extensiones -> Apps Script
 *   2. Borrar lo que haya y pegar todo este archivo
 *   3. Guardar. Volver a la planilla y recargar la página
 *   4. Aparece el menú "Control" arriba. La primera vez pide permiso.
 *
 * Se ejecuta solo cada vez que se edita la hoja Landing, y a mano desde
 * Control -> Revisar ahora.
 */

var HOJA     = 'Landing';
var FONDO    = '#f4c7c3';         // rojo suave
var COLUMNAS = ['A', 'F', 'G'];   // ID, Precio USD, Color: las tres que hay que mirar

/* La lista sale del catálogo. Si mañana entra un color nuevo, se vuelve a
   generar con herramientas/generar-control-sheet.py y se pega de nuevo. */
var COLORES = [
  "amethyst", "anchor", "anchor blue", "astrobot", "bla", "black",
  "black ceramic", "black keys", "black leather", "blanco", "blu", "blue",
  "blueberry", "blush", "brown", "camo", "charcoal", "cherry pink",
  "cinza", "citrus", "cream", "dark blue", "dark green", "denim",
  "desert titanium", "gold", "grafito", "graphite", "graphite black",
  "gray", "gray camo", "graygreen", "gre", "green", "grey", "gris",
  "ice white", "icy blue", "icyblue", "indigo", "jet black", "jetblack",
  "laurel oak", "lavander", "lavender", "light blue", "light gold",
  "lightblue", "mate black", "matte black", "midnight", "moonlit silver",
  "natural", "natural titanium", "navy", "negro", "olive", "orange",
  "pearl", "pin", "pink", "pistacho", "pur", "purple", "py", "red",
  "remix green", "rhythm blue", "rose gold", "s", "s repetido", "sage",
  "sapphire", "shiny black", "shiny chalky gray", "shiny chalky grey",
  "sil", "silver", "silverblue", "sky blue", "skyblue", "space black",
  "space gray", "starlight", "teal", "techno red", "teclas blancas",
  "teclas negras", "titan black", "titanio", "titanio gris", "titanium",
  "ultramarine", "violet", "violeta", "whi", "white", "white titanium",
  "whites", "whitesilver", "y la primera", "yellow"
];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Control')
    .addItem('Revisar ahora', 'revisarColores')
    .addToUi();
}

function onEdit(e) {
  if (!e || !e.range) return;
  if (e.range.getSheet().getName() !== HOJA) return;
  revisarColores();
}

function norm(s) {
  return String(s == null ? '' : s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim();
}

/* Los colores de una celda Color, como lista sin repetidos. */
function juego(s) {
  var fuera = [];
  String(s == null ? '' : s).split('/').forEach(function (c) {
    var n = norm(c);
    if (n && fuera.indexOf(n) < 0) fuera.push(n);
  });
  return fuera;
}

/**
 * La descripción sin el paréntesis de colores, más lo que también distingue.
 *
 * El paréntesis se saca SOLO si todo lo de adentro son colores conocidos. Es lo
 * que hace que esto no se equivoque: "Watch Ultra 3 49mm (Black/Black Ocean
 * Band M/L)" conserva el paréntesis porque "black ocean band m" no es un color,
 * así que no se compara contra el de la Milanese Loop. Lo mismo el iPad
 * "(11ª Gen)" y los Ray-Ban "(601/T352)". Sacándolos todos, productos distintos
 * quedarían iguales y el aviso saltaría de más.
 */
function sinColor(desc, incluye, condicion) {
  var t = String(desc == null ? '' : desc).replace(/\(([^)]*)\)/g, function (todo, dentro) {
    var partes = dentro.split('/').map(norm).filter(function (p) { return p; });
    var sonColores = partes.length > 0 && partes.every(function (p) {
      return COLORES.indexOf(p) >= 0;
    });
    return sonColores ? ' ' : todo;
  });
  return norm(t) + ' || ' + norm(incluye) + '|' + norm(condicion);
}

function revisarColores() {
  var hoja = SpreadsheetApp.getActive().getSheetByName(HOJA);
  if (!hoja) return;
  var datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return;
  var col = {};
  datos[0].forEach(function (c, i) { col[String(c).trim()] = i; });

  var filas = [];
  for (var i = 1; i < datos.length; i++) {
    var f = datos[i];
    if (!String(f[col['ID']] || '').trim()) continue;
    // Sin Grupo no hay con quién comparar: esta fila simplemente no aplica.
    if (!String(f[col['Grupo']] || '').trim()) continue;
    var cs = juego(f[col['Color']]);
    if (!cs.length) continue;
    filas.push({
      linea: i + 1,
      id: String(f[col['ID']]).trim(),
      precio: String(f[col['Precio USD']] || '').trim(),
      colores: cs,
      clave: norm(f[col['Grupo']]) + ' || ' +
             sinColor(f[col['Descripción completa']], f[col['Incluye']], f[col['Condición']])
    });
  }

  var porClave = {};
  filas.forEach(function (f) {
    (porClave[f.clave] = porClave[f.clave] || []).push(f);
  });

  var malas = {}, avisos = {};
  Object.keys(porClave).forEach(function (k) {
    var hs = porClave[k];
    for (var a = 0; a < hs.length; a++) {
      for (var b = a + 1; b < hs.length; b++) {
        if (hs[a].precio === hs[b].precio) continue;   // mismo precio: no hay ambigüedad
        var repes = hs[a].colores.filter(function (c) {
          return hs[b].colores.indexOf(c) >= 0;
        });
        if (!repes.length) continue;                   // colores repartidos: así va
        [[hs[a], hs[b]], [hs[b], hs[a]]].forEach(function (par) {
          malas[par[0].linea] = true;
          avisos[par[0].linea] = repes.join(', ').toUpperCase() +
            ' está también en ' + par[1].id + ', que sale USD ' + par[1].precio +
            '.\nUn mismo color no puede tener dos precios: dejá en cada fila' +
            ' sólo SU color.';
        });
      }
    }
  });

  /* Se pinta y se despinta SOLO estas tres columnas, no la fila entera: si
     alguien tiene un fondo propio en la planilla, esto no se lo come. */
  var ultima = hoja.getLastRow();
  COLUMNAS.forEach(function (letra) {
    var rango = hoja.getRange(letra + '2:' + letra + ultima);
    var fondos = rango.getBackgrounds(), notas = rango.getNotes();
    for (var i = 0; i < fondos.length; i++) {
      var linea = i + 2, mal = !!malas[linea];
      var tenia = String(fondos[i][0]).toLowerCase() === FONDO.toLowerCase();
      if (mal && !tenia) fondos[i][0] = FONDO;
      else if (!mal && tenia) fondos[i][0] = null;
      if (letra === 'G') notas[i][0] = mal ? avisos[linea] : '';
    }
    rango.setBackgrounds(fondos);
    if (letra === 'G') rango.setNotes(notas);
  });
}
