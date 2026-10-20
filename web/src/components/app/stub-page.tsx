import { Hammer } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { screen } from "@/lib/screens";
import { PageHeader } from "./page-header";

/** Placeholder for screens that are routed but not built yet (see replica/build-log.md). */
export function StubPage({ id }: { id: string }) {
  const s = screen(id);
  return (
    <>
      <PageHeader title={s.title} description={s.purpose} />
      <div className="rounded-md border border-border bg-bg">
        <EmptyState icon={Hammer} title="Noch nicht gebaut" body={`${s.id} ist geplant, aber noch nicht umgesetzt. Den Stand führt das Build-Log.`} />
      </div>
    </>
  );
}
