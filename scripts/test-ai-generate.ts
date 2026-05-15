// CLI test for Phase 7 AI review generation.
// Usage:
//   env -u ANTHROPIC_API_KEY npx tsx --env-file=.env.local scripts/test-ai-generate.ts
//   env -u ANTHROPIC_API_KEY npx tsx --env-file=.env.local scripts/test-ai-generate.ts <suggestion_id>

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit, getDailyCostUsd, generateAiReviewDraft } from '../lib/ai-review'

// Debug flag: set DEBUG=1 to print raw Claude output before parsing
const DEBUG = process.env.DEBUG === '1'

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  // Sanity-check Claude connectivity first
  if (DEBUG) {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const probe = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 50,
      messages: [{ role: 'user', content: 'Say "ok" and nothing else.' }],
    })
    console.log('Claude probe:', probe.content[0])
  }

  const [rateLimit, dailyCost] = await Promise.all([checkRateLimit(), getDailyCostUsd()])
  console.log(`Rate limit: ${rateLimit.ok ? `OK (${rateLimit.remaining} remaining)` : rateLimit.reason}`)
  console.log(`Daily cost so far: $${dailyCost.toFixed(4)}`)
  if (!rateLimit.ok) { console.error('Abort: rate limit hit'); process.exit(1) }

  let suggestionId = process.argv[2]
  if (!suggestionId) {
    const { data } = await sb
      .from('olivator_suggestions')
      .select('olivator_product_id, name, olivator_score')
      .eq('status', 'new')
      .order('olivator_score', { ascending: false, nullsFirst: false })
      .limit(1)
      .single()
    if (!data) { console.error('No new suggestions found'); process.exit(1) }
    const row = data as { olivator_product_id: string; name: string; olivator_score: number }
    suggestionId = row.olivator_product_id
    console.log(`\nTop suggestion: ${row.name} (score ${row.olivator_score})`)
  }

  console.log(`Suggestion ID: ${suggestionId}`)
  console.log('Starting AI pipeline… (eshop scrape + optional Heureka + Claude ~60 s)\n')

  const start = Date.now()
  const result = await generateAiReviewDraft(suggestionId)
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  console.log('\n=== RESULT ===')
  console.log(`product_id:    ${result.product_id}`)
  console.log(`job_id:        ${result.job_id}`)
  console.log(`slug:          ${result.slug}`)
  console.log(`review_slug:   ${result.review_slug}`)
  console.log(`input_tokens:  ${result.input_tokens}`)
  console.log(`output_tokens: ${result.output_tokens}`)
  console.log(`cost_usd:      $${result.cost_usd.toFixed(4)}`)
  console.log(`elapsed:       ${elapsed} s`)
  if (result.warnings.length) {
    console.log(`warnings:      ${result.warnings.join(', ')}`)
  }
  console.log(`\nEdit draft:    http://localhost:3000/admin/products/${result.product_id}/edit/`)
}

main().catch(e => { console.error('\n[FAILED]', e); process.exit(1) })
