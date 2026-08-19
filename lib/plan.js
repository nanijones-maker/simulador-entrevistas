// El guion completo de la entrevista. Todo vive acá y todo corre en el
// navegador: no hay backend, no hay API y no hay clave que configurar.
// Las ocho preguntas son siempre las mismas, en el mismo orden, para todos.

export const MIN_CARACTERES = 140;

export const PUESTOS = [
  { id: "atencion", label: "Atención al cliente" },
  { id: "gastronomia", label: "Gastronomía" },
  { id: "retail", label: "Local / retail" },
  { id: "admin", label: "Administrativo" },
  { id: "pasantia", label: "Pasantía" },
  { id: "general", label: "Primer empleo en general" },
];

// `repregunta` sale cuando la respuesta viene muy corta, una sola vez por
// pregunta. `pista` es lo que muestra el botón "No sé qué decir".
export const PLAN = [
  {
    comp: "Desarrollo personal",
    tipo: "apertura",
    foco: "quién es, qué viene haciendo y por qué le interesa este trabajo",
    pregunta: "Contame un poco de vos y qué te interesó de este puesto.",
    repregunta:
      "¿Qué cosa de este trabajo te gustaría aprender o empezar a hacer bien?",
    pista:
      "Podés contar qué estás haciendo hoy, algo que te guste aprender o hacer y por qué te interesa empezar a trabajar en este tipo de puesto.",
  },
  {
    comp: "Trabajo en equipo",
    tipo: "conductual",
    foco: "una vez que hizo algo junto con otras personas",
    pregunta:
      "Contame de una vez que tuviste que hacer algo con otras personas. ¿Qué hiciste vos para que saliera bien?",
    repregunta:
      "¿Qué hiciste vos, concretamente, cuando el grupo necesitó avanzar?",
    pista:
      "Pensá en el colegio, un deporte, un club, tu familia o un proyecto. Elegí una situación concreta y contá qué parte hiciste vos.",
  },
  {
    comp: "Comunicación",
    tipo: "conductual",
    foco: "una vez que tuvo que explicarle algo a alguien, o pedir ayuda",
    pregunta:
      "Contame de una vez que tuviste que explicarle algo a alguien que no entendía. ¿Cómo lo hiciste?",
    repregunta:
      "¿Qué cambiaste en tu forma de explicarlo para que la otra persona entendiera?",
    pista:
      "Puede ser explicando una tarea, una regla, un trámite o algo del colegio. Contá qué dijiste o hiciste distinto para hacerte entender.",
  },
  {
    comp: "Pensamiento crítico",
    tipo: "situacional",
    foco: "un problema chico del puesto, sin nadie cerca a quien preguntarle",
    pregunta:
      "Imaginate que aparece un problema chico mientras trabajás y no hay nadie cerca para preguntarle. ¿Qué hacés primero?",
    repregunta:
      "¿Cómo decidirías si podés resolverlo vos o si tenés que esperar y pedir ayuda?",
    pista:
      "Explicá un orden simple: primero entender el problema, después revisar qué podés hacer sin arriesgar nada y, si hace falta, pedir ayuda.",
  },
  {
    comp: "Profesionalismo",
    tipo: "situacional",
    foco: "llegar tarde, un error propio, o algo que no le corresponde hacer",
    pregunta:
      "Imaginate que te das cuenta de que cometiste un error en el trabajo. ¿Qué hacés?",
    repregunta:
      "¿Qué le dirías a la persona responsable y qué harías para corregirlo?",
    pista:
      "Mostrá que no esconderías el error: avisar, explicar qué pasó sin excusas y proponer cómo corregirlo.",
  },
  {
    comp: "Iniciativa",
    tipo: "conductual",
    foco: "una vez que hizo algo sin que nadie se lo pidiera",
    pregunta: "Contame de una vez que hiciste algo útil sin que nadie te lo pidiera.",
    repregunta:
      "¿Qué viste que hacía falta y qué decidiste hacer por tu cuenta?",
    pista:
      "No tiene que ser trabajo. Puede ser organizar algo, ayudar a alguien, mejorar una tarea o resolver algo en tu casa, colegio o club.",
  },
  {
    comp: "Trato con la gente",
    tipo: "situacional",
    foco: "alguien de mal humor, muy distinto a ella o él, o difícil de atender",
    pregunta:
      "Imaginate que tenés que atender a una persona que viene de mal humor y te habla mal. ¿Cómo la manejarías?",
    repregunta:
      "¿Qué harías si sigue enojada aunque vos le hables con calma?",
    pista:
      "Pensá en mantener la calma, escuchar qué necesita, no discutir y buscar una solución o pedir ayuda si la situación se complica.",
  },
  {
    comp: "Aprendizaje",
    tipo: "conductual",
    foco: "algo que le costó, un error, o una crítica que le hicieron",
    pregunta:
      "Contame de algo que al principio te costaba y después aprendiste a hacer mejor. ¿Qué cambiaste?",
    repregunta:
      "¿Qué hiciste distinto después de darte cuenta de que así no te estaba saliendo?",
    pista:
      "Elegí algo real: una materia, un deporte, una tarea, una crítica que recibiste o un error. Contá qué cambiaste y qué pasó después.",
  },
];

export function labelPuesto(id) {
  return PUESTOS.find((p) => p.id === id)?.label || "Primer empleo";
}
