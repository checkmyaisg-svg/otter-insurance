/**
 * Route-transition skeleton. Mirrors the dashboard/list silhouette so content
 * appears to materialize in place — no blank flash, no layout shift.
 */
export default function Loading() {
  return (
    <main className="mx-auto max-w-[960px] animate-pulse p-6 md:p-8" aria-busy>
      <div className="h-3 w-32 rounded bg-muted" />
      <div className="mt-3 h-7 w-64 rounded bg-muted" />
      <div className="mt-2 h-4 w-80 rounded bg-muted" />
      <div className="mt-8 space-y-4">
        <div className="h-24 rounded-xl bg-muted/70" />
        <div className="h-40 rounded-xl bg-muted/70" />
        <div className="h-32 rounded-xl bg-muted/70" />
      </div>
    </main>
  );
}
