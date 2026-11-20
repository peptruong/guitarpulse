export function PageLoading() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Loading">
      <div className="h-9 w-72 animate-pulse rounded-xl bg-white/5" />
      <div className="h-4 w-[min(36rem,90%)] animate-pulse rounded bg-white/5" />
      <div className="h-64 animate-pulse rounded-2xl bg-white/5" />
    </div>
  );
}
