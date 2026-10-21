-- F&B controlling: each outlet can carry the cost centre number the accounting uses (Kostenstelle), so the monthly
-- export lines up with the books. Free text, short; optional.
alter table outlets add column cost_center text check (length(cost_center) <= 20);
