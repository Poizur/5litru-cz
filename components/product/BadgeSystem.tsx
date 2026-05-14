import type { ProductRow } from '@/lib/content'

interface Badge {
  icon: string
  label: string
  variant?: 'gold' | 'default'
}

export function computeBadges(p: Pick<ProductRow, 'rating' | 'acidity_pct' | 'packaging' | 'volume_ml' | 'origin_country'>): Badge[] {
  const badges: Badge[] = []
  if (p.rating !== null && p.rating !== undefined && p.rating >= 4.7) {
    badges.push({ icon: '⭐', label: 'Nejprodávanější', variant: 'gold' })
  }
  if (p.acidity_pct !== null && p.acidity_pct !== undefined && p.acidity_pct <= 0.8) {
    badges.push({ icon: '⚗️', label: `Acidita ≤ ${p.acidity_pct.toFixed(1)} %` })
  } else if (p.acidity_pct === null) {
    badges.push({ icon: '⚗️', label: 'Acidita ≤ 0,8 %' })
  }
  if (p.packaging === 'plech' && p.volume_ml === 5000) {
    badges.push({ icon: '🫙', label: 'Plech 5 l' })
  }
  if (p.origin_country === 'Řecko') {
    badges.push({ icon: '🇬🇷', label: 'Řecký původ' })
  }
  return badges
}

interface BadgeListProps {
  badges: Badge[]
  /** Use dark-theme styling (white text on dark bg). Default: light theme (cream bg). */
  dark?: boolean
}

export function BadgeList({ badges, dark = false }: BadgeListProps) {
  if (!badges.length) return null
  const base = 'inline-flex items-center gap-1.5 rounded-[2px] border px-3 py-1 text-xs font-medium'
  const lightDefault = 'border-[color:var(--color-border)] bg-white text-[color:var(--color-text)]'
  const lightGold = 'border-[rgba(196,151,62,0.3)] bg-[rgba(196,151,62,0.12)] text-[color:var(--color-olive)]'
  const darkDefault = 'border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.07)] text-[rgba(255,255,255,0.8)]'
  const darkGold = 'border-[rgba(196,151,62,0.3)] bg-[rgba(196,151,62,0.15)] text-[color:var(--color-gold-light)]'

  return (
    <ul className="flex flex-wrap gap-2">
      {badges.map((b, i) => {
        const variant = b.variant === 'gold'
          ? (dark ? darkGold : lightGold)
          : (dark ? darkDefault : lightDefault)
        return (
          <li key={`${b.label}-${i}`} className={`${base} ${variant}`}>
            <span aria-hidden>{b.icon}</span>
            <span>{b.label}</span>
          </li>
        )
      })}
    </ul>
  )
}
