import { SearchX } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <div className="rounded-md border border-border bg-bg">
      <EmptyState
        as="h1"
        icon={SearchX}
        title="Nicht gefunden"
        body="Diesen Eintrag gibt es nicht, nicht mehr, oder er gehört zu einem anderen Betrieb."
        action={<Link className="font-semibold text-accent underline" href="/app">Zur Übersicht</Link>}
      />
    </div>
  );
}
