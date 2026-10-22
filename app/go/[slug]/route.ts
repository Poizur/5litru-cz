import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { buildAffiliateUrl } from '@/lib/affiliate'
import type { Market } from '@/lib/market'
import { botReason } from '@/lib/bot-detect'

const RATE_LIMIT_PER_MIN = 5

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
  const userAgent = req.headers.get('user-agent') ?? ''
  const referer = req.headers.get('referer') ?? ''
  const hasOrigin = Boolean(referer || req.nextUrl.searchParams.get('utm_source'))
  const obviousBot = botReason(userAgent, hasOrigin)
  const isTest = req.nextUrl.searchParams.has('test') || obviousBot != null
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
  // Pojistka: obchod mimo spolupráci (active=false) nikdy neposíláme do e-shopu — zpět na recenzi produktu.
  if (retailer?.active === false) {
    return NextResponse.redirect(new URL(`/${product.slug}/`, req.url), 302)
  }
  const targetUrl = (market === 'SK' && product.product_url_sk) ? product.product_url_sk : product.product_url

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
  const ipHash = ip ? crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16) : null

  // >5 kliků/min z jedné IP = bot → přímo do obchodu, mimo eHUB (ochrana před click fraud)
  let isRateLimited = false
  if (ipHash) {
    const { count } = await supabaseAdmin
      .from('affiliate_clicks')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('clicked_at', new Date(Date.now() - 60_000).toISOString())
    isRateLimited = (count ?? 0) >= RATE_LIMIT_PER_MIN
  }
  const redirectUrl = isRateLimited || obviousBot
    ? new URL(targetUrl, retailer?.base_url ?? undefined).toString()
    : buildAffiliateUrl(targetUrl, retailer ?? {}, slug, market)

  const logBase = {
    slug,
    referer: referer || null,
    user_agent: userAgent || null,
    ip_hash: ipHash,
    is_test: isTest || isRateLimited,
    // Klik bez refereru se přesměruje normálně, ale do lidských kliků se nepočítá
    unverified: !hasOrigin && !isTest && !isRateLimited,
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

  return NextResponse.redirect(redirectUrl, { status: 302 })
}
