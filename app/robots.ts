import type { MetadataRoute } from 'next'
import { getMarket, getSiteUrl } from '@/lib/market'

export const dynamic = 'force-dynamic'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const market = await getMarket()
  const siteUrl = getSiteUrl(market)
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
