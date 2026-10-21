-- Housekeeping for hotels: rooms per outlet (the hotel), their cleaning status and occupancy, who cleans them,
-- a log of every status change, and the cleaning checklist that has to be ticked before a room counts as cleaned.
-- Row-level security: everyone with access to the outlet sees and updates its rooms (the app decides which status
-- changes a role may make); creating, archiving and the checklist belong to owners, admins and the head of department.

create table rooms (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries(id) on delete cascade,
  outlet_id uuid not null references outlets(id) on delete cascade,
  number text not null check (length(number) between 1 and 20),
  floor text check (length(floor) <= 20),
  room_type text check (length(room_type) <= 60),
  status text not null default 'dirty' check (status in ('dirty', 'clean', 'inspected', 'out_of_order')),
  occupancy text not null default 'vacant' check (occupancy in ('vacant', 'occupied', 'departure', 'arrival')),
  assigned_to uuid references memberships(id) on delete set null,
  note text check (length(note) <= 300),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index rooms_number_per_outlet on rooms (outlet_id, lower(number)) where archived_at is null;
create index on rooms (outlet_id) where archived_at is null;

create table room_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  from_status text,
  to_status text not null,
  checked jsonb not null default '[]',
  by_user uuid references auth.users(id) on delete set null,
  at timestamptz not null default now()
);
create index on room_events (room_id, at desc);

create table hk_checklist_items (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries(id) on delete cascade,
  position integer not null,
  label text not null check (length(label) between 1 and 120)
);
create index on hk_checklist_items (library_id, position);

alter table rooms enable row level security;
alter table room_events enable row level security;
alter table hk_checklist_items enable row level security;

create policy rooms_read on rooms for select using (can_access_outlet(outlet_id));
create policy rooms_update on rooms for update using (can_access_outlet(outlet_id)) with check (can_access_outlet(outlet_id));
create policy rooms_insert on rooms for insert with check (
  has_role(library_id, '{owner,admin,chef}') and can_access_outlet(outlet_id)
  and exists (select 1 from outlets o where o.id = outlet_id and o.library_id = rooms.library_id));
create policy rooms_delete on rooms for delete using (has_role(library_id, '{owner,admin,chef}'));

create policy room_events_read on room_events for select using (exists (select 1 from rooms r where r.id = room_id and can_access_outlet(r.outlet_id)));
create policy room_events_insert on room_events for insert with check (exists (select 1 from rooms r where r.id = room_id and can_access_outlet(r.outlet_id)) and by_user = auth.uid());

create policy hk_checklist_read on hk_checklist_items for select using (is_member(library_id));
create policy hk_checklist_write on hk_checklist_items for all using (has_role(library_id, '{owner,admin,chef}')) with check (has_role(library_id, '{owner,admin,chef}'));
