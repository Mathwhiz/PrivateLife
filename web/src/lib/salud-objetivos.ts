// Objetivos de Salud. Los valores por defecto son los que figuran en la
// planilla (objetivo 1500-1600 kcal, mantenimiento ~1900-2000, meta 61 kg).
// Se guardan en este dispositivo.

export type Objetivos = { kcalMin: number; kcalMax: number; mantenimiento: number; metaKg: number };

export const objetivosPorDefecto: Objetivos = { kcalMin: 1500, kcalMax: 1600, mantenimiento: 1950, metaKg: 61 };

const CLAVE = "private-life.salud.objetivos.v1";

export function leerObjetivos(): Objetivos {
  try {
    const raw = localStorage.getItem(CLAVE);
    return raw ? { ...objetivosPorDefecto, ...(JSON.parse(raw) as Partial<Objetivos>) } : objetivosPorDefecto;
  } catch {
    return objetivosPorDefecto;
  }
}

export function guardarObjetivos(o: Objetivos) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(o));
  } catch {
    /* sin storage: vale para esta visita */
  }
}

type Pesaje = { fecha: string; kg: number };
export type Semana = { inicio: string; kg: number; n: number };

/** Lunes de la semana de esa fecha (YYYY-MM-DD). */
function lunes(fecha: string) {
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Promedio de peso por semana (lunes a domingo): saca el ruido de agua y sal de cada día. */
export function promediosSemanales(pesos: Pesaje[]): Semana[] {
  const grupos = new Map<string, number[]>();
  for (const p of pesos) grupos.set(lunes(p.fecha), [...(grupos.get(lunes(p.fecha)) ?? []), p.kg]);
  return [...grupos.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([inicio, kgs]) => ({ inicio, kg: kgs.reduce((s, k) => s + k, 0) / kgs.length, n: kgs.length }));
}

export type Proyeccion = { kgPorSemana: number; llegada: string | null; semanasUsadas: number };

/**
 * Ritmo de las últimas 8 semanas (recta por mínimos cuadrados sobre los
 * promedios semanales) y, si baja, cuándo llegaría a la meta a ese ritmo.
 */
export function proyectar(semanas: Semana[], metaKg: number): Proyeccion | null {
  const ultimas = semanas.slice(-8);
  if (ultimas.length < 3) return null;
  const t0 = new Date(`${ultimas[0].inicio}T12:00:00`).getTime();
  const xs = ultimas.map((s) => (new Date(`${s.inicio}T12:00:00`).getTime() - t0) / (7 * 86_400_000));
  const ys = ultimas.map((s) => s.kg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  if (den === 0) return null;
  const pendiente = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / den;
  const actual = my + pendiente * (xs.at(-1)! - mx);

  let llegada: string | null = null;
  if (pendiente < -0.01 && actual > metaKg) {
    const semanasFaltan = (actual - metaKg) / -pendiente;
    const d = new Date(`${ultimas.at(-1)!.inicio}T12:00:00`);
    d.setDate(d.getDate() + Math.round(semanasFaltan * 7));
    llegada = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return { kgPorSemana: pendiente, llegada, semanasUsadas: ultimas.length };
}
