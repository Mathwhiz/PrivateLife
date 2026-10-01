"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  flushSave,
  getKnownUpdatedAt,
  hasPendingSave,
  loadEntries,
  scheduleSave,
  setKnownUpdatedAt,
  type SaveHandlers,
  type SaveStatus,
} from "@/lib/persistence";
import { getSession, signOut as authSignOut, onAuthStateChange } from "@/lib/auth";
import { LoginScreen } from "@/components/login-screen";
import { AppConfig, AppView, CONFIG_KEY, defaultAppConfig, loadConfig } from "@/lib/app-config";
import { FormState, HabitDraft, HabitStats, HabitViewMode, MediaFormState, daysBetween, defaultFormState, defaultHabitDraft, defaultMediaForm, entryToMediaForm, entryTypes, formatDate, habitHiddenTag, habitTemplateTag, isHabitLogEntry, isHabitTemplateEntry, isHiddenHabitTemplateEntry, makeEntryId, mediaTypes, normalizeHabitTitle, normalizeSection, sortEntries, systemMediaTags, todayAR, writingSections } from "@/lib/entries";
import { EmptyState, ViewHeader } from "@/components/ui/common";
import { ArchiveCard, MediaCard, WritingCard } from "@/components/ui/entry-cards";
import { MediaEditorForm } from "@/components/ui/media-editor-form";
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


export function PrivateLifeApp() {
  const [authState, setAuthState] = useState<"checking" | "authenticated" | "unauthenticated">("checking");
  const [entries, setEntries] = useState<LifeEntry[]>(initialEntries);
  const [syncSource, setSyncSource] = useState<"supabase" | "local">("local");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
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
  const [moreOpen, setMoreOpen] = useState(false);
  const [undoDelete, setUndoDelete] = useState<{ entry: LifeEntry; index: number } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  // Evita el eco: cuando las entradas vienen de la nube no hay que volver a subirlas.
  const skipNextSave = useRef(false);
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
        skipNextSave.current = true;
        setEntries(result.entries);
        setSyncSource(result.source);
        setKnownUpdatedAt(result.updatedAt);
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
      // Al irse: subir ya lo que quedo esperando el debounce.
      if (document.visibilityState === "hidden") {
        void flushSave();
        return;
      }

      if (!getKnownUpdatedAt()) return; // todavia no cargo la primera vez
      if (hasPendingSave()) return; // hay cambios sin subir: no los pisamos

      void loadEntries().then((result) => {
        if (!result?.entries?.length) return;
        const known = getKnownUpdatedAt();
        if (known && result.updatedAt <= known) return; // ya tenemos la version mas nueva
        skipNextSave.current = true;
        setEntries(result.entries);
        setKnownUpdatedAt(result.updatedAt);
        setSyncSource(result.source);
      });
    };

    const handleExit = () => {
      void flushSave();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handleExit);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handleExit);
    };
  }, [authState]);

  // 4. Guardar entradas cada vez que cambian.
  //    scheduleSave escribe local al instante y agrupa las subidas: marcar
  //    varios habitos seguidos manda una sola escritura, no una por click.
  const saveHandlers = useRef<SaveHandlers>({
    onStatus: () => {},
    onConflict: () => {},
    onSynced: () => {},
  });
  saveHandlers.current = {
    onStatus: setSaveStatus,
    onConflict: (remoteEntries) => {
      setPendingRemoteEntries(remoteEntries);
      setSyncConflict(true);
    },
    onSynced: setSyncSource,
  };

  useEffect(() => {
    if (!isHydrated) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    scheduleSave(entries, saveHandlers.current);
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

  // Solo los generos del tipo elegido: pelis y juegos usan vocabularios distintos.
  const mediaGenres = useMemo(
    () =>
      [...new Set(
        mediaEntries
          .filter((entry) => libraryFilter === "all-media" || entry.type === libraryFilter)
          .flatMap((entry) =>
            entry.tags.filter((tag) => !systemMediaTags.has(tag) && !tag.includes("import")),
          ),
      )].sort((a, b) => a.localeCompare(b)),
    [libraryFilter, mediaEntries],
  );

  // Si el genero elegido no existe en el tipo nuevo, quedaria un filtro fantasma.
  useEffect(() => {
    if (genreFilter !== "all-genres" && !mediaGenres.includes(genreFilter)) {
      setGenreFilter("all-genres");
    }
  }, [genreFilter, mediaGenres]);

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
    const index = entries.findIndex((e) => e.id === id);
    if (index === -1) return;
    const removed = entries[index];
    setEntries((current) => current.filter((e) => e.id !== id));
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoDelete({ entry: removed, index });
    undoTimer.current = setTimeout(() => setUndoDelete(null), 6000);
  }

  function undoDeleteEntry() {
    if (!undoDelete) return;
    const { entry, index } = undoDelete;
    setEntries((current) => {
      if (current.some((e) => e.id === entry.id)) return current;
      const next = [...current];
      next.splice(Math.min(index, next.length), 0, entry);
      return next;
    });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoDelete(null);
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

  const saveLabel =
    saveStatus === "saving"
      ? "Guardando…"
      : saveStatus === "pending"
        ? "Sin conexión — reintentando"
        : saveStatus === "conflict"
          ? "Sin subir"
          : syncSource === "supabase"
            ? "Guardado"
            : "Solo en este equipo";

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

  const mobileNavItems = appConfig.sidebar.filter((item) => item.visible);

  return (
    <main className="app-shellmx-auto flex w-full max-w-[1520px] flex-col px-3 py-3 sm:px-4 lg:px-5">
      {syncConflict && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold/30 bg-gold/10 px-4 py-2.5 text-sm text-gold">
          <span>Se editó desde otro dispositivo. Elegí con cuál te quedás.</span>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded bg-gold/20 px-2 py-1 text-xs hover:bg-gold/30"
              onClick={() => {
                if (pendingRemoteEntries) {
                  skipNextSave.current = true;
                  setEntries(pendingRemoteEntries);
                  setPendingRemoteEntries(null);
                }
                setSyncConflict(false);
                setSaveStatus("saved");
              }}
            >
              Traer lo de la nube
            </button>
            <button
              type="button"
              className="rounded px-2 py-1 text-xs hover:bg-gold/20"
              onClick={() => {
                setPendingRemoteEntries(null);
                setSyncConflict(false);
                // Subir lo de este dispositivo encima de lo remoto.
                scheduleSave(entries, saveHandlers.current);
              }}
            >
              Mantener lo mío
            </button>
          </div>
        </div>
      )}
      <div className={`grid gap-3 ${sidebarOpen ? "xl:grid-cols-[220px_minmax(0,1fr)]" : ""}`}>
        <aside className={`hidden flex-col rounded-xl border border-border bg-surface px-4 py-5 xl:sticky xl:top-3 xl:h-[calc(100vh-1.5rem)] ${sidebarOpen ? "xl:flex" : ""}`}>
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
                title="Cerrar menú"
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
              {saveStatus === "saving" ? "↻ " : "↑ "}
              {saveLabel}
            </p>
          </div>
        </aside>

        <section className="rounded-xl border border-border bg-surface px-5 py-5 sm:px-6 sm:py-6">
            {!sidebarOpen ? (
              <div className="mb-5 hidden items-center gap-3 border-b border-border pb-4 xl:flex">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="sidebar-toggle"
                  title="Abrir menú"
                >
                  ≡
                </button>
                <span className="section-kicker">private life</span>
              </div>
            ) : null}
            {activeView === "habits" ? (
            <div className="space-y-5">
              <ViewHeader
                title="Hábitos diarios"
                description={
                  habitViewMode === "checklist"
                    ? "Checklist compacta para resolver el día sin ruido."
                    : "Detalle del hábito con estadísticas y edición."
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
                          {habitDraft.originalTitle ? "Editar hábito" : "Crear hábito"}
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
                        placeholder="Nombre del hábito"
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
                        placeholder="Contexto corto del hábito"
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
                            Guardar hábito
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
                          <p className="section-kicker">hábito activo</p>
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
                        Última vez: {habitStats.lastDone ? formatDate(habitStats.lastDone) : "Nunca"}
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
                <EmptyState label="Elegí un hábito para ver estadísticas y editarlo." />
              )}
            </div>
          ) : null}

          {activeView === "library" ? (
            <div className="space-y-5">
              <ViewHeader
                title="Biblioteca"
                description="Películas, series y libros con género filtrable, fecha clara y tu nota arriba."
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
                description="Búsqueda global para recorrer todo el sistema cuando lo necesitás."
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
                  <span className="font-medium text-foreground">Título</span>
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
                <p className="mt-1 text-xs text-muted">
                  {entries.length} entradas en total · {saveLabel.toLowerCase()}.
                </p>
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
                  Cerrar sesión desconecta este dispositivo. Los datos en la nube no se borran.
                </p>
                <button
                  type="button"
                  className="mt-4 danger-button"
                  onClick={() => void authSignOut()}
                >
                  Cerrar sesión
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {undoDelete ? (
        <div className="undo-toast" role="status">
          <span className="truncate">Se eliminó “{undoDelete.entry.title}”</span>
          <button type="button" className="undo-toast-action" onClick={undoDeleteEntry}>
            Deshacer
          </button>
        </div>
      ) : null}

      {moreOpen ? (
        <div className="more-sheet-backdrop xl:hidden" onClick={() => setMoreOpen(false)}>
          <div className="more-sheet" role="menu" onClick={(event) => event.stopPropagation()}>
            {mobileNavItems.slice(4).map(({ view, label }) => (
              <button
                key={view}
                type="button"
                role="menuitem"
                onClick={() => {
                  setActiveView(view);
                  setMoreOpen(false);
                }}
                className={activeView === view ? "nav-link nav-link-active" : "nav-link"}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <nav className="bottom-nav xl:hidden" aria-label="Secciones">
        {mobileNavItems.slice(0, mobileNavItems.length > 5 ? 4 : 5).map(({ view, label }) => (
          <button
            key={view}
            type="button"
            onClick={() => {
              setActiveView(view);
              setMoreOpen(false);
            }}
            className={activeView === view ? "bottom-nav-item bottom-nav-item-active" : "bottom-nav-item"}
            aria-current={activeView === view ? "page" : undefined}
          >
            {label}
          </button>
        ))}
        {mobileNavItems.length > 5 ? (
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            className={
              moreOpen || mobileNavItems.slice(4).some((item) => item.view === activeView)
                ? "bottom-nav-item bottom-nav-item-active"
                : "bottom-nav-item"
            }
            aria-expanded={moreOpen}
          >
            Más
          </button>
        ) : null}
      </nav>
    </main>
  );
}
