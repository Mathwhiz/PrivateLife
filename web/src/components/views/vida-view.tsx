import { useMemo, useState } from "react";
import { EmptyState, ViewHeader } from "@/components/ui/common";
import { excerptText, formatDate } from "@/lib/entries";
import { entrySectionLabels, type LifeEntry } from "@/lib/types";
import { kindOf, quickKindLabels, type QuickKind } from "@/components/ui/quick-add";
import { typeColor, typeKeyOf } from "@/lib/type-style";
import { RangosHitos, fechaHito } from "@/components/ui/rangos-hitos";

type Filtro = "todo" | QuickKind;

type VidaViewProps = {
  /** Hitos, textos y recuerdos (sin biblioteca ni hábitos). */
  entries: LifeEntry[];
  openEntry: (entry: LifeEntry) => void;
  verResumen: () => void;
};

const filtros: { id: Filtro; label: string }[] = [
  { id: "todo", label: "Todo" },
  { id: "milestone", label: "Hitos" },
  { id: "note", label: "Textos" },
  { id: "memory", label: "Recuerdos" },
  { id: "trip", label: "Viajes" },
];

export function VidaView({ entries, openEntry, verResumen }: VidaViewProps) {
  const [filtro, setFiltro] = useState<Filtro>("todo");

  const porAnio = useMemo(() => {
    const visibles = entries
      .filter((e) => filtro === "todo" || kindOf(e) === filtro)
      .sort((a, b) => b.date.localeCompare(a.date));
    const grupos = new Map<string, LifeEntry[]>();
    for (const e of visibles) {
      const anio = e.date.slice(0, 4);
      grupos.set(anio, [...(grupos.get(anio) ?? []), e]);
    }
    return [...grupos.entries()];
  }, [entries, filtro]);

  return (
    <div className="space-y-5">
      <ViewHeader
        title="Mi vida"
        description="Hitos, viajes, textos y recuerdos en una sola línea de tiempo."
        aside={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="secondary-button" onClick={verResumen}>
              Resumen del año
            </button>
            {filtros.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltro(f.id)}
                className={filtro === f.id ? "filter-button-active" : "filter-button"}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      />

      {filtro === "todo" || filtro === "milestone" ? (
        <RangosHitos hitos={entries.filter((e) => kindOf(e) === "milestone")} onOpen={openEntry} />
      ) : null}

      {porAnio.length === 0 ? (
        <EmptyState label="No hay nada acá todavía. Usá el + para agregar." />
      ) : (
        porAnio.map(([anio, items]) => (
          <section key={anio} className="grid gap-2 @3xl:grid-cols-[4.5rem_minmax(0,1fr)] @3xl:gap-4">
            <h3 className="text-lg font-medium tracking-[-0.03em] text-muted @3xl:sticky @3xl:top-3 @3xl:self-start">{anio}</h3>
            <ol className="timeline grid gap-2">
              {items.map((e) => {
                const kind = kindOf(e)!;
                const aprox = e.tags.includes("approx-date");
                return (
                  <li key={e.id} className="timeline-item" style={{ "--dot": typeColor[typeKeyOf(e)] } as React.CSSProperties}>
                    <button
                      type="button"
                      className="w-full rounded-xl border border-border bg-panel px-4 py-3 text-left transition-colors hover:border-accent/40"
                      onClick={() => openEntry(e)}
                    >
                      <p className="text-[0.7rem] uppercase tracking-[0.16em] text-muted">
                        {kind === "note" ? entrySectionLabels[e.section ?? "general"] : quickKindLabels[kind]} ·{" "}
                        {kind === "milestone" ? fechaHito(e.date, aprox) : aprox ? e.date.slice(0, 4) : formatDate(e.date)}
                        {e.end_date ? ` → ${kind === "trip" ? formatDate(e.end_date) : fechaHito(e.end_date, aprox)}` : e.tags.includes("en-curso") ? " → hoy" : ""}
                        {aprox ? " · aprox." : ""}
                      </p>
                      <h4 className="mt-1 text-[0.95rem] font-medium tracking-[-0.01em] text-foreground">{e.title}</h4>
                      {e.content ? <p className="mt-1 text-sm leading-6 text-muted">{excerptText(e.content)}</p> : null}
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}
