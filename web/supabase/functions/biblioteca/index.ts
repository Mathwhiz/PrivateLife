// Endpoint de SOLO LECTURA de la biblioteca (pelis, series, anime, manga, libros, juegos).
// Existe para que agentes externos (rutinas de Claude en la nube) puedan leer qué vi
// y qué nota le puse, sin darles la service_role ni el resto del payload
// (hábitos, notas, recuerdos no salen por acá).
//
// Uso:  GET /functions/v1/biblioteca?t=<BIBLIOTECA_TOKEN>
// Desplegar con --no-verify-jwt (el token propio es la única llave).

const TIPOS = new Set(["movie", "series", "anime", "manga", "book", "game"]);
// Tags de importación que no dicen nada del gusto; se filtran para achicar la respuesta.
const RUIDO = new Set([
  "imported", "rated", "life-xlsx", "imdb", "approx-date", "jkanime", "steam",
  "movie", "series", "anime", "manga", "book", "game",
]);

Deno.serve(async (req) => {
  const esperado = Deno.env.get("BIBLIOTECA_TOKEN");
  const t = new URL(req.url).searchParams.get("t") ?? req.headers.get("x-token");
  if (!esperado || !t || t !== esperado) {
    return new Response("no autorizado", { status: 401 });
  }

  const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const r = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/rest/v1/private_life_state?id=eq.default&select=payload,updated_at`,
    { headers: { apikey: srk, Authorization: `Bearer ${srk}` } },
  );
  if (!r.ok) return new Response("error leyendo la base", { status: 502 });
  const [fila] = await r.json();

  const items = (fila?.payload?.entries ?? [])
    .filter((e: any) => TIPOS.has(e.type))
    .map((e: any) => ({
      tipo: e.type,
      titulo: e.title,
      nota: e.rating != null && e.rating !== "" ? Number(e.rating) : null,
      fecha: e.date ?? null,
      anio: e.release_year ?? null,
      generos: (e.tags ?? []).filter((x: string) => !RUIDO.has(x)),
      ...(e.playtime_hours != null ? { horas: e.playtime_hours } : {}),
      ...(e.cover_url ? { tapa: e.cover_url } : {}),
    }));

  return Response.json(
    { actualizado: fila?.updated_at ?? null, total: items.length, items },
    { headers: { "cache-control": "no-store" } },
  );
});
