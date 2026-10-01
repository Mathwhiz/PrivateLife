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
import { getSession, onAuthStateChange } from "@/lib/auth";
import { LoginScreen } from "@/components/login-screen";
import { AppConfig, AppView, CONFIG_KEY, loadConfig } from "@/lib/app-config";
import { FormState, HabitDraft, HabitStats, HabitViewMode, MediaFormState, daysBetween, defaultFormState, defaultHabitDraft, defaultMediaForm, entryToMediaForm, habitHiddenTag, habitTemplateTag, isHabitLogEntry, isHabitTemplateEntry, isHiddenHabitTemplateEntry, makeEntryId, mediaTypes, normalizeHabitTitle, normalizeSection, sortEntries, systemMediaTags, todayAR } from "@/lib/entries";
import { ArchiveView } from "@/components/views/archive-view";
import { CaptureView } from "@/components/views/capture-view";
import { HabitsView } from "@/components/views/habits-view";
import { LibraryView } from "@/components/views/library-view";
import { MilestonesView } from "@/components/views/milestones-view";
import { SettingsView } from "@/components/views/ajustes-view";
import { WritingsView } from "@/components/views/writings-view";
import {
  entrySectionLabels,
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
            <HabitsView
              deleteHabit={deleteHabit}
              deleteHabitDraft={deleteHabitDraft}
              habitCatalog={habitCatalog}
              habitDate={habitDate}
              habitDraft={habitDraft}
              habitStats={habitStats}
              habitViewMode={habitViewMode}
              habitsForDay={habitsForDay}
              isHabitComposerOpen={isHabitComposerOpen}
              saveHabitTemplate={saveHabitTemplate}
              selectedHabitMeta={selectedHabitMeta}
              setHabitDate={setHabitDate}
              setHabitDraft={setHabitDraft}
              setHabitViewMode={setHabitViewMode}
              setIsHabitComposerOpen={setIsHabitComposerOpen}
              setSelectedHabit={setSelectedHabit}
              startEditingHabit={startEditingHabit}
              toggleHabit={toggleHabit}
            />
          ) : null}

          {activeView === "library" ? (
            <LibraryView
              appConfig={appConfig}
              deleteEntry={deleteEntry}
              genreFilter={genreFilter}
              libraryFilter={libraryFilter}
              librarySearch={librarySearch}
              librarySort={librarySort}
              mediaForm={mediaForm}
              mediaGenres={mediaGenres}
              openMediaEditor={openMediaEditor}
              ratingFilter={ratingFilter}
              saveMediaForm={saveMediaForm}
              setGenreFilter={setGenreFilter}
              setLibraryFilter={setLibraryFilter}
              setLibrarySearch={setLibrarySearch}
              setLibrarySort={setLibrarySort}
              setMediaForm={setMediaForm}
              setRatingFilter={setRatingFilter}
              visibleMedia={visibleMedia}
            />
          ) : null}

          {activeView === "writings" ? (
            <WritingsView
              writingFilter={writingFilter}
              setWritingFilter={setWritingFilter}
              visibleWritings={visibleWritings}
            />
          ) : null}

          {activeView === "milestones" ? (
            <MilestonesView
              milestoneEntries={milestoneEntries}
            />
          ) : null}

          {activeView === "archive" ? (
            <ArchiveView
              activeTag={activeTag}
              allTags={allTags}
              archiveFilter={archiveFilter}
              filteredArchive={filteredArchive}
              searchQuery={searchQuery}
              setActiveTag={setActiveTag}
              setArchiveFilter={setArchiveFilter}
              setSearchQuery={setSearchQuery}
            />
          ) : null}

          {activeView === "capture" ? (
            <CaptureView
              currentSectionOptions={currentSectionOptions}
              form={form}
              handleSubmit={handleSubmit}
              updateForm={updateForm}
            />
          ) : null}

          {activeView === "ajustes" ? (
            <SettingsView
              appConfig={appConfig}
              setAppConfig={setAppConfig}
              entries={entries}
              handleExport={handleExport}
              handleImportFile={handleImportFile}
              importInputRef={importInputRef}
              importMessage={importMessage}
              openImportPicker={openImportPicker}
              saveLabel={saveLabel}
              syncSource={syncSource}
            />
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
