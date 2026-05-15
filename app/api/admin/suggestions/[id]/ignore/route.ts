// Ignore a suggestion → flips its status='ignored'. Optional ?reason= or
// form field. Caller redirects back to /admin/suggestions/.

import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const form = await request.formData().catch(() => null)
  const reason = (form?.get('reason') as string | null)?.slice(0, 200) ?? null

  const { error } = await supabaseAdmin
    .from('olivator_suggestions')
    .update({
      status: 'ignored',
      ignore_reason: reason,
      decided_at: new Date().toISOString(),
    })
    .eq('olivator_product_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.redirect(new URL('/admin/suggestions/', request.url), { status: 303 })
}
