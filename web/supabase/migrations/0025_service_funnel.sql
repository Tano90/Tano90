-- Service funnel: per outlet and day, how many guests (covers) there were and how many of them took an aperitif,
-- water, an upgrade, a side, a dessert or a coffee. It measures selling in service; it is never revenue and never
-- feeds stock or sales. Anyone with access to the outlet may enter a day. The assumptions per step (gross price,
-- VAT, variable cost) and the target rates are set by owners, admins and the head of department.

create table funnel_days (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries(id) on delete cascade,
  outlet_id uuid not null references outlets(id) on delete cascade,
  day date not null,
  covers integer not null check (covers between 0 and 100000),
  aperitif integer not null default 0 check (aperitif between 0 and 100000),
  water integer not null default 0 check (water between 0 and 100000),
  upgrades integer not null default 0 check (upgrades between 0 and 100000),
  sides integer not null default 0 check (sides between 0 and 100000),
  desserts integer not null default 0 check (desserts between 0 and 100000),
  coffee integer not null default 0 check (coffee between 0 and 100000),
  note text check (length(note) <= 500),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (outlet_id, day)
);
create index on funnel_days (library_id, day);

create table funnel_steps (
  library_id uuid not null references libraries(id) on delete cascade,
  step text not null check (step in ('aperitif', 'water', 'upgrades', 'sides', 'desserts', 'coffee')),
  price_gross_cents integer not null default 0 check (price_gross_cents between 0 and 100000),
  vat_bp integer not null default 1900 check (vat_bp in (0, 700, 1900)),
  variable_cents integer not null default 0 check (variable_cents between 0 and 100000),
  goal_pct numeric(5,1) not null default 0 check (goal_pct between 0 and 200),
  primary key (library_id, step)
);

create table funnel_settings (
  library_id uuid primary key references libraries(id) on delete cascade,
  projected_days integer not null default 26 check (projected_days between 1 and 31)
);

alter table funnel_days enable row level security;
alter table funnel_steps enable row level security;
alter table funnel_settings enable row level security;
create policy funnel_days_all on funnel_days for all using (can_access_outlet(outlet_id)) with check (
  can_access_outlet(outlet_id) and exists (select 1 from outlets o where o.id = outlet_id and o.library_id = funnel_days.library_id));
create policy funnel_steps_read on funnel_steps for select using (is_member(library_id));
create policy funnel_steps_write on funnel_steps for all using (has_role(library_id, '{owner,admin,chef}')) with check (has_role(library_id, '{owner,admin,chef}'));
create policy funnel_settings_read on funnel_settings for select using (is_member(library_id));
create policy funnel_settings_write on funnel_settings for all using (has_role(library_id, '{owner,admin,chef}')) with check (has_role(library_id, '{owner,admin,chef}'));
