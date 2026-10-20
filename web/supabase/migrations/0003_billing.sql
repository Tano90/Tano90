-- Billing state, written only by the Stripe webhook (service connection). The app reads it, never the client.
alter table libraries add column stripe_subscription_id text unique;
alter table libraries add column subscription_status text;          -- Stripe's own status, for display
alter table libraries add column current_period_end timestamptz;
alter table libraries add column trial_ends_at timestamptz not null default now() + interval '14 days';

-- Members must not be able to change their own plan through the API. A column-level REVOKE has no effect
-- while a table-level UPDATE grant exists, so take UPDATE away and grant it back for the editable columns only.
revoke update on libraries from authenticated;
grant update (name, default_vat_bp, wage_cents_per_hour) on libraries to authenticated;
