// Creates guide_images table for Phase C Unsplash integration.
// Run: npx tsx --env-file=.env.local scripts/db-migrate-guide-images.ts
import { Pool } from 'pg'

const SQL = `
CREATE TABLE IF NOT EXISTS guide_images (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  guide_slug       TEXT NOT NULL,
  position         INTEGER NOT NULL,  -- 0, 1, 2 (after which H2)
  h2_heading       TEXT NOT NULL,
  unsplash_id      TEXT NOT NULL,
  local_path       TEXT NOT NULL,     -- /images/guides/<slug>/<file>.webp
  unsplash_url     TEXT NOT NULL,
  alt_cs           TEXT NOT NULL,
  photographer     TEXT NOT NULL,
  photographer_url TEXT NOT NULL,
  query_used       TEXT NOT NULL,
  was_fallback     BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guide_slug, position)
);
CREATE INDEX IF NOT EXISTS guide_images_slug_idx ON guide_images (guide_slug);
`

async function main() {
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!.split('//')[1].split('.')[0]
  const pool = new Pool({
    host: `aws-0-${process.env.SUPABASE_POOLER_REGION ?? 'eu-west-1'}.pooler.supabase.com`,
    port: 5432, database: 'postgres',
    user: `postgres.${projectRef}`,
    password: process.env.SUPABASE_DB_PASSWORD!,
    ssl: { rejectUnauthorized: false },
  })
  const client = await pool.connect()
  try {
    await client.query(SQL)
    console.log('✓ guide_images table ready')
  } finally {
    client.release(); await pool.end()
  }
}
main().catch(e => { console.error(e.message); process.exit(1) })
