import type { NextConfig } from 'next'

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null

const nextConfig: NextConfig = {
  trailingSlash: true,
  images: {
    minimumCacheTTL: 2592000,
    remotePatterns: [
      ...(supabaseHost
        ? [
            {
              protocol: 'https' as const,
              hostname: supabaseHost,
              pathname: '/storage/v1/object/public/**',
            },
          ]
        : []),
      { protocol: 'https', hostname: '5litru.cz' },
      { protocol: 'https', hostname: 'shop.reckonasbavi.cz' },
      { protocol: 'https', hostname: 'cdn.myshoptet.com' }, // retailer product images CDN
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
}

export default nextConfig
