import type { LifeEntry } from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export const storageKey = "private-life.entries.v1";
const tableName = "private_life_state";
const stateRowId = "default";

type PersistedPayload = {
  entries: LifeEntry[];
  source: "supabase" | "local";
};

type RemoteStateRow = {
  id: string;
  payload: {
    entries?: LifeEntry[];
    updatedAt?: string;
  } | null;
};

export function readLocalEntries(): LifeEntry[] | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as LifeEntry[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

export function writeLocalEntries(entries: LifeEntry[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(entries));
}

export async function loadEntries(): Promise<PersistedPayload | null> {
  const localEntries = readLocalEntries();
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    return localEntries ? { entries: localEntries, source: "local" } : null;
  }

  const { data, error } = await supabase
    .from(tableName)
    .select("id, payload")
    .eq("id", stateRowId)
    .maybeSingle<RemoteStateRow>();

  if (error) {
    return localEntries ? { entries: localEntries, source: "local" } : null;
  }

  const remoteEntries = data?.payload?.entries;
  if (Array.isArray(remoteEntries)) {
    writeLocalEntries(remoteEntries);
    return { entries: remoteEntries, source: "supabase" };
  }

  return localEntries ? { entries: localEntries, source: "local" } : null;
}

export async function saveEntries(entries: LifeEntry[]) {
  writeLocalEntries(entries);

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return { source: "local" as const };
  }

  const table = supabase.from(tableName) as unknown as {
    upsert: (values: Record<string, unknown>, options?: { onConflict?: string }) => Promise<{ error: unknown }>;
  };

  const { error } = await table.upsert(
    {
      id: stateRowId,
      payload: { entries, updatedAt: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    return { source: "local" as const, error };
  }

  return { source: "supabase" as const };
}
