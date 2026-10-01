import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from "react";
import { signOut as authSignOut } from "@/lib/auth";
import { ViewHeader } from "@/components/ui/common";
import { defaultAppConfig, type AppConfig } from "@/lib/app-config";
import { type LifeEntry } from "@/lib/types";

type SettingsViewProps = {
  appConfig: AppConfig;
  setAppConfig: Dispatch<SetStateAction<AppConfig>>;
  entries: LifeEntry[];
  handleExport: () => void;
  handleImportFile: (event: ChangeEvent<HTMLInputElement>) => void;
  importInputRef: RefObject<HTMLInputElement | null>;
  importMessage: string;
  openImportPicker: () => void;
  saveLabel: string;
  syncSource: "supabase" | "local";
};

export function SettingsView({
  appConfig,
  setAppConfig,
  entries,
  handleExport,
  handleImportFile,
  importInputRef,
  importMessage,
  openImportPicker,
  saveLabel,
  syncSource,
}: SettingsViewProps) {
  return (
            <div className="space-y-5">
              <ViewHeader
                title="Ajustes"
                description="Gestion de datos y configuracion de la app."
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-panel px-4 py-5">
                  <p className="section-kicker">Exportar datos</p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Descarga todas tus entradas como archivo JSON. Guardalo como backup manual.
                  </p>
                  <button
                    type="button"
                    className="mt-4 secondary-button"
                    onClick={handleExport}
                  >
                    Exportar JSON
                  </button>
                </div>

                <div className="rounded-xl border border-border bg-panel px-4 py-5">
                  <p className="section-kicker">Importar datos</p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Carga un archivo JSON exportado previamente. Reemplaza las entradas actuales.
                  </p>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json"
                    onChange={handleImportFile}
                    className="hidden"
                  />
                  <button
                    type="button"
                    className="mt-4 secondary-button"
                    onClick={openImportPicker}
                  >
                    Importar JSON
                  </button>
                  {importMessage ? (
                    <p className="mt-2 text-xs text-muted">{importMessage}</p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-panel px-4 py-5">
                <p className="section-kicker">Sincronizacion</p>
                <p className="mt-2 text-sm text-foreground">
                  {syncSource === "supabase"
                    ? "Supabase activo — los datos se sincronizan en la nube."
                    : "Modo local — los datos viven en este navegador."}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {entries.length} entradas en total · {saveLabel.toLowerCase()}.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {/* Config: Menu lateral */}
                <div className="rounded-xl border border-border bg-panel px-4 py-5">
                  <div className="flex items-center justify-between">
                    <p className="section-kicker">Menu lateral</p>
                    <button
                      type="button"
                      className="text-xs text-muted transition-colors hover:text-foreground"
                      onClick={() => setAppConfig((prev) => ({ ...prev, sidebar: defaultAppConfig.sidebar }))}
                    >
                      Restaurar
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-muted">Renombrá o ocultá secciones del menú.</p>
                  <div className="mt-4 grid gap-2">
                    {appConfig.sidebar.map((item, i) => (
                      <div key={item.view} className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={item.view === "ajustes"}
                          onClick={() =>
                            setAppConfig((prev) => ({
                              ...prev,
                              sidebar: prev.sidebar.map((s, j) =>
                                j === i ? { ...s, visible: !s.visible } : s,
                              ),
                            }))
                          }
                          className={`flex-shrink-0 w-7 h-7 rounded-md border text-xs font-medium transition-colors ${
                            item.visible
                              ? "border-sage/40 bg-sage/10 text-sage"
                              : "border-border bg-transparent text-muted"
                          } ${item.view === "ajustes" ? "opacity-30 cursor-not-allowed" : ""}`}
                          title={item.view === "ajustes" ? "Ajustes siempre visible" : item.visible ? "Ocultar" : "Mostrar"}
                        >
                          {item.visible ? "✓" : "—"}
                        </button>
                        <input
                          type="text"
                          value={item.label}
                          onChange={(e) =>
                            setAppConfig((prev) => ({
                              ...prev,
                              sidebar: prev.sidebar.map((s, j) =>
                                j === i ? { ...s, label: e.target.value } : s,
                              ),
                            }))
                          }
                          className="field text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Config: Tipos de biblioteca */}
                <div className="rounded-xl border border-border bg-panel px-4 py-5">
                  <div className="flex items-center justify-between">
                    <p className="section-kicker">Tipos de biblioteca</p>
                    <button
                      type="button"
                      className="text-xs text-muted transition-colors hover:text-foreground"
                      onClick={() => setAppConfig((prev) => ({ ...prev, mediaTypes: defaultAppConfig.mediaTypes }))}
                    >
                      Restaurar
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-muted">Renombrá o desactivá categorías de la biblioteca.</p>
                  <div className="mt-4 grid gap-2">
                    {appConfig.mediaTypes.map((mt, i) => (
                      <div key={mt.id} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setAppConfig((prev) => ({
                              ...prev,
                              mediaTypes: prev.mediaTypes.map((m, j) =>
                                j === i ? { ...m, visible: !m.visible } : m,
                              ),
                            }))
                          }
                          className={`flex-shrink-0 w-7 h-7 rounded-md border text-xs font-medium transition-colors ${
                            mt.visible
                              ? "border-sage/40 bg-sage/10 text-sage"
                              : "border-border bg-transparent text-muted"
                          }`}
                          title={mt.visible ? "Ocultar" : "Mostrar"}
                        >
                          {mt.visible ? "✓" : "—"}
                        </button>
                        <input
                          type="text"
                          value={mt.label}
                          onChange={(e) =>
                            setAppConfig((prev) => ({
                              ...prev,
                              mediaTypes: prev.mediaTypes.map((m, j) =>
                                j === i ? { ...m, label: e.target.value } : m,
                              ),
                            }))
                          }
                          className="field text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-panel px-4 py-5">
                <p className="section-kicker">Sesion</p>
                <p className="mt-2 text-sm text-muted">
                  Cerrar sesión desconecta este dispositivo. Los datos en la nube no se borran.
                </p>
                <button
                  type="button"
                  className="mt-4 danger-button"
                  onClick={() => void authSignOut()}
                >
                  Cerrar sesión
                </button>
              </div>
            </div>
  );
}
