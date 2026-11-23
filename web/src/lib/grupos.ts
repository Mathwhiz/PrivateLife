import { type HabitCatalogItem } from "@/lib/use-habits";

/**
 * Grupos del Registro: varios ítems que se muestran en una sola fila con un tick
 * cada uno (ej.: Dientes 1·2·3, JW con Estudiar/Leer/Escribir). Cada tick sigue
 * siendo su propio ítem, así que las estadísticas y el historial no cambian.
 * El grupo se guarda como etiqueta "grupo:<Nombre>" en la plantilla del ítem.
 */
export const GRUPO_PREFIJO = "grupo:";
/** Ítems que ya no se usan: siguen con sus estadísticas pero no aparecen para marcar. */
export const ARCHIVADO = "archivado";

export function grupoDe(item: { tags: string[] }) {
  return item.tags.find((t) => t.startsWith(GRUPO_PREFIJO))?.slice(GRUPO_PREFIJO.length).trim() || null;
}

/** "marca:Leer" en la plantilla de Libro: marcar Libro marca también Leer (y desmarcarlo lo desmarca). */
export const MARCA_PREFIJO = "marca:";
export const tambienMarca = (item: { tags: string[] }) =>
  item.tags.filter((t) => t.startsWith(MARCA_PREFIJO)).map((t) => t.slice(MARCA_PREFIJO.length).trim()).filter(Boolean);

/** Etiquetas que configuran el ítem: viven solo en la plantilla, nunca se copian a cada registro. */
export const esEtiquetaDePlantilla = (tag: string) =>
  tag === ARCHIVADO || tag.startsWith(GRUPO_PREFIJO) || tag.startsWith(MARCA_PREFIJO);

export const esArchivado = (item: { tags: string[] }) => item.tags.includes(ARCHIVADO);

const ORDEN_GRUPOS = ["jw", "ejercicio", "social", "entretenimiento", "vicio", "del día", "dientes"];

export type FilaRegistro =
  | { tipo: "solo"; item: HabitCatalogItem }
  | { tipo: "grupo"; nombre: string; items: { item: HabitCatalogItem; etiqueta: string }[] };

/** Nombre corto de cada tick: si todos repiten el nombre del primero ("… 2", "… 3"), quedan 1, 2, 3. */
function etiquetas(items: HabitCatalogItem[], grupo: string) {
  const base = items[0].title;
  const repetidos = items.every((it) => it.title.startsWith(base));
  if (!repetidos || items.length < 2) {
    // "Leer JW" dentro del grupo JW se ve como "Leer" (el grupo ya lo dice).
    const sinGrupo = new RegExp(`\\s*\\b${grupo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b\\s*`, "i");
    return items.map((it) => it.title.replace(sinGrupo, " ").trim() || it.title);
  }
  return items.map((it, i) => it.title.slice(base.length).trim() || String(i + 1));
}

/** Arma las filas: primero los grupos (en el orden de su primer ítem), después los sueltos. */
export function armarFilas(catalogo: HabitCatalogItem[]): FilaRegistro[] {
  const porGrupo = new Map<string, HabitCatalogItem[]>();
  for (const item of catalogo) {
    const g = grupoDe(item);
    if (g) porGrupo.set(g, [...(porGrupo.get(g) ?? []), item]);
  }
  const filas: FilaRegistro[] = [];
  const puestos = new Set<string>();
  for (const item of catalogo) {
    const g = grupoDe(item);
    if (!g) {
      filas.push({ tipo: "solo", item });
      continue;
    }
    if (puestos.has(g)) continue;
    puestos.add(g);
    // Orden fijo: primero el que se llama como el grupo (JW → Jw), después por nombre ("… 2" antes de "… 3").
    const cabeza = (t: string) => (t.toLowerCase() === g.toLowerCase() ? 0 : 1);
    const items = [...porGrupo.get(g)!].sort(
      (a, b) => cabeza(a.title) - cabeza(b.title) || a.title.localeCompare(b.title, "es", { numeric: true }),
    );
    const nombres = etiquetas(items, g);
    filas.push({ tipo: "grupo", nombre: g, items: items.map((item, i) => ({ item, etiqueta: nombres[i] })) });
  }
  // Los grupos ocupan todo el ancho: arriba, para no dejar huecos entre los sueltos.
  // Orden fijo (igual en Hoy y en Registro); los grupos nuevos van al final.
  const lugar = (f: FilaRegistro) => {
    const i = f.tipo === "grupo" ? ORDEN_GRUPOS.indexOf(f.nombre.toLowerCase()) : -1;
    return i === -1 ? ORDEN_GRUPOS.length : i;
  };
  const grupos = filas.filter((f) => f.tipo === "grupo").sort((a, b) => lugar(a) - lugar(b));
  return [...grupos, ...filas.filter((f) => f.tipo === "solo")];
}
