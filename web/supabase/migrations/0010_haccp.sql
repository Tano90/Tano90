-- S27 HACCP: checklists with control points, one record per point, outlet and day.
create table haccp_checklists (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index on haccp_checklists (library_id);

create table haccp_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references haccp_checklists(id) on delete cascade,
  position integer not null default 0,
  label text not null check (length(label) between 1 and 160),
  kind text not null check (kind in ('check', 'temperature', 'text')),
  min_value numeric(8,2),
  max_value numeric(8,2),
  check (kind = 'temperature' or (min_value is null and max_value is null)),
  check (min_value is null or max_value is null or min_value <= max_value)
);
create index on haccp_items (checklist_id, position);

create table haccp_records (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references haccp_items(id) on delete cascade,
  outlet_id uuid not null references outlets(id) on delete cascade,
  day date not null,
  value_text text,
  value_number numeric(8,2),
  ok boolean not null,
  action text,                                   -- corrective action, required when not ok
  recorded_by uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now(),
  unique (item_id, outlet_id, day),
  check (ok or length(coalesce(action, '')) > 0)
);
create index on haccp_records (outlet_id, day);

alter table haccp_checklists enable row level security;
create policy haccp_checklists_read on haccp_checklists for select using (is_member(library_id));
create policy haccp_checklists_write on haccp_checklists for all
  using (has_role(library_id, '{owner,admin,chef}')) with check (has_role(library_id, '{owner,admin,chef}'));
alter table haccp_items enable row level security;
create policy haccp_items_read on haccp_items for select
  using (exists (select 1 from haccp_checklists c where c.id = checklist_id and is_member(c.library_id)));
create policy haccp_items_write on haccp_items for all
  using (exists (select 1 from haccp_checklists c where c.id = checklist_id and has_role(c.library_id, '{owner,admin,chef}')))
  with check (exists (select 1 from haccp_checklists c where c.id = checklist_id and has_role(c.library_id, '{owner,admin,chef}')));
-- Anyone working in the outlet records; the point must belong to the outlet's library.
alter table haccp_records enable row level security;
create policy haccp_records_outlet on haccp_records for all
  using (can_access_outlet(outlet_id))
  with check (can_access_outlet(outlet_id) and exists (
    select 1 from haccp_items i join haccp_checklists c on c.id = i.checklist_id join outlets o on o.id = outlet_id
    where i.id = item_id and c.library_id = o.library_id));
