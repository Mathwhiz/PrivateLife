import { type LifeEntry } from "@/lib/types";

/** Lo que se puede anotar de un día. */
export type CambiosDia = Partial<Pick<LifeEntry, "animo" | "desperte" | "dormi" | "content">>;

export const diaId = (fecha: string) => `dia-${fecha}`;

export function diaAnterior(fecha: string) {
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const vacio = (e: LifeEntry) => !e.animo && !e.desperte && !e.dormi && !e.content.trim();

/** Aplica cambios al registro de una fecha: lo crea si no existe y lo borra si queda vacío. */
export function actualizarDia(entries: LifeEntry[], fecha: string, cambios: CambiosDia): LifeEntry[] {
  const id = diaId(fecha);
  const actual = entries.find((e) => e.id === id);
  const nuevo: LifeEntry = {
    ...(actual ?? { id, type: "day", title: "Día", content: "", date: fecha, tags: ["dia"], created_at: new Date().toISOString() }),
    ...cambios,
  };
  for (const k of ["animo", "desperte", "dormi"] as const) if (!nuevo[k]) delete nuevo[k];
  const resto = entries.filter((e) => e.id !== id);
  return vacio(nuevo) ? resto : [nuevo, ...resto];
}

/** Minutos de sueño entre la hora en que te dormiste (noche anterior) y la que te despertaste. */
export function minutosDormidos(dormi?: string, desperte?: string) {
  if (!dormi || !desperte) return null;
  const m = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
  // Antes del mediodía = ya era el día siguiente (ej.: 01:15).
  const inicio = m(dormi) >= 12 * 60 ? m(dormi) - 24 * 60 : m(dormi);
  const total = m(desperte) - inicio;
  return total > 0 && total < 20 * 60 ? total : null;
}

export const horasYMinutos = (min: number) => `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`;

export const CARAS = ["😞", "🙁", "😐", "🙂", "😄"];
