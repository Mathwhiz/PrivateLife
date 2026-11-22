import { useMemo } from "react";
import {
  daysBetween,
  habitTemplateTag,
  isHabitLogEntry,
  isHabitTemplateEntry,
  isHiddenHabitTemplateEntry,
  normalizeHabitTitle,
  sortEntries,
  type HabitStats,
} from "@/lib/entries";
import { quickHabits, type LifeEntry } from "@/lib/types";

export type HabitCatalogItem = { title: string; tags: string[]; content: string };

/** Todo lo que se deriva de las entradas para la pantalla de hábitos (sin estado propio). */
export function useHabits(entries: LifeEntry[], habitDate: string, selectedHabit: string | null) {
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
    const catalog = new Map<string, HabitCatalogItem>();

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

  return {
    normalizedEntries,
    habitLogs,
    habitTemplateEntries,
    habitCatalog,
    activeHabitTitle,
    selectedHabitMeta,
    habitsForDay,
    habitStats,
  };
}
