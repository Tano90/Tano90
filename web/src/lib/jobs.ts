// Time-based jobs, triggered by Vercel Cron (vercel.json) through /api/cron/[job].
// Each item is processed on its own: a failure is recorded in job_runs and retried on the next run;
// after MAX_ATTEMPTS it is marked dead and stays visible there (the dead-letter log).
import "server-only";
import { asService } from "@/data/pg/client";
import { formatBase } from "./units-display";
import { sendMail } from "./mail";
import { lowStockMail } from "./mail-templates";

const MAX_ATTEMPTS = 5;

async function item(job: string, key: string, fn: () => Promise<void>): Promise<"ok" | "failed" | "dead" | "skipped"> {
  const [prev] = await asService((tx) => tx<{ status: string; attempts: number }[]>`select status, attempts from job_runs where job = ${job} and item_key = ${key}`);
  if (prev?.status === "ok" || prev?.status === "dead") return "skipped";
  try {
    await fn();
    await asService((tx) => tx`
      insert into job_runs (job, item_key, status) values (${job}, ${key}, 'ok')
      on conflict (job, item_key) where item_key is not null do update set status = 'ok', attempts = job_runs.attempts + 1, error = null, updated_at = now()`);
    return "ok";
  } catch (e) {
    const attempts = (prev?.attempts ?? 0) + 1;
    const status = attempts >= MAX_ATTEMPTS ? "dead" : "failed";
    const msg = e instanceof Error ? e.message.slice(0, 500) : String(e);
    await asService((tx) => tx`
      insert into job_runs (job, item_key, status, error) values (${job}, ${key}, ${status}, ${msg})
      on conflict (job, item_key) where item_key is not null do update set status = ${status}, attempts = ${attempts}, error = ${msg}, updated_at = now()`);
    console.error(`[job ${job}] ${key} ${status}: ${msg}`);
    return status;
  }
}

/** Daily: one email per outlet listing items below minimum stock, to the team of that outlet. */
export async function lowStockAlerts(now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const outlets = await asService((tx) => tx<{ outletId: string; outletName: string }[]>`
    select o.id as outlet_id, o.name as outlet_name from outlets o join libraries l on l.id = o.library_id
    where o.archived_at is null and l.plan in ('trial', 'active')`);
  const results: Record<string, number> = { ok: 0, failed: 0, dead: 0, skipped: 0 };
  for (const o of outlets) {
    const r = await item("low-stock", `${o.outletId}:${day}`, async () => {
      const low = await asService((tx) => tx<{ ingredientId: string; name: string; baseUnit: "g" | "ml" | "piece"; onHand: number; min: number }[]>`
        select i.id as ingredient_id, i.name, i.base_unit, coalesce(sl.quantity_base, 0) as on_hand, oi.min_level_base as min
        from outlet_ingredients oi join ingredients i on i.id = oi.ingredient_id and i.archived_at is null
        left join stock_levels sl on sl.outlet_id = oi.outlet_id and sl.ingredient_id = i.id
        where oi.outlet_id = ${o.outletId} and oi.min_level_base is not null and coalesce(sl.quantity_base, 0) < oi.min_level_base
          and not exists (select 1 from stock_alerts_sent a where a.outlet_id = oi.outlet_id and a.ingredient_id = i.id and a.day = ${day})
        order by i.name`);
      if (!low.length) return;
      const recipients = await asService((tx) => tx<{ email: string }[]>`
        select distinct m.email from memberships m join outlets o on o.library_id = m.library_id
        left join membership_outlets mo on mo.membership_id = m.id and mo.outlet_id = o.id
        where o.id = ${o.outletId} and m.email <> '' and (m.role in ('owner', 'admin') or m.all_outlets or mo.outlet_id is not null)`);
      const mail = lowStockMail({
        outletName: o.outletName,
        link: `${process.env.APP_URL ?? "http://localhost:3000"}/orders/new`,
        items: low.map((l) => ({ name: l.name, onHand: formatBase(l.onHand, l.baseUnit), min: formatBase(l.min, l.baseUnit) })),
      });
      for (const r of recipients) await sendMail({ to: r.email, ...mail, idempotencyKey: `low-stock-${o.outletId}-${day}-${r.email}` });
      await asService((tx) => tx`insert into stock_alerts_sent ${tx(low.map((l) => ({ outletId: o.outletId, ingredientId: l.ingredientId, day })))} on conflict do nothing`);
    });
    results[r]++;
  }
  return results;
}

/** Daily: delete expired invitations, old rate-limit hits, webhook ids older than 90 days. */
export async function cleanup() {
  return asService(async (tx) => {
    const inv = await tx`delete from invitations where accepted_at is null and expires_at < now() - interval '1 day'`;
    const rl = await tx`delete from rate_limit_events where at < now() - interval '1 day'`;
    const wh = await tx`delete from processed_webhooks where received_at < now() - interval '90 days'`;
    const jr = await tx`delete from job_runs where status = 'ok' and updated_at < now() - interval '30 days'`;
    return { invitations: inv.count, rateLimitEvents: rl.count, webhooks: wh.count, jobRuns: jr.count };
  });
}
