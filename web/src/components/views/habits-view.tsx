import type { Dispatch, SetStateAction } from "react";
import { EmptyState, ViewHeader } from "@/components/ui/common";
import { HabitDetail } from "@/components/views/habit-detail";
import { armarFilas, esArchivado, grupoDe } from "@/lib/grupos";
import { FilasRegistro } from "@/components/ui/filas-registro";
import { TuDia } from "@/components/ui/tu-dia";
import { type CambiosDia } from "@/lib/dia";
import { defaultHabitDraft, type HabitDraft, type HabitStats, type HabitViewMode } from "@/lib/entries";
import { type LifeEntry } from "@/lib/types";

export type HabitCatalogItem = { title: string; tags: string[]; content: string };
type HabitsViewProps = {
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
  dias: Map<string, LifeEntry>;
  cambiarDia: (fecha: string, cambios: CambiosDia) => void;
};

export function HabitsView({
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
  dias,
  cambiarDia,
}: HabitsViewProps) {
  return (
            <div className="space-y-5">
              <ViewHeader
                title="Registro diario"
                description={
                  habitViewMode === "checklist"
                    ? "Marcá lo que hiciste cada día, bueno o malo."
                    : "Cuándo y cuánto, sin metas."
                }
                aside={
                  habitViewMode === "detail" ? undefined : (
                  <div className="flex flex-wrap items-center gap-2">
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
                  )
                }
                />

              {habitViewMode === "checklist" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="section-kicker">Checklist</p>
                      <p className="mt-1 text-sm text-muted">Tocá lo que hiciste y listo.</p>
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

                  <section className="rounded-xl border border-border bg-panel px-4 py-4">
                    <p className="section-kicker">Tu día</p>
                    <div className="mt-3">
                      <TuDia fecha={habitDate} dias={dias} cambiar={cambiarDia} />
                    </div>
                  </section>

                    <div className="grid gap-2 @xl:grid-cols-2 @4xl:grid-cols-3 @7xl:grid-cols-4">
                      <FilasRegistro
                        filas={armarFilas(habitCatalog.filter((h) => !esArchivado(h)))}
                        hecho={(t) => habitsForDay.some((entry) => entry.title === t)}
                        toggle={toggleHabit}
                        onVer={(t) => {
                          setSelectedHabit(t);
                          setHabitViewMode("detail");
                        }}
                      />
                    </div>

                  {isHabitComposerOpen ? (
                    <form className="grid gap-3 rounded-xl border border-border bg-panel px-4 py-4" onSubmit={saveHabitTemplate}>
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-medium text-foreground">
                          {habitDraft.originalTitle ? "Editar ítem" : "Nuevo ítem"}
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
                        placeholder="Nombre (ej.: Leer, Lol, Alcohol)"
                        className="field"
                      />
                      <input
                        type="text"
                        value={habitDraft.tags}
                        onChange={(event) => setHabitDraft((current) => ({ ...current, tags: event.target.value }))}
                        placeholder="salud, rutina, estudio"
                        className="field"
                      />
                      <label className="grid gap-1.5 text-xs">
                        <span className="text-muted">
                          Grupo (opcional): los ítems con el mismo grupo van juntos en una fila, con un tick cada uno.
                        </span>
                        <input
                          type="text"
                          list="grupos-registro"
                          value={habitDraft.group}
                          onChange={(event) => setHabitDraft((current) => ({ ...current, group: event.target.value }))}
                          placeholder="ej.: JW, Ejercicio, Dientes"
                          className="field"
                        />
                        <datalist id="grupos-registro">
                          {[...new Set(habitCatalog.map(grupoDe).filter(Boolean))].map((g) => (
                            <option key={g} value={g!} />
                          ))}
                        </datalist>
                      </label>
                      <label className="flex items-center gap-2 text-sm text-muted">
                        <input
                          type="checkbox"
                          checked={habitDraft.archived}
                          onChange={(event) => setHabitDraft((current) => ({ ...current, archived: event.target.checked }))}
                        />
                        Ya no lo uso (deja de aparecer para marcar, pero guarda sus estadísticas)
                      </label>
                      <textarea
                        value={habitDraft.content}
                        onChange={(event) => setHabitDraft((current) => ({ ...current, content: event.target.value }))}
                        placeholder="Descripción corta (opcional)"
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
                            Guardar
                          </button>
                        </div>
                      </form>
                    ) : null}
                  </div>
                ) : selectedHabitMeta && habitStats ? (
                  <HabitDetail
                    habit={selectedHabitMeta}
                    stats={habitStats}
                    catalog={habitCatalog}
                    dias={dias}
                    onSelect={setSelectedHabit}
                    onBack={() => setHabitViewMode("checklist")}
                    onEdit={() => {
                      // El formulario de edición vive en la lista.
                      setHabitViewMode("checklist");
                      startEditingHabit(selectedHabitMeta.title);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  />
              ) : (
                <EmptyState label="Elegí un ítem para ver estadísticas y editarlo." />
              )}
            </div>
  );
}
