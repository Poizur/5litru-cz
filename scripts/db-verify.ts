// Verify migration result via Supabase REST (PostgREST).
// Run: npx tsx --env-file=.env.local scripts/db-verify.ts
import { createClient } from '@supabase/supabase-js'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const sb = createClient(url, key, { auth: { persistSession: false } })

  // 1) products count
  const { count: productsCount, error: err1 } = await sb
    .from('products')
    .select('*', { count: 'exact', head: true })
  if (err1) {
    console.error('products count error:', err1.message)
    process.exit(1)
  }
  console.log(`products count: ${productsCount}`)

  // 2) retailers list
  const { data: retailers, error: err2 } = await sb
    .from('retailers')
    .select('slug,name,utm_campaign,ehub_tracking_hash')
  if (err2) {
    console.error('retailers select error:', err2.message)
    process.exit(1)
  }
  console.log('retailers:', JSON.stringify(retailers, null, 2))

  // 3) products list (sanity)
  const { data: products, error: err3 } = await sb
    .from('products')
    .select('slug,review_slug,name,origin_region,status')
    .order('slug')
  if (err3) {
    console.error('products select error:', err3.message)
    process.exit(1)
  }
  console.log('products (10 expected):')
  for (const p of products ?? []) {
    console.log(`  ${p.slug.padEnd(12)} → ${p.review_slug?.padEnd(35)} ${p.origin_region?.padEnd(10)} [${p.status}]`)
  }

  // 4) Sanity: verify legacy `fivelitru_*` tables from earlier refactor are gone.
  // Note: `select('id', { head: true })` doesn't surface missing-table errors
  // because head=true skips body parsing — must use a normal select for the
  // PGRST404 / 42P01 ("relation does not exist") error to come through.
  const { error: err4 } = await sb.from('fivelitru_products').select('id').limit(1)
  const tableMissing =
    !!err4 && (err4.code === 'PGRST205' || err4.code === '42P01' || /does not exist/i.test(err4.message))
  if (tableMissing) {
    console.log(`\n✓ Sanity: legacy 'fivelitru_products' does not exist`)
  } else if (!err4) {
    console.warn(`\n⚠ WARNING: legacy 'fivelitru_products' exists — refactor leak`)
  } else {
    console.warn(`\nunexpected error checking legacy table: ${err4.message} (code=${err4.code})`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
