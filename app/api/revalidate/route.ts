import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

// On-demand revalidation. Call after DB changes that affect static pages.
// Usage: POST /api/revalidate?path=/nejlepsi-olivovy-olej-5l&secret=ADMIN_SECRET_KEY
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.ADMIN_SECRET_KEY) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const path = req.nextUrl.searchParams.get('path') ?? '/'
  revalidatePath(path)
  return NextResponse.json({ revalidated: true, path })
}
