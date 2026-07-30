import { NextRequest, NextResponse } from 'next/server'
import { runOlivatorSync } from '@/lib/olivator-sync'

// Called by Railway cron at 06:00 UTC daily.
// Authorized via x-cron-secret header (must match CRON_SECRET env var).
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const summary = await runOlivatorSync('cron')
    return NextResponse.json({ ok: summary.ok, summary })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
