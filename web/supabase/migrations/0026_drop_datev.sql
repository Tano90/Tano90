-- GLB AI Suite is a reporting tool, not bookkeeping: the DATEV export is gone. E-invoices stay (they feed prices).
drop table if exists datev_settings;
alter table suppliers drop column if exists creditor_account;
