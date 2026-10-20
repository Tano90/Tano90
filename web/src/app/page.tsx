import { ArrowRight, Check, ClipboardList, Receipt, ShieldCheck, Truck, WifiOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { APP_NAME } from "@/lib/brand";
import { formatCents } from "@/lib/format";
import { PRICING } from "@/lib/pricing";
import shot from "../../public/landing/rezept-kalkulation.png";

// Public landing page. Static: no session lookup, so it is fast and cacheable.
// Copy follows replica/brand.md (voice) and replica/launch/landing.md. No testimonials, logos or user
// counts until there are real ones.

const cta = "inline-flex h-(--size-control-lg) items-center gap-2 rounded-sm bg-accent px-6 text-base font-semibold text-on-accent hover:bg-accent-hover";
const ctaSecondary = "inline-flex h-(--size-control-lg) items-center rounded-sm border border-border-input bg-bg px-6 text-base font-semibold hover:bg-row-hover";

const STEPS = [
  { title: "Einkauf erfassen", body: "Zutaten so anlegen, wie dein Lieferant sie verkauft – Karton, Sack, Flasche – mit dem Preis von der Rechnung." },
  { title: "Rezepte bauen", body: "Zutaten und Grundrezepte eintragen. Pantra rechnet Gramm, Liter und Stück um und zeigt beim Tippen, was ein Teller kostet." },
  { title: "Bestellen und zählen", body: "Bestellungen gehen per Mail an den Lieferanten, Lieferungen und Inventur laufen über dasselbe Lager." },
];

const FEATURES = [
  { icon: Receipt, title: "Wareneinsatz beim Tippen", body: "Kosten pro Portion, Wareneinsatz in Prozent und Rohertrag stehen neben dem Rezept, während du es schreibst. Ändert sich ein Einkaufspreis, rechnet jedes Rezept mit, auch über Grundrezepte hinweg." },
  { icon: ShieldCheck, title: "Allergene, die nichts schönrechnen", body: "Eine Zutat ohne geprüfte Allergene macht das Gericht „unbekannt“, nie „frei“. Fehlt ein Preis oder ein Stückgewicht, steht an der Zeile, was genau fehlt." },
  { icon: Truck, title: "Bestellung genau einmal beim Lieferanten", body: "Vorschlag aus Mindestbestand und offenen Bestellungen, Versand per Mail. Auch bei Doppelklick oder zwei offenen Tabs kommt beim Lieferanten nur eine Bestellung an." },
  { icon: ClipboardList, title: "Wareneingang in zwei Klicks", body: "Bestellte Mengen sind vorausgefüllt. Teillieferungen bleiben offen, Überlieferungen werden abgefangen statt doppelt gebucht." },
  { icon: WifiOff, title: "Inventur, die ein Funkloch übersteht", body: "Jede Zahl wird sofort zwischengespeichert. Fällt im Kühlhaus das Netz weg, zeigt Pantra das an und speichert nach, sobald es zurück ist." },
];

const FAQ = [
  { q: "Kann ich meine Zutaten und Preise importieren?", a: "Noch nicht. Ein Import per Excel ist in Arbeit. Bis dahin legst du Zutaten einzeln an; die meisten Küchen starten mit den 30 Artikeln, die sie am häufigsten kaufen." },
  { q: "Funktioniert Pantra mit meiner Kasse?", a: "Noch nicht. Eine Schnittstelle, über die Kassen Verkäufe übertragen, ist geplant. Bis dahin rechnet Pantra mit Rezepten, Einkauf und Inventur, aber ohne automatischen Abzug verkaufter Gerichte." },
  { q: "Wer haftet für die Allergenangaben?", a: "Pantra rechnet aus deinen Angaben, die Kennzeichnung gegenüber Gästen verantwortet dein Betrieb. Deshalb zeigt Pantra ungeprüfte Zutaten offen an, statt sie als allergenfrei durchzuwinken." },
  { q: "Wo liegen meine Daten?", a: "In der EU (Frankfurt). Zahlungen laufen über Stripe; deine Kartendaten sehen wir nie." },
  { q: "Wie kündige ich?", a: "Mit einem Klick unter Einstellungen → Abo & Rechnungen, ohne Anruf und ohne Formular. Das Abo läuft bis zum Ende des bereits bezahlten Zeitraums und endet dann." },
  { q: "Brauche ich eine App?", a: "Nein. Pantra läuft im Browser auf Computer, Tablet und Handy. Die Inventur ist für das Handy gebaut." },
];

const eur = (cents: number) => formatCents(cents).replace(",00", "");

export default function LandingPage() {
  return (
    <div className="bg-bg">
      <header className="mx-auto flex max-w-(--size-content-max) items-center justify-between px-4 py-4 lg:px-8">
        <span className="text-lg font-semibold">{APP_NAME}</span>
        <nav aria-label="Konto" className="flex items-center gap-4">
          <Link href="/login" className="font-semibold hover:underline">Anmelden</Link>
          <Link href="/signup" className="hidden h-(--size-control-md) items-center rounded-sm bg-accent px-4 font-semibold text-on-accent hover:bg-accent-hover sm:inline-flex">
            Kostenlos testen
          </Link>
        </nav>
      </header>

      <main>
        <section aria-labelledby="hero" className="mx-auto grid max-w-(--size-content-max) items-center gap-12 px-4 pt-12 pb-16 lg:grid-cols-[5fr_7fr] lg:px-8 lg:pt-20">
          <div>
            <h1 id="hero" className="text-display">Was jeder Teller kostet. Live.</h1>
            <p className="mt-4 max-w-xl text-base text-text-muted">
              Für Küchen mit einem oder mehreren Standorten: Rezepte, Einkaufspreise, Bestellungen und Inventur in einem Werkzeug –
              und der Wareneinsatz stimmt, auch wenn sich Preise jede Woche ändern.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className={cta}>{PRICING.trialDays} Tage kostenlos testen <ArrowRight aria-hidden className="size-4" /></Link>
              <a href="#preise" className={ctaSecondary}>Preise</a>
            </div>
            <p className="mt-3 text-xs font-normal text-text-muted">Ohne Kreditkarte. Kündigen mit einem Klick.</p>
          </div>
          <figure className="overflow-hidden rounded-lg border border-border shadow-pop">
            <Image src={shot} alt="Rezept „Linsensuppe“ in Pantra: Zutatenzeilen mit Kosten, daneben Wareneinsatz pro Portion 0,63 € und 8,5 % Wareneinsatz." priority placeholder="blur" sizes="(min-width: 1024px) 58vw, 100vw" />
            <figcaption className="sr-only">Der Rezept-Editor mit Live-Kalkulation</figcaption>
          </figure>
        </section>

        <section aria-labelledby="problem" className="bg-surface">
          <div className="mx-auto max-w-(--size-content-max) px-4 py-16 lg:px-8">
            <h2 id="problem" className="text-xl">Die Kalkulation stimmt am Tag, an dem sie gemacht wird</h2>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <p className="text-base text-text-muted">Butter wird teurer, der Lieferant ändert die Gebindegröße, ein Grundrezept bekommt eine Zutat mehr. Die Tabelle von letztem Quartal weiß davon nichts, und der Wareneinsatz auf der Karte ist eine Schätzung.</p>
              <p className="text-base text-text-muted">Einkauf, Lager und Rezepte liegen in verschiedenen Listen. Wer bestellt, sieht nicht, was noch da ist; wer zählt, weiß nicht, was seit der letzten Inventur geliefert oder weggeworfen wurde.</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="how" className="mx-auto max-w-(--size-content-max) px-4 py-16 lg:px-8">
          <h2 id="how" className="text-xl">So funktioniert es</h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span aria-hidden className="num flex size-10 items-center justify-center rounded-pill bg-accent-subtle font-semibold text-accent">{i + 1}</span>
                <h3 className="mt-3 text-lg">{s.title}</h3>
                <p className="mt-1 text-text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="features" className="bg-surface">
          <div className="mx-auto max-w-(--size-content-max) px-4 py-16 lg:px-8">
            <h2 id="features" className="text-xl">Gebaut für die Momente, in denen es sonst schiefgeht</h2>
            <ul className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <li key={title} className="rounded-md border border-border bg-surface-raised p-6">
                  <Icon aria-hidden className="size-6 text-accent" />
                  <h3 className="mt-3 text-lg">{title}</h3>
                  <p className="mt-1 text-text-muted">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="preise" aria-labelledby="pricing" className="mx-auto max-w-(--size-content-max) px-4 py-16 lg:px-8">
          <h2 id="pricing" className="text-xl">Preise</h2>
          <p className="mt-2 text-text-muted">Alle Funktionen in jedem Tarif. Beliebig viele Nutzer. Preise netto zzgl. MwSt.</p>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-border p-6">
              <h3 className="text-lg">Eine Küche</h3>
              <p className="mt-1 text-text-muted">Für das Restaurant, das Café, den Imbiss.</p>
              <p className="num mt-4 text-xl">{eur(PRICING.firstOutletMonthly)} <span className="text-sm font-normal text-text-muted">pro Monat</span></p>
              <p className="text-xs font-normal text-text-muted">oder {eur(PRICING.firstOutletYearly)} pro Jahr (2 Monate geschenkt)</p>
              <ul className="mt-4 flex flex-col gap-2">
                {["1 Standort", "Unbegrenzt Zutaten, Rezepte, Bestellungen", "Beliebig viele Nutzer", "Kündigen mit einem Klick"].map((x) => (
                  <li key={x} className="flex gap-2"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />{x}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border-2 border-accent p-6">
              <h3 className="text-lg">Mehrere Küchen</h3>
              <p className="mt-1 text-text-muted">Für Gruppen, Filialen und Zentralküchen.</p>
              <p className="num mt-4 text-xl">+ {eur(PRICING.extraOutletMonthly)} <span className="text-sm font-normal text-text-muted">pro weiterem Standort und Monat</span></p>
              <p className="text-xs font-normal text-text-muted">oder {eur(PRICING.extraOutletYearly)} pro Jahr und Standort</p>
              <ul className="mt-4 flex flex-col gap-2">
                {["Eigener Bestand und eigene Bestellungen je Standort", "Gemeinsame Rezepte und Zutaten", "Teammitglieder nur für ihren Standort", "Abgerechnet wird, was angelegt ist – keine Sprünge"].map((x) => (
                  <li key={x} className="flex gap-2"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />{x}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-4 text-xs font-normal text-text-muted">Beispiel: drei Standorte = {eur(PRICING.firstOutletMonthly + 2 * PRICING.extraOutletMonthly)} pro Monat.</p>
        </section>

        <section aria-labelledby="faq" className="bg-surface">
          <div className="mx-auto max-w-(--size-form-max) px-4 py-16">
            <h2 id="faq" className="text-xl">Häufige Fragen</h2>
            <div className="mt-6 flex flex-col divide-y divide-border rounded-md border border-border bg-surface-raised">
              {FAQ.map(({ q, a }) => (
                <details key={q} className="group px-4 py-3">
                  <summary className="cursor-pointer list-none font-semibold marker:hidden">{q}</summary>
                  <p className="mt-2 text-text-muted">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="final" className="mx-auto max-w-(--size-content-max) px-4 py-20 text-center lg:px-8">
          <h2 id="final" className="text-xl">Leg dein teuerstes Gericht an und sieh, was es wirklich kostet.</h2>
          <div className="mt-8 flex justify-center"><Link href="/signup" className={cta}>{PRICING.trialDays} Tage kostenlos testen <ArrowRight aria-hidden className="size-4" /></Link></div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-(--size-content-max) flex-wrap justify-between gap-4 px-4 py-6 text-xs font-normal text-text-muted lg:px-8">
          <span>© {APP_NAME}</span>
          <nav aria-label="Rechtliches" className="flex gap-4">
            <Link href="/legal/privacy" className="hover:underline">Datenschutz</Link>
            <Link href="/legal/terms" className="hover:underline">Nutzungsbedingungen</Link>
            <Link href="/legal/imprint" className="hover:underline">Impressum</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
