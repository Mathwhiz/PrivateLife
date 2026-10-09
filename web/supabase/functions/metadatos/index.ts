// Buscador de metadatos para la biblioteca (tapa, año, géneros, id externo).
// Normaliza TMDB, AniList, Open Library y la tienda de Steam a un mismo formato:
//   { fuente, id_externo, titulo, titulos_alt, anio, tapa_url, generos, autor?, votos? }
//
// Uso:  GET  /functions/v1/metadatos?tipo=movie&q=Margin%20Call&anio=2011
//       POST /functions/v1/metadatos  { "tipo": "game", "appid": 730 }
// Pide Authorization: Bearer <JWT del usuario logueado> (o la service_role, para
// tools/enriquecer_biblioteca.py). Desplegar con --no-verify-jwt: el chequeo se
// hace acá para poder responder el preflight de CORS.
// Secret necesario: TMDB_TOKEN (API Read Access Token de TMDB).

type Resultado = {
  fuente: "tmdb" | "anilist" | "openlibrary" | "steam";
  id_externo: string;
  titulo: string;
  titulos_alt: string[];
  anio: string | null;
  tapa_url: string | null;
  generos: string[];
  autor?: string;
  /** Solo TMDB: sirve para desempatar títulos repetidos (un corto vs. la película). */
  votos?: number;
};

const MAX = 8;
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

class ErrorFuente extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { ...CORS, "cache-control": "no-store" } });
}

async function autorizado(req: Request): Promise<boolean> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return false;

  const llaves = [Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")];
  try {
    llaves.push(...Object.values<string>(JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}")));
  } catch { /* formato inesperado: solo queda la service_role clásica */ }
  if (llaves.includes(token)) return true;

  const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
    headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY")!, Authorization: `Bearer ${token}` },
  });
  return r.ok;
}

const anio = (fecha?: string | null) => (fecha ? fecha.slice(0, 4) : null) || null;
const unicos = (xs: (string | null | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))];

// --- TMDB ---------------------------------------------------------------------

const generosTmdb: Record<string, Map<number, string>> = {};

async function tmdb(path: string) {
  const token = Deno.env.get("TMDB_TOKEN");
  if (!token) throw new ErrorFuente(503, "falta el secret TMDB_TOKEN");
  const r = await fetch(`https://api.themoviedb.org/3/${path}`, {
    headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (!r.ok) throw new ErrorFuente(r.status === 429 ? 429 : 502, `TMDB respondió ${r.status}`);
  return r.json();
}

async function generosDe(clase: "movie" | "tv") {
  if (!generosTmdb[clase]) {
    const { genres } = await tmdb(`genre/${clase}/list?language=es`);
    generosTmdb[clase] = new Map(genres.map((g: { id: number; name: string }) => [g.id, g.name]));
  }
  return generosTmdb[clase];
}

async function buscarTmdb(clase: "movie" | "tv", q: string, year: string | null): Promise<Resultado[]> {
  const filtroAnio = clase === "movie" ? "year" : "first_air_date_year";
  const base = `search/${clase}?language=en-US&include_adult=false&query=${encodeURIComponent(q)}`;
  let { results } = await tmdb(year ? `${base}&${filtroAnio}=${year}` : base);
  // El año del registro a veces difiere en uno del de TMDB: si no hubo nada, sin filtro.
  if (year && !results.length) ({ results } = await tmdb(base));
  const generos = await generosDe(clase);

  return results.slice(0, MAX).map((m: any) => ({
    fuente: "tmdb",
    id_externo: `${clase}/${m.id}`,
    titulo: m.title ?? m.name,
    titulos_alt: unicos([m.original_title ?? m.original_name]),
    anio: anio(m.release_date ?? m.first_air_date),
    tapa_url: m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : null,
    generos: (m.genre_ids ?? []).map((id: number) => generos.get(id)).filter(Boolean),
    votos: m.vote_count ?? 0,
  }));
}

// --- AniList ------------------------------------------------------------------

const GENEROS_ANILIST: Record<string, string> = {
  Action: "Acción", Adventure: "Aventura", Comedy: "Comedia", Drama: "Drama", Ecchi: "Ecchi",
  Fantasy: "Fantasía", Hentai: "Hentai", Horror: "Terror", "Mahou Shoujo": "Mahou shoujo",
  Mecha: "Mecha", Music: "Música", Mystery: "Misterio", Psychological: "Psicológico",
  Romance: "Romance", "Sci-Fi": "Ciencia ficción", "Slice of Life": "Recuentos de la vida",
  Sports: "Deportes", Supernatural: "Sobrenatural", Thriller: "Suspense",
};

const QUERY_ANILIST = `query ($q: String, $tipo: MediaType) {
  Page(perPage: ${MAX}) {
    media(search: $q, type: $tipo, sort: SEARCH_MATCH, isAdult: false) {
      id title { romaji english native } synonyms startDate { year } coverImage { large } genres
    }
  }
}`;

// Los títulos de JKAnime vienen en romaji o en español y a veces con la temporada
// pegada: si la búsqueda literal no encuentra nada, probamos versiones recortadas.
// AniList busca casi palabra por palabra ("Russia-go" no encuentra "Rossiya-go"),
// así que el último intento son las primeras palabras, que suelen ser únicas.
function variantesAnime(q: string) {
  const limpio = q.replace(/\s*\((TV|OVA|ONA)\)/gi, "").trim();
  const sinTemporada = limpio
    .replace(/\b(\d+(st|nd|rd|th)|second|third|fourth|final)\s+season\b.*$/i, "")
    .replace(/\b(season|temporada|part|parte|cour)\s*\d+.*$/i, "")
    .replace(/\s+(S\d+|II|III|IV|V|\d)(\s+OVA)?\s*$/i, "")
    .trim();
  const antesDeDosPuntos = sinTemporada.split(/[:：,]/)[0].trim();
  const primerasPalabras = antesDeDosPuntos.split(/\s+/).slice(0, 3).join(" ");
  return unicos([q, limpio, sinTemporada, antesDeDosPuntos, primerasPalabras]).filter((v) => v.length >= 3);
}

async function buscarAnilist(tipo: "ANIME" | "MANGA", q: string): Promise<Resultado[]> {
  for (const variante of variantesAnime(q)) {
    const r = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ query: QUERY_ANILIST, variables: { q: variante, tipo } }),
    });
    if (r.status === 429) throw new ErrorFuente(429, "AniList: demasiados pedidos");
    if (!r.ok) throw new ErrorFuente(502, `AniList respondió ${r.status}`);
    const media = (await r.json()).data?.Page?.media ?? [];
    if (!media.length) continue;

    return media.map((m: any) => {
      const titulo = m.title.romaji ?? m.title.english ?? m.title.native;
      return {
        fuente: "anilist",
        id_externo: `${m.id}`,
        titulo,
        titulos_alt: unicos([m.title.english, m.title.native, ...(m.synonyms ?? [])]).filter((t) => t !== titulo),
        anio: m.startDate?.year ? `${m.startDate.year}` : null,
        tapa_url: m.coverImage?.large ?? null,
        generos: (m.genres ?? []).map((g: string) => GENEROS_ANILIST[g] ?? g),
      };
    });
  }
  return [];
}

// --- Open Library -------------------------------------------------------------

async function buscarOpenLibrary(q: string): Promise<Resultado[]> {
  const campos = "key,title,author_name,first_publish_year,cover_i";
  const r = await fetch(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&fields=${campos}&limit=${MAX}&lang=es`,
    { headers: { "user-agent": "PrivateLife (biblioteca personal)" } },
  );
  if (!r.ok) throw new ErrorFuente(502, `Open Library respondió ${r.status}`);
  const { docs } = await r.json();

  return docs.map((d: any) => ({
    fuente: "openlibrary",
    id_externo: d.key, // "/works/OL...W"
    titulo: d.title,
    titulos_alt: [],
    anio: d.first_publish_year ? `${d.first_publish_year}` : null,
    tapa_url: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : null,
    generos: [],
    ...(d.author_name?.length ? { autor: d.author_name.slice(0, 2).join(", ") } : {}),
  }));
}

// --- Steam --------------------------------------------------------------------

const STEAM_CDN = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps";

// La tapa vertical no existe para todos los juegos (sobre todo los viejos): si falta,
// usamos el header horizontal. Los juegos nuevos lo tienen en una ruta con hash que
// solo da appdetails, así que si la ruta clásica falla le preguntamos a la tienda.
async function tapaSteam(appid: number) {
  for (const archivo of ["library_600x900.jpg", "header.jpg"]) {
    const url = `${STEAM_CDN}/${appid}/${archivo}`;
    if ((await fetch(url, { method: "HEAD" })).ok) return url;
  }
  const r = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&filters=basic`);
  return r.ok ? ((await r.json())[appid]?.data?.header_image ?? null) : null;
}

async function buscarSteam(q: string): Promise<Resultado[]> {
  const r = await fetch(
    `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(q)}&l=spanish&cc=AR`,
  );
  if (!r.ok) throw new ErrorFuente(502, `Steam respondió ${r.status}`);
  const items = ((await r.json()).items ?? []).filter((i: any) => i.type === "app").slice(0, MAX);

  return Promise.all(items.map(async (i: any) => ({
    fuente: "steam" as const,
    id_externo: `${i.id}`,
    titulo: i.name,
    titulos_alt: [],
    anio: null,
    tapa_url: await tapaSteam(i.id),
    generos: [],
  })));
}

async function porAppid(appid: number): Promise<Resultado[]> {
  const r = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&l=spanish&cc=AR`);
  const datos = r.ok ? (await r.json())[appid]?.data : null;
  return [{
    fuente: "steam",
    id_externo: `${appid}`,
    titulo: datos?.name ?? "",
    titulos_alt: [],
    anio: datos?.release_date?.date?.match(/\d{4}/)?.[0] ?? null,
    tapa_url: await tapaSteam(appid),
    generos: (datos?.genres ?? []).map((g: { description: string }) => g.description),
  }];
}

// -----------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (!(await autorizado(req))) return json({ error: "no autorizado" }, 401);

  const params = Object.fromEntries(new URL(req.url).searchParams);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const { tipo, q = "", anio: year = null, appid } = { ...params, ...body };
  const texto = `${q}`.trim();

  try {
    let resultados: Resultado[];
    if (tipo === "game" && appid) resultados = await porAppid(Number(appid));
    else if (!texto) return json({ error: "falta q" }, 400);
    else if (tipo === "movie") resultados = await buscarTmdb("movie", texto, year ? `${year}` : null);
    else if (tipo === "series") resultados = await buscarTmdb("tv", texto, year ? `${year}` : null);
    else if (tipo === "anime") resultados = await buscarAnilist("ANIME", texto);
    else if (tipo === "manga") resultados = await buscarAnilist("MANGA", texto);
    else if (tipo === "book") resultados = await buscarOpenLibrary(texto);
    else if (tipo === "game") resultados = await buscarSteam(texto);
    else return json({ error: `tipo desconocido: ${tipo}` }, 400);
    return json({ resultados });
  } catch (error) {
    const status = error instanceof ErrorFuente ? error.status : 500;
    return json({ error: error instanceof Error ? error.message : "error" }, status);
  }
});
