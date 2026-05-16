import { supabaseAdmin } from '@/lib/supabase'
import { CatalogClient } from './CatalogClient'

export const dynamic = 'force-dynamic'

export interface CatalogProduct {
  id: string
  slug: string
  review_slug: string | null
  name: string
  brand: string | null
  origin_region: string | null
  origin_country: string | null
  acidity_pct: number | null
  price_czk: number | null
  rating: number | null
  status: string
  published_at: string | null
  hero_image: string | null
  retailer: { name: string; slug: string } | null
}

async function loadProducts(): Promise<CatalogProduct[]> {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('id,slug,review_slug,name,brand,origin_region,origin_country,acidity_pct,price_czk,rating,status,published_at,hero_image,retailer:retailers(name,slug)')
    .order('status', { ascending: true })
    .order('name', { ascending: true })
  if (error) {
    console.error('catalog load error:', error)
    return []
  }
  return (data ?? []) as unknown as CatalogProduct[]
}

export default async function CatalogPage() {
  const products = await loadProducts()
  const ratings = products.filter(p => typeof p.rating === 'number').map(p => p.rating as number)
  const stats = {
    total: products.length,
    published: products.filter(p => p.status === 'published').length,
    drafts: products.filter(p => p.status === 'draft').length,
    avgRating: ratings.length
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : '—',
  }
  return <CatalogClient products={products} stats={stats} />
}
