'use client'
import { useRouter } from 'next/navigation'
import { ProductCard, type CardProduct } from '../_components/ProductCard'
import { PageHeader } from '../_components/PageHeader'
import { COLORS } from '../_components/tokens'

interface Props {
  drafts: CardProduct[]
}

export function DraftsClient({ drafts }: Props) {
  const router = useRouter()
  const count = drafts.length

  return (
    <>
      <PageHeader
        title="Drafts"
        subtitle={count === 0
          ? 'Žádné drafty — nové vznikají automaticky po Olivator syncu.'
          : `${count} ${count === 1 ? 'draft čeká' : count < 5 ? 'drafty čekají' : 'draftů čeká'} na review`}
      />

      <div style={{ padding: '24px 32px', maxWidth: '1400px', width: '100%' }}>
        {drafts.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px',
          }}>
            {drafts.map(p => (
              <ProductCard key={p.id} product={p} onChanged={() => router.refresh()} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function EmptyState() {
  return (
    <div style={{
      textAlign: 'center',
      padding: '80px 24px',
      border: `1px dashed ${COLORS.border}`,
      borderRadius: '8px',
      background: COLORS.surface,
    }}>
      <div style={{
        fontSize: '15px',
        color: COLORS.text,
        marginBottom: '6px',
        fontWeight: 500,
      }}>
        Žádné drafty
      </div>
      <div style={{ fontSize: '13px', color: COLORS.textSubtle, lineHeight: 1.5 }}>
        Nové drafty se objeví automaticky, když Olivator najde nový 5L olej.
        <br />
        Můžeš taky vygenerovat draft ručně ze záložky <strong>Návrhy</strong>.
      </div>
    </div>
  )
}
