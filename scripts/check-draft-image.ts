import { supabaseAdmin } from '../lib/supabase'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const PRODUCT_ID = process.argv[2] ?? 'ec1f4900-95c2-41cd-8a15-994ee6306b1c'

Promise.all([
  supabaseAdmin
    .from('products')
    .select('id,slug,name,hero_image,status')
    .eq('id', PRODUCT_ID)
    .single(),
  supabaseAdmin
    .from('olivator_suggestions')
    .select('olivator_product_id,name,image_url')
    .eq('imported_product_id', PRODUCT_ID)
    .maybeSingle(),
]).then(([{ data: product }, { data: suggestion }]) => {
  if (!product) {
    console.log('Product not found:', PRODUCT_ID)
    return
  }
  console.log('=== PRODUCT (DB) ===')
  console.log('slug:        ', product.slug)
  console.log('name:        ', product.name)
  console.log('hero_image:  ', product.hero_image)
  console.log('status:      ', product.status)
  console.log('')
  console.log('=== FILE on disk ===')
  if (product.hero_image && product.hero_image.startsWith('/')) {
    const path = join(process.cwd(), 'public', product.hero_image)
    if (existsSync(path)) {
      const stat = statSync(path)
      console.log('EXISTS:', path)
      console.log('size:  ', stat.size, 'B')
    } else {
      console.log('MISSING:', path)
    }
  } else {
    console.log('hero_image is null or external URL — nothing on disk')
  }
  console.log('')
  console.log('=== OLIVATOR (source) ===')
  if (suggestion) {
    console.log('olivator name:', suggestion.name)
    console.log('image_url:    ', suggestion.image_url)
  } else {
    console.log('No Olivator suggestion linked')
  }
})
