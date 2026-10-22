-- GLB AI Suite Cloud Pilot v0.7
-- Run once in Supabase SQL Editor, on a NEW project.
-- All business data is scoped by organization and encrypted at rest by provider defaults.
-- Access never relies solely on frontend buttons: database policies and functions enforce isolation.

create table if not exists public.glb_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.glb_memberships (
  organization_id uuid not null references public.glb_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index if not exists glb_memberships_user_idx on public.glb_memberships(user_id);

create table if not exists public.glb_snapshots (
  organization_id uuid primary key references public.glb_organizations(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.glb_invitations (
  organization_id uuid not null references public.glb_organizations(id) on delete cascade,
  email text not null check (length(email) between 3 and 254),
  role text not null check (role in ('editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, email)
);

alter table public.glb_organizations enable row level security;
alter table public.glb_memberships enable row level security;
alter table public.glb_snapshots enable row level security;
alter table public.glb_invitations enable row level security;

-- Only a signed-in user can list their own memberships; no recursive RLS references.
create policy glb_membership_self on public.glb_memberships
  for select to authenticated using (user_id = (select auth.uid()));

create policy glb_org_read on public.glb_organizations
  for select to authenticated using (
    exists (select 1 from public.glb_memberships m
            where m.organization_id = id and m.user_id = (select auth.uid()))
  );

create policy glb_snapshot_read on public.glb_snapshots
  for select to authenticated using (
    exists (select 1 from public.glb_memberships m
            where m.organization_id = glb_snapshots.organization_id
              and m.user_id = (select auth.uid()))
  );

-- No direct inserts, updates or deletes on business tables from the browser.
revoke all on public.glb_organizations, public.glb_memberships,
  public.glb_snapshots, public.glb_invitations from anon, authenticated;
grant select on public.glb_organizations, public.glb_memberships, public.glb_snapshots to authenticated;

-- Create a new isolated workspace for the logged-in user.
create or replace function public.glb_create_workspace(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_org uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if length(trim(coalesce(p_name,''))) not between 1 and 100 then raise exception 'INVALID_NAME'; end if;
  insert into public.glb_organizations(name,owner_id)
    values(trim(p_name),v_uid) returning id into v_org;
  insert into public.glb_memberships(organization_id,user_id,role)
    values(v_org,v_uid,'owner');
  insert into public.glb_snapshots(organization_id) values(v_org);
  return v_org;
end $$;

-- Atomic compare-and-swap: protects against silent overwrites when two editors change the same workspace.
create or replace function public.glb_save_snapshot(
  p_org uuid, p_expected_revision bigint, p_data jsonb
)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_revision bigint;
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.glb_memberships m
                 where m.organization_id=p_org and m.user_id=(select auth.uid())
                   and m.role in ('owner','editor')) then
    raise exception 'WRITE_NOT_ALLOWED';
  end if;
  if jsonb_typeof(p_data) is distinct from 'object'
     or octet_length(p_data::text) > 4000000 then
    raise exception 'INVALID_PAYLOAD_OR_OVER_4MB';
  end if;
  update public.glb_snapshots
     set data=p_data, revision=revision+1, updated_at=now(), updated_by=(select auth.uid())
   where organization_id=p_org and revision=p_expected_revision
   returning revision into v_revision;
  if v_revision is null then raise exception 'REVISION_CONFLICT'; end if;
  return v_revision;
end $$;

-- Owner can create an email invitation; no email is sent (recipient visits the same application URL).
create or replace function public.glb_invite_member(p_org uuid,p_email text,p_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(trim(coalesce(p_email,'')));
begin
  if not exists (select 1 from public.glb_memberships m
    where m.organization_id=p_org and m.user_id=(select auth.uid()) and m.role='owner')
    then raise exception 'OWNER_ONLY'; end if;
  if length(v_email) not between 3 and 254 or v_email !~ '^[^ @]+@[^ @]+[.][^ @]+$'
     or p_role not in ('editor','viewer') then raise exception 'BAD_INVITATION'; end if;
  insert into public.glb_invitations(organization_id,email,role)
    values(p_org,v_email,p_role)
  on conflict (organization_id,email) do update set role=excluded.role,created_at=now();
end $$;

-- An account may accept only email-matching invitations AND only after email verification.
create or replace function public.glb_accept_invitations()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_email text; v_count integer := 0; v_inv record;
begin
  select lower(email) into v_email from auth.users
    where id=(select auth.uid()) and email_confirmed_at is not null;
  if v_email is null then return 0; end if;
  for v_inv in select organization_id,role from public.glb_invitations where email=v_email loop
    insert into public.glb_memberships(organization_id,user_id,role)
      values(v_inv.organization_id,(select auth.uid()),v_inv.role)
    on conflict (organization_id,user_id) do nothing;
    delete from public.glb_invitations
      where organization_id=v_inv.organization_id and email=v_email;
    v_count:=v_count+1;
  end loop;
  return v_count;
end $$;

-- Owner-only member directory (admin UI). No direct access to auth.users is granted.
create or replace function public.glb_list_members(p_org uuid)
returns table(user_id uuid,email text,role text) language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.glb_memberships m where
       m.organization_id=p_org and m.user_id=(select auth.uid()) and m.role='owner')
    then raise exception 'OWNER_ONLY'; end if;
  return query select m.user_id, coalesce(u.email,'')::text, m.role
    from public.glb_memberships m join auth.users u on u.id=m.user_id
    where m.organization_id=p_org order by m.created_at;
end $$;

-- Prevent PostgREST anonymous invocation of privileged functions.
revoke all on function public.glb_create_workspace(text) from public, anon;
revoke all on function public.glb_save_snapshot(uuid,bigint,jsonb) from public, anon;
revoke all on function public.glb_invite_member(uuid,text,text) from public, anon;
revoke all on function public.glb_accept_invitations() from public, anon;
revoke all on function public.glb_list_members(uuid) from public, anon;
grant execute on function public.glb_create_workspace(text) to authenticated;
grant execute on function public.glb_save_snapshot(uuid,bigint,jsonb) to authenticated;
grant execute on function public.glb_invite_member(uuid,text,text) to authenticated;
grant execute on function public.glb_accept_invitations() to authenticated;
grant execute on function public.glb_list_members(uuid) to authenticated;
