-- Olivator Score + vazba na produkt Olivátoru, synchronizované nočním cronem olivator-sync
-- (lib/olivator-sync.ts). Zobrazuje se přes tokeny <!-- @PRODUCT_SCORE:slug --> /
-- <!-- @PRODUCT_SCORE_BADGE:slug --> v lib/content.ts — Score v obsahu už nikdy natvrdo.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS olivator_score INTEGER CHECK (olivator_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS olivator_product_id UUID,
  ADD COLUMN IF NOT EXISTS olivator_slug VARCHAR(255);

COMMENT ON COLUMN products.olivator_score IS
  'Olivator Score (0–100) z Olivátoru (products.olivator_score). Synchronizuje olivator-sync denně 06:00 UTC; null = Olivátor Score nemá.';
COMMENT ON COLUMN products.olivator_product_id IS
  'products.id v DB Olivátoru — produkt spárovaný podle product_url nabídky (reckonasbavi).';
COMMENT ON COLUMN products.olivator_slug IS
  'products.slug v Olivátoru (odkaz na olivator.cz/olej/<slug>).';
