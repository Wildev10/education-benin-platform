export default function EnseignantLoading() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8" role="status" aria-label="Chargement">
      <div className="max-w-2xl space-y-3">
        <div className="h-4 w-32 animate-pulse rounded bg-border" />
        <div className="h-10 w-64 animate-pulse rounded-lg bg-border" />
        <div className="h-5 w-96 animate-pulse rounded bg-border" />
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="h-12 animate-pulse bg-ink/10" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-5 border-t border-border px-5 py-4">
            <div className="h-4 w-28 animate-pulse rounded bg-border" />
            <div className="h-4 w-20 animate-pulse rounded bg-border" />
            <div className="h-4 w-40 animate-pulse rounded bg-border" />
            <div className="h-4 w-24 animate-pulse rounded bg-border" />
          </div>
        ))}
      </div>
    </main>
  );
}
