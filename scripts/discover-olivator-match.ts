// Phase-2 Olivator probe: deep dive on match strategy + retailer coverage.
// Run: env -u ANTHROPIC_API_KEY npx tsx --env-file=.env.local \
//      scripts/discover-olivator-match.ts

import { createClient } from '@supabase/supabase-js'

async function main() {
  const url = process.env.OLIVATOR_SUPABASE_URL!
  const key = process.env.OLIVATOR_SUPABASE_ANON_KEY!
  const oliv = createClient(url, key, { auth: { persistSession: false } })

  const fiveUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const fiveKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const five = createClient(fiveUrl, fiveKey, { auth: { persistSession: false } })

  console.log('=== A. Olivator 5L retailers (which shops sell 5L oils) ===')
  const { data: offers } = await oliv
    .from('product_offers')
    .select('retailer_id, product_id, product_url, price, currency, in_stock, products!inner(volume_ml,status)')
    .gte('products.volume_ml', 4500)
    .lte('products.volume_ml', 5500)
    .eq('products.status', 'active')
    .limit(2000)
  if (!offers) return

  const byRetailer = new Map<string, number>()
  for (const o of offers) byRetailer.set(o.retailer_id as string, (byRetailer.get(o.retailer_id as string) ?? 0) + 1)

  const { data: rets } = await oliv.from('retailers').select('id, slug, name, domain, is_active')
  const retById = new Map(rets!.map((r: any) => [r.id, r]))

  console.log('  retailer · slug · domain · 5L offers')
  console.log('  ' + '-'.repeat(75))
  const sorted = [...byRetailer.entries()].sort((a, b) => b[1] - a[1])
  for (const [rid, count] of sorted) {
    const r = retById.get(rid) as any
    console.log(`  ${(r?.name ?? '?').slice(0, 30).padEnd(30)} · ${(r?.slug ?? '?').padEnd(20)} · ${(r?.domain ?? '?').slice(0, 24).padEnd(24)} · ${count} offer(s)`)
  }

  console.log('\n=== B. 5L offer URLs from `reckonasbavi` retailer (our shop) ===')
  const reckonas = sorted.find(([rid]) => (retById.get(rid) as any)?.slug === 'reckonasbavi')
  if (reckonas) {
    const [rid] = reckonas
    const reckonasOffers = offers.filter((o: any) => o.retailer_id === rid)
    console.log(`  ${reckonasOffers.length} 5L offers at reckonasbavi`)
    for (const o of reckonasOffers.slice(0, 12)) {
      console.log(`  · ${o.price ?? '—'} ${o.currency ?? ''}  ${(o.product_url as string ?? '').slice(0, 80)}`)
    }
  } else {
    console.log('  no reckonasbavi retailer in Olivator (would need URL-only match)')
  }

  console.log('\n=== C. Match attempt: 5litru.products.product_url ↔ Olivator.product_offers.product_url ===')
  const { data: ours } = await five
    .from('products')
    .select('slug, name, product_url')
    .not('product_url', 'is', null)
  if (!ours) return

  const olivUrls = new Set(offers.map((o: any) => o.product_url as string).filter(Boolean))
  for (const p of ours) {
    const match = olivUrls.has(p.product_url as string)
    console.log(`  ${match ? '✓' : '✗'}  ${(p.slug as string).padEnd(12)}  ${(p.product_url as string).slice(0, 80)}`)
  }

  console.log('\n=== D. Sample 5L products from Olivator NOT yet in 5litru (would become "suggestions") ===')
  const { data: sample } = await oliv
    .from('products')
    .select('slug, name, brand_slug, origin_country, origin_region, variety, volume_ml, acidity, olivator_score, image_url, type')
    .eq('status', 'active')
    .gte('volume_ml', 4500)
    .lte('volume_ml', 5500)
    .order('olivator_score', { ascending: false, nullsFirst: false })
    .limit(10)
  for (const p of sample ?? []) {
    console.log(`  [${(p.olivator_score ?? '—').toString().padStart(3)}] ${(p.slug as string).padEnd(40)} · ${p.origin_country ?? '—'} · ${p.variety ?? '—'} · ${p.type ?? '—'}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
