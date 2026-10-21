// Room changes made without network, kept on the device until they are sent. Only the cleaning staff's own steps
// (cleaned, back to dirty, start, do not disturb, note) are queued; they are safe to send late and twice.
"use client";

export type QueuedPatch = { status?: "dirty" | "clean"; dnd?: boolean; start?: boolean; note?: string | null; checked?: string[] };
export type Queued = { id: string; roomId: string; number: string; patch: QueuedPatch; at: string };

const KEY = "mirepa-hk-outbox";
const listeners = new Set<() => void>();

export function readOutbox(): Queued[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Queued[];
  } catch {
    return [];
  }
}
function write(items: Queued[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage full or blocked: the change stays only on screen */
  }
  for (const l of listeners) l();
}
export function enqueue(roomId: string, number: string, patch: QueuedPatch) {
  write([...readOutbox(), { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, roomId, number, patch, at: new Date().toISOString() }]);
}
export function dropQueued(id: string) {
  write(readOutbox().filter((q) => q.id !== id));
}
export function onOutboxChange(fn: () => void) {
  listeners.add(fn);
  const storage = (e: StorageEvent) => e.key === KEY && fn();
  window.addEventListener("storage", storage);
  return () => { listeners.delete(fn); window.removeEventListener("storage", storage); };
}
/** A failed server action from a dropped connection throws; a refused change returns { ok: false }. */
export const isNetworkError = (e: unknown) => !navigator.onLine || (e instanceof TypeError) || (e instanceof Error && /fetch|network|Failed to/i.test(e.message));
