// Row and input types of the linen, occupancy plan and roster functions (shared by both data backends).
import type { HkSettings, LinenItem, PlanRow } from "@/domain/linen";

export type LinenItemRow = LinenItem & { sets: { roomType: string; qty: number }[] };
export type HkSetup = { settings: HkSettings; items: LinenItemRow[]; roomTypes: string[]; people: { id: string; name: string }[] };
export type LinenItemInput = { id?: string; name: string; kind: LinenItem["kind"]; priceCents: number; packSize: number; sets: { roomType: string; qty: number }[] };
export type LinenCountLine = { itemId: string; counted: number; discarded: number };
export type LinenMovementRow = { itemId: string; kind: "count" | "received" | "discard"; qty: number; before: number | null; priceCents: number; at: string };
export type LinenOrderStatus = "draft" | "sent" | "received";
export type LinenOrderRow = {
  id: string; supplierId: string | null; supplierName: string | null; deliveryDay: string; status: LinenOrderStatus; note: string | null; createdAt: string;
  lines: { itemId: string; name: string; qty: number; priceCents: number }[];
};
export type LinenOrderInput = { supplierId: string | null; deliveryDay: string; note: string | null; lines: { itemId: string; qty: number }[] };
export type LinenOrderMailData = { to: string | null; supplierName: string | null; outletName: string; libraryName: string; deliveryDay: string; note: string | null; lines: { name: string; qty: number; priceCents: number }[] };
export type ShiftRow = { id: string; day: string; membershipId: string | null; person: string; starts: string; ends: string; breakMinutes: number };
export type ShiftInput = Omit<ShiftRow, "id"> & { id?: string };
export type { PlanRow };

export type TicketKind = "defect" | "lost_found";
export type TicketRow = {
  id: string; kind: TicketKind; title: string; note: string | null; status: "open" | "done"; resolution: string | null;
  roomId: string | null; roomNumber: string | null; hasPhoto: boolean; createdAt: string; createdByName: string | null; closedAt: string | null;
};
export type TicketInput = { kind: TicketKind; title: string; note: string | null; roomId: string | null; photo: { base64: string; type: "image/jpeg" | "image/png" | "image/webp" } | null };
export type CleaningTime = { person: string; rooms: number; avgMinutes: number };
