-- Olivator-driven price sync + new-product suggestions.
--
-- Strategy:
--   - 5litru.products.product_url matched against Olivator product_offers.product_url
--     → on match, update 5litru.products.price_czk
--   - Olivator 5L products WITHOUT a 5litru counterpart, that HAVE an offer
--     at reckonasbavi (our affiliate partner) → snapshot row in
--     olivator_suggestions for admin review
--   - Every run logged to price_sync_log

create table if not exists olivator_suggestions (
  -- Uses Olivator's product UUID as PK → opakovaný sync = upsert no-op.
  olivator_product_id   uuid primary key,
  olivator_slug         text not null,

  -- Snapshot of Olivator data at discovery time. Stable for admin UI even
  -- if olivator.cz is offline. NOT refreshed on subsequent syncs.
  name                  text not null,
  brand_slug            text,
  origin_country        text,
  origin_region         text,
  variety               text,
  type                  text,
  volume_ml             integer,
  acidity               numeric(4,2),
  polyphenols           integer,
  olivator_score        integer,
  image_url             text,

  -- Primary offer = reckonasbavi entry (gated at sync time). If reckonasbavi
  -- doesn't sell the product in Olivator catalog, the product is skipped
  -- entirely (every import must have a working affiliate relationship).
  primary_retailer_slug text not null,
  primary_offer_price   numeric(8,2),
  primary_offer_url     text not null,

  status                text not null default 'new'
                        check (status in ('new', 'imported', 'ignored')),
  ignore_reason         text,
  imported_product_id   uuid references products(id),

  discovered_at         timestamptz default now(),
  decided_at            timestamptz
);

create index if not exists idx_olivator_suggestions_status
  on olivator_suggestions(status, discovered_at desc);
create index if not exists idx_olivator_suggestions_score_new
  on olivator_suggestions(olivator_score desc nulls last)
  where status = 'new';
create index if not exists idx_olivator_suggestions_origin
  on olivator_suggestions(origin_country, status);

alter table olivator_suggestions enable row level security;

drop policy if exists "service_role_all_olivator_suggestions" on olivator_suggestions;
create policy "service_role_all_olivator_suggestions" on olivator_suggestions
  for all to service_role using (true) with check (true);

create table if not exists price_sync_log (
  id                    bigserial primary key,
  started_at            timestamptz default now(),
  finished_at           timestamptz,

  products_checked      integer default 0,
  prices_updated        integer default 0,
  prices_unchanged      integer default 0,
  prices_missing        integer default 0,

  suggestions_added     integer default 0,
  suggestions_skipped   integer default 0,

  status                text not null
                        check (status in ('running', 'success', 'partial', 'failed')),
  error_summary         text,
  errors_json           jsonb,
  duration_ms           integer,
  triggered_by          text check (triggered_by in ('cron', 'admin_manual', 'cli_test'))
);

create index if not exists idx_price_sync_log_started
  on price_sync_log(started_at desc);

alter table price_sync_log enable row level security;

drop policy if exists "service_role_all_price_sync_log" on price_sync_log;
create policy "service_role_all_price_sync_log" on price_sync_log
  for all to service_role using (true) with check (true);
