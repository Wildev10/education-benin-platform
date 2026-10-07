export default function AdminLoading() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8" role="status" aria-label="Chargement">
      {/* Page header skeleton */}
      <div className="max-w-3xl space-y-3">
        <div className="h-4 w-32 animate-pulse rounded bg-border" />
        <div className="h-10 w-72 animate-pulse rounded-lg bg-border" />
        <div className="h-5 w-96 animate-pulse rounded bg-border" />
      </div>

      {/* Stat cards skeleton */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-[14px] border border-border bg-surface p-5 shadow-sm">
            <div className="h-4 w-28 animate-pulse rounded bg-border" />
            <div className="mt-3 h-10 w-20 animate-pulse rounded-lg bg-border" />
          </div>
        ))}
      </div>

      {/* Alert cards skeleton */}
      <div className="mt-10 space-y-4">
        <div className="h-6 w-48 animate-pulse rounded-lg bg-border" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-5 w-40 animate-pulse rounded bg-border" />
              <div className="h-5 w-20 animate-pulse rounded-full bg-border" />
            </div>
            <div className="mt-2 h-4 w-56 animate-pulse rounded bg-border" />
          </div>
        ))}
      </div>
    </main>
  );
}
