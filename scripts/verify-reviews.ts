import { createClient } from '@supabase/supabase-js'

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data } = await sb.from('products').select('slug, review_slug, review_mdx').eq('status', 'published').not('review_slug', 'is', null)
  let priceErrors = 0, tokenOK = 0
  for (const p of data ?? []) {
    const mdx = p.review_mdx ?? ''
    const hasHardcoded = /buy-bar-price">[0-9]|sidebar-price">[0-9]|sidebar-price-per">[0-9]|buy-bar-per">[0-9]/.test(mdx)
    const hasToken = mdx.includes('@PRODUCT_PRICE:')
    if (hasHardcoded) { priceErrors++; console.log('STILL HARDCODED:', p.slug) }
    if (hasToken) tokenOK++
  }
  console.log('Hardcoded price divs remaining:', priceErrors)
  console.log('Reviews with tokens:', tokenOK + '/13')

  // Verify specific patches
  for (const p of data ?? []) {
    const mdx = p.review_mdx ?? ''
    if (p.slug === 'nikolos') {
      const titleMatch = mdx.match(/^title: "([^"]+)"/m)
      console.log('Nikolos title:', titleMatch?.[1])
    }
    if (p.slug === 'evoilino') {
      console.log('Evoilino zaručeně still present:', mdx.includes('zaručeně'))
    }
    if (p.slug === 'erato') {
      console.log('Erato 2024/25 still present:', mdx.includes('2024/25'))
    }
    if (p.slug === 'petromilos') {
      console.log('Petromilos 2024/25 still present:', mdx.includes('2024/25'))
    }
  }
}

main()
