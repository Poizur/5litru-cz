// Admin login: validates password via constant-time compare, sets HMAC-signed
// session cookie, redirects to ?redirect= target. Logs every attempt to
// admin_login_attempts; locks IP for 15 min after 5 failures.

import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { createAdminSession, verifyPassword } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'

const MAX_FAILS = 5
const LOCKOUT_MINUTES = 15

function hashIp(request: NextRequest): string {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  return createHash('sha256').update(ip).digest('hex')
}

async function checkLockout(ipHash: string): Promise<number> {
  const since = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000).toISOString()
  const { count } = await supabaseAdmin
    .from('admin_login_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .eq('success', false)
    .gte('attempted_at', since)

  if ((count ?? 0) >= MAX_FAILS) {
    const { data } = await supabaseAdmin
      .from('admin_login_attempts')
      .select('attempted_at')
      .eq('ip_hash', ipHash)
      .eq('success', false)
      .gte('attempted_at', since)
      .order('attempted_at', { ascending: true })
      .limit(1)
    const oldest = data?.[0]?.attempted_at
    if (oldest) {
      const elapsedMin = (Date.now() - new Date(oldest).getTime()) / 60000
      return Math.max(0, Math.ceil(LOCKOUT_MINUTES - elapsedMin))
    }
    return LOCKOUT_MINUTES
  }
  return 0
}

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Bad form' }, { status: 400 })

  const password = (form.get('password') as string | null) ?? ''
  const target = ((form.get('redirect') as string | null) ?? '/admin/').toString()
  const safeTarget = target.startsWith('/admin') ? target : '/admin/'

  const ipHash = hashIp(request)
  const lockedMin = await checkLockout(ipHash)
  if (lockedMin > 0) {
    const url = new URL('/admin/login', request.url)
    url.searchParams.set('locked', String(lockedMin))
    return NextResponse.redirect(url, { status: 303 })
  }

  const ok = verifyPassword(password)

  // Log attempt — non-fatal if it fails (don't surface DB errors to the user).
  try {
    await supabaseAdmin.from('admin_login_attempts').insert({
      ip_hash: ipHash,
      success: ok,
    })
  } catch {
    // ignore — login decision already made
  }

  if (!ok) {
    const url = new URL('/admin/login', request.url)
    url.searchParams.set('error', 'invalid')
    if (target) url.searchParams.set('redirect', safeTarget)
    return NextResponse.redirect(url, { status: 303 })
  }

  await createAdminSession()
  return NextResponse.redirect(new URL(safeTarget, request.url), { status: 303 })
}
