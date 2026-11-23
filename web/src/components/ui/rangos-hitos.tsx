import { useEffect, useRef, useState } from "react";
import { type LifeEntry } from "@/lib/types";
import { todayAR } from "@/lib/entries";

/** Fecha de un hito: si es aproximada no se inventa el día ("2015", "ago 2025"). */
export function fechaHito(fecha: string, aprox: boolean) {
  const d = new Date(`${fecha}T12:00:00`);
  if (!aprox) return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" }).format(d);
  if (fecha.endsWith("-01-01")) return fecha.slice(0, 4);
  return new Intl.DateTimeFormat("es-AR", { month: "short", year: "numeric" }).format(d);
}

const anioDecimal = (fecha: string) => {
  const d = new Date(`${fecha}T12:00:00`);
  const inicio = new Date(d.getFullYear(), 0, 1).getTime();
  const fin = new Date(d.getFullYear() + 1, 0, 1).getTime();
  return d.getFullYear() + (d.getTime() - inicio) / (fin - inicio);
};

/** "hasta" de un hito: su end_date, o hoy si sigue en curso (etiqueta "en-curso"). */
export function finHito(h: LifeEntry) {
  return h.end_date ?? (h.tags.includes("en-curso") ? todayAR() : null);
}

/** Color de la barra según de qué es el hito. */
const colorHito = (h: LifeEntry) =>
  h.tags.includes("estudio") ? "var(--sky)" : h.tags.includes("trabajo") ? "#e07a5f" : h.tags.includes("pareja") ? "#d98bb3" : "var(--gold)";

/** Hitos sobre una línea de años: barra si tienen duración, punto si fueron un día. */
export function RangosHitos({ hitos, onOpen }: { hitos: LifeEntry[]; onOpen: (e: LifeEntry) => void }) {
  const caja = useRef<HTMLDivElement | null>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const conRango = [...hitos].sort((a, b) => a.date.localeCompare(b.date));
  if (conRango.length === 0) return null;

  const desde = Math.floor(Math.min(...conRango.map((h) => anioDecimal(h.date))));
  const hasta = Math.ceil(Math.max(...conRango.map((h) => anioDecimal(finHito(h) ?? h.date))));
  const FILA = 34;
  const pad = { l: 16, r: 16, t: 6, b: 22 };
  const x = (anio: number) => pad.l + ((anio - desde) / Math.max(hasta - desde, 1)) * (W - pad.l - pad.r);
  // Cada hito va en la primera fila donde no choca con otro, contando el largo del nombre.
  const ocupado: number[] = [];
  const marcas = conRango.map((h) => {
    const fin = finHito(h);
    const x0 = x(anioDecimal(h.date));
    const x1 = fin ? Math.max(x(anioDecimal(fin)), x0 + 4) : x0;
    const largo = h.title.length * 6.2 + 4;
    const xTexto = Math.max(pad.l, Math.min(x0 - (fin ? 0 : 5), W - pad.r - largo));
    const ini = Math.min(x0 - 5, xTexto);
    let fila = ocupado.findIndex((hastaX) => hastaX + 10 < ini);
    if (fila === -1) fila = ocupado.length;
    ocupado[fila] = Math.max(x1 + 5, xTexto + largo);
    return { h, fin, x0, x1, xTexto, fila };
  });
  const H = pad.t + ocupado.length * FILA + pad.b;
  const paso = W < 480 ? 2 : 1;
  const anios = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i).filter((a) => (a - desde) % paso === 0);

  return (
    <section className="rounded-xl border border-border bg-panel px-4 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="section-kicker">Línea de tiempo</p>
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          {[
            ["Estudio", "var(--sky)"],
            ["Trabajo", "#e07a5f"],
            ["Pareja", "#d98bb3"],
            ["JW", "var(--gold)"],
          ].map(([nombre, color]) => (
            <span key={nombre} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-3 rounded-sm" style={{ background: color }} />
              {nombre}
            </span>
          ))}
        </p>
      </div>
      <div ref={caja} className="mt-3">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full" role="img" aria-label="Hitos por año">
          {anios.map((a) => (
            <g key={a}>
              <line x1={x(a)} x2={x(a)} y1={pad.t} y2={H - pad.b} stroke="var(--border)" />
              <text x={x(a)} y={H - 6} fontSize={10} fill="var(--muted)" textAnchor="middle">
                {a}
              </text>
            </g>
          ))}
          {marcas.map(({ h, fin, x0, x1, xTexto, fila }) => {
            const y = pad.t + fila * FILA;
            const aprox = h.tags.includes("approx-date");
            return (
              <g key={h.id} className="cursor-pointer" onClick={() => onOpen(h)}>
                <title>
                  {`${h.title}: ${fechaHito(h.date, aprox)}${fin ? ` → ${h.end_date ? fechaHito(h.end_date, aprox) : "hoy"}` : ""}`}
                </title>
                <text x={xTexto} y={y + 12} fontSize={11} fill="var(--foreground)">
                  {h.title}
                </text>
                {fin ? (
                  <rect x={x0} y={y + 17} width={x1 - x0} height={9} rx={4} fill={colorHito(h)} opacity={0.85} />
                ) : (
                  <circle cx={x0} cy={y + 21.5} r={4.5} fill={colorHito(h)} />
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
