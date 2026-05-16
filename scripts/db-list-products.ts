import { createClient } from '@supabase/supabase-js'

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const { data, error } = await sb
    .from('products')
    .select('id, name, slug, hero_image, status')
    .order('name')

  if (error) { console.error(error.message); process.exit(1) }

  for (const p of data ?? []) {
    const img = p.hero_image ? '✓ ' + p.hero_image.slice(0, 60) : '✗ missing'
    console.log(`[${p.status}] ${p.slug}: ${img}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
