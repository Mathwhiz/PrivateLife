"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { loadEntries, saveEntries } from "@/lib/persistence";
import { getSession, signOut as authSignOut, onAuthStateChange } from "@/lib/auth";
import { LoginScreen } from "@/components/login-screen";
import {
  entrySectionLabels,
  entryTypeLabels,
  initialEntries,
  quickHabits,
  sectionOptionsByType,
  type EntrySection,
  type EntryType,
  type LifeEntry,
} from "@/lib/types";

const habitTemplateTag = "habit-template";
const habitHiddenTag = "habit-hidden";
const systemMediaTags = new Set([
  "movie",
  "series",
  "book",
  "anime",
  "manga",
  "imported",
  "imdb",
  "life-xlsx",
  "rated",
  "liked",
  "wow",
  "approx-date",
  "childhood",
]);

const entryTypes: EntryType[] = ["memory", "habit", "movie", "book", "series", "anime", "manga", "note"];
const mediaTypes: EntryType[] = ["movie", "series", "book", "anime", "manga"];
const writingSections: EntrySection[] = ["philosophy", "thought", "anecdote"];

type AppView = "capture" | "habits" | "library" | "writings" | "milestones" | "archive" | "ajustes";

// ─── App config (persisted in localStorage) ──────────────────────

const CONFIG_KEY = "private-life.config.v1";

type SidebarItemConfig = { view: AppView; label: string; visible: boolean };
type MediaTypeConfig = { id: string; label: string; visible: boolean };
type AppConfig = { sidebar: SidebarItemConfig[]; mediaTypes: MediaTypeConfig[] };

const defaultAppConfig: AppConfig = {
  sidebar: [
    { view: "habits",     label: "Habitos",       visible: true },
    { view: "library",    label: "Biblioteca",     visible: true },
    { view: "writings",   label: "Textos",         visible: true },
    { view: "milestones", label: "Hitos",          visible: true },
    { view: "archive",    label: "Archivo",        visible: true },
    { view: "capture",    label: "Nueva entrada",  visible: true },
    { view: "ajustes",    label: "Ajustes",        visible: true },
  ],
  mediaTypes: [
    { id: "movie",  label: "Pelicula", visible: true },
    { id: "series", label: "Serie",    visible: true },
    { id: "book",   label: "Libro",    visible: true },
    { id: "anime",  label: "Anime",    visible: true },
    { id: "manga",  label: "Manga",    visible: true },
  ],
};

function loadConfig(): AppConfig {
  if (typeof window === "undefined") return defaultAppConfig;
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (!stored) return defaultAppConfig;
    const parsed = JSON.parse(stored) as Partial<AppConfig>;
    return {
      sidebar: defaultAppConfig.sidebar.map((def) => {
        const s = parsed.sidebar?.find((x) => x.view === def.view);
        return s ? { ...def, ...s } : def;
      }),
      mediaTypes: defaultAppConfig.mediaTypes.map((def) => {
        const m = parsed.mediaTypes?.find((x) => x.id === def.id);
        return m ? { ...def, ...m } : def;
      }),
    };
  } catch {
    return defaultAppConfig;
  }
}

type FormState = {
  type: EntryType;
  section: EntrySection;
  title: string;
  content: string;
  date: string;
  tags: string;
};

type HabitDraft = {
  originalTitle: string | null;
  title: string;
  content: string;
  tags: string;
};

type HabitStats = {
  total: number;
  week: number;
  month: number;
  year: number;
  currentStreak: number;
  bestStreak: number;
  completionRate30: number;
  weekdayCounts: number[];
  monthlyCounts: Array<{ year: number; months: number[] }>;
  lastDone: string | null;
};

type HabitViewMode = "checklist" | "detail";

type MediaFormState = {
  id: string;
  type: EntryType;
  title: string;
  content: string;
  date: string;
  rating: string;
  tags: string;
};

const defaultType: EntryType = "memory";

const defaultFormState = (): FormState => ({
  type: defaultType,
  section: sectionOptionsByType[defaultType][0],
  title: "",
  content: "",
  date: todayAR(),
  tags: "",
});

const defaultHabitDraft = (): HabitDraft => ({
  originalTitle: null,
  title: "",
  content: "",
  tags: "",
});

function defaultMediaForm(type: EntryType = "movie"): MediaFormState {
  return {
    id: "",
    type,
    title: "",
    content: "",
    date: todayAR(),
    rating: "",
    tags: "",
  };
}

function entryToMediaForm(entry: LifeEntry): MediaFormState {
  const cleanTags = entry.tags.filter(
    (t) => !systemMediaTags.has(t) && !t.includes("import"),
  );
  return {
    id: entry.id,
    type: entry.type,
    title: entry.title,
    content: entry.content,
    date: entry.date,
    rating: entry.rating !== undefined && entry.rating !== null ? `${entry.rating}` : "",
    tags: cleanTags.join(", "),
  };
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function normalizeSection(entry: LifeEntry): EntrySection {
  if (entry.section) {
    return entry.section;
  }

  switch (entry.type) {
    case "habit":
      return "habit";
    case "movie":
      return "movie";
    case "book":
      return "book";
    case "series":
      return "series";
    case "anime":
      return "anime";
    case "manga":
      return "manga";
    case "memory":
      return "anecdote";
    case "note":
    default:
      return "thought";
  }
}

function sortEntries(entries: LifeEntry[]) {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date));
}

function getReactionBadge(entry: LifeEntry) {
  if (entry.tags.includes("wow")) {
    return "WOW";
  }
  if (entry.tags.includes("liked")) {
    return "I like";
  }
  if (entry.tags.includes("rated")) {
    return "Rated";
  }
  return null;
}

function getDisplayRating(entry: LifeEntry) {
  if (entry.rating !== undefined && entry.rating !== null && `${entry.rating}`.trim() !== "") {
    return `${entry.rating}/10`;
  }
  return getReactionBadge(entry);
}

function getRatingBadgeClass(entry: LifeEntry): string {
  const raw = entry.rating;
  if (raw !== undefined && raw !== null && `${raw}`.trim() !== "") {
    const num = parseFloat(`${raw}`);
    if (num >= 10) return "media-badge media-badge-10";
    if (num >= 9) return "media-badge media-badge-9";
    if (num >= 8) return "media-badge media-badge-8";
    return "media-badge";
  }
  if (entry.tags.includes("wow")) return "media-badge media-badge-10";
  if (entry.tags.includes("liked")) return "media-badge media-badge-8";
  return "media-badge";
}

function compactMeta(entry: LifeEntry) {
  return entry.content
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);
}

function excerptText(text: string, limit = 260) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= limit) {
    return compact;
  }
  return `${compact.slice(0, limit).trimEnd()}...`;
}

function normalizeHabitTitle(title: string) {
  const lowered = title.trim().toLowerCase();
  if (lowered === "bao" || lowered === "bano" || lowered === "ba\u00f1o") {
    return "Ba\u00f1o";
  }
  if (
    lowered === "ejercico fsico" ||
    lowered === "ejercicio fisico" ||
    lowered === "ejercicio f\u00edsico"
  ) {
    return "Ejercicio fisico";
  }
  return title.trim();
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function daysBetween(reference: string, target: string) {
  const ref = startOfDay(new Date(`${reference}T12:00:00`));
  const tar = startOfDay(new Date(`${target}T12:00:00`));
  return Math.floor((ref.getTime() - tar.getTime()) / 86_400_000);
}

// Fecha de hoy en horario de Argentina (UTC-3, sin DST)
function todayAR(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date());
}

function makeEntryId(prefix: string, ...parts: string[]) {
  return [prefix, ...parts.map((part) => part.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))]
    .filter(Boolean)
    .join("-");
}

function isHabitTemplateEntry(entry: LifeEntry) {
  return entry.type === "habit" && entry.tags.includes(habitTemplateTag);
}

function isHiddenHabitTemplateEntry(entry: LifeEntry) {
  return isHabitTemplateEntry(entry) && entry.tags.includes(habitHiddenTag);
}

function isHabitLogEntry(entry: LifeEntry) {
  return entry.type === "habit" && !entry.tags.includes(habitTemplateTag) && !entry.tags.includes("summary");
}

function ViewHeader({
  title,
  description,
  aside,
}: {
  title: string;
  description: string;
  aside?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h2 className="text-xl font-medium tracking-[-0.03em] text-foreground">{title}</h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">{description}</p>
      </div>
      {aside}
    </header>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <article className="rounded-xl border border-border bg-panel px-4 py-5 text-sm text-muted">
      {label}
    </article>
  );
}

function MediaCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: LifeEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const badgeClass = getRatingBadgeClass(entry);
  const display = getDisplayRating(entry);
  const meta = compactMeta(entry);
  const exactness = entry.tags.includes("childhood")
    ? "Infancia"
    : entry.tags.includes("approx-date")
      ? "Fecha aprox"
      : null;

  return (
    <article className="rounded-xl border border-border bg-panel px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-muted">
            {entryTypeLabels[entry.type]} · {formatDate(entry.date)}{exactness ? ` · ${exactness}` : ""}
          </p>
          <h3 className="text-base font-medium tracking-[-0.02em] text-foreground">{entry.title}</h3>
        </div>
        {display ? <span className={badgeClass}>{display}</span> : null}
      </div>
      {meta.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {meta.map((item) => (
            <span key={`${entry.id}-${item}`} className="meta-chip">
              {item}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex gap-1.5 border-t border-border pt-3">
        <button type="button" className="habit-inline-link" onClick={onEdit}>
          Editar
        </button>
        <button type="button" className="habit-inline-link" onClick={onDelete}>
          Eliminar
        </button>
      </div>
    </article>
  );
}

function WritingCard({ entry }: { entry: LifeEntry }) {
  return (
    <article className="rounded-xl border border-border bg-panel px-4 py-4">
      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-muted">
        {entrySectionLabels[normalizeSection(entry)]} · {formatDate(entry.date)}
      </p>
      <h3 className="mt-2 text-base font-medium tracking-[-0.02em] text-foreground">{entry.title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{excerptText(entry.content)}</p>
    </article>
  );
}

function ArchiveCard({
  entry,
  onTagClick,
}: {
  entry: LifeEntry;
  onTagClick: (tag: string) => void;
}) {
  const reaction = getReactionBadge(entry);
  const rating = getDisplayRating(entry);

  return (
    <article className="rounded-xl border border-border bg-panel px-4 py-4">
      <div className="flex flex-wrap items-center gap-2 text-[0.7rem] uppercase tracking-[0.18em] text-muted">
        <span>{formatDate(entry.date)}</span>
        <span>{entryTypeLabels[entry.type]}</span>
        <span>{entrySectionLabels[normalizeSection(entry)]}</span>
        {rating ? <span className="media-badge">{rating}</span> : reaction ? <span className="media-badge">{reaction}</span> : null}
      </div>
      <h3 className="mt-2 text-base font-medium tracking-[-0.02em] text-foreground">{entry.title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{entry.content}</p>
      {entry.tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {entry.tags.slice(0, 6).map((tag) => (
            <button
              key={`${entry.id}-${tag}`}
              type="button"
              onClick={() => onTagClick(tag)}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted transition-colors hover:border-foreground hover:text-foreground"
            >
              #{tag}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function MediaEditorForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  onDelete,
  typeConfig,
}: {
  form: MediaFormState;
  onChange: (updates: Partial<MediaFormState>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  onDelete?: () => void;
  typeConfig?: MediaTypeConfig[];
}) {
  const isNew = !form.id;

  return (
    <form
      className="grid gap-3 rounded-xl border border-border bg-panel px-4 py-4"
      onSubmit={onSubmit}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-foreground">
          {isNew ? "Nueva entrada" : "Editar entrada"}
        </h3>
        <button
          type="button"
          className="text-xs text-muted transition-colors hover:text-foreground"
          onClick={onCancel}
        >
          Cerrar
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1.5 text-xs">
          <span className="font-medium uppercase tracking-wide text-muted">Tipo</span>
          <select
            value={form.type}
            onChange={(e) => onChange({ type: e.target.value as EntryType })}
            className="field"
          >
            {(typeConfig ?? mediaTypes.map((t) => ({ id: t, label: entryTypeLabels[t], visible: true }))).map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-xs">
          <span className="font-medium uppercase tracking-wide text-muted">Fecha</span>
          <input
            type="date"
            value={form.date}
            onChange={(e) => onChange({ date: e.target.value })}
            className="field"
          />
        </label>
        <label className="grid gap-1.5 text-xs">
          <span className="font-medium uppercase tracking-wide text-muted">Rating (1–10)</span>
          <input
            type="number"
            min="1"
            max="10"
            step="0.5"
            value={form.rating}
            onChange={(e) => onChange({ rating: e.target.value })}
            placeholder="—"
            className="field"
          />
        </label>
        <label className="grid gap-1.5 text-xs">
          <span className="font-medium uppercase tracking-wide text-muted">Tags</span>
          <input
            type="text"
            value={form.tags}
            onChange={(e) => onChange({ tags: e.target.value })}
            placeholder="drama, favorita"
            className="field"
          />
        </label>
      </div>

      <label className="grid gap-1.5 text-xs">
        <span className="font-medium uppercase tracking-wide text-muted">Titulo</span>
        <input
          type="text"
          value={form.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Titulo de la obra"
          className="field"
          autoFocus
        />
      </label>

      <label className="grid gap-1.5 text-xs">
        <span className="font-medium uppercase tracking-wide text-muted">Notas</span>
        <textarea
          value={form.content}
          onChange={(e) => onChange({ content: e.target.value })}
          placeholder="Contexto, impresiones, por que vale la pena recordarla."
          rows={3}
          className="field resize-y"
        />
      </label>

      <div className="flex flex-wrap justify-between gap-2">
        <div>
          {!isNew && onDelete ? (
            <button type="button" className="danger-button" onClick={onDelete}>
              Eliminar
            </button>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="primary-button">
            {isNew ? "Agregar" : "Guardar"}
          </button>
        </div>
      </div>
    </form>
  );
}

export function PrivateLifeApp() {
  const [authState, setAuthState] = useState<"checking" | "authenticated" | "unauthenticated">("checking");
  const [entries, setEntries] = useState<LifeEntry[]>(initialEntries);
  const [syncSource, setSyncSource] = useState<"supabase" | "local">("local");
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeView, setActiveView] = useState<AppView>("habits");
  const [archiveFilter, setArchiveFilter] = useState<EntryType | "all">("all");
  const [libraryFilter, setLibraryFilter] = useState<EntryType | "all-media">("all-media");
  const [genreFilter, setGenreFilter] = useState<string>("all-genres");
  const [writingFilter, setWritingFilter] = useState<EntrySection | "all-writing">("all-writing");
  const [habitDate, setHabitDate] = useState(todayAR);
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [habitDraft, setHabitDraft] = useState<HabitDraft>(defaultHabitDraft);
  const [isHabitComposerOpen, setIsHabitComposerOpen] = useState(false);
  const [selectedHabit, setSelectedHabit] = useState<string | null>(null);
  const [habitViewMode, setHabitViewMode] = useState<HabitViewMode>("checklist");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mediaForm, setMediaForm] = useState<MediaFormState | null>(null);
  const [ratingFilter, setRatingFilter] = useState<"all" | "8" | "9" | "10">("all");
  const [librarySearch, setLibrarySearch] = useState("");
  const [librarySort, setLibrarySort] = useState<"date-desc" | "date-asc" | "rating-desc" | "rating-asc">("date-desc");
  const [appConfig, setAppConfig] = useState<AppConfig>(() => loadConfig());
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string>("");
  const [syncConflict, setSyncConflict] = useState(false);
  const [pendingRemoteEntries, setPendingRemoteEntries] = useState<LifeEntry[] | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const lastSyncedAt = useRef<string | null>(null);
  const deferredQuery = useDeferredValue(searchQuery);

  // 1. Verificar sesión al montar y escuchar cambios de auth
  useEffect(() => {
    void getSession().then((session) => {
      setAuthState(session ? "authenticated" : "unauthenticated");
    });

    const unsubscribe = onAuthStateChange((session) => {
      if (!session) {
        setAuthState("unauthenticated");
        setIsHydrated(false);
        setEntries(initialEntries);
      }
    });

    return unsubscribe;
  }, []);

  // 2. Cargar entradas solo cuando el usuario esté autenticado
  useEffect(() => {
    if (authState !== "authenticated") return;

    let cancelled = false;

    void loadEntries().then((result) => {
      if (cancelled) return;

      if (result?.entries?.length) {
        setEntries(result.entries);
        setSyncSource(result.source);
        lastSyncedAt.current = result.updatedAt;
      }

      setIsHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, [authState]);

  // 3. Re-sincronizar con Supabase cuando la pestaña/app vuelve a estar visible
  useEffect(() => {
    if (authState !== "authenticated") return;

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (!lastSyncedAt.current) return; // todavía no cargó la primera vez

      void loadEntries().then((result) => {
        if (!result?.entries?.length) return;
        if (result.updatedAt <= lastSyncedAt.current!) return; // ya tenemos la versión más nueva
        setEntries(result.entries);
        lastSyncedAt.current = result.updatedAt;
        setSyncSource(result.source);
      });
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [authState]);

  // 4. Guardar entradas cada vez que cambian
  useEffect(() => {
    if (!isHydrated) return;

    void saveEntries(entries, lastSyncedAt.current).then((result) => {
      if (result.source === "conflict") {
        lastSyncedAt.current = result.remoteUpdatedAt;
        setPendingRemoteEntries(result.remoteEntries);
        setSyncConflict(true);
      } else {
        if (result.source === "supabase") lastSyncedAt.current = result.updatedAt;
        setSyncSource(result.source);
      }
    });
  }, [entries, isHydrated]);

  // 4. Guardar config en localStorage cada vez que cambia
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(appConfig));
    }
  }, [appConfig]);

  const normalizedEntries = useMemo(
    () =>
      entries.map((entry) =>
        entry.type === "habit"
          ? {
              ...entry,
              title: normalizeHabitTitle(entry.title),
            }
          : entry,
      ),
    [entries],
  );

  const habitLogs = useMemo(
    () => sortEntries(normalizedEntries.filter((entry) => isHabitLogEntry(entry))),
    [normalizedEntries],
  );

  const habitTemplateEntries = useMemo(
    () => normalizedEntries.filter((entry) => isHabitTemplateEntry(entry)),
    [normalizedEntries],
  );

  const hiddenHabitTitles = useMemo(
    () =>
      new Set(
        habitTemplateEntries
          .filter((entry) => isHiddenHabitTemplateEntry(entry))
          .map((entry) => normalizeHabitTitle(entry.title)),
      ),
    [habitTemplateEntries],
  );

  const habitCatalog = useMemo(() => {
    const catalog = new Map<string, { title: string; tags: string[]; content: string }>();

    for (const habit of quickHabits) {
      const title = normalizeHabitTitle(habit.title);
      if (hiddenHabitTitles.has(title)) {
        continue;
      }
      catalog.set(title, { title, tags: [...habit.tags], content: habit.content });
    }

    for (const entry of habitTemplateEntries) {
      if (isHiddenHabitTemplateEntry(entry)) {
        continue;
      }
      catalog.set(entry.title, {
        title: entry.title,
        tags: entry.tags.filter((tag) => !["habit", habitTemplateTag].includes(tag)),
        content: entry.content,
      });
    }

    for (const entry of habitLogs) {
      const existing = catalog.get(entry.title);
      if (!existing) {
        catalog.set(entry.title, {
          title: entry.title,
          tags: entry.tags.filter((tag) => tag !== "habit"),
          content: entry.content,
        });
        continue;
      }

      catalog.set(entry.title, {
        title: entry.title,
        tags: [...new Set([...existing.tags, ...entry.tags.filter((tag) => tag !== "habit")])],
        content: existing.content || entry.content,
      });
    }

    return [...catalog.values()].sort((a, b) => a.title.localeCompare(b.title));
  }, [habitLogs, habitTemplateEntries, hiddenHabitTitles]);

  const activeHabitTitle = useMemo(() => {
    if (selectedHabit && habitCatalog.some((habit) => habit.title === selectedHabit)) {
      return selectedHabit;
    }
    return habitCatalog[0]?.title ?? null;
  }, [habitCatalog, selectedHabit]);

  const selectedHabitMeta = useMemo(
    () => habitCatalog.find((habit) => habit.title === activeHabitTitle) ?? null,
    [activeHabitTitle, habitCatalog],
  );

  const habitsForDay = useMemo(
    () => habitLogs.filter((entry) => entry.date === habitDate),
    [habitDate, habitLogs],
  );

  const selectedHabitLogs = useMemo(
    () => habitLogs.filter((entry) => entry.title === activeHabitTitle),
    [activeHabitTitle, habitLogs],
  );

  const habitStats = useMemo<HabitStats | null>(() => {
    if (!activeHabitTitle) {
      return null;
    }

    const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
    const uniqueDates = [...new Set(selectedHabitLogs.map((entry) => entry.date))].sort((a, b) => b.localeCompare(a));

    for (const entry of selectedHabitLogs) {
      const day = new Date(`${entry.date}T12:00:00`).getDay();
      weekdayCounts[day] += 1;
    }

    let currentStreak = 0;
    for (let index = 0; index < uniqueDates.length; index += 1) {
      if (daysBetween(habitDate, uniqueDates[index]) === index) {
        currentStreak += 1;
      } else if (index > 0 || daysBetween(habitDate, uniqueDates[index]) !== 0) {
        break;
      }
    }

    let bestStreak = 0;
    let streak = 0;
    let previousDate: string | null = null;
    const ascendingDates = [...uniqueDates].reverse();
    for (const date of ascendingDates) {
      if (!previousDate) {
        streak = 1;
      } else {
        const gap = daysBetween(date, previousDate);
        streak = gap === 1 ? streak + 1 : 1;
      }
      previousDate = date;
      bestStreak = Math.max(bestStreak, streak);
    }

    const completionRate30 = Math.round((selectedHabitLogs.filter((entry) => daysBetween(habitDate, entry.date) <= 29).length / 30) * 100);

    const monthlyMap = new Map<number, number[]>();
    for (const entry of selectedHabitLogs) {
      const d = new Date(`${entry.date}T12:00:00`);
      const y = d.getFullYear();
      const m = d.getMonth();
      if (!monthlyMap.has(y)) monthlyMap.set(y, Array<number>(12).fill(0));
      monthlyMap.get(y)![m] += 1;
    }
    const monthlyCounts = [...monthlyMap.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([year, months]) => ({ year, months }));

    return {
      total: selectedHabitLogs.length,
      week: selectedHabitLogs.filter((entry) => daysBetween(habitDate, entry.date) <= 6).length,
      month: selectedHabitLogs.filter((entry) => daysBetween(habitDate, entry.date) <= 29).length,
      year: selectedHabitLogs.filter((entry) => daysBetween(habitDate, entry.date) <= 364).length,
      currentStreak,
      bestStreak,
      completionRate30,
      weekdayCounts,
      monthlyCounts,
      lastDone: selectedHabitLogs[0]?.date ?? null,
    };
  }, [activeHabitTitle, habitDate, selectedHabitLogs]);

  const mediaEntries = useMemo(
    () => sortEntries(normalizedEntries.filter((entry) => mediaTypes.includes(entry.type))),
    [normalizedEntries],
  );

  const mediaGenres = useMemo(
    () =>
      [...new Set(
        mediaEntries.flatMap((entry) =>
          entry.tags.filter((tag) => !systemMediaTags.has(tag) && !tag.includes("import")),
        ),
      )].sort((a, b) => a.localeCompare(b)),
    [mediaEntries],
  );

  const visibleMedia = useMemo(() => {
    const byType =
      libraryFilter === "all-media"
        ? mediaEntries
        : mediaEntries.filter((entry) => entry.type === libraryFilter);

    const searchNorm = librarySearch.trim().toLowerCase();

    const filtered = byType.filter((entry) => {
      const matchesGenre = genreFilter === "all-genres" || entry.tags.includes(genreFilter);
      const matchesTag = activeTag === null || entry.tags.includes(activeTag);
      const matchesSearch =
        searchNorm === "" || entry.title.toLowerCase().includes(searchNorm);
      const matchesRating =
        ratingFilter === "all" ||
        (entry.rating !== undefined &&
          entry.rating !== null &&
          parseFloat(`${entry.rating}`) >= parseFloat(ratingFilter));
      return matchesGenre && matchesTag && matchesSearch && matchesRating;
    });

    return [...filtered].sort((a, b) => {
      switch (librarySort) {
        case "date-asc":
          return a.date.localeCompare(b.date);
        case "rating-desc": {
          const ra = parseFloat(`${a.rating ?? 0}`);
          const rb = parseFloat(`${b.rating ?? 0}`);
          return rb - ra || b.date.localeCompare(a.date);
        }
        case "rating-asc": {
          const ra = parseFloat(`${a.rating ?? 0}`);
          const rb = parseFloat(`${b.rating ?? 0}`);
          return ra - rb || b.date.localeCompare(a.date);
        }
        case "date-desc":
        default:
          return b.date.localeCompare(a.date);
      }
    });
  }, [activeTag, genreFilter, libraryFilter, librarySearch, librarySort, mediaEntries, ratingFilter]);

  const writingEntries = useMemo(
    () =>
      sortEntries(
        normalizedEntries.filter(
          (entry) =>
            entry.type === "note" ||
            (entry.type === "memory" &&
              !entry.tags.includes("milestone") &&
              normalizeSection(entry) !== "general"),
        ),
      ),
    [normalizedEntries],
  );

  const visibleWritings = useMemo(() => {
    const scoped =
      writingFilter === "all-writing"
        ? writingEntries
        : writingEntries.filter((entry) => normalizeSection(entry) === writingFilter);

    return scoped.filter((entry) => activeTag === null || entry.tags.includes(activeTag));
  }, [activeTag, writingEntries, writingFilter]);

  const milestoneEntries = useMemo(
    () =>
      sortEntries(
        normalizedEntries.filter(
          (entry) => entry.type === "memory" && entry.tags.includes("milestone"),
        ),
      ),
    [normalizedEntries],
  );

  const filteredArchive = useMemo(() => {
    const scoped =
      archiveFilter === "all"
        ? normalizedEntries
        : normalizedEntries.filter((entry) => entry.type === archiveFilter);
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return sortEntries(
      scoped.filter((entry) => {
        const matchesQuery =
          normalizedQuery.length === 0 ||
          entry.title.toLowerCase().includes(normalizedQuery) ||
          entry.content.toLowerCase().includes(normalizedQuery) ||
          entry.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery)) ||
          entrySectionLabels[normalizeSection(entry)].toLowerCase().includes(normalizedQuery);

        const matchesTag = activeTag === null || entry.tags.includes(activeTag);
        return matchesQuery && matchesTag;
      }),
    );
  }, [activeTag, archiveFilter, deferredQuery, normalizedEntries]);

  const allTags = useMemo(
    () => [...new Set(normalizedEntries.flatMap((entry) => entry.tags))].slice(0, 20),
    [normalizedEntries],
  );

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => {
      if (key === "type") {
        const nextType = value as EntryType;
        return {
          ...current,
          type: nextType,
          section: sectionOptionsByType[nextType][0],
        };
      }

      return { ...current, [key]: value };
    });
  }

  function createEntry(nextEntry: LifeEntry) {
    setEntries((current) => [nextEntry, ...current]);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = form.title.trim();
    const content = form.content.trim();

    if (!title || !content || !form.date) {
      return;
    }

    createEntry({
      id: makeEntryId(form.type, form.date, title, content.slice(0, 24)),
      type: form.type,
      section: form.section,
      title,
      content,
      date: form.date,
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
    setForm(defaultFormState());
    setActiveView("archive");
  }

  function toggleHabit(title: string) {
    const existing = habitLogs.find((entry) => entry.title === title && entry.date === habitDate);

    if (existing) {
      setEntries((current) => current.filter((entry) => entry.id !== existing.id));
      return;
    }

    const habitMeta = habitCatalog.find((habit) => habit.title === title);
    createEntry({
      id: makeEntryId("habit-log", title, habitDate),
      type: "habit",
      section: "habit",
      title,
      content: habitMeta?.content ?? "Registro diario del habito.",
      date: habitDate,
      tags: [...new Set(["habit", ...(habitMeta?.tags ?? [])])],
    });
  }

  function startEditingHabit(title: string) {
    const habitMeta = habitCatalog.find((habit) => habit.title === title);
    if (!habitMeta) {
      return;
    }

    setHabitDraft({
      originalTitle: title,
      title,
      content: habitMeta.content,
      tags: habitMeta.tags.join(", "),
    });
    setIsHabitComposerOpen(true);
  }

  function saveHabitTemplate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = normalizeHabitTitle(habitDraft.title);
    if (!title) {
      return;
    }

    const templateEntry: LifeEntry = {
      id:
        habitTemplateEntries.find((entry) => entry.title === habitDraft.originalTitle)?.id ??
        makeEntryId("habit-template", title),
      type: "habit",
      section: "habit",
      title,
      content: habitDraft.content.trim() || "Habito personalizado.",
      date: new Date().toISOString().slice(0, 10),
      tags: [
        "habit",
        habitTemplateTag,
        ...habitDraft.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      ],
      };

      const shouldHideOriginalQuickHabit =
        Boolean(habitDraft.originalTitle) &&
        habitDraft.originalTitle !== title &&
        quickHabits.some((habit) => normalizeHabitTitle(habit.title) === habitDraft.originalTitle);

      const hiddenOriginalEntry: LifeEntry | null =
        shouldHideOriginalQuickHabit && habitDraft.originalTitle
          ? {
              id: makeEntryId("habit-hidden", habitDraft.originalTitle),
              type: "habit",
              section: "habit",
              title: habitDraft.originalTitle,
              content: "Habito base ocultado.",
              date: new Date().toISOString().slice(0, 10),
              tags: ["habit", habitTemplateTag, habitHiddenTag],
            }
          : null;

      setEntries((current) =>
        current
          .filter((entry) => !hiddenOriginalEntry || entry.id !== hiddenOriginalEntry.id)
          .map((entry) => {
            if (habitDraft.originalTitle && entry.type === "habit" && entry.title === habitDraft.originalTitle) {
              return { ...entry, title, content: templateEntry.content };
            }

          if (entry.id === templateEntry.id) {
            return templateEntry;
          }

            return entry;
          })
          .concat(current.some((entry) => entry.id === templateEntry.id) ? [] : [templateEntry])
          .concat(hiddenOriginalEntry ? [hiddenOriginalEntry] : []),
      );
    setSelectedHabit(title);
    setHabitDraft(defaultHabitDraft());
    setIsHabitComposerOpen(false);
  }

  function deleteHabit(title: string) {
    const shouldHideQuickHabit = quickHabits.some((habit) => normalizeHabitTitle(habit.title) === title);
    const hiddenEntry: LifeEntry | null = shouldHideQuickHabit
      ? {
          id: makeEntryId("habit-hidden", title),
          type: "habit",
          section: "habit",
          title,
          content: "Habito base ocultado.",
          date: new Date().toISOString().slice(0, 10),
          tags: ["habit", habitTemplateTag, habitHiddenTag],
        }
      : null;

    setEntries((current) => {
      const filtered = current.filter(
        (entry) =>
          !(entry.type === "habit" && entry.title === title) &&
          !(hiddenEntry && entry.id === hiddenEntry.id),
      );

      return hiddenEntry ? [...filtered, hiddenEntry] : filtered;
    });
    if (selectedHabit === title) {
      setSelectedHabit(null);
    }
    if (habitDraft.originalTitle === title) {
      setHabitDraft(defaultHabitDraft());
    }
    setIsHabitComposerOpen(false);
  }

  function deleteHabitDraft() {
    if (!habitDraft.originalTitle) {
      return;
    }
    deleteHabit(habitDraft.originalTitle);
  }

  function deleteEntry(id: string) {
    setEntries((current) => current.filter((e) => e.id !== id));
  }

  function openMediaEditor(entry?: LifeEntry) {
    if (entry) {
      setMediaForm(entryToMediaForm(entry));
    } else {
      const type = libraryFilter === "all-media" ? "movie" : (libraryFilter as EntryType);
      setMediaForm(defaultMediaForm(type));
    }
  }

  function saveMediaForm(event: React.FormEvent) {
    event.preventDefault();
    if (!mediaForm || !mediaForm.title.trim()) return;

    const isNew = !mediaForm.id;
    const id = isNew
      ? makeEntryId(mediaForm.type, mediaForm.date, mediaForm.title)
      : mediaForm.id;

    const parsedRating = mediaForm.rating.trim() !== "" ? mediaForm.rating.trim() : undefined;

    const next: LifeEntry = {
      id,
      type: mediaForm.type,
      section: mediaForm.type as EntrySection,
      title: mediaForm.title.trim(),
      content: mediaForm.content.trim(),
      date: mediaForm.date,
      tags: mediaForm.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      ...(parsedRating !== undefined ? { rating: parsedRating } : {}),
    };

    if (isNew) {
      setEntries((current) => [next, ...current]);
    } else {
      setEntries((current) => current.map((e) => (e.id === id ? next : e)));
    }
    setMediaForm(null);
  }

  function handleExport() {
    const payload = JSON.stringify({ entries, exportedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `private-life-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openImportPicker() {
    importInputRef.current?.click();
  }

  function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result ?? "{}")) as { entries?: LifeEntry[] };
        if (!Array.isArray(payload.entries)) {
          throw new Error("Archivo invalido");
        }
        setEntries(sortEntries(payload.entries));
        setImportMessage(`${payload.entries.length} entradas importadas.`);
        setActiveView("library");
      } catch {
        setImportMessage("No pude importar ese JSON.");
      } finally {
        event.target.value = "";
      }
    };
    reader.onerror = () => {
      setImportMessage("No pude leer ese archivo.");
      event.target.value = "";
    };
    reader.readAsText(file);
  }

  const currentSectionOptions = sectionOptionsByType[form.type];

  if (authState === "checking") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[1520px] items-center justify-center px-4 py-10">
        <div className="loading-card">
          <p className="section-kicker">private life</p>
          <h1 className="mt-3 text-lg font-medium text-foreground">Verificando sesión...</h1>
        </div>
      </main>
    );
  }

  if (authState === "unauthenticated") {
    return <LoginScreen onLogin={() => setAuthState("authenticated")} />;
  }

  if (!isHydrated) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[1520px] items-center justify-center px-4 py-10">
        <div className="loading-card">
          <p className="section-kicker">private life</p>
          <h1 className="mt-3 text-lg font-medium text-foreground">Cargando...</h1>
          <p className="mt-2 text-sm text-muted">
            {syncSource === "supabase" ? "Supabase" : "localStorage"}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[1520px] flex-col px-3 py-3 sm:px-4 lg:px-5">
      {syncConflict && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-600 dark:text-amber-400">
          <span>Conflicto de sincronización — hay datos más recientes en la nube. Tus cambios actuales se mantienen.</span>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded bg-amber-500/20 px-2 py-1 text-xs hover:bg-amber-500/30"
              onClick={() => {
                if (pendingRemoteEntries) {
                  setEntries(pendingRemoteEntries);
                  setPendingRemoteEntries(null);
                }
                setSyncConflict(false);
              }}
            >
              Cargar nube
            </button>
            <button
              type="button"
              className="rounded px-2 py-1 text-xs hover:bg-amber-500/20"
              onClick={() => {
                setPendingRemoteEntries(null);
                setSyncConflict(false);
              }}
            >
              Ignorar
            </button>
          </div>
        </div>
      )}
      <div className={`grid gap-3 ${sidebarOpen ? "xl:grid-cols-[220px_minmax(0,1fr)]" : ""}`}>
        <aside className={`flex flex-col rounded-xl border border-border bg-surface px-4 py-5 xl:sticky xl:top-3 xl:h-[calc(100vh-1.5rem)] ${sidebarOpen ? "" : "hidden"}`}>
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <p className="section-kicker">private life</p>
                <h1 className="mt-2 text-base font-medium tracking-[-0.02em] text-foreground">
                  Archivo vivo.
                </h1>
              </div>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="sidebar-toggle mt-0.5"
                title="Cerrar menu"
              >
                ‹
              </button>
            </div>

            <nav className="mt-5 grid gap-1.5 text-sm">
            {appConfig.sidebar
              .filter((item) => item.visible)
              .map(({ view, label }) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setActiveView(view)}
                  className={activeView === view ? "nav-link nav-link-active" : "nav-link"}
                >
                  {label}
                </button>
              ))}
          </nav>

          <div className="mt-auto pt-4 border-t border-border">
            <p className="text-xs text-muted">
              {syncSource === "supabase" ? "↑ Supabase" : "↑ Local"}
            </p>
          </div>
        </aside>

        <section className="rounded-xl border border-border bg-surface px-5 py-5 sm:px-6 sm:py-6">
            {!sidebarOpen ? (
              <div className="mb-5 flex items-center gap-3 border-b border-border pb-4">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="sidebar-toggle"
                  title="Abrir menu"
                >
                  ≡
                </button>
                <span className="section-kicker">private life</span>
              </div>
            ) : null}
            {activeView === "habits" ? (
            <div className="space-y-5">
              <ViewHeader
                title="Habitos diarios"
                description={
                  habitViewMode === "checklist"
                    ? "Checklist compacta para resolver el dia sin ruido."
                    : "Detalle del habito con estadisticas y edicion."
                }
                aside={
                  <div className="flex flex-wrap items-center gap-2">
                    {habitViewMode === "detail" ? (
                      <button type="button" className="secondary-button" onClick={() => setHabitViewMode("checklist")}>
                        Volver
                      </button>
                    ) : null}
                      <label className="grid gap-2 text-sm">
                        <span className="font-medium text-foreground">Fecha</span>
                        <input
                          type="date"
                          value={habitDate}
                          onChange={(event) => setHabitDate(event.target.value)}
                          className="field min-w-40"
                        />
                      </label>
                    </div>
                  }
                />

              {habitViewMode === "checklist" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="section-kicker">Checklist</p>
                      <p className="mt-1 text-sm text-muted">Marca lo de hoy y listo.</p>
                    </div>
                    <button
                      type="button"
                      className="habit-add-button"
                      onClick={() => {
                        setHabitDraft(defaultHabitDraft());
                        setIsHabitComposerOpen((current) => !current);
                      }}
                    >
                      +
                    </button>
                  </div>

                    <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
                      {habitCatalog.map((habit) => {
                        const checked = habitsForDay.some((entry) => entry.title === habit.title);
                        return (
                          <div key={habit.title} className={`habit-toggle-pill ${checked ? "habit-toggle-pill-active" : ""}`}>
                          <button
                            type="button"
                            onClick={() => toggleHabit(habit.title)}
                            className="habit-toggle-main"
                          >
                              <span className="habit-toggle-box">{checked ? "✓" : ""}</span>
                              <span className="truncate">{habit.title}</span>
                            </button>
                            <div className="habit-inline-actions">
                              <button
                                type="button"
                                className="habit-inline-link"
                                onClick={() => {
                                  setSelectedHabit(habit.title);
                                  setHabitViewMode("detail");
                                }}
                              >
                                Ver
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                  {isHabitComposerOpen ? (
                    <form className="grid gap-3 rounded-xl border border-border bg-panel px-4 py-4" onSubmit={saveHabitTemplate}>
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-medium text-foreground">
                          {habitDraft.originalTitle ? "Editar habito" : "Crear habito"}
                        </h3>
                        <button
                          type="button"
                          className="text-xs text-muted"
                          onClick={() => {
                            setHabitDraft(defaultHabitDraft());
                            setIsHabitComposerOpen(false);
                          }}
                        >
                          Cerrar
                        </button>
                      </div>
                      <input
                        type="text"
                        value={habitDraft.title}
                        onChange={(event) => setHabitDraft((current) => ({ ...current, title: event.target.value }))}
                        placeholder="Nombre del habito"
                        className="field"
                      />
                      <input
                        type="text"
                        value={habitDraft.tags}
                        onChange={(event) => setHabitDraft((current) => ({ ...current, tags: event.target.value }))}
                        placeholder="salud, rutina, estudio"
                        className="field"
                      />
                      <textarea
                        value={habitDraft.content}
                        onChange={(event) => setHabitDraft((current) => ({ ...current, content: event.target.value }))}
                        placeholder="Contexto corto del habito"
                        rows={3}
                        className="field resize-y"
                      />
                        <div className="flex flex-wrap justify-end gap-2">
                          {habitDraft.originalTitle ? (
                            <button type="button" className="danger-button" onClick={deleteHabitDraft}>
                              Eliminar
                            </button>
                          ) : null}
                          <button type="submit" className="primary-button">
                            Guardar habito
                          </button>
                        </div>
                      </form>
                    ) : null}
                  </div>
                ) : selectedHabitMeta && habitStats ? (
                  <div className="space-y-4">
                    <article className="rounded-xl border border-border bg-panel px-4 py-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="section-kicker">habito activo</p>
                          <h3 className="mt-2 text-lg font-medium text-foreground">{selectedHabitMeta.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-muted">
                            {selectedHabitMeta.content || "Sin descripcion"}
                          </p>
                        </div>
                        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
                          <button type="button" className="secondary-button" onClick={() => startEditingHabit(selectedHabitMeta.title)}>
                            Editar
                          </button>
                          <button type="button" className="danger-button" onClick={() => deleteHabit(selectedHabitMeta.title)}>
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </article>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <article className="stat-card">
                      <span className="stat-label">7 dias</span>
                      <strong className="stat-value">{habitStats.week}</strong>
                    </article>
                    <article className="stat-card">
                      <span className="stat-label">30 dias</span>
                      <strong className="stat-value">{habitStats.month}</strong>
                    </article>
                    <article className="stat-card">
                      <span className="stat-label">365 dias</span>
                      <strong className="stat-value">{habitStats.year}</strong>
                    </article>
                    <article className="stat-card">
                      <span className="stat-label">Total</span>
                      <strong className="stat-value">{habitStats.total}</strong>
                    </article>
                    <article className="stat-card">
                      <span className="stat-label">Racha actual</span>
                      <strong className="stat-value">{habitStats.currentStreak}</strong>
                    </article>
                    <article className="stat-card">
                      <span className="stat-label">Mejor racha</span>
                      <strong className="stat-value">{habitStats.bestStreak}</strong>
                    </article>
                  </div>

                  <article className="rounded-xl border border-border bg-panel px-4 py-4">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="section-kicker">Constancia</p>
                        <strong className="mt-2 block text-3xl font-medium text-foreground">
                          {habitStats.completionRate30}%
                        </strong>
                        <p className="mt-2 text-sm text-muted">
                          Porcentaje de dias cumplidos en los ultimos 30 dias.
                        </p>
                      </div>
                      <p className="text-xs text-muted">
                        Ultima vez: {habitStats.lastDone ? formatDate(habitStats.lastDone) : "Nunca"}
                      </p>
                    </div>
                  </article>

                  <article className="rounded-xl border border-border bg-panel px-4 py-4">
                    <p className="section-kicker">Patron semanal</p>
                    <div className="mt-4 grid gap-2">
                      {["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"].map((label, index) => {
                        const value = habitStats.weekdayCounts[index];
                        const width = habitStats.total === 0 ? 0 : Math.max(10, (value / habitStats.total) * 100);
                        return (
                          <div key={label} className="grid grid-cols-[36px_minmax(0,1fr)_24px] items-center gap-3">
                            <span className="text-xs text-muted">{label}</span>
                            <div className="habit-bar-track">
                              <span className="habit-bar-fill" style={{ width: `${width}%` }} />
                            </div>
                            <span className="text-xs text-foreground">{value}</span>
                          </div>
                        );
                      })}
                    </div>
                  </article>

                  {habitStats.monthlyCounts.length > 0 && (
                    <article className="rounded-xl border border-border bg-panel px-4 py-4">
                      <p className="section-kicker">Por año y mes</p>
                      <div className="mt-4 grid gap-6">
                        {habitStats.monthlyCounts.map(({ year, months }) => {
                          const maxMonth = Math.max(...months, 1);
                          return (
                            <div key={year}>
                              <p className="mb-2 text-xs font-medium text-foreground">{year}</p>
                              <div className="grid gap-1.5">
                                {months.map((count, monthIndex) => {
                                  const label = new Intl.DateTimeFormat("es-AR", { month: "short" }).format(
                                    new Date(year, monthIndex),
                                  );
                                  const width = count === 0 ? 0 : Math.max(4, (count / maxMonth) * 100);
                                  return (
                                    <div key={monthIndex} className="grid grid-cols-[36px_minmax(0,1fr)_24px] items-center gap-3">
                                      <span className="text-xs text-muted capitalize">{label}</span>
                                      <div className="habit-bar-track">
                                        <span className="habit-bar-fill" style={{ width: `${width}%` }} />
                                      </div>
                                      <span className="text-xs text-foreground">{count}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </article>
                  )}
                </div>
              ) : (
                <EmptyState label="Elige un habito para ver estadisticas y editarlo." />
              )}
            </div>
          ) : null}

          {activeView === "library" ? (
            <div className="space-y-5">
              <ViewHeader
                title="Biblioteca"
                description="Peliculas, series y libros con genero filtrable, fecha clara y tu nota arriba."
                aside={
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openMediaEditor()}
                      className="primary-button"
                    >
                      + Nueva
                    </button>
                    <button
                      type="button"
                      onClick={() => setLibraryFilter("all-media")}
                      className={libraryFilter === "all-media" ? "filter-button-active" : "filter-button"}
                    >
                      Todo
                    </button>
                    {appConfig.mediaTypes
                      .filter((mt) => mt.visible)
                      .map(({ id, label }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setLibraryFilter(id as EntryType)}
                          className={libraryFilter === id ? "filter-button-active" : "filter-button"}
                        >
                          {label}
                        </button>
                      ))}
                  </div>
                }
              />

              {mediaForm !== null ? (
                <MediaEditorForm
                  form={mediaForm}
                  onChange={(updates) =>
                    setMediaForm((current) => (current ? { ...current, ...updates } : current))
                  }
                  onSubmit={saveMediaForm}
                  onCancel={() => setMediaForm(null)}
                  onDelete={
                    mediaForm.id
                      ? () => {
                          deleteEntry(mediaForm.id);
                          setMediaForm(null);
                        }
                      : undefined
                  }
                  typeConfig={appConfig.mediaTypes}
                />
              ) : null}

              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="search"
                    value={librarySearch}
                    onChange={(e) => setLibrarySearch(e.target.value)}
                    placeholder="Buscar por nombre..."
                    className="field max-w-xs"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {(["all", "8", "9", "10"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRatingFilter(r)}
                        className={ratingFilter === r ? "filter-button-active" : "filter-button"}
                      >
                        {r === "all" ? "Todas" : `${r}+`}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        ["date-desc", "Más reciente"],
                        ["date-asc", "Más antigua"],
                        ["rating-desc", "Nota ↓"],
                        ["rating-asc", "Nota ↑"],
                      ] as const
                    ).map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setLibrarySort(val)}
                        className={librarySort === val ? "filter-button-active" : "filter-button"}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {mediaGenres.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setGenreFilter("all-genres")}
                      className={genreFilter === "all-genres" ? "filter-button-active" : "filter-button"}
                    >
                      Todos los generos
                    </button>
                    {mediaGenres.slice(0, 24).map((genre) => (
                      <button
                        key={genre}
                        type="button"
                        onClick={() => setGenreFilter(genre)}
                        className={genreFilter === genre ? "filter-button-active" : "filter-button"}
                      >
                        {genre}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {visibleMedia.length === 0 ? (
                <EmptyState label="No hay items para este filtro." />
              ) : (
                <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                  {visibleMedia.map((entry) => (
                    <MediaCard
                      key={entry.id}
                      entry={entry}
                      onEdit={() => openMediaEditor(entry)}
                      onDelete={() => deleteEntry(entry.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {activeView === "writings" ? (
            <div className="space-y-5">
              <ViewHeader
                title="Textos y pensamientos"
                description="Vista compacta por fecha, sin interminables columnas de texto."
                aside={
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setWritingFilter("all-writing")}
                      className={writingFilter === "all-writing" ? "filter-button-active" : "filter-button"}
                    >
                      Todo
                    </button>
                    {writingSections.map((section) => (
                      <button
                        key={section}
                        type="button"
                        onClick={() => setWritingFilter(section)}
                        className={writingFilter === section ? "filter-button-active" : "filter-button"}
                      >
                        {entrySectionLabels[section]}
                      </button>
                    ))}
                  </div>
                }
              />
              {visibleWritings.length === 0 ? (
                <EmptyState label="No hay textos para este filtro." />
              ) : (
                <div className="space-y-3">
                  {visibleWritings.map((entry) => (
                    <WritingCard key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {activeView === "milestones" ? (
            <div className="space-y-5">
              <ViewHeader title="Hitos JW" description="Fechas, privilegios y pasos importantes de tu recorrido." />
              {milestoneEntries.length === 0 ? (
                <EmptyState label="No hay hitos cargados." />
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {milestoneEntries.map((entry) => (
                    <article key={entry.id} className="rounded-xl border border-border bg-panel px-4 py-4">
                      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-muted">{formatDate(entry.date)}</p>
                      <h3 className="mt-2 text-base font-medium tracking-[-0.02em] text-foreground">{entry.title}</h3>
                      {entry.content ? <p className="mt-2 text-sm leading-6 text-muted">{entry.content}</p> : null}
                    </article>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {activeView === "archive" ? (
            <div className="space-y-5">
              <ViewHeader
                title="Archivo completo"
                description="Busqueda global para recorrer todo el sistema cuando lo necesitas."
              />

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar por texto, etiqueta o seccion"
                  className="field"
                />
                {activeTag ? (
                  <button type="button" onClick={() => setActiveTag(null)} className="secondary-button">
                    Quitar etiqueta: {activeTag}
                  </button>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setArchiveFilter("all")}
                  className={archiveFilter === "all" ? "filter-button-active" : "filter-button"}
                >
                  Todo
                </button>
                {entryTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setArchiveFilter(type)}
                    className={archiveFilter === type ? "filter-button-active" : "filter-button"}
                  >
                    {entryTypeLabels[type]}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setActiveTag((current) => (current === tag ? null : tag))}
                    className={activeTag === tag ? "filter-button-active" : "filter-button"}
                  >
                    #{tag}
                  </button>
                ))}
              </div>

              {filteredArchive.length === 0 ? (
                <EmptyState label="No hay entradas para el filtro actual." />
              ) : (
                <div className="space-y-3">
                  {filteredArchive.map((entry) => (
                    <ArchiveCard key={entry.id} entry={entry} onTagClick={setActiveTag} />
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {activeView === "capture" ? (
            <div className="space-y-5">
              <ViewHeader
                title="Nueva entrada"
                description="Captura rapida para pensamiento, anecdota, texto o recuerdo."
              />

              <form className="grid gap-4" onSubmit={handleSubmit}>
                <div className="grid gap-4 md:grid-cols-4">
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium text-foreground">Tipo</span>
                    <select
                      value={form.type}
                      onChange={(event) => updateForm("type", event.target.value as EntryType)}
                      className="field"
                    >
                      {entryTypes.map((type) => (
                        <option key={type} value={type}>
                          {entryTypeLabels[type]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium text-foreground">Seccion</span>
                    <select
                      value={form.section}
                      onChange={(event) => updateForm("section", event.target.value as EntrySection)}
                      className="field"
                    >
                      {currentSectionOptions.map((section) => (
                        <option key={section} value={section}>
                          {entrySectionLabels[section]}
                        </option>
                      ))}
                    </select>
                  </label>
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium text-foreground">Fecha</span>
                      <input
                        type="date"
                        value={form.date}
                        onChange={(event) => updateForm("date", event.target.value)}
                        className="field"
                      />
                    </label>
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium text-foreground">Etiquetas</span>
                    <input
                      type="text"
                      value={form.tags}
                      onChange={(event) => updateForm("tags", event.target.value)}
                      placeholder="filosofia, rutina, cine"
                      className="field"
                    />
                  </label>
                </div>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium text-foreground">Titulo</span>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(event) => updateForm("title", event.target.value)}
                    placeholder="Que quieres guardar ahora"
                    className="field"
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium text-foreground">Contenido</span>
                  <textarea
                    value={form.content}
                    onChange={(event) => updateForm("content", event.target.value)}
                    placeholder="Anota el hecho, el pensamiento o el contexto."
                    rows={10}
                    className="field min-h-40 resize-y"
                  />
                </label>

                <div className="flex justify-end">
                  <button type="submit" className="primary-button">
                    Guardar entrada
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          {activeView === "ajustes" ? (
            <div className="space-y-5">
              <ViewHeader
                title="Ajustes"
                description="Gestion de datos y configuracion de la app."
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-panel px-4 py-5">
                  <p className="section-kicker">Exportar datos</p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Descarga todas tus entradas como archivo JSON. Guardalo como backup manual.
                  </p>
                  <button
                    type="button"
                    className="mt-4 secondary-button"
                    onClick={handleExport}
                  >
                    Exportar JSON
                  </button>
                </div>

                <div className="rounded-xl border border-border bg-panel px-4 py-5">
                  <p className="section-kicker">Importar datos</p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Carga un archivo JSON exportado previamente. Reemplaza las entradas actuales.
                  </p>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json"
                    onChange={handleImportFile}
                    className="hidden"
                  />
                  <button
                    type="button"
                    className="mt-4 secondary-button"
                    onClick={openImportPicker}
                  >
                    Importar JSON
                  </button>
                  {importMessage ? (
                    <p className="mt-2 text-xs text-muted">{importMessage}</p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-panel px-4 py-5">
                <p className="section-kicker">Sincronizacion</p>
                <p className="mt-2 text-sm text-foreground">
                  {syncSource === "supabase"
                    ? "Supabase activo — los datos se sincronizan en la nube."
                    : "Modo local — los datos viven en este navegador."}
                </p>
                <p className="mt-1 text-xs text-muted">{entries.length} entradas en total.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {/* Config: Menu lateral */}
                <div className="rounded-xl border border-border bg-panel px-4 py-5">
                  <div className="flex items-center justify-between">
                    <p className="section-kicker">Menu lateral</p>
                    <button
                      type="button"
                      className="text-xs text-muted transition-colors hover:text-foreground"
                      onClick={() => setAppConfig((prev) => ({ ...prev, sidebar: defaultAppConfig.sidebar }))}
                    >
                      Restaurar
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-muted">Renombrá o ocultá secciones del menú.</p>
                  <div className="mt-4 grid gap-2">
                    {appConfig.sidebar.map((item, i) => (
                      <div key={item.view} className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={item.view === "ajustes"}
                          onClick={() =>
                            setAppConfig((prev) => ({
                              ...prev,
                              sidebar: prev.sidebar.map((s, j) =>
                                j === i ? { ...s, visible: !s.visible } : s,
                              ),
                            }))
                          }
                          className={`flex-shrink-0 w-7 h-7 rounded-md border text-xs font-medium transition-colors ${
                            item.visible
                              ? "border-sage/40 bg-sage/10 text-sage"
                              : "border-border bg-transparent text-muted"
                          } ${item.view === "ajustes" ? "opacity-30 cursor-not-allowed" : ""}`}
                          title={item.view === "ajustes" ? "Ajustes siempre visible" : item.visible ? "Ocultar" : "Mostrar"}
                        >
                          {item.visible ? "✓" : "—"}
                        </button>
                        <input
                          type="text"
                          value={item.label}
                          onChange={(e) =>
                            setAppConfig((prev) => ({
                              ...prev,
                              sidebar: prev.sidebar.map((s, j) =>
                                j === i ? { ...s, label: e.target.value } : s,
                              ),
                            }))
                          }
                          className="field text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Config: Tipos de biblioteca */}
                <div className="rounded-xl border border-border bg-panel px-4 py-5">
                  <div className="flex items-center justify-between">
                    <p className="section-kicker">Tipos de biblioteca</p>
                    <button
                      type="button"
                      className="text-xs text-muted transition-colors hover:text-foreground"
                      onClick={() => setAppConfig((prev) => ({ ...prev, mediaTypes: defaultAppConfig.mediaTypes }))}
                    >
                      Restaurar
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-muted">Renombrá o desactivá categorías de la biblioteca.</p>
                  <div className="mt-4 grid gap-2">
                    {appConfig.mediaTypes.map((mt, i) => (
                      <div key={mt.id} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setAppConfig((prev) => ({
                              ...prev,
                              mediaTypes: prev.mediaTypes.map((m, j) =>
                                j === i ? { ...m, visible: !m.visible } : m,
                              ),
                            }))
                          }
                          className={`flex-shrink-0 w-7 h-7 rounded-md border text-xs font-medium transition-colors ${
                            mt.visible
                              ? "border-sage/40 bg-sage/10 text-sage"
                              : "border-border bg-transparent text-muted"
                          }`}
                          title={mt.visible ? "Ocultar" : "Mostrar"}
                        >
                          {mt.visible ? "✓" : "—"}
                        </button>
                        <input
                          type="text"
                          value={mt.label}
                          onChange={(e) =>
                            setAppConfig((prev) => ({
                              ...prev,
                              mediaTypes: prev.mediaTypes.map((m, j) =>
                                j === i ? { ...m, label: e.target.value } : m,
                              ),
                            }))
                          }
                          className="field text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-panel px-4 py-5">
                <p className="section-kicker">Sesion</p>
                <p className="mt-2 text-sm text-muted">
                  Cerrar sesion desconecta este dispositivo. Los datos en la nube no se borran.
                </p>
                <button
                  type="button"
                  className="mt-4 danger-button"
                  onClick={() => void authSignOut()}
                >
                  Cerrar sesion
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
