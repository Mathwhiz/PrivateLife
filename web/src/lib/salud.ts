import { getSupabaseBrowserClient } from "@/lib/supabase";

// Registro de comidas, movimiento y peso. Vive en una planilla de Google que
// Claude va completando; la app solo la lee (edge function `salud`).
// Columnas: Bloque | Fecha | Hora | Momento | Que comi/tome | Calorias aprox |
//           Proteina | Verdura | Notas

export type TipoItem = "comida" | "ejercicio" | "pesaje" | "bano" | "total" | "otro";

export type ItemSalud = {
  tipo: TipoItem;
  momento: string;
  hora: string;
  que: string;
  kcal: number | null;
  proteina: string;
  verdura: string;
  notas: string;
};

export type DiaSalud = {
  /** "DIA 23", o la fecha si la fila no trae bloque. Dos bloques pueden caer el mismo día. */
  clave: string;
  fecha: string;
  bloque: string;
  items: ItemSalud[];
  /** Suma de lo que comiste ese día (sin ejercicio). */
  kcalComidas: number;
  /** Lo quemado, en positivo. */
  kcalEjercicio: number;
  peso: number | null;
  /** La fila TOTAL que escribe Claude, si hay. */
  total: ItemSalud | null;
};

const MOMENTOS_COMIDA = /^(desayuno|almuerzo|merienda|cena|postre|bebida|snack|comida|varios)/;

export function clasificar(momento: string): TipoItem {
  const m = momento
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
  if (m.startsWith("total")) return "total";
  if (m.startsWith("pesaje")) return "pesaje";
  if (m.startsWith("ejercicio")) return "ejercicio";
  if (m.startsWith("bano")) return "bano";
  if (MOMENTOS_COMIDA.test(m)) return "comida";
  return "otro";
}

/** "~1900", "-125", "300-400", "~1234 (parcial)" -> número. Un rango da el promedio. */
export function leerNumero(texto: string): number | null {
  const limpio = texto.replace(/~/g, "").replace(/,/g, ".").trim();
  const rango = limpio.match(/^(-?\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (rango) {
    const a = Number(rango[1]);
    const b = Number(rango[2]) * Math.sign(a || 1);
    return (a + b) / 2;
  }
  const uno = limpio.match(/-?\d+(?:\.\d+)?/);
  return uno ? Number(uno[0]) : null;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const numeroDeDia = (bloque: string) => bloque.match(/^DIA\s+(\d+)/i)?.[1] ?? null;

/** Convierte las filas crudas (con encabezado) en días ordenados del más nuevo al más viejo. */
export function armarDias(filas: string[][]): DiaSalud[] {
  const vistas = new Set<string>();
  const datos = filas
    .slice(1)
    .map((f) => Array.from({ length: 9 }, (_, i) => (f[i] ?? "").trim()))
    .filter((f) => f.some(Boolean))
    // La planilla tiene alguna fila repetida tal cual: se cuenta una vez.
    .filter((f) => {
      const clave = f.join("\u0001");
      if (vistas.has(clave)) return false;
      vistas.add(clave);
      return true;
    });

  // Las filas TOTAL no traen fecha: se ubican por el número de "DIA N".
  const fechaPorDia = new Map<string, string>();
  for (const f of datos) {
    const n = numeroDeDia(f[0]);
    if (n && FECHA.test(f[1]) && !fechaPorDia.has(n)) fechaPorDia.set(n, f[1]);
  }

  const dias = new Map<string, DiaSalud>();
  let sinFecha: ItemSalud[] = [];
  let ultima: string | null = null;

  const dia = (clave: string, fecha: string, bloque: string) => {
    let d = dias.get(clave);
    if (!d) {
      d = { clave, fecha, bloque, items: [], kcalComidas: 0, kcalEjercicio: 0, peso: null, total: null };
      dias.set(clave, d);
    }
    return d;
  };

  for (const [bloque, fechaCol, hora, momento, que, kcal, proteina, verdura, notas] of datos) {
    // Se agrupa por "DIA N" y no por fecha: lo que comiste a las 3 de la mañana
    // tiene la fecha del día siguiente pero es parte del mismo día despierto.
    const n = numeroDeDia(bloque);
    const fecha = (n && fechaPorDia.get(n)) || (FECHA.test(fechaCol) ? fechaCol : null);
    const item: ItemSalud = {
      tipo: clasificar(momento),
      momento: momento || (bloque.startsWith(">>>") ? bloque.replace(/^>+\s*/, "") : ""),
      hora,
      que,
      kcal: leerNumero(kcal),
      proteina,
      verdura,
      notas,
    };

    if (!fecha) {
      // Avisos sueltos (">>> PLAN NUEVO…"): van al próximo día con fecha.
      sinFecha.push(item);
      continue;
    }

    const clave = n ? `DIA ${n}` : fecha;
    const d = dia(clave, fecha, bloque);
    d.items.push(...sinFecha, item);
    sinFecha = [];
    ultima = clave;
  }
  if (sinFecha.length && ultima) dias.get(ultima)!.items.push(...sinFecha);

  for (const d of dias.values()) {
    for (const it of d.items) {
      if (it.tipo === "comida" && it.kcal) d.kcalComidas += it.kcal;
      if (it.tipo === "ejercicio" && it.kcal) d.kcalEjercicio += Math.abs(it.kcal);
      if (it.tipo === "pesaje") d.peso = leerNumero(it.que);
      if (it.tipo === "total") d.total = it;
    }
  }

  const orden = (d: DiaSalud) => Number(d.clave.match(/^DIA (\d+)/)?.[1] ?? -1);
  return [...dias.values()].sort((a, b) => b.fecha.localeCompare(a.fecha) || orden(b) - orden(a));
}

const CACHE = "private-life.salud.v1";

export type RegistroSalud = { filas: string[][]; actualizado: string };

export function leerCache(): RegistroSalud | null {
  try {
    const raw = localStorage.getItem(CACHE);
    return raw ? (JSON.parse(raw) as RegistroSalud) : null;
  } catch {
    return null;
  }
}

/** Trae la planilla por la edge function `salud` (pide sesión de dueño). */
export async function traerRegistro(): Promise<RegistroSalud> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Salud necesita Supabase configurado.");

  const { data, error } = await supabase.functions.invoke<RegistroSalud>("salud", { method: "GET" });
  if (error || !data) {
    const detalle = await (error as { context?: Response } | null)?.context?.json?.().catch(() => null);
    throw new Error(detalle?.error ?? "No se pudo leer la planilla.");
  }
  try {
    localStorage.setItem(CACHE, JSON.stringify(data));
  } catch {
    /* sin espacio o bloqueado: igual se muestra */
  }
  return data;
}
