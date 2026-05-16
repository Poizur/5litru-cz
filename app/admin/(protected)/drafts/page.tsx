import { supabaseAdmin } from '@/lib/supabase'
import { DraftsClient } from './DraftsClient'
import type { CardProduct } from '../_components/ProductCard'

export const dynamic = 'force-dynamic'

async function loadDrafts(): Promise<CardProduct[]> {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('id,slug,review_slug,name,brand,origin_region,price_czk,status,hero_image,created_at')
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('drafts load error:', error)
    return []
  }
  return (data ?? []) as unknown as CardProduct[]
}

export default async function DraftsPage() {
  const drafts = await loadDrafts()
  return <DraftsClient drafts={drafts} />
}
