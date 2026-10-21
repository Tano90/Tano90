// Row types, one per table in web/supabase/migrations (camelCase). The fake store and the
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

export type Outlet = { id: string; libraryId: string; name: string; isCentralKitchen: boolean; timezone: string; archivedAt: string | null; costCenter?: string | null };

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

export type PosItem = { id: string; outletId: string; plu: string; name: string; recipeId: string | null; ignored: boolean };
export type Sale = { id: string; outletId: string; posItemId: string; externalId: string; quantity: number; revenueNetCents: number; soldAt: string; depletedEventId: string | null };
export type ApiKey = { id: string; libraryId: string; outletId: string | null; name: string; keyHash: string; lastUsedAt: string | null; revokedAt: string | null; createdAt: string };

export type HaccpItem = { id: string; position: number; label: string; kind: "check" | "temperature" | "text"; minValue: number | null; maxValue: number | null };
export type HaccpChecklist = { id: string; name: string; archivedAt: string | null; items: HaccpItem[] };
export type HaccpRecord = {
  itemId: string; outletId: string; day: string; valueText: string | null; valueNumber: number | null; ok: boolean; action: string | null;
  recordedBy: string | null; recordedAt: string;
};

export type ProductionRequest = {
  id: string; fromOutletId: string; kitchenOutletId: string; recipeId: string; portions: number; neededOn: string; note: string | null;
  status: "requested" | "produced" | "delivered" | "cancelled"; productionEventId: string | null; costCents: number | null;
  createdBy: string | null; createdAt: string; producedAt: string | null; deliveredAt: string | null;
};

export type MenuItem = { id: string; recipeId: string; portions: number; position: number };
export type MenuCourse = { id: string; name: string; position: number; items: MenuItem[] };
export type Menu = {
  id: string;
  libraryId: string;
  name: string;
  categoryId: string | null;
  priceCents: number | null;
  priceIncludesVat: boolean;
  vatBp: number | null;
  /** Gross margin the kitchen aims for: (net price - food cost) / net price. */
  targetMarginBp: number | null;
  validFrom: string | null;
  validTo: string | null;
  archivedAt: string | null;
  updatedAt: string;
  courses: MenuCourse[];
};

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
/** One line of a count sheet: a total in base units, or a count in packages. null clears the line. */
export type CountEntry = number | { packs: Record<string, number>; looseBase: number } | null;

export type Session = { userId: string; name: string; email: string; role: Role; libraryId: string; outletIds: string[] | "all" };

export type Room = {
  id: string; libraryId: string; outletId: string; number: string; floor: string | null; roomType: string | null;
  status: "dirty" | "clean" | "inspected" | "out_of_order"; occupancy: "vacant" | "occupied" | "departure" | "arrival";
  assignedTo: string | null; note: string | null; updatedAt: string; updatedBy: string | null; archivedAt: string | null;
  dnd: boolean; vip: boolean; arrivalTime: string | null; cleaningStartedAt: string | null;
};
export type RoomEvent = { id: string; roomId: string; fromStatus: string | null; toStatus: string; checked: string[]; byUser: string | null; at: string; minutes?: number | null };
export type HkChecklistItem = { id: string; position: number; label: string };
