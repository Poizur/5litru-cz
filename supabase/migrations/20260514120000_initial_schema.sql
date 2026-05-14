-- 5litru.cz initial schema
-- Standalone Supabase project (NOT shared with olivator.cz).
-- Apply in Supabase SQL editor of the 5litru project after creating it.

-- Retailers (eshops where affiliate links point)
create table if not exists retailers (
  id                  uuid primary key default gen_random_uuid(),
  slug                text unique not null,
  name                text not null,
  base_url            text not null,
  affiliate_network   text not null default 'ehub',
  ehub_tracking_hash  text,                                 -- 32-char hash from eHub dashboard; replace placeholder before publishing
  utm_campaign        text default '5litru-cz',
  active              boolean default true,
  created_at          timestamptz default now()
);

-- Products (oils on 5litru.cz — primary record; reviews stored in review_mdx column)
create table if not exists products (
  id                  uuid primary key default gen_random_uuid(),
  slug                text unique not null,                 -- 'motakis' → /motakis/ affiliate redirect
  review_slug         text unique,                          -- 'motakis-recenze' → /motakis-recenze/ review page
  name                text not null,                        -- 'Motakis Kréta 5l'
  brand               text,
  origin_country      text default 'Řecko',
  origin_region       text,                                 -- 'Kréta'
  variety             text,                                 -- 'Koroneiki'
  volume_ml           integer default 5000,
  acidity_pct         numeric(4,2),
  packaging           text check (packaging in ('plech','pet','sklo') or packaging is null),
  price_czk           numeric(8,2),
  retailer_id         uuid references retailers(id),
  product_url         text,                                 -- canonical URL on retailer site
  affiliate_url       text,                                 -- computed via lib/affiliate.ts
  rating              numeric(2,1),
  hero_image          text,                                 -- path in /public/images/ or Supabase storage URL
  status              text default 'draft' check (status in ('draft','published','archived')),
  review_mdx          text,                                 -- MDX content itself (see PROMPT_PATCH §12)
  review_frontmatter  jsonb,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  published_at        timestamptz
);

create index if not exists idx_products_status on products(status);
create index if not exists idx_products_review_slug on products(review_slug);

-- AI generation jobs (audit trail + cost tracking)
create table if not exists ai_jobs (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid references products(id) on delete cascade,
  job_type        text not null check (job_type in ('review_draft','scrape_url','image_alt')),
  input           jsonb,
  output          jsonb,
  model           text,                                     -- e.g. 'claude-sonnet-4-5'
  status          text default 'pending' check (status in ('pending','completed','failed')),
  cost_usd        numeric(6,4),
  error_message   text,
  created_at      timestamptz default now(),
  completed_at    timestamptz
);

-- Click tracking (server-side count only; GDPR-safe via ip_hash)
create table if not exists clicks (
  id            bigserial primary key,
  product_id    uuid references products(id),
  source_path   text,                                       -- e.g. '/motakis-recenze/'
  user_agent    text,
  ip_hash       text,
  clicked_at    timestamptz default now()
);
create index if not exists idx_clicks_product on clicks(product_id, clicked_at);

-- updated_at trigger for products
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists products_set_updated_at on products;
create trigger products_set_updated_at
  before update on products
  for each row execute function set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table retailers enable row level security;
alter table products  enable row level security;
alter table ai_jobs   enable row level security;
alter table clicks    enable row level security;

-- Public site: anon can read published products + active retailers (for affiliate URL build)
drop policy if exists "anon_read_published_products" on products;
create policy "anon_read_published_products" on products
  for select to anon using (status = 'published');

drop policy if exists "anon_read_active_retailers" on retailers;
create policy "anon_read_active_retailers" on retailers
  for select to anon using (active = true);

-- Admin: service_role has full access (used via supabaseAdmin client)
drop policy if exists "service_role_all_products" on products;
create policy "service_role_all_products" on products
  for all to service_role using (true) with check (true);

drop policy if exists "service_role_all_retailers" on retailers;
create policy "service_role_all_retailers" on retailers
  for all to service_role using (true) with check (true);

drop policy if exists "service_role_all_ai_jobs" on ai_jobs;
create policy "service_role_all_ai_jobs" on ai_jobs
  for all to service_role using (true) with check (true);

drop policy if exists "service_role_all_clicks" on clicks;
create policy "service_role_all_clicks" on clicks
  for all to service_role using (true) with check (true);
