import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: '5litru.cz — olivový olej v 5L balení',
    template: '%s | 5litru.cz',
  },
  description:
    'Niche srovnávač olivových olejů v 5litrovém balení. Recenze řeckých olejů, průvodce výběrem, aktuální ceny.',
  metadataBase: new URL('https://5litru.cz'),
  icons: {
    icon: [
      { url: '/icon.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    locale: 'cs_CZ',
    url: 'https://5litru.cz',
    siteName: '5litru.cz',
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: '5litru.cz — Olivový olej v 5L balení' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/opengraph-image.png'],
  },
  robots: { index: true, follow: true },
}

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <head>
        <meta name="seznam-wmt" content="SedkqqnWTxaxP9ywfQvzV2xUhrQJkDOt" />
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
        {children}
        <footer style={{ textAlign: 'center', padding: '24px 16px', fontSize: '12px', color: '#888', borderTop: '1px solid #eee', marginTop: '48px' }}>
          Tento web používá affiliate odkazy. Pokud zakoupíte produkt přes odkaz na 5litru.cz, může web obdržet provizi bez jakýchkoli dalších nákladů pro vás.{' '}
          <a href="/o-webu/" style={{ color: '#888', textDecoration: 'underline' }}>Více o nás</a>
        </footer>
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}', { anonymize_ip: true });`}
            </Script>
          </>
        )}
      </body>
    </html>
  )
}
