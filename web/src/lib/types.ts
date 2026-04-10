export type EntryType =
  | "memory"
  | "habit"
  | "movie"
  | "book"
  | "series"
  | "note";

export type EntrySection =
  | "general"
  | "habit"
  | "philosophy"
  | "thought"
  | "anecdote"
  | "movie"
  | "book"
  | "series";

export type LifeEntry = {
  id: string;
  type: EntryType;
  title: string;
  content: string;
  date: string;
  tags: string[];
  section?: EntrySection;
  rating?: number | string;
};

export const entryTypeLabels: Record<EntryType, string> = {
  memory: "Recuerdo",
  habit: "Habito",
  movie: "Pelicula",
  book: "Libro",
  series: "Serie",
  note: "Nota",
};

export const entrySectionLabels: Record<EntrySection, string> = {
  general: "General",
  habit: "Habito",
  philosophy: "Filosofia",
  thought: "Pensamiento",
  anecdote: "Anecdota",
  movie: "Pelicula",
  book: "Libro",
  series: "Serie",
};

export const sectionOptionsByType: Record<EntryType, EntrySection[]> = {
  memory: ["anecdote", "general"],
  habit: ["habit"],
  movie: ["movie"],
  book: ["book"],
  series: ["series"],
  note: ["philosophy", "thought", "general"],
};

export const initialEntries: LifeEntry[] = [
  {
    id: "entry-1",
    type: "memory",
    title: "Nace PrivateLife",
    content:
      "La primera idea toma forma: una app para guardar etapas, habitos, peliculas, libros y recuerdos personales.",
    date: "2026-04-08",
    tags: ["proyecto", "inicio"],
    section: "anecdote",
  },
  {
    id: "entry-2",
    type: "movie",
    title: "Perfect Days",
    content:
      "Vista y anotada como una pelicula que quiero poder recordar junto al contexto de esa semana.",
    date: "2026-04-04",
    tags: ["cine", "favoritas"],
    section: "movie",
  },
  {
    id: "entry-3",
    type: "habit",
    title: "Cepillado nocturno",
    content:
      "Ejemplo de registro cotidiano que luego deberia convertirse en un tracker rapido.",
    date: "2026-04-07",
    tags: ["salud", "rutina"],
    section: "habit",
  },
  {
    id: "entry-4",
    type: "book",
    title: "La tregua",
    content:
      "Libro terminado con la idea de guardar tambien rating, notas y fecha de lectura.",
    date: "2026-03-31",
    tags: ["libros"],
    section: "book",
  },
  {
    id: "entry-5",
    type: "series",
    title: "Twin Peaks",
    content:
      "Serie que quiero ubicar con claridad junto a peliculas y libros dentro del archivo personal.",
    date: "2026-04-02",
    tags: ["series", "favoritas"],
    section: "series",
  },
  {
    id: "entry-6",
    type: "note",
    title: "Sobre la disciplina silenciosa",
    content:
      "Texto filosofico breve sobre sostener procesos largos sin depender del impulso del dia.",
    date: "2026-04-05",
    tags: ["filosofia", "disciplina"],
    section: "philosophy",
  },
  {
    id: "entry-7",
    type: "note",
    title: "Pensamiento suelto de la noche",
    content:
      "Una idea corta para revisar despues sobre el tipo de vida que vale la pena construir.",
    date: "2026-04-06",
    tags: ["pensamientos"],
    section: "thought",
  },
];

export const quickHabits = [
  {
    title: "Cepillado",
    content: "Registro rapido del habito de cepillado.",
    tags: ["salud", "rutina"],
  },
  {
    title: "Ejercicio fisico",
    content: "Registro rapido de actividad fisica hecha hoy.",
    tags: ["salud", "movimiento"],
  },
  {
    title: "Ba\u00f1o",
    content: "Registro rapido para cuando hiciste del 2.",
    tags: ["salud", "cuerpo"],
  },
  {
    title: "Lectura",
    content: "Sesion de lectura registrada desde el panel rapido.",
    tags: ["lectura", "rutina"],
  },
  {
    title: "Dia ordenado",
    content: "Pequeno check de orden, limpieza o tareas personales.",
    tags: ["casa", "rutina"],
  },
] as const;
