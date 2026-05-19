// One-off: assign acidity_pct to legacy products that were seeded manually
// (i.e. not via Olivator pipeline). Values extracted from the original
// static comparison table in content/pages/nejlepsi-olivovy-olej-5l.mdx
// at migration time. Adjust as needed before publishing.

import { supabaseAdmin } from '../lib/supabase'

const ACIDITY_BY_SLUG: Record<string, number> = {
  sitia: 0.26,
  neotis: 0.30,        // brand says "≤ 0,3 %"
  evoilino: 0.32,
  petromilos: 0.36,
  nikolos: 0.37,
  orino: 0.39,         // brand says "≤ 0,39 %"
  erato: 0.42,
  pallada: 0.70,       // brand range "0,61–0,8 %", picked midpoint
  motakis: 0.80,       // brand says "≤ 0,8 %"
  theoni: 0.80,        // brand says "≤ 0,8 %"
}

async function run() {
  let fixed = 0
  for (const [slug, acid] of Object.entries(ACIDITY_BY_SLUG)) {
    const { error, count } = await supabaseAdmin
      .from('products')
      .update({ acidity_pct: acid }, { count: 'exact' })
      .eq('slug', slug)
      .is('acidity_pct', null)
    if (error) { console.log(`  FAIL ${slug}: ${error.message}`); continue }
    if ((count ?? 0) > 0) {
      console.log(`  ok ${slug}: ${acid} %`)
      fixed++
    } else {
      console.log(`  -- ${slug}: not found or already set`)
    }
  }
  console.log(`\nUpdated: ${fixed}`)
}

run().then(() => process.exit(0))
