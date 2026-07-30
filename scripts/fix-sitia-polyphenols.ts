// K-1: update SITIA polyphenols from 479 to 646 mg/kg in review_mdx
import { createClient } from '@supabase/supabase-js'

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data, error } = await sb
    .from('products')
    .select('id, slug, review_mdx')
    .ilike('slug', '%sitia%')

  if (error) { console.error('query error:', error.message); process.exit(1) }

  for (const p of data ?? []) {
    const mdx = p.review_mdx as string | null
    if (!mdx || !mdx.includes('479')) {
      console.log(`${p.slug}: no 479 found, skipping`)
      continue
    }
    const updated = mdx.replaceAll('479', '646')
    const { error: upErr } = await sb
      .from('products')
      .update({ review_mdx: updated })
      .eq('id', p.id)
    if (upErr) {
      console.error(`${p.slug}: update failed —`, upErr.message)
    } else {
      console.log(`${p.slug}: updated 479→646 mg/kg`)
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })
