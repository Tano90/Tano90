"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import * as repo from "@/data/repo";
import { OUTLET_COOKIE, SESSION_COOKIE, currentOutletId, requireSession } from "@/data/session";
import { db } from "@/data/store";
import type { Session } from "@/data/types";

export type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: (s: Session) => Promise<T>, paths: string[] = []): Promise<Result<T>> {
  try {
    const s = await requireSession();
    const data = await fn(s);
    for (const p of paths) revalidatePath(p, "layout");
    return { ok: true, data };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof z.ZodError) return { ok: false, error: e.issues.map((i) => i.message).join(" ") };
    return { ok: false, error: e instanceof Error ? e.message : "Unbekannter Fehler." };
  }
}

// ---------------------------------------------------------------- session

export async function signIn(_: Result | null, form: FormData): Promise<Result> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const m = db().members.find((x) => x.email === email);
  if (!m || password.length < 1) return { ok: false, error: "E-Mail oder Passwort stimmt nicht." };
  (await cookies()).set(SESSION_COOKIE, m.userId, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/");
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export async function setOutlet(outletId: string) {
  (await cookies()).set(OUTLET_COOKIE, outletId, { sameSite: "lax", path: "/" });
  revalidatePath("/", "layout");
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
  return run((s) => repo.previewRecipe(s, RecipeSchema.parse(input)));
}
export async function saveRecipe(input: RecipeInput) {
  return run((s) => repo.saveRecipe(s, RecipeSchema.parse(input)), ["/recipes", "/ingredients"]);
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
  return run((s) => repo.sendOrder(s, orderId), ["/orders", "/"]);
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

// ---------------------------------------------------------------- stock

export async function startCount() {
  return run(async (s) => repo.startCount(s, await currentOutletId(s)), ["/stock"]);
}
export async function saveCountLines(eventId: string, counted: Record<string, number | null>) {
  return run((s) => repo.saveCountLines(s, eventId, z.record(z.string(), z.number().min(0).nullable()).parse(counted)));
}
export async function closeCount(eventId: string) {
  return run((s) => repo.closeCount(s, eventId), ["/stock", "/"]);
}
const WasteSchema = z.array(z.object({ ingredientId: z.string().min(1, "Bitte eine Zutat wählen."), quantityBase: positive, reason: z.string().min(1, "Bitte einen Grund wählen.") }));
export async function recordWaste(lines: z.input<typeof WasteSchema>) {
  return run(async (s) => repo.recordWaste(s, await currentOutletId(s), WasteSchema.parse(lines)), ["/stock", "/"]);
}

// ---------------------------------------------------------------- settings

export async function updateLibrary(input: { name: string; defaultVatBp: number; wageCentsPerHour: number | null }) {
  const schema = z.object({ name, defaultVatBp: bp, wageCentsPerHour: cents.nullable() });
  return run((s) => repo.updateLibrary(s, schema.parse(input)), ["/"]);
}
export async function createOutlet(outletName: string, isCentralKitchen: boolean) {
  return run((s) => repo.createOutlet(s, name.parse(outletName), isCentralKitchen), ["/"]);
}
export async function inviteMember(input: { name: string; email: string; role: string; outletIds: string[] }) {
  const schema = z.object({ name, email: z.string().trim().email("Die E-Mail-Adresse ist ungültig."), role: z.enum(["admin", "chef", "outlet_staff"]), outletIds: z.array(id) });
  return run((s) => repo.inviteMember(s, schema.parse(input)), ["/settings/team"]);
}
