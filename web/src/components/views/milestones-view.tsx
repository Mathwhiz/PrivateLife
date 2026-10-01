import { EmptyState, ViewHeader } from "@/components/ui/common";
import { formatDate } from "@/lib/entries";
import { type LifeEntry } from "@/lib/types";

type MilestonesViewProps = {
  milestoneEntries: LifeEntry[];
};

export function MilestonesView({
  milestoneEntries,
}: MilestonesViewProps) {
  return (
            <div className="space-y-5">
              <ViewHeader title="Hitos JW" description="Fechas, privilegios y pasos importantes de tu recorrido." />
              {milestoneEntries.length === 0 ? (
                <EmptyState label="No hay hitos cargados." />
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {milestoneEntries.map((entry) => (
                    <article key={entry.id} className="rounded-xl border border-border bg-panel px-4 py-4">
                      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-muted">{formatDate(entry.date)}</p>
                      <h3 className="mt-2 text-base font-medium tracking-[-0.02em] text-foreground">{entry.title}</h3>
                      {entry.content ? <p className="mt-2 text-sm leading-6 text-muted">{entry.content}</p> : null}
                    </article>
                  ))}
                </div>
              )}
            </div>
  );
}
