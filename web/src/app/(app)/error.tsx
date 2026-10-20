"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-md border border-border bg-bg">
      <EmptyState
        icon={TriangleAlert}
        title="Da ist etwas schiefgegangen"
        // Never show error.message: in production it is Next.js's generic English text.
        body={`Die Seite ließ sich gerade nicht laden. Meist hilft ein zweiter Versuch.${error.digest ? ` Fehlercode für den Support: ${error.digest}` : ""}`}
        action={<Button onClick={reset}>Erneut versuchen</Button>}
      />
    </div>
  );
}
