// Backfill products.acidity_pct from olivator_suggestions for rows that
// have a linked suggestion and an acidity value but a null acidity_pct on
// the product row. Migrated WP products mostly lacked acidity; this lets
// the comparison table sort meaningfully.

import { supabaseAdmin } from '../lib/supabase'

async function run() {
  const { data: products } = await supabaseAdmin
    .from('products')
    .select('id, slug, acidity_pct')
  if (!products) return
  const nullProducts = products.filter((p: any) => p.acidity_pct === null)
  console.log(`${nullProducts.length} products with null acidity_pct`)

  let fixed = 0
  for (const p of nullProducts) {
    const { data: sug } = await supabaseAdmin
      .from('olivator_suggestions')
      .select('acidity')
      .eq('imported_product_id', p.id)
      .maybeSingle()
    if (!sug || sug.acidity == null) {
      console.log(`  -- ${p.slug}: no olivator data`)
      continue
    }
    const { error } = await supabaseAdmin
      .from('products')
      .update({ acidity_pct: sug.acidity })
      .eq('id', p.id)
    if (error) {
      console.log(`  FAIL ${p.slug}: ${error.message}`)
      continue
    }
    console.log(`  ok ${p.slug}: ${sug.acidity} %`)
    fixed++
  }
  console.log(`\nFixed: ${fixed} / ${nullProducts.length}`)
}

run().then(() => process.exit(0))
