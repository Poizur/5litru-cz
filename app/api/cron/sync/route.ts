// Railway cron trigger for Olivator sync. Auth: Bearer token CRON_SECRET.
// Schedule in Railway dashboard: 0 6 * * * (daily 06:00 UTC = 07:00 Prague CET / 08:00 CEST).

import { NextRequest, NextResponse } from 'next/server'
import { runOlivatorSync } from '@/lib/olivator-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const summary = await runOlivatorSync('cron')
  return NextResponse.json(summary, { status: summary.ok ? 200 : 500 })
}

// GET — health check / readiness probe (no secret needed, returns metadata only).
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/cron/sync',
    method: 'POST',
    auth: 'Authorization: Bearer ${CRON_SECRET}',
    schedule_recommended: '0 6 * * *',
  })
}
