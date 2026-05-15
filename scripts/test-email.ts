// One-off Resend connectivity check. Sends a small test email to verify:
//   1. RESEND_API_KEY is valid
//   2. RESEND_FROM_EMAIL domain is verified in Resend
//   3. Recipient inbox accepts the message (no SPF/DKIM failures)
//
// Run:
//   env -u ANTHROPIC_API_KEY npx tsx --env-file=.env.local \
//     scripts/test-email.ts <recipient@example.com>

import { sendViaResend, renderAdminAlertHtml } from '../lib/email'

async function main() {
  const to = process.argv[2]
  if (!to || !to.includes('@')) {
    console.error('Usage: scripts/test-email.ts <recipient>')
    process.exit(1)
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('✗ RESEND_API_KEY not set in .env.local — abort')
    process.exit(1)
  }
  console.log('From:', process.env.RESEND_FROM_EMAIL ?? '(default fallback)')
  console.log('To:  ', to)
  console.log()

  const html = renderAdminAlertHtml({
    title: 'Resend test OK',
    bodyHtml:
      '<p>Tento email potvrzuje, že:</p>' +
      '<ul>' +
      '<li>RESEND_API_KEY je platný</li>' +
      '<li>doména <code>redakce.5litru.cz</code> je verifikovaná v Resend</li>' +
      '<li>SPF/DKIM/DMARC průchozí — DNS na Wedos panelu sedí</li>' +
      '</ul>' +
      `<p>Time: <code>${new Date().toISOString()}</code></p>`,
    ctaLabel: 'Otevřít 5litru.cz',
    ctaUrl: 'https://5litru.cz',
  })

  const result = await sendViaResend(to, '[5litru.cz] Resend test', html, { tag: 'system-test' })
  console.log('Result:', JSON.stringify(result, null, 2))
  if (!result.delivered) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
