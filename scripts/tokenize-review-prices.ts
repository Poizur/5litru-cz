// Jednorázová oprava review_mdx v DB (22. 11. 2026): ceny a Olivator Score natvrdo → tokeny z DB
// (lib/content.ts: @PRODUCT_PRICE / @PRODUCT_PER / @PRODUCT_SCORE / @PRICE_CMP / @PRICE_DIFF).
//
//   npx tsx --env-file=.env.local scripts/tokenize-review-prices.ts            # dry-run (jen kontrola)
//   npx tsx --env-file=.env.local scripts/tokenize-review-prices.ts --apply    # záloha + zápis
//
// Záloha původních review_mdx: ~/Projekty/olivator-reporty/2026-11-22-001-zalohy/review-mdx-ceny-score.json

import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { supabaseAdmin } from '../lib/supabase'

const APPLY = process.argv.includes('--apply')
const DUMP = process.argv.find(a => a.startsWith('--dump='))?.slice('--dump='.length) ?? null
const BACKUP_DIR = join(homedir(), 'Projekty', 'olivator-reporty', '2026-11-22-001-zalohy')
const BACKUP_FILE = join(BACKUP_DIR, 'review-mdx-ceny-score.json')

const P = (s: string) => `<!-- @PRODUCT_PRICE:${s} -->`
const PER = (s: string) => `<!-- @PRODUCT_PER:${s} -->`
const SCORE = (s: string) => `<!-- @PRODUCT_SCORE:${s} -->`
const CMP = (a: string, b: string) => `<!-- @PRICE_CMP:${a}:${b} -->`
const DIFF = (a: string, b: string) => `<!-- @PRICE_DIFF:${a}:${b} -->`

const MOT = 'motakis-recenze', SIT = 'sitia-premium-gold-recenze', NEO = 'neotis-manaki-recenze', NIK = 'nikolos-kalamata-recenze'
const ERA = 'erato-kalamata-recenze', THE = 'theoni-kalamata-recenze', ORI = 'orino-sitia-recenze', PAL = 'pallada-kreta-recenze'
const PET = 'petromilos-zakynthos-recenze', EVO = 'evoilino-korfu-recenze'
const C03 = 'corinto-pelopones-olivovy-olej-manaki-0-3-recenze', C04 = 'corinto-pelopones-extra-panensky-manaki-0-4-recenze'
const STY = 'styliana-amazona-extra-panensky-arbequina-0-2-recenze'

type Rep = [old: string, neu: string, count?: number]

// Explicitní náhrady vět — každá musí být nalezena přesně `count`× (výchozí 1)
const EXPLICIT: Record<string, Rep[]> = {
  [ERA]: [
    ['Nikolos vyjde na 1 690 Kč.', `Nikolos vyjde na ${P(NIK)}.`],
    ['je nejlevnější kalamata olej v nabídce za 1 390 Kč,', `je nejlevnější kalamata olej v nabídce za ${P(THE)},`],
    ['Erato je o 159 Kč dražší, ale', `Erato je ${CMP(ERA, THE)}, ale`],
    ['Cena 2 090 Kč je o 541 Kč více.', `Cena ${P(NEO)} — Neotis je ${CMP(NEO, ERA)} než Erato.`],
  ],
  [EVO]: [
    ['Cena 420 Kč/l je nejvyšší v nabídce — přímo odráží', `Cena ${PER(EVO)} patří k nejvyšším v nabídce — přímo odráží`],
    ['<li>Nejvyšší cena v nabídce — 420 Kč/l</li>', `<li>Jedna z nejvyšších cen v nabídce — ${PER(EVO)}</li>`],
    ['vzhledem k ceně 420 Kč/l se pro', `vzhledem k ceně ${PER(EVO)} se pro`],
    ['Neotis</a> za 2 090 Kč má aciditu', `Neotis</a> za ${P(NEO)} má aciditu`],
    ['Evoilino za 2 099 Kč přináší', `Evoilino za ${P(EVO)} přináší`],
    ['Motakis</a> za 1 290 Kč vs. Evoilino za 2 099 Kč — to je 800 Kč za 5 litrů.', `Motakis</a> za ${P(MOT)} vs. Evoilino za ${P(EVO)} — to je ${DIFF(EVO, MOT)} za 5 litrů.`],
    ['Výsledná cena 420 Kč/l přímo odráží', `Výsledná cena ${PER(EVO)} přímo odráží`],
    ['ale cena 420 Kč/l je pro každodenní', `ale cena ${PER(EVO)} je pro každodenní`],
  ],
  [MOT]: [
    ['Cena Motakis Kréta 5l je přibližně 1 290 Kč, tedy 258 Kč za litr.', `Cena Motakis Kréta 5l je přibližně ${P(MOT)}, tedy ${PER(MOT)}.`],
    ['<li>Nejnižší cena v nabídce — 258 Kč/l</li>', `<li>Nejnižší cena v nabídce — ${PER(MOT)}</li>`],
    ['Cena je o 300 Kč vyšší — 1 590 Kč.', `Cena je ${CMP(SIT, MOT)} — ${P(SIT)}.`],
    ['Cena 2 090 Kč je o 800 Kč více.', `Cena ${P(NEO)} — Neotis je ${CMP(NEO, MOT)}.`],
  ],
  [NEO]: [
    ['Cena Neotis Manaki 5l je přibližně 2 090 Kč, tedy 418 Kč za litr.\n            Jde o nejvyšší cenu v naší nabídce, odpovídající',
      `Cena Neotis Manaki 5l je přibližně ${P(NEO)}, tedy ${PER(NEO)}.\n            Jde o jednu z nejvyšších cen v naší nabídce, odpovídající`],
    ['SITIA Gold stojí 1 590 Kč, Neotis Manaki 2 090 Kč. Volba', `SITIA Gold stojí ${P(SIT)}, Neotis Manaki ${P(NEO)}. Volba`],
    ['Je to také nejdražší olej v nabídce — 2 090 Kč tj. 418 Kč/l — a tato cena', `Patří také k nejdražším olejům v nabídce — ${P(NEO)} tj. ${PER(NEO)} — a tato cena`],
    ['<li>Nejvyšší cena v nabídce — 418 Kč/l</li>', `<li>Jedna z nejvyšších cen v nabídce — ${PER(NEO)}</li>`],
    ['Motakis</a> za 1 290 Kč tj. 258 Kč/l je výrazný', `Motakis</a> za ${P(MOT)} tj. ${PER(MOT)} je výrazný`],
    ['Neotis za 2 090 Kč tj. 418 Kč/l je jemný', `Neotis za ${P(NEO)} tj. ${PER(NEO)} je jemný`],
    ['SITIA Gold</a> stojí 1 590 Kč, Neotis 2 090 Kč. Volba závisí čistě na chuťové preferenci', `SITIA Gold</a> stojí ${P(SIT)}, Neotis ${P(NEO)}. Volba závisí čistě na chuťové preferenci`, 2],
    ['Evoilino Korfu</a> za 2 099 Kč je také', `Evoilino Korfu</a> za ${P(EVO)} je také`],
    ['Motakis</a> za 1 290 Kč, Neotis nechte', `Motakis</a> za ${P(MOT)}, Neotis nechte`],
  ],
  [NIK]: [
    ['Cena: 1 690 Kč vs. <a href="/motakis-recenze/">Motakis</a> 1 290 Kč.', `Cena: ${P(NIK)} vs. <a href="/motakis-recenze/">Motakis</a> ${P(MOT)}.`],
    ['Erato je o něco levnější za 1 549 Kč.', `Erato je ${CMP(ERA, NIK)} — ${P(ERA)}.`],
    ['Cena 2 090 Kč. Nikolos vs.', `Cena ${P(NEO)}. Nikolos vs.`],
  ],
  [ORI]: [
    ['Sitia Lassithi a mají identickou cenu (1 590 Kč).', `Sitia Lassithi (SITIA Gold ${P(SIT)}, Orino ${P(ORI)}).`],
    ['Motakis</a> je o 300 Kč levnější (1 290 Kč) a má', `Motakis</a> je ${CMP(MOT, ORI)} (${P(MOT)}) a má`],
    ['Neotis</a> (2 090 Kč) je chuťová', `Neotis</a> (${P(NEO)}) je chuťová`],
  ],
  [PAL]: [
    ['Cena Pallada Kréta 5l je přibližně 1 549 Kč, tedy 310 Kč za litr.', `Cena Pallada Kréta 5l je přibližně ${P(PAL)}, tedy ${PER(PAL)}.`],
    ['Pallada je o 259 Kč dražší za\n            5l.', `Pallada je ${CMP(PAL, MOT)} za\n            5l.`],
    ['<li>Dobrý poměr cena / objem — 310 Kč/l</li>', `<li>Dobrý poměr cena / objem — ${PER(PAL)}</li>`],
    ['<td style="font-weight:600;">1 549 Kč</td>\n                <td style="font-size:13px;color:var(--muted);">310 Kč/l</td>',
      `<td style="font-weight:600;">${P(PAL)}</td>\n                <td style="font-size:13px;color:var(--muted);">${PER(PAL)}</td>`],
    ['<td style="font-weight:600;">1 290 Kč</td>\n                <td style="font-size:13px;color:var(--muted);">258 Kč/l</td>',
      `<td style="font-weight:600;">${P(MOT)}</td>\n                <td style="font-size:13px;color:var(--muted);">${PER(MOT)}</td>`],
    // dva řádky 1 590 Kč: první SITIA Gold, druhý Orino (pořadí v tabulce)
    ['<span class="ct-name">SITIA Gold 0,2 %</span><br><span style="font-size:11px;color:var(--muted);">nejnižší acidita</span></td>\n                <td style="font-size:13px;">Sitia Lassithi</td>\n                <td><span class="ct-acid-low">0,26 %</span></td>\n                <td style="font-weight:600;">1 590 Kč</td>\n                <td style="font-size:13px;color:var(--muted);">318 Kč/l</td>',
      `<span class="ct-name">SITIA Gold 0,2 %</span><br><span style="font-size:11px;color:var(--muted);">nejnižší acidita</span></td>\n                <td style="font-size:13px;">Sitia Lassithi</td>\n                <td><span class="ct-acid-low">0,26 %</span></td>\n                <td style="font-weight:600;">${P(SIT)}</td>\n                <td style="font-size:13px;color:var(--muted);">${PER(SIT)}</td>`],
    ['<td style="font-weight:600;">1 590 Kč</td>\n                <td style="font-size:13px;color:var(--muted);">318 Kč/l</td>',
      `<td style="font-weight:600;">${P(ORI)}</td>\n                <td style="font-size:13px;color:var(--muted);">${PER(ORI)}</td>`],
    ['Pallada je za 1 549 Kč vs. <a href="/motakis-recenze/">Motakis</a> za 1 290 Kč — tedy o 259 Kč dražší.',
      `Pallada je za ${P(PAL)} vs. <a href="/motakis-recenze/">Motakis</a> za ${P(MOT)} — tedy ${CMP(PAL, MOT)}.`],
    ['Cena 1 590 Kč vs. 1 549 Kč u Pallady.', `Cena ${P(SIT)} vs. ${P(PAL)} u Pallady.`],
    ['Motakis</a> je za 1 290 Kč, Pallada za 1 549 Kč.', `Motakis</a> je za ${P(MOT)}, Pallada za ${P(PAL)}.`],
  ],
  [PET]: [
    ['Cena 2 099 Kč je o více než 600 Kč vyšší.', `Cena ${P(EVO)} — Evoilino je ${CMP(EVO, PET)}.`],
    ['je nejprodávanější olej za 1 290 Kč —', `je nejprodávanější olej za ${P(MOT)} —`],
  ],
  [SIT]: [
    ['je přibližně\n            1 590 Kč, tedy 318 Kč za litr.', `je přibližně\n            ${P(SIT)}, tedy ${PER(SIT)}.`],
    ['za nižší cenu (1 290 Kč vs. 1 590 Kč).', `za nižší cenu (${P(MOT)} vs. ${P(SIT)}).`],
    ['<li>Vyšší cena — 318 Kč/l vs. 258 Kč/l u Motakis</li>', `<li>Vyšší cena — ${PER(SIT)} vs. ${PER(MOT)} u Motakis</li>`],
    ['a cenou 1 290 Kč, tj. 258 Kč/l. SITIA Gold má aciditu 0,26 % a stojí 1 590 Kč, tj. 318 Kč/l. Rozdíl 300 Kč za 5 litrů.',
      `a cenou ${P(MOT)}, tj. ${PER(MOT)}. SITIA Gold má aciditu 0,26 % a stojí ${P(SIT)}, tj. ${PER(SIT)}. Rozdíl ${DIFF(SIT, MOT)} za 5 litrů.`],
    ['za stejnou cenu 1 590 Kč.', `za ${P(ORI)}.`],
    ['nulová hořkost, cena 2 090 Kč.', `nulová hořkost, cena ${P(NEO)}.`],
    ['SITIA Gold je správná volba za 1 590 Kč.', `SITIA Gold je správná volba za ${P(SIT)}.`],
    ['Motakis Kréta</a> za 1 290 Kč, SITIA Gold nechte', `Motakis Kréta</a> za ${P(MOT)}, SITIA Gold nechte`],
  ],
  [THE]: [
    ['je s cenou 1 390 Kč (278 Kč/l) nejdostupnější', `je s cenou ${P(THE)} (${PER(THE)}) nejdostupnější`],
    ['<div class="verdict-score">1 390 Kč</div>', `<div class="verdict-score">${P(THE)}</div>`],
    ['<li>Nejlevnější kalamata olej v nabídce — 278 Kč/l</li>', `<li>Nejlevnější kalamata olej v nabídce — ${PER(THE)}</li>`],
    ['Nikolos</a> za 1 690 Kč je o 300 Kč dražší a přináší', `Nikolos</a> za ${P(NIK)} je ${CMP(NIK, THE)} a přináší`],
    ['Theoni za 1 390 Kč je o 100 Kč dražší než <a href="/motakis-recenze/">Motakis</a> za 1 290 Kč.',
      `Theoni za ${P(THE)} je ${CMP(THE, MOT)} než <a href="/motakis-recenze/">Motakis</a> za ${P(MOT)}.`],
    ['je s cenou 1 390 Kč, tj. 278 Kč/l, nejdostupnější', `je s cenou ${P(THE)}, tj. ${PER(THE)}, nejdostupnější`],
    ['Nikolos</a> je o přibližně 300 Kč dražší.', `Nikolos</a> je přibližně ${CMP(NIK, THE)}.`],
  ],
  [C03]: [
    // Olivátor má pro tento olej Score 82 (ne 55) — věty vykládající „průměr“ jsou nepravdivé, jdou pryč
    ['<li>Olivator skóre 55/100 naznačuje průměrnou kvalitu</li>', ''],
    ['V segmentu pětilitrových extra panenských olejů se CORINTO Peloponés pohybuje ve střední úrovni. Olivator skóre 55/100 naznačuje, že jde o řádný produkt bez závažných vad, ale zároveň bez výjimečných kvalit. Pro srovnání:',
      `V segmentu pětilitrových extra panenských olejů má CORINTO Peloponés Olivator skóre ${SCORE(C03)}/100. Pro srovnání:`],
    [' CORINTO sedí přesně uprostřed — solidní řecký olej, který nesklame, ale ani nevynikne.</p>', '</p>'],
    ['Na druhé straně chybějící údaj o polyfenolech, absence BIO certifikace a Olivator skóre 55/100 jasně ukazují, že nejde o prémiový produkt.',
      'Na druhé straně chybějící údaj o polyfenolech a absence BIO certifikace ukazují, že nejde o prémiový produkt.'],
  ],
  [C04]: [
    ['Cena kolem 400 Kč/litr je u BIO olejů férová', `Cena ${PER(C04)} je u BIO olejů férová`],
    ['Cena 1990 Kč (asi 398 Kč/litr) řadí CORINTO', `Cena ${P(C04)} (asi ${PER(C04)}) řadí CORINTO`],
  ],
  [STY]: [
    ['<li>Olivator skóre 81/100 je solidní, nikoliv špičkové</li>', `<li>Olivator skóre ${SCORE(STY)}/100 je solidní, nikoliv špičkové</li>`],
    ['Olivator skóre 81/100 řadí produkt do kategorie velmi dobrých olejů', `Olivator skóre ${SCORE(STY)}/100 řadí produkt do kategorie velmi dobrých olejů`],
  ],
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Obecné transformace (všechny recenze)
function generic(mdx: string, own: string, log: string[]): string {
  const before = mdx
  const count = (re: RegExp) => (before.match(re) ?? []).length
  // 1. sidebar-price s cenou natvrdo (i s atributem style=…)
  mdx = mdx.replace(/<div class="sidebar-price"([^>]*)>\s*[\d\s ]+Kč\s*<\/div>/g, `<div class="sidebar-price"$1>${P(own)}</div>`)
  // 2. buy-bar: holé tokeny z dřívější opravy zpět do stylovaných divů
  const ownP = escapeRe(P(own)), ownPer = escapeRe(PER(own))
  mdx = mdx.replace(
    new RegExp(`(<div class="buy-bar-inner">(?:(?!<\\/div>\\s*<\\/div>)[\\s\\S])*?<div style="display:flex;align-items:baseline;gap:10px;">\\s*)${ownP}(\\s*)${ownPer}`),
    `$1<div class="buy-bar-price">${P(own)}</div>$2<div class="buy-bar-per">${PER(own)} · ověřte aktuální cenu</div>`,
  )
  // 3. sidebar: holý @PRODUCT_PER za sidebar-price divem
  mdx = mdx.replace(new RegExp(`(<div class="sidebar-price"[^>]*>[^\\n]*<\\/div>\\s*)${ownPer}`), `$1<div class="sidebar-price-per">${PER(own)}</div>`)
  // 4. sidebar v AI recenzích: holé PRICE + PER před sidebar-price-note
  mdx = mdx.replace(
    new RegExp(`${ownP}(\\s*)${ownPer}(\\s*<div class="sidebar-price-note">)`),
    `<div class="sidebar-price">${P(own)}</div>$1<div class="sidebar-price-per">${PER(own)}</div>$2`,
  )
  // 5. compare-item ceny podle odkazu položky
  mdx = mdx.replace(
    /(<a href="\/([a-z0-9-]+)\/" class="compare-item">(?:(?!<\/a>)[\s\S])*?<div class="compare-item-price">)[^<]*?Kč(<\/div>)/g,
    (_m, pre: string, slug: string, post: string) => `${pre}${P(slug)}${post}`,
  )
  // 6. Olivator Score natvrdo (AI recenze)
  mdx = mdx.replace(/<span class="badge badge-gold">Olivator \d+\/100<\/span>/g, `<!-- @PRODUCT_SCORE_BADGE:${own} -->`)
  mdx = mdx.replace(/<div class="verdict-score">\d+<\/div>/g, `<div class="verdict-score">${SCORE(own)}</div>`)
  log.push(`generic: sidebar-price=${count(/<div class="sidebar-price"[^>]*>\s*[\d\s ]+Kč/g)} compare=${count(/compare-item-price">[^<]*Kč/g)} score-badge=${count(/Olivator \d+\/100<\/span>/g)} verdict=${count(/verdict-score">\d+</g)}`)
  return mdx
}

function countOccurrences(hay: string, needle: string): number {
  if (!needle) return 0
  let n = 0, i = 0
  while ((i = hay.indexOf(needle, i)) !== -1) { n++; i += needle.length }
  return n
}

async function main() {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('id, slug, review_slug, review_mdx')
    .eq('status', 'published')
    .not('review_slug', 'is', null)
  if (error || !data) throw new Error(`read: ${error?.message}`)

  const results: Array<{ id: string; slug: string; review_slug: string; mdx: string }> = []
  let problems = 0
  for (const row of data as Array<{ id: string; slug: string; review_slug: string; review_mdx: string | null }>) {
    const own = row.review_slug
    let mdx = row.review_mdx ?? ''
    const log: string[] = []
    mdx = generic(mdx, own, log)
    for (const [old, neu, cnt = 1] of EXPLICIT[own] ?? []) {
      const found = countOccurrences(mdx, old)
      if (found === 0 && (neu === '' || countOccurrences(mdx, neu) >= cnt)) continue // už aplikováno (opakovaný běh)
      if (found !== cnt) {
        problems++
        log.push(`  CHYBA očekáváno ${cnt}×, nalezeno ${found}×: "${old.slice(0, 70).replace(/\n/g, '⏎')}"`)
        continue
      }
      mdx = mdx.split(old).join(neu)
    }
    const remaining = mdx.split('\n')
      .map((l, i) => [i + 1, l] as const)
      .filter(([, l]) => /\d\s?\d{3}\s?Kč|\d{3}\s?Kč\/l|Olivator \d+\/100|skóre \d+\/100/.test(l) && !/^\s*price:|priceCurrency|^\.|\{.*\}/.test(l))
    console.log(`\n## ${own}  (${row.review_mdx === mdx ? 'beze změny' : 'ZMĚNA'})`)
    for (const l of log) console.log('  ' + l)
    for (const [n, l] of remaining) console.log(`  zbývá ř.${n}: ${l.trim().slice(0, 140)}`)
    results.push({ id: row.id, slug: row.slug, review_slug: own, mdx })
    if (DUMP === own) { console.log('----- DUMP ' + own + ' -----'); console.log(mdx); console.log('----- END DUMP -----') }
  }

  if (problems) {
    console.error(`\n✗ ${problems} problémů — nic nezapsáno`)
    process.exit(1)
  }
  if (!APPLY) {
    console.log('\n(dry-run) spusť s --apply pro zálohu + zápis')
    return
  }

  mkdirSync(BACKUP_DIR, { recursive: true })
  let backupFile = BACKUP_FILE
  for (let n = 2; existsSync(backupFile); n++) backupFile = BACKUP_FILE.replace(/\.json$/, `-${n}.json`)
  writeFileSync(backupFile, JSON.stringify(
    (data as Array<{ id: string; slug: string; review_slug: string; review_mdx: string | null }>)
      .map(r => ({ id: r.id, slug: r.slug, review_slug: r.review_slug, review_mdx: r.review_mdx })),
    null, 2,
  ))
  console.log(`\n✓ záloha: ${backupFile}`)

  let written = 0
  for (const r of results) {
    const orig = (data as Array<{ id: string; review_mdx: string | null }>).find(d => d.id === r.id)?.review_mdx ?? ''
    if (orig === r.mdx) continue
    const { error: upErr } = await supabaseAdmin.from('products').update({ review_mdx: r.mdx }).eq('id', r.id)
    if (upErr) { console.error(`✗ ${r.slug}: ${upErr.message}`); process.exitCode = 1; continue }
    written++
    console.log(`✓ zapsáno ${r.slug}`)
  }
  console.log(`\nhotovo: ${written} recenzí aktualizováno`)
}

main().catch(e => { console.error(e); process.exit(1) })
