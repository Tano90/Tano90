"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { submitLead } from "@/app/actions";
import { Notice } from "@/components/app/notice";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";

const campaign = () => {
  const q = new URLSearchParams(window.location.search);
  let referrer: string | null = null;
  try { referrer = document.referrer ? new URL(document.referrer).host || null : null; } catch { /* ignore */ }
  if (referrer === window.location.host) referrer = null;
  return { source: q.get("utm_source") || referrer, medium: q.get("utm_medium"), campaign: q.get("utm_campaign"), referrer };
};

/** Counts one view of the landing page: no cookie, nothing about the visitor, only the campaign source. */
export function ViewBeacon() {
  useEffect(() => {
    const source = new URLSearchParams(window.location.search).get("utm_source") ?? "";
    const body = JSON.stringify({ path: "/", source });
    if (!navigator.sendBeacon?.("/api/hit", new Blob([body], { type: "application/json" }))) {
      fetch("/api/hit", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
    }
  }, []);
  return null;
}

export function LeadForm({ appName }: { appName: string }) {
  const [f, setF] = useState({ name: "", company: "", email: "", phone: "", outlets: "", message: "", website: "" });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  if (done) return <Notice><p className="font-semibold">Danke, {f.name}!</p><p>Wir melden uns in den nächsten zwei Werktagen bei dir. Eine Bestätigung ist unterwegs an {f.email}.</p></Notice>;
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const outlets = Number(f.outlets);
          const res = await submitLead({
            name: f.name, company: f.company, email: f.email, phone: f.phone, message: f.message, website: f.website,
            outlets: Number.isInteger(outlets) && outlets > 0 ? outlets : null, ...campaign(),
          });
          if (!res.ok) return setError(res.error);
          setError(null);
          setDone(true);
        });
      }}
    >
      {error && <Notice tone="warning">{error}</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Dein Name" required><Input value={f.name} onChange={set("name")} maxLength={120} autoComplete="name" /></Field>
        <Field label="Betrieb" required><Input value={f.company} onChange={set("company")} maxLength={160} autoComplete="organization" /></Field>
        <Field label="E-Mail" required><Input type="email" value={f.email} onChange={set("email")} maxLength={254} autoComplete="email" /></Field>
        <Field label="Telefon (optional)"><Input type="tel" value={f.phone} onChange={set("phone")} maxLength={40} autoComplete="tel" /></Field>
        <Field label="Wie viele Standorte?" hint="Optional"><Input inputMode="numeric" value={f.outlets} onChange={(e) => setF((p) => ({ ...p, outlets: e.target.value.replace(/\D/g, "").slice(0, 4) }))} /></Field>
      </div>
      <Field label="Was soll die Suite für euch lösen? (optional)"><Textarea value={f.message} onChange={set("message")} maxLength={2000} rows={3} /></Field>
      {/* Honeypot: hidden from people and screen readers, filled in by naive bots. */}
      <div aria-hidden className="sr-only">
        <label>Website <input tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} /></label>
      </div>
      <p className="text-xs font-normal text-text-muted">
        Wir nutzen deine Angaben nur, um dich wegen {appName} zu kontaktieren, und löschen sie spätestens zwölf Monate nach dem letzten Kontakt.
        Mehr in der <Link href="/legal/privacy" className="underline">Datenschutzerklärung</Link>.
      </p>
      <div><Button type="submit" loading={pending}>Vorführung anfragen</Button></div>
    </form>
  );
}
