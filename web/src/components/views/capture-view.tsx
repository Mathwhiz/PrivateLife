import { ViewHeader } from "@/components/ui/common";
import { entryTypes, type FormState } from "@/lib/entries";
import { entrySectionLabels, entryTypeLabels, type EntrySection, type EntryType } from "@/lib/types";

type CaptureViewProps = {
  currentSectionOptions: EntrySection[];
  form: FormState;
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  updateForm: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
};

export function CaptureView({
  currentSectionOptions,
  form,
  handleSubmit,
  updateForm,
}: CaptureViewProps) {
  return (
            <div className="space-y-5">
              <ViewHeader
                title="Nueva entrada"
                description="Captura rapida para pensamiento, anecdota, texto o recuerdo."
              />

              <form className="grid gap-4" onSubmit={handleSubmit}>
                <div className="grid gap-4 md:grid-cols-4">
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium text-foreground">Tipo</span>
                    <select
                      value={form.type}
                      onChange={(event) => updateForm("type", event.target.value as EntryType)}
                      className="field"
                    >
                      {entryTypes.map((type) => (
                        <option key={type} value={type}>
                          {entryTypeLabels[type]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium text-foreground">Seccion</span>
                    <select
                      value={form.section}
                      onChange={(event) => updateForm("section", event.target.value as EntrySection)}
                      className="field"
                    >
                      {currentSectionOptions.map((section) => (
                        <option key={section} value={section}>
                          {entrySectionLabels[section]}
                        </option>
                      ))}
                    </select>
                  </label>
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium text-foreground">Fecha</span>
                      <input
                        type="date"
                        value={form.date}
                        onChange={(event) => updateForm("date", event.target.value)}
                        className="field"
                      />
                    </label>
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium text-foreground">Etiquetas</span>
                    <input
                      type="text"
                      value={form.tags}
                      onChange={(event) => updateForm("tags", event.target.value)}
                      placeholder="filosofia, rutina, cine"
                      className="field"
                    />
                  </label>
                </div>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium text-foreground">Título</span>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(event) => updateForm("title", event.target.value)}
                    placeholder="Que quieres guardar ahora"
                    className="field"
                  />
                </label>

                <label className="grid gap-2 text-sm">
                  <span className="font-medium text-foreground">Contenido</span>
                  <textarea
                    value={form.content}
                    onChange={(event) => updateForm("content", event.target.value)}
                    placeholder="Anota el hecho, el pensamiento o el contexto."
                    rows={10}
                    className="field min-h-40 resize-y"
                  />
                </label>

                <div className="flex justify-end">
                  <button type="submit" className="primary-button">
                    Guardar entrada
                  </button>
                </div>
              </form>
            </div>
  );
}
