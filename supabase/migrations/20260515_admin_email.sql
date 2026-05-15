-- Admin login rate limiting + Resend webhook event log.

create table if not exists admin_login_attempts (
  id            bigserial primary key,
  ip_hash       text not null,
  success       boolean not null,
  attempted_at  timestamptz default now()
);
create index if not exists idx_admin_login_attempts_ip
  on admin_login_attempts(ip_hash, attempted_at desc);

create table if not exists email_events (
  id                  bigserial primary key,
  resend_message_id   text,
  event_type          text not null,                -- 'sent','delivered','opened','clicked','bounced','complained','delayed'
  subject             text,
  recipient           text,
  link_url            text,
  bounce_reason       text,
  occurred_at         timestamptz,
  received_at         timestamptz default now()
);
create index if not exists idx_email_events_message on email_events(resend_message_id);
create index if not exists idx_email_events_type on email_events(event_type, received_at desc);

alter table admin_login_attempts enable row level security;
alter table email_events         enable row level security;

drop policy if exists "service_role_all_admin_login_attempts" on admin_login_attempts;
create policy "service_role_all_admin_login_attempts" on admin_login_attempts
  for all to service_role using (true) with check (true);

drop policy if exists "service_role_all_email_events" on email_events;
create policy "service_role_all_email_events" on email_events
  for all to service_role using (true) with check (true);
