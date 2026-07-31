-- SK market setup (2026-07-31)
--
-- 1. price_eur  — scraped retail EUR prices from shop.reckonasbavi.cz/sk/
-- 2. product_url_sk — SK product page URL on the same merchant
-- 3. affiliate_clicks.market — CZ/SK flag for reporting
-- 4. SK retailer row
-- 5. Seed: EUR prices + SK URLs for all published products

-- ---------- Schema ----------

ALTER TABLE products ADD COLUMN IF NOT EXISTS price_eur numeric(8,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_url_sk text;

ALTER TABLE affiliate_clicks ADD COLUMN IF NOT EXISTS market text NOT NULL DEFAULT 'CZ';
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_market ON affiliate_clicks(market);

-- ---------- SK retailer ----------

INSERT INTO retailers (slug, name, base_url, affiliate_network, ehub_tracking_hash, utm_campaign, active)
VALUES (
  'reckonasbavi-sk',
  'Řecko nás baví — SK',
  'https://shop.reckonasbavi.cz/sk',
  'ehub',
  '189a3b9437684fadb7dae10516aab5dc',
  '5litrov-sk',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name        = EXCLUDED.name,
  base_url    = EXCLUDED.base_url,
  utm_campaign = EXCLUDED.utm_campaign;

-- ---------- SK prices + URLs (scraped 2026-07-31) ----------
-- Source: shop.reckonasbavi.cz/sk/  — retail prices incl. DPH
-- Styliana (Spanish Arbequina) returns 404 on SK — left NULL

UPDATE products SET
  price_eur      = 71.91,
  product_url_sk = 'https://shop.reckonasbavi.cz/sk/nikolos-kalamata-extra-panensky-olivovy-olej-0-3--5l-plech/'
WHERE slug = 'nikolos';

UPDATE products SET
  price_eur      = 67.66,
  product_url_sk = 'https://shop.reckonasbavi.cz/sk/sitia-kreta-premium-gold-0-2--extra-panensky-olivovy-olej-5l---plech/'
WHERE slug = 'sitia';

UPDATE products SET
  price_eur      = 65.91,
  product_url_sk = 'https://shop.reckonasbavi.cz/sk/erato-kalamata-extra-panensky-olivovy-olej-5l---plech/'
WHERE slug = 'erato';

UPDATE products SET
  price_eur      = 67.66,
  product_url_sk = 'https://shop.reckonasbavi.cz/sk/theoni-kalamata-extra-panensky-olivovy-olej-5l-plech/'
WHERE slug = 'theoni';

UPDATE products SET
  price_eur      = 63.40,
  product_url_sk = 'https://shop.reckonasbavi.cz/sk/motakis-kreta-extra-panensky-olivovy-olej-5l---plech/'
WHERE slug = 'motakis';

UPDATE products SET
  price_eur      = 93.62,
  product_url_sk = 'https://shop.reckonasbavi.cz/sk/neotis-pelopones-extra-panensky-olivovy-olej-0-3--5l---plech/'
WHERE slug = 'neotis';

UPDATE products SET
  price_eur      = 93.62,
  product_url_sk = 'https://shop.reckonasbavi.cz/sk/evoilino-korfu-extra-panensky-olivovy-olej-5l---plech/'
WHERE slug = 'evoilino';

UPDATE products SET
  price_eur      = 67.66,
  product_url_sk = 'https://shop.reckonasbavi.cz/sk/petromilos-zakynthos-extra-panensky-olivovy-olej-0-3--5l---plech/'
WHERE slug = 'petromilos';

UPDATE products SET
  price_eur      = 84.68,
  product_url_sk = 'https://shop.reckonasbavi.cz/sk/corinto-pelopones-extra-panensky-olivovy-olej--manaki--0-3--5-l---plech/'
WHERE slug = 'corinto-pelopones-olivovy-olej-manaki-0-3';

UPDATE products SET
  price_eur      = 65.91,
  product_url_sk = 'https://shop.reckonasbavi.cz/sk/pallada-kreta-extra-panensky-olivovy-olej-5-l---plech/'
WHERE slug = 'pallada';

UPDATE products SET
  price_eur      = 67.66,
  product_url_sk = 'https://shop.reckonasbavi.cz/sk/orino-sitia-p-d-o--kreta-extra-panensky-olivovy-olej-5l---plech/'
WHERE slug = 'orino';

UPDATE products SET
  price_eur      = 93.19,
  product_url_sk = 'https://shop.reckonasbavi.cz/sk/corinto-pelopones-bio-extra-panensky-olivovy-olej--manaki--0-4--5-l---plech/'
WHERE slug = 'corinto-pelopones-extra-panensky-manaki-0-4';

-- styliana: 404 on SK — product_url_sk and price_eur stay NULL
