import { Cover } from "@/components/ui/cover";
import { TypeBadge } from "@/components/ui/common";
import { Sheet } from "@/components/ui/quick-add";
import { formatDate, getDisplayRating, getRatingBadgeClass, systemMediaTags } from "@/lib/entries";
import { type LifeEntry } from "@/lib/types";

const generosDe = (entry: LifeEntry) => entry.tags.filter((t) => !systemMediaTags.has(t) && !t.includes("import"));

/** Tapa grande en la grilla, con la nota encima. */
export function CoverTile({ entry, onOpen }: { entry: LifeEntry; onOpen: () => void }) {
  const nota = getDisplayRating(entry);
  return (
    <button type="button" className="group grid gap-1.5 text-left" onClick={onOpen}>
      <span className="relative block">
        <Cover
          src={entry.cover_url}
          type={entry.type}
          title={entry.title}
          className="w-full transition-transform group-hover:-translate-y-0.5"
          sizes="(min-width: 1280px) 160px, (min-width: 640px) 25vw, 33vw"
        />
        {nota ? <span className={`${getRatingBadgeClass(entry)} absolute right-1.5 top-1.5 shadow`}>{nota}</span> : null}
      </span>
      <span className="line-clamp-2 text-[0.8rem] leading-snug text-foreground">{entry.title}</span>
      <span className="-mt-1 text-[0.7rem] text-muted">{entry.release_year ?? entry.date.slice(0, 4)}</span>
    </button>
  );
}

/** Ficha de una obra: lo que hay guardado, con Editar y Eliminar. */
export function MediaFicha({
  entry,
  onClose,
  onEdit,
  onDelete,
}: {
  entry: LifeEntry;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const nota = getDisplayRating(entry);
  const generos = generosDe(entry);
  const aprox = entry.tags.includes("approx-date") || entry.tags.includes("childhood");

  return (
    <Sheet title={entry.title} onClose={onClose}>
      <div className="flex gap-4">
        <Cover src={entry.cover_url} type={entry.type} title={entry.title} className="w-28 sm:w-36" sizes="144px" />
        <div className="min-w-0 space-y-2">
          <TypeBadge entry={entry} />
          {entry.release_year ? <p className="text-sm text-muted">{entry.release_year}</p> : null}
          {nota ? <span className={getRatingBadgeClass(entry)}>{nota}</span> : null}
          <p className="text-sm text-muted">
            {entry.type === "game" ? "Jugado" : entry.type === "book" || entry.type === "manga" ? "Leído" : "Visto"}:{" "}
            {aprox ? `${entry.date.slice(0, 4)} (aprox.)` : formatDate(entry.date)}
          </p>
          {entry.playtime_hours ? <p className="text-sm text-muted">{entry.playtime_hours} h jugadas</p> : null}
        </div>
      </div>

      {generos.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {generos.map((g) => (
            <span key={g} className="meta-chip">
              {g}
            </span>
          ))}
        </div>
      ) : null}

      {entry.content ? <p className="mt-4 whitespace-pre-line text-sm leading-6 text-muted">{entry.content}</p> : null}

      <div className="mt-5 flex justify-between gap-2 border-t border-border pt-4">
        <button type="button" className="danger-button" onClick={onDelete}>
          Eliminar
        </button>
        <button type="button" className="primary-button" onClick={onEdit}>
          Editar
        </button>
      </div>
    </Sheet>
  );
}
