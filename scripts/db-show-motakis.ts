// One-off: prints the exact row user asked for.
// SELECT slug, review_slug, status, length(review_mdx) as mdx_length,
//        hero_image, published_at FROM products WHERE slug = 'motakis';
import { createClient } from '@supabase/supabase-js'

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const { data, error } = await sb
    .from('products')
    .select('slug, review_slug, status, review_mdx, hero_image, published_at')
    .eq('slug', 'motakis')
    .single()

  if (error || !data) {
    console.error('error:', error?.message)
    process.exit(1)
  }
  console.log({
    slug: data.slug,
    review_slug: data.review_slug,
    status: data.status,
    mdx_length: data.review_mdx?.length ?? 0,
    hero_image: data.hero_image,
    published_at: data.published_at,
  })
}

main().catch((e) => { console.error(e); process.exit(1) })
