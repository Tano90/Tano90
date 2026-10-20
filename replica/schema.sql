-- Schema for the Apicbase-style back-of-house clone.
-- Target: Postgres 15+ on Supabase (uses auth.users and auth.uid()).
-- Conventions:
--   * every tenant-owned row carries library_id; RLS checks membership.
--   * quantities are stored in the ingredient's base unit (g, ml or piece).
--   * prices the user types (package price, sell price, invoice total) are integer cents.
--   * derived per-base-unit costs (WAC, cost per gram) are numeric cents, because
--     0.3 ct/g does not fit in an integer; they are never typed by a user.
--   * all times are timestamptz in UTC.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- enums

create type base_unit as enum ('g', 'ml', 'piece');
create type member_role as enum ('owner', 'admin', 'chef', 'outlet_staff');
create type allergen as enum (
  'gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soybeans', 'milk', 'nuts',
  'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs'
);
-- order matters: higher wins when allergens roll up from ingredients to recipes
create type allergen_status as enum ('unknown', 'free', 'may_contain', 'contains');
create type product_type as enum ('finished', 'semi_finished');
create type price_type as enum ('per_pack', 'per_unit');
create type po_status as enum ('draft', 'ordered', 'partially_delivered', 'delivered', 'cancelled');
create type stock_event_type as enum (
  'count', 'waste', 'transfer', 'delivery', 'sale', 'production', 'correction'
);
create type stock_event_status as enum ('open', 'closed');

-- ---------------------------------------------------------------- shared

create function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- tenancy

create table libraries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency char(3) not null default 'EUR',
  default_vat_bp integer not null default 700 check (default_vat_bp between 0 and 10000), -- basis points, 700 = 7 %
  wage_cents_per_hour integer check (wage_cents_per_hour >= 0),
  stripe_customer_id text unique,
  plan text not null default 'trial' check (plan in ('trial', 'active', 'past_due', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table outlets (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries(id) on delete cascade,
  name text not null,
  is_central_kitchen boolean not null default false,
  timezone text not null default 'Europe/Berlin',
  custom_fields jsonb not null default '{}',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (library_id, name)
);
create index on outlets (library_id);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role member_role not null default 'outlet_staff',
  all_outlets boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (library_id, user_id)
);
create index on memberships (user_id);

create table membership_outlets (
  membership_id uuid not null references memberships(id) on delete cascade,
  outlet_id uuid not null references outlets(id) on delete cascade,
  primary key (membership_id, outlet_id)
);
create index on membership_outlets (outlet_id);

create table invitations (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries(id) on delete cascade,
  email text not null,
  role member_role not null,
  outlet_ids uuid[] not null default '{}',
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on invitations (library_id);

-- ---------------------------------------------------------------- library

create table categories (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries(id) on delete cascade,
  kind text not null check (kind in ('ingredient', 'recipe', 'menu')),
  name text not null,
  parent_id uuid references categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (library_id, kind, parent_id, name)
);
create index on categories (library_id, kind);
create index on categories (parent_id);

create table ingredients (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries(id) on delete cascade,
  name text not null,
  short_name text,
  internal_uid text,
  category_id uuid references categories(id) on delete set null,
  base_unit base_unit not null default 'g',
  grams_per_piece numeric(12,4) check (grams_per_piece > 0),  -- lets a 'piece' ingredient be used in g and vice versa
  ml_per_gram numeric(12,6) check (ml_per_gram > 0),          -- density, for g <-> ml
  shelf_life_days integer check (shelf_life_days >= 0),
  allergens_verified boolean not null default false,
  approved boolean not null default true,
  archived_at timestamptz,
  search tsvector generated always as (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(short_name, ''))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (library_id, internal_uid)
);
create index on ingredients (library_id, name);
create index on ingredients (category_id);
create index on ingredients using gin (search);

-- 150 g bag -> box of 30 bags. quantity_base is the total in the ingredient's base unit.
create table packages (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  parent_package_id uuid references packages(id) on delete restrict,
  count integer not null default 1 check (count > 0),           -- 30 (x the parent)
  quantity_base numeric(14,4) not null check (quantity_base > 0), -- 4500 g
  label text not null,                                           -- "30x150 g"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on packages (ingredient_id);
create index on packages (parent_package_id);

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries(id) on delete cascade,
  company_name text not null,
  email text,
  order_email text,
  phone text,
  vat_number text,
  customer_number text,
  lead_time_days integer not null default 1 check (lead_time_days >= 0),
  min_order_cents integer check (min_order_cents >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (library_id, company_name)
);

-- A supplier article: what you order, count and receive.
create table stock_items (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete set null,
  package_id uuid not null references packages(id) on delete restrict,
  name text not null,
  supplier_sku text,
  gtin text,
  price_type price_type not null default 'per_pack',
  price_cents integer not null check (price_cents >= 0),        -- net, excl. VAT
  price_unit base_unit,                                          -- required when per_unit
  price_unit_quantity numeric(14,4),                             -- e.g. 1000 for "per kg"
  is_preferred boolean not null default false,
  weighted boolean not null default false,
  stockable boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (price_type = 'per_pack' or (price_unit is not null and price_unit_quantity > 0))
);
create index on stock_items (library_id);
create index on stock_items (ingredient_id);
create index on stock_items (supplier_id);
create index on stock_items (package_id);
create index on stock_items (gtin) where gtin is not null;
create unique index one_preferred_stock_item on stock_items (ingredient_id) where is_preferred and archived_at is null;

create table stock_item_price_history (
  id uuid primary key default gen_random_uuid(),
  stock_item_id uuid not null references stock_items(id) on delete cascade,
  price_cents integer not null,
  valid_from timestamptz not null default now(),
  source text not null check (source in ('manual', 'import', 'invoice', 'delivery'))
);
create index on stock_item_price_history (stock_item_id, valid_from desc);

create table ingredient_allergens (
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  allergen allergen not null,
  status allergen_status not null default 'unknown',
  primary key (ingredient_id, allergen)
);

-- per 100 g (or 100 ml) of the ingredient
create table ingredient_nutrition (
  ingredient_id uuid primary key references ingredients(id) on delete cascade,
  energy_kj numeric(10,2),
  energy_kcal numeric(10,2),
  fat_g numeric(10,3),
  saturated_fat_g numeric(10,3),
  carbohydrate_g numeric(10,3),
  sugars_g numeric(10,3),
  fibre_g numeric(10,3),
  protein_g numeric(10,3),
  salt_g numeric(10,3),
  updated_at timestamptz not null default now()
);

create table recipes (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries(id) on delete cascade,
  uid text,
  name text not null,
  category_id uuid references categories(id) on delete set null,
  product_type product_type not null default 'finished',
  portions numeric(10,3) not null default 1 check (portions > 0),
  net_quantity_base numeric(14,4) check (net_quantity_base > 0), -- yield of the whole recipe; null = sum of lines
  net_unit base_unit not null default 'g',
  sell_price_cents integer check (sell_price_cents >= 0),          -- per portion
  sell_price_includes_vat boolean not null default true,
  vat_bp integer check (vat_bp between 0 and 10000),
  target_food_cost_bp integer check (target_food_cost_bp between 0 and 10000),
  prep_minutes integer check (prep_minutes >= 0),
  instructions text,
  archived_at timestamptz,
  search tsvector generated always as (to_tsvector('simple', coalesce(name, ''))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (library_id, uid)
);
create index on recipes (library_id, name);
create index on recipes (category_id);
create index on recipes using gin (search);

create table recipe_lines (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  ingredient_id uuid references ingredients(id) on delete restrict,
  sub_recipe_id uuid references recipes(id) on delete restrict,
  quantity numeric(14,4) not null check (quantity > 0),
  unit text not null check (unit in ('g', 'kg', 'mg', 'ml', 'cl', 'l', 'piece', 'portion')),
  position integer not null default 0,
  note text,
  check (num_nonnulls(ingredient_id, sub_recipe_id) = 1),
  check (sub_recipe_id is null or sub_recipe_id <> recipe_id)
);
create index on recipe_lines (recipe_id, position);
create index on recipe_lines (ingredient_id);
create index on recipe_lines (sub_recipe_id);

-- Reject sub-recipe cycles (A -> B -> A) at write time.
create function recipe_lines_no_cycle() returns trigger language plpgsql as $$
begin
  if new.sub_recipe_id is null then
    return new;
  end if;
  if exists (
    with recursive down(id) as (
      select new.sub_recipe_id
      union
      select rl.sub_recipe_id from recipe_lines rl join down on rl.recipe_id = down.id
      where rl.sub_recipe_id is not null
    )
    select 1 from down where id = new.recipe_id
  ) then
    raise exception 'sub-recipe cycle: recipe % would contain itself', new.recipe_id
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger recipe_lines_no_cycle before insert or update on recipe_lines
  for each row execute function recipe_lines_no_cycle();

create table recipe_outlet_prices (
  recipe_id uuid not null references recipes(id) on delete cascade,
  outlet_id uuid not null references outlets(id) on delete cascade,
  sell_price_cents integer not null check (sell_price_cents >= 0),
  primary key (recipe_id, outlet_id)
);
create index on recipe_outlet_prices (outlet_id);

-- Allergens added on the recipe itself ("may contain nuts, processed in this kitchen").
create table recipe_extra_allergens (
  recipe_id uuid not null references recipes(id) on delete cascade,
  allergen allergen not null,
  status allergen_status not null,
  primary key (recipe_id, allergen)
);

-- Cache of computed costs, rebuilt by the recost job. Never the source of truth.
create table recipe_costs (
  recipe_id uuid primary key references recipes(id) on delete cascade,
  cost_per_portion_cents numeric(14,4) not null,
  cost_per_base_unit_cents numeric(18,8) not null,
  missing_prices integer not null default 0,
  computed_at timestamptz not null default now()
);

create table menus (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries(id) on delete cascade,
  name text not null,
  category_id uuid references categories(id) on delete set null,
  price_cents integer check (price_cents >= 0),
  price_includes_vat boolean not null default true,
  vat_bp integer check (vat_bp between 0 and 10000),
  target_margin_bp integer check (target_margin_bp between 0 and 10000),
  valid_from date,
  valid_to date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);
create index on menus (library_id, name);
create index on menus (category_id);

create table menu_courses (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references menus(id) on delete cascade,
  name text not null,
  position integer not null default 0
);
create index on menu_courses (menu_id, position);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references menu_courses(id) on delete cascade,
  recipe_id uuid not null references recipes(id) on delete restrict,
  portions numeric(10,3) not null default 1 check (portions > 0),
  position integer not null default 0
);
create index on menu_items (course_id, position);
create index on menu_items (recipe_id);

-- ---------------------------------------------------------------- outlet-scoped

create table outlet_ingredients (
  outlet_id uuid not null references outlets(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  par_level_base numeric(14,4) check (par_level_base >= 0),
  min_level_base numeric(14,4) check (min_level_base >= 0),
  primary key (outlet_id, ingredient_id)
);
create index on outlet_ingredients (ingredient_id);

create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries(id) on delete cascade,
  outlet_id uuid not null references outlets(id) on delete restrict,
  supplier_id uuid not null references suppliers(id) on delete restrict,
  order_number text not null,
  status po_status not null default 'draft',
  ordered_at timestamptz,
  expected_delivery_date date,
  discount_cents integer not null default 0 check (discount_cents >= 0),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (library_id, order_number),
  check (status = 'draft' or ordered_at is not null)
);
create index on purchase_orders (outlet_id, status, created_at desc);
create index on purchase_orders (supplier_id);

create table purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  stock_item_id uuid not null references stock_items(id) on delete restrict,
  quantity_packs numeric(14,4) not null check (quantity_packs > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0), -- price per pack frozen at order time
  unique (purchase_order_id, stock_item_id)
);
create index on purchase_order_lines (stock_item_id);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete restrict,
  purchase_order_id uuid references purchase_orders(id) on delete set null,
  invoice_number text not null,
  invoice_date date not null,
  total_net_cents integer not null,
  file_path text,
  match_status text not null default 'unmatched'
    check (match_status in ('unmatched', 'matched', 'mismatch', 'approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id, invoice_number)
);
create index on invoices (library_id, invoice_date desc);
create index on invoices (purchase_order_id);

-- Every change to stock is an event with movements. Stock levels follow from these.
create table stock_events (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries(id) on delete cascade,
  outlet_id uuid not null references outlets(id) on delete restrict,
  type stock_event_type not null,
  status stock_event_status not null default 'closed',
  occurred_at timestamptz not null default now(),
  counterpart_outlet_id uuid references outlets(id) on delete restrict, -- transfer target
  purchase_order_id uuid references purchase_orders(id) on delete set null, -- delivery
  idempotency_key text,                                                  -- POS sale id, client retry key
  note text,
  created_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  check (type <> 'transfer' or (counterpart_outlet_id is not null and counterpart_outlet_id <> outlet_id)),
  check (status = 'open' or closed_at is not null or type <> 'count')
);
create index on stock_events (outlet_id, occurred_at desc);
create index on stock_events (purchase_order_id);
create index on stock_events (counterpart_outlet_id);
create unique index stock_events_idempotent on stock_events (outlet_id, type, idempotency_key)
  where idempotency_key is not null;
-- one open count per outlet at a time
create unique index one_open_count_per_outlet on stock_events (outlet_id)
  where type = 'count' and status = 'open';

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  stock_event_id uuid not null references stock_events(id) on delete cascade,
  outlet_id uuid not null references outlets(id) on delete restrict,
  ingredient_id uuid not null references ingredients(id) on delete restrict,
  stock_item_id uuid references stock_items(id) on delete set null,
  delta_base numeric(14,4) not null,                    -- + in, - out, in base unit
  unit_cost_cents numeric(18,8) not null default 0,     -- per base unit, at the time of movement
  counted_base numeric(14,4),                           -- counts only: what was counted
  reason text,                                          -- waste reason
  created_at timestamptz not null default now()
);
create index on stock_movements (stock_event_id);
create index on stock_movements (outlet_id, ingredient_id, created_at);
create index on stock_movements (stock_item_id);

-- Current level per outlet and ingredient, maintained in the same transaction as each movement.
create table stock_levels (
  outlet_id uuid not null references outlets(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  quantity_base numeric(14,4) not null default 0,
  avg_cost_cents numeric(18,8) not null default 0,       -- weighted average cost per base unit
  updated_at timestamptz not null default now(),
  primary key (outlet_id, ingredient_id)
);
create index on stock_levels (ingredient_id);

-- WAC: inbound movements re-average, outbound use the current average.
-- security definer: users may only read stock_levels; this trigger is the one writer.
create function apply_stock_movement() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  lvl stock_levels%rowtype;
begin
  -- a movement belongs to its event's outlet (or, for transfers, the receiving outlet)
  if not exists (
    select 1 from stock_events e
    where e.id = new.stock_event_id and new.outlet_id in (e.outlet_id, e.counterpart_outlet_id)
  ) then
    raise exception 'movement outlet % does not match its stock event', new.outlet_id
      using errcode = 'check_violation';
  end if;

  insert into stock_levels (outlet_id, ingredient_id) values (new.outlet_id, new.ingredient_id)
    on conflict do nothing;
  select * into lvl from stock_levels
    where outlet_id = new.outlet_id and ingredient_id = new.ingredient_id
    for update;

  if new.delta_base > 0 and lvl.quantity_base + new.delta_base > 0 then
    lvl.avg_cost_cents := (greatest(lvl.quantity_base, 0) * lvl.avg_cost_cents + new.delta_base * new.unit_cost_cents)
                          / (greatest(lvl.quantity_base, 0) + new.delta_base);
  elsif new.delta_base < 0 then
    new.unit_cost_cents := lvl.avg_cost_cents;
  end if;

  update stock_levels
    set quantity_base = lvl.quantity_base + new.delta_base,
        avg_cost_cents = lvl.avg_cost_cents,
        updated_at = now()
    where outlet_id = new.outlet_id and ingredient_id = new.ingredient_id;
  return new;
end $$;
create trigger stock_movements_apply before insert on stock_movements
  for each row execute function apply_stock_movement();

-- Movements are a ledger: no edits, corrections are new events.
create function stock_movements_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'stock_movements is append-only; record a correction event instead';
end $$;
create trigger stock_movements_no_update before update on stock_movements
  for each row execute function stock_movements_append_only();

create table pos_items (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries(id) on delete cascade,
  outlet_id uuid not null references outlets(id) on delete cascade,
  plu text not null,
  name text not null,
  recipe_id uuid references recipes(id) on delete set null,
  ignored boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (outlet_id, plu)
);
create index on pos_items (recipe_id);
create index on pos_items (outlet_id) where recipe_id is null and not ignored; -- "unmapped" list

create table sales (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries(id) on delete cascade,
  outlet_id uuid not null references outlets(id) on delete cascade,
  pos_item_id uuid not null references pos_items(id) on delete cascade,
  external_id text not null,                     -- receipt line id from the POS, for idempotency
  quantity numeric(10,3) not null,
  revenue_net_cents integer not null,
  sold_at timestamptz not null,
  depleted_event_id uuid references stock_events(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (outlet_id, external_id)
);
create index on sales (outlet_id, sold_at);
create index on sales (pos_item_id, sold_at);
create index on sales (depleted_event_id);

create table api_keys (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries(id) on delete cascade,
  outlet_id uuid references outlets(id) on delete cascade, -- POS keys are outlet-scoped
  name text not null,
  key_hash text not null unique,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index on api_keys (library_id);

create table imports (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries(id) on delete cascade,
  kind text not null check (kind in ('ingredients_prices', 'pos_links', 'sales')),
  file_path text not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed')),
  rows_ok integer not null default 0,
  errors jsonb not null default '[]',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index on imports (library_id, created_at desc);

create table processed_webhooks (
  provider text not null,
  event_id text not null,
  received_at timestamptz not null default now(),
  primary key (provider, event_id)
);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array[
    'libraries', 'outlets', 'memberships', 'ingredients', 'packages', 'suppliers', 'stock_items',
    'recipes', 'menus', 'purchase_orders', 'invoices', 'pos_items'
  ] loop
    execute format('create trigger %I before update on %I for each row execute function set_updated_at()',
                   t || '_updated_at', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- access rules (RLS)

create function is_member(lib uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where library_id = lib and user_id = auth.uid())
$$;

create function has_role(lib uuid, roles member_role[]) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where library_id = lib and user_id = auth.uid() and role = any(roles))
$$;

create function can_access_outlet(outlet uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from outlets o
    join memberships m on m.library_id = o.library_id and m.user_id = auth.uid()
    left join membership_outlets mo on mo.membership_id = m.id and mo.outlet_id = o.id
    where o.id = outlet
      and (m.all_outlets or m.role in ('owner', 'admin') or mo.outlet_id is not null)
  )
$$;

-- Library-level tables: members read, owner/admin/chef write.
do $$
declare t text;
begin
  foreach t in array array[
    'categories', 'ingredients', 'suppliers', 'stock_items', 'recipes', 'menus', 'invoices', 'imports'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (is_member(library_id))', t || '_read', t);
    execute format($p$create policy %I on %I for all
                     using (has_role(library_id, '{owner,admin,chef}'))
                     with check (has_role(library_id, '{owner,admin,chef}'))$p$, t || '_write', t);
  end loop;
end $$;

-- Outlet-level tables: anyone assigned to the outlet reads and writes.
do $$
declare t text;
begin
  foreach t in array array['purchase_orders', 'stock_events', 'pos_items', 'sales'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for all using (can_access_outlet(outlet_id)) with check (can_access_outlet(outlet_id))',
                   t || '_outlet', t);
  end loop;
end $$;

alter table stock_movements enable row level security;
create policy stock_movements_outlet on stock_movements for all
  using (can_access_outlet(outlet_id)) with check (can_access_outlet(outlet_id));
alter table stock_levels enable row level security;
create policy stock_levels_read on stock_levels for select using (can_access_outlet(outlet_id));
alter table outlet_ingredients enable row level security;
create policy outlet_ingredients_read on outlet_ingredients for select using (can_access_outlet(outlet_id));
create policy outlet_ingredients_write on outlet_ingredients for all
  using (can_access_outlet(outlet_id)) with check (can_access_outlet(outlet_id));

alter table libraries enable row level security;
create policy libraries_read on libraries for select using (is_member(id));
create policy libraries_write on libraries for update using (has_role(id, '{owner,admin}'));

alter table outlets enable row level security;
create policy outlets_read on outlets for select using (can_access_outlet(id) or has_role(library_id, '{owner,admin,chef}'));
create policy outlets_write on outlets for all using (has_role(library_id, '{owner,admin}'))
  with check (has_role(library_id, '{owner,admin}'));

alter table memberships enable row level security;
create policy memberships_read on memberships for select using (is_member(library_id));
create policy memberships_write on memberships for all using (has_role(library_id, '{owner,admin}'))
  with check (has_role(library_id, '{owner,admin}'));

alter table membership_outlets enable row level security;
create policy membership_outlets_rw on membership_outlets for all
  using (exists (select 1 from memberships m where m.id = membership_id and has_role(m.library_id, '{owner,admin}')))
  with check (exists (select 1 from memberships m where m.id = membership_id and has_role(m.library_id, '{owner,admin}')));

alter table invitations enable row level security;
create policy invitations_rw on invitations for all using (has_role(library_id, '{owner,admin}'))
  with check (has_role(library_id, '{owner,admin}'));

alter table api_keys enable row level security;
create policy api_keys_rw on api_keys for all using (has_role(library_id, '{owner,admin}'))
  with check (has_role(library_id, '{owner,admin}'));

-- Child tables without library_id: check through the parent.
alter table packages enable row level security;
create policy packages_read on packages for select
  using (exists (select 1 from ingredients i where i.id = ingredient_id and is_member(i.library_id)));
create policy packages_write on packages for all
  using (exists (select 1 from ingredients i where i.id = ingredient_id and has_role(i.library_id, '{owner,admin,chef}')))
  with check (exists (select 1 from ingredients i where i.id = ingredient_id and has_role(i.library_id, '{owner,admin,chef}')));

alter table ingredient_allergens enable row level security;
create policy ingredient_allergens_read on ingredient_allergens for select
  using (exists (select 1 from ingredients i where i.id = ingredient_id and is_member(i.library_id)));
create policy ingredient_allergens_write on ingredient_allergens for all
  using (exists (select 1 from ingredients i where i.id = ingredient_id and has_role(i.library_id, '{owner,admin,chef}')))
  with check (exists (select 1 from ingredients i where i.id = ingredient_id and has_role(i.library_id, '{owner,admin,chef}')));

alter table ingredient_nutrition enable row level security;
create policy ingredient_nutrition_read on ingredient_nutrition for select
  using (exists (select 1 from ingredients i where i.id = ingredient_id and is_member(i.library_id)));
create policy ingredient_nutrition_write on ingredient_nutrition for all
  using (exists (select 1 from ingredients i where i.id = ingredient_id and has_role(i.library_id, '{owner,admin,chef}')))
  with check (exists (select 1 from ingredients i where i.id = ingredient_id and has_role(i.library_id, '{owner,admin,chef}')));

alter table stock_item_price_history enable row level security;
create policy stock_item_price_history_read on stock_item_price_history for select
  using (exists (select 1 from stock_items s where s.id = stock_item_id and is_member(s.library_id)));

do $$
declare t text;
begin
  foreach t in array array['recipe_lines', 'recipe_outlet_prices', 'recipe_extra_allergens', 'recipe_costs'] loop
    execute format('alter table %I enable row level security', t);
    execute format($p$create policy %I on %I for select
                     using (exists (select 1 from recipes r where r.id = recipe_id and is_member(r.library_id)))$p$,
                   t || '_read', t);
    execute format($p$create policy %I on %I for all
                     using (exists (select 1 from recipes r where r.id = recipe_id and has_role(r.library_id, '{owner,admin,chef}')))
                     with check (exists (select 1 from recipes r where r.id = recipe_id and has_role(r.library_id, '{owner,admin,chef}')))$p$,
                   t || '_write', t);
  end loop;
end $$;

alter table menu_courses enable row level security;
create policy menu_courses_read on menu_courses for select
  using (exists (select 1 from menus m where m.id = menu_id and is_member(m.library_id)));
create policy menu_courses_write on menu_courses for all
  using (exists (select 1 from menus m where m.id = menu_id and has_role(m.library_id, '{owner,admin,chef}')))
  with check (exists (select 1 from menus m where m.id = menu_id and has_role(m.library_id, '{owner,admin,chef}')));

alter table menu_items enable row level security;
create policy menu_items_read on menu_items for select
  using (exists (select 1 from menu_courses c join menus m on m.id = c.menu_id where c.id = course_id and is_member(m.library_id)));
create policy menu_items_write on menu_items for all
  using (exists (select 1 from menu_courses c join menus m on m.id = c.menu_id where c.id = course_id and has_role(m.library_id, '{owner,admin,chef}')))
  with check (exists (select 1 from menu_courses c join menus m on m.id = c.menu_id where c.id = course_id and has_role(m.library_id, '{owner,admin,chef}')));

alter table purchase_order_lines enable row level security;
create policy purchase_order_lines_outlet on purchase_order_lines for all
  using (exists (select 1 from purchase_orders p where p.id = purchase_order_id and can_access_outlet(p.outlet_id)))
  with check (exists (select 1 from purchase_orders p where p.id = purchase_order_id and can_access_outlet(p.outlet_id)));

-- processed_webhooks: service role only (RLS on, no policies).
alter table processed_webhooks enable row level security;
