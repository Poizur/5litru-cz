import { createClient } from '@supabase/supabase-js'

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const { data } = await sb
    .from('products')
    .select('slug, name, review_mdx')
    .eq('slug', 'erato')
    .single()
  console.log(data?.review_mdx)
}

main().catch(e => { console.error(e); process.exit(1) })
