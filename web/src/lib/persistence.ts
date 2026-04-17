import type { LifeEntry } from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export const storageKey = "private-life.entries.v1";
const tableName = "private_life_state";
const stateRowId = "default";

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
    if (remoteUpdatedAt && remoteUpdatedAt > baseUpdatedAt) {
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
  return { source: "supabase", updatedAt: newUpdatedAt };
}
