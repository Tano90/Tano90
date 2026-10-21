import { NoPermission, Notice } from "@/components/app/notice";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { getBilling, listOutlets } from "@/data/repo";
import { canManageBilling, requireSession } from "@/data/session";
import { addonConfigured, billingConfigured, yearlyConfigured } from "@/lib/billing";
import { ADDONS, ADDON_KEYS } from "@/domain/addons";
import { formatCents } from "@/lib/format";
import { PRICING } from "@/lib/pricing";
import { accessOf } from "@/domain/access";
import { formatDate } from "@/lib/dates";
import { PRICE_TAX_NOTE } from "@/lib/legal";
import { BillingButtons } from "./billing-buttons";

export const metadata = { title: "Abo & Rechnungen" };

const PLAN = { trial: { label: "Testphase", tone: "info" }, active: { label: "Aktiv", tone: "success" }, past_due: { label: "Zahlung offen", tone: "warning" }, cancelled: { label: "Gekündigt", tone: "danger" } } as const;
const date = (iso: string | null) => formatDate(iso, undefined, "long");

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const { checkout } = await searchParams;
  const s = await requireSession();
  if (!canManageBilling(s.role)) {
    return (<><PageHeader title="Abo & Rechnungen" back={{ href: "/settings", label: "Einstellungen" }} /><NoPermission what="Das Abo verwaltet die Inhaberin oder der Inhaber des Betriebs." /></>);
  }
  const [billing, outlets] = await Promise.all([getBilling(s), listOutlets(s)]);
  const access = accessOf(billing);
  const p = access.kind === "trial_over" ? { label: "Testphase vorbei", tone: "danger" as const } : PLAN[billing.plan];
  return (
    <>
      <PageHeader title="Abo & Rechnungen" back={{ href: "/settings", label: "Einstellungen" }} />
      <div className="flex max-w-(--size-form-max) flex-col gap-4">
        {checkout === "success" && <Notice>Danke! Sobald Stripe die Zahlung bestätigt, ist dein Abo aktiv. Das dauert meist nur Sekunden.</Notice>}
        {checkout === "cancelled" && <Notice tone="warning">Der Bezahlvorgang wurde abgebrochen. Es wurde nichts berechnet.</Notice>}
        {!billingConfigured() && <Notice tone="warning">Die Abrechnung ist noch nicht eingerichtet (Stripe-Schlüssel fehlen).</Notice>}
        <dl className="grid grid-cols-2 gap-4 rounded-md border border-border bg-bg p-4">
          <div><dt className="text-xs text-text-muted">Status</dt><dd><Badge tone={p.tone}>{p.label}</Badge></dd></div>
          <div><dt className="text-xs text-text-muted">Outlets (abgerechnet)</dt><dd className="num">{outlets.length}</dd></div>
          {billing.plan === "trial" && <div><dt className="text-xs text-text-muted">{access.readOnly ? "Testphase endete" : "Testphase endet"}</dt><dd>{date(billing.trialEndsAt)}</dd></div>}
          {billing.currentPeriodEnd && <div><dt className="text-xs text-text-muted">{billing.plan === "cancelled" ? "Zugang bis" : "Nächste Abrechnung"}</dt><dd>{date(billing.currentPeriodEnd)}</dd></div>}
        </dl>
        {billing.plan === "past_due" && <Notice tone="warning">Die letzte Zahlung ist fehlgeschlagen. Aktualisiere deine Zahlungsart, damit der Zugang erhalten bleibt.</Notice>}
        <BillingButtons
          hasCustomer={!!billing.stripeCustomerId}
          subscribed={!!billing.stripeSubscriptionId && billing.plan !== "cancelled"}
          configured={billingConfigured()}
          yearly={yearlyConfigured()}
          inTrial={access.kind === "trial"}
          price={`${formatCents(PRICING.addonMonthly)} im Monat pro Betrieb`}
          addons={ADDON_KEYS.map((key) => ({ key, name: ADDONS[key].name, pitch: ADDONS[key].pitch, booked: billing.addons.includes(key), configured: addonConfigured(key) }))}
        />
        <p className="text-xs font-normal text-text-muted">Kündigen geht jederzeit mit einem Klick über „Abo verwalten“. Bezahlung und Rechnungen laufen über Stripe; deine Kartendaten sehen wir nie. {PRICE_TAX_NOTE}</p>
      </div>
    </>
  );
}
