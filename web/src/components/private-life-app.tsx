"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { loadEntries, saveEntries } from "@/lib/persistence";
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
const systemMediaTags = new Set([
  "movie",
  "series",
  "book",
  "imported",
  "imdb",
  "life-xlsx",
  "rated",
  "liked",
  "wow",
  "approx-date",
  "childhood",
]);

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

type HabitDraft = {
  originalTitle: string | null;
  title: string;
  content: string;
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

const defaultHabitDraft = (): HabitDraft => ({
  originalTitle: null,
  title: "",
  content: "",
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

function isHabitTemplateEntry(entry: LifeEntry) {
  return entry.type === "habit" && entry.tags.includes(habitTemplateTag);
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
    <header className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="section-kicker">private life</p>
        <h2 className="mt-1 text-[1.65rem] font-medium tracking-[-0.04em] text-foreground">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{description}</p>
      </div>
      {aside}
    </header>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <article className="rounded-[1rem] border border-border bg-panel px-4 py-5 text-sm text-muted">
      {label}
    </article>
  );
}

function MediaCard({ entry }: { entry: LifeEntry }) {
  const rating = getDisplayRating(entry);
  const meta = compactMeta(entry);
  const exactness = entry.tags.includes("childhood")
    ? "Infancia"
    : entry.tags.includes("approx-date")
      ? "Fecha aprox"
      : "Fecha exacta";

  return (
    <article className="rounded-[1rem] border border-border bg-panel px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-muted">
            {entryTypeLabels[entry.type]} · {formatDate(entry.date)} · {exactness}
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
    <article className="rounded-[1rem] border border-border bg-panel px-4 py-4">
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
    <article className="rounded-[1rem] border border-border bg-panel px-4 py-4">
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
  const [entries, setEntries] = useState<LifeEntry[]>(initialEntries);
  const [syncSource, setSyncSource] = useState<"supabase" | "local">("local");
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeView, setActiveView] = useState<AppView>("habits");
  const [archiveFilter, setArchiveFilter] = useState<EntryType | "all">("all");
  const [libraryFilter, setLibraryFilter] = useState<EntryType | "all-media">("all-media");
  const [genreFilter, setGenreFilter] = useState<string>("all-genres");
  const [writingFilter, setWritingFilter] = useState<EntrySection | "all-writing">("all-writing");
  const [habitDate, setHabitDate] = useState(new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [habitDraft, setHabitDraft] = useState<HabitDraft>(defaultHabitDraft);
  const [selectedHabit, setSelectedHabit] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    let cancelled = false;

    void loadEntries().then((result) => {
      if (cancelled) {
        return;
      }

      if (result?.entries?.length) {
        setEntries(result.entries);
        setSyncSource(result.source);
      }

      setIsHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    void saveEntries(entries).then((result) => {
      setSyncSource(result.source);
    });
  }, [entries, isHydrated]);

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

  const habitCatalog = useMemo(() => {
    const catalog = new Map<string, { title: string; tags: string[]; content: string }>();

    for (const habit of quickHabits) {
      const title = normalizeHabitTitle(habit.title);
      catalog.set(title, { title, tags: [...habit.tags], content: habit.content });
    }

    for (const entry of habitTemplateEntries) {
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
  }, [habitLogs, habitTemplateEntries]);

  useEffect(() => {
    if (!selectedHabit && habitCatalog.length > 0) {
      setSelectedHabit(habitCatalog[0].title);
      return;
    }

    if (selectedHabit && !habitCatalog.some((habit) => habit.title === selectedHabit)) {
      setSelectedHabit(habitCatalog[0]?.title ?? null);
    }
  }, [habitCatalog, selectedHabit]);

  const selectedHabitMeta = useMemo(
    () => habitCatalog.find((habit) => habit.title === selectedHabit) ?? null,
    [habitCatalog, selectedHabit],
  );

  const habitsForDay = useMemo(
    () => habitLogs.filter((entry) => entry.date === habitDate),
    [habitDate, habitLogs],
  );

  const selectedHabitLogs = useMemo(
    () => habitLogs.filter((entry) => entry.title === selectedHabit),
    [habitLogs, selectedHabit],
  );

  const habitStats = useMemo(() => {
    if (!selectedHabit) {
      return null;
    }

    const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
    for (const entry of selectedHabitLogs) {
      const day = new Date(`${entry.date}T12:00:00`).getDay();
      weekdayCounts[day] += 1;
    }

    return {
      total: selectedHabitLogs.length,
      week: selectedHabitLogs.filter((entry) => daysBetween(habitDate, entry.date) <= 6).length,
      month: selectedHabitLogs.filter((entry) => daysBetween(habitDate, entry.date) <= 29).length,
      year: selectedHabitLogs.filter((entry) => daysBetween(habitDate, entry.date) <= 364).length,
      weekdayCounts,
      lastDone: selectedHabitLogs[0]?.date ?? null,
    };
  }, [habitDate, selectedHabit, selectedHabitLogs]);

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

    return byType.filter((entry) => {
      const matchesGenre = genreFilter === "all-genres" || entry.tags.includes(genreFilter);
      const matchesTag = activeTag === null || entry.tags.includes(activeTag);
      return matchesGenre && matchesTag;
    });
  }, [activeTag, genreFilter, libraryFilter, mediaEntries]);

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
      habitsToday: habitsForDay.length,
      library: mediaEntries.length,
      writings: writingEntries.length,
    }),
    [habitCatalog.length, habitsForDay.length, mediaEntries.length, writingEntries.length],
  );

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
    const existing = habitLogs.find((entry) => entry.title === title && entry.date === habitDate);

    if (existing) {
      setEntries((current) => current.filter((entry) => entry.id !== existing.id));
      return;
    }

    const habitMeta = habitCatalog.find((habit) => habit.title === title);
    createEntry({
      id: `${Date.now()}-${title}-${habitDate}`,
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
        `habit-template-${Date.now()}`,
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

    setEntries((current) =>
      current
        .map((entry) => {
          if (habitDraft.originalTitle && entry.type === "habit" && entry.title === habitDraft.originalTitle) {
            return { ...entry, title, content: templateEntry.content };
          }

          if (entry.id === templateEntry.id) {
            return templateEntry;
          }

          return entry;
        })
        .concat(current.some((entry) => entry.id === templateEntry.id) ? [] : [templateEntry]),
    );
    setSelectedHabit(title);
    setHabitDraft(defaultHabitDraft());
  }

  function deleteHabit(title: string) {
    setEntries((current) => current.filter((entry) => !(entry.type === "habit" && entry.title === title)));
    if (selectedHabit === title) {
      setSelectedHabit(null);
    }
    if (habitDraft.originalTitle === title) {
      setHabitDraft(defaultHabitDraft());
    }
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
          setGenreFilter("all-genres");
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
    <main className="mx-auto flex w-full max-w-[1520px] flex-col px-3 py-3 sm:px-5 lg:px-6">
      <div className="grid gap-3 xl:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="rounded-[1.4rem] border border-border bg-surface px-4 py-5 xl:sticky xl:top-3 xl:h-[calc(100vh-1.5rem)]">
          <div className="border-b border-border pb-4">
            <p className="section-kicker">private life</p>
            <h1 className="mt-2 text-[1.85rem] font-medium tracking-[-0.05em] text-foreground">
              Archivo vivo.
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              Menos dashboard y mas secciones utiles.
            </p>
          </div>

          <nav className="mt-5 grid gap-1.5 text-sm">
            {[
              ["habits", "Habitos"],
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
              <span className="stat-label">Habitos</span>
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
              <p className="text-xs leading-5 text-muted">
                Para sincronizar en todos lados hace falta conectar una base remota con credenciales.
              </p>
              <p className="text-xs leading-5 text-muted">
                Persistencia activa: {syncSource === "supabase" ? "Supabase" : "localStorage"}
              </p>
            </div>
          </div>
        </aside>

        <section className="rounded-[1.4rem] border border-border bg-surface px-4 py-5 sm:px-5 sm:py-5">
          {activeView === "habits" ? (
            <div className="space-y-5">
              <ViewHeader
                title="Habitos diarios"
                description="Checklist compacta, estadisticas simples y edicion del catalogo."
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

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_360px]">
                <div className="space-y-4">
                  <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
                    {habitCatalog.map((habit) => {
                      const checked = habitsForDay.some((entry) => entry.title === habit.title);
                      return (
                        <button
                          key={habit.title}
                          type="button"
                          onClick={() => {
                            setSelectedHabit(habit.title);
                            toggleHabit(habit.title);
                          }}
                          className={`habit-toggle-pill ${checked ? "habit-toggle-pill-active" : ""}`}
                        >
                          <span className="habit-toggle-box">{checked ? "✓" : ""}</span>
                          <span className="truncate">{habit.title}</span>
                        </button>
                      );
                    })}
                  </div>

                  <form className="grid gap-3 rounded-[1rem] border border-border bg-panel px-4 py-4" onSubmit={saveHabitTemplate}>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-medium text-foreground">
                        {habitDraft.originalTitle ? "Editar habito" : "Crear habito"}
                      </h3>
                      {habitDraft.originalTitle ? (
                        <button type="button" className="text-xs text-muted" onClick={() => setHabitDraft(defaultHabitDraft())}>
                          Cancelar
                        </button>
                      ) : null}
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
                    <div className="flex justify-end">
                      <button type="submit" className="primary-button">
                        Guardar habito
                      </button>
                    </div>
                  </form>
                </div>

                <div className="space-y-4">
                  {selectedHabitMeta && habitStats ? (
                    <>
                      <article className="rounded-[1rem] border border-border bg-panel px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="section-kicker">habito activo</p>
                            <h3 className="mt-2 text-lg font-medium text-foreground">{selectedHabitMeta.title}</h3>
                            <p className="mt-2 text-sm leading-6 text-muted">
                              {selectedHabitMeta.content || "Sin descripcion"}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button type="button" className="secondary-button" onClick={() => startEditingHabit(selectedHabitMeta.title)}>
                              Editar
                            </button>
                            <button type="button" className="secondary-button" onClick={() => deleteHabit(selectedHabitMeta.title)}>
                              Eliminar
                            </button>
                          </div>
                        </div>
                      </article>

                      <div className="grid gap-3 sm:grid-cols-2">
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
                      </div>

                      <article className="rounded-[1rem] border border-border bg-panel px-4 py-4">
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
                        <p className="mt-4 text-xs text-muted">
                          Ultima vez: {habitStats.lastDone ? formatDate(habitStats.lastDone) : "Nunca"}
                        </p>
                      </article>
                    </>
                  ) : (
                    <EmptyState label="Elige un habito para ver estadisticas y editarlo." />
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {activeView === "library" ? (
            <div className="space-y-5">
              <ViewHeader
                title="Biblioteca"
                description="Peliculas, series y libros con genero filtrable, fecha clara y tu nota arriba."
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

              <div className="flex flex-wrap gap-2">
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
                    <article key={entry.id} className="rounded-[1rem] border border-border bg-panel px-4 py-4">
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
        </section>
      </div>
    </main>
  );
}
