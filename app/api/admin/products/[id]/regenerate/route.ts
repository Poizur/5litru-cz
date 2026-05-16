// POST /api/admin/products/[id]/regenerate
// Body: { instructions: string }
//
// Re-runs the AI pipeline on an existing draft (or published) review,
// updating review_mdx in-place and resetting status to 'draft' so admin
// can re-publish after the new version is reviewed.

import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { checkRateLimit, getDailyCostUsd, regenerateAiReviewDraft } from '@/lib/ai-review'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = await params

  let body: { instructions?: string; override_cost_limit?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const instructions = (body.instructions ?? '').trim()
  if (!instructions) {
    return NextResponse.json({ error: 'instructions required' }, { status: 400 })
  }

  // Same rate + cost guards as initial generation
  const rateLimit = await checkRateLimit()
  if (!rateLimit.ok) {
    return NextResponse.json({ error: rateLimit.reason }, { status: 429 })
  }

  const dailyCost = await getDailyCostUsd()
  if (dailyCost >= 1.0 && !body.override_cost_limit) {
    return NextResponse.json({
      error: 'daily_cost_limit',
      detail: `Dnešní AI náklady: $${dailyCost.toFixed(3)}. Pošli override_cost_limit: true pro pokračování.`,
      daily_cost_usd: dailyCost,
    }, { status: 402 })
  }

  try {
    const result = await regenerateAiReviewDraft(id, instructions)
    return NextResponse.json({
      ok: true,
      product_id: result.product_id,
      cost_usd: result.cost_usd,
      input_tokens: result.input_tokens,
      output_tokens: result.output_tokens,
      warnings: result.warnings,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'regeneration failed'
    console.error('[regenerate] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
