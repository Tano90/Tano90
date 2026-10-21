-- Demand before launch: inquiries from the website and a cookie-free count of landing page views.
-- Both belong to the operator, not to any library, so no user role may read or write them: row-level security is on
-- and there are no policies. The app reaches them only through the service connection, behind the operator check.

create table leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null check (length(name) between 1 and 120),
  company text not null check (length(company) between 1 and 160),
  email text not null check (length(email) between 3 and 254),
  phone text check (length(phone) <= 40),
  outlets integer check (outlets between 1 and 1000),
  message text check (length(message) <= 2000),
  source text check (length(source) <= 100),
  medium text check (length(medium) <= 100),
  campaign text check (length(campaign) <= 100),
  referrer text check (length(referrer) <= 300),
  status text not null default 'new' check (status in ('new', 'contacted', 'demo', 'won', 'lost')),
  notes text check (length(notes) <= 4000)
);
create index on leads (created_at desc);
alter table leads enable row level security;

-- One row per day, page and source; no IP address, no cookie, no user agent stored.
create table page_views (
  day date not null,
  path text not null check (length(path) <= 100),
  source text not null default '' check (length(source) <= 100),
  views integer not null default 0,
  primary key (day, path, source)
);
alter table page_views enable row level security;
