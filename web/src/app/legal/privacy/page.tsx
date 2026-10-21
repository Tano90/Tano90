import { LegalPage, Op, Section } from "@/components/legal/legal-page";
import { APP_NAME } from "@/lib/brand";
import { PROCESSORS } from "@/lib/legal";

export const metadata = { title: "Datenschutz" };

// Every period and cookie below matches the code: src/lib/jobs.ts (cleanup), the invitation expiry (7 days),
// rate limiting (src/app/actions.ts) and the outlet cookie (OUTLET_COOKIE). Change them together.
export default function PrivacyPage() {
  return (
    <LegalPage title="Datenschutzerklärung">
      <Section title="Verantwortlich">
        <p>
          Verantwortlich für die Verarbeitung personenbezogener Daten auf dieser Website und in {APP_NAME} ist:<br />
          <Op field="company" />, <Op field="street" />, <Op field="postalCodeCity" />, <Op field="country" /><br />
          E-Mail: <Op field="email" />
        </p>
        <p>Anfragen zum Datenschutz: <Op field="privacyContact" />. Datenschutzbeauftragte Person: <Op field="dataProtectionOfficer" />.</p>
      </Section>

      <Section title="Unsere Rolle: Verantwortliche und Auftragsverarbeiter">
        <p>
          Für Konten, Abrechnung und den Betrieb der Website sind wir Verantwortliche. Was dein Betrieb in {APP_NAME} einträgt und
          dabei Personen betrifft, etwa Namen von Teammitgliedern, Ansprechpartner bei Lieferanten oder wer eine HACCP-Kontrolle
          eingetragen hat, verarbeiten wir im Auftrag deines Betriebs (Art. 28 DSGVO). Verantwortlich ist dafür dein Betrieb;
          wir schließen dazu einen Auftragsverarbeitungsvertrag ab (siehe Nutzungsbedingungen).
        </p>
      </Section>

      <Section title="Was wir verarbeiten, wozu und auf welcher Grundlage">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <caption className="sr-only">Verarbeitungen mit Zweck, Rechtsgrundlage und Speicherdauer</caption>
            <thead className="text-left text-xs text-text-muted">
              <tr><th scope="col" className="py-2 pr-3">Daten</th><th scope="col" className="pr-3">Zweck</th><th scope="col" className="pr-3">Rechtsgrundlage</th><th scope="col">Speicherdauer</th></tr>
            </thead>
            <tbody className="align-top">
              <tr className="border-t border-border"><td className="py-2 pr-3">Aufruf der Website: IP-Adresse, Zeitpunkt, aufgerufene Adresse, Browser-Kennung (Server-Protokolle)</td><td className="pr-3">Auslieferung, Fehlersuche, Abwehr von Angriffen</td><td className="pr-3">Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren Betrieb)</td><td>nach den Fristen von Vercel, danach gelöscht</td></tr>
              <tr className="border-t border-border"><td className="py-2 pr-3">Anfrage über die Website: Name, Betrieb, E-Mail, freiwillig Telefon, Zahl der Standorte und Nachricht; dazu, über welchen Link du gekommen bist (Kampagnenkennung, Herkunftsseite)</td><td className="pr-3">deine Anfrage beantworten und eine Vorführung vereinbaren; sehen, welche Kanäle Interesse wecken</td><td className="pr-3">Art. 6 Abs. 1 lit. b DSGVO (vorvertragliche Anfrage); für die Herkunft lit. f</td><td>zwölf Monate nach dem letzten Kontakt, danach automatisch gelöscht; früher auf Wunsch</td></tr>
              <tr className="border-t border-border"><td className="py-2 pr-3">Aufrufe der Startseite: nur eine Zahl pro Tag und Kampagnenkennung, ohne IP-Adresse, ohne Cookie, ohne Kennung des Geräts</td><td className="pr-3">Reichweite der Website messen</td><td className="pr-3">Art. 6 Abs. 1 lit. f DSGVO; es werden keine Informationen auf deinem Gerät gespeichert oder ausgelesen</td><td>als Tageszahl ohne Personenbezug</td></tr>
              <tr className="border-t border-border"><td className="py-2 pr-3">Konto: Name, E-Mail-Adresse, Passwort (nur als Hash), Rolle und Standorte im Betrieb</td><td className="pr-3">Anmeldung, Zugriff auf die Daten deines Betriebs</td><td className="pr-3">Art. 6 Abs. 1 lit. b DSGVO (Vertrag)</td><td>bis du dein Konto löschst</td></tr>
              <tr className="border-t border-border"><td className="py-2 pr-3">Einladungen: E-Mail-Adresse der eingeladenen Person, Rolle, Standorte</td><td className="pr-3">Einladung ins Team</td><td className="pr-3">Art. 6 Abs. 1 lit. b DSGVO; für die eingeladene Person lit. f</td><td>Link 7 Tage gültig; nicht angenommene Einladungen löschen wir einen Tag nach Ablauf</td></tr>
              <tr className="border-t border-border"><td className="py-2 pr-3">Abo und Zahlung: Firma, Rechnungsanschrift, E-Mail, Zahlungsart (Kartendaten nur bei Stripe), Rechnungen</td><td className="pr-3">Abrechnung</td><td className="pr-3">Art. 6 Abs. 1 lit. b und c DSGVO</td><td>Rechnungen und Buchungsbelege 10 Jahre (§ 147 AO, § 257 HGB), sonst bis Vertragsende</td></tr>
              <tr className="border-t border-border"><td className="py-2 pr-3">E-Mails, die {APP_NAME} versendet: Empfängeradresse und Inhalt (Bestellung an Lieferanten, Einladung, Bestands- und Kontohinweise)</td><td className="pr-3">Zustellung</td><td className="pr-3">Art. 6 Abs. 1 lit. b DSGVO; für Lieferanten im Auftrag deines Betriebs</td><td>nach den Fristen von Resend</td></tr>
              <tr className="border-t border-border"><td className="py-2 pr-3">Schutz vor Missbrauch: IP-Adresse bei Anmelde- und Registrierungsversuchen, zusätzlich die E-Mail-Adresse bei Anmeldelinks und beim Zurücksetzen des Passworts</td><td className="pr-3">Begrenzung von Versuchen gegen das Erraten von Passwörtern</td><td className="pr-3">Art. 6 Abs. 1 lit. f DSGVO</td><td>spätestens nach zwei Tagen gelöscht</td></tr>
              <tr className="border-t border-border"><td className="py-2 pr-3">Betriebsdaten: Zutaten, Rezepte, Lieferanten und deren Ansprechpartner, Bestellungen, Bestände, Kassenverkäufe (ohne Daten von Gästen), HACCP-Einträge mit Name und Zeitpunkt</td><td className="pr-3">die Funktionen von {APP_NAME}</td><td className="pr-3">Auftragsverarbeitung für deinen Betrieb (Art. 28 DSGVO)</td><td>bis dein Betrieb sie löscht oder der Vertrag endet</td></tr>
            </tbody>
          </table>
        </div>
        <p>Zusätzlich führen wir technische Protokolle über eingegangene Zahlungsereignisse (90 Tage) und über erfolgreich gelaufene Hintergrundaufgaben (30 Tage). Sie enthalten keine Inhalte deiner Betriebsdaten.</p>
      </Section>

      <Section title="Cookies">
        <p>Wir setzen nur Cookies, die für den Dienst technisch nötig sind (§ 25 Abs. 2 Nr. 2 TDDDG). Eine Einwilligung ist dafür nicht erforderlich, deshalb gibt es kein Cookie-Banner.</p>
        <ul className="list-disc pl-6">
          <li><strong>Anmeldung</strong> (Supabase, beginnt mit <code>sb-</code>): hält dich angemeldet; gelöscht beim Abmelden oder nach Ablauf der Sitzung.</li>
          <li><strong>kl_outlet</strong>: merkt sich den gewählten Standort; gelöscht, wenn du den Browser schließt.</li>
        </ul>
        <p>Wir nutzen keine Analyse-, Werbe- oder Tracking-Dienste; die Aufrufe der Startseite zählen wir selbst, ohne Cookie und ohne Personenbezug. Die Schrift ist auf unserem Server eingebunden; beim Laden der Seite wird keine Verbindung zu Schriftanbietern aufgebaut.</p>
      </Section>

      <Section title="Dienstleister">
        <p>Diese Dienstleister verarbeiten Daten in unserem Auftrag, jeweils auf Grundlage eines Vertrags zur Auftragsverarbeitung:</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <caption className="sr-only">Dienstleister mit Zweck und Ort der Verarbeitung</caption>
            <thead className="text-left text-xs text-text-muted"><tr><th scope="col" className="py-2 pr-3">Dienst</th><th scope="col" className="pr-3">Zweck</th><th scope="col">Ort</th></tr></thead>
            <tbody className="align-top">
              {PROCESSORS.map((p) => (
                <tr key={p.name} className="border-t border-border"><td className="py-2 pr-3"><a className="underline" href={p.link}>{p.name}</a></td><td className="pr-3">{p.purpose}</td><td>{p.location}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Einige dieser Unternehmen sitzen in den USA oder können Daten dorthin übermitteln. Die Übermittlung stützt sich auf die
          Standardvertragsklauseln der EU-Kommission (Art. 46 Abs. 2 lit. c DSGVO) und, soweit der Anbieter zertifiziert ist, auf
          den Angemessenheitsbeschluss zum EU-US Data Privacy Framework (Art. 45 DSGVO).
        </p>
      </Section>

      <Section title="Löschen">
        <p>
          Du kannst dein Konto jederzeit unter Einstellungen → Dein Konto löschen. Bist du allein im Betrieb, löschen wir alle
          Betriebsdaten mit. Gibt es weitere Mitglieder, bleiben die Betriebsdaten beim Betrieb; dein Konto und deine Anmeldung
          werden gelöscht. Sicherungskopien der Datenbank werden nach den Fristen von Supabase überschrieben. Gesetzlich
          aufzubewahrende Rechnungen bleiben bis zum Ende der Frist.
        </p>
      </Section>

      <Section title="Pflicht zur Angabe">
        <p>Ohne E-Mail-Adresse und Passwort können wir kein Konto anlegen. Alle anderen Angaben machst du freiwillig, soweit du die jeweilige Funktion nutzen möchtest. Eine automatisierte Entscheidung im Einzelfall (Art. 22 DSGVO) findet nicht statt.</p>
      </Section>

      <Section title="Deine Rechte">
        <p>
          Du hast das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18),
          Datenübertragbarkeit (Art. 20) und Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21
          DSGVO). Schreib dafür an <Op field="privacyContact" />. Betrifft deine Anfrage Daten, die dein Betrieb in {APP_NAME}{" "}
          eingetragen hat, leiten wir sie an den Betrieb weiter.
        </p>
        <p>Du kannst dich bei einer Datenschutz-Aufsichtsbehörde beschweren, zum Beispiel bei der für uns zuständigen: <Op field="supervisoryAuthority" />.</p>
      </Section>
    </LegalPage>
  );
}
