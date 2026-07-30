import type { Retailer } from './types'

// Builds an eHub server-redirect URL so every click is recorded server-side
// before the browser reaches the merchant (more reliable than on-site pixel).
// Format: https://ehub.cz/system/scripts/click.php?a_aid=...&a_bid=...&desturl=...
//
// The desturl carries UTM params for analytics on the merchant side.
export function buildAffiliateUrl(
  productUrl: string,
  retailer: Pick<Retailer, 'base_url' | 'ehub_tracking_hash' | 'utm_campaign'>,
  productSlug = ''
): string {
  const target = new URL(productUrl, retailer.base_url)
  target.searchParams.set('utm_source', 'ehub')
  target.searchParams.set('utm_medium', 'affiliate')
  target.searchParams.set('utm_campaign', retailer.utm_campaign || '5litru-cz')
  const desturl = encodeURIComponent(target.toString())
  const data1 = productSlug ? `5litru-${productSlug}` : '5litru'
  return (
    `https://ehub.cz/system/scripts/click.php?a_aid=2f4d1556&a_bid=46f8224d` +
    `&data1=${data1}&desturl=${desturl}`
  )
}
