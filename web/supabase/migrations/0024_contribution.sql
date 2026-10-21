-- Contribution margin accounting (Deckungsbeitragsrechnung): variable costs per library (a share of revenue such as
-- card fees and delivery commission, plus a fixed amount per item such as packaging) and fixed costs per month,
-- for one outlet or the whole business. Only owners, admins and the head of department see and change them.

create table cost_settings (
  library_id uuid primary key references libraries(id) on delete cascade,
  variable_revenue_pct numeric(5,2) not null default 0 check (variable_revenue_pct between 0 and 100),
  per_item_cents integer not null default 0 check (per_item_cents between 0 and 100000)
);

create table fixed_costs (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries(id) on delete cascade,
  outlet_id uuid references outlets(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  category text not null default 'other' check (category in ('rent', 'staff', 'energy', 'insurance', 'leasing', 'marketing', 'other')),
  monthly_cents integer not null check (monthly_cents between 0 and 100000000),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index on fixed_costs (library_id) where archived_at is null;

alter table cost_settings enable row level security;
alter table fixed_costs enable row level security;
create policy cost_settings_all on cost_settings for all using (has_role(library_id, '{owner,admin,chef}')) with check (has_role(library_id, '{owner,admin,chef}'));
create policy fixed_costs_all on fixed_costs for all using (has_role(library_id, '{owner,admin,chef}')) with check (
  has_role(library_id, '{owner,admin,chef}') and (outlet_id is null or exists (select 1 from outlets o where o.id = outlet_id and o.library_id = fixed_costs.library_id)));
