-- BUG-001: saving a supplier price also writes its price history, but 0001 only gave
-- stock_item_price_history a read policy, so every price save failed under RLS.
create policy stock_item_price_history_write on stock_item_price_history for insert
  with check (exists (select 1 from stock_items s where s.id = stock_item_id and has_role(s.library_id, '{owner,admin,chef}')));
