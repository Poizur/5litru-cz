// Railway native cron script — Olivator price sync + suggestion discovery.
// Railway injects env vars directly; no HTTP endpoint or auth token needed.
//
// Railway configuration (Settings → Cron):
//   Schedule: 0 6 * * *   (daily 06:00 UTC = 07:00 Prague CET / 08:00 CEST)
//   Command:  npx tsx scripts/cron-sync.ts

import { runOlivatorSync } from '../lib/olivator-sync'
import { supabaseAdmin } from '../lib/supabase'
import { sendTrackingAlert } from '../lib/email'

const TRACKING_WINDOW_HOURS = 72

async function checkTrackingHealth(): Promise<void> {
  const cutoff = new Date(Date.now() - TRACKING_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
  const { count } = await supabaseAdmin
    .from('affiliate_clicks')
    .select('id', { count: 'exact', head: true })
    .eq('is_test', false)
    .gte('clicked_at', cutoff)

  const organicCount = count ?? 0
  console.log(`[cron-sync] tracking health: ${organicCount} organic clicks in last ${TRACKING_WINDOW_HOURS}h`)
  if (organicCount > 0) return

  const { data: lastClick } = await supabaseAdmin
    .from('affiliate_clicks')
    .select('clicked_at')
    .eq('is_test', false)
    .order('clicked_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  await sendTrackingAlert({
    windowHours: TRACKING_WINDOW_HOURS,
    lastClickAt: (lastClick?.clicked_at as string | null) ?? null,
  })
  console.log(`[cron-sync] tracking alert sent (0 clicks in ${TRACKING_WINDOW_HOURS}h)`)
}

async function main() {
  console.log(`[cron-sync] starting at ${new Date().toISOString()}`)

  // Dead-man's switch — alert pokud 0 organic kliků za 72h
  await checkTrackingHealth().catch(e =>
    console.error('[cron-sync] tracking health check failed:', e?.message),
  )

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
