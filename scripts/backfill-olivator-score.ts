// Jednorázové doplnění olivator_score / olivator_product_id / olivator_slug do 5litru products
// z DB Olivátoru (stejné párování jako lib/olivator-sync.ts: product_url nabídky reckonasbavi).
// Nevolá Claude, neposílá e-maily, nemění ceny ani dostupnost — jen Score a vazbu.
//
//   npx tsx --env-file=.env.local scripts/backfill-olivator-score.ts            # dry-run
//   npx tsx --env-file=.env.local scripts/backfill-olivator-score.ts --apply    # zápis
//
// Předpoklad: aplikovaná migrace supabase/migrations/20261122_olivator_score.sql.
// Od té chvíle totéž dělá noční cron olivator-sync (06:00 UTC) — skript je jen pro první naplnění.

import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '../lib/supabase'

const APPLY = process.argv.includes('--apply')

async function main() {
  const url = process.env.OLIVATOR_SUPABASE_URL
  const key = process.env.OLIVATOR_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('OLIVATOR_SUPABASE_URL / OLIVATOR_SUPABASE_ANON_KEY not set')
  const oliv = createClient(url, key, { auth: { persistSession: false } })

  const { data: olivProducts, error } = await oliv
    .from('products')
    .select('id, slug, olivator_score, offers:product_offers(product_url, retailer:retailers(slug, is_active))')
    .eq('status', 'active')
    .gte('volume_ml', 4500)
    .lte('volume_ml', 5500)
    .limit(500)
  if (error) throw new Error(`olivator: ${error.message}`)

  const byUrl = new Map<string, { id: string; slug: string; score: number | null }>()
  for (const p of (olivProducts ?? []) as Array<{ id: string; slug: string; olivator_score: number | null; offers: Array<{ product_url: string | null; retailer: { is_active?: boolean } | { is_active?: boolean }[] | null }> }>) {
    for (const o of p.offers ?? []) {
      if (!o.product_url) continue
      const r = Array.isArray(o.retailer) ? o.retailer[0] : o.retailer
      if (r?.is_active === false) continue
      byUrl.set(o.product_url, { id: p.id, slug: p.slug, score: p.olivator_score ?? null })
    }
  }

  const { data: ours, error: ourErr } = await supabaseAdmin
    .from('products')
    .select('id, slug, product_url, olivator_score, olivator_product_id, olivator_slug')
    .not('product_url', 'is', null)
  if (ourErr) throw new Error(`5litru: ${ourErr.message} (je aplikovaná migrace 20261122_olivator_score.sql?)`)

  let changed = 0
  for (const p of (ours ?? []) as Array<{ id: string; slug: string; product_url: string; olivator_score: number | null; olivator_product_id: string | null; olivator_slug: string | null }>) {
    const o = byUrl.get(p.product_url)
    if (!o) { console.log(`– ${p.slug}: bez nabídky v Olivátoru`); continue }
    const updates: Record<string, unknown> = {}
    if (p.olivator_score !== o.score) updates.olivator_score = o.score
    if (p.olivator_product_id !== o.id) updates.olivator_product_id = o.id
    if (p.olivator_slug !== o.slug) updates.olivator_slug = o.slug
    if (Object.keys(updates).length === 0) { console.log(`= ${p.slug}: beze změny (score ${p.olivator_score})`); continue }
    console.log(`${APPLY ? '✓' : '→'} ${p.slug}: ${JSON.stringify(updates)} (dříve score=${p.olivator_score})`)
    changed++
    if (!APPLY) continue
    const { error: upErr } = await supabaseAdmin.from('products').update(updates).eq('id', p.id)
    if (upErr) { console.error(`✗ ${p.slug}: ${upErr.message}`); process.exitCode = 1 }
  }
  console.log(APPLY ? `hotovo: ${changed} produktů aktualizováno` : `dry-run: ${changed} produktů by se změnilo (spusť s --apply)`)
}

main().catch(e => { console.error(e); process.exit(1) })
