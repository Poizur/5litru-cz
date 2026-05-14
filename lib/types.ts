// 5litru.cz DB types (standalone Supabase project, no shared tables with olivator).

export type ProductStatus = 'draft' | 'published' | 'archived'

export interface Retailer {
  id: string
  slug: string
  name: string
  base_url: string
  affiliate_network: string // 'ehub' (default)
  ehub_tracking_hash: string | null
  utm_campaign: string // '5litru-cz' (default)
  active: boolean
  created_at: string
}

export interface Product {
  id: string
  slug: string // e.g. 'motakis' — drives /motakis/ affiliate redirect
  review_slug: string | null // e.g. 'motakis-recenze' — drives /motakis-recenze/ review page
  name: string
  brand: string | null
  origin_country: string
  origin_region: string | null
  variety: string | null
  volume_ml: number
  acidity_pct: number | null
  packaging: 'plech' | 'pet' | 'sklo' | null
  price_czk: number | null
  retailer_id: string | null
  product_url: string | null // canonical URL on retailer site
  affiliate_url: string | null
  rating: number | null
  hero_image: string | null
  status: ProductStatus
  review_mdx: string | null
  review_frontmatter: Record<string, unknown> | null
  created_at: string
  updated_at: string
  published_at: string | null
}

export type AiJobType = 'review_draft' | 'scrape_url' | 'image_alt'
export type AiJobStatus = 'pending' | 'completed' | 'failed'

export interface AiJob {
  id: string
  product_id: string | null
  job_type: AiJobType
  input: Record<string, unknown> | null
  output: Record<string, unknown> | null
  model: string | null
  status: AiJobStatus
  cost_usd: number | null
  error_message: string | null
  created_at: string
  completed_at: string | null
}

export interface Click {
  id: number
  product_id: string | null
  source_path: string | null
  user_agent: string | null
  ip_hash: string | null
  clicked_at: string
}
