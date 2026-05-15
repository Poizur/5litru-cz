// Resend webhook receiver — Svix-signed events (email.delivered, .opened,
// .clicked, .bounced, .complained). Mirrors olivator pattern but writes
// to a single `email_events` table (no newsletter sends tracking yet).
//
// Setup: Resend dashboard → Webhooks → URL: https://5litru.cz/api/webhooks/resend
// Set RESEND_WEBHOOK_SECRET=whsec_… for signature verification (production).
//
// Without RESEND_WEBHOOK_SECRET the endpoint accepts all events (dev fallback).

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface ResendWebhookPayload {
  type: string
  data: {
    email_id: string
    to?: string[]
    subject?: string
    click?: { link: string; userAgent?: string }
    bounce?: { reason?: string }
  }
  created_at: string
}

const TYPE_MAP: Record<string, string> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.delivery_delayed': 'delayed',
}

function verifySvixSignature(
  rawBody: string,
  svixId: string | null,
  svixTimestamp: string | null,
  svixSignature: string | null,
): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    console.warn('[resend webhook] RESEND_WEBHOOK_SECRET not set — accepting without verification')
    return true
  }
  if (!svixId || !svixTimestamp || !svixSignature) return false

  // Replay protection: reject if timestamp older than 5 minutes
  const now = Math.floor(Date.now() / 1000)
  const ts = Number(svixTimestamp)
  if (Number.isNaN(ts) || Math.abs(now - ts) > 300) return false

  const secretKey = secret.startsWith('whsec_') ? secret.slice(6) : secret
  let secretBytes: Buffer
  try {
    secretBytes = Buffer.from(secretKey, 'base64')
  } catch {
    return false
  }
  const signedPayload = `${svixId}.${svixTimestamp}.${rawBody}`
  const expected = crypto.createHmac('sha256', secretBytes).update(signedPayload).digest('base64')

  // svix-signature may contain multiple sigs ("v1,sigA v1,sigB")
  const sigs = svixSignature.split(' ').map((s) => s.split(',')[1]).filter(Boolean)
  for (const sig of sigs) {
    if (sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return true
    }
  }
  return false
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const ok = verifySvixSignature(
    rawBody,
    request.headers.get('svix-id'),
    request.headers.get('svix-timestamp'),
    request.headers.get('svix-signature'),
  )
  if (!ok) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: ResendWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventType = TYPE_MAP[payload.type]
  if (!eventType) {
    return NextResponse.json({ ok: true, ignored: payload.type })
  }
  if (!payload.data?.email_id) {
    return NextResponse.json({ error: 'Missing email_id' }, { status: 400 })
  }

  // Best-effort log: skip silently if email_events table doesn't exist yet
  // (table is created by a later migration once we add admin notifications).
  try {
    await supabaseAdmin.from('email_events').insert({
      resend_message_id: payload.data.email_id,
      event_type: eventType,
      subject: payload.data.subject ?? null,
      recipient: payload.data.to?.[0] ?? null,
      link_url: payload.data.click?.link ?? null,
      bounce_reason: payload.data.bounce?.reason ?? null,
      occurred_at: payload.created_at,
    })
  } catch {
    // table missing — accepted but unlogged
  }

  return NextResponse.json({ ok: true })
}
