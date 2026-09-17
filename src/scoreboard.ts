import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { LogRecord, Mandate } from "./types.js";

// scoreboard.ts — rebuild out/bakeoff.md from both jsonl logs after every
// meaningful action (intent/fill/snapshot/close). Columns:
//
//   peak LTV · min gap to call (call − peak LTV) · max DD vs 10 000 ·
//   sum overnight tax bps on fills · open-window PnL

const OUT_DIR = join(process.cwd(), "out");
const HAIR_LOG = join(process.cwd(), "logs", "haircut.jsonl");
const NAIVE_LOG = join(process.cwd(), "logs", "naive.jsonl");

function readJsonl(path: string): LogRecord[] {
  try {
    return readFileSync(path, "utf-8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as LogRecord);
  } catch {
    return [];
  }
}

interface Stats {
  peakLtv: number;
  minGapToCall: number;
  maxDD: number;
  overnightTaxBps: number;
  openWindowPnl: number;
}

function computeStats(logs: LogRecord[], mandate: Mandate): Stats {
  let peakLtv = 0;
  let minGapToCall = mandate.ltv.call;
  let maxEquity = 10_000;
  let maxDD = 0;
  let taxBpsSum = 0;
  let openWindowPnl = 0;
  let windowEntries = 0;

  for (const r of logs) {
    const ltv = Number(r.ltv ?? 0);
    const eq = Number(r.equity ?? 0);
    if (ltv > peakLtv) peakLtv = ltv;
    const gap = mandate.ltv.call - ltv;
    if (gap < minGapToCall) minGapToCall = gap;
    if (eq > maxEquity) maxEquity = eq;
    const dd = maxEquity > 0 ? (maxEquity - eq) / maxEquity : 0;
    if (dd > maxDD) maxDD = dd;
    taxBpsSum += Number(r.tax_bps ?? 0);
    if (r.session === "OPEN_WINDOW" && eq > 0) {
      openWindowPnl += eq - 10_000;
      windowEntries++;
    }
  }

  return {
    peakLtv: Number((peakLtv * 100).toFixed(1)),
    minGapToCall: Number((minGapToCall * 100).toFixed(1)),
    maxDD: Number((maxDD * 100).toFixed(1)),
    overnightTaxBps: taxBpsSum,
    openWindowPnl: windowEntries > 0 ? Number(openWindowPnl.toFixed(2)) : 0,
  };
}

export function rebuildScoreboard(mandate: Mandate): void {
  mkdirSync(OUT_DIR, { recursive: true });
  const hairLogs = readJsonl(HAIR_LOG);
  const naiveLogs = readJsonl(NAIVE_LOG);
  const hair = computeStats(hairLogs, mandate);
  const naive = computeStats(naiveLogs, mandate);
  const dt = new Date().toISOString().slice(0, 19);
  const md = `# Bakeoff — Haircut vs Naive

Updated: ${dt} UTC

| Metric | Haircut | Naive |
|--------|---------|-------|
| Peak LTV % | ${hair.peakLtv} | ${naive.peakLtv} |
| Min gap to call % | ${hair.minGapToCall} | ${naive.minGapToCall} |
| Max drawdown % vs 10 000 | ${hair.maxDD} | ${naive.maxDD} |
| Sum overnight tax bps on fills | ${hair.overnightTaxBps} | ${naive.overnightTaxBps} |
| Open-window PnL (USDT) | ${hair.openWindowPnl} | ${naive.openWindowPnl} |

---
Manual rows will be appended after the first autopsy (09:30–09:45 ET window).
`;
  writeFileSync(join(OUT_DIR, "bakeoff.md"), md);
}
