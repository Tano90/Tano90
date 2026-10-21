// Screen inventory from replica/recon.md. Used by stub pages, the nav and the screenshot script.
export type Screen = { id: string; title: string; route: string; purpose: string; built: boolean };

export const SCREENS: Screen[] = [
  { id: "S01", title: "Anmeldung", route: "/login", purpose: "Anmelden", built: true },
  { id: "S02", title: "Übersicht", route: "/app", purpose: "Kennzahlen und offene Aufgaben auf einen Blick", built: true },
  { id: "S03", title: "Zutaten", route: "/ingredients", purpose: "Zutaten suchen, filtern, anlegen", built: true },
  { id: "S04", title: "Zutat", route: "/ingredients/ing-zwiebeln", purpose: "Stammdaten, Gebinde, Lieferantenpreise, Allergene", built: true },
  { id: "S05", title: "Rezepte", route: "/recipes", purpose: "Rezepte mit Kosten und Wareneinsatz", built: true },
  { id: "S06", title: "Rezept", route: "/recipes/rec-linsensuppe", purpose: "Rezept bauen und kalkulieren", built: true },
  { id: "S07", title: "Menüs", route: "/menus", purpose: "Menüs mit Gängen verwalten", built: true },
  { id: "S08", title: "Menü", route: "/menus/new", purpose: "Menü aus Gängen bauen, Zielmarge prüfen", built: true },
  { id: "S09", title: "Etikett & Stückliste", route: "/recipes/rec-linsensuppe/label", purpose: "Allergen- und Nährwertetikett, Stückliste", built: true },
  { id: "S10", title: "Lieferanten", route: "/suppliers", purpose: "Lieferanten verwalten", built: true },
  { id: "S11", title: "Lieferant", route: "/suppliers/sup-frische", purpose: "Kontakt, Bestellweg, Sortiment", built: true },
  { id: "S12", title: "Bestellungen", route: "/orders", purpose: "Entwürfe, offene und gelieferte Bestellungen pro Outlet", built: true },
  { id: "S13", title: "Neue Bestellung", route: "/orders/new", purpose: "Bestellung pro Lieferant mit Vorschlag aus Mindestbestand", built: true },
  { id: "S14", title: "Wareneingang", route: "/orders/po-2", purpose: "Lieferung erfassen, auch teilweise", built: true },
  { id: "S15", title: "Rechnungsabgleich", route: "/orders/po-1/invoice", purpose: "Bestellung, Lieferschein und Rechnung abgleichen", built: false },
  { id: "S16", title: "Lager", route: "/stock", purpose: "Bestand und Lagerwert pro Outlet", built: true },
  { id: "S17", title: "Inventur", route: "/stock/count", purpose: "Bestand zählen", built: true },
  { id: "S18", title: "Umbuchung", route: "/stock/transfer", purpose: "Ware zwischen Outlets verschieben", built: true },
  { id: "S19", title: "Schwund", route: "/stock/waste", purpose: "Verlust mit Grund buchen", built: true },
  { id: "S20", title: "Lagerbericht", route: "/stock/report", purpose: "Bewegungen und Bewertung", built: true },
  { id: "S21", title: "Kassen-Anbindung", route: "/analytics/pos", purpose: "Kassenartikel mit Rezepten verknüpfen", built: true },
  { id: "S22", title: "Menu Engineering", route: "/analytics/menu-engineering", purpose: "Beliebtheit und Marge pro Gericht", built: true },
  { id: "S23", title: "Produktion", route: "/production", purpose: "Zentralküche: Aufträge und Produktionsplan", built: false },
  { id: "S24", title: "Einstellungen", route: "/settings", purpose: "Mehrwertsteuer, Lohnkosten, Name des Betriebs", built: true },
  { id: "S25", title: "Outlets & Team", route: "/settings/team", purpose: "Standorte, Einladungen, Rollen", built: true },
  { id: "S26", title: "Import", route: "/imports", purpose: "Preise und Gebinde per Excel", built: false },
  { id: "S27", title: "HACCP", route: "/haccp", purpose: "Checklisten und Kontrollpunkte", built: false },
];

export const screen = (id: string) => SCREENS.find((s) => s.id === id)!;
