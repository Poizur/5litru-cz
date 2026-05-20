// Olivator → 5litru sync.
//
// Two outputs:
//   1. price updates on 5litru.products (match by product_url)
//   2. new suggestions in olivator_suggestions for unmatched Olivator 5L
//      products that ARE sold by reckonasbavi (our affiliate partner)
//
// Every run is logged to price_sync_log. Triggers email via lib/email.ts
// when new suggestions are added; the email gracefully no-ops if
// RESEND_API_KEY is missing.

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from './supabase'
import { sendViaResend, renderAdminAlertHtml } from './email'
import { generateAiReviewDraft } from './ai-review'

export type SyncTrigger = 'cron' | 'admin_manual' | 'cli_test'

export interface SyncSummary {
  ok: boolean
  log_id: number | null
  status: 'success' | 'partial' | 'failed'
  duration_ms: number
  products_checked: number
  prices_updated: number
  prices_unchanged: number
  prices_missing: number
  suggestions_added: number
  suggestions_skipped: number
  errors: string[]
  /** When suggestions_added > 0, the new rows (snapshot for email + admin redirect). */
  new_suggestions: Array<{
    olivator_product_id: string
    name: string
    olivator_score: number | null
    origin_country: string | null
    primary_offer_price: number | null
  }>
}

const RECKONASBAVI_SLUG = 'reckonasbavi'
const VOLUME_MIN = 4500
const VOLUME_MAX = 5500

function olivatorClient(): SupabaseClient {
  const url = process.env.OLIVATOR_SUPABASE_URL
  const key = process.env.OLIVATOR_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('OLIVATOR_SUPABASE_URL / OLIVATOR_SUPABASE_ANON_KEY not set')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

async function maybeNotifyNewSuggestions(
  summary: SyncSummary,
): Promise<{ sent: boolean; error?: string }> {
  if (summary.new_suggestions.length === 0) return { sent: false }
  const recipient = process.env.ADMIN_NOTIFICATION_EMAIL
  if (!recipient) return { sent: false, error: 'ADMIN_NOTIFICATION_EMAIL not set' }

  const n = summary.new_suggestions.length
  const subject = n === 1
    ? `🫒 5litru.cz: Nový olej v Olivatoru — ${summary.new_suggestions[0].name}`
    : `🫒 5litru.cz: ${n} nových olejů v Olivatoru`

  const listHtml = summary.new_suggestions
    .map((s) => {
      const score = s.olivator_score !== null ? `<strong>${s.olivator_score}</strong>` : '—'
      const price = s.primary_offer_price !== null
        ? `${Math.round(s.primary_offer_price).toLocaleString('cs-CZ')} Kč`
        : '—'
      const origin = s.origin_country ?? '—'
      return `<li style="margin:6px 0">
        <strong>${s.name}</strong>
        <span style="color:#7a8a65;font-size:12px"> · skóre ${score} · ${origin} · ${price}</span>
      </li>`
    })
    .join('')

  const html = renderAdminAlertHtml({
    title: n === 1 ? 'Nový olej k posouzení' : `${n} nových olejů k posouzení`,
    bodyHtml: `
      <p>Olivator katalog má ${n === 1 ? 'jeden nový olej' : `${n} nových olejů`} v 5L balení,
      ${n === 1 ? 'který reckonasbavi nabízí' : 'které reckonasbavi nabízí'} a ${n === 1 ? 'není' : 'nejsou'} ještě na 5litru.cz.</p>
      <ul style="padding-left:20px;margin:16px 0">${listHtml}</ul>
      <p style="color:#7a8a65;font-size:13px">Sync trvání: ${summary.duration_ms} ms · prices_updated: ${summary.prices_updated} / ${summary.products_checked}</p>
    `,
    ctaLabel: 'Otevřít návrhy',
    ctaUrl: 'https://5litru.cz/admin/suggestions/',
  })

  const result = await sendViaResend(recipient, subject, html, {
    replyTo: process.env.RESEND_REPLY_TO,
    tag: 'olivator-sync-new-suggestions',
  })
  return { sent: result.delivered, error: result.error }
}

export async function runOlivatorSync(triggeredBy: SyncTrigger): Promise<SyncSummary> {
  const startedAt = Date.now()
  const errors: string[] = []

  // 1. Open log entry — survives any later failure
  const { data: logRow } = await supabaseAdmin
    .from('price_sync_log')
    .insert({ status: 'running', triggered_by: triggeredBy })
    .select('id')
    .single()
  const logId = (logRow?.id as number | undefined) ?? null

  const finalize = async (
    summary: Omit<SyncSummary, 'ok' | 'log_id' | 'duration_ms' | 'status'>,
    status: 'success' | 'partial' | 'failed',
  ): Promise<SyncSummary> => {
    const duration = Date.now() - startedAt
    const full: SyncSummary = { ...summary, ok: status !== 'failed', log_id: logId, duration_ms: duration, status }
    if (logId !== null) {
      await supabaseAdmin
        .from('price_sync_log')
        .update({
          finished_at: new Date().toISOString(),
          products_checked: full.products_checked,
          prices_updated: full.prices_updated,
          prices_unchanged: full.prices_unchanged,
          prices_missing: full.prices_missing,
          suggestions_added: full.suggestions_added,
          suggestions_skipped: full.suggestions_skipped,
          duration_ms: duration,
          status,
          error_summary: errors.length > 0 ? errors[0].slice(0, 200) : null,
          errors_json: errors.length > 0 ? errors.slice(0, 20) : null,
        })
        .eq('id', logId)
    }
    return full
  }

  let oliv: SupabaseClient
  try {
    oliv = olivatorClient()
  } catch (e) {
    errors.push((e as Error).message)
    return finalize(
      {
        products_checked: 0, prices_updated: 0, prices_unchanged: 0, prices_missing: 0,
        suggestions_added: 0, suggestions_skipped: 0, errors, new_suggestions: [],
      },
      'failed',
    )
  }

  // 2. Pull 5L Olivator products with their offers (single query, embedded)
  let olivProducts: Array<{
    id: string
    slug: string
    name: string
    brand_slug: string | null
    origin_country: string | null
    origin_region: string | null
    variety: string | null
    type: string | null
    volume_ml: number | null
    acidity: number | null
    polyphenols: number | null
    olivator_score: number | null
    image_url: string | null
    offers: Array<{
      product_url: string | null
      price: number | null
      retailer: { slug: string | null } | { slug: string | null }[] | null
    }>
  }> = []
  {
    const { data, error } = await oliv
      .from('products')
      .select(`
        id, slug, name, brand_slug, origin_country, origin_region, variety, type,
        volume_ml, acidity, polyphenols, olivator_score, image_url,
        offers:product_offers(product_url, price, retailer:retailers(slug))
      `)
      .eq('status', 'active')
      .gte('volume_ml', VOLUME_MIN)
      .lte('volume_ml', VOLUME_MAX)
      .limit(500)
    if (error) {
      errors.push(`olivator query: ${error.message}`)
      return finalize(
        {
          products_checked: 0, prices_updated: 0, prices_unchanged: 0, prices_missing: 0,
          suggestions_added: 0, suggestions_skipped: 0, errors, new_suggestions: [],
        },
        'failed',
      )
    }
    olivProducts = (data ?? []) as typeof olivProducts
  }

  // Build URL → offer index for price-sync lookup
  type FlatOffer = {
    olivator_product_id: string
    product_url: string
    price: number | null
    retailer_slug: string | null
  }
  const offersByUrl = new Map<string, FlatOffer>()
  for (const p of olivProducts) {
    for (const o of p.offers ?? []) {
      if (!o.product_url) continue
      const rs = Array.isArray(o.retailer) ? o.retailer[0]?.slug ?? null : o.retailer?.slug ?? null
      offersByUrl.set(o.product_url, {
        olivator_product_id: p.id,
        product_url: o.product_url,
        price: o.price,
        retailer_slug: rs,
      })
    }
  }

  // 3. Update prices on 5litru products
  let products_checked = 0, prices_updated = 0, prices_unchanged = 0, prices_missing = 0
  const { data: ourProducts, error: ourErr } = await supabaseAdmin
    .from('products')
    .select('id, slug, product_url, price_czk')
    .not('product_url', 'is', null)
  if (ourErr) errors.push(`5litru products read: ${ourErr.message}`)

  // Track which Olivator product_ids are present in 5litru (via URL match) to exclude from suggestions
  const matchedOlivatorProductIds = new Set<string>()

  for (const p of ourProducts ?? []) {
    products_checked++
    const url = p.product_url as string
    const offer = offersByUrl.get(url)
    if (!offer) {
      prices_missing++
      continue
    }
    matchedOlivatorProductIds.add(offer.olivator_product_id)
    if (offer.price === null || offer.price === undefined) {
      prices_unchanged++
      continue
    }
    const newPrice = Number(offer.price)
    const oldPrice = p.price_czk !== null && p.price_czk !== undefined ? Number(p.price_czk) : null
    if (oldPrice === newPrice) {
      prices_unchanged++
      continue
    }
    const { error: upErr } = await supabaseAdmin
      .from('products')
      .update({ price_czk: newPrice })
      .eq('id', p.id)
    if (upErr) {
      errors.push(`update price ${p.slug}: ${upErr.message}`)
      prices_unchanged++
    } else {
      prices_updated++
    }
  }

  // 4. Build suggestion candidates: Olivator 5L products that
  //    (a) HAVE a reckonasbavi offer
  //    (b) AREN'T already on 5litru (via URL match)
  const newSuggestionsPayload: Array<Record<string, unknown>> = []
  const newSuggestionsForEmail: SyncSummary['new_suggestions'] = []
  let suggestions_added = 0, suggestions_skipped = 0

  for (const p of olivProducts) {
    if (matchedOlivatorProductIds.has(p.id)) {
      suggestions_skipped++
      continue
    }
    // Find reckonasbavi offer for this product
    const reckonas = (p.offers ?? []).find((o) => {
      const rs = Array.isArray(o.retailer) ? o.retailer[0]?.slug : o.retailer?.slug
      return rs === RECKONASBAVI_SLUG
    })
    if (!reckonas || !reckonas.product_url) {
      suggestions_skipped++
      continue
    }

    newSuggestionsPayload.push({
      olivator_product_id: p.id,
      olivator_slug: p.slug,
      name: p.name,
      brand_slug: p.brand_slug,
      origin_country: p.origin_country,
      origin_region: p.origin_region,
      variety: p.variety,
      type: p.type,
      volume_ml: p.volume_ml,
      acidity: p.acidity,
      polyphenols: p.polyphenols,
      olivator_score: p.olivator_score,
      image_url: p.image_url,
      primary_retailer_slug: RECKONASBAVI_SLUG,
      primary_offer_price: reckonas.price,
      primary_offer_url: reckonas.product_url,
      status: 'new',
    })
  }

  if (newSuggestionsPayload.length > 0) {
    // Upsert with ignoreDuplicates so re-runs don't re-insert (PK = olivator_product_id)
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('olivator_suggestions')
      .upsert(newSuggestionsPayload, {
        onConflict: 'olivator_product_id',
        ignoreDuplicates: true,
      })
      .select('olivator_product_id, name, olivator_score, origin_country, primary_offer_price, status')
    if (insErr) {
      errors.push(`upsert suggestions: ${insErr.message}`)
    } else {
      // Only count rows the upsert actually inserted (status='new'). ignoreDuplicates
      // skips existing rows so `inserted` only contains brand-new ones.
      const truelyNew = (inserted ?? []).filter((r: { status?: string }) => r.status === 'new')
      suggestions_added = truelyNew.length
      suggestions_skipped += newSuggestionsPayload.length - truelyNew.length
      for (const r of truelyNew) {
        newSuggestionsForEmail.push({
          olivator_product_id: r.olivator_product_id as string,
          name: r.name as string,
          olivator_score: (r.olivator_score as number | null) ?? null,
          origin_country: (r.origin_country as string | null) ?? null,
          primary_offer_price: (r.primary_offer_price as number | null) ?? null,
        })
      }
    }
  }

  // 4b. Auto-generate AI drafts for each brand-new suggestion. Sequential
  // (one at a time) so we don't OOM the Railway worker — each generation
  // holds cheerio DOMs + image buffers + a Claude stream in memory.
  // Each draft costs ~$0.07 and takes 30-60 s — capped by checkRateLimit()
  // inside generateAiReviewDraft (5/h). Disable via AUTO_GENERATE_DRAFTS=false.
  let drafts_created = 0
  if (process.env.AUTO_GENERATE_DRAFTS !== 'false' && newSuggestionsForEmail.length > 0) {
    for (const s of newSuggestionsForEmail) {
      try {
        await generateAiReviewDraft(s.olivator_product_id)
        drafts_created++
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e)
        errors.push(`auto-draft ${s.name.slice(0, 40)}: ${reason}`)
        console.warn(`[olivator-sync] auto-draft failed:`, reason)
      }
    }
  }

  const status: 'success' | 'partial' | 'failed' =
    errors.length === 0 ? 'success' : errors.length < 5 ? 'partial' : 'failed'

  console.log(`[olivator-sync] drafts_created=${drafts_created} of ${newSuggestionsForEmail.length} new suggestions`)

  const summary = await finalize(
    {
      products_checked, prices_updated, prices_unchanged, prices_missing,
      suggestions_added, suggestions_skipped, errors,
      new_suggestions: newSuggestionsForEmail,
    },
    status,
  )

  // 5. Notification email — only if some suggestions failed to auto-draft
  // (successful drafts already triggered per-draft emails via ai-review.ts).
  // When everything auto-drafted, this email would just be noise.
  const allDrafted = drafts_created === newSuggestionsForEmail.length
  if (!allDrafted) {
    try {
      await maybeNotifyNewSuggestions(summary)
    } catch (e) {
      console.warn('[olivator-sync] email notification failed:', e)
    }
  }

  return summary
}
