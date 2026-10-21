import { LegalPage, Op, Section } from "@/components/legal/legal-page";
import { APP_NAME } from "@/lib/brand";
import { PROCESSORS } from "@/lib/legal";

export const metadata = { title: "Auftragsverarbeitung" };

// Art. 28 Abs. 3 DSGVO. The technical measures listed in Anlage 1 describe what the code does
// (row level security per library and outlet, hashed keys and tokens, rate limits); keep them in step.
export default function DpaPage() {
  return (
    <LegalPage title="Vertrag zur Auftragsverarbeitung">
      <p className="mt-4">
        zwischen dem Betrieb, der {APP_NAME} nutzt („Verantwortlicher“), und <Op field="company" />, <Op field="street" />,{" "}
        <Op field="postalCodeCity" /> („Auftragsverarbeiter“). Dieser Vertrag ist Bestandteil der Nutzungsbedingungen und gilt,
        solange der Auftragsverarbeiter personenbezogene Daten für den Verantwortlichen verarbeitet.
      </p>

      <Section title="1. Gegenstand, Art und Zweck">
        <p>Der Auftragsverarbeiter stellt die {APP_NAME} als Software im Browser bereit. Er speichert und verarbeitet dabei die Daten, die der Verantwortliche einträgt, ausschließlich, um die Funktionen von {APP_NAME} zu erbringen: speichern, anzeigen, berechnen, E-Mails in seinem Auftrag versenden (etwa Bestellungen an Lieferanten), sichern und auf Weisung löschen.</p>
      </Section>

      <Section title="2. Arten der Daten und betroffene Personen">
        <ul className="list-disc pl-6">
          <li><strong>Teammitglieder des Verantwortlichen:</strong> Name, E-Mail-Adresse, Rolle, zugeordnete Standorte, wer wann welche Einträge gemacht hat (zum Beispiel HACCP-Kontrollen, Bestellungen, Inventuren).</li>
          <li><strong>Ansprechpartner bei Lieferanten:</strong> Name, E-Mail-Adresse, Telefonnummer, soweit eingetragen, und der Inhalt der an sie gesendeten Bestellungen.</li>
          <li><strong>Eingeladene Personen:</strong> E-Mail-Adresse, vorgesehene Rolle.</li>
        </ul>
        <p>Kassenverkäufe enthalten keine Daten von Gästen. Besondere Kategorien nach Art. 9 DSGVO sind nicht vorgesehen; der Verantwortliche trägt keine ein.</p>
      </Section>

      <Section title="3. Weisungen">
        <p>Der Auftragsverarbeiter verarbeitet die Daten nur auf dokumentierte Weisung des Verantwortlichen. Die Weisung ergibt sich aus den Nutzungsbedingungen und aus der Nutzung der {APP_NAME} durch den Verantwortlichen; weitere Weisungen erteilt er in Textform. Hält der Auftragsverarbeiter eine Weisung für rechtswidrig, teilt er das unverzüglich mit.</p>
      </Section>

      <Section title="4. Vertraulichkeit">
        <p>Personen, die beim Auftragsverarbeiter Zugang zu den Daten haben, sind zur Vertraulichkeit verpflichtet. Zugriff erhalten sie nur, soweit es für Betrieb, Support oder Fehlerbehebung nötig ist.</p>
      </Section>

      <Section title="5. Sicherheit">
        <p>Der Auftragsverarbeiter trifft die technischen und organisatorischen Maßnahmen nach Art. 32 DSGVO, die in Anlage 1 beschrieben sind, und passt sie dem Stand der Technik an, ohne das Schutzniveau zu senken.</p>
      </Section>

      <Section title="6. Unterauftragsverarbeiter">
        <p>Der Verantwortliche genehmigt die in Anlage 2 genannten Unterauftragsverarbeiter. Über neue oder geänderte informiert der Auftragsverarbeiter mindestens vier Wochen vorher in Textform; der Verantwortliche kann aus wichtigem datenschutzrechtlichem Grund widersprechen und, wenn keine Einigung gelingt, den Vertrag zum Wechsel kündigen. Unterauftragsverarbeiter werden vertraglich zu mindestens gleichwertigem Datenschutz verpflichtet. Übermittlungen in Drittländer erfolgen nur nach Kapitel V DSGVO.</p>
      </Section>

      <Section title="7. Unterstützung">
        <p>Der Auftragsverarbeiter unterstützt den Verantwortlichen bei Anfragen betroffener Personen, bei der Sicherheit der Verarbeitung, bei Meldungen von Datenschutzverletzungen und bei Datenschutz-Folgenabschätzungen, soweit es seinen Bereich betrifft. Eine Verletzung des Schutzes personenbezogener Daten meldet er unverzüglich, nachdem sie ihm bekannt geworden ist, mit den Angaben nach Art. 33 Abs. 3 DSGVO, soweit verfügbar.</p>
      </Section>

      <Section title="8. Löschung und Rückgabe">
        <p>Der Verantwortliche kann alle Daten jederzeit selbst als JSON-Datei herunterladen. Nach Vertragsende stellt der Auftragsverarbeiter die Daten auf Anforderung innerhalb von 30 Tagen in diesem Format bereit und löscht sie danach, einschließlich vorhandener Kopien, soweit keine gesetzliche Pflicht zur Aufbewahrung besteht. Sicherungskopien werden im regulären Zyklus überschrieben.</p>
      </Section>

      <Section title="9. Nachweise und Kontrollen">
        <p>Der Auftragsverarbeiter stellt die Informationen bereit, die zum Nachweis der Pflichten aus Art. 28 DSGVO nötig sind, und ermöglicht Überprüfungen, in der Regel durch Auskünfte und Unterlagen, nach Anmeldung mit angemessener Frist auch vor Ort, ohne den Betrieb unverhältnismäßig zu stören.</p>
      </Section>

      <Section title="Anlage 1: Technische und organisatorische Maßnahmen">
        <ul className="list-disc pl-6">
          <li><strong>Trennung der Mandanten:</strong> Jeder Datensatz gehört zu genau einem Betrieb. Die Datenbank prüft bei jeder Abfrage über Zeilenrechte (Row Level Security), dass nur Mitglieder dieses Betriebs und nur der ihnen zugeordneten Standorte Zugriff haben. Automatisierte Tests prüfen, dass ein zweiter Betrieb nichts davon sieht.</li>
          <li><strong>Zugriffskontrolle:</strong> Rollen (Inhaber, Admin, Küchenleitung, Team) mit abgestuften Rechten, auch in der Datenbank durchgesetzt; mindestens ein Inhaber pro Betrieb.</li>
          <li><strong>Anmeldung:</strong> Passwörter nur als Hash beim Anmeldedienst; Einladungs-Tokens und Kassen-API-Schlüssel nur als Hash gespeichert; Begrenzung von Anmelde-, Registrierungs- und Rücksetzversuchen.</li>
          <li><strong>Übertragung:</strong> ausschließlich verschlüsselt (HTTPS/TLS).</li>
          <li><strong>Speicherort:</strong> Datenbank in einem Rechenzentrum in der EU (Frankfurt).</li>
          <li><strong>Verfügbarkeit:</strong> tägliche Sicherungen der Datenbank beim Hosting-Anbieter; Überwachung der Erreichbarkeit einschließlich der Datenbank.</li>
          <li><strong>Datensparsamkeit:</strong> Die Anwendung schreibt keine E-Mail-Adressen in Protokolle; kurzlebige Sicherheitsdaten werden automatisch gelöscht (siehe Datenschutzerklärung).</li>
          <li><strong>Organisation:</strong> Zugang für Personal nur bei Bedarf, Zugangsdaten zu Produktivsystemen mit Zwei-Faktor-Anmeldung.</li>
        </ul>
      </Section>

      <Section title="Anlage 2: Unterauftragsverarbeiter">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <caption className="sr-only">Unterauftragsverarbeiter mit Zweck und Ort</caption>
            <thead className="text-left text-xs text-text-muted"><tr><th scope="col" className="py-2 pr-3">Unternehmen</th><th scope="col" className="pr-3">Zweck</th><th scope="col">Ort</th></tr></thead>
            <tbody className="align-top">
              {PROCESSORS.map((p) => (
                <tr key={p.name} className="border-t border-border"><td className="py-2 pr-3">{p.name}</td><td className="pr-3">{p.purpose}</td><td>{p.location}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </LegalPage>
  );
}
