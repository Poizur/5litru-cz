export interface RatingBar {
  label: string
  /** 0-5 integer or decimal */
  value: number
}

interface RatingBarsProps {
  items: RatingBar[]
  max?: number
}

/**
 * Horizontal bar chart for sensory profile.
 * Example: <RatingBars items={[{label:'Jemnost chuti', value:4}, {label:'Hořkost', value:2}]} />
 */
export function RatingBars({ items, max = 5 }: RatingBarsProps) {
  if (!items?.length) return null
  return (
    <div className="space-y-3">
      {items.map((r) => {
        const pct = Math.max(0, Math.min(100, (r.value / max) * 100))
        return (
          <div key={r.label}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="text-[color:var(--color-text)]">{r.label}</span>
              <span className="font-mono text-[11px] text-[color:var(--color-muted)]">
                {r.value}/{max}
              </span>
            </div>
            <div
              role="meter"
              aria-valuenow={r.value}
              aria-valuemin={0}
              aria-valuemax={max}
              aria-label={r.label}
              className="h-[6px] overflow-hidden rounded-[1px] bg-[rgba(150,150,150,0.15)]"
            >
              <div
                className="h-full bg-[color:var(--color-gold)]"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
