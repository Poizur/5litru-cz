/**
 * Prebuild kontrola: <Link href="/go/…"> je zakázaný — Next router /go/ prefetchuje
 * (zbytečné requesty na affiliate route). Pro /go/ používej obyčejné <a>.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIRS = ['app', 'components', 'lib']
const LINK_IMPORT = /from\s+['"]next\/link['"]/
const LINK_TAG = /<Link\b[\s\S]*?>/g

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const e of entries) {
    const full = join(dir, e)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(e)) out.push(full)
  }
  return out
}

const hits: string[] = []
for (const f of DIRS.flatMap((d) => walk(d))) {
  const src = readFileSync(f, 'utf8')
  if (!LINK_IMPORT.test(src)) continue
  for (const m of src.matchAll(LINK_TAG)) {
    if (!m[0].includes('/go/')) continue
    const line = src.slice(0, m.index).split('\n').length
    hits.push(`${f}:${line}`)
  }
}

if (hits.length > 0) {
  console.error(`[check-go-links] ✗ <Link> na /go/ (použij <a>):\n  ${hits.join('\n  ')}`)
  process.exit(1)
}
console.log('[check-go-links] ✓ žádný <Link> na /go/')
