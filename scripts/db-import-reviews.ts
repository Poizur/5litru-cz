// Imports 10 migrated WP reviews into products.review_mdx + flips status to
// 'published'. Reads data/migrated-reviews.json (output of wp-migrate-content.ts).
//
// Run: npx tsx --env-file=.env.local scripts/db-import-reviews.ts

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const REVIEWS_JSON = join(process.cwd(), 'data', 'migrated-reviews.json')

interface MigratedReview {
  slug: string
  review_slug: string
  frontmatter: Record<string, unknown>
  mdx: string
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')

  const sb = createClient(url, key, { auth: { persistSession: false } })
  const raw = await readFile(REVIEWS_JSON, 'utf8')
  const reviews: MigratedReview[] = JSON.parse(raw)
  console.log(`→ ${reviews.length} reviews to import`)

  let ok = 0, fail = 0
  const now = new Date().toISOString()

  for (const r of reviews) {
    // hero_image priority:
    //   1. seo.og_image_url from frontmatter (already rewritten to /images/…)
    //   2. first <img src="/images/…"> in MDX body
    //   3. first <img src="https://…"> in MDX (external retailer CDN, e.g. cdn.myshoptet.com)
    const ogImage = (r.frontmatter as { og_image?: string | null }).og_image
    let heroImage: string | null = ogImage ?? null
    if (!heroImage) {
      heroImage = r.mdx.match(/<img[^>]+src="(\/images\/[^"]+)"/)?.[1] ?? null
    }
    if (!heroImage) {
      heroImage = r.mdx.match(/<img[^>]+src="(https?:\/\/[^"]+)"/)?.[1] ?? null
    }

    const { error, data } = await sb
      .from('products')
      .update({
        review_mdx: r.mdx,
        review_frontmatter: r.frontmatter,
        hero_image: heroImage,
        status: 'published',
        published_at: now,
      })
      .eq('review_slug', r.review_slug)
      .select('slug,review_slug,status,hero_image')

    if (error) {
      console.log(`  ✗ ${r.slug}: ${error.message}`)
      fail++
      continue
    }
    if (!data || data.length === 0) {
      console.log(`  ✗ ${r.slug}: no matching row (slug not found in products table)`)
      fail++
      continue
    }
    console.log(`  ✓ ${r.slug.padEnd(12)} status=${data[0].status} hero=${data[0].hero_image ?? '(none)'}`)
    ok++
  }

  console.log(`\n✓ ${ok} imported, ✗ ${fail} failed`)
}

main().catch((e) => { console.error(e); process.exit(1) })
