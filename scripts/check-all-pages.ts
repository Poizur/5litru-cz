// Hits all 34 routes locally + verifies HTTP 200 + measures basic
// signals (HTML bytes, has <nav>, has <h1>, has <footer>).
// Run: npx tsx scripts/check-all-pages.ts
//
// Requires `npm run dev` (or preview server) on localhost:3000.

const URLS = [
  '/',
  // 10 reviews
  '/motakis-recenze/',
  '/sitia-premium-gold-recenze/',
  '/neotis-manaki-recenze/',
  '/pallada-kreta-recenze/',
  '/nikolos-kalamata-recenze/',
  '/erato-kalamata-recenze/',
  '/orino-sitia-recenze/',
  '/evoilino-korfu-recenze/',
  '/theoni-kalamata-recenze/',
  '/petromilos-zakynthos-recenze/',
  // 5 comparisons
  '/nejlepsi-olivovy-olej-5l/',
  '/recky-olivovy-olej-5l/',
  '/olivovy-olej-kreta-5l/',
  '/kalamata-olivovy-olej-5l/',
  '/olivovy-olej-5l-akce/',
  // about
  '/o-webu/',
  // 17 guides
  '/acidita-olivoveho-oleje/',
  '/polyfenoly-olivovy-olej/',
  '/pdo-olivovy-olej/',
  '/jak-skladovat-olivovy-olej/',
  '/olivovy-olej-na-smazeni/',
  '/olivovy-olej-na-peceni/',
  '/olivovy-olej-na-salat/',
  '/olivovy-olej-pro-deti/',
  '/bio-olivovy-olej/',
  '/koroneiki-odruda/',
  '/manaki-odruda/',
  '/extra-panensky-olivovy-olej/',
  '/recky-vs-italsky-olivovy-olej/',
  '/olivovy-olej-vs-repkovy/',
  '/sklizen-olivoveho-oleje/',
  '/olivovy-olej-5l-plech/',
  '/farmarske-olivove-oleje/',
]

async function check(url: string) {
  const start = Date.now()
  const res = await fetch(`http://localhost:3000${url}`)
  const html = await res.text()
  const ms = Date.now() - start

  const hasNav = /<nav\b/i.test(html)
  const hasH1 = /<h1\b/i.test(html)
  const hasFooter = /<footer\b/i.test(html)
  const hasLogo = /class=["']nav-logo["']/i.test(html)
  const hasHeroOrSection = /<section\b/i.test(html)
  const hasBadge = /class=["'](?:[^"']*\s)?badge(?:\s|["'])/i.test(html)

  // Count occurrences of empty data-produkt spans (should be 0 — all substituted)
  const emptySpans = (html.match(/<span\s+data-produkt="[^"]+"\s+data-pole="[^"]+"[^>]*><\/span>/g) || []).length

  return {
    url,
    status: res.status,
    bytes: html.length,
    ms,
    nav: hasNav,
    h1: hasH1,
    footer: hasFooter,
    logo: hasLogo,
    section: hasHeroOrSection,
    badge: hasBadge,
    emptyDataSpans: emptySpans,
  }
}

async function main() {
  console.log(`Checking ${URLS.length} URLs against http://localhost:3000\n`)
  const rows = []
  for (const url of URLS) {
    try {
      rows.push(await check(url))
    } catch (e) {
      rows.push({ url, status: 0, error: (e as Error).message })
    }
  }

  // Print table
  console.log(
    'url'.padEnd(38),
    'st',
    'bytes'.padStart(7),
    'ms'.padStart(5),
    'nav h1 ft logo sec bd emptyDP',
  )
  console.log('-'.repeat(95))
  let okCount = 0
  let problems: string[] = []
  for (const r of rows) {
    if ('error' in r) {
      console.log(`${r.url.padEnd(38)} ERR ${r.error}`)
      problems.push(`${r.url}: ${r.error}`)
      continue
    }
    const flags = [r.nav, r.h1, r.footer, r.logo, r.section, r.badge]
      .map((b) => (b ? '✓ ' : '✗ '))
      .join('')
    const emptyMark = r.emptyDataSpans > 0 ? `⚠${r.emptyDataSpans}` : '0'
    console.log(
      r.url.padEnd(38),
      String(r.status).padStart(2),
      String(r.bytes).padStart(7),
      String(r.ms).padStart(5),
      ' ' + flags + ' ' + emptyMark,
    )
    if (r.status !== 200) problems.push(`${r.url} status=${r.status}`)
    if (!r.nav) problems.push(`${r.url} missing <nav>`)
    if (!r.h1) problems.push(`${r.url} missing <h1>`)
    if (!r.footer) problems.push(`${r.url} missing <footer>`)
    if (r.emptyDataSpans > 0) problems.push(`${r.url} has ${r.emptyDataSpans} empty data-produkt spans`)
    if (r.status === 200) okCount++
  }
  console.log('-'.repeat(95))
  console.log(`\n${okCount}/${URLS.length} OK`)
  if (problems.length) {
    console.log(`\n${problems.length} problems:`)
    for (const p of problems) console.log(`  - ${p}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
