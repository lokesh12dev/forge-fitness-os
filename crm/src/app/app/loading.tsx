export default function CrmLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-12 w-64 bg-[var(--bg-muted)] border-2 border-[var(--border-ink)]" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 bg-[var(--bg-muted)] border-2 border-[var(--border-ink)]" />
        ))}
      </div>
      <div className="h-64 bg-[var(--bg-muted)] border-2 border-[var(--border-ink)]" />
    </div>
  );
}
