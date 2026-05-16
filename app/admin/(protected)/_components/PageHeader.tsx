import { COLORS } from './tokens'

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle?: string
  right?: React.ReactNode
}) {
  return (
    <header style={{
      borderBottom: `1px solid ${COLORS.border}`,
      padding: '20px 32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      background: '#FFFFFF',
    }}>
      <div>
        <h1 style={{
          fontSize: '18px',
          fontWeight: 600,
          color: COLORS.text,
          letterSpacing: '-0.015em',
          margin: 0,
        }}>{title}</h1>
        {subtitle && (
          <p style={{
            fontSize: '13px',
            color: COLORS.textSubtle,
            margin: '2px 0 0',
          }}>{subtitle}</p>
        )}
      </div>
      {right && <div style={{ display: 'flex', gap: '8px' }}>{right}</div>}
    </header>
  )
}
