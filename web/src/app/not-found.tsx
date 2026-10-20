import { SearchX } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <main className="p-6">
      <EmptyState
        icon={SearchX}
        as="h1"
        title="Nicht gefunden"
        body="Diesen Eintrag gibt es nicht oder nicht mehr."
        action={<Link className="font-semibold text-accent underline" href="/">Zur Übersicht</Link>}
      />
    </main>
  );
}
