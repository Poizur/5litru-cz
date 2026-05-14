-- Seed: one retailer + 10 existing products as draft rows.
-- Product URLs extracted from data/affiliate_links.json (decoded desturl param).
-- Reviews are populated later in Phase 3 (content migration → review_mdx column).
--
-- The ehub_tracking_hash below is a literal placeholder. Replace it with the
-- real 32-char hash from eHub dashboard before publishing any product:
--   update retailers set ehub_tracking_hash = '<real-hash>' where slug = 'reckonasbavi';

insert into retailers (slug, name, base_url, affiliate_network, ehub_tracking_hash, utm_campaign, active)
values (
  'reckonasbavi',
  'Řecko nás baví',
  'https://shop.reckonasbavi.cz',
  'ehub',
  '<EHUB_HASH_TODO>',
  '5litru-cz',
  true
)
on conflict (slug) do update
  set name              = excluded.name,
      base_url          = excluded.base_url,
      affiliate_network = excluded.affiliate_network,
      active            = excluded.active;

-- 10 existing products from WordPress ThirstyLinks. Status = 'draft'
-- (flipped to 'published' once review_mdx is filled in Phase 3).
with retailer as (select id from retailers where slug = 'reckonasbavi')
insert into products (
  slug, review_slug, name, origin_country, origin_region,
  packaging, retailer_id, product_url, status
) values
  ('motakis',    'motakis-recenze',              'Motakis Kréta 5l',          'Řecko', 'Kréta',     'plech', (select id from retailer), 'https://shop.reckonasbavi.cz/motakis-kreta-extra-panensky-olivovy-olej-5l---plech/',        'draft'),
  ('sitia',      'sitia-premium-gold-recenze',   'SITIA Gold 0,2 % 5l',       'Řecko', 'Kréta',     'plech', (select id from retailer), 'https://shop.reckonasbavi.cz/sitia-kreta-premium-gold-0-2--extra-panensky-olivovy-olej-5l---plech/', 'draft'),
  ('neotis',     'neotis-manaki-recenze',        'Neotis Manaki 5l',          'Řecko', 'Peloponés', 'plech', (select id from retailer), 'https://shop.reckonasbavi.cz/neotis-pelopones-extra-panensky-olivovy-olej-0-3--5l---plech/', 'draft'),
  ('pallada',    'pallada-kreta-recenze',        'Pallada Kréta 5l',          'Řecko', 'Kréta',     'plech', (select id from retailer), 'https://shop.reckonasbavi.cz/pallada-kreta-extra-panensky-olivovy-olej-5-l---plech/',         'draft'),
  ('nikolos',    'nikolos-kalamata-recenze',     'Nikolos Kalamata 5l',       'Řecko', 'Kalamata',  'plech', (select id from retailer), 'https://shop.reckonasbavi.cz/nikolos-kalamata-extra-panensky-olivovy-olej-0-3--5l-plech/',    'draft'),
  ('erato',      'erato-kalamata-recenze',       'Erato Kalamata 5l',         'Řecko', 'Kalamata',  'plech', (select id from retailer), 'https://shop.reckonasbavi.cz/erato-kalamata-extra-panensky-olivovy-olej-5l---plech/',          'draft'),
  ('orino',      'orino-sitia-recenze',          'Orino Sitia P.D.O. 5l',     'Řecko', 'Kréta',     'plech', (select id from retailer), 'https://shop.reckonasbavi.cz/orino-sitia-p-d-o--kreta-extra-panensky-olivovy-olej-5l---plech/', 'draft'),
  ('evoilino',   'evoilino-korfu-recenze',       'Evoilino Korfu 5l',         'Řecko', 'Korfu',     'plech', (select id from retailer), 'https://shop.reckonasbavi.cz/evoilino-korfu-extra-panensky-olivovy-olej-5l---plech/',          'draft'),
  ('theoni',     'theoni-kalamata-recenze',      'Theoni Kalamata 5l',        'Řecko', 'Kalamata',  'plech', (select id from retailer), 'https://shop.reckonasbavi.cz/theoni-kalamata-extra-panensky-olivovy-olej-5l-plech/',           'draft'),
  ('petromilos', 'petromilos-zakynthos-recenze', 'Petromilos Zakynthos 5l',   'Řecko', 'Zakynthos', 'plech', (select id from retailer), 'https://shop.reckonasbavi.cz/petromilos-zakynthos-extra-panensky-olivovy-olej-0-3--5l---plech/', 'draft')
on conflict (slug) do update
  set name           = excluded.name,
      review_slug    = excluded.review_slug,
      origin_country = excluded.origin_country,
      origin_region  = excluded.origin_region,
      packaging      = excluded.packaging,
      retailer_id    = excluded.retailer_id,
      product_url    = excluded.product_url;
