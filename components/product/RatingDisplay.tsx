interface RatingDisplayProps {
  /** 0–5 numeric rating. Supports decimals (e.g. 4.7). */
  value: number
  count?: number
  /** sm = 14px stars, md = 18px (default), lg = 22px */
  size?: 'sm' | 'md' | 'lg'
  dark?: boolean
}

const SIZES = {
  sm: { star: 14, gap: 1, font: 'text-xs' },
  md: { star: 18, gap: 2, font: 'text-sm' },
  lg: { star: 22, gap: 3, font: 'text-base' },
}

/**
 * Renders "4.9 ★★★★★ 176 recenzí" with partial fill on fractional stars.
 * Uses a single SVG with two layers (filled overlay clipped to %).
 */
export function RatingDisplay({ value, count, size = 'md', dark = false }: RatingDisplayProps) {
  const cfg = SIZES[size]
  const clamped = Math.max(0, Math.min(5, value))
  const pct = (clamped / 5) * 100
  const textColor = dark ? 'text-[rgba(255,255,255,0.8)]' : 'text-[color:var(--color-text)]'
  const mutedColor = dark ? 'text-[rgba(255,255,255,0.45)]' : 'text-[color:var(--color-muted)]'
  const ratingColor = dark ? 'text-[color:var(--color-gold-light)]' : 'text-[color:var(--color-text)]'

  return (
    <div className={`inline-flex items-center gap-2 ${cfg.font}`}>
      <span className={`font-semibold ${ratingColor}`}>{clamped.toFixed(1)}</span>
      <div className="relative inline-flex" style={{ gap: cfg.gap }} aria-label={`Hodnocení ${clamped.toFixed(1)} z 5`}>
        {/* Empty base layer */}
        <Stars filled={false} size={cfg.star} gap={cfg.gap} />
        {/* Gold overlay clipped to percentage */}
        <span
          aria-hidden
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${pct}%` }}
        >
          <Stars filled={true} size={cfg.star} gap={cfg.gap} />
        </span>
      </div>
      {typeof count === 'number' && (
        <span className={`${mutedColor}`}>· {count} {count === 1 ? 'recenze' : count >= 2 && count <= 4 ? 'recenze' : 'recenzí'}</span>
      )}
    </div>
  )
}

function Stars({ filled, size, gap }: { filled: boolean; size: number; gap: number }) {
  const color = filled ? 'var(--color-gold)' : 'rgba(150,150,150,0.3)'
  return (
    <span className="flex" style={{ gap }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={color}
          aria-hidden
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  )
}
