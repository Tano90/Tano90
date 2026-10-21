// The people who run the GLB AI Suite itself (not a kitchen): they see the inquiries and the demand numbers.
// Set OPERATOR_EMAILS to a comma-separated list of the accounts' e-mail addresses.
import type { Session } from "@/data/types";

export function isOperator(s: Pick<Session, "email"> | null) {
  const list = (process.env.OPERATOR_EMAILS ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  return !!s?.email && list.includes(s.email.toLowerCase());
}
