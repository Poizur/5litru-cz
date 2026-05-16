// Fetch style samples (published reviews) + top suggestions for AI pipeline context.
import { createClient } from '@supabase/supabase-js'

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: products } = await sb
    .from('products')
    .select('slug, name, review_mdx, origin_country, origin_region, variety, acidity_pct, rating')
    .eq('status', 'published')
    .not('review_mdx', 'is', null)
    .limit(4)

  console.log('=== PUBLISHED PRODUCTS WITH REVIEWS ===')
  for (const p of products ?? []) {
    console.log('---', p.slug, '|', p.name)
    console.log(p.review_mdx?.slice(0, 500))
    console.log()
  }

  const { data: sugs } = await sb
    .from('olivator_suggestions')
    .select('*')
    .eq('status', 'new')
    .order('olivator_score', { ascending: false, nullsFirst: false })
    .limit(3)

  console.log('\n=== TOP SUGGESTIONS ===')
  for (const s of sugs ?? []) {
    console.log(JSON.stringify({
      id: s.olivator_product_id,
      name: s.name,
      brand_slug: s.brand_slug,
      score: s.olivator_score,
      origin: s.origin_country,
      region: s.origin_region,
      variety: s.variety,
      type: s.type,
      acidity: s.acidity,
      polyphenols: s.polyphenols,
      volume_ml: s.volume_ml,
      url: s.primary_offer_url,
      image: s.image_url,
      price: s.primary_offer_price,
    }, null, 2))
    console.log()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
