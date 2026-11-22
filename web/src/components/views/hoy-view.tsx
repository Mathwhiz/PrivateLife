import { useMemo } from "react";
import { formatDate, todayAR } from "@/lib/entries";
import { type HabitCatalogItem } from "@/lib/use-habits";
import { type RegistroSaludState } from "@/lib/use-registro-salud";
import { entrySectionLabels, entryTypeLabels, type LifeEntry } from "@/lib/types";
import { kindOf } from "@/components/ui/quick-add";
import type { AppView } from "@/lib/app-config";

type HoyViewProps = {
  /** Entradas sin registros de hábitos. */
  entries: LifeEntry[];
  habitCatalog: HabitCatalogItem[];
  doneToday: Set<string>;
  toggleHabitToday: (title: string) => void;
  salud: RegistroSaludState;
  goTo: (view: AppView) => void;
  openEntry: (entry: LifeEntry) => void;
};

const kcal = (n: number) => Math.round(n).toLocaleString("es-AR");

/** Fechas que no sirven para "En este día": inventadas o de importaciones en bloque. */
function fechasDudosas(entries: LifeEntry[]) {
  const porFecha = new Map<string, number>();
  for (const e of entries) porFecha.set(e.date, (porFecha.get(e.date) ?? 0) + 1);
  return (e: LifeEntry) =>
    e.tags.includes("approx-date") ||
    e.tags.includes("childhood") ||
    /-01-0[12]$/.test(e.date) ||
    (porFecha.get(e.date) ?? 0) > 5;
}

function etiqueta(entry: LifeEntry) {
  const kind = kindOf(entry);
  if (kind === "milestone") return "Hito";
  if (kind === "memory") return "Recuerdo";
  if (entry.type === "note") return entrySectionLabels[entry.section ?? "general"];
  return entryTypeLabels[entry.type];
}

export function HoyView({ entries, habitCatalog, doneToday, toggleHabitToday, salud, goTo, openEntry }: HoyViewProps) {
  const hoy = todayAR();
  const anio = Number(hoy.slice(0, 4));

  const enEsteDia = useMemo(() => {
    const dudosa = fechasDudosas(entries);
    return entries
      .filter((e) => e.date.slice(5) === hoy.slice(5) && e.date < hoy && !dudosa(e))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8);
  }, [entries, hoy]);

  const recientes = useMemo(
    () =>
      [...entries]
        .sort((a, b) => (b.created_at ?? `${b.date}T00`).localeCompare(a.created_at ?? `${a.date}T00`))
        .slice(0, 5),
    [entries],
  );

  const ultimoDia = salud.dias[0] ?? null;
  const ultimoPeso = salud.dias.find((d) => d.peso !== null) ?? null;
  const hechos = doneToday.size;
  const fechaLarga = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(
    new Date(`${hoy}T12:00:00`),
  );

  return (
    <div className="space-y-5">
      <header className="border-b border-border pb-5">
        <p className="section-kicker">Hoy</p>
        <h2 className="mt-1.5 text-2xl font-medium tracking-[-0.03em] text-foreground first-letter:uppercase">{fechaLarga}</h2>
      </header>

      <div className="grid gap-4 @4xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="rounded-xl border border-border bg-panel px-4 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="section-kicker">Qué hiciste hoy</p>
            <button type="button" className="text-xs text-muted hover:text-foreground" onClick={() => goTo("habits")}>
              {hechos ? `${hechos} ${hechos === 1 ? "marcado" : "marcados"} · ` : ""}Ver todo ›
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {habitCatalog.map((habit) => {
              const checked = doneToday.has(habit.title);
              return (
                <div key={habit.title} className={`habit-toggle-pill ${checked ? "habit-toggle-pill-active" : ""}`}>
                  <button type="button" onClick={() => toggleHabitToday(habit.title)} className="habit-toggle-main">
                    <span className="habit-toggle-box">{checked ? "✓" : ""}</span>
                    <span className="truncate">{habit.title}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <div className="grid content-start gap-4">
          <button
            type="button"
            className="rounded-xl border border-border bg-panel px-4 py-4 text-left transition-colors hover:border-accent/40"
            onClick={() => goTo("salud")}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="section-kicker">Salud</p>
              <span className="text-xs text-muted">Ver ›</span>
            </div>
            {ultimoDia ? (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <span className="stat-label">{ultimoDia.fecha === hoy ? "Comido hoy" : `Comido ${formatDate(ultimoDia.fecha).slice(0, 6)}`}</span>
                  <span className="stat-value">{kcal(ultimoDia.kcalComidas)}</span>
                  <span className="mt-1 block text-xs text-muted">kcal{ultimoDia.kcalEjercicio ? ` · −${kcal(ultimoDia.kcalEjercicio)} movimiento` : ""}</span>
                </div>
                <div>
                  <span className="stat-label">Peso</span>
                  <span className="stat-value">{ultimoPeso ? ultimoPeso.peso!.toLocaleString("es-AR") : "—"}</span>
                  <span className="mt-1 block text-xs text-muted">{ultimoPeso ? `kg · ${formatDate(ultimoPeso.fecha).slice(0, 6)}` : ""}</span>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">{salud.cargando ? "Leyendo la planilla…" : salud.error || "Sin datos todavía."}</p>
            )}
          </button>

          {enEsteDia.length > 0 ? (
            <section className="rounded-xl border border-border bg-panel px-4 py-4">
              <p className="section-kicker">En este día</p>
              <ul className="mt-3 grid gap-2">
                {enEsteDia.map((e) => (
                  <li key={e.id}>
                    <button type="button" className="w-full text-left" onClick={() => openEntry(e)}>
                      <span className="text-xs text-muted">
                        Hace {anio - Number(e.date.slice(0, 4))} {anio - Number(e.date.slice(0, 4)) === 1 ? "año" : "años"} · {etiqueta(e)}
                      </span>
                      <span className="block truncate text-sm text-foreground">{e.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>

      <section className="rounded-xl border border-border bg-panel px-4 py-4">
        <p className="section-kicker">Lo último</p>
        <ul className="mt-3 grid gap-1">
          {recientes.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 rounded-md px-2 py-1.5 text-left hover:bg-accent-soft"
                onClick={() => openEntry(e)}
              >
                <span className="min-w-0 truncate text-sm text-foreground">
                  <span className="mr-2 text-xs text-muted">{etiqueta(e)}</span>
                  {e.title}
                </span>
                <span className="text-xs text-muted">{formatDate(e.date)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
