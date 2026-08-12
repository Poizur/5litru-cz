#!/usr/bin/env tsx
/**
 * Build-time schema guard — UZÁVĚRA-1.
 * Skenuje *.ts/*.tsx a křížuje Supabase column refs s schema-snapshot.json.
 * Selže (exit 1) pokud kód referencuje neexistující sloupec.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

const ROOT = join(__dirname, '..')
const SNAPSHOT_PATH = join(ROOT, 'supabase', 'schema-snapshot.json')

const snapshot: Record<string, string[]> = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'))
delete (snapshot as Record<string, unknown>)['_meta']

const KNOWN_TABLES = new Set(Object.keys(snapshot))
const KNOWN_COLS: Record<string, Set<string>> = {}
for (const [t, cols] of Object.entries(snapshot)) {
  KNOWN_COLS[t] = new Set(cols as string[])
}

const FROM_RE = /\.from\(['"]([a-z_]+)['"]\)/g
const SELECT_RE = /\.select\(['"]([^'"]+)['"]\)/g
const FILTER_RE = /\.(?:eq|neq|gt|gte|lt|lte|like|ilike|is|in|order)\(['"]([a-z_]+)['"]/g

interface Issue { file: string; line: number; table: string; col: string; context: string }

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '.claude', 'dist'])

function collectFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const s = statSync(full)
    if (s.isDirectory()) collectFiles(full, out)
    else if (['.ts', '.tsx'].includes(extname(full))) out.push(full)
  }
  return out
}

function parseSelectCols(raw: string): string[] {
  return raw.split(',')
    .map(s => s.trim().split('(')[0].split(':')[0].trim())
    .filter(c => c && !c.startsWith('*') && /^[a-z_]+$/.test(c))
}

function checkFile(filePath: string, issues: Issue[]): void {
  const lines = readFileSync(filePath, 'utf8').split('\n')
  let currentTable: string | null = null
  let currentTableLine = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNo = i + 1

    const fromMatches = [...line.matchAll(FROM_RE)]
    for (const m of fromMatches) {
      currentTable = m[1]
      currentTableLine = lineNo
    }

    if (!currentTable || !KNOWN_TABLES.has(currentTable)) continue

    for (const m of [...line.matchAll(SELECT_RE)]) {
      for (const col of parseSelectCols(m[1])) {
        if (!KNOWN_COLS[currentTable].has(col)) {
          issues.push({ file: relative(ROOT, filePath), line: lineNo, table: currentTable, col, context: `.select('${col}')` })
        }
      }
    }
    for (const m of [...line.matchAll(FILTER_RE)]) {
      const col = m[1]
      if (!KNOWN_COLS[currentTable].has(col)) {
        issues.push({ file: relative(ROOT, filePath), line: lineNo, table: currentTable, col, context: `filter on ${col}` })
      }
    }

    if (lineNo - currentTableLine > 15 && !fromMatches.length) currentTable = null
  }
}

function main() {
  const files = collectFiles(ROOT)
  const issues: Issue[] = []
  for (const f of files) checkFile(f, issues)

  if (!issues.length) {
    console.log(`[check-schema] ✓ OK — ${files.length} souborů, žádné neznámé sloupce`)
    process.exit(0)
  }

  console.error(`[check-schema] ✗ ${issues.length} neznámých sloupců:\n`)
  for (const i of issues) {
    console.error(`  ${i.file}:${i.line}  ${i.context} → tabulka '${i.table}' sloupec '${i.col}' není v snapshotu`)
    console.error(`  → Aplikuj migraci a spusť: npm run schema:snapshot\n`)
  }
  process.exit(1)
}

main()
