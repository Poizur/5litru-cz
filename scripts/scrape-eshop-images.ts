// Phase 8B: Scrape product gallery images from reckonasbavi.cz
// Run: npx tsx --env-file=.env.local scripts/scrape-eshop-images.ts
//
// Dry-run by default — pass --save to write to product_images table.
import * as cheerio from 'cheerio'
import { createClient } from '@supabase/supabase-js'

const BASE = 'https://shop.reckonasbavi.cz'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124'

// Map product slug → eshop path. Extend as needed.
const PRODUCTS: Array<{ slug: string; eshopPath: string }> = [
  { slug: 'motakis',     eshopPath: '/motakis-kreta-extra-panensky-olivovy-olej-5l---plech/' },
  { slug: 'erato',       eshopPath: '/erato-kalamata-extra-panensky-olivovy-olej-5l---plech/' },
  { slug: 'sitia',       eshopPath: '/sitia-kreta-premium-gold-0-2--extra-panensky-olivovy-olej-5l---plech/' },
  { slug: 'neotis',      eshopPath: '/neotis-pelopones-extra-panensky-olivovy-olej-0-3--5l---plech/' },
  { slug: 'nikolos',     eshopPath: '/nikolos-kalamata-extra-panensky-olivovy-olej-0-3--5l-plech/' },
  { slug: 'orino',       eshopPath: '/orino-sitia-p-d-o--kreta-extra-panensky-olivovy-olej-5l---plech/' },
  { slug: 'pallada',     eshopPath: '/pallada-kreta-extra-panensky-olivovy-olej-500-ml---plech/' },
  { slug: 'petromilos',  eshopPath: '/petromilos-zakynthos-extra-panensky-olivovy-olej-0-3--5l---plech/' },
  { slug: 'evoilino',    eshopPath: '/evoilino-korfu-extra-panensky-olivovy-olej-5l---plech/' },
  { slug: 'theoni',      eshopPath: '/theoni-kalamata-extra-panensky-olivovy-olej-5l-plech/' },
]

interface ScrapedImage {
  product_slug: string
  url: string
  alt: string
  position: number
  source: 'eshop'
}

async function scrapeProduct(slug: string, path: string): Promise<ScrapedImage[]> {
  const url = BASE + path
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) {
    console.warn(`  ⚠ ${slug}: HTTP ${res.status} for ${url}`)
    return []
  }
  const html = await res.text()
  const $ = cheerio.load(html)

  const images: ScrapedImage[] = []
  // cheerio re-parents the nodes, so query a.cbox-gal globally
  // (related-product cards use data-micro-image, not class="cbox-gal")
  $('a.cbox-gal').each((i, el) => {
    const rawUrl = $(el).attr('href') ?? ''
    const alt = $(el).attr('data-alt') ?? ''
    // Strip query string for stable URL
    const stableUrl = rawUrl.split('?')[0]
    if (stableUrl.includes('cdn.myshoptet.com')) {
      images.push({ product_slug: slug, url: stableUrl, alt, position: i, source: 'eshop' })
    }
  })
  return images
}

async function main() {
  const save = process.argv.includes('--save')
  const slugFilter = process.argv.find(a => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1] && !a.includes('scrape'))

  // Sample mode: first 3 unless --all passed
  const targets = process.argv.includes('--all')
    ? PRODUCTS
    : (slugFilter ? PRODUCTS.filter(p => p.slug === slugFilter) : PRODUCTS.slice(0, 3))

  let sb: ReturnType<typeof createClient> | null = null
  if (save) {
    sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
  }

  let total = 0
  for (const { slug, eshopPath } of targets) {
    console.log(`\n→ ${slug}  ${BASE + eshopPath}`)
    const images = await scrapeProduct(slug, eshopPath)
    if (images.length === 0) {
      console.log('  no images found')
      continue
    }
    for (const img of images) {
      console.log(`  [${img.position}] ${img.alt || '(no alt)'}`)
      console.log(`       ${img.url}`)
    }
    total += images.length

    if (save && sb) {
      const { error } = await sb.from('product_images').upsert(
        images.map(img => ({
          product_slug: img.product_slug,
          url: img.url,
          alt: img.alt,
          position: img.position,
          source: img.source,
        })),
        { onConflict: 'product_slug,url' }
      )
      if (error) console.error(`  ✗ save error: ${error.message}`)
      else console.log(`  ✓ saved ${images.length} rows`)
    }

    // Polite delay
    await new Promise(r => setTimeout(r, 600))
  }

  console.log(`\nTotal: ${total} images found across ${targets.length} products`)
  if (!save) console.log('Dry-run — pass --save to persist to product_images table')
}

main().catch((e) => { console.error(e); process.exit(1) })
