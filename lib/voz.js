"use client";

// Voz del navegador. No agrega costo ni una segunda clave de API: son dos
// funciones que ya vienen en el navegador. Los dos hooks degradan solos —
// si el navegador no las tiene, `soportado` viene en false y la interfaz
// esconde el botón. Nunca se rompe nada: escribir a mano siempre funciona.

import { useCallback, useEffect, useRef, useState } from "react";

const IDIOMA = "es-AR";

/* ────────────────── leer en voz alta ────────────────── */

// Preferencia de acento: primero rioplatense, después el resto de América,
// y España al final. Si no hay ninguna voz en español, canta la del sistema.
const ACENTOS = ["es-ar", "es-419", "es-us", "es-mx", "es-cl", "es-co", "es-es"];

function elegirVoz(voces) {
  const es = voces.filter((v) => (v.lang || "").toLowerCase().startsWith("es"));
  if (!es.length) return null;
  const norm = (v) => (v.lang || "").toLowerCase().replace("_", "-");
  for (const pref of ACENTOS) {
    const v = es.find((x) => norm(x) === pref);
    if (v) return v;
  }
  return es[0];
}

// Chrome corta las lecturas de más de ~15 segundos. Mandarlo frase por frase
// esquiva el bug y de paso hace que Parar reaccione al toque.
function partirEnFrases(texto, max = 170) {
  const frases = String(texto)
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?…:;])\s+/);

  const trozos = [];
  let buffer = "";
  for (const f of frases) {
    if (!f) continue;
    if ((buffer + " " + f).trim().length <= max) {
      buffer = (buffer + " " + f).trim();
      continue;
    }
    if (buffer) trozos.push(buffer);
    // Una frase sola más larga que el máximo: cortarla por comas o a lo bruto.
    if (f.length <= max) {
      buffer = f;
    } else {
      let resto = f;
      while (resto.length > max) {
        const corte = resto.lastIndexOf(",", max);
        const i = corte > max * 0.5 ? corte + 1 : max;
        trozos.push(resto.slice(0, i).trim());
        resto = resto.slice(i).trim();
      }
      buffer = resto;
    }
  }
  if (buffer) trozos.push(buffer);
  return trozos;
}

export function useLectura() {
  const [soportado, setSoportado] = useState(false);
  const [hablando, setHablando] = useState(false);
  const vozRef = useRef(null);
  const latidoRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    setSoportado(true);

    // Las voces cargan de forma asincrónica y en algunos navegadores llegan
    // recién con el evento. Se lee en los dos momentos.
    const cargar = () => {
      const v = elegirVoz(window.speechSynthesis.getVoices() || []);
      if (v) vozRef.current = v;
    };
    cargar();
    window.speechSynthesis.addEventListener("voiceschanged", cargar);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", cargar);
      window.speechSynthesis.cancel();
      clearInterval(latidoRef.current);
    };
  }, []);

  const parar = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    clearInterval(latidoRef.current);
    window.speechSynthesis.cancel();
    setHablando(false);
  }, []);

  const leer = useCallback(
    (texto) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      const trozos = partirEnFrases(texto || "");
      if (!trozos.length) return;

      window.speechSynthesis.cancel();

      trozos.forEach((t, i) => {
        const u = new SpeechSynthesisUtterance(t);
        u.lang = IDIOMA;
        if (vozRef.current) u.voice = vozRef.current;
        u.rate = 0.95; // apenas más lento que el default: se entiende mejor
        u.pitch = 1;
        if (i === 0) u.onstart = () => setHablando(true);
        if (i === trozos.length - 1) {
          u.onend = () => {
            clearInterval(latidoRef.current);
            setHablando(false);
          };
        }
        u.onerror = () => {
          clearInterval(latidoRef.current);
          setHablando(false);
        };
        window.speechSynthesis.speak(u);
      });

      setHablando(true);

      // Dos cosas a la vez. Chrome deja la cola en pausa sola cada tanto y este
      // resume la despierta. Y si el navegador se comió la lectura sin avisar
      // (pasa cuando no hay salida de audio), onend no llega nunca: al ver que
      // no quedó nada sonando, se apaga el botón solo en vez de quedar trabado.
      let ticks = 0;
      clearInterval(latidoRef.current);
      latidoRef.current = setInterval(() => {
        const s = window.speechSynthesis;
        ticks++;
        if (s.paused) {
          s.resume();
          return;
        }
        if (ticks > 2 && !s.speaking && !s.pending) {
          clearInterval(latidoRef.current);
          setHablando(false);
        }
      }, 1000);
    },
    []
  );

  return { soportado, hablando, leer, parar };
}

/* ────────────────── dictado ────────────────── */

function ClaseReconocimiento() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function useDictado({ onTexto }) {
  const [soportado, setSoportado] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const [parcial, setParcial] = useState("");
  const [error, setError] = useState("");

  const recRef = useRef(null);
  const quiereRef = useRef(false); // si el usuario todavía quiere grabar
  const onTextoRef = useRef(onTexto);

  useEffect(() => {
    onTextoRef.current = onTexto;
  }, [onTexto]);

  useEffect(() => {
    const Clase = ClaseReconocimiento();
    if (!Clase) return;
    setSoportado(true);

    const rec = new Clase();
    rec.lang = IDIOMA;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (ev) => {
      let enVivo = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) onTextoRef.current?.(r[0].transcript);
        else enVivo += r[0].transcript;
      }
      setParcial(enVivo);
    };

    rec.onerror = (ev) => {
      if (ev.error === "no-speech" || ev.error === "aborted") return; // normal
      quiereRef.current = false;
      setGrabando(false);
      setParcial("");
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        setError(
          "El navegador no dio permiso para el micrófono. Habilitalo en el candado de la barra de direcciones, o escribí la respuesta."
        );
      } else if (ev.error === "network") {
        setError("El dictado se quedó sin conexión. Podés escribir la respuesta.");
      } else {
        setError("El dictado se cortó. Probá de nuevo o escribí la respuesta.");
      }
    };

    // Chrome corta solo después de un silencio largo. Si el usuario no tocó
    // Parar, se vuelve a levantar y la grabación se siente continua.
    rec.onend = () => {
      setParcial("");
      if (!quiereRef.current) {
        setGrabando(false);
        return;
      }
      try {
        rec.start();
      } catch (e) {
        setGrabando(false);
      }
    };

    recRef.current = rec;

    return () => {
      quiereRef.current = false;
      try {
        rec.onend = null;
        rec.abort();
      } catch (e) {
        /* ya estaba cerrado */
      }
    };
  }, []);

  const arrancar = useCallback(() => {
    const rec = recRef.current;
    if (!rec || quiereRef.current) return;
    setError("");
    quiereRef.current = true;
    try {
      rec.start();
      setGrabando(true);
    } catch (e) {
      // start() tira si ya venía andando: no es un problema real.
      setGrabando(true);
    }
  }, []);

  const parar = useCallback(() => {
    const rec = recRef.current;
    quiereRef.current = false;
    setParcial("");
    setGrabando(false);
    if (!rec) return;
    try {
      rec.stop();
    } catch (e) {
      /* ya estaba frenado */
    }
  }, []);

  const limpiarError = useCallback(() => setError(""), []);

  return { soportado, grabando, parcial, error, arrancar, parar, limpiarError };
}
