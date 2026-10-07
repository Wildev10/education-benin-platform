export default function EtudiantLoading() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8" role="status" aria-label="Chargement">
      <div className="max-w-3xl space-y-3">
        <div className="h-4 w-28 animate-pulse rounded bg-border" />
        <div className="h-10 w-56 animate-pulse rounded-lg bg-border" />
        <div className="h-5 w-64 animate-pulse rounded bg-border" />
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="h-6 w-40 animate-pulse rounded-lg bg-border" />
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-border" />
              <div className="h-6 w-32 animate-pulse rounded-lg bg-border" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
            <div className="h-14 animate-pulse bg-ink/10" />
            <div className="space-y-3 p-5">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="h-4 w-full animate-pulse rounded bg-border" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
