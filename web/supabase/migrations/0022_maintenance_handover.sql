-- Maintenance plans and the shift handover book, per outlet, for kitchens and hotels alike.
-- Everyone with the outlet reads, ticks a task done and writes in the handover book; equipment and plans belong to
-- owners, admins and the head of department.

create table assets (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries(id) on delete cascade,
  outlet_id uuid not null references outlets(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  location text check (length(location) <= 80),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index on assets (outlet_id) where archived_at is null;

create table maintenance_tasks (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries(id) on delete cascade,
  outlet_id uuid not null references outlets(id) on delete cascade,
  asset_id uuid references assets(id) on delete set null,
  title text not null check (length(title) between 1 and 120),
  interval_days integer not null check (interval_days between 1 and 730),
  next_due date not null,
  last_done_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index on maintenance_tasks (outlet_id, next_due) where archived_at is null;

create table maintenance_log (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references maintenance_tasks(id) on delete cascade,
  done_at timestamptz not null default now(),
  done_by uuid references auth.users(id) on delete set null,
  note text check (length(note) <= 300)
);
create index on maintenance_log (task_id, done_at desc);

create table handover_notes (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries(id) on delete cascade,
  outlet_id uuid not null references outlets(id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  important boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on handover_notes (outlet_id, created_at desc);

create table handover_reads (
  note_id uuid not null references handover_notes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (note_id, user_id)
);

alter table assets enable row level security;
alter table maintenance_tasks enable row level security;
alter table maintenance_log enable row level security;
alter table handover_notes enable row level security;
alter table handover_reads enable row level security;

create policy assets_read on assets for select using (can_access_outlet(outlet_id));
create policy assets_write on assets for all
  using (has_role(library_id, '{owner,admin,chef}') and can_access_outlet(outlet_id))
  with check (has_role(library_id, '{owner,admin,chef}') and can_access_outlet(outlet_id)
    and exists (select 1 from outlets o where o.id = outlet_id and o.library_id = assets.library_id));

create policy mt_read on maintenance_tasks for select using (can_access_outlet(outlet_id));
create policy mt_write on maintenance_tasks for insert with check (has_role(library_id, '{owner,admin,chef}') and can_access_outlet(outlet_id)
  and exists (select 1 from outlets o where o.id = outlet_id and o.library_id = maintenance_tasks.library_id));
-- Ticking a task done moves next_due; anyone with the outlet may do that (the app limits what else changes).
create policy mt_update on maintenance_tasks for update using (can_access_outlet(outlet_id)) with check (can_access_outlet(outlet_id));
create policy mt_delete on maintenance_tasks for delete using (has_role(library_id, '{owner,admin,chef}'));

create policy ml_read on maintenance_log for select using (exists (select 1 from maintenance_tasks t where t.id = task_id and can_access_outlet(t.outlet_id)));
create policy ml_insert on maintenance_log for insert with check (done_by = auth.uid() and exists (select 1 from maintenance_tasks t where t.id = task_id and can_access_outlet(t.outlet_id)));

create policy hn_read on handover_notes for select using (can_access_outlet(outlet_id));
create policy hn_insert on handover_notes for insert with check (created_by = auth.uid() and can_access_outlet(outlet_id)
  and exists (select 1 from outlets o where o.id = outlet_id and o.library_id = handover_notes.library_id));
create policy hn_delete on handover_notes for delete using (created_by = auth.uid() or has_role(library_id, '{owner,admin,chef}'));

create policy hr_read on handover_reads for select using (exists (select 1 from handover_notes n where n.id = note_id and can_access_outlet(n.outlet_id)));
create policy hr_insert on handover_reads for insert with check (user_id = auth.uid() and exists (select 1 from handover_notes n where n.id = note_id and can_access_outlet(n.outlet_id)));
