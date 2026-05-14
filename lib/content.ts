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
  return { kind, slug, ...r }
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
