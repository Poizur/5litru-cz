// Unified content loader. Resolves a slug from three sources:
//   1. Reviews — DB `products.review_slug` (status='published')
//   2. Guides — filesystem `content/guides/*.mdx`
//   3. Pages — filesystem `content/pages/*.mdx`
//
// All MDX is parsed once via gray-matter to split frontmatter from body.
// Body is preprocessed (class→className, style→JSX style object) so that
// the migrated HTML-heavy MDX from WordPress compiles cleanly with
// next-mdx-remote/rsc.

import { readFile } from 'node:fs/promises'
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import matter from 'gray-matter'
import { supabaseAdmin } from './supabase'

const GUIDES_DIR = join(process.cwd(), 'content', 'guides')
const PAGES_DIR = join(process.cwd(), 'content', 'pages')

export type ContentKind = 'guide' | 'page' | 'review' | 'homepage'

export interface Frontmatter {
  title?: string
  slug?: string
  description?: string
  focus_keyword?: string
  og_image?: string | null
  published_at?: string
  word_count?: number
  category?: string
  seo_score?: number | null
  schemas?: unknown[]
  [key: string]: unknown
}

export interface ProductRow {
  id: string
  slug: string
  review_slug: string | null
  name: string
  brand: string | null
  origin_country: string
  origin_region: string | null
  variety: string | null
  volume_ml: number
  acidity_pct: number | null
  packaging: string | null
  price_czk: number | null
  rating: number | null
  hero_image: string | null
  status: string
  review_mdx: string | null
  review_frontmatter: Frontmatter | null
  published_at: string | null
}

export interface ContentItem {
  kind: ContentKind
  slug: string
  frontmatter: Frontmatter
  body: string
  product?: ProductRow
}

// ---------- Loaders ----------
//
// Migrated bodies are raw HTML (post wp-migrate-content.ts pipeline) — they
// preserve the live site's <nav>, <footer>, inline <style>, and brand chrome
// on every page. The page component renders this via dangerouslySetInnerHTML,
// so no MDX/JSX preprocessing is needed at load time.

async function readMdxFile(path: string): Promise<{ frontmatter: Frontmatter; body: string } | null> {
  if (!existsSync(path)) return null
  const raw = await readFile(path, 'utf8')
  const { data, content } = matter(raw)
  return { frontmatter: data as Frontmatter, body: content }
}

export async function getGuide(slug: string): Promise<ContentItem | null> {
  const r = await readMdxFile(join(GUIDES_DIR, `${slug}.mdx`))
  return r ? { kind: 'guide', slug, ...r } : null
}

export async function getPage(slug: string): Promise<ContentItem | null> {
  const r = await readMdxFile(join(PAGES_DIR, `${slug}.mdx`))
  if (!r) return null
  const kind: ContentKind = slug === 'homepage' ? 'homepage' : 'page'

  // Server-side injection of dynamic blocks (DB-driven). Currently:
  //   <!-- @DYNAMIC_COMPARISON_TABLE -->  →  comparison-table HTML built
  //                                         from published products
  let body = r.body
  if (body.includes('<!-- @DYNAMIC_COMPARISON_TABLE -->')) {
    const html = await buildDynamicComparisonTable()
    body = body.replace('<!-- @DYNAMIC_COMPARISON_TABLE -->', html)
  }

  return { kind, slug, frontmatter: r.frontmatter, body }
}

export async function getReview(reviewSlug: string): Promise<ContentItem | null> {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('review_slug', reviewSlug)
    .eq('status', 'published')
    .maybeSingle()
  if (error || !data) return null
  const product = data as ProductRow
  const raw = product.review_mdx ?? ''
  const { data: fm, content } = matter(raw)
  return {
    kind: 'review',
    slug: reviewSlug,
    frontmatter: fm as Frontmatter,
    body: content,
    product,
  }
}

// ---------- Slug enumeration (for generateStaticParams) ----------

function listMdxSlugs(dir: string, exclude?: string[]): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => f.replace(/\.mdx$/, ''))
    .filter((s) => !exclude?.includes(s))
}

export function getAllGuideSlugs(): string[] {
  return listMdxSlugs(GUIDES_DIR)
}

export function getAllPageSlugs(): string[] {
  // Exclude homepage — it's served by app/page.tsx, not [slug].
  return listMdxSlugs(PAGES_DIR, ['homepage'])
}

export async function getAllReviewSlugs(): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('review_slug')
    .eq('status', 'published')
    .not('review_slug', 'is', null)
  if (error || !data) return []
  return data.map((r: { review_slug: string | null }) => r.review_slug!).filter(Boolean)
}

export async function getAllPublicSlugs(): Promise<string[]> {
  const [reviews] = await Promise.all([getAllReviewSlugs()])
  return [...getAllGuideSlugs(), ...getAllPageSlugs(), ...reviews]
}

// ---------- Dynamic comparison table (DB-driven) ----------
//
// Renders all published products as <table class="comparison-table">,
// reusing the CSS classes already defined inside the page MDX. Sorted by
// acidity (lowest first → quality marker). Includes a hero thumbnail next
// to the product name; this used to be missing in the legacy static table.

interface ComparisonRow {
  slug: string
  review_slug: string | null
  name: string
  origin_region: string | null
  origin_country: string | null
  acidity_pct: number | null
  price_czk: number | null
  volume_ml: number
  hero_image: string | null
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function formatAcidity(pct: number | null): { value: string; band: 'low' | 'mid' | 'high' } {
  if (pct === null) return { value: '—', band: 'mid' }
  const formatted = `${pct.toFixed(2).replace('.', ',')} %`
  const band = pct <= 0.35 ? 'low' : pct <= 0.5 ? 'mid' : 'high'
  return { value: formatted, band }
}

async function buildDynamicComparisonTable(): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('slug, review_slug, name, origin_region, origin_country, acidity_pct, price_czk, volume_ml, hero_image')
    .eq('status', 'published')
    .order('acidity_pct', { ascending: true, nullsFirst: false })
  if (error || !data || data.length === 0) {
    return '<!-- comparison table: no published products -->'
  }

  const rows = (data as ComparisonRow[]).map((p, i) => {
    const liters = (p.volume_ml ?? 5000) / 1000
    const pricePer = p.price_czk != null ? Math.round(p.price_czk / liters) : null
    const acid = formatAcidity(p.acidity_pct)
    const thumb = p.hero_image
      ? `<img src="${escapeHtml(p.hero_image)}" alt="${escapeHtml(p.name)}" class="t-thumb" loading="lazy" decoding="async">`
      : `<div class="t-thumb" aria-hidden="true"></div>`
    const nameCell = p.review_slug
      ? `<a href="/${p.review_slug}/" style="color:var(--dark);text-decoration:none;">${escapeHtml(p.name)}</a>`
      : escapeHtml(p.name)
    const region = [p.origin_region, p.origin_country].filter(Boolean).join(' · ') || '—'
    const isTopPick = i < 3   // first 3 sorted by acidity get highlighted
    return `<tr${isTopPick ? ' class="top-pick"' : ''}>
            <td>
              <div class="t-product-cell">
                ${thumb}
                <div class="t-product-text">
                  <span class="t-name">${nameCell}</span>
                  <span class="t-region">${escapeHtml(region)}</span>
                </div>
              </div>
            </td>
            <td>${escapeHtml(p.origin_region ?? p.origin_country ?? '—')}</td>
            <td><span class="t-acid acid-${acid.band}">${acid.value}</span></td>
            <td><span class="t-price">${p.price_czk != null ? Math.round(p.price_czk).toLocaleString('cs-CZ') + ' Kč' : '—'}</span></td>
            <td><span class="t-price-per">${pricePer != null ? pricePer + ' Kč/l' : '—'}</span></td>
            <td><a href="/go/${p.slug}" class="btn-table" rel="nofollow sponsored">Koupit →</a></td>
          </tr>`
  }).join('\n')

  return `<div class="comparison-wrap reveal">
      <table class="comparison-table">
        <thead>
          <tr>
            <th>Produkt</th>
            <th>Region</th>
            <th>Acidita</th>
            <th>Cena</th>
            <th>Kč/litr</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
${rows}
        </tbody>
      </table>
    </div>`
}

// Slug resolver — tries DB first (reviews), then filesystem (guides, pages).
// Review slugs end with -recenze so they're unambiguous, but we still try
// each source in turn for safety.
export async function resolveContent(slug: string): Promise<ContentItem | null> {
  const review = await getReview(slug)
  if (review) return review
  const guide = await getGuide(slug)
  if (guide) return guide
  const page = await getPage(slug)
  if (page) return page
  return null
}
