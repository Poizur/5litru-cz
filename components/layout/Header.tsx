import Link from 'next/link'

const NAV = [
  { href: '/nejlepsi-olivovy-olej-5l/', label: 'Srovnání' },
  { href: '/motakis-recenze/', label: 'Recenze' },
  { href: '/acidita-olivoveho-oleje/', label: 'Průvodci' },
  { href: '/o-webu/', label: 'O webu' },
] as const

export function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-[60px] items-center justify-between border-b border-[rgba(196,151,62,0.12)] bg-[rgba(20,26,13,0.98)] px-5 backdrop-blur-sm md:px-10">
      <Link
        href="/"
        className="font-serif text-xl font-bold text-[color:var(--color-gold-light)] transition-colors hover:text-[color:var(--color-gold)]"
        aria-label="5litru.cz — domů"
      >
        5litru<span className="font-normal text-[rgba(255,255,255,0.4)]">.cz</span>
      </Link>

      {/* Desktop nav */}
      <nav className="hidden gap-7 md:flex" aria-label="Hlavní navigace">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-sm font-medium tracking-wider text-[rgba(255,255,255,0.55)] transition-colors hover:text-[color:var(--color-gold-light)]"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Mobile CTA — full menu would need client interactivity (Phase 5/6) */}
      <Link
        href="/nejlepsi-olivovy-olej-5l/"
        className="rounded-[2px] bg-[color:var(--color-gold)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[color:var(--color-dark)] transition-colors hover:bg-[color:var(--color-gold-light)] md:hidden"
      >
        Srovnat
      </Link>
    </header>
  )
}
