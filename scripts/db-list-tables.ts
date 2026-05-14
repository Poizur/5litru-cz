// List actual tables in public schema via direct pg connection.
// Run: npx tsx --env-file=.env.local scripts/db-list-tables.ts
import { Client } from 'pg'

async function main() {
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!.match(/https:\/\/([^.]+)/)![1]
  const password = process.env.SUPABASE_DB_PASSWORD!
  const region = process.env.SUPABASE_POOLER_REGION ?? 'eu-west-1'
  const cs = `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-${region}.pooler.supabase.com:5432/postgres`

  const c = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false } })
  await c.connect()
  const r = await c.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
    order by table_name
  `)
  console.log('Tables in public schema:')
  for (const row of r.rows) console.log(`  - ${row.table_name}`)
  await c.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
