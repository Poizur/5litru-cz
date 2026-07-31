import { headers } from 'next/headers'

export type Market = 'CZ' | 'SK'

export async function getMarket(): Promise<Market> {
  try {
    const hdrs = await headers()
    return hdrs.get('x-market') === 'SK' ? 'SK' : 'CZ'
  } catch {
    // Safe fallback for build-time calls where headers() is unavailable
    return 'CZ'
  }
}

export function getSiteUrl(market: Market): string {
  return market === 'SK' ? 'https://5litrov.sk' : 'https://5litru.cz'
}

export function getSiteName(market: Market): string {
  return market === 'SK' ? '5litrov.sk' : '5litru.cz'
}
