import type { Retailer } from './types'
import type { Market } from './market'

// Builds an eHub server-redirect URL so every click is recorded server-side
// before the browser reaches the merchant (more reliable than on-site pixel).
// Format: https://ehub.cz/system/scripts/click.php?a_aid=...&a_bid=...&desturl=...
//
// market='SK' → data1=5litrov-{slug}, utm_campaign=5litrov-sk
// market='CZ' → data1=5litru-{slug},  utm_campaign from retailer row
export function buildAffiliateUrl(
  productUrl: string,
  retailer: Pick<Retailer, 'base_url' | 'ehub_tracking_hash' | 'utm_campaign'>,
  productSlug = '',
  market: Market = 'CZ'
): string {
  const target = new URL(productUrl, retailer.base_url)
  target.searchParams.set('utm_source', 'ehub')
  target.searchParams.set('utm_medium', 'affiliate')
  target.searchParams.set('utm_campaign', market === 'SK' ? '5litrov-sk' : (retailer.utm_campaign || '5litru-cz'))
  const desturl = encodeURIComponent(target.toString())
  const prefix = market === 'SK' ? '5litrov' : '5litru'
  const data1 = productSlug ? `${prefix}-${productSlug}` : prefix
  return (
    `https://ehub.cz/system/scripts/click.php?a_aid=2f4d1556&a_bid=46f8224d` +
    `&data1=${data1}&desturl=${desturl}`
  )
}
