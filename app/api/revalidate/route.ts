import { timingSafeEqual } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

// On-demand revalidation. Call after DB changes that affect static pages.
// Usage: POST /api/revalidate/?path=/nejlepsi-olivovy-olej-5l/
//        -H "x-revalidate-secret: $REVALIDATE_SECRET"
// Klíč jen v hlavičce (query string končí v access logu), porovnání v konstantním čase.

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

export async function POST(req: NextRequest) {
  const expected = process.env.REVALIDATE_SECRET
  if (!expected) {
    console.error('[revalidate] REVALIDATE_SECRET not configured')
    return NextResponse.json({ error: 'REVALIDATE_SECRET not configured' }, { status: 503 })
  }
  const given = req.headers.get('x-revalidate-secret') ?? ''
  if (!safeEqual(given, expected)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const path = req.nextUrl.searchParams.get('path') ?? '/'
  revalidatePath(path)
  return NextResponse.json({ revalidated: true, path })
}
