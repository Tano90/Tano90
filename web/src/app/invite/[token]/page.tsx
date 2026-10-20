import Link from "next/link";
import { AuthCard } from "@/components/app/auth-card";
import { Notice } from "@/components/app/notice";
import { invitationPreview } from "@/data/repo";
import { currentUser } from "@/data/session";
import { AcceptForm } from "./accept-form";

export const metadata = { title: "Einladung" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [preview, user] = await Promise.all([invitationPreview(token), currentUser()]);
  if (!preview || preview.expired) {
    return <AuthCard title="Einladung ungültig"><Notice tone="warning" className="mt-4">Diese Einladung ist abgelaufen oder wurde schon angenommen. Bitte frag nach einer neuen.</Notice></AuthCard>;
  }
  return (
    <AuthCard title={`Einladung zu ${preview.libraryName}`} intro={`Für ${preview.email}.`}>
      {user ? (
        <AcceptForm token={token} />
      ) : (
        <p className="mt-4">
          <Link className="font-semibold text-accent underline" href={`/signup`}>Konto anlegen</Link> oder{" "}
          <Link className="font-semibold text-accent underline" href={`/login?next=/invite/${encodeURIComponent(token)}`}>anmelden</Link> – mit genau dieser E-Mail-Adresse.
        </p>
      )}
    </AuthCard>
  );
}
