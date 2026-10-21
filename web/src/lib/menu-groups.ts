// Names and advice for the four menu engineering groups; shared by the server page and the client chart.
import type { Group } from "@/domain/menu-engineering";

export const GROUPS: { key: Group; label: string; rule: string; advice: string }[] = [
  { key: "star", label: "Stars", rule: "beliebt, hoher Deckungsbeitrag", advice: "Halten: Rezept, Portion und Platz auf der Karte nicht antasten. Preis vorsichtig testen." },
  { key: "workhorse", label: "Arbeitspferde", rule: "beliebt, niedriger Deckungsbeitrag", advice: "Wareneinsatz senken (Portion, Zutaten, Einkauf) oder den Preis in kleinen Schritten anheben." },
  { key: "puzzle", label: "Rätsel", rule: "selten, hoher Deckungsbeitrag", advice: "Sichtbarer machen: bessere Position auf der Karte, Name, Empfehlung durch den Service." },
  { key: "dog", label: "Ladenhüter", rule: "selten, niedriger Deckungsbeitrag", advice: "Überarbeiten oder streichen. Bindet Lager und Vorbereitung, ohne viel einzubringen." },
];
