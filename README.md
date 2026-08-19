# Entrevista de práctica

Simulador de entrevista laboral para gente que busca su primer trabajo. Ocho preguntas con formato de entrevista estructurada, repregunta cuando la respuesta viene muy corta, y al final una revisión de lo que quedó afuera.

Se puede hacer hablando: lee las preguntas en voz alta y las respuestas se pueden dictar. También funciona entera escribiendo.

**No necesita ninguna clave de API.** Todo corre en el navegador: las preguntas están escritas en el código y la revisión final es un análisis de texto local. No hay backend, no hay base de datos y no se llama a ningún servicio externo.

Next.js 15 (App Router), sitio estático.

---

## Correrlo en tu compu

```bash
npm install
npm run dev
```

Abre en http://localhost:3000. No hay nada que configurar antes.

---

## Cómo subirlo

```bash
git push
```

Si el repo está conectado a Vercel, se despliega solo. Si lo importás por primera vez en [vercel.com/new](https://vercel.com/new), Vercel detecta Next.js y no hay que tocar nada de la configuración de build ni cargar variables de entorno.

Sirve cualquier hosting de estáticos, no solo Vercel.

---

## Qué hace y qué no

**Las preguntas son fijas.** Las mismas ocho, en el mismo orden, para todos. Eso es a propósito: así funciona una entrevista estructurada de verdad. El campo del aviso laboral es solo una referencia para que la persona lo tenga a la vista mientras practica; no cambia las preguntas.

**La repregunta es una regla, no un criterio.** Si la respuesta tiene menos de `MIN_CARACTERES`, aparece una repregunta escrita de antemano. Sale una sola vez por pregunta: después se avanza sí o sí, así que nunca salen dos seguidas. Las dos partes se guardan como una sola respuesta.

**La revisión final no es una evaluación.** Busca palabras clave en el texto que la persona escribió y marca si aparecen ciertas señales: contexto, acción propia, resultado, aprendizaje. Nada más. Una respuesta buena escrita con otras palabras le pasa por al lado, y lo dice en pantalla con todas las letras. Está en `lib/revision.js` y se puede ajustar.

El marco situación / acción / resultado / aprendizaje se aplica solo a las preguntas que piden contar algo que ya pasó. En las que arrancan con "imaginate" no hay historia real que contar, así que ahí se mira otra cosa.

**No inventa nada.** La devolución solo puede señalar qué aparece y qué no aparece en lo escrito. No reescribe respuestas ni completa lo que falta.

---

## La voz

Dos cosas separadas, las dos ya vienen en el navegador.

**Leer en voz alta.** Botón para escuchar cada pregunta, más una casilla para que se lean solas. Al final también se puede escuchar la devolución. Anda en todos los navegadores.

**Contestar hablando.** Botón de micrófono debajo del campo: lo que se dice se va escribiendo, y siempre se puede corregir a mano. Necesita Chrome, Edge o Safari. **En Firefox no existe**, y en ese caso la app lo dice y deja escribir normalmente.

Los dos se apagan entre sí: mientras el micrófono está abierto no se lee nada en voz alta, así no se escucha a sí misma.

**Dónde va a parar el audio.** Es la única parte que sale del dispositivo. El dictado no lo hace la app, lo hace el navegador, y Chrome manda el audio a los servidores de Google para transcribirlo (Safari, a los de Apple). Escribiendo, el audio no existe.

El acento se elige solo: rioplatense primero, después el resto de América Latina, España al final. Depende de las voces que tenga instaladas el sistema de cada persona.

---

## Datos personales

No se guarda nada: ni base de datos, ni cookies, ni servidor que reciba las respuestas. Viven en la memoria de la pestaña y se pierden al cerrarla. Por eso la devolución tiene botón de copiar y de descargar.

Como no hay backend ni clave de API, no hay costo por uso ni endpoint que alguien pueda abusar. El link se puede repartir sin más.

---

## Dónde tocar qué

| Querés cambiar | Archivo |
|---|---|
| Las 8 preguntas, repreguntas, pistas y puestos | `lib/plan.js` |
| Cómo se revisan las respuestas al final | `lib/revision.js` |
| La voz: acento, velocidad, dictado | `lib/voz.js` |
| Toda la interfaz y los textos | `app/page.js` |

---

Competencias adaptadas de las Career Readiness Competencies del National Association of Colleges and Employers (NACE). Formato de entrevista estructurada y preguntas conductuales y situacionales según la guía de structured interviews de la U.S. Office of Personnel Management. Esquema de respuesta situación / acción / resultado / aprendizaje, Columbia University Center for Career Education.
