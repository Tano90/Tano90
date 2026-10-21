-- Housekeeping, part 3: "do not disturb", VIP and arrival time per room, cleaning start (for minutes per room),
-- and reports from the rooms: defects for maintenance and lost & found, each with an optional photo.
alter table rooms
  add column dnd boolean not null default false,
  add column vip boolean not null default false,
  add column arrival_time time,
  add column cleaning_started_at timestamptz;
alter table room_events add column minutes integer check (minutes between 0 and 600);

create table hk_tickets (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references libraries(id) on delete cascade,
  outlet_id uuid not null references outlets(id) on delete cascade,
  room_id uuid references rooms(id) on delete set null,
  kind text not null check (kind in ('defect', 'lost_found')),
  title text not null check (length(title) between 1 and 120),
  note text check (length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'done')),
  resolution text check (length(resolution) <= 300),
  photo bytea check (octet_length(photo) <= 800000),
  photo_type text check (photo_type in ('image/jpeg', 'image/png', 'image/webp')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  closed_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz
);
create index on hk_tickets (outlet_id, status, created_at desc);

alter table hk_tickets enable row level security;
create policy hk_tickets_read on hk_tickets for select using (can_access_outlet(outlet_id));
create policy hk_tickets_insert on hk_tickets for insert with check (
  can_access_outlet(outlet_id) and created_by = auth.uid()
  and exists (select 1 from outlets o where o.id = outlet_id and o.library_id = hk_tickets.library_id));
create policy hk_tickets_update on hk_tickets for update using (can_access_outlet(outlet_id)) with check (can_access_outlet(outlet_id));
create policy hk_tickets_delete on hk_tickets for delete using (has_role(library_id, '{owner,admin,chef}'));
