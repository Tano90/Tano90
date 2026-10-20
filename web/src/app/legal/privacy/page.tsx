// DRAFT. Must be completed with the operator's details and reviewed by a lawyer before launch (/replica-deploy checks this).
export const metadata = { title: "Datenschutz · Kitchen Ledger" };

const PROCESSORS = [
  ["Supabase Inc.", "Datenbank, Anmeldung, Dateispeicher", "EU (Frankfurt)", "https://supabase.com/privacy"],
  ["Vercel Inc.", "Hosting der Anwendung", "EU (Frankfurt), Edge weltweit", "https://vercel.com/legal/privacy-policy"],
  ["Stripe Payments Europe Ltd.", "Abonnements und Zahlungen", "EU/USA", "https://stripe.com/de/privacy"],
  ["Resend Inc.", "Versand von E-Mails (Bestellungen, Einladungen, Hinweise)", "USA", "https://resend.com/legal/privacy-policy"],
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl">Datenschutzerklärung</h1>
      <p className="mt-2 rounded-md border border-warning bg-warning-subtle p-3">Entwurf. Verantwortliche Stelle, Kontakt, Rechtsgrundlagen und Speicherfristen müssen vor dem Start ergänzt und rechtlich geprüft werden.</p>
      <h2 className="mt-6 text-lg">Verantwortlich</h2>
      <p>[Name, Anschrift, E-Mail des Betreibers]</p>
      <h2 className="mt-6 text-lg">Welche Daten wir verarbeiten</h2>
      <ul className="mt-2 list-disc pl-6">
        <li>Konto: Name, E-Mail-Adresse, Passwort (nur als Hash bei Supabase).</li>
        <li>Betriebsdaten, die du eingibst: Zutaten, Rezepte, Lieferanten, Bestellungen, Bestände.</li>
        <li>Abrechnung: über Stripe; Kartendaten erreichen uns nicht.</li>
        <li>Technisch: Server-Logs ohne Inhalte deiner Daten, für Fehlersuche und Sicherheit.</li>
      </ul>
      <h2 className="mt-6 text-lg">Auftragsverarbeiter</h2>
      <table className="mt-2 w-full text-sm">
        <thead><tr className="text-left text-xs text-text-muted"><th className="py-1">Dienst</th><th>Zweck</th><th>Ort</th></tr></thead>
        <tbody>
          {PROCESSORS.map(([name, purpose, where, link]) => (
            <tr key={name} className="border-t border-border"><td className="py-2"><a className="underline" href={link}>{name}</a></td><td>{purpose}</td><td>{where}</td></tr>
          ))}
        </tbody>
      </table>
      <h2 className="mt-6 text-lg">Löschen</h2>
      <p>Du kannst dein Konto jederzeit unter Einstellungen → Dein Konto löschen. Bist du allein im Betrieb, werden alle Betriebsdaten mitgelöscht.</p>
    </main>
  );
}
