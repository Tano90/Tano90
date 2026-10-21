import { ArrowRight, Check, ClipboardCheck, CookingPot, Plus, Receipt, ReceiptText, ScanBarcode, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LeadForm, ViewBeacon } from "@/components/landing/lead-form";
import { LiveCalc } from "@/components/landing/live-calc";
import { APP_NAME } from "@/lib/brand";
import { formatCents } from "@/lib/format";
import { LAUNCH_MODE } from "@/lib/launch";
import { PRICE_TAX_NOTE } from "@/lib/legal";
import { PRICING } from "@/lib/pricing";
import shot from "../../public/landing/rezept-kalkulation.png";

// Public landing page. Static: no session lookup, so it is fast and cacheable.
// Copy follows replica/brand.md (voice) and replica/launch/landing.md. No testimonials, logos or user
// counts until there are real ones.

const cta = "inline-flex h-(--size-control-lg) items-center gap-2 rounded-pill bg-saffron px-6 text-base font-bold text-on-saffron transition-transform duration-fast hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron";
const ctaGhost = "inline-flex h-(--size-control-lg) items-center rounded-pill border border-on-ink-muted px-6 text-base font-semibold text-on-ink hover:bg-ink-raised";
const TICKER = ["Wareneinsatz live", "Grundrezepte", "Allergene", "Inventur offline", "Barcode-Scanner", "Zentralküche", "Rechnungsabgleich", "HACCP", "Kassen-Import", "Mindestbestand", "Lagerbericht", "Mehrere Standorte"];

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

      {/* ------------------------------------------------ stage */}
      <div className="relative overflow-hidden bg-ink text-on-ink">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_60%_at_80%_10%,var(--color-accent)_0%,transparent_70%)] opacity-70" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(40%_40%_at_0%_100%,var(--color-accent-hover)_0%,transparent_70%)] opacity-60" />
        <header className="relative mx-auto flex max-w-(--size-content-max) items-center justify-between px-4 py-5 lg:px-8">
          <Link href="/" aria-label={`${APP_NAME} Startseite`}><Logo tone="light" /></Link>
          <nav aria-label="Konto" className="flex items-center gap-5">
            <a href="#funktionen" className="hidden font-semibold text-on-ink-muted hover:text-on-ink md:inline">Funktionen</a>
            <a href="#preise" className="hidden font-semibold text-on-ink-muted hover:text-on-ink md:inline">Preise</a>
            <Link href="/login" className="font-semibold hover:underline">Anmelden</Link>
            <Link href={waitlist ? "#anfrage" : "/signup"} className="hidden h-(--size-control-md) items-center rounded-pill bg-saffron px-4 font-bold text-on-saffron sm:inline-flex">
              {waitlist ? "Vorführung anfragen" : "Kostenlos testen"}
            </Link>
          </nav>
        </header>

        <section aria-labelledby="hero" className="relative mx-auto grid max-w-(--size-content-max) items-center gap-12 px-4 pt-10 pb-20 lg:grid-cols-[6fr_5fr] lg:px-8 lg:pt-16 lg:pb-28">
          <div className="animate-rise">
            <p className="mb-4 inline-flex items-center gap-2 rounded-pill border border-ink-raised bg-ink-raised px-3 py-1 text-xs text-on-ink-muted">
              <span aria-hidden className="size-2 rounded-pill bg-saffron" /> Für Küchen mit einem oder vielen Standorten
            </p>
            <h1 id="hero" className="text-display lg:text-hero">
              Was jeder Teller kostet. <span className="relative whitespace-nowrap text-saffron">Live.<span aria-hidden className="absolute -bottom-1 left-0 h-1 w-full rounded-pill bg-saffron/60" /></span>
            </h1>
            <p className="mt-6 max-w-xl text-base text-on-ink-muted lg:text-lg lg:font-normal">
              Rezepte, Einkauf, Lager und Zentralküche in einem Werkzeug. Ändert sich ein Einkaufspreis, rechnet jedes Rezept mit.
              Probier es aus: Zieh am Regler.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={mainCta.href} className={cta}>{mainCta.label} <ArrowRight aria-hidden className="size-4" /></Link>
              <a href={waitlist ? "#preise" : "#anfrage"} className={ctaGhost}>{waitlist ? "Preise ansehen" : "Vorführung anfragen"}</a>
            </div>
            <p className="mt-4 text-xs font-normal text-on-ink-muted">{waitlist ? "30 Minuten mit deinen eigenen Rezepten. Unverbindlich." : "Ohne Kreditkarte. Kündigen mit einem Klick."}</p>
          </div>
          <div className="relative animate-rise [animation-delay:150ms]">
            <div aria-hidden className="absolute -top-6 -left-6 size-12 animate-wobble rounded-md bg-saffron/90" />
            <div aria-hidden className="absolute -right-4 -bottom-5 size-8 animate-wobble rounded-sm bg-accent-glow [animation-delay:1s]" />
            <LiveCalc />
          </div>
        </section>

        <div aria-hidden className="relative overflow-hidden border-y border-ink-raised py-4">
          <div className="flex w-max animate-marquee gap-10 whitespace-nowrap text-sm font-semibold text-on-ink-muted">
            {[...TICKER, ...TICKER].map((t, i) => <span key={i} className="flex items-center gap-10">{t}<span className="size-1.5 rounded-pill bg-saffron" /></span>)}
          </div>
        </div>
      </div>

      <main>
        {/* ------------------------------------------------ problem */}
        <section aria-labelledby="problem" className="mx-auto max-w-(--size-content-max) px-4 py-20 lg:px-8">
          <p className="text-sm font-bold uppercase tracking-wide text-accent">Das Problem</p>
          <h2 id="problem" className="mt-2 max-w-3xl text-xl lg:text-display">Die Kalkulation stimmt am Tag, an dem sie gemacht wird</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <p className="rounded-lg border border-border bg-surface p-6 text-base text-text-muted">Butter wird teurer, der Lieferant ändert die Gebindegröße, ein Grundrezept bekommt eine Zutat mehr. Die Tabelle von letztem Quartal weiß davon nichts, und der Wareneinsatz auf der Karte ist eine Schätzung.</p>
            <p className="rounded-lg border border-border bg-surface p-6 text-base text-text-muted">Einkauf, Lager und Rezepte liegen in verschiedenen Listen. Wer bestellt, sieht nicht, was noch da ist; wer zählt, weiß nicht, was seit der letzten Inventur geliefert oder weggeworfen wurde.</p>
          </div>
        </section>

        {/* ------------------------------------------------ how */}
        <section aria-labelledby="how" className="bg-surface">
          <div className="mx-auto max-w-(--size-content-max) px-4 py-20 lg:px-8">
            <p className="text-sm font-bold uppercase tracking-wide text-accent">So funktioniert es</p>
            <h2 id="how" className="mt-2 text-xl lg:text-display">In drei Schritten zum echten Wareneinsatz</h2>
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative rounded-lg border border-border bg-bg p-6 shadow-card">
                  <span aria-hidden className="num text-display text-accent">0{i + 1}</span>
                  <h3 className="mt-2 text-lg">{s.title}</h3>
                  <p className="mt-1 text-text-muted">{s.body}</p>
                </li>
              ))}
            </ol>
            <figure className="mt-12 overflow-hidden rounded-lg border border-border shadow-pop">
              <Image src={shot} alt={`Rezept „Linsensuppe“ in ${APP_NAME}: Zutatenzeilen mit Kosten, daneben Wareneinsatz pro Portion 0,63 € und 8,5 % Wareneinsatz.`} placeholder="blur" sizes="(min-width: 1280px) 1200px, 100vw" />
              <figcaption className="bg-bg px-4 py-3 text-sm text-text-muted">So sieht ein Rezept in {APP_NAME} aus: Kosten pro Zeile, rechts der Wareneinsatz, während du tippst.</figcaption>
            </figure>
          </div>
        </section>

        {/* ------------------------------------------------ features */}
        <section id="funktionen" aria-labelledby="features" className="mx-auto max-w-(--size-content-max) px-4 py-20 lg:px-8">
          <p className="text-sm font-bold uppercase tracking-wide text-accent">Funktionen</p>
          <h2 id="features" className="mt-2 max-w-3xl text-xl lg:text-display">Gebaut für die Momente, in denen es sonst schiefgeht</h2>
          <ul className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className={i === 0 ? "rounded-lg bg-ink p-7 text-on-ink md:col-span-2 lg:row-span-2 lg:p-9" : "rounded-lg border border-border bg-surface p-6 transition-transform duration-base hover:-translate-y-1"}>
                <span className={i === 0 ? "inline-flex size-12 items-center justify-center rounded-md bg-saffron text-on-saffron" : "inline-flex size-10 items-center justify-center rounded-md bg-accent-subtle text-accent"}>
                  <Icon aria-hidden className={i === 0 ? "size-6" : "size-5"} />
                </span>
                <h3 className={i === 0 ? "mt-5 text-xl" : "mt-4 text-lg"}>{title}</h3>
                <p className={i === 0 ? "mt-2 max-w-xl text-base text-on-ink-muted" : "mt-1 text-text-muted"}>{body}</p>
                {i === 0 && (
                  <div aria-hidden className="mt-8 grid max-w-md grid-cols-3 gap-3 text-sm" title="Beispiel">
                    {[["Butter", "+12 %"], ["Pasta", "0,94 €"], ["Fond", "−0,08 €"]].map(([a, b]) => (
                      <div key={a} className="rounded-md bg-ink-raised p-3"><p className="text-on-ink-muted">{a}</p><p className="num text-lg text-saffron">{b}</p></div>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------------------------ pricing */}
        <section id="preise" aria-labelledby="pricing" className="bg-surface">
          <div className="mx-auto max-w-(--size-content-max) px-4 py-20 lg:px-8">
            <h2 id="pricing" className="text-xl lg:text-display">Preise</h2>
            <p className="mt-2 text-text-muted">Alle Funktionen in jedem Tarif. Beliebig viele Nutzer. {PRICE_TAX_NOTE}</p>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-bg p-8">
                <h3 className="text-lg">Eine Küche</h3>
                <p className="mt-1 text-text-muted">Für das Restaurant, das Café, den Imbiss.</p>
                <p className="num mt-6 text-display">{eur(PRICING.firstOutletMonthly)} <span className="text-sm font-normal text-text-muted">pro Monat</span></p>
                <p className="text-xs font-normal text-text-muted">oder {eur(PRICING.firstOutletYearly)} pro Jahr (2 Monate geschenkt)</p>
                <ul className="mt-6 flex flex-col gap-2">
                  {["1 Standort", "Unbegrenzt Zutaten, Rezepte, Bestellungen", "Inventur, Rechnungsabgleich, HACCP", "Beliebig viele Nutzer", "Kündigen mit einem Klick"].map((x) => (
                    <li key={x} className="flex gap-2"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />{x}</li>
                  ))}
                </ul>
              </div>
              <div className="relative rounded-lg bg-ink p-8 text-on-ink shadow-glow">
                <span className="absolute -top-3 right-6 rounded-pill bg-saffron px-3 py-1 text-xs font-bold text-on-saffron">für Gruppen</span>
                <h3 className="text-lg">Mehrere Küchen</h3>
                <p className="mt-1 text-on-ink-muted">Für Gruppen, Filialen und Zentralküchen.</p>
                <p className="num mt-6 text-display">+ {eur(PRICING.extraOutletMonthly)} <span className="text-sm font-normal text-on-ink-muted">pro weiterem Standort und Monat</span></p>
                <p className="text-xs font-normal text-on-ink-muted">oder {eur(PRICING.extraOutletYearly)} pro Jahr und Standort</p>
                <ul className="mt-6 flex flex-col gap-2">
                  {["Eigener Bestand und eigene Bestellungen je Standort", "Gemeinsame Rezepte und Zutaten", "Zentralküche: Anforderungen und Produktionsplan", "Teammitglieder nur für ihren Standort", "Abgerechnet wird, was angelegt ist – keine Sprünge"].map((x) => (
                    <li key={x} className="flex gap-2"><Plus aria-hidden className="mt-0.5 size-4 shrink-0 text-saffron" />{x}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-4 text-xs font-normal text-text-muted">Beispiel: drei Standorte = {eur(PRICING.firstOutletMonthly + 2 * PRICING.extraOutletMonthly)} pro Monat.</p>
          </div>
        </section>

        {/* ------------------------------------------------ inquiry */}
        <section id="anfrage" aria-labelledby="lead" className="mx-auto max-w-(--size-content-max) px-4 py-20 lg:px-8">
          <div className="grid gap-10 rounded-lg border border-border bg-bg p-6 shadow-pop lg:grid-cols-[5fr_7fr] lg:p-10">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-accent">Vorführung</p>
              <h2 id="lead" className="mt-2 text-xl lg:text-display">Zeig uns dein teuerstes Gericht</h2>
              <p className="mt-3 text-text-muted">
                In einer halben Stunde legen wir zusammen deine wichtigsten Zutaten und ein Rezept an, und du siehst, was der Teller
                wirklich kostet. Für einen oder viele Standorte, mit oder ohne Zentralküche.
              </p>
              <ul className="mt-6 flex flex-col gap-2 text-sm">
                {["30 Minuten, per Video oder bei euch", "Mit euren echten Einkaufspreisen", "Kostenlos und unverbindlich"].map((x) => (
                  <li key={x} className="flex gap-2"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />{x}</li>
                ))}
              </ul>
            </div>
            <LeadForm appName={APP_NAME} />
          </div>
        </section>

        {/* ------------------------------------------------ faq */}
        <section aria-labelledby="faq" className="bg-surface">
          <div className="mx-auto max-w-(--size-form-max) px-4 py-20">
            <h2 id="faq" className="text-xl">Häufige Fragen</h2>
            <div className="mt-6 flex flex-col gap-3">
              {FAQ.map(({ q, a }) => (
                <details key={q} className="group rounded-md border border-border bg-bg px-5 py-4 open:shadow-card">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold marker:hidden">
                    {q}<Plus aria-hidden className="size-4 shrink-0 text-accent transition-transform duration-base group-open:rotate-45" />
                  </summary>
                  <p className="mt-2 text-text-muted">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ final */}
        <section aria-labelledby="final" className="relative overflow-hidden bg-ink text-on-ink">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_120%,var(--color-accent)_0%,transparent_70%)]" />
          <div className="relative mx-auto max-w-(--size-content-max) px-4 py-24 text-center lg:px-8">
            <h2 id="final" className="mx-auto max-w-3xl text-xl lg:text-display">Leg dein teuerstes Gericht an und sieh, was es wirklich kostet.</h2>
            <div className="mt-8 flex justify-center"><Link href={mainCta.href} className={cta}>{mainCta.label} <ArrowRight aria-hidden className="size-4" /></Link></div>
          </div>
        </section>
      </main>

      <footer className="bg-ink text-on-ink-muted">
        <div className="mx-auto flex max-w-(--size-content-max) flex-wrap items-center justify-between gap-4 border-t border-ink-raised px-4 py-8 text-xs font-normal lg:px-8">
          <span className="flex items-center gap-3"><Logo tone="light" /> <span>© {APP_NAME}</span></span>
          <nav aria-label="Rechtliches" className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/legal/privacy" className="hover:text-on-ink hover:underline">Datenschutz</Link>
            <Link href="/legal/terms" className="hover:text-on-ink hover:underline">Nutzungsbedingungen</Link>
            <Link href="/legal/dpa" className="hover:text-on-ink hover:underline">Auftragsverarbeitung</Link>
            <Link href="/legal/imprint" className="hover:text-on-ink hover:underline">Impressum</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
