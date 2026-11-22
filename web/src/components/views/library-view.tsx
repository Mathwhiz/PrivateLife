import { useState, type Dispatch, type SetStateAction } from "react";
import { EmptyAction, ViewHeader } from "@/components/ui/common";
import { CoverTile, MediaFicha } from "@/components/ui/media-ficha";
import { MediaCard } from "@/components/ui/entry-cards";
import { MediaEditorForm } from "@/components/ui/media-editor-form";
import { type EntryType, type LifeEntry } from "@/lib/types";
import { type AppConfig } from "@/lib/app-config";
import { todayAR, type MediaFormState } from "@/lib/entries";

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
  openMediaEditor: (entry?: LifeEntry, overrides?: Partial<MediaFormState>) => void;
  ratingFilter: RatingFilter;
  saveMediaForm: (event: React.FormEvent) => void;
  setGenreFilter: Dispatch<SetStateAction<string>>;
  setLibraryFilter: Dispatch<SetStateAction<EntryType | "all-media">>;
  setLibrarySearch: Dispatch<SetStateAction<string>>;
  setLibrarySort: Dispatch<SetStateAction<LibrarySort>>;
  setMediaForm: Dispatch<SetStateAction<MediaFormState | null>>;
  setRatingFilter: Dispatch<SetStateAction<RatingFilter>>;
  visibleMedia: LifeEntry[];
  showPendientes: boolean;
  setShowPendientes: Dispatch<SetStateAction<boolean>>;
  pendientesCount: number;
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
  showPendientes,
  setShowPendientes,
  pendientesCount,
}: LibraryViewProps) {
  const [modo, setModo] = useState<"tapas" | "lista">(() => {
    try {
      return localStorage.getItem("private-life.biblioteca.modo") === "lista" ? "lista" : "tapas";
    } catch {
      return "tapas";
    }
  });
  const [ficha, setFicha] = useState<LifeEntry | null>(null);
  // Se dibujan de a tandas: son más de mil tapas.
  // Al cambiar los filtros vuelve a 120 (el límite queda atado a esa lista).
  const [tanda, setTanda] = useState({ lista: visibleMedia, n: 120 });
  const limite = tanda.lista === visibleMedia ? tanda.n : 120;

  function cambiarModo(m: "tapas" | "lista") {
    setModo(m);
    try {
      localStorage.setItem("private-life.biblioteca.modo", m);
    } catch {
      /* sin storage: queda solo para esta visita */
    }
  }

  function editar(entry: LifeEntry) {
    setFicha(null);
    openMediaEditor(entry);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const hayFiltros = librarySearch !== "" || ratingFilter !== "all" || genreFilter !== "all-genres";
  const visibles = visibleMedia.slice(0, limite);

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

              <div className="flex gap-1.5">
                <button
                  type="button"
                  className={!showPendientes ? "filter-button-active" : "filter-button"}
                  onClick={() => setShowPendientes(false)}
                >
                  Vistas
                </button>
                <button
                  type="button"
                  className={showPendientes ? "filter-button-active" : "filter-button"}
                  onClick={() => setShowPendientes(true)}
                >
                  Quiero ver{pendientesCount ? ` (${pendientesCount})` : ""}
                </button>
              </div>

              {mediaForm !== null ? (
                <MediaEditorForm
                  key={mediaForm.id || "nueva"}
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

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted">{visibleMedia.length.toLocaleString("es-AR")} en total</p>
                <div className="flex gap-1.5">
                  <button type="button" className={modo === "tapas" ? "filter-button-active" : "filter-button"} onClick={() => cambiarModo("tapas")}>
                    Tapas
                  </button>
                  <button type="button" className={modo === "lista" ? "filter-button-active" : "filter-button"} onClick={() => cambiarModo("lista")}>
                    Lista
                  </button>
                </div>
              </div>

              {visibleMedia.length === 0 ? (
                hayFiltros ? (
                  <EmptyAction
                    label="No hay nada con estos filtros."
                    action="Limpiar filtros"
                    onAction={() => {
                      setLibrarySearch("");
                      setRatingFilter("all");
                      setGenreFilter("all-genres");
                    }}
                  />
                ) : (
                  <EmptyAction
                    label={showPendientes ? "No tenés nada anotado para ver." : "Todavía no hay nada acá."}
                    action="+ Agregar"
                    onAction={() => openMediaEditor()}
                  />
                )
              ) : modo === "tapas" ? (
                <div className="grid grid-cols-3 gap-x-3 gap-y-4 @lg:grid-cols-4 @2xl:grid-cols-5 @4xl:grid-cols-6 @6xl:grid-cols-8">
                  {visibles.map((entry) => (
                    <CoverTile key={entry.id} entry={entry} onOpen={() => setFicha(entry)} />
                  ))}
                </div>
              ) : (
                <div className="grid gap-3 @xl:grid-cols-2 @4xl:grid-cols-3 @7xl:grid-cols-4">
                  {visibles.map((entry) => (
                    <MediaCard
                      key={entry.id}
                      entry={entry}
                      onEdit={() => editar(entry)}
                      onDelete={() => deleteEntry(entry.id)}
                    />
                  ))}
                </div>
              )}

              {visibleMedia.length > limite ? (
                <div className="flex justify-center">
                  <button type="button" className="secondary-button" onClick={() => setTanda({ lista: visibleMedia, n: limite + 120 })}>
                    Mostrar más ({(visibleMedia.length - limite).toLocaleString("es-AR")} restantes)
                  </button>
                </div>
              ) : null}

              {ficha ? (
                <MediaFicha
                  entry={ficha}
                  onClose={() => setFicha(null)}
                  onEdit={() => editar(ficha)}
                  onYaLaVi={
                    showPendientes
                      ? () => {
                          setFicha(null);
                          setShowPendientes(false);
                          openMediaEditor(ficha, { pending: false, date: todayAR() });
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }
                      : undefined
                  }
                  onDelete={() => {
                    deleteEntry(ficha.id);
                    setFicha(null);
                  }}
                />
              ) : null}
            </div>
  );
}
