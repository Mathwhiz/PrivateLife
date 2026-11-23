import { useState } from "react";
import { CARAS, diaAnterior, horasYMinutos, minutosDormidos, type CambiosDia } from "@/lib/dia";
import { todayAR } from "@/lib/entries";
import { type LifeEntry } from "@/lib/types";

type Props = {
  fecha: string;
  dias: Map<string, LifeEntry>;
  cambiar: (fecha: string, cambios: CambiosDia) => void;
};

/** Ánimo, sueño y frase de un día. Todo opcional: se guarda al tocar. */
export function TuDia({ fecha, dias, cambiar }: Props) {
  const dia = dias.get(fecha);
  const anterior = diaAnterior(fecha);
  const noche = dias.get(anterior);
  const esHoy = fecha === todayAR();
  const dormido = minutosDormidos(noche?.dormi, dia?.desperte);

  return (
    <div className="grid gap-4">
      <div>
        <span className="stat-label">Ánimo</span>
        <div className="mt-1.5 flex gap-1.5" role="radiogroup" aria-label="Ánimo del día">
          {CARAS.map((cara, i) => {
            const valor = i + 1;
            const activo = dia?.animo === valor;
            return (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={activo}
                aria-label={`${valor} de 5`}
                className={`animo-boton ${activo ? "animo-boton-activo" : ""}`}
                onClick={() => cambiar(fecha, { animo: activo ? undefined : valor })}
              >
                <span className="text-lg leading-none">{cara}</span>
                <span className="text-[0.65rem] text-muted">{valor}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1.5">
          <span className="stat-label">{esHoy ? "Anoche te dormiste" : "La noche anterior"}</span>
          <input
            type="time"
            className="field"
            value={noche?.dormi ?? ""}
            onChange={(e) => cambiar(anterior, { dormi: e.target.value || undefined })}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="stat-label">Te despertaste</span>
          <input
            type="time"
            className="field"
            value={dia?.desperte ?? ""}
            onChange={(e) => cambiar(fecha, { desperte: e.target.value || undefined })}
          />
        </label>
      </div>
      {dormido !== null ? <p className="-mt-2 text-xs text-muted">Dormiste {horasYMinutos(dormido)}.</p> : null}

      {/* key: al cambiar de fecha arranca con la frase de ese día. */}
      <Frase key={fecha} inicial={dia?.content ?? ""} guardar={(content) => cambiar(fecha, { content })} />
    </div>
  );
}

function Frase({ inicial, guardar }: { inicial: string; guardar: (texto: string) => void }) {
  const [texto, setTexto] = useState(inicial);
  const cambiado = texto.trim() !== inicial.trim();
  return (
    <label className="grid gap-1.5">
      <span className="stat-label">Frase del día (opcional)</span>
      <div className="flex gap-2">
        <input
          type="text"
          className="field min-w-0 flex-1"
          value={texto}
          placeholder="Algo para acordarte de este día"
          onChange={(e) => setTexto(e.target.value)}
          onBlur={() => cambiado && guardar(texto.trim())}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
        {cambiado ? (
          <button type="button" className="primary-button" onClick={() => guardar(texto.trim())}>
            Guardar
          </button>
        ) : null}
      </div>
    </label>
  );
}
