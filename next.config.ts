import type { NextConfig } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null

// Build-time DB query: for every published product with a product_url, emit
// `/${slug}/` → eHub-decorated retailer URL as a 302 (so eHub can rotate
// click trackers without us redeploying). The eHub tracking hash currently
// sits as the literal '<EHUB_HASH_TODO>' placeholder; once the real hash
// lands in the retailers row, `UPDATE retailers SET ehub_tracking_hash=...`
// + Railway redeploy picks it up automatically.
async function buildAffiliateRedirects() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.warn('[next.config] Supabase env missing — skipping affiliate redirects.')
    return []
  }
  try {
    const sb = createClient(url, key, { auth: { persistSession: false } })
    const { data, error } = await sb
      .from('products')
      .select('slug, product_url, retailer:retailers(utm_campaign, ehub_tracking_hash, base_url, active)')
      .eq('status', 'published')
      .not('product_url', 'is', null)
    if (error) {
      console.warn('[next.config] DB query failed for redirects:', error.message)
      return []
    }

    const redirects = (data ?? []).flatMap((p: any) => {
      if (!p.slug || !p.product_url) return []
      const retailer = Array.isArray(p.retailer) ? p.retailer[0] : p.retailer
      if (retailer && retailer.active === false) return []
      let target: URL
      try {
        target = new URL(p.product_url)
      } catch {
        return []
      }
      target.searchParams.set('utm_source', 'ehub')
      target.searchParams.set('utm_medium', 'affiliate')
      target.searchParams.set('utm_campaign', retailer?.utm_campaign ?? '5litru-cz')
      if (retailer?.ehub_tracking_hash) {
        target.searchParams.set('ehub', retailer.ehub_tracking_hash)
      }
      const destination = target.toString()
      // Two aliases per product:
      //   /${slug}/        — canonical short link (used in current MDX)
      //   /go/${slug}      — legacy ThirstyAffiliates pattern from WordPress;
      //                      still referenced by migrated review pages.
      return [
        { source: `/${p.slug}/`, destination, permanent: false },
        { source: `/go/${p.slug}`, destination, permanent: false },
      ]
    })
    console.log(`[next.config] generated ${redirects.length} affiliate redirects.`)
    return redirects
  } catch (e) {
    console.warn('[next.config] affiliate redirects failed:', (e as Error).message)
    return []
  }
}

const nextConfig: NextConfig = {
  trailingSlash: true,
  images: {
    minimumCacheTTL: 2592000,
    remotePatterns: [
      ...(supabaseHost
        ? [
            {
              protocol: 'https' as const,
              hostname: supabaseHost,
              pathname: '/storage/v1/object/public/**',
            },
          ]
        : []),
      { protocol: 'https', hostname: '5litru.cz' },
      { protocol: 'https', hostname: 'shop.reckonasbavi.cz' },
      { protocol: 'https', hostname: 'cdn.myshoptet.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  async redirects() {
    return buildAffiliateRedirects()
  },
}

export default nextConfig
