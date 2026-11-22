import { useMemo, useState } from "react";
import { TypeBadge, ViewHeader } from "@/components/ui/common";
import { CoverTile } from "@/components/ui/media-ficha";
import { fechaHito } from "@/components/ui/rangos-hitos";
import { isPendiente, mediaTypes, todayAR } from "@/lib/entries";
import { type DiaSalud } from "@/lib/salud";
import { promediosSemanales } from "@/lib/salud-objetivos";
import { typeColor } from "@/lib/type-style";
import { entryTypeLabels, type EntryType, type LifeEntry } from "@/lib/types";

type ResumenViewProps = {
  entries: LifeEntry[];
  dias: DiaSalud[];
  openEntry: (entry: LifeEntry) => void;
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const nota = (e: LifeEntry) => parseFloat(`${e.rating ?? ""}`);
const num = (n: number, dec = 0) => n.toLocaleString("es-AR", { maximumFractionDigits: dec });

/** Fechas que sirven para ubicar algo en un año: sin aproximadas ni de infancia. */
const fechaReal = (e: LifeEntry) => !e.tags.includes("approx-date") && !e.tags.includes("childhood");

export function ResumenView({ entries, dias, openEntry }: ResumenViewProps) {
  const actual = Number(todayAR().slice(0, 4));
  const anios = useMemo(() => {
    const set = new Set(entries.filter((e) => e.type !== "habit" && fechaReal(e)).map((e) => Number(e.date.slice(0, 4))));
    set.add(actual);
    return [...set].filter((a) => a >= 2000).sort((a, b) => b - a);
  }, [entries, actual]);
  const [anio, setAnio] = useState(actual);
  const enAnio = (fecha: string) => fecha.startsWith(`${anio}-`);

  const media = useMemo(
    () => entries.filter((e) => mediaTypes.includes(e.type) && !isPendiente(e) && fechaReal(e) && e.date.startsWith(`${anio}-`)),
    [entries, anio],
  );
  const porTipo = mediaTypes
    .map((t) => ({ tipo: t, n: media.filter((e) => e.type === t).length }))
    .filter((x) => x.n > 0);
  const porMes = MESES.map((_, m) => media.filter((e) => Number(e.date.slice(5, 7)) === m + 1).length);
  const topeMes = Math.max(...porMes, 1);
  const mejores = [...media]
    .filter((e) => nota(e) >= 9)
    .sort((a, b) => nota(b) - nota(a) || b.date.localeCompare(a.date))
    .slice(0, 12);

  const registro = useMemo(() => {
    const cuenta = new Map<string, Set<string>>();
    for (const e of entries) {
      if (e.type !== "habit" || e.tags.includes("habit-template") || !e.date.startsWith(`${anio}-`)) continue;
      cuenta.set(e.title, (cuenta.get(e.title) ?? new Set()).add(e.date));
    }
    return [...cuenta.entries()].map(([titulo, dias]) => ({ titulo, dias: dias.size })).sort((a, b) => b.dias - a.dias);
  }, [entries, anio]);

  const hitos = entries
    .filter((e) => e.type === "memory" && e.tags.includes("milestone"))
    .filter((e) => {
      const desde = Number(e.date.slice(0, 4));
      const hasta = e.end_date ? Number(e.end_date.slice(0, 4)) : desde;
      return desde <= anio && anio <= hasta;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const textos = entries.filter((e) => (e.type === "note" || (e.type === "memory" && !e.tags.includes("milestone"))) && enAnio(e.date));

  const diasSalud = dias.filter((d) => enAnio(d.fecha));
  const semanas = promediosSemanales(diasSalud.filter((d) => d.peso !== null).map((d) => ({ fecha: d.fecha, kg: d.peso! })));
  const conComida = diasSalud.filter((d) => d.kcalComidas > 0);
  const sesiones = diasSalud.flatMap((d) => d.items.filter((it) => it.tipo === "ejercicio")).length;

  return (
    <div className="space-y-5">
      <ViewHeader
        title={`Tu ${anio}`}
        description="Lo que viste, lo que hiciste y lo que pasó en el año."
        aside={
          <div>
          <select className="field w-28" value={anio} onChange={(e) => setAnio(Number(e.target.value))} aria-label="Año">
            {anios.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          </div>
        }
      />

      <section className="rounded-xl border border-border bg-panel px-4 py-4">
        <p className="section-kicker">Biblioteca</p>
        {media.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nada con fecha en {anio}.</p>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
              <div>
                <span className="stat-value">{media.length}</span>
                <span className="mt-1 block text-xs text-muted">en total</span>
              </div>
              {porTipo.map(({ tipo, n }) => (
                <div key={tipo}>
                  <span className="stat-value text-[1.3rem]">{n}</span>
                  <span
                    className="type-badge mt-1"
                    style={{ "--dot": typeColor[tipo as keyof typeof typeColor] } as React.CSSProperties}
                  >
                    {entryTypeLabels[tipo as EntryType]}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-12 items-end gap-1.5" style={{ height: 80 }} role="img" aria-label="Obras por mes">
              {porMes.map((n, m) => (
                <div key={m} className="flex h-full flex-col justify-end" title={`${MESES[m]}: ${n}`}>
                  <div className="rounded-t-[3px] bg-accent/70" style={{ height: `${(n / topeMes) * 100}%`, minHeight: n ? 3 : 0 }} />
                </div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-12 gap-1.5 text-center text-[0.65rem] text-muted">
              {MESES.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>

            {mejores.length > 0 ? (
              <>
                <p className="section-kicker mt-6">Lo mejor (9 o más)</p>
                <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-4 @lg:grid-cols-4 @2xl:grid-cols-6">
                  {mejores.map((e) => (
                    <CoverTile key={e.id} entry={e} onOpen={() => openEntry(e)} />
                  ))}
                </div>
              </>
            ) : null}
          </>
        )}
      </section>

      <div className="grid gap-4 @4xl:grid-cols-2">
        <section className="rounded-xl border border-border bg-panel px-4 py-4">
          <p className="section-kicker">Lo que más hiciste</p>
          {registro.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Sin registros en {anio}.</p>
          ) : (
            <ul className="mt-3 grid gap-1.5">
              {registro.slice(0, 10).map((r) => (
                <li key={r.titulo} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-sm">
                  <span className="truncate text-foreground">{r.titulo}</span>
                  <span className="text-muted">{r.dias} días</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-panel px-4 py-4">
          <p className="section-kicker">Mi vida</p>
          {hitos.length === 0 && textos.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nada anotado en {anio}.</p>
          ) : (
            <>
              <ul className="mt-3 grid gap-2">
                {hitos.map((h) => {
                  const aprox = h.tags.includes("approx-date");
                  return (
                    <li key={h.id}>
                      <button type="button" className="w-full text-left" onClick={() => openEntry(h)}>
                        <span className="flex items-center gap-2 text-xs text-muted">
                          <TypeBadge entry={h} />
                          {fechaHito(h.date, aprox)}
                          {h.end_date ? ` → ${fechaHito(h.end_date, aprox)}` : ""}
                        </span>
                        <span className="block text-sm text-foreground">{h.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {textos.length > 0 ? (
                <p className="mt-3 text-sm text-muted">
                  {textos.length} {textos.length === 1 ? "texto o recuerdo escrito" : "textos y recuerdos escritos"}.
                </p>
              ) : null}
            </>
          )}
        </section>
      </div>

      {diasSalud.length > 0 ? (
        <section className="rounded-xl border border-border bg-panel px-4 py-4">
          <p className="section-kicker">Salud</p>
          <div className="mt-3 grid grid-cols-2 gap-3 @3xl:grid-cols-4">
            <div>
              <span className="stat-label">Peso</span>
              <span className="stat-value text-[1.3rem]">
                {semanas.length ? `${num(semanas[0].kg, 1)} → ${num(semanas.at(-1)!.kg, 1)}` : "—"}
              </span>
              <span className="mt-1 block text-xs text-muted">kg, promedio de la primera y la última semana</span>
            </div>
            <div>
              <span className="stat-label">Calorías</span>
              <span className="stat-value text-[1.3rem]">
                {conComida.length ? num(conComida.reduce((s, d) => s + d.kcalComidas, 0) / conComida.length) : "—"}
              </span>
              <span className="mt-1 block text-xs text-muted">promedio por día · {conComida.length} días</span>
            </div>
            <div>
              <span className="stat-label">Movimiento</span>
              <span className="stat-value text-[1.3rem]">{sesiones}</span>
              <span className="mt-1 block text-xs text-muted">sesiones anotadas</span>
            </div>
            <div>
              <span className="stat-label">Registrado</span>
              <span className="stat-value text-[1.3rem]">{diasSalud.length}</span>
              <span className="mt-1 block text-xs text-muted">días en la planilla</span>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
