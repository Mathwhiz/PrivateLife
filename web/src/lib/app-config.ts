
export type AppView = "capture" | "habits" | "library" | "writings" | "milestones" | "archive" | "ajustes";

// ─── App config (persisted in localStorage) ──────────────────────

export const CONFIG_KEY = "private-life.config.v1";

export type SidebarItemConfig = { view: AppView; label: string; visible: boolean };
export type MediaTypeConfig = { id: string; label: string; visible: boolean };
export type AppConfig = { sidebar: SidebarItemConfig[]; mediaTypes: MediaTypeConfig[] };

export const defaultAppConfig: AppConfig = {
  sidebar: [
    { view: "habits",     label: "Hábitos",       visible: true },
    { view: "library",    label: "Biblioteca",     visible: true },
    { view: "writings",   label: "Textos",         visible: true },
    { view: "milestones", label: "Hitos",          visible: true },
    { view: "archive",    label: "Archivo",        visible: true },
    { view: "capture",    label: "Nueva entrada",  visible: true },
    { view: "ajustes",    label: "Ajustes",        visible: true },
  ],
  mediaTypes: [
    { id: "movie",  label: "Película", visible: true },
    { id: "series", label: "Serie",    visible: true },
    { id: "book",   label: "Libro",    visible: true },
    { id: "anime",  label: "Anime",    visible: true },
    { id: "manga",  label: "Manga",    visible: true },
    { id: "game",   label: "Videojuego", visible: true },
  ],
};

export const legacyLabels = new Set(["Habitos", "Pelicula"]);

export function loadConfig(): AppConfig {
  if (typeof window === "undefined") return defaultAppConfig;
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (!stored) return defaultAppConfig;
    const parsed = JSON.parse(stored) as Partial<AppConfig>;
    return {
      sidebar: defaultAppConfig.sidebar.map((def) => {
        const s = parsed.sidebar?.find((x) => x.view === def.view);
        if (!s) return def;
        // Etiquetas viejas sin tilde guardadas en localStorage: usar la nueva.
        const label = legacyLabels.has(s.label) ? def.label : s.label;
        return { ...def, ...s, label };
      }),
      mediaTypes: defaultAppConfig.mediaTypes.map((def) => {
        const m = parsed.mediaTypes?.find((x) => x.id === def.id);
        if (!m) return def;
        return { ...def, ...m, label: legacyLabels.has(m.label) ? def.label : m.label };
      }),
    };
  } catch {
    return defaultAppConfig;
  }
}
