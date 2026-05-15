// One-off: write real eHub tracking hash to retailers.ehub_tracking_hash
// for the 'reckonasbavi' row. Hash supplied by user from eHub dashboard.
//
// Run: env -u ANTHROPIC_API_KEY npx tsx --env-file=.env.local scripts/db-update-ehub-hash.ts <hash>

import { createClient } from '@supabase/supabase-js'

async function main() {
  const hash = process.argv[2]
  if (!hash || !/^[a-f0-9]{32}$/i.test(hash)) {
    console.error('Usage: ... db-update-ehub-hash.ts <32-char-hex-hash>')
    process.exit(1)
  }
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  const { data, error } = await sb
    .from('retailers')
    .update({ ehub_tracking_hash: hash })
    .eq('slug', 'reckonasbavi')
    .select('slug, name, ehub_tracking_hash, utm_campaign')
  if (error) {
    console.error('update error:', error.message)
    process.exit(1)
  }
  if (!data || data.length === 0) {
    console.error('no retailer with slug=reckonasbavi found')
    process.exit(1)
  }
  console.log('updated row:', JSON.stringify(data[0], null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })
