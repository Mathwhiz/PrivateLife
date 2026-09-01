import type { LifeEntry } from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export const storageKey = "private-life.entries.v1";
const tableName = "private_life_state";
const stateRowId = "default";

/** Cuanto esperamos a que dejes de tocar antes de subir. */
const DEBOUNCE_MS = 700;
/** Espera antes de reintentar una subida que fallo por red. */
const RETRY_MS = 3000;

type LocalPayload = {
  entries: LifeEntry[];
  updatedAt: string;
};

type RemoteStateRow = {
  id: string;
  payload: {
    entries?: LifeEntry[];
    updatedAt?: string;
  } | null;
};

export type LoadResult = {
  entries: LifeEntry[];
  source: "supabase" | "local";
  updatedAt: string;
};

export type SaveResult =
  | { source: "local" }
  | { source: "supabase"; updatedAt: string }
  | { source: "conflict"; remoteEntries: LifeEntry[]; remoteUpdatedAt: string };

/** Que mostrarle al usuario sobre el guardado. */
export type SaveStatus = "idle" | "saving" | "saved" | "pending" | "conflict";

export type SaveHandlers = {
  onStatus: (status: SaveStatus) => void;
  onConflict: (remoteEntries: LifeEntry[], remoteUpdatedAt: string) => void;
  onSynced: (source: "supabase" | "local") => void;
};

export function readLocalEntries(): LocalPayload | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    // Migrate old format (plain array)
    if (Array.isArray(parsed)) {
      return { entries: parsed, updatedAt: new Date(0).toISOString() };
    }
    if (parsed && Array.isArray(parsed.entries)) {
      return parsed as LocalPayload;
    }
    return null;
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

export function writeLocalEntries(entries: LifeEntry[], updatedAt: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify({ entries, updatedAt }));
}

/**
 * Ultima version del remoto que conocemos. Vive aca y no en el componente para
 * que la cola siempre lea el valor actualizado, incluso entre dos subidas
 * encadenadas.
 */
let knownUpdatedAt: string | null = null;
/**
 * updatedAt que escribio ESTA pestana. Sin esto, una subida propia que llega
 * tarde ve su propio timestamp en la nube y lo confunde con otro dispositivo.
 */
const ownWrites = new Set<string>();

export function setKnownUpdatedAt(value: string | null) {
  knownUpdatedAt = value;
}

export function getKnownUpdatedAt() {
  return knownUpdatedAt;
}

export async function loadEntries(): Promise<LoadResult | null> {
  const local = readLocalEntries();
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    return local ? { entries: local.entries, source: "local", updatedAt: local.updatedAt } : null;
  }

  const { data, error } = await supabase
    .from(tableName)
    .select("id, payload")
    .eq("id", stateRowId)
    .maybeSingle<RemoteStateRow>();

  if (error) {
    return local ? { entries: local.entries, source: "local", updatedAt: local.updatedAt } : null;
  }

  const remoteEntries = data?.payload?.entries;
  const remoteUpdatedAt = data?.payload?.updatedAt ?? new Date(0).toISOString();

  if (Array.isArray(remoteEntries)) {
    // Use whichever is newer
    const localNewer = local?.updatedAt && local.updatedAt > remoteUpdatedAt;
    if (localNewer) {
      return { entries: local!.entries, source: "local", updatedAt: local!.updatedAt };
    }
    writeLocalEntries(remoteEntries, remoteUpdatedAt);
    return { entries: remoteEntries, source: "supabase", updatedAt: remoteUpdatedAt };
  }

  return local ? { entries: local.entries, source: "local", updatedAt: local.updatedAt } : null;
}

export async function saveEntries(
  entries: LifeEntry[],
  baseUpdatedAt: string | null,
): Promise<SaveResult> {
  const newUpdatedAt = new Date().toISOString();
  writeLocalEntries(entries, newUpdatedAt);

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { source: "local" };

  // Check for conflict: if remote is newer than what we loaded, don't overwrite
  if (baseUpdatedAt) {
    const { data: current } = await supabase
      .from(tableName)
      .select("id, payload")
      .eq("id", stateRowId)
      .maybeSingle<RemoteStateRow>();

    const remoteUpdatedAt = current?.payload?.updatedAt;
    // Si ese "remoto mas nuevo" lo escribimos nosotros, no es conflicto: es
    // nuestra propia subida anterior y podemos seguir encima de ella.
    if (remoteUpdatedAt && remoteUpdatedAt > baseUpdatedAt && !ownWrites.has(remoteUpdatedAt)) {
      const remoteEntries = current?.payload?.entries;
      if (Array.isArray(remoteEntries)) {
        writeLocalEntries(remoteEntries, remoteUpdatedAt);
        return { source: "conflict", remoteEntries, remoteUpdatedAt };
      }
    }
  }

  const table = supabase.from(tableName) as unknown as {
    upsert: (values: Record<string, unknown>, options?: { onConflict?: string }) => Promise<{ error: unknown }>;
  };

  const { error } = await table.upsert(
    {
      id: stateRowId,
      payload: { entries, updatedAt: newUpdatedAt },
      updated_at: newUpdatedAt,
    },
    { onConflict: "id" },
  );

  if (error) return { source: "local" };

  ownWrites.add(newUpdatedAt);
  if (ownWrites.size > 20) {
    const oldest = ownWrites.values().next().value;
    if (oldest) ownWrites.delete(oldest);
  }
  return { source: "supabase", updatedAt: newUpdatedAt };
}

// --- Cola de guardado -------------------------------------------------------
// Una sola subida en vuelo a la vez. Los cambios que llegan mientras tanto se
// acumulan y se mandan juntos al terminar, asi marcar tres habitos seguidos es
// una sola escritura y no tres carreras compitiendo entre si.

let queuedEntries: LifeEntry[] | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<void> | null = null;
let handlers: SaveHandlers | null = null;

function stopTimer(timer: ReturnType<typeof setTimeout> | null) {
  if (timer) clearTimeout(timer);
  return null;
}

async function drainQueue(): Promise<void> {
  while (queuedEntries) {
    const batch = queuedEntries;
    queuedEntries = null;
    handlers?.onStatus("saving");

    const result = await saveEntries(batch, knownUpdatedAt);

    if (result.source === "conflict") {
      knownUpdatedAt = result.remoteUpdatedAt;
      handlers?.onConflict(result.remoteEntries, result.remoteUpdatedAt);
      handlers?.onStatus("conflict");
      return;
    }

    if (result.source === "supabase") {
      knownUpdatedAt = result.updatedAt;
      handlers?.onSynced("supabase");
      continue;
    }

    // Sin cliente, o fallo la red: quedo guardado local y lo reintentamos.
    handlers?.onSynced("local");
    if (getSupabaseBrowserClient() && !queuedEntries) {
      queuedEntries = batch;
      handlers?.onStatus("pending");
      retryTimer = stopTimer(retryTimer);
      retryTimer = setTimeout(() => void flushSave(), RETRY_MS);
      return;
    }
  }

  handlers?.onStatus("saved");
}

function run(): Promise<void> {
  if (inFlight) return inFlight; // al terminar vuelve a mirar la cola
  inFlight = drainQueue().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/**
 * Guarda local al instante y programa la subida a la nube. Llamalo en cada
 * cambio: agrupa solo, no hace falta cuidarlo desde afuera.
 */
export function scheduleSave(entries: LifeEntry[], nextHandlers: SaveHandlers) {
  handlers = nextHandlers;
  queuedEntries = entries;

  // Local primero: si cerras la app antes del debounce, no se pierde nada.
  writeLocalEntries(entries, new Date().toISOString());
  handlers.onStatus("saving");

  retryTimer = stopTimer(retryTimer);
  debounceTimer = stopTimer(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void run();
  }, DEBOUNCE_MS);
}

/** Sube ya lo que este pendiente, sin esperar el debounce. */
export function flushSave(): Promise<void> {
  debounceTimer = stopTimer(debounceTimer);
  retryTimer = stopTimer(retryTimer);
  if (!queuedEntries && !inFlight) return Promise.resolve();
  return run();
}

/** Hay algo escrito local que todavia no llego a la nube? */
export function hasPendingSave() {
  return queuedEntries !== null || inFlight !== null;
}
