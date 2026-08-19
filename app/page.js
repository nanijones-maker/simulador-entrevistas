"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { PLAN, PUESTOS, MIN_CARACTERES, labelPuesto } from "@/lib/plan";
import { useLectura, useDictado } from "@/lib/voz";
import { revisarEntrevista, usaMarcoSara } from "@/lib/revision";

// Todos los pares que quedan uno sobre otro pasan contraste AA (4.5:1), y el
// texto principal llega a 14:1. Si se tocan estos valores, conviene medirlo:
// el fucsia clarito es muy fácil de dejar ilegible.
const C = {
  paper: "#FFF5FA", // fondo, rosa muy claro
  page: "#FFFFFF", // tarjetas
  ink: "#45092F", // texto principal, ciruela casi negro
  inkSoft: "#8A4A72", // texto secundario, malva
  rule: "#F4D2E5", // bordes y líneas
  margin: "#CC006E", // fucsia fuerte: margen, error, punto del micrófono
  ok: "#8E1B75", // logrado
  okBg: "#FBE9F6",
  warnBg: "#FFF0F3",
  warn: "#AF3459", // avisos y pistas, rosa oscuro
};

const SERIF = 'Georgia, "Times New Roman", serif';


export default function Page() {
  const [stage, setStage] = useState("setup");
  const [puesto, setPuesto] = useState("atencion");
  const [aviso, setAviso] = useState("");
  const [nombre, setNombre] = useState("");
  const [mostrarMarco, setMostrarMarco] = useState(true);

  const [question, setQuestion] = useState("");
  const [esRepregunta, setEsRepregunta] = useState(false);
  const [planIdx, setPlanIdx] = useState(0);
  const [turno, setTurno] = useState(0);
  const [answer, setAnswer] = useState("");
  const [transcript, setTranscript] = useState([]);

  const [hint, setHint] = useState("");
  const [error, setError] = useState("");

  const [revision, setRevision] = useState(null);
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
  function crecer(e) {
    setAnswer(e.target.value);
    ajustarAlto();
  }

  // Sin red de por medio: la primera pregunta ya está en el guion.
  function start() {
    setError("");
    setPlanIdx(0);
    setQuestion(PLAN[0].pregunta);
    setEsRepregunta(false);
    setTurno(1);
    setStage("interview");
  }

  function submit() {
    const a = answer.trim();
    if (!a) return;

    // Cerrar el micrófono antes de mandar: lo último dictado ya entró.
    dictado.parar();
    lectura.parar();
    setError("");

    // La repregunta sale cuando la respuesta viene corta, y una sola vez por
    // pregunta: si ya estamos en la repregunta, se avanza sí o sí. Por eso
    // nunca pueden salir dos seguidas.
    const merece = a.length < MIN_CARACTERES && !esRepregunta;

    if (merece) {
      // Lo dicho hasta acá se guarda igual: la repregunta suma, no reemplaza.
      setTranscript([
        ...transcript,
        { q: question, a, comp: actual.comp, tipo: actual.tipo, esRepregunta },
      ]);
      setAnswer("");
      setHint("");
      setEsRepregunta(true);
      setQuestion(actual.repregunta);
      setTurno(turno + 1);
      return;
    }

    // Cuando hubo repregunta, las dos partes se juntan en una sola respuesta:
    // la devolución mira la historia completa, no cada mitad por separado.
    const nuevaTranscript = esRepregunta
      ? transcript.map((x, i) =>
          i === transcript.length - 1
            ? { ...x, q: PLAN[planIdx].pregunta, a: (x.a + " " + a).trim() }
            : x
        )
      : [
          ...transcript,
          { q: question, a, comp: actual.comp, tipo: actual.tipo, esRepregunta },
        ];

    setTranscript(nuevaTranscript);
    setAnswer("");
    setHint("");
    setTurno(turno + 1);

    if (planIdx >= PLAN.length - 1) {
      setEsRepregunta(false);
      return cerrar(nuevaTranscript);
    }

    const siguiente = planIdx + 1;
    setPlanIdx(siguiente);
    setEsRepregunta(false);
    setQuestion(PLAN[siguiente].pregunta);
  }

  function cerrar(t) {
    setRevision(revisarEntrevista(t));
    setStage("feedback");
  }

  // La pista ya está escrita en el guion: sale al toque.
  function getHint() {
    setHint(actual.pista);
  }

  function armarTexto() {
    const l = [];
    l.push("ENTREVISTA DE PRÁCTICA");
    l.push(`Puesto: ${puestoLabel}`);
    if (nombre) l.push(`Nombre: ${nombre}`);
    l.push(new Date().toLocaleDateString("es-AR"));
    l.push("");

    if (revision?.sugerencias?.length) {
      l.push("PARA PRACTICAR");
      revision.sugerencias.forEach((s) => l.push("- " + s));
      l.push("");
    }

    if (revision?.analisis?.length) {
      l.push("QUÉ ENCONTRÓ LA REVISIÓN EN CADA RESPUESTA");
      l.push(
        "(Es una búsqueda de palabras clave hecha en tu navegador, no una evaluación. Se equivoca.)"
      );
      l.push("");
      revision.analisis.forEach((x) => {
        l.push(`${x.pregunta}: ${x.observaciones.join(" / ")}`);
        if (x.nota) l.push(x.nota);
        l.push("");
      });
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

  const puedeGuardar = transcript.length > 0 || !!revision;

  // Versión hablada de la devolución. No es el archivo entero: se saltea la
  // entrevista completa, que escuchada de corrido son varios minutos.
  function textoDevolucion() {
    const l = [];
    l.push(
      nombre
        ? `${nombre}, esta es tu devolución.`
        : "Esta es tu devolución."
    );
    if (revision?.sugerencias?.length) {
      l.push("Para practicar:");
      revision.sugerencias.forEach((s) => l.push(s));
    }
    if (revision?.analisis?.length) {
      l.push("Respuesta por respuesta.");
      revision.analisis.forEach((x) => {
        l.push(`${x.pregunta}: ${x.observaciones.join(", ")}.`);
        if (x.nota) l.push(x.nota);
      });
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
    setQuestion("");
    setAnswer("");
    setPlanIdx(0);
    setTurno(0);
    setEsRepregunta(false);
    setTranscript([]);
    setRevision(null);
    setHint("");
    setError("");
  }

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
                estructurada de verdad. Si una respuesta queda muy corta, te
                repregunta. Al final te muestra tus respuestas con lo que quedó
                afuera, y te las podés llevar.
              </p>
              <p
                style={{
                  margin: "12px 0 0",
                  fontSize: 14,
                  lineHeight: 1.65,
                  color: C.inkSoft,
                }}
              >
                Corre entero en tu navegador. No hay servidor, no hay cuenta y
                tus respuestas no salen de esta pestaña.
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
                placeholder="Podés pegar la búsqueda como referencia mientras practicás."
                rows={4}
                style={{ ...inputStyle, lineHeight: 1.5, resize: "vertical" }}
              />

              <Casilla
                on={mostrarMarco}
                onClick={() => setMostrarMarco(!mostrarMarco)}
              >
                Mostrar qué mira cada pregunta mientras respondo
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
              <SectionTitle>Qué mira cada pregunta</SectionTitle>
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

                      {mostrarMarco && usaMarcoSara(actual.tipo) && (
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
                          Responder
                        </PrimaryButton>
                        <SecondaryButton onClick={getHint}>
                          No sé qué decir
                        </SecondaryButton>
                      </div>
                  {error && <ErrorNote>{error}</ErrorNote>}
            </Card>
          </>
        )}

        {/* ── devolución ── */}
        {stage === "feedback" && (
          <>
            <Card>
              <SectionTitle>
                {nombre ? `${nombre}, terminaste` : "Terminaste"}
              </SectionTitle>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65 }}>
                Abajo está lo que revisó el navegador y tu entrevista completa.
                Lo que más sirve es releer tus propias respuestas: ahí se ve
                solo lo que quedó afuera.
              </p>
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
                Esto no es una evaluación. Es una búsqueda de palabras clave que
                corre en tu navegador: mira si aparecen ciertas señales en el
                texto y nada más. Si contaste algo con otras palabras, no lo va
                a ver. No lo lee nadie ni lo revisa una inteligencia artificial.
              </div>
            </Card>

            {revision?.sugerencias?.length > 0 && (
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
                {revision.sugerencias.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      fontFamily: SERIF,
                      fontSize: "clamp(17px, 4.4vw, 20px)",
                      lineHeight: 1.5,
                      marginTop: 12,
                    }}
                  >
                    {s}
                  </div>
                ))}
              </div>
            )}

            {revision?.analisis?.length > 0 && (
              <Card>
                <SectionTitle>Respuesta por respuesta</SectionTitle>
                {revision.analisis.map((x, i) => (
                  <div
                    key={i}
                    style={{
                      paddingBottom: 16,
                      marginBottom: 16,
                      borderBottom:
                        i < revision.analisis.length - 1
                          ? `1px solid ${C.rule}`
                          : "none",
                    }}
                  >
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
                      {x.marco ? (
                        <>
                          <Tick on={x.situacion}>Situación</Tick>
                          <Tick on={x.accion}>Acción</Tick>
                          <Tick on={x.resultado}>Resultado</Tick>
                          <Tick on={x.aprendizaje}>Aprendizaje</Tick>
                        </>
                      ) : (
                        x.observaciones.map((o) => (
                          <Chip key={o} muted>
                            {o}
                          </Chip>
                        ))
                      )}
                    </div>
                    <div
                      style={{ fontSize: 14, lineHeight: 1.6, color: C.inkSoft }}
                    >
                      {x.nota}
                    </div>
                  </div>
                ))}
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: C.inkSoft,
                  }}
                >
                  El marco situación / acción / resultado / aprendizaje solo se
                  aplica a las preguntas que piden contar algo que ya te pasó.
                  En las que arrancan con “imaginate” no hay una historia real
                  que contar, así que ahí se mira otra cosa.
                </p>
              </Card>
            )}

            {puedeGuardar && (
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
                  {lectura.soportado && revision && (
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

            <div style={{ marginTop: 8 }}>
              <SecondaryButton onClick={reset}>
                Practicar de nuevo
              </SecondaryButton>
            </div>
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

function ErrorNote({ children }) {
  return (
    <div
      style={{ marginTop: 14, fontSize: 14, lineHeight: 1.6, color: C.margin }}
    >
      {children}
    </div>
  );
}
