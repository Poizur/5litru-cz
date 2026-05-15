import type { MetadataRoute } from 'next'
import { getAllGuideSlugs, getAllPageSlugs, getAllReviewSlugs } from '@/lib/content'
import { SITE_URL } from '@/lib/seo'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [reviews, pages, guides] = await Promise.all([
    getAllReviewSlugs(),
    Promise.resolve(getAllPageSlugs()),
    Promise.resolve(getAllGuideSlugs()),
  ])

  const lastModified = new Date()

  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: 'weekly', priority: 1.0 },
    ...reviews.map((slug) => ({
      url: `${SITE_URL}/${slug}/`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    })),
    ...pages.map((slug) => ({
      url: `${SITE_URL}/${slug}/`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...guides.map((slug) => ({
      url: `${SITE_URL}/${slug}/`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ]
}
