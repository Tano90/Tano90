import { AlertTriangle, ArrowRight, BedDouble, CalendarDays, CheckCircle2, Clock, Coins, LogIn, LogOut, Shirt, Users } from "lucide-react";
import Link from "next/link";
import { NoPermission } from "@/components/app/notice";
import { BarChart } from "@/components/app/bar-chart";
import { canEditLibrary, currentOutletId, requireSession } from "@/data/session";
import { KIND_LABEL } from "@/domain/linen";
import { formatDay } from "@/lib/dates";
import { formatCents } from "@/lib/format";
import { cn } from "@/lib/cn";
import { hkForecast } from "../forecast";

export const metadata = { title: "Housekeeping: Übersicht" };
export const dynamic = "force-dynamic";

const hours = (min: number) => (min / 60).toLocaleString("de-DE", { maximumFractionDigits: 1 });
const weekday = (day: string) => new Intl.DateTimeFormat("de-DE", { weekday: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
const short = (day: string) => new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));

type Alert = { tone: "danger" | "warning"; text: string; href: string; action: string };

function Tile({ icon: Icon, label, value, sub, tone }: { icon: typeof BedDouble; label: string; value: string; sub?: string; tone?: "danger" | "warning" | "success" }) {
  return (
    <div className="rounded-md border border-border bg-surface-raised p-4 shadow-card">
      <p className="flex items-center gap-1.5 text-xs font-normal text-text-muted"><Icon aria-hidden className="size-4" />{label}</p>
      <p className="num mt-1 text-xl">{value}</p>
      {sub && <p className={cn("mt-1 text-xs", tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-text-muted")}>{sub}</p>}
    </div>
  );
}

export default async function HkDashboard() {
  const s = await requireSession();
  if (!canEditLibrary(s.role)) return <NoPermission what="Die Übersicht sieht die Leitung." />;
  const f = await hkForecast(s, await currentOutletId(s));
  const t = f.daily[0];
  const week = f.daily.slice(0, 7);
  const occupancy = f.board.total ? Math.round(((t.stayovers + t.arrivals) / f.board.total) * 100) : null;
  const gapToday = t.plannedMin - t.requiredMin;

  const alerts: Alert[] = [];
  if (f.board.arrivalsNotReady) alerts.push({ tone: "danger", text: `${f.board.arrivalsNotReady} Anreise-Zimmer noch nicht freigegeben`, href: "/housekeeping", action: "Zimmer" });
  for (const l of f.linen.filter((x) => x.coverage !== null && x.coverage < 3)) alerts.push({ tone: x(l.coverage!), text: `${l.name}: Lager reicht nur noch ${l.coverage === 1 ? "1 Tag" : `${l.coverage} Tage`}`, href: "/housekeeping/waesche#bestellen", action: "Bestellen" });
  for (const d of week.filter((d) => d.hasPlan && d.requiredMin - d.plannedMin >= 60)) alerts.push({ tone: "warning", text: `${weekday(d.day)} ${short(d.day)}: ${hours(d.requiredMin - d.plannedMin)} Std. Personal fehlen`, href: "/housekeeping/dienstplan", action: "Dienstplan" });
  for (const l of f.linen.filter((x) => x.deviation !== null && x.deviation >= 15)) alerts.push({ tone: "warning", text: `${l.name}: ${l.deviation} % mehr verbraucht als laut Belegung erwartet (Schwund?)`, href: "/housekeeping/waesche", action: "Ansehen" });
  const overdue = f.orders.filter((o) => o.status === "sent" && o.deliveryDay < f.today);
  if (overdue.length) alerts.push({ tone: "warning", text: `${overdue.length === 1 ? "Eine Wäschelieferung ist" : `${overdue.length} Wäschelieferungen sind`} überfällig`, href: "/housekeeping/waesche#bestellungen", action: "Ansehen" });
  if (f.planMissingDays > 7) alerts.push({ tone: "warning", text: `Für ${f.planMissingDays} der nächsten 14 Tage fehlt die Belegung; Bedarf und Personal sind dort 0`, href: "/housekeeping/belegung", action: "Eintragen" });
  const noSet = f.linen.filter((l) => !l.hasSet);
  if (noSet.length) alerts.push({ tone: "warning", text: `${noSet.map((l) => l.name).join(", ")}: kein Wäscheset hinterlegt, Bedarf unbekannt`, href: "/housekeeping/waesche#artikel", action: "Festlegen" });
  function x(c: number): Alert["tone"] { return c <= 1 ? "danger" : "warning"; }

  const empty = !f.board.total && !f.linen.length && f.planMissingDays === 14;
  if (empty) {
    return (
      <section aria-labelledby="start" className="max-w-2xl rounded-lg border border-border bg-bg p-6 shadow-card">
        <h2 id="start" className="text-lg">So startest du</h2>
        <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5">
          <li><Link className="font-semibold text-accent hover:underline" href="/housekeeping">Zimmer anlegen</Link>, mit Zimmertyp (z. B. Doppelzimmer).</li>
          <li><Link className="font-semibold text-accent hover:underline" href="/housekeeping/waesche#artikel">Wäscheartikel</Link> mit Preis und Set pro Zimmertyp anlegen und einmal zählen.</li>
          <li><Link className="font-semibold text-accent hover:underline" href="/housekeeping/belegung">Belegung</Link> der nächsten Tage eintragen oder als CSV aus dem Hotelprogramm laden.</li>
          <li><Link className="font-semibold text-accent hover:underline" href="/housekeeping/dienstplan">Dienstplan</Link> anlegen.</li>
        </ol>
        <p className="mt-3 text-sm text-text-muted">Danach zeigt diese Seite Wäschebedarf, Bestellvorschlag, Personalbedarf und Kosten.</p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="-mt-2 text-text-muted">{f.outletName}, {formatDay(f.today, "full")}{f.todayFromBoard ? " · Zahlen für heute aus der Zimmerliste" : ""}</p>

      <section aria-label="Heute" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Tile icon={BedDouble} label="Belegung heute" value={occupancy === null ? "–" : `${occupancy} %`} sub={`${t.stayovers + t.arrivals} von ${f.board.total} Zimmern`} />
        <Tile icon={LogIn} label="Anreisen" value={String(t.arrivals)} sub={f.board.arrivalsNotReady ? `${f.board.arrivalsNotReady} nicht freigegeben` : "alle freigegeben"} tone={f.board.arrivalsNotReady ? "danger" : "success"} />
        <Tile icon={LogOut} label="Abreisen" value={String(t.departures)} sub="Komplettwechsel" />
        <Tile icon={CalendarDays} label="Bleiber" value={String(t.stayovers)} sub={`Bett alle ${f.settings.bedEveryDays} Tage`} />
        <Tile icon={Clock} label="Personal heute" value={`${hours(t.plannedMin)} Std.`} sub={gapToday >= 0 ? `geplant, benötigt ${hours(t.requiredMin)}` : `benötigt ${hours(t.requiredMin)}, ${hours(-gapToday)} fehlen`} tone={gapToday >= 0 ? "success" : "danger"} />
        <Tile icon={Coins} label="Wäsche pro Zimmernacht" value={f.cost.perNightCents === null ? "–" : formatCents(f.cost.perNightCents)} sub="letzte 30 Tage, aus Zählungen" />
      </section>

      <section aria-labelledby="todo" className="rounded-lg border border-border bg-bg p-4">
        <h2 id="todo" className="text-lg">Was jetzt wichtig ist</h2>
        {alerts.length ? (
          <ul className="mt-2 flex flex-col divide-y divide-border">
            {alerts.map((a) => (
              <li key={a.text} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="flex items-start gap-2"><AlertTriangle aria-hidden className={cn("mt-0.5 size-4 shrink-0", a.tone === "danger" ? "text-danger" : "text-warning")} />{a.text}</span>
                <Link href={a.href} className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">{a.action} <ArrowRight aria-hidden className="size-4" /></Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 flex items-center gap-2 text-success"><CheckCircle2 aria-hidden className="size-4" /> Alles im grünen Bereich.</p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-label="Belegung" className="rounded-lg border border-border bg-bg p-4">
          <BarChart
            title="Zimmer der nächsten 14 Tage"
            stacked
            series={[{ key: "departures", label: "Abreisen", color: "chart-1" }, { key: "stayovers", label: "Bleiber", color: "chart-2" }, { key: "arrivals", label: "Anreisen", color: "chart-3" }]}
            columns={f.daily.map((d) => ({ label: weekday(d.day), sub: short(d.day), values: { departures: d.departures, stayovers: d.stayovers, arrivals: d.arrivals } }))}
          />
        </section>
        <section aria-label="Personal" className="rounded-lg border border-border bg-bg p-4">
          <BarChart
            title="Personal: benötigt und geplant (Stunden)"
            series={[{ key: "required", label: "Benötigt", color: "chart-1" }, { key: "planned", label: "Geplant", color: "chart-3" }]}
            columns={f.daily.map((d) => ({ label: weekday(d.day), sub: short(d.day), values: { required: d.requiredMin / 60, planned: d.plannedMin / 60 } }))}
            decimals={1}
            unit=" Std."
          />
          <p className="mt-2 text-xs text-text-muted">Benötigt: {f.settings.minutesDeparture} Min. je Abreise, {f.settings.minutesStayover} je Bleiber, {f.settings.minutesArrival} je Anreise (änderbar unter Wäsche → Einstellungen).</p>
        </section>
      </div>

      <section aria-labelledby="linen" className="rounded-lg border border-border bg-bg p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="linen" className="flex items-center gap-2 text-lg"><Shirt aria-hidden className="size-5 text-accent" /> Wäsche</h2>
          <Link href="/housekeeping/waesche#bestellen" className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">Bestellung aus Vorschlag <ArrowRight aria-hidden className="size-4" /></Link>
        </div>
        {f.linen.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="text-left text-xs text-text-muted">
                <tr><th scope="col" className="py-2 font-normal">Artikel</th><th scope="col" className="text-right font-normal">Sauber im Lager</th><th scope="col" className="text-right font-normal">Bedarf 7 Tage</th><th scope="col" className="text-right font-normal">Reicht für</th><th scope="col" className="text-right font-normal">Unterwegs</th><th scope="col" className="text-right font-normal">Vorschlag ({f.settings.coverDays} Tage)</th><th scope="col" className="text-right font-normal">Kosten 7 Tage</th></tr>
              </thead>
              <tbody>
                {f.linen.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <th scope="row" className="py-2 text-left font-semibold">{l.name} <span className="font-normal text-text-muted">· {KIND_LABEL[l.kind]}</span></th>
                    <td className="num text-right">{l.stockClean}</td>
                    <td className="num text-right">{l.hasSet ? l.weekNeed : "–"}</td>
                    <td className="text-right">
                      {l.coverage === null ? "–" : (
                        <span className={cn("inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-semibold", l.coverage < 2 ? "bg-danger-subtle text-danger" : l.coverage < f.settings.coverDays ? "bg-warning-subtle text-warning" : "bg-success-subtle text-success")}>
                          {l.coverage < 2 && <AlertTriangle aria-hidden className="size-3" />}{l.coverage} {l.coverage === 1 ? "Tag" : "Tage"}
                        </span>
                      )}
                    </td>
                    <td className="num text-right">{l.incoming || "–"}</td>
                    <td className="num text-right font-semibold">{l.proposal || "–"}</td>
                    <td className="num text-right">{formatCents(l.plannedWeekCostCents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t-2 border-border font-semibold"><th scope="row" className="py-2 text-left">Summe</th><td colSpan={5} /><td className="num text-right">{formatCents(f.cost.weekPlannedCents)}</td></tr></tfoot>
            </table>
          </div>
        ) : <p className="mt-2 text-text-muted">Noch keine Wäscheartikel. <Link className="font-semibold text-accent hover:underline" href="/housekeeping/waesche#artikel">Jetzt anlegen</Link></p>}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="cost" className="rounded-lg border border-border bg-bg p-4">
          <h2 id="cost" className="flex items-center gap-2 text-lg"><Coins aria-hidden className="size-5 text-accent" /> Kosten der letzten 30 Tage</h2>
          <dl className="mt-3 grid grid-cols-2 gap-4">
            <div><dt className="text-xs text-text-muted">Wäsche verbraucht (Wert)</dt><dd className="num text-lg">{formatCents(f.cost.usedCents)}</dd></div>
            <div><dt className="text-xs text-text-muted">Pro belegte Zimmernacht</dt><dd className="num text-lg">{f.cost.perNightCents === null ? "–" : formatCents(f.cost.perNightCents)}</dd></div>
            <div><dt className="text-xs text-text-muted">Lieferungen (Wert)</dt><dd className="num text-lg">{formatCents(f.cost.receivedCents)}</dd></div>
            <div><dt className="text-xs text-text-muted">Belegte Zimmernächte</dt><dd className="num text-lg">{f.cost.nights}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-text-muted">Verbrauch = erwarteter Bestand − gezählter Bestand, je Zählung. Zimmernächte aus der Belegung.</p>
        </section>
        <section aria-labelledby="rooms" className="rounded-lg border border-border bg-bg p-4">
          <h2 id="rooms" className="flex items-center gap-2 text-lg"><Users aria-hidden className="size-5 text-accent" /> Zimmer jetzt</h2>
          {f.board.total ? (
            <>
              <div aria-hidden className="mt-3 flex h-3 overflow-hidden rounded-pill bg-surface-sunken">
                <div className="bg-success" style={{ width: `${(f.board.inspected / f.board.total) * 100}%` }} />
                <div className="bg-info" style={{ width: `${(f.board.clean / f.board.total) * 100}%` }} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[["Kontrolliert", f.board.inspected], ["Gereinigt", f.board.clean], ["Schmutzig", f.board.dirty], ["Gesperrt", f.board.outOfOrder]].map(([k, v]) => (
                  <div key={k}><dt className="text-xs text-text-muted">{k}</dt><dd className="num text-lg">{v}</dd></div>
                ))}
              </dl>
              <Link href="/housekeeping" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">Zur Zimmerliste <ArrowRight aria-hidden className="size-4" /></Link>
            </>
          ) : <p className="mt-2 text-text-muted">Noch keine Zimmer angelegt.</p>}
        </section>
      </div>
    </div>
  );
}
