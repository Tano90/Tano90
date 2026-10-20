// Row types, one per table in replica/schema.sql (camelCase). The fake store and the
// Supabase repository both return these, so screens do not change when the backend does.
import type { Allergen, AllergenStatus } from "@/domain/allergens";
import type { LineUnit } from "@/domain/costing";
import type { BaseUnit } from "@/domain/units";

export type Role = "owner" | "admin" | "chef" | "outlet_staff";

export type Library = {
  id: string;
  name: string;
  currency: string;
  defaultVatBp: number;
  wageCentsPerHour: number | null;
};

export type Outlet = { id: string; libraryId: string; name: string; isCentralKitchen: boolean; timezone: string; archivedAt: string | null };

export type Member = { id: string; userId: string; name: string; email: string; role: Role; allOutlets: boolean; outletIds: string[] };

export type Category = { id: string; kind: "ingredient" | "recipe" | "menu"; name: string };

export type Ingredient = {
  id: string;
  libraryId: string;
  name: string;
  shortName: string | null;
  internalUid: string | null;
  categoryId: string | null;
  baseUnit: BaseUnit;
  gramsPerPiece: number | null;
  mlPerGram: number | null;
  allergensVerified: boolean;
  archivedAt: string | null;
  updatedAt: string;
};

export type Package = { id: string; ingredientId: string; parentPackageId: string | null; count: number; quantityBase: number; label: string };

export type Supplier = {
  id: string;
  libraryId: string;
  companyName: string;
  email: string | null;
  orderEmail: string | null;
  phone: string | null;
  customerNumber: string | null;
  leadTimeDays: number;
  minOrderCents: number | null;
  archivedAt: string | null;
};

export type StockItem = {
  id: string;
  ingredientId: string;
  supplierId: string | null;
  packageId: string;
  name: string;
  supplierSku: string | null;
  gtin: string | null;
  priceType: "per_pack" | "per_unit";
  priceCents: number;
  priceUnit: BaseUnit | null;
  priceUnitQuantity: number | null;
  isPreferred: boolean;
  weighted: boolean;
  archivedAt: string | null;
};

export type AllergenRow = Partial<Record<Allergen, AllergenStatus>>;

export type Nutrition = {
  energyKcal: number | null;
  fatG: number | null;
  saturatedFatG: number | null;
  carbohydrateG: number | null;
  sugarsG: number | null;
  proteinG: number | null;
  saltG: number | null;
};

export type RecipeLine = { id: string; ingredientId: string | null; subRecipeId: string | null; quantity: number; unit: LineUnit; position: number; note: string | null };

export type Recipe = {
  id: string;
  libraryId: string;
  name: string;
  categoryId: string | null;
  productType: "finished" | "semi_finished";
  portions: number;
  netQuantityBase: number | null;
  netUnit: BaseUnit;
  sellPriceCents: number | null;
  sellPriceIncludesVat: boolean;
  vatBp: number | null;
  targetFoodCostBp: number | null;
  prepMinutes: number | null;
  instructions: string | null;
  lines: RecipeLine[];
  extraAllergens: AllergenRow;
  archivedAt: string | null;
  updatedAt: string;
};

export type OutletIngredient = { outletId: string; ingredientId: string; parLevelBase: number | null; minLevelBase: number | null };

export type PoStatus = "draft" | "ordered" | "partially_delivered" | "delivered" | "cancelled";
export type PurchaseOrderLine = { id: string; stockItemId: string; quantityPacks: number; unitPriceCents: number };
export type PurchaseOrder = {
  id: string;
  outletId: string;
  supplierId: string;
  orderNumber: string;
  status: PoStatus;
  orderedAt: string | null;
  expectedDeliveryDate: string | null;
  note: string | null;
  lines: PurchaseOrderLine[];
  /** Packs received so far, per order line id. */
  received: Record<string, number>;
  createdAt: string;
};

export type StockEventType = "count" | "waste" | "transfer" | "delivery" | "sale" | "production" | "correction";
export type StockMovement = { id: string; eventId: string; outletId: string; ingredientId: string; deltaBase: number; unitCostCents: number; countedBase: number | null; reason: string | null };
export type StockEvent = {
  id: string;
  outletId: string;
  type: StockEventType;
  status: "open" | "closed";
  occurredAt: string;
  counterpartOutletId: string | null;
  purchaseOrderId: string | null;
  note: string | null;
  createdBy: string | null;
  closedAt: string | null;
};
export type StockLevel = { outletId: string; ingredientId: string; quantityBase: number; avgCostCents: number };

/** Draft count lines kept on the open count event until it is closed. */
export type CountDraft = Record<string, number>; // ingredientId -> counted base quantity

export type Session = { userId: string; name: string; email: string; role: Role; libraryId: string; outletIds: string[] | "all" };
