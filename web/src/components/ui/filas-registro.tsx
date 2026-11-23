import { type FilaRegistro } from "@/lib/grupos";
import { acento, itemColor } from "@/lib/type-style";

type Props = {
  filas: FilaRegistro[];
  hecho: (title: string) => boolean;
  toggle: (title: string) => void;
  /** Si está, cada fila muestra "Ver" para abrir las estadísticas. */
  onVer?: (title: string) => void;
};

/** Casillas del Registro: los ítems sueltos van de a uno y los grupos en una fila con un tick por ítem. */
export function FilasRegistro({ filas, hecho, toggle, onVer }: Props) {
  return (
    <>
      {filas.map((fila) => {
        if (fila.tipo === "solo") {
          const { title } = fila.item;
          const checked = hecho(title);
          return (
            <div key={title} className={`habit-toggle-pill ${checked ? "habit-toggle-pill-active" : ""}`} style={acento(itemColor(title))}>
              <button type="button" onClick={() => toggle(title)} className="habit-toggle-main">
                <span className="habit-toggle-box">{checked ? "✓" : ""}</span>
                <span className="truncate">{title}</span>
              </button>
              {onVer ? (
                <div className="habit-inline-actions">
                  <button type="button" className="habit-inline-link" onClick={() => onVer(title)}>
                    Ver
                  </button>
                </div>
              ) : null}
            </div>
          );
        }

        const marcados = fila.items.filter(({ item }) => hecho(item.title));
        const todos = marcados.length === fila.items.length;
        const alguno = marcados.length > 0;
        return (
          <div
            key={`grupo-${fila.nombre}`}
            className={`habit-group col-span-full ${alguno ? "habit-group-active" : ""}`}
            style={acento(itemColor(fila.nombre))}
          >
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                className="habit-group-name"
                onClick={() => {
                  // Todo de una: marca lo que falta; si ya estaba todo, lo desmarca.
                  for (const { item } of fila.items) if (todos || !hecho(item.title)) toggle(item.title);
                }}
                title={todos ? "Desmarcar todo" : "Marcar todo"}
              >
                <span className="habit-toggle-box">{todos ? "✓" : alguno ? "–" : ""}</span>
                <span className="truncate">{fila.nombre}</span>
              </button>
              {onVer ? (
                <button type="button" className="habit-inline-link" onClick={() => onVer(fila.items[0].item.title)}>
                  Ver
                </button>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {fila.items.map(({ item, etiqueta }) => {
                const checked = hecho(item.title);
                return (
                  <button
                    key={item.title}
                    type="button"
                    className={`habit-tick ${checked ? "habit-tick-active" : ""}`}
                    onClick={() => toggle(item.title)}
                    title={item.title}
                  >
                    <span className="habit-toggle-box">{checked ? "✓" : ""}</span>
                    {etiqueta}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
