// Picks the data backend: Postgres when DATABASE_URL is set, otherwise the in-memory demo store.
// `const impl: Repo = pg` makes TypeScript prove both have the same functions and return types.
import "server-only";
import * as pg from "./pg/repo-pg";
import * as memory from "./repo-memory";

type Repo = Omit<typeof memory, "sha256">;
// In production without a database every call fails loudly (checked per call, not at import, so `next build` works).
const misconfigured = process.env.NODE_ENV === "production" && !process.env.DATABASE_URL && process.env.ALLOW_DEMO !== "1";
const refuse = Object.fromEntries(
  Object.keys(memory).map((k) => [k, () => Promise.reject(new Error("DATABASE_URL is required in production."))]),
) as unknown as Repo;
const impl: Repo = process.env.DATABASE_URL ? pg : misconfigured ? refuse : memory;

export const usingDatabase = !!process.env.DATABASE_URL;
export const {
  getMembership, findUserIdByEmail, createLibrary, invitationPreview, acceptInvitation, deleteAccountData,
  getLibrary, getBilling, updateLibrary, listOutlets, createOutlet, archiveOutlet, listMembers, inviteMember, updateMember, removeMember, transferOwnership, listCategories,
  listIngredients, getIngredient, setOutletCarried, saveIngredient, archiveIngredient, savePackage, deletePackage, saveStockItem, archiveStockItem,
  setIngredientAllergens, setNutrition, listSuppliers, getSupplier, saveSupplier, archiveSupplier,
  listRecipes, getRecipe, lineOptions, previewRecipe, saveRecipe, archiveRecipe, setRecipeOutletPrice, getRecipeLabel, listMenus, getMenu, saveMenu, archiveMenu,
  getStock, getStockReport, listStockEvents, recordWaste, recordTransfer, listTransfers, setStockLevels, getOpenCount, startCount, saveCountLines, closeCount,
  listOrders, orderCounts, getOrder, orderableItems, saveOrderDraft, sendOrder, deleteOrderDraft, receiveDelivery,
  listProduction, requestProduction, cancelProductionRequest, produce, deliverProduction,
  getInvoice, saveInvoice, approveInvoice, listChecklists, getHaccpDay, saveHaccpRecords, haccpDeviations, saveChecklist, archiveChecklist, getMenuEngineering, importSales, importSalesWithKey, listPosItems, linkPosItem, listApiKeys, createApiKey, revokeApiKey,
  dashboard, exportLibrary,
  saveEInvoice, listInvoices,
  getCostSetup, saveCostSettings, saveFixedCost, archiveFixedCost,
  getFunnel, saveFunnelDays, deleteFunnelDay, saveFunnelSettings,
} = impl;
export type * from "./finance-types";
export type * from "./cost-types";
export type { Billing, ChecklistDraft, HaccpEntry, IngredientFilter, ProductionInput, IngredientInput, MenuDraft, RecipeDraft, StockItemInput, SupplierInput } from "./repo-memory";
