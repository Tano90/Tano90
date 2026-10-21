"use client";

import { Copy, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateLeadStatus } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import type { Lead, LeadStatus } from "@/data/leads";
import { toCsv } from "@/domain/csv";
import { formatDateTime } from "@/lib/dates";

const STATUS: Record<LeadStatus, string> = { new: "neu", contacted: "kontaktiert", demo: "Vorführung", won: "Kunde", lost: "kein Interesse" };

export function LeadList({ leads }: { leads: Lead[] }) {
  const download = () => {
    const rows = [["Eingang", "Name", "Betrieb", "E-Mail", "Telefon", "Standorte", "Quelle", "Medium", "Kampagne", "Status", "Nachricht", "Notizen"],
      ...leads.map((l) => [formatDateTime(l.createdAt), l.name, l.company, l.email, l.phone, l.outlets, l.source, l.medium, l.campaign, STATUS[l.status], l.message, l.notes])];
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "anfragen.csv" });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section aria-labelledby="leads-h" className="mb-10 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="leads-h" className="text-lg">Anfragen ({leads.length})</h2>
        <Button variant="secondary" size="sm" disabled={!leads.length} onClick={download}><Download aria-hidden className="size-4" /> Als CSV exportieren</Button>
      </div>
      {leads.length === 0 ? (
        <p className="text-text-muted">Noch keine Anfragen. Sie kommen über das Formular auf der Startseite.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-bg">
          {leads.map((l) => <LeadRow key={l.id} lead={l} />)}
        </ul>
      )}
    </section>
  );
}

function LeadRow({ lead }: { lead: Lead }) {
  const router = useRouter();
  const [status, setStatus] = useState(lead.status);
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [pending, start] = useTransition();
  const dirty = status !== lead.status || notes !== (lead.notes ?? "");
  return (
    <li className="flex flex-col gap-3 p-4 lg:flex-row">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{lead.company} <span className="font-normal text-text-muted">· {lead.name}</span></p>
        <p className="text-sm"><a className="underline" href={`mailto:${lead.email}`}>{lead.email}</a>{lead.phone && <> · <a className="underline" href={`tel:${lead.phone}`}>{lead.phone}</a></>}</p>
        <p className="text-xs text-text-muted">
          {formatDateTime(lead.createdAt)} · {lead.outlets ? `${lead.outlets} ${lead.outlets === 1 ? "Standort" : "Standorte"}` : "Standorte offen"} · Quelle: {[lead.source, lead.medium, lead.campaign].filter(Boolean).join(" / ") || "direkt"}
        </p>
        {lead.message && <p className="mt-2 whitespace-pre-wrap text-sm">{lead.message}</p>}
      </div>
      <div className="flex w-full flex-col gap-2 lg:w-80">
        <label className="flex flex-col gap-1 text-xs">Status
          <Select value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)}>
            {Object.entries(STATUS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs">Notizen
          <Textarea rows={2} value={notes} maxLength={4000} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <div>
          <Button size="sm" disabled={!dirty} loading={pending} onClick={() => start(async () => {
            const res = await updateLeadStatus(lead.id, { status, notes });
            if (!res.ok) return void toast.error(res.error);
            toast.success("Gespeichert");
            router.refresh();
          })}>Speichern</Button>
        </div>
      </div>
    </li>
  );
}

const CHANNELS: [label: string, source: string, medium: string][] = [
  ["LinkedIn-Beiträge", "linkedin", "social"],
  ["Instagram-Profil und Stories", "instagram", "social"],
  ["Facebook-Gruppen für Gastronomie", "facebook", "community"],
  ["Persönliche E-Mails an Kontakte", "email", "personal"],
  ["Flyer und Visitenkarten (QR-Code)", "flyer", "print"],
  ["Messen und Branchentreffen", "event", "offline"],
  ["Google Ads (Testbudget)", "google", "cpc"],
];

/** Ready-made links per channel, so every inquiry shows where it came from. */
export function CampaignLinks({ base }: { base: string }) {
  const [campaign, setCampaign] = useState("vorstart");
  const slug = campaign.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "vorstart";
  return (
    <section aria-labelledby="links-h" className="flex flex-col gap-3">
      <h2 id="links-h" className="text-lg">Links für Kampagnen</h2>
      <p className="text-text-muted">Für jeden Kanal den passenden Link nutzen; dann steht bei jeder Anfrage und in „Nach Quelle“, woher sie kam.</p>
      <label className="flex max-w-xs flex-col gap-1 text-xs">Kampagne
        <input className="h-(--size-control-md) rounded-sm border border-border-input bg-bg px-3 text-sm" value={campaign} onChange={(e) => setCampaign(e.target.value)} maxLength={60} />
      </label>
      <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-bg">
        {CHANNELS.map(([label, source, medium]) => {
          const url = `${base}/?utm_source=${source}&utm_medium=${medium}&utm_campaign=${slug}`;
          return (
            <li key={source} className="flex flex-wrap items-center gap-3 px-4 py-2">
              <span className="min-w-48 font-semibold">{label}</span>
              <code className="min-w-0 flex-1 break-all text-xs">{url}</code>
              <Button variant="ghost" size="sm" aria-label={`Link für ${label} kopieren`} onClick={() => navigator.clipboard.writeText(url).then(() => toast.success("Link kopiert"), () => toast.error("Kopieren nicht erlaubt"))}>
                <Copy aria-hidden className="size-4" />
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
