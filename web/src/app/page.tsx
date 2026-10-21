import { ArrowRight, Check, ClipboardCheck, CookingPot, Receipt, ReceiptText, ScanBarcode, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { LeadForm, ViewBeacon } from "@/components/landing/lead-form";
import { APP_NAME } from "@/lib/brand";
import { formatCents } from "@/lib/format";
import { LAUNCH_MODE } from "@/lib/launch";
import { PRICE_TAX_NOTE } from "@/lib/legal";
import { PRICING } from "@/lib/pricing";
import shot from "../../public/landing/rezept-kalkulation.png";

// Public landing page. Static: no session lookup, so it is fast and cacheable.
// Copy follows replica/brand.md (voice) and replica/launch/landing.md. No testimonials, logos or user
// counts until there are real ones.

const cta = "inline-flex h-(--size-control-lg) items-center gap-2 rounded-sm bg-accent px-6 text-base font-semibold text-on-accent hover:bg-accent-hover";
const ctaSecondary = "inline-flex h-(--size-control-lg) items-center rounded-sm border border-border-input bg-bg px-6 text-base font-semibold hover:bg-row-hover";

const STEPS = [
  { title: "Einkauf erfassen", body: "Zutaten so anlegen, wie dein Lieferant sie verkauft – Karton, Sack, Flasche – mit dem Preis von der Rechnung." },
  { title: "Rezepte bauen", body: `Zutaten und Grundrezepte eintragen. ${APP_NAME} rechnet Gramm, Liter und Stück um und zeigt beim Tippen, was ein Teller kostet.` },
  { title: "Bestellen und zählen", body: "Bestellungen gehen per Mail an den Lieferanten, Lieferungen und Inventur laufen über dasselbe Lager." },
];

const FEATURES = [
  { icon: Receipt, title: "Wareneinsatz beim Tippen", body: "Kosten pro Portion, Wareneinsatz in Prozent und Rohertrag stehen neben dem Rezept, während du es schreibst. Ändert sich ein Einkaufspreis, rechnet jedes Rezept mit, auch über Grundrezepte hinweg." },
  { icon: CookingPot, title: "Zentralküche mit Plan", body: "Standorte fordern Rezepte an, die Zentralküche sieht pro Liefertag, was zu kochen ist und welche Rohware fehlt. Produzieren bucht die Rohware aus und schreibt jedem Standort seine Kosten zu." },
  { icon: ScanBarcode, title: "Inventur, die ein Funkloch übersteht", body: `Zählen in Kartons plus Rest oder per Barcode-Scanner. Jede Zahl wird sofort zwischengespeichert; fällt im Kühlhaus das Netz weg, speichert ${APP_NAME} nach, sobald es zurück ist.` },
  { icon: ReceiptText, title: "Rechnung gegen Lieferung", body: "Jede Rechnungszeile steht neben Bestellung und Wareneingang. Abweichungen bei Menge und Preis sind markiert, freigeben lässt sich eine abweichende Rechnung nur mit Begründung." },
  { icon: ClipboardCheck, title: "HACCP im Grundpreis", body: "Eigene Checklisten mit Grenzwerten, Tageskontrolle pro Standort, Abweichungen nur mit Maßnahme. Das Protokoll der letzten 30 Tage geht als CSV an die Lebensmittelkontrolle." },
  { icon: ShieldCheck, title: "Fehler, bevor sie Geld kosten", body: "„2.5“ und „2,5“ ergeben dieselbe Menge, eine Bestellung kommt auch bei Doppelklick nur einmal an, und eine ungeprüfte Zutat macht ein Gericht „unbekannt“, nie „allergenfrei“." },
];

const FAQ = [
  { q: "Kann ich meine Zutaten und Preise importieren?", a: `Ja. Die Preisliste deines Lieferanten als Excel- oder CSV-Datei hochladen: ${APP_NAME} zeigt vor dem Übernehmen jede Zeile als neu, geändert oder fehlerhaft. Übernommen wird erst, wenn du zustimmst.` },
  { q: `Funktioniert ${APP_NAME} mit meiner Kasse?`, a: "Über eine Datei oder eine Schnittstelle: Verkäufe als CSV hochladen oder von der Kasse per API senden lassen. Verknüpfte Gerichte werden über ihre Rezepte vom Lager abgebucht, Stornos zurückgebucht. Fertige Anbindungen an einzelne Kassenhersteller gibt es nicht." },
  { q: "Brauche ich für HACCP oder die Zentralküche ein Zusatzmodul?", a: "Nein. Alle Funktionen sind in jedem Tarif enthalten. Bezahlt wird nur pro Standort." },
  { q: "Wer haftet für die Allergenangaben?", a: `${APP_NAME} rechnet aus deinen Angaben, die Kennzeichnung gegenüber Gästen verantwortet dein Betrieb. Deshalb zeigt ${APP_NAME} ungeprüfte Zutaten offen an, statt sie als allergenfrei durchzuwinken.` },
  { q: "Wo liegen meine Daten?", a: "In der EU (Frankfurt). Zahlungen laufen über Stripe; deine Kartendaten sehen wir nie." },
  { q: "Was passiert nach der Testphase?", a: "Drei Tage vorher bekommst du eine E-Mail. Schließt du kein Abo ab, bleiben alle Daten erhalten: Du kannst sie ansehen und als Datei herunterladen, nur ändern geht erst wieder mit einem Abo. Es verlängert sich nichts automatisch." },
  { q: "Wie kündige ich?", a: "Mit einem Klick unter Einstellungen → Abo & Rechnungen, ohne Anruf und ohne Formular. Das Abo läuft bis zum Ende des bereits bezahlten Zeitraums und endet dann." },
  { q: "Brauche ich eine App?", a: `Nein. ${APP_NAME} läuft im Browser auf Computer, Tablet und Handy. Inventur und Wareneingang sind für das Handy gebaut, ein Barcode-Scanner mit Tastatur-Modus funktioniert ohne Einrichtung.` },
];

const eur = (cents: number) => formatCents(cents).replace(",00", "");
const waitlist = LAUNCH_MODE === "waitlist";
const mainCta = waitlist ? { href: "#anfrage", label: "Vorführung anfragen" } : { href: "/signup", label: `${PRICING.trialDays} Tage kostenlos testen` };

export default function LandingPage() {
  return (
    <div className="bg-bg">
      <ViewBeacon />
      <header className="mx-auto flex max-w-(--size-content-max) items-center justify-between px-4 py-4 lg:px-8">
        <span className="text-lg font-semibold">{APP_NAME}</span>
        <nav aria-label="Konto" className="flex items-center gap-4">
          <Link href="/login" className="font-semibold hover:underline">Anmelden</Link>
          <Link href={waitlist ? "#anfrage" : "/signup"} className="hidden h-(--size-control-md) items-center rounded-sm bg-accent px-4 font-semibold text-on-accent hover:bg-accent-hover sm:inline-flex">
            {waitlist ? "Vorführung anfragen" : "Kostenlos testen"}
          </Link>
        </nav>
      </header>

      <main>
        <section aria-labelledby="hero" className="mx-auto grid max-w-(--size-content-max) items-center gap-12 px-4 pt-12 pb-16 lg:grid-cols-[5fr_7fr] lg:px-8 lg:pt-20">
          <div>
            <h1 id="hero" className="text-display">Was jeder Teller kostet. Live.</h1>
            <p className="mt-4 max-w-xl text-base text-text-muted">
              Für Küchen mit einem oder mehreren Standorten: Rezepte, Einkauf, Lager und Zentralküche in einem Werkzeug –
              und der Wareneinsatz stimmt, auch wenn sich Preise jede Woche ändern.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={mainCta.href} className={cta}>{mainCta.label} <ArrowRight aria-hidden className="size-4" /></Link>
              <a href={waitlist ? "#preise" : "#anfrage"} className={ctaSecondary}>{waitlist ? "Preise" : "Vorführung anfragen"}</a>
            </div>
            <p className="mt-3 text-xs font-normal text-text-muted">{waitlist ? "30 Minuten mit deinen eigenen Rezepten. Unverbindlich." : "Ohne Kreditkarte. Kündigen mit einem Klick."}</p>
          </div>
          <figure className="overflow-hidden rounded-lg border border-border shadow-pop">
            <Image src={shot} alt={`Rezept „Linsensuppe“ in ${APP_NAME}: Zutatenzeilen mit Kosten, daneben Wareneinsatz pro Portion 0,63 € und 8,5 % Wareneinsatz.`} priority placeholder="blur" sizes="(min-width: 1024px) 58vw, 100vw" />
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
          <p className="mt-2 text-text-muted">Alle Funktionen in jedem Tarif. Beliebig viele Nutzer. {PRICE_TAX_NOTE}</p>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-border p-6">
              <h3 className="text-lg">Eine Küche</h3>
              <p className="mt-1 text-text-muted">Für das Restaurant, das Café, den Imbiss.</p>
              <p className="num mt-4 text-xl">{eur(PRICING.firstOutletMonthly)} <span className="text-sm font-normal text-text-muted">pro Monat</span></p>
              <p className="text-xs font-normal text-text-muted">oder {eur(PRICING.firstOutletYearly)} pro Jahr (2 Monate geschenkt)</p>
              <ul className="mt-4 flex flex-col gap-2">
                {["1 Standort", "Unbegrenzt Zutaten, Rezepte, Bestellungen", "Inventur, Rechnungsabgleich, HACCP", "Beliebig viele Nutzer", "Kündigen mit einem Klick"].map((x) => (
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
                {["Eigener Bestand und eigene Bestellungen je Standort", "Gemeinsame Rezepte und Zutaten", "Zentralküche: Anforderungen und Produktionsplan", "Teammitglieder nur für ihren Standort", "Abgerechnet wird, was angelegt ist – keine Sprünge"].map((x) => (
                  <li key={x} className="flex gap-2"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />{x}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-4 text-xs font-normal text-text-muted">Beispiel: drei Standorte = {eur(PRICING.firstOutletMonthly + 2 * PRICING.extraOutletMonthly)} pro Monat.</p>
        </section>

        <section id="anfrage" aria-labelledby="lead" className="mx-auto grid max-w-(--size-content-max) gap-8 px-4 py-16 lg:grid-cols-[5fr_7fr] lg:px-8">
          <div>
            <h2 id="lead" className="text-xl">Zeig uns dein teuerstes Gericht</h2>
            <p className="mt-2 text-text-muted">
              In einer halben Stunde legen wir zusammen deine wichtigsten Zutaten und ein Rezept an, und du siehst, was der Teller
              wirklich kostet. Für einen oder viele Standorte, mit oder ohne Zentralküche.
            </p>
          </div>
          <LeadForm appName={APP_NAME} />
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
          <div className="mt-8 flex justify-center"><Link href={mainCta.href} className={cta}>{mainCta.label} <ArrowRight aria-hidden className="size-4" /></Link></div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-(--size-content-max) flex-wrap justify-between gap-4 px-4 py-6 text-xs font-normal text-text-muted lg:px-8">
          <span>© {APP_NAME}</span>
          <nav aria-label="Rechtliches" className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/legal/privacy" className="hover:underline">Datenschutz</Link>
            <Link href="/legal/terms" className="hover:underline">Nutzungsbedingungen</Link>
            <Link href="/legal/dpa" className="hover:underline">Auftragsverarbeitung</Link>
            <Link href="/legal/imprint" className="hover:underline">Impressum</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
