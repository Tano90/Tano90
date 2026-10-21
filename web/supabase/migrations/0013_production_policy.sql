-- 0011's check looked the kitchen up in outlets under the caller's own row-level security, so outlet staff,
-- who cannot see the central kitchen's row, could never place a request. Its unqualified library_id also
-- resolved to the subquery's own table and compared a column with itself. Both checks now run in one
-- security definer function that compares against the request's library explicitly.
create or replace function production_request_valid(p_library uuid, p_from uuid, p_kitchen uuid, p_recipe uuid)
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from outlets k where k.id = p_kitchen and k.library_id = p_library and k.is_central_kitchen)
     and exists (select 1 from outlets f where f.id = p_from and f.library_id = p_library)
     and exists (select 1 from recipes r where r.id = p_recipe and r.library_id = p_library)
$$;
revoke all on function production_request_valid(uuid, uuid, uuid, uuid) from public;
grant execute on function production_request_valid(uuid, uuid, uuid, uuid) to authenticated;

drop policy production_requests_rw on production_requests;
create policy production_requests_rw on production_requests for all
  using (can_access_outlet(from_outlet_id) or can_access_outlet(kitchen_outlet_id))
  with check (
    (can_access_outlet(from_outlet_id) or can_access_outlet(kitchen_outlet_id))
    and production_request_valid(library_id, from_outlet_id, kitchen_outlet_id, recipe_id));
