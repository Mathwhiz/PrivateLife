"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
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
import { HabitDraft, HabitViewMode, daysBetween, isPendiente, MediaFormState, defaultHabitDraft, defaultMediaForm, entryToMediaForm, habitHiddenTag, habitTemplateTag, makeEntryId, mediaFormToEntry, mediaTypes, normalizeHabitTitle, sortEntries, systemMediaTags, todayAR } from "@/lib/entries";
import { useHabits } from "@/lib/use-habits";
import { ARCHIVADO, GRUPO_PREFIJO, esArchivado, grupoDe } from "@/lib/grupos";
import { acento, sectionColor } from "@/lib/type-style";
import { useRegistroSalud } from "@/lib/use-registro-salud";
import { HabitsView } from "@/components/views/habits-view";
import { HoyView } from "@/components/views/hoy-view";
import { LibraryView } from "@/components/views/library-view";
import { SaludView } from "@/components/views/salud-view";
import { SettingsView } from "@/components/views/ajustes-view";
import { VidaView } from "@/components/views/vida-view";
import { ResumenView } from "@/components/views/resumen-view";
import { SearchOverlay } from "@/components/ui/search-overlay";
import { QuickAddChooser, QuickEntryForm, draftToEntry, entryToDraft, newDraft, type QuickDraft } from "@/components/ui/quick-add";
import {
  initialEntries,
  quickHabits,
  type EntryType,
  type LifeEntry,
} from "@/lib/types";

// Solo en `npm run dev:sandbox`: entra sin login y no toca Supabase.
const SANDBOX = process.env.NEXT_PUBLIC_SANDBOX === "1";

type QuickState = { step: "choose" } | { step: "form"; draft: QuickDraft } | null;

export function PrivateLifeApp() {
  const [authState, setAuthState] = useState<"checking" | "authenticated" | "unauthenticated">("checking");
  const [entries, setEntries] = useState<LifeEntry[]>(initialEntries);
  const [syncSource, setSyncSource] = useState<"supabase" | "local">("local");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeView, setActiveView] = useState<AppView>("hoy");
  const [libraryFilter, setLibraryFilter] = useState<EntryType | "all-media">("all-media");
  const [genreFilter, setGenreFilter] = useState<string>("all-genres");
  const [habitDate, setHabitDate] = useState(todayAR);
  const [habitDraft, setHabitDraft] = useState<HabitDraft>(defaultHabitDraft);
  const [isHabitComposerOpen, setIsHabitComposerOpen] = useState(false);
  const [selectedHabit, setSelectedHabit] = useState<string | null>(null);
  const [habitViewMode, setHabitViewMode] = useState<HabitViewMode>("checklist");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [quick, setQuick] = useState<QuickState>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [undoDelete, setUndoDelete] = useState<{ entry: LifeEntry; index: number } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mediaForm, setMediaForm] = useState<MediaFormState | null>(null);
  const [ratingFilter, setRatingFilter] = useState<"all" | "8" | "9" | "10">("all");
  const [librarySearch, setLibrarySearch] = useState("");
  const [showPendientes, setShowPendientes] = useState(false);
  const [librarySort, setLibrarySort] = useState<"date-desc" | "date-asc" | "rating-desc" | "rating-asc">("date-desc");
  const [appConfig, setAppConfig] = useState<AppConfig>(() => loadConfig());
  const [importMessage, setImportMessage] = useState<string>("");
  const [syncConflict, setSyncConflict] = useState(false);
  const [pendingRemoteEntries, setPendingRemoteEntries] = useState<LifeEntry[] | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  // Evita el eco: cuando las entradas vienen de la nube no hay que volver a subirlas.
  const skipNextSave = useRef(false);

  // 1. Verificar sesión al montar y escuchar cambios de auth
  useEffect(() => {
    if (SANDBOX) {
      setAuthState("authenticated");
      return;
    }

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

  const {
    normalizedEntries,
    habitLogs,
    habitTemplateEntries,
    habitCatalog,
    selectedHabitMeta,
    habitsForDay,
    habitStats,
  } = useHabits(entries, habitDate, selectedHabit);

  const banoDates = useMemo(
    () => [...new Set(habitLogs.filter((entry) => entry.title === "Ba\u00f1o").map((entry) => entry.date))],
    [habitLogs],
  );

  const today = todayAR();
  const doneToday = useMemo(
    () => new Set(habitLogs.filter((entry) => entry.date === today).map((entry) => entry.title)),
    [habitLogs, today],
  );

  // En Hoy van solo los hábitos que usás: marcados en los últimos 45 días, los más frecuentes primero.
  const activeHabits = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of habitLogs) {
      if (daysBetween(today, entry.date) <= 44) counts.set(entry.title, (counts.get(entry.title) ?? 0) + 1);
    }
    // Recién creados también, aunque todavía no se hayan marcado (ej.: Correr, Caminar).
    const nuevos = new Set(
      habitTemplateEntries.filter((entry) => daysBetween(today, entry.date) <= 44).map((entry) => entry.title),
    );
    const usables = habitCatalog.filter((habit) => !esArchivado(habit));
    const gruposActivos = new Set(
      usables.filter((h) => counts.has(h.title) || nuevos.has(h.title)).map(grupoDe).filter(Boolean),
    );
    const active = usables.filter(
      (habit) => counts.has(habit.title) || nuevos.has(habit.title) || gruposActivos.has(grupoDe(habit)),
    );
    return [...(active.length ? active : usables)].sort((a, b) => (counts.get(b.title) ?? 0) - (counts.get(a.title) ?? 0));
  }, [habitCatalog, habitLogs, habitTemplateEntries, today]);

  // Todo menos los registros de hábitos (son ~8.400 y solo ensucian listas y búsqueda).
  const lifeEntries = useMemo(() => normalizedEntries.filter((entry) => entry.type !== "habit"), [normalizedEntries]);
  const vidaEntries = useMemo(
    () => lifeEntries.filter((entry) => entry.type === "note" || entry.type === "memory"),
    [lifeEntries],
  );

  // En modo prueba no hay Supabase: muestra lo cacheado y el aviso de que no pudo actualizar.
  const salud = useRegistroSalud(isHydrated);

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

  const pendientesCount = useMemo(() => mediaEntries.filter(isPendiente).length, [mediaEntries]);

  const visibleMedia = useMemo(() => {
    // "Quiero ver" es una lista aparte: no se mezcla con lo que ya viste.
    const scoped = mediaEntries.filter((entry) => isPendiente(entry) === showPendientes);
    const byType =
      libraryFilter === "all-media"
        ? scoped
        : scoped.filter((entry) => entry.type === libraryFilter);

    const searchNorm = librarySearch.trim().toLowerCase();

    const filtered = byType.filter((entry) => {
      const matchesGenre = genreFilter === "all-genres" || entry.tags.includes(genreFilter);
      const matchesSearch =
        searchNorm === "" || entry.title.toLowerCase().includes(searchNorm);
      const matchesRating =
        ratingFilter === "all" ||
        (entry.rating !== undefined &&
          entry.rating !== null &&
          parseFloat(`${entry.rating}`) >= parseFloat(ratingFilter));
      return matchesGenre && matchesSearch && matchesRating;
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
  }, [genreFilter, libraryFilter, librarySearch, librarySort, mediaEntries, ratingFilter, showPendientes]);

  function createEntry(nextEntry: LifeEntry) {
    setEntries((current) => [nextEntry, ...current]);
  }

  function toggleHabit(title: string, date = habitDate) {
    const existing = habitLogs.find((entry) => entry.title === title && entry.date === date);

    if (existing) {
      setEntries((current) => current.filter((entry) => entry.id !== existing.id));
      return;
    }

    const habitMeta = habitCatalog.find((habit) => habit.title === title);
    createEntry({
      id: makeEntryId("habit-log", title, date),
      type: "habit",
      section: "habit",
      title,
      content: habitMeta?.content ?? "Registro diario del habito.",
      date,
      tags: [...new Set(["habit", ...(habitMeta?.tags ?? []).filter((tag) => tag !== ARCHIVADO && !tag.startsWith(GRUPO_PREFIJO))])],
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
      tags: habitMeta.tags.filter((tag) => tag !== ARCHIVADO && !tag.startsWith(GRUPO_PREFIJO)).join(", "),
      group: grupoDe(habitMeta) ?? "",
      archived: esArchivado(habitMeta),
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
          .filter((tag) => tag && tag !== ARCHIVADO && !tag.startsWith(GRUPO_PREFIJO)),
        ...(habitDraft.group.trim() ? [`${GRUPO_PREFIJO}${habitDraft.group.trim()}`] : []),
        ...(habitDraft.archived ? [ARCHIVADO] : []),
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

  function openMediaEditor(entry?: LifeEntry, overrides?: Partial<MediaFormState>) {
    if (entry) {
      setMediaForm({ ...entryToMediaForm(entry), ...overrides });
    } else {
      const type = libraryFilter === "all-media" ? "movie" : (libraryFilter as EntryType);
      // Desde "Quiero ver", lo nuevo nace pendiente.
      setMediaForm({ ...defaultMediaForm(type), pending: showPendientes, ...overrides });
    }
  }

  function openNewMedia(type: EntryType, pending = false) {
    setQuick(null);
    setLibraryFilter(type);
    setShowPendientes(pending);
    setMediaForm({ ...defaultMediaForm(type), pending });
    setActiveView("library");
  }

  /** Abre una entrada donde se edita: biblioteca, formulario corto o el día del hábito. */
  function openEntry(entry: LifeEntry) {
    setSearchOpen(false);
    if (mediaTypes.includes(entry.type)) {
      setShowPendientes(isPendiente(entry));
      setMediaForm(entryToMediaForm(entry));
      setActiveView("library");
      return;
    }
    if (entry.type === "habit") {
      setHabitDate(entry.date);
      setHabitViewMode("checklist");
      setActiveView("habits");
      return;
    }
    const draft = entryToDraft(entry);
    if (draft) setQuick({ step: "form", draft });
  }

  function saveQuick(draft: QuickDraft) {
    const existing = draft.id ? entries.find((e) => e.id === draft.id) : undefined;
    const next = draftToEntry(draft, existing, new Set(entries.map((e) => e.id)));
    setEntries((current) => (existing ? current.map((e) => (e.id === next.id ? next : e)) : [next, ...current]));
    setQuick(null);
  }

  // Cada sección arranca desde arriba.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [activeView]);

  // Ctrl/Cmd+K abre la búsqueda desde cualquier pantalla.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function saveMediaForm(event: React.FormEvent) {
    event.preventDefault();
    if (!mediaForm || !mediaForm.title.trim()) return;

    const isNew = !mediaForm.id;
    const id = isNew
      ? makeEntryId(mediaForm.type, mediaForm.date, mediaForm.title)
      : mediaForm.id;

    const existing = isNew ? undefined : entries.find((e) => e.id === id);
    const next = mediaFormToEntry(mediaForm, id, existing);

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

  const navItems = appConfig.sidebar.filter((item) => item.visible);

  return (
    <main
      className="app-shell mx-auto flex w-full max-w-[2200px] flex-col px-3 py-3 sm:px-4 lg:px-5"
      style={acento(sectionColor[activeView])}
    >
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
              <h1 className="mt-2 text-base font-medium tracking-[-0.02em] text-foreground">Archivo vivo.</h1>
            </div>
            <button type="button" onClick={() => setSidebarOpen(false)} className="sidebar-toggle mt-0.5" title="Cerrar menú">
              ‹
            </button>
          </div>

          <button type="button" className="search-trigger mt-4" onClick={() => setSearchOpen(true)}>
            <SearchIcon />
            <span className="flex-1 text-left">Buscar</span>
            <kbd className="text-[0.65rem] text-muted">Ctrl K</kbd>
          </button>

          <nav className="mt-4 grid gap-1.5 text-sm">
            {navItems.map(({ view, label }) => (
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

          <button type="button" className="primary-button mt-5" onClick={() => setQuick({ step: "choose" })}>
            + Agregar
          </button>

          <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-4">
            <p className="text-xs text-muted">
              {saveStatus === "saving" ? "↻ " : "↑ "}
              {SANDBOX ? "Modo prueba (sin nube)" : saveLabel}
            </p>
            <button
              type="button"
              className={`icon-button ${activeView === "ajustes" ? "text-accent" : ""}`}
              onClick={() => setActiveView("ajustes")}
              title="Ajustes"
              aria-label="Ajustes"
            >
              <GearIcon />
            </button>
          </div>
        </aside>

        <section className="@container min-w-0 rounded-xl border border-border bg-surface px-5 py-5 sm:px-6 sm:py-6">
          {/* Barra superior: en el celular siempre, en escritorio solo con el menú cerrado. */}
          <div className={`mb-5 flex items-center gap-2 border-b border-border pb-4 ${sidebarOpen ? "xl:hidden" : ""}`}>
            <span className="hidden xl:inline-flex">
              <button type="button" onClick={() => setSidebarOpen(true)} className="sidebar-toggle" title="Abrir menú">
                ≡
              </button>
            </span>
            <span className="section-kicker flex-1">private life</span>
            <button type="button" className="icon-button" onClick={() => setSearchOpen(true)} aria-label="Buscar" title="Buscar">
              <SearchIcon />
            </button>
            <button
              type="button"
              className={`icon-button ${activeView === "ajustes" ? "text-accent" : ""}`}
              onClick={() => setActiveView("ajustes")}
              aria-label="Ajustes"
              title="Ajustes"
            >
              <GearIcon />
            </button>
          </div>

          {activeView === "hoy" ? (
            <HoyView
              entries={lifeEntries}
              habitCatalog={activeHabits}
              doneToday={doneToday}
              toggleHabitToday={(title) => toggleHabit(title, today)}
              salud={salud}
              goTo={setActiveView}
              openEntry={openEntry}
            />
          ) : null}

          {activeView === "habits" ? (
            <HabitsView
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
              toggleHabit={(title) => toggleHabit(title)}
            />
          ) : null}

          {activeView === "salud" ? <SaludView banoDates={banoDates} salud={salud} /> : null}

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
              showPendientes={showPendientes}
              setShowPendientes={setShowPendientes}
              pendientesCount={pendientesCount}
            />
          ) : null}

          {activeView === "vida" ? <VidaView entries={vidaEntries} openEntry={openEntry} verResumen={() => setActiveView("resumen")} /> : null}

          {activeView === "resumen" ? <ResumenView entries={normalizedEntries} dias={salud.dias} openEntry={openEntry} /> : null}

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

      {/* El "+" flotante solo en el celular: en escritorio está en el menú lateral. */}
      {quick === null && !searchOpen && mediaForm === null ? (
        <button type="button" className="fab xl:hidden" onClick={() => setQuick({ step: "choose" })} aria-label="Agregar">
          +
        </button>
      ) : null}

      {quick?.step === "choose" ? (
        <QuickAddChooser
          onClose={() => setQuick(null)}
          onPick={(kind) => setQuick({ step: "form", draft: newDraft(kind) })}
          onPickMedia={openNewMedia}
          onPickWishlist={() => openNewMedia(libraryFilter === "all-media" ? "movie" : libraryFilter, true)}
          mediaVisible={(type) => appConfig.mediaTypes.find((m) => m.id === type)?.visible ?? true}
        />
      ) : null}

      {quick?.step === "form" ? (
        <QuickEntryForm
          key={quick.draft.id ?? quick.draft.kind}
          initial={quick.draft}
          onClose={() => setQuick(null)}
          onSave={saveQuick}
          onDelete={
            quick.draft.id
              ? () => {
                  deleteEntry(quick.draft.id!);
                  setQuick(null);
                }
              : undefined
          }
        />
      ) : null}

      {searchOpen ? <SearchOverlay entries={normalizedEntries} onOpen={openEntry} onClose={() => setSearchOpen(false)} /> : null}

      {undoDelete ? (
        <div className="undo-toast" role="status">
          <span className="truncate">Se eliminó “{undoDelete.entry.title}”</span>
          <button type="button" className="undo-toast-action" onClick={undoDeleteEntry}>
            Deshacer
          </button>
        </div>
      ) : null}

      <nav className="bottom-nav xl:hidden" aria-label="Secciones">
        {navItems.map(({ view, label }) => (
          <button
            key={view}
            type="button"
            onClick={() => setActiveView(view)}
            className={activeView === view ? "bottom-nav-item bottom-nav-item-active" : "bottom-nav-item"}
            aria-current={activeView === view ? "page" : undefined}
          >
            {label}
          </button>
        ))}
      </nav>
    </main>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
