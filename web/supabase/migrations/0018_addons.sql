-- Paid add-ons per library (Housekeeping, F&B-Controlling). Written only by the Stripe webhook and the
-- billing actions through the service connection: the column is not in the update grant of 0003.
alter table libraries add column addons text[] not null default '{}'
  check (addons <@ array['housekeeping', 'controlling']::text[]);
