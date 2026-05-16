import { supabaseAdmin } from '../lib/supabase'

supabaseAdmin
  .from('products')
  .select('slug')
  .eq('status', 'published')
  .not('product_url', 'is', null)
  .then(({ data }) => {
    console.log((data ?? []).map((p: { slug: string }) => p.slug).join('\n'))
  })
