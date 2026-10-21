// Inquiries from the website and cookie-free view counts: the operator's demand data, not a library's.
// Postgres through the service connection when configured, an in-memory list otherwise (demo, tests without DB).
import "server-only";
import { asService } from "@/data/pg/client";
import { addDays, dayIn } from "@/lib/dates";

export type LeadStatus = "new" | "contacted" | "demo" | "won" | "lost";
export type LeadInput = {
  name: string; company: string; email: string; phone: string | null; outlets: number | null; message: string | null;
  source: string | null; medium: string | null; campaign: string | null; referrer: string | null;
};
export type Lead = LeadInput & { id: string; createdAt: string; updatedAt: string; status: LeadStatus; notes: string | null };

type Memory = { leads: Lead[]; views: Map<string, number> };
const mem = (): Memory => ((globalThis as { __leads?: Memory }).__leads ??= { leads: [], views: new Map() });
const pg = () => !!process.env.DATABASE_URL;

export async function createLead(input: LeadInput): Promise<string> {
  if (pg()) {
    const [row] = await asService((tx) => tx<{ id: string }[]>`insert into leads ${tx(input)} returning id`);
    return row.id;
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  mem().leads.unshift({ ...input, id, createdAt: now, updatedAt: now, status: "new", notes: null });
  return id;
}

export async function countView(path: string, source: string) {
  const day = dayIn();
  if (pg()) {
    await asService((tx) => tx`
      insert into page_views (day, path, source, views) values (${day}, ${path}, ${source}, 1)
      on conflict (day, path, source) do update set views = page_views.views + 1`);
    return;
  }
  const k = `${day}|${path}|${source}`;
  mem().views.set(k, (mem().views.get(k) ?? 0) + 1);
}

export async function listLeads(): Promise<Lead[]> {
  if (pg()) return asService((tx) => tx<Lead[]>`select * from leads order by created_at desc limit 1000`);
  return mem().leads;
}

export async function updateLead(id: string, patch: { status: LeadStatus; notes: string | null }) {
  if (pg()) {
    const rows = await asService((tx) => tx`update leads set status = ${patch.status}, notes = ${patch.notes}, updated_at = now() where id = ${id} returning id`);
    if (!rows.length) throw new Error("Anfrage nicht gefunden.");
    return;
  }
  const l = mem().leads.find((x) => x.id === id);
  if (!l) throw new Error("Anfrage nicht gefunden.");
  Object.assign(l, patch, { updatedAt: new Date().toISOString() });
}

export type DemandStats = {
  weeks: { from: string; views: number; leads: number }[];
  sources: { source: string; views: number; leads: number }[];
  total: { views: number; leads: number; demos: number; won: number };
};

/** The last `weeks` weeks (Monday to Sunday, Berlin days), views and inquiries per week and per source. */
export async function demandStats(weeks = 12): Promise<DemandStats> {
  const today = dayIn();
  const dow = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const firstMonday = addDays(today, -dow - 7 * (weeks - 1));
  const leads = (await listLeads()).filter((l) => dayIn(undefined, new Date(l.createdAt)) >= firstMonday);
  let views: { day: string; source: string; views: number }[];
  if (pg()) {
    views = await asService((tx) => tx<{ day: string; source: string; views: number }[]>`
      select to_char(day, 'YYYY-MM-DD') as day, source, views from page_views where path = '/' and day >= ${firstMonday}`);
  } else {
    views = [...mem().views].map(([k, n]) => { const [day, path, source] = k.split("|"); return { day, path, source, views: n }; })
      .filter((v) => v.path === "/" && v.day >= firstMonday);
  }
  const weekOf = (day: string) => {
    const d = Math.floor((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${firstMonday}T12:00:00Z`)) / 86_400_000);
    return Math.floor(d / 7);
  };
  const ws = Array.from({ length: weeks }, (_, i) => ({ from: addDays(firstMonday, 7 * i), views: 0, leads: 0 }));
  const src = new Map<string, { views: number; leads: number }>();
  const bump = (s: string) => src.get(s) ?? (src.set(s, { views: 0, leads: 0 }), src.get(s)!);
  for (const v of views) { const w = ws[weekOf(v.day)]; if (w) w.views += v.views; bump(v.source || "direkt").views += v.views; }
  for (const l of leads) { const w = ws[weekOf(dayIn(undefined, new Date(l.createdAt)))]; if (w) w.leads++; bump(l.source || "direkt").leads++; }
  const all = await listLeads();
  return {
    weeks: ws,
    sources: [...src].map(([source, n]) => ({ source, ...n })).sort((a, b) => b.leads - a.leads || b.views - a.views),
    total: {
      views: ws.reduce((t, w) => t + w.views, 0), leads: ws.reduce((t, w) => t + w.leads, 0),
      demos: all.filter((l) => l.status === "demo" || l.status === "won").length, won: all.filter((l) => l.status === "won").length,
    },
  };
}

/** Inquiries are kept 12 months after the last change (privacy policy). */
export async function deleteStaleLeads() {
  if (!pg()) return 0;
  const rows = await asService((tx) => tx`delete from leads where updated_at < now() - interval '12 months' returning id`);
  return rows.length;
}
