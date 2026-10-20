import { redirect } from "next/navigation";
import { getSession } from "@/data/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Anmelden · Kitchen Ledger" };

export default async function LoginPage() {
  if (await getSession()) redirect("/");
  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface-raised p-6 shadow-card">
        <h1 className="text-lg">Anmelden</h1>
        <p className="mt-1 text-text-muted">Rezepte, Kalkulation, Einkauf und Lager an einem Ort.</p>
        <LoginForm />
        <div className="mt-6 rounded-md bg-surface p-3 text-xs font-normal text-text-muted">
          <p className="font-semibold text-text">Demo-Zugänge (beliebiges Passwort)</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            <li>inhaber@example.com – alle Rechte</li>
            <li>kueche@example.com – Küchenleitung</li>
            <li>team@example.com – nur Küche Mitte, keine Rezepte bearbeiten</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
