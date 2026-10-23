import { ArrowRight, Check, Download, PackageSearch, Plus, ShieldCheck, Smartphone, Store, Users } from "lucide-react";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LeadForm, ViewBeacon } from "@/components/landing/lead-form";
import { Reveal } from "@/components/landing/motion";
import { SiteFooter } from "@/components/landing/site-chrome";
import { APP_NAME } from "@/lib/brand";
import { PriceCalculator } from "@/components/landing/price-calculator";
import { Story } from "@/components/landing/story/story";
import { formatEur, INDIVIDUAL, PLANS, PLANS_PRELIMINARY_NOTE } from "@/lib/pricing";
import detailHint from "../../public/landing/detail-hint.png";
import shotLifecycle from "../../public/landing/suite-lifecycle.png";
import shotMobile from "../../public/landing/suite-mobile.png";
import shotPurchasing from "../../public/landing/suite-purchasing.png";
import shotV11Tasks from "../../public/landing/suite-v11tasks.png";

// Public landing page. Static: no session lookup, so it is fast and cacheable.
// Only what the GLB AI Suite (public/suite) does today; every screenshot shows its built-in example data.
// No testimonials, logos, user counts, savings or time promises the product cannot back.

const SUITE = "/suite";
// Calm, solid buttons: green for the main action, an outlined one beside it. No glow, no lift.
const cta = "inline-flex h-(--size-control-lg) items-center gap-2 rounded-pill bg-accent px-6 text-base font-bold text-on-accent transition-colors duration-fast hover:bg-accent-hover";
const ctaQuiet = "inline-flex h-(--size-control-lg) items-center rounded-pill border border-border-input bg-transparent px-6 text-base font-semibold hover:bg-row-hover";
// Exact cents, German format: 89,00 € / 109,99 € / 2,99 € – the same formatter as calculator and billing
const eur = formatEur;
// Primary action: the demo without sign-up (lowest threshold); second: a guided session with the visitor's own data.
const CTA_PRIMARY = "Vorführung mit eigenen Daten";
const CTA_DEMO = "Demo ohne Anmeldung öffnen";

// Per plan: for whom, which problem, what getting started needs, what is NOT connected automatically.
// The module split is the operator's PROPOSAL (Oct 2026), shown as such until it is confirmed. Every module named
// exists in the suite today; nothing is switched off for anyone (there is no plan gating in the product yet).
const PLAN_DETAILS = {
  standard: {
    who: "Betriebe, die Artikel, Rezepte, Lager und Einkauf an einem Ort führen wollen.",
    problem: "Wareneinsatz und Bestand sind unklar, bestellt wird aus dem Bauch.",
    modules: ["Artikel und Rezepte", "Rohwaren und Einkaufspreise", "Inventur und Bestand", "Bestellungen mit Bestell-Forecast", "Basisberichte mit CSV- und Excel-Export"],
    start: "Speisekarte, Rezepte mit Rohwaren und Einkaufspreisen, eine erste Inventur und ein Verkaufsexport aus der Kasse.",
    manual: "Keine Kassenschnittstelle: Verkäufe kommen per CSV-Export. Bestellungen werden nicht an Lieferanten gesendet.",
  },
  premium: {
    who: "Betriebe, die Sortiment, Preise und Service aktiv steuern wollen.",
    problem: "Welche Artikel lassen nach, wo liegen die Preise im Umfeld, welche Zusatzverkäufe bleiben im Service liegen?",
    modules: ["Alles aus Standard", "Lebenszyklen je Artikel", "Menu Engineering (Renner und Penner)", "Szenarien im Service Funnel", "Wettbewerbspreise mit Quelle"],
    start: "Wie Standard, dazu mindestens vier Monate Verkäufe für Lebenszyklen und Gästezahlen für den Service Funnel.",
    manual: "Wettbewerbspreise werden nicht automatisch abgerufen, sondern mit Quelle erfasst. Eine KI-Einordnung gibt es nur, wenn der Betreiber sie eingerichtet hat. Keine Kassenschnittstelle.",
  },
} as const;

// The six questions a buyer asks first, each answered in one or two sentences and linked to the section with details.
const ANSWERS = [
  { q: "Für welchen Betrieb?", a: "Restaurants mit einem oder mehreren Bereichen wie Restaurant, Bar oder Bankett, die Preise, Wareneinsatz, Einkauf und Aufgaben aus den eigenen Verkaufszahlen steuern wollen.", href: "#funktionen", link: "Was die Suite zeigt" },
  { q: "Welche Entscheidungen erleichtert sie?", a: "Welches Gericht über deinem Ziel für die Warenquote liegt, welcher Artikel nachlässt, was du nachbestellen musst und was in welchem Outlet offen ist.", href: "#funktionen", link: "Vier Beispiele" },
  { q: "Wie kommen die Daten hinein?", a: "Speisekarte als CSV, Text oder PDF mit Text; Verkäufe als CSV-Export aus der Kasse. Vor dem Speichern zeigt eine Vorschau jede fehlerhafte Zeile.", href: "#daten", link: "Import im Detail" },
  { q: "Welche Arbeit bleibt bei dir?", a: "Einmal im Monat den Verkaufsexport importieren und geänderte Einkaufspreise nachtragen. Für Bestellvorschläge zusätzlich Tagesabsätze und Inventur.", href: "#daten", link: "Was du selbst erledigst" },
  { q: "Was kostet sie?", a: `Ab ${eur(PLANS[0].baseMonthly)} im Monat plus ${eur(PLANS[0].perUserMonthly)} je Nutzer. Die Preise sind vorläufig.`, href: "#preise", link: "Preise und Rechner" },
  { q: "Wie probiere ich sie aus?", a: "Die Demo mit Beispieldaten öffnen, ohne Anmeldung. Danach eigene Daten starten oder eine Vorführung mit deinen Daten anfragen.", href: "#ausprobieren", link: "So geht es" },
];

// Four decisions, each with ONE real view of the suite (example data). Replaces the former close-ups, use cases and
// feature spotlights, which showed the same views two or three times.
const DECISIONS: { q: string; a: string; points: string[]; need: string; shot: StaticImageData; alt: string }[] = [
  {
    q: "Welches Gericht überschreitet deine Warenquote?",
    a: "Die Übersicht vergleicht die Warenquote jedes Artikels mit deinem eigenen Ziel und zeigt die Rechnung dazu. Die Kalkulation nennt den Preis, mit dem du dein Ziel erreichen würdest.",
    points: ["Wareneinsatz geteilt durch Netto-Umsatz, je Artikel und Outlet", "Zielpreis aus Rezeptkosten und Monatskosten", "Ohne festgelegtes Ziel keine Bewertung"],
    need: "Speisekarte, Rezepte mit Einkaufspreisen, Verkäufe",
    shot: detailHint, alt: "Hinweis „Prüfen“: Rumpsteak 250 g, Warenquote 42,3 % über deinem Ziel von 30,0 %, Wareneinsatz 1.817,40 € geteilt durch Netto-Umsatz 4.300,93 €, Schaltfläche Zielpreis ansehen.",
  },
  {
    q: "Welcher Artikel wächst, welcher verliert?",
    a: "Der Lebenszyklus zeigt die echten Monatswerte je Artikel, Outlet und Zeitraum als Verlauf. Renner-Penner und Menu Engineering ordnen das ganze Sortiment ein.",
    points: ["Verlauf mit Vergleichsfenster und erklärter Einordnung", "Fehlende Monate bleiben Lücken, nichts wird geschätzt", "Für die neue Karte: was bleibt, was geht"],
    need: "mindestens vier Monate Verkäufe",
    shot: shotLifecycle, alt: "Absatzverlauf eines Artikels mit Monatspunkten, Vergleichsfenster und Erklärung der Einordnung.",
  },
  {
    q: "Was musst du nachbestellen?",
    a: "Der Bestell-Forecast rechnet aus dem Absatz der letzten 7 und 28 Tage über die Rezepte den Rohwarenbedarf, abzüglich gezähltem Bestand und offener Bestellungen.",
    points: ["Bestellgebinde und Einkaufswert je Rohware", "Fehlender Bestand, fehlendes Rezept oder fehlender Verbrauch wird ausgewiesen", "Ergebnis ist ein interner Bestellentwurf; an Lieferanten sendest du selbst"],
    need: "Rezepte, Tagesabsätze und eine Inventur",
    shot: shotPurchasing, alt: "Bestell-Forecast mit Datenbasis, Bestellwert und Bestellvorschlag je Rohware in kg und Stück.",
  },
  {
    q: "Was ist in welchem Outlet offen?",
    a: "Team & Aufgaben zeigt offene und überfällige Aufgaben je Outlet; Betriebsübergreifendes steht getrennt. Der Service Funnel zeigt Zusatzverkäufe je 100 Gäste und rechnet höhere Quoten als Szenario.",
    points: ["Aufgaben je Outlet, auch auf dem Handy", "Szenario-Werte getrennt vom echten Umsatz", "Schulungen aus dem Tagesfunnel landen beim gewählten Outlet"],
    need: "Aufgaben erfasst ihr selbst; für den Funnel Gästezahlen",
    shot: shotV11Tasks, alt: "Team und Aufgaben mit offenen und überfälligen Aufgaben je Outlet und gruppierter Aufgabenliste.",
  },
];

// Every area of the suite as a short index (the same five areas as the navigation inside the app).
const AREAS: [string, string][] = [
  ["Übersicht", "Kennzahlen und Handlungsbedarf, Aufgaben für heute, Monatsabschluss, Berichte & Export, Hinweise"],
  ["Verkauf & Preise", "Artikel & Umsätze, Outlets, Deckungsbeiträge & Zielpreise, Preiskalkulation, Renner-Penner, Menu Engineering, Lebenszyklen, Wettbewerbspreise, Mein Markt"],
  ["Einkauf & Lager", "Bestell-Forecast, Bestellungen, Inventur & Lager, Warenbewegungen, Mindestbestände, Rezepte & Rohwaren"],
  ["Service & Team", "Team & Aufgaben je Outlet, Service Funnel, Tagesfunnel aus Kassenbons, Funnel Quest (Training)"],
  ["Einrichtung & Daten", "Erste Schritte, Datenqualität, Speisekarten- und Verkaufsimport, Warengruppen, Einstellungen, Backup"],
];

// How data gets in, and what stays with the customer (from the import code and the setup checklist of the suite).
const DATA_IN = [
  "Speisekarte als CSV, kopierter Text oder PDF mit Textebene; Fotos und gescannte PDFs werden nicht gelesen",
  "Monatsverkäufe, Rezepte, Rohwaren und Tagesabsätze als CSV, mit Vorlagen unter „Erste Schritte“",
  "Vorschau vor dem Speichern: fehlerhafte Zeilen korrigieren, dieselbe Datei wird nicht doppelt gezählt",
  "Kasse: keine fertige Anbindung an ein bestimmtes System; Verkäufe kommen per CSV-Export",
];
const DATA_YOURS = [
  "Monatlich den Verkaufsexport aus der Kasse importieren",
  "Geänderte Einkaufspreise und Monatskosten nachtragen",
  "Ziele festlegen, etwa die Warenquote; erst dann wird bewertet",
  "Für Bestellvorschläge: Tagesabsätze importieren und Inventur zählen",
  "Wettbewerbspreise mit Quelle selbst eintragen",
  "Bestellungen an Lieferanten selbst senden",
];

// What is calculation, rule, AI, manual input or optional integration – checked against the code (Oct 2026):
// the only AI call is /api/suite/market/analyze (OpenAI, operator key, on click, management roles, daily limit);
// /market/discover queries OpenStreetMap without prices; status reports price_lookup: false.
const HOW_IT_WORKS: { kind: string; what: string; data: string; yours: string }[] = [
  { kind: "Nachvollziehbare Berechnungen", what: "Umsatz, DB I und II, Warenquote, Zielpreise und Bestellbedarf. Jede Kennzahl nennt ihre Formel.", data: "Verkäufe, Rezepte, Einkaufspreise, Monatskosten", yours: "Daten aktuell halten" },
  { kind: "Regelbasierte Hinweise", what: "Hinweise wie „Warenquote über deinem Ziel“ oder „Absatz −30 %“ folgen festen Regeln auf deinen Zahlen. Sie nennen Artikel, Zeitraum und Grundlage.", data: "deine Zahlen und deine eigenen Ziele", yours: "entscheiden und umsetzen; ohne Ziel gibt es keine Bewertung" },
  { kind: "KI-Einordnung im Marktcheck (optional)", what: "Ordnet auf Klick die Wettbewerbspreise ein, die du mit Quelle erfasst hast. Nur verfügbar, wenn der Betreiber sie auf dem Server eingerichtet hat; für Leitungsrollen, mit Tageslimit. Sie ruft keine Preise im Internet ab und ändert keine Daten.", data: "deine erfassten Preisbeobachtungen", yours: "Preise erfassen und die Einordnung selbst bewerten" },
  { kind: "Manuelle Erfassung", what: "Wettbewerbspreise mit Quelle, Inventurzählungen, Aufgaben, Ziele und Monatskosten.", data: "was du im Betrieb siehst und zählst", yours: "erfassen; die Suite rechnet damit weiter" },
  { kind: "Optionale Integrationen", what: "Eine signierte Schnittstelle für Bonpositionen aus Kasse oder ETL-Dienst; die Umgebungssuche zeigt Restaurants in der Nähe aus OpenStreetMap, ohne Preise.", data: "Kassendaten bzw. Standort", yours: "Schnittstelle mit deinem Kassenanbieter einrichten" },
];

// From the suite's access model (v0.8): what each role works with.
const ROLES = [
  ["Geschäftsführung", "Alle Module und die Mitarbeiterverwaltung"],
  ["Restaurantleitung", "Operative und kaufmännische Module, ohne Rollenverwaltung"],
  ["Abteilungsleitung Service", "Service Funnel und Absatzdaten, ohne Einkaufspreise und Fixkosten"],
  ["Abteilungsleitung Küche", "Artikel, Speisekarten, Rezepte, Inventur, Bestellungen, Forecast"],
  ["Sales", "Service Funnel, Absatz- und Marktdaten, ohne Wareneinsatzkosten"],
  ["Mitarbeiter Service", "Mobiler Arbeitsplatz mit den Tageszahlen für den Funnel"],
  ["Mitarbeiter Küche", "Mobile Inventur-Schnellerfassung, ohne Einkaufspreise"],
] as const;

const FACTS = [
  { icon: ShieldCheck, title: "Rechte auch in der Datenbank", body: "Was eine Rolle nicht sehen darf, prüft nicht nur die Oberfläche, sondern auch die Datenbank." },
  { icon: Smartphone, title: "Als App installierbar", body: "Auf Handy und Tablet zum Startbildschirm hinzufügen, mit eigenen mobilen Ansichten." },
  { icon: Download, title: "Backup jederzeit", body: "Alle Daten deines Betriebs mit einem Klick als Datei sichern." },
  { icon: PackageSearch, title: "Beispieldaten klar markiert", body: "Beispieldaten sind überall als solche gekennzeichnet. Eigene Daten werden nie mit Beispielwerten ergänzt." },
  { icon: Store, title: "Mehrere Outlets", body: "Restaurant, Bar, Bankett oder Terrasse getrennt auswerten oder zusammen betrachten." },
];

const FAQ = [
  { q: `Ist ${APP_NAME} mit meiner Kasse verbunden?`, a: "Es gibt keine fertige Anbindung an ein bestimmtes Kassensystem. Monatsverkäufe und einzelne Bonpositionen kommen per CSV-Export aus der Kasse. Für eine automatische Übertragung gibt es eine signierte Schnittstelle, an die ein Kassen- oder ETL-Dienst Positionen senden kann; das muss für deine Kasse eingerichtet werden." },
  { q: "Wer sieht welche Zahlen?", a: "Es gibt sieben Rollen von Geschäftsführung bis Mitarbeiter Küche. Service und Sales sehen keine Einkaufspreise und keine Fixkosten, die Küche keine Finanzberichte. Die Rechte prüft auch die Datenbank." },
  { q: "Funktioniert das auf dem Handy?", a: `Ja. ${APP_NAME} läuft im Browser und lässt sich als App installieren. Für Service und Küche gibt es eigene mobile Ansichten, etwa für die Tageszahlen im Funnel und die Inventur.` },
  { q: "Was passiert in der Demo mit meinen Eingaben?", a: "Die Demo läuft ohne Anmeldung nur in deinem Browser, mit Beispieldaten. Sie legt kein Konto und keine Daten in der Cloud an. Eigene Daten beginnst du bewusst über „Eigene Daten starten“." },
  { q: "Ist KI im Tarif enthalten?", a: "Die einzige KI-Funktion ist die optionale Einordnung im Marktcheck. Ob sie in einem Tarif enthalten ist, wird mit den Tarifdetails festgelegt; bis dahin gilt sie als offen." },
  { q: "Wo liegen meine Daten?", a: "Mit Anmeldung in der Cloud-Datenbank von Supabase, getrennt pro Betrieb. Ohne Anmeldung nur in deinem Browser. Zusätzlich kannst du jederzeit ein Backup herunterladen." },
];

export default function LandingPage() {
  return (
    <div className="landing-beige">
      <ViewBeacon />

      {/* ------------------------------------------------ hero */}
      <div className="story-ink border-b border-white/10">
        <header className="mx-auto flex max-w-(--size-content-max) items-center justify-between px-4 py-5 lg:px-8">
          <Link href="/" aria-label={`${APP_NAME} Startseite`}><Logo tone="light" /></Link>
          <nav aria-label="Konto" className="flex items-center gap-5">
            <a href="#funktionen" className="hidden font-semibold text-[var(--story-muted)] hover:text-[var(--story-cream)] md:inline">Funktionen</a>
            <a href="#daten" className="hidden font-semibold text-[var(--story-muted)] hover:text-[var(--story-cream)] lg:inline">Daten & KI</a>
            <a href="#preise" className="hidden font-semibold text-[var(--story-muted)] hover:text-[var(--story-cream)] md:inline">Preise</a>
            <a href="#ausprobieren" className="hidden font-semibold text-[var(--story-muted)] hover:text-[var(--story-cream)] md:inline">Ausprobieren</a>
            <Link href={SUITE} className="font-semibold text-[var(--story-cream)] hover:underline">Anmelden</Link>
            <Link href={SUITE} className="hidden h-(--size-control-md) items-center rounded-pill bg-[var(--story-cream)] px-4 font-bold text-[var(--story-ink)] hover:bg-white sm:inline-flex">Demo öffnen</Link>
          </nav>
        </header>
      </div>

      {/* the product story: the real overview of the suite, close up (heading and actions inside) */}
      <Story />

      {/* the first questions of a buyer, answered before any feature list */}
      {/* the six questions of a buyer, answered first; each links to its section */}
      <section id="ueberblick" aria-labelledby="answers" className="border-b border-border bg-surface">
        <div className="mx-auto max-w-(--size-content-max) px-4 py-14 lg:px-8">
          <h2 id="answers" className="font-display text-[1.75rem] leading-tight lg:text-[2.25rem]">Kurz beantwortet</h2>
          <dl className="mt-8 grid gap-x-10 gap-y-7 md:grid-cols-2 lg:grid-cols-3">
            {ANSWERS.map((x) => (
              <div key={x.q} className="border-t-2 border-accent pt-4">
                <dt className="font-semibold">{x.q}</dt>
                <dd className="mt-2 text-sm text-text-muted">{x.a}</dd>
                <dd className="mt-2 text-sm"><a href={x.href} className="inline-flex min-h-11 items-center font-semibold text-accent underline">{x.link}</a></dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <main>
        {/* ------------------------------------------------ decisions: one real view each */}
        <section id="funktionen" aria-labelledby="features" className="mx-auto max-w-(--size-content-max) px-4 py-20 lg:px-8 lg:py-24">
          {/* former anchors of the sections merged here, so old links still land on the right content */}
          <span id="alltag" aria-hidden className="block" />
          <span id="details" aria-hidden className="block" />
          <Reveal>
            <p className="text-sm font-bold uppercase tracking-wide text-accent">Was die Suite zeigt</p>
            <h2 id="features" className="font-display mt-3 max-w-3xl text-[2rem] leading-tight lg:text-[2.75rem]">Vier Entscheidungen, die jede Woche anstehen.</h2>
            <p className="mt-4 max-w-2xl text-base text-text-muted">Jede Antwort ist eine echte Ansicht der Suite, aufgenommen mit ihren Beispieldaten.</p>
          </Reveal>
          <ol className="mt-12 flex flex-col">
            {DECISIONS.map((d, i) => (
              <li key={d.q} className="grid gap-8 border-t border-border py-12 lg:grid-cols-[5fr_7fr] lg:gap-14">
                <Reveal>
                  <p className="num text-sm font-semibold text-accent">0{i + 1}</p>
                  <h3 className="font-display mt-2 text-[1.625rem] leading-snug">{d.q}</h3>
                  <p className="mt-3 text-base text-text-muted">{d.a}</p>
                  <ul className="mt-4 flex flex-col gap-2 text-sm">
                    {d.points.map((x) => <li key={x} className="flex gap-2"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />{x}</li>)}
                  </ul>
                  <p className="mt-4 text-sm"><span className="font-semibold">Dafür nötig: </span><span className="text-text-muted">{d.need}</span></p>
                </Reveal>
                <Reveal delay={100}>
                  <figure className="overflow-hidden rounded-md border border-border bg-surface-raised">
                    <Image src={d.shot} alt={d.alt} placeholder="blur" className="h-auto w-full" sizes="(min-width: 1024px) 720px, 100vw" />
                  </figure>
                </Reveal>
              </li>
            ))}
          </ol>
          <details className="group border-y border-border">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 font-semibold">
              Alle Bereiche der Suite, gegliedert wie das Menü in der App
              <Plus aria-hidden className="size-4 shrink-0 text-accent transition-transform duration-base group-open:rotate-45" />
            </summary>
            <dl aria-label="Bereiche der Suite" className="flex flex-col divide-y divide-border pb-4">
              {AREAS.map(([area, pages]) => (
                <div key={area} className="grid gap-1 py-3 sm:grid-cols-[14rem_1fr] sm:gap-6">
                  <dt className="font-semibold">{area}</dt>
                  <dd className="text-sm text-text-muted">{pages}</dd>
                </div>
              ))}
            </dl>
          </details>
        </section>

        {/* ------------------------------------------------ data in, and the work that stays with the customer */}
        <section id="daten" aria-labelledby="data" className="border-y border-border bg-surface">
          <div className="mx-auto max-w-(--size-content-max) px-4 py-20 lg:px-8">
            <p className="text-sm font-bold uppercase tracking-wide text-accent">Daten</p>
            <h2 id="data" className="font-display mt-3 max-w-3xl text-[2rem] leading-tight lg:text-[2.75rem]">Wie die Daten hineinkommen, und was bei dir bleibt.</h2>
            <div className="mt-10 grid gap-10 lg:grid-cols-2">
              <div>
                <h3 className="text-lg">So kommen die Daten hinein</h3>
                <ul className="mt-4 flex flex-col gap-3">
                  {DATA_IN.map((x) => <li key={x} className="flex gap-2"><Check aria-hidden className="mt-1 size-4 shrink-0 text-accent" />{x}</li>)}
                </ul>
              </div>
              <div>
                <h3 className="text-lg">Das erledigst du weiterhin selbst</h3>
                <ul className="mt-4 flex flex-col gap-3">
                  {DATA_YOURS.map((x) => <li key={x} className="flex gap-2"><Users aria-hidden className="mt-1 size-4 shrink-0 text-accent" />{x}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ calculation, rules, AI, manual input, integrations */}
        <section id="ki" aria-labelledby="ai" className="mx-auto max-w-(--size-content-max) px-4 py-20 lg:px-8">
          <p className="text-sm font-bold uppercase tracking-wide text-accent">Rechnung, Regeln und KI</p>
          <h2 id="ai" className="font-display mt-3 max-w-3xl text-[2rem] leading-tight lg:text-[2.75rem]">Was die Suite rechnet, und wo KI im Spiel ist.</h2>
          <p className="mt-4 max-w-3xl text-base text-text-muted">Die Suite ruft keine Restaurant- oder Wettbewerbspreise automatisch ab. Fast alles, was du siehst, ist Rechnung und Regel auf deinen eigenen Zahlen.</p>
          <ul className="mt-10 grid gap-6 lg:grid-cols-2">
            {HOW_IT_WORKS.map((x) => (
              <li key={x.kind} className="rounded-md border border-border bg-surface-raised p-5">
                <h3 className="text-lg">{x.kind}</h3>
                <p className="mt-2 text-sm text-text-muted">{x.what}</p>
                <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-[8.5rem_1fr]">
                  <dt className="font-semibold">Benötigt</dt><dd className="text-text-muted">{x.data}</dd>
                  <dt className="font-semibold">Bleibt bei dir</dt><dd className="text-text-muted">{x.yours}</dd>
                </dl>
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------------------------ roles and facts */}
        <section id="rollen" aria-labelledby="roles" className="border-y border-border bg-surface">
          <div className="mx-auto grid max-w-(--size-content-max) items-start gap-12 px-4 py-20 lg:grid-cols-[7fr_4fr] lg:px-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-accent">Rollen und Verlässlichkeit</p>
              <h2 id="roles" className="font-display mt-3 max-w-2xl text-[2rem] leading-tight lg:text-[2.75rem]">Jeder sieht, was er braucht.</h2>
              <p className="mt-4 max-w-xl text-text-muted">Service und Sales arbeiten mit Quoten und Absatz, ohne Einkaufspreise und Fixkosten zu sehen. Die Leitung sieht das ganze Bild.</p>
              <ul className="mt-8 flex flex-col divide-y divide-border border-y border-border">
                {ROLES.map(([role, scope]) => (
                  <li key={role} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-4">
                    <span className="font-semibold sm:w-60 sm:shrink-0">{role}</span>
                    <span className="text-sm text-text-muted">{scope}</span>
                  </li>
                ))}
              </ul>
              <ul aria-label="Worauf du dich verlassen kannst" className="mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-2">
                {FACTS.map(({ icon: Icon, title, body }) => (
                  <li key={title}>
                    <h3 className="flex items-center gap-2 text-base"><Icon aria-hidden className="size-5 shrink-0 text-accent" />{title}</h3>
                    <p className="mt-1 text-sm text-text-muted">{body}</p>
                  </li>
                ))}
              </ul>
            </div>
            <figure className="mx-auto w-64 overflow-hidden rounded-lg border-8 border-text">
              <Image src={shotMobile} alt="Die Suite auf dem Handy: Übersicht mit Netto-Umsatz und Berichtsfilter." placeholder="blur" className="h-auto w-full" sizes="256px" />
            </figure>
          </div>
        </section>

        {/* ------------------------------------------------ pricing */}
        <section id="preise" aria-labelledby="pricing">
          <div className="mx-auto max-w-(--size-content-max) px-4 py-20 lg:px-8">
            <h2 id="pricing" className="font-display text-[2rem] leading-tight lg:text-[2.75rem]">Preise</h2>
            {/* all preliminary points in one place; the decisions are the operator's, not settled here */}
            <div className="mt-3 max-w-3xl rounded-md border border-border bg-surface px-4 py-3 text-sm text-text-muted" role="note">
              <p>{PLANS_PRELIMINARY_NOTE}</p>
              <p className="mt-2 font-semibold text-text">Noch offen:</p>
              <ul className="mt-1 list-disc pl-5">
                <li>welche Module endgültig zu welchem Tarif gehören (der Umfang unten ist ein Vorschlag)</li>
                <li>ob Nutzer im Grundpreis enthalten sind und was „pro Kunde“ genau abrechnet</li>
                <li>wie die Umsatzsteuer ausgewiesen wird</li>
                <li>ob die optionale KI-Einordnung in einem Tarif enthalten ist</li>
              </ul>
            </div>
            <p className="mt-4 max-w-3xl text-text-muted">Standard ist der Einstieg. Premium kostet {eur(PLANS[1].baseMonthly - PLANS[0].baseMonthly)} mehr Grundpreis im Monat und ergänzt die Module zur Steuerung von Sortiment, Preisen und Service; der Preis je Nutzer ist gleich. Individuelle Lösungen sind ein eigener Weg für Anforderungen außerhalb dieser Module.</p>
            <div className="mt-10 grid items-start gap-6 lg:grid-cols-3">
              {PLANS.map((p) => {
                const d = PLAN_DETAILS[p.id];
                const premium = p.id === "premium";
                return (
                  <article key={p.id} data-plan-card={p.id} aria-labelledby={`plan-${p.id}`} className={premium ? "flex flex-col rounded-md border-2 border-accent bg-surface-raised p-6 lg:p-8" : "flex flex-col rounded-md border border-border bg-surface-raised p-6 lg:p-8"}>
                    <div className="flex min-h-7 flex-wrap items-center justify-between gap-2">
                      <h3 id={`plan-${p.id}`} className="text-lg">{p.name}</h3>
                      {premium && <p className="inline-flex rounded-pill bg-accent px-3 py-1 text-xs font-bold text-on-accent">Empfehlung für aktive Betriebssteuerung</p>}
                    </div>
                    <p className="num font-display mt-4 text-[2.5rem] leading-none">{eur(p.baseMonthly)}</p>
                    <p className="mt-2 text-sm text-text-muted">pro Kunde und Monat</p>
                    <p className="mt-2 flex gap-2 text-sm"><Plus aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />zuzüglich {eur(p.perUserMonthly)} pro Nutzer und Monat</p>
                    {premium && <p className="mt-2 text-sm text-text-muted">{eur(p.baseMonthly - PLANS[0].baseMonthly)} mehr als Standard, für vier zusätzliche Module.</p>}
                    <p className="mt-5 text-sm"><span className="font-bold">Für wen: </span><span className="text-text-muted">{d.who}</span></p>
                    <p className="mt-5 text-sm font-bold">Vorgeschlagener Umfang</p>
                    <ul className="mt-2 flex flex-col gap-1.5 text-sm">{d.modules.map((m) => <li key={m} className="flex gap-2"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />{m}</li>)}</ul>
                    <div className="mt-6 flex flex-col gap-2">
                      <Link href={SUITE} className="inline-flex min-h-12 items-center justify-center rounded-pill bg-accent px-5 font-bold text-on-accent hover:bg-accent-hover">Mit Beispieldaten testen</Link>
                      <a href="#anfrage" className="inline-flex min-h-11 items-center justify-center font-semibold text-accent underline">Vorführung anfragen</a>
                    </div>
                    <details className="group mt-5 border-t border-border pt-4 text-sm">
                      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-semibold"><span>Details: Problem, Start, Grenzen</span><Plus aria-hidden className="size-4 transition-transform group-open:rotate-45" /></summary>
                      <dl className="mt-3 flex flex-col gap-4">
                        <div><dt className="font-bold">Welches Problem</dt><dd className="mt-1 text-text-muted">{d.problem}</dd></div>
                        <div><dt className="font-bold">Zum Start nötig</dt><dd className="mt-1 text-text-muted">{d.start}</dd></div>
                        <div><dt className="font-bold">Nicht automatisch angebunden</dt><dd className="mt-1 text-text-muted">{d.manual}</dd></div>
                      </dl>
                    </details>
                  </article>
                );
              })}
              <article data-plan-card="individual" aria-labelledby="plan-individual" className="flex flex-col rounded-md border border-border border-t-4 border-t-text bg-surface-raised p-6 lg:p-8">
                <div className="flex min-h-7 items-center"><h3 id="plan-individual" className="text-lg">Individuelle Lösungen</h3></div>
                <p className="font-display mt-4 text-[1.5rem] leading-tight">Entwicklungsgebühr nach Angebot</p>
                <p className="mt-2 text-sm text-text-muted">einmalig, Umfang und Betrag vorab schriftlich festgelegt</p>
                <p className="mt-2 flex gap-2 text-sm"><Plus aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />danach {eur(INDIVIDUAL.serviceMonthly)} pro Monat</p>
                <p className="mt-5 text-sm"><span className="font-bold">Für wen: </span><span className="text-text-muted">Betriebe mit Anforderungen, die Standard und Premium nicht abdecken.</span></p>
                <div className="mt-6 flex flex-col gap-2">
                  <a href="#anfrage" className="inline-flex min-h-12 items-center justify-center rounded-pill border border-border-input px-5 font-bold hover:bg-row-hover">Anforderung besprechen</a>
                </div>
                <details className="group mt-5 border-t border-border pt-4 text-sm">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-semibold"><span>Details: Leistung und Start</span><Plus aria-hidden className="size-4 transition-transform group-open:rotate-45" /></summary>
                  <dl className="mt-3 flex flex-col gap-4">
                    <div><dt className="font-bold">Was die {eur(INDIVIDUAL.serviceMonthly)} abdecken</dt><dd className="mt-1 text-text-muted">Umfang und Grenzen der laufenden Leistung werden vor Vertragsschluss schriftlich festgelegt. Eine unbegrenzte Weiterentwicklung ist nicht enthalten.</dd></div>
                    <div><dt className="font-bold">Zum Start nötig</dt><dd className="mt-1 text-text-muted">Ein Gespräch über Anforderung, Daten und Abgrenzung; daraus ein schriftliches Angebot.</dd></div>
                  </dl>
                </details>
              </article>
            </div>
            <PriceCalculator />
            <p className="mt-6 text-sm text-text-muted">Die Demo ist kostenlos und ohne Anmeldung. Mehr Übersicht oder Ergebnis durch Premium ist eine Annahme, die du mit deinen eigenen Daten prüfen solltest, kein Versprechen.</p>
          </div>
        </section>

        {/* ------------------------------------------------ how to try it, with the short video tour */}
        <section id="ausprobieren" aria-labelledby="try" className="border-t border-border bg-surface">
          <div className="mx-auto grid max-w-(--size-content-max) items-center gap-12 px-4 py-20 lg:grid-cols-[5fr_7fr] lg:px-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-accent">Ausprobieren</p>
              <h2 id="try" className="font-display mt-3 text-[2rem] leading-tight lg:text-[2.75rem]">In drei Schritten zum eigenen Bild.</h2>
              <ol className="mt-6 flex flex-col gap-4">
                {[
                  ["Demo öffnen", "Die Suite mit Beispieldaten, ohne Anmeldung. Sie läuft nur in deinem Browser und legt nichts an."],
                  ["Einstieg in drei Schritten folgen", "Die Übersicht der Demo führt zu Import, Auffälligkeiten und der nächsten Maßnahme; du kannst ihn ausblenden."],
                  ["Mit eigenen Daten weitermachen", "In der Suite „Eigene Daten starten“, oder wir zeigen sie dir mit deiner Speisekarte und deinen Verkäufen."],
                ].map(([t, d], i) => (
                  <li key={t} className="flex gap-3">
                    <span aria-hidden className="num grid size-8 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-on-accent">{i + 1}</span>
                    <div><p className="font-semibold">{t}</p><p className="text-sm text-text-muted">{d}</p></div>
                  </li>
                ))}
              </ol>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap"><Link href={SUITE} className={cta}>{CTA_DEMO} <ArrowRight aria-hidden className="size-4" /></Link><a href="#anfrage" className={ctaQuiet}>{CTA_PRIMARY}</a></div>
            </div>
            <figure id="rundgang" className="overflow-hidden rounded-md border border-border bg-surface-raised">
              <video controls muted playsInline preload="metadata" poster="/landing/suite-reports.png" className="h-auto w-full" aria-label={`Rundgang durch die ${APP_NAME}, ohne Ton`}>
                <source src="/landing/suite-rundgang.mp4" type="video/mp4" />
                <track kind="captions" src="/landing/suite-rundgang.vtt" srcLang="de" label="Deutsch" default />
              </video>
              <figcaption className="border-t border-border px-4 py-2 text-xs text-text-muted">Rundgang in 26 Sekunden, ohne Ton. Untertitel nennen das jeweilige Modul.</figcaption>
            </figure>
          </div>
        </section>

        {/* ------------------------------------------------ inquiry */}
        <section id="anfrage" aria-labelledby="lead" className="border-t border-border">
          <div className="mx-auto grid max-w-(--size-content-max) gap-10 px-4 py-20 lg:grid-cols-[5fr_7fr] lg:px-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-accent">Vorführung</p>
              <h2 id="lead" className="font-display mt-3 text-[2rem] leading-tight lg:text-[2.75rem]">Deine Zahlen im Board</h2>
              <p className="mt-4 text-text-muted">
                Gemeinsam importieren wir deine Speisekarte und einen Monat Verkäufe, und du siehst Renner, Penner,
                Deckungsbeiträge und den Handlungsbedarf deines eigenen Betriebs.
              </p>
              <ul className="mt-6 flex flex-col gap-2 text-sm">
                {["Per Video oder bei euch im Betrieb", "Mit deiner echten Speisekarte", "Kostenlos und unverbindlich"].map((x) => (
                  <li key={x} className="flex gap-2"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />{x}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-md border border-border bg-surface-raised p-6 lg:p-8">
              <LeadForm appName={APP_NAME} />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ faq */}
        <section aria-labelledby="faq" className="border-y border-border bg-surface">
          <div className="mx-auto max-w-(--size-form-max) px-4 py-20">
            <h2 id="faq" className="font-display text-[2rem] leading-tight">Häufige Fragen</h2>
            <div className="mt-6 flex flex-col divide-y divide-border border-y border-border">
              {FAQ.map(({ q, a }) => (
                <details key={q} className="group py-4">
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
        <section aria-labelledby="final">
          <div className="mx-auto max-w-(--size-content-max) px-4 py-24 text-center lg:px-8">
            <h2 id="final" className="font-display mx-auto max-w-3xl text-[2rem] leading-tight lg:text-[2.75rem]">Sieh deinen Betrieb so, wie die Zahlen ihn sehen.</h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3"><Link href={SUITE} className={cta}>{CTA_DEMO} <ArrowRight aria-hidden className="size-4" /></Link><a href="#anfrage" className={ctaQuiet}>{CTA_PRIMARY}</a></div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
