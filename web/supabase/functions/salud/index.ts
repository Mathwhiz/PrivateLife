// Lee el registro de comidas / movimiento / peso de la planilla de Google.
// La planilla expone sus filas con un Apps Script publicado como web app
// (ver web/supabase/apps-script/registro-salud.gs); esta función le pasa el
// token, así ni la URL ni el token quedan en el bundle público de la app.
//
// Uso:  GET /functions/v1/salud   (Authorization: Bearer <JWT de un dueño>)
// Desplegar con --no-verify-jwt: el chequeo se hace acá para responder el
// preflight de CORS.
// Secrets: SALUD_SCRIPT_URL (URL /exec del Apps Script) y SALUD_SCRIPT_TOKEN.

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { ...CORS, "cache-control": "no-store" } });
}

/** Solo dueños: una sesión cualquiera no alcanza (igual que las políticas RLS). */
async function esDueno(req: Request): Promise<boolean> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return false;

  const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/is_private_life_owner`, {
    method: "POST",
    headers: {
      apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: "{}",
  });
  return r.ok && (await r.json()) === true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (!(await esDueno(req))) return json({ error: "no autorizado" }, 401);

  const url = Deno.env.get("SALUD_SCRIPT_URL");
  const token = Deno.env.get("SALUD_SCRIPT_TOKEN");
  if (!url || !token) return json({ error: "faltan los secrets SALUD_SCRIPT_URL / SALUD_SCRIPT_TOKEN" }, 503);

  // Apps Script responde con un redirect a googleusercontent.com: fetch lo sigue.
  const r = await fetch(`${url}?token=${encodeURIComponent(token)}`);
  if (!r.ok) return json({ error: `la planilla respondió ${r.status}` }, 502);

  let datos: { filas?: unknown; actualizado?: string; error?: string };
  try {
    datos = await r.json();
  } catch {
    // Sin permisos o script mal publicado: Google devuelve una página HTML.
    return json({ error: "la planilla no devolvió JSON (¿el script está publicado para «Cualquier persona»?)" }, 502);
  }
  if (datos.error || !Array.isArray(datos.filas)) {
    return json({ error: `la planilla dijo: ${datos.error ?? "formato inesperado"}` }, 502);
  }

  return json({ filas: datos.filas, actualizado: datos.actualizado ?? new Date().toISOString() });
});
