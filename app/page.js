"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  PLAN,
  PUESTOS,
  NIVELES,
  MAX_TURNOS,
  MIN_CARACTERES,
  labelPuesto,
} from "@/lib/plan";
import { useLectura, useDictado } from "@/lib/voz";

const C = {
  paper: "#FBFAF7",
  page: "#FFFFFF",
  ink: "#1B2A4A",
  inkSoft: "#5A6B8C",
  rule: "#DCE4F0",
  margin: "#D6564A",
  ok: "#2E6B54",
  okBg: "#EDF4F0",
  warnBg: "#FBF3EC",
  warn: "#A5622A",
};

const SERIF = 'Georgia, "Times New Roman", serif';

async function pedir(tipo, payload) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tipo, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "falló");
  return data;
}

export default function Page() {
  const [stage, setStage] = useState("setup");
  const [puesto, setPuesto] = useState("atencion");
  const [aviso, setAviso] = useState("");
  const [nombre, setNombre] = useState("");
  const [mostrarMarco, setMostrarMarco] = useState(true);

  const [apiMessages, setApiMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [esRepregunta, setEsRepregunta] = useState(false);
  const [planIdx, setPlanIdx] = useState(0);
  const [turno, setTurno] = useState(0);
  const [answer, setAnswer] = useState("");
  const [transcript, setTranscript] = useState([]);
  const [avisado, setAvisado] = useState(false);

  const [hint, setHint] = useState("");
  const [hintLoading, setHintLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fallo, setFallo] = useState(false);

  const [comp, setComp] = useState(null);
  const [sara, setSara] = useState(null);
  const [cargandoComp, setCargandoComp] = useState(false);
  const [cargandoSara, setCargandoSara] = useState(false);
  const [fallaComp, setFallaComp] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const [vozActiva, setVozActiva] = useState(false);

  const textareaRef = useRef(null);
  const anclaRef = useRef(null);
  const leidaRef = useRef(""); // última pregunta leída, para no repetirla

  const lectura = useLectura();

  // Lo dictado se va sumando a lo que ya haya escrito, sin pisarlo.
  const agregarDictado = useCallback((fragmento) => {
    const t = String(fragmento || "").trim();
    if (!t) return;
    setAnswer((prev) => {
      const sep = prev && !/\s$/.test(prev) ? " " : "";
      // Mayúscula al empezar y después de un punto: el dictado no la pone.
      const arranca = !prev.trim() || /[.!?…]\s*$/.test(prev);
      const txt = arranca ? t.charAt(0).toUpperCase() + t.slice(1) : t;
      return prev + sep + txt;
    });
  }, []);

  const dictado = useDictado({ onTexto: agregarDictado });

  // Al cambiar de pregunta, subir a la pregunta nueva. Sin robar el foco:
  // en el celular el teclado taparía la pregunta antes de que se lea.
  useEffect(() => {
    if (stage === "interview" && question && anclaRef.current) {
      anclaRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [question, stage]);

  function ajustarAlto() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 340) + "px";
  }

  // También corre cuando el texto entra por dictado, no solo al tipear.
  useEffect(() => {
    ajustarAlto();
  }, [answer, question]);

  // Se sacan las funciones sueltas a propósito: son estables entre renders,
  // así los efectos de abajo corren solo cuando cambia lo que importa. Si se
  // dependiera del objeto entero, cada render cortaría la lectura en curso.
  const { leer, parar: pararLectura, soportado: vozSoportada } = lectura;
  const { parar: pararDictado, limpiarError: limpiarErrorDictado } = dictado;

  // El aviso del micrófono es de la pregunta que se fue: no se arrastra.
  useEffect(() => {
    limpiarErrorDictado();
  }, [question, limpiarErrorDictado]);

  // Pregunta nueva con la voz prendida: se lee sola. El micrófono se apaga
  // antes, así no se escucha a sí misma.
  useEffect(() => {
    if (stage !== "interview" || !question) return;
    if (!vozActiva || !vozSoportada) return;
    if (leidaRef.current === question) return;
    leidaRef.current = question;
    pararDictado();
    leer(question);
  }, [question, stage, vozActiva, vozSoportada, leer, pararDictado]);

  // Al salir de la entrevista no queda nada hablando ni grabando.
  useEffect(() => {
    if (stage !== "interview") {
      pararLectura();
      pararDictado();
    }
  }, [stage, pararLectura, pararDictado]);

  function escucharPregunta() {
    if (lectura.hablando) return lectura.parar();
    dictado.parar();
    lectura.leer(question);
  }

  function alternarDictado() {
    if (dictado.grabando) return dictado.parar();
    lectura.parar();
    dictado.arrancar();
  }

  // El toggle se prende con un toque, y ese toque es el gesto que iOS exige
  // para dejar hablar al navegador. Por eso lee la pregunta ahí mismo.
  function alternarVoz() {
    if (vozActiva) {
      setVozActiva(false);
      lectura.parar();
      return;
    }
    setVozActiva(true);
    if (stage === "interview" && question) {
      leidaRef.current = question;
      dictado.parar();
      lectura.leer(question);
    }
  }

  const puestoLabel = labelPuesto(puesto);
  const actual = PLAN[Math.min(planIdx, PLAN.length - 1)];
  const cortita =
    answer.trim().length > 0 &&
    answer.trim().length < MIN_CARACTERES &&
    actual.tipo !== "apertura";

  function crecer(e) {
    setAnswer(e.target.value);
    ajustarAlto();
  }

  async function start() {
    setError("");
    setFallo(false);
    setLoading(true);
    setStage("interview");
    try {
      const msgs = [{ role: "user", content: "Arrancá la entrevista." }];
      const r = await pedir("pregunta", {
        messages: msgs,
        idx: 0,
        puesto,
        aviso,
        nombre,
      });
      setQuestion(r.texto);
      setEsRepregunta(false);
      setApiMessages([...msgs, { role: "assistant", content: r.texto }]);
      setPlanIdx(0);
      setTurno(1);
    } catch (e) {
      setError("No arrancó. Tocá de nuevo Empezar la entrevista.");
      setStage("setup");
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    const a = answer.trim();
    if (!a || loading) return;

    // Cerrar el micrófono antes de mandar: lo último dictado ya entró.
    dictado.parar();
    lectura.parar();

    // Empujón suave, una sola vez por pregunta. Nunca bloquea.
    if (cortita && !avisado && !fallo) {
      setAvisado(true);
      return;
    }

    setError("");
    setFallo(false);

    const entrada = {
      q: question,
      a,
      comp: actual.comp,
      tipo: actual.tipo,
      esRepregunta,
    };
    const nuevaTranscript = [...transcript, entrada];

    const terminada = planIdx >= PLAN.length - 1 || turno >= MAX_TURNOS;
    if (terminada) {
      setTranscript(nuevaTranscript);
      setAnswer("");
      setHint("");
      return cerrar(nuevaTranscript);
    }

    setLoading(true);
    try {
      const msgs = [...apiMessages, { role: "user", content: a }];
      const r = await pedir("pregunta", {
        messages: msgs,
        idx: Math.min(planIdx + 1, PLAN.length - 1),
        puesto,
        aviso,
        nombre,
      });
      // nunca dos repreguntas seguidas
      const avanza = r.accion !== "repregunta" || esRepregunta;
      const nuevoIdx = avanza ? planIdx + 1 : planIdx;

      // Recién acá se borra lo escrito: si falla, no se pierde nada.
      setTranscript(nuevaTranscript);
      setAnswer("");
      setHint("");
      setAvisado(false);
      setPlanIdx(nuevoIdx);
      setEsRepregunta(!avanza);
      setQuestion(r.texto);
      setApiMessages([...msgs, { role: "assistant", content: r.texto }]);
      setTurno(turno + 1);
    } catch (e) {
      setError("Se cortó la conexión. Tu respuesta quedó guardada acá abajo.");
      setFallo(true);
    } finally {
      setLoading(false);
    }
  }

  function cerrar(t) {
    setStage("feedback");
    setCargandoComp(true);
    setCargandoSara(true);
    setFallaComp(false);

    const limpia = t.map((x) => ({
      q: x.q,
      a: x.a,
      comp: x.comp,
      tipo: x.tipo,
    }));

    // Las dos evaluaciones salen en paralelo y se muestran a medida que llegan.
    pedir("competencias", { transcript: limpia, puesto, nombre })
      .then(setComp)
      .catch(() => setFallaComp(true))
      .finally(() => setCargandoComp(false));

    pedir("sara", { transcript: limpia, puesto })
      .then(setSara)
      .catch(() => {})
      .finally(() => setCargandoSara(false));
  }

  async function getHint() {
    if (hintLoading) return;
    setHintLoading(true);
    setError("");
    try {
      const r = await pedir("pista", {
        puesto,
        comp: actual.comp,
        formato: actual.tipo,
        pregunta: question,
      });
      setHint(r.texto);
    } catch (e) {
      setError("La pista no cargó. Seguí con lo que tengas.");
    } finally {
      setHintLoading(false);
    }
  }

  function armarTexto() {
    const l = [];
    l.push("ENTREVISTA DE PRÁCTICA");
    l.push(`Puesto: ${puestoLabel}`);
    if (nombre) l.push(`Nombre: ${nombre}`);
    l.push(new Date().toLocaleDateString("es-AR"));
    l.push("");

    if (comp?.competencias?.length) {
      l.push("TU NIVEL POR COMPETENCIA");
      l.push("");
      comp.competencias.forEach((c) => {
        l.push(`${c.nombre} — ${c.nivel}/4 (${NIVELES[c.nivel] || ""})`);
        if (c.evidencia) l.push(c.evidencia);
        if (c.para_subir) l.push(`Para subir: ${c.para_subir}`);
        l.push("");
      });
    }

    if (comp?.para_practicar) {
      l.push("LO QUE MÁS TE CONVIENE PRACTICAR");
      l.push(comp.para_practicar);
      l.push("");
    }

    if (sara?.analisis?.length) {
      l.push("QUÉ LE FALTÓ A CADA RESPUESTA");
      l.push("");
      sara.analisis.forEach((x) => {
        const partes = [
          x.situacion ? "Situación ok" : "falta Situación",
          x.accion ? "Acción ok" : "falta Acción",
          x.resultado ? "Resultado ok" : "falta Resultado",
          x.aprendizaje ? "Aprendizaje ok" : "falta Aprendizaje",
        ].join(" / ");
        l.push(`${x.pregunta}: ${partes}`);
        if (x.nota) l.push(x.nota);
        l.push("");
      });
    }

    if (sara?.reescritura) {
      const r = sara.reescritura;
      l.push("UNA RESPUESTA TUYA, REESCRITA");
      l.push(r.pregunta || "");
      if (r.situacion) l.push(`Situación: ${r.situacion}`);
      if (r.accion) l.push(`Acción: ${r.accion}`);
      if (r.resultado) l.push(`Resultado: ${r.resultado}`);
      if (r.aprendizaje) l.push(`Aprendizaje: ${r.aprendizaje}`);
      if (r.por_que) l.push(`Qué cambió: ${r.por_que}`);
      l.push("");
    }

    if (transcript.length) {
      l.push("TU ENTREVISTA COMPLETA");
      l.push("");
      transcript.forEach((t, i) => {
        l.push(`${i + 1}. [${t.comp}] ${t.q}`);
        l.push(t.a);
        l.push("");
      });
    }

    l.push(
      "Competencias adaptadas de las Career Readiness Competencies de NACE. Esquema situación / acción / resultado / aprendizaje, Columbia University Center for Career Education."
    );
    return l.join("\n");
  }

  // Versión hablada de la devolución. No es el archivo entero: se saltea la
  // entrevista completa, que escuchada de corrido son varios minutos.
  function textoDevolucion() {
    const l = [];
    l.push(
      nombre
        ? `${nombre}, esta es tu devolución.`
        : "Esta es tu devolución."
    );
    if (comp?.competencias?.length) {
      comp.competencias.forEach((c) => {
        l.push(`${c.nombre}: ${NIVELES[c.nivel] || ""}.`);
        if (c.evidencia) l.push(c.evidencia);
        if (c.para_subir) l.push(`Para subir: ${c.para_subir}`);
      });
    }
    if (comp?.para_practicar) {
      l.push("Lo que más te conviene practicar:");
      l.push(comp.para_practicar);
    }
    if (sara?.reescritura) {
      const r = sara.reescritura;
      l.push("Una respuesta tuya, reescrita.");
      if (r.situacion) l.push(`Situación: ${r.situacion}`);
      if (r.accion) l.push(`Acción: ${r.accion}`);
      if (r.resultado) l.push(`Resultado: ${r.resultado}`);
      if (r.aprendizaje) l.push(`Aprendizaje: ${r.aprendizaje}`);
    }
    return l.join(" ");
  }

  function escucharDevolucion() {
    if (lectura.hablando) return lectura.parar();
    lectura.leer(textoDevolucion());
  }

  async function copiar() {
    const txt = armarTexto();
    try {
      await navigator.clipboard.writeText(txt);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
      return;
    } catch (e) {
      /* fallback abajo */
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = txt;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    } catch (e) {
      setError("No se pudo copiar. Descargá el archivo.");
    }
  }

  function descargar() {
    try {
      const blob = new Blob([armarTexto()], {
        type: "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "entrevista-de-practica.txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError("No se pudo descargar. Probá copiando el texto.");
    }
  }

  function reset() {
    lectura.parar();
    dictado.parar();
    leidaRef.current = "";
    setStage("setup");
    setApiMessages([]);
    setQuestion("");
    setAnswer("");
    setPlanIdx(0);
    setTurno(0);
    setEsRepregunta(false);
    setTranscript([]);
    setComp(null);
    setSara(null);
    setHint("");
    setError("");
    setFallo(false);
    setAvisado(false);
    setCargandoComp(false);
    setCargandoSara(false);
    setFallaComp(false);
  }

  const listo = !cargandoComp && !cargandoSara;

  return (
    <main
      style={{
        background: C.paper,
        color: C.ink,
        minHeight: "100vh",
        padding: "22px 14px 56px",
      }}
    >
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ marginBottom: 20 }}>
          <Eyebrow>Entrevista de práctica</Eyebrow>
          <h1
            style={{
              fontFamily: SERIF,
              fontSize: "clamp(23px, 6.5vw, 27px)",
              lineHeight: 1.2,
              margin: "2px 0 0",
              fontWeight: "normal",
            }}
          >
            Nadie ve esto. Podés equivocarte.
          </h1>
        </div>

        {/* ── setup ── */}
        {stage === "setup" && (
          <>
            <Card>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 16,
                }}
              >
                <Chip muted>8 preguntas</Chip>
                <Chip muted>15 a 20 minutos</Chip>
                <Chip muted>
                  {dictado.soportado ? "Hablando o escribiendo" : "Se escribe"}
                </Chip>
              </div>

              <p
                style={{
                  margin: "0 0 22px",
                  fontSize: 15,
                  lineHeight: 1.65,
                  color: C.inkSoft,
                }}
              >
                Ocho preguntas, siempre las mismas, como en una entrevista
                estructurada de verdad. Te van a repreguntar. Al final tenés tu
                nivel en cada competencia, una respuesta tuya reescrita y todo
                para guardar.
              </p>

              <Label>¿Para qué tipo de puesto?</Label>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 22,
                }}
              >
                {PUESTOS.map((p) => {
                  const on = p.id === puesto;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPuesto(p.id)}
                      aria-pressed={on}
                      style={{
                        padding: "12px 15px",
                        minHeight: 44,
                        borderRadius: 2,
                        fontSize: 14,
                        cursor: "pointer",
                        border: `1px solid ${on ? C.ink : C.rule}`,
                        background: on ? C.ink : "transparent",
                        color: on ? C.page : C.ink,
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              <Label>Tu nombre (opcional)</Label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Cómo querés que te llamen"
                style={inputStyle}
              />

              <Label>Pegá el aviso, si tenés uno (opcional)</Label>
              <textarea
                value={aviso}
                onChange={(e) => setAviso(e.target.value)}
                placeholder="Copiá la búsqueda a la que te querés postular. Las preguntas se ajustan a eso."
                rows={4}
                style={{ ...inputStyle, lineHeight: 1.5, resize: "vertical" }}
              />

              <Casilla
                on={mostrarMarco}
                onClick={() => setMostrarMarco(!mostrarMarco)}
              >
                Mostrar qué evalúa cada pregunta mientras respondo
              </Casilla>

              {lectura.soportado && (
                <Casilla on={vozActiva} onClick={alternarVoz}>
                  Leerme las preguntas en voz alta
                </Casilla>
              )}

              <div style={{ height: 16 }} />

              {dictado.soportado ? (
                <Note>
                  Podés contestar hablando: en cada pregunta hay un botón de
                  micrófono y lo que decís se escribe solo. Siempre podés
                  corregir el texto a mano antes de mandarlo.
                </Note>
              ) : (
                <Note>
                  Este navegador no deja contestar hablando. Si lo querés
                  probar, abrilo en Chrome, Edge o Safari. Escribiendo funciona
                  igual.
                </Note>
              )}

              <PrimaryButton onClick={start}>
                Empezar la entrevista
              </PrimaryButton>
              {error && <ErrorNote>{error}</ErrorNote>}
            </Card>

            <Card>
              <SectionTitle>Qué se evalúa</SectionTitle>
              {PLAN.map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    padding: "10px 0",
                    borderBottom:
                      i < PLAN.length - 1 ? `1px solid ${C.rule}` : "none",
                    fontSize: 14,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{p.comp}</span>
                  <span
                    style={{
                      color: C.inkSoft,
                      fontSize: 13,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.tipo}
                  </span>
                </div>
              ))}
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.65,
                  color: C.inkSoft,
                  marginTop: 16,
                  marginBottom: 0,
                }}
              >
                Las conductuales piden algo que ya te pasó. Las situacionales te
                plantean una escena: sirven cuando todavía no trabajaste, porque
                no hace falta haberlo vivido.
              </p>
            </Card>
          </>
        )}

        {/* ── entrevista ── */}
        {stage === "interview" && (
          <>
            <div ref={anclaRef} style={{ scrollMarginTop: 12 }} />
            <Progress idx={planIdx} />
            <Card>
              {loading && !question ? (
                <Typing text="Preparando la entrevista" />
              ) : (
                <>
                  <div style={{ marginBottom: 14 }}>
                    <Eyebrow>
                      Pregunta {Math.min(planIdx + 1, PLAN.length)} de{" "}
                      {PLAN.length}
                      {esRepregunta ? " · repregunta" : ""}
                    </Eyebrow>
                    {mostrarMarco && (
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          marginTop: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <Chip>{actual.comp}</Chip>
                        <Chip muted>{actual.tipo}</Chip>
                      </div>
                    )}
                  </div>

                  <p
                    aria-live="polite"
                    style={{
                      fontFamily: SERIF,
                      fontSize: "clamp(19px, 5.2vw, 22px)",
                      lineHeight: 1.45,
                      margin: "0 0 16px",
                    }}
                  >
                    {question}
                  </p>

                  {lectura.soportado && question && (
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        flexWrap: "wrap",
                        marginBottom: 22,
                      }}
                    >
                      <BotonVoz
                        onClick={escucharPregunta}
                        activo={lectura.hablando}
                        title="Escuchar la pregunta"
                      >
                        {lectura.hablando
                          ? "Parar la lectura"
                          : "Escuchar la pregunta"}
                      </BotonVoz>
                      <Casilla on={vozActiva} onClick={alternarVoz}>
                        Leer sola cada pregunta
                      </Casilla>
                    </div>
                  )}

                  {loading ? (
                    <Typing text="Escuchando" />
                  ) : (
                    <>
                      <textarea
                        ref={textareaRef}
                        value={answer}
                        onChange={crecer}
                        placeholder={
                          dictado.soportado
                            ? "Contestá hablando con el botón de abajo, o escribí acá."
                            : "Escribí como hablarías. Después leelo en voz alta."
                        }
                        rows={4}
                        style={{
                          ...inputStyle,
                          lineHeight: 1.7,
                          resize: "vertical",
                          marginBottom: 0,
                          minHeight: 110,
                          overflow: "hidden",
                        }}
                      />

                      {dictado.grabando && (
                        <div
                          aria-live="polite"
                          style={{
                            fontSize: 15,
                            lineHeight: 1.6,
                            color: C.inkSoft,
                            fontStyle: "italic",
                            padding: "8px 12px",
                            marginTop: 8,
                            borderLeft: `2px solid ${C.rule}`,
                            minHeight: 24,
                          }}
                        >
                          {dictado.parcial || "Te escucho…"}
                        </div>
                      )}

                      {dictado.soportado && (
                        <div style={{ marginTop: 12 }}>
                          <BotonVoz
                            onClick={alternarDictado}
                            activo={dictado.grabando}
                            title="Contestar hablando"
                          >
                            {dictado.grabando ? (
                              <>
                                <Pulso /> Listo, terminé
                              </>
                            ) : (
                              "Contestar hablando"
                            )}
                          </BotonVoz>
                        </div>
                      )}

                      {dictado.error && <Note>{dictado.error}</Note>}

                      {mostrarMarco && actual.tipo !== "apertura" && (
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            marginTop: 10,
                            flexWrap: "wrap",
                          }}
                        >
                          {[
                            "Situación",
                            "Acción",
                            "Resultado",
                            "Aprendizaje",
                          ].map((s) => (
                            <Chip key={s} muted>
                              {s}
                            </Chip>
                          ))}
                        </div>
                      )}

                      {avisado && cortita && !fallo && (
                        <Note>
                          Esto da para un ejemplo concreto: qué pasó, qué hiciste
                          vos y cómo terminó. Si querés, agregalo. Si no, tocá
                          Responder otra vez.
                        </Note>
                      )}

                      {hint && <Note>{hint}</Note>}

                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          marginTop: 18,
                          flexWrap: "wrap",
                        }}
                      >
                        <PrimaryButton
                          onClick={submit}
                          disabled={!answer.trim()}
                        >
                          {fallo ? "Reintentar" : "Responder"}
                        </PrimaryButton>
                        <SecondaryButton
                          onClick={getHint}
                          disabled={hintLoading}
                        >
                          {hintLoading ? "Buscando…" : "No sé qué decir"}
                        </SecondaryButton>
                      </div>
                    </>
                  )}
                  {error && <ErrorNote>{error}</ErrorNote>}
                </>
              )}
            </Card>
          </>
        )}

        {/* ── devolución ── */}
        {stage === "feedback" && (
          <>
            {cargandoComp && (
              <Card>
                <Typing text="Evaluando competencia por competencia" />
              </Card>
            )}

            {fallaComp && !comp && (
              <Card>
                <div style={{ fontSize: 15, lineHeight: 1.6 }}>
                  La evaluación por competencia no llegó. La entrevista completa
                  está más abajo y la podés guardar igual.
                </div>
              </Card>
            )}

            {comp?.competencias && (
              <Card>
                <SectionTitle>
                  {nombre
                    ? `${nombre}, tu nivel por competencia`
                    : "Tu nivel por competencia"}
                </SectionTitle>
                {comp.competencias.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      paddingBottom: 18,
                      marginBottom: 18,
                      borderBottom:
                        i < comp.competencias.length - 1
                          ? `1px solid ${C.rule}`
                          : "none",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: 12,
                        marginBottom: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 15 }}>
                        {c.nombre}
                      </span>
                      <span style={{ fontSize: 13, color: C.inkSoft }}>
                        {NIVELES[c.nivel] || ""}
                      </span>
                    </div>
                    <Meter nivel={c.nivel} />
                    <div
                      style={{
                        fontSize: 15,
                        lineHeight: 1.6,
                        margin: "12px 0 8px",
                      }}
                    >
                      {c.evidencia}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        lineHeight: 1.6,
                        padding: "10px 12px",
                        background: C.okBg,
                        color: C.ok,
                      }}
                    >
                      {c.para_subir}
                    </div>
                  </div>
                ))}
              </Card>
            )}

            {comp?.para_practicar && (
              <div
                style={{
                  background: C.page,
                  border: `1px solid ${C.rule}`,
                  borderLeft: `3px solid ${C.margin}`,
                  padding: "24px",
                  marginBottom: 16,
                }}
              >
                <Eyebrow>Practicá esto antes de la entrevista real</Eyebrow>
                <div
                  style={{
                    fontFamily: SERIF,
                    fontSize: "clamp(18px, 4.8vw, 21px)",
                    lineHeight: 1.5,
                    marginTop: 10,
                  }}
                >
                  {comp.para_practicar}
                </div>
              </div>
            )}

            {cargandoSara && !cargandoComp && (
              <Card>
                <Typing text="Revisando respuesta por respuesta" />
              </Card>
            )}

            {sara?.analisis && (
              <Card>
                <SectionTitle>Qué le faltó a cada respuesta</SectionTitle>
                {sara.analisis.map((x, i) => (
                  <div key={i} style={{ marginBottom: 18 }}>
                    <div
                      style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}
                    >
                      {x.pregunta}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        flexWrap: "wrap",
                        marginBottom: 8,
                      }}
                    >
                      <Tick on={x.situacion}>Situación</Tick>
                      <Tick on={x.accion}>Acción</Tick>
                      <Tick on={x.resultado}>Resultado</Tick>
                      <Tick on={x.aprendizaje}>Aprendizaje</Tick>
                    </div>
                    <div
                      style={{ fontSize: 14, lineHeight: 1.6, color: C.inkSoft }}
                    >
                      {x.nota}
                    </div>
                  </div>
                ))}
              </Card>
            )}

            {sara?.reescritura && (
              <Card>
                <SectionTitle>Una respuesta tuya, reescrita</SectionTitle>
                <div
                  style={{
                    fontFamily: SERIF,
                    fontSize: 17,
                    lineHeight: 1.5,
                    marginBottom: 18,
                  }}
                >
                  {sara.reescritura.pregunta}
                </div>
                {[
                  ["Situación", sara.reescritura.situacion],
                  ["Acción", sara.reescritura.accion],
                  ["Resultado", sara.reescritura.resultado],
                  ["Aprendizaje", sara.reescritura.aprendizaje],
                ].map(([k, v]) =>
                  v ? (
                    <div
                      key={k}
                      style={{
                        marginBottom: 14,
                        borderLeft: `2px solid ${C.margin}`,
                        paddingLeft: 14,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          color: C.inkSoft,
                          marginBottom: 4,
                        }}
                      >
                        {k}
                      </div>
                      <div style={{ fontSize: 15, lineHeight: 1.7 }}>{v}</div>
                    </div>
                  ) : null
                )}
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: C.inkSoft,
                    marginTop: 14,
                  }}
                >
                  {sara.reescritura.por_que}
                </div>
              </Card>
            )}

            {comp?.cierre && (
              <div
                style={{
                  fontFamily: SERIF,
                  fontSize: 19,
                  lineHeight: 1.5,
                  padding: "8px 4px 22px",
                }}
              >
                {comp.cierre}
              </div>
            )}

            {(comp || sara || transcript.length > 0) && listo && (
              <Card>
                <SectionTitle>Llevate esto</SectionTitle>
                <p
                  style={{
                    margin: "0 0 16px",
                    fontSize: 14,
                    lineHeight: 1.65,
                    color: C.inkSoft,
                  }}
                >
                  Esta pantalla no se guarda sola. Copiala y pegala donde la
                  vayas a releer antes de la entrevista real.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <PrimaryButton onClick={copiar}>
                    {copiado ? "Copiado" : "Copiar todo"}
                  </PrimaryButton>
                  <SecondaryButton onClick={descargar}>
                    Descargar archivo
                  </SecondaryButton>
                  {lectura.soportado && (comp || sara) && (
                    <SecondaryButton onClick={escucharDevolucion}>
                      {lectura.hablando
                        ? "Parar la lectura"
                        : "Escuchar la devolución"}
                    </SecondaryButton>
                  )}
                </div>
              </Card>
            )}

            {transcript.length > 0 && (
              <Card>
                <SectionTitle>Tu entrevista, completa</SectionTitle>
                {transcript.map((t, i) => (
                  <div key={i} style={{ marginBottom: 20 }}>
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        marginBottom: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      <Chip muted>{t.comp}</Chip>
                    </div>
                    <div
                      style={{
                        fontFamily: SERIF,
                        fontSize: 16,
                        lineHeight: 1.5,
                        marginBottom: 6,
                      }}
                    >
                      {t.q}
                    </div>
                    <div
                      style={{
                        fontSize: 15,
                        lineHeight: 1.65,
                        color: C.inkSoft,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {t.a}
                    </div>
                  </div>
                ))}
              </Card>
            )}

            {error && <ErrorNote>{error}</ErrorNote>}

            {listo && (
              <div style={{ marginTop: 8 }}>
                <SecondaryButton onClick={reset}>
                  Practicar de nuevo
                </SecondaryButton>
              </div>
            )}
          </>
        )}

        <footer
          style={{
            marginTop: 32,
            paddingTop: 16,
            borderTop: `1px solid ${C.rule}`,
            fontSize: 12,
            lineHeight: 1.7,
            color: C.inkSoft,
          }}
        >
          Tus respuestas no se guardan en ningún lado: viven solo en esta
          pestaña y se pierden al cerrarla.
          <br />
          <br />
          Competencias adaptadas de las Career Readiness Competencies del
          National Association of Colleges and Employers (NACE). Formato de
          entrevista estructurada y preguntas conductuales y situacionales según
          la guía de structured interviews de la U.S. Office of Personnel
          Management. Esquema de respuesta situación / acción / resultado /
          aprendizaje, Columbia University Center for Career Education.
        </footer>
      </div>
    </main>
  );
}

/* ---------- piezas ---------- */

const inputStyle = {
  width: "100%",
  padding: "12px 12px",
  fontSize: 16, // 16px evita el zoom automático de iOS al tocar el campo
  border: `1px solid ${C.rule}`,
  borderRadius: 2,
  background: C.page,
  color: C.ink,
  marginBottom: 22,
};

function Card({ children }) {
  return (
    <div
      style={{
        background: C.page,
        border: `1px solid ${C.rule}`,
        borderLeftWidth: 2,
        borderLeftColor: C.margin,
        padding: "24px 20px",
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: C.inkSoft,
      }}
    >
      {children}
    </div>
  );
}

function Label({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: C.inkSoft,
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div
      style={{
        fontFamily: SERIF,
        fontSize: 20,
        marginBottom: 18,
        paddingBottom: 10,
        borderBottom: `1px solid ${C.rule}`,
      }}
    >
      {children}
    </div>
  );
}

function Casilla({ on, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "none",
        border: "none",
        padding: "10px 0",
        minHeight: 44,
        cursor: "pointer",
        color: C.ink,
        fontSize: 14,
        textAlign: "left",
      }}
      aria-pressed={on}
    >
      <span
        style={{
          width: 18,
          height: 18,
          border: `1px solid ${C.ink}`,
          background: on ? C.ink : "transparent",
          flexShrink: 0,
        }}
      />
      {children}
    </button>
  );
}

// Botón chico de texto, para los controles de voz al lado de la pregunta.
function BotonVoz({ onClick, activo, children, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "9px 13px",
        minHeight: 40,
        fontSize: 13,
        cursor: "pointer",
        borderRadius: 2,
        border: `1px solid ${activo ? C.ink : C.rule}`,
        background: activo ? C.ink : "transparent",
        color: activo ? C.page : C.inkSoft,
      }}
    >
      {children}
    </button>
  );
}

// Punto que late mientras el micrófono está abierto.
function Pulso() {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: C.margin,
        display: "inline-block",
        animation: "pulso 1.2s ease-in-out infinite",
      }}
    />
  );
}

function Chip({ children, muted }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: "5px 9px",
        border: `1px solid ${muted ? C.rule : C.ink}`,
        color: muted ? C.inkSoft : C.ink,
        borderRadius: 2,
      }}
    >
      {children}
    </span>
  );
}

function Tick({ on, children }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: "5px 9px",
        borderRadius: 2,
        border: `1px solid ${on ? C.ok : C.rule}`,
        background: on ? C.okBg : "transparent",
        color: on ? C.ok : C.inkSoft,
        textDecoration: on ? "none" : "line-through",
      }}
    >
      {children}
    </span>
  );
}

function Meter({ nivel }) {
  return (
    <div style={{ display: "flex", gap: 3 }} aria-label={`Nivel ${nivel} de 4`}>
      {[1, 2, 3, 4].map((n) => (
        <div
          key={n}
          style={{ height: 5, flex: 1, background: n <= nivel ? C.ink : C.rule }}
        />
      ))}
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "13px 22px",
        minHeight: 46,
        fontSize: 15,
        border: "none",
        borderRadius: 2,
        background: disabled ? C.rule : C.ink,
        color: disabled ? C.inkSoft : C.page,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "13px 18px",
        minHeight: 46,
        fontSize: 15,
        cursor: disabled ? "not-allowed" : "pointer",
        border: `1px solid ${C.rule}`,
        background: "transparent",
        color: C.inkSoft,
        borderRadius: 2,
      }}
    >
      {children}
    </button>
  );
}

function Progress({ idx }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
      {PLAN.map((_, i) => (
        <div
          key={i}
          style={{ height: 3, flex: 1, background: i <= idx ? C.ink : C.rule }}
        />
      ))}
    </div>
  );
}

function Note({ children }) {
  return (
    <div
      style={{
        marginTop: 14,
        padding: "12px 14px",
        background: C.warnBg,
        borderLeft: `2px solid ${C.warn}`,
        fontSize: 14,
        lineHeight: 1.6,
        color: C.warn,
      }}
    >
      {children}
    </div>
  );
}

function Typing({ text }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        color: C.inkSoft,
        fontSize: 14,
        padding: "6px 0",
      }}
    >
      {text}
      <span style={{ display: "inline-flex", gap: 3 }}>
        <span className="dot">•</span>
        <span className="dot">•</span>
        <span className="dot">•</span>
      </span>
    </div>
  );
}

function ErrorNote({ children }) {
  return (
    <div
      style={{ marginTop: 14, fontSize: 14, lineHeight: 1.6, color: C.margin }}
    >
      {children}
    </div>
  );
}
