import type { ReactNode } from 'react'

type CalloutType = 'tip' | 'warning' | 'info' | 'success'

const VARIANTS: Record<CalloutType, { icon: string; bg: string; border: string; color: string }> = {
  tip: {
    icon: '💡',
    bg: 'bg-[rgba(196,151,62,0.08)]',
    border: 'border-[rgba(196,151,62,0.3)]',
    color: 'text-[color:var(--color-text)]',
  },
  warning: {
    icon: '⚠️',
    bg: 'bg-[rgba(220,80,40,0.06)]',
    border: 'border-[rgba(220,80,40,0.25)]',
    color: 'text-[color:var(--color-text)]',
  },
  info: {
    icon: 'ℹ️',
    bg: 'bg-[color:var(--color-olive-pale)]',
    border: 'border-[rgba(61,82,32,0.2)]',
    color: 'text-[color:var(--color-text)]',
  },
  success: {
    icon: '✓',
    bg: 'bg-[rgba(90,120,48,0.08)]',
    border: 'border-[rgba(90,120,48,0.25)]',
    color: 'text-[color:var(--color-text)]',
  },
}

interface CalloutProps {
  type?: CalloutType
  title?: string
  children: ReactNode
}

export function Callout({ type = 'tip', title, children }: CalloutProps) {
  const v = VARIANTS[type]
  return (
    <aside
      role="note"
      className={`my-6 flex gap-3 rounded-[2px] border ${v.border} ${v.bg} p-4 md:gap-4 md:p-5 ${v.color}`}
    >
      <span aria-hidden className="shrink-0 text-xl leading-none">
        {v.icon}
      </span>
      <div className="text-sm leading-relaxed [&_p]:my-1">
        {title && (
          <p className="font-semibold uppercase tracking-wider text-[11px] mb-1 text-[color:var(--color-olive)]">
            {title}
          </p>
        )}
        {children}
      </div>
    </aside>
  )
}
