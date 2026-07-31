import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Script from 'next/script'
import './globals.css'
import { getMarket } from '@/lib/market'
import { getLocale } from '@/lib/locale'

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

export async function generateMetadata(): Promise<Metadata> {
  const market = await getMarket()
  const locale = getLocale(market)
  const siteUrl = market === 'SK' ? 'https://5litrov.sk' : 'https://5litru.cz'
  return {
    title: {
      default: locale.siteTitle,
      template: `%s | ${locale.siteName}`,
    },
    description: locale.siteDescription,
    metadataBase: new URL(siteUrl),
    icons: {
      icon: [
        { url: '/icon.png', sizes: '192x192', type: 'image/png' },
        { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
    },
    openGraph: {
      type: 'website',
      locale: locale.locale,
      url: siteUrl,
      siteName: locale.siteName,
      images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: `${locale.siteName} — Olivový olej v 5L balení` }],
    },
    twitter: {
      card: 'summary_large_image',
      images: ['/opengraph-image.png'],
    },
    robots: { index: true, follow: true },
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const market = await getMarket()
  const locale = getLocale(market)
  return (
    <html lang={locale.lang}>
      <head>
        {/* Seznam.cz webmaster verification — CZ only (Seznam has no SK presence) */}
        {market === 'CZ' && <meta name="seznam-wmt" content="SedkqqnWTxaxP9ywfQvzV2xUhrQJkDOt" />}
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
          {locale.footerDisclaimer}{' '}
          <a href={locale.footerAboutHref} style={{ color: '#888', textDecoration: 'underline' }}>{locale.footerAboutText}</a>
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
