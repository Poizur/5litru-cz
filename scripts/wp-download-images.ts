// Downloads 32 WordPress images from data/images.json into public/images/.
// Mirrors the file_path structure (year/month subdirs). Idempotent — skips
// files that already exist on disk.
//
// Run: npx tsx scripts/wp-download-images.ts

import { mkdir, writeFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'

interface ImageRow {
  id: string
  file_path: string       // e.g. "2025/11/motakis-...jpg"
  public_url: string      // e.g. "https://5litru.cz/wp-content/uploads/..."
  alt_text: string
  title: string
}

const PUBLIC_IMAGES_DIR = join(process.cwd(), 'public', 'images')

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true } catch { return false }
}

async function downloadOne(img: ImageRow): Promise<{ id: string; status: 'ok' | 'skip' | 'fail'; err?: string; bytes?: number }> {
  const dest = join(PUBLIC_IMAGES_DIR, img.file_path)
  if (await fileExists(dest)) return { id: img.id, status: 'skip' }
  try {
    await mkdir(dirname(dest), { recursive: true })
    const res = await fetch(img.public_url)
    if (!res.ok) return { id: img.id, status: 'fail', err: `HTTP ${res.status}` }
    const buf = Buffer.from(await res.arrayBuffer())
    await writeFile(dest, buf)
    return { id: img.id, status: 'ok', bytes: buf.length }
  } catch (e) {
    return { id: img.id, status: 'fail', err: (e as Error).message }
  }
}

async function main() {
  const images: ImageRow[] = (await import('../data/images.json', { with: { type: 'json' } })).default
  console.log(`→ ${images.length} images to process`)

  let ok = 0, skip = 0, fail = 0, totalBytes = 0
  const failures: { id: string; err: string }[] = []

  // Concurrency limit: 8 parallel
  const queue = [...images]
  const workers = Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const img = queue.shift()
      if (!img) return
      const r = await downloadOne(img)
      if (r.status === 'ok') { ok++; totalBytes += r.bytes ?? 0; process.stdout.write('.') }
      else if (r.status === 'skip') { skip++; process.stdout.write('-') }
      else { fail++; failures.push({ id: r.id, err: r.err ?? 'unknown' }); process.stdout.write('x') }
    }
  })
  await Promise.all(workers)
  console.log('')

  console.log(`\n✓ downloaded: ${ok}`)
  console.log(`- skipped (already on disk): ${skip}`)
  console.log(`✗ failed: ${fail}`)
  console.log(`total new bytes: ${(totalBytes / 1024).toFixed(1)} KB`)
  if (failures.length) {
    console.log('\nFailures:')
    failures.forEach((f) => console.log(`  id=${f.id}: ${f.err}`))
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
