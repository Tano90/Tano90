-- Housekeeping, part 2: linen stock and counts, the occupancy plan (arrivals, departures, stayovers per day and
-- room type, typed in or imported from the hotel program's report), linen orders with a forecast, and the
-- housekeeping roster. Everything belongs to one outlet (the hotel).
-- Row-level security: everyone with access to the outlet reads; counting linen is open to them too (staff count);
-- settings, items, plan, orders and shifts belong to owners, admins and the head of department.

create table hk_settings (
  outlet_id uuid primary key references outlets(id) on delete cascade,
  library_id uuid not null references libraries(id) on delete cascade,
  bed_every_days integer not null default 3 check (bed_every_days between 1 and 14),
  bath_every_days integer not null default 1 check (bath_every_days between 1 and 14),
  minutes_departure integer not null default 30 check (minutes_departure between 1 and 240),
  minutes_stayover integer not null default 15 check (minutes_stayover between 0 and 240),
  minutes_arrival integer not null default 5 check (minutes_arrival between 0 and 240),
  safety_pct integer not null default 10 check (safety_pct between 0 and 100),
  cover_days integer not null default 7 check (cover_days between 1 and 28)
);

create table linen_items (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries(id) on delete cascade,
  outlet_id uuid not null references outlets(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  kind text not null check (kind in ('bed', 'bath', 'other')),
  price_cents integer not null default 0 check (price_cents between 0 and 100000),
  pack_size integer not null default 1 check (pack_size between 1 and 1000),
  stock_clean integer not null default 0 check (stock_clean >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index linen_items_name_per_outlet on linen_items (outlet_id, lower(name)) where archived_at is null;

-- What one full change of a room type uses, per item ('' = rooms without a type).
create table linen_set_items (
  item_id uuid not null references linen_items(id) on delete cascade,
  room_type text not null default '' check (length(room_type) <= 60),
  qty integer not null check (qty between 1 and 50),
  primary key (item_id, room_type)
);

create table occupancy_plan (
  outlet_id uuid not null references outlets(id) on delete cascade,
  library_id uuid not null references libraries(id) on delete cascade,
  day date not null,
  room_type text not null default '' check (length(room_type) <= 60),
  arrivals integer not null default 0 check (arrivals between 0 and 5000),
  departures integer not null default 0 check (departures between 0 and 5000),
  stayovers integer not null default 0 check (stayovers between 0 and 5000),
  primary key (outlet_id, day, room_type)
);

create table linen_orders (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries(id) on delete cascade,
  outlet_id uuid not null references outlets(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete set null,
  delivery_day date not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'received')),
  note text check (length(note) <= 500),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  received_at timestamptz
);
create index on linen_orders (outlet_id, created_at desc);

create table linen_order_lines (
  order_id uuid not null references linen_orders(id) on delete cascade,
  item_id uuid not null references linen_items(id) on delete cascade,
  qty integer not null check (qty between 1 and 100000),
  price_cents integer not null check (price_cents >= 0),
  primary key (order_id, item_id)
);

-- Every change of the clean stock. 'count': qty = counted, before = stock the system expected (before − qty is what
-- was used since the last count). 'received': delivered clean. 'discard': taken out (torn, stained, lost).
create table linen_movements (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries(id) on delete cascade,
  outlet_id uuid not null references outlets(id) on delete cascade,
  item_id uuid not null references linen_items(id) on delete cascade,
  kind text not null check (kind in ('count', 'received', 'discard')),
  qty integer not null check (qty >= 0),
  before integer,
  price_cents integer not null default 0,
  order_id uuid references linen_orders(id) on delete set null,
  by_user uuid references auth.users(id) on delete set null,
  at timestamptz not null default now()
);
create index on linen_movements (outlet_id, at desc);

create table hk_shifts (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries(id) on delete cascade,
  outlet_id uuid not null references outlets(id) on delete cascade,
  day date not null,
  membership_id uuid references memberships(id) on delete set null,
  person text not null check (length(person) between 1 and 80),
  starts time not null,
  ends time not null,
  break_minutes integer not null default 0 check (break_minutes between 0 and 240),
  check (ends > starts)
);
create index on hk_shifts (outlet_id, day);

alter table hk_settings enable row level security;
alter table linen_items enable row level security;
alter table linen_set_items enable row level security;
alter table occupancy_plan enable row level security;
alter table linen_orders enable row level security;
alter table linen_order_lines enable row level security;
alter table linen_movements enable row level security;
alter table hk_shifts enable row level security;

-- Read: anyone with the outlet. Write: managers of the library with the outlet.
create policy hk_settings_read on hk_settings for select using (can_access_outlet(outlet_id));
create policy hk_settings_write on hk_settings for all
  using (has_role(library_id, '{owner,admin,chef}') and can_access_outlet(outlet_id))
  with check (has_role(library_id, '{owner,admin,chef}') and can_access_outlet(outlet_id)
    and exists (select 1 from outlets o where o.id = outlet_id and o.library_id = hk_settings.library_id));

create policy linen_items_read on linen_items for select using (can_access_outlet(outlet_id));
create policy linen_items_write on linen_items for all
  using (has_role(library_id, '{owner,admin,chef}') and can_access_outlet(outlet_id))
  with check (has_role(library_id, '{owner,admin,chef}') and can_access_outlet(outlet_id)
    and exists (select 1 from outlets o where o.id = outlet_id and o.library_id = linen_items.library_id));
-- Counting changes stock_clean; staff with the outlet may do that (the app only lets them set the counted number).
create policy linen_items_count on linen_items for update using (can_access_outlet(outlet_id)) with check (can_access_outlet(outlet_id));

create policy linen_set_read on linen_set_items for select using (exists (select 1 from linen_items i where i.id = item_id and can_access_outlet(i.outlet_id)));
create policy linen_set_write on linen_set_items for all
  using (exists (select 1 from linen_items i where i.id = item_id and has_role(i.library_id, '{owner,admin,chef}') and can_access_outlet(i.outlet_id)))
  with check (exists (select 1 from linen_items i where i.id = item_id and has_role(i.library_id, '{owner,admin,chef}') and can_access_outlet(i.outlet_id)));

create policy occupancy_read on occupancy_plan for select using (can_access_outlet(outlet_id));
create policy occupancy_write on occupancy_plan for all
  using (has_role(library_id, '{owner,admin,chef}') and can_access_outlet(outlet_id))
  with check (has_role(library_id, '{owner,admin,chef}') and can_access_outlet(outlet_id)
    and exists (select 1 from outlets o where o.id = outlet_id and o.library_id = occupancy_plan.library_id));

create policy linen_orders_read on linen_orders for select using (can_access_outlet(outlet_id));
create policy linen_orders_write on linen_orders for all
  using (has_role(library_id, '{owner,admin,chef}') and can_access_outlet(outlet_id))
  with check (has_role(library_id, '{owner,admin,chef}') and can_access_outlet(outlet_id)
    and exists (select 1 from outlets o where o.id = outlet_id and o.library_id = linen_orders.library_id));

create policy linen_order_lines_read on linen_order_lines for select using (exists (select 1 from linen_orders o where o.id = order_id and can_access_outlet(o.outlet_id)));
create policy linen_order_lines_write on linen_order_lines for all
  using (exists (select 1 from linen_orders o where o.id = order_id and has_role(o.library_id, '{owner,admin,chef}') and can_access_outlet(o.outlet_id)))
  with check (exists (select 1 from linen_orders o where o.id = order_id and has_role(o.library_id, '{owner,admin,chef}') and can_access_outlet(o.outlet_id)));

create policy linen_movements_read on linen_movements for select using (can_access_outlet(outlet_id));
create policy linen_movements_insert on linen_movements for insert with check (
  can_access_outlet(outlet_id) and by_user = auth.uid()
  and (kind = 'count' or has_role(library_id, '{owner,admin,chef}'))
  and exists (select 1 from linen_items i where i.id = item_id and i.outlet_id = linen_movements.outlet_id));

create policy hk_shifts_read on hk_shifts for select using (can_access_outlet(outlet_id));
create policy hk_shifts_write on hk_shifts for all
  using (has_role(library_id, '{owner,admin,chef}') and can_access_outlet(outlet_id))
  with check (has_role(library_id, '{owner,admin,chef}') and can_access_outlet(outlet_id)
    and exists (select 1 from outlets o where o.id = outlet_id and o.library_id = hk_shifts.library_id));
