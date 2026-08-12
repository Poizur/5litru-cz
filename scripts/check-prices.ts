#!/usr/bin/env tsx
/**
 * CI price lint — UZÁVĚRA-2.
 * Hledá statické ceny v MDX mimo tokeny nebo review_mdx.
 * Neblokuje build — jen loguje WARNING.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

const ROOT = join(__dirname, '..')

const PRICE_RE = /\b(\d[\d\s]*[\d])\s*(Kč|CZK|€|EUR)\b/g
const RANGE_RE = /\b\d+[–\-]\d+\s*(Kč|CZK|€|EUR)\b/
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '.claude', 'dist'])
const TARGET_EXTS = new Set(['.mdx', '.md'])

interface Violation { file: string; line: number; text: string; severity: 'WARNING' | 'INFO' }

function collectFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const s = statSync(full)
    if (s.isDirectory()) collectFiles(full, out)
    else if (TARGET_EXTS.has(extname(full))) out.push(full)
  }
  return out
}

function checkFile(filePath: string, violations: Violation[]): void {
  const lines = readFileSync(filePath, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.includes('price_czk:') || line.includes('price_czk ')) continue
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue
    const matches = [...line.matchAll(PRICE_RE)]
    for (const _ of matches) {
      violations.push({
        file: relative(ROOT, filePath),
        line: i + 1,
        text: line.trim().slice(0, 120),
        severity: RANGE_RE.test(line) ? 'INFO' : 'WARNING',
      })
    }
  }
}

function main() {
  const files = collectFiles(ROOT)
  const violations: Violation[] = []
  for (const f of files) checkFile(f, violations)

  if (!violations.length) {
    console.log(`[check-prices] ✓ Žádné statické ceny v ${files.length} MDX souborech`)
    process.exit(0)
  }

  const warnings = violations.filter(v => v.severity === 'WARNING')
  const infos = violations.filter(v => v.severity === 'INFO')

  if (infos.length) {
    console.log(`[check-prices] INFO — cenové rozsahy (editorial, ověř aktuálnost):`)
    for (const v of infos) console.log(`  ${v.file}:${v.line}  ${v.text.slice(0, 80)}`)
    console.log()
  }
  if (warnings.length) {
    console.warn(`[check-prices] ⚠ ${warnings.length} statická cena mimo token:`)
    for (const v of warnings) console.warn(`  ${v.file}:${v.line}  ${v.text.slice(0, 80)}`)
  }
  process.exit(0)
}

main()
