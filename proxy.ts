// Gate /admin/* (except /admin/login) behind a signed session cookie.
// Edge-runtime — uses only Web Crypto API (mirrors lib/admin-auth.ts).
//
// Next.js 16: proxy.ts replaces middleware.ts. Function export name MUST
// be `proxy` (or default) — the previous `middleware` export triggers
// "Proxy is missing expected function export name".

import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = '5litru_admin'
const COOKIE_MAX_AGE_MS = 60 * 60 * 24 * 7 * 1000

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return result === 0
}

async function hmacSign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  const bytes = new Uint8Array(sig)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function isValidSession(value: string | undefined, secret: string): Promise<boolean> {
  if (!value) return false
  const [issued, signature] = value.split('.')
  if (!issued || !signature) return false
  const expected = await hmacSign(issued, secret)
  if (!safeEqual(signature, expected)) return false
  const age = Date.now() - Number(issued)
  return !isNaN(age) && age >= 0 && age <= COOKIE_MAX_AGE_MS
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isAdmin = pathname.startsWith('/admin')
  const isLogin = pathname === '/admin/login' || pathname === '/admin/login/'
  const isLoginApi = pathname.startsWith('/api/admin/login')

  if (isAdmin && !isLogin && !isLoginApi) {
    const secret = process.env.ADMIN_SECRET_KEY
    if (!secret) {
      return new NextResponse('ADMIN_SECRET_KEY not configured', { status: 500 })
    }
    const cookie = request.cookies.get(COOKIE_NAME)
    const valid = await isValidSession(cookie?.value, secret)
    if (!valid) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/login'
      url.search = ''
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }
  }

  const response = NextResponse.next()
  // Admin pages must not be cached — DB state changes frequently.
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    response.headers.set('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon|images/|.*\\.(?:webp|jpg|jpeg|png|svg|ico|json|js|css|xml|txt)$).*)'],
}
