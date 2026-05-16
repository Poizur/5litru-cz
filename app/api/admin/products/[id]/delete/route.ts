import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) return new NextResponse(null, { status: 401 })
  const { id } = await params

  const { data: product } = await supabaseAdmin
    .from('products')
    .select('status')
    .eq('id', id)
    .single()

  if (!product) return new NextResponse(null, { status: 404 })
  if (product.status !== 'draft') {
    return NextResponse.json({ error: 'Only drafts can be deleted' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('products').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 200 })
}
