# Entrevista de práctica

Simulador de entrevista laboral para gente que busca su primer trabajo. Ocho preguntas con formato de entrevista estructurada, repreguntas cuando la respuesta viene vaga, y devolución final por competencia.

Next.js 15 (App Router). Sin base de datos: nada se guarda en el servidor.

---

## Cómo subirlo a Vercel

**1. Conseguí una clave de API**

Entrá a [console.anthropic.com](https://console.anthropic.com), creá una API key y cargá crédito. Es una cuenta distinta de la de claude.ai y se paga por uso.

**2. Subí el código a GitHub**

```bash
cd entrevista-de-practica
git init
git add .
git commit -m "primera versión"
```

Creá un repo vacío en GitHub y seguí las instrucciones que te da para conectarlo.

**3. Importá el proyecto en Vercel**

En [vercel.com/new](https://vercel.com/new), elegí el repo. Vercel detecta Next.js solo: no toques nada de la configuración de build.

**4. Cargá la variable de entorno**

Antes de darle Deploy, abrí **Environment Variables** y agregá:

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | tu clave |

Marcá los tres entornos (Production, Preview, Development).

**5. Deploy**

En un minuto tenés una URL tipo `entrevista-de-practica.vercel.app`. Ese es el link que compartís: se abre en cualquier navegador, sin cuenta y sin instalar nada.

Si querés un dominio propio, se agrega desde **Settings → Domains**.

---

## Correrlo en tu compu

```bash
npm install
cp .env.example .env.local   # y pegá tu clave adentro
npm run dev
```

Abre en http://localhost:3000

---

## Lo que tenés que saber antes de compartirlo

**La clave nunca llega al navegador.** El front no habla con Anthropic: le pega a `/api/claude`, que corre en el servidor de Vercel y ahí sí usa la clave. Por eso hay una carpeta `app/api` y no se puede saltear. Si alguna vez ves una variable con prefijo `NEXT_PUBLIC_`, esa sí queda expuesta: la clave no va nunca ahí.

**Cada entrevista te cuesta plata.** Una entrevista completa son unas once llamadas a la API. Con Sonnet quedan centavos por persona, pero se multiplica por cuánta gente entre. Poné un límite de gasto mensual en la consola de Anthropic (Settings → Limits) antes de difundir el link, así no hay sorpresas.

Si el volumen es alto y querés bajar el costo, cambiá el modelo por Haiku agregando la variable `CLAUDE_MODEL=claude-haiku-4-5-20251001`. Las preguntas salen algo menos afinadas, pero el ejercicio funciona igual.

**El endpoint es público.** Cualquiera que encuentre la URL puede usarlo. Hay tres defensas puestas:

- El navegador no puede elegir el prompt. Manda solo `tipo` y datos; los prompts viven en `lib/prompts.js`, que solo corre en el servidor. Nadie puede usar tu clave como un Claude genérico.
- Hay límites de tamaño en todo lo que entra.
- Hay un rate limit por IP en `app/api/claude/route.js`. Es best-effort: en serverless la memoria no se comparte entre instancias, así que frena lo obvio y poco más.

Para algo más firme, en Vercel podés activar **Firewall → Bot protection** (Settings → Security), o mover el rate limit a Vercel KV.

**Datos personales.** No se guarda nada: ni base de datos, ni cookies, ni logs de respuestas. Las respuestas viven en la memoria de la pestaña y se pierden al cerrarla. Por eso la devolución tiene botón de copiar y de descargar. Las respuestas sí pasan por la API de Anthropic para ser procesadas.

**Menores de edad.** Si el link va a circular entre chicos de 16 o 17, revisá los términos de uso de la API y qué te pide la normativa de datos de menores antes de difundirlo.

---

## Dónde tocar qué

| Querés cambiar | Archivo |
|---|---|
| Las 8 competencias, el orden, los puestos | `lib/plan.js` |
| Cómo pregunta y cómo evalúa | `lib/prompts.js` |
| Límites, rate limit, modelo | `app/api/claude/route.js` |
| Toda la interfaz y los textos | `app/page.js` |

Después de cambiar algo: `git add . && git commit -m "..." && git push`. Vercel redeploya solo.
