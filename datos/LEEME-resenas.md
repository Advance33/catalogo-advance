# datos/resenas.json — las reseñas de Google

Este archivo es lo que usa el bloque **Reseñas en Google** de la portada y el
sello del encabezado ("★ 4,9 · 469 reseñas en Google"). Benja lo pidió el
13/10/2026: "que se vean nuestras reseñas en Google".

Sale de la ficha del negocio en Google Maps (Advance Tecno, Av. de los Incas
5150; el identificador de la ficha va en `lugar`).

## Reglas que no se discuten

1. **Las reseñas se copian tal cual.** El texto, el nombre y las estrellas son
   los que están en Google: no se corrige la ortografía del cliente, no se
   recorta, no se traduce y no se le cambia el nombre. La web las muestra
   enteras (las largas, con "Leer completa").
2. **Ninguna reseña se escribe acá.** Si no está en Google, no va.
3. **El puntaje y la cantidad son los de la ficha** el día que se leyó
   (`leido`). No se redondean para arriba.
4. **Cuáles se muestran lo decide Benja.** El 13/10 se cargaron las cinco que
   Google muestra primero; el 20/10 se sacó una y quedaron cuatro. Para cambiar
   una, se saca del archivo y se pone otra de la ficha, completa.
5. **Solo se muestran las de 5 estrellas** (Benja, 19/10/2026: "¿también se
   pueden evitar las malas?"). La web saltea sola una de 4 o menos aunque
   esté en el archivo. El puntaje y la cantidad de arriba siguen siendo los
   de la ficha de Google, con todas las reseñas.
6. **No va una reseña que nombra a alguien que ya no atiende en Advance**
   (20/10/2026), aunque sea de 5 estrellas: al cambiar o sumar reseñas, leer
   el texto entero antes de copiarla.

## Formato (`resenas/1`)

```json
{
  "formato": "resenas/1",
  "leido": "2026-10-13",
  "lugar": "el identificador de la ficha en Google",
  "puntaje": 4.9,
  "cantidad": 469,
  "ver": "https://search.google.com/local/reviews?placeid=…",
  "escribir": "https://search.google.com/local/writereview?placeid=…",
  "resenas": [
    { "autor": "Nombre como figura en Google", "estrellas": 5, "texto": "La reseña entera" }
  ]
}
```

- `puntaje` de 1 a 5, `cantidad` entero, `ver` un link de google.com: si
  alguno falta o viene mal, la web no muestra ni el bloque ni el sello (ver
  `validarResenas` en `index.html`).
- Una reseña sin autor, sin texto o con estrellas que no sean un entero de 1 a
  5 se saltea sola. Se muestran hasta 12.
- `escribir` es opcional: el link de Google para dejar una reseña. Con él
  aparece el botón **Dejá tu reseña** (Benja, 13/10); sin él, o si no es de
  google.com, no aparece.

## Cómo se actualiza

A mano, por ahora: se abre la ficha de Google, se anotan el puntaje y la
cantidad, y se cambia `leido`. El número queda viejo si no se toca (siempre
para menos: las reseñas crecen).

Para que se actualice solo hace falta la API oficial de Google (Places), con
una llave que crea Benja en su cuenta de Google Cloud y que no puede ir en
este repositorio, que es público. Está pendiente de que él lo decida.
