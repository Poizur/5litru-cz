import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: '5litru.cz — olivový olej v 5L balení',
    template: '%s | 5litru.cz',
  },
  description:
    'Niche srovnávač olivových olejů v 5litrovém balení. Recenze řeckých olejů, průvodce výběrem, aktuální ceny.',
  metadataBase: new URL('https://5litru.cz'),
  openGraph: {
    type: 'website',
    locale: 'cs_CZ',
    url: 'https://5litru.cz',
    siteName: '5litru.cz',
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=Jost:wght@300;400;500;600&family=DM+Mono:wght@400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Placeholder header — extracted to components/layout/Header in sub-phase B */}
        <header className="fixed inset-x-0 top-0 z-50 flex h-[60px] items-center justify-between border-b border-[rgba(196,151,62,0.12)] bg-[rgba(20,26,13,0.98)] px-10">
          <Link
            href="/"
            className="font-serif text-xl font-bold text-[color:var(--color-gold-light)]"
          >
            5litru<span className="font-normal text-[rgba(255,255,255,0.4)]">.cz</span>
          </Link>
          <nav className="hidden gap-7 md:flex">
            <Link href="/nejlepsi-olivovy-olej-5l/" className="text-sm font-medium tracking-wider text-[rgba(255,255,255,0.55)] transition-colors hover:text-[color:var(--color-gold-light)]">
              Srovnání
            </Link>
            <Link href="/motakis-recenze/" className="text-sm font-medium tracking-wider text-[rgba(255,255,255,0.55)] transition-colors hover:text-[color:var(--color-gold-light)]">
              Recenze
            </Link>
            <Link href="/acidita-olivoveho-oleje/" className="text-sm font-medium tracking-wider text-[rgba(255,255,255,0.55)] transition-colors hover:text-[color:var(--color-gold-light)]">
              Průvodci
            </Link>
            <Link href="/o-webu/" className="text-sm font-medium tracking-wider text-[rgba(255,255,255,0.55)] transition-colors hover:text-[color:var(--color-gold-light)]">
              O webu
            </Link>
          </nav>
        </header>
        <main className="pt-[60px]">{children}</main>
        {/* Placeholder footer — extracted to components/layout/Footer in sub-phase B */}
        <footer className="border-t border-[color:var(--color-border)] bg-[color:var(--color-dark-2)] px-10 py-12 text-[rgba(255,255,255,0.5)]">
          <div className="mx-auto max-w-[1100px] text-center">
            <p className="font-serif text-xl text-[color:var(--color-gold-light)]">5litru.cz</p>
            <p className="mt-2 text-xs">
              © {new Date().getFullYear()} 5litru.cz — Niche srovnávač olivového oleje v 5l balení.
            </p>
            <p className="mt-1 text-[11px] text-[rgba(255,255,255,0.35)]">
              Web obsahuje affiliate odkazy. Při nákupu přes naše odkazy získáme provizi.
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
