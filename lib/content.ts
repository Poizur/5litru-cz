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

// ---------- MDX preprocessing ----------

// Converts inline `style="display:flex;color:red"` strings to JSX-compatible
// object literals: `style={{display:'flex',color:'red'}}`.
// Handles camelCase conversion of CSS property names.
function styleStringToObjectLiteral(styleStr: string): string {
  const props = styleStr
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((decl) => {
      const idx = decl.indexOf(':')
      if (idx === -1) return null
      const prop = decl.slice(0, idx).trim()
      const value = decl.slice(idx + 1).trim()
      const camel = prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
      // Quote the value as a string (avoids issues with `0.5`, `1px`, etc.)
      const safeValue = value.replace(/'/g, "\\'")
      return `'${camel}':'${safeValue}'`
    })
    .filter(Boolean)
  return `{{${props.join(',')}}}`
}

export function preprocessMdx(raw: string): string {
  let s = raw
  // class="..." → className="..."  (only on HTML element tags, not in attribute values)
  s = s.replace(/(<[a-zA-Z][^>]*?)\sclass=/g, '$1 className=')
  // for="..." → htmlFor="..."  (form labels — rare but possible)
  s = s.replace(/(<[a-zA-Z][^>]*?)\sfor=/g, '$1 htmlFor=')
  // style="…" → style={{…}}
  s = s.replace(/\sstyle="([^"]*)"/g, (_match, css: string) => ` style=${styleStringToObjectLiteral(css)}`)
  // Self-close void elements that MDX/JSX requires closed
  s = s.replace(/<(br|hr|img|input|meta|link)([^>]*?)(?<!\/)>/gi, '<$1$2 />')
  // Standalone curly braces in legacy text would be parsed as JSX expressions by MDX.
  // Defensive: escape lone `{` and `}` that appear in text content.
  // We deliberately don't process this — MDX is generally tolerant, and our migrated
  // content from turndown is curl-free.
  return s
}

// ---------- Loaders ----------

async function readMdxFile(path: string): Promise<{ frontmatter: Frontmatter; body: string } | null> {
  if (!existsSync(path)) return null
  const raw = await readFile(path, 'utf8')
  const { data, content } = matter(raw)
  return { frontmatter: data as Frontmatter, body: preprocessMdx(content) }
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
    body: preprocessMdx(content),
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
