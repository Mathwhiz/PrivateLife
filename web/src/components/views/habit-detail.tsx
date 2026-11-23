import { useState } from "react";
import { YearHeatmap } from "@/components/ui/heatmap";
import { daysBetween, formatDate, todayAR, type HabitStats } from "@/lib/entries";
import { type HabitCatalogItem } from "@/lib/use-habits";
import { acento, itemColor } from "@/lib/type-style";
import { type LifeEntry } from "@/lib/types";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function haceCuanto(fecha: string) {
  const d = daysBetween(todayAR(), fecha);
  if (d <= 0) return "hoy";
  if (d === 1) return "ayer";
  if (d < 30) return `hace ${d} días`;
  if (d < 365) return `hace ${Math.round(d / 30)} ${Math.round(d / 30) === 1 ? "mes" : "meses"}`;
  return `hace ${Math.round(d / 365)} ${Math.round(d / 365) === 1 ? "año" : "años"}`;
}

/** Estadísticas de un ítem del registro. Cuenta lo que pasó; no lo trata como meta. */
export function HabitDetail({
  habit,
  stats,
  catalog,
  dias,
  onSelect,
  onBack,
  onEdit,
}: {
  habit: HabitCatalogItem;
  stats: HabitStats;
  catalog: HabitCatalogItem[];
  dias: Map<string, LifeEntry>;
  onSelect: (title: string) => void;
  onBack: () => void;
  onEdit: () => void;
}) {
  const fechas = new Set(stats.dates);
  const porAnio = new Map<number, number>();
  for (const d of stats.dates) porAnio.set(Number(d.slice(0, 4)), (porAnio.get(Number(d.slice(0, 4))) ?? 0) + 1);
  const anios = [...porAnio.keys()].sort((a, b) => a - b);
  const [anioElegido, setAnio] = useState<number | null>(null);
  const anio = anioElegido !== null && porAnio.has(anioElegido) ? anioElegido : anios.at(-1) ?? Number(todayAR().slice(0, 4));
  const topeAnio = Math.max(...porAnio.values(), 1);

  // De lunes a domingo (weekdayCounts viene de domingo a sábado).
  const semana = [1, 2, 3, 4, 5, 6, 0].map((i) => stats.weekdayCounts[i]);
  const topeSemana = Math.max(...semana, 1);

  // Ánimo promedio los días que sí y los que no (solo desde que se anota el ánimo).
  const con: number[] = [];
  const sin: number[] = [];
  for (const [fecha, dia] of dias) if (dia.animo) (fechas.has(fecha) ? con : sin).push(dia.animo);
  const prom = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / xs.length).toLocaleString("es-AR", { maximumFractionDigits: 1 });

  const cadaCuanto =
    stats.avgGap90 === null
      ? "—"
      : stats.avgGap90 <= 1.05
        ? "a diario"
        : `cada ${stats.avgGap90.toLocaleString("es-AR", { maximumFractionDigits: 1 })} d`;

  return (
    <div className="space-y-4" style={acento(itemColor(habit.title))}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="secondary-button" onClick={onBack}>
          ‹ Volver
        </button>
        <select
          className="field min-w-0 flex-1 sm:max-w-xs"
          value={habit.title}
          onChange={(e) => onSelect(e.target.value)}
          aria-label="Elegir ítem"
        >
          {catalog.map((h) => (
            <option key={h.title} value={h.title}>
              {h.title}
            </option>
          ))}
        </select>
        <button type="button" className="secondary-button" onClick={onEdit}>
          Editar
        </button>
      </div>

      <header className="rounded-xl border border-border bg-panel px-4 py-5">
        <h3 className="text-2xl font-medium tracking-[-0.03em] text-foreground">{habit.title}</h3>
        <p className="mt-1.5 text-sm text-muted">
          {stats.lastDone ? (
            <>
              Última vez <span className="text-foreground">{haceCuanto(stats.lastDone)}</span> · {formatDate(stats.lastDone)}
            </>
          ) : (
            "Todavía no hay registros."
          )}
        </p>
        {habit.content && !/^Registro (rapido|diario)/i.test(habit.content) ? (
          <p className="mt-2 text-sm text-muted">{habit.content}</p>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 @xl:grid-cols-4">
          {[
            ["Últimos 30 días", `${stats.month}`],
            ["Últimos 365", `${stats.year}`],
            ["En total", `${stats.total}`],
            ["Frecuencia", cadaCuanto],
          ].map(([label, valor]) => (
            <div key={label}>
              <span className="stat-label">{label}</span>
              <span className="stat-value text-[1.45rem]">{valor}</span>
            </div>
          ))}
        </div>
        {stats.bestStreak > 1 ? (
          <p className="mt-4 text-xs text-muted">
            Máximo de días seguidos: {stats.bestStreak}
            {stats.currentStreak > 1 ? ` · ahora van ${stats.currentStreak}` : ""}
          </p>
        ) : null}
        {con.length >= 5 && sin.length >= 5 ? (
          <p className="mt-2 text-xs text-muted">
            Ánimo promedio: <span className="text-foreground">{prom(con)}</span> los días con {habit.title} ·{" "}
            <span className="text-foreground">{prom(sin)}</span> los días sin ({con.length + sin.length} días con ánimo anotado)
          </p>
        ) : null}
      </header>

      {stats.dates.length > 0 ? (
        <section className="rounded-xl border border-border bg-panel px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="section-kicker">Por día</p>
            {anios.length > 1 ? (
              <div className="flex flex-wrap gap-1">
                {anios
                  .slice()
                  .reverse()
                  .map((a) => (
                    <button
                      key={a}
                      type="button"
                      className={a === anio ? "filter-button-active !min-h-0 !px-2.5 !py-1 text-xs" : "filter-button !min-h-0 !px-2.5 !py-1 text-xs"}
                      onClick={() => setAnio(a)}
                    >
                      {a}
                    </button>
                  ))}
              </div>
            ) : null}
          </div>
          <div className="mt-3">
            <YearHeatmap year={anio} dates={fechas} />
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 @3xl:grid-cols-2">
        {anios.length > 1 ? (
          <section className="rounded-xl border border-border bg-panel px-4 py-4">
            <p className="section-kicker">Días por año</p>
            <div className="mt-4 flex h-28 items-end gap-1.5">
              {anios.map((a) => (
                <button
                  key={a}
                  type="button"
                  className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                  onClick={() => setAnio(a)}
                  title={`${a}: ${porAnio.get(a)} días`}
                >
                  <span className="text-[0.65rem] text-muted">{porAnio.get(a)}</span>
                  <span
                    className={`w-full rounded-t-[3px] ${a === anio ? "bg-accent" : "bg-accent/45 group-hover:bg-accent/70"}`}
                    style={{ height: `${(porAnio.get(a)! / topeAnio) * 75}%`, minHeight: 3 }}
                  />
                  <span className="text-[0.65rem] text-muted">{String(a).slice(2)}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-xl border border-border bg-panel px-4 py-4">
          <p className="section-kicker">Qué días de la semana</p>
          <div className="mt-4 flex h-28 items-end gap-2">
            {semana.map((n, i) => (
              <div key={DIAS[i]} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${DIAS[i]}: ${n}`}>
                <span className="text-[0.65rem] text-muted">{n}</span>
                <span className="w-full rounded-t-[3px] bg-accent/60" style={{ height: `${(n / topeSemana) * 75}%`, minHeight: n ? 3 : 0 }} />
                <span className="text-[0.65rem] text-muted">{DIAS[i]}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
