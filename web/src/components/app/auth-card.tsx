export function AuthCard({ title, intro, children, footer }: { title: string; intro?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface p-4">
      <div className="w-full max-w-sm">
        <p className="mb-4 text-center font-semibold">Kitchen Ledger</p>
        <div className="rounded-lg border border-border bg-surface-raised p-6 shadow-card">
          <h1 className="text-lg">{title}</h1>
          {intro && <p className="mt-1 text-text-muted">{intro}</p>}
          {children}
        </div>
        {footer && <div className="mt-4 text-center text-text-muted">{footer}</div>}
      </div>
    </main>
  );
}
