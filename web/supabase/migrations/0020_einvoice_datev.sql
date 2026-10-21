-- E-invoices (XRechnung / ZUGFeRD) and the DATEV export.
-- An invoice now keeps its VAT split and gross amount (from the e-invoice; typed invoices have none and are
-- exported with the library's default rate), where it came from, and the original XML for the records.
alter table invoices
  add column gross_cents integer check (gross_cents >= 0),
  add column tax_lines jsonb not null default '[]',
  add column source text not null default 'manual' check (source in ('manual', 'einvoice')),
  add column seller_vat_id text check (length(seller_vat_id) <= 40),
  add column document text check (length(document) <= 2000000);

-- Creditor account per supplier in the accountant's chart (Kreditorenkonto), optional.
alter table suppliers add column creditor_account integer check (creditor_account between 1 and 999999999);

-- The accountant's DATEV parameters. Only owner and admin see and change them.
create table datev_settings (
  library_id uuid primary key references libraries(id) on delete cascade,
  consultant_number integer not null check (consultant_number between 1001 and 9999999),
  client_number integer not null check (client_number between 1 and 99999),
  chart text not null default '03' check (chart in ('03', '04')),
  account_length integer not null default 4 check (account_length between 4 and 8),
  fiscal_year_start_month integer not null default 1 check (fiscal_year_start_month between 1 and 12),
  default_creditor integer not null check (default_creditor between 1 and 999999999),
  -- VAT rate in basis points → expense account, e.g. {"700": 3300, "1900": 3400, "0": 3200}
  accounts jsonb not null default '{}'
);
alter table datev_settings enable row level security;
create policy datev_settings_all on datev_settings for all
  using (has_role(library_id, '{owner,admin}')) with check (has_role(library_id, '{owner,admin}'));
