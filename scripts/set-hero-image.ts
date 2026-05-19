// Swap a product's hero_image without touching the admin UI.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/set-hero-image.ts <product-id> <source>
//
// <source> can be:
//   - https://...           → uses URL directly (recommended; CDN-hosted)
//   - ./local-file.webp     → uploads to Supabase Storage 5litru bucket,
//                             returns a public URL, sets hero_image to that
//   - /images/products/x.webp → assumes you already added it to public/ in git
//
// After running, the product row is updated. The review_mdx <img> still
// references the old URL inside the HTML body — if you need that to change
// too, click "Přegenerovat" in the admin preview to rebuild the MDX.

import { supabaseAdmin } from '../lib/supabase'
import { readFileSync, existsSync } from 'node:fs'
import { basename, extname } from 'node:path'

async function main() {
  const [, , productId, source] = process.argv
  if (!productId || !source) {
    console.error('Usage: set-hero-image.ts <product-id> <url|local-path|/images/path>')
    process.exit(1)
  }

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('products')
    .select('id, slug, name, hero_image, review_mdx')
    .eq('id', productId)
    .single()
  if (fetchErr || !existing) {
    console.error('Product not found:', productId)
    process.exit(1)
  }

  let newHeroImage: string

  if (source.startsWith('http://') || source.startsWith('https://')) {
    // Direct URL — store as-is
    newHeroImage = source
  } else if (source.startsWith('/')) {
    // Already-committed public path — trust it
    newHeroImage = source
  } else if (existsSync(source)) {
    // Local file — upload to Supabase Storage
    const ext = extname(source).slice(1) || 'webp'
    const fileName = `${existing.slug}.${ext}`
    const buffer = readFileSync(source)
    const contentType = ext === 'webp' ? 'image/webp'
      : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
      : ext === 'png' ? 'image/png'
      : 'application/octet-stream'

    const { error: uploadErr } = await supabaseAdmin
      .storage
      .from('product-images')
      .upload(fileName, buffer, { contentType, upsert: true })
    if (uploadErr) {
      console.error('Upload failed:', uploadErr.message)
      console.error('Hint: create a "product-images" bucket (public) in your 5litru Supabase project first.')
      process.exit(1)
    }
    const { data: pub } = supabaseAdmin.storage.from('product-images').getPublicUrl(fileName)
    newHeroImage = pub.publicUrl
    console.log('Uploaded:', basename(source), '→', newHeroImage)
  } else {
    console.error('Source not a URL, an existing file, or a / path:', source)
    process.exit(1)
  }

  // Also rewrite any embedded <img src> in review_mdx that pointed at the
  // old hero — public review page renders review_mdx verbatim, so this is
  // the only way to swap the hero without "Přegenerovat" (which costs ~$0.07).
  let replacements = 0
  let newReviewMdx: string | null = null
  if (existing.hero_image && existing.review_mdx) {
    const old = existing.hero_image
    if (existing.review_mdx.includes(old)) {
      newReviewMdx = existing.review_mdx.split(old).join(newHeroImage)
      replacements = existing.review_mdx.split(old).length - 1
    }
  }

  const updatePayload: { hero_image: string; review_mdx?: string } = { hero_image: newHeroImage }
  if (newReviewMdx) updatePayload.review_mdx = newReviewMdx

  const { error: updateErr } = await supabaseAdmin
    .from('products')
    .update(updatePayload)
    .eq('id', productId)
  if (updateErr) {
    console.error('DB update failed:', updateErr.message)
    process.exit(1)
  }

  console.log(`OK  ${existing.name}`)
  console.log(`     old: ${existing.hero_image ?? '(none)'}`)
  console.log(`     new: ${newHeroImage}`)
  if (replacements > 0) {
    console.log(`     review_mdx: replaced ${replacements} embedded reference(s)`)
  }
  console.log('')
  console.log('Trigger a Railway redeploy (or wait) so the public review page picks up the change.')
}

main()
