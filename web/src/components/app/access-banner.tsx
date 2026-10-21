import Link from "next/link";
import { type Access, READ_ONLY_MESSAGE } from "@/domain/access";
import { Notice } from "./notice";

/** Shown on every app page: the last days of the trial, and the read-only state after it or after cancelling. */
export function AccessBanner({ access, canBill }: { access: Access; canBill: boolean }) {
  const next = canBill
    ? <Link href="/settings/billing" className="font-semibold underline">Abo abschließen</Link>
    : <span>Das Abo schließt die Inhaberin oder der Inhaber ab.</span>;
  if (access.kind === "trial" && access.daysLeft <= 3) {
    return (
      <Notice className="mb-4">
        Die Testphase endet {access.daysLeft === 1 ? "morgen" : `in ${access.daysLeft} Tagen`}. Danach lassen sich die Daten nur noch ansehen. {next}
      </Notice>
    );
  }
  if (access.kind === "trial_over" || access.kind === "cancelled") {
    return <Notice tone="warning" className="mb-4">{READ_ONLY_MESSAGE[access.kind]} {next}</Notice>;
  }
  if (access.kind === "past_due" && canBill) {
    return <Notice tone="warning" className="mb-4">Die letzte Zahlung ist fehlgeschlagen. <Link href="/settings/billing" className="font-semibold underline">Zahlungsart prüfen</Link></Notice>;
  }
  return null;
}
