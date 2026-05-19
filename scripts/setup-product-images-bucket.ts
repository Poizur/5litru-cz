// One-time setup for the product-images bucket.
// Creates it if missing, idempotent. Reads policies via SQL editor still
// needed (storage.objects RLS), but bucket creation via JS is supported.

import { supabaseAdmin } from '../lib/supabase'

const BUCKET = 'product-images'

supabaseAdmin.storage.listBuckets().then(async ({ data, error }) => {
  if (error) {
    console.error('listBuckets failed:', error.message)
    process.exit(1)
  }
  const exists = (data ?? []).some(b => b.id === BUCKET)
  if (exists) {
    console.log(`Bucket '${BUCKET}' already exists.`)
    return
  }
  const { error: createErr } = await supabaseAdmin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/webp', 'image/jpeg', 'image/png'],
  })
  if (createErr) {
    console.error('createBucket failed:', createErr.message)
    process.exit(1)
  }
  console.log(`Bucket '${BUCKET}' created (public, 5 MB cap, webp/jpg/png).`)
  console.log(`Run the SQL migration too to set up RLS policies on storage.objects:`)
  console.log(`  supabase/migrations/20260518_product_images_bucket.sql`)
})
