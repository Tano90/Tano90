import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/app/auth-card";
import { Notice } from "@/components/app/notice";
import { authMode, getSession } from "@/data/session";
import { LoginForm, MagicLinkForm } from "./login-form";

export const metadata = { title: "Anmelden" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ signedout?: string; deleted?: string; next?: string; error?: string }> }) {
  const sp = await searchParams;
  if (await getSession()) redirect("/app");
  const supabase = authMode() === "supabase";
  return (
    <AuthCard
      title="Anmelden"
      intro="Rezepte, Preise und Lager – alles, was deine Küche rechnet."
      footer={supabase && <>Noch kein Konto? <Link className="font-semibold text-accent underline" href="/signup">Registrieren</Link></>}
    >
      {sp.signedout && <Notice className="mt-4">Du wurdest auf allen Geräten abgemeldet.</Notice>}
      {sp.deleted && <Notice className="mt-4">Dein Konto wurde gelöscht.</Notice>}
      {sp.error && <Notice tone="warning" className="mt-4">Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.</Notice>}
      <LoginForm demo={!supabase} next={sp.next} />
      {supabase ? (
        <>
          <p className="mt-3 text-right text-xs"><Link className="text-accent underline" href="/forgot-password">Passwort vergessen?</Link></p>
          <div className="my-6 flex items-center gap-3 text-xs text-text-muted"><span className="h-px flex-1 bg-border" />oder<span className="h-px flex-1 bg-border" /></div>
          <MagicLinkForm />
        </>
      ) : (
        <div className="mt-6 rounded-md bg-surface p-3 text-xs font-normal text-text-muted">
          <p className="font-semibold text-text">Demo-Modus (Supabase nicht eingerichtet)</p>
          <p className="mt-1">Beliebiges Passwort. Nur in der Entwicklung verfügbar.</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            <li>inhaber@example.com – alle Rechte</li>
            <li>kueche@example.com – Küchenleitung</li>
            <li>team@example.com – nur Küche Mitte, keine Rezepte bearbeiten</li>
          </ul>
        </div>
      )}
    </AuthCard>
  );
}
