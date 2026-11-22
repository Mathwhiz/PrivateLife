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
