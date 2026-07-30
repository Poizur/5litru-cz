import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { buildAffiliateUrl } from '@/lib/affiliate'

// Affiliate redirect with server-side click logging.
// /go/[slug] → log to affiliate_clicks → 302 → eHub → merchant
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const isTest = req.nextUrl.searchParams.has('test')

  // Resolve affiliate URL from DB
  const { data: product, error } = await supabaseAdmin
    .from('products')
    .select('slug, product_url, retailer:retailers(utm_campaign, ehub_tracking_hash, base_url, active)')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (error || !product?.product_url) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  const retailer = Array.isArray(product.retailer) ? product.retailer[0] : product.retailer
  const affiliateUrl = buildAffiliateUrl(product.product_url, retailer ?? {}, slug)

  // Log click async (fire and forget — never block the redirect)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
  const ipHash = ip ? crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16) : null
  supabaseAdmin.from('affiliate_clicks').insert({
    slug,
    referer: req.headers.get('referer') ?? null,
    user_agent: req.headers.get('user-agent') ?? null,
    ip_hash: ipHash,
    is_test: isTest,
  }).then(({ error: e }) => {
    if (e) console.error('[go] click log failed:', e.message)
  })

  return NextResponse.redirect(affiliateUrl, { status: 302 })
}
