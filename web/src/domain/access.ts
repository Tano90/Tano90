// What a library may do, from its billing state. Pure, so the server, the layout banner and the jobs agree.

export type BillingState = { plan: "trial" | "active" | "past_due" | "cancelled"; trialEndsAt: string | null };
export type Access =
  | { kind: "trial"; daysLeft: number; readOnly: false }
  | { kind: "active"; readOnly: false }
  | { kind: "past_due"; readOnly: false }
  | { kind: "trial_over"; readOnly: true }
  | { kind: "cancelled"; readOnly: true };

const DAY = 86_400_000;

export function accessOf(b: BillingState, now = new Date()): Access {
  if (b.plan === "active") return { kind: "active", readOnly: false };
  // Payment trouble is Stripe's dunning to sort out; the kitchen keeps working meanwhile.
  if (b.plan === "past_due") return { kind: "past_due", readOnly: false };
  if (b.plan === "cancelled") return { kind: "cancelled", readOnly: true };
  const ends = b.trialEndsAt ? new Date(b.trialEndsAt).getTime() : Infinity;
  if (ends <= now.getTime()) return { kind: "trial_over", readOnly: true };
  return { kind: "trial", daysLeft: Math.max(1, Math.ceil((ends - now.getTime()) / DAY)), readOnly: false };
}

export const READ_ONLY_MESSAGE: Record<"trial_over" | "cancelled", string> = {
  trial_over: "Die Testphase ist vorbei. Deine Daten bleiben erhalten und lassen sich ansehen und exportieren; ändern geht wieder mit einem Abo.",
  cancelled: "Das Abo ist beendet. Deine Daten bleiben erhalten und lassen sich ansehen und exportieren; ändern geht wieder mit einem Abo.",
};
