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
        body={error.message || "Die Seite konnte nicht geladen werden."}
        action={<Button onClick={reset}>Erneut versuchen</Button>}
      />
    </div>
  );
}
