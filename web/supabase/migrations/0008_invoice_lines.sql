-- S15 invoice matching: what the supplier invoiced per order line, next to ordered and received.
alter table invoices add column note text, add column approved_at timestamptz, add column approved_by uuid references auth.users(id) on delete set null;

create table invoice_lines (
  invoice_id uuid not null references invoices(id) on delete cascade,
  purchase_order_line_id uuid not null references purchase_order_lines(id) on delete cascade,
  quantity_packs numeric(14,4) not null check (quantity_packs >= 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  primary key (invoice_id, purchase_order_line_id)
);
create index on invoice_lines (purchase_order_line_id);
alter table invoice_lines enable row level security;
create policy invoice_lines_read on invoice_lines for select
  using (exists (select 1 from invoices i where i.id = invoice_id and is_member(i.library_id)));
create policy invoice_lines_write on invoice_lines for all
  using (exists (select 1 from invoices i where i.id = invoice_id and has_role(i.library_id, '{owner,admin,chef}')))
  with check (exists (select 1 from invoices i where i.id = invoice_id and has_role(i.library_id, '{owner,admin,chef}')));
-- one invoice per order (a second invoice for the same order is a correction of the first)
create unique index invoices_one_per_order on invoices (purchase_order_id) where purchase_order_id is not null;
