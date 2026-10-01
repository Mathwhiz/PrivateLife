import {
  sectionOptionsByType,
  type EntrySection,
  type EntryType,
  type LifeEntry,
} from "@/lib/types";

export const habitTemplateTag = "habit-template";
export const habitHiddenTag = "habit-hidden";
export const systemMediaTags = new Set([
  "movie",
  "series",
  "book",
  "anime",
  "manga",
  "game",
  "steam",
  "imported",
  "imdb",
  "life-xlsx",
  "rated",
  "liked",
  "wow",
  "approx-date",
  "childhood",
]);

export const entryTypes: EntryType[] = ["memory", "habit", "movie", "book", "series", "anime", "manga", "game", "note"];
export const mediaTypes: EntryType[] = ["movie", "series", "book", "anime", "manga", "game"];
export const writingSections: EntrySection[] = ["philosophy", "thought", "anecdote"];

export type FormState = {
  type: EntryType;
  section: EntrySection;
  title: string;
  content: string;
  date: string;
  tags: string;
};

export type HabitDraft = {
  originalTitle: string | null;
  title: string;
  content: string;
  tags: string;
};

export type HabitStats = {
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

export type HabitViewMode = "checklist" | "detail";

export type MediaFormState = {
  id: string;
  type: EntryType;
  title: string;
  content: string;
  date: string;
  rating: string;
  tags: string;
};

export const defaultType: EntryType = "memory";

export const defaultFormState = (): FormState => ({
  type: defaultType,
  section: sectionOptionsByType[defaultType][0],
  title: "",
  content: "",
  date: todayAR(),
  tags: "",
});

export const defaultHabitDraft = (): HabitDraft => ({
  originalTitle: null,
  title: "",
  content: "",
  tags: "",
});

export function defaultMediaForm(type: EntryType = "movie"): MediaFormState {
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

export function entryToMediaForm(entry: LifeEntry): MediaFormState {
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

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function normalizeSection(entry: LifeEntry): EntrySection {
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
    case "game":
      return "game";
    case "memory":
      return "anecdote";
    case "note":
    default:
      return "thought";
  }
}

export function sortEntries(entries: LifeEntry[]) {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date));
}

export function getReactionBadge(entry: LifeEntry) {
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

export function getDisplayRating(entry: LifeEntry) {
  if (entry.rating !== undefined && entry.rating !== null && `${entry.rating}`.trim() !== "") {
    return `${entry.rating}/10`;
  }
  return getReactionBadge(entry);
}

export function getRatingBadgeClass(entry: LifeEntry): string {
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

export function compactMeta(entry: LifeEntry) {
  return entry.content
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);
}

export function excerptText(text: string, limit = 260) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= limit) {
    return compact;
  }
  return `${compact.slice(0, limit).trimEnd()}...`;
}

export function normalizeHabitTitle(title: string) {
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

export function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function daysBetween(reference: string, target: string) {
  const ref = startOfDay(new Date(`${reference}T12:00:00`));
  const tar = startOfDay(new Date(`${target}T12:00:00`));
  return Math.floor((ref.getTime() - tar.getTime()) / 86_400_000);
}

// Fecha de hoy en horario de Argentina (UTC-3, sin DST)
export function todayAR(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date());
}

export function makeEntryId(prefix: string, ...parts: string[]) {
  return [prefix, ...parts.map((part) => part.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))]
    .filter(Boolean)
    .join("-");
}

export function isHabitTemplateEntry(entry: LifeEntry) {
  return entry.type === "habit" && entry.tags.includes(habitTemplateTag);
}

export function isHiddenHabitTemplateEntry(entry: LifeEntry) {
  return isHabitTemplateEntry(entry) && entry.tags.includes(habitHiddenTag);
}

export function isHabitLogEntry(entry: LifeEntry) {
  return entry.type === "habit" && !entry.tags.includes(habitTemplateTag) && !entry.tags.includes("summary");
}
