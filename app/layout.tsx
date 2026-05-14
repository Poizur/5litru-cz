import type { Metadata } from 'next'
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
      <body>{children}</body>
    </html>
  )
}
