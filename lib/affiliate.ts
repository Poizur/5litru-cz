import type { Retailer } from './types'

// Builds an affiliate URL by appending eHub tracking params to a retailer product URL.
// Pattern (per PROMPT_PATCH.md §11):
//   https://shop.reckonasbavi.cz/<path>/?utm_source=ehub&utm_medium=affiliate
//     &utm_campaign=5litru-cz&ehub=<hash>
//
// 5litru reports are distinguished from other sites in eHub via utm_campaign.
export function buildAffiliateUrl(
  productUrl: string,
  retailer: Pick<Retailer, 'base_url' | 'ehub_tracking_hash' | 'utm_campaign'>
): string {
  const url = new URL(productUrl, retailer.base_url)
  url.searchParams.set('utm_source', 'ehub')
  url.searchParams.set('utm_medium', 'affiliate')
  url.searchParams.set('utm_campaign', retailer.utm_campaign || '5litru-cz')
  if (retailer.ehub_tracking_hash) {
    url.searchParams.set('ehub', retailer.ehub_tracking_hash)
  }
  return url.toString()
}
