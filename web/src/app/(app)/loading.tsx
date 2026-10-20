export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Lädt" className="flex flex-col gap-4">
      <div className="h-8 w-64 animate-pulse rounded-sm bg-surface-sunken" />
      <div className="h-4 w-96 max-w-full animate-pulse rounded-sm bg-surface-sunken" />
      <div className="mt-4 flex flex-col gap-2 rounded-md border border-border bg-bg p-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-6 animate-pulse rounded-sm bg-surface-sunken" />
        ))}
      </div>
    </div>
  );
}
