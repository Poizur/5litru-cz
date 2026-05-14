// Probe which Supabase pooler region serves this project.
// Run: npx tsx --env-file=.env.local scripts/probe-pooler.ts
import { Client } from 'pg'

const REGIONS = [
  'eu-central-1', // Frankfurt
  'eu-west-1',    // Ireland
  'eu-west-2',    // London
  'eu-west-3',    // Paris
  'eu-north-1',   // Stockholm
  'eu-central-2', // Zurich
]

async function probe(region: string): Promise<{ region: string; ok: boolean; error?: string }> {
  const host = `aws-0-${region}.pooler.supabase.com`
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!.match(/https:\/\/([^.]+)/)![1]
  const password = process.env.SUPABASE_DB_PASSWORD!
  const cs = `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@${host}:5432/postgres`
  const c = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 })
  try {
    await c.connect()
    await c.query('select 1')
    await c.end()
    return { region, ok: true }
  } catch (e) {
    try { await c.end() } catch {}
    return { region, ok: false, error: (e as Error).message }
  }
}

async function main() {
  for (const r of REGIONS) {
    process.stdout.write(`Probing aws-0-${r}.pooler.supabase.com:5432 ... `)
    const res = await probe(r)
    if (res.ok) {
      console.log('✓ CONNECTED — use this region')
      console.log(`\nSet SUPABASE_POOLER_REGION=${res.region} in .env.local`)
      process.exit(0)
    } else {
      console.log(`✗ ${res.error?.slice(0, 80)}`)
    }
  }
  console.log('\nNo region worked. Check project ref / password.')
  process.exit(1)
}

main()
