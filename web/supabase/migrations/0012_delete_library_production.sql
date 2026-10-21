-- 0011 added production_requests, which reference recipes with ON DELETE RESTRICT: delete them first.
create or replace function delete_library(lib uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  delete from production_requests where library_id = lib;       -- refer to recipes (restrict) and stock events
  delete from stock_movements where outlet_id in (select id from outlets where library_id = lib);
  delete from stock_events where library_id = lib;
  delete from sales where library_id = lib;
  delete from pos_items where library_id = lib;
  delete from invoices where library_id = lib;
  delete from purchase_orders where library_id = lib;            -- cascades order lines
  delete from menus where library_id = lib;                      -- cascades courses and items
  delete from recipe_lines where recipe_id in (select id from recipes where library_id = lib);
  delete from recipes where library_id = lib;
  delete from stock_items where library_id = lib;
  -- packages reference each other (carton -> bag): children first
  with recursive tree(id, depth) as (
    select p.id, 0 from packages p join ingredients i on i.id = p.ingredient_id where i.library_id = lib and p.parent_package_id is null
    union all
    select p.id, t.depth + 1 from packages p join tree t on p.parent_package_id = t.id
  )
  delete from packages where id in (select id from tree);
  delete from ingredients where library_id = lib;
  delete from suppliers where library_id = lib;
  delete from libraries where id = lib;                         -- cascades the rest (outlets, memberships, ...)
end $$;
revoke execute on function delete_library(uuid) from public, authenticated;
