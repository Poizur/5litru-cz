// Converts WordPress pages from data/pages.json into raw-HTML mirror content.
//
// Output:
//   - content/guides/<slug>.mdx        (17 guides, frontmatter + raw HTML body)
//   - content/pages/<slug>.mdx         (5 comparisons + homepage + o-webu = 7)
//   - data/migrated-reviews.json       (10 reviews → consumed by db-import-reviews.ts)
//
// Strategy (post live-site comparison): the live site uses an Elementor canvas
// template that bakes <nav>, <footer>, inline <style>, and JSON-LD schemas
// directly into the page body. To match 1:1, we preserve all of this and let
// the Next.js page render the body via dangerouslySetInnerHTML — same DOM
// shape as live, same CSS hooks, same brand chrome on every page.
//
// Cleanup pipeline (gentle, fidelity-preserving):
//   1. Strip <link>, <script> tags (CSS loaded centrally; scripts are inert).
//      Exception: <script type="application/ld+json"> captured to frontmatter.
//   2. Strip WordPress block comments (<!-- wp:html -->) — pure markup noise.
//   3. Rewrite img src: https://5litru.cz/wp-content/uploads/<x>  →  /images/<x>
//   4. Inject alt text from data/images.json for images with empty alt.
//   5. Substitute <span data-produkt="X" data-pole="Y">…</span> with OLEJE data.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { load as loadHtml } from 'cheerio'
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

type OlejeRecord = Record<string, Record<string, string>>
const OLEJE: OlejeRecord = JSON.parse(
  readFileSync(join(ROOT, 'data', 'products-runtime.json'), 'utf8'),
)

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
  const m = new Map<string, string>()
  for (const img of images) {
    if (img.alt_text && img.alt_text.trim()) {
      m.set(img.public_url, img.alt_text.trim())
    }
  }
  return m
}

function rewriteImgPath(url: string): string {
  const m = url.match(/^https?:\/\/(?:www\.)?5litru\.cz\/wp-content\/uploads\/(.+)$/i)
  if (m) return `/images/${m[1]}`
  return url
}

function extractSchemas(html: string): { cleanedHtml: string; schemas: unknown[] } {
  const $ = loadHtml(html)
  const schemas: unknown[] = []
  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).html() ?? ''
    try {
      const trimmed = text.trim()
      if (trimmed) schemas.push(JSON.parse(trimmed))
    } catch {
      /* skip malformed */
    }
  })
  // Strip <link> (CSS loaded centrally) and ALL <script> tags (inert in static mirror;
  // JSON-LD already captured to frontmatter and re-emitted by page component).
  $('link').remove()
  $('script').remove()
  return { cleanedHtml: $.html(), schemas }
}

function rewriteImages(html: string, altLookup: Map<string, string>): string {
  const $ = loadHtml(html)
  $('img').each((_, el) => {
    const $el = $(el)
    const src = $el.attr('src') ?? ''
    const newSrc = rewriteImgPath(src)
    $el.attr('src', newSrc)
    const existingAlt = $el.attr('alt') ?? ''
    if (!existingAlt && altLookup.has(src)) {
      $el.attr('alt', altLookup.get(src)!)
    }
  })
  return $.html()
}

function substituteOlejeSpans(html: string): string {
  return html.replace(
    /<span\s+data-produkt="([^"]+)"\s+data-pole="([^"]+)"[^>]*>[^<]*<\/span>/g,
    (match, product, field) => {
      const value = OLEJE[product]?.[field]
      return value !== undefined ? value : match
    },
  )
}

function stripWpBlockComments(html: string): string {
  // Remove <!-- wp:html --> / <!-- /wp:html --> / <!-- wp:paragraph --> markers.
  return html.replace(/<!--\s*\/?wp:[^>]*-->/g, '')
}

function decodeNumericEntityFallback(html: string): string {
  // Cheerio's serializer turns malformed source entities like `&382;` into
  // `&amp;382;`. Recover the intended numeric entity so browsers render ž.
  return html
    .replace(/&amp;#(\d+);/g, '&#$1;')
    .replace(/&amp;#x([0-9a-fA-F]+);/g, '&#x$1;')
    .replace(/&amp;(\d+);/g, '&#$1;')
}

async function ensureDir(p: string) {
  await mkdir(p, { recursive: true })
}

async function main() {
  const pagesRaw = await readFile(PAGES_JSON, 'utf8')
  const imagesRaw = await readFile(IMAGES_JSON, 'utf8')
  const pages: Page[] = JSON.parse(pagesRaw)
  const images: ImageRow[] = JSON.parse(imagesRaw)
  const altLookup = buildAltLookup(images)

  await ensureDir(GUIDES_DIR)
  await ensureDir(PAGES_DIR)

  const reviewsOut: Array<{
    slug: string
    review_slug: string
    frontmatter: Record<string, unknown>
    mdx: string
  }> = []
  const counts: Record<Category, number> = {
    review: 0,
    guide: 0,
    comparison: 0,
    homepage: 0,
    about: 0,
  }

  for (const page of pages) {
    const category = categorize(page.slug)

    // Pipeline: substitute OLEJE → strip wp comments → extract schemas + strip script/link
    //         → rewrite images → recover numeric entities.
    let html = page.content_html
    html = substituteOlejeSpans(html)
    html = stripWpBlockComments(html)
    const { cleanedHtml, schemas } = extractSchemas(html)
    html = rewriteImages(cleanedHtml, altLookup)
    html = decodeNumericEntityFallback(html)

    const ogImage = page.seo.og_image_url ? rewriteImgPath(page.seo.og_image_url) : null

    const fm = {
      title: page.title,
      slug: page.slug,
      description: page.seo.description || '',
      focus_keyword: page.seo.focus_keyword || '',
      og_image: ogImage,
      published_at: page.date,
      word_count: page.word_count,
      category,
      seo_score: Number(page.seo.seo_score) || null,
      schemas,
    }

    const mdx = matter.stringify(html, fm)

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
      await writeFile(join(PAGES_DIR, `${page.slug}.mdx`), mdx, 'utf8')
    }
    counts[category]++
  }

  await writeFile(REVIEWS_INTERMEDIATE, JSON.stringify(reviewsOut, null, 2), 'utf8')

  console.log('\n1:1 mirror migration complete:')
  console.log(`  reviews    (→ data/migrated-reviews.json): ${counts.review}`)
  console.log(`  guides     (→ content/guides/*.mdx):       ${counts.guide}`)
  console.log(`  comparisons(→ content/pages/*.mdx):        ${counts.comparison}`)
  console.log(`  homepage   (→ content/pages/homepage.mdx): ${counts.homepage}`)
  console.log(`  about      (→ content/pages/o-webu.mdx):   ${counts.about}`)
  console.log(`  total: ${pages.length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
