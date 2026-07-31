import type { MetadataRoute } from 'next'
import { getAllGuideSlugs, getAllPageSlugs, getAllReviewSlugs } from '@/lib/content'
import { getMarket, getSiteUrl } from '@/lib/market'

// force-dynamic: each domain (5litru.cz / 5litrov.sk) gets its own sitemap
// with correct base URLs. ISR would cache the first domain's URLs for both.
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const market = await getMarket()
  const siteUrl = getSiteUrl(market)

  const [reviews, pages, guides] = await Promise.all([
    getAllReviewSlugs(),
    Promise.resolve(getAllPageSlugs()),
    Promise.resolve(getAllGuideSlugs()),
  ])

  const lastModified = new Date()

  return [
    { url: `${siteUrl}/`, lastModified, changeFrequency: 'weekly', priority: 1.0 },
    ...reviews.map((slug) => ({
      url: `${siteUrl}/${slug}/`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    })),
    ...pages.map((slug) => ({
      url: `${siteUrl}/${slug}/`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...guides.map((slug) => ({
      url: `${siteUrl}/${slug}/`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ]
}
