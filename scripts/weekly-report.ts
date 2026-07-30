// Týdenní mini-report: affiliate kliky per produkt + sync stav + sold-out počet.
// Spouští cron-weekly-report.ts každou neděli v 19:00 UTC.

import { supabaseAdmin } from '../lib/supabase'
import { sendViaResend } from '../lib/email'

interface ClickRow { slug: string; cnt: number }
interface SyncRow {
  started_at: string
  finished_at: string | null
  status: string
  prices_updated: number
  errors: string[] | null
}

export async function generateWeeklyReport(isTest = false): Promise<{ sent: boolean; html: string }> {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()

  // 1. Affiliate kliky za posledních 7 dní
  const { data: rawClicks } = await supabaseAdmin
    .from('affiliate_clicks')
    .select('slug')
    .gte('clicked_at', since)
    .eq('is_test', false)

  const clickMap: Record<string, number> = {}
  for (const r of rawClicks ?? []) {
    clickMap[r.slug] = (clickMap[r.slug] ?? 0) + 1
  }
  const clickRows: ClickRow[] = Object.entries(clickMap)
    .map(([slug, cnt]) => ({ slug, cnt }))
    .sort((a, b) => b.cnt - a.cnt)
  const totalClicks = clickRows.reduce((s, r) => s + r.cnt, 0)

  // 2. Posledních 5 sync runů
  const { data: syncLogs } = await supabaseAdmin
    .from('price_sync_log')
    .select('started_at, finished_at, status, prices_updated, errors')
    .order('started_at', { ascending: false })
    .limit(5)

  const lastSync = (syncLogs ?? [])[0] as SyncRow | undefined
  const syncOk = lastSync?.status === 'success'
  const failedCount = (syncLogs ?? []).filter((r: SyncRow) => r.status !== 'success').length

  // 3. Sold-out počet
  const { count: soldOut } = await supabaseAdmin
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published')
    .eq('available', false)

  const { count: total } = await supabaseAdmin
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published')

  const weekStr = new Date().toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })

  // --- HTML email ---
  const clickTableRows = clickRows.length
    ? clickRows.map(r => `<tr><td style="padding:4px 12px 4px 0">${r.slug}</td><td style="padding:4px 0;text-align:right;font-weight:600">${r.cnt}</td></tr>`).join('')
    : '<tr><td colspan="2" style="padding:4px 0;color:#888">Žádné kliky za posledních 7 dní</td></tr>'

  const syncStatusColor = syncOk ? '#2d6a4f' : '#c0392b'
  const syncStatusText = syncOk
    ? `✓ OK — ${lastSync?.prices_updated ?? 0} cen aktualizováno`
    : `✗ ${lastSync?.status ?? 'neznámý'} — ${lastSync?.errors?.[0] ?? 'viz logy'}`

  const testBanner = isTest
    ? '<div style="background:#fff3cd;border:1px solid #ffc107;padding:8px 16px;margin-bottom:16px;border-radius:4px;font-size:12px">TESTOVACÍ REPORT — data za posledních 7 dní</div>'
    : ''

  const html = `
<div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;color:#1d1d1f">
  ${testBanner}
  <h2 style="color:#2d6a4f;margin:0 0 4px">5litru.cz — týdenní report</h2>
  <p style="color:#888;font-size:13px;margin:0 0 24px">${weekStr}${failedCount > 0 ? ` · <strong style="color:#c0392b">${failedCount} sync chyb za týden</strong>` : ''}</p>

  <h3 style="font-size:14px;margin:0 0 8px;color:#444">Affiliate kliky (7 dní)</h3>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    ${clickTableRows}
    <tr style="border-top:1px solid #eee"><td style="padding:6px 12px 0 0;color:#888">Celkem</td><td style="padding:6px 0;text-align:right;font-weight:700">${totalClicks}</td></tr>
  </table>

  <h3 style="font-size:14px;margin:24px 0 8px;color:#444">Sync stav</h3>
  <p style="font-size:14px;margin:0;color:${syncStatusColor}">${syncStatusText}</p>
  ${lastSync ? `<p style="font-size:12px;color:#aaa;margin:4px 0 0">Poslední run: ${new Date(lastSync.started_at).toLocaleString('cs-CZ')}</p>` : ''}

  <h3 style="font-size:14px;margin:24px 0 8px;color:#444">Dostupnost</h3>
  <p style="font-size:14px;margin:0">${soldOut ?? 0} / ${total ?? 0} produktů vyprodáno</p>

  <p style="font-size:11px;color:#ccc;margin:32px 0 0;border-top:1px solid #eee;padding-top:12px">5litru.cz · automatický report</p>
</div>`

  const recipient = process.env.ADMIN_NOTIFICATION_EMAIL
  if (!recipient) {
    console.warn('[weekly-report] ADMIN_NOTIFICATION_EMAIL not set — skipping send')
    return { sent: false, html }
  }

  const subject = isTest
    ? `[TEST] 5litru.cz týdenní report — ${weekStr}`
    : `5litru.cz týdenní report — ${weekStr}`

  const result = await sendViaResend(recipient, subject, html)
  console.log('[weekly-report] send:', result)
  return { sent: result.delivered, html }
}
