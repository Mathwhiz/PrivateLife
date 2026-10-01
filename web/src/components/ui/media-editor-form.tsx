import { entryTypeLabels, type EntryType } from "@/lib/types";
import { MediaTypeConfig } from "@/lib/app-config";
import { MediaFormState, mediaTypes } from "@/lib/entries";

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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1.5 text-xs">
          <span className="font-medium uppercase tracking-wide text-muted">Tipo</span>
          <select
            value={form.type}
            onChange={(e) => onChange({ type: e.target.value as EntryType })}
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
        <label className="grid gap-1.5 text-xs">
          <span className="font-medium uppercase tracking-wide text-muted">Tags</span>
          <input
            type="text"
            value={form.tags}
            onChange={(e) => onChange({ tags: e.target.value })}
            placeholder="drama, favorita"
            className="field"
          />
        </label>
      </div>

      <label className="grid gap-1.5 text-xs">
        <span className="font-medium uppercase tracking-wide text-muted">Título</span>
        <input
          type="text"
          value={form.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Título de la obra"
          className="field"
          autoFocus
        />
      </label>

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
