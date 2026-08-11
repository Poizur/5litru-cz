import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { buildAffiliateUrl } from '@/lib/affiliate'
import type { Market } from '@/lib/market'

// Affiliate redirect with server-side click logging.
// /go/[slug] → log to affiliate_clicks → 302 → eHub → merchant
//
// Market awareness: middleware stamps x-market='SK' on requests from 5litrov.sk.
// SK requests use product_url_sk (if available) and log market='SK' for analytics.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const ua = (req.headers.get('user-agent') ?? '').toLowerCase()
  const isTest =
    req.nextUrl.searchParams.has('test') ||
    ua === 'node' ||
    ua.startsWith('curl/') ||
    ua.includes('bot') ||
    ua.includes('crawler') ||
    ua.includes('spider') ||
    ua.includes('jscrawler') ||
    ua.includes('meta-webindexer') ||
    ua.includes('semrush') ||
    ua.includes('ahref')
  const market: Market = req.headers.get('x-market') === 'SK' ? 'SK' : 'CZ'

  // Resolve affiliate URL from DB — try with product_url_sk, fall back if column missing
  type ProductData = {
    slug: string
    product_url: string | null
    product_url_sk?: string | null
    retailer: { utm_campaign: string | null; ehub_tracking_hash: string | null; base_url: string | null; active: boolean | null } | null
  }

  let product: ProductData | null = null

  const resFull = await supabaseAdmin
    .from('products')
    .select('slug, product_url, product_url_sk, retailer:retailers(utm_campaign, ehub_tracking_hash, base_url, active)')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (!resFull.error) {
    product = resFull.data as ProductData | null
  } else {
    // product_url_sk column not yet migrated — select without it
    const resFallback = await supabaseAdmin
      .from('products')
      .select('slug, product_url, retailer:retailers(utm_campaign, ehub_tracking_hash, base_url, active)')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle()
    product = resFallback.data as ProductData | null
    if (resFallback.error) console.error('[go] product fetch failed:', resFallback.error.message)
  }

  if (!product?.product_url) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  const retailer = Array.isArray(product.retailer) ? product.retailer[0] : product.retailer
  const targetUrl = (market === 'SK' && product.product_url_sk) ? product.product_url_sk : product.product_url
  const affiliateUrl = buildAffiliateUrl(targetUrl, retailer ?? {}, slug, market)

  // Log click before redirect (await ensures it completes before Railway terminates the handler)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
  const ipHash = ip ? crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16) : null

  const logBase = {
    slug,
    referer: req.headers.get('referer') ?? null,
    user_agent: req.headers.get('user-agent') ?? null,
    ip_hash: ipHash,
    is_test: isTest,
  }

  const { error: logErr } = await supabaseAdmin.from('affiliate_clicks').insert({ ...logBase, market })
  if (logErr) {
    if (logErr.message.includes('market')) {
      // market column not yet added by DDL — retry without it
      const { error: logErr2 } = await supabaseAdmin.from('affiliate_clicks').insert(logBase)
      if (logErr2) console.error('[go] click log failed:', logErr2.message)
    } else {
      console.error('[go] click log failed:', logErr.message)
    }
  }

  return NextResponse.redirect(affiliateUrl, { status: 302 })
}
