import type { Dispatch, SetStateAction } from "react";
import { EmptyState, ViewHeader } from "@/components/ui/common";
import { ArchiveCard } from "@/components/ui/entry-cards";
import { entryTypes } from "@/lib/entries";
import { entryTypeLabels, type EntryType, type LifeEntry } from "@/lib/types";

type ArchiveViewProps = {
  activeTag: string | null;
  allTags: string[];
  archiveFilter: EntryType | "all";
  filteredArchive: LifeEntry[];
  searchQuery: string;
  setActiveTag: Dispatch<SetStateAction<string | null>>;
  setArchiveFilter: Dispatch<SetStateAction<EntryType | "all">>;
  setSearchQuery: Dispatch<SetStateAction<string>>;
};

export function ArchiveView({
  activeTag,
  allTags,
  archiveFilter,
  filteredArchive,
  searchQuery,
  setActiveTag,
  setArchiveFilter,
  setSearchQuery,
}: ArchiveViewProps) {
  return (
            <div className="space-y-5">
              <ViewHeader
                title="Archivo completo"
                description="Búsqueda global para recorrer todo el sistema cuando lo necesitás."
              />

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar por texto, etiqueta o seccion"
                  className="field"
                />
                {activeTag ? (
                  <button type="button" onClick={() => setActiveTag(null)} className="secondary-button">
                    Quitar etiqueta: {activeTag}
                  </button>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setArchiveFilter("all")}
                  className={archiveFilter === "all" ? "filter-button-active" : "filter-button"}
                >
                  Todo
                </button>
                {entryTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setArchiveFilter(type)}
                    className={archiveFilter === type ? "filter-button-active" : "filter-button"}
                  >
                    {entryTypeLabels[type]}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setActiveTag((current) => (current === tag ? null : tag))}
                    className={activeTag === tag ? "filter-button-active" : "filter-button"}
                  >
                    #{tag}
                  </button>
                ))}
              </div>

              {filteredArchive.length === 0 ? (
                <EmptyState label="No hay entradas para el filtro actual." />
              ) : (
                <div className="space-y-3">
                  {filteredArchive.map((entry) => (
                    <ArchiveCard key={entry.id} entry={entry} onTagClick={setActiveTag} />
                  ))}
                </div>
              )}
            </div>
  );
}
