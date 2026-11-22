import { useEffect, useMemo, useRef, useState } from "react";
import { EmptyState, ViewHeader } from "@/components/ui/common";
import { daysBetween, formatDate, todayAR } from "@/lib/entries";
import { armarDias, leerCache, traerRegistro, type DiaSalud, type ItemSalud, type RegistroSalud } from "@/lib/salud";

type SaludViewProps = {
  /** Días con el hábito "Baño" marcado en la app. Es el registro principal de baño. */
  banoDates: string[];
};

const kcal = (n: number) => Math.round(n).toLocaleString("es-AR");
const kg = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function SaludView({ banoDates }: SaludViewProps) {
  const [registro, setRegistro] = useState<RegistroSalud | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [seleccion, setSeleccion] = useState<string | null>(null);

  async function actualizar() {
    setCargando(true);
    setError("");
    try {
      setRegistro(await traerRegistro());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer la planilla.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    // Primero lo último que se vio (al instante), después lo fresco.
    const cache = leerCache();
    if (cache) setRegistro(cache);
    void actualizar();
  }, []);

  const dias = useMemo(() => (registro ? armarDias(registro.filas) : []), [registro]);
  const hoy = todayAR();

  // Baño: lo de la app más lo que la planilla tenga y la app no (hoy son un subconjunto).
  const notasBano = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of dias) for (const it of d.items) if (it.tipo === "bano") m.set(d.fecha, it.notas);
    return m;
  }, [dias]);
  const banos = useMemo(
    () => [...new Set([...banoDates, ...notasBano.keys()])].sort((a, b) => b.localeCompare(a)),
    [banoDates, notasBano],
  );

  const pesos = useMemo(
    () => dias.filter((d) => d.peso !== null).map((d) => ({ fecha: d.fecha, kg: d.peso! })).reverse(),
    [dias],
  );

  const semana = dias.filter((d) => daysBetween(hoy, d.fecha) <= 6 && d.kcalComidas > 0);
  const promedioSemana = semana.length ? semana.reduce((s, d) => s + d.kcalComidas, 0) / semana.length : null;
  const ejercicioSemana = dias
    .filter((d) => daysBetween(hoy, d.fecha) <= 6)
    .flatMap((d) => d.items.filter((it) => it.tipo === "ejercicio"));
  const quemadoSemana = ejercicioSemana.reduce((s, it) => s + Math.abs(it.kcal ?? 0), 0);

  const ultimoPeso = pesos.at(-1) ?? null;
  const pesoHaceUnaSemana = ultimoPeso
    ? [...pesos].reverse().find((p) => daysBetween(ultimoPeso.fecha, p.fecha) >= 7) ?? null
    : null;

  const ultimoBano = banos[0] ?? null;
  const banos30 = banos.filter((f) => daysBetween(hoy, f) <= 29).length;

  const diaActivo = dias.find((d) => d.clave === seleccion) ?? dias[0] ?? null;
  const indiceActivo = diaActivo ? dias.indexOf(diaActivo) : -1;

  return (
    <div className="space-y-5">
      <ViewHeader
        title="Salud"
        description="Comidas, movimiento y peso desde la planilla que completa Claude."
        aside={
          <div className="flex items-center gap-3">
            {registro ? (
              <span className="text-xs text-muted">
                Leído {new Date(registro.actualizado).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            ) : null}
            <button type="button" className="secondary-button" onClick={() => void actualizar()} disabled={cargando}>
              {cargando ? "Leyendo…" : "Actualizar"}
            </button>
          </div>
        }
      />

      {error ? (
        <p className="rounded-lg border border-gold/30 bg-gold/10 px-4 py-2.5 text-sm text-gold">
          {registro ? `No pude actualizar (muestro lo último que leí): ${error}` : error}
        </p>
      ) : null}

      {!registro ? (
        cargando ? <EmptyState label="Leyendo la planilla…" /> : null
      ) : dias.length === 0 ? (
        <EmptyState label="La planilla no tiene filas todavía." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 @4xl:grid-cols-4">
            <article className="stat-card">
              <span className="stat-label">Peso</span>
              <span className="stat-value">{ultimoPeso ? `${kg(ultimoPeso.kg)} kg` : "—"}</span>
              <span className="mt-2 block text-xs text-muted">
                {ultimoPeso ? formatDate(ultimoPeso.fecha) : ""}
                {ultimoPeso && pesoHaceUnaSemana
                  ? ` · ${ultimoPeso.kg - pesoHaceUnaSemana.kg >= 0 ? "+" : ""}${kg(ultimoPeso.kg - pesoHaceUnaSemana.kg)} en una semana`
                  : ""}
              </span>
            </article>
            <article className="stat-card">
              <span className="stat-label">Promedio 7 días</span>
              <span className="stat-value">{promedioSemana !== null ? kcal(promedioSemana) : "—"}</span>
              <span className="mt-2 block text-xs text-muted">kcal por día · {semana.length} días cargados</span>
            </article>
            <article className="stat-card">
              <span className="stat-label">Movimiento 7 días</span>
              <span className="stat-value">{ejercicioSemana.length}</span>
              <span className="mt-2 block text-xs text-muted">
                {ejercicioSemana.length === 1 ? "sesión" : "sesiones"}
                {quemadoSemana ? ` · ~${kcal(quemadoSemana)} kcal` : ""}
              </span>
            </article>
            <article className="stat-card">
              <span className="stat-label">Baño</span>
              <span className="stat-value">{ultimoBano ? `${daysBetween(hoy, ultimoBano)} d` : "—"}</span>
              <span className="mt-2 block text-xs text-muted">
                {ultimoBano ? `desde el ${formatDate(ultimoBano)}` : ""} · {banos30} en 30 días
              </span>
            </article>
          </div>

          {pesos.length > 1 ? <GraficoPeso pesos={pesos} /> : null}

          <BarrasCalorias dias={dias.slice(0, 14)} activo={diaActivo?.clave ?? null} elegir={setSeleccion} />

          {diaActivo ? (
            <DetalleDia
              dia={diaActivo}
              bano={banos.includes(diaActivo.fecha)}
              notaBano={notasBano.get(diaActivo.fecha) ?? ""}
              anterior={indiceActivo < dias.length - 1 ? () => setSeleccion(dias[indiceActivo + 1].clave) : null}
              siguiente={indiceActivo > 0 ? () => setSeleccion(dias[indiceActivo - 1].clave) : null}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function GraficoPeso({ pesos }: { pesos: { fecha: string; kg: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  // El SVG se dibuja al ancho real: escalado, el texto quedaba ilegible en el celular.
  const caja = useRef<HTMLDivElement | null>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const H = W < 480 ? 160 : 200;
  const pad = { l: 40, r: 12, t: 12, b: 24 };
  const min = Math.floor(Math.min(...pesos.map((p) => p.kg)) - 0.5);
  const max = Math.ceil(Math.max(...pesos.map((p) => p.kg)) + 0.5);
  const t0 = new Date(`${pesos[0].fecha}T12:00:00`).getTime();
  const t1 = new Date(`${pesos.at(-1)!.fecha}T12:00:00`).getTime();
  const x = (fecha: string) => pad.l + ((new Date(`${fecha}T12:00:00`).getTime() - t0) / Math.max(t1 - t0, 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + ((max - v) / (max - min)) * (H - pad.t - pad.b);
  const linea = pesos.map((p, i) => `${i ? "L" : "M"}${x(p.fecha).toFixed(1)},${y(p.kg).toFixed(1)}`).join(" ");
  const marcas = Array.from({ length: max - min + 1 }, (_, i) => min + i).filter((v, _, xs) => xs.length <= 6 || v % 2 === 0);
  const fechaCorta = (f: string) => (W < 480 ? formatDate(f).replace(/ de \d{4}|\s\d{4}/, "") : formatDate(f));
  const p = hover !== null ? pesos[hover] : null;

  return (
    <section className="rounded-xl border border-border bg-panel px-4 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="section-kicker">Peso (kg)</p>
        <p className="text-xs text-muted">{p ? `${formatDate(p.fecha)} · ${kg(p.kg)} kg` : `${pesos.length} pesajes`}</p>
      </div>
      <div ref={caja} className="mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full" role="img" aria-label="Peso a lo largo del tiempo" onMouseLeave={() => setHover(null)}>
        {marcas.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
            <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
              {v}
            </text>
          </g>
        ))}
        <text x={pad.l} y={H - 6} fontSize={11} fill="var(--muted)">
          {fechaCorta(pesos[0].fecha)}
        </text>
        <text x={W - pad.r} y={H - 6} fontSize={11} fill="var(--muted)" textAnchor="end">
          {fechaCorta(pesos.at(-1)!.fecha)}
        </text>
        {p ? <line x1={x(p.fecha)} x2={x(p.fecha)} y1={pad.t} y2={H - pad.b} stroke="var(--muted)" strokeWidth={1} strokeDasharray="3 3" /> : null}
        <path d={linea} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {pesos.map((pp, i) => (
          <g key={pp.fecha + i} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
            <circle cx={x(pp.fecha)} cy={y(pp.kg)} r={10} fill="transparent" />
            <circle
              cx={x(pp.fecha)}
              cy={y(pp.kg)}
              r={hover === i ? 4.5 : 2.5}
              fill="var(--accent)"
              stroke="var(--panel)"
              strokeWidth={2}
            />
          </g>
        ))}
      </svg>
      </div>
    </section>
  );
}

function BarrasCalorias({ dias, activo, elegir }: { dias: DiaSalud[]; activo: string | null; elegir: (clave: string) => void }) {
  const tope = Math.max(...dias.map((d) => d.kcalComidas), 1);
  return (
    <section className="rounded-xl border border-border bg-panel px-4 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="section-kicker">Calorías por día</p>
        <p className="text-xs text-muted">Tocá un día para ver el detalle</p>
      </div>
      <div className="mt-3 grid gap-1">
        {dias.map((d) => (
          <button
            key={d.clave}
            type="button"
            onClick={() => elegir(d.clave)}
            className={`grid grid-cols-[5.5rem_minmax(0,1fr)_4.5rem] items-center gap-3 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent-soft ${
              d.clave === activo ? "bg-accent-soft" : ""
            }`}
          >
            <span className="text-muted">{formatDate(d.fecha).replace(/ de \d{4}|\s\d{4}/, "")}</span>
            <span className="habit-bar-track">
              <span className="habit-bar-fill" style={{ width: `${(d.kcalComidas / tope) * 100}%` }} />
            </span>
            <span className="text-right text-foreground">
              {d.kcalComidas ? kcal(d.kcalComidas) : "—"}
              {d.kcalEjercicio ? <span className="text-sage"> −{kcal(d.kcalEjercicio)}</span> : null}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

const etiquetas: Record<ItemSalud["tipo"], string> = {
  comida: "",
  ejercicio: "Movimiento",
  pesaje: "Pesaje",
  bano: "Baño",
  total: "Total",
  otro: "",
};

function DetalleDia({
  dia,
  bano,
  notaBano,
  anterior,
  siguiente,
}: {
  dia: DiaSalud;
  bano: boolean;
  notaBano: string;
  anterior: (() => void) | null;
  siguiente: (() => void) | null;
}) {
  const visibles = dia.items.filter((it) => it.tipo !== "total" && it.tipo !== "bano");
  const totalClaude = dia.total?.kcal ?? null;
  const difiere = totalClaude !== null && Math.abs(totalClaude - dia.kcalComidas) > 100 && Math.abs(totalClaude - (dia.kcalComidas - dia.kcalEjercicio)) > 100;

  return (
    <section className="rounded-xl border border-border bg-panel px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="section-kicker">{dia.bloque}</p>
          <h3 className="mt-1 text-base font-medium text-foreground">{formatDate(dia.fecha)}</h3>
        </div>
        <div className="flex gap-2">
          <button type="button" className="secondary-button" onClick={anterior ?? undefined} disabled={!anterior}>
            ‹ Anterior
          </button>
          <button type="button" className="secondary-button" onClick={siguiente ?? undefined} disabled={!siguiente}>
            Siguiente ›
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="meta-chip">{kcal(dia.kcalComidas)} kcal comidas</span>
        {dia.kcalEjercicio ? <span className="meta-chip">−{kcal(dia.kcalEjercicio)} movimiento</span> : null}
        {dia.total?.proteina ? <span className="meta-chip">Proteína {dia.total.proteina}</span> : null}
        {dia.total?.verdura ? <span className="meta-chip">Verdura {dia.total.verdura}</span> : null}
        {dia.peso !== null ? <span className="meta-chip">{kg(dia.peso)} kg</span> : null}
        {bano ? <span className="meta-chip">Baño ✓</span> : null}
      </div>

      {dia.total?.notas ? (
        <p className="mt-3 text-sm leading-6 text-muted">
          {dia.total.notas}
          {difiere ? ` (Claude anotó ~${kcal(totalClaude!)} kcal)` : ""}
        </p>
      ) : null}
      {bano && notaBano && !notaBano.startsWith("Importado") ? <p className="mt-2 text-sm text-muted">Baño: {notaBano}</p> : null}

      <ul className="mt-4 grid gap-2">
        {visibles.map((it, i) => (
          <li key={i} className="grid grid-cols-[6.5rem_minmax(0,1fr)_3.5rem] gap-3 border-t border-border pt-2 text-sm">
            <span className="text-xs text-muted">
              {etiquetas[it.tipo] || it.momento || "Nota"}
              {it.hora ? <span className="block">{it.hora}</span> : null}
            </span>
            <span className="min-w-0">
              <span className="text-foreground">{it.que || it.notas}</span>
              {it.que && it.notas ? <span className="mt-0.5 block text-xs leading-5 text-muted">{it.notas}</span> : null}
            </span>
            <span className="text-right text-xs text-muted">{it.kcal ? kcal(it.kcal) : ""}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
