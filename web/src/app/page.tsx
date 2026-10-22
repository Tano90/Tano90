import { ArrowRight, BarChart3, Boxes, Calculator, Check, ChefHat, Download, Filter, Gauge, GraduationCap, LineChart, ListChecks, MapPin, PackageSearch, Plus, Receipt, ScanLine, ShieldCheck, ShoppingCart, Smartphone, Sparkles, Store, Upload, Users } from "lucide-react";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LeadForm, ViewBeacon } from "@/components/landing/lead-form";
import { CountUp, Reveal } from "@/components/landing/motion";
import { SiteFooter } from "@/components/landing/site-chrome";
import { APP_NAME } from "@/lib/brand";
import { formatCents } from "@/lib/format";
import { PRICE_TAX_NOTE } from "@/lib/legal";
import { PRICING } from "@/lib/pricing";
import shotCosts from "../../public/landing/suite-costs.png";
import shotFunnel from "../../public/landing/suite-funnel.png";
import shotInsights from "../../public/landing/suite-insights.png";
import shotInventory from "../../public/landing/suite-inventory.png";
import shotLifecycle from "../../public/landing/suite-lifecycle.png";
import shotMarket from "../../public/landing/suite-market.png";
import shotMenuImport from "../../public/landing/suite-menuimport.png";
import shotMobile from "../../public/landing/suite-mobile.png";
import shotOverview from "../../public/landing/suite-overview.png";
import shotPortfolio from "../../public/landing/suite-portfolio.png";
import shotPurchasing from "../../public/landing/suite-purchasing.png";
import shotRecipes from "../../public/landing/suite-recipes.png";
import shotReports from "../../public/landing/suite-reports.png";
import shotV11Cockpit from "../../public/landing/suite-v11cockpit.png";
import shotV11Funnel from "../../public/landing/suite-v11funnel.png";
import shotV11Market from "../../public/landing/suite-v11market.png";
import shotV11Menu from "../../public/landing/suite-v11menu.png";
import shotV11Tasks from "../../public/landing/suite-v11tasks.png";
import shotV11Training from "../../public/landing/suite-v11training.png";

// Public landing page. Static: no session lookup, so it is fast and cacheable.
// Only what the GLB AI Suite (public/suite, v0.8 modules plus v1.1 Intelligence Center) does today.
// Every screenshot shows its built-in example data.
// No testimonials, logos or user counts until there are real ones.

const SUITE = "/suite";
const cta = "inline-flex h-(--size-control-lg) items-center gap-2 rounded-pill bg-saffron px-6 text-base font-bold text-on-saffron transition-transform duration-fast hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron";
const ctaLight = "inline-flex h-(--size-control-lg) items-center gap-2 rounded-pill bg-accent px-6 text-base font-bold text-on-accent shadow-glow transition-transform duration-fast hover:-translate-y-0.5 hover:bg-accent-hover";
const eur = (cents: number) => formatCents(cents).replace(",00", "");

type Spotlight = { icon: typeof BarChart3; kicker: string; title: string; body: string; points: string[]; shot: StaticImageData; alt: string };
// The big modules, each with a screenshot.
const SPOTLIGHTS: Spotlight[] = [
  {
    icon: BarChart3, kicker: "Management Reporting", title: "GLB Report Studio",
    body: "Alle betriebswirtschaftlichen Kennzahlen an einem Ort: Performance, Sortiment und Rezepte, Service und Conversion, Lager und Einkauf.",
    points: ["Filter nach Zeitraum, Outlet und Warengruppe", "ABC-Analyse, Outlet-, Artikel-, Funnel-, Kosten- und Lagerberichte", "Ansichten speichern, Export als CSV oder Excel mit Zeitraum, Einheiten und Rechengrundlage, Drucken oder als PDF"],
    shot: shotReports, alt: "GLB Report Studio mit Berichtsfilter, Reitern Performance, Sortiment und Rezepte, Service und Conversion, Lager und Einkauf sowie Kacheln für Netto-Umsatz, DB II, Wareneinsatzquote und Absatz.",
  },
  {
    icon: Filter, kicker: "Service & Verkauf", title: "Service Funnel & Sales Forecast",
    body: "Taggenau erfassen, wie oft der Service Aperitif, Wasser, Upgrades, Beilagen, Desserts und Kaffee verkauft, und sehen, was eine höhere Quote bringt.",
    points: ["Zielquote je 100 Gäste für jede Stufe", "Schieberegler für Conversion und Gästeentwicklung", "Hochrechnung auf den Monat für Umsatz und DB II, getrennt vom echten Umsatz"],
    shot: shotFunnel, alt: "Service Funnel mit Schiebereglern je Stufe und Kacheln für Gäste, Szenario-Umsatzveränderung und DB-II-Veränderung.",
  },
  {
    icon: Calculator, kicker: "Profit Engineering", title: "Deckungsbeiträge & Zielpreise",
    body: "Monatskosten einmal erfassen, und die Kalkulation zeigt für jeden Artikel den aktuellen und den erforderlichen Verkaufspreis nebeneinander.",
    points: ["DB I und DB II je Artikel", "Monatliche Kosten und Zielbetriebsergebnis", "Kostenstände mit Datum: vergangene Monate mit den damals gültigen Kosten"],
    shot: shotCosts, alt: "Deckungsbeiträge und Zielpreise mit Eingabe der Monatskosten und Kacheln für Nettoumsatz, Fixkostenquote und Zielpreis.",
  },
  {
    icon: LineChart, kicker: "Menu Engineering", title: "Renner-Penner & Aktionsplan",
    body: "Jedes Produkt in der Matrix aus Absatz und Deckungsbeitrag, mit priorisierten Schritten, was du im Betrieb als Nächstes testen kannst.",
    points: ["Vergleich innerhalb des Sortiments, einer Warengruppe oder Oberkategorie", "Konkrete Maßnahmen je Artikel", "Preis-Szenarien für ausgewählte Artikel"],
    shot: shotPortfolio, alt: "Renner-Penner-Matrix mit Produkten als Punkte in vier Feldern und daneben eine Liste priorisierter Schritte.",
  },
  {
    icon: Receipt, kicker: "Kassenbons", title: "Tagesfunnel aus Kassendaten",
    body: "Aus einzelnen Bonpositionen: Wie viele Bons enthalten einen Aperitif, Wasser, ein Upgrade, ein Dessert, Kaffee oder einen After-Glow-Abschluss?",
    points: ["Kaufquote je Bon für sechs unabhängige Themen, Gäste nur bei vollständiger Angabe", "Zielquoten und vorsichtige Szenarien, ohne garantierte Gewinne", "Import per CSV mit Positions-ID, Storno und Erkennung von Überschneidungen"],
    shot: shotV11Funnel, alt: "Tagesfunnel mit Kacheln für Bons, Gäste, Bruttoverkauf und Deckungsbeitrag I sowie Balken je Thema mit Zielmarke.",
  },
  {
    icon: GraduationCap, kicker: "Team", title: "Funnel Quest – Training",
    body: "Kurze Verkaufstrainings zu den sechs Themen: Lernhinweis, Frage, Rückmeldung und Punkte. Die Schulungspriorität kommt aus den Kassenbons.",
    points: ["100 Punkte je richtiger Antwort, ein Versuch je Thema und Tag", "Ergebnisse sieht nur die Person selbst, kein Ranking, keine Bewertung", "Schulung direkt als Aufgabe für das Team anlegen"],
    shot: shotV11Training, alt: "Funnel Quest mit Punkten, Stufe, sechs Missionen und einer Frage mit drei Antworten.",
  },
];

// Further modules: a smaller card each, also with a screenshot.
const MODULES: { icon: typeof BarChart3; title: string; body: string; shot: StaticImageData; alt: string }[] = [
  { icon: Gauge, title: "Arbeitsplatz, Mission Control & Dashboard", body: "Aufgaben aus deinen Daten im Arbeitsplatz, Einrichtung und Datenqualität in Mission Control, Netto-Umsatz, DB II und Wareneinsatz im Dashboard.", shot: shotOverview, alt: "Dashboard mit Berichtsfilter, Netto-Umsatz, DB II, Wareneinsatzquote und Absatz." },
  { icon: Sparkles, title: "Produktlebenszyklen", body: "Einführung, Wachstum, Reife oder Rückgang je Artikel, ab vier zusammenhängenden Monaten.", shot: shotLifecycle, alt: "Produktlebenszyklus mit Phasen und Einzelanalyse eines Artikels." },
  { icon: MapPin, title: "Mein Markt", body: "Wettbewerber im Umkreis über OpenStreetMap finden und Preise von Hand vergleichen.", shot: shotMarket, alt: "Mein Markt mit Standortangaben und Suche nach Betrieben im Radius." },
  { icon: ShoppingCart, title: "Bestell-Forecast", body: "Aus dem Absatz der letzten 7 oder 28 Tage über die Rezepte zum Rohwarenbedarf und zu Bestellgebinden.", shot: shotPurchasing, alt: "Bestell-Forecast mit Kacheln für Tage, Bestellwert und Szenario-Einstellungen." },
  { icon: Boxes, title: "Inventur & Lager", body: "Mehrere Lager, mobile Zählmaske, Warenbewegungen, Transfer, Schwund und Wareneingang.", shot: shotInventory, alt: "Inventur und Lagerverwaltung mit Beständen je Rohware." },
  { icon: ChefHat, title: "Rezepte & Rohwaren", body: "Zutaten, Gebinde und Einheiten, Kosten je Portion, Import von Rezepten und Rohwaren per CSV.", shot: shotRecipes, alt: "Rezepturen und Rohwaren mit Kosten je Rezept und Rohwarenstamm." },
  { icon: Upload, title: "Speisekarten-Import", body: "CSV, Text oder textbasierte PDF einlesen; Steuersatz nach Speisen und Getränken vorbelegt, unsichere Positionen markiert, vor dem Speichern korrigierbar.", shot: shotMenuImport, alt: "Speisekarten-Import mit Upload-Feld, Texteingabe und Vorschau." },
  { icon: Gauge, title: "Management-Cockpit", body: "Brutto- und Nettoumsatz, Deckungsbeitrag I und Wareneinsatzquote nach Outlet und Monat; fehlende Kosten werden als unvollständig gezeigt, nicht geschätzt.", shot: shotV11Cockpit, alt: "Management-Cockpit mit vier Kennzahlen, Monatsdiagramm und regelbasierten Hinweisen." },
  { icon: LineChart, title: "Menu Engineering", body: "Stars, Renner, Puzzle und Penner nach Absatz und DB I je Einheit; fehlender Wareneinsatz lässt sich bewusst nachtragen.", shot: shotV11Menu, alt: "Menu Engineering mit Klassen je Artikel, Empfehlungen und Berechnungsgrundlage." },
  { icon: ListChecks, title: "Team & Aufgaben, Mindestbestände", body: "Maßnahmen mit Priorität und Fälligkeit für alle Rollen; einfache Mindestbestandsliste mit Bestellvorschlag Ziel minus Ist, neben dem Forecast.", shot: shotV11Tasks, alt: "Team und Aufgaben mit Aufgabenliste und Formular für neue Aufgaben." },
  { icon: MapPin, title: "KI-Marktcheck", body: "Preise der Konkurrenz mit Quelle und Prüfdatum vergleichen, Umfeld per OpenStreetMap finden. Die KI-Einordnung ist optional und braucht einen eigenen Schlüssel auf dem Server.", shot: shotV11Market, alt: "KI-Marktcheck mit Formular für Preisbeobachtungen, Umfeldsuche und Preisvergleich." },
  { icon: ScanLine, title: "GLB Intelligence", body: "Regelbasierte Hinweise und Handlungsempfehlungen. Vorschläge, keine Automatik: du entscheidest.", shot: shotInsights, alt: "GLB Intelligence mit Handlungsempfehlungen und Analysegrundlage." },
];

const TICKER = ["Management-Cockpit", "Tagesfunnel", "Funnel Quest", "Menu Engineering", "KI-Marktcheck", "Report Studio", "Mission Control", "Service Funnel", "Deckungsbeiträge", "Zielpreise", "Renner-Penner", "Lebenszyklen", "Mein Markt", "Speisekarten-Import", "Rezepte & Rohwaren", "Inventur & Lager", "Bestell-Forecast", "7 Rollen", "App fürs Handy"];

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
  { icon: PackageSearch, title: "Beispieldaten klar markiert", body: "Zum Ausprobieren gibt es Beispieldaten, die überall als solche gekennzeichnet sind." },
  { icon: Sparkles, title: "Vorschläge statt Automatik", body: "Empfehlungen und Szenarien helfen beim Entscheiden. Übernommen wird nur, was du bestätigst." },
  { icon: Store, title: "Mehrere Outlets", body: "Restaurant, Bar, Bankett oder Terrasse getrennt auswerten oder zusammen betrachten." },
];

const FAQ = [
  { q: "Wie kommen meine Daten hinein?", a: "Über den Datenimport: Speisekarten als CSV, Text oder textbasierte PDF, Rezepte, Rohwaren und Tagesabsätze als CSV. Vorlagen für jede Datei liegen in der Suite. Vor dem Übernehmen siehst du eine Vorschau und kannst korrigieren. Dieselbe Datei wird wiedererkannt und nicht doppelt gezählt." },
  { q: `Ist ${APP_NAME} mit meiner Kasse verbunden?`, a: "Es gibt keine fertige Anbindung an ein bestimmtes Kassensystem. Monatsverkäufe und einzelne Bonpositionen kommen per CSV-Export aus der Kasse. Für eine automatische Übertragung gibt es eine signierte Schnittstelle, an die ein Kassen- oder ETL-Dienst Positionen senden kann; das muss für deine Kasse eingerichtet werden." },
  { q: "Wer sieht welche Zahlen?", a: "Es gibt sieben Rollen von Geschäftsführung bis Mitarbeiter Küche. Service und Sales sehen keine Einkaufspreise und keine Fixkosten, die Küche keine Finanzberichte. Die Rechte prüft auch die Datenbank." },
  { q: "Funktioniert das auf dem Handy?", a: `Ja. ${APP_NAME} läuft im Browser und lässt sich als App installieren. Für Service und Küche gibt es eigene mobile Ansichten, etwa für die Tageszahlen im Funnel und die Inventur.` },
  { q: "Rechnet die KI für mich?", a: "Kennzahlen, Hinweise und Szenarien entstehen aus nachvollziehbaren Regeln auf deinen Zahlen. Nur der KI-Marktcheck kann optional eine KI um eine Einordnung bitten: Sie bekommt ausschließlich die von dir eingetragenen Preise mit Quelle, prüft keine Webseiten und ändert nichts. Dafür muss auf dem Server ein eigener API-Schlüssel eingerichtet sein." },
  { q: "Kann ich vorher ausprobieren?", a: `Ja. Über „Live ausprobieren“ öffnest du die Suite mit Beispieldaten. Für deinen eigenen Betrieb legst du in der Suite ein Konto an.` },
  { q: "Wo liegen meine Daten?", a: "In der Cloud-Datenbank von Supabase, getrennt pro Betrieb. Zusätzlich kannst du jederzeit ein Backup herunterladen." },
];

export default function LandingPage() {
  return (
    <div className="bg-bg">
      <ViewBeacon />

      {/* ------------------------------------------------ hero */}
      <div className="relative overflow-hidden bg-cream">
        <div aria-hidden className="pointer-events-none absolute -top-40 -right-40 size-[36rem] rounded-pill bg-[radial-gradient(closest-side,var(--color-accent-subtle),transparent)]" />
        <header className="relative mx-auto flex max-w-(--size-content-max) items-center justify-between px-4 py-5 lg:px-8">
          <Link href="/" aria-label={`${APP_NAME} Startseite`}><Logo /></Link>
          <nav aria-label="Konto" className="flex items-center gap-5">
            <a href="#rundgang" className="hidden font-semibold text-text-muted hover:text-text md:inline">Rundgang</a>
            <a href="#funktionen" className="hidden font-semibold text-text-muted hover:text-text md:inline">Funktionen</a>
            <a href="#rollen" className="hidden font-semibold text-text-muted hover:text-text lg:inline">Rollen</a>
            <a href="#preise" className="hidden font-semibold text-text-muted hover:text-text md:inline">Preise</a>
            <Link href={SUITE} className="font-semibold hover:underline">Anmelden</Link>
            <Link href={SUITE} className="hidden h-(--size-control-md) items-center rounded-pill bg-accent px-4 font-bold text-on-accent hover:bg-accent-hover sm:inline-flex">Kostenlos starten</Link>
          </nav>
        </header>

        <section aria-labelledby="hero" className="relative mx-auto grid max-w-(--size-content-max) items-center gap-10 px-4 pt-6 pb-16 lg:grid-cols-[5fr_7fr] lg:px-8 lg:pt-12 lg:pb-24">
          <div className="min-w-0 animate-rise">
            <a href="#funktionen" className="mb-5 inline-flex max-w-full items-center gap-2 rounded-pill border border-border bg-bg py-1 pr-3 pl-1 text-sm shadow-card hover:bg-row-hover">
              <span className="rounded-pill bg-accent px-2 py-0.5 text-xs font-bold text-on-accent">v0.8</span>
              <span className="truncate">Report Studio, Service Funnel, 7 Rollen, App fürs Handy</span>
              <ArrowRight aria-hidden className="size-4 shrink-0" />
            </a>
            <h1 id="hero" className="text-display lg:text-hero">
              Gastro führen mit <span className="relative isolate inline-block whitespace-nowrap text-accent">echten Zahlen.<span aria-hidden className="absolute inset-x-0 bottom-1 -z-10 h-4 -rotate-1 rounded-sm bg-saffron/70" /></span>
            </h1>
            <p className="mt-6 max-w-xl text-base text-text-muted lg:text-lg lg:font-normal">
              Das Gastro Leadership Board: Umsatz, Deckungsbeitrag, Service Funnel, Rezepte, Lager und Einkauf in einer Suite.
              Mit Reports für die Leitung und mobilen Ansichten für Service und Küche.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={SUITE} className={ctaLight}>Live ausprobieren <ArrowRight aria-hidden className="size-4" /></Link>
              <a href="#rundgang" className="inline-flex h-(--size-control-lg) items-center rounded-pill border border-border-input bg-bg px-6 text-base font-semibold hover:bg-row-hover">Rundgang ansehen</a>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-muted">
              {["Mit Beispieldaten sofort testen", "Ohne Kreditkarte", "Im Browser und als App"].map((x) => (
                <li key={x} className="flex items-center gap-1.5"><Check aria-hidden className="size-4 text-success" />{x}</li>
              ))}
            </ul>
          </div>
          <div className="relative animate-rise [animation-delay:150ms]">
            <figure className="overflow-hidden rounded-lg border border-border bg-surface shadow-pop">
              <Image src={shotOverview} alt="Dashboard der GLB AI Suite: Netto-Umsatz 22.766 Euro, DB II, Wareneinsatzquote und verkaufte Einheiten, mit Beispieldaten." placeholder="blur" priority className="h-auto w-full" sizes="(min-width: 1024px) 760px, 100vw" />
            </figure>
            <figure className="absolute -bottom-10 -left-6 hidden w-36 overflow-hidden rounded-lg border-4 border-ink shadow-pop sm:block lg:w-44">
              <Image src={shotMobile} alt="Die Suite auf dem Handy." placeholder="blur" className="h-auto w-full" sizes="176px" />
            </figure>
          </div>
        </section>
      </div>

      <div aria-hidden className="overflow-hidden bg-accent py-4">
        <div className="flex w-max animate-marquee gap-10 whitespace-nowrap text-sm font-semibold text-on-accent">
          {[...TICKER, ...TICKER].map((t, i) => <span key={i} className="flex items-center gap-10">{t}<span className="size-1.5 rounded-pill bg-saffron" /></span>)}
        </div>
      </div>

      <main>
        {/* ------------------------------------------------ video walkthrough */}
        <section id="rundgang" aria-labelledby="tour" className="relative overflow-hidden bg-ink text-on-ink">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_85%_20%,var(--color-accent)_0%,transparent_70%)] opacity-70" />
          <div className="relative mx-auto grid max-w-(--size-content-max) items-center gap-12 px-4 py-20 lg:grid-cols-[4fr_7fr] lg:px-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-saffron">Rundgang</p>
              <h2 id="tour" className="mt-2 text-xl lg:text-display">Die Suite in 26 Sekunden</h2>
              <p className="mt-4 max-w-lg text-base text-on-ink-muted">
                Report Studio, Service Funnel, Renner-Penner, Deckungsbeiträge, Lebenszyklen, Mein Markt, Bestell-Forecast und GLB Intelligence,
                aufgenommen in der Suite mit ihren Beispieldaten.
              </p>
              <div className="mt-8"><Link href={SUITE} className={cta}>Selbst ausprobieren <ArrowRight aria-hidden className="size-4" /></Link></div>
            </div>
            <figure className="overflow-hidden rounded-lg border border-ink-raised shadow-pop">
              <video controls muted playsInline preload="metadata" poster="/landing/suite-reports.png" className="h-auto w-full" aria-label={`Rundgang durch die ${APP_NAME}, ohne Ton`}>
                <source src="/landing/suite-rundgang.mp4" type="video/mp4" />
                <track kind="captions" src="/landing/suite-rundgang.vtt" srcLang="de" label="Deutsch" default />
              </video>
              <figcaption className="bg-ink-raised px-4 py-2 text-xs text-on-ink-muted">Ohne Ton. Untertitel nennen das jeweilige Modul.</figcaption>
            </figure>
          </div>
        </section>

        {/* ------------------------------------------------ spotlights */}
        <section id="funktionen" aria-labelledby="features" className="bg-bg">
          <div className="mx-auto max-w-(--size-content-max) px-4 py-20 lg:px-8">
            <Reveal>
              <p className="text-sm font-bold uppercase tracking-wide text-accent">Funktionen</p>
              <h2 id="features" className="mt-2 max-w-3xl text-xl lg:text-display">Vom Service bis zum Ergebnis.</h2>
            </Reveal>
            <div className="mt-12 flex flex-col gap-20">
              {SPOTLIGHTS.map((n, i) => (
                <article key={n.title} aria-labelledby={`spot-${i}`} className="grid items-center gap-8 lg:grid-cols-[5fr_7fr] lg:gap-14">
                  <Reveal className={i % 2 ? "lg:order-2" : ""}>
                    <p className="inline-flex items-center gap-2 rounded-pill bg-accent-subtle px-3 py-1 text-xs font-bold text-accent"><n.icon aria-hidden className="size-4" />{n.kicker}</p>
                    <h3 id={`spot-${i}`} className="mt-3 text-xl">{n.title}</h3>
                    <p className="mt-2 text-base text-text-muted">{n.body}</p>
                    <ul className="mt-5 flex flex-col gap-2">
                      {n.points.map((p) => <li key={p} className="flex gap-2"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />{p}</li>)}
                    </ul>
                  </Reveal>
                  <Reveal delay={120}>
                    <figure className="overflow-hidden rounded-lg border border-border bg-surface shadow-pop">
                      <Image src={n.shot} alt={n.alt} placeholder="blur" className="h-auto w-full" sizes="(min-width: 1024px) 700px, 100vw" />
                    </figure>
                  </Reveal>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ module gallery */}
        <section aria-labelledby="modules" className="bg-cream">
          <div className="mx-auto max-w-(--size-content-max) px-4 py-20 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-accent">Alles drin</p>
                <h2 id="modules" className="mt-2 max-w-2xl text-xl lg:text-display">Ein Board statt zehn Listen</h2>
              </div>
              <p className="max-w-sm text-text-muted">Jede Karte ist ein Modul der {APP_NAME}, so wie es heute aussieht.</p>
            </div>
            <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {MODULES.map(({ icon: Icon, title, body, shot, alt }, i) => (
                <li key={title}><Reveal delay={(i % 4) * 80} className="h-full">
                  <article className="flex h-full flex-col overflow-hidden rounded-lg bg-bg shadow-card transition-transform duration-base hover:-translate-y-1">
                    <Image src={shot} alt={alt} placeholder="blur" className="h-auto w-full border-b border-border" sizes="(min-width: 1024px) 300px, (min-width: 640px) 50vw, 100vw" />
                    <div className="flex flex-1 flex-col gap-2 p-5">
                      <span className="inline-flex size-10 items-center justify-center rounded-md bg-accent-subtle text-accent"><Icon aria-hidden className="size-5" /></span>
                      <h3 className="text-lg">{title}</h3>
                      <p className="text-sm text-text-muted">{body}</p>
                    </div>
                  </article>
                </Reveal></li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------ numbers, all true of the product today */}
        <section aria-label="In Zahlen" className="bg-ink text-on-ink">
          <dl className="mx-auto grid max-w-(--size-content-max) grid-cols-2 gap-8 px-4 py-14 lg:grid-cols-4 lg:px-8">
            {[
              { value: SPOTLIGHTS.length + MODULES.length, suffix: "", label: "Module in einer Oberfläche" },
              { value: ROLES.length, suffix: "", label: "Rollen vom Service bis zur Geschäftsführung" },
              { value: 6, suffix: "", label: "Stufen im Service Funnel" },
              { value: 28, suffix: " Tage", label: "Absatz als Grundlage für den Bestell-Forecast" },
            ].map((x) => (
              <div key={x.label} className="flex flex-col-reverse justify-end gap-1">
                <dt className="text-sm text-on-ink-muted">{x.label}</dt>
                <dd className="num text-display text-saffron"><CountUp value={x.value} suffix={x.suffix} /></dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ------------------------------------------------ roles */}
        <section id="rollen" aria-labelledby="roles" className="mx-auto max-w-(--size-content-max) px-4 py-20 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-[7fr_4fr]">
            <div>
              <Reveal>
                <p className="text-sm font-bold uppercase tracking-wide text-accent">Rollen</p>
                <h2 id="roles" className="mt-2 max-w-2xl text-xl lg:text-display">Jeder sieht, was er braucht</h2>
                <p className="mt-3 max-w-xl text-text-muted">Service und Sales arbeiten mit Quoten und Absatz, ohne Einkaufspreise und Fixkosten zu sehen. Die Leitung sieht das ganze Bild.</p>
              </Reveal>
              <ul className="mt-8 flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
                {ROLES.map(([role, scope]) => (
                  <li key={role} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-baseline sm:gap-4">
                    <span className="flex items-center gap-2 font-semibold sm:w-60 sm:shrink-0"><Users aria-hidden className="size-4 text-accent" />{role}</span>
                    <span className="text-sm text-text-muted">{scope}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Reveal delay={120} className="mx-auto w-64">
              <figure className="overflow-hidden rounded-lg border-8 border-ink shadow-pop">
                <Image src={shotMobile} alt="Die Suite auf dem Handy: Übersicht mit Netto-Umsatz und Berichtsfilter." placeholder="blur" className="h-auto w-full" sizes="256px" />
              </figure>
            </Reveal>
          </div>
        </section>

        {/* ------------------------------------------------ trust, facts only */}
        <section aria-labelledby="facts" className="bg-surface">
          <div className="mx-auto max-w-(--size-content-max) px-4 py-20 lg:px-8">
            <Reveal>
              <p className="text-sm font-bold uppercase tracking-wide text-accent">Verlässlich</p>
              <h2 id="facts" className="mt-2 max-w-2xl text-xl lg:text-display">Worauf du dich verlassen kannst</h2>
            </Reveal>
            <ul className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {FACTS.map(({ icon: Icon, title, body }) => (
                <li key={title}>
                  <span className="inline-flex size-12 items-center justify-center rounded-md border-2 border-saffron text-accent"><Icon aria-hidden className="size-6" /></span>
                  <h3 className="mt-4 text-lg">{title}</h3>
                  <p className="mt-1 text-text-muted">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------ pricing */}
        <section id="preise" aria-labelledby="pricing" className="bg-bg">
          <div className="mx-auto max-w-(--size-content-max) px-4 py-20 lg:px-8">
            <h2 id="pricing" className="text-xl lg:text-display">Preise</h2>
            <p className="mt-2 text-text-muted">Alle Module in jedem Tarif. {PRICE_TAX_NOTE}</p>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-surface p-8">
                <h3 className="text-lg">Ein Betrieb</h3>
                <p className="mt-1 text-text-muted">Für das Restaurant, die Bar, das Café.</p>
                <p className="num mt-6 text-display">{eur(PRICING.firstOutletMonthly)} <span className="text-sm font-normal text-text-muted">pro Monat</span></p>
                <p className="text-xs font-normal text-text-muted">oder {eur(PRICING.firstOutletYearly)} pro Jahr (2 Monate geschenkt)</p>
                <ul className="mt-6 flex flex-col gap-2">
                  {["Report Studio und Mission Control", "Service Funnel, Deckungsbeiträge, Renner-Penner", "Rezepte, Inventur, Bestell-Forecast", "Alle 7 Rollen"].map((x) => (
                    <li key={x} className="flex gap-2"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />{x}</li>
                  ))}
                </ul>
              </div>
              <div className="relative rounded-lg bg-ink p-8 text-on-ink shadow-glow">
                <span className="absolute -top-3 right-6 rounded-pill bg-saffron px-3 py-1 text-xs font-bold text-on-saffron">für Gruppen</span>
                <h3 className="text-lg">Weitere Standorte</h3>
                <p className="mt-1 text-on-ink-muted">Für Gruppen und Betriebe mit mehreren Häusern.</p>
                <p className="num mt-6 text-display">+ {eur(PRICING.extraOutletMonthly)} <span className="text-sm font-normal text-on-ink-muted">pro weiterem Standort und Monat</span></p>
                <p className="text-xs font-normal text-on-ink-muted">oder {eur(PRICING.extraOutletYearly)} pro Jahr und Standort</p>
                <ul className="mt-6 flex flex-col gap-2">
                  {["Outlets einzeln und gesamt auswerten", "Mehrere Lager mit Transfer", "Rollen je Mitarbeiter"].map((x) => (
                    <li key={x} className="flex gap-2"><Plus aria-hidden className="mt-0.5 size-4 shrink-0 text-saffron" />{x}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ inquiry */}
        <section id="anfrage" aria-labelledby="lead" className="mx-auto max-w-(--size-content-max) px-4 py-20 lg:px-8">
          <div className="grid gap-10 rounded-lg border border-border bg-bg p-6 shadow-pop lg:grid-cols-[5fr_7fr] lg:p-10">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-accent">Vorführung</p>
              <h2 id="lead" className="mt-2 text-xl lg:text-display">Deine Zahlen im Board</h2>
              <p className="mt-3 text-text-muted">
                In einer halben Stunde importieren wir zusammen deine Speisekarte und einen Monat Verkäufe, und du siehst Renner,
                Penner und Deckungsbeiträge deines Betriebs.
              </p>
              <ul className="mt-6 flex flex-col gap-2 text-sm">
                {["30 Minuten, per Video oder bei euch", "Mit deiner echten Speisekarte", "Kostenlos und unverbindlich"].map((x) => (
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
            <h2 id="final" className="mx-auto max-w-3xl text-xl lg:text-display">Sieh deinen Betrieb so, wie die Zahlen ihn sehen.</h2>
            <div className="mt-8 flex justify-center"><Link href={SUITE} className={cta}>Live ausprobieren <ArrowRight aria-hidden className="size-4" /></Link></div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
