import type { Dispatch, SetStateAction } from "react";
import { EmptyState, ViewHeader } from "@/components/ui/common";
import { WritingCard } from "@/components/ui/entry-cards";
import { writingSections } from "@/lib/entries";
import { entrySectionLabels, type EntrySection, type LifeEntry } from "@/lib/types";

type WritingsViewProps = {
  writingFilter: EntrySection | "all-writing";
  setWritingFilter: Dispatch<SetStateAction<EntrySection | "all-writing">>;
  visibleWritings: LifeEntry[];
};

export function WritingsView({
  writingFilter,
  setWritingFilter,
  visibleWritings,
}: WritingsViewProps) {
  return (
            <div className="space-y-5">
              <ViewHeader
                title="Textos y pensamientos"
                description="Vista compacta por fecha, sin interminables columnas de texto."
                aside={
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setWritingFilter("all-writing")}
                      className={writingFilter === "all-writing" ? "filter-button-active" : "filter-button"}
                    >
                      Todo
                    </button>
                    {writingSections.map((section) => (
                      <button
                        key={section}
                        type="button"
                        onClick={() => setWritingFilter(section)}
                        className={writingFilter === section ? "filter-button-active" : "filter-button"}
                      >
                        {entrySectionLabels[section]}
                      </button>
                    ))}
                  </div>
                }
              />
              {visibleWritings.length === 0 ? (
                <EmptyState label="No hay textos para este filtro." />
              ) : (
                <div className="grid items-start gap-3 @3xl:grid-cols-2 @7xl:grid-cols-3">
                  {visibleWritings.map((entry) => (
                    <WritingCard key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
            </div>
  );
}
