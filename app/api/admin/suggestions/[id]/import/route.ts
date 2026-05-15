// Import a suggestion → creates a draft row in products + flips the
// suggestion to status='imported'. Caller redirects back to /admin/suggestions/.

import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface SuggestionRow {
  olivator_product_id: string
  olivator_slug: string
  name: string
  brand_slug: string | null
  origin_country: string | null
  origin_region: string | null
  variety: string | null
  volume_ml: number | null
  acidity: number | null
  image_url: string | null
  primary_retailer_slug: string
  primary_offer_price: number | null
  primary_offer_url: string
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { id } = await params

  const { data: sug, error: sErr } = await supabaseAdmin
    .from('olivator_suggestions')
    .select('*')
    .eq('olivator_product_id', id)
    .single()
  if (sErr || !sug) {
    return NextResponse.json({ error: 'suggestion not found' }, { status: 404 })
  }
  const s = sug as unknown as SuggestionRow

  // Resolve retailer_id from primary_retailer_slug
  const { data: retailer } = await supabaseAdmin
    .from('retailers')
    .select('id')
    .eq('slug', s.primary_retailer_slug)
    .maybeSingle()

  // Build a product slug from Olivator slug (strip trailing -5l fragments
  // so we get something like 'corinto-pelopones' instead of the full noisy slug).
  const slug = s.olivator_slug
    .replace(/-(bio|extra-panensky|olivovy-olej|nefiltrovany|bag-in-box|coupage|pet|plech)-?/g, '-')
    .replace(/-?5-?l-?/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || s.olivator_slug.slice(0, 60)

  // Insert draft product (best-effort — if slug collides, suffix-1)
  let finalSlug = slug
  let attempt = 0
  let insertedProduct: { id: string } | null = null
  while (attempt < 5) {
    const { data, error } = await supabaseAdmin
      .from('products')
      .insert({
        slug: finalSlug,
        name: s.name.slice(0, 200),
        brand: s.brand_slug,
        origin_country: s.origin_country ?? 'Řecko',
        origin_region: s.origin_region,
        variety: s.variety,
        volume_ml: s.volume_ml ?? 5000,
        acidity_pct: s.acidity,
        packaging: 'plech',
        retailer_id: retailer?.id ?? null,
        product_url: s.primary_offer_url,
        price_czk: s.primary_offer_price,
        hero_image: s.image_url,
        status: 'draft',
      })
      .select('id')
      .single()
    if (!error && data) {
      insertedProduct = data as { id: string }
      break
    }
    if (error?.code === '23505') {
      // unique violation on slug — try suffix
      attempt++
      finalSlug = `${slug}-${attempt}`
      continue
    }
    return NextResponse.json({ error: error?.message ?? 'insert failed' }, { status: 500 })
  }
  if (!insertedProduct) {
    return NextResponse.json({ error: 'slug exhausted' }, { status: 500 })
  }

  // Flip the suggestion
  await supabaseAdmin
    .from('olivator_suggestions')
    .update({
      status: 'imported',
      imported_product_id: insertedProduct.id,
      decided_at: new Date().toISOString(),
    })
    .eq('olivator_product_id', id)

  return NextResponse.redirect(new URL('/admin/suggestions/', request.url), { status: 303 })
}
