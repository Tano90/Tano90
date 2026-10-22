-- GLB AI Suite 0.8: RBAC security upgrade to existing v0.7 Cloud Pilot.
-- Run AFTER 001_cloud_pilot.sql. Does not delete existing organizations or snapshots.
-- IMPORTANT: Backup existing data first. Role redaction is server-side; no trust in hidden menu items.
begin;

alter table public.glb_memberships drop constraint if exists glb_memberships_role_check;
alter table public.glb_memberships add constraint glb_memberships_role_check check (role in (
 'owner','editor','viewer','service_staff','kitchen_staff','sales','service_lead','kitchen_lead','restaurant_manager','general_manager'));
alter table public.glb_invitations drop constraint if exists glb_invitations_role_check;
alter table public.glb_invitations add constraint glb_invitations_role_check check (role in (
 'editor','viewer','service_staff','kitchen_staff','sales','service_lead','kitchen_lead','restaurant_manager','general_manager'));

-- Remove old broad read access to the whole JSON document for every employee.
drop policy if exists glb_snapshot_read on public.glb_snapshots;
drop policy if exists glb_snapshot_privileged_read on public.glb_snapshots;
create policy glb_snapshot_privileged_read on public.glb_snapshots
 for select to authenticated using (
   exists (select 1 from public.glb_memberships m
     where m.organization_id=glb_snapshots.organization_id
       and m.user_id=(select auth.uid())
       and m.role in ('owner','editor','restaurant_manager','general_manager'))
 );
-- All employees use this server-filtered RPC to load workplace data.
-- The fields returned depend on the role. Sensitive values are NOT included in restricted roles.
create or replace function public.glb_read_workspace(p_org uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r text; d jsonb; rev bigint; base jsonb; clean_items jsonb; clean_ing jsonb;
begin
 select role into r from public.glb_memberships
  where organization_id=p_org and user_id=(select auth.uid());
 if r is null then raise exception 'ACCESS_DENIED'; end if;
 select data,revision into d,rev from public.glb_snapshots where organization_id=p_org;
 if d is null then raise exception 'WORKSPACE_MISSING'; end if;
 if r in ('owner','editor','restaurant_manager','general_manager') then
   return jsonb_build_object('data',d,'revision',rev,'role',r);
 end if;
 -- Restricted team never receives article raw costs, recipe finance, fixed payroll or business secrets.
 select coalesce(jsonb_agg((e.value - 'costNet' - 'costDetail' - 'purchaseCost' - 'margin' - 'db')
                   || jsonb_build_object('costNet',0)), '[]'::jsonb)
   into clean_items from jsonb_array_elements(case when jsonb_typeof(d->'items')='array' then d->'items' else '[]'::jsonb end) AS e(value);
 select coalesce(jsonb_agg((e.value - 'packCostNet' - 'supplierPriceNet' - 'costNet') || jsonb_build_object('packCostNet',0)), '[]'::jsonb)
   into clean_ing from jsonb_array_elements(case when jsonb_typeof(d->'ingredients')='array' then d->'ingredients' else '[]'::jsonb end) AS e(value);
 base:=jsonb_build_object('version',4,'mode','own','business',coalesce(d->'business','"Betrieb"'::jsonb),
   'targetPct',30,'items',clean_items,'recipe','{}'::jsonb,'outlets',coalesce(d->'outlets','[]'::jsonb),
   'sales','[]'::jsonb,'market','[]'::jsonb);
 if r in ('service_staff','service_lead','sales') then
   base:=base||jsonb_build_object('funnel',coalesce(d->'funnel','[]'::jsonb),
     'funnelGoals',coalesce(d->'funnelGoals','{}'::jsonb),
     'funnelProjectedDays',coalesce(d->'funnelProjectedDays','30'::jsonb));
 end if;
 if r in ('service_lead','sales') then
   base:=base||jsonb_build_object('sales',coalesce(d->'sales','[]'::jsonb),
    'dailySales',coalesce(d->'dailySales','[]'::jsonb));
 end if;
 if r='sales' then
   base:=base||jsonb_build_object('market',coalesce(d->'market','[]'::jsonb),
    'marketDiscovered',coalesce(d->'marketDiscovered','[]'::jsonb),
    'marketLastScan',coalesce(d->'marketLastScan','""'::jsonb));
 end if;
 if r in ('kitchen_staff','kitchen_lead') then
   base:=base||jsonb_build_object('ingredients',case when r='kitchen_lead' then coalesce(d->'ingredients','[]'::jsonb) else clean_ing end,
   'recipes',coalesce(d->'recipes','[]'::jsonb),
   'warehouses',coalesce(d->'warehouses','[]'::jsonb),
   'inventoryCounts',coalesce(d->'inventoryCounts','[]'::jsonb),
   'ingredientWarehouses',coalesce(d->'ingredientWarehouses','{}'::jsonb),
   'stockMovements',coalesce(d->'stockMovements','[]'::jsonb));
 end if;
 if r='kitchen_lead' then
   base:=base||jsonb_build_object('items',coalesce(d->'items','[]'::jsonb),
   'dailySales',coalesce(d->'dailySales','[]'::jsonb),
   'purchaseOrders',coalesce(d->'purchaseOrders','[]'::jsonb),
   'v04Forecast',coalesce(d->'v04Forecast','{}'::jsonb));
 end if;
 return jsonb_build_object('data',base,'revision',rev,'role',r);
end $$;

-- Full-document writes only for management. This replaces old editor-only save rule.
create or replace function public.glb_save_snapshot(p_org uuid, p_expected_revision bigint, p_data jsonb)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_revision bigint;
begin
 if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists (select 1 from public.glb_memberships m
  where m.organization_id=p_org and m.user_id=(select auth.uid())
  and m.role in ('owner','editor','restaurant_manager','general_manager')) then
    raise exception 'WRITE_NOT_ALLOWED'; end if;
 if jsonb_typeof(p_data) is distinct from 'object'
    or octet_length(p_data::text)>4000000 then raise exception 'INVALID_PAYLOAD_OR_OVER_4MB'; end if;
 update public.glb_snapshots set data=p_data,revision=revision+1,updated_at=now(),updated_by=(select auth.uid())
  where organization_id=p_org and revision=p_expected_revision returning revision into v_revision;
 if v_revision is null then raise exception 'REVISION_CONFLICT'; end if;
 return v_revision;
end $$;

-- Restricted roles write ONLY allowed module keys, independently of the JS user interface.
-- Atomic JSONB patch merging; no restricted role may replace/see the full snapshot.
create or replace function public.glb_save_limited(p_org uuid,p_expected_revision bigint,p_data jsonb)
returns bigint language plpgsql security definer set search_path='' as $$
declare r text; allowed text[]; k text; patch jsonb:='{}'::jsonb; v_revision bigint;
begin
 select role into r from public.glb_memberships where organization_id=p_org and user_id=(select auth.uid());
 if r is null then raise exception 'ACCESS_DENIED'; end if;
 if jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>4000000 then raise exception 'INVALID_PAYLOAD'; end if;
 allowed:=case r
  when 'service_staff' then array['funnel']
  when 'service_lead' then array['funnel','sales','dailySales']
  when 'sales' then array['funnel','sales','dailySales','market','marketDiscovered','marketLastScan']
  when 'kitchen_staff' then array['inventoryCounts']
  when 'kitchen_lead' then array['items','ingredients','recipes','warehouses','inventoryCounts','stockMovements','ingredientWarehouses','purchaseOrders','dailySales','v04Forecast']
  else array[]::text[] end;
 if array_length(allowed,1) is null then raise exception 'WRITE_NOT_ALLOWED'; end if;
 foreach k in array allowed loop
   if p_data ? k then patch:=patch||jsonb_build_object(k,p_data->k); end if;
 end loop;
 if patch='{}'::jsonb then raise exception 'NO_PERMITTED_CHANGES'; end if;
 -- Change only whitelisted keys, preserve ALL other keys on the server.
 update public.glb_snapshots set data=data||patch,revision=revision+1,updated_at=now(),updated_by=(select auth.uid())
  where organization_id=p_org and revision=p_expected_revision returning revision into v_revision;
 if v_revision is null then raise exception 'REVISION_CONFLICT'; end if;
 return v_revision;
end $$;

create or replace function public.glb_invite_member_v08(p_org uuid,p_email text,p_role text)
returns void language plpgsql security definer set search_path='' as $$
declare v_email text:=lower(trim(coalesce(p_email,''))); v_my_role text;
begin
 select role into v_my_role from public.glb_memberships where organization_id=p_org and user_id=(select auth.uid());
 if v_my_role not in ('owner','general_manager') then raise exception 'NOT_AUTHORIZED'; end if;
 if length(v_email) not between 3 and 254 or v_email !~ '^[^ @]+@[^ @]+[.][^ @]+$' or
  p_role not in ('service_staff','kitchen_staff','sales','service_lead','kitchen_lead','restaurant_manager','general_manager')
  then raise exception 'INVALID_INVITATION'; end if;
 -- General manager cannot invite another general manager or change the owner.
 if v_my_role='general_manager' and p_role='general_manager' then raise exception 'OWNER_ONLY'; end if;
 insert into public.glb_invitations(organization_id,email,role) values(p_org,v_email,p_role)
 on conflict (organization_id,email) do update set role=excluded.role,created_at=now();
end $$;

create or replace function public.glb_set_member_role_v08(p_org uuid,p_user uuid,p_role text)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor text; v_target text;
begin
 select role into v_actor from public.glb_memberships where organization_id=p_org and user_id=(select auth.uid());
 select role into v_target from public.glb_memberships where organization_id=p_org and user_id=p_user;
 if v_actor not in ('owner','general_manager') then raise exception 'NOT_AUTHORIZED'; end if;
 if v_target is null or v_target='owner' or p_user=(select auth.uid()) then raise exception 'CANNOT_MODIFY_OWNER_OR_SELF'; end if;
 if p_role not in ('service_staff','kitchen_staff','sales','service_lead','kitchen_lead','restaurant_manager','general_manager')
 then raise exception 'INVALID_ROLE'; end if;
 if v_actor='general_manager' and (v_target='general_manager' or p_role='general_manager') then raise exception 'OWNER_ONLY'; end if;
 update public.glb_memberships set role=p_role where organization_id=p_org and user_id=p_user;
end $$;

-- Legacy v0.7 member-directory used only by owner; v0.8 allows general manager too.
create or replace function public.glb_list_members(p_org uuid)
returns table(user_id uuid,email text,role text) language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.glb_memberships m where
 m.organization_id=p_org and m.user_id=(select auth.uid()) and m.role in ('owner','general_manager'))
 then raise exception 'NOT_AUTHORIZED'; end if;
 return query select m.user_id,coalesce(u.email,'')::text,m.role
 from public.glb_memberships m join auth.users u on u.id=m.user_id
 where m.organization_id=p_org order by m.created_at;
end $$;

revoke all on function public.glb_read_workspace(uuid) from public,anon;
revoke all on function public.glb_save_limited(uuid,bigint,jsonb) from public,anon;
revoke all on function public.glb_invite_member_v08(uuid,text,text) from public,anon;
revoke all on function public.glb_set_member_role_v08(uuid,uuid,text) from public,anon;
grant execute on function public.glb_read_workspace(uuid) to authenticated;
grant execute on function public.glb_save_limited(uuid,bigint,jsonb) to authenticated;
grant execute on function public.glb_invite_member_v08(uuid,text,text) to authenticated;
grant execute on function public.glb_set_member_role_v08(uuid,uuid,text) to authenticated;
commit;
