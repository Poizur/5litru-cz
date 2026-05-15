// POST /api/admin/ai-generate
// Body: { suggestion_id: string }
//
// Triggers the full AI review pipeline for one olivator_suggestion.
// Returns JSON with product_id + cost summary. Admin UI polls for redirect.
//
// Rate limit: 5 drafts / hour (DB-based, no Redis needed).
// Cost warning: responds 402 if daily spend > $1 (admin must confirm override).

import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { checkRateLimit, getDailyCostUsd, generateAiReviewDraft } from '@/lib/ai-review'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // scraping + Claude can take up to 2 min

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { suggestion_id?: string; override_cost_limit?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const { suggestion_id, override_cost_limit } = body
  if (!suggestion_id) {
    return NextResponse.json({ error: 'suggestion_id required' }, { status: 400 })
  }

  // Rate limit
  const rateLimit = await checkRateLimit()
  if (!rateLimit.ok) {
    return NextResponse.json({ error: rateLimit.reason }, { status: 429 })
  }

  // Daily cost warning (soft limit — requires explicit override)
  const dailyCost = await getDailyCostUsd()
  if (dailyCost >= 1.0 && !override_cost_limit) {
    return NextResponse.json({
      error: `daily_cost_limit`,
      detail: `Dnešní náklady na AI: $${dailyCost.toFixed(3)}. Pokračovat? Pošli override_cost_limit: true.`,
      daily_cost_usd: dailyCost,
    }, { status: 402 })
  }

  try {
    const result = await generateAiReviewDraft(suggestion_id)
    return NextResponse.json({
      ok: true,
      product_id: result.product_id,
      job_id: result.job_id,
      slug: result.slug,
      review_slug: result.review_slug,
      input_tokens: result.input_tokens,
      output_tokens: result.output_tokens,
      cost_usd: result.cost_usd,
      warnings: result.warnings,
      edit_url: `/admin/products/${result.product_id}/edit/`,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'generation failed'
    console.error('[ai-generate] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
