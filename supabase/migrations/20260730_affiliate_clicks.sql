-- Affiliate click tracking (server-side, GDPR-safe).
-- Logged by app/go/[slug]/route.ts before every eHub redirect.
create table if not exists affiliate_clicks (
  id          bigserial primary key,
  slug        text not null,
  referer     text,
  user_agent  text,
  ip_hash     text,
  is_test     boolean not null default false,
  clicked_at  timestamptz not null default now()
);

create index if not exists idx_affiliate_clicks_slug     on affiliate_clicks(slug);
create index if not exists idx_affiliate_clicks_clicked  on affiliate_clicks(clicked_at desc);

alter table affiliate_clicks enable row level security;
create policy "service_role_all" on affiliate_clicks
  for all to service_role using (true) with check (true);
