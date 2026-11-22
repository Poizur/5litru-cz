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
import { cache } from 'react'
import { supabaseAdmin } from './supabase'
import { getMarket, type Market } from './market'
import { getLocale } from './locale'

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
  price_eur?: number | null
  olivator_score?: number | null
  rating: number | null
  hero_image: string | null
  status: string
  available?: boolean | null
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
  if (!r) return null
  const market = await getMarket()
  const body = await applyProductTokens(r.body, market)
  const frontmatter = await applyTokensToFrontmatter(r.frontmatter, market)
  return { kind: 'guide', slug, frontmatter, body }
}

export async function getPage(slug: string): Promise<ContentItem | null> {
  const r = await readMdxFile(join(PAGES_DIR, `${slug}.mdx`))
  if (!r) return null
  const kind: ContentKind = slug === 'homepage' ? 'homepage' : 'page'
  const market = await getMarket()

  let body = r.body

  if (body.includes('<!-- @DYNAMIC_COMPARISON_TABLE -->')) {
    const html = await buildDynamicComparisonTable(market)
    body = body.replace('<!-- @DYNAMIC_COMPARISON_TABLE -->', html)
  }

  body = await applyProductTokens(body, market)
  const frontmatter = await applyTokensToFrontmatter(r.frontmatter, market)

  return { kind, slug, frontmatter, body }
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
  const market = await getMarket()
  const body = await applyProductTokens(content, market)
  const frontmatter = await applyTokensToFrontmatter(fm as Frontmatter, market)
  return {
    kind: 'review',
    slug: reviewSlug,
    frontmatter,
    body,
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

// ---------- Shared types for product card rendering ----------

interface Top3ProductRow {
  slug: string
  review_slug: string | null
  name: string
  origin_region: string | null
  acidity_pct: number | null
  price_czk: number | null
  price_eur: number | null        // null before DDL or for products without SK pricing (e.g. styliana)
  volume_ml: number
  hero_image: string | null
  available: boolean | null       // null = column not yet migrated, treat as true
  product_url_sk: string | null   // null before DDL or for products without a SK page
  olivator_score: number | null   // synced from Olivátor (null before DDL or when Olivátor has no Score)
}

interface ComparisonRow extends Top3ProductRow {
  origin_country: string | null
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

// Market-aware price formatting
function buildPriceInfo(
  p: Pick<Top3ProductRow, 'price_czk' | 'price_eur' | 'volume_ml'>,
  market: Market,
) {
  const liters = (p.volume_ml ?? 5000) / 1000
  if (market === 'SK' && p.price_eur != null) {
    const perL = p.price_eur / liters
    return {
      priceFormatted: `${p.price_eur.toFixed(2).replace('.', ',')} €`,
      perFormatted: `${perL.toFixed(2).replace('.', ',')} €/l`,
      perWithSize: `${perL.toFixed(2).replace('.', ',')} €/l · plech 5l`,
    }
  }
  const pricePer = p.price_czk != null ? Math.round(p.price_czk / liters) : null
  return {
    priceFormatted: p.price_czk != null ? Math.round(p.price_czk).toLocaleString('cs-CZ') + ' Kč' : '—',
    perFormatted: pricePer != null ? pricePer + ' Kč/l' : '—',
    perWithSize: pricePer != null ? `${pricePer} Kč/l · plech 5l` : 'plech 5l',
  }
}

// Číselná cena použitá pro min/max a rozdíly: EUR jen na SK trhu a jen když je vyplněná, jinak CZK.
function priceNumber(p: Pick<Top3ProductRow, 'price_czk' | 'price_eur'>, market: Market): { value: number; eur: boolean } | null {
  if (market === 'SK' && p.price_eur != null) return { value: p.price_eur, eur: true }
  if (p.price_czk != null) return { value: p.price_czk, eur: false }
  return null
}

function formatAmount(value: number, eur: boolean): string {
  return eur ? `${value.toFixed(2).replace('.', ',')} €` : `${Math.round(value).toLocaleString('cs-CZ')} Kč`
}

// ---------- Per-product card injection (used by @PRODUCT_* tokens) ----------

function buildProductImgHtml(p: Top3ProductRow): string {
  if (!p.hero_image) return ''
  return `<img class="pd-img" src="${escapeHtml(p.hero_image)}" alt="${escapeHtml(p.name)}" loading="lazy" decoding="async">`
}

function buildProductSpecsHtml(p: Top3ProductRow, market: Market): string {
  const acid = formatAcidity(p.acidity_pct)
  const { priceFormatted, perFormatted } = buildPriceInfo(p, market)
  const locale = getLocale(market)
  return `<div class="product-detail-specs">
      <div class="spec-item">
        <div class="spec-val acid-${acid.band}">${acid.value}</div>
        <div class="spec-key">Acidita</div>
      </div>
      <div class="spec-item">
        <div class="spec-val">${priceFormatted}</div>
        <div class="spec-key">${escapeHtml(locale.priceLabel)}</div>
      </div>
      <div class="spec-item">
        <div class="spec-val">${perFormatted}</div>
        <div class="spec-key">${escapeHtml(locale.perLabel)}</div>
      </div>
    </div>`
}

function buildProductFooterHtml(p: Top3ProductRow, market: Market): string {
  const isAvailable = p.available !== false
  const { priceFormatted, perWithSize } = buildPriceInfo(p, market)
  const locale = getLocale(market)
  const reviewHref = p.review_slug ? `/${p.review_slug}/` : `/${p.slug}/`
  const ctaHtml = isAvailable
    ? `<a href="/go/${escapeHtml(p.slug)}/" class="btn-buy-big" rel="nofollow sponsored">${escapeHtml(locale.buyAt)}</a>`
    : `<span class="badge-sold-out">${escapeHtml(locale.soldOut)}</span>`
  return `<div class="pd-footer">
      <div class="pd-price-wrap">
        <div class="pd-price">${priceFormatted}</div>
        <div class="pd-price-per">${perWithSize}</div>
      </div>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <a href="${escapeHtml(reviewHref)}" class="btn-detail">${escapeHtml(locale.fullReview)}</a>
        ${ctaHtml}
      </div>
    </div>`
}

function buildProductAvailabilityHtml(p: Top3ProductRow, market: Market): string {
  const isAvailable = p.available !== false
  const locale = getLocale(market)
  if (isAvailable) {
    return `<a href="/go/${escapeHtml(p.slug)}/" class="btn-buy" rel="nofollow sponsored">${escapeHtml(locale.buy)}</a>`
  }
  return `<span class="badge-sold-out">${escapeHtml(locale.soldOut)}</span>`
}

function buildProductScoreBadgeHtml(p: Top3ProductRow): string {
  if (p.olivator_score == null) return ''
  return `<span class="badge badge-gold">Olivator ${p.olivator_score}/100</span>`
}

// ---------- Tokeny s hodnotami z DB ----------
//
// Každá cena, cena za litr a Olivator Score v obsahu (MDX v content/, review_mdx v DB,
// frontmatter včetně JSON-LD) se bere z tabulky products přes tyto tokeny — nikdy natvrdo.
//
//   <!-- @PRODUCT_PRICE:review-slug -->        1 290 Kč                (text)
//   <!-- @PRODUCT_PER:review-slug -->          258 Kč/l                (text)
//   <!-- @PRODUCT_SCORE:review-slug -->        68  nebo —              (text)
//   <!-- @PRODUCT_SCORE_BADGE:review-slug -->  <span class="badge badge-gold">Olivator 68/100</span>
//   <!-- @PRODUCT_IMG|SPECS|FOOTER|AVAILABILITY:review-slug -->  HTML bloky karet
//   <!-- @PRICE_MIN --> / <!-- @PRICE_MAX -->  nejnižší/nejvyšší cena ze všech publikovaných olejů
//   <!-- @PRICE_MIN:slug-a,slug-b -->          totéž jen z vyjmenovaných olejů (skupina, region)
//   <!-- @PER_MIN --> / <!-- @PER_MAX --> / <!-- @PER_MIN:slug-a,slug-b -->   cena za litr
//   <!-- @PRICE_CMP:slug-a:slug-b -->          „o 300 Kč dražší“ / „o 300 Kč levnější“ / „za stejnou cenu“ (A vůči B)
//   <!-- @PRICE_DIFF:slug-a:slug-b -->         „300 Kč“ (absolutní rozdíl)
//
// Min/max berou přednostně oleje skladem (available !== false); když žádný není, všechny.
// Textové tokeny se aplikují i na frontmatter (title, description, schemas → JSON-LD).

const TOKEN_RE = /<!-- @(PRODUCT_(?:IMG|SPECS|FOOTER|PRICE|PER|AVAILABILITY|SCORE_BADGE|SCORE):[a-z0-9-]+|PRICE_(?:MIN|MAX)(?::[a-z0-9,-]+)?|PER_(?:MIN|MAX)(?::[a-z0-9,-]+)?|PRICE_(?:CMP|DIFF):[a-z0-9-]+:[a-z0-9-]+) -->/g
const HTML_TOKEN_KINDS = new Set(['PRODUCT_IMG', 'PRODUCT_SPECS', 'PRODUCT_FOOTER', 'PRODUCT_AVAILABILITY', 'PRODUCT_SCORE_BADGE'])

export interface ApplyTokensOptions {
  /** Admin náhled: dosadit i hodnoty rozpracovaných (draft) produktů. */
  includeDrafts?: boolean
  /** Jen textové tokeny (frontmatter / JSON) — HTML tokeny zůstanou nedotčené. */
  textOnly?: boolean
}

export function hasProductTokens(s: string): boolean {
  TOKEN_RE.lastIndex = 0
  return TOKEN_RE.test(s)
}

async function fetchTokenProducts(includeDrafts: boolean): Promise<Top3ProductRow[]> {
  const statuses = includeDrafts ? ['published', 'draft'] : ['published']
  // Plný výběr; když sloupce z novějších migrací (price_eur, product_url_sk, olivator_score) chybí, nouzový výběr
  const resFull = await supabaseAdmin
    .from('products')
    .select('slug, review_slug, name, origin_region, acidity_pct, price_czk, price_eur, product_url_sk, volume_ml, hero_image, available, olivator_score')
    .in('status', statuses)
    .not('review_slug', 'is', null)
  if (!resFull.error) return (resFull.data ?? []) as Top3ProductRow[]
  console.warn('[content] token products full fetch failed, using fallback columns:', resFull.error.message)
  const resFallback = await supabaseAdmin
    .from('products')
    .select('slug, review_slug, name, origin_region, acidity_pct, price_czk, volume_ml, hero_image, available')
    .in('status', statuses)
    .not('review_slug', 'is', null)
  return ((resFallback.data ?? []) as Array<Omit<Top3ProductRow, 'price_eur' | 'product_url_sk' | 'olivator_score'>>).map(p => ({
    ...p, price_eur: null, product_url_sk: null, olivator_score: null,
  }))
}

// Jeden dotaz na request (React cache) — homepage i recenze volají tokeny z generateMetadata i z page.
const fetchTokenProductsCached = cache(fetchTokenProducts)

function pickRows(all: Top3ProductRow[], bySlug: Map<string, Top3ProductRow>, arg: string | undefined): Top3ProductRow[] {
  if (!arg) return all
  return arg.split(',').map(s => bySlug.get(s)).filter((p): p is Top3ProductRow => !!p)
}

// Nejlevnější / nejdražší olej z množiny: přednost mají oleje skladem.
function extremeRow(rows: Top3ProductRow[], market: Market, perLiter: boolean, max: boolean): Top3ProductRow | null {
  const metric = (p: Top3ProductRow) => {
    const n = priceNumber(p, market)
    if (!n) return null
    return perLiter ? n.value / ((p.volume_ml ?? 5000) / 1000) : n.value
  }
  const pick = (candidates: Top3ProductRow[]) => {
    let best: Top3ProductRow | null = null
    let bestVal = 0
    for (const p of candidates) {
      const v = metric(p)
      if (v == null) continue
      if (best === null || (max ? v > bestVal : v < bestVal)) { best = p; bestVal = v }
    }
    return best
  }
  return pick(rows.filter(p => p.available !== false)) ?? pick(rows)
}

function priceCompareText(a: Top3ProductRow | undefined, b: Top3ProductRow | undefined, market: Market, diffOnly: boolean): string {
  const na = a ? priceNumber(a, market) : null
  const nb = b ? priceNumber(b, market) : null
  if (!na || !nb) return '—'
  // Srovnávej ve stejné měně: když má jen jeden EUR, spadni na CZK
  const eur = na.eur && nb.eur
  const va = eur ? na.value : a!.price_czk
  const vb = eur ? nb.value : b!.price_czk
  if (va == null || vb == null) return '—'
  const diff = va - vb
  const formatted = formatAmount(Math.abs(diff), eur)
  if (diffOnly) return formatted
  const locale = getLocale(market)
  if (Math.abs(diff) < 0.5) return locale.priceSame
  return diff > 0 ? locale.priceMoreExpensive(formatted) : locale.priceCheaper(formatted)
}

function renderToken(
  token: string,
  all: Top3ProductRow[],
  bySlug: Map<string, Top3ProductRow>,
  market: Market,
  textOnly: boolean,
): string | null {
  const sep = token.indexOf(':')
  const kind = sep === -1 ? token : token.slice(0, sep)
  const arg = sep === -1 ? undefined : token.slice(sep + 1)
  if (textOnly && HTML_TOKEN_KINDS.has(kind)) return null

  switch (kind) {
    case 'PRODUCT_PRICE': { const p = bySlug.get(arg!); return p ? buildPriceInfo(p, market).priceFormatted : '—' }
    case 'PRODUCT_PER': { const p = bySlug.get(arg!); return p ? buildPriceInfo(p, market).perFormatted : '—' }
    case 'PRODUCT_SCORE': { const p = bySlug.get(arg!); return p?.olivator_score != null ? String(p.olivator_score) : '—' }
    case 'PRODUCT_SCORE_BADGE': { const p = bySlug.get(arg!); return p ? buildProductScoreBadgeHtml(p) : '' }
    case 'PRODUCT_IMG': { const p = bySlug.get(arg!); return p ? buildProductImgHtml(p) : '' }
    case 'PRODUCT_SPECS': { const p = bySlug.get(arg!); return p ? buildProductSpecsHtml(p, market) : '' }
    case 'PRODUCT_FOOTER': { const p = bySlug.get(arg!); return p ? buildProductFooterHtml(p, market) : '' }
    case 'PRODUCT_AVAILABILITY': { const p = bySlug.get(arg!); return p ? buildProductAvailabilityHtml(p, market) : '' }
    case 'PRICE_MIN':
    case 'PRICE_MAX': {
      const p = extremeRow(pickRows(all, bySlug, arg), market, false, kind === 'PRICE_MAX')
      return p ? buildPriceInfo(p, market).priceFormatted : '—'
    }
    case 'PER_MIN':
    case 'PER_MAX': {
      const p = extremeRow(pickRows(all, bySlug, arg), market, true, kind === 'PER_MAX')
      return p ? buildPriceInfo(p, market).perFormatted : '—'
    }
    case 'PRICE_CMP':
    case 'PRICE_DIFF': {
      const [a, b] = (arg ?? '').split(':')
      return priceCompareText(bySlug.get(a), bySlug.get(b), market, kind === 'PRICE_DIFF')
    }
    default:
      return null
  }
}

export async function applyProductTokens(body: string, market: Market = 'CZ', opts: ApplyTokensOptions = {}): Promise<string> {
  if (!hasProductTokens(body)) return body
  const all = await fetchTokenProductsCached(opts.includeDrafts === true)
  const bySlug = new Map(all.filter(p => p.review_slug).map(p => [p.review_slug!, p]))
  return body.replace(TOKEN_RE, (match, token: string) => renderToken(token, all, bySlug, market, opts.textOnly === true) ?? match)
}

// Textové tokeny ve frontmatteru (title, description, schemas/JSON-LD). Nahrazuje se v JSON
// serializaci — textové tokeny neobsahují uvozovky ani zpětná lomítka, JSON zůstane validní.
async function applyTokensToFrontmatter(fm: Frontmatter, market: Market, opts: ApplyTokensOptions = {}): Promise<Frontmatter> {
  const json = JSON.stringify(fm)
  if (!hasProductTokens(json)) return fm
  const replaced = await applyProductTokens(json, market, { ...opts, textOnly: true })
  try {
    return JSON.parse(replaced) as Frontmatter
  } catch (e) {
    console.warn('[content] frontmatter tokens: JSON parse failed, keeping raw frontmatter:', (e as Error).message)
    return fm
  }
}

// ---------- Dynamic comparison table (DB-driven) ----------
//
// Renders all published products as <table class="comparison-table">,
// reusing the CSS classes already defined inside the page MDX. Sorted by
// acidity (lowest first → quality marker). Includes a hero thumbnail next
// to the product name; this used to be missing in the legacy static table.

async function buildDynamicComparisonTable(market: Market = 'CZ'): Promise<string> {
  const locale = getLocale(market)
  let data: ComparisonRow[] | null = null

  // Try with SK columns; fall back if DDL not yet applied
  const resFull = await supabaseAdmin
    .from('products')
    .select('slug, review_slug, name, origin_region, origin_country, acidity_pct, price_czk, price_eur, product_url_sk, volume_ml, hero_image, available')
    .eq('status', 'published')
    .order('acidity_pct', { ascending: true, nullsFirst: false })
  if (!resFull.error && resFull.data && resFull.data.length > 0) {
    data = (resFull.data as Array<Omit<ComparisonRow, 'olivator_score'>>).map(p => ({ ...p, olivator_score: null }))
  } else {
    console.log('[content] comparison-table full fetch:', resFull.error?.message ?? 'empty result')
    const resFallback = await supabaseAdmin
      .from('products')
      .select('slug, review_slug, name, origin_region, origin_country, acidity_pct, price_czk, volume_ml, hero_image, available')
      .eq('status', 'published')
      .order('acidity_pct', { ascending: true, nullsFirst: false })
    if (!resFallback.error && resFallback.data && resFallback.data.length > 0) {
      data = (resFallback.data as Array<Omit<ComparisonRow, 'price_eur' | 'product_url_sk' | 'olivator_score'>>).map(p => ({
        ...p, price_eur: null, product_url_sk: null, olivator_score: null,
      }))
    }
  }

  if (!data || data.length === 0) {
    return '<!-- comparison table: no published products -->'
  }

  // Available products first, then sold-out; within each group keep acidity order
  const sorted = [
    ...data.filter(p => p.available !== false),
    ...data.filter(p => p.available === false),
  ]

  const rows = sorted.map((p, i) => {
    const isAvailable = p.available !== false
    const acid = formatAcidity(p.acidity_pct)
    const { priceFormatted, perFormatted } = buildPriceInfo(p, market)
    const thumb = p.hero_image
      ? `<img src="${escapeHtml(p.hero_image)}" alt="${escapeHtml(p.name)}" class="t-thumb" loading="lazy" decoding="async">`
      : `<div class="t-thumb" aria-hidden="true"></div>`
    const nameCell = p.review_slug
      ? `<a href="/${p.review_slug}/" style="color:var(--dark);text-decoration:none;">${escapeHtml(p.name)}</a>`
      : escapeHtml(p.name)
    const region = [p.origin_region, p.origin_country].filter(Boolean).join(' · ') || '—'
    const isTopPick = isAvailable && i < 3
    const ctaCell = isAvailable
      ? `<a href="/go/${escapeHtml(p.slug)}/" class="btn-table" rel="nofollow sponsored">${escapeHtml(locale.buy)}</a>`
      : `<span class="badge-sold-out">${escapeHtml(locale.soldOut)}</span>`
    return `<tr${isTopPick ? ' class="top-pick"' : ''}${!isAvailable ? ' class="row-sold-out"' : ''}>
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
            <td><span class="t-price">${priceFormatted}</span></td>
            <td><span class="t-price-per">${perFormatted}</span></td>
            <td>${ctaCell}</td>
          </tr>`
  }).join('\n')

  return `<div class="comparison-wrap reveal">
      <table class="comparison-table">
        <thead>
          <tr>
            <th>${locale.tableHeadProduct}</th>
            <th>${locale.tableHeadRegion}</th>
            <th>${locale.tableHeadAcidity}</th>
            <th>${locale.tableHeadPrice}</th>
            <th>${locale.tableHeadPerLiter}</th>
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
