import { NextRequest, NextResponse } from 'next/server'

// Detects host and stamps x-market / x-locale / x-currency headers so server
// components can render market-appropriate content without per-component host reads.
// 5litrov.sk → SK / EUR / sk
// 5litru.cz (or any other host) → CZ / CZK / cs
export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? ''
  const isSK = host === '5litrov.sk' || host.startsWith('5litrov.sk:')
  const res = NextResponse.next()
  res.headers.set('x-market', isSK ? 'SK' : 'CZ')
  res.headers.set('x-locale', isSK ? 'sk' : 'cs')
  res.headers.set('x-currency', isSK ? 'EUR' : 'CZK')
  return res
}

export const config = {
  // Run on all routes except Next.js internals and static assets
  matcher: [
    '/((?!_next/static|_next/image|favicon|icon|.*\\.png$|.*\\.ico$|.*\\.svg$|.*\\.webp$).*)',
  ],
}
