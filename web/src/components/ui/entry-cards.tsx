import { entrySectionLabels, entryTypeLabels, type LifeEntry } from "@/lib/types";
import { compactMeta, excerptText, formatDate, getDisplayRating, getRatingBadgeClass, getReactionBadge, normalizeSection } from "@/lib/entries";

export function MediaCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: LifeEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const badgeClass = getRatingBadgeClass(entry);
  const display = getDisplayRating(entry);
  const meta = compactMeta(entry);
  const exactness = entry.tags.includes("childhood")
    ? "Infancia"
    : entry.tags.includes("approx-date")
      ? "Fecha aprox"
      : null;

  return (
    <article className="rounded-xl border border-border bg-panel px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-muted">
            {entryTypeLabels[entry.type]} · {formatDate(entry.date)}{exactness ? ` · ${exactness}` : ""}
          </p>
          <h3 className="text-base font-medium tracking-[-0.02em] text-foreground">{entry.title}</h3>
        </div>
        {display ? <span className={badgeClass}>{display}</span> : null}
      </div>
      {meta.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {meta.map((item) => (
            <span key={`${entry.id}-${item}`} className="meta-chip">
              {item}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex gap-1.5 border-t border-border pt-3">
        <button type="button" className="habit-inline-link" onClick={onEdit}>
          Editar
        </button>
        <button type="button" className="habit-inline-link" onClick={onDelete}>
          Eliminar
        </button>
      </div>
    </article>
  );
}

export function WritingCard({ entry }: { entry: LifeEntry }) {
  return (
    <article className="rounded-xl border border-border bg-panel px-4 py-4">
      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-muted">
        {entrySectionLabels[normalizeSection(entry)]} · {formatDate(entry.date)}
      </p>
      <h3 className="mt-2 text-base font-medium tracking-[-0.02em] text-foreground">{entry.title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{excerptText(entry.content)}</p>
    </article>
  );
}

export function ArchiveCard({
  entry,
  onTagClick,
}: {
  entry: LifeEntry;
  onTagClick: (tag: string) => void;
}) {
  const reaction = getReactionBadge(entry);
  const rating = getDisplayRating(entry);

  return (
    <article className="rounded-xl border border-border bg-panel px-4 py-4">
      <div className="flex flex-wrap items-center gap-2 text-[0.7rem] uppercase tracking-[0.18em] text-muted">
        <span>{formatDate(entry.date)}</span>
        <span>{entryTypeLabels[entry.type]}</span>
        <span>{entrySectionLabels[normalizeSection(entry)]}</span>
        {rating ? <span className="media-badge">{rating}</span> : reaction ? <span className="media-badge">{reaction}</span> : null}
      </div>
      <h3 className="mt-2 text-base font-medium tracking-[-0.02em] text-foreground">{entry.title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{entry.content}</p>
      {entry.tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {entry.tags.slice(0, 6).map((tag) => (
            <button
              key={`${entry.id}-${tag}`}
              type="button"
              onClick={() => onTagClick(tag)}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted transition-colors hover:border-foreground hover:text-foreground"
            >
              #{tag}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}
