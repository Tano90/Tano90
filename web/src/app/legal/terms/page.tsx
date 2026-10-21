import Link from "next/link";
import { LegalPage, Op, Section } from "@/components/legal/legal-page";
import { APP_NAME } from "@/lib/brand";
import { formatCents } from "@/lib/format";
import { SMALL_BUSINESS } from "@/lib/legal";
import { PRICING } from "@/lib/pricing";

export const metadata = { title: "Nutzungsbedingungen" };

const eur = (cents: number) => formatCents(cents).replace(",00", "");

export default function TermsPage() {
  return (
    <LegalPage title="Nutzungsbedingungen">
      <p className="mt-4">Allgemeine Geschäftsbedingungen für die Nutzung von {APP_NAME} zwischen <Op field="company" /> („wir“) und dem Betrieb, der {APP_NAME} nutzt („Kunde“).</p>

      <Section title="1. Geltung">
        <p>{APP_NAME} richtet sich ausschließlich an Unternehmer im Sinne von § 14 BGB, juristische Personen des öffentlichen Rechts und öffentlich-rechtliche Sondervermögen. Mit der Registrierung bestätigt der Kunde, dass er {APP_NAME} für seine gewerbliche oder selbständige berufliche Tätigkeit nutzt. Abweichende Bedingungen des Kunden gelten nicht, auch wenn wir ihnen nicht ausdrücklich widersprechen.</p>
      </Section>

      <Section title="2. Leistung">
        <p>{APP_NAME} ist eine Software im Browser für Küchenbetriebe: Zutaten und Einkaufspreise, Rezepte und Kalkulation, Menüs, Lieferanten und Bestellungen, Lager und Inventur, Zentralküche, Kassenverkäufe, Rechnungsabgleich und HACCP-Checklisten. Maßgeblich ist der Funktionsumfang zum Zeitpunkt der Nutzung. Wir entwickeln {APP_NAME} weiter und dürfen Funktionen ändern, solange der wesentliche Zweck erhalten bleibt.</p>
        <p>Wir bemühen uns um eine hohe Verfügbarkeit, schulden aber keine bestimmte Verfügbarkeitsquote. Wartungen kündigen wir nach Möglichkeit vorher an und legen sie in verkehrsarme Zeiten.</p>
      </Section>

      <Section title="3. Vertragsschluss und Testphase">
        <p>Der Vertrag kommt mit der Registrierung zustande. Die ersten {PRICING.trialDays} Tage sind kostenlos und ohne Angabe einer Zahlungsart. Die Testphase geht nicht automatisch in ein kostenpflichtiges Abo über; ein Abo entsteht erst, wenn der Kunde es unter Einstellungen → Abo &amp; Rechnungen abschließt. Wir erinnern die Inhaber drei Tage vor dem Ende per E-Mail. Nach dem Ende lassen sich die Daten weiter ansehen und exportieren; ändern und neue Buchungen, auch über die Kassen-Schnittstelle, gehen erst wieder mit einem Abo.</p>
      </Section>

      <Section title="4. Preise und Zahlung">
        <p>Es gelten die Preise auf unserer Website zum Zeitpunkt des Abschlusses, derzeit {eur(PRICING.firstOutletMonthly)} im Monat für den ersten Standort und {eur(PRICING.extraOutletMonthly)} für jeden weiteren, bei jährlicher Zahlung {eur(PRICING.firstOutletYearly)} und {eur(PRICING.extraOutletYearly)} im Jahr. {SMALL_BUSINESS ? "Als Kleinunternehmer nach § 19 UStG berechnen wir keine Umsatzsteuer; die Preise sind Endpreise." : "Alle Preise zuzüglich Umsatzsteuer."} Alle Funktionen sind enthalten; die Zahl der Nutzer ist nicht begrenzt.</p>
        <p>Abgerechnet wird die Zahl der angelegten Standorte. Legt der Kunde einen weiteren Standort an, erhöht sich die Menge, und der Unterschied wird anteilig für den laufenden Zeitraum berechnet. Archiviert er einen Standort, verringert sich die Menge, und der Unterschied wird anteilig mit der nächsten Rechnung verrechnet. Die Zahlung läuft im Voraus über unseren Zahlungsdienstleister Stripe.</p>
        <p>Preisänderungen kündigen wir mindestens sechs Wochen vor Beginn des Abrechnungszeitraums an, ab dem sie gelten. Der Kunde kann bis dahin zum Ende des laufenden Zeitraums kündigen.</p>
      </Section>

      <Section title="5. Laufzeit und Kündigung">
        <p>Ein Abo läuft je nach Wahl einen Monat oder ein Jahr und verlängert sich jeweils um denselben Zeitraum. Der Kunde kann jederzeit zum Ende des bezahlten Zeitraums kündigen, mit einem Klick unter Einstellungen → Abo &amp; Rechnungen. Wir können mit einer Frist von einem Monat zum Ende eines Abrechnungszeitraums kündigen. Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt.</p>
        <p>Kommt der Kunde mit einer Zahlung in Verzug, weisen wir in {APP_NAME} darauf hin. Bleibt die Zahlung auch nach einer Erinnerung aus, dürfen wir den Zugang bis zum Ausgleich auf Lesen beschränken. Nach dem Ende eines Abos bleibt der Zugang zum Lesen und Exportieren bestehen.</p>
      </Section>

      <Section title="6. Pflichten des Kunden">
        <ul className="list-disc pl-6">
          <li>Zugangsdaten geheim halten und Teammitglieder nur mit den Rechten einladen, die sie brauchen.</li>
          <li>Nur Inhalte eintragen, die er eintragen darf; für personenbezogene Daten von Mitarbeitenden und Lieferanten ist er datenschutzrechtlich verantwortlich.</li>
          <li>Schnittstellen (etwa die Kassen-API) nur im vorgesehenen Umfang nutzen und Schlüssel bei Verdacht auf Missbrauch sofort widerrufen.</li>
        </ul>
      </Section>

      <Section title="7. Allergene, Nährwerte, HACCP und Kalkulation">
        <p>{APP_NAME} rechnet aus den Angaben, die der Kunde einträgt. Für die Richtigkeit von Allergen- und Nährwertangaben gegenüber Gästen, für Etiketten und für die Einhaltung des Lebensmittelrechts bleibt der Kunde verantwortlich. Die HACCP-Funktionen unterstützen die Dokumentation; sie ersetzen kein eigenes HACCP-Konzept und keine Prüfung durch den Kunden. Kalkulationen, Bestellvorschläge und Lagerwerte sind Hilfsmittel; Entscheidungen trifft der Kunde.</p>
      </Section>

      <Section title="8. Daten des Kunden">
        <p>Die Daten, die der Kunde einträgt, gehören ihm. Wir nutzen sie nur, um {APP_NAME} für ihn bereitzustellen. Soweit sie personenbezogen sind, verarbeiten wir sie nach dem <Link href="/legal/dpa" className="underline">Vertrag zur Auftragsverarbeitung</Link>, der Bestandteil dieser Bedingungen ist. Inhaber und Admins können jederzeit alle Daten des Betriebs als Datei herunterladen (Einstellungen → Daten exportieren), auch nach dem Ende der Testphase oder des Abos. Nach Vertragsende stellen wir die Daten auf Anforderung noch 30 Tage bereit und löschen sie danach, soweit keine gesetzliche Pflicht zur Aufbewahrung besteht.</p>
      </Section>

      <Section title="9. Haftung">
        <p>Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei Verletzung von Leben, Körper oder Gesundheit, nach dem Produkthaftungsgesetz und soweit wir eine Garantie übernommen haben.</p>
        <p>Bei leichter Fahrlässigkeit haften wir nur für die Verletzung einer wesentlichen Vertragspflicht, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags erst ermöglicht und auf deren Einhaltung der Kunde regelmäßig vertrauen darf, und begrenzt auf den bei Vertragsschluss vorhersehbaren, vertragstypischen Schaden. Im Übrigen ist die Haftung für leichte Fahrlässigkeit ausgeschlossen.</p>
        <p>Für den Verlust von Daten haften wir nur in Höhe des Aufwands, der bei regelmäßiger Datensicherung zur Wiederherstellung nötig gewesen wäre.</p>
      </Section>

      <Section title="10. Änderungen dieser Bedingungen">
        <p>Änderungen teilen wir dem Kunden mindestens sechs Wochen vor ihrem Inkrafttreten in Textform mit. Widerspricht er nicht bis zum Inkrafttreten, gelten sie als angenommen; auf diese Folge weisen wir in der Mitteilung hin. Widerspricht er, kann jede Seite zum Inkrafttreten kündigen.</p>
      </Section>

      <Section title="11. Schlussbestimmungen">
        <p>Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. Ausschließlicher Gerichtsstand für Streitigkeiten mit Kaufleuten, juristischen Personen des öffentlichen Rechts und öffentlich-rechtlichen Sondervermögen ist <Op field="jurisdictionCity" />. Sollte eine Bestimmung unwirksam sein, bleibt der Rest wirksam.</p>
      </Section>
    </LegalPage>
  );
}
