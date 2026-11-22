import { useDeferredValue, useMemo, useState } from "react";
import { formatDate } from "@/lib/entries";
import { entryTypeLabels, type EntryType, type LifeEntry } from "@/lib/types";
import { Sheet } from "@/components/ui/quick-add";
import { TypeBadge } from "@/components/ui/common";

const MAX = 60;
const tipos: EntryType[] = ["movie", "series", "anime", "book", "game", "manga", "note", "memory", "habit"];

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Búsqueda en todo el archivo. Sin texto, sirve para recorrer por tipo. */
export function SearchOverlay({
  entries,
  onOpen,
  onClose,
}: {
  entries: LifeEntry[];
  onOpen: (entry: LifeEntry) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [tipo, setTipo] = useState<EntryType | "all">("all");
  const q = sinTildes(useDeferredValue(query).trim());

  const { resultados, total } = useMemo(() => {
    const encontrados = entries
      .filter((e) => (tipo === "all" ? e.type !== "habit" : e.type === tipo))
      .filter(
        (e) =>
          q === "" ||
          sinTildes(e.title).includes(q) ||
          sinTildes(e.content).includes(q) ||
          e.tags.some((t) => sinTildes(t).includes(q)),
      )
      .sort((a, b) => {
        // Lo que coincide en el título primero; después lo más nuevo.
        if (q) {
          const ta = sinTildes(a.title).includes(q) ? 0 : 1;
          const tb = sinTildes(b.title).includes(q) ? 0 : 1;
          if (ta !== tb) return ta - tb;
        }
        return b.date.localeCompare(a.date);
      });
    return { resultados: encontrados.slice(0, MAX), total: encontrados.length };
  }, [entries, q, tipo]);

  return (
    <Sheet title="Buscar" onClose={onClose}>
      <input
        autoFocus
        type="search"
        className="field w-full"
        placeholder="Película, recuerdo, etiqueta…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={tipo === "all" ? "filter-button-active" : "filter-button"} onClick={() => setTipo("all")}>
          Todo
        </button>
        {tipos.map((t) => (
          <button key={t} type="button" className={tipo === t ? "filter-button-active" : "filter-button"} onClick={() => setTipo(t)}>
            {entryTypeLabels[t]}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        {total === 0 ? "Sin resultados." : total > MAX ? `${total} resultados · mostrando ${MAX}` : `${total} resultados`}
      </p>
      <ul className="mt-2 grid max-h-[55vh] gap-0.5 overflow-y-auto">
        {resultados.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 rounded-md px-2 py-2 text-left hover:bg-accent-soft"
              onClick={() => onOpen(e)}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm text-foreground">{e.title}</span>
                <TypeBadge entry={e} />
              </span>
              <span className="text-xs text-muted">{formatDate(e.date)}</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
