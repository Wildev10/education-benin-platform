export default function DirecteurLoading() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8" role="status" aria-label="Chargement">
      <div className="max-w-2xl space-y-3">
        <div className="h-4 w-40 animate-pulse rounded bg-border" />
        <div className="h-10 w-72 max-w-full animate-pulse rounded-lg bg-border" />
        <div className="h-5 w-80 max-w-full animate-pulse rounded bg-border" />
      </div>
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-[14px] border border-border bg-surface" />
        ))}
      </div>
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-80 animate-pulse rounded-[14px] border border-border bg-surface" />
        ))}
      </div>
    </main>
  );
}
