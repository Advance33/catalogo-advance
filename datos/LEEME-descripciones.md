# datos/descripciones.json — la descripción de cada producto

Este archivo es lo que muestra la ficha de cada producto en el acordeón
**Por qué elegirlo / Lo más importante / Ficha técnica** (Pedro eligió la A2
de `muestras/descripciones-desplegables`, 30/09/2026). Va a crecer hasta
cubrir todo el catálogo. Estas son las reglas para cargarlo.

## Reglas que no se discuten

1. **Todo dato técnico sale de la página oficial del fabricante** (Apple,
   Samsung, Sigma, DJI…), y esa página va en `fuentes`. Nada de tiendas,
   reseñas ni memoria. Si no está en la fuente oficial, no va.
2. **Nada comercial.** Precio, cuotas, envío, garantía, stock y "el mejor"
   los define Pedro, no la ficha: esas palabras hacen fallar la prueba.
   (Retiro, garantía y formas de pago ya están en la ficha, aparte.)
3. **No inventar.** Si un dato falta, no se pone. Mejor un punto menos.
4. **Lo que no sale del fabricante va en `proveedor`**, nunca mezclado con
   lo del fabricante, y la entrada dice de dónde vino (`proveedor.fuente`).
   La ficha lo marca "proveedor" y la fuente lo aclara.
5. Español rioplatense, frases cortas, sin signos de exclamación.

## Cómo lo usa la web

- Lo pide **recién al abrir la primera ficha** (el que sólo mira la grilla no
  lo baja), con un tope de 6 s (`DESC_ESPERA_MS` en `index.html`). Si no
  llega, la ficha se ve como antes y se prueba otra vez con la próxima.
- Busca la entrada por el **código AT-#### de la fila** que se está mirando
  (columna CODIGO de ADVAPP). Si el código no está en ninguna entrada, **no
  se muestra nada**: ni un renglón vacío.
- La descripción es **del modelo**: una entrada cubre todos los códigos del
  modelo (todas las memorias, Sim y eSIM, teclados, monturas, packs).
- Un dato que cambia con la versión se resuelve con lo que la ficha ya sabe
  de la fila (su Sim, la memoria de la pestaña, la montura, el nombre) y
  **no con el código**: el 30/09 la columna CODIGO de ADVAPP traía en 16 de
  las 52 filas con descripción el código de otra versión (el iPhone 17 Pro
  Sim de 256GB dice AT-0071, que es el eSIM de 1TB). Si una fila no calza en
  exactamente una versión, el dato no se resalta: se muestran todos, cada
  uno con su versión (y la prueba avisa).

## El formato

```json
{
  "formato": "descripciones/1",
  "leeme": "El formato está en datos/LEEME-descripciones.md",
  "descripciones": [ { …una entrada por modelo… } ]
}
```

Una entrada (recortada del iPhone 17 Pro):

```json
{
  "modelo": "iPhone 17 Pro",
  "codigos": ["AT-0071", "AT-0072", "AT-0073", "AT-0535", "AT-0536", "AT-0537"],
  "versiones": [
    {"nombre": "Sim", "codigos": ["AT-0535", "AT-0536", "AT-0537"], "si": {"sim": "Sim"}},
    {"nombre": "E-Sim", "codigos": ["AT-0071", "AT-0072", "AT-0073"], "si": {"sim": "E-Sim"}}
  ],
  "venta": [
    "Tres cámaras de 48 MP atrás, con un teleobjetivo que llega a 8x…",
    "Pantalla de 6,3\" con ProMotion hasta 120 Hz…"
  ],
  "importante": [
    {"titulo": "Chip A19 Pro", "texto": "CPU de 6 núcleos, GPU de 6 núcleos y Neural Engine de 16 núcleos."},
    {"titulo": {"segun": {"Sim": "Hasta 31 h de video", "E-Sim": "Hasta 33 h de video"}},
     "texto": "De reproducción. Carga rápida: hasta 50% en 20 minutos…"}
  ],
  "ficha": [
    {"grupo": "Diseño", "datos": [
      ["Medidas", "150 x 71,9 x 8,75 mm"],
      ["Peso", {"segun": {"Sim": "204 g", "E-Sim": "206 g"}}]
    ]}
  ],
  "fuentes": [
    {"texto": "support.apple.com/es-la/125090", "url": "https://support.apple.com/es-la/125090"}
  ],
  "verificado": "2026-09-30",
  "notas": "Lo que haya que confirmar. No se muestra."
}
```

### Los campos

| Campo | Qué es |
|---|---|
| `modelo` | El nombre, para que lo lea una persona. La web no lo muestra. |
| `codigos` | **Todos** los AT-#### del modelo, sacados de `herramientas/catalogo-maestro.csv` (columna CODIGO). Cada código en **una sola** entrada de todo el archivo. |
| `versiones` | Sólo si algún dato cambia con la versión. Cada una: `nombre` (lo que se lee en la ficha: "Sim", "1TB", "Canon RF"), sus `codigos` (cada código de la entrada en una sola versión) y `si`, cómo la reconoce la web (abajo). |
| `venta` | "Por qué elegirlo": una o dos frases de venta, con datos, sin adjetivos vacíos. |
| `importante` | "Lo más importante": 4 o 5 puntos, cada uno `titulo` (corto) y `texto` (una línea). |
| `ficha` | "Ficha técnica": grupos (`grupo`: "Pantalla", "Cámaras"…) con `datos`, cada dato `[nombre, valor]`. |
| `fuentes` | La página oficial, siempre (una o más). `texto` es lo que se lee (la dirección sin `https://`), `url` empieza con `https://`. |
| `proveedor` | Sólo si hay datos del proveedor: `fuente` (quién y cuándo lo dijo) y `aviso` (lo que agrega la línea de la fuente, por ejemplo "lo que trae es dato del proveedor"). |
| `verificado` | La fecha en que se leyó la fuente (AAAA-MM-DD). |
| `notas` | Lo que queda por confirmar. No se muestra. |

### Un valor que cambia con la versión

Donde va un texto (`titulo`, `texto` o el valor de un dato de la ficha)
puede ir, en cambio:

```json
{"segun": {"256GB": "12 GB", "512GB": "12 GB", "1TB": "16 GB"}}
```

- Las claves son los `nombre` de `versiones`, y **tienen que estar todas**.
- La ficha muestra resaltado el de la versión que se mira, con los de las
  otras en chiquito ("En esta versión. 1TB: 16 GB"), y en los puntos la
  marca "según versión".
- Lo que dice el proveedor y no el fabricante va aparte, en `proveedor`:

```json
{"segun": {"RC-N3": "Control RC-N3", "RC 2 + Combo More Fly": "Control DJI RC 2"},
 "proveedor": {"4 baterías": "Control remoto con pantalla"}}
```

  Una versión va en `segun` o en `proveedor`, no en los dos. Si el dato del
  proveedor vale para todas las versiones: `{"proveedor": "texto"}`.

### `si`: cómo reconoce la web cada versión

Todas las condiciones de `si` se tienen que cumplir, y cada fila tiene que
calzar en **una sola** versión.

| Condición | Se compara con | Ejemplo |
|---|---|---|
| `sim` | la Sim de la fila ("Sim" o "E-Sim", sale del SKU) | `{"sim": "E-Sim"}` |
| `memoria` | la memoria de la pestaña (la última capacidad: en "16GB/1TB" es 1TB) | `{"memoria": "1TB"}` |
| `teclado` | el teclado de la fila ("EN" o "ES") | `{"teclado": "ES"}` |
| `montura` | la montura del lente ("Sony E", "Canon RF"…) | `{"montura": "Canon RF"}` |
| `texto` | pedazos que tienen que estar en el nombre de la fila (descripción, modelo e "Incluye" de ADVAPP, sin mayúsculas, tildes ni signos) | `{"texto": ["more fly plus"]}` |
| `sin` | pedazos que NO tienen que estar | `{"texto": ["more fly"], "sin": ["plus"]}` |

Para saber qué dice cada fila, abrí la ficha y mirá las pestañas, o en la
consola del navegador: `MODELOS.find(m => /s26 ultra/i.test(m.desc)).variantes.map(v => [v.id, v.codigo, v.opcion, v.sim, v.montura])`.

## Cómo sumar un modelo

1. Buscá en `herramientas/catalogo-maestro.csv` **todos** sus códigos (cada
   memoria, Sim/eSIM, teclado, montura o pack tiene el suyo).
2. Leé la página oficial de specs del fabricante (en español si existe) y
   anotá la dirección.
3. Escribí la entrada con el formato de arriba. Si un dato cambia entre
   versiones, armá `versiones` y usá `segun`.
4. **Pasala por el verificador** (obligatorio desde el 01/10/2026: Pedro pidió
   "una estructura con un agente para que no se filtren datos erróneos"):
   - `python3 herramientas/verificar-descripciones.py --lotes 1 --carpeta DIR`
     arma el lote con lo que falta verificar y las filas de hoy del sitio.
   - Se lo das al agente **verificador-descripciones**
     (`~/.claude/agents/verificador-descripciones.md`), que NO es el que la
     escribió: lee cada fuente oficial entera y revisa dato por dato, que sea
     ese producto (sin deducir 4G/5G, Wi-Fi/celular, Sim/eSIM, región) y las
     reglas de arriba. Devuelve `ok`, `corregir` o `sacar` por entrada.
   - Lo que vuelve `corregir` se arregla y se vuelve a verificar.
   - `python3 herramientas/verificar-descripciones.py --registrar DIR/informe-*.json`
     anota la huella de las `ok` en `datos/descripciones-verificadas.json`.
   Una entrada sin su huella (nueva, o cambiada después de verificarse, aunque
   sea una coma) hace fallar la prueba y frena la publicación. Las `notas` no
   cuentan: se pueden cambiar sin volver a verificar.
5. Corré las pruebas: `python3 pruebas/correr.py` (la tanda
   `decision-descripciones` revisa el formato: códigos que existen en el
   maestro, ninguno repetido entre entradas, versiones que cubren sus
   códigos, cada dato cubriendo todas las versiones, fuente `https://`,
   proveedor con su fuente y ninguna palabra comercial; que cada fila de
   hoy calce en una sola versión; y que todas estén verificadas).
6. Mirá la ficha en el celular y en la compu.

## De dónde salieron las primeras cinco (30/09/2026)

iPhone 17 Pro, Galaxy S26 Ultra, MacBook Neo, Sigma 17-40mm F1.8 DC Art y DJI
Mini 5 Pro: las verificadas para la muestra
(`descripciones-armador/desc.json`), sin cambiar ningún dato técnico, más el
dato de Pedro del DJI Mini 5 Pro «4 baterías» (lo que trae, del proveedor;
no es un pack oficial de DJI), que reemplazó los "a confirmar".
