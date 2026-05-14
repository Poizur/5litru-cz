// Applies all SQL files in supabase/migrations/ to the remote Supabase
// project via direct Postgres connection. Idempotent thanks to "create
// table if not exists" + "on conflict do update" patterns in the SQL.
//
// Run with:
//   npx tsx --env-file=.env.local scripts/db-push.ts
//
// Requires SUPABASE_DB_PASSWORD env var. Project ref is parsed from
// NEXT_PUBLIC_SUPABASE_URL.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'

function parseProjectRef(supabaseUrl: string): string {
  const host = new URL(supabaseUrl).hostname // e.g. xpilzmjiprvtquvzjegx.supabase.co
  return host.split('.')[0]
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const dbPassword = process.env.SUPABASE_DB_PASSWORD
  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL missing')
  if (!dbPassword) throw new Error('SUPABASE_DB_PASSWORD missing')

  const projectRef = parseProjectRef(supabaseUrl)
  // Use the Supabase Pooler (session mode, port 5432). Direct connection at
  // db.<ref>.supabase.co:5432 is IPv6-only on newer Supabase projects, which
  // breaks on IPv4-only networks. Pooler exposes IPv4 and supports full
  // session-mode SQL incl. migrations.
  const poolerRegion = process.env.SUPABASE_POOLER_REGION ?? 'eu-central-1'
  const connectionString =
    `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}` +
    `@aws-0-${poolerRegion}.pooler.supabase.com:5432/postgres`

  const migrationsDir = join(process.cwd(), 'supabase', 'migrations')
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  console.log(`→ Project: ${projectRef}`)
  console.log(`→ Migrations to apply: ${files.length}`)
  files.forEach((f) => console.log(`   - ${f}`))

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()
  console.log('✓ Connected\n')

  for (const file of files) {
    const path = join(migrationsDir, file)
    const sql = readFileSync(path, 'utf8')
    console.log(`▸ Applying ${file} (${sql.length} chars)`)
    try {
      await client.query(sql)
      console.log(`  ✓ OK`)
    } catch (err) {
      console.error(`  ✗ FAILED: ${(err as Error).message}`)
      await client.end()
      process.exit(1)
    }
  }

  await client.end()
  console.log('\n✓ All migrations applied.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
