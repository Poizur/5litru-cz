import { createClient } from '@supabase/supabase-js'

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const r = await sb.from('products').select('slug,review_mdx').eq('status', 'published')
  let total = 0
  for (const row of r.data ?? []) {
    const m = (row.review_mdx as string | null)?.match(/on[a-z]+=/g) ?? []
    if (m.length) console.log(row.slug, 'has', m.length, 'lowercase event handlers')
    total += m.length
  }
  console.log('TOTAL lowercase event handlers in DB review_mdx:', total)
}

main().catch(e => { console.error(e); process.exit(1) })
