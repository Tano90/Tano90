import { LegalPage, Op, Section } from "@/components/legal/legal-page";
import { APP_NAME } from "@/lib/brand";

export const metadata = { title: "Impressum" };

// Angaben nach § 5 DDG und § 18 Abs. 2 MStV. The values live in src/lib/legal.ts.
export default function ImprintPage() {
  return (
    <LegalPage title="Impressum">
      <Section title="Anbieter">
        <p>
          <Op field="company" /> (<Op field="legalForm" />)<br />
          <Op field="street" /><br />
          <Op field="postalCodeCity" /><br />
          <Op field="country" />
        </p>
        <p>Vertreten durch: <Op field="representative" /></p>
      </Section>
      <Section title="Kontakt">
        <p>E-Mail: <Op field="email" /><br />Telefon: <Op field="phone" /></p>
      </Section>
      <Section title="Register und Steuern">
        <p>Registereintrag: <Op field="register" /><br />Umsatzsteuer-Identifikationsnummer nach § 27a UStG: <Op field="vatId" /></p>
      </Section>
      <Section title="Verantwortlich für den Inhalt">
        <p>Nach § 18 Abs. 2 MStV: <Op field="contentResponsible" /></p>
      </Section>
      <Section title="Streitbeilegung">
        <p>
          {APP_NAME} richtet sich ausschließlich an Unternehmen. Wir sind nicht verpflichtet und nicht bereit, an einem
          Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </Section>
    </LegalPage>
  );
}
