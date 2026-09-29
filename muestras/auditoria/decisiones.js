/* Las 40 decisiones de la auditoria del 29/09, una lista por pagina.
   Lo leen elegir.js en cada muestra y el indice. Generado desde el resultado
   de los agentes de diseño: si se rehace una muestra, rehacer esto. */
window.DECISIONES = [
 {
  "n": 1,
  "archivo": "resiliencia.html",
  "titulo": "Cuando ADVAPP falla",
  "items": [
   {
    "id": "1.1",
    "pregunta": "ADVAPP no contesta, pero ese celular ya había entrado antes. El navegador puede guardar la última lista buena de ADVAPP con su hora. ¿Cómo la mostramos? (hallazgos #0 y #16)",
    "opciones": [
     {
      "letra": "A",
      "texto": "La copia con sello ámbar: se ve la última lista buena y solo cambia el sello de arriba («Precios de las 01:52 · no se pudo actualizar», con el punto ámbar). En el celular el sello baja a un segundo renglón, y en un celular de menos de 360 px se corta."
     },
     {
      "letra": "B",
      "texto": "La copia con franja: además del sello ámbar, arriba de los productos va una franja ámbar que dice «Estás viendo los precios de las 01:52. No pudimos actualizarlos.», con un botón Reintentar."
     },
     {
      "letra": "C",
      "texto": "No mostrar la copia: aunque la copia sea de hace cinco minutos, sale el aviso de no disponible con Reintentar y WhatsApp. Es la misma pantalla que la pregunta 4."
     }
    ],
    "rec": "B",
    "porque": "B: con la hora a la vista el cliente sabe qué está mirando, y en el celular el sello solo casi no se ve."
   },
   {
    "id": "1.2",
    "pregunta": "¿Hasta cuántas horas vale esa copia? Solo cuenta si en la 1 elige A o B. Durante la auditoría, ADVAPP cambió precios dentro de la misma hora. (hallazgos #16 y #0)",
    "opciones": [
     {
      "letra": "A",
      "texto": "1 hora: con la copia de las 01:52, se usa hasta las 02:51."
     },
     {
      "letra": "B",
      "texto": "6 horas: se usa hasta las 07:51."
     },
     {
      "letra": "C",
      "texto": "24 horas: se usa hasta las 01:51 del día siguiente, y el sello dice «Precios de ayer, 01:52»."
     },
     {
      "letra": "D",
      "texto": "En los tres casos, cuando la copia vence pasa lo que se elija en la 3."
     }
    ],
    "rec": "B",
    "porque": "B: cubre una caída de media jornada. Si dura más, que el cliente pregunte por WhatsApp."
   },
   {
    "id": "1.3",
    "pregunta": "ADVAPP no contesta y no hay copia, porque es la primera visita o la copia ya venció. Hoy se muestra la planilla del 16/09. ¿Qué ve el cliente? (hallazgo #0)",
    "opciones": [
     {
      "letra": "A",
      "texto": "Aviso de no disponible: sin precios, con Reintentar y WhatsApp. El formato del aviso se elige en la 4."
     },
     {
      "letra": "B",
      "texto": "La planilla del 16/09, avisada: sello ámbar «Precios del 16/09» y una franja que dice «Precios y stock del 16/09. Pueden haber cambiado: confirmá por WhatsApp antes de comprar.». Hoy esa lista muestra con stock 94 productos que ADVAPP da sin stock."
     },
     {
      "letra": "C",
      "texto": "Una copia del día publicada junto con la web: una foto de ADVAPP que se sube una vez por día, con franja ámbar. Hace falta una tarea diaria que la publique. Si esa tarea se corta, la copia se congela igual que la planilla, así que vencería a las 24 h y pasaría a A."
     }
    ],
    "rec": "A",
    "porque": "A: la planilla muestra stock que no existe, y preferimos no mostrar nada antes que inventar."
   },
   {
    "id": "1.4",
    "pregunta": "¿Cómo es el aviso cuando no carga nada? Hoy el cliente lee cómo compartir un Google Sheet, ve el error crudo «Failed to fetch» y no tiene botón para reintentar. (hallazgo #10)",
    "opciones": [
     {
      "letra": "A",
      "texto": "Corto: título «No pudimos cargar el catálogo» y abajo «Revisá tu conexión y probá de nuevo.» (con señal dice «Probá de nuevo en un momento…»). Botón Reintentar y enlace «Escribinos por WhatsApp»."
     },
     {
      "letra": "B",
      "texto": "Como A, más el error técnico escondido en un desplegable cerrado que dice «Detalle para Advance»."
     },
     {
      "letra": "C",
      "texto": "Como A, más reintentos automáticos: a los 5, 15 y 30 s y apenas vuelve la señal, hasta 3 intentos. Se ve una línea que dice «Probamos de nuevo solos en 15 s»."
     }
    ],
    "rec": "C",
    "porque": "C: si la señal vuelve, el cliente no tiene que hacer nada, y el detalle técnico ya queda en la consola."
   },
   {
    "id": "1.5",
    "pregunta": "¿Cómo se ve el pedido mientras se muestra una copia? El total y el mensaje de WhatsApp salen de los precios que están en pantalla. El ejemplo usa datos reales: iPhone 17 Pro Max 256GB E-Sim (CEL-APP-096) USD 1.330 más Xbox Series X (CON-MIC-008) USD 1.000. (hallazgo #16)",
    "opciones": [
     {
      "letra": "A",
      "texto": "Total con la hora: la barra muestra USD 2.330 / $ 3.693.050 y abajo «Precios de las 01:52 · a confirmar». El mensaje termina con «Precios de las 01:52, a confirmar.»."
     },
     {
      "letra": "B",
      "texto": "Sin precios hasta que se actualice: la barra dice «Total a confirmar» y el mensaje lista los productos sin precios, con «Precios a confirmar.»."
     }
    ],
    "rec": "A",
    "porque": "A: el cliente ve cuánto gasta y el vendedor sabe de qué hora es cada precio."
   },
   {
    "id": "1.6",
    "pregunta": "Al entrar, ¿mostramos la copia al instante mientras llega lo nuevo? Hoy la página espera a ADVAPP, al dólar, a la hoja Meta y a las fotos antes de mostrar un producto. (hallazgo #16)",
    "opciones": [
     {
      "letra": "A",
      "texto": "Como hoy: esqueletos grises y el sello «Cargando…» hasta que llega todo."
     },
     {
      "letra": "B",
      "texto": "La copia al instante: los productos aparecen enseguida, sin pesos, con el sello ámbar «Precios de las 01:52 · actualizando…». Se reemplazan solos cuando llega lo nuevo, y los pesos aparecen cuando llega el dólar."
     }
    ],
    "rec": "B",
    "porque": "B, pero solo si lo nuevo tarda más de 1 segundo: con buena señal no hace falta y así la pantalla no titila."
   }
  ]
 },
 {
  "n": 2,
  "archivo": "tarjeta-precio.html",
  "titulo": "Tarjeta y precio",
  "items": [
   {
    "id": "2.1",
    "pregunta": "Punto 1 de la muestra (#66). Con un filtro de variante puesto (1TB, RAM, tramo de precio), ¿qué precio muestra la tarjeta y en qué versión abre la ficha? Datos de hoy: con 1TB, el 17 Pro Max dice 'desde USD 1.330' y el 1TB vale 1.720. La cabecera dice 'desde USD 860' y no hay ningún 1TB a ese precio.",
    "opciones": [
     {
      "letra": "A",
      "texto": "como hoy. El 'desde' es el del modelo entero, la ficha abre en la versión más barata (256GB) y el + carga esa."
     },
     {
      "letra": "B",
      "texto": "la tarjeta muestra el precio de las versiones que cumplen el filtro y dice 'desde' sólo si entre ellas hay precios distintos. data-key y el + pasan a la más barata con stock entre esas. La cabecera se recalcula (queda 'desde USD 1.005')."
     },
     {
      "letra": "C",
      "texto": "como B, pero la etiqueta dice 'en 1TB' en vez de 'desde'."
     }
    ],
    "rec": "B",
    "porque": "B. El chip del filtro ya está a la vista arriba; alcanza con que el número coincida con lo filtrado. Si Pedro elige B o C, también hay que tocar togglePedidoModelo y tomar el precio anterior de la misma variante."
   },
   {
    "id": "2.2",
    "pregunta": "Punto 2 (#208). ¿Marcamos como aproximados los pesos de la tarjeta, la ficha y el pedido?",
    "opciones": [
     {
      "letra": "A",
      "texto": "como hoy, '$ 2.108.050' sin aclarar."
     },
     {
      "letra": "B",
      "texto": "'≈ $ 2.108.050', con title 'Referencia con la cotización del día'."
     },
     {
      "letra": "C",
      "texto": "'aprox. $ 2.108.050'."
     }
    ],
    "rec": "B",
    "porque": "B en la tarjeta, la ficha, la vidriera y el total del pedido. En la barra del pedido del celular va sin marca: lo medí en el sitio real a 390 px y bp-ars tiene 81 px, así que con '≈' o 'aprox.' los pesos bajan a un segundo renglón. El mensaje de WhatsApp ya dice 'aprox.'."
   },
   {
    "id": "2.3",
    "pregunta": "Punto 3 (#82). ¿Cómo arma el título la ficha en las 9 fichas que muestran códigos del proveedor (3 Ray-Ban Meta Gen 2 'F … | L …', 3 Dell y 3 MSI '| Marca')?",
    "opciones": [
     {
      "letra": "A",
      "texto": "como hoy, el nombreFicha crudo ('Meta Gen 2 — Wayfarer F Shiny Black | L Transitions Graphite Green', 'P2425HE | Dell Pro 24 Plus FHD (…)')."
     },
     {
      "letra": "B",
      "texto": "limpiar sólo esas 9 con las mismas regex de partirTitulo. Ray-Ban: h3 'Meta Gen 2 Wayfarer' y debajo una línea 'Armazón … · Cristal …' que sí hace salto de línea. Monitores: sin '| Marca'."
     },
     {
      "letra": "C",
      "texto": "la ficha igual a la tarjeta en todos los productos (m.titulo + m.tecnica). Cambian 45 fichas más y se repite lo que ya está en los chips (23.8\")."
     }
    ],
    "rec": "B",
    "porque": "B: arregla las 9 fichas mal armadas y no toca las que se leen bien. Es lo que propuso el verificador."
   },
   {
    "id": "2.4",
    "pregunta": "Punto 4 (#94). ¿Cómo muestra la ficha el 'Precio anterior' cuando ADVAPP lo traiga? Hoy vienen 0 de 757 filas con ese dato. En la muestra, el monto es un hueco [anterior]/[dif.].",
    "opciones": [
     {
      "letra": "A",
      "texto": "como hoy, la ficha no dice nada."
     },
     {
      "letra": "B",
      "texto": "'USD [anterior]' tachado al lado del precio, en la etiqueta oscura (en lila #A597C4)."
     },
     {
      "letra": "C",
      "texto": "B, más el cartel 'Ahorrás USD …' sobre la foto, al lado de 'En stock'."
     }
    ],
    "rec": "C",
    "porque": "C: afuera y adentro dicen lo mismo. El precio anterior se toma siempre de la variante v, no del modelo."
   },
   {
    "id": "2.5",
    "pregunta": "Punto 5 (#200). ¿Dónde dice la ficha que el precio es sin factura y cómo se paga? Los textos quedaron como hueco [Pedro completa]; también se pueden usar, tal cual, las respuestas de PREGUNTAS.",
    "opciones": [
     {
      "letra": "A",
      "texto": "como hoy, sólo en las preguntas frecuentes de la portada."
     },
     {
      "letra": "B",
      "texto": "un renglón nuevo en .fi-servicio, junto a retiro y garantía, con 'Ver formas de pago' que despliega la respuesta de '¿Cómo puedo pagar?' (hace falta ícono en ICONOS_SERVICIO)."
     },
     {
      "letra": "C",
      "texto": "una frase más en la nota del pie de la ficha, con link a las formas de pago."
     }
    ],
    "rec": "B",
    "porque": "B, con el texto sacado de PREGUNTAS buscando por la pregunta, para que no haya dos versiones. El texto lo decide Pedro."
   },
   {
    "id": "2.6",
    "pregunta": "Punto 6 (#80). ¿Se puede agregar al pedido un producto sin stock? Ejemplo real: ACC-CAN-001 a USD 130. Hoy hay 236 versiones sin stock.",
    "opciones": [
     {
      "letra": "A",
      "texto": "como hoy. Se agrega sin aviso y suma al total (el pedido de ejemplo da USD 1.590 con 260 que no hay)."
     },
     {
      "letra": "B",
      "texto": "no se puede. La ficha deja sólo 'Avisame cuando entre' y la tarjeta agotada pierde el +. Lo que ya estaba guardado y se quedó sin stock se ve marcado, sin borrarse."
     },
     {
      "letra": "C",
      "texto": "se puede, pero marcado. Lleva la etiqueta 'Sin stock' en la lista, no suma al total y el mensaje dice '— sin stock (avisame cuando entre)' y cierra con ', más los productos sin stock'."
     }
    ],
    "rec": "B",
    "porque": "B: es lo que la ficha ya le dice al cliente, y así el vendedor no tiene que desarmar pedidos. La marca para lo que ya estaba guardado se hace igual en cualquier caso."
   },
   {
    "id": "2.7",
    "pregunta": "Punto 7 (#199, sólo celular). ¿Cómo hacemos que 'Consultar por WhatsApp' se vea sin bajar? En la maqueta a 390×664, la CTA del 17 Pro queda en 826-873 dentro de una caja de 624 de alto.",
    "opciones": [
     {
      "letra": "A",
      "texto": "como hoy, aparece después de bajar."
     },
     {
      "letra": "B",
      "texto": ".fi-botones con position:sticky; bottom:0 dentro de .fi-datos, con fondo y borde arriba. Son los mismos botones y se sueltan al llegar al envío (en la maqueta quedan en 519-566)."
     },
     {
      "letra": "C",
      "texto": "una barra compacta sticky al pie de la caja, con el precio de la versión, 'Consultar' y '+'. Es una pieza nueva que hay que sincronizar con el color y la versión."
     }
    ],
    "rec": "B",
    "porque": "B: no agrega estado nuevo, es el mismo botón que ya actualizan elegirColorFicha y elegirVariante."
   },
   {
    "id": "2.8",
    "pregunta": "Punto 8 (#123, sólo celular). ¿Qué pasa con la X de cerrar la ficha cuando se baja?",
    "opciones": [
     {
      "letra": "A",
      "texto": "como hoy, se va con el scroll."
     },
     {
      "letra": "B",
      "texto": "la X sticky con la regla del verificador: position:sticky; top:14px; align-self:flex-end; margin:14px 14px -48px auto. Flota siempre y puede tapar un poco la punta de una pestaña."
     },
     {
      "letra": "C",
      "texto": "una franja fina con el nombre y la X que aparece al bajar más de unos 260 px (necesita un listener de scroll)."
     }
    ],
    "rec": "B",
    "porque": "B: es un cambio chico de CSS, la X no se pierde nunca y combina con la B del punto 7."
   }
  ]
 },
 {
  "n": 3,
  "archivo": "busqueda.html",
  "titulo": "Búsqueda sin resultados",
  "items": [
   {
    "id": "3.1",
    "pregunta": "Hallazgo #60. Adentro de un rubro, ¿dónde busca? Estás en Celulares y escribís \"airpods\": el desplegable sugiere 4 AirPods, pero la grilla dice \"No encontramos nada\", porque busca solo en Celulares y no lo avisa. Con los datos de hoy da 0 contra 4, y \"canon\" da 0 contra 89.",
    "opciones": [
     {
      "letra": "A",
      "texto": "busca en todo el catálogo. Al escribir, la cinta pasa sola a \"Todo\" y aparecen los 4. En contra: te saca del rubro sin preguntarte, y en Objetivos se pierden los filtros de montura y apertura."
     },
     {
      "letra": "B",
      "texto": "busca en el rubro y te ofrece salir. El título dice “airpods” en Celulares · 0 productos, el desplegable muestra lo mismo que la grilla y los dos ofrecen \"Buscar en todo el catálogo (4)\"."
     },
     {
      "letra": "C",
      "texto": "busca en el rubro y, si no encuentra nada, salta solo a todo el catálogo, con un aviso y un \"Volver a Celulares\". En contra: la pantalla puede cambiar de rubro mientras todavía estás escribiendo la palabra."
     }
    ],
    "rec": "B",
    "porque": "B: es la única que no te cambia de lugar sin avisar, y funciona igual en Objetivos."
   },
   {
    "id": "3.2",
    "pregunta": "Hallazgo #69. Si un filtro deja la grilla vacía, ¿qué dice? En Consolas con \"Más de USD 5.000\" hay 0, y la grilla dice \"Probá con menos palabras\" aunque no escribiste nada. Sin el filtro hay 12 y la más cara sale USD 1.300.",
    "opciones": [
     {
      "letra": "A",
      "texto": "solo cambia el texto, que dice la causa (\"En Consolas no hay nada de más de USD 5.000\") y señala la × de arriba. No agrega ningún botón."
     },
     {
      "letra": "B",
      "texto": "la causa más un botón con la cantidad: \"Quitar 'Más de USD 5.000' (12)\". Es el mismo botón que el \"en todo el catálogo\" de la decisión 1."
     },
     {
      "letra": "C",
      "texto": "la causa, el botón y debajo las 4 consolas más caras. En contra: muestra precios que nadie pidió y suma ruido."
     }
    ],
    "rec": "B",
    "porque": "B: dice por qué la grilla quedó vacía y da una salida con número, con el mismo botón que la decisión 1."
   },
   {
    "id": "3.3",
    "pregunta": "Hallazgo #119. Si lo que buscás no está en ningún lado, ¿ofrecemos consultarlo? \"xiaomi 15 ultra\" da 0 en todo el catálogo y hoy la pantalla no ofrece ninguna salida. El \"¿Buscás algo que no está?\" solo aparece en la portada.",
    "opciones": [
     {
      "letra": "A",
      "texto": "un botón en el vacío, \"Preguntanos si lo conseguimos\", que abre WhatsApp con el mismo mensaje de la portada (\"Hola! Estoy buscando: … ¿Lo consiguen?\")."
     },
     {
      "letra": "B",
      "texto": "el recuadro de la portada, con lo buscado ya escrito y editable. En contra: es más grande y más oscuro que el resto de la grilla."
     },
     {
      "letra": "C",
      "texto": "el botón de A y además la consulta dentro del desplegable, en lugar de que se cierre. En contra: aparece con la palabra a medio escribir; con \"xiaomi 15 u\" ya no hay sugerencias."
     }
    ],
    "rec": "A",
    "porque": "A: un solo botón, justo cuando hace falta y con lo buscado ya escrito, sin prometer que lo conseguimos."
   },
   {
    "id": "3.4",
    "pregunta": "Hallazgo #69, aparte. Al cambiar de rubro con un precio puesto: en Cámaras con \"Más de USD 5.000\" hay 4; si tocás Consolas, el filtro sigue puesto y la grilla queda vacía (0 de 12). A la marca, la cinta ya la saca sola.",
    "opciones": [
     {
      "letra": "A",
      "texto": "el precio se queda, como hoy, y el vacío lo explica lo que elijas en la decisión 2."
     },
     {
      "letra": "B",
      "texto": "el precio se saca solo si en el rubro nuevo no queda nada, con el aviso \"Sacamos 'Más de USD 5.000': en Consolas no había nada en ese precio\"."
     }
    ],
    "rec": "B",
    "porque": "B: hace con el precio lo mismo que la cinta ya hace con la marca."
   }
  ]
 },
 {
  "n": 4,
  "archivo": "ficha.html",
  "titulo": "Ficha: cuatro agregados",
  "items": [
   {
    "id": "4.1",
    "pregunta": "Botón Compartir en la ficha (#97, parte 1): ¿dónde va? Hoy para mandar un producto hay que copiar la dirección del navegador a mano.",
    "opciones": [
     {
      "letra": "A",
      "texto": "tercer botón «Compartir», debajo de «Agregar al pedido», con el mismo estilo"
     },
     {
      "letra": "B",
      "texto": "ícono redondo arriba, al lado de la X (mismo estilo que la X, con 8 px de separación)"
     },
     {
      "letra": "C",
      "texto": "botón «Compartir» dentro del recuadro «Estás eligiendo»"
     }
    ],
    "rec": "B",
    "porque": "B: se ve sin bajar, en el celular y en la compu, y no suma otro botón a la columna."
   },
   {
    "id": "4.2",
    "pregunta": "Vista previa en WhatsApp (#97, parte 2): ¿qué tarjeta le llega al cliente con el link? Hoy es la misma tarjeta genérica para cualquier producto.",
    "opciones": [
     {
      "letra": "A",
      "texto": "como hoy, la tarjeta genérica (preview.png, «Stock y precios en tiempo real»)"
     },
     {
      "letra": "B",
      "texto": "página chica por fila con la foto propia del producto, el modelo y la versión con el color de esa fila; sin precio (la foto cuadrada WhatsApp suele mostrarla chica, al costado)"
     },
     {
      "letra": "C",
      "texto": "lo mismo que B, más una imagen de 1200x630 armada por fila con la foto y el nombre, sin precio; se ve grande pero son 757 imágenes por PUBLICAR"
     }
    ],
    "rec": "B",
    "porque": "B, pero después de la 5: sin ese arreglo, un link con buena vista previa puede terminar en la portada sin ningún aviso."
   },
   {
    "id": "4.3",
    "pregunta": "Todas las versiones juntas (#35): el iPhone 17 Pro tiene 18 filas (8 con stock, 10 agotadas) y para ver precio y stock de cada una hay que tocar memoria, versión y color de a una.",
    "opciones": [
     {
      "letra": "A",
      "texto": "desplegable «Ver las 18 versiones» con un renglón por fila (memoria · versión · color, precio, stock), primero lo que tiene stock y después por precio; tocar un renglón la elige"
     },
     {
      "letra": "B",
      "texto": "sin componente nuevo, sólo tachar en la tira los colores sin stock"
     },
     {
      "letra": "C",
      "texto": "la misma lista de A, partida por memoria como las pestañas"
     }
    ],
    "rec": "C",
    "porque": "C: se lee como se pregunta («¿el de 512 azul?») y cada memoria muestra sus precios juntos. Arranca cerrada y sólo en modelos con 6 versiones o más (26 hoy)."
   },
   {
    "id": "4.4",
    "pregunta": "Foto grande (#53): la foto de la ficha no se puede agrandar; en la compu se ve a unos 330 px y la foto mide 900.",
    "opciones": [
     {
      "letra": "A",
      "texto": "como hoy (en el celular ya se puede pellizcar la página)"
     },
     {
      "letra": "B",
      "texto": "visor a pantalla completa en compu y celular: lupa en la foto, fondo claro de la ficha, se cierra con la X, tocando afuera o con Esc; sin galería"
     },
     {
      "letra": "C",
      "texto": "el visor de B sólo en la compu; en el celular queda como hoy"
     }
    ],
    "rec": "B",
    "porque": "B: el mismo gesto en los dos, y en la compu la foto pasa de 330 a 900 px."
   },
   {
    "id": "4.5",
    "pregunta": "Link a un producto que ya no está (#95): de los 152 links viejos que hoy no abren nada, 143 se arreglan solos sin cambiar nada visible (ID viejo, que CATALOGO.ids lleva al producto; por ejemplo #p=NB-APP-104 abre el MacBook Neo). ¿Qué aviso se muestra en los 9 de productos dados de baja?",
    "opciones": [
     {
      "letra": "A",
      "texto": "franja arriba del catálogo, «Ese producto ya no está en el catálogo.», con «Buscar otro» y una X"
     },
     {
      "letra": "B",
      "texto": "ventanita en el lugar de la ficha, «Ya no está», con «Escribinos por WhatsApp» (el mensaje del botón flotante) y «Ver el catálogo»"
     },
     {
      "letra": "C",
      "texto": "cartelito abajo que se va solo a los 6 segundos"
     }
    ],
    "rec": "B",
    "porque": "B: aparece justo donde el cliente esperaba la ficha y le deja escribir sin buscar el número. En las tres opciones se saca el #p= de la dirección."
   }
  ]
 },
 {
  "n": 5,
  "archivo": "pedido.html",
  "titulo": "El pedido, a elegir",
  "items": [
   {
    "id": "5.1",
    "pregunta": "Hallazgo #98. Del pedido a la ficha: hoy la foto y el nombre del pedido no hacen nada; en las tres opciones se pueden tocar y abren la ficha en la versión y el color de esa línea (512GB · Orange). ¿Cómo se nota que se pueden tocar?",
    "opciones": [
     {
      "letra": "A",
      "texto": "se tocan, sin nada nuevo a la vista (en la compu el nombre se subraya al pasar el mouse; en el celular nada lo avisa)"
     },
     {
      "letra": "B",
      "texto": "con un renglón «Cambiar versión o color ›», solo en los productos que tienen algo para cambiar (el iPhone sí; los AirPods y la Xbox no, aunque igual abren su ficha)"
     },
     {
      "letra": "C",
      "texto": "con una flechita › al costado de cada producto, como en una lista del celular"
     }
    ],
    "rec": "B",
    "porque": "B: en el celular, si no lo dice nadie lo toca, y aparece solo donde hay algo para cambiar."
   },
   {
    "id": "5.2",
    "pregunta": "Hallazgo #98. La ficha no sabe lo que ya cargaste: con el iPhone 17 Pro de 512GB en el pedido, la tarjeta lo marca como agregado, pero la ficha abre en 256GB y dice «Agregar al pedido». Si se toca, quedan dos iPhone 17 Pro. ¿Qué muestra la ficha?",
    "opciones": [
     {
      "letra": "A",
      "texto": "Hoy (referencia): «Agregar al pedido», sin ningún aviso"
     },
     {
      "letra": "A",
      "texto": "avisa «Ya tenés en el pedido: 512GB E-Sim · Orange ×1» y el botón pasa a «Agregar también»"
     },
     {
      "letra": "B",
      "texto": "lo mismo que A, más «Cambiar por esta», que reemplaza la línea, conserva las unidades y usa el color de la versión nueva (solo cuando hay una sola versión cargada)"
     },
     {
      "letra": "C",
      "texto": "B más un punto violeta en la pestaña de la memoria que está cargada"
     }
    ],
    "rec": "B",
    "porque": "B: avisa y lo resuelve en un toque; al lado del aviso, el punto de C casi no suma."
   },
   {
    "id": "5.3",
    "pregunta": "Hallazgo #96. Retiro o envío en el mismo mensaje: hoy el mensaje del pedido lleva solo la lista y el total. ¿Sumamos datos opcionales? Sin tocar nada, el mensaje sale igual que hoy.",
    "opciones": [
     {
      "letra": "A",
      "texto": "Hoy (referencia): la ventana no pregunta nada"
     },
     {
      "letra": "A",
      "texto": "dos botones opcionales, «Retiro en CABA» / «Envío», y si elige envío, un campo «Localidad». Al mensaje se le agrega un renglón: «Lo retiro en CABA.» o «Me lo mandan a Rosario?»"
     },
     {
      "letra": "B",
      "texto": "A más un selector opcional de forma de pago con las cinco opciones copiadas tal cual de las preguntas frecuentes. El total no cambia y queda un hueco visible «[Pedro completa: qué dice acá sobre el recargo, si dice algo]»"
     },
     {
      "letra": "D",
      "texto": "Ninguna: queda como hoy"
     }
    ],
    "rec": "A",
    "porque": "A: saber si es retiro o envío ayuda a cotizar el envío; la forma de pago, con sus recargos, conviene dejarla para el chat."
   },
   {
    "id": "5.4",
    "pregunta": "Hallazgo #91. «Vaciar» borra todo de un toque: está pegado a «Enviar por WhatsApp», tiene el mismo tamaño y borra el pedido entero sin preguntar y sin forma de volver atrás, ni siquiera recargando.",
    "opciones": [
     {
      "letra": "A",
      "texto": "Hoy (referencia): un toque y el pedido desaparece"
     },
     {
      "letra": "A",
      "texto": "vacía de una, pero deja «Vaciaste el pedido. [Deshacer]» mientras la ventana siga abierta, sin temporizador"
     },
     {
      "letra": "B",
      "texto": "igual que A, y además «Vaciar» pasa a ser un link chico abajo («Vaciar el pedido») y «Enviar por WhatsApp» ocupa todo el ancho"
     },
     {
      "letra": "C",
      "texto": "pregunta dentro de la misma ventana, «¿Vaciamos todo el pedido? Se borran los 3 productos.» [No] [Sí, vaciar], y después de «Sí» no hay deshacer"
     }
    ],
    "rec": "B",
    "porque": "B: no le suma pasos al que vacía a propósito, y «Vaciar» deja de estar pegado a «Enviar»."
   }
  ]
 },
 {
  "n": 6,
  "archivo": "identidad.html",
  "titulo": "Identidad y legibilidad",
  "items": [
   {
    "id": "6.1",
    "pregunta": "¿Qué ícono lleva la pestaña y el inicio del celular? (#203)",
    "opciones": [
     {
      "letra": "A",
      "texto": "el de hoy, el PNG del logo (línea finita, sin fondo). En la pestaña oscura casi no se ve"
     },
     {
      "letra": "B",
      "texto": "el mismo triángulo en blanco sobre el grafito #151220 de la barra de arriba, con trazo más grueso en 16 y 32 px"
     },
     {
      "letra": "C",
      "texto": "el mismo triángulo en blanco sobre el morado #7C3AED"
     }
    ],
    "rec": "B",
    "porque": "B: se ve en la pestaña clara y en la oscura, y usa el grafito que ya tiene el sitio sin sumar colores."
   },
   {
    "id": "6.2",
    "pregunta": "¿De qué color pinta el celular la barra del navegador? (theme-color, #138)",
    "opciones": [
     {
      "letra": "A",
      "texto": "blanco #FFFFFF, como hoy. Al abrir queda un corte contra la barra grafito"
     },
     {
      "letra": "B",
      "texto": "lila #F4EFFD fijo. Sin corte al bajar; al abrir el corte sigue, pero en lila"
     },
     {
      "letra": "C",
      "texto": "cambia sola: grafito #151220 mientras se ve la barra de arriba y lila cuando queda pegada la cinta de rubros"
     }
    ],
    "rec": "C",
    "porque": "C: la barra sigue a la página en los dos momentos. Hay que mirarlo en un celular de verdad; si parpadea al bajar, B."
   },
   {
    "id": "6.3",
    "pregunta": "¿Con qué letra va el título de portada «Elegí un rubro»? (#122)",
    "opciones": [
     {
      "letra": "A",
      "texto": "la de hoy, letra del sistema en negrita en el celular y en pantallas de menos de 1180 px"
     },
     {
      "letra": "B",
      "texto": "Lilita sin mayúsculas en todos los anchos (27 px en la compu, 22 en el celular), como ya se ve en la compu grande"
     },
     {
      "letra": "C",
      "texto": "Lilita en mayúsculas, igual que los demás títulos de la portada"
     }
    ],
    "rec": "B",
    "porque": "B: arregla el error y la compu grande queda como se ve hoy."
   },
   {
    "id": "6.4",
    "pregunta": "¿Qué tono lleva el texto tenue (--faint)? (#121)",
    "opciones": [
     {
      "letra": "A",
      "texto": "#867AA6, el de hoy, con la versión agotada semitransparente (da entre 1,8 y 3,9 de contraste)"
     },
     {
      "letra": "B",
      "texto": "#726496, un poco más oscuro, y #6B5F8C sobre el lila del mundo grande. La versión agotada deja de ser transparente"
     },
     {
      "letra": "C",
      "texto": "#6B5F8C en todos lados. Cumple, pero queda casi igual al gris del texto normal"
     }
    ],
    "rec": "B",
    "porque": "B: se lee bien en todos lados y el tenue sigue distinto del texto normal."
   },
   {
    "id": "6.5",
    "pregunta": "¿Qué verde lleva «En stock», el regalo y «Agregado»? (#137)",
    "opciones": [
     {
      "letra": "A",
      "texto": "#0F8A5F, el de hoy (contraste de 3,7 a 4,4)"
     },
     {
      "letra": "B",
      "texto": "#0A7050, el mismo verde un poco más hondo (contraste de 5,0 a 6,1)"
     }
    ],
    "rec": "B",
    "porque": "B: no cambia lo que significa el color y se lee mejor. El verificador dice que no hace falta que decida Pedro; se muestra porque cambia el tono."
   },
   {
    "id": "6.6",
    "pregunta": "¿Cómo agrandamos los botones para el dedo en pantallas táctiles? (#130)",
    "opciones": [
     {
      "letra": "A",
      "texto": "como hoy: puntitos de 8 px, + y WhatsApp de 36, contador del pedido de 26"
     },
     {
      "letra": "B",
      "texto": "más zona que responde al toque con el mismo dibujo: puntitos de 24, tarjeta de 43×44, contador del pedido de 40, sin que se pisen"
     },
     {
      "letra": "C",
      "texto": "agrandar también lo que se ve: botones de 44, contadores de 36 a 40 y puntitos más grandes"
     }
    ],
    "rec": "B",
    "porque": "B: se toca mejor y no cambia nada del diseño que ya aprobó."
   },
   {
    "id": "6.7",
    "pregunta": "¿Qué dice el pie de la página? (#202)",
    "opciones": [
     {
      "letra": "A",
      "texto": "como hoy, solo la cotización y «Precios sujetos a cambio»"
     },
     {
      "letra": "B",
      "texto": "una línea de contacto: Advance Tecno · Av. De los Incas 5150, 1A, CABA · Ver en mapa · WhatsApp +54 9 11 2262-0770 · Atención con cita previa. Todo sale de la configuración que ya existe"
     },
     {
      "letra": "C",
      "texto": "un pie en tres columnas que suma horario, Instagram y razón social, hoy marcados como [Pedro completa]"
     }
    ],
    "rec": "B",
    "porque": "B ahora, porque todo sale de lo que ya está cargado. C cuando Pedro pase horario, redes y razón social."
   },
   {
    "id": "6.8",
    "pregunta": "¿Cómo se nombran los productos en «Buscá por marca» y en «También te puede interesar»? (#86)",
    "opciones": [
     {
      "letra": "A",
      "texto": "como hoy, el nombre cortado. Aparecen tres «Drone DJI Mini 5 Pro» y dos «AirPods 4» con distinto precio"
     },
     {
      "letra": "B",
      "texto": "como la tarjeta: el modelo y abajo la línea técnica (la opción B del 26/09)"
     },
     {
      "letra": "C",
      "texto": "solo el modelo, y la línea técnica únicamente cuando dos de la misma tira se llaman igual"
     }
    ],
    "rec": "B",
    "porque": "B: la portada dice lo mismo que la tarjeta y ningún producto tiene dos nombres."
   },
   {
    "id": "6.9",
    "pregunta": "¿Qué muestra la tira «Lo último de <marca>» y cómo se rotula? (#104)",
    "opciones": [
     {
      "letra": "A",
      "texto": "como hoy, ordenada por número de código. En Canon y Sony salen 14 objetivos y ninguna cámara"
     },
     {
      "letra": "B",
      "texto": "orden arreglado: primero lo que entró después del 10/09 y después un producto de cada rubro por turno. El rótulo queda igual"
     },
     {
      "letra": "C",
      "texto": "el mismo orden que B, y dice «Lo último de» solo si la tira arranca con algo posterior al 10/09. Si no, «De Canon»"
     }
    ],
    "rec": "C",
    "porque": "C: aparecen las cámaras y el rótulo no anuncia como nuevo algo que no lo es."
   }
  ]
 },
 {
  "n": 7,
  "archivo": "pruebas.html",
  "titulo": "Fallas nuevas y conocidas",
  "items": [
   {
    "id": "7.1",
    "pregunta": "El resumen de las pruebas en la terminal (PROBAR y PUBLICAR). Hoy sale una línea por tanda y solo los 3 primeros casos de cada falla: detrás de la línea del código hay 51 filas (2 nuevas, 14 ya pedidas y 35 que no cuentan) y no hay forma de verlo.",
    "opciones": [
     {
      "letra": "A",
      "texto": "Como hoy. Tal cual salió a las 02:31: lo viejo y lo nuevo en la misma línea, con 'RESULTADO: 2 comprobacion(es) fallaron'."
     },
     {
      "letra": "B",
      "texto": "Tres grupos, fila por fila. La lista de tandas queda igual arriba y al final se agregan NUEVAS / CONOCIDAS / ARREGLADAS, cada fila con su ID, lo que dice la columna, lo que dice el mapa y la fecha del pedido."
     },
     {
      "letra": "C",
      "texto": "Tres grupos, las conocidas agrupadas por pedido. Arriba va solo lo que falla. Las nuevas van fila por fila con el nombre del producto; las conocidas, una línea por pedido con los días que lleva ('11 iPhone 17 Pro (Sim y eSIM) - ADVAPP, pedido el 26/09 (hace 3 dias)'). El detalle queda en pruebas/conocidas.json. Todas las líneas tienen 50 caracteres o menos."
     }
    ],
    "rec": "C",
    "porque": "C: entra en una pantalla, se lee también a ancho de celular y lo nuevo es lo primero que se ve, sin perder el detalle."
   },
   {
    "id": "7.2",
    "pregunta": "Cuándo pregunta PUBLICAR '¿Publicar igual?'. Hoy pregunta siempre que algo falla, aunque ya esté pedido, y de tanto contestar S se contesta S también el día que aparece algo nuevo.",
    "opciones": [
     {
      "letra": "A",
      "texto": "Como hoy. Pregunta siempre, con el mismo cartel haya nuevas o no."
     },
     {
      "letra": "B",
      "texto": "Pregunta solo por lo nuevo. Si lo único que falla son conocidas, las recuerda en dos líneas ('la mas vieja, pedida el 21/09: hace 8 dias') y sigue a 'Publicar estos cambios?' como cualquier día."
     },
     {
      "letra": "C",
      "texto": "Igual que B, pero cuando hay nuevas no alcanza con apretar una tecla: para publicar igual hay que escribir la palabra PUBLICAR."
     }
    ],
    "rec": "B",
    "porque": "B: la pregunta vuelve a ser rara y por eso se lee; el paso extra de C deja de hacer falta."
   },
   {
    "id": "7.3",
    "pregunta": "El aviso de las 14:00 (la notificación de la Mac y el archivo del Escritorio). Hoy cuenta todas las pruebas que fallan: el 27/09 dijo 2 y el 28/09 dijo 4, y nada indicaba que 2 eran nuevas.",
    "opciones": [
     {
      "letra": "A",
      "texto": "Como hoy. '2 prueba(s) de la pagina fallan'. En el archivo, cada falla es una línea cortada a 160 caracteres, así que el tercer ID queda en 'AT-00'."
     },
     {
      "letra": "B",
      "texto": "Cuenta solo lo nuevo. La notificación dice '2 falla(s) NUEVAS en la pagina'. En el archivo va '[pagina] NUEVA' con cada ID, y al final una sección 'YA PEDIDO, ESPERANDO RESPUESTA' agrupada por pedido y con la fecha."
     },
     {
      "letra": "C",
      "texto": "Igual que B, y además avisa 'Reclamar a ADVAPP: 3 fila(s) pedidas hace 8 dias' cuando algo pedido lleva más de 7 días sin respuesta. Las conocidas más recientes aparecen solo con el número."
     }
    ],
    "rec": "C",
    "porque": "C: lo nuevo te frena y lo que se pidió hace mucho te recuerda reclamar; los 7 días los elige Pedro."
   },
   {
    "id": "7.4",
    "pregunta": "Quién anota una falla como conocida, que es lo que hace que deje de frenar.",
    "opciones": [
     {
      "letra": "A",
      "texto": "Se anota sola si la fila figura en herramientas/pedidos-advapp.json. Con los datos de hoy se equivoca dos veces: el Watch Ultra 3 Black Ocean saldría como NUEVO todos los días (se pidió a mano en PEDIDO-ADVAPP-26-09.txt y no está en el registro), y el MacBook Air 24/512 Midnight pasaría como pedido, aunque el 21/09 se le pidió otra cosa (su código de color)."
     },
     {
      "letra": "B",
      "texto": "Se anota a mano con un comando. Cada nueva muestra cómo anotarla ('python3 pruebas/correr.py --conocida CLAVE --a ADVAPP --pedido ...', con la CLAVE tanda|comprobación|ID), y lo corre Claude cuando se le pasa la falla."
     }
    ],
    "rec": "B",
    "porque": "B: una falla deja de frenar solo cuando alguien confirma que se pidió."
   }
  ]
 }
];
