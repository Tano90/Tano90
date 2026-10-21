import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { demandStats, listLeads } from "@/data/leads";
import { requireSession } from "@/data/session";
import { formatDay } from "@/lib/dates";
import { isOperator } from "@/lib/operator";
import { CampaignLinks, LeadList } from "./lead-list";

export const metadata = { title: "Anfragen" };
export const dynamic = "force-dynamic";

const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1).replace(".", ",")} %` : "–");

export default async function LeadsPage() {
  const s = await requireSession();
  if (!isOperator(s)) notFound(); // the page does not exist for kitchens
  const [stats, leads] = await Promise.all([demandStats(12), listLeads()]);
  const max = Math.max(1, ...stats.weeks.map((w) => w.leads));
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return (
    <>
      <PageHeader title="Anfragen und Nachfrage" description="Wer sich für das Produkt interessiert, woher, und was daraus wird. Aufrufe ohne Cookies gezählt, nur die Startseite." />
      <dl className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          ["Aufrufe (12 Wochen)", stats.total.views.toLocaleString("de-DE")],
          ["Anfragen (12 Wochen)", stats.total.leads.toLocaleString("de-DE")],
          ["Anfragen je Aufruf", pct(stats.total.leads, stats.total.views)],
          ["Vorführungen / Kunden", `${stats.total.demos} / ${stats.total.won}`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-md border border-border bg-bg p-4"><dt className="text-xs text-text-muted">{k}</dt><dd className="num text-xl">{v}</dd></div>
        ))}
      </dl>

      <div className="mb-10 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="weeks" className="flex flex-col gap-2">
          <h2 id="weeks" className="text-lg">Pro Woche</h2>
          <table className="w-full text-sm">
            <caption className="sr-only">Aufrufe und Anfragen pro Woche</caption>
            <thead className="text-xs text-text-muted"><tr><th scope="col" className="text-left">Woche ab</th><th scope="col" className="text-right">Aufrufe</th><th scope="col" className="text-right">Anfragen</th><th scope="col"><span className="sr-only">Balken</span></th></tr></thead>
            <tbody>
              {stats.weeks.map((w) => (
                <tr key={w.from} className="border-t border-border">
                  <td className="py-1">{formatDay(w.from)}</td>
                  <td className="num text-right">{w.views}</td>
                  <td className="num text-right">{w.leads}</td>
                  <td className="w-1/3 pl-3"><div aria-hidden className="h-2 rounded-pill bg-accent" style={{ width: `${(w.leads / max) * 100}%` }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section aria-labelledby="sources" className="flex flex-col gap-2">
          <h2 id="sources" className="text-lg">Nach Quelle</h2>
          {stats.sources.length === 0 ? <p className="text-text-muted">Noch keine Aufrufe oder Anfragen.</p> : (
            <table className="w-full text-sm">
              <caption className="sr-only">Aufrufe und Anfragen nach Quelle</caption>
              <thead className="text-xs text-text-muted"><tr><th scope="col" className="text-left">Quelle</th><th scope="col" className="text-right">Aufrufe</th><th scope="col" className="text-right">Anfragen</th><th scope="col" className="text-right">Quote</th></tr></thead>
              <tbody>
                {stats.sources.map((x) => (
                  <tr key={x.source} className="border-t border-border"><td className="py-1">{x.source}</td><td className="num text-right">{x.views}</td><td className="num text-right">{x.leads}</td><td className="num text-right">{pct(x.leads, x.views)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <LeadList leads={leads.map((l) => ({ ...l, createdAt: new Date(l.createdAt).toISOString(), updatedAt: new Date(l.updatedAt).toISOString() }))} />
      <CampaignLinks base={base} />
    </>
  );
}
