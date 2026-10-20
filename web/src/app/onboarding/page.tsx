import { redirect } from "next/navigation";
import { AuthCard } from "@/components/app/auth-card";
import { getMembership } from "@/data/repo";
import { currentUser } from "@/data/session";
import { OnboardingForm } from "./onboarding-form";

export const metadata = { title: "Einrichten" };

export default async function OnboardingPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (await getMembership(user.id)) redirect("/app");
  return (
    <AuthCard title="Willkommen" intro="Zwei Angaben, dann geht es los. Beides kannst du später ändern.">
      <OnboardingForm />
    </AuthCard>
  );
}
