// sync-snapshot.mjs — freeze engine state into src/data/snapshot.json.
// Run: `npm run sync` (also runs automatically as `prebuild`).
// No dependencies. The dashboard renders this file; no backend involved.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const outDir = join(here, '..', 'src', 'data')

function readLines(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l)
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}

function summarize(rows) {
  if (rows.length === 0) return null
  const last = rows[rows.length - 1]
  return {
    equity: last.equity ?? 10_000,
    peakLtv: Math.max(...rows.map((r) => r.ltv ?? 0)),
    peakProjLtv: Math.max(...rows.map((r) => r.proj_ltv ?? 0)),
    taxOnFills: rows
      .filter((r) => r.action === 'FIRE' || r.action === 'BUY')
      .reduce((s, r) => s + (r.tax_bps ?? 0), 0),
    actions: rows.length,
    lastTs: last.ts ?? null,
    lastPx: last.px ?? null,
    lastSession: last.session ?? null,
    lastAction: last.action ?? null,
  }
}

const haircutRows = readLines(join(root, 'logs', 'haircut.jsonl'))
const naiveRows = readLines(join(root, 'logs', 'naive.jsonl'))

// Autopsies, oldest → newest.
const autopsyDir = join(root, 'logs', 'autopsies')
let autopsies = []
if (existsSync(autopsyDir)) {
  autopsies = readdirSync(autopsyDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => readJson(join(autopsyDir, f)))
    .filter(Boolean)
}

// Ledger: interleaved, newest first, capped.
const ledger = [...haircutRows, ...naiveRows]
  .sort((a, b) => String(a.ts).localeCompare(String(b.ts)))
  .slice(-14)
  .reverse()

const snapshot = {
  generatedAt: new Date().toISOString(),
  haircut: summarize(haircutRows),
  naive: summarize(naiveRows),
  autopsies,
  ledger,
  ticket: readJson(join(root, 'state', 'ticket.json')),
  lastHash: existsSync(join(root, 'state', 'last_hash.txt'))
    ? readFileSync(join(root, 'state', 'last_hash.txt'), 'utf8').trim()
    : null,
  hasAutopsy: autopsies.length > 0,
}

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'snapshot.json'), JSON.stringify(snapshot, null, 2) + '\n')
console.log(
  `snapshot: haircut=${haircutRows.length} rows, naive=${naiveRows.length} rows, autopsies=${autopsies.length}`,
)
