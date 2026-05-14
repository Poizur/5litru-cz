# 5litru.cz

Niche srovnávač olivových olejů v 5 L balení. **Samostatný projekt** — vlastní Supabase, vlastní Railway, vlastní doména. Žádné runtime sdílení s [olivator.cz](https://olivator.cz); Olivator slouží pouze jako kódová inspirace (stack, patterny).

## Stack

- Next.js 16 (App Router, RSC, Turbopack)
- React 19, TypeScript 5
- Tailwind 4 (`@tailwindcss/postcss`)
- Supabase JS (`@supabase/supabase-js`)
- Anthropic SDK (`@anthropic-ai/sdk`)
- MDX (`next-mdx-remote`, `gray-matter`)

## Setup

```bash
cp .env.example .env.local
# vyplň po vytvoření Supabase projektu (viz Krok 1 níže)

npm install
npm run dev    # http://localhost:3000
```

## Krok 1 — vytvořit Supabase projekt

1. https://supabase.com/dashboard → New project
   - **Name**: `5litru`
   - **Region**: Frankfurt (EU)
   - **Database password**: vygenerovat silný
2. Po vytvoření Settings → API → zkopírovat:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (NIKDY do klienta)
3. Vyplnit `.env.local`

## Krok 2 — aplikovat databázové migrace

V Supabase Dashboard → SQL Editor (nového 5litru projektu, **ne Olivator**):

1. Paste obsah `supabase/migrations/001_initial_schema.sql` → Run  
   → vytvoří 4 tabulky (`retailers`, `products`, `ai_jobs`, `clicks`) + RLS
2. Paste obsah `supabase/migrations/002_seed.sql` → Run  
   → vloží 1 retailer (`Řecko nás baví`) + 10 produktových draftů
3. Po seedu doplnit reálný eHub hash:
   ```sql
   update retailers
      set ehub_tracking_hash = '<reálný-32-znakový-hash>'
    where slug = 'reckonasbavi';
   ```
4. Ověřit:
   ```sql
   select count(*) from products;   -- → 10
   select slug, name from products order by slug;
   ```

## Adresářová struktura

```
app/                  Next.js App Router (skeleton, Fáze 2)
components/           UI komponenty (Fáze 4)
content/              MDX guides + pages (Fáze 3)
data/                 pages.json, images.json, affiliate_links.json (vstupy migrace)
lib/
  supabase.ts         supabaseAdmin (server) + getSupabaseBrowser() (client)
  types.ts            Product, Retailer, AiJob, Click
  affiliate.ts        buildAffiliateUrl()
out/                  Briefing a prompty (dokumentace, runtime nepoužívá)
public/               Statika + 32 WP obrázků (Fáze 3)
supabase/migrations/  SQL schema + seed
```

## Co jsme převzali z Olivatoru jako vzor

| Z Olivatoru | Kde v 5litru | Proč |
|---|---|---|
| `lib/supabase.ts` (sanitizingFetch + admin/browser singletons) | `lib/supabase.ts` 1:1 | Battle-tested fix proti PostgREST control chars které rozbíjely Next.js prerender. |
| Stack: Next 16, React 19, Tailwind 4, Anthropic SDK 0.90 | `package.json` | Konzistence + jisté kombinace verzí které prošly produkcí. |
| `next.config.ts` (image config: 30d cache TTL, Supabase storage pattern) | `next.config.ts` | Klíčové pro Supabase free egress (boti by jinak refetchovali). |
| DB pattern: `status text check (...)` + `default 'draft'` | migrace `products.status`, `ai_jobs.status` | Jednoduché enum bez Postgres ENUM type. |
| `updated_at` trigger | `001_initial_schema.sql` | Standard pattern, žádné aplikační časové ošetření. |
| RLS pattern: anon read + service_role full | `001_initial_schema.sql` | Jasná separace public/admin přístupu. |

**Žádné runtime spojení** — Olivator URL, klíče, ani jeho tabulky se z 5litru kódu nevolá.

## Affiliate tracking

`lib/affiliate.ts` skládá URL pattern z patche §11:

```ts
buildAffiliateUrl('https://shop.reckonasbavi.cz/<path>/', retailer)
// → https://shop.reckonasbavi.cz/<path>/?utm_source=ehub&utm_medium=affiliate
//   &utm_campaign=5litru-cz&ehub=<EHUB_HASH>
```

Reporty v eHub se rozeznají přes `utm_campaign=5litru-cz`.

## Fáze implementace

- [x] **Fáze 2** — Next.js + Supabase skeleton, migrace připravené
- [ ] Fáze 3 — Content migrace (HTML → MDX, 32 obrázků, AI alt texty)
- [ ] Fáze 4 — Public site komponenty (brand-perfect)
- [ ] Fáze 5 — SEO metadata + Schema.org JSON-LD
- [ ] Fáze 6 — Admin panel (3 záložky, magic link)
- [ ] Fáze 7 — AI review pipeline (Claude Sonnet)
- [ ] Fáze 8 — Railway deploy
- [ ] Fáze 9 — Testing + Railway preview
- [ ] Fáze 10 — DNS switch

Patch (`out/PROMPT_PATCH.md`) má přednost před `out/5LITRU_MIGRATION_CODE_PROMPT.md`.

### Admin záložky (Fáze 6)

V MVP má admin tři záložky:

1. **Můj katalog** — list všech řádků v `products` s editací a status badges
2. **Přidat z URL** — paste retailer URL, scrape OG/JSON-LD/h1, vytvoří draft + spustí AI review pipeline (Fáze 7)
3. **Retailers** — CRUD pro tabulku `retailers`

Pokud se v budoucnu vrátí potřeba „návrhů z Olivatoru", půjde to přes ruční CSV/JSON import — žádná live cross-project query.

## Affiliate URL formát — otevřená otázka

Současné WordPress odkazy v `data/affiliate_links.json` používají **starý formát** (eHub clickthrough):
```
https://ehub.cz/system/scripts/click.php?a_aid=...&a_bid=...&desturl=...
```

Patch §11 (a tento projekt) používá **nový formát** (přímý retailer URL + `?ehub=<hash>`):
```
https://shop.reckonasbavi.cz/<path>/?utm_source=ehub&...&ehub=<hash>
```

Rozhodnutí: nový formát. Skutečný 32-znakový hash doplnit z eHub dashboardu před deployem.
