import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { EntryType, ExternalSource } from "@/lib/types";

/** Lo que devuelve la edge function `metadatos`, igual para todas las fuentes. */
export type ResultadoMetadatos = {
  fuente: ExternalSource;
  id_externo: string;
  titulo: string;
  titulos_alt: string[];
  anio: string | null;
  tapa_url: string | null;
  generos: string[];
  autor?: string;
  votos?: number;
};

export const fuenteLabels: Record<ExternalSource, string> = {
  tmdb: "TMDB",
  anilist: "AniList",
  openlibrary: "Open Library",
  steam: "Steam",
  wikipedia: "Wikipedia",
};

/** Busca en la fuente que corresponde al tipo. Pasa por Supabase con tu sesión. */
export async function buscarMetadatos(tipo: EntryType, q: string, anio?: string): Promise<ResultadoMetadatos[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("La búsqueda necesita Supabase configurado.");

  const { data, error } = await supabase.functions.invoke<{ resultados: ResultadoMetadatos[] }>("metadatos", {
    body: { tipo, q, ...(anio ? { anio } : {}) },
  });
  if (error) {
    // El cuerpo del error trae el motivo (p. ej. "falta el secret TMDB_TOKEN").
    const detalle = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(detalle?.error ?? "No se pudo buscar.");
  }
  return data?.resultados ?? [];
}

/**
 * Alias de géneros: inglés, variantes y errores de tipeo -> el tag en
 * castellano que usa la biblioteca. Algunos de TMDB valen por dos.
 */
export const aliasGeneros: Record<string, string[]> = {
  action: ["accion"],
  adventure: ["aventura"],
  aventurua: ["aventura"],
  avfentura: ["aventura"],
  animation: ["animacion"],
  biography: ["biografia"],
  briografia: ["biografia"],
  "sci-fi": ["ciencia-ficcion"],
  "ciencia-ficcon": ["ciencia-ficcion"],
  comedy: ["comedia"],
  crime: ["crimen"],
  deporte: ["deportes"],
  sport: ["deportes"],
  documentary: ["documental"],
  epic: ["epica"],
  family: ["familia"],
  fantasy: ["fantasia"],
  "game-show": ["reality"],
  "reality-tv": ["reality"],
  history: ["historia"],
  horror: ["terror"],
  misterios: ["misterio"],
  mystery: ["misterio"],
  music: ["musica"],
  politca: ["politica"],
  short: ["cortometraje"],
  spy: ["espionaje"],
  suspense: ["thriller"],
  "thriller-203": ["thriller"],
  war: ["guerra"],
  belica: ["guerra"],
  // Géneros dobles de TMDB para series.
  "action-adventure": ["accion", "aventura"],
  "accion-y-aventura": ["accion", "aventura"],
  "sci-fi-fantasy": ["ciencia-ficcion", "fantasia"],
  "ciencia-ficcion-y-fantasia": ["ciencia-ficcion", "fantasia"],
  "war-politics": ["guerra", "politica"],
  "belica-y-politica": ["guerra", "politica"],
};

/** "Ciencia ficción" -> ["ciencia-ficcion"]; "Action & Adventure" -> ["accion", "aventura"]. */
export function generoATags(genero: string): string[] {
  const tag = generoATag(genero);
  return aliasGeneros[tag] ?? (tag ? [tag] : []);
}

/** "Ciencia ficción" -> "ciencia-ficcion", igual que los tags que ya hay. */
export function generoATag(genero: string) {
  return genero
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
