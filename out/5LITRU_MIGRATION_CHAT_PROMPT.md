# 5LITRU.CZ → NEXT.JS MIGRATION — PROJECT BRIEF

## Context

Jsem majitel dvou webů:

### OLIVATOR.CZ (main project)
- Next.js + Railway + Supabase
- Srovnávač olivových olejů (všechny velikosti)
- 446 produktů, 98 brands, multi-retailer
- Live na https://olivator.cz
- Features: product comparison, Score algorithm, affiliate tracking
- Nedávno přidána landing page `/olivovy-olej-5l`

### 5LITRU.CZ (niche specialist)
- WordPress na Wedos hostingu
- Specializace pouze na 5L oleje
- Rankuje #1 "řecký olivový olej 5l" (75 impressions/měsíc)
- 14 users/měsíc, 58.8% organic traffic
- 34 published pages (recenze, průvodce, srovnání)
- Performance: LCP 4.4s (POOR)
- Design: AI-generated content, Gutenberg blocks, Elementor
- Tone: Storytelling, personal ("Při prvním doušku ucítíte...")

## Goal

Migrovat 5litru.cz z WordPress → Next.js/Railway:
- ✅ Zachovat VEŠKERÝ design pixel-perfect
- ✅ Zachovat VEŠKERÝ obsah (34 pages, 32 images)
- ✅ Zachovat VŠECHNY SEO metadata (Yoast → Next.js)
- ✅ Zachovat URLs identické (SEO protection)
- ✅ Sdílet DB s Olivator (Supabase, live data produktů)
- ✅ AI-generated nové listingy (match existing style)
- ✅ 3× rychlejší (4.4s → 1.5s LCP)

## Strategy

**Dual brand positioning:**
- OLIVATOR.CZ = comprehensive (all sizes)
- 5LITRU.CZ = niche expert (only 5L)

**Shared architecture:**
```
Supabase DB (shared)
    ↓              ↓
Olivator.cz    5litru.cz
(Railway)      (Railway)
```

**Migration approach:**
1. Build duplicita na Railway (temporary URL)
2. Test thoroughly (kdykoli, no rush)
3. DNS switch když confident (5 min)
4. Monitor rankings 1-2 týdny
5. DELETE WordPress when safe

## What I have

**Files provided:**
- WordPress XML export (`5litrucz_WordPress_2026-05-14.xml`)
  - 34 published pages
  - 32 attachments (images)
  - 10 ThirstyLinks (affiliate)
- Live pages fetched:
  - Homepage design & content
  - Motakis review (product page template)
  - All metadata (Yoast SEO)

**Content structure (from XML):**
- Homepage (special)
- `/nejlepsi-olivovy-olej-5l/` — main comparison (TOP ranking)
- 9 product reviews (Motakis, SITIA, Neotis, Pallada, Nikolos, Erato, Orino, Evoilino, Theoni)
- 18 guides (acidita, polyfenoly, PDO, skladování, smažení, pečení, salát, děti, bio, koroneiki, manaki, extra panenský, řecký vs italský, olivový vs řepkový, sklizeň, plech)
- 3 regional comparisons (řecký 5l, kréta 5l, kalamata 5l)
- Shopping guide (akce)

## Design characteristics (from live fetch)

**Homepage patterns:**
- Hero section s CTA buttons
- Product cards: Top 3 featured
- Badges: ⭐ Nejprodávanější, ⚗️ Acidita, 🫙 Plech 5l, 🇬🇷 Řecký
- Rating display: "4.9★★★★★ 176 recenzí"
- Customer reviews embedded (z reckonasbavi.cz)
- Guide grid (numbered 01-17)
- Regional sections (🏔️ Kréta, 🌊 Kalamata, 🏝️ Ostrovy)

**Product review template:**
- Breadcrumbs navigation
- Product hero (image, badges, rating, specs)
- "Rychlé shrnutí" section
- Rating bars: "Jemnost chuti 3/5"
- Comparison tables (vs alternatives)
- Customer review cards with stars
- FAQ accordion
- CTA boxes (Koupit, Srovnat)

**Tone & style:**
- Storytelling: "Při prvním doušku ucítíte svěží ovocné tóny..."
- Practical tips: 💡 callouts
- Personal recommendations
- Informal but authoritative
- Czech language, natural phrasing

## Technical requirements

**Next.js stack:**
- App router
- TypeScript
- Tailwind CSS
- Supabase client (shared with Olivator)
- MDX for content (converted from WordPress HTML)
- Next.js Metadata API (Yoast SEO → generateMetadata)
- Schema.org JSON-LD (FAQPage, Review, Product)

**URL preservation (critical for SEO):**
```
WordPress → Next.js (must match exactly)
/motakis-recenze/ → /motakis-recenze/
/acidita-olivoveho-oleje/ → /acidita-olivoveho-oleje/
... all 34 pages identical URLs
```

**Live data integration:**
```typescript
// Fetch 5L produkty z Olivator Supabase
export async function get5LProducts() {
  return supabase
    .from('products')
    .select('*, product_offers(*, retailers(*))')
    .gte('volume_ml', 4500)
    .lte('volume_ml', 5500)
    .eq('status', 'active')
    .order('olivator_score', { ascending: false });
}
```

**AI listing generator:**
- Analyze existing reviews (style, structure, tone)
- Generate new reviews matching 5litru.cz style
- Input: product data from Olivator DB
- Output: MDX review files

## Success criteria

**Design match:**
- [ ] Homepage looks identical
- [ ] Product cards match exactly (badges, layout, typography)
- [ ] Review pages match structure
- [ ] Colors, fonts, spacing pixel-perfect

**Content preserved:**
- [ ] All 34 pages migrated
- [ ] All images present
- [ ] All affiliate links working (ThirstyLinks → new system)
- [ ] All internal links functional

**SEO intact:**
- [ ] All meta titles/descriptions preserved (from Yoast)
- [ ] Schema.org markup present
- [ ] OpenGraph tags correct
- [ ] URLs identical (no 301s needed)
- [ ] Canonical URLs set

**Performance:**
- [ ] LCP < 2s (target 1.5s, down from 4.4s)
- [ ] All Core Web Vitals green
- [ ] Mobile responsive

**Live data:**
- [ ] Prices fetch from Olivator DB
- [ ] Product info accurate
- [ ] Multi-retailer support

## Deployment workflow

**Phase 1: Build (on Railway)**
- Build Next.js site
- Deploy to Railway temporary URL
- Share URL for testing
- Zero impact on live WordPress

**Phase 2: Test (user)**
- Test Railway URL thoroughly
- Report bugs/issues
- Iterate until satisfied
- No time pressure

**Phase 3: Switch (when approved)**
- DNS change: 5litru.cz → Railway
- Monitor rankings 1-2 weeks
- Keep WordPress as backup

**Phase 4: Cleanup (when confident)**
- DELETE WordPress
- CANCEL Wedos hosting
- Keep domain only

## Budget & timeline

**Effort estimate:** 18-20 hours
**Cost estimate:** $0.85 (Claude API usage)
**Timeline:** Flexible (switch when user approves)

**Cost savings:**
- Before: ~2000 Kč/rok (Wedos hosting + domain)
- After: ~1700 Kč/rok (Railway $5/mo + domain)
- Savings: ~300 Kč/rok + 3× speed boost

## Current status

- [x] WordPress XML export received
- [x] Live pages fetched (homepage, review)
- [x] Design analysis complete
- [x] Content structure mapped
- [ ] Migration not started yet

## What I need

Strategic guidance pro:
- Migration priority sequence (co první?)
- Design replication approach (components structure?)
- Content conversion strategy (WordPress HTML → MDX?)
- SEO preservation tactics (metadata mapping?)
- Live data integration architecture
- AI listing generation workflow
- Testing & verification checklist

Jsem ready začít. Co doporučuješ jako první krok?
