// POST /api/admin/products/[id]/hero-image
// multipart/form-data with field "file" (image/webp|jpeg|png, ≤5 MB)
//
// 1. Uploads to Supabase Storage bucket `product-images` (key = `${slug}.${ext}`)
// 2. UPDATEs products.hero_image to the new public URL
// 3. Rewrites any reference to the OLD hero_image inside review_mdx
//    (public review page renders MDX verbatim, so this keeps the hero img
//    in the rendered article in sync)
//
// Status returned to admin: 200 { hero_image: <new public URL> } on success.

import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const BUCKET = 'product-images'
const ALLOWED_TYPES = new Set(['image/webp', 'image/jpeg', 'image/png'])
const MAX_BYTES = 5 * 1024 * 1024

const EXT_BY_TYPE: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { id } = await params

  // Parse multipart
  let file: File | null = null
  try {
    const form = await request.formData()
    const f = form.get('file')
    if (f instanceof File) file = f
  } catch {
    return NextResponse.json({ error: 'invalid form data' }, { status: 400 })
  }
  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 })
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `unsupported type ${file.type} — povolen webp / jpg / png` },
      { status: 400 },
    )
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `soubor je ${(file.size / 1024 / 1024).toFixed(1)} MB, limit 5 MB` },
      { status: 400 },
    )
  }

  // Load existing product for slug + old hero_image + review_mdx
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('products')
    .select('slug, hero_image, review_mdx')
    .eq('id', id)
    .single()
  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'product not found' }, { status: 404 })
  }

  const ext = EXT_BY_TYPE[file.type]
  // Cache-bust suffix so admins see the new image immediately instead of
  // the CDN's old copy when re-uploading under the same slug.
  const objectKey = `${existing.slug}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadErr } = await supabaseAdmin
    .storage
    .from(BUCKET)
    .upload(objectKey, buffer, {
      contentType: file.type,
      upsert: true,
      cacheControl: '3600',
    })
  if (uploadErr) {
    return NextResponse.json(
      { error: `upload failed: ${uploadErr.message}` },
      { status: 500 },
    )
  }

  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(objectKey)
  // Cache-bust query so CDN-cached <img> swaps even within the same key
  const newHeroImage = `${pub.publicUrl}?v=${Date.now()}`

  // Rewrite review_mdx references to the old URL
  let updatedMdx: string | null = null
  if (existing.hero_image && existing.review_mdx?.includes(existing.hero_image)) {
    updatedMdx = existing.review_mdx.split(existing.hero_image).join(newHeroImage)
  }

  const updatePayload: { hero_image: string; review_mdx?: string } = {
    hero_image: newHeroImage,
  }
  if (updatedMdx) updatePayload.review_mdx = updatedMdx

  const { error: updateErr } = await supabaseAdmin
    .from('products')
    .update(updatePayload)
    .eq('id', id)
  if (updateErr) {
    return NextResponse.json(
      { error: `db update failed: ${updateErr.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    hero_image: newHeroImage,
    mdx_replaced: updatedMdx !== null,
  })
}
