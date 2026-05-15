// Olivator product schema discovery — read-only probe of the live Olivator
// project (NOT the 5litru standalone Supabase). Output drives the sync
// script + admin "Suggestions" tab design.
//
// We connect to Olivator's Supabase via the SAME service role (Olivator
// and 5litru both live in shared org; service key has cross-project
// access only when admin grants — for read-only product browsing we
// use a HARDCODED Olivator Supabase URL + a public reading approach).
//
// Run: env -u ANTHROPIC_API_KEY npx tsx --env-file=.env.local \
//      scripts/discover-olivator-products.ts

import { createClient } from '@supabase/supabase-js'

// Hardcoded Olivator project — same Supabase org but DIFFERENT project than 5litru.
// Read URL from olivator's next.config.ts default.
const OLIVATOR_URL = 'https://dyaloliwynmfnpjemzrh.supabase.co'

async function main() {
  // Try using 5litru's service key against Olivator URL — likely fails
  // (different project, different keys). Fall back to anon REST if Olivator
  // exposes a public read-only policy for 5L products.
  const key = process.env.OLIVATOR_SUPABASE_ANON_KEY
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY  // last-resort, will 401 if not Olivator's

  console.log('Olivator URL:', OLIVATOR_URL)
  console.log('Key source:', process.env.OLIVATOR_SUPABASE_ANON_KEY ? 'OLIVATOR_SUPABASE_ANON_KEY' : 'SUPABASE_SERVICE_ROLE_KEY (likely wrong project)')

  const sb = createClient(OLIVATOR_URL, key ?? '', { auth: { persistSession: false } })

  // Probe 1: products table column structure (any row at all)
  console.log('\n--- Probe 1: read any product row to confirm access + columns ---')
  const { data: any1, error: err1 } = await sb.from('products').select('*').limit(1)
  if (err1) {
    console.error('  ✗ products table read failed:', err1.message, '(code:', err1.code, ')')
    console.error('  → most likely need OLIVATOR_SUPABASE_ANON_KEY in .env.local')
    return
  }
  if (!any1 || any1.length === 0) {
    console.warn('  ⚠ products table accessible but empty under this key (RLS may scope it).')
    return
  }
  console.log('  ✓ access OK. Columns on `products`:')
  console.log('    ' + Object.keys(any1[0]).sort().join(', '))

  // Probe 2: count of 5L products
  console.log('\n--- Probe 2: count active 5L products (volume_ml 4500-5500) ---')
  const { count, error: err2 } = await sb
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')
    .gte('volume_ml', 4500)
    .lte('volume_ml', 5500)
  if (err2) {
    console.error('  ✗ count failed:', err2.message)
  } else {
    console.log(`  ✓ ${count} active 5L products in Olivator catalog`)
  }

  // Probe 3: sample 5 of them
  console.log('\n--- Probe 3: sample 5 active 5L products ---')
  const { data: sample, error: err3 } = await sb
    .from('products')
    .select('slug, name, name_short, brand_slug, origin_country, origin_region, type, volume_ml, acidity, polyphenols, olivator_score, status, image_url, ean, harvest_year')
    .eq('status', 'active')
    .gte('volume_ml', 4500)
    .lte('volume_ml', 5500)
    .order('olivator_score', { ascending: false, nullsFirst: false })
    .limit(5)
  if (err3) {
    console.error('  ✗ sample failed:', err3.message)
  } else {
    console.log('  ✓ sample (top 5 by olivator_score):')
    for (const p of sample ?? []) {
      console.log(`    [${p.olivator_score ?? '—'}]`.padEnd(6), p.name, '·', p.origin_region ?? p.origin_country ?? '—', '·', p.volume_ml + 'ml')
    }
  }

  // Probe 4: product_offers table for price sync
  console.log('\n--- Probe 4: product_offers table (price sync source) ---')
  const { data: offers, error: err4 } = await sb
    .from('product_offers')
    .select('*')
    .limit(1)
  if (err4) {
    console.error('  ✗ product_offers failed:', err4.message)
  } else if (offers && offers.length > 0) {
    console.log('  ✓ Columns on `product_offers`:')
    console.log('    ' + Object.keys(offers[0]).sort().join(', '))
  }

  // Probe 5: retailers table
  console.log('\n--- Probe 5: retailers table ---')
  const { data: rets, error: err5 } = await sb.from('retailers').select('*').limit(1)
  if (err5) {
    console.error('  ✗ retailers failed:', err5.message)
  } else if (rets && rets.length > 0) {
    console.log('  ✓ Columns on `retailers`:')
    console.log('    ' + Object.keys(rets[0]).sort().join(', '))
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
