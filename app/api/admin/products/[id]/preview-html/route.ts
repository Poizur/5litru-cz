// GET /api/admin/products/[id]/preview-html
// Returns the raw HTML body of `review_mdx` for the given product, so the
// admin preview page can render it 1:1 inside an iframe.
//
// review_mdx is stored as a full <!DOCTYPE html>...</html> document
// (see lib/ai-review.ts buildReviewHtml). We strip the YAML frontmatter
// front-matter delimiters and serve the body verbatim.

import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'
import matter from 'gray-matter'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('products')
    .select('review_mdx,name')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) {
    return new NextResponse('Not found', { status: 404 })
  }

  const raw = (data.review_mdx as string | null) ?? ''
  if (!raw) {
    return new NextResponse(emptyPlaceholder(data.name as string), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // Strip frontmatter so iframe gets pure HTML document.
  const body = matter(raw).content || raw

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      // Render only inside our own admin — prevents being framed elsewhere.
      'X-Frame-Options': 'SAMEORIGIN',
    },
  })
}

function emptyPlaceholder(name: string): string {
  return `<!DOCTYPE html><html lang="cs"><head><meta charset="utf-8"><title>${name}</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#FAFAFA;color:#71717A;}
.box{text-align:center;padding:40px;}h1{font-size:18px;margin:0 0 8px;color:#18181B;font-weight:500;}p{font-size:13px;margin:0;}</style>
</head><body><div class="box"><h1>Žádný náhled k zobrazení</h1><p>review_mdx je prázdné — vygeneruj recenzi.</p></div></body></html>`
}
