import type { Dispatch, SetStateAction } from "react";
import { EmptyState, ViewHeader } from "@/components/ui/common";
import { defaultHabitDraft, formatDate, type HabitDraft, type HabitStats, type HabitViewMode } from "@/lib/entries";
import { type LifeEntry } from "@/lib/types";

export type HabitCatalogItem = { title: string; tags: string[]; content: string };
type HabitsViewProps = {
  deleteHabit: (title: string) => void;
  deleteHabitDraft: () => void;
  habitCatalog: HabitCatalogItem[];
  habitDate: string;
  habitDraft: HabitDraft;
  habitStats: HabitStats | null;
  habitViewMode: HabitViewMode;
  habitsForDay: LifeEntry[];
  isHabitComposerOpen: boolean;
  saveHabitTemplate: (event: React.FormEvent<HTMLFormElement>) => void;
  selectedHabitMeta: HabitCatalogItem | null;
  setHabitDate: Dispatch<SetStateAction<string>>;
  setHabitDraft: Dispatch<SetStateAction<HabitDraft>>;
  setHabitViewMode: Dispatch<SetStateAction<HabitViewMode>>;
  setIsHabitComposerOpen: Dispatch<SetStateAction<boolean>>;
  setSelectedHabit: Dispatch<SetStateAction<string | null>>;
  startEditingHabit: (title: string) => void;
  toggleHabit: (title: string) => void;
};

export function HabitsView({
  deleteHabit,
  deleteHabitDraft,
  habitCatalog,
  habitDate,
  habitDraft,
  habitStats,
  habitViewMode,
  habitsForDay,
  isHabitComposerOpen,
  saveHabitTemplate,
  selectedHabitMeta,
  setHabitDate,
  setHabitDraft,
  setHabitViewMode,
  setIsHabitComposerOpen,
  setSelectedHabit,
  startEditingHabit,
  toggleHabit,
}: HabitsViewProps) {
  return (
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
  );
}
