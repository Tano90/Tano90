// Pages per industry. Every feature named here exists in the app today; limits are said out loud.
import type { LucideIcon } from "lucide-react";
import { BedDouble, Calculator, ChefHat, ClipboardCheck, CookingPot, Package, ReceiptText, ScanBarcode, ShoppingCart, Tags, UtensilsCrossed, WifiOff } from "lucide-react";

import { formatCents } from "./format";
import { PRICING } from "./pricing";

const ADDON_PRICE = formatCents(PRICING.addonMonthly).replace(",00", "");

export type Industry = {
  slug: "hotel" | "restaurant" | "catering" | "kantine";
  name: string;
  title: string;
  lead: string;
  pains: string[];
  features: { icon: LucideIcon; title: string; body: string }[];
  note?: string;
  cards: { title: string; detail: string }[];
};

export const INDUSTRIES: Industry[] = [
  {
    slug: "hotel",
    name: "Hotel",
    title: "F&B und Housekeeping für Hotels. In einem Werkzeug.",
    lead: "Frühstück, Restaurant, Bankett und Bar als eigene Kostenstellen, die Küche kalkuliert live, und die Hausdame sieht jedes Zimmer auf einen Blick.",
    pains: [
      "Der Wareneinsatz pro Outlet kommt erst mit dem Monatsabschluss, zu spät zum Gegensteuern.",
      "Frühstück, Bankett und Restaurant greifen auf dasselbe Lager zu, und niemand weiß, wer was verbraucht hat.",
      "Zimmerstatus auf Zetteln und per Funk: Die Rezeption weiß nicht, ob das Zimmer für die Anreise fertig ist.",
    ],
    features: [
      { icon: Calculator, title: "F&B-Controlling je Kostenstelle", body: `Wareneinsatz je Outlet und Monat, wie die Buchhaltung ihn rechnet, mit Schwund, Inventurdifferenz, Umsatz und Quote. Export als CSV für die Buchhaltung. Add-on, ${ADDON_PRICE} im Monat.` },
      { icon: BedDouble, title: "Housekeeping", body: `Zimmertafel mit „Bitte nicht stören“, VIP und Anreisezeit, automatische Verteilung nach Minuten, Schäden und Fundsachen mit Foto, Minuten pro Zimmer. Dazu Wäschelager, Wäschebestellung aus der Belegung und Dienstplan. Add-on, ${ADDON_PRICE} im Monat.` },
      { icon: CookingPot, title: "Bankett aus der Zentralküche", body: "Outlets fordern an, die Produktion sieht pro Tag, was zu kochen ist und welche Rohware fehlt, und bucht sie aus." },
      { icon: UtensilsCrossed, title: "Frühstück und Menüs", body: "Buffet und Bankettmenüs mit Kosten pro Gast; die Stückliste rechnet auf die Gästezahl hoch, über alle Grundrezepte." },
      { icon: Tags, title: "Allergene fürs Buffet", body: "Allergene und Nährwerte pro Rezept, als Etikett druckbar. Ungeprüfte Zutaten machen ein Gericht „unbekannt“, nie „frei“." },
      { icon: ClipboardCheck, title: "HACCP pro Outlet", body: "Eigene Checklisten mit Grenzwerten für Küche, Bar und Frühstück; Abweichungen nur mit Maßnahme, Protokoll als CSV." },
    ],
    note: "Noch keine Anbindung an das Hotelprogramm (PMS): Die Belegung trägt die Hausdame ein. Mirepa ist keine Finanzbuchhaltung, sondern liefert ihr die F&B-Zahlen.",
    cards: [{ title: "Zimmer 214 kontrolliert", detail: "Anreise 15:00 · freigegeben" }, { title: "Frühstück: 23,4 %", detail: "Wareneinsatz Oktober" }],
  },
  {
    slug: "restaurant",
    name: "Restaurant",
    title: "Der echte Wareneinsatz, bevor die Karte gedruckt ist.",
    lead: "Für Restaurants mit einer oder mehreren Küchen: Rezepte rechnen beim Tippen, Preise kommen von der Lieferantenliste, und die Inventur ist in einer halben Stunde durch.",
    pains: [
      "Die Kalkulation stammt vom letzten Quartal; seitdem sind Butter, Fleisch und Fond teurer geworden.",
      "Bestellt wird nach Gefühl, gezählt wird auf Papier und abends abgetippt.",
      "Bei Allergenen verlässt sich der Service auf das Gedächtnis der Küche.",
    ],
    features: [
      { icon: ChefHat, title: "Kalkulation beim Tippen", body: "Kosten pro Portion, Wareneinsatz und Rohertrag neben dem Rezept, über Grundrezepte hinweg." },
      { icon: Package, title: "Preise aus Liste und E-Rechnung", body: "Excel, CSV oder die E-Rechnung des Lieferanten (XRechnung, ZUGFeRD), mit Vorschau jeder Zeile und Warnung bei Preissprüngen." },
      { icon: ShoppingCart, title: "Bestellen mit Vorschlag", body: "Aus Mindest- und Zielbestand; die Bestellung geht per Mail genau einmal an den Lieferanten." },
      { icon: ScanBarcode, title: "Inventur auf dem Handy", body: "In Kartons plus Rest oder per Barcode-Scanner, gespeichert auch ohne Netz." },
      { icon: Tags, title: "Allergene und Etiketten", body: "14 EU-Allergene pro Zutat, vererbt auf jedes Gericht, als Etikett druckbar." },
      { icon: Calculator, title: "Kasse und Menu Engineering", body: "Verkäufe per CSV oder Schnittstelle, Abbuchung über die Rezepte, und welches Gericht Renner oder Ladenhüter ist." },
    ],
    cards: [{ title: "Linsensuppe: 0,63 €", detail: "Wareneinsatz 8,5 %" }, { title: "Preisliste übernommen", detail: "12 Preise geändert" }],
  },
  {
    slug: "catering",
    name: "Catering",
    title: "Vom Angebot bis zur Rohware: jedes Menü durchgerechnet.",
    lead: "Für Caterer und Eventküchen: Menüs kalkulieren pro Gast, die Stückliste auf 80 oder 800 Gäste hochrechnen und die Produktion planen.",
    pains: [
      "Für jedes Angebot wird die Kalkulation neu zusammengesucht.",
      "Die Einkaufsliste für ein Event entsteht im Kopf, und am Tag fehlt dann doch etwas.",
      "Allergenangaben für Buffetkarten werden von Hand abgeschrieben.",
    ],
    features: [
      { icon: UtensilsCrossed, title: "Menüs pro Gast", body: "Gänge, Zielmarge und Kosten pro Gast; die Stückliste rechnet auf die Gästezahl hoch." },
      { icon: CookingPot, title: "Produktionsplan", body: "Anforderungen nach Liefertag gebündelt, mit Rohwarenbedarf und Fehlmengen." },
      { icon: Tags, title: "Buffetkarten mit Allergenen", body: "Etiketten mit Zutatenliste, Allergenen und Nährwerten aus dem Rezept." },
      { icon: ShoppingCart, title: "Bestellung aus dem Bedarf", body: "Was fehlt, geht als Bestellung an den passenden Lieferanten." },
      { icon: ReceiptText, title: "Rechnung gegen Lieferung", body: "Abweichungen bei Menge und Preis sind markiert, bevor bezahlt wird." },
      { icon: ClipboardCheck, title: "HACCP", body: "Temperaturen und Kontrollen mit Grenzwerten, Protokoll für die Kontrolle." },
    ],
    cards: [{ title: "Hochzeit, 120 Gäste", detail: "Kosten pro Gast 14,80 €" }, { title: "Rohware fehlt: 2", detail: "Sahne, Lachs" }],
  },
  {
    slug: "kantine",
    name: "Kantine",
    title: "Gemeinschafts\u00ADverpflegung mit festen Budgets.",
    lead: "Für Betriebsrestaurants, Mensen und Kantinen: Speisepläne mit Kosten pro Portion, Nährwerte und Allergene für jede Ausgabe, mehrere Standorte unter einem Dach.",
    pains: [
      "Das Budget pro Essen ist fest, aber die Einkaufspreise sind es nicht.",
      "Nährwerte und Allergene für jeden Tag werden mühsam zusammengestellt.",
      "Mehrere Ausgabestellen bestellen und zählen jede für sich.",
    ],
    features: [
      { icon: UtensilsCrossed, title: "Speisepläne mit Kosten", body: "Menüs mit Kosten pro Portion und Ziel-Wareneinsatz, live mit den aktuellen Einkaufspreisen." },
      { icon: Tags, title: "Nährwerte und Allergene", body: "Pro Rezept über alle Grundrezepte berechnet, als Aushang oder Etikett." },
      { icon: Package, title: "Große Gebinde", body: "Zutaten so, wie sie geliefert werden: Sack, Kanister, Karton, mit Umrechnung in Gramm und Liter." },
      { icon: WifiOff, title: "Inventur ohne Netz", body: "Im Kühlhaus zählen, gespeichert auch ohne WLAN." },
      { icon: CookingPot, title: "Zentralküche für Ausgabestellen", body: "Ausgabestellen fordern an, die Zentralküche produziert und verteilt die Kosten." },
      { icon: ClipboardCheck, title: "HACCP", body: "Tageskontrollen pro Standort, Abweichungen nur mit Maßnahme." },
    ],
    cards: [{ title: "Tagesessen: 2,14 €", detail: "Ziel 2,50 € pro Portion" }, { title: "Ausgabe Nord", detail: "Anforderung für morgen" }],
  },
];

export const industry = (slug: string) => INDUSTRIES.find((i) => i.slug === slug);
