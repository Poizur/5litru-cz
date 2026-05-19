// One-time migration: download every product's current hero_image and
// re-upload it to our own Supabase Storage bucket. Then UPDATE
// products.hero_image + rewrite any references inside review_mdx.
//
// Safe to re-run — uses upsert + skips products whose hero_image already
// points at our bucket.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/migrate-hero-images-to-bucket.ts

import { supabaseAdmin } from '../lib/supabase'

const BUCKET = 'product-images'

async function migrate() {
  // Detect our own Supabase host so we can skip already-migrated rows.
  const ownHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname

  const { data: products, error } = await supabaseAdmin
    .from('products')
    .select('id, slug, name, hero_image, review_mdx')
    .not('hero_image', 'is', null)
  if (error) {
    console.error('Read failed:', error.message)
    process.exit(1)
  }

  let migrated = 0
  let skipped = 0
  let failed = 0

  for (const p of products ?? []) {
    const oldUrl = p.hero_image as string
    if (oldUrl.includes(ownHost)) {
      console.log(`  skip  ${p.slug}  (already on our bucket)`)
      skipped++
      continue
    }

    try {
      // Fetch source
      const sourceUrl = oldUrl.startsWith('/')
        ? `https://5litru.cz${oldUrl}`  // legacy /images/products/*.webp path on prod
        : oldUrl
      const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(15_000) })
      if (!res.ok) throw new Error(`fetch ${sourceUrl} → HTTP ${res.status}`)
      const contentType = res.headers.get('content-type') ?? ''
      const ext = contentType.includes('webp') ? 'webp'
        : contentType.includes('png') ? 'png'
        : contentType.includes('jpeg') ? 'jpg'
        : (oldUrl.match(/\.(webp|jpg|jpeg|png)/i)?.[1]?.toLowerCase()) ?? 'webp'
      const mime = ext === 'webp' ? 'image/webp' : ext === 'png' ? 'image/png' : 'image/jpeg'
      const objectKey = `${p.slug}.${ext}`
      const buffer = Buffer.from(await res.arrayBuffer())

      const { error: upErr } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(objectKey, buffer, { contentType: mime, upsert: true, cacheControl: '3600' })
      if (upErr) throw new Error(`upload: ${upErr.message}`)

      const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(objectKey)
      const newUrl = `${pub.publicUrl}?v=${Date.now()}`

      // Rewrite any references inside review_mdx (img src in HTML body)
      const updatePayload: { hero_image: string; review_mdx?: string } = { hero_image: newUrl }
      if (p.review_mdx && (p.review_mdx as string).includes(oldUrl)) {
        updatePayload.review_mdx = (p.review_mdx as string).split(oldUrl).join(newUrl)
      }

      const { error: updErr } = await supabaseAdmin
        .from('products')
        .update(updatePayload)
        .eq('id', p.id)
      if (updErr) throw new Error(`db update: ${updErr.message}`)

      console.log(`  ok    ${p.slug}  →  ${objectKey}${updatePayload.review_mdx ? ' (+ mdx)' : ''}`)
      migrated++
    } catch (e) {
      console.log(`  FAIL  ${p.slug}  ${(e as Error).message}`)
      failed++
    }
  }

  console.log('')
  console.log(`Migrated: ${migrated}  Skipped (already ours): ${skipped}  Failed: ${failed}`)
}

migrate().then(() => process.exit(0))
