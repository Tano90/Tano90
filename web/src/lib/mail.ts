// Transactional email. With RESEND_API_KEY: sent through Resend from MAIL_FROM (your own domain).
// Without (local development): written to web/.outbox/ and logged, so flows can be tested without sending.
import "server-only";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resend } from "resend";

export type Mail = { to: string; subject: string; text: string; html: string; replyTo?: string; idempotencyKey?: string };

export async function sendMail(mail: Mail): Promise<{ id: string; delivered: boolean }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO !== "1") throw new Error("RESEND_API_KEY is not set.");
    const dir = join(process.cwd(), ".outbox");
    mkdirSync(dir, { recursive: true });
    const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID().slice(0, 6)}`;
    writeFileSync(join(dir, `${id}.json`), JSON.stringify(mail, null, 2));
    console.info(`[mail] to=<redacted> subject="${mail.subject}" -> .outbox/${id}.json`);
    return { id, delivered: false };
  }
  const resend = new Resend(key);
  const { data, error } = await resend.emails.send(
    { from: process.env.MAIL_FROM ?? "Kitchen Ledger <no-reply@example.com>", to: mail.to, subject: mail.subject, text: mail.text, html: mail.html, replyTo: mail.replyTo },
    mail.idempotencyKey ? { idempotencyKey: mail.idempotencyKey } : undefined,
  );
  if (error) throw new Error(`E-Mail konnte nicht gesendet werden: ${error.message}`);
  return { id: data!.id, delivered: true };
}
