import { supabaseAdmin } from '../lib/supabase'
supabaseAdmin
  .from('products')
  .select('slug, name, status, acidity_pct, price_czk, hero_image')
  .order('acidity_pct', { ascending: true, nullsFirst: false })
  .then(({ data }) => {
    for (const p of data ?? []) {
      console.log(`${p.status.padEnd(10)} ${(p.acidity_pct ?? '—').toString().padEnd(6)} ${p.slug.padEnd(50)} ${p.hero_image?.slice(0, 80) ?? '(none)'}`)
    }
  })
