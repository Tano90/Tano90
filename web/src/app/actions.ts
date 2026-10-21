"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { parseSalesCsv } from "@/domain/pos";
import { applyImport, planImport } from "@/lib/price-import";
import { zoneOffsetMinutes } from "@/lib/dates";
import { headers } from "next/headers";
import * as repo from "@/data/repo";
import { Forbidden, OUTLET_COOKIE, SESSION_COOKIE, authMode, canEditLibrary, canManageBilling, currentOutletId, currentUser, demoAllowed, requireSession } from "@/data/session";
import type { Session } from "@/data/types";
import { createLead, updateLead } from "@/data/leads";
import { READ_ONLY_MESSAGE, accessOf } from "@/domain/access";
import { parseRoomNumbers } from "@/domain/housekeeping";
import { billingConfigured, createCheckout, createPortal, syncOutletQuantity } from "@/lib/billing";
import { sendMail } from "@/lib/mail";
import { invitationMail, leadNotifyMail, leadThanksMail, orderMail } from "@/lib/mail-templates";
import { APP_NAME } from "@/lib/brand";
import { OPERATOR } from "@/lib/legal";
import { isOperator } from "@/lib/operator";
import { RateLimited, allow } from "@/lib/rate-limit";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

export type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Every signed-in action. After the trial or a cancelled subscription the library is read-only: the action is refused
 * here unless it is one that must keep working then (billing, team, previews), marked `readOnlyOk`.
 */
async function run<T>(fn: (s: Session) => Promise<T>, paths: string[] = [], opts: { readOnlyOk?: boolean } = {}): Promise<Result<T>> {
  try {
    const s = await requireSession();
    if (!opts.readOnlyOk) {
      const access = accessOf(await repo.getBilling(s));
      if (access.readOnly) throw new Error(READ_ONLY_MESSAGE[access.kind]);
    }
    const data = await fn(s);
    for (const p of paths) revalidatePath(p, "layout");
    return { ok: true, data };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof z.ZodError) return { ok: false, error: e.issues.map((i) => i.message).join(" ") };
    return { ok: false, error: e instanceof Error ? e.message : "Da ist etwas schiefgegangen. Bitte versuch es noch einmal." };
  }
}

// ---------------------------------------------------------------- session & account

const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";
const emailSchema = z.string().trim().toLowerCase().email("Bitte eine gültige E-Mail-Adresse angeben.");
const passwordSchema = z.string().min(10, "Das Passwort braucht mindestens 10 Zeichen.").max(200);

async function clientKey() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** Plain wrapper for actions that run before there is a session (sign in, sign up, reset). */
async function open<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof z.ZodError) return { ok: false, error: e.issues.map((i) => i.message).join(" ") };
    return { ok: false, error: e instanceof Error ? e.message : "Da ist etwas schiefgegangen. Bitte versuch es noch einmal." };
  }
}

/** Only same-site paths: "//evil.example" or "/\\evil.example" would leave the site after sign-in. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return /^\/(?![/\\])/.test(next) ? next : "/app";
}

export async function signIn(_: Result | null, form: FormData): Promise<Result> {
  const res = await open(async () => {
    const email = emailSchema.parse(form.get("email"));
    const password = String(form.get("password") ?? "");
    if (!(await allow(`signin:${await clientKey()}`, 20, 600))) throw new RateLimited();
    if (authMode() === "supabase") {
      const { error } = await (await supabaseServer()).auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.code === "email_not_confirmed" ? "Bitte bestätige zuerst deine E-Mail-Adresse." : "E-Mail oder Passwort stimmt nicht.");
      return null;
    }
    if (!demoAllowed()) throw new Error("Anmeldung ist nicht eingerichtet.");
    const id = await repo.findUserIdByEmail(email);
    if (!id || !password) throw new Error("E-Mail oder Passwort stimmt nicht.");
    (await cookies()).set(SESSION_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
    return null;
  });
  if (!res.ok) return res;
  redirect(safeNext(form.get("next")));
}

export async function sendMagicLink(_: Result<string> | null, form: FormData): Promise<Result<string>> {
  return open(async () => {
    if (authMode() !== "supabase") throw new Error("Magic Links brauchen Supabase Auth.");
    const email = emailSchema.parse(form.get("email"));
    if (!(await allow(`magic:${email}`, 3, 3600)) || !(await allow(`magic-ip:${await clientKey()}`, 10, 3600))) throw new RateLimited();
    const { error } = await (await supabaseServer()).auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: `${appUrl()}/auth/callback` } });
    // Same answer whether or not the address exists, so the form cannot be used to probe for accounts.
    if (error && error.code !== "otp_disabled" && error.status !== 400) throw new Error("Der Link konnte nicht gesendet werden.");
    return "Wenn ein Konto zu dieser Adresse existiert, ist ein Anmeldelink unterwegs.";
  });
}

export async function signUp(_: Result<string> | null, form: FormData): Promise<Result<string>> {
  return open(async () => {
    if (authMode() !== "supabase") throw new Error("Registrierung braucht Supabase Auth. Lokal gibt es Demo-Zugänge.");
    const email = emailSchema.parse(form.get("email"));
    const password = passwordSchema.parse(form.get("password"));
    const name = z.string().trim().min(1, "Bitte deinen Namen angeben.").max(80).parse(form.get("name"));
    if (!(await allow(`signup:${await clientKey()}`, 5, 3600))) throw new RateLimited();
    const { error } = await (await supabaseServer()).auth.signUp({
      email, password, options: { data: { name }, emailRedirectTo: `${appUrl()}/auth/callback?next=/onboarding` },
    });
    if (error && error.code === "weak_password") throw new Error("Dieses Passwort ist zu schwach oder bekannt aus Datenlecks.");
    if (error && error.code !== "user_already_exists") throw new Error("Die Registrierung hat nicht geklappt. Bitte später erneut versuchen.");
    return "Fast geschafft: Wir haben dir eine E-Mail geschickt. Bestätige deine Adresse über den Link darin.";
  });
}

export async function requestPasswordReset(_: Result<string> | null, form: FormData): Promise<Result<string>> {
  return open(async () => {
    if (authMode() !== "supabase") throw new Error("Passwort-Zurücksetzen braucht Supabase Auth.");
    const email = emailSchema.parse(form.get("email"));
    if (!(await allow(`reset:${email}`, 3, 3600)) || !(await allow(`reset-ip:${await clientKey()}`, 10, 3600))) throw new RateLimited();
    await (await supabaseServer()).auth.resetPasswordForEmail(email, { redirectTo: `${appUrl()}/auth/callback?next=/update-password` });
    return "Wenn ein Konto zu dieser Adresse existiert, ist ein Link zum Zurücksetzen unterwegs.";
  });
}

export async function updatePassword(_: Result | null, form: FormData): Promise<Result> {
  const res = await open(async () => {
    const password = passwordSchema.parse(form.get("password"));
    if (password !== form.get("confirm")) throw new Error("Die Passwörter stimmen nicht überein.");
    const sb = await supabaseServer();
    const { error } = await sb.auth.updateUser({ password });
    if (error) throw new Error(error.code === "same_password" ? "Das neue Passwort muss sich vom alten unterscheiden." : "Das Passwort konnte nicht geändert werden. Ist der Link abgelaufen?");
    return null;
  });
  if (!res.ok) return res;
  redirect("/app");
}

export async function signOut() {
  if (authMode() === "supabase") await (await supabaseServer()).auth.signOut({ scope: "local" });
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

/** Ends every session of this user on every device. */
export async function signOutEverywhere() {
  if (authMode() === "supabase") await (await supabaseServer()).auth.signOut({ scope: "global" });
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login?signedout=all");
}

export async function deleteAccount(_: Result | null, form: FormData): Promise<Result> {
  const res = await open(async () => {
    if (form.get("confirm") !== "LÖSCHEN") throw new Error("Bitte tippe LÖSCHEN zur Bestätigung.");
    const user = await currentUser();
    if (!user) throw new Error("Nicht angemeldet.");
    const done = await repo.deleteAccountData(user.id);
    if (!done.ok) throw new Error(done.reason);
    if (authMode() === "supabase") {
      const { error } = await supabaseAdmin().auth.admin.deleteUser(user.id);
      if (error) throw new Error("Deine Daten sind gelöscht, das Login konnte aber nicht entfernt werden. Bitte melde dich beim Support.");
      await (await supabaseServer()).auth.signOut({ scope: "local" });
    }
    (await cookies()).delete(SESSION_COOKIE);
    return null;
  });
  if (!res.ok) return res;
  redirect("/login?deleted=1");
}

export async function createLibrary(_: Result | null, form: FormData): Promise<Result> {
  const res = await open(async () => {
    const user = await currentUser();
    if (!user) throw new Error("Bitte zuerst anmelden.");
    const input = z.object({ libraryName: name, outletName: name, ownerName: name }).parse({
      libraryName: form.get("libraryName"), outletName: form.get("outletName"), ownerName: form.get("ownerName"),
    });
    await repo.createLibrary(user.id, input);
    return null;
  });
  if (!res.ok) return res;
  redirect("/app");
}

export async function acceptInvitation(_: Result | null, form: FormData): Promise<Result> {
  const res = await open(async () => {
    const user = await currentUser();
    if (!user) throw new Error("Bitte zuerst anmelden.");
    await repo.acceptInvitation(user.id, String(form.get("token") ?? ""), name.parse(form.get("name")));
    return null;
  });
  if (!res.ok) return res;
  redirect("/app");
}

export async function setOutlet(outletId: string) {
  (await cookies()).set(OUTLET_COOKIE, outletId, { sameSite: "lax", path: "/" });
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------- inquiries (website)

const optional = (max: number) => z.string().trim().max(max).transform((v) => v || null).nullable();
const LeadSchema = z.object({
  name: z.string().trim().min(1, "Bitte deinen Namen angeben.").max(120),
  company: z.string().trim().min(1, "Bitte den Namen des Betriebs angeben.").max(160),
  email: emailSchema,
  phone: optional(40),
  outlets: z.number().int().min(1).max(1000).nullable(),
  message: optional(2000),
  source: optional(100), medium: optional(100), campaign: optional(100), referrer: optional(300),
  website: z.string().max(0, "Bitte das Feld „Website“ leer lassen.").optional(), // honeypot: people never see it
});

/** Public: an inquiry from the landing page. The operator gets a mail, the person a short confirmation. */
export async function submitLead(input: z.input<typeof LeadSchema>): Promise<Result<null>> {
  return open(async () => {
    // Validate first: a typo should not use up the visitor's attempts.
    const { website: _, ...lead } = LeadSchema.parse(input);
    if (!(await allow(`lead:${await clientKey()}`, 5, 3600))) throw new RateLimited();
    await createLead(lead);
    const notify = process.env.LEADS_NOTIFY_EMAIL || OPERATOR.email;
    const mails = [];
    if (notify) mails.push(sendMail({ to: notify, ...leadNotifyMail({ ...lead, link: `${appUrl()}/admin/leads` }), replyTo: lead.email }));
    mails.push(sendMail({ to: lead.email, ...leadThanksMail({ appName: APP_NAME, name: lead.name }) }));
    // The inquiry is saved either way; a mail that fails is logged, not shown to the visitor.
    for (const r of await Promise.allSettled(mails)) if (r.status === "rejected") console.error("[leads] mail failed", r.reason);
    return null;
  });
}

const LeadUpdateSchema = z.object({ status: z.enum(["new", "contacted", "demo", "won", "lost"]), notes: optional(4000) });
export async function updateLeadStatus(leadId: string, input: z.input<typeof LeadUpdateSchema>) {
  return run(async (s) => {
    if (!isOperator(s)) throw new Forbidden();
    await updateLead(id.parse(leadId), LeadUpdateSchema.parse(input));
  }, ["/admin/leads"], { readOnlyOk: true });
}

// ---------------------------------------------------------------- billing

export async function startCheckout(interval: "month" | "year" = "month"): Promise<Result<string>> {
  return run(async (s) => {
    if (!canManageBilling(s.role)) throw new Error("Nur Inhaber können das Abo verwalten.");
    if (!billingConfigured()) throw new Error("Die Abrechnung ist noch nicht eingerichtet.");
    const billing = await repo.getBilling(s);
    return createCheckout({ libraryId: s.libraryId, email: s.email, outletCount: (await repo.listOutlets(s)).length, customerId: billing.stripeCustomerId, interval: z.enum(["month", "year"]).parse(interval) });
  }, [], { readOnlyOk: true });
}

export async function openBillingPortal(): Promise<Result<string>> {
  return run(async (s) => {
    if (!canManageBilling(s.role)) throw new Error("Nur Inhaber können das Abo verwalten.");
    const billing = await repo.getBilling(s);
    if (!billing.stripeCustomerId) throw new Error("Noch kein Abo vorhanden.");
    return createPortal(billing.stripeCustomerId);
  }, [], { readOnlyOk: true });
}

// ---------------------------------------------------------------- schemas

const id = z.string().min(1);
const name = z.string().trim().min(1, "Bitte einen Namen angeben.").max(120, "Der Name ist zu lang (max. 120 Zeichen).");
const optText = z.string().trim().max(500).nullable().transform((v) => v || null);
const positive = z.number({ error: "Bitte eine Zahl angeben." }).positive("Die Menge muss größer als 0 sein.");
const cents = z.number().int().min(0, "Preise dürfen nicht negativ sein.");
const bp = z.number().int().min(0).max(10000);
const baseUnit = z.enum(["g", "ml", "piece"]);
const lineUnit = z.enum(["g", "kg", "mg", "ml", "cl", "l", "piece", "portion"]);
const allergenRow = z.record(z.string(), z.enum(["free", "unknown", "may_contain", "contains"]));

// ---------------------------------------------------------------- ingredients

const IngredientSchema = z.object({
  id: id.optional(),
  name,
  shortName: optText,
  internalUid: optText,
  categoryId: z.string().nullable(),
  baseUnit,
  gramsPerPiece: z.number().positive().nullable(),
  mlPerGram: z.number().positive().nullable(),
});
export async function saveIngredient(input: z.input<typeof IngredientSchema>) {
  return run((s) => repo.saveIngredient(s, IngredientSchema.parse(input)), ["/ingredients"]);
}
export async function archiveIngredient(ingredientId: string) {
  return run((s) => repo.archiveIngredient(s, ingredientId), ["/ingredients"]);
}

const PackageSchema = z.object({ id: id.optional(), ingredientId: id, parentPackageId: z.string().nullable(), count: z.number().int().positive(), quantityBase: positive, label: name });
export async function savePackage(input: z.input<typeof PackageSchema>) {
  return run((s) => repo.savePackage(s, PackageSchema.parse(input)), ["/ingredients", "/recipes"]);
}
export async function deletePackage(packageId: string) {
  return run((s) => repo.deletePackage(s, packageId), ["/ingredients"]);
}

const StockItemSchema = z
  .object({
    id: id.optional(),
    ingredientId: id,
    supplierId: z.string().nullable(),
    packageId: z.string().min(1, "Bitte ein Gebinde wählen."),
    priceType: z.enum(["per_pack", "per_unit"]),
    priceCents: cents,
    priceUnit: baseUnit.nullable(),
    priceUnitQuantity: z.number().positive().nullable(),
    isPreferred: z.boolean(),
    supplierSku: optText,
    gtin: z.string().trim().regex(/^\d{8,14}$/, "Die GTIN hat 8 bis 14 Ziffern.").nullable().or(z.literal("").transform(() => null)),
    weighted: z.boolean(),
  })
  .refine((v) => v.priceType === "per_pack" || (v.priceUnit && v.priceUnitQuantity), "Für einen Preis pro Einheit fehlt die Einheit.");
export async function saveStockItem(input: z.input<typeof StockItemSchema>) {
  return run((s) => repo.saveStockItem(s, StockItemSchema.parse(input)), ["/ingredients", "/recipes", "/suppliers"]);
}
export async function archiveStockItem(stockItemId: string) {
  return run((s) => repo.archiveStockItem(s, stockItemId), ["/ingredients", "/recipes", "/suppliers"]);
}

export async function setAllergens(ingredientId: string, map: Record<string, string>, verified: boolean) {
  return run((s) => repo.setIngredientAllergens(s, ingredientId, allergenRow.parse(map), verified), ["/ingredients", "/recipes"]);
}

const nutr = z.number().min(0).nullable();
const NutritionSchema = z.object({ energyKcal: nutr, fatG: nutr, saturatedFatG: nutr, carbohydrateG: nutr, sugarsG: nutr, proteinG: nutr, saltG: nutr });
export async function setNutrition(ingredientId: string, n: z.input<typeof NutritionSchema>) {
  return run((s) => repo.setNutrition(s, ingredientId, NutritionSchema.parse(n)), ["/ingredients"]);
}

// ---------------------------------------------------------------- suppliers

const SupplierSchema = z.object({
  id: id.optional(),
  companyName: name,
  email: z.string().trim().email("Die E-Mail-Adresse ist ungültig.").nullable().or(z.literal("").transform(() => null)),
  orderEmail: z.string().trim().email("Die Bestell-Adresse ist ungültig.").nullable().or(z.literal("").transform(() => null)),
  phone: optText,
  customerNumber: optText,
  leadTimeDays: z.number().int().min(0).max(60),
  minOrderCents: cents.nullable(),
});
export async function saveSupplier(input: z.input<typeof SupplierSchema>) {
  return run((s) => repo.saveSupplier(s, SupplierSchema.parse(input)), ["/suppliers", "/ingredients"]);
}

export async function archiveSupplier(supplierId: string) {
  return run((s) => repo.archiveSupplier(s, supplierId), ["/suppliers", "/ingredients", "/recipes"]);
}

export async function setOutletCarried(ingredientId: string, outletId: string, carried: boolean) {
  return run((s) => repo.setOutletCarried(s, ingredientId, outletId, z.boolean().parse(carried)), ["/stock", "/ingredients", "/orders"]);
}

// ---------------------------------------------------------------- recipes

const RecipeSchema = z.object({
  id: id.optional(),
  name,
  categoryId: z.string().nullable(),
  productType: z.enum(["finished", "semi_finished"]),
  portions: z.number().positive("Mindestens eine Portion."),
  netQuantityBase: z.number().positive().nullable(),
  netUnit: baseUnit,
  sellPriceCents: cents.nullable(),
  sellPriceIncludesVat: z.boolean(),
  vatBp: bp.nullable(),
  targetFoodCostBp: bp.nullable(),
  prepMinutes: z.number().int().min(0).nullable(),
  instructions: z.string().max(10000).nullable(),
  extraAllergens: allergenRow,
  lines: z.array(z.object({ ingredientId: z.string().nullable(), subRecipeId: z.string().nullable(), quantity: positive, unit: lineUnit, position: z.number().int() })),
});
export type RecipeInput = z.input<typeof RecipeSchema>;
export async function previewRecipe(input: RecipeInput) {
  return run((s) => repo.previewRecipe(s, RecipeSchema.parse(input)), [], { readOnlyOk: true });
}
export async function saveRecipe(input: RecipeInput) {
  return run((s) => repo.saveRecipe(s, RecipeSchema.parse(input)), ["/recipes", "/ingredients"]);
}
export async function setRecipeOutletPrice(recipeId: string, outletId: string, sellPriceCents: number | null) {
  return run((s) => repo.setRecipeOutletPrice(s, recipeId, outletId, cents.nullable().parse(sellPriceCents)), ["/recipes", "/menus"]);
}
export async function archiveRecipe(recipeId: string) {
  return run((s) => repo.archiveRecipe(s, recipeId), ["/recipes"]);
}

// ---------------------------------------------------------------- purchasing

const OrderSchema = z.object({
  id: id.optional(),
  supplierId: z.string().min(1, "Bitte einen Lieferanten wählen."),
  expectedDeliveryDate: z.string().nullable(),
  note: optText,
  lines: z.array(z.object({ stockItemId: id, quantityPacks: z.number().min(0) })),
});
export async function saveOrderDraft(input: z.input<typeof OrderSchema>) {
  return run(async (s) => repo.saveOrderDraft(s, { ...OrderSchema.parse(input), outletId: await currentOutletId(s) }), ["/orders", "/"]);
}
export async function sendOrder(orderId: string) {
  return run(async (s) => {
    const found = await repo.getOrder(s, orderId);
    if (!found) throw new Error("Bestellung nicht gefunden.");
    if (found.order.status !== "draft") return { alreadySent: true, to: null, mailed: false };
    const to = found.supplier.orderEmail;
    if (to) {
      if (!(await allow(`order-mail:${s.libraryId}`, 100, 3600))) throw new RateLimited();
      const lib = await repo.getLibrary(s);
      // Mail first, then mark as sent. The order id is the idempotency key, so if marking fails and the
      // user retries, the supplier still gets exactly one email.
      await sendMail({
        to,
        replyTo: s.email,
        idempotencyKey: `order-${orderId}`,
        ...orderMail({
          libraryName: lib.name, outletName: found.outlet.name, supplierName: found.supplier.companyName, customerNumber: found.supplier.customerNumber,
          orderNumber: found.order.orderNumber, expectedDeliveryDate: found.order.expectedDeliveryDate, note: found.order.note, lines: found.lines,
        }),
      });
    }
    const sent = await repo.sendOrder(s, orderId);
    return { ...sent, mailed: !!to };
  }, ["/orders", "/"]);
}

export async function deleteOrderDraft(orderId: string) {
  return run((s) => repo.deleteOrderDraft(s, orderId), ["/orders", "/"]);
}
export async function orderableItems(supplierId: string) {
  return run(async (s) => repo.orderableItems(s, await currentOutletId(s), supplierId));
}
const ReceiveSchema = z.object({
  lines: z.array(z.object({ lineId: id, packs: z.number().min(0), weightBase: z.number().positive().nullable().optional() })),
  addToStock: z.boolean(),
});
export async function receiveDelivery(orderId: string, input: z.input<typeof ReceiveSchema>) {
  return run((s) => repo.receiveDelivery(s, orderId, ReceiveSchema.parse(input)), ["/orders", "/stock", "/"]);
}

// ---------------------------------------------------------------- menus

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Bitte ein gültiges Datum angeben.");
const MenuSchema = z.object({
  id: id.optional(),
  name,
  categoryId: z.string().nullable(),
  priceCents: cents.nullable(),
  priceIncludesVat: z.boolean(),
  vatBp: bp.nullable(),
  targetMarginBp: bp.nullable(),
  validFrom: isoDate.nullable(),
  validTo: isoDate.nullable(),
  courses: z.array(z.object({
    name: z.string().trim().min(1, "Bitte jedem Gang einen Namen geben.").max(80),
    items: z.array(z.object({ recipeId: z.string().min(1, "Bitte ein Rezept wählen."), portions: positive })),
  })).min(1, "Mindestens einen Gang anlegen."),
}).refine((m) => !m.validFrom || !m.validTo || m.validTo >= m.validFrom, "„Gültig bis“ liegt vor „gültig ab“.");
export type MenuInput = z.input<typeof MenuSchema>;
export async function saveMenu(input: MenuInput) {
  return run((s) => repo.saveMenu(s, MenuSchema.parse(input)), ["/menus"]);
}
export async function archiveMenu(menuId: string) {
  return run((s) => repo.archiveMenu(s, menuId), ["/menus"]);
}

// ---------------------------------------------------------------- stock

export async function startCount() {
  return run(async (s) => repo.startCount(s, await currentOutletId(s)), ["/stock"]);
}
const CountEntrySchema = z.union([
  z.number().min(0),
  z.object({ packs: z.record(z.string(), z.number().min(0)), looseBase: z.number().min(0) }),
  z.null(),
]);
export async function saveCountLines(eventId: string, counted: Record<string, z.input<typeof CountEntrySchema>>) {
  return run((s) => repo.saveCountLines(s, eventId, z.record(z.string(), CountEntrySchema).parse(counted)));
}
export async function closeCount(eventId: string) {
  return run((s) => repo.closeCount(s, eventId), ["/stock", "/"]);
}
const WasteSchema = z.array(z.object({ ingredientId: z.string().min(1, "Bitte eine Zutat wählen."), quantityBase: positive, reason: z.string().min(1, "Bitte einen Grund wählen.") }));
export async function recordWaste(lines: z.input<typeof WasteSchema>) {
  return run(async (s) => repo.recordWaste(s, await currentOutletId(s), WasteSchema.parse(lines)), ["/stock", "/"]);
}

const LevelsSchema = z.object({ minLevelBase: z.number().min(0).nullable(), parLevelBase: z.number().min(0).nullable() });
export async function setStockLevels(ingredientId: string, input: z.input<typeof LevelsSchema>) {
  return run(async (s) => repo.setStockLevels(s, await currentOutletId(s), ingredientId, LevelsSchema.parse(input)), ["/stock", "/orders"]);
}

const TransferSchema = z.object({
  toOutletId: z.string().min(1, "Bitte ein Ziel-Outlet wählen."),
  lines: z.array(z.object({ ingredientId: z.string().min(1, "Bitte eine Zutat wählen."), quantityBase: positive })).min(1, "Mindestens eine Position angeben."),
});
export async function recordTransfer(input: z.input<typeof TransferSchema>) {
  return run(async (s) => {
    const t = TransferSchema.parse(input);
    return repo.recordTransfer(s, await currentOutletId(s), t.toOutletId, t.lines);
  }, ["/stock", "/"]);
}

// ---------------------------------------------------------------- central kitchen

const ProductionSchema = z.object({
  recipeId: z.string().min(1, "Bitte ein Rezept wählen."),
  portions: positive,
  neededOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Bitte einen Liefertag wählen."),
  note: z.string().trim().max(300).nullable(),
});
export async function requestProduction(input: z.input<typeof ProductionSchema>) {
  return run(async (s) => repo.requestProduction(s, await currentOutletId(s), ProductionSchema.parse(input)), ["/production"]);
}
export async function cancelProductionRequest(requestId: string) {
  return run((s) => repo.cancelProductionRequest(s, requestId), ["/production"]);
}
export async function produce(requestIds: string[]) {
  return run(async (s) => repo.produce(s, await currentOutletId(s), z.array(id).min(1).max(200).parse(requestIds)), ["/production", "/stock"]);
}
export async function deliverProduction(requestIds: string[]) {
  return run(async (s) => repo.deliverProduction(s, await currentOutletId(s), z.array(id).min(1).max(200).parse(requestIds)), ["/production"]);
}

// ---------------------------------------------------------------- housekeeping

const roomStatus = z.enum(["dirty", "clean", "inspected", "out_of_order"]);
const occupancy = z.enum(["vacant", "occupied", "departure", "arrival"]);
const shortText = (max: number) => z.string().trim().max(max).transform((v) => v || null).nullable();

export async function createRooms(input: { numbers: string; floor: string; roomType: string }) {
  return run(async (s) => {
    const numbers = parseRoomNumbers(z.string().max(4000).parse(input.numbers));
    return repo.createRooms(s, await currentOutletId(s), { numbers, floor: shortText(20).parse(input.floor), roomType: shortText(60).parse(input.roomType) });
  }, ["/housekeeping"]);
}
const RoomPatchSchema = z.object({ status: roomStatus.optional(), occupancy: occupancy.optional(), note: shortText(300).optional(), checked: z.array(id).max(100).optional() });
export async function updateRoom(roomId: string, patch: z.input<typeof RoomPatchSchema>) {
  return run((s) => repo.updateRoom(s, id.parse(roomId), RoomPatchSchema.parse(patch)), ["/housekeeping"]);
}
export async function assignRooms(roomIds: string[], membershipId: string | null) {
  return run((s) => repo.assignRooms(s, z.array(id).min(1).max(500).parse(roomIds), membershipId ? id.parse(membershipId) : null), ["/housekeeping"]);
}
export async function startHousekeepingDay() {
  return run(async (s) => repo.startHousekeepingDay(s, await currentOutletId(s)), ["/housekeeping"]);
}
export async function archiveRoom(roomId: string) {
  return run((s) => repo.archiveRoom(s, id.parse(roomId)), ["/housekeeping"]);
}
export async function saveHkChecklist(labels: string[]) {
  return run((s) => repo.saveHkChecklist(s, z.array(z.string().trim().min(1).max(120)).max(40, "Höchstens 40 Punkte.").parse(labels.filter((l) => l.trim()))), ["/housekeeping"]);
}

// ---------------------------------------------------------------- HACCP

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const HaccpEntriesSchema = z.array(z.object({ itemId: id, value: z.string().max(500), action: z.string().max(1000).nullable() })).max(200);
export async function saveHaccpRecords(day: string, entries: z.input<typeof HaccpEntriesSchema>) {
  return run(async (s) => repo.saveHaccpRecords(s, await currentOutletId(s), daySchema.parse(day), HaccpEntriesSchema.parse(entries)), ["/haccp"]);
}
const ChecklistSchema = z.object({
  id: id.optional(),
  name,
  items: z.array(z.object({
    id: id.optional(),
    label: z.string().trim().min(1, "Bitte jedem Kontrollpunkt einen Namen geben.").max(160),
    kind: z.enum(["check", "temperature", "text"]),
    minValue: z.number().min(-100).max(300).nullable(),
    maxValue: z.number().min(-100).max(300).nullable(),
  }).refine((i) => i.minValue === null || i.maxValue === null || i.minValue <= i.maxValue, "Untergrenze liegt über der Obergrenze."))
    .min(1, "Mindestens einen Kontrollpunkt anlegen.").max(50),
});
export async function saveChecklist(input: z.input<typeof ChecklistSchema>) {
  return run((s) => repo.saveChecklist(s, ChecklistSchema.parse(input)), ["/haccp"]);
}
export async function archiveChecklist(checklistId: string) {
  return run((s) => repo.archiveChecklist(s, checklistId), ["/haccp"]);
}

// ---------------------------------------------------------------- invoices

const InvoiceSchema = z.object({
  invoiceNumber: z.string().trim().min(1, "Bitte die Rechnungsnummer angeben.").max(60),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Bitte das Rechnungsdatum angeben."),
  lines: z.array(z.object({ lineId: id, quantityPacks: z.number().min(0), unitPriceCents: cents })),
});
export async function saveInvoice(orderId: string, input: z.input<typeof InvoiceSchema>) {
  return run((s) => repo.saveInvoice(s, orderId, InvoiceSchema.parse(input)), ["/orders"]);
}
export async function approveInvoice(orderId: string, note: string | null) {
  return run((s) => repo.approveInvoice(s, orderId, z.string().max(500).nullable().parse(note)), ["/orders"]);
}

// ---------------------------------------------------------------- price list import

const PriceRowsSchema = z.array(z.object({
  row: z.number().int().positive(),
  ingredient: z.string().trim().min(1).max(120),
  packLabel: z.string().trim().min(1).max(120),
  packBase: z.number().positive().max(10_000_000),
  baseUnit: baseUnit,
  priceCents: cents.max(100_000_000),
  perUnitBase: z.number().positive().nullable(),
  sku: z.string().max(64).nullable(),
  category: z.string().max(120).nullable(),
})).max(500, "Höchstens 500 Zeilen pro Teil.");
export async function previewPriceList(supplierId: string, rows: z.input<typeof PriceRowsSchema>) {
  return run(async (s) => {
    if (!canEditLibrary(s.role)) throw new Forbidden();
    return planImport(s, id.parse(supplierId), PriceRowsSchema.parse(rows));
  }, [], { readOnlyOk: true });
}
export async function applyPriceList(supplierId: string, rows: z.input<typeof PriceRowsSchema>) {
  return run((s) => applyImport(s, id.parse(supplierId), PriceRowsSchema.parse(rows)), ["/ingredients", "/recipes", "/suppliers", "/menus"]);
}

// ---------------------------------------------------------------- point of sale

/** One part of a sales file (the browser splits big files). `rowOffset` = data rows in earlier parts, for error row numbers. */
export async function importSalesCsv(text: string, rowOffset = 0) {
  return run(async (s) => {
    if (text.length > 1_000_000) throw new Error("Dieser Teil der Datei ist zu groß.");
    const outletId = await currentOutletId(s);
    const tz = (await repo.listOutlets(s)).find((o) => o.id === outletId)?.timezone;
    const { rows, errors } = parseSalesCsv(text, (ms) => zoneOffsetMinutes(ms, tz));
    const result = rows.length ? await repo.importSales(s, outletId, rows) : { imported: 0, duplicates: 0, depleted: 0, unmapped: 0 };
    const shifted = errors.map((e) => (e.row === 1 ? e : { ...e, row: e.row + rowOffset }));
    return { ...result, errors: shifted.slice(0, 50), errorCount: errors.length, headerProblem: errors.some((e) => e.row === 1) };
  }, ["/analytics/pos", "/stock"]);
}
const LinkSchema = z.object({ recipeId: z.string().min(1).nullable(), ignored: z.boolean() });
export async function linkPosItem(posItemId: string, input: z.input<typeof LinkSchema>) {
  return run((s) => repo.linkPosItem(s, posItemId, LinkSchema.parse(input)), ["/analytics/pos", "/stock"]);
}
export async function createApiKey(name: string) {
  return run(async (s) => repo.createApiKey(s, await currentOutletId(s), z.string().trim().min(1, "Bitte einen Namen angeben, z. B. „Kasse Theke“.").max(80).parse(name)), ["/analytics/pos"]);
}
export async function revokeApiKey(keyId: string) {
  return run((s) => repo.revokeApiKey(s, keyId), ["/analytics/pos"]);
}

// ---------------------------------------------------------------- settings

export async function updateLibrary(input: { name: string; defaultVatBp: number; wageCentsPerHour: number | null }) {
  const schema = z.object({ name, defaultVatBp: bp, wageCentsPerHour: cents.nullable() });
  return run((s) => repo.updateLibrary(s, schema.parse(input)), ["/"]);
}
export async function createOutlet(outletName: string, isCentralKitchen: boolean) {
  return run(async (s) => {
    const id = await repo.createOutlet(s, name.parse(outletName), isCentralKitchen);
    const billing = await repo.getBilling(s);
    if (billing.stripeSubscriptionId && billingConfigured()) {
      // Billing follows the outlet count. If Stripe is down the outlet still exists; the next change re-syncs.
      await syncOutletQuantity(billing.stripeSubscriptionId, (await repo.listOutlets(s)).length).catch((e) => console.error("[billing] quantity sync failed", e));
    }
    return id;
  }, ["/"]);
}
const MemberSchema = z.object({ role: z.enum(["admin", "chef", "outlet_staff"]), outletIds: z.array(id) })
  .refine((v) => v.role !== "outlet_staff" || v.outletIds.length > 0, "Bitte mindestens ein Outlet wählen.");
export async function updateMember(memberId: string, input: z.input<typeof MemberSchema>) {
  return run((s) => repo.updateMember(s, memberId, MemberSchema.parse(input)), ["/settings/team"], { readOnlyOk: true });
}
export async function archiveOutlet(outletId: string) {
  return run(async (s) => {
    await repo.archiveOutlet(s, outletId);
    const billing = await repo.getBilling(s);
    if (billing.stripeSubscriptionId && billingConfigured()) {
      // Billing follows the outlet count, credited pro rata. If Stripe is down the next change re-syncs.
      await syncOutletQuantity(billing.stripeSubscriptionId, (await repo.listOutlets(s)).length).catch((e) => console.error("[billing] quantity sync failed", e));
    }
  }, ["/"]);
}
export async function setOutletCostCenter(outletId: string, costCenter: string) {
  return run((s) => repo.setOutletCostCenter(s, id.parse(outletId), z.string().trim().max(20, "Höchstens 20 Zeichen.").parse(costCenter) || null), ["/analytics/controlling"]);
}
export async function removeMember(memberId: string) {
  return run((s) => repo.removeMember(s, memberId), ["/settings/team"], { readOnlyOk: true });
}
export async function transferOwnership(memberId: string) {
  return run((s) => repo.transferOwnership(s, memberId), ["/"], { readOnlyOk: true });
}

const ROLE_LABEL = { admin: "Admin", chef: "Küchenleitung", outlet_staff: "Teammitglied" } as const;

export async function inviteMember(input: { name: string; email: string; role: string; outletIds: string[] }) {
  const schema = z.object({ name, email: emailSchema, role: z.enum(["admin", "chef", "outlet_staff"]), outletIds: z.array(id) });
  return run(async (s) => {
    const data = schema.parse(input);
    if (!(await allow(`invite:${s.libraryId}`, 20, 3600))) throw new RateLimited();
    const { token } = await repo.inviteMember(s, data);
    if (!token) return { sent: false };
    const lib = await repo.getLibrary(s);
    await sendMail({ to: data.email, replyTo: s.email, ...invitationMail({ libraryName: lib.name, inviterName: s.name, roleLabel: ROLE_LABEL[data.role], link: `${appUrl()}/invite/${token}` }) });
    return { sent: true };
  }, ["/settings/team"]);
}
