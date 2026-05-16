import { supabaseAdmin } from '@/lib/supabase'
import { CatalogClient } from './CatalogClient'
import type { CardProduct } from '../_components/ProductCard'

export const dynamic = 'force-dynamic'

async function loadProducts(): Promise<CardProduct[]> {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('id,slug,review_slug,name,brand,origin_region,price_czk,status,hero_image')
    .neq('status', 'draft')
    .order('status', { ascending: true })
    .order('name', { ascending: true })
  if (error) {
    console.error('catalog load error:', error)
    return []
  }
  return (data ?? []) as unknown as CardProduct[]
}

export default async function CatalogPage() {
  const products = await loadProducts()
  return <CatalogClient products={products} />
}
