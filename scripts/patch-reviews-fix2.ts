/**
 * Fix2 — opraví zbývající problémy po patch-reviews-abcd.ts:
 * 1. nikolos title (nebyl v uvozovkách → jiný regex)
 * 2. erato + petromilos: agresivnější odstraňování 2024/25 ze všech formátů
 */

import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function removeHarvestYear(mdx: string): string {
  // sidebar spec value
  mdx = mdx.replace(
    /<span class="sidebar-spec-value">2024\/25<\/span>/g,
    '<span class="sidebar-spec-value">aktuální</span>'
  )
  // <strong>2024/25</strong> v těle
  mdx = mdx.replace(/<strong>2024\/25<\/strong>/g, 'starší sklizně')
  // "ze sklizně 2024/25" — v FAQ, v textu
  mdx = mdx.replace(/ze sklizn[eě] 2024\/25/gi, 'ze starší sklizně')
  // "sklizeň 2024/25" — prostý text (v schema YAML i v body)
  mdx = mdx.replace(/[Ss]klize[nň]:? ?2024\/25/g, 'aktuální sklizeň')
  // "2024/25" jako standalone hodnota v sidebar-spec nebo v textu
  mdx = mdx.replace(/\b2024\/25\b/g, 'aktuální sklizeň')
  return mdx
}

async function main() {
  const { data, error } = await sb
    .from('products')
    .select('slug, review_slug, review_mdx')
    .eq('status', 'published')
    .in('slug', ['nikolos', 'erato', 'petromilos'])

  if (error || !data) { console.error(error?.message); process.exit(1) }

  const updates: Array<{ slug: string; review_mdx: string }> = []

  for (const p of data) {
    let mdx = p.review_mdx as string
    const original = mdx

    if (p.slug === 'nikolos') {
      // Fix title — může být s nebo bez uvozovek
      // Původní: title: Nikolos Kalamata 5l — recenze 2026
      mdx = mdx.replace(
        /^title:.*$/m,
        'title: "Nikolos Kalamata 5l — recenze řeckého olivového oleje"'
      )
    }

    if (p.slug === 'erato' || p.slug === 'petromilos') {
      mdx = removeHarvestYear(mdx)
    }

    if (mdx !== original) {
      updates.push({ slug: p.slug, review_mdx: mdx })

      // Show diff summary
      if (p.slug === 'nikolos') {
        const titleLine = mdx.split('\n').find(l => l.startsWith('title:'))
        console.log(`nikolos title → ${titleLine}`)
      }
      if (p.slug === 'erato') {
        const remaining = (mdx.match(/2024\/25/g) ?? []).length
        console.log(`erato 2024/25 remaining: ${remaining}`)
      }
      if (p.slug === 'petromilos') {
        const remaining = (mdx.match(/2024\/25/g) ?? []).length
        console.log(`petromilos 2024/25 remaining: ${remaining}`)
      }
    }
  }

  if (process.argv.includes('--dry-run')) {
    console.log('\n[DRY RUN]', updates.map(u => u.slug))
    return
  }

  for (const u of updates) {
    const { error: err } = await sb.from('products').update({ review_mdx: u.review_mdx }).eq('slug', u.slug)
    console.log(err ? `ERROR ${u.slug}: ${err.message}` : `  ✓ ${u.slug}`)
  }
}

main()
