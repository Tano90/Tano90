// The operator's details for the imprint, privacy policy and terms. Every value comes from you, the operator: nothing
// here is guessed. While a field is null the pages show "[fehlt: …]" and `npm run legal:check` fails.
// Before launch: fill in, then have a lawyer review the three pages (replica/deploy.md).

export const OPERATOR = {
  company: null as string | null, // e.g. "Muster Software GmbH" or your full name as a sole trader
  legalForm: null as string | null, // e.g. "GmbH", "UG (haftungsbeschränkt)", "Einzelunternehmen"
  representative: null as string | null, // managing director(s); for a sole trader your name again
  street: null as string | null,
  postalCodeCity: null as string | null,
  country: "Deutschland",
  email: null as string | null, // a monitored address, e.g. kontakt@your-domain
  phone: null as string | null, // or another fast way to reach you (§ 5 DDG)
  register: null as string | null, // e.g. "Amtsgericht München, HRB 123456"; "nicht eingetragen" for a sole trader
  vatId: null as string | null, // USt-IdNr. per § 27a UStG, or "nicht vorhanden"
  contentResponsible: null as string | null, // § 18 Abs. 2 MStV: name and address of the person responsible for content
  privacyContact: null as string | null, // e-mail for data protection requests (may be the same as email)
  dataProtectionOfficer: "nicht bestellt (nicht verpflichtend)" as string | null, // change if you appoint one
  supervisoryAuthority: null as string | null, // the data protection authority of your federal state, with its address
  jurisdictionCity: null as string | null, // court for disputes with merchants, usually your registered seat
};

export const LEGAL_DATE = "21. Oktober 2026";

export type OperatorField = keyof typeof OPERATOR;

export const FIELD_LABELS: Record<OperatorField, string> = {
  company: "Name oder Firma",
  legalForm: "Rechtsform",
  representative: "Vertretungsberechtigte Person",
  street: "Straße und Hausnummer",
  postalCodeCity: "PLZ und Ort",
  country: "Land",
  email: "E-Mail-Adresse",
  phone: "Telefonnummer",
  register: "Registergericht und -nummer",
  vatId: "Umsatzsteuer-Identifikationsnummer",
  contentResponsible: "Verantwortlich für den Inhalt (§ 18 Abs. 2 MStV)",
  privacyContact: "E-Mail für Datenschutzanfragen",
  dataProtectionOfficer: "Datenschutzbeauftragte Person",
  supervisoryAuthority: "Zuständige Datenschutz-Aufsichtsbehörde",
  jurisdictionCity: "Gerichtsstand (Ort)",
};

export const missingOperatorFields = () => (Object.keys(OPERATOR) as OperatorField[]).filter((k) => !OPERATOR[k]?.trim());

/** Every service that processes personal data for us. The privacy policy lists exactly these. */
export const PROCESSORS = [
  { name: "Supabase Inc.", purpose: "Datenbank und Anmeldung (Konten, Betriebsdaten, Sitzungen)", location: "Server in der EU (Frankfurt); Unternehmen in den USA", link: "https://supabase.com/privacy" },
  { name: "Vercel Inc.", purpose: "Hosting der Website und der Anwendung, Server-Protokolle, zeitgesteuerte Aufgaben", location: "Funktionen in der EU (Frankfurt), Auslieferung über ein weltweites Netz; Unternehmen in den USA", link: "https://vercel.com/legal/privacy-policy" },
  { name: "Stripe Payments Europe Ltd.", purpose: "Abonnements, Zahlungen, Rechnungen", location: "Irland; Datenübermittlung in die USA möglich", link: "https://stripe.com/de/privacy" },
  { name: "Resend Inc.", purpose: "Versand von E-Mails (Bestellungen an Lieferanten, Einladungen, Bestands- und Kontohinweise)", location: "USA", link: "https://resend.com/legal/privacy-policy" },
] as const;
