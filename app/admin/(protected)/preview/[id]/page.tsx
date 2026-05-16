import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import { PreviewToolbar } from './PreviewToolbar'
import { COLORS } from '../../_components/tokens'

export const dynamic = 'force-dynamic'

interface ProductRow {
  id: string
  slug: string
  review_slug: string | null
  name: string
  status: string
  created_at: string
  updated_at: string
  price_czk: number | null
}

async function loadProduct(id: string): Promise<ProductRow | null> {
  const { data } = await supabaseAdmin
    .from('products')
    .select('id,slug,review_slug,name,status,created_at,updated_at,price_czk')
    .eq('id', id)
    .maybeSingle()
  return (data as ProductRow | null) ?? null
}

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const product = await loadProduct(id)
  if (!product) notFound()

  const backHref = product.status === 'draft' ? '/admin/drafts/' : '/admin/catalog/'
  const backLabel = product.status === 'draft' ? '← Drafts' : '← Katalog'

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: COLORS.surface,
    }}>
      {/* Sticky toolbar */}
      <div style={{
        background: '#FFFFFF',
        borderBottom: `1px solid ${COLORS.border}`,
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        flexShrink: 0,
        zIndex: 10,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          minWidth: 0,
          flex: 1,
        }}>
          <Link href={backHref} style={{
            fontSize: '13px',
            color: COLORS.textMuted,
            textDecoration: 'none',
            padding: '4px 8px',
            borderRadius: '5px',
            flexShrink: 0,
          }}>{backLabel}</Link>

          <div style={{
            height: '18px',
            width: '1px',
            background: COLORS.border,
            flexShrink: 0,
          }} />

          <div style={{
            minWidth: 0,
            display: 'flex',
            alignItems: 'baseline',
            gap: '10px',
          }}>
            <div style={{
              fontSize: '13px',
              fontWeight: 500,
              color: COLORS.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              letterSpacing: '-0.005em',
            }}>{product.name}</div>
            <StatusBadge status={product.status} />
          </div>
        </div>

        <PreviewToolbar
          productId={product.id}
          status={product.status}
          reviewSlug={product.review_slug}
        />
      </div>

      {/* Iframe preview */}
      <div style={{ flex: 1, background: COLORS.surfaceAlt, minHeight: 0 }}>
        <iframe
          src={`/api/admin/products/${product.id}/preview-html`}
          title={`Náhled: ${product.name}`}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            background: '#FFFFFF',
            display: 'block',
          }}
        />
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    draft:     { bg: COLORS.draftBg,     color: COLORS.draft,     label: 'DRAFT' },
    published: { bg: COLORS.publishedBg, color: COLORS.published, label: 'PUBLISHED' },
    archived:  { bg: COLORS.surfaceAlt,  color: COLORS.textSubtle, label: 'ARCHIVED' },
  }
  const s = styles[status] ?? styles.draft
  return (
    <span style={{
      fontSize: '10px',
      fontWeight: 600,
      letterSpacing: '0.05em',
      padding: '2px 6px',
      borderRadius: '4px',
      background: s.bg,
      color: s.color,
      flexShrink: 0,
    }}>{s.label}</span>
  )
}
