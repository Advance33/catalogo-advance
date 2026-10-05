# datos/usados.json — los valores de toma de usados

Este archivo es lo que usa **Cotizá tu usado**: el cliente entrega un equipo
usado como parte de pago y la web le dice en el momento cuánto vale (Pedro,
05/10/2026; eligió 1B 2A 3A 5A del muestrario de usados). Aparece en la
ficha de cada producto con stock (**🔁 Entregar mi usado**), en el pedido
(**¿Entregás un usado?**) y en Preguntas frecuentes (**¿Toman mi usado como
parte de pago?**, con "Cotizar mi usado"). En el resto de la portada no va
nada (Pedro eligió la G, 05/10).

## Reglas que no se discuten

1. **Los valores y las condiciones son los de Pedro, tal cual.** Él manda la
   lista y se sube sin redondear, sin completar huecos y sin agregar
   modelos ("pasamelo a mí siempre", 05/10). Un valor que no está en su
   lista no se inventa.
2. **Lo que no está en la lista no se toma.** El cotizador lo dice ("Por
   ahora tomamos sólo estos modelos") y no ofrece nada más.
3. **El valor es "si cumple todas las condiciones".** La batería por debajo
   del umbral resta lo que dice `bateria.resta`. Si cualquier otra
   condición no se cumple, no se muestra ningún número: "Mandanos los
   detalles" y el botón "Enviar los detalles por WhatsApp", con un mensaje
   que termina en "Te paso los detalles:" (Pedro, 05/10; antes decía "Lo
   revisamos en persona").
4. Si el usado vale más que lo que compra, la web dice **"Te queda a favor
   USD X"** y se coordina por WhatsApp.
5. **Lo que Pedro toma pero todavía no tiene lista** (05/10: "lo de Apple,
   Samsung o MacBook") va en `USADOS_OTROS` de `index.html`: el cotizador
   ofrece **"Otro equipo"**, sin valor, que lleva a mandar los detalles por
   WhatsApp, y la pregunta frecuente lo nombra. Cuando llegue la lista de
   alguno, se carga acá como un equipo más y se saca de `USADOS_OTROS`.

## Cómo lo usa la web

- Lo pide al arrancar, con un tope de 6 s (`USADOS_ESPERA_MS` en
  `index.html`). Si no llega o no cumple el formato, no aparece ni el botón
  ni la pregunta del pedido: la página sigue igual que antes.
- La cotización del cliente queda guardada en su navegador
  (`advtecno.usado`), aparte del pedido. Si Pedro saca un modelo o una
  memoria de la lista, la cotización guardada deja de valer sola.
- El mensaje de WhatsApp dice el modelo, la memoria (o la caja), la
  batería, si cumple todo o qué no cumple, y el valor.

## El formato

```json
{
  "formato": "usados/1",
  "actualizado": "2026-10-05",
  "equipos": [
    {
      "id": "iphone",
      "nombre": "iPhone",
      "pregunta_opcion": "¿Cuánta memoria tiene?",
      "bateria": { "umbral": 80, "resta": 20 },
      "condiciones": [ { "id": "pantalla", "texto": "Pantalla y vidrios sin roturas" } ],
      "grupos": [
        { "nombre": "iPhone 13", "modelos": [
          { "id": "iphone-13", "nombre": "iPhone 13", "opciones": [
            { "nombre": "128GB", "usd": 220 } ] } ] }
      ]
    }
  ]
}
```

- `equipos`: uno por botón del primer paso (hoy iPhone y PlayStation).
- `pregunta_opcion`: la pregunta del paso de las opciones (memoria, caja).
- `bateria`: opcional. Sin ella no hay paso de batería.
- `condiciones`: cada una se contesta Sí / No. Con un No, sin número.
- `grupos`: los renglones del paso del modelo, en el orden en que se
  muestran (el más nuevo arriba).
- `opciones`: `usd` es un número entero en dólares (`220`, no `"220"` ni
  `"U$220"`). Una opción con un valor que no es un número no se muestra, y
  la prueba `pruebas/decision-usados.js` no deja publicarlo.
- Los `id` no se cambian una vez publicados: son los que quedan guardados
  en el navegador del cliente y los que llegan a la medición.

## Para cambiar un valor

1. Pedro pasa la lista nueva (una foto o el texto, como el 05/10).
2. Se cambia el número en este archivo y `actualizado` con la fecha.
3. Se corre `python3 pruebas/correr.py` (la tanda `decision-usados` revisa
   el archivo) y se publica.
