// Datos que usan tanto el navegador como el servidor.
// Acá no va nada secreto: los prompts viven en lib/prompts.js, que solo corre en el servidor.

export const MAX_TURNOS = 11;
export const MIN_CARACTERES = 140;

export const PUESTOS = [
  { id: "atencion", label: "Atención al cliente" },
  { id: "gastronomia", label: "Gastronomía" },
  { id: "retail", label: "Local / retail" },
  { id: "admin", label: "Administrativo" },
  { id: "pasantia", label: "Pasantía" },
  { id: "general", label: "Primer empleo en general" },
];

// Guion estructurado: las mismas 8 preguntas, en el mismo orden, para todos.
export const PLAN = [
  {
    comp: "Desarrollo personal",
    tipo: "apertura",
    foco: "quién es, qué viene haciendo y por qué le interesa este trabajo",
  },
  {
    comp: "Trabajo en equipo",
    tipo: "conductual",
    foco: "una vez que hizo algo junto con otras personas",
  },
  {
    comp: "Comunicación",
    tipo: "conductual",
    foco: "una vez que tuvo que explicarle algo a alguien, o pedir ayuda",
  },
  {
    comp: "Pensamiento crítico",
    tipo: "situacional",
    foco: "un problema chico del puesto, sin nadie cerca a quien preguntarle",
  },
  {
    comp: "Profesionalismo",
    tipo: "situacional",
    foco: "llegar tarde, un error propio, o algo que no le corresponde hacer",
  },
  {
    comp: "Iniciativa",
    tipo: "conductual",
    foco: "una vez que hizo algo sin que nadie se lo pidiera",
  },
  {
    comp: "Trato con la gente",
    tipo: "situacional",
    foco: "alguien de mal humor, muy distinto a ella o él, o difícil de atender",
  },
  {
    comp: "Aprendizaje",
    tipo: "conductual",
    foco: "algo que le costó, un error, o una crítica que le hicieron",
  },
];

export const NIVELES = {
  1: "Todavía no se ve",
  2: "Asoma",
  3: "Se ve claro",
  4: "Sólido",
};

export function labelPuesto(id) {
  return PUESTOS.find((p) => p.id === id)?.label || "Primer empleo";
}
