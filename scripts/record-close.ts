import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { currentSession, etTimestamp } from "../src/clock.js";
import { appendLog, appendEvent, closeSnapshot, ensureLogs } from "../src/snapshot.js";
import { rebuildScoreboard } from "../src/scoreboard.js";
import type { CashClose, Mandate, LogRecord } from "../src/types.js";

// scripts/record-close.ts — called at mandate.cash_close_et to snapshot cash close.
// Exported as `npm run close-snap`. Records marks + book snapshot and writes
// state/last_cash_close.json for the next session. Each close bumps
// state/close_count.txt, which the overnight lock uses to tell "night one" apart
// from a close whose autopsy was never recorded.

const CLOSE_COUNT_FILE = join(process.cwd(), "state", "close_count.txt");

function bumpCloseCount(): number {
  let n = 0;
  try {
    n = Number.parseInt(readFileSync(CLOSE_COUNT_FILE, "utf-8").trim(), 10) || 0;
  } catch {
    /* first close */
  }
  writeFileSync(CLOSE_COUNT_FILE, String(n + 1));
  return n + 1;
}

async function closeSnap(): Promise<number> {
  ensureLogs();
  const mandate: Mandate = JSON.parse(
    readFileSync(join(process.cwd(), "mandate.json"), "utf-8")
  );
  const session = currentSession(mandate.open_window_et, mandate.cash_close_et);

  // Pull last known marks (if available), else snapshot now.
  let rtokenMid = 0;
  let perpMid = 0;
  try {
    const { marketTicker } = await import("../src/hub.js");
    const [rtok, perp] = await Promise.all([
      marketTicker(mandate.sleeve.rtoken, mandate),
      marketTicker(mandate.sleeve.perp, mandate),
    ]);
    rtokenMid = rtok.ok && rtok.data ? rtok.data.last : 0;
    perpMid = perp.ok && perp.data ? perp.data.last : 0;
  } catch {
    const { appendEvent } = await import("../src/snapshot.js");
    appendEvent({ kind: "error", session, error: "marks unavailable at close" });
  }

  const date = new Date().toISOString().slice(0, 10);
  const cashClose: CashClose = {
    date,
    at: new Date().toISOString(),
    rtokenMid,
    perpMid,
    sessionTaxBps: 0,
    source: "close",
  };

  const marks = {
    at: cashClose.at,
    source: "hub" as const,
    mid: { rtoken: rtokenMid, perp: perpMid },
    book: {
      rtoken: { ts: cashClose.at, bids: [], asks: [] },
      perp: { ts: cashClose.at, bids: [], asks: [] },
    },
  };

  closeSnapshot(mandate, marks, session, cashClose);

  // SNAP row per book, strict schema, both files identical shape.
  const snap = (account: "haircut" | "naive", ltv: number, equity: number): LogRecord => ({
    ts: cashClose.at,
    et: etTimestamp(),
    account,
    session,
    action: "SNAP",
    symbol: mandate.sleeve.rtoken,
    px: rtokenMid,
    qty: 0,
    notional: 0,
    equity,
    ltv,
    proj_ltv: ltv,
    tax_bps: cashClose.sessionTaxBps,
    btc_move_since_close: 0,
    reason: "cash_close",
    hash: null,
    ok: true,
    hub: "paper",
  });
  appendLog(snap("haircut", 0, 10_000));
  appendLog(snap("naive", 0, 10_000));

  mkdirSync(join(process.cwd(), "state"), { recursive: true });
  writeFileSync(
    join(process.cwd(), "state", "last_cash_close.json"),
    JSON.stringify(cashClose, null, 2)
  );
  bumpCloseCount();
  rebuildScoreboard(mandate);
  console.log(`close-snap: ${date} et=${etTimestamp()} rtoken=${rtokenMid} perp=${perpMid}`);
  return 0;
}

closeSnap()
  .then((c) => { process.exitCode = c; })
  .catch((e) => { console.error(e); process.exitCode = 1; });