export function ViewHeader({
  title,
  description,
  aside,
}: {
  title: string;
  description: string;
  aside?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h2 className="text-xl font-medium tracking-[-0.03em] text-foreground">{title}</h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">{description}</p>
      </div>
      {aside}
    </header>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <article className="rounded-xl border border-border bg-panel px-4 py-5 text-sm text-muted">
      {label}
    </article>
  );
}
