// Revisión local de las respuestas. Corre entera en el navegador.
//
// Esto NO es una evaluación: es una búsqueda de palabras clave en el texto que
// la persona escribió. Marca si aparecen ciertas señales y nada más. Se
// equivoca seguido — una respuesta buena escrita con otras palabras le pasa por
// al lado. La interfaz tiene que decirlo con todas las letras.
//
// Regla dura: no inventar nada. Solo se puede señalar qué aparece y qué no
// aparece en lo que la persona escribió.

// Todo se compara sin tildes y en minúscula: mucha gente escribe sin acentos,
// y el dictado del navegador sí los pone. Sin esto, la misma frase daría
// distinto según cómo se cargó.
function normalizar(t) {
  return String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Debajo de esto no hay nada que buscar: son dos o tres palabras sueltas.
const MINIMO_UTIL = 45;

const SENALES = {
  // Cuándo, dónde, con quién. El contexto de la historia.
  situacion: [
    "cuando", "una vez", "el ano pasado", "el otro dia", "hace poco",
    "estaba", "estabamos", "trabajaba", "trabajabamos", "habia", "tenia",
    "en el colegio", "en la escuela", "en el club", "en mi casa",
    "en el negocio", "en el local", "en la cocina", "un dia", "un sabado",
    "un domingo", "de verano", "en las vacaciones", "mi hermana",
    "mi hermano", "mi mama", "mi papa", "mi tia", "mi tio", "mis amigos",
    "mis companeros", "el equipo", "la profesora", "el profesor",
  ],
  // Qué hizo ella o él. Primera persona, no el grupo.
  accion: [
    "hice", "hablé", "hable", "expliqué", "explique", "organicé", "organice",
    "ayudé", "ayude", "decidí", "decidi", "resolví", "resolvi", "propuse",
    "me puse", "me encargue", "me encargué", "avisé", "avise", "llamé",
    "llame", "busqué", "busque", "armé", "arme", "atendí", "atendi",
    "empecé", "empece", "pregunté", "pregunte", "dije", "fui", "tuve",
    "puse", "revisé", "revise", "anoté", "anote", "escribí", "escribi",
    "yo me", "yo le", "lo que hice", "me tocó", "me toco",
  ],
  // Cómo terminó.
  resultado: [
    "al final", "termino", "terminó", "terminamos", "terminé", "termine",
    "salio bien", "salió bien", "salio", "logré", "logre", "logramos",
    "conseguí", "consegui", "conseguimos", "pudimos", "pude", "quedo",
    "quedó", "funcionó", "funciono", "entendió", "entendio", "entendieron",
    "resultó", "resulto", "asi que", "así que", "gracias a eso",
    "se soluciono", "se solucionó", "lo resolvimos", "nos fue",
  ],
  // Las situacionales son hipotéticas: nadie contesta en pasado. Acá se busca
  // condicional y presente, y las palabras de quien ordena unos pasos.
  accionHipotetica: [
    "haria", "haría", "trataria", "trataría", "preguntaria", "preguntaría",
    "avisaria", "avisaría", "revisaria", "revisaría", "buscaria", "buscaría",
    "llamaria", "llamaría", "esperaria", "esperaría", "intentaria",
    "intentaría", "resolveria", "resolvería", "diria", "diría", "iria",
    "iría", "primero", "despues", "después", "luego", "lo primero",
    "reviso", "pregunto", "aviso", "espero", "trato de", "me fijo",
    "le digo", "me quedo", "lo que haria", "lo que haría",
  ],
  // Solo para la de apertura: por qué le interesa el puesto.
  motivo: [
    "me interesa", "me interesó", "me interesa mucho", "me gusta",
    "me gustaria", "me gustaría", "quiero", "busco", "estoy buscando",
    "aprender", "me llama la atencion", "me llama la atención",
    "porque", "para", "me sirve",
  ],
  // Qué se llevó de ahí.
  aprendizaje: [
    "aprendí", "aprendi", "me di cuenta", "la proxima", "la próxima",
    "desde ahi", "desde ahí", "desde entonces", "me sirvio", "me sirvió",
    "cambié", "cambie", "ahora lo hago", "ahora se", "ahora sé",
    "si me pasara", "me quedo que", "me quedó que", "entendi que",
    "entendí que",
  ],
};

function tiene(txt, lista) {
  return lista.some((k) => txt.includes(normalizar(k)));
}

// El marco situación / acción / resultado / aprendizaje sirve para contar algo
// que pasó de verdad. En las preguntas situacionales no hay historia que
// contar, son hipotéticas, y en la de apertura tampoco. Aplicarlo ahí sería
// pedirle a la respuesta algo que la pregunta nunca pidió.
export function usaMarcoSara(tipo) {
  return tipo === "conductual";
}

export function revisarRespuesta(entrada) {
  const txt = normalizar(entrada.a);
  const largo = String(entrada.a || "").trim().length;
  const suficiente = largo >= MINIMO_UTIL;

  const marcas = {
    situacion: suficiente && tiene(txt, SENALES.situacion),
    accion: suficiente && tiene(txt, SENALES.accion),
    resultado: suficiente && tiene(txt, SENALES.resultado),
    aprendizaje: suficiente && tiene(txt, SENALES.aprendizaje),
  };

  const marco = usaMarcoSara(entrada.tipo);
  const observaciones = [];
  const faltan = [];

  if (largo < MINIMO_UTIL) {
    observaciones.push("Respuesta muy breve");
  } else if (largo < 200) {
    observaciones.push("Respuesta corta");
  } else {
    observaciones.push("Respuesta con desarrollo");
  }

  if (marco) {
    if (marcas.situacion) observaciones.push("Aparece una situación concreta");
    else faltan.push("cuándo y dónde fue");

    if (marcas.accion) observaciones.push("Se entiende qué hiciste vos");
    else faltan.push("qué hiciste vos");

    if (marcas.resultado) observaciones.push("Aparece cómo terminó");
    else faltan.push("cómo terminó");

    if (marcas.aprendizaje) observaciones.push("Aparece un aprendizaje");
    else faltan.push("qué te llevaste");
  } else if (entrada.tipo === "situacional") {
    if (suficiente && tiene(txt, SENALES.accionHipotetica)) {
      observaciones.push("Decís qué harías");
    } else {
      faltan.push("qué harías vos, paso a paso");
    }
  } else {
    // Apertura: no hay historia ni escena, se mira si dice por qué le interesa.
    if (suficiente && tiene(txt, SENALES.motivo)) {
      observaciones.push("Contás por qué te interesa");
    } else {
      faltan.push("por qué te interesa este puesto");
    }
  }

  let nota;
  if (largo < MINIMO_UTIL) {
    nota =
      "Con esto no alcanza para que se entienda. En una entrevista real conviene dar un ejemplo.";
  } else if (!faltan.length) {
    nota = "No falta ninguna de las señales que busca esta revisión.";
  } else {
    nota = "No encontré en el texto: " + faltan.join(", ") + ".";
  }

  return {
    pregunta: entrada.comp,
    tipo: entrada.tipo,
    marco,
    largo,
    observaciones,
    faltan,
    nota,
    // Nombres planos para que la fila de tildes de la interfaz los lea directo.
    situacion: marcas.situacion,
    accion: marcas.accion,
    resultado: marcas.resultado,
    aprendizaje: marcas.aprendizaje,
  };
}

// Junta lo de todas las respuestas y arma dos o tres sugerencias. Todo sale de
// contar lo que ya se marcó arriba: acá tampoco se inventa nada.
export function revisarEntrevista(transcript) {
  const analisis = (transcript || []).map(revisarRespuesta);
  const conductuales = analisis.filter((x) => x.marco);

  const cortas = analisis.filter((x) => x.largo < MINIMO_UTIL).length;
  const sinResultado = conductuales.filter((x) => !x.resultado).length;
  const sinAccion = conductuales.filter((x) => !x.accion).length;
  const sinAprendizaje = conductuales.filter((x) => !x.aprendizaje).length;
  const sinSituacion = conductuales.filter((x) => !x.situacion).length;

  const sugerencias = [];
  if (cortas > 0) {
    sugerencias.push(
      cortas === 1
        ? "Una de tus respuestas quedó muy corta. Practicá estirarla con un ejemplo."
        : `${cortas} de tus respuestas quedaron muy cortas. Practicá estirarlas con un ejemplo.`
    );
  }
  if (conductuales.length) {
    if (sinSituacion > conductuales.length / 2) {
      sugerencias.push(
        "En la mayoría de tus ejemplos no queda claro cuándo ni dónde pasó. Arrancá ubicando la escena."
      );
    }
    if (sinAccion > conductuales.length / 2) {
      sugerencias.push(
        "Contás lo que pasó, pero cuesta ver qué hiciste vos. Usá más el yo: hice, dije, propuse."
      );
    }
    if (sinResultado > conductuales.length / 2) {
      sugerencias.push(
        "Casi ninguna de tus historias tiene final. Cerrá siempre contando cómo terminó."
      );
    }
    if (sinAprendizaje > conductuales.length / 2) {
      sugerencias.push(
        "Falta qué te llevaste de cada situación. Es lo que más se valora en una entrevista."
      );
    }
  }
  if (!sugerencias.length) {
    sugerencias.push(
      "Tus respuestas tienen las señales que busca esta revisión. Leelas en voz alta y cronometrate: en una entrevista real también pesa cómo suenan."
    );
  }

  return { analisis, sugerencias };
}
