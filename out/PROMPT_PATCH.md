# 5LITRU MIGRATION — PROMPT PATCH v2 (COMPLETE)

This document patches `5LITRU_MIGRATION_CODE_PROMPT.md` with everything
discovered while parsing the WordPress XML export and clarifying the
target architecture with the user. Apply these corrections before
starting any work — they save Claude Code from building features against
incorrect assumptions.

**Reading order:**
1. Sections 1–7 (🔴 CRITICAL CORRECTIONS) — fix mistakes in the original prompt
2. Section 8 (📋 CONTENT INVENTORY) — pre-built data files
3. Section 9 (🗺️ URL MAP) — exact routing requirements
4. Section 10 (🏗️ DATABASE SCHEMA) — new tables in shared Supabase
5. Section 11 (🔗 AFFILIATE ROUTING) — eHub link generation
6. Section 12 (🛠️ ADMIN PANEL) — three-tab admin UI
7. Section 13 (🤖 AI REVIEW PIPELINE) — Claude API integration
8. Section 14 (✅ REVISED PHASES) — updated implementation order

---

## 🔴 CRITICAL CORRECTIONS

### 1. SEO plugin: RankMath, NOT Yoast

The original prompt mentions Yoast SEO 12+ times. The actual WordPress
site uses **Rank Math SEO**. Postmeta keys are completely different:

| What prompt says | What actually exists |
|------------------|----------------------|
| `_yoast_wpseo_title` | `rank_math_title` |
| `_yoast_wpseo_metadesc` | `rank_math_description` |
| `_yoast_wpseo_focuskw` | `rank_math_focus_keyword` |
| `_yoast_wpseo_opengraph-image` | `rank_math_og_content_image` (PHP serialized!) |
| `_yoast_wpseo_canonical` | (does not exist — needs to be generated) |
| Twitter card fields | (do not exist — derive from OG) |

**Action**: Every reference to Yoast in Phase 1 and Phase 5 must be
replaced with RankMath. The provided `pages.json` already has
RankMath data extracted under `seo.*` per page.

### 2. `rank_math_og_content_image` is PHP-serialized, not a URL

It looks like: `a:2:{s:5:"check";s:32:"...";s:6:"images";a:1:{i:0;i:60;}}`.
The `60` is the attachment post_id. Resolution is already done in the
provided `pages.json` — each page has `seo.og_image_url` as a real URL.

### 3. ThirstyLinks plugin: meta key is `_ta_destination_url`

Not `_tcl_destination_url`. The plugin is "Thirsty Affiliates" (`_ta_*`
prefix). All 10 affiliate links currently redirect to
`https://ehub.cz/system/scripts/click.php?...`. These are pre-extracted
in `affiliate_links.json`.

### 4. No Yoast canonicals stored — generate them

RankMath computes canonicals at runtime from permalinks. **In Next.js,
generate `canonical: 'https://5litru.cz/${slug}/'`** (with trailing
slash — see point 7).

### 5. No structured Gutenberg blocks — pages are raw HTML

Every page uses exactly one `core/html` Gutenberg block wrapping raw
HTML. This is AI-generated content pasted into the editor. The
`convert-to-mdx.ts` script does NOT need a Gutenberg block parser:
1. Strip the `<!-- wp:html --> ... <!-- /wp:html -->` wrapper comments
2. The inner HTML can stay as HTML inside MDX (MDX accepts HTML) or
   be converted with `turndown` for cleaner markdown
3. Replace `<img>` src paths from `https://5litru.cz/wp-content/uploads/...`
   to local `/images/...`

### 6. Design approach: brand-perfect, not pixel-perfect

The user prefers preserving the brand vibe over 1:1 visual cloning. The
WordPress LCP of 4.4s is partly caused by the existing CSS — a faithful
clone reproduces the performance problem.

**Preserve**: badges (⭐ ⚗️ 🫙 🇬🇷), section structure, storytelling
tone, rating display format, customer review cards, FAQ accordion,
olive-green / dark color palette.

**Modernize**: typography rhythm, spacing scale, card shadows, hover
transitions, image aspect ratios (use Next/Image with proper sizes).

**Acceptance test**: a returning visitor should still recognize the
brand. Pixel-level diffs are acceptable.

### 7. Trailing slashes — set early

All WordPress permalinks have trailing slashes (`/motakis-recenze/`).
Next.js defaults to no trailing slash. To preserve URLs exactly:

```js
// next.config.js
module.exports = {
  trailingSlash: true,
};
```

Without this, every URL becomes a 308 redirect (slash → no-slash) →
brief SEO hiccup. **Set this in Phase 2.**

---

## 📋 CONTENT INVENTORY (provided as `data/`)

Three pre-built JSON files. Copy to `5litru-cz/data/` and skip the
original Phase 1 entirely.

- **`pages.json`** — 34 pages, each with:
  - `id`, `slug`, `title`, `url`, `date`, `parent_id`
  - `content_html` (raw HTML, ready for MDX conversion)
  - `word_count`, `content_length`
  - `seo`: `{ title, description, focus_keyword, og_image_url, schema_article, seo_score }`
  - `internal_links`, `images_in_content`
  - `gutenberg_blocks` (always `["html"]` or `["html","paragraph"]`)
  - `all_seo_meta` (raw RankMath postmeta)

- **`images.json`** — 32 attachments:
  - `id`, `file_path`, `public_url`, `alt_text`
  - 27 of 32 have **empty alt text** — flag for batch generation

- **`affiliate_links.json`** — 10 ThirstyLinks:
  - `slug`, `target_url` (eHub URL with tracking hash), `redirect_type`, `no_follow`

---

## 🗺️ URL MAP (HARD REQUIREMENT)

All 34 URLs must work identically post-migration. None can change
without breaking SEO.

### Homepage
- `/` ← maps from WP page with slug `homepage`

### Main comparisons (5)
- `/nejlepsi-olivovy-olej-5l/` — TOP ranking page (#1 "řecký olivový olej 5l")
- `/recky-olivovy-olej-5l/`
- `/olivovy-olej-kreta-5l/`
- `/kalamata-olivovy-olej-5l/`
- `/olivovy-olej-5l-akce/`

### Product reviews (10 — note: brief said 9, Petromilos was missing)
- `/motakis-recenze/`
- `/sitia-premium-gold-recenze/`
- `/neotis-manaki-recenze/`
- `/pallada-kreta-recenze/`
- `/nikolos-kalamata-recenze/`
- `/erato-kalamata-recenze/`
- `/orino-sitia-recenze/`
- `/evoilino-korfu-recenze/`
- `/theoni-kalamata-recenze/`
- `/petromilos-zakynthos-recenze/`

### Guides (18)
- `/acidita-olivoveho-oleje/`, `/polyfenoly-olivovy-olej/`, `/pdo-olivovy-olej/`,
  `/jak-skladovat-olivovy-olej/`, `/olivovy-olej-na-smazeni/`, `/olivovy-olej-na-peceni/`,
  `/olivovy-olej-na-salat/`, `/olivovy-olej-pro-deti/`, `/bio-olivovy-olej/`,
  `/koroneiki-odruda/`, `/manaki-odruda/`, `/extra-panensky-olivovy-olej/`,
  `/recky-vs-italsky-olivovy-olej/`, `/olivovy-olej-vs-repkovy/`,
  `/sklizen-olivoveho-oleje/`, `/olivovy-olej-5l-plech/`,
  `/farmarske-olivove-oleje/`

### About
- `/o-webu/`

### Affiliate redirects (10 — NOT pages, server-side redirects)
These belong in `next.config.js`, not as Next.js routes:

```js
async redirects() {
  return [
    { source: '/motakis/',    destination: '<eHub URL>', permanent: false },
    { source: '/sitia/',      destination: '<eHub URL>', permanent: false },
    { source: '/neotis/',     destination: '<eHub URL>', permanent: false },
    { source: '/pallada/',    destination: '<eHub URL>', permanent: false },
    { source: '/nikolos/',    destination: '<eHub URL>', permanent: false },
    { source: '/erato/',      destination: '<eHub URL>', permanent: false },
    { source: '/orino/',      destination: '<eHub URL>', permanent: false },
    { source: '/evoilino/',   destination: '<eHub URL>', permanent: false },
    { source: '/theoni/',     destination: '<eHub URL>', permanent: false },
    { source: '/petromilos/', destination: '<eHub URL>', permanent: false },
  ];
}
```

`permanent: false` (302) so eHub tracking URLs can rotate. URLs are in
`affiliate_links.json`. **For new products added via admin**, redirects
must be regenerated from DB at build time — see Section 11.

### Recommended route structure

```
app/
├── page.tsx                    # / (homepage)
├── [slug]/
│   └── page.tsx                # ALL non-home content pages
└── admin/
    ├── layout.tsx              # auth wrapper
    ├── page.tsx                # dashboard (Section 12)
    ├── catalog/page.tsx        # "Můj katalog" tab
    ├── suggestions/page.tsx    # "Návrhy z Olivatoru" tab
    ├── add/page.tsx            # "Přidat z URL" tab
    ├── retailers/page.tsx      # "Retailers" tab
    └── drafts/[id]/page.tsx    # review draft editor
```

**Critical**: Do NOT add a `/pruvodce/` prefix for guides as the
original prompt suggested — guides currently live at root and that
would break every guide URL.

---

## 🏗️ DATABASE SCHEMA (new tables in shared Supabase)

The user's strategy: **5litru.cz is a standalone project**. Olivator
DB is a read-only source of suggestions. 5litru has its own tables in
the same Supabase project, all prefixed `fivelitru_*` to avoid
collisions with Olivator's tables.

```sql
-- Retailers (eshops where affiliate links point)
create table fivelitru_retailers (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text unique not null,
  name                  text not null,
  base_url              text not null,
  affiliate_network     text not null default 'ehub',
  ehub_tracking_hash    text,                    -- e.g. cda7c92a602d43e7b6635f22fd9b7298
  utm_campaign          text default '5litru-cz',
  active                boolean default true,
  created_at            timestamptz default now()
);

-- Products (oils on 5litru.cz — primary record)
create table fivelitru_products (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text unique not null,         -- 'motakis' → /motakis/ redirect
  review_slug           text unique,                  -- 'motakis-recenze' → /motakis-recenze/
  name                  text not null,                -- 'Motakis Kréta 5l'
  brand                 text,
  origin_country        text default 'Řecko',
  origin_region         text,                         -- 'Kréta'
  variety               text,                         -- 'Koroneiki'
  volume_ml             integer default 5000,
  acidity_pct           numeric(4,2),
  packaging             text,                         -- 'plech' | 'pet' | 'sklo'
  price_czk             numeric(8,2),
  retailer_id           uuid references fivelitru_retailers(id),
  product_url           text not null,                -- canonical URL on retailer site
  affiliate_url         text,                         -- computed (see Section 11)
  olivator_product_id   uuid,                         -- nullable link to Olivator catalog
  rating                numeric(2,1),
  hero_image            text,                         -- path in /public/images/
  status                text default 'draft',         -- 'draft' | 'published' | 'archived'
  review_mdx            text,                         -- the MDX content itself (see Section 12)
  review_frontmatter    jsonb,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),
  published_at          timestamptz
);

create index on fivelitru_products(status);
create index on fivelitru_products(olivator_product_id);

-- Olivator products user has explicitly ignored (so they stop appearing in suggestions)
create table fivelitru_ignored_suggestions (
  olivator_product_id   uuid primary key,
  reason                text,                         -- 'italian-out-of-scope', 'too-expensive', etc.
  ignored_at            timestamptz default now()
);

-- AI generation jobs (audit trail + cost tracking)
create table fivelitru_ai_jobs (
  id                    uuid primary key default gen_random_uuid(),
  product_id            uuid references fivelitru_products(id) on delete cascade,
  job_type              text not null,                -- 'review_draft' | 'scrape_url' | 'image_alt'
  input                 jsonb,
  output                jsonb,
  model                 text,                         -- e.g. 'claude-sonnet-4-5'
  status                text default 'pending',
  cost_usd              numeric(6,4),
  error_message         text,
  created_at            timestamptz default now(),
  completed_at          timestamptz
);

-- Click tracking (optional, for later — server-side count)
create table fivelitru_clicks (
  id                    bigserial primary key,
  product_id            uuid references fivelitru_products(id),
  source_path           text,                         -- e.g. '/motakis-recenze/'
  user_agent            text,
  ip_hash               text,                         -- hashed for GDPR
  clicked_at            timestamptz default now()
);
create index on fivelitru_clicks(product_id, clicked_at);
```

### Row Level Security

5litru uses its own anon key, separate from Olivator's:

```sql
-- Allow 5litru anon to read Olivator products (5L only) for suggestions
-- (adjust to match Olivator's actual table/column names)
create policy "5litru_read_5l_products" on products
  for select using (
    volume_ml between 4500 and 5500
    and status = 'active'
  );

-- 5litru tables: anon = read for public site, service_role = admin writes
create policy "anon_read_published" on fivelitru_products
  for select using (status = 'published');

create policy "service_role_full_access" on fivelitru_products
  for all using (auth.role() = 'service_role');

-- Apply analogous policies to fivelitru_retailers, fivelitru_ai_jobs, etc.
```

Admin routes use the service_role key (server-side only, env var).
Public site reads with anon key.

### Seed data

After creating tables, seed `fivelitru_retailers` with the existing
retailer (extracted from the eHub URL in `affiliate_links.json`):

```sql
insert into fivelitru_retailers (slug, name, base_url, ehub_tracking_hash, utm_campaign)
values (
  'reckonasbavi',
  'Řecko nás baví',
  'https://shop.reckonasbavi.cz',
  'cda7c92a602d43e7b6635f22fd9b7298',  -- extract actual hash from existing links
  '5litru-cz'
);
```

Then seed `fivelitru_products` for the 10 existing reviews, mapping
ThirstyLink slugs to product slugs.

---

## 🔗 AFFILIATE ROUTING

### URL format

Pattern from user's example:
```
https://shop.reckonasbavi.cz/<product-path>/
  ?utm_source=ehub
  &utm_medium=affiliate
  &utm_campaign=5litru-cz                  ← distinguishes 5litru vs olivator in eHub reports
  &ehub=cda7c92a602d43e7b6635f22fd9b7298
```

The user uses the **same eHub tracking hash** for both olivator.cz and
5litru.cz; `utm_campaign=5litru-cz` is how they're separated in eHub
reports. (If/when per-domain hashes are issued by eHub, just update
`fivelitru_retailers.ehub_tracking_hash`.)

### Helper function

```typescript
// lib/affiliate.ts
type Retailer = {
  base_url: string;
  ehub_tracking_hash: string;
  utm_campaign: string;
};

export function buildAffiliateUrl(productUrl: string, retailer: Retailer): string {
  const url = new URL(productUrl, retailer.base_url);
  url.searchParams.set('utm_source', 'ehub');
  url.searchParams.set('utm_medium', 'affiliate');
  url.searchParams.set('utm_campaign', retailer.utm_campaign);
  url.searchParams.set('ehub', retailer.ehub_tracking_hash);
  return url.toString();
}
```

### Build-time redirect generation

The challenge: `next.config.js redirects()` runs at build time, so
when admin adds a new product, redirects don't update until next deploy.

**Solution**: load redirects from Supabase at build time. Trigger a
Railway redeploy webhook when admin publishes a new product.

```js
// next.config.js
const { createClient } = require('@supabase/supabase-js');

async function loadAffiliateRedirects() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase
    .from('fivelitru_products')
    .select('slug, affiliate_url')
    .eq('status', 'published')
    .not('affiliate_url', 'is', null);

  if (error) throw error;
  return data.map(p => ({
    source: `/${p.slug}/`,
    destination: p.affiliate_url,
    permanent: false,
  }));
}

module.exports = {
  trailingSlash: true,
  async redirects() {
    return await loadAffiliateRedirects();
  },
};
```

**Alternative for instant updates**: a catch-all route handler that
queries DB on each click. Trades tiny latency for real-time updates.

```typescript
// app/[slug]/route.ts (fallback handler — only if slug matches a product)
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const { data } = await supabase
    .from('fivelitru_products')
    .select('affiliate_url')
    .eq('slug', params.slug)
    .eq('status', 'published')
    .single();

  if (!data?.affiliate_url) return new Response('Not found', { status: 404 });
  return Response.redirect(data.affiliate_url, 302);
}
```

**Decision for Claude Code**: implement the static `next.config.js`
version first (matches WordPress behavior). Add dynamic fallback only
if user reports stale-redirect issues.

---

## 🛠️ ADMIN PANEL

Located at `/admin/*`. Protected by Supabase Auth (magic link to the
user's email — `m.navratil01@seznam.cz` based on WordPress export).

### Auth setup

```typescript
// app/admin/layout.tsx
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

const ALLOWED_EMAILS = (process.env.ADMIN_ALLOWED_EMAILS ?? '')
  .split(',').map(s => s.trim()).filter(Boolean);

export default async function AdminLayout({ children }) {
  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !ALLOWED_EMAILS.includes(user.email!)) {
    redirect('/admin/login');
  }

  return <div className="admin-shell">{children}</div>;
}
```

### Four tabs

#### Tab 1: Můj katalog (`/admin/catalog`)
Lists all rows in `fivelitru_products`. Columns: name, retailer, price,
status, actions (edit, preview, archive). Status badges color-coded.

#### Tab 2: Návrhy z Olivatoru (`/admin/suggestions`)
Queries Olivator products WHERE:
- `volume_ml` BETWEEN 4500 AND 5500
- `status` = 'active'
- `id` NOT IN (SELECT olivator_product_id FROM fivelitru_products)
- `id` NOT IN (SELECT olivator_product_id FROM fivelitru_ignored_suggestions)

Each row shows: image, name, region, variety, retailers available,
price range, Olivator score. Two buttons: "Detail" (modal with full
data) and "Importovat" (kicks off import workflow → Section 13).
Optional "Ignorovat" with reason field (adds to ignored table).

#### Tab 3: Přidat z URL (`/admin/add`)
Single input: paste retailer product URL. Backend:
1. Fetch the URL (server-side)
2. Extract metadata (OG tags, JSON-LD `Product` schema, h1, price)
3. Detect retailer by domain → match to `fivelitru_retailers` (or
   prompt user to create one)
4. Create draft `fivelitru_products` row
5. Redirect to `/admin/drafts/<id>` to confirm scraped data + trigger
   AI review generation

#### Tab 4: Retailers (`/admin/retailers`)
CRUD for `fivelitru_retailers`. Fields: name, base URL, eHub hash, UTM
campaign. Important for when a second eshop is added later.

### Draft editor (`/admin/drafts/[id]`)
Two-pane layout:
- **Left**: editable form (name, brand, price, acidita, …) + AI-generated
  review MDX in a textarea (Monaco/CodeMirror if Claude Code wants nice editing)
- **Right**: live preview rendering the MDX as it will appear on the public site

Actions: "Save draft", "Regenerate review (AI)", "Publish".

On publish:
1. Set `status = 'published'`, `published_at = now()`
2. MDX is already in `review_mdx` column — no filesystem write needed
3. Call `revalidatePath('/<review_slug>/')` for instant public update
4. Trigger Railway redeploy webhook (so `next.config.js redirects()`
   picks up the new affiliate URL — only needed if using static redirects)

### MDX storage decision: DB column, not files

**Reviews are stored in `fivelitru_products.review_mdx` column** (text).

Rationale:
- Admin = pure DB writes, no filesystem/git friction
- Instant updates via `revalidatePath`, no redeploy needed for content edits
- Railway containers have ephemeral filesystem — files written there don't persist

The original 10 reviews migrated from WordPress get inserted into the
DB column during migration (Phase 3). Future AI-generated reviews same.

**Guides stay as files** (`content/guides/*.mdx`) since they're hand-authored
long-form content, not admin-managed.

---

## 🤖 AI REVIEW PIPELINE

### Style reference: existing 5litru reviews

The 10 existing reviews in `pages.json` are the gold standard for style.
Structure (extracted from `/motakis-recenze/`):

1. **Intro paragraph** — storytelling ("Při prvním doušku ucítíte…")
2. **Quick summary box** ("Rychlé shrnutí")
3. **Product specs** (brand, origin, variety, acidita, volume, packaging)
4. **Sensory profile** — rating bars (Jemnost chuti X/5, etc.)
5. **Comparison vs alternatives** (3-column table)
6. **Customer review cards** (3-5 quotes with stars)
7. **FAQ accordion** (5-8 Q&A)
8. **CTA box** ("Koupit za X Kč" / "Srovnat s ostatními")

Average length: ~1,800–2,300 words. Tone: informal, authoritative,
personal recommendations, 💡 callouts for tips.

### Generation workflow

Triggered from admin in two places:
- "Importovat" button on a Olivator suggestion → product data is rich
  (DB record), AI just writes the review
- "Přidat z URL" → scrape URL first, then same pipeline

```typescript
// lib/ai-review.ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateReviewDraft(product: ProductData) {
  // Load 2-3 existing reviews as style references (from DB)
  const styleSamples = await loadStyleSamples();

  const systemPrompt = `Jsi copywriter pro 5litru.cz — niche český web
  o 5L olivových olejích. Píšeš recenze v storytelling stylu: osobní,
  autoritativní, ale neformální. Používáš 💡 callouty pro tipy.
  Vždy v češtině.

  Struktura recenze:
  1. Úvodní storytelling odstavec
  2. Rychlé shrnutí (3-4 věty)
  3. Specifikace produktu
  4. Senzorický profil (5 atributů 1-5)
  5. Srovnání s alternativami
  6. Pro a proti
  7. FAQ (5-8 otázek)
  8. Závěrečné doporučení

  Délka: 1800–2300 slov. Output: MDX s frontmatter (title, description,
  focus_keyword, og_image, schema).`;

  const userMsg = `Napiš recenzi tohoto produktu:

  ${JSON.stringify(product, null, 2)}

  Ukázky stylu z existujících recenzí:

  --- MOTAKIS ---
  ${styleSamples.motakis}

  --- SITIA ---
  ${styleSamples.sitia}

  Napiš novou recenzi v identickém stylu.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',  // or whatever current Sonnet is at build time
    max_tokens: 8000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMsg }],
  });

  await logAiJob({
    product_id: product.id,
    job_type: 'review_draft',
    input: { product, styleSampleKeys: Object.keys(styleSamples) },
    output: response,
    model: response.model,
    cost_usd: estimateCost(response.usage),
  });

  return extractMdx(response.content);
}
```

### Safety: human-in-the-loop

Generated MDX **must** go to a draft state. Auto-publish is NOT allowed:
- AI can hallucinate facts (acidity numbers, harvest years, origins)
- Tone calibration may drift over many generations
- SEO focus keyword needs verification

Admin shows draft, user edits/approves, then publishes.

### Cost estimation

- Claude Sonnet input: ~$3 / 1M tokens; output: ~$15 / 1M tokens
- Per review: ~2K input + ~4K output ≈ $0.07 per review
- 50 reviews over a year ≈ $3.50. Negligible.

### Image alt text generation (bonus)

Same pattern with Haiku for cost. 27 missing alts × ~500 tokens ≈ $0.01
total. Run once as a batch script during Phase 3.

---

## ✅ REVISED IMPLEMENTATION PHASES

### Phase 1 — SKIPPED
Content inventory already done. Copy `data/*.json` into project.

### Phase 2: Next.js + Supabase skeleton
- `npx create-next-app@latest` (TS, Tailwind, App Router, no src/)
- `next.config.js`: `trailingSlash: true` + dynamic redirects loader
- Install: `@supabase/supabase-js`, `@supabase/auth-helpers-nextjs`,
  `gray-matter`, `next-mdx-remote`, `@anthropic-ai/sdk`
- Supabase clients: anon for public, service_role for admin (server only)
- Run schema migrations (Section 10)
- Seed `fivelitru_retailers` + `fivelitru_products` from existing data

### Phase 3: Content migration
- HTML→MDX converter for 18 guides → `content/guides/*.mdx`
- Existing 10 reviews → `fivelitru_products.review_mdx` column
- 5 comparison pages → `content/pages/*.mdx`
- Homepage → `content/pages/homepage.mdx`
- O webu → `content/pages/o-webu.mdx`
- Download 32 images → `public/images/`
- Generate alt texts for 27 missing alts via AI batch

### Phase 4: Public site components
- Brand-perfect components (Section 6)
- `[slug]/page.tsx` resolves slug → guide MDX file, review from DB,
  or content page MDX file (priority order)

### Phase 5: SEO
- `generateMetadata` per page, sourcing from RankMath data in pages.json
- Canonical = `https://5litru.cz/${slug}/`
- JSON-LD per page type (Product, Review, Article, FAQPage)

### Phase 6: Admin panel
- Auth (magic link, allowlist)
- Four tabs (Section 12)
- Draft editor with live preview

### Phase 7: AI integration
- Review generation pipeline (Section 13)
- URL scraper for "Přidat z URL" tab
- AI jobs logging

### Phase 8: Railway deployment
- Same as original prompt
- Add Railway redeploy webhook URL to env vars
- Add `ANTHROPIC_API_KEY` env var
- Add `SUPABASE_SERVICE_ROLE_KEY` env var (server-side only!)

### Phase 9: Testing
- Same as original
- Plus: test admin workflow (suggestion → AI draft → publish →
  public site shows it → affiliate redirect works with utm_campaign=5litru-cz)

### Phase 10: DNS switch
- Same as original

---

## 🔐 ENVIRONMENT VARIABLES

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>  # SERVER ONLY
ANTHROPIC_API_KEY=<claude-api-key>             # SERVER ONLY
RAILWAY_REDEPLOY_WEBHOOK=<webhook-url>         # SERVER ONLY
ADMIN_ALLOWED_EMAILS=m.navratil01@seznam.cz    # comma-separated
```

Never expose service_role or Anthropic keys to the client. Use them
only in server components, API routes, and server actions.

---

## 📊 SUCCESS CRITERIA UPDATE

In addition to original criteria (design, content, SEO, performance):

**Admin & AI:**
- [ ] Login at `/admin/login` works (magic link)
- [ ] Suggestions tab shows 5L oils from Olivator not yet on 5litru
- [ ] "Importovat" creates draft + triggers AI review
- [ ] Draft editor renders MDX live preview
- [ ] Publish updates public site within 60s (revalidate)
- [ ] New product's `/<slug>/` redirect works with `utm_campaign=5litru-cz`

**Affiliate routing:**
- [ ] All 10 existing redirects work
- [ ] New products auto-generate redirects
- [ ] eHub reports show `utm_campaign=5litru-cz` traffic separately
      from olivator-cz

---

## NOTES FOR CLAUDE CODE

- **Do not auto-proceed through phases.** After each phase, show output
  and wait for user confirmation.
- **Do not write tests** unless explicitly asked — user prefers manual
  verification on the Railway preview URL.
- **Keep dependencies minimal.** Tailwind + custom components preferred
  over heavy UI libraries.
- **Czech language everywhere** in UI text, error messages, MDX content.
  Code comments + variable names in English is fine.
- **The user uses Claude Code** (terminal-based dev tool). Use Unix
  paths and commands.
