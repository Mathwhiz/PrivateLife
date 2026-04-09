export const timelineEntries = [
  {
    date: "08 abr 2026",
    title: "Nace PrivateLife",
    kind: "Hito",
    note:
      "La primera idea toma forma: una app para recordar etapas, hábitos, personas y cosas vistas.",
  },
  {
    date: "15 feb 2026",
    title: "Relectura con notas",
    kind: "Libro",
    note:
      "Terminaste un libro y anotaste por qué ese momento de tu vida hizo que lo entendieras distinto.",
  },
  {
    date: "03 ene 2026",
    title: "Cambio de rutina",
    kind: "Hábito",
    note:
      "Empezaste a registrar energía, sueño y ejercicio en el mismo lugar en vez de repartirlo entre apps.",
  },
] as const;

export const todayCards = [
  { label: "Racha de cepillado", value: "118 días", hint: "Registro diario consistente" },
  { label: "Última película", value: "Perfect Days", hint: "Vista el 4 abr 2026" },
  { label: "Último libro", value: "La tregua", hint: "Marcado como terminado" },
  { label: "Memorias guardadas", value: "284", hint: "Entre anécdotas, notas y hitos" },
] as const;

export const modules = [
  {
    name: "Timeline de vida",
    description:
      "Una línea temporal unificada para recuerdos, hitos, películas, libros y hábitos importantes.",
  },
  {
    name: "Hábitos y cuerpo",
    description:
      "Logs rápidos para lo cotidiano, con métricas simples y notas contextuales.",
  },
  {
    name: "Consumo cultural",
    description:
      "Historial de películas, libros, series o música con fecha, rating y comentario personal.",
  },
  {
    name: "Personas y lugares",
    description:
      "Fichas enlazadas para encontrar todo lo vivido con alguien o en una etapa concreta.",
  },
] as const;

export const memories = [
  {
    title: "Tarde de lluvia y cine",
    meta: "Recuerdo · con X persona · Buenos Aires",
    excerpt:
      "Una anécdota breve con tono emocional. Este tipo de entrada será el corazón de la app.",
  },
  {
    title: "Etapa universitaria",
    meta: "Etapa · 2018 a 2022",
    excerpt:
      "Una vista agregada donde puedas ver libros, fotos, personas, lugares y eventos conectados.",
  },
] as const;
