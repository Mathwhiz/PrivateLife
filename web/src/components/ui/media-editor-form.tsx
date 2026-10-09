import { useState } from "react";
import { entryTypeLabels, type EntryType } from "@/lib/types";
import { MediaTypeConfig } from "@/lib/app-config";
import { MediaFormState, mediaTypes } from "@/lib/entries";
import { buscarMetadatos, fuenteLabels, generoATag, type ResultadoMetadatos } from "@/lib/metadatos";
import { Cover } from "@/components/ui/cover";

type Busqueda =
  | { estado: "inactiva" }
  | { estado: "buscando" }
  | { estado: "lista"; resultados: ResultadoMetadatos[] }
  | { estado: "error"; mensaje: string };

function parseTags(tags: string) {
  return tags.split(",").map((t) => t.trim()).filter(Boolean);
}

export function MediaEditorForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  onDelete,
  typeConfig,
}: {
  form: MediaFormState;
  onChange: (updates: Partial<MediaFormState>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  onDelete?: () => void;
  typeConfig?: MediaTypeConfig[];
}) {
  const isNew = !form.id;
  const [busqueda, setBusqueda] = useState<Busqueda>({ estado: "inactiva" });
  const [generosSugeridos, setGenerosSugeridos] = useState<string[]>([]);

  const tagsActuales = parseTags(form.tags);
  const sugerenciasPendientes = generosSugeridos.filter((g) => !tagsActuales.includes(g));

  async function buscar() {
    const q = form.title.trim();
    if (!q) return;
    setBusqueda({ estado: "buscando" });
    try {
      const resultados = await buscarMetadatos(form.type, q, form.release_year.trim() || undefined);
      setBusqueda({ estado: "lista", resultados });
    } catch (error) {
      setBusqueda({ estado: "error", mensaje: error instanceof Error ? error.message : "No se pudo buscar." });
    }
  }

  function elegir(r: ResultadoMetadatos) {
    onChange({
      release_year: r.anio ?? form.release_year,
      cover_url: r.tapa_url ?? form.cover_url,
      external: { source: r.fuente, id: r.id_externo },
    });
    setGenerosSugeridos([...new Set(r.generos.map(generoATag).filter(Boolean))]);
    setBusqueda({ estado: "inactiva" });
  }

  function agregarTag(tag: string) {
    onChange({ tags: [...tagsActuales, tag].join(", ") });
  }

  return (
    <form
      className="grid gap-3 rounded-xl border border-border bg-panel px-4 py-4"
      onSubmit={onSubmit}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-foreground">
          {isNew ? "Nueva entrada" : "Editar entrada"}
        </h3>
        <button
          type="button"
          className="text-xs text-muted transition-colors hover:text-foreground"
          onClick={onCancel}
        >
          Cerrar
        </button>
      </div>

      <div className="grid gap-1.5 text-xs">
        <label htmlFor="media-title" className="font-medium uppercase tracking-wide text-muted">Título</label>
        <div className="flex gap-2">
          <input
            id="media-title"
            type="text"
            value={form.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Título de la obra"
            className="field min-w-0 flex-1"
            autoFocus
          />
          <button
            type="button"
            className="secondary-button shrink-0"
            onClick={() => void buscar()}
            disabled={!form.title.trim() || busqueda.estado === "buscando"}
          >
            {busqueda.estado === "buscando" ? "Buscando…" : "Buscar"}
          </button>
        </div>
      </div>

      {busqueda.estado === "error" ? (
        <p className="text-xs text-rose" role="alert">{busqueda.mensaje}</p>
      ) : null}

      {busqueda.estado === "lista" ? (
        <div className="rounded-lg border border-border">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-xs text-muted">
            <span>
              {busqueda.resultados.length === 0
                ? "Sin resultados. Probá con otro título."
                : "Elegí uno para completar año y tapa."}
            </span>
            <button
              type="button"
              className="transition-colors hover:text-foreground"
              onClick={() => setBusqueda({ estado: "inactiva" })}
            >
              Cerrar
            </button>
          </div>
          {busqueda.resultados.length > 0 ? (
            <ul className="max-h-80 divide-y divide-border overflow-y-auto">
              {busqueda.resultados.map((r) => (
                <li key={`${r.fuente}-${r.id_externo}`}>
                  <button
                    type="button"
                    onClick={() => elegir(r)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-strong"
                  >
                    <Cover src={r.tapa_url ?? undefined} type={form.type} title={r.titulo} className="w-10" sizes="40px" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-foreground">{r.titulo}</span>
                      <span className="block truncate text-xs text-muted">
                        {[r.anio, r.autor, r.titulos_alt[0], fuenteLabels[r.fuente]].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="flex gap-3">
        <Cover src={form.cover_url || undefined} type={form.type} title={form.title} className="w-20" sizes="80px" />
        <div className="grid min-w-0 flex-1 content-start gap-1.5 text-xs">
          <label htmlFor="media-cover" className="font-medium uppercase tracking-wide text-muted">Tapa (URL)</label>
          <input
            id="media-cover"
            type="url"
            value={form.cover_url}
            // A mano ya no es la tapa de la fuente: sacamos el id externo.
            onChange={(e) => onChange({ cover_url: e.target.value, external: null })}
            placeholder="https://…"
            className="field"
          />
          <div className="flex flex-wrap items-center gap-2 text-muted">
            {form.external ? <span>De {fuenteLabels[form.external.source]}</span> : null}
            {form.cover_url ? (
              <button
                type="button"
                className="transition-colors hover:text-foreground"
                onClick={() => onChange({ cover_url: "", external: null })}
              >
                Quitar tapa
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <label className="grid gap-1.5 text-xs">
          <span className="font-medium uppercase tracking-wide text-muted">Tipo</span>
          <select
            value={form.type}
            onChange={(e) => {
              onChange({ type: e.target.value as EntryType });
              setBusqueda({ estado: "inactiva" });
            }}
            className="field"
          >
            {(typeConfig ?? mediaTypes.map((t) => ({ id: t, label: entryTypeLabels[t], visible: true }))).map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-xs">
          <span className="font-medium uppercase tracking-wide text-muted">Año</span>
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={form.release_year}
            onChange={(e) => onChange({ release_year: e.target.value.replace(/\D/g, "") })}
            placeholder="—"
            className="field"
          />
        </label>
        <label className="grid gap-1.5 text-xs">
          <span className="font-medium uppercase tracking-wide text-muted">Fecha</span>
          <input
            type="date"
            value={form.date}
            onChange={(e) => onChange({ date: e.target.value })}
            className="field"
          />
        </label>
        <label className="grid gap-1.5 text-xs">
          <span className="font-medium uppercase tracking-wide text-muted">Rating (1–10)</span>
          <input
            type="number"
            min="1"
            max="10"
            step="0.5"
            value={form.rating}
            onChange={(e) => onChange({ rating: e.target.value })}
            placeholder="—"
            className="field"
          />
        </label>
      </div>

      <div className="grid gap-1.5 text-xs">
        <label htmlFor="media-tags" className="font-medium uppercase tracking-wide text-muted">Tags</label>
        <input
          id="media-tags"
          type="text"
          value={form.tags}
          onChange={(e) => onChange({ tags: e.target.value })}
          placeholder="drama, favorita"
          className="field"
        />
        {sugerenciasPendientes.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-muted">Géneros sugeridos:</span>
            {sugerenciasPendientes.map((g) => (
              <button key={g} type="button" className="filter-button" onClick={() => agregarTag(g)}>
                + {g}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <label className="grid gap-1.5 text-xs">
        <span className="font-medium uppercase tracking-wide text-muted">Notas</span>
        <textarea
          value={form.content}
          onChange={(e) => onChange({ content: e.target.value })}
          placeholder="Contexto, impresiones, por que vale la pena recordarla."
          rows={3}
          className="field resize-y"
        />
      </label>

      <div className="flex flex-wrap justify-between gap-2">
        <div>
          {!isNew && onDelete ? (
            <button type="button" className="danger-button" onClick={onDelete}>
              Eliminar
            </button>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="primary-button">
            {isNew ? "Agregar" : "Guardar"}
          </button>
        </div>
      </div>
    </form>
  );
}
