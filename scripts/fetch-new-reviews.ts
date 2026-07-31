import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const slugs = [
    'corinto-pelopones-olivovy-olej-manaki-0-3',
    'corinto-pelopones-extra-panensky-manaki-0-4',
    'styliana-amazona-extra-panensky-arbequina-0-2'
  ]

  const { data, error } = await sb.from('products')
    .select('slug, review_slug, name, review_mdx, price_czk, volume_ml, available')
    .in('slug', slugs)

  if (error) { console.error(error.message); process.exit(1) }

  for (const p of (data ?? [])) {
    writeFileSync(`/tmp/review_${p.slug}.txt`, p.review_mdx ?? '')
    console.log(`Written: ${p.slug} | price: ${p.price_czk} | vol: ${p.volume_ml} | available: ${p.available}`)
    console.log('  Preview:', (p.review_mdx ?? '').slice(0, 300))
    console.log()
  }
}

main()
