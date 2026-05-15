// POST /api/admin/products/[id]/publish
// Sets status='published', published_at=now(), triggers Railway redeploy.

import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { id } = await params

  const { error } = await supabaseAdmin
    .from('products')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'draft') // only promote from draft

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Trigger Railway redeploy so next.config.ts affiliate redirects pick up new slug
  const webhook = process.env.RAILWAY_REDEPLOY_WEBHOOK
  if (webhook) {
    fetch(webhook, { method: 'POST' }).catch(e =>
      console.warn('[publish] Railway redeploy webhook failed:', e)
    )
  }

  return NextResponse.json({ ok: true })
}
