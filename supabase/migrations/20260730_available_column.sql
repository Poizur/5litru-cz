-- Availability flag synced from Olivátor (in_stock AND NOT manual_override).
-- Controls sold-out badge in comparison table and review CTAs.
-- Default true so existing products remain visible until first sync.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS available BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN products.available IS
  'Synced from Olivátor: true when reckonasbavi offer has in_stock=true AND manual_override=false. '
  'Updated nightly by olivator-sync cron at 06:00 UTC.';
