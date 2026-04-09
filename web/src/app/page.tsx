import { memories, modules, timelineEntries, todayCards } from "@/lib/mock-data";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-5 py-6 sm:px-8 lg:px-10">
      <section className="fade-up grid gap-6 lg:grid-cols-[1.35fr_0.9fr]">
        <div className="paper overflow-hidden rounded-[2rem] border border-border p-7 sm:p-10">
          <div className="eyebrow mb-5">archivo personal · beta 0</div>
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.75fr]">
            <div className="space-y-6">
              <h1 className="max-w-2xl text-5xl leading-[0.95] font-semibold tracking-[-0.04em] text-foreground sm:text-6xl">
                Tu vida en una línea de tiempo que sí se puede consultar.
              </h1>
              <p className="max-w-xl text-base leading-7 text-muted sm:text-lg">
                PrivateLife arranca como un segundo cerebro personal: recuerdos,
                hábitos, películas, libros, etapas, personas y pequeños rastros
                del día a día reunidos en un mismo sistema.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="#timeline"
                  className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5"
                >
                  Ver la estructura
                </a>
                <a
                  href="#modulos"
                  className="rounded-full border border-border bg-white/70 px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-white"
                >
                  Explorar módulos
                </a>
              </div>
            </div>
            <div className="glass rounded-[1.75rem] border border-white/60 p-5 text-sm text-foreground">
              <div className="mb-4 flex items-center justify-between">
                <span className="eyebrow">Hoy</span>
                <span className="rounded-full bg-white/70 px-3 py-1 text-xs text-muted">
                  08 abr 2026
                </span>
              </div>
              <div className="space-y-3">
                {todayCards.map((card) => (
                  <article
                    key={card.label}
                    className="rounded-[1.25rem] border border-border bg-white/75 p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">
                      {card.label}
                    </p>
                    <p className="mt-2 text-2xl font-semibold">{card.value}</p>
                    <p className="mt-1 text-sm leading-6 text-muted">{card.hint}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>

        <aside className="fade-up-delay flex flex-col gap-5">
          <div className="glass rounded-[2rem] border border-border p-6">
            <div className="eyebrow mb-4">principios</div>
            <ul className="space-y-4 text-sm leading-6 text-muted">
              <li>
                <strong className="mr-2 text-foreground">Local-first.</strong>
                Tus datos primero viven contigo.
              </li>
              <li>
                <strong className="mr-2 text-foreground">Web primero.</strong>
                Publicable en GitHub Pages y adaptable a APK después.
              </li>
              <li>
                <strong className="mr-2 text-foreground">Mismo modelo.</strong>
                Recuerdos, hábitos y consumos comparten timeline.
              </li>
            </ul>
          </div>
          <div className="rounded-[2rem] bg-deep p-6 text-white shadow-[0_24px_60px_rgba(47,81,68,0.28)]">
            <div className="eyebrow mb-4 text-white/70">MVP</div>
            <p className="text-2xl leading-tight font-semibold">
              Registrar rápido, buscar bien, exportar todo.
            </p>
            <p className="mt-4 text-sm leading-6 text-white/78">
              La primera versión no intenta hacerlo todo. Prioriza captura rápida,
              historial consultable y una UI que invite a volver.
            </p>
          </div>
        </aside>
      </section>

      <section id="timeline" className="mt-8 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="glass rounded-[2rem] border border-border p-6 sm:p-8">
          <div className="eyebrow mb-3">timeline central</div>
          <h2 className="section-title max-w-md font-semibold">
            Un único flujo para recuerdos, hábitos e hitos.
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-7 text-muted sm:text-base">
            La app gira alrededor de entradas con fecha, tipo y contexto. Eso
            simplifica la búsqueda y evita acabar con módulos aislados que luego
            no se pueden relacionar.
          </p>
        </div>

        <div className="space-y-4">
          {timelineEntries.map((entry) => (
            <article
              key={`${entry.date}-${entry.title}`}
              className="paper rounded-[1.75rem] border border-border p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
                <span>{entry.date}</span>
                <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold tracking-[0.16em] text-accent uppercase">
                  {entry.kind}
                </span>
              </div>
              <h3 className="mt-4 text-2xl font-semibold tracking-[-0.03em]">
                {entry.title}
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted sm:text-base">
                {entry.note}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section id="modulos" className="mt-8 grid gap-4 md:grid-cols-2">
        {modules.map((module) => (
          <article
            key={module.name}
            className="glass rounded-[1.75rem] border border-border p-6 transition-transform duration-200 hover:-translate-y-1"
          >
            <div className="eyebrow mb-3">módulo</div>
            <h3 className="text-2xl font-semibold tracking-[-0.03em]">
              {module.name}
            </h3>
            <p className="mt-3 text-sm leading-7 text-muted sm:text-base">
              {module.description}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-[2rem] border border-border bg-[#fff8ef] p-6 sm:p-8">
          <div className="eyebrow mb-3">captura rápida</div>
          <h2 className="section-title font-semibold">
            La entrada ideal tarda menos de un minuto.
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[1.4rem] bg-white p-4">
              <p className="text-sm font-semibold">¿Qué pasó?</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Recuerdo, hábito, película, libro o nota.
              </p>
            </div>
            <div className="rounded-[1.4rem] bg-white p-4">
              <p className="text-sm font-semibold">¿Cuándo fue?</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Fecha exacta, aproximada o solo una etapa.
              </p>
            </div>
            <div className="rounded-[1.4rem] bg-white p-4">
              <p className="text-sm font-semibold">¿Con qué se relaciona?</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Personas, lugares, etiquetas y emociones.
              </p>
            </div>
          </div>
        </div>

        <div className="glass rounded-[2rem] border border-border p-6 sm:p-8">
          <div className="eyebrow mb-4">memorias conectadas</div>
          <div className="space-y-4">
            {memories.map((memory) => (
              <article
                key={memory.title}
                className="rounded-[1.4rem] border border-border bg-white/80 p-5"
              >
                <p className="text-xs uppercase tracking-[0.18em] text-muted">
                  {memory.meta}
                </p>
                <h3 className="mt-3 text-xl font-semibold tracking-[-0.02em]">
                  {memory.title}
                </h3>
                <p className="mt-2 text-sm leading-7 text-muted">
                  {memory.excerpt}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
