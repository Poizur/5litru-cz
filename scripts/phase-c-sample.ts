// Phase C sample — ukáže výsledky pro 1 guide PŘED hromadným runem.
// Run: npx tsx --env-file=.env.local scripts/phase-c-sample.ts
import * as fs from 'node:fs'
import * as path from 'node:path'
import matter from 'gray-matter'

const KEY = process.env.UNSPLASH_ACCESS_KEY!
const SLUG = 'acidita-olivoveho-oleje'

// Smart queries — ne 1:1 z článku, ale tematicky relevantní fotky
const QUERIES: Array<{ query: string; injectAfterH2: number; seoFilename: string }> = [
  { query: 'extra virgin olive oil pouring golden light bottle',   injectAfterH2: 0, seoFilename: 'extra-panensky-olivovy-olej-lahev' },
  { query: 'olive oil laboratory quality analysis chemistry test', injectAfterH2: 1, seoFilename: 'acidita-olivoveho-oleje-analyza' },
  { query: 'mediterranean olive grove harvest sunlight greece',    injectAfterH2: 2, seoFilename: 'recky-olivovnik-sklizen' },
]

interface UPhoto {
  id: string
  width: number; height: number
  urls: { regular: string; small: string }
  alt_description: string | null
  description: string | null
  user: { name: string; username: string; links: { html: string } }
  links: { html: string }
}

async function searchUnsplash(query: string): Promise<UPhoto | null> {
  const u = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=landscape&per_page=5&order_by=relevant`
  const r = await fetch(u, { headers: { Authorization: `Client-ID ${KEY}` } })
  if (!r.ok) { console.error('Unsplash HTTP', r.status); return null }
  const d = await r.json()
  const photos: UPhoto[] = d.results ?? []
  return photos.find(p => p.width >= 1200) ?? photos[0] ?? null
}

function buildFigureHtml(
  slug: string, filename: string,
  photo: UPhoto, altText: string
): string {
  const src = `/images/guides/${slug}/${filename}.jpg`
  const credit = `<a href="${photo.user.links.html}?utm_source=5litru_cz&utm_medium=referral" target="_blank" rel="noopener">${photo.user.name}</a>`
  return [
    `<figure class="guide-img-figure" style="margin:36px 0 28px;border-radius:6px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">`,
    `  <img src="${src}" alt="${altText}" width="1200" height="800" loading="lazy" decoding="async" style="width:100%;height:auto;display:block;aspect-ratio:3/2;object-fit:cover;">`,
    `  <figcaption style="font-size:12px;color:rgba(0,0,0,0.38);padding:7px 12px;text-align:right;background:#fafafa;border-top:1px solid rgba(0,0,0,0.05);">Foto: ${credit} / <a href="https://unsplash.com?utm_source=5litru_cz&utm_medium=referral" target="_blank" rel="noopener" style="color:inherit;">Unsplash</a></figcaption>`,
    `</figure>`,
  ].join('\n')
}

async function main() {
  if (!KEY) { console.error('UNSPLASH_ACCESS_KEY chybí'); process.exit(1) }

  const mdxPath = path.join(process.cwd(), 'content', 'guides', `${SLUG}.mdx`)
  const raw = fs.readFileSync(mdxPath, 'utf8')
  const { data: fm, content } = matter(raw)

  console.log(`\n╔═══ PHASE C SAMPLE ═══════════════════════════════╗`)
  console.log(`  Guide:    ${SLUG}`)
  console.log(`  Keyword:  ${fm.focus_keyword}`)
  console.log(`╚════════════════════════════════════════════════════╝\n`)

  // Find H2s
  const h2Matches = [...content.matchAll(/<h2 class="content-h2">([^<]+)<\/h2>/g)]
  console.log(`H2 sekce (${h2Matches.length} celkem):`)
  h2Matches.forEach((m, i) => console.log(`  [${i}] ${m[1]}`))

  console.log('\n── Unsplash queries ────────────────────────────────\n')

  const results: Array<{ q: typeof QUERIES[0]; photo: UPhoto; altText: string }> = []

  for (const q of QUERIES) {
    const photo = await searchUnsplash(q.query)
    if (!photo) { console.log(`❌  "${q.query}" → žádný výsledek`); continue }

    const altBase = photo.alt_description ?? photo.description ?? q.query
    // Pro sample: alt text z Unsplash description — full run bude mít Haiku
    const altText = altBase.charAt(0).toUpperCase() + altBase.slice(1)

    const h2label = h2Matches[q.injectAfterH2]?.[1] ?? '(žádná H2)'
    console.log(`Query:    "${q.query}"`)
    console.log(`→ Inject: po H2 [${q.injectAfterH2}] "${h2label}"`)
    console.log(`→ Foto:   ${photo.urls.small}`)
    console.log(`→ Autor:  ${photo.user.name} (${photo.user.links.html})`)
    console.log(`→ Popis:  ${photo.alt_description ?? '(prázdné)'}`)
    console.log(`→ Size:   ${photo.width}×${photo.height}`)
    console.log(`→ URL:    ${photo.links.html}`)
    console.log()

    results.push({ q, photo, altText })
    await new Promise(r => setTimeout(r, 120))
  }

  console.log('── Ukázka HTML injekce ─────────────────────────────\n')
  for (const { q, photo, altText } of results) {
    const h2text = h2Matches[q.injectAfterH2]?.[1] ?? ''
    console.log(`Po H2 [${q.injectAfterH2}]: "${h2text}"`)
    console.log(buildFigureHtml(SLUG, q.seoFilename, photo, altText))
    console.log()
  }

  console.log('── Shrnutí ─────────────────────────────────────────')
  console.log(`Nalezeno: ${results.length} z ${QUERIES.length} queries`)
  console.log('Cena Unsplash API: free tier, 0 Kč')
  console.log('Haiku alt texty (full run): ~$0.001/foto × 3 = ~$0.003')
  console.log('\nPo schválení: npx tsx scripts/phase-c-run.ts --all')
}

main().catch(e => { console.error(e); process.exit(1) })
