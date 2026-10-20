-- S18: a transfer is one event owned by the sending outlet. Staff of the receiving outlet must see it too
-- (incoming transfers list, stock report), but only read it. Policies are combined with OR.
create policy stock_events_counterpart_read on stock_events for select
  using (counterpart_outlet_id is not null and can_access_outlet(counterpart_outlet_id));
