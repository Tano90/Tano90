import { Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import { Notice } from "@/components/app/notice";
import { getBilling } from "@/data/repo";
import { canManageBilling } from "@/data/session";
import type { Session } from "@/data/types";
import { accessOf } from "@/domain/access";
import { ADDONS, type AddonKey, addonOpen } from "@/domain/addons";
import { formatCents } from "@/lib/format";
import { PRICING } from "@/lib/pricing";

const price = `${formatCents(PRICING.addonMonthly)} im Monat pro Betrieb`;

/** Where an add-on stands for this library: open (with a trial hint) or locked. */
export async function addonState(s: Session, key: AddonKey) {
  const billing = await getBilling(s);
  const access = accessOf(billing);
  return { open: addonOpen(access, billing.addons, key), trial: access.kind === "trial" && !billing.addons.includes(key) };
}

export function AddonTrialHint({ addon }: { addon: AddonKey }) {
  return <Notice className="mb-4">{ADDONS[addon].name} ist ein Add-on und in der Testphase enthalten. Danach {price}, jederzeit kündbar.</Notice>;
}

export function AddonLocked({ addon, s }: { addon: AddonKey; s: Session }) {
  const a = ADDONS[addon];
  return (
    <section aria-labelledby="addon-locked" className="max-w-xl rounded-lg border border-border bg-bg p-6 shadow-card">
      <span className="inline-flex size-11 items-center justify-center rounded-md bg-accent-subtle text-accent"><Lock aria-hidden className="size-5" /></span>
      <h2 id="addon-locked" className="mt-4 text-lg">{a.name} ist ein Add-on</h2>
      <p className="mt-1 text-text-muted">{a.pitch}</p>
      <p className="mt-3 font-semibold">{price}, monatlich kündbar.</p>
      <p className="mt-1 text-sm text-text-muted">Was du schon eingetragen hast, bleibt gespeichert und ist im Datenexport enthalten.</p>
      {canManageBilling(s.role) ? (
        <Link href="/settings/billing#addons" className="mt-5 inline-flex h-(--size-control-md) items-center gap-2 rounded-md bg-accent px-4 font-semibold text-on-accent hover:bg-accent-hover">
          <Sparkles aria-hidden className="size-4" /> Add-on buchen
        </Link>
      ) : (
        <p className="mt-5 text-sm">Buchen kann die Inhaberin oder der Inhaber unter Einstellungen → Abo.</p>
      )}
    </section>
  );
}
