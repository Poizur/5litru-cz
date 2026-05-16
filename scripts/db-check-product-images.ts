import { createClient } from '@supabase/supabase-js'

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data } = await sb.from('product_images').select('product_slug').order('product_slug')
  const counts: Record<string, number> = {}
  for (const r of data ?? []) counts[r.product_slug] = (counts[r.product_slug] ?? 0) + 1
  for (const [slug, n] of Object.entries(counts)) console.log(`  ${slug}: ${n} images`)
  console.log(`Total: ${data?.length ?? 0}`)
}
main().catch(e => { console.error(e); process.exit(1) })
