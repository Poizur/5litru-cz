# START HERE — 5LITRU.CZ MIGRATION

You are Claude Code working on migrating 5litru.cz from WordPress to
Next.js. The user has prepared all context up front so you don't need
to do exploratory work.

## Files in this directory (read in this order)

1. **`START_HERE.md`** ← you are here. Orientation only.
2. **`5LITRU_MIGRATION_CHAT_PROMPT.md`** — original project brief (business context, goals, strategy)
3. **`5LITRU_MIGRATION_CODE_PROMPT.md`** — original technical implementation plan
4. **`PROMPT_PATCH.md`** ← **CRITICAL: this overrides the code prompt where they conflict.** Read this carefully, it fixes incorrect assumptions in the code prompt (Yoast vs RankMath, etc.) and adds new requirements (admin panel, AI pipeline, affiliate routing).
5. **`data/pages.json`** — all 34 WordPress pages pre-parsed with SEO metadata
6. **`data/images.json`** — 32 image attachments with URLs and alt text
7. **`data/affiliate_links.json`** — 10 eHub affiliate redirects
8. **`data/inventory.md`** — human-readable summary of all the above

## Your first actions

1. Read all four `.md` files in the order above (1, 2, 3, 4). The
   patch (file 4) takes precedence over the code prompt (file 3) where
   they conflict.

2. Confirm you understand:
   - SEO plugin is **RankMath**, not Yoast (patch §1)
   - Design is **brand-perfect**, not pixel-perfect (patch §6)
   - Reviews stored in **DB column**, guides as **MDX files** (patch §12)
   - 5litru is a **standalone project**; Olivator DB is **read-only source of suggestions** (patch §10)
   - Affiliate tracking: same eHub hash for both sites, distinguished by `utm_campaign=5litru-cz` (patch §11)

3. Ask the user three questions before writing any code:
   - **Supabase project**: same instance as Olivator (shared, with `fivelitru_*` prefix), or new dedicated 5litru Supabase project?
   - **Olivator schema**: what's the actual table/column structure of Olivator's `products` table? The patch assumes `volume_ml`, `status`, etc. but you need to verify before writing the suggestions query.
   - **eHub hash**: the patch uses placeholder `cda7c92a602d43e7b6635f22fd9b7298`. The user should provide their actual eHub tracking hash for 5litru, or confirm to extract it from the existing ThirstyLinks in `affiliate_links.json`.

4. After the user answers, start **Phase 2** (Next.js + Supabase
   skeleton) from `PROMPT_PATCH.md §14`. Skip Phase 1 entirely — content
   inventory is already done.

5. After each phase, **stop and show the user the output**. Wait for
   approval before proceeding. Do not auto-chain phases.

## Project conventions

- **Language**: Czech in all user-facing text (UI, errors, MDX content);
  English in code (variable names, comments).
- **Stack**: Next.js 15 App Router, TypeScript, Tailwind, Supabase, MDX.
  No heavy UI libraries unless user agrees.
- **Tests**: don't write them. User verifies manually on Railway preview.
- **Phases**: don't auto-proceed. Stop after each, present output, wait.
- **Filesystem**: Railway containers have ephemeral fs. Anything that
  needs persistence between deploys goes in Supabase, not files.
- **Secrets**: never commit. Server-only keys (service role, Anthropic)
  must never reach client bundles.

## Working directory layout you should create

```
5litru-cz/
├── app/
│   ├── page.tsx                # homepage
│   ├── [slug]/page.tsx         # all non-home content pages
│   ├── admin/
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   ├── catalog/page.tsx
│   │   ├── suggestions/page.tsx
│   │   ├── add/page.tsx
│   │   ├── retailers/page.tsx
│   │   └── drafts/[id]/page.tsx
│   └── api/
│       ├── admin/scrape-url/route.ts
│       ├── admin/import/route.ts
│       └── admin/publish/route.ts
├── components/
│   ├── layout/                 # Header, Footer, Breadcrumbs
│   ├── product/                # ProductCard, ProductHero, RatingDisplay, BadgeSystem
│   ├── content/                # ArticleLayout, FAQ, CalloutBox
│   └── admin/                  # admin-specific components
├── content/
│   ├── guides/                 # 18 .mdx files
│   └── pages/                  # homepage, o-webu, comparisons
├── data/
│   ├── pages.json              # provided
│   ├── images.json             # provided
│   ├── affiliate_links.json    # provided
│   └── inventory.md            # provided
├── lib/
│   ├── supabase.ts             # clients (anon + service)
│   ├── content.ts              # MDX loading
│   ├── affiliate.ts            # URL builder
│   ├── ai-review.ts            # Claude API integration
│   ├── metadata.ts             # SEO helpers
│   └── types.ts
├── scripts/
│   ├── migrate-wp-content.ts   # one-shot: convert pages.json → MDX files + DB rows
│   ├── download-images.ts      # one-shot: fetch 32 images
│   └── generate-alt-texts.ts   # one-shot: AI batch for 27 missing alts
├── public/
│   └── images/                 # 32 WP images
├── supabase/
│   └── migrations/
│       └── 001_initial.sql     # tables, RLS, seeds
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── .env.local.example
```

## What success looks like

When you're done, the user should be able to:

1. Open Railway preview URL and see the site identical (in feel) to
   the current WordPress 5litru.cz, but 3× faster.
2. Log into `/admin/login` with a magic link.
3. Click "Návrhy z Olivatoru" and see 5L oils from Olivator catalog
   they don't have yet.
4. Click "Importovat" on one, wait ~15s for AI to generate a draft,
   review it, hit "Publish."
5. Within 60 seconds, the new review is live at `/<slug>-recenze/`
   and the affiliate redirect at `/<slug>/` works with `utm_campaign=5litru-cz`.

Then user does DNS switch and old WordPress can be deleted.

## When in doubt

- Patch overrides code prompt.
- User overrides anything.
- Keep it simple. The user values working software over feature completeness.
- Czech UI text. English code.
- Brand-perfect, not pixel-perfect.
- Ask before refactoring. Never delete code without permission.

Good luck.
