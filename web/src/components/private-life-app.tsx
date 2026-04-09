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

function isToday(date: string) {
  return date === new Date().toISOString().slice(0, 10);
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

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="section-kicker">{eyebrow}</p>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <h2 className="text-2xl font-medium tracking-[-0.04em] text-foreground sm:text-3xl">
          {title}
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-muted sm:text-base">{description}</p>
      </div>
    </div>
  );
}

function EntryList({
  entries,
  emptyLabel,
  onTagClick,
  showSection = false,
  highlightMedia = false,
}: {
  entries: LifeEntry[];
  emptyLabel: string;
  onTagClick: (tag: string) => void;
  showSection?: boolean;
  highlightMedia?: boolean;
}) {
  if (entries.length === 0) {
    return (
      <article className="rounded-[1.5rem] border border-border bg-panel px-5 py-6 text-sm text-muted">
        {emptyLabel}
      </article>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <article
          key={entry.id}
          className="rounded-[1.5rem] border border-border bg-panel px-5 py-5"
        >
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted">
            <span>{formatDate(entry.date)}</span>
            <span>{entryTypeLabels[entry.type]}</span>
            {showSection ? <span>{entrySectionLabels[normalizeSection(entry)]}</span> : null}
            {highlightMedia && getReactionBadge(entry) ? (
              <span className="media-badge">{getReactionBadge(entry)}</span>
            ) : null}
          </div>
          <h3 className="mt-3 text-lg font-medium tracking-[-0.03em] text-foreground">
            {entry.title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted">{entry.content}</p>
          {entry.tags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {entry.tags.map((tag) => (
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
      ))}
    </div>
  );
}

function TypeColumn({
  label,
  entries,
  onTagClick,
}: {
  label: string;
  entries: LifeEntry[];
  onTagClick: (tag: string) => void;
}) {
  return (
    <section className="space-y-3 rounded-[1.75rem] border border-border bg-surface px-5 py-5">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <h3 className="text-lg font-medium text-foreground">{label}</h3>
        <span className="text-sm text-muted">{entries.length}</span>
      </div>
      <EntryList
        entries={entries.slice(0, 4)}
        emptyLabel={`Todavia no hay ${label.toLowerCase()} cargados.`}
        onTagClick={onTagClick}
        highlightMedia
      />
    </section>
  );
}

function WritingColumn({
  section,
  entries,
  onTagClick,
}: {
  section: EntrySection;
  entries: LifeEntry[];
  onTagClick: (tag: string) => void;
}) {
  return (
    <section className="space-y-3 rounded-[1.75rem] border border-border bg-surface px-5 py-5">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <h3 className="text-lg font-medium text-foreground">{entrySectionLabels[section]}</h3>
        <span className="text-sm text-muted">{entries.length}</span>
      </div>
      <EntryList
        entries={entries.slice(0, 4)}
        emptyLabel={`Todavia no hay entradas de ${entrySectionLabels[section].toLowerCase()}.`}
        onTagClick={onTagClick}
      />
    </section>
  );
}

function MilestoneList({
  entries,
  onTagClick,
}: {
  entries: LifeEntry[];
  onTagClick: (tag: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <article className="rounded-[1.5rem] border border-border bg-panel px-5 py-6 text-sm text-muted">
        Todavia no hay hitos cargados.
      </article>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {entries.map((entry) => (
        <article
          key={entry.id}
          className="rounded-[1.5rem] border border-border bg-panel px-5 py-5"
        >
          <p className="text-xs uppercase tracking-[0.18em] text-muted">{formatDate(entry.date)}</p>
          <h3 className="mt-3 text-lg font-medium tracking-[-0.03em] text-foreground">
            {entry.title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted">{entry.content}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {entry.tags.map((tag) => (
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
        </article>
      ))}
    </div>
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
  const [filter, setFilter] = useState<EntryType | "all">("all");
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

  const filteredEntries = useMemo(() => {
    const nextEntries =
      filter === "all" ? entries : entries.filter((entry) => entry.type === filter);

    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return sortEntries(
      nextEntries.filter((entry) => {
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
  }, [activeTag, deferredQuery, entries, filter]);

  const allTags = useMemo(() => {
    return [...new Set(entries.flatMap((entry) => entry.tags))].slice(0, 12);
  }, [entries]);

  const habitsAll = useMemo(() => sortEntries(entries.filter((entry) => entry.type === "habit")), [entries]);
  const habitsToday = useMemo(
    () => habitsAll.filter((entry) => isToday(entry.date)),
    [habitsAll],
  );
  const habitsRecent = useMemo(() => habitsAll.slice(0, 6), [habitsAll]);

  const media = useMemo(() => {
    return mediaTypes.map((type) => ({
      type,
      label: entryTypeLabels[type],
      entries: filteredEntries.filter((entry) => entry.type === type),
    }));
  }, [filteredEntries]);

  const writing = useMemo(() => {
    return writingSections.map((section) => ({
      section,
      entries: filteredEntries.filter((entry) => normalizeSection(entry) === section),
    }));
  }, [filteredEntries]);

  const jwMilestones = useMemo(() => {
    return filteredEntries.filter(
      (entry) => entry.type === "memory" && entry.tags.includes("milestone"),
    );
  }, [filteredEntries]);

  const memories = useMemo(() => {
    return filteredEntries.filter(
      (entry) =>
        entry.type === "memory" &&
        !entry.tags.includes("milestone") &&
        normalizeSection(entry) !== "anecdote",
    );
  }, [filteredEntries]);

  const stats = useMemo(() => {
    const mediaAll = entries.filter((entry) => mediaTypes.includes(entry.type));
    const writingAll = entries.filter((entry) =>
      writingSections.includes(normalizeSection(entry)),
    );

    return {
      total: entries.length,
      todayHabits: habitsToday.length,
      mediaCount: mediaAll.length,
      writingCount: writingAll.length,
      milestonesCount: entries.filter(
        (entry) => entry.type === "memory" && entry.tags.includes("milestone"),
      ).length,
      tags: new Set(entries.flatMap((entry) => entry.tags)).size,
    };
  }, [entries, habitsToday]);

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

    const nextEntry: LifeEntry = {
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
    };

    createEntry(nextEntry);
    setForm(defaultFormState());
  }

  function handleQuickHabit(title: string, content: string, tags: readonly string[]) {
    createEntry({
      id: `${Date.now()}-${title}`,
      type: "habit",
      section: "habit",
      title,
      content,
      date: new Date().toISOString().slice(0, 10),
      tags: [...tags],
    });
    setFilter("habit");
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
        const parsed = JSON.parse(text) as {
          entries?: LifeEntry[];
        };

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
          setFilter("all");
          setActiveTag(null);
          setSearchQuery("");
        }
      } catch {
        return;
      } finally {
        event.target.value = "";
      }
    });
  }

  const currentSectionOptions = sectionOptionsByType[form.type];

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col px-4 py-4 sm:px-6 lg:px-8">
      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-[2rem] border border-border bg-surface px-5 py-6 xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
          <div className="border-b border-border pb-5">
            <p className="section-kicker">private life</p>
            <h1 className="mt-3 text-3xl font-medium tracking-[-0.05em] text-foreground">
              Un panel claro para seguir tu vida diaria.
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              Menos landing, mas sistema personal. Todo queda separado por uso real.
            </p>
          </div>

          <nav className="mt-6 grid gap-2 text-sm">
            <a className="nav-link" href="#hoy">
              Hoy y captura
            </a>
            <a className="nav-link" href="#habitos">
              Habitos diarios
            </a>
            <a className="nav-link" href="#biblioteca">
              Libros, series y pelis
            </a>
            <a className="nav-link" href="#hitos">
              Hitos JW
            </a>
            <a className="nav-link" href="#textos">
              Filosofia, pensamientos y recuerdos
            </a>
            <a className="nav-link" href="#archivo">
              Archivo completo
            </a>
          </nav>

          <div className="mt-8 grid gap-3">
            <article className="stat-card">
              <span className="stat-label">Entradas</span>
              <strong className="stat-value">{stats.total}</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Habitos hoy</span>
              <strong className="stat-value">{stats.todayHabits}</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Biblioteca</span>
              <strong className="stat-value">{stats.mediaCount}</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Textos</span>
              <strong className="stat-value">{stats.writingCount}</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Hitos</span>
              <strong className="stat-value">{stats.milestonesCount}</strong>
            </article>
          </div>

          <div className="mt-8 border-t border-border pt-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Etiquetas</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setActiveTag((current) => (current === tag ? null : tag))}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    activeTag === tag
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted hover:border-foreground hover:text-foreground"
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="space-y-4">
          <section
            id="hoy"
            className="rounded-[2rem] border border-border bg-surface px-5 py-6 sm:px-7 sm:py-7"
          >
            <SectionHeader
              eyebrow="Hoy y captura"
              title="Entrar, registrar y encontrar rapido."
              description="La portada ya no compite con el contenido. Desde aqui capturas una entrada nueva, haces backup y mantienes visible el estado general del sistema."
            />

            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
              <div className="grid gap-4 md:grid-cols-3">
                <article className="hero-card">
                  <p className="hero-label">Habitos hoy</p>
                  <p className="hero-value">{stats.todayHabits}</p>
                  <p className="hero-copy">Checks diarios registrados en esta fecha.</p>
                </article>
                <article className="hero-card">
                  <p className="hero-label">Etiquetas</p>
                  <p className="hero-value">{stats.tags}</p>
                  <p className="hero-copy">Temas disponibles para filtrar el archivo.</p>
                </article>
                <article className="hero-card">
                  <p className="hero-label">Ultima entrada</p>
                  <p className="hero-value text-xl leading-7">
                    {entries[0]?.title ?? "Sin registros"}
                  </p>
                  <p className="hero-copy">Siempre visible, sin esconderse en la timeline.</p>
                </article>
              </div>

              <div className="rounded-[1.75rem] border border-border bg-panel px-5 py-5">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">Backup</p>
                <p className="mt-3 text-base leading-7 text-foreground">
                  Los datos siguen guardados localmente en este navegador. Exporta o importa tu
                  archivo cuando quieras.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button type="button" onClick={handleExport} className="primary-button">
                    Exportar JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => importRef.current?.click()}
                    className="secondary-button"
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
            </div>

            <form
              className="mt-6 grid gap-4 rounded-[1.75rem] border border-border bg-panel px-5 py-5"
              onSubmit={handleSubmit}
            >
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
                  placeholder="Anota el hecho, el pensamiento o el contexto para recuperarlo despues."
                  rows={5}
                  className="field min-h-32 resize-y"
                />
              </label>

              <div className="flex justify-end">
                <button type="submit" className="primary-button">
                  Guardar entrada
                </button>
              </div>
            </form>
          </section>

          <section
            id="habitos"
            className="rounded-[2rem] border border-border bg-surface px-5 py-6 sm:px-7 sm:py-7"
          >
            <SectionHeader
              eyebrow="Habitos diarios"
              title="Lo cotidiano tiene su propia zona."
              description="Checks rapidos para hoy, recuento del dia y tus ultimos registros juntos en el mismo lugar."
            />

            <div className="mt-6 grid gap-4 xl:grid-cols-[320px_240px_minmax(0,1fr)]">
              <div className="rounded-[1.75rem] border border-border bg-panel px-5 py-5">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">Acciones rapidas</p>
                <div className="mt-4 grid gap-2">
                  {quickHabits.map((habit) => (
                    <button
                      key={habit.title}
                      type="button"
                      onClick={() => handleQuickHabit(habit.title, habit.content, habit.tags)}
                      className="secondary-button justify-center"
                    >
                      + {habit.title}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-border bg-panel px-5 py-5">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">Resumen de hoy</p>
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="hero-value text-4xl">{habitsToday.length}</p>
                    <p className="hero-copy">registros hechos en el dia</p>
                  </div>
                  <div className="space-y-2">
                    {quickHabits.map((habit) => {
                      const done = habitsToday.some((entry) => entry.title === habit.title);
                      return (
                        <div key={habit.title} className="habit-row">
                          <span>{habit.title}</span>
                          <span className={done ? "habit-pill-active" : "habit-pill"}>
                            {done ? "Hecho" : "Pendiente"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <EntryList
                entries={filter === "all" ? habitsRecent : filteredEntries.filter((entry) => entry.type === "habit")}
                emptyLabel="Todavia no hay habitos para el filtro actual."
                onTagClick={setActiveTag}
              />
            </div>
          </section>

          <section
            id="biblioteca"
            className="rounded-[2rem] border border-border bg-surface px-5 py-6 sm:px-7 sm:py-7"
          >
            <SectionHeader
              eyebrow="Biblioteca"
              title="Libros, series y peliculas con ubicacion obvia."
              description="Cada tipo queda separado visualmente y ademas mantiene su propia seccion interna dentro del dato."
            />

            <div className="mt-6 grid gap-4 xl:grid-cols-3">
              {media.map((group) => (
                <TypeColumn
                  key={group.type}
                  label={group.label}
                  entries={group.entries}
                  onTagClick={setActiveTag}
                />
              ))}
            </div>
          </section>

          <section
            id="hitos"
            className="rounded-[2rem] border border-border bg-surface px-5 py-6 sm:px-7 sm:py-7"
          >
            <SectionHeader
              eyebrow="Hitos JW"
              title="Tu recorrido y privilegios tienen lugar propio."
              description="Los hitos importantes no quedan enterrados en la timeline. Esta zona resume avances, fechas clave y marcas personales de tu historia JW."
            />

            <div className="mt-6">
              <MilestoneList entries={jwMilestones.slice(0, 12)} onTagClick={setActiveTag} />
            </div>
          </section>

          <section
            id="textos"
            className="rounded-[2rem] border border-border bg-surface px-5 py-6 sm:px-7 sm:py-7"
          >
            <SectionHeader
              eyebrow="Textos y recuerdos"
              title="Filosofia, pensamientos y recuerdos en zonas separadas."
              description="Los textos largos y tus pensamientos quedan en columnas propias. Los recuerdos generales viven aparte para no mezclarse con hitos ni con biblioteca."
            />

            <div className="mt-6 grid gap-4 xl:grid-cols-3">
              {writing.map((group) => (
                <WritingColumn
                  key={group.section}
                  section={group.section}
                  entries={group.entries}
                  onTagClick={setActiveTag}
                />
              ))}
            </div>

            <div className="mt-4 rounded-[1.75rem] border border-border bg-surface px-5 py-5">
              <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                <h3 className="text-lg font-medium text-foreground">Recuerdos generales</h3>
                <span className="text-sm text-muted">{memories.length}</span>
              </div>
              <div className="mt-4">
                <EntryList
                  entries={memories.slice(0, 4)}
                  emptyLabel="Todavia no hay recuerdos generales cargados."
                  onTagClick={setActiveTag}
                />
              </div>
            </div>
          </section>

          <section
            id="archivo"
            className="rounded-[2rem] border border-border bg-surface px-5 py-6 sm:px-7 sm:py-7"
          >
            <SectionHeader
              eyebrow="Archivo completo"
              title="Timeline y filtros globales."
              description="Cuando necesitas recorrer todo el sistema, aqui sigues teniendo busqueda, etiquetas y vista unificada."
            />

            <div className="mt-6 grid gap-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className={filter === "all" ? "filter-button-active" : "filter-button"}
                >
                  Todo
                </button>
                {entryTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFilter(type)}
                    className={filter === type ? "filter-button-active" : "filter-button"}
                  >
                    {entryTypeLabels[type]}
                  </button>
                ))}
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar por texto, etiqueta o seccion"
                  className="field"
                />

                {activeTag ? (
                  <button
                    type="button"
                    onClick={() => setActiveTag(null)}
                    className="secondary-button"
                  >
                    Quitar etiqueta: {activeTag}
                  </button>
                ) : null}
              </div>

              <EntryList
                entries={filteredEntries}
                emptyLabel="No hay entradas para el filtro actual."
                onTagClick={setActiveTag}
                showSection
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
