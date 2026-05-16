import { createClient } from '@supabase/supabase-js'

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const { data } = await sb
    .from('products')
    .select('id, slug, review_slug, name, status, price_czk, review_mdx, created_at')
    .eq('id', 'ec1f4900-95c2-41cd-8a15-994ee6306b1c')
    .single()

  if (!data) { console.log('Not found'); return }
  const p = data as { id: string; slug: string; review_slug: string; name: string; status: string; price_czk: number; review_mdx: string; created_at: string }

  console.log('=== DRAFT PRODUCT ===')
  console.log('ID:          ', p.id)
  console.log('slug:        ', p.slug)
  console.log('review_slug: ', p.review_slug)
  console.log('name:        ', p.name)
  console.log('status:      ', p.status)
  console.log('price_czk:   ', p.price_czk)
  console.log('created_at:  ', p.created_at)

  const mdx = p.review_mdx ?? ''
  const wordCount = mdx.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').length
  console.log('MDX length:  ', mdx.length, 'chars /', wordCount, 'words (incl. CSS)')

  // Show frontmatter
  const fmEnd = mdx.indexOf('\n---\n', 3)
  if (fmEnd >= 0) {
    console.log('\n=== FRONTMATTER ===')
    console.log(mdx.slice(4, fmEnd))
  }

  // Show intro section (first 800 chars of HTML body without CSS)
  const bodyStart = fmEnd >= 0 ? mdx.slice(fmEnd + 5) : mdx
  const afterStyle = bodyStart.indexOf('</style>')
  const htmlBody = afterStyle >= 0 ? bodyStart.slice(afterStyle + 8) : bodyStart
  console.log('\n=== HTML BODY (first 1200 chars after nav) ===')
  const afterNav = htmlBody.indexOf('</nav>') + 6
  process.stdout.write(htmlBody.slice(afterNav, afterNav + 1200))
}

main().catch(e => { console.error(e); process.exit(1) })
