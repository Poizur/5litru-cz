// Kontrola, že se ceny / cena za litr / Olivator Score v obsahu dosazují z DB (tokeny lib/content.ts)
// a že v renderovaném HTML nezůstal žádný nenahrazený token ani cena natvrdo.
//
//   npx tsx --env-file=.env.local scripts/check-price-tokens.ts            # homepage, stránky, průvodci, recenze
//   npx tsx --env-file=.env.local scripts/check-price-tokens.ts motakis-recenze homepage   # jen vybrané slugy
//
// Mimo Next.js request nejsou headers() → trh CZ. Nic nezapisuje.

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { getPage, getGuide, getReview, getAllGuideSlugs, getAllPageSlugs, getAllReviewSlugs, type ContentItem } from '../lib/content'
import { supabaseAdmin } from '../lib/supabase'

const TOKEN_LEFT = /<!-- @[A-Z_]+(?::[^ ]*)? -->/g
const LITERAL_PRICE = /\b\d\s?\d{3}\s?Kč\b|\b\d{3}\s?Kč\/l\b|Olivator \d+\/100|skóre \d+\/100/g
// editorial rozsahy / zahraniční srovnání, které tokeny záměrně nenahrazují
const ALLOWED = /\d+[–-]\d+\s?Kč|od 400 Kč\/l|400–600 Kč|méně než 300 Kč|price:\s*'?\d+|"price":\s*\d+/

async function main() {
  const only = process.argv.slice(2)
  type Row = { review_slug: string; price_czk: number | null; olivator_score?: number | null; review_mdx: string | null }
  let res = await supabaseAdmin
    .from('products').select('review_slug, price_czk, olivator_score, review_mdx').eq('status', 'published')
  if (res.error) {
    console.warn('[check] olivator_score sloupec chybí (migrace 20261122 ještě neaplikována) — Score se nekontroluje')
    res = await supabaseAdmin.from('products').select('review_slug, price_czk, review_mdx').eq('status', 'published')
  }
  const expected = new Map(((res.data ?? []) as Row[]).map((p) => [p.review_slug, p]))
  // Surový zdroj (před dosazením tokenů) — v něm nesmí být ceny natvrdo
  const rawSource = (slug: string, kind: string): string => {
    if (kind === 'review') return expected.get(slug)?.review_mdx ?? ''
    for (const dir of ['pages', 'guides']) {
      const f = join(process.cwd(), 'content', dir, `${slug}.mdx`)
      if (existsSync(f)) return readFileSync(f, 'utf8')
    }
    return ''
  }

  const targets: Array<[string, () => Promise<ContentItem | null>]> = []
  const wants = (s: string) => only.length === 0 || only.includes(s)
  if (wants('homepage')) targets.push(['homepage', () => getPage('homepage')])
  for (const s of getAllPageSlugs()) if (wants(s)) targets.push([s, () => getPage(s)])
  for (const s of getAllGuideSlugs()) if (wants(s)) targets.push([s, () => getGuide(s)])
  for (const s of await getAllReviewSlugs()) if (wants(s)) targets.push([s, () => getReview(s)])

  let problems = 0
  for (const [slug, load] of targets) {
    const item = await load()
    if (!item) { console.log(`✗ ${slug}: nenalezeno`); problems++; continue }
    const html = item.body
    const fmJson = JSON.stringify(item.frontmatter)
    const leftover = [...html.matchAll(TOKEN_LEFT), ...fmJson.matchAll(TOKEN_LEFT)].map(m => m[0])
    const raw = rawSource(slug, item.kind)
    const literalLines = raw.split('\n').filter(l => { LITERAL_PRICE.lastIndex = 0; return LITERAL_PRICE.test(l) && !ALLOWED.test(l) && !/^\s*\./.test(l) })
    const prices = [...html.matchAll(/(?:card-price|mini-price|deal-price|t-price|pd-price|oil-card-price|top3-price|buy-bar-price|sidebar-price|compare-item-price|spec-val)"[^>]*>([^<]*Kč)</g)].map(m => m[1])
    const scores = [...html.matchAll(/Olivator (\d+)\/100/g)].map(m => m[1])
    let status = '✓'
    if (leftover.length) { status = '✗'; problems++ }
    if (literalLines.length) { status = '⚠'; }
    console.log(`${status} ${slug}: cen=${prices.length} score=${scores.join(',') || '—'} leftover=${leftover.length} literal=${literalLines.length}`)
    for (const t of leftover.slice(0, 5)) console.log(`    nenahrazený token: ${t}`)
    for (const l of literalLines.slice(0, 5)) console.log(`    cena natvrdo: ${l.trim().slice(0, 120)}`)
    if (item.kind === 'review') {
      const p = expected.get(slug)
      const own = buildOwn(p)
      const buyBar = html.match(/buy-bar-price"[^>]*>([^<]*)</)?.[1]
      if (p && buyBar && buyBar !== own) { console.log(`    ✗ buy-bar ${buyBar} ≠ DB ${own}`); problems++ }
      const score = html.match(/verdict-score">([^<]*)</)?.[1]
      if (p && p.olivator_score != null && score !== String(p.olivator_score)) { console.log(`    ✗ verdict-score ${score} ≠ DB ${p.olivator_score}`); problems++ }
    }
  }
  console.log(problems ? `\n✗ problémů: ${problems}` : '\n✓ vše dosazeno z DB')
  process.exit(problems ? 1 : 0)
}

function buildOwn(p: { price_czk: number | null } | undefined): string {
  if (!p || p.price_czk == null) return '—'
  return Math.round(p.price_czk).toLocaleString('cs-CZ') + ' Kč'
}

main().catch(e => { console.error(e); process.exit(1) })
