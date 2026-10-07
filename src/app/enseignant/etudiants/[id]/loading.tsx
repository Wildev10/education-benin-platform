export default function StudentDetailLoading() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8" role="status" aria-label="Chargement de la fiche étudiant">
      {/* Back button skeleton */}
      <div className="h-9 w-40 animate-pulse rounded-lg bg-border" />

      {/* Header skeleton */}
      <div className="mt-6 border-b border-border pb-7 space-y-4">
        <div className="h-4 w-28 animate-pulse rounded bg-border" />
        <div className="h-10 w-64 animate-pulse rounded-lg bg-border" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 mt-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-24 animate-pulse rounded bg-border" />
              <div className="h-6 w-32 animate-pulse rounded-lg bg-border" />
            </div>
          ))}
        </div>
      </div>

      {/* Chart skeleton */}
      <div className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="h-5 w-48 animate-pulse rounded-lg bg-border" />
        <div className="mt-6 h-72 animate-pulse rounded-xl bg-border/40" />
      </div>

      {/* Notes skeleton */}
      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
            <div className="h-14 animate-pulse bg-ink/10" />
            <div className="space-y-3 p-5">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="flex justify-between">
                  <div className="h-4 w-32 animate-pulse rounded bg-border" />
                  <div className="h-4 w-12 animate-pulse rounded bg-border" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
