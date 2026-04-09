"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
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

const storageKey = "private-life.entries.v1";
const entryTypes: EntryType[] = ["memory", "habit", "movie", "book", "series", "note"];
const mediaTypes: EntryType[] = ["movie", "series", "book"];
const writingSections: EntrySection[] = ["philosophy", "thought", "anecdote"];

type AppView = "capture" | "habits" | "library" | "writings" | "milestones" | "archive";

type FormState = {
  type: EntryType;
  section: EntrySection;
  title: string;
  content: string;
  date: string;
  tags: string;
};

const defaultType: EntryType = "memory";

const defaultFormState = (): FormState => ({
  type: defaultType,
  section: sectionOptionsByType[defaultType][0],
  title: "",
  content: "",
  date: new Date().toISOString().slice(0, 10),
  tags: "",
});

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

function compactMeta(entry: LifeEntry) {
  return entry.content
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);
}

function excerptText(text: string, limit = 320) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= limit) {
    return compact;
  }

  return `${compact.slice(0, limit).trimEnd()}...`;
}

function normalizeHabitTitle(title: string) {
  const lowered = title.trim().toLowerCase();

  if (lowered === "bao" || lowered === "bano" || lowered === "baño") {
    return "Baño";
  }

  if (
    lowered === "ejercico fsico" ||
    lowered === "ejercicio fisico" ||
    lowered === "ejercicio físico"
  ) {
    return "Ejercicio físico";
  }

  return title.trim();
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
    <header className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="section-kicker">private life</p>
        <h2 className="mt-2 text-[1.7rem] font-medium tracking-[-0.04em] text-foreground">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{description}</p>
      </div>
      {aside}
    </header>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <article className="rounded-[1.15rem] border border-border bg-panel px-4 py-5 text-sm text-muted">
      {label}
    </article>
  );
}

function MediaCard({ entry }: { entry: LifeEntry }) {
  const rating = getDisplayRating(entry);
  const meta = compactMeta(entry);

  return (
    <article className="rounded-[1.15rem] border border-border bg-panel px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-muted">
            {entryTypeLabels[entry.type]} · {formatDate(entry.date)}
          </p>
          <h3 className="text-base font-medium tracking-[-0.02em] text-foreground">{entry.title}</h3>
        </div>
        {rating ? <span className="media-badge">{rating}</span> : null}
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
    </article>
  );
}

function WritingCard({ entry }: { entry: LifeEntry }) {
  return (
    <article className="rounded-[1.15rem] border border-border bg-panel px-4 py-4">
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
    <article className="rounded-[1.15rem] border border-border bg-panel px-4 py-4">
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

export function PrivateLifeApp() {
  const importRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<LifeEntry[]>(() => {
    if (typeof window === "undefined") {
      return initialEntries;
    }

    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return initialEntries;
    }

    try {
      const parsed = JSON.parse(raw) as LifeEntry[];
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : initialEntries;
    } catch {
      window.localStorage.removeItem(storageKey);
      return initialEntries;
    }
  });
  const [activeView, setActiveView] = useState<AppView>("habits");
  const [archiveFilter, setArchiveFilter] = useState<EntryType | "all">("all");
  const [libraryFilter, setLibraryFilter] = useState<EntryType | "all-media">("all-media");
  const [writingFilter, setWritingFilter] = useState<EntrySection | "all-writing">("all-writing");
  const [habitDate, setHabitDate] = useState(new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(entries));
  }, [entries]);

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

  const habitEntries = useMemo(
    () =>
      sortEntries(
        normalizedEntries.filter(
          (entry) => entry.type === "habit" && !entry.tags.includes("summary"),
        ),
      ),
    [normalizedEntries],
  );

  const habitCatalog = useMemo(() => {
    const seeded = quickHabits.map((habit) => ({
      title: normalizeHabitTitle(habit.title),
      tags: [...habit.tags],
      content: habit.content,
    }));
    const seen = new Map<string, { title: string; tags: string[]; content: string }>(
      seeded.map((habit) => [habit.title, habit]),
    );

    for (const entry of habitEntries) {
      const normalizedTitle = normalizeHabitTitle(entry.title);
      const current = seen.get(normalizedTitle);

      if (!current) {
        seen.set(normalizedTitle, {
          title: normalizedTitle,
          tags: entry.tags.filter((tag) => !["habit", "loop"].includes(tag)),
          content: entry.content,
        });
        continue;
      }

      seen.set(normalizedTitle, {
        title: normalizedTitle,
        tags: [...new Set([...current.tags, ...entry.tags.filter((tag) => !["habit", "loop"].includes(tag))])],
        content: current.content || entry.content,
      });
    }

    return [...seen.values()].sort((a, b) => a.title.localeCompare(b.title));
  }, [habitEntries]);

  const habitsForDay = useMemo(
    () => habitEntries.filter((entry) => entry.date === habitDate),
    [habitDate, habitEntries],
  );

  const mediaEntries = useMemo(
    () => sortEntries(normalizedEntries.filter((entry) => mediaTypes.includes(entry.type))),
    [normalizedEntries],
  );

  const visibleMedia = useMemo(() => {
    const scoped =
      libraryFilter === "all-media"
        ? mediaEntries
        : mediaEntries.filter((entry) => entry.type === libraryFilter);

    return scoped.filter((entry) => activeTag === null || entry.tags.includes(activeTag));
  }, [activeTag, libraryFilter, mediaEntries]);

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

  const stats = useMemo(
    () => ({
      habits: habitCatalog.length,
      habitsToday: habitEntries.filter(
        (entry) => entry.date === new Date().toISOString().slice(0, 10),
      ).length,
      library: mediaEntries.length,
      writings: writingEntries.length,
    }),
    [habitCatalog.length, habitEntries, mediaEntries.length, writingEntries.length],
  );

  const allTags = useMemo(
    () => [...new Set(normalizedEntries.flatMap((entry) => entry.tags))].slice(0, 18),
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
      id: `${Date.now()}`,
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
    const normalizedTitle = normalizeHabitTitle(title);
    const existing = habitEntries.find(
      (entry) => normalizeHabitTitle(entry.title) === normalizedTitle && entry.date === habitDate,
    );

    if (existing) {
      setEntries((current) => current.filter((entry) => entry.id !== existing.id));
      return;
    }

    const habitMeta = habitCatalog.find((habit) => habit.title === normalizedTitle);
    createEntry({
      id: `${Date.now()}-${normalizedTitle}-${habitDate}`,
      type: "habit",
      section: "habit",
      title: normalizedTitle,
      content: habitMeta?.content ?? "Registro diario del hábito.",
      date: habitDate,
      tags: [...new Set(["habit", ...(habitMeta?.tags ?? [])])],
    });
  }

  function handleExport() {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      entries,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `private-life-backup-${date}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    void file.text().then((text) => {
      try {
        const parsed = JSON.parse(text) as { entries?: LifeEntry[] };
        if (!Array.isArray(parsed.entries)) {
          return;
        }

        const validEntries = parsed.entries.filter(
          (entry): entry is LifeEntry =>
            typeof entry.id === "string" &&
            typeof entry.type === "string" &&
            typeof entry.title === "string" &&
            typeof entry.content === "string" &&
            typeof entry.date === "string" &&
            Array.isArray(entry.tags),
        );

        if (validEntries.length > 0) {
          setEntries(validEntries);
          setArchiveFilter("all");
          setLibraryFilter("all-media");
          setWritingFilter("all-writing");
          setActiveTag(null);
          setSearchQuery("");
        }
      } finally {
        event.target.value = "";
      }
    });
  }

  const currentSectionOptions = sectionOptionsByType[form.type];

  return (
    <main className="mx-auto flex w-full max-w-[1480px] flex-col px-3 py-3 sm:px-5 lg:px-6">
      <div className="grid gap-3 xl:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="rounded-[1.5rem] border border-border bg-surface px-4 py-5 xl:sticky xl:top-3 xl:h-[calc(100vh-1.5rem)]">
          <div className="border-b border-border pb-4">
            <p className="section-kicker">private life</p>
            <h1 className="mt-2 text-[1.85rem] font-medium tracking-[-0.05em] text-foreground">
              Sistema personal.
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              Una sección por vez. Sin dashboard ruidoso.
            </p>
          </div>

          <nav className="mt-5 grid gap-1.5 text-sm">
            {[
              ["habits", "Hábitos"],
              ["library", "Biblioteca"],
              ["writings", "Textos"],
              ["milestones", "Hitos JW"],
              ["archive", "Archivo"],
              ["capture", "Nueva entrada"],
            ].map(([view, label]) => (
              <button
                key={view}
                type="button"
                onClick={() => setActiveView(view as AppView)}
                className={activeView === view ? "filter-button-active justify-start" : "filter-button justify-start"}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="mt-5 grid gap-2">
            <article className="stat-card">
              <span className="stat-label">Hábitos</span>
              <strong className="stat-value">{stats.habits}</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Checks hoy</span>
              <strong className="stat-value">{stats.habitsToday}</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Biblioteca</span>
              <strong className="stat-value">{stats.library}</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Textos</span>
              <strong className="stat-value">{stats.writings}</strong>
            </article>
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Datos</p>
            <div className="mt-3 grid gap-2">
              <button type="button" onClick={handleExport} className="secondary-button justify-center">
                Exportar JSON
              </button>
              <button
                type="button"
                onClick={() => importRef.current?.click()}
                className="primary-button justify-center"
              >
                Importar JSON
              </button>
              <input
                ref={importRef}
                type="file"
                accept="application/json"
                onChange={handleImport}
                className="hidden"
              />
            </div>
          </div>
        </aside>

        <section className="rounded-[1.5rem] border border-border bg-surface px-4 py-5 sm:px-5 sm:py-5">
          {activeView === "habits" ? (
            <div className="space-y-5">
              <ViewHeader
                title="Hábitos diarios"
                description="Checklist compacta para marcar lo que hiciste en un día concreto."
                aside={
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium text-foreground">Fecha</span>
                    <input
                      type="date"
                      value={habitDate}
                      onChange={(event) => setHabitDate(event.target.value)}
                      className="field min-w-40"
                    />
                  </label>
                }
              />

              <div className="grid gap-2">
                {habitCatalog.map((habit) => {
                  const checked = habitsForDay.some(
                    (entry) => normalizeHabitTitle(entry.title) === habit.title,
                  );

                  return (
                    <button
                      key={habit.title}
                      type="button"
                      onClick={() => toggleHabit(habit.title)}
                      className={`habit-check-row ${checked ? "habit-check-row-active" : ""}`}
                    >
                      <span className="habit-check-box">{checked ? "✓" : ""}</span>
                      <span className="text-left">
                        <span className="block text-sm font-medium text-foreground">{habit.title}</span>
                        <span className="mt-0.5 block text-xs text-muted">
                          {(habit.tags ?? []).slice(0, 3).join(" · ") || "Sin categoría"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {activeView === "library" ? (
            <div className="space-y-5">
              <ViewHeader
                title="Biblioteca"
                description="Películas, series y libros con fecha clara y tu nota visible arriba."
                aside={
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setLibraryFilter("all-media")}
                      className={libraryFilter === "all-media" ? "filter-button-active" : "filter-button"}
                    >
                      Todo
                    </button>
                    {mediaTypes.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setLibraryFilter(type)}
                        className={libraryFilter === type ? "filter-button-active" : "filter-button"}
                      >
                        {entryTypeLabels[type]}
                      </button>
                    ))}
                  </div>
                }
              />
              {visibleMedia.length === 0 ? (
                <EmptyState label="No hay items para este filtro." />
              ) : (
                <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                  {visibleMedia.map((entry) => (
                    <MediaCard key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {activeView === "writings" ? (
            <div className="space-y-5">
              <ViewHeader
                title="Textos y pensamientos"
                description="Vista compacta. Aquí se muestran previews, no los textos completos."
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
              <ViewHeader
                title="Hitos JW"
                description="Fechas, privilegios y pasos importantes de tu recorrido."
              />
              {milestoneEntries.length === 0 ? (
                <EmptyState label="No hay hitos cargados." />
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {milestoneEntries.map((entry) => (
                    <article key={entry.id} className="rounded-[1.15rem] border border-border bg-panel px-4 py-4">
                      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-muted">
                        {formatDate(entry.date)}
                      </p>
                      <h3 className="mt-2 text-base font-medium tracking-[-0.02em] text-foreground">
                        {entry.title}
                      </h3>
                      {entry.content ? (
                        <p className="mt-2 text-sm leading-6 text-muted">{entry.content}</p>
                      ) : null}
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
                description="Búsqueda global para recorrer todo el sistema cuando lo necesitas."
              />

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar por texto, etiqueta o sección"
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
                description="Captura rápida para pensamiento, anécdota, texto o recuerdo."
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
                    <span className="font-medium text-foreground">Sección</span>
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
                      placeholder="filosofía, rutina, cine"
                      className="field"
                    />
                  </label>
                </div>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium text-foreground">Título</span>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(event) => updateForm("title", event.target.value)}
                    placeholder="Qué quieres guardar ahora"
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
        </section>
      </div>
    </main>
  );
}
