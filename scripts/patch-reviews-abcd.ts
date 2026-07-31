/**
 * Dávky A+B+C+D — patch všech 13 produktových recenzí v Supabase DB.
 *
 * A) nikolos-kalamata: oprava title + description (copy-paste chyba)
 * B) evoilino: odstranit "zaručeně"; erato+petromilos: odstraní rok 2024/25
 * C) descriptions > 160 zn zkrátit
 * D) hardcoded price divy → @PRODUCT_PRICE/@PRODUCT_PER tokeny
 */

import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── helpers ────────────────────────────────────────────────────────────────

function tokenizeReview(mdx: string, reviewSlug: string): string {
  // buy-bar-price
  mdx = mdx.replace(
    /<div class="buy-bar-price">[^<]*<\/div>/g,
    `<!-- @PRODUCT_PRICE:${reviewSlug} -->`
  )
  // buy-bar-per — includes trailing text like "· ověřte aktuální cenu"
  mdx = mdx.replace(
    /<div class="buy-bar-per">[^<]*<\/div>/g,
    `<!-- @PRODUCT_PER:${reviewSlug} -->`
  )
  // sidebar-price
  mdx = mdx.replace(
    /<div class="sidebar-price">[^<]*<\/div>/g,
    `<!-- @PRODUCT_PRICE:${reviewSlug} -->`
  )
  // sidebar-price-per
  mdx = mdx.replace(
    /<div class="sidebar-price-per">[^<]*<\/div>/g,
    `<!-- @PRODUCT_PER:${reviewSlug} -->`
  )
  return mdx
}

/** Replace only the YAML frontmatter description with a new value */
function replaceDesc(mdx: string, newDesc: string): string {
  // Match "description: >-\n  ...\n  ...\n" (multi-line YAML block scalar)
  return mdx.replace(
    /^(description: >-\n)((?:[ \t]+[^\n]*\n)*)/m,
    `$1  ${newDesc}\n`
  )
}

/** Replace only the YAML frontmatter title */
function replaceTitle(mdx: string, newTitle: string): string {
  return mdx.replace(
    /^(title: ")[^"]*(")/m,
    `$1${newTitle}$2`
  )
}

// ─── per-review patches ──────────────────────────────────────────────────────

const PATCHES: Record<string, (mdx: string) => string> = {

  'nikolos-kalamata-recenze': (mdx) => {
    // A: fix title (34 chars → 54)
    mdx = replaceTitle(mdx, 'Nikolos Kalamata 5l — recenze řeckého olivového oleje')
    // A: fix description (wrong o-webu text → correct product desc, 142 chars)
    mdx = replaceDesc(mdx,
      'Recenze Nikolos Kalamata 5l z Peloponésu. Extra panenský, acidita 0,37 %, sklizeň 2025/26. Plechový kanystr — dobrá volba k masu a grilování.'
    )
    return mdx
  },

  'evoilino-korfu-recenze': (mdx) => {
    // B: "zaručeně nejnižší aciditu" → "deklarovanou aciditou max. 0,3 % dle výrobce"
    mdx = mdx.replace(
      'pro zaručeně nejnižší aciditu',
      's deklarovanou aciditou max. 0,3 % dle výrobce'
    )
    return mdx
  },

  'erato-kalamata-recenze': (mdx) => {
    // B: odstraň rok 2024/25 (nelze ověřit u výrobce — viz instrukce)
    // "sklizeň 2024/25" v hero sekci → "aktuální sklizeň"
    mdx = mdx.replace(/[Ss]klize[nň] 2024\/25/g, 'aktuální sklizeň')
    mdx = mdx.replace(/📅 Sklize[nň] 2024\/25/g, '📅 Aktuální sklizeň')
    // V těle textu: "ze sklizně **2024/25** — o rok starší než"
    mdx = mdx.replace(
      /ze sklizn[eě] \*\*2024\/25\*\* — o rok starší než většina ostatních/g,
      'ze starší sklizně — u pětilitrového balení sledujte datum expirace'
    )
    // C: zkrátit description (183 → 155)
    mdx = replaceDesc(mdx,
      'Recenze Erato Kalamata 5l. Extra panenský z Messinie, Peloponés. Výrobce AGRO.VI.M s tradicí od 1964. Acidita 0,42 %, plechový kanystr 5 l.'
    )
    return mdx
  },

  'petromilos-zakynthos-recenze': (mdx) => {
    // B: odstraň rok 2024/25
    mdx = mdx.replace(/[Ss]klize[nň] 2024\/25/g, 'aktuální sklizeň')
    mdx = mdx.replace(/📅 Sklize[nň] 2024\/25/g, '📅 Aktuální sklizeň')
    // C: zkrátit description (172 → 152) + odstraň "Ověřte aktuální cenu a sklizeň."
    mdx = replaceDesc(mdx,
      'Recenze Petromilos Zakynthos 5l. Jemný jónský charakter, acidita 0,36 %, odrůda Koroneiki. Plechový kanystr ze slunného ostrova Zakynthos.'
    )
    return mdx
  },

  'orino-sitia-recenze': (mdx) => {
    // C: zkrátit description (199 → 155)
    mdx = replaceDesc(mdx,
      'Recenze Orino Sitia P.D.O. 5l — jediný PDO certifikovaný olej v nabídce. Acidita ≤ 0,39 %, oblast Sitia Lassithi, Kréta. Plechový kanystr.'
    )
    return mdx
  },

  'pallada-kreta-recenze': (mdx) => {
    // C: zkrátit description (169 → 153) — odstraň "Cena, srovnání, kde koupit."
    mdx = replaceDesc(mdx,
      'Recenze Pallada Kréta 5l z oblasti Akrotiri, Chania. Extra panenský, acidita 0,61–0,8 %, odrůda Koroneiki, sklizeň 2025/26. Plechový kanystr.'
    )
    return mdx
  },

  'motakis-recenze': (mdx) => {
    // D only — description has "Cena 258 Kč/litr" → remove price
    mdx = replaceDesc(mdx,
      'Recenze Motakis Kréta 5l — extra panenský olivový olej z Kréty, odrůda Koroneiki, acidita 0,49–0,8 %. Je to správná volba pro vás?'
    )
    return mdx
  },

  'neotis-manaki-recenze': (mdx) => {
    // "jediný olivový olej z odrůdy Manaki v 5l balení" → CORINTO je taky Manaki
    mdx = mdx.replace(
      'jediný olivový olej z odrůdy Manaki v 5l balení',
      'olivový olej z odrůdy Manaki v 5l balení s extra jemným profilem'
    )
    // Description: "jediný olivový olej z odrůdy Manaki v 5l balení."
    mdx = replaceDesc(mdx,
      'Recenze Neotis Manaki 5l — extra panenský olivový olej z odrůdy Manaki. Sametová chuť bez hořkosti, acidita ≤ 0,3 %, lisovaný den sklizně.'
    )
    return mdx
  },

  'theoni-kalamata-recenze': (mdx) => {
    // description ends at 153 chars — OK, no change needed except D
    return mdx
  },

  'corinto-pelopones-extra-panensky-manaki-0-4-recenze': (mdx) => {
    // C: description má hardcoded "za 1990 Kč" — odstraň cenu
    mdx = replaceDesc(mdx,
      'Detailní recenze BIO olivového oleje CORINTO Manaki z Peloponésu. Acidita 0,42 %, sametová chuť, 5litrový plech. Hodí se na finishing i vaření.'
    )
    return mdx
  },
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  const { data: products, error } = await sb
    .from('products')
    .select('slug, review_slug, review_mdx, price_czk, volume_ml')
    .eq('status', 'published')
    .not('review_slug', 'is', null)

  if (error || !products) {
    console.error('Fetch error:', error?.message)
    process.exit(1)
  }

  console.log(`Fetched ${products.length} published products with review_slug\n`)

  const updates: Array<{ slug: string; review_mdx: string; changed: string[] }> = []

  for (const p of products) {
    const reviewSlug = p.review_slug as string
    let mdx = (p.review_mdx ?? '') as string
    const original = mdx
    const changes: string[] = []

    // D: tokenize price divs (all reviews)
    const tokenized = tokenizeReview(mdx, reviewSlug)
    if (tokenized !== mdx) {
      const countBuyBar = (mdx.match(/buy-bar-price/g) ?? []).length
      const countSidebar = (mdx.match(/sidebar-price"/g) ?? []).length
      changes.push(`D: tokenized ${countBuyBar} buy-bar + ${countSidebar} sidebar price divs`)
      mdx = tokenized
    }

    // Apply per-review patches (A, B, C)
    const patch = PATCHES[reviewSlug]
    if (patch) {
      const patched = patch(mdx)
      if (patched !== mdx) {
        changes.push(`A/B/C: per-review patch applied`)
        mdx = patched
      }
    }

    if (mdx !== original) {
      updates.push({ slug: p.slug, review_mdx: mdx, changed: changes })
    } else {
      console.log(`  SKIP ${reviewSlug} — no changes`)
    }
  }

  console.log(`\n${updates.length} reviews to update:\n`)
  for (const u of updates) {
    console.log(`  • ${u.slug}: ${u.changed.join('; ')}`)
  }

  // Dry-run check
  if (process.argv.includes('--dry-run')) {
    console.log('\n[DRY RUN] No changes written to DB.')
    return
  }

  console.log('\nWriting to DB...')
  let ok = 0
  for (const u of updates) {
    const { error: updateErr } = await sb
      .from('products')
      .update({ review_mdx: u.review_mdx })
      .eq('slug', u.slug)
    if (updateErr) {
      console.error(`  ERROR ${u.slug}:`, updateErr.message)
    } else {
      console.log(`  ✓ ${u.slug}`)
      ok++
    }
  }

  console.log(`\nDone. ${ok}/${updates.length} updated.`)
}

main()
