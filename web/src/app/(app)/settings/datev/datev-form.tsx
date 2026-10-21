"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveDatevSettings } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, controlClass } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { type DatevSettings, STANDARD_ACCOUNTS } from "@/domain/datev";

const RATES = [["0", "0 % / steuerfrei"], ["700", "7 %"], ["1900", "19 %"]] as const;
const num = (v: string) => (/^\d{1,9}$/.test(v.trim()) ? Number(v.trim()) : null);

export function DatevForm({ settings, suppliers }: { settings: DatevSettings | null; suppliers: { id: string; name: string; creditor: number | null }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [chart, setChart] = useState<DatevSettings["chart"]>(settings?.chart ?? "03");
  const [v, setV] = useState({
    consultant: String(settings?.consultantNumber ?? ""), client: String(settings?.clientNumber ?? ""), length: String(settings?.accountLength ?? 4),
    fy: String(settings?.fiscalYearStartMonth ?? 1), creditor: String(settings?.defaultCreditor ?? 70000),
  });
  const [accounts, setAccounts] = useState<Record<string, string>>(Object.fromEntries(RATES.map(([k]) => [k, String((settings?.accounts ?? STANDARD_ACCOUNTS["03"])[k] ?? "")])));
  const [creditors, setCreditors] = useState<Record<string, string>>(Object.fromEntries(suppliers.map((x) => [x.id, x.creditor ? String(x.creditor) : ""])));
  const switchChart = (c: DatevSettings["chart"]) => {
    setChart(c);
    // Only replace accounts that are still the other chart's standard.
    setAccounts((a) => Object.fromEntries(RATES.map(([k]) => [k, a[k] === String(STANDARD_ACCOUNTS[c === "03" ? "04" : "03"][k]) || !a[k] ? String(STANDARD_ACCOUNTS[c][k]) : a[k]])));
  };
  const save = () => start(async () => {
    const res = await saveDatevSettings({
      consultantNumber: num(v.consultant) ?? 0, clientNumber: num(v.client) ?? 0, chart, accountLength: num(v.length) ?? 4, fiscalYearStartMonth: num(v.fy) ?? 1,
      defaultCreditor: num(v.creditor) ?? 0, accounts: Object.fromEntries(Object.entries(accounts).filter(([, a]) => num(a)).map(([k, a]) => [k, num(a)!])),
    }, suppliers.map((x) => ({ supplierId: x.id, creditor: num(creditors[x.id] ?? "") })));
    if (res.ok) { toast.success("DATEV-Einstellungen gespeichert"); router.refresh(); } else toast.error(res.error);
  });
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <section aria-labelledby="base" className="rounded-lg border border-border bg-bg p-4">
        <h2 id="base" className="text-lg">Kanzlei und Mandant</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Beraternummer" required><input inputMode="numeric" className={controlClass} value={v.consultant} onChange={(e) => setV({ ...v, consultant: e.target.value })} /></Field>
          <Field label="Mandantennummer" required><input inputMode="numeric" className={controlClass} value={v.client} onChange={(e) => setV({ ...v, client: e.target.value })} /></Field>
          <Field label="Kontenrahmen">
            <select className={controlClass} value={chart} onChange={(e) => switchChart(e.target.value as DatevSettings["chart"])}><option value="03">SKR 03</option><option value="04">SKR 04</option></select>
          </Field>
          <Field label="Sachkontenlänge"><input inputMode="numeric" className={controlClass} value={v.length} onChange={(e) => setV({ ...v, length: e.target.value })} /></Field>
          <Field label="Wirtschaftsjahr beginnt im Monat" hint="1 = Januar"><input inputMode="numeric" className={controlClass} value={v.fy} onChange={(e) => setV({ ...v, fy: e.target.value })} /></Field>
          <Field label="Kreditorenkonto (Standard)" hint="Für Lieferanten ohne eigenes Konto, z. B. 70000"><input inputMode="numeric" className={controlClass} value={v.creditor} onChange={(e) => setV({ ...v, creditor: e.target.value })} /></Field>
        </div>
      </section>
      <section aria-labelledby="accounts" className="rounded-lg border border-border bg-bg p-4">
        <h2 id="accounts" className="text-lg">Wareneingangskonten je Steuersatz</h2>
        <p className="mt-1 text-sm text-text-muted">Vorbelegt mit den üblichen Konten mit automatischer Vorsteuer. Nimmt dein Steuerberater andere, hier ändern.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {RATES.map(([k, label]) => <Field key={k} label={`Konto ${label}`}><input inputMode="numeric" className={controlClass} value={accounts[k] ?? ""} onChange={(e) => setAccounts({ ...accounts, [k]: e.target.value })} /></Field>)}
        </div>
      </section>
      {suppliers.length > 0 && (
        <section aria-labelledby="creditors" className="rounded-lg border border-border bg-bg p-4">
          <h2 id="creditors" className="text-lg">Kreditorenkonten je Lieferant (optional)</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {suppliers.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-3 text-sm"><span>{x.name}</span>
                <input aria-label={`Kreditorenkonto ${x.name}`} inputMode="numeric" placeholder={v.creditor} className={`${controlClass} max-w-40`} value={creditors[x.id] ?? ""} onChange={(e) => setCreditors({ ...creditors, [x.id]: e.target.value })} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <div><Button loading={pending} onClick={save}>Speichern</Button></div>
    </div>
  );
}
