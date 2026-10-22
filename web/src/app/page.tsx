import { ArrowRight, BarChart3, Calculator, Check, Download, Filter, PackageSearch, Plus, ShieldCheck, ShoppingCart, Smartphone, Sparkles, Store, Users } from "lucide-react";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LeadForm, ViewBeacon } from "@/components/landing/lead-form";
import { Reveal } from "@/components/landing/motion";
import { SiteFooter } from "@/components/landing/site-chrome";
import { APP_NAME } from "@/lib/brand";
import { PriceCalculator } from "@/components/landing/price-calculator";
import { formatEur, INDIVIDUAL, PLANS, PLANS_PRELIMINARY_NOTE } from "@/lib/pricing";
import shotCosts from "../../public/landing/suite-costs.png";
import shotFunnel from "../../public/landing/suite-funnel.png";
import shotLifecycle from "../../public/landing/suite-lifecycle.png";
import shotMobile from "../../public/landing/suite-mobile.png";
import shotOverview from "../../public/landing/suite-overview.png";
import shotPurchasing from "../../public/landing/suite-purchasing.png";
import shotReports from "../../public/landing/suite-reports.png";
import shotV11Cockpit from "../../public/landing/suite-v11cockpit.png";
import shotV11Market from "../../public/landing/suite-v11market.png";
import shotV11Tasks from "../../public/landing/suite-v11tasks.png";

// Public landing page. Static: no session lookup, so it is fast and cacheable.
// Only what the GLB AI Suite (public/suite) does today; every screenshot shows its built-in example data.
// No testimonials, logos, user counts, savings or time promises the product cannot back.

const SUITE = "/suite";
// Calm, solid buttons: green for the main action, an outlined one beside it. No glow, no lift.
const cta = "inline-flex h-(--size-control-lg) items-center gap-2 rounded-pill bg-accent px-6 text-base font-bold text-on-accent transition-colors duration-fast hover:bg-accent-hover";
const ctaLight = cta;
const ctaQuiet = "inline-flex h-(--size-control-lg) items-center rounded-pill border border-border-input bg-transparent px-6 text-base font-semibold hover:bg-row-hover";
// Exact cents, German format: 89,00 € / 109,99 € / 2,99 € – the same formatter as calculator and billing
const eur = formatEur;
// Primary action: a guided session with the visitor's own data; secondary: the demo without sign-up.
const CTA_PRIMARY = "Mit eigenen Daten vorführen lassen";
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

// The questions a buyer asks first, answered before any feature list (Oct 2026).
const ANSWERS = [
  { q: "Welche Entscheidung erleichtert die Suite?", a: "Preise, Sortiment und Einkauf: welcher Artikel über deinem Ziel für die Warenquote liegt, welcher nachlässt und was du nachbestellen musst." },
  { q: "Wie kommen meine Daten hinein?", a: "Speisekarte als CSV, kopierter Text oder PDF mit Text; Verkäufe als CSV-Export aus der Kasse. Vor dem Speichern zeigt eine Vorschau jede fehlerhafte Zeile." },
  { q: "Wie viel laufende Arbeit entsteht?", a: "Einmal im Monat den Verkaufsexport importieren und geänderte Einkaufspreise nachtragen. Für den Bestell-Forecast zusätzlich Tagesabsätze und Inventur." },
  { q: "Was kostet das?", a: `Ab ${eur(PLANS[0].baseMonthly)} im Monat plus ${eur(PLANS[0].perUserMonthly)} je Nutzer. Die Preise sind vorläufig, siehe unten.` },
  { q: "Wie teste ich mit eigenen Daten?", a: "Zuerst die Demo ohne Anmeldung. Dann in der Suite „Eigene Daten starten“: Betrieb anlegen, Speisekarte und einen Monat Verkäufe importieren." },
];

type Spotlight = { icon: typeof BarChart3; kicker: string; title: string; body: string; points: string[]; shot: StaticImageData; alt: string };
// Four everyday workflows, each with a screenshot.
const SPOTLIGHTS: Spotlight[] = [
  {
    icon: BarChart3, kicker: "Berichte & Export", title: "Report Studio",
    body: "Umsatz, Deckungsbeitrag, Sortiment, Service sowie Lager und Einkauf mit einem gemeinsamen Filter für Zeitraum, Outlet und Warengruppe.",
    points: ["Kostenbasis wählbar: Kosten des Verkaufsmonats oder heutige Kosten als Szenario", "ABC-Analyse, Outlet-, Artikel-, Funnel- und Lagerberichte", "Export als CSV oder Excel mit Zeitraum und Rechengrundlage, Drucken als PDF"],
    shot: shotReports, alt: "Report Studio mit Berichtsfilter, Reitern und Kacheln für Netto-Umsatz, DB II, Wareneinsatzquote und Absatz.",
  },
  {
    icon: Calculator, kicker: "Verkauf & Preise", title: "Deckungsbeiträge & Zielpreise",
    body: "Monatskosten einmal erfassen, und die Kalkulation zeigt für jeden Artikel den aktuellen und den erforderlichen Verkaufspreis nebeneinander.",
    points: ["DB I und DB II je Artikel", "Monatliche Fixkosten und Zielbetriebsergebnis", "Kostenstände mit Datum: vergangene Monate mit den damals gültigen Kosten"],
    shot: shotCosts, alt: "Deckungsbeiträge und Zielpreise mit Eingabe der Monatskosten und Kacheln für Nettoumsatz, Fixkostenquote und Zielpreis.",
  },
  {
    icon: ShoppingCart, kicker: "Einkauf & Lager", title: "Bestell-Forecast",
    body: "Aus dem Absatz der letzten 7 und 28 Tage über die Rezepte zum Rohwarenbedarf, abzüglich gezähltem Bestand und offener Bestellungen.",
    points: ["Bestellgebinde und Einkaufswert je Rohware", "Fehlender Bestand, fehlendes Rezept und fehlender Verbrauch werden getrennt ausgewiesen", "Mit einem Klick als interner Bestellentwurf"],
    shot: shotPurchasing, alt: "Bestell-Forecast mit Datenbasis, Bestellwert und Bestellvorschlag je Rohware in kg und Stück.",
  },
  {
    icon: Filter, kicker: "Service & Team", title: "Service Funnel",
    body: "Wie oft der Service Aperitif, Wasser, Upgrades, Beilagen, Desserts und Kaffee verkauft, und was eine höhere Quote als Szenario bedeuten würde.",
    points: ["Zielquote je 100 Gäste für jede Stufe", "Szenario-Werte getrennt vom echten Umsatz", "Kaufquoten je Bon zusätzlich aus Kassendaten (Tagesfunnel)"],
    shot: shotFunnel, alt: "Service Funnel mit Schiebereglern je Stufe und Kacheln für Gäste und Szenario-Werte.",
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

// Situations from day-to-day work, each with the screen that answers it (example data of the suite).
const USE_CASES: { when: string; question: string; answer: string; shot: StaticImageData; alt: string }[] = [
  { when: "Bürotag am Monatsanfang", question: "Wie lief der Monat, und wo fehlen noch Kosten?", answer: "Der Monatsabschluss zeigt Brutto, Netto, DB I und Wareneinsatzquote je Outlet und Monat. Fehlender Wareneinsatz steht als unvollständig da, statt geschätzt zu werden.", shot: shotV11Cockpit, alt: "Monatsabschluss mit Kennzahlen je Outlet und Monat." },
  { when: "Vor der neuen Karte", question: "Welcher Artikel wächst, welcher verliert?", answer: "Der Lebenszyklus zeigt die echten Monatswerte je Artikel, Outlet und Zeitraum als Verlauf. Fehlende Monate bleiben Lücken; die Einordnung wird am Graphen erklärt.", shot: shotLifecycle, alt: "Absatzverlauf eines Artikels mit Monatspunkten, Vergleichsfenster und Erklärung der Einordnung." },
  { when: "Preise prüfen", question: "Was verlangen andere für Vergleichbares?", answer: "Die Wettbewerbspreise trennen den Preisvergleich vom Umfeld in der Nähe. Preise trägst du mit Quelle ein; Abweichungen gibt es nur bei vergleichbarer Menge und Leistung.", shot: shotV11Market, alt: "Wettbewerbspreise mit den Reitern Speisen- und Getränkevergleich sowie Restaurants und Locations in der Nähe." },
  { when: "Schichtbriefing", question: "Was ist in welchem Outlet offen?", answer: "Team & Aufgaben zeigt offene und überfällige Aufgaben je Outlet. Betriebsübergreifendes steht getrennt; Schulungen aus dem Tagesfunnel landen beim gewählten Outlet.", shot: shotV11Tasks, alt: "Team und Aufgaben mit offenen und überfälligen Aufgaben je Outlet und gruppierter Aufgabenliste." },
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
  { icon: PackageSearch, title: "Beispieldaten klar markiert", body: "Zum Ausprobieren gibt es Beispieldaten, die überall als solche gekennzeichnet sind. Eigene Daten werden nie mit Beispielwerten ergänzt." },
  { icon: Sparkles, title: "Vorschläge statt Automatik", body: "Hinweise nennen Artikel, Zeitraum und Grundlage. Bewertet wird nur an Zielen, die du selbst festlegst." },
  { icon: Store, title: "Mehrere Outlets", body: "Restaurant, Bar, Bankett oder Terrasse getrennt auswerten oder zusammen betrachten." },
];

const FAQ = [
  { q: "Wie kommen meine Daten hinein?", a: "Über den Import: Speisekarten als CSV, Text oder PDF mit Textebene, Monatsverkäufe, Rezepte, Rohwaren und Tagesabsätze als CSV. Vorlagen für jede Datei liegen in der Suite unter „Erste Schritte“. Vor dem Übernehmen siehst du eine Vorschau und kannst korrigieren. Dieselbe Datei wird wiedererkannt und nicht doppelt gezählt. Fotos und gescannte PDFs ohne Text werden nicht gelesen." },
  { q: `Ist ${APP_NAME} mit meiner Kasse verbunden?`, a: "Es gibt keine fertige Anbindung an ein bestimmtes Kassensystem. Monatsverkäufe und einzelne Bonpositionen kommen per CSV-Export aus der Kasse. Für eine automatische Übertragung gibt es eine signierte Schnittstelle, an die ein Kassen- oder ETL-Dienst Positionen senden kann; das muss für deine Kasse eingerichtet werden." },
  { q: "Was kostet die Suite?", a: `Standard ${eur(PLANS[0].baseMonthly)} und Premium ${eur(PLANS[1].baseMonthly)} im Monat, jeweils zuzüglich ${eur(PLANS[0].perUserMonthly)} je Nutzer und Monat; individuelle Lösungen mit vereinbarter Entwicklungsgebühr zuzüglich ${eur(INDIVIDUAL.serviceMonthly)} im Monat. ${PLANS_PRELIMINARY_NOTE}` },
  { q: "Wer sieht welche Zahlen?", a: "Es gibt sieben Rollen von Geschäftsführung bis Mitarbeiter Küche. Service und Sales sehen keine Einkaufspreise und keine Fixkosten, die Küche keine Finanzberichte. Die Rechte prüft auch die Datenbank." },
  { q: "Funktioniert das auf dem Handy?", a: `Ja. ${APP_NAME} läuft im Browser und lässt sich als App installieren. Für Service und Küche gibt es eigene mobile Ansichten, etwa für die Tageszahlen im Funnel und die Inventur.` },
  { q: "Rechnet die KI für mich?", a: "Kennzahlen, Hinweise und Szenarien entstehen aus nachvollziehbaren Regeln auf deinen Zahlen. Nur bei den Wettbewerbspreisen kann optional eine KI die von dir erfassten Preise einordnen; sie prüft keine Webseiten und ändert nichts. Die KI richtet der Betreiber auf dem Server ein, du verwaltest keine Schlüssel. Ob sie in einem Tarif enthalten ist, wird mit den Tarifdetails festgelegt." },
  { q: "Kann ich vorher ausprobieren?", a: "Ja. Über „Demo ohne Anmeldung öffnen“ öffnest du die Suite mit Beispieldaten, ohne Anmeldung. Mit „Eigene Daten starten“ legst du in der Suite deinen Betrieb an." },
  { q: "Wo liegen meine Daten?", a: "Mit Anmeldung in der Cloud-Datenbank von Supabase, getrennt pro Betrieb. Ohne Anmeldung nur in deinem Browser. Zusätzlich kannst du jederzeit ein Backup herunterladen." },
];

export default function LandingPage() {
  return (
    <div className="landing-beige">
      <ViewBeacon />

      {/* ------------------------------------------------ hero */}
      <div className="border-b border-border">
        <header className="mx-auto flex max-w-(--size-content-max) items-center justify-between px-4 py-5 lg:px-8">
          <Link href="/" aria-label={`${APP_NAME} Startseite`}><Logo /></Link>
          <nav aria-label="Konto" className="flex items-center gap-5">
            <a href="#rundgang" className="hidden font-semibold text-text-muted hover:text-text md:inline">Rundgang</a>
            <a href="#funktionen" className="hidden font-semibold text-text-muted hover:text-text md:inline">Funktionen</a>
            <a href="#rollen" className="hidden font-semibold text-text-muted hover:text-text lg:inline">Rollen</a>
            <a href="#preise" className="hidden font-semibold text-text-muted hover:text-text md:inline">Preise</a>
            <a href="#anfrage" className="hidden font-semibold text-text-muted hover:text-text md:inline">Vorführung</a>
            <Link href={SUITE} className="font-semibold hover:underline">Anmelden</Link>
            <Link href={SUITE} className="hidden h-(--size-control-md) items-center rounded-pill bg-accent px-4 font-bold text-on-accent hover:bg-accent-hover sm:inline-flex">Demo öffnen</Link>
          </nav>
        </header>

        <section aria-labelledby="hero" className="mx-auto grid max-w-(--size-content-max) items-center gap-12 px-4 pt-8 pb-20 lg:grid-cols-[5fr_7fr] lg:px-8 lg:pt-16 lg:pb-28">
          <div className="min-w-0">
            <a href="#alltag" className="mb-6 inline-flex max-w-full items-center gap-2 border-b border-accent pb-0.5 text-sm font-semibold text-accent hover:text-accent-hover">
              <span className="truncate">Neu: Lebenszyklus-Graph, Wettbewerbspreise in zwei Ansichten, Aufgaben je Outlet</span>
              <ArrowRight aria-hidden className="size-4 shrink-0" />
            </a>
            <h1 id="hero" className="font-display text-[2.5rem] leading-[1.08] sm:text-[3.25rem] lg:text-[4rem]">
              Gastro führen mit <span className="text-accent">echten Zahlen.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base text-text-muted lg:text-lg lg:font-normal">
              Für Inhaber und Betriebsleitungen in der Gastronomie: sieh jeden Monat, welche Artikel Geld bringen, wo die
              Warenquote über deinem Ziel liegt und was nachbestellt werden muss. Aus deinen Kassen- und Einkaufsdaten.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#anfrage" className={ctaLight}>{CTA_PRIMARY} <ArrowRight aria-hidden className="size-4" /></a>
              <Link href={SUITE} className={ctaQuiet}>{CTA_DEMO}</Link>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-muted">
              {["Demo ohne Anmeldung", "Beispieldaten klar markiert", "Im Browser und als App"].map((x) => (
                <li key={x} className="flex items-center gap-1.5"><Check aria-hidden className="size-4 text-accent" />{x}</li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <figure className="overflow-hidden rounded-md border border-border bg-surface-raised">
              <Image src={shotOverview} alt="Dashboard der GLB AI Suite: Netto-Umsatz 22.766 Euro, DB II, Wareneinsatzquote und verkaufte Einheiten, mit Beispieldaten." placeholder="blur" priority className="h-auto w-full" sizes="(min-width: 1024px) 760px, 100vw" />
            </figure>
            <figure className="absolute -bottom-10 -left-6 hidden w-36 overflow-hidden rounded-md border-4 border-text sm:block lg:w-44">
              <Image src={shotMobile} alt="Die Suite auf dem Handy." placeholder="blur" className="h-auto w-full" sizes="176px" />
            </figure>
          </div>
        </section>
      </div>

      {/* the first questions of a buyer, answered before any feature list */}
      <section aria-labelledby="answers" className="border-b border-border bg-surface">
        <div className="mx-auto max-w-(--size-content-max) px-4 py-14 lg:px-8">
          <h2 id="answers" className="font-display text-[1.75rem] leading-tight lg:text-[2.25rem]">Kurz beantwortet</h2>
          <dl className="mt-8 grid gap-x-10 gap-y-6 md:grid-cols-2 lg:grid-cols-5">
            {ANSWERS.map((x) => (
              <div key={x.q} className="border-t-2 border-accent pt-4">
                <dt className="font-semibold">{x.q}</dt>
                <dd className="mt-2 text-sm text-text-muted">{x.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <main>
        {/* ------------------------------------------------ use cases */}
        <section id="alltag" aria-labelledby="usecases" className="mx-auto max-w-(--size-content-max) px-4 py-20 lg:px-8 lg:py-28">
          <Reveal>
            <p className="text-sm font-bold uppercase tracking-wide text-accent">Aus dem Betriebsalltag</p>
            <h2 id="usecases" className="font-display mt-3 max-w-3xl text-[2rem] leading-tight lg:text-[2.75rem]">Vier Fragen, die jede Woche kommen.</h2>
            <p className="mt-4 max-w-2xl text-base text-text-muted">Jede Antwort ist eine echte Ansicht der Suite, aufgenommen mit ihren Beispieldaten.</p>
          </Reveal>
          <ol className="mt-14 flex flex-col">
            {USE_CASES.map((u, i) => (
              <li key={u.question} className="grid gap-8 border-t border-border py-12 lg:grid-cols-[4fr_7fr] lg:gap-16">
                <Reveal>
                  <p className="text-sm font-semibold text-text-muted"><span className="num mr-2 text-accent">0{i + 1}</span>{u.when}</p>
                  <h3 className="font-display mt-3 text-[1.625rem] leading-snug">{u.question}</h3>
                  <p className="mt-3 text-base text-text-muted">{u.answer}</p>
                </Reveal>
                <Reveal delay={100}>
                  <figure className="overflow-hidden rounded-md border border-border bg-surface-raised">
                    <Image src={u.shot} alt={u.alt} placeholder="blur" className="h-auto w-full" sizes="(min-width: 1024px) 760px, 100vw" />
                  </figure>
                </Reveal>
              </li>
            ))}
          </ol>
        </section>

        {/* ------------------------------------------------ video walkthrough */}
        <section id="rundgang" aria-labelledby="tour" className="border-y border-border bg-surface">
          <div className="mx-auto grid max-w-(--size-content-max) items-center gap-12 px-4 py-20 lg:grid-cols-[4fr_7fr] lg:px-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-accent">Rundgang</p>
              <h2 id="tour" className="font-display mt-3 text-[2rem] leading-tight lg:text-[2.75rem]">Die Suite in 26 Sekunden</h2>
              <p className="mt-4 max-w-lg text-base text-text-muted">
                Report Studio, Service Funnel, Renner-Penner, Deckungsbeiträge, Lebenszyklen, Mein Markt, Bestell-Forecast und GLB Intelligence,
                aufgenommen in der Suite mit ihren Beispieldaten.
              </p>
              <div className="mt-8"><Link href={SUITE} className={cta}>Selbst ausprobieren <ArrowRight aria-hidden className="size-4" /></Link></div>
            </div>
            <figure className="overflow-hidden rounded-md border border-border bg-surface-raised">
              <video controls muted playsInline preload="metadata" poster="/landing/suite-reports.png" className="h-auto w-full" aria-label={`Rundgang durch die ${APP_NAME}, ohne Ton`}>
                <source src="/landing/suite-rundgang.mp4" type="video/mp4" />
                <track kind="captions" src="/landing/suite-rundgang.vtt" srcLang="de" label="Deutsch" default />
              </video>
              <figcaption className="border-t border-border px-4 py-2 text-xs text-text-muted">Ohne Ton. Untertitel nennen das jeweilige Modul.</figcaption>
            </figure>
          </div>
        </section>

        {/* ------------------------------------------------ spotlights */}
        <section id="funktionen" aria-labelledby="features">
          <div className="mx-auto max-w-(--size-content-max) px-4 py-20 lg:px-8 lg:py-28">
            <Reveal>
              <p className="text-sm font-bold uppercase tracking-wide text-accent">Funktionen</p>
              <h2 id="features" className="font-display mt-3 max-w-3xl text-[2rem] leading-tight lg:text-[2.75rem]">Vom Service bis zum Ergebnis.</h2>
            </Reveal>
            <div className="mt-14 flex flex-col gap-20">
              {SPOTLIGHTS.map((n, i) => (
                <article key={n.title} aria-labelledby={`spot-${i}`} className="grid items-center gap-8 lg:grid-cols-[5fr_7fr] lg:gap-16">
                  <Reveal className={i % 2 ? "lg:order-2" : ""}>
                    <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-accent"><n.icon aria-hidden className="size-4" />{n.kicker}</p>
                    <h3 id={`spot-${i}`} className="font-display mt-3 text-[1.625rem] leading-snug">{n.title}</h3>
                    <p className="mt-3 text-base text-text-muted">{n.body}</p>
                    <ul className="mt-5 flex flex-col gap-2">
                      {n.points.map((p) => <li key={p} className="flex gap-2"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />{p}</li>)}
                    </ul>
                  </Reveal>
                  <Reveal delay={100}>
                    <figure className="overflow-hidden rounded-md border border-border bg-surface-raised">
                      <Image src={n.shot} alt={n.alt} placeholder="blur" className="h-auto w-full" sizes="(min-width: 1024px) 700px, 100vw" />
                    </figure>
                  </Reveal>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ module index: a list, not a card grid */}
        <section aria-labelledby="modules" className="border-y border-border bg-surface">
          <div className="mx-auto max-w-(--size-content-max) px-4 py-20 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-accent">Alles drin</p>
                <h2 id="modules" className="font-display mt-3 max-w-2xl text-[2rem] leading-tight lg:text-[2.75rem]">Ein Board statt zehn Listen</h2>
              </div>
              <p className="max-w-sm text-text-muted">Alle Bereiche der {APP_NAME}, gegliedert wie das Menü in der App.</p>
            </div>
            <dl className="mt-10 flex flex-col divide-y divide-border border-y border-border">
              {AREAS.map(([area, pages]) => (
                <div key={area} className="grid gap-1 py-4 sm:grid-cols-[14rem_1fr] sm:gap-6">
                  <dt className="font-semibold">{area}</dt>
                  <dd className="text-text-muted">{pages}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ------------------------------------------------ roles */}
        <section id="rollen" aria-labelledby="roles" className="border-t border-border">
          <div className="mx-auto grid max-w-(--size-content-max) items-center gap-12 px-4 py-20 lg:grid-cols-[7fr_4fr] lg:px-8">
            <div>
              <Reveal>
                <p className="text-sm font-bold uppercase tracking-wide text-accent">Rollen</p>
                <h2 id="roles" className="font-display mt-3 max-w-2xl text-[2rem] leading-tight lg:text-[2.75rem]">Jeder sieht, was er braucht</h2>
                <p className="mt-4 max-w-xl text-text-muted">Service und Sales arbeiten mit Quoten und Absatz, ohne Einkaufspreise und Fixkosten zu sehen. Die Leitung sieht das ganze Bild.</p>
              </Reveal>
              <ul className="mt-8 flex flex-col divide-y divide-border border-y border-border">
                {ROLES.map(([role, scope]) => (
                  <li key={role} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-4">
                    <span className="flex items-center gap-2 font-semibold sm:w-60 sm:shrink-0"><Users aria-hidden className="size-4 text-accent" />{role}</span>
                    <span className="text-sm text-text-muted">{scope}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Reveal delay={100} className="mx-auto w-64">
              <figure className="overflow-hidden rounded-lg border-8 border-text">
                <Image src={shotMobile} alt="Die Suite auf dem Handy: Übersicht mit Netto-Umsatz und Berichtsfilter." placeholder="blur" className="h-auto w-full" sizes="256px" />
              </figure>
            </Reveal>
          </div>
        </section>

        {/* ------------------------------------------------ trust, facts only */}
        <section aria-labelledby="facts" className="border-y border-border bg-surface">
          <div className="mx-auto max-w-(--size-content-max) px-4 py-20 lg:px-8">
            <Reveal>
              <p className="text-sm font-bold uppercase tracking-wide text-accent">Verlässlich</p>
              <h2 id="facts" className="font-display mt-3 max-w-2xl text-[2rem] leading-tight lg:text-[2.75rem]">Worauf du dich verlassen kannst</h2>
            </Reveal>
            <ul className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {FACTS.map(({ icon: Icon, title, body }) => (
                <li key={title} className="border-t border-border pt-5">
                  <h3 className="flex items-center gap-2 text-lg"><Icon aria-hidden className="size-5 shrink-0 text-accent" />{title}</h3>
                  <p className="mt-2 text-text-muted">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------ pricing */}
        <section id="preise" aria-labelledby="pricing">
          <div className="mx-auto max-w-(--size-content-max) px-4 py-20 lg:px-8">
            <h2 id="pricing" className="font-display text-[2rem] leading-tight lg:text-[2.75rem]">Preise</h2>
            <p className="mt-3 max-w-3xl rounded-md border border-border bg-surface px-4 py-3 text-sm text-text-muted" role="note">{PLANS_PRELIMINARY_NOTE}</p>
            <p className="mt-4 max-w-3xl text-text-muted">Standard ist der Einstieg. Premium kostet {eur(PLANS[1].baseMonthly - PLANS[0].baseMonthly)} mehr Grundpreis im Monat und ergänzt die Module zur Steuerung von Sortiment, Preisen und Service; der Preis je Nutzer ist gleich. Individuelle Lösungen sind ein eigener Weg für Anforderungen außerhalb dieser Module.</p>
            <div className="mt-10 grid items-start gap-6 lg:grid-cols-3">
              {PLANS.map((p) => {
                const d = PLAN_DETAILS[p.id];
                const premium = p.id === "premium";
                return (
                  <article key={p.id} data-plan-card={p.id} aria-labelledby={`plan-${p.id}`} className={premium ? "rounded-md border-2 border-accent bg-surface-raised p-6 lg:p-8" : "rounded-md border border-border bg-surface-raised p-6 lg:p-8"}>
                    {premium && <p className="mb-3 inline-flex rounded-pill bg-accent px-3 py-1 text-xs font-bold text-on-accent">Empfehlung für aktive Betriebssteuerung</p>}
                    <h3 id={`plan-${p.id}`} className="text-lg">{p.name}</h3>
                    <p className="num font-display mt-4 text-[2.5rem] leading-none">{eur(p.baseMonthly)}</p>
                    <p className="mt-2 text-sm text-text-muted">pro Kunde und Monat</p>
                    <p className="mt-3 flex gap-2 text-sm"><Plus aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />zuzüglich {eur(p.perUserMonthly)} pro Nutzer und Monat</p>
                    {premium && <p className="mt-3 text-sm text-text-muted">{eur(p.baseMonthly - PLANS[0].baseMonthly)} mehr als Standard – für die vier zusätzlichen Module unten.</p>}
                    <dl className="mt-6 flex flex-col gap-4 text-sm">
                      <div><dt className="font-bold">Für wen</dt><dd className="mt-1 text-text-muted">{d.who}</dd></div>
                      <div><dt className="font-bold">Welches Problem</dt><dd className="mt-1 text-text-muted">{d.problem}</dd></div>
                      <div>
                        <dt className="font-bold">Vorgeschlagener Umfang</dt>
                        <dd className="mt-1"><ul className="flex flex-col gap-1">{d.modules.map((m) => <li key={m} className="flex gap-2"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />{m}</li>)}</ul></dd>
                      </div>
                      <div><dt className="font-bold">Zum Start nötig</dt><dd className="mt-1 text-text-muted">{d.start}</dd></div>
                      <div><dt className="font-bold">Nicht automatisch angebunden</dt><dd className="mt-1 text-text-muted">{d.manual}</dd></div>
                    </dl>
                  </article>
                );
              })}
              <article data-plan-card="individual" aria-labelledby="plan-individual" className="rounded-md border border-border border-t-4 border-t-text bg-surface-raised p-6 lg:p-8">
                <h3 id="plan-individual" className="text-lg">Individuelle Lösungen</h3>
                <p className="font-display mt-4 text-[1.5rem] leading-tight">Entwicklungsgebühr nach vereinbartem Umfang</p>
                <p className="mt-2 text-sm text-text-muted">einmalig, Umfang und Betrag vorab schriftlich festgelegt</p>
                <p className="mt-3 flex gap-2 text-sm"><Plus aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />danach {eur(INDIVIDUAL.serviceMonthly)} pro Monat</p>
                <dl className="mt-6 flex flex-col gap-4 text-sm">
                  <div><dt className="font-bold">Für wen</dt><dd className="mt-1 text-text-muted">Betriebe mit Anforderungen, die Standard und Premium nicht abdecken.</dd></div>
                  <div><dt className="font-bold">Was die {eur(INDIVIDUAL.serviceMonthly)} abdecken</dt><dd className="mt-1 text-text-muted">Umfang und Grenzen der laufenden Leistung werden vor Vertragsschluss schriftlich festgelegt. Eine unbegrenzte Weiterentwicklung ist nicht enthalten.</dd></div>
                  <div><dt className="font-bold">Zum Start nötig</dt><dd className="mt-1 text-text-muted">Ein Gespräch über Anforderung, Daten und Abgrenzung; daraus ein schriftliches Angebot.</dd></div>
                </dl>
                <a href="#anfrage" className="mt-6 inline-flex min-h-11 items-center font-semibold text-accent underline">Anforderung besprechen →</a>
              </article>
            </div>
            <PriceCalculator />
            <p className="mt-6 text-sm text-text-muted">Die Demo ist kostenlos und ohne Anmeldung. Mehr Übersicht oder Ergebnis durch Premium ist eine Annahme, die du mit deinen eigenen Daten prüfen solltest, kein Versprechen.</p>
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
            <div className="mt-8 flex flex-wrap justify-center gap-3"><a href="#anfrage" className={cta}>{CTA_PRIMARY} <ArrowRight aria-hidden className="size-4" /></a><Link href={SUITE} className={ctaQuiet}>{CTA_DEMO}</Link></div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
