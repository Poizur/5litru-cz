import { createClient } from '@supabase/supabase-js'

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const r1 = await sb.from('products').select('slug, available').eq('status', 'published').limit(3)
  console.log('WITH available:', r1.error?.message ?? JSON.stringify(r1.data?.map(p => p.slug)))
  const r2 = await sb.from('products').select('slug').eq('status', 'published').limit(3)
  console.log('WITHOUT available:', r2.error?.message ?? JSON.stringify(r2.data?.map(p => p.slug)))
}

main().catch(e => { console.error(e); process.exit(1) })
