// Email notifications via Resend.com.
// Mirrors Olivator's lib/email.ts pattern: direct fetch to Resend API
// (no SDK lock-in), inline HTML strings with brand-styled tables.
//
// Setup (one-time, before first send):
//   1. Resend → Domains → Add `redakce.5litru.cz` → copy DNS records
//      → paste into Wedos DNS panel (DKIM, SPF, MX, DMARC)
//   2. Resend → API Keys → Create new (Sending access, domain-scoped to
//      redakce.5litru.cz) → put into RESEND_API_KEY
//   3. RESEND_FROM_EMAIL='5litru.cz <info@redakce.5litru.cz>'
//
// If RESEND_API_KEY is missing, send() returns ok=true delivered=false
// (degrades gracefully in dev / before DNS verification finishes).

const RESEND_FROM =
  process.env.RESEND_FROM_EMAIL || '5litru.cz <onboarding@resend.dev>'

export interface SendResult {
  ok: boolean
  delivered: boolean
  error?: string
  /** Resend message id, present iff delivered = true */
  id?: string
}

export async function sendViaResend(
  to: string,
  subject: string,
  html: string,
  options?: { replyTo?: string; tag?: string },
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return {
      ok: true,
      delivered: false,
      error: 'RESEND_API_KEY not set — skipping send',
    }
  }
  try {
    const body: Record<string, unknown> = {
      from: RESEND_FROM,
      to: [to],
      subject,
      html,
    }
    if (options?.replyTo) body.reply_to = options.replyTo
    if (options?.tag) body.tags = [{ name: 'category', value: options.tag }]

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Resend error')
      return { ok: false, delivered: false, error: errorText.slice(0, 240) }
    }
    const payload = (await res.json().catch(() => null)) as { id?: string } | null
    return { ok: true, delivered: true, id: payload?.id }
  } catch (err) {
    return {
      ok: false,
      delivered: false,
      error: err instanceof Error ? err.message : 'Fetch failed',
    }
  }
}

// ---------- Brand-styled HTML helpers (5litru palette) ----------

const BRAND = {
  olive: '#3d5220',
  oliveLight: '#5a7830',
  gold: '#c4973e',
  goldLight: '#e8c97a',
  dark: '#141a0d',
  cream: '#f8f6f0',
  text: '#2a3318',
  muted: '#7a8a65',
  border: 'rgba(61,82,32,0.15)',
}

function emailShell(inner: string): string {
  return `<!DOCTYPE html>
<html lang="cs"><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${BRAND.text};max-width:600px;margin:0 auto;padding:24px;background:${BRAND.cream}">
  <div style="background:white;border-radius:12px;padding:32px;border:1px solid ${BRAND.border}">
    ${inner}
    <p style="font-size:11px;color:${BRAND.muted};margin-top:32px;border-top:1px solid ${BRAND.border};padding-top:16px">
      Generováno automaticky z 5litru.cz. Odpovědi → info@5litru.cz.
    </p>
  </div>
</body></html>`.trim()
}

export function renderAdminAlertHtml(opts: {
  title: string
  bodyHtml: string
  ctaLabel?: string
  ctaUrl?: string
}): string {
  const cta =
    opts.ctaLabel && opts.ctaUrl
      ? `<div style="text-align:center;margin-top:24px">
           <a href="${opts.ctaUrl}" style="display:inline-block;background:${BRAND.olive};color:white;text-decoration:none;padding:12px 24px;border-radius:4px;font-size:13px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase">
             ${opts.ctaLabel}
           </a>
         </div>`
      : ''
  return emailShell(`
    <h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;color:${BRAND.olive};margin:0 0 16px">
      ${opts.title}
    </h1>
    <div style="font-size:14px;line-height:1.6">${opts.bodyHtml}</div>
    ${cta}
  `)
}
