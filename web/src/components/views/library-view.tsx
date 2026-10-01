import type { Dispatch, SetStateAction } from "react";
import { EmptyState, ViewHeader } from "@/components/ui/common";
import { MediaCard } from "@/components/ui/entry-cards";
import { MediaEditorForm } from "@/components/ui/media-editor-form";
import { type EntryType, type LifeEntry } from "@/lib/types";
import { type AppConfig } from "@/lib/app-config";
import { type MediaFormState } from "@/lib/entries";

export type LibrarySort = "date-desc" | "date-asc" | "rating-desc" | "rating-asc";
export type RatingFilter = "all" | "8" | "9" | "10";
type LibraryViewProps = {
  appConfig: AppConfig;
  deleteEntry: (id: string) => void;
  genreFilter: string;
  libraryFilter: EntryType | "all-media";
  librarySearch: string;
  librarySort: LibrarySort;
  mediaForm: MediaFormState | null;
  mediaGenres: string[];
  openMediaEditor: (entry?: LifeEntry) => void;
  ratingFilter: RatingFilter;
  saveMediaForm: (event: React.FormEvent) => void;
  setGenreFilter: Dispatch<SetStateAction<string>>;
  setLibraryFilter: Dispatch<SetStateAction<EntryType | "all-media">>;
  setLibrarySearch: Dispatch<SetStateAction<string>>;
  setLibrarySort: Dispatch<SetStateAction<LibrarySort>>;
  setMediaForm: Dispatch<SetStateAction<MediaFormState | null>>;
  setRatingFilter: Dispatch<SetStateAction<RatingFilter>>;
  visibleMedia: LifeEntry[];
};

export function LibraryView({
  appConfig,
  deleteEntry,
  genreFilter,
  libraryFilter,
  librarySearch,
  librarySort,
  mediaForm,
  mediaGenres,
  openMediaEditor,
  ratingFilter,
  saveMediaForm,
  setGenreFilter,
  setLibraryFilter,
  setLibrarySearch,
  setLibrarySort,
  setMediaForm,
  setRatingFilter,
  visibleMedia,
}: LibraryViewProps) {
  return (
            <div className="space-y-5">
              <ViewHeader
                title="Biblioteca"
                description="Películas, series y libros con género filtrable, fecha clara y tu nota arriba."
                aside={
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openMediaEditor()}
                      className="primary-button"
                    >
                      + Nueva
                    </button>
                    <button
                      type="button"
                      onClick={() => setLibraryFilter("all-media")}
                      className={libraryFilter === "all-media" ? "filter-button-active" : "filter-button"}
                    >
                      Todo
                    </button>
                    {appConfig.mediaTypes
                      .filter((mt) => mt.visible)
                      .map(({ id, label }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setLibraryFilter(id as EntryType)}
                          className={libraryFilter === id ? "filter-button-active" : "filter-button"}
                        >
                          {label}
                        </button>
                      ))}
                  </div>
                }
              />

              {mediaForm !== null ? (
                <MediaEditorForm
                  form={mediaForm}
                  onChange={(updates) =>
                    setMediaForm((current) => (current ? { ...current, ...updates } : current))
                  }
                  onSubmit={saveMediaForm}
                  onCancel={() => setMediaForm(null)}
                  onDelete={
                    mediaForm.id
                      ? () => {
                          deleteEntry(mediaForm.id);
                          setMediaForm(null);
                        }
                      : undefined
                  }
                  typeConfig={appConfig.mediaTypes}
                />
              ) : null}

              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="search"
                    value={librarySearch}
                    onChange={(e) => setLibrarySearch(e.target.value)}
                    placeholder="Buscar por nombre..."
                    className="field max-w-xs"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {(["all", "8", "9", "10"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRatingFilter(r)}
                        className={ratingFilter === r ? "filter-button-active" : "filter-button"}
                      >
                        {r === "all" ? "Todas" : `${r}+`}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        ["date-desc", "Más reciente"],
                        ["date-asc", "Más antigua"],
                        ["rating-desc", "Nota ↓"],
                        ["rating-asc", "Nota ↑"],
                      ] as const
                    ).map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setLibrarySort(val)}
                        className={librarySort === val ? "filter-button-active" : "filter-button"}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {mediaGenres.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setGenreFilter("all-genres")}
                      className={genreFilter === "all-genres" ? "filter-button-active" : "filter-button"}
                    >
                      Todos los generos
                    </button>
                    {mediaGenres.slice(0, 24).map((genre) => (
                      <button
                        key={genre}
                        type="button"
                        onClick={() => setGenreFilter(genre)}
                        className={genreFilter === genre ? "filter-button-active" : "filter-button"}
                      >
                        {genre}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {visibleMedia.length === 0 ? (
                <EmptyState label="No hay items para este filtro." />
              ) : (
                <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                  {visibleMedia.map((entry) => (
                    <MediaCard
                      key={entry.id}
                      entry={entry}
                      onEdit={() => openMediaEditor(entry)}
                      onDelete={() => deleteEntry(entry.id)}
                    />
                  ))}
                </div>
              )}
            </div>
  );
}
