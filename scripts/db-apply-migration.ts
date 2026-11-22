// Aplikuje JEDEN migrační soubor na vzdálenou Supabase DB (5litru) přes pooler.
// Na rozdíl od db-push.ts nepouští všechny migrace znovu.
//
//   npx tsx --env-file=.env.local scripts/db-apply-migration.ts supabase/migrations/20261122_olivator_score.sql
//
// Potřebuje NEXT_PUBLIC_SUPABASE_URL + SUPABASE_DB_PASSWORD (+ volitelně SUPABASE_POOLER_REGION).
// Po úspěchu spusť `npm run schema:snapshot`, jinak prebuild check-schema neprojde.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Client } from 'pg'

async function main() {
  const file = process.argv[2]
  if (!file) throw new Error('Použití: db-apply-migration.ts <cesta k .sql>')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const dbPassword = process.env.SUPABASE_DB_PASSWORD
  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL missing')
  if (!dbPassword) throw new Error('SUPABASE_DB_PASSWORD missing')

  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  const region = process.env.SUPABASE_POOLER_REGION ?? 'eu-west-1'
  // Session mode (5432) — DDL i COMMENT bez omezení transaction poolingu
  const connectionString =
    `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@aws-0-${region}.pooler.supabase.com:5432/postgres`

  const sql = readFileSync(resolve(process.cwd(), file), 'utf8')
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 })
  await client.connect()
  console.log(`→ ${projectRef} via aws-0-${region} — applying ${file} (${sql.length} chars)`)
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('COMMIT')
    console.log('✓ OK')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined)
    console.error('✗ FAILED:', (err as Error).message)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
