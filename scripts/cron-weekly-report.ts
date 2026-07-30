// Railway cron service — spustit každou neděli v 19:00 UTC.
// Railway: Settings → Cron → Schedule: 0 19 * * 0 → Command: npx tsx scripts/cron-weekly-report.ts

import { generateWeeklyReport } from './weekly-report'

async function main() {
  console.log(`[cron-weekly-report] starting at ${new Date().toISOString()}`)
  const { sent } = await generateWeeklyReport(false)
  console.log(`[cron-weekly-report] done — sent=${sent}`)
}

main().catch(e => { console.error(e); process.exit(1) })
