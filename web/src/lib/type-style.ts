import { entrySectionLabels, entryTypeLabels, type LifeEntry } from "@/lib/types";

/**
 * Identidad visual de cada tipo de entrada: un color fijo por tipo (nunca por
 * posición), usado en puntos y chips. El texto siempre va en tinta normal.
 */
export type TypeKey = "movie" | "series" | "anime" | "book" | "manga" | "game" | "note" | "memory" | "milestone" | "habit";

export const typeColor: Record<TypeKey, string> = {
  movie: "var(--accent)",
  series: "var(--sky)",
  anime: "var(--rose)",
  book: "var(--sage)",
  manga: "var(--violet)",
  game: "var(--teal)",
  note: "var(--sage)",
  memory: "var(--rose)",
  milestone: "var(--gold)",
  habit: "var(--muted)",
};

export function typeKeyOf(entry: LifeEntry): TypeKey {
  if (entry.type === "memory" && entry.tags.includes("milestone")) return "milestone";
  return entry.type as TypeKey;
}

export function typeLabelOf(entry: LifeEntry): string {
  const key = typeKeyOf(entry);
  if (key === "milestone") return "Hito";
  if (key === "memory") return "Recuerdo";
  if (key === "note") return entrySectionLabels[entry.section ?? "general"];
  return entryTypeLabels[entry.type];
}

// ─── Color por sección y por ítem ─────────────────────────────────────
// Se aplican redefiniendo --accent: todo lo que usa el acento (menú,
// filtros, barras, mapas de calor, gráficos) toma ese color solo.

const HEX = {
  ambar: "#c8905a",
  cielo: "#5f9fdc",
  agua: "#3fb0aa",
  verde: "#6aa47e",
  oro: "#c8aa5a",
  rosa: "#c96f6f",
  violeta: "#a083dc",
  coral: "#e07a5f",
} as const;

export const sectionColor: Record<string, string> = {
  hoy: HEX.ambar,
  habits: HEX.agua,
  library: HEX.cielo,
  vida: HEX.oro,
  salud: HEX.verde,
  resumen: HEX.violeta,
  ajustes: HEX.ambar,
};

export const cardColor = HEX;

const paletaItems = [HEX.ambar, HEX.cielo, HEX.agua, HEX.verde, HEX.oro, HEX.rosa, HEX.violeta, HEX.coral];

/** Color fijo de un ítem del Registro, siempre el mismo para el mismo nombre. */
export function itemColor(title: string) {
  let h = 0;
  for (const c of title.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return paletaItems[h % paletaItems.length];
}

/** Color fijo de cada grupo del Registro; los que no están acá salen del nombre, como los ítems. */
const coloresGrupo: Record<string, string> = {
  jw: HEX.violeta,
  vicio: HEX.coral,
  ejercicio: HEX.verde,
  "del día": HEX.cielo,
  entretenimiento: HEX.agua,
  dientes: HEX.oro,
};

export function grupoColor(nombre: string) {
  return coloresGrupo[nombre.toLowerCase()] ?? itemColor(nombre);
}

/** Estilo que pinta un bloque (y todo lo de adentro) con ese color de acento. */
export function acento(hex: string) {
  return { "--accent": hex, "--accent-soft": `${hex}26` } as React.CSSProperties;
}
