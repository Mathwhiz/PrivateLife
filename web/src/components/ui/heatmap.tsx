import { useState } from "react";
import { formatDate } from "@/lib/entries";

const CELDA = 11;
const GAP = 2;
const PASO = CELDA + GAP;
const IZQ = 22; // espacio para "Lun / Mié / Vie"
const ARRIBA = 14; // espacio para los meses

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Un año en cuadraditos, una columna por semana. Marca los días en que lo
 * hiciste; no es una meta, así que no hay escala de "mejor" o "peor".
 */
export function YearHeatmap({ year, dates }: { year: number; dates: Set<string> }) {
  const [hover, setHover] = useState<string | null>(null);
  const inicio = new Date(year, 0, 1, 12);
  // La grilla arranca el domingo anterior al 1 de enero.
  const origen = new Date(inicio);
  origen.setDate(origen.getDate() - origen.getDay());

  const dias: { fecha: string; col: number; fila: number }[] = [];
  const meses: { label: string; col: number }[] = [];
  for (let d = new Date(inicio); d.getFullYear() === year; d.setDate(d.getDate() + 1)) {
    const col = Math.floor((d.getTime() - origen.getTime()) / (7 * 86_400_000));
    dias.push({ fecha: iso(d), col, fila: d.getDay() });
    if (d.getDate() === 1) {
      meses.push({ label: new Intl.DateTimeFormat("es-AR", { month: "short" }).format(d).replace(".", ""), col });
    }
  }
  const columnas = dias.at(-1)!.col + 1;
  const ancho = IZQ + columnas * PASO;
  const alto = ARRIBA + 7 * PASO;
  const cuenta = dias.filter((d) => dates.has(d.fecha)).length;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium text-foreground">{year}</p>
        <p className="text-xs text-muted">
          {hover ? `${formatDate(hover)} · ${dates.has(hover) ? "sí" : "no"}` : `${cuenta} ${cuenta === 1 ? "día" : "días"}`}
        </p>
      </div>
      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        className="block h-auto w-full max-w-[720px]"
        role="img"
        aria-label={`${cuenta} días en ${year}`}
        onMouseLeave={() => setHover(null)}
      >
        {meses.map((m) => (
          <text key={m.label} x={IZQ + m.col * PASO} y={9} fontSize={9} fill="var(--muted)">
            {m.label}
          </text>
        ))}
        {[
          ["Lun", 1],
          ["Mié", 3],
          ["Vie", 5],
        ].map(([label, fila]) => (
          <text key={label} x={0} y={ARRIBA + (fila as number) * PASO + 9} fontSize={8} fill="var(--muted)">
            {label}
          </text>
        ))}
        {dias.map((d) => (
          <rect
            key={d.fecha}
            x={IZQ + d.col * PASO}
            y={ARRIBA + d.fila * PASO}
            width={CELDA}
            height={CELDA}
            rx={2}
            fill={dates.has(d.fecha) ? "var(--accent)" : "rgba(255,255,255,0.06)"}
            stroke={hover === d.fecha ? "var(--foreground)" : "none"}
            strokeWidth={1}
            onMouseEnter={() => setHover(d.fecha)}
            onClick={() => setHover(d.fecha)}
          >
            <title>{`${formatDate(d.fecha)}: ${dates.has(d.fecha) ? "sí" : "no"}`}</title>
          </rect>
        ))}
      </svg>
    </div>
  );
}
