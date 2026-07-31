import { createClient } from '@supabase/supabase-js'

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data } = await sb.from('products').select('slug, review_mdx').eq('status', 'published').in('slug', ['nikolos', 'erato', 'petromilos'])

  for (const p of data ?? []) {
    const mdx = p.review_mdx ?? ''
    const lines = mdx.split('\n').slice(0, 10)
    console.log(`\n=== ${p.slug} — frontmatter top ===`)
    lines.forEach((l, i) => console.log(`L${i+1}: ${l}`))

    if (p.slug === 'erato') {
      // Find all 2024/25 occurrences
      console.log('\n--- 2024/25 occurrences ---')
      mdx.split('\n').forEach((l, i) => {
        if (l.includes('2024/25')) console.log(`L${i+1}: ${l.trim().slice(0, 150)}`)
      })
    }
  }
}

main()
