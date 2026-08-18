import { NextResponse } from "next/server";
import { PLAN, labelPuesto } from "@/lib/plan";
import {
  sistemaEntrevistadora,
  SISTEMA_PISTA,
  SISTEMA_COMPETENCIAS,
  SISTEMA_SARA,
} from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";

// Límites de tamaño. Cortan tanto los errores honestos como los abusos.
const LIM = {
  aviso: 2000,
  nombre: 60,
  respuesta: 4000,
  mensajes: 30,
  transcript: 20,
};

// Rate limit best-effort. En serverless la memoria no es compartida entre
// instancias, así que esto frena lo obvio pero no reemplaza un límite real.
// Si el proyecto crece, moverlo a Vercel KV o Upstash.
const VENTANA_MS = 10 * 60 * 1000;
const MAX_PEDIDOS = 60;
const visitas = new Map();

function pasaRateLimit(ip) {
  const ahora = Date.now();
  const previas = (visitas.get(ip) || []).filter((t) => ahora - t < VENTANA_MS);
  if (previas.length >= MAX_PEDIDOS) {
    visitas.set(ip, previas);
    return false;
  }
  previas.push(ahora);
  visitas.set(ip, previas);
  if (visitas.size > 5000) visitas.clear();
  return true;
}

function texto(v, max) {
  return typeof v === "string" ? v.slice(0, max) : "";
}

function parseJSON(raw) {
  const limpio = raw.replace(/```json|```/g, "").trim();
  const ini = limpio.indexOf("{");
  const fin = limpio.lastIndexOf("}");
  if (ini === -1 || fin === -1) throw new Error("sin json");
  return JSON.parse(limpio.slice(ini, fin + 1));
}

async function llamar({ system, messages, maxTokens }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });
  if (!res.ok) {
    const detalle = await res.text();
    console.error("Anthropic error", res.status, detalle.slice(0, 400));
    throw new Error("upstream");
  }
  const data = await res.json();
  return data.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function armarTranscript(t) {
  return t
    .slice(0, LIM.transcript)
    .map(
      (x, i) =>
        `PREGUNTA ${i + 1} (${texto(x.comp, 60)}, ${texto(x.tipo, 20)}): ${texto(
          x.q,
          600
        )}\nRESPUESTA: ${texto(x.a, LIM.respuesta)}`
    )
    .join("\n\n");
}

export async function POST(req) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Falta configurar ANTHROPIC_API_KEY" },
      { status: 500 }
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconocida";
  if (!pasaRateLimit(ip)) {
    return NextResponse.json(
      { error: "Demasiados pedidos. Esperá unos minutos." },
      { status: 429 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const tipo = body?.tipo;
  const puesto = labelPuesto(body?.puesto);
  const nombre = texto(body?.nombre, LIM.nombre);
  const aviso = texto(body?.aviso, LIM.aviso);

  try {
    // ── siguiente pregunta de la entrevista ──
    if (tipo === "pregunta") {
      const idx = Math.max(0, Math.min(Number(body?.idx) || 0, PLAN.length - 1));
      const p = PLAN[idx];

      const entrantes = Array.isArray(body?.messages) ? body.messages : [];
      const messages = entrantes.slice(-LIM.mensajes).map((m) => ({
        role: m?.role === "assistant" ? "assistant" : "user",
        content: texto(m?.content, LIM.respuesta),
      }));
      if (!messages.length || messages[messages.length - 1].role !== "user") {
        return NextResponse.json({ error: "Turno inválido" }, { status: 400 });
      }

      const instruccion = `[Competencia a evaluar: ${p.comp}. Formato: ${p.tipo}. Foco: ${p.foco}. Pregunta ${idx + 1} de ${PLAN.length}.]`;
      const ultimo = messages[messages.length - 1];
      messages[messages.length - 1] = {
        ...ultimo,
        content: `${ultimo.content}\n\n${instruccion}`,
      };

      const raw = await llamar({
        system: sistemaEntrevistadora(puesto, aviso, nombre),
        messages,
        maxTokens: 400,
      });
      const r = parseJSON(raw);
      return NextResponse.json({
        accion: r.accion === "repregunta" ? "repregunta" : "nueva",
        texto: texto(r.texto, 600),
      });
    }

    // ── pista cuando se traba ──
    if (tipo === "pista") {
      const raw = await llamar({
        system: SISTEMA_PISTA,
        messages: [
          {
            role: "user",
            content: `Puesto: ${puesto}. Competencia: ${texto(body?.comp, 60)}. Formato: ${texto(body?.formato, 20)}. Pregunta: "${texto(body?.pregunta, 600)}"`,
          },
        ],
        maxTokens: 250,
      });
      return NextResponse.json({ texto: raw });
    }

    // ── evaluación por competencia ──
    if (tipo === "competencias") {
      const t = Array.isArray(body?.transcript) ? body.transcript : [];
      if (!t.length) {
        return NextResponse.json({ error: "Sin entrevista" }, { status: 400 });
      }
      const comps = [...new Set(t.map((x) => texto(x.comp, 60)))].join(", ");
      const raw = await llamar({
        system: SISTEMA_COMPETENCIAS,
        messages: [
          {
            role: "user",
            content: `Puesto: ${puesto}.${nombre ? `\nSe llama ${nombre}.` : ""}\nCompetencias evaluadas, en este orden: ${comps}.\n\nTranscripción:\n\n${armarTranscript(t)}`,
          },
        ],
        maxTokens: 1400,
      });
      return NextResponse.json(parseJSON(raw));
    }

    // ── análisis situación / acción / resultado / aprendizaje ──
    if (tipo === "sara") {
      const t = Array.isArray(body?.transcript) ? body.transcript : [];
      if (!t.length) {
        return NextResponse.json({ error: "Sin entrevista" }, { status: 400 });
      }
      const raw = await llamar({
        system: SISTEMA_SARA,
        messages: [
          {
            role: "user",
            content: `Puesto: ${puesto}.\n\n${armarTranscript(t)}`,
          },
        ],
        maxTokens: 1400,
      });
      return NextResponse.json(parseJSON(raw));
    }

    return NextResponse.json({ error: "Tipo desconocido" }, { status: 400 });
  } catch (e) {
    console.error("Fallo en /api/claude", tipo, e?.message);
    return NextResponse.json(
      { error: "No se pudo generar la respuesta" },
      { status: 502 }
    );
  }
}
