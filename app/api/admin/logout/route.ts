import { NextRequest, NextResponse } from 'next/server'
import { clearAdminSession } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  await clearAdminSession()
  return NextResponse.redirect(new URL('/admin/login', request.url), { status: 303 })
}
