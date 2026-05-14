// Converts WordPress pages from data/pages.json into:
//   - content/guides/<slug>.mdx        (17 guides)
//   - content/pages/<slug>.mdx         (5 comparisons + homepage + o-webu = 7)
//   - data/migrated-reviews.json       (10 reviews → consumed by db-import-reviews.ts)
//
// HTML cleanup pipeline:
//   1. Parse with cheerio
//   2. Drop <nav>, <footer>, <link>, <style>, <head>-ish elements
//   3. Pull out <script type="application/ld+json"> blocks into frontmatter.schemas
//   4. Rewrite img src: https://5litru.cz/wp-content/uploads/<path>  →  /images/<path>
//   5. Inject alt text from data/images.json for images that have one
//   6. Turndown → clean markdown
//
// Run: npx tsx scripts/wp-migrate-content.ts

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { load as loadHtml } from 'cheerio'
import TurndownService from 'turndown'
import matter from 'gray-matter'

const ROOT = process.cwd()
const PAGES_JSON = join(ROOT, 'data', 'pages.json')
const IMAGES_JSON = join(ROOT, 'data', 'images.json')
const GUIDES_DIR = join(ROOT, 'content', 'guides')
const PAGES_DIR = join(ROOT, 'content', 'pages')
const REVIEWS_INTERMEDIATE = join(ROOT, 'data', 'migrated-reviews.json')

const COMPARISONS = new Set([
  'nejlepsi-olivovy-olej-5l',
  'recky-olivovy-olej-5l',
  'olivovy-olej-kreta-5l',
  'kalamata-olivovy-olej-5l',
  'olivovy-olej-5l-akce',
])

interface Page {
  id: string
  slug: string
  title: string
  url: string
  date: string
  content_html: string
  word_count: number
  seo: {
    title: string
    description: string
    focus_keyword: string
    og_image_url: string
    og_image_attachment_id: string
    seo_score: string
    rich_snippet: string
  }
  images_in_content: string[]
}

interface ImageRow {
  file_path: string
  public_url: string
  alt_text: string
}

type Category = 'review' | 'guide' | 'comparison' | 'homepage' | 'about'

function categorize(slug: string): Category {
  if (slug === 'homepage') return 'homepage'
  if (slug === 'o-webu') return 'about'
  if (slug.endsWith('-recenze')) return 'review'
  if (COMPARISONS.has(slug)) return 'comparison'
  return 'guide'
}

function buildAltLookup(images: ImageRow[]): Map<string, string> {
  // Map: public_url → alt_text (only non-empty)
  const m = new Map<string, string>()
  for (const img of images) {
    if (img.alt_text && img.alt_text.trim()) {
      m.set(img.public_url, img.alt_text.trim())
    }
  }
  return m
}

function rewriteImgPath(url: string): string {
  // https://5litru.cz/wp-content/uploads/2025/11/foo.jpg  →  /images/2025/11/foo.jpg
  const m = url.match(/^https?:\/\/(?:www\.)?5litru\.cz\/wp-content\/uploads\/(.+)$/i)
  if (m) return `/images/${m[1]}`
  return url
}

function extractSchemas(html: string): { cleanedHtml: string; schemas: unknown[] } {
  const $ = loadHtml(html, { decodeEntities: false })
  const schemas: unknown[] = []
  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).html() ?? ''
    try {
      const trimmed = text.trim()
      if (trimmed) schemas.push(JSON.parse(trimmed))
    } catch {
      // Skip malformed JSON-LD
    }
  })
  // Remove everything we don't want to convert
  $('script, style, link, nav, footer, header').remove()
  return { cleanedHtml: $.html(), schemas }
}

function preprocessImages(html: string, altLookup: Map<string, string>): string {
  const $ = loadHtml(html, { decodeEntities: false })
  $('img').each((_, el) => {
    const $el = $(el)
    const src = $el.attr('src') ?? ''
    const existingAlt = $el.attr('alt') ?? ''
    const newSrc = rewriteImgPath(src)
    $el.attr('src', newSrc)
    if (!existingAlt && altLookup.has(src)) {
      $el.attr('alt', altLookup.get(src)!)
    }
  })
  return $.html()
}

function htmlToMarkdown(html: string): string {
  const td = new TurndownService({
    headingStyle: 'atx',         // # H1 instead of underline
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '_',
  })
  // Preserve <section> as semantic divs in MD (will round-trip via MDX raw HTML)
  td.keep(['section'])
  // Drop empty paragraphs and standalone divs that exist purely for layout
  td.remove(['style', 'script'])
  return td.turndown(html).trim()
}

function buildFrontmatter(p: Page, schemas: unknown[], category: Category): Record<string, unknown> {
  const ogImage = p.seo.og_image_url ? rewriteImgPath(p.seo.og_image_url) : null
  return {
    title: p.title,
    slug: p.slug,
    description: p.seo.description || '',
    focus_keyword: p.seo.focus_keyword || '',
    og_image: ogImage,
    published_at: p.date,
    word_count: p.word_count,
    category,
    seo_score: Number(p.seo.seo_score) || null,
    schemas, // array of JSON-LD objects
  }
}

async function ensureDir(p: string) { await mkdir(p, { recursive: true }) }

async function main() {
  const pagesRaw = await readFile(PAGES_JSON, 'utf8')
  const imagesRaw = await readFile(IMAGES_JSON, 'utf8')
  const pages: Page[] = JSON.parse(pagesRaw)
  const images: ImageRow[] = JSON.parse(imagesRaw)
  const altLookup = buildAltLookup(images)

  await ensureDir(GUIDES_DIR)
  await ensureDir(PAGES_DIR)

  const reviewsOut: Array<{ slug: string; review_slug: string; frontmatter: Record<string, unknown>; mdx: string }> = []
  const counts: Record<Category, number> = { review: 0, guide: 0, comparison: 0, homepage: 0, about: 0 }

  for (const page of pages) {
    const category = categorize(page.slug)
    const { cleanedHtml, schemas } = extractSchemas(page.content_html)
    const withImgPaths = preprocessImages(cleanedHtml, altLookup)
    const md = htmlToMarkdown(withImgPaths)
    const fm = buildFrontmatter(page, schemas, category)
    const mdx = matter.stringify(md, fm)

    if (category === 'review') {
      reviewsOut.push({
        slug: page.slug.replace(/-recenze$/, ''),
        review_slug: page.slug,
        frontmatter: fm,
        mdx,
      })
    } else if (category === 'guide') {
      await writeFile(join(GUIDES_DIR, `${page.slug}.mdx`), mdx, 'utf8')
    } else {
      // comparison | homepage | about → content/pages/
      await writeFile(join(PAGES_DIR, `${page.slug}.mdx`), mdx, 'utf8')
    }
    counts[category]++
  }

  await writeFile(REVIEWS_INTERMEDIATE, JSON.stringify(reviewsOut, null, 2), 'utf8')

  console.log('\nMigration complete:')
  console.log(`  reviews    (→ data/migrated-reviews.json): ${counts.review}`)
  console.log(`  guides     (→ content/guides/*.mdx):       ${counts.guide}`)
  console.log(`  comparisons(→ content/pages/*.mdx):        ${counts.comparison}`)
  console.log(`  homepage   (→ content/pages/homepage.mdx): ${counts.homepage}`)
  console.log(`  about      (→ content/pages/o-webu.mdx):   ${counts.about}`)
  console.log(`  total: ${pages.length}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
