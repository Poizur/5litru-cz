// Manual admin trigger for Olivator sync. Auth: admin session cookie.

import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { runOlivatorSync } from '@/lib/olivator-sync'

export const dynamic = 'force-dynamic'
// Sync runs DB queries against two Supabase projects — give it generous budget.
export const maxDuration = 60

export async function POST(_request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const summary = await runOlivatorSync('admin_manual')
  return NextResponse.json(summary, { status: summary.ok ? 200 : 500 })
}
