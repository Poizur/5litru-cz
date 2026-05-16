// Creates product_images table via direct DB connection.
// Run: npx tsx --env-file=.env.local scripts/db-migrate-product-images.ts
import { Pool } from 'pg'

const SQL = `
CREATE TABLE IF NOT EXISTS product_images (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_slug TEXT NOT NULL REFERENCES products(slug) ON DELETE CASCADE,
  url          TEXT NOT NULL,
  alt          TEXT NOT NULL DEFAULT '',
  position     INTEGER NOT NULL DEFAULT 0,
  source       TEXT NOT NULL DEFAULT 'eshop',
  is_hero      BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_slug, url)
);
CREATE INDEX IF NOT EXISTS product_images_slug_pos_idx ON product_images (product_slug, position);
`

async function main() {
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!.split('//')[1].split('.')[0]
  const password = process.env.SUPABASE_DB_PASSWORD!
  const region = process.env.SUPABASE_POOLER_REGION ?? 'eu-west-1'

  const pool = new Pool({
    host: `aws-0-${region}.pooler.supabase.com`,
    port: 5432,
    database: 'postgres',
    user: `postgres.${projectRef}`,
    password,
    ssl: { rejectUnauthorized: false },
  })

  const client = await pool.connect()
  try {
    await client.query(SQL)
    console.log('✓ product_images table created (or already existed)')
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(e => { console.error(e.message); process.exit(1) })
