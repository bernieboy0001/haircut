import { mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import type {
  BookState,
  CashClose,
  LogRecord,
  Mandate,
  Marks,
  Session,
} from "./types.js";

// snapshot.ts — book accounting and cash-close snapshots for both actors.
//
// Books:
//   - Haircut  rides the real paper account (spot rToken + BTC perp). Its
//     equity comes from the Hub (account overview + positions).
//   - Naive    is a shadow book on the SAME marks: it buys the overnight
//     rToken print once per session and holds the perp. Nothing is executed
//     for Naive unless the paper account supports a second sleeve; by default
//     Naive is marked from the same ticker data (disclosed in DISCLOSURE.md).

const LOG_DIR = join(process.cwd(), "logs");

export function ensureLogs(): void {
  mkdirSync(LOG_DIR, { recursive: true });
  mkdirSync(join(LOG_DIR, "autopsies"), { recursive: true });
}

export function appendLog(record: LogRecord): void {
  ensureLogs();
  const file =
    record.account === "naive"
      ? join(LOG_DIR, "naive.jsonl")
      : join(LOG_DIR, "haircut.jsonl");
  appendFileSync(file, JSON.stringify(record) + "\n");
}

export function appendEvent(ev: Record<string, unknown>): void {
  ensureLogs();
  appendFileSync(
    join(LOG_DIR, "events.jsonl"),
    JSON.stringify({ ts: new Date().toISOString(), ...ev }) + "\n"
  );
}

export interface BookSnapshot {
  book: BookState;
  equity: number;
}

export function buildHaircutBook(
  mandate: Mandate,
  overview: { usdtEquity: number; available: number; spotUsdt: number; futuresEquity: number },
  perpPosition: { sizeNotional: number } | null,
  debt: number,
  rtokenMid: number
): BookSnapshot {
  const rtokenNotional = Math.max(0, overview.spotUsdt);
  const perpNotional = perpPosition?.sizeNotional ?? 0;
  const equity = overview.usdtEquity;
  return {
    book: {
      symbol: mandate.sleeve.rtoken,
      collateralNotional: rtokenNotional,
      perpNotional,
      debt,
      cash: overview.available,
      equity,
    },
    equity,
  };
}

export function closeSnapshot(
  mandate: Mandate,
  marks: Marks,
  session: Session,
  cashClose: CashClose
): void {
  appendEvent({
    kind: "close",
    session,
    date: cashClose.date,
    at: cashClose.at,
    rtoken_mid: marks.mid.rtoken,
    perp_mid: marks.mid.perp,
    session_tax_bps: cashClose.sessionTaxBps,
    source: cashClose.source,
  });
}
