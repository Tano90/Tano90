import Link from "next/link";
import { AuthCard } from "@/components/app/auth-card";
import { NoPermission } from "@/components/app/notice";
import { authMode } from "@/data/session";
import { SignUpForm } from "./signup-form";

export const metadata = { title: "Registrieren · Kitchen Ledger" };

export default function SignUpPage() {
  return (
    <AuthCard title="Konto anlegen" intro="14 Tage kostenlos testen. Keine Zahlungsdaten nötig." footer={<>Schon registriert? <Link className="font-semibold text-accent underline" href="/login">Anmelden</Link></>}>
      {authMode() === "supabase" ? <SignUpForm /> : <div className="mt-4"><NoPermission what="Registrierung ist ohne Supabase nicht verfügbar. Nutze lokal die Demo-Zugänge." /></div>}
    </AuthCard>
  );
}
