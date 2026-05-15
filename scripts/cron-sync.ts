// Railway native cron script — Olivator price sync + suggestion discovery.
// Railway injects env vars directly; no HTTP endpoint or auth token needed.
//
// Railway configuration (Settings → Cron):
//   Schedule: 0 6 * * *   (daily 06:00 UTC = 07:00 Prague CET / 08:00 CEST)
//   Command:  npx tsx scripts/cron-sync.ts

import { runOlivatorSync } from '../lib/olivator-sync'

async function main() {
  console.log(`[cron-sync] starting at ${new Date().toISOString()}`)
  const summary = await runOlivatorSync('cron')
  console.log('[cron-sync] done:', JSON.stringify({
    status: summary.status,
    duration_ms: summary.duration_ms,
    prices_updated: summary.prices_updated,
    products_checked: summary.products_checked,
    suggestions_added: summary.suggestions_added,
    errors: summary.errors.length,
  }))
  process.exit(summary.ok ? 0 : 1)
}

main().catch(e => {
  console.error('[cron-sync] unhandled error:', e)
  process.exit(1)
})
