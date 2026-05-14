# 5LITRU.CZ MIGRATION — TECHNICAL IMPLEMENTATION

## Mission

Migrate 5litru.cz from WordPress (Wedos hosting) to Next.js (Railway), preserving 100% design, content, and SEO while adding live data integration with Olivator.cz Supabase database.

## Context

**Source: WordPress site**
- URL: https://5litru.cz
- Stack: WordPress 6.9.4, Gutenberg blocks, Elementor
- Content: 34 published pages, 32 images, 10 affiliate links
- Performance: LCP 4.4s (POOR)
- Rankings: #1 "řecký olivový olej 5l"

**Target: Next.js site**
- Stack: Next.js 15 (App Router), TypeScript, Tailwind, Supabase
- Deploy: Railway (temporary URL first, then DNS switch)
- Performance goal: LCP < 1.5s
- SEO: Preserve all rankings, URLs identical

**Related project: Olivator.cz**
- Next.js + Supabase (shared DB)
- 446 products, 98 brands
- Architecture reference: similar to what we're building

## Files provided

**In context:**
- `/mnt/user-data/uploads/5litrucz_WordPress_2026-05-14.xml`
  - WordPress WXR export
  - 34 pages, 32 attachments
  - Yoast SEO metadata included

**Live pages fetched:**
- Homepage: https://5litru.cz/ (design reference)
- Review template: https://5litru.cz/motakis-recenze/ (structure reference)

## Architecture

```
┌─────────────────────────────────────┐
│ SUPABASE (shared with Olivator)    │
│ - products table                    │
│ - brands, retailers, product_offers │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ 5LITRU.CZ (Next.js on Railway)     │
│ - Fetch 5L products (4500-5500ml)  │
│ - Display reviews + guides          │
│ - Live pricing from DB              │
└─────────────────────────────────────┘
```

## Project structure

```
5litru-cz/
├── app/
│   ├── layout.tsx              # Global layout
│   ├── page.tsx                # Homepage
│   ├── nejlepsi-olivovy-olej-5l/
│   │   └── page.tsx            # Main comparison
│   ├── [slug]/
│   │   └── page.tsx            # Product reviews (dynamic)
│   └── pruvodce/
│       └── [slug]/
│           └── page.tsx        # Guides (dynamic)
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   └── Breadcrumbs.tsx
│   ├── product/
│   │   ├── ProductCard.tsx     # Match WP design exactly
│   │   ├── ProductHero.tsx
│   │   ├── RatingDisplay.tsx   # "4.9★★★★★ 176 recenzí"
│   │   └── BadgeSystem.tsx     # ⭐ ⚗️ 🫙 🇬🇷
│   └── content/
│       ├── ArticleLayout.tsx
│       ├── FAQ.tsx             # Accordion
│       └── CalloutBox.tsx      # 💡 tips
├── lib/
│   ├── supabase.ts             # Shared client (same as Olivator)
│   ├── products.ts             # get5LProducts()
│   └── metadata.ts             # SEO utilities
├── content/
│   ├── reviews/
│   │   ├── motakis-recenze.mdx
│   │   ├── sitia-premium-gold-recenze.mdx
│   │   └── ... (9 reviews total)
│   └── guides/
│       ├── acidita-olivoveho-oleje.mdx
│       ├── polyfenoly-olivovy-olej.mdx
│       └── ... (18 guides total)
└── public/
    └── images/                 # 32 WordPress images
```

## Implementation phases

### PHASE 1: Setup & data extraction (2 hours, $0.10)

**Tasks:**
1. Parse WordPress XML export
   - Extract all 34 pages (title, slug, content, metadata)
   - Extract Yoast SEO data per page
   - Extract 32 image attachments
   - Extract 10 ThirstyLinks (affiliate URLs)

2. Create conversion scripts:
   ```
   scripts/
   ├── parse-wordpress-export.ts    # XML → JSON
   ├── convert-to-mdx.ts            # HTML → MDX
   └── extract-images.ts             # Download images
   ```

3. Output structure:
   ```
   data/
   ├── pages.json          # All page data + metadata
   ├── images.json         # Image URLs + alt text
   └── affiliate-links.json # ThirstyLinks mapping
   ```

**Verification:**
- Run: `npm run parse-wp-export`
- Check: `data/pages.json` contains all 34 pages
- Check: All Yoast metadata preserved

### PHASE 2: Next.js skeleton (3 hours, $0.15)

**Tasks:**
1. Initialize Next.js project:
   ```bash
   npx create-next-app@latest 5litru-cz \
     --typescript --tailwind --app --no-src-dir
   ```

2. Install dependencies:
   ```bash
   npm install @supabase/supabase-js gray-matter next-mdx-remote
   ```

3. Setup Supabase connection (same as Olivator):
   ```typescript
   // lib/supabase.ts
   export const supabase = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL!,
     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
   );
   ```

4. Create route structure:
   - `/` → homepage
   - `/[slug]/` → dynamic reviews
   - `/pruvodce/[slug]/` → dynamic guides
   - `/nejlepsi-olivovy-olej-5l/` → comparison

5. Setup MDX loading:
   ```typescript
   // lib/content.ts
   export async function getReview(slug: string) {
     const file = await fs.readFile(`content/reviews/${slug}.mdx`);
     const { data, content } = matter(file);
     return { meta: data, content };
   }
   ```

**Verification:**
- Run: `npm run dev`
- Check: All routes accessible (404s OK for now)
- Check: Supabase connection works

### PHASE 3: Content conversion (2 hours, $0.10)

**Tasks:**
1. Convert WordPress HTML → MDX:
   ```typescript
   // Gutenberg blocks → clean MDX
   // Preserve headings, lists, images
   // Clean WordPress cruft
   ```

2. Generate MDX files:
   ```
   content/
   ├── reviews/
   │   └── motakis-recenze.mdx
   │       ---
   │       title: "Motakis Kréta 5l — recenze 2026"
   │       description: "Recenze Motakis..."
   │       slug: "motakis-recenze"
   │       yoast_title: "..."
   │       yoast_description: "..."
   │       og_image: "/images/motakis.jpg"
   │       schema: {...}
   │       ---
   │       # Content here
   ```

3. Download & optimize images:
   ```bash
   # Download 32 WordPress images
   # Convert to WebP where possible
   # Save to public/images/
   ```

**Verification:**
- Check: All 34 MDX files created
- Check: All images in public/images/
- Check: MDX frontmatter has all Yoast metadata

### PHASE 4: Design replication (4 hours, $0.20)

**Critical: Match WordPress pixel-perfect**

**Tasks:**
1. Extract design tokens from live site:
   - Colors (olive green, dark backgrounds)
   - Typography (font families, sizes, weights)
   - Spacing (gaps, paddings, margins)
   - Borders, shadows, radii

2. Create components matching WP exactly:

   **ProductCard.tsx:**
   ```typescript
   // Match WordPress card exactly:
   // - Image aspect ratio
   // - Badge positions (⭐ ⚗️ 🫙)
   // - Typography hierarchy
   // - CTA button style
   // - Hover states
   ```

   **RatingDisplay.tsx:**
   ```typescript
   // "4.9★★★★★ 176 recenzí"
   // Match: star size, spacing, font weight
   ```

   **BadgeSystem.tsx:**
   ```typescript
   // ⭐ Nejprodávanější
   // ⚗️ Acidita ≤ 0,8 %
   // 🫙 Plech 5 l
   // 🇬🇷 Řecký původ
   // Match: colors, sizing, positioning
   ```

3. Page layouts:
   - Homepage hero
   - Product review structure
   - Guide article layout
   - Footer navigation

**Verification:**
- Screenshot comparison: WP vs Next.js
- Check: Typography matches
- Check: Colors match
- Check: Spacing matches
- Check: Mobile responsive

### PHASE 5: SEO preservation (1 hour, $0.05)

**Tasks:**
1. Implement Next.js Metadata API:
   ```typescript
   export async function generateMetadata({ params }): Promise<Metadata> {
     const review = await getReview(params.slug);
     return {
       title: review.meta.yoast_title,
       description: review.meta.yoast_description,
       alternates: { canonical: `https://5litru.cz/${params.slug}` },
       openGraph: {
         title: review.meta.og_title,
         description: review.meta.og_description,
         images: [review.meta.og_image],
       },
       twitter: {
         card: 'summary_large_image',
         title: review.meta.twitter_title,
         description: review.meta.twitter_description,
       }
     };
   }
   ```

2. Add Schema.org JSON-LD:
   ```typescript
   // Per page type:
   // - Review → Review schema
   // - Guide → Article schema
   // - FAQ sections → FAQPage schema
   ```

3. Verify all URLs match WordPress exactly

**Verification:**
- Check: View source → meta tags correct
- Check: Schema.org validator passes
- Check: OpenGraph debugger (Facebook) passes

### PHASE 6: Live data integration (2 hours, $0.10)

**Tasks:**
1. Product data fetching:
   ```typescript
   // lib/products.ts
   export async function get5LProducts() {
     return supabase
       .from('products')
       .select(`
         *,
         product_offers!inner (
           price_czk,
           url,
           retailer:retailers (name, slug, logo_url)
         )
       `)
       .gte('volume_ml', 4500)
       .lte('volume_ml', 5500)
       .eq('status', 'active')
       .order('olivator_score', { ascending: false });
   }
   ```

2. Dynamic pricing on product pages:
   ```typescript
   // Show live price from Olivator DB
   // "Ověřte aktuální cenu" → real-time
   ```

3. Affiliate link tracking:
   ```typescript
   // Convert ThirstyLinks → new system
   // Track clicks, UTM params
   ```

**Verification:**
- Check: Prices display correctly
- Check: Links point to correct retailers
- Check: Data refreshes (ISR/dynamic)

### PHASE 7: AI listing generator (2 hours, $0.10)

**Tasks:**
1. Analyze existing review style:
   ```typescript
   // Extract patterns from 9 existing reviews:
   // - Average length
   // - Section structure
   // - Tone markers
   // - Common phrases
   ```

2. Generate new reviews:
   ```typescript
   // For each 5L product in DB without review:
   // 1. Fetch product data (score, origin, brand)
   // 2. Generate review matching 5litru.cz style
   // 3. Save as MDX file
   ```

3. Manual review & edit option

**Verification:**
- Check: AI reviews match existing style
- Check: No factual errors
- Check: Tone consistent

### PHASE 8: Railway deployment (1 hour, $0.05)

**Tasks:**
1. Create Railway project:
   ```bash
   railway init
   railway link
   ```

2. Add environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=<same as Olivator>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<same as Olivator>
   ```

3. Deploy:
   ```bash
   railway up
   ```

4. Get temporary URL:
   ```
   https://5litru-production.up.railway.app
   ```

**Verification:**
- Check: Site loads on Railway URL
- Check: All pages accessible
- Check: Images load
- Check: Supabase connection works

### PHASE 9: Testing (2 hours, user-driven)

**Checklist provided to user:**

**Visual match:**
- [ ] Homepage looks identical to WordPress
- [ ] Product cards match exactly
- [ ] Review pages match structure
- [ ] Typography correct
- [ ] Colors correct
- [ ] Mobile responsive

**Content:**
- [ ] All 34 pages present
- [ ] All images display
- [ ] All links work (internal + external)
- [ ] Affiliate links functional

**SEO:**
- [ ] Meta tags correct (view source)
- [ ] Schema.org present
- [ ] URLs match WordPress

**Performance:**
- [ ] LCP < 2s (Lighthouse)
- [ ] Core Web Vitals green

**Live data:**
- [ ] Prices accurate
- [ ] Product info correct

**Bugs reported → fix → retest → repeat**

### PHASE 10: DNS switch (user decides when)

**Instructions for user:**

1. Railway dashboard → Settings → Domains
2. Add custom domain: `5litru.cz`
3. Copy CNAME record: `xxxxx.up.railway.app`
4. Wedos DNS panel:
   - Delete old A record
   - Add CNAME: `5litru.cz` → Railway CNAME
5. Wait 5-30 minutes for propagation
6. Verify: `5litru.cz` now shows Railway site

**Rollback plan:**
- If issues: change DNS back to WordPress IP
- Zero data loss (WordPress still exists)

## Critical constraints

**HARD REQUIREMENTS:**
- [ ] All URLs must match WordPress exactly (SEO)
- [ ] Design must be pixel-perfect (user trust)
- [ ] All content must be preserved (no loss)
- [ ] Performance must improve (4.4s → <2s)

**BUDGET:**
- Time: 18-20 hours
- Cost: $0.85 (API usage)
- No external services beyond Railway ($5/mo)

**SAFETY:**
- WordPress remains live during entire build
- DNS switch is reversible
- No deleting WordPress until confident
- Rollback plan documented

## Success definition

**Migration is complete when:**
1. Railway URL tested & approved by user
2. DNS switched successfully
3. Rankings maintained (1-2 week monitor)
4. User confident to delete WordPress

**Then:**
- WordPress deleted
- Wedos hosting canceled
- Domain points to Railway
- Cost: ~1700 Kč/rok (down from ~2000 Kč/rok)
- Speed: 3× faster

## Current status

- [x] WordPress export received
- [x] Live pages analyzed
- [x] Architecture designed
- [ ] Build not started

## First steps

When you start:
1. Create project directory: `5litru-cz/`
2. Run PHASE 1: Parse WordPress export
3. Show me output: `data/pages.json` sample
4. Wait for approval before PHASE 2

After each phase: show sample output, wait for verification.

No auto-proceeding through all phases — checkpoint after each.

Let's build this right. Start with PHASE 1 when ready.
