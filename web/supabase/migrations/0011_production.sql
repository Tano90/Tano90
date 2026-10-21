-- S23 central kitchen: outlets request recipes, the central kitchen plans, produces (raw goods leave its stock)
-- and delivers. Finished goods are not stock items: stock is kept per ingredient.
create table production_requests (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries(id) on delete cascade,
  from_outlet_id uuid not null references outlets(id) on delete cascade,
  kitchen_outlet_id uuid not null references outlets(id) on delete cascade,
  recipe_id uuid not null references recipes(id) on delete restrict,
  portions numeric(10,3) not null check (portions > 0),
  needed_on date not null,
  note text,
  status text not null default 'requested' check (status in ('requested', 'produced', 'delivered', 'cancelled')),
  production_event_id uuid references stock_events(id) on delete set null,
  cost_cents numeric(14,4),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  produced_at timestamptz,
  delivered_at timestamptz
);
create index on production_requests (kitchen_outlet_id, needed_on);
create index on production_requests (from_outlet_id, needed_on);
alter table production_requests enable row level security;
-- Both sides see a request; the requesting outlet writes its own, the kitchen writes what it produces.
create policy production_requests_rw on production_requests for all
  using (can_access_outlet(from_outlet_id) or can_access_outlet(kitchen_outlet_id))
  with check (
    (can_access_outlet(from_outlet_id) or can_access_outlet(kitchen_outlet_id))
    and exists (select 1 from outlets k where k.id = kitchen_outlet_id and k.library_id = library_id and k.is_central_kitchen)
    and exists (select 1 from outlets f where f.id = from_outlet_id and f.library_id = library_id)
    and exists (select 1 from recipes r where r.id = recipe_id and r.library_id = library_id));
