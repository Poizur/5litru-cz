// Generates Czech SEO alt text for images with empty alt_text in
// data/images.json, via Claude Haiku Vision (base64 of local file).
// Updates data/images.json in-place.
//
// Run: npx tsx --env-file=.env.local scripts/wp-generate-alt-texts.ts
//
// Cost: 27 images × ~$0.001 ≈ $0.03 total.

import { readFile, writeFile } from 'node:fs/promises'
import { extname, basename, join } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'

const IMAGES_JSON = join(process.cwd(), 'data', 'images.json')
const PUBLIC_IMAGES = join(process.cwd(), 'public', 'images')

interface ImageRow {
  id: string
  file_path: string
  public_url: string
  alt_text: string
  title: string
}

function guessMediaType(filename: string): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif' | null {
  const ext = extname(filename).toLowerCase()
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.avif') return 'image/avif'
  return null
}

async function genAlt(client: Anthropic, img: ImageRow): Promise<string | null> {
  const localPath = join(PUBLIC_IMAGES, img.file_path)
  const mediaType = guessMediaType(img.file_path)
  if (!mediaType) {
    console.warn(`  skip ${img.id}: unknown media type for ${img.file_path}`)
    return null
  }
  // Anthropic image input doesn't accept AVIF currently — fall back to URL.
  if (mediaType === 'image/avif') {
    return genAltViaUrl(client, img)
  }
  let base64: string
  try {
    base64 = (await readFile(localPath)).toString('base64')
  } catch (e) {
    console.warn(`  skip ${img.id}: ${(e as Error).message}`)
    return null
  }

  const filenameHint = basename(img.file_path, extname(img.file_path))

  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    system:
      'Jsi SEO copywriter pro český web o olivovém oleji 5litru.cz. ' +
      'Napiš popisný alt text v češtině, 8–15 slov, bez marketingových frází. ' +
      'Vrať POUZE samotný alt text — nic dalšího, žádné uvozovky, žádný "Alt:".',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          {
            type: 'text',
            text: `Filename hint: ${filenameHint}\nNapiš alt text pro tento obrázek.`,
          },
        ],
      },
    ],
  })

  const block = resp.content[0]
  if (block?.type !== 'text') return null
  return block.text.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, ' ')
}

async function genAltViaUrl(client: Anthropic, img: ImageRow): Promise<string | null> {
  const filenameHint = basename(img.file_path, extname(img.file_path))
  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    system:
      'Jsi SEO copywriter pro český web o olivovém oleji 5litru.cz. ' +
      'Napiš popisný alt text v češtině, 8–15 slov, bez marketingových frází. ' +
      'Vrať POUZE samotný alt text.',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'url', url: img.public_url } },
          { type: 'text', text: `Filename hint: ${filenameHint}\nNapiš alt text pro tento obrázek.` },
        ],
      },
    ],
  })
  const block = resp.content[0]
  if (block?.type !== 'text') return null
  return block.text.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, ' ')
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing')
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const raw = await readFile(IMAGES_JSON, 'utf8')
  const images: ImageRow[] = JSON.parse(raw)
  const todo = images.filter((i) => !i.alt_text || !i.alt_text.trim())
  console.log(`→ ${todo.length} images need alt text (out of ${images.length})`)

  let ok = 0, fail = 0, totalCost = 0
  const concurrency = 4
  const queue = [...todo]

  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (queue.length) {
        const img = queue.shift()
        if (!img) return
        try {
          const alt = await genAlt(client, img)
          if (alt) {
            img.alt_text = alt
            ok++
            // Rough cost estimate per call:
            // input ≈ 1200 tokens × $0.80/M = $0.00096
            // output ≈ 30 tokens × $4/M = $0.00012
            totalCost += 0.0011
            console.log(`  ✓ ${img.id} → "${alt}"`)
          } else {
            fail++
            console.log(`  ✗ ${img.id} → no alt returned`)
          }
        } catch (e) {
          fail++
          console.log(`  ✗ ${img.id} → ${(e as Error).message.slice(0, 80)}`)
        }
      }
    })
  )

  await writeFile(IMAGES_JSON, JSON.stringify(images, null, 2), 'utf8')
  console.log(`\n✓ ${ok} alts generated, ✗ ${fail} failed`)
  console.log(`estimated cost: ~$${totalCost.toFixed(3)}`)
  console.log(`data/images.json updated`)
}

main().catch((e) => { console.error(e); process.exit(1) })
