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

/** "Ciencia ficción" -> "ciencia-ficcion", igual que los tags que ya hay. */
export function generoATag(genero: string) {
  return genero
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
