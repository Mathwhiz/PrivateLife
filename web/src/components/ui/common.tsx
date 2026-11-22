import { typeColor, typeKeyOf, typeLabelOf } from "@/lib/type-style";
import type { LifeEntry } from "@/lib/types";

export function ViewHeader({
  title,
  description,
  aside,
}: {
  title: string;
  description: string;
  aside?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h2 className="text-xl font-medium tracking-[-0.03em] text-foreground">{title}</h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">{description}</p>
      </div>
      {aside}
    </header>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <article className="rounded-xl border border-border bg-panel px-4 py-5 text-sm text-muted">
      {label}
    </article>
  );
}

/** Punto de color del tipo + su nombre ("Película", "Hito", "Filosofía"…). */
export function TypeBadge({ entry, label }: { entry: LifeEntry; label?: string }) {
  return (
    <span className="type-badge" style={{ "--dot": typeColor[typeKeyOf(entry)] } as React.CSSProperties}>
      {label ?? typeLabelOf(entry)}
    </span>
  );
}

/** Estado vacío con un botón para resolverlo. */
export function EmptyAction({ label, action, onAction }: { label: string; action: string; onAction: () => void }) {
  return (
    <article className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border-mid bg-panel px-4 py-5 text-sm text-muted">
      <span>{label}</span>
      <button type="button" className="secondary-button" onClick={onAction}>
        {action}
      </button>
    </article>
  );
}
