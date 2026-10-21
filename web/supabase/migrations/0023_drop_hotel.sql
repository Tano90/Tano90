-- The product is now the GLB AI Suite for gastronomy: the hotel modules (housekeeping, linen, roster, reports,
-- F&B controlling per cost centre) and the paid add-ons are removed, with their tables and columns.
drop table if exists hk_tickets, hk_shifts, linen_movements, linen_order_lines, linen_orders, occupancy_plan,
  linen_set_items, linen_items, hk_settings, room_events, rooms, hk_checklist_items cascade;
alter table libraries drop column if exists addons;
alter table outlets drop column if exists cost_center;
