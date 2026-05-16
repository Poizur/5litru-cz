// Phase C: Unsplash stock photos pro všech 17 guides.
// Run: npx tsx scripts/phase-c-run.ts [--dry] [--guide=slug]
import * as fs from 'node:fs'
import * as path from 'node:path'

// Load .env.local (tsx --env-file doesn't work when script has extra args)
;(function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
})()
import matter from 'gray-matter'
import sharp from 'sharp'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY!
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!
const GUIDES_DIR = path.join(process.cwd(), 'content', 'guides')
const IMAGES_DIR = path.join(process.cwd(), 'public', 'images', 'guides')

const DRY = process.argv.includes('--dry')
const ONLY = process.argv.find(a => a.startsWith('--guide='))?.split('=')[1]

// ─── Smart Unsplash queries per guide (3 per guide, matched to H2 position) ───
const GUIDE_QUERIES: Record<string, [string, string, string]> = {
  'acidita-olivoveho-oleje': [
    'extra virgin olive oil bottle golden clarity premium',
    'olive oil quality grading test tasting drops',
    'greek olive oil selection bottles premium tin',
  ],
  'bio-olivovy-olej': [
    'organic certification label eco farming sustainable',
    'organic olive grove sustainable small traditional farm',
    'certified organic olive oil green bottle pure',
  ],
  'extra-panensky-olivovy-olej': [
    'extra virgin olive oil pouring golden sunlight drop',
    'cold press olive oil mill traditional stone press',
    'olive oil tasting sensory aroma flavor kitchen',
  ],
  'farmarske-olivove-oleje': [
    'small family farm olive grove traditional landscape',
    'artisan traditional stone olive press mill heritage',
    'handcrafted olive oil rustic bottle farmhouse',
  ],
  'jak-skladovat-olivovy-olej': [
    'olive oil dark glass bottle pantry storage kitchen',
    'pantry dark cool cabinet food storage shelves',
    'olive oil freshness quality preservation shelf life',
  ],
  'koroneiki-odruda': [
    'green olives branch close-up harvest mediterranean',
    'fresh pressed green intense olive oil bottle',
    'crete peloponnese greece olive grove landscape aerial',
  ],
  'manaki-odruda': [
    'greek olive tree branch traditional harvest autumn',
    'mild smooth golden olive oil bottle light',
    'peloponnese greece rolling hills landscape green',
  ],
  'olivovy-olej-5l-plech': [
    'olive oil large tin can container pantry kitchen',
    'food storage metal tin airtight seal quality',
    'family cooking kitchen bulk savings economical food',
  ],
  'olivovy-olej-na-peceni': [
    'baking bread olive oil mediterranean home recipe',
    'butter cake baking healthy fat ingredient bowl',
    'oven fresh bread golden warm mediterranean baking',
  ],
  'olivovy-olej-na-salat': [
    'salad dressing olive oil drizzle pouring fresh green',
    'fresh salad vegetables olive oil drop light',
    'mediterranean greek salad tomato feta olive oil',
  ],
  'olivovy-olej-na-smazeni': [
    'olive oil cooking frying pan hot stove kitchen',
    'cooking heat temperature stove pan sizzle',
    'pan frying vegetables mediterranean method cooking',
  ],
  'olivovy-olej-pro-deti': [
    'healthy baby food pure natural nutrition gentle',
    'child healthy eating fresh food pure ingredients',
    'natural pure mild food children toddler organic',
  ],
  'olivovy-olej-vs-repkovy': [
    'cooking oil bottles comparison selection kitchen',
    'healthy fats omega nutrition food science comparison',
    'olive oil rapeseed oil kitchen comparison cooking',
  ],
  'pdo-olivovy-olej': [
    'european protected origin certification traditional food label',
    'traditional regional european food quality certification',
    'greek traditional authentic certified food label origin',
  ],
  'polyfenoly-olivovy-olej': [
    'antioxidant health benefits food natural olive',
    'healthy mediterranean food nutrition wellness antioxidant',
    'fresh early harvest green olive oil polyphenol',
  ],
  'recky-vs-italsky-olivovy-olej': [
    'greece italy olive oil comparison mediterranean bottles',
    'greek olive grove blue sky landscape crete',
    'mediterranean food market authentic traditional region',
  ],
  'sklizen-olivoveho-oleje': [
    'olive harvest picking nets hands autumn traditional',
    'olive harvesting traditional method seasonal greek',
    'olive mill pressing fresh oil production golden process',
  ],
}

const FALLBACK_QUERIES = [
  'olive oil bottle dark background premium',
  'olive grove mediterranean landscape golden',
  'olives close-up fresh green branch',
]

// ─── Types ───────────────────────────────────────────────────────────────────

interface UPhoto {
  id: string; width: number; height: number
  urls: { full: string; regular: string }
  alt_description: string | null; description: string | null
  user: { name: string; username: string; links: { html: string } }
  links: { html: string; download_location: string }
}

interface GuideResult {
  slug: string
  photos: Array<{
    position: number; h2: string; photo: UPhoto
    localPath: string; altCs: string; query: string; wasFallback: boolean
  }>
  errors: string[]
  haikuInputTokens: number; haikuOutputTokens: number
}

// ─── Unsplash helpers ─────────────────────────────────────────────────────────

async function searchUnsplash(query: string, count = 5): Promise<UPhoto[]> {
  const u = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=landscape&per_page=${count}&order_by=relevant`
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch(u, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } })
    if (r.status === 403 || r.status === 429) {
      if (attempt === 0) {
        console.log(`      ⏳ Unsplash rate limit — čekám 75s…`)
        await new Promise(res => setTimeout(res, 75_000))
        continue
      }
      throw new Error(`Unsplash search HTTP ${r.status}`)
    }
    if (!r.ok) throw new Error(`Unsplash search HTTP ${r.status}`)
    const d = await r.json()
    return (d.results ?? []) as UPhoto[]
  }
  return []
}

async function triggerDownload(downloadLocation: string): Promise<void> {
  await fetch(downloadLocation, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } })
}

// ─── Haiku: pick best photo + generate alt text ───────────────────────────────

const ai = new Anthropic({ apiKey: ANTHROPIC_KEY })

interface HaikuResult {
  pick: number | 'none'; alt: string
  inputTokens: number; outputTokens: number
}

async function haikuPickAndAlt(
  h2heading: string, keyword: string, photos: UPhoto[], isFallback: boolean
): Promise<HaikuResult> {
  const photoList = photos.map((p, i) =>
    `${i + 1}. alt="${p.alt_description ?? ''}" | desc="${p.description ?? ''}" | size=${p.width}×${p.height}`
  ).join('\n')

  const prompt = isFallback
    ? `Section heading: "${h2heading}"
Article keyword: "${keyword}"
These are FALLBACK generic olive oil photos (any is acceptable):
${photoList}

Pick the highest quality landscape photo (best resolution, most professional).
Then write Czech alt text (max 120 chars, storytelling, SEO if possible).

Reply ONLY as JSON: {"pick": 1, "alt": "..."}`
    : `Section heading: "${h2heading}"
Article keyword: "${keyword}"

Candidate Unsplash photos:
${photoList}

1. Pick the photo (1-${photos.length}) most semantically relevant to the section heading.
   Reply "none" if ALL photos are misleading or off-topic for this heading.
2. If you picked one, write Czech alt text (max 120 chars):
   - Evoke the visual
   - Relevant to "${keyword}"
   - Slightly storytelling, not dry
   - Include focus keyword naturally if it fits

Reply ONLY as JSON: {"pick": 1, "alt": "..."} or {"pick": "none"}`

  const msg = await ai.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = (msg.content[0] as { type: string; text: string }).text.trim()
  const inputTokens = msg.usage.input_tokens
  const outputTokens = msg.usage.output_tokens

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch?.[0] ?? text)
    return { pick: parsed.pick, alt: parsed.alt ?? '', inputTokens, outputTokens }
  } catch {
    return { pick: 1, alt: '', inputTokens, outputTokens }
  }
}

// ─── Image download → WebP ────────────────────────────────────────────────────

async function downloadWebP(photo: UPhoto, outPath: string): Promise<void> {
  const url = photo.urls.full + '&w=1200&q=85'
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await sharp(buf).resize(1200).webp({ quality: 82 }).toFile(outPath)
}

// ─── Figure HTML builder ──────────────────────────────────────────────────────

function buildFigure(localPath: string, photo: UPhoto, altCs: string): string {
  const webPath = localPath.replace(path.join(process.cwd(), 'public'), '')
  const authorHref = `${photo.user.links.html}?utm_source=5litru_cz&utm_medium=referral`
  const unsplashHref = `https://unsplash.com?utm_source=5litru_cz&utm_medium=referral`
  return [
    `<figure class="guide-img-figure" style="margin:36px 0 28px;border-radius:6px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">`,
    `  <img src="${webPath}" alt="${altCs.replace(/"/g, '&quot;')}" width="1200" height="800" loading="lazy" decoding="async" style="width:100%;height:auto;display:block;aspect-ratio:3/2;object-fit:cover;">`,
    `  <figcaption style="font-size:12px;color:rgba(0,0,0,0.38);padding:7px 12px;text-align:right;background:#fafafa;border-top:1px solid rgba(0,0,0,0.05);">Foto: <a href="${authorHref}" target="_blank" rel="noopener" style="color:rgba(0,0,0,0.5);">${photo.user.name}</a> / <a href="${unsplashHref}" target="_blank" rel="noopener" style="color:rgba(0,0,0,0.5);">Unsplash</a></figcaption>`,
    `</figure>`,
  ].join('\n')
}

// ─── MDX injection ────────────────────────────────────────────────────────────

// Matches both H2 variants used across guides:
// 1. <h2 class="content-h2">TEXT</h2>
// 2. <h2 class="prose" style="...">TEXT (possibly with <em>)</em></h2>
const H2_RE = /<h2 class="(?:content-h2|prose)"[^>]*>(?:[^<]|<em[^>]*>[^<]*<\/em>)*<\/h2>/g

function extractH2Text(tag: string): string {
  return tag.replace(/<[^>]+>/g, '').trim()
}

function injectFiguresIntoBody(
  body: string,
  injections: Array<{ h2Index: number; figure: string }>
): string {
  let idx = 0
  return body.replace(H2_RE, (match) => {
    const inj = injections.find(i => i.h2Index === idx)
    idx++
    return inj ? match + '\n' + inj.figure : match
  })
}

function countInjected(body: string): number {
  return (body.match(/guide-img-figure/g) ?? []).length
}

// ─── Per-guide processor ──────────────────────────────────────────────────────

async function processGuide(slug: string): Promise<GuideResult> {
  const result: GuideResult = { slug, photos: [], errors: [], haikuInputTokens: 0, haikuOutputTokens: 0 }
  const mdxPath = path.join(GUIDES_DIR, `${slug}.mdx`)

  const raw = fs.readFileSync(mdxPath, 'utf8')
  const { data: fm, content: body } = matter(raw)
  const keyword = String(fm.focus_keyword ?? slug)

  const alreadyCount = countInjected(body)
  if (alreadyCount >= 3) {
    console.log(`  ⚠  ${slug}: 3/3 figur již injektováno — přeskakuji`)
    return result
  }

  // Extract first 3 H2 headings (supports both content-h2 and prose class)
  const h2Matches = [...body.matchAll(H2_RE)].map(m => ({
    fullMatch: m[0], text: extractH2Text(m[0]), index: m.index!
  }))
  const h2s = h2Matches.slice(0, 3).map(m => m.text)
  if (h2s.length === 0) { result.errors.push('no H2 found'); return result }

  const queries = GUIDE_QUERIES[slug]
  if (!queries) { result.errors.push('no query map'); return result }

  const imgDir = path.join(IMAGES_DIR, slug)
  if (!DRY) fs.mkdirSync(imgDir, { recursive: true })

  // Detect which H2 positions already have a figure immediately after them
  const alreadyAtPos = h2Matches.slice(0, 3).map((m) => {
    const afterH2 = body.slice(m.index + m.fullMatch.length, m.index + m.fullMatch.length + 80)
    return afterH2.includes('guide-img-figure')
  })

  const injections: Array<{ h2Index: number; figure: string }> = []

  for (let pos = 0; pos < Math.min(h2s.length, 3); pos++) {
    const h2 = h2s[pos]
    if (alreadyAtPos[pos]) {
      console.log(`  [${pos}] "${h2}" — figura již existuje, přeskakuji`)
      continue
    }
    const query = queries[pos]
    console.log(`  [${pos}] "${h2}"`)
    console.log(`      query: "${query}"`)

    let selectedPhoto: UPhoto | null = null
    let altCs = ''
    let wasFallback = false
    let usedQuery = query

    // Primary search
    try {
      const photos = await searchUnsplash(query)
      if (photos.length > 0) {
        const haiku = await haikuPickAndAlt(h2, keyword, photos, false)
        result.haikuInputTokens += haiku.inputTokens
        result.haikuOutputTokens += haiku.outputTokens

        if (haiku.pick !== 'none' && typeof haiku.pick === 'number') {
          selectedPhoto = photos[haiku.pick - 1] ?? photos[0]
          altCs = haiku.alt
          console.log(`      ✓ Haiku pick: #${haiku.pick} — "${altCs.slice(0, 60)}…"`)
        } else {
          console.log(`      ↩ Haiku: semantically wrong — fallback`)
        }
      }
    } catch (e) {
      result.errors.push(`pos${pos} search: ${e}`)
    }

    // Fallback
    if (!selectedPhoto) {
      wasFallback = true
      const fbQuery = FALLBACK_QUERIES[pos % FALLBACK_QUERIES.length]
      usedQuery = fbQuery
      console.log(`      fallback query: "${fbQuery}"`)
      try {
        const fbPhotos = await searchUnsplash(fbQuery)
        if (fbPhotos.length > 0) {
          const haiku = await haikuPickAndAlt(h2, keyword, fbPhotos, true)
          result.haikuInputTokens += haiku.inputTokens
          result.haikuOutputTokens += haiku.outputTokens
          selectedPhoto = fbPhotos[typeof haiku.pick === 'number' ? haiku.pick - 1 : 0] ?? fbPhotos[0]
          altCs = haiku.alt || `${keyword} — extra panenský olivový olej`
          console.log(`      ✓ fallback pick: "${altCs.slice(0, 60)}…"`)
        }
      } catch (e) {
        result.errors.push(`pos${pos} fallback: ${e}`)
        continue
      }
    }

    if (!selectedPhoto) { result.errors.push(`pos${pos}: no photo`); continue }

    // Download + WebP
    const filename = `${slug}-${pos + 1}.webp`
    const localPath = path.join(imgDir, filename)

    if (!DRY) {
      try {
        await downloadWebP(selectedPhoto, localPath)
        await triggerDownload(selectedPhoto.links.download_location)
        console.log(`      ↓ saved ${filename} (${(fs.statSync(localPath).size / 1024).toFixed(0)} KB)`)
      } catch (e) {
        result.errors.push(`pos${pos} download: ${e}`)
        continue
      }
    } else {
      console.log(`      [DRY] would save ${filename}`)
    }

    injections.push({ h2Index: pos, figure: buildFigure(localPath, selectedPhoto, altCs) })
    result.photos.push({
      position: pos, h2, photo: selectedPhoto,
      localPath, altCs, query: usedQuery, wasFallback,
    })

    await new Promise(r => setTimeout(r, 1500)) // polite delay (Unsplash free tier: 50 req/hr)
  }

  // Inject into MDX
  if (!DRY && injections.length > 0) {
    const newBody = injectFiguresIntoBody(body, injections)
    const newRaw = matter.stringify(newBody, fm)
    fs.writeFileSync(mdxPath, newRaw, 'utf8')
    console.log(`      ✎ MDX updated (${injections.length} figures injected)`)
  }

  return result
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!UNSPLASH_KEY || !ANTHROPIC_KEY) {
    console.error('UNSPLASH_ACCESS_KEY nebo ANTHROPIC_API_KEY chybí'); process.exit(1)
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const slugs = ONLY
    ? [ONLY]
    : Object.keys(GUIDE_QUERIES)

  console.log(`\n╔═══ PHASE C RUN${DRY ? ' [DRY]' : ''} ═══════════════════════════╗`)
  console.log(`  Guides: ${slugs.length}  ·  Target: 3 fotek/guide`)
  console.log(`╚══════════════════════════════════════════════════════╝\n`)

  const results: GuideResult[] = []
  let totalInputTokens = 0, totalOutputTokens = 0

  for (const slug of slugs) {
    console.log(`\n▶ ${slug}`)
    const r = await processGuide(slug)
    results.push(r)
    totalInputTokens += r.haikuInputTokens
    totalOutputTokens += r.haikuOutputTokens

    // Save to DB
    if (!DRY && r.photos.length > 0) {
      for (const p of r.photos) {
        const webPath = p.localPath.replace(path.join(process.cwd(), 'public'), '')
        const { error } = await sb.from('guide_images').upsert({
          guide_slug: slug,
          position: p.position,
          h2_heading: p.h2,
          unsplash_id: p.photo.id,
          local_path: webPath,
          unsplash_url: p.photo.links.html,
          alt_cs: p.altCs,
          photographer: p.photo.user.name,
          photographer_url: p.photo.user.links.html,
          query_used: p.query,
          was_fallback: p.wasFallback,
        }, { onConflict: 'guide_slug,position' })
        if (error) console.error(`  ✗ DB save: ${error.message}`)
      }
    }
  }

  // ─── Final report ────────────────────────────────────────────────────────────
  console.log('\n\n╔═══ VÝSLEDKY ══════════════════════════════════════════╗\n')

  let totalOk = 0, totalFailed = 0, fallbackGuides: string[] = []

  for (const r of results) {
    const ok = r.photos.length
    const fail = (Math.min(3, Object.keys(GUIDE_QUERIES[r.slug] ?? {}).length || 3)) - ok
    totalOk += ok; totalFailed += fail
    const hasFallback = r.photos.some(p => p.wasFallback)
    if (hasFallback) fallbackGuides.push(r.slug)

    const status = fail === 0 ? '✓' : fail === 3 ? '✗' : '⚠'
    console.log(`  ${status} ${r.slug}: ${ok}/3 OK${hasFallback ? ' [fallback]' : ''}${r.errors.length ? ` — ${r.errors[0]}` : ''}`)
  }

  const haikuCost = (totalInputTokens / 1_000_000 * 0.80) + (totalOutputTokens / 1_000_000 * 4.00)

  console.log(`\n── Souhrn ──────────────────────────────────────────────`)
  console.log(`  Celkem fotek: ${totalOk} úspěšných, ${totalFailed} selhalo`)
  console.log(`  Fallback guides (${fallbackGuides.length}): ${fallbackGuides.join(', ') || 'žádné'}`)
  console.log(`  Haiku tokeny: ${totalInputTokens.toLocaleString()} in + ${totalOutputTokens.toLocaleString()} out`)
  console.log(`  Haiku cena: $${haikuCost.toFixed(4)}`)
  console.log(`  Unsplash API: free tier — $0`)
  console.log(`╚═══════════════════════════════════════════════════════╝\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
