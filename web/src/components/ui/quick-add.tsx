import { useState } from "react";
import { makeEntryId, todayAR } from "@/lib/entries";
import { entrySectionLabels, entryTypeLabels, type EntrySection, type EntryType, type LifeEntry } from "@/lib/types";

/** Lo que se carga desde el "+" sin pasar por la biblioteca. */
export type QuickKind = "note" | "memory" | "milestone" | "trip";

/** Hitos y viajes tienen "desde" y "hasta" y un título obligatorio. */
const conRango = (kind: QuickKind) => kind === "milestone" || kind === "trip";

export type QuickDraft = {
  kind: QuickKind;
  /** Si existe, se está editando esa entrada. */
  id?: string;
  title: string;
  content: string;
  date: string;
  end_date: string;
  section: EntrySection;
  tags: string;
};

export const quickKindLabels: Record<QuickKind, string> = {
  note: "Texto",
  memory: "Recuerdo",
  milestone: "Hito",
  trip: "Viaje",
};

const noteSections: EntrySection[] = ["thought", "philosophy", "general"];

export function newDraft(kind: QuickKind): QuickDraft {
  return {
    kind,
    title: "",
    content: "",
    date: todayAR(),
    end_date: "",
    section: kind === "note" ? "thought" : kind === "memory" ? "anecdote" : "general",
    tags: kind === "milestone" ? "jw" : "",
  };
}

export function kindOf(entry: LifeEntry): QuickKind | null {
  if (entry.type === "note") return "note";
  if (entry.type === "memory") return entry.tags.includes("milestone") ? "milestone" : entry.tags.includes("viaje") ? "trip" : "memory";
  return null;
}

export function entryToDraft(entry: LifeEntry): QuickDraft | null {
  const kind = kindOf(entry);
  if (!kind) return null;
  return {
    kind,
    id: entry.id,
    title: entry.title,
    content: entry.content,
    date: entry.date,
    end_date: entry.end_date ?? "",
    section: entry.section ?? newDraft(kind).section,
    tags: entry.tags.filter((t) => t !== "milestone" && t !== "viaje").join(", "),
  };
}

/**
 * Arma la entrada a partir del borrador. Al editar conserva lo que el
 * formulario no muestra (tags de importación, created_at, etc.).
 */
export function draftToEntry(draft: QuickDraft, existing: LifeEntry | undefined, takenIds: Set<string>): LifeEntry {
  const tags = draft.tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (draft.kind === "milestone") tags.push("milestone");
  if (draft.kind === "trip") tags.push("viaje");

  const type: EntryType = draft.kind === "note" ? "note" : "memory";
  let id = existing?.id ?? draft.id;
  if (!id) {
    const base = makeEntryId(draft.kind === "milestone" ? "hito" : draft.kind === "trip" ? "viaje" : type, draft.date, draft.title || draft.content.slice(0, 24));
    id = base;
    for (let n = 2; takenIds.has(id); n += 1) id = `${base}-${n}`;
  }

  const entry: LifeEntry = {
    ...existing,
    id,
    type,
    section: draft.section,
    title: draft.title.trim() || draft.content.trim().slice(0, 60),
    content: draft.content.trim(),
    date: draft.date,
    tags: [...new Set(tags)],
    created_at: existing?.created_at ?? (existing ? undefined : new Date().toISOString()),
  };
  if (conRango(draft.kind) && draft.end_date) entry.end_date = draft.end_date;
  else delete entry.end_date;
  if (!entry.created_at) delete entry.created_at;
  return entry;
}

const mediaChoices: EntryType[] = ["movie", "series", "anime", "book", "game", "manga"];

/** Paso 1 del "+": elegir qué cargar. */
export function QuickAddChooser({
  onPick,
  onPickMedia,
  onPickWishlist,
  onClose,
  mediaVisible,
}: {
  onPick: (kind: QuickKind) => void;
  onPickMedia: (type: EntryType) => void;
  onPickWishlist: () => void;
  onClose: () => void;
  mediaVisible: (type: EntryType) => boolean;
}) {
  return (
    <Sheet title="Agregar" onClose={onClose}>
      <p className="section-kicker">Escribir</p>
      <div className="mt-2 grid grid-cols-2 gap-2 @sm:grid-cols-4">
        {(["note", "memory", "milestone", "trip"] as QuickKind[]).map((kind) => (
          <button key={kind} type="button" className="choice-tile" onClick={() => onPick(kind)}>
            {quickKindLabels[kind]}
          </button>
        ))}
      </div>
      <p className="section-kicker mt-5">Biblioteca</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {mediaChoices.filter(mediaVisible).map((type) => (
          <button key={type} type="button" className="choice-tile" onClick={() => onPickMedia(type)}>
            {entryTypeLabels[type]}
          </button>
        ))}
        <button type="button" className="choice-tile col-span-3" onClick={onPickWishlist}>
          Quiero ver / jugar / leer
        </button>
      </div>
    </Sheet>
  );
}

/** Paso 2: el formulario corto de cada tipo (también sirve para editar). */
export function QuickEntryForm({
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  initial: QuickDraft;
  onSave: (draft: QuickDraft) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const set = <K extends keyof QuickDraft>(key: K, value: QuickDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const editing = Boolean(initial.id);
  const valid =
    conRango(draft.kind) ? draft.title.trim() !== "" : draft.content.trim() !== "" || draft.title.trim() !== "";
  const endBeforeStart = conRango(draft.kind) && draft.end_date !== "" && draft.end_date < draft.date;

  return (
    <Sheet title={`${editing ? "Editar" : "Nuevo"} ${quickKindLabels[draft.kind].toLowerCase()}`} onClose={onClose}>
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid && !endBeforeStart) onSave(draft);
        }}
      >
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-foreground">
            {draft.kind === "milestone" ? "Qué" : draft.kind === "trip" ? "Adónde" : "Título"}
          </span>
          <input
            autoFocus={conRango(draft.kind)}
            className="field"
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder={draft.kind === "milestone" ? "Ej.: Dep. Sonido Congregación" : draft.kind === "trip" ? "Ej.: Mar del Plata" : "Opcional"}
          />
        </label>

        <div className={`grid gap-3 ${conRango(draft.kind) ? "grid-cols-2" : "grid-cols-1"}`}>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-foreground">{draft.kind === "trip" ? "Ida" : draft.kind === "milestone" ? "Desde" : "Fecha"}</span>
            <input type="date" className="field" value={draft.date} onChange={(e) => set("date", e.target.value)} required />
          </label>
          {conRango(draft.kind) ? (
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-foreground">
                {draft.kind === "trip" ? "Vuelta" : "Hasta"} <span className="text-muted">(opcional)</span>
              </span>
              <input type="date" className="field" value={draft.end_date} onChange={(e) => set("end_date", e.target.value)} />
            </label>
          ) : null}
        </div>
        {endBeforeStart ? <p className="text-xs text-rose">La fecha de fin es anterior a la de inicio.</p> : null}

        {draft.kind === "note" ? (
          <div className="flex flex-wrap gap-2">
            {noteSections.map((section) => (
              <button
                key={section}
                type="button"
                className={draft.section === section ? "filter-button-active" : "filter-button"}
                onClick={() => set("section", section)}
              >
                {entrySectionLabels[section]}
              </button>
            ))}
          </div>
        ) : null}

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-foreground">{conRango(draft.kind) ? "Nota" : "Texto"}</span>
          <textarea
            autoFocus={!conRango(draft.kind)}
            className="field min-h-28 resize-y"
            rows={conRango(draft.kind) ? 2 : 6}
            value={draft.content}
            onChange={(e) => set("content", e.target.value)}
            placeholder={draft.kind === "trip" ? "Con quién, qué hicieron… (opcional)" : draft.kind === "milestone" ? "Opcional" : "Lo que quieras guardar"}
          />
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-foreground">Etiquetas <span className="text-muted">(separadas por coma)</span></span>
          <input className="field" value={draft.tags} onChange={(e) => set("tags", e.target.value)} />
        </label>

        <div className="mt-1 flex items-center justify-between gap-2">
          {onDelete ? (
            <button type="button" className="danger-button" onClick={onDelete}>
              Eliminar
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="primary-button" disabled={!valid || endBeforeStart}>
              Guardar
            </button>
          </div>
        </div>
      </form>
    </Sheet>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-medium text-foreground">{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
